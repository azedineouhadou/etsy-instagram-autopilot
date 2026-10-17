export type EtsyLink = { listingId: string; slug: string; url: string };

// Handles locale prefixes (/fr/, /en-gb/) and tracking params (?ref=…, ?ls=…)
const LISTING = /etsy\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?listing\/(\d{6,12})(?:\/([a-z0-9-]+))?/i;
const SLUG_WORDS = 5;

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
    slug: fullSlug.split('-').filter(Boolean).slice(0, SLUG_WORDS).join('-'),
    url: `https://www.etsy.com/listing/${listingId}${fullSlug ? `/${fullSlug}` : ''}`,
  };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, SLUG_WORDS)
    .join('-');
}
