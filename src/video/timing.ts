// Plain module (no React/fonts) so the Node render CLI can import it too
export const REEL_TIMING = {
  hook: 75,
  perPage: 40,
  outro: 120,
  // Scenes overlap so the next one can fade in over the previous
  crossfade: 10,
};

/** Scene lengths in frames; a voiceover measures its own, a silent reel uses REEL_TIMING */
export type SceneLengths = Pick<typeof REEL_TIMING, 'hook' | 'perPage' | 'outro'>;

export const reelTiming = (measured?: SceneLengths) => ({ ...REEL_TIMING, ...measured });

export const reelDuration = (pageCount: number, measured?: SceneLengths) => {
  const { hook, perPage, outro } = reelTiming(measured);
  return hook + pageCount * perPage + outro;
};
