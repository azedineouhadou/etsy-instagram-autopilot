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

function numberWords(n: number): string[] {
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
