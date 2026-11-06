import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { REEL_TIMING, reelDuration, reelTiming } from './timing.js';

describe('reelTiming', () => {
  it('keeps the fixed scene lengths for a silent reel', () => {
    assert.deepEqual(reelTiming(undefined), REEL_TIMING);
    assert.equal(reelDuration(5), 75 + 5 * 40 + 120);
  });

  it('uses the scene lengths measured from a voiceover', () => {
    const measured = { hook: 107, perPage: 43, outro: 210 };
    assert.deepEqual(reelTiming(measured), { ...measured, crossfade: REEL_TIMING.crossfade });
    assert.equal(reelDuration(5, measured), 107 + 5 * 43 + 210);
  });
});
