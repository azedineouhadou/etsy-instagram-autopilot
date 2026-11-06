import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { alignParts, MIN_ACCURACY, planReelTiming, spokenWords, wordAccuracy } from './voiceover.js';

describe('spokenWords', () => {
  it('treats digits and spelled-out numbers as the same words', () => {
    assert.deepEqual(spokenWords('Sixty-six scenes'), spokenWords('66 scenes'));
    assert.deepEqual(spokenWords('Twenty-three covers.'), ['twenty', 'three', 'covers']);
    assert.deepEqual(spokenWords('137 pages'), ['one', 'hundred', 'thirty', 'seven', 'pages']);
  });
});

describe('wordAccuracy', () => {
  const script = 'Give them a gift you printed yourself. Sixty-six country Christmas scenes';

  it('scores a take that says the script as 1', () => {
    assert.equal(wordAccuracy(script, 'Give them a gift you printed yourself 66 country Christmas scenes'), 1);
  });

  it('scores the garbled take from the voice test far below a usable take', () => {
    assert.ok(wordAccuracy(script, 'Sixty-six countries, six vintage trucks, trees, snowing trees.') < 0.5);
  });

  it('rejects a take that repeats words, as a real test take did', () => {
    const line = 'Screens off. Now what? Thirty-seven hands-on pages of mazes, tracing, and memory games. Short, varied activities for busy little hands. Screen-free quiet time, with room for their imagination. Print as many times as you need. Link in bio.';
    const stutter = line.replace('Now what?', 'Now what time? Now what?');
    assert.ok(wordAccuracy(line, stutter) < MIN_ACCURACY);
  });

  it('accepts a take with one misheard word', () => {
    const line = 'Thirty-seven hands-on pages of mazes, tracing, and memory games. Short, varied activities for busy little hands. Screen-free quiet time, with room for their imagination. Print as many times as you need. Link in bio.';
    assert.ok(wordAccuracy(line, line.replace('busy', 'dizzy')) >= MIN_ACCURACY);
  });

  it('scores an empty transcript as 0', () => {
    assert.equal(wordAccuracy(script, ''), 0);
  });
});

describe('alignParts', () => {
  const heard = (text: string, secondsPerWord = 0.5) =>
    text.split(' ').map((word, i) => ({ word, start: i * secondsPerWord, end: (i + 1) * secondsPerWord }));

  it('finds where each part starts and ends, counting a digit as the words it stands for', () => {
    const times = alignParts(
      { hook: 'One two.', pages: 'Sixty-six scenes.', outro: 'Link in bio.' },
      heard('one two 66 scenes link in bio'),
    );
    assert.deepEqual(times, { hookEnd: 1, pagesStart: 1, outroStart: 2, end: 3.5 });
  });
});

describe('planReelTiming', () => {
  // Measured from the approved slower take, with its 0.4 s lead-in
  const approved = { hookEnd: 3.02, pagesStart: 4.1, outroStart: 10.52, end: 16.74 };

  it('switches scenes in the pause between lines, and the closing scene just before its line', () => {
    const t = planReelTiming(approved, 5);
    assert.equal(t.hook, 107); // 3.56 s, halfway through the pause
    assert.equal(t.perPage, 43);
    const outroStarts = (t.hook + 5 * t.perPage - 10) / 30;
    assert.ok(outroStarts > 10 && outroStarts < 10.52, `closing scene starts at ${outroStarts}s`);
  });

  it('holds the last frame one second after the voice ends', () => {
    const t = planReelTiming(approved, 5);
    assert.equal(t.hook + 5 * t.perPage + t.outro, Math.round(17.74 * 30));
  });

  it('refuses a pages line too short to show the pages', () => {
    assert.throws(() => planReelTiming({ hookEnd: 2, pagesStart: 2.2, outroStart: 6, end: 9 }, 6), /pages line/);
  });
});
