// Plain module (no React/fonts) so the Node CLIs and tests can import it too
import { captionWords, normalWord, type BeatSpec, type StickerSpec, type StoryTiming, type TimedWord } from '../../render/spec';

export const FPS = 30;
/** The next beat fades in over the last frames of the previous one */
export const OVERLAP = 8;
/** The CTA scene types the shop handle one character every TYPE_FRAMES, starting at TYPE_START */
export const TYPE_START = 8;
export const TYPE_FRAMES = 2;

const msToFrame = (ms: number) => Math.round((ms / 1000) * FPS);

/** Beat lengths and evenly spread words for a reel with no voiceover (Studio previews, examples) */
export function silentTiming(beats: Pick<BeatSpec, 'say'>[]): StoryTiming {
  const lengths: number[] = [];
  const words: TimedWord[] = [];
  let start = 0;
  beats.forEach((beat, i) => {
    const tokens = captionWords(beat.say);
    const length = Math.max(60, Math.round(tokens.length * 12.5) + 18);
    const slot = (length - 18) / tokens.length;
    tokens.forEach((text, k) => {
      const from = start + 6 + k * slot;
      words.push({ beat: i, text, startMs: (from / FPS) * 1000, endMs: ((from + slot) / FPS) * 1000 });
    });
    lengths.push(length);
    start += length;
  });
  return { beats: lengths, words };
}

/** First frame of each beat */
export const beatStarts = (beats: number[]): number[] => beats.map((_, i) => beats.slice(0, i).reduce((a, b) => a + b, 0));

export const totalFrames = (beats: number[]): number => beats.reduce((a, b) => a + b, 0);

/** Frame (inside its beat) at which a sticker lands: on its cue word if it has one, else staggered */
export function stickerFrame(sticker: StickerSpec, index: number, beatIndex: number, timing: StoryTiming): number {
  const start = beatStarts(timing.beats)[beatIndex] ?? 0;
  const length = timing.beats[beatIndex] ?? 0;
  if (sticker.on) {
    const cue = normalWord(sticker.on);
    const word = timing.words.find((w) => w.beat === beatIndex && normalWord(w.text) === cue);
    if (word) return Math.max(0, msToFrame(word.startMs) - start - 2);
  }
  return index === 0 ? 10 : Math.round(length * 0.45);
}

/** Frame (inside the beat) at which the contrast scene's second card lands */
export const contrastLanding = (length: number) => Math.round(length * 0.45);

/** Frames after a checks sticker lands at which each item ticks */
export const checkTick = (item: number) => 8 + item * 12;

export type Sound = 'whoosh' | 'pop' | 'ding' | 'typing';
export type Cue = { from: number; sound: Sound; frames: number };

/** How loud each effect plays under the voice (0–1) */
export const SFX_LEVELS: Record<Sound, number> = { whoosh: 0.28, pop: 0.45, ding: 0.35, typing: 0.4 };
const SFX_FRAMES: Record<Exclude<Sound, 'typing'>, number> = { whoosh: 24, pop: 15, ding: 30 };

/** Every sound effect in the reel, in frame order: scene entrances, stickers landing, the CTA typing */
export function sfxCues(beats: BeatSpec[], timing: StoryTiming, handleLength: number): Cue[] {
  const starts = beatStarts(timing.beats);
  const cues: Cue[] = [];
  const add = (from: number, sound: Exclude<Sound, 'typing'>) => cues.push({ from, sound, frames: SFX_FRAMES[sound] });

  beats.forEach((beat, i) => {
    const start = starts[i]!;
    const previous = beats[i - 1]?.scene;
    // A zoom that keeps moving over the same image is one shot, not a new scene
    const sameShot = beat.scene.kind === 'zoom' && previous?.kind === 'zoom' && previous.image === beat.scene.image;
    if (i > 0 && !sameShot) add(start - Math.round(OVERLAP / 2), 'whoosh');
    if (beat.scene.kind === 'contrast') add(start + contrastLanding(timing.beats[i]!), 'pop');
    if (beat.scene.kind === 'reveal') add(start + Math.round(timing.beats[i]! * 0.3), 'whoosh');
    if (beat.scene.kind === 'cta') cues.push({ from: start + TYPE_START, sound: 'typing', frames: handleLength * TYPE_FRAMES });

    beat.stickers.forEach((sticker, k) => {
      const at = start + stickerFrame(sticker, k, i, timing);
      switch (sticker.kind) {
        case 'checks':
          sticker.items.forEach((_, n) => add(at + checkTick(n), 'ding'));
          break;
        case 'circle':
          add(at + 10, 'ding');
          break;
        case 'pill':
          add(at, 'ding');
          break;
        default:
          add(at, 'pop');
      }
    });
  });
  return cues.sort((a, b) => a.from - b.from);
}

/**
 * Background music level (linear gain on a track evened out to MUSIC_LUFS): low under the voice,
 * rising in pauses long enough to notice and at the end, with a fade in and a fade out.
 */
export const MUSIC_LEVELS = { underVoice: 0.16, inPauses: 0.32 };
/** Loudness every track is evened out to before the levels above apply */
export const MUSIC_LUFS = -16;
const MUSIC_RAMP = 9;
const MUSIC_FADE_IN = 15;
const MUSIC_FADE_OUT = 45;

/** Music gain for every frame of the reel */
export function musicVolumes(timing: StoryTiming): number[] {
  const total = totalFrames(timing.beats);
  const speaking = new Array<boolean>(total).fill(false);
  for (const w of timing.words) {
    // A little either side of each word so the music doesn't swell between syllables
    for (let f = Math.max(0, msToFrame(w.startMs) - 3); f <= Math.min(total - 1, msToFrame(w.endMs) + 3); f++) speaking[f] = true;
  }
  // Frames to the nearest speech, from both directions
  const distance = new Array<number>(total).fill(Infinity);
  let last = -Infinity;
  for (let f = 0; f < total; f++) {
    if (speaking[f]) last = f;
    distance[f] = f - last;
  }
  last = Infinity;
  for (let f = total - 1; f >= 0; f--) {
    if (speaking[f]) last = f;
    distance[f] = Math.min(distance[f]!, last - f);
  }
  const { underVoice, inPauses } = MUSIC_LEVELS;
  return distance.map((d, f) => {
    // Short gaps never reach full level, so the music only rises in real pauses
    const level = underVoice + (inPauses - underVoice) * Math.min(1, d / MUSIC_RAMP);
    const fade = Math.min(1, f / MUSIC_FADE_IN, (total - 1 - f) / MUSIC_FADE_OUT);
    return level * Math.max(0, fade);
  });
}

/** Frame used for the reel's cover image: the middle of the chosen beat, after its stickers have landed */
export function coverFrame(beats: BeatSpec[], cover: number | undefined, timing: StoryTiming): number {
  const firstCover = beats.findIndex((b) => b.scene.kind === 'cover');
  const index = cover ?? (firstCover >= 0 ? firstCover : 0);
  return beatStarts(timing.beats)[index]! + Math.round(timing.beats[index]! * 0.7);
}
