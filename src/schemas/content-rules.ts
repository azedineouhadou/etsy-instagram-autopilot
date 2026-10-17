// Shop choices, stricter than Instagram's own limits (instagram-limits.ts). No imports: src/render/spec.ts uses this too.
export const CONTENT_RULES = {
  // Instagram allows up to 10; for e-commerce we aim for 5–6 (cover, pages, CTA)
  carouselMinSlides: 2,
  carouselMaxSlides: 6,
  carouselRecommendedMinSlides: 5,
} as const;
