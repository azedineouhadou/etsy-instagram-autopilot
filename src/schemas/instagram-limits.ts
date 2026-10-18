// Platform limits change — re-check against Meta's docs when a publish fails validation it used to pass.
export const INSTAGRAM_LIMITS = {
  captionMaxChars: 2200,
  // Instagram cut the per-post hashtag cap to 5 in Dec 2025 (per the instagram-agent-skill README).
  hashtagsMax: 5,
  carouselMinItems: 2,
  carouselMaxItems: 10,
  // Product library images can be PNG; anything we hand to Instagram must be JPEG
  imageExtensions: ['.png', '.jpg', '.jpeg'],
  publishImageExtensions: ['.jpg', '.jpeg'],
  videoExtensions: ['.mp4'],
} as const;
