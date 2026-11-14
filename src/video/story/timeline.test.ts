import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { storyReelSpec, type BeatSpec } from '../../render/spec.js';
import { beatStarts, coverFrame, MUSIC_LEVELS, musicVolumes, OVERLAP, sfxCues, silentTiming, stickerFrame } from './timeline.js';

const beat = (say: string, scene: BeatSpec['scene'], stickers: BeatSpec['stickers'] = []): BeatSpec => ({ say, scene, stickers, emphasis: [] });
const zoom = (image: string): BeatSpec['scene'] => ({ kind: 'zoom', image, from: [0.5, 0.5, 1], to: [0.5, 0.5, 1.5] });

describe('silentTiming', () => {
  it('gives each beat time for its words and spreads the words through it', () => {
    const timing = silentTiming([{ say: 'One two three four five six' }, { say: 'Hi' }]);
    assert.deepEqual(timing.beats, [93, 60]);
    assert.equal(timing.words.length, 7);
    assert.ok(timing.words.filter((w) => w.beat === 1).every((w) => w.startMs >= (93 / 30) * 1000));
  });
});

describe('stickerFrame', () => {
  const timing = { beats: [60, 90], words: [{ beat: 1, text: 'Two', startMs: 2000, endMs: 2400 }, { beat: 1, text: 'hundred!', startMs: 3000, endMs: 3500 }] };

  it('lands a sticker as its cue word is spoken, matching without case or punctuation', () => {
    assert.equal(stickerFrame({ kind: 'pill', text: 'x', on: 'HUNDRED' }, 0, 1, timing), 90 - 60 - 2);
  });

  it('staggers stickers without a cue', () => {
    assert.equal(stickerFrame({ kind: 'pill', text: 'x' }, 0, 1, timing), 10);
    assert.equal(stickerFrame({ kind: 'pill', text: 'x' }, 1, 1, timing), Math.round(90 * 0.45));
  });
});

describe('sfxCues', () => {
  const beats = [
    beat('Look closer', zoom('interior/01.png')),
    beat('closer still', zoom('interior/01.png'), [{ kind: 'circle', x: 0.5, y: 0.5, r: 0.1 }]),
    beat('This is it', { kind: 'cover', image: 'mockups/01.png' }, [{ kind: 'count', value: 200, label: 'pages' }]),
    beat('Tick tick', { kind: 'cta', image: 'mockups/01.png', title: 'Book', points: [], cta: 'Link in bio' }, [{ kind: 'checks', items: ['a', 'b'] }]),
  ];
  const timing = { beats: [60, 60, 60, 90], words: [] };
  const starts = beatStarts(timing.beats);
  const cues = sfxCues(beats, timing, 10);

  it('whooshes on a new scene but not when a zoom keeps moving over the same image', () => {
    const whooshes = cues.filter((c) => c.sound === 'whoosh').map((c) => c.from);
    assert.deepEqual(whooshes, [starts[2]! - OVERLAP / 2, starts[3]! - OVERLAP / 2]);
  });

  it('pops, dings and types where the stickers and the CTA land', () => {
    assert.ok(cues.some((c) => c.sound === 'ding' && c.from === starts[1]! + 10 + 10));
    assert.ok(cues.some((c) => c.sound === 'pop' && c.from === starts[2]! + 10));
    assert.equal(cues.filter((c) => c.sound === 'ding').length, 3);
    assert.deepEqual(cues.find((c) => c.sound === 'typing'), { from: starts[3]! + 8, sound: 'typing', frames: 20 });
  });

  it('comes out in time order', () => {
    assert.deepEqual(cues.map((c) => c.from), [...cues.map((c) => c.from)].sort((a, b) => a - b));
  });
});

describe('coverFrame', () => {
  it('defaults to the first cover beat, 70% of the way in', () => {
    const beats = [beat('a', zoom('interior/01.png')), beat('b', { kind: 'cover', image: 'mockups/01.png' })];
    assert.equal(coverFrame(beats, undefined, { beats: [60, 100], words: [] }), 60 + 70);
    assert.equal(coverFrame(beats, 0, { beats: [60, 100], words: [] }), 42);
  });
});

describe('storyReelSpec', () => {
  const base = {
    template: 'story-reel',
    backdrop: 'interior/01.png',
    beats: [1, 2, 3, 4].map(() => ({ say: 'Pick your monster', scene: { kind: 'cover', image: 'mockups/01.png' } })),
  };

  it('accepts a minimal reel and fills in defaults', () => {
    const spec = storyReelSpec.parse(base);
    assert.equal(spec.voiced, true);
    assert.deepEqual(spec.beats[0]!.stickers, []);
  });

  it('rejects emphasis and cue words that are not in the line', () => {
    const beats = [...base.beats];
    beats[0] = { ...beats[0]!, emphasis: ['dragon'], stickers: [{ kind: 'pill', text: 'Yes', on: 'Monster!' }] } as never;
    const result = storyReelSpec.safeParse({ ...base, beats });
    assert.equal(result.success, false);
    assert.deepEqual(result.error!.issues.map((i) => i.path.join('.')), ['beats.0.emphasis']);
  });

  it('only allows circles on a zoom scene', () => {
    const beats = [...base.beats];
    beats[0] = { ...beats[0]!, stickers: [{ kind: 'circle', x: 0.5, y: 0.5, r: 0.1 }] } as never;
    assert.equal(storyReelSpec.safeParse({ ...base, beats }).success, false);
  });
});

describe('musicVolumes', () => {
  // 10 s reel: speech 1–3 s and 3.2–5 s (a short gap), then silence to the end
  const words = [
    { beat: 0, text: 'a', startMs: 1000, endMs: 3000 },
    { beat: 0, text: 'b', startMs: 3200, endMs: 5000 },
  ];
  const v = musicVolumes({ beats: [300], words });
  const { underVoice, inPauses } = MUSIC_LEVELS;

  it('has one value per frame, fading in from silence and out to silence', () => {
    assert.equal(v.length, 300);
    assert.equal(v[0], 0);
    assert.equal(v[299], 0);
  });

  it('sits low under the voice and stays low through a short gap', () => {
    assert.equal(v[60], underVoice);
    assert.ok(v[93]! < (underVoice + inPauses) / 2, `gap level ${v[93]}`);
  });

  it('rises to the pause level once the voice stops for a while', () => {
    assert.equal(v[200], inPauses);
  });
});
