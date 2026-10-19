import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findBannedPhrases } from './content-rules.js';

describe('findBannedPhrases', () => {
  it('catches reseller talk however it is written', () => {
    assert.equal(findBannedPhrases('PLR + MRR included').length, 1);
    assert.equal(findBannedPhrases('Ready for KDP').length, 1);
    assert.equal(findBannedPhrases('Upload it to Amazon').length, 1);
    assert.equal(findBannedPhrases('Resell it and keep 100%').length, 1);
    assert.equal(findBannedPhrases('#plrcoloringpages').length, 0, 'inside a hashtag word is not a whole-word match');
    assert.equal(findBannedPhrases('#PLR').length, 1);
    assert.equal(findBannedPhrases('Commercial use allowed, build passive income').length, 1);
  });

  it('catches health and guarantee claims', () => {
    assert.ok(findBannedPhrases('Great for therapy sessions')[0]?.includes('health'));
    assert.equal(findBannedPhrases('an ADHD treatment').length, 1);
    assert.equal(findBannedPhrases('Guaranteed calm').length, 1);
  });

  it('leaves normal captions alone', () => {
    const caption = 'Pour something warm, pick a page and let autumn fill in. A little Halloween treat. Link in bio';
    assert.deepEqual(findBannedPhrases(caption), []);
  });
});
