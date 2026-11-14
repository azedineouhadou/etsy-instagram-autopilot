import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { alignParts, MIN_ACCURACY, planBeatTiming, planReelTiming, scriptHash, spokenWords, timeScript, toSpeech, wordAccuracy } from './voiceover.js';

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

describe('toSpeech', () => {
  it('spells digits out for the voice and leaves words alone', () => {
    assert.equal(toSpeech('200 horror pages, 37 mazes.'), 'two hundred horror pages, thirty seven mazes.');
    assert.equal(toSpeech('Link in bio.'), 'Link in bio.');
  });
});

describe('scriptHash', () => {
  it('changes when any line changes', () => {
    assert.equal(scriptHash(['a b', 'c']), scriptHash(['a b', 'c']));
    assert.notEqual(scriptHash(['a b', 'c']), scriptHash(['a b', 'c.']));
    assert.notEqual(scriptHash(['a', 'b c']), scriptHash(['a b', 'c']));
  });
});

describe('timeScript', () => {
  // Transcripts write numbers as digits and drop dashes; each word lasts half a second
  const heard = (text: string) => text.split(' ').map((word, i) => ({ word, start: i * 0.5, end: (i + 1) * 0.5 }));

  it('times every script word, a number spanning all the words the voice said for it', () => {
    const words = timeScript(['200 horror pages.', 'Link in bio.'], heard('two hundred horror pages link in bio'));
    assert.deepEqual(
      words.map((w) => [w.beat, w.text, w.startMs, w.endMs]),
      [
        [0, '200', 0, 1000],
        [0, 'horror', 1000, 1500],
        [0, 'pages.', 1500, 2000],
        [1, 'Link', 2000, 2500],
        [1, 'in', 2500, 3000],
        [1, 'bio.', 3000, 3500],
      ],
    );
  });

  it('keeps the captions in the script spelling when a word is misheard', () => {
    const words = timeScript(['Pick your monster.'], heard('pick your mobster'));
    assert.deepEqual(words.map((w) => w.text), ['Pick', 'your', 'monster.']);
    assert.equal(words[2]!.startMs, 1000);
  });

  it('gives an unspoken token the moment of the word before it', () => {
    const words = timeScript(['Color – relax'], heard('color relax'));
    assert.deepEqual(words.map((w) => [w.text, w.startMs, w.endMs]), [['Color', 0, 500], ['–', 500, 500], ['relax', 500, 1000]]);
  });
});

describe('planBeatTiming', () => {
  const word = (beat: number, startMs: number, endMs: number) => ({ beat, text: 'w', startMs, endMs });

  it('cuts each beat halfway through the pause before its first word and holds a second after the voice', () => {
    const words = [word(0, 400, 1800), word(0, 1800, 2600), word(1, 3000, 4000), word(2, 4600, 6200)];
    const { beats } = planBeatTiming(words, 3);
    assert.deepEqual(beats, [84, 45, 87]); // cuts at 2.8 s and 4.3 s, end at 6.2 + 1 s
    assert.equal(beats.reduce((a, b) => a + b), Math.round(7.2 * 30));
  });

  it('refuses a beat too short to register', () => {
    const words = [word(0, 400, 2000), word(1, 2100, 2500), word(2, 2600, 5000)];
    assert.throws(() => planBeatTiming(words, 3), /beat 2 is only/);
  });
});
