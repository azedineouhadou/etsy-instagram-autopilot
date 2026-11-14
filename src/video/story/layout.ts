// Where things sit in the 1080×1920 story reel

/** Scenes and stickers live here; zoomed images are clipped to it so they never run under the captions */
export const STAGE = { top: 0, height: 1250 } as const;
/** Instagram's top bar (Reels title, camera icon) covers about this much: no stickers above it */
export const TOP_SAFE = 150;
/** Instagram draws the caption, username and buttons over the bottom of a reel (same estimate as PageFlipReel) */
export const SAFE_BOTTOM = 380;
/** Captions sit between the stage and the safe bottom */
export const CAPTIONS = { top: 1275, bottom: 1920 - SAFE_BOTTOM } as const;
