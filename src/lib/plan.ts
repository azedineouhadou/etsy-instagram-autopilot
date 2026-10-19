import type { Post } from '../schemas/post.js';
import type { Product } from '../schemas/product.js';
import { MAX_PER_WEEK, MIN_GAP_DAYS } from './rotation.js';
import type { Slot } from './schedule.js';

export type Format = 'reel' | 'carousel' | 'spotlight';

export type PlannedPost = {
  slot: Slot;
  format: Format;
  product: Product;
  /** Rotation rules this pick still breaks because no book fit better */
  warnings: string[];
};

const DAY_MS = 86_400_000;

/**
 * Format mix for a week: reels reach non-followers, carousels earn saves, spotlights are cheap filler.
 * Interleaved so the same format doesn't land on consecutive days.
 */
export function formatMix(count: number): Format[] {
  const want: Record<Format, number> = {
    reel: count >= 4 ? 2 : 1,
    carousel: count >= 3 ? 2 : count >= 2 ? 1 : 0,
    spotlight: 0,
  };
  want.spotlight = Math.max(0, count - want.reel - want.carousel);
  const order: Format[] = ['reel', 'carousel', 'spotlight'];
  const mix: Format[] = [];
  while (mix.length < count) {
    for (const f of order) {
      if (want[f] > 0 && mix.length < count) {
        mix.push(f);
        want[f]--;
      }
    }
  }
  return mix;
}

/** Formats a book has enough images for: carousels want 4 pages, reels at least 2 */
export function canMake(product: Product, format: Format): boolean {
  if (format === 'carousel') return product.interior.length >= 4;
  if (format === 'reel') return product.interior.length >= 2;
  return product.mockups.length >= 1;
}

/**
 * Picks a book for each slot. Prefers books that break no rotation rule, then the one featured
 * longest ago, then the one featured least — so a growing library gets spread evenly.
 * `history` is every published and already-queued post.
 */
export function assignBooks(slots: Slot[], formats: Format[], products: Product[], history: Post[]): PlannedPost[] {
  const featured = new Map<string, number[]>();
  const note = (id: string, at: number) => featured.set(id, [...(featured.get(id) ?? []), at].sort((a, b) => a - b));
  for (const post of history) note(post.listingId, Date.parse(post.scheduledAt));

  return slots.map((slot, i) => {
    const at = Date.parse(slot.scheduledAt);
    let format = formats[i] ?? 'spotlight';
    const usable = products.filter((p) => canMake(p, format));
    // If no book has enough pages for this format, fall back to a single image
    if (!usable.length) format = 'spotlight';

    const scored = (usable.length ? usable : products).map((product) => {
      const times = featured.get(product.listingId) ?? [];
      const warnings = rotationProblems(product, times, at);
      const last = times.filter((t) => t < at).at(-1) ?? -Infinity;
      return { product, warnings, last, total: times.length };
    });
    scored.sort(
      (a, b) =>
        a.warnings.length - b.warnings.length ||
        a.last - b.last ||
        a.total - b.total ||
        a.product.listingId.localeCompare(b.product.listingId),
    );

    const pick = scored[0]!;
    note(pick.product.listingId, at);
    return { slot, format, product: pick.product, warnings: pick.warnings };
  });
}

function rotationProblems(product: Product, times: number[], at: number): string[] {
  const problems: string[] = [];
  const nearest = Math.min(...times.map((t) => Math.abs(at - t)));
  if (Number.isFinite(nearest) && nearest < MIN_GAP_DAYS * DAY_MS) {
    problems.push(`featured ${Math.round((nearest / DAY_MS) * 10) / 10} day(s) apart (minimum ${MIN_GAP_DAYS})`);
  }
  const inWeek = times.filter((t) => t <= at && at - t < 7 * DAY_MS).length + 1;
  if (inWeek > MAX_PER_WEEK) problems.push(`${inWeek} times in 7 days (max ${MAX_PER_WEEK})`);
  return problems;
}

export function audience(product: Product): 'adults' | 'kids' {
  return product.ageRange.min >= 18 ? 'adults' : 'kids';
}
