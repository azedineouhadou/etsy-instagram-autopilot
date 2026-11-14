import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { captionWords, type StoryTiming, type TimedWord } from '../render/spec.js';
import { REEL_TIMING, type SceneLengths } from '../video/timing.js';

/** Silence before the first word, in seconds */
export const LEAD_SECONDS = 0.4;
/** Below this a take is thrown away: wrong words or a garbled voice (seen on real takes) */
export const MIN_ACCURACY = 0.97;
const TAIL_SECONDS = 1;
// The closing scene fades in just before its line, so the words land on the finished screen
const OUTRO_EARLY_SECONDS = 0.2;
const MIN_PER_PAGE = 30;

export type VoiceoverParts = { hook: string; pages: string; outro: string };
export type HeardWord = { word: string; start: number; end: number };
export type PartTimes = { hookEnd: number; pagesStart: number; outroStart: number; end: number };

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function numberWords(n: number): string[] {
  if (n < 20) return [ONES[n]!];
  if (n < 100) return n % 10 ? [TENS[Math.floor(n / 10)]!, ONES[n % 10]!] : [TENS[n / 10]!];
  if (n < 1000) return [ONES[Math.floor(n / 100)]!, 'hundred', ...(n % 100 ? numberWords(n % 100) : [])];
  return [String(n)];
}

/** The script is spelled out ("sixty-six") but transcripts use digits ("66"), so both reduce to the same words */
export function spokenWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .flatMap((word) => (/^\d+$/.test(word) ? numberWords(Number(word)) : [word]));
}

function editDistance(a: string[], b: string[]): number {
  let row = b.map((_, i) => i + 1);
  row.unshift(0);
  a.forEach((wordA, i) => {
    const next = [i + 1];
    b.forEach((wordB, j) => next.push(Math.min(row[j]! + (wordA === wordB ? 0 : 1), row[j + 1]! + 1, next[j]! + 1)));
    row = next;
  });
  return row[b.length]!;
}

/** 1 = the take says the script exactly, 0 = nothing in common */
export function wordAccuracy(script: string, transcript: string): number {
  const expected = spokenWords(script);
  const heard = spokenWords(transcript);
  return Math.max(0, 1 - editDistance(expected, heard) / Math.max(expected.length, heard.length, 1));
}

/** Where each part of the script falls in the transcript's word timings */
export function alignParts(parts: VoiceoverParts, words: HeardWord[]): PartTimes {
  const heard = words.flatMap((w) => spokenWords(w.word).map(() => w));
  const hookCount = spokenWords(parts.hook).length;
  const pagesCount = spokenWords(parts.pages).length;
  const scriptCount = hookCount + pagesCount + spokenWords(parts.outro).length;
  // A misheard word can shift the count slightly; scaling keeps the boundary in the right pause
  const at = (count: number) => Math.round((count * heard.length) / scriptCount);
  return {
    hookEnd: heard[at(hookCount) - 1]!.end,
    pagesStart: heard[at(hookCount)]!.start,
    outroStart: heard[at(hookCount + pagesCount)]!.start,
    end: heard[heard.length - 1]!.end,
  };
}

/** Scene lengths that follow the voice: each scene changes in the pause before its line */
export function planReelTiming(times: PartTimes, pageCount: number, fps = 30): SceneLengths {
  const { crossfade } = REEL_TIMING;
  const hook = Math.round(((times.hookEnd + times.pagesStart) / 2) * fps);
  const outroStart = Math.round((times.outroStart - OUTRO_EARLY_SECONDS) * fps);
  const perPage = Math.round((outroStart - hook + crossfade) / pageCount);
  if (perPage < MIN_PER_PAGE) {
    throw new Error(`pages line is too short for ${pageCount} pages (${perPage} frames each, ${MIN_PER_PAGE} minimum): lengthen it or use fewer pages`);
  }
  const total = Math.round((times.end + TAIL_SECONDS) * fps);
  return { hook, perPage, outro: total - hook - pageCount * perPage };
}

// ── Story reels: one line per beat ──

/** Shortest beat a story reel allows: under this a scene flashes past before it registers */
export const MIN_BEAT_FRAMES = 36;

