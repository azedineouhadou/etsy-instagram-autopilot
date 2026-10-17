export type EtsyLink = { listingId: string; slug: string; url: string };

// Handles locale prefixes (/fr/, /en-gb/) and tracking params (?ref=…, ?ls=…)
const LISTING = /etsy\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?listing\/(\d{6,12})(?:\/([a-z0-9-]+))?/i;
const SLUG_WORDS = 5;
// Cut slugs shouldn't end mid-phrase ("…-color-by-number-for")
const TRAILING_FILLERS = new Set(['for', 'and', 'with', 'the', 'of', 'to', 'a', 'an', 'in', 'by', 'on']);

function shortSlug(words: string[]): string {
  const kept = words.filter(Boolean).slice(0, SLUG_WORDS);
  while (kept.length > 1 && TRAILING_FILLERS.has(kept[kept.length - 1] ?? '')) kept.pop();
  return kept.join('-');
}

export function parseEtsyLink(text: string): EtsyLink | { error: string } {
  if (/etsy\.me\//i.test(text)) {
    return { error: 'short etsy.me link — open it in the browser and copy the full etsy.com/listing/… address' };
  }
  const match = LISTING.exec(text);
  if (!match?.[1]) return { error: 'no etsy.com/listing/<number> link found' };

  const listingId = match[1];
  const fullSlug = (match[2] ?? '').toLowerCase();
  return {
    listingId,
    slug: shortSlug(fullSlug.split('-')),
    url: `https://www.etsy.com/listing/${listingId}${fullSlug ? `/${fullSlug}` : ''}`,
  };
}

export function slugify(text: string): string {
  return shortSlug(
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .split(/[\s_-]+/),
  );
}
