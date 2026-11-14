import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { PATHS } from '../lib/library.js';
import {
  alignParts,
  LEAD_SECONDS,
  MIN_ACCURACY,
  planBeatTiming,
  planReelTiming,
  scriptHash,
  timeScript,
  toSpeech,
  wordAccuracy,
  type HeardWord,
} from '../lib/voiceover.js';
import { renderSpec, type PageFlipReelSpec, type StoryReelSpec } from '../render/spec.js';

const API = 'http://127.0.0.1:3900';
const TAKES = 6;
// Louder than the -14 LUFS the finished reel measures: the render lowers the level by about 3 dB
const LOUDNESS = 'loudnorm=I=-11:TP=-1:LRA=7';

const { values } = parseArgs({
  options: {
    root: { type: 'string', default: '.' },
    post: { type: 'string', multiple: true },
  },
});

const voice = z
  .object({ profileId: z.string().min(1), speed: z.number(), steps: z.number().int(), seed: z.number().int(), language: z.string() })
  .parse(JSON.parse(readFileSync(resolve('brand/voiceover.json'), 'utf8')));

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function speak(text: string, seed: number): Promise<Buffer> {
  const form = new FormData();
  const fields = { text, seed, profile_id: voice.profileId, language: voice.language, num_step: voice.steps, speed: voice.speed, denoise: true };
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  const response = await fetch(`${API}/generate`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`VoiceStudio /generate: ${response.status} ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

async function transcribe(wav: Buffer): Promise<{ text: string; words: HeardWord[] }> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'take.wav');
  form.append('language', 'en');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const response = await fetch(`${API}/v1/audio/transcriptions`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`VoiceStudio transcription: ${response.status} ${await response.text()}`);
  const { text, words } = (await response.json()) as { text?: string; words?: HeardWord[] };
  return { text: text ?? '', words: words ?? [] };
}

/** Evens out the level, adds the lead-in, and writes stereo: Remotion lowers mono tracks further */
function finish(wav: Buffer, output: string) {
  const dir = mkdtempSync(join(tmpdir(), 'voiceover-'));
  try {
    const input = join(dir, 'take.wav');
    writeFileSync(input, wav);
    const filter = `${LOUDNESS},aresample=48000,adelay=${LEAD_SECONDS * 1000}:all=1`;
    execFileSync('npx', ['remotion', 'ffmpeg', '-hide_banner', '-y', '-i', input, '-af', filter, '-ac', '2', '-c:a', 'pcm_s16le', output], { stdio: 'pipe' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function bestTake(script: string) {
  for (let take = 0; take < TAKES; take++) {
    const seed = voice.seed + take;
    const wav = await speak(script, seed);
    const heard = await transcribe(wav);
    const accuracy = wordAccuracy(script, heard.text);
    console.log(`  take ${take + 1}: ${Math.round(accuracy * 100)}% of the script heard back`);
    if (accuracy >= MIN_ACCURACY && heard.words.length) return { wav, words: heard.words };
    console.log(`    heard: ${heard.text || '(nothing)'}`);
  }
  fail(`no usable take in ${TAKES} tries — open VoiceStudio and check voice ${voice.profileId}`);
}

async function run(id: string) {
  const dir = join(resolve(values.root), PATHS.queue, id);
  const specPath = join(dir, 'render.json');
  const raw = JSON.parse(readFileSync(specPath, 'utf8')) as Record<string, unknown>;
  const spec = renderSpec.parse(raw);

  console.log(`→ ${id}`);
  if (spec.template === 'story-reel') return storyVoiceover(dir, spec);
  if (spec.template === 'page-flip-reel') return pageFlipVoiceover(dir, specPath, raw, spec);
  fail(`${id}: ${spec.template} posts have no voiceover`);
}

async function pageFlipVoiceover(dir: string, specPath: string, raw: Record<string, unknown>, spec: PageFlipReelSpec) {
  if (!spec.voiceover) fail(`${basename(dir)}: render.json has no voiceover`);
  const { hook, pages, outro } = spec.voiceover;

  const { wav, words } = await bestTake(`${hook} ${pages} ${outro}`);
  finish(wav, join(dir, 'voiceover.wav'));

  const shifted = words.map((w) => ({ ...w, start: w.start + LEAD_SECONDS, end: w.end + LEAD_SECONDS }));
  const timing = planReelTiming(alignParts({ hook, pages, outro }, shifted), spec.pages.length);
  writeFileSync(specPath, `${JSON.stringify({ ...raw, voiceover: { hook, pages, outro, timing } }, null, 2)}\n`);
  const seconds = (timing.hook + spec.pages.length * timing.perPage + timing.outro) / 30;
  console.log(`  ✓ voiceover.wav, reel length ${seconds.toFixed(1)} s`);
}

/** Story reels: one take of every line, then beat lengths and caption timings into voiceover.json */
async function storyVoiceover(dir: string, spec: StoryReelSpec) {
  if (!spec.voiced) fail(`${basename(dir)}: render.json says "voiced": false`);
  const says = spec.beats.map((b) => b.say);
  // Accuracy is checked against what the voice was asked to say, digits already spelled out
  const { wav, words } = await bestTake(says.map(toSpeech).join(' '));
  finish(wav, join(dir, 'voiceover.wav'));

  const shifted = words.map((w) => ({ ...w, start: w.start + LEAD_SECONDS, end: w.end + LEAD_SECONDS }));
  let timing;
  try {
    timing = planBeatTiming(timeScript(says, shifted), says.length);
  } catch (err) {
    fail(`${basename(dir)}: ${(err as Error).message}`);
  }
  writeFileSync(join(dir, 'voiceover.json'), `${JSON.stringify({ scriptHash: scriptHash(says), ...timing }, null, 2)}\n`);
  const seconds = timing.beats.reduce((a, b) => a + b, 0) / 30;
  console.log(`  ✓ voiceover.wav + voiceover.json, ${spec.beats.length} beats, reel length ${seconds.toFixed(1)} s`);
}

if (!values.post?.length) fail('name the reels: npm run voiceover -- --post <folder>');
try {
  await fetch(`${API}/health`);
} catch {
  fail(`VoiceStudio isn't running at ${API} — start it and try again`);
}
for (const id of values.post) await run(id);
console.log('\nRender next: npm run render -- --post <folder>');