/** The line as the voice should read it: digits spelled out ("200" → "two hundred") */
export function toSpeech(say: string): string {
  return say.replace(/\d+/g, (digits) => numberWords(Number(digits)).join(' '));
}

/** Identifies the script a voiceover was made from, so the validator can spot a line edited afterwards */
export function scriptHash(says: string[]): string {
  return createHash('sha256').update(JSON.stringify(says)).digest('hex').slice(0, 16);
}

/**
 * Gives every caption word of the script the time it was spoken. Captions show the script's own
 * spelling, so "200" spans the heard "two" and "hundred". Same count scaling as alignParts: a
 * misheard word shifts nothing by more than a word.
 */
export function timeScript(says: string[], heardWords: HeardWord[]): TimedWord[] {
  const heard = heardWords.flatMap((w) => spokenWords(w.word).map(() => w));
  if (!heard.length) throw new Error('the transcript has no words');
  const tokens = says.flatMap((say, beat) => captionWords(say).map((text) => ({ beat, text, spoken: spokenWords(text).length })));
  const scriptCount = tokens.reduce((n, t) => n + t.spoken, 0);
  const at = (count: number) => heard[Math.min(heard.length - 1, Math.max(0, Math.round((count * heard.length) / scriptCount)))]!;

  let count = 0;
  let lastEnd = heard[0]!.start;
  return tokens.map(({ beat, text, spoken }) => {
    // Punctuation-only tokens ("–") aren't spoken: they share the moment of the word before
    if (!spoken) return { beat, text, startMs: lastEnd * 1000, endMs: lastEnd * 1000 };
    const start = at(count).start;
    const end = Math.max(start, at(count + spoken - 1).end);
    count += spoken;
    lastEnd = end;
    return { beat, text, startMs: Math.round(start * 1000), endMs: Math.round(end * 1000) };
  });
}

/** Beat lengths that follow the voice: each beat cuts in the pause before its first word */
export function planBeatTiming(words: TimedWord[], beatCount: number, fps = 30): StoryTiming {
  const firstOf = (beat: number) => words.find((w) => w.beat === beat)!;
  const lastOf = (beat: number) => words.filter((w) => w.beat === beat).at(-1)!;
  const cuts = [0];
  for (let beat = 1; beat < beatCount; beat++) {
    const gap = (lastOf(beat - 1).endMs + firstOf(beat).startMs) / 2;
    cuts.push(Math.round((gap / 1000) * fps));
  }
  cuts.push(Math.round((lastOf(beatCount - 1).endMs / 1000 + TAIL_SECONDS) * fps));
  const beats = cuts.slice(1).map((cut, i) => cut - cuts[i]!);
  beats.forEach((frames, i) => {
    if (frames < MIN_BEAT_FRAMES) {
      throw new Error(`beat ${i + 1} is only ${frames} frames (${MIN_BEAT_FRAMES} minimum): lengthen its line or merge it with the next`);
    }
  });
  return { beats, words };
}

const storyVoiceoverFile = z.object({
  scriptHash: z.string(),
  beats: z.array(z.number().int().positive()),
  words: z.array(z.object({ beat: z.number().int().min(0), text: z.string(), startMs: z.number(), endMs: z.number() })),
});

/** What `npm run voiceover` made for a story reel, and whether it still matches the script */
export function readStoryVoiceover(dir: string, says: string[]): { timing?: StoryTiming; problem?: string } {
  const json = join(dir, 'voiceover.json');
  if (!existsSync(json) || !existsSync(join(dir, 'voiceover.wav'))) return { problem: 'voiceover not generated' };
  const parsed = storyVoiceoverFile.safeParse(JSON.parse(readFileSync(json, 'utf8')));
  if (!parsed.success) return { problem: 'voiceover.json is not valid' };
  if (parsed.data.scriptHash !== scriptHash(says) || parsed.data.beats.length !== says.length) {
    return { problem: 'voiceover out of date: a line changed after it was recorded' };
  }
  return { timing: { beats: parsed.data.beats, words: parsed.data.words } };
}
