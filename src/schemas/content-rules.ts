// Shop choices, stricter than Instagram's own limits (instagram-limits.ts). No imports: src/render/spec.ts uses this too.
export const CONTENT_RULES = {
  // Instagram allows up to 10; for e-commerce we aim for 5–6 (cover, pages, CTA)
  carouselMinSlides: 2,
  carouselMaxSlides: 6,
  carouselRecommendedMinSlides: 5,
} as const;

/**
 * Words that must never reach Instagram (brand/voice.md "Off limits"): reseller talk — the feed is for
 * people who color, even when a listing sells resale rights — and health claims.
 * "treat" alone isn't listed: "Halloween treat" is fine; "treatment" isn't.
 */
export const BANNED_PHRASES: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(PLR|MRR)\b/i, reason: 'resale rights' },
  { pattern: /\bKDP\b|\bkindle direct\b|\bamazon\b/i, reason: 'reseller platform' },
  { pattern: /\bresell\w*|\bresale\b|\bsell (it|them|this) as your own\b|\bprivate label\b/i, reason: 'reselling' },
  { pattern: /\bcommercial use\b|\bpassive income\b|\bprint[- ]on[- ]demand\b/i, reason: 'reselling' },
  { pattern: /\btherap\w*|\btreatment\b|\bcures?\b|\bguarantee\w*/i, reason: 'health or guarantee claim' },
];

/** Every banned phrase found in the text, e.g. ['"PLR" (resale rights)'] */
export function findBannedPhrases(text: string): string[] {
  return BANNED_PHRASES.flatMap(({ pattern, reason }) => {
    const match = text.match(pattern);
    return match ? [`"${match[0]}" (${reason})`] : [];
  });
}
