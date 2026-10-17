// Plain module (no React/fonts) so the Node render CLI can import it too
export const REEL_TIMING = {
  hook: 75,
  perPage: 40,
  outro: 120,
  // Scenes overlap so the next one can fade in over the previous
  crossfade: 10,
};

export const reelDuration = (pageCount: number) => REEL_TIMING.hook + pageCount * REEL_TIMING.perPage + REEL_TIMING.outro;
