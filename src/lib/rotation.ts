import type { Post } from '../schemas/post.js';

export const MIN_GAP_DAYS = 3;
export const MAX_PER_WEEK = 2;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

type Entry = { post: Post; at: number; queued: boolean };

/**
 * Flags queued posts that feature the same book too often, so the feed doesn't
 * look like it only sells one product. Returned messages are warnings: they show
 * in the validator output but don't block the batch.
 *
 * Rules: at least MIN_GAP_DAYS between posts of the same listing, and at most
 * MAX_PER_WEEK posts of it in any 7-day window — counting published posts too,
 * so a new batch doesn't repeat the end of the last one.
 */
export function findRotationIssues(queued: Post[], published: Post[]): string[] {
  const timeline: Entry[] = [
    ...published.map((post) => ({ post, at: Date.parse(post.scheduledAt), queued: false })),
    // Unapproved posts won't go out, so holding one back shouldn't warn about its neighbours
    ...queued.filter((post) => post.approved).map((post) => ({ post, at: Date.parse(post.scheduledAt), queued: true })),
  ].sort((a, b) => a.at - b.at);

  const byListing = new Map<string, Entry[]>();
  for (const entry of timeline) {
    const entries = byListing.get(entry.post.listingId) ?? [];
    entries.push(entry);
    byListing.set(entry.post.listingId, entries);
  }

  const issues: string[] = [];
  for (const [listingId, entries] of byListing) {
    entries.forEach((entry, i) => {
      // Published posts are history; only warn where the batch can still change
      if (!entry.queued) return;

      const previous = entries[i - 1];
      if (previous) {
        const gapDays = (entry.at - previous.at) / DAY_MS;
        if (gapDays < MIN_GAP_DAYS) {
          issues.push(
            `post ${entry.post.id}: listing ${listingId} was featured ${round(gapDays)} day(s) earlier in ${previous.post.id} (minimum ${MIN_GAP_DAYS})`,
          );
        }
      }

      const inWindow = entries.slice(0, i + 1).filter((e) => entry.at - e.at < WEEK_MS).length;
      if (inWindow > MAX_PER_WEEK) {
        issues.push(`post ${entry.post.id}: listing ${listingId} appears ${inWindow} times in 7 days (max ${MAX_PER_WEEK})`);
      }
    });
  }
  return issues;
}

function round(days: number): number {
  return Math.round(days * 10) / 10;
}
