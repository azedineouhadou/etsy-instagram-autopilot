import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadPosts, PATHS } from '../lib/library.js';
import { DryRunInstagram, InstagramClient, type InstagramApi } from '../publish/instagram.js';
import { publishPost, selectDue, type InstagramState } from '../publish/publish-post.js';

const { values } = parseArgs({
  options: {
    root: { type: 'string', default: '.' },
    live: { type: 'boolean', default: false },
    max: { type: 'string', default: '2' },
    // Dry-run only: pretend it's this moment, to preview what a future run would publish
    now: { type: 'string' },
  },
});

const live = values.live;
const root = resolve(values.root);
// Caps a catch-up run after downtime so the feed doesn't get several posts at once
const max = Number(values.max);
if (!Number.isInteger(max) || max < 1) fail('--max must be a whole number ≥ 1');
if (live && values.now) fail('--now only works in dry runs');

if (existsSync('.env')) process.loadEnvFile('.env');
const env = (name: string) => process.env[name]?.trim() || undefined;

const mediaBase = (env('MEDIA_BASE_URL') ?? 'https://raw.githubusercontent.com/azedineouhadou/etsy-instagram-autopilot/main').replace(/\/$/, '');
const now = values.now ? new Date(values.now) : new Date();
if (Number.isNaN(now.getTime())) fail(`--now "${values.now}" is not a valid date`);

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function makeApi(): InstagramApi {
  if (!live) return new DryRunInstagram();
  const missing = ['INSTAGRAM_USER_ID', 'INSTAGRAM_ACCESS_TOKEN'].filter((n) => !env(n));
  if (missing.length) fail(`missing ${missing.join(', ')} in .env / secrets`);
  return new InstagramClient({
    userId: env('INSTAGRAM_USER_ID')!,
    accessToken: env('INSTAGRAM_ACCESS_TOKEN')!,
    apiVersion: env('INSTAGRAM_API_VERSION') ?? 'v25.0',
  });
}

const api = makeApi();
const loaded = loadPosts(root, 'queue');
const invalid = loaded.filter((p) => !p.value);
const valid = loaded.flatMap((p) => (p.value ? [{ ...p, value: p.value }] : []));
for (const p of invalid) console.log(`  skip   ${p.folder}: invalid post.json (run npm run validate)`);

let due = selectDue(
  valid.map((p) => p.value),
  now,
  max,
);

if (live && due.length) {
  const { used, total } = await api.quota();
  const left = Math.max(0, total - used);
  if (left < due.length) console.log(`  note   Instagram daily limit: ${used}/${total} used, publishing ${left} now`);
  due = due.slice(0, left);
}

console.log(`${live ? 'LIVE' : 'DRY RUN'} · ${now.toISOString()} · ${due.length} due of ${valid.length} queued\n`);

let failures = 0;
for (const post of due) {
  const entry = valid.find((p) => p.value.id === post.id)!;
  const postPath = join(entry.dir, 'post.json');
  const rel = relative(process.cwd(), entry.dir).split('\\').join('/');
  const log = api instanceof DryRunInstagram ? api.calls : undefined;
  const firstCall = log?.length ?? 0;

  console.log(`→ ${post.id} (${post.media.type})`);
  try {
    const result = await publishPost(post, {
      api,
      mediaUrl: (file) => `${mediaBase}/${encodeURI(`${rel}/${file}`)}`,
      saveState: (state: InstagramState) => {
        if (!live) return;
        const raw = JSON.parse(readFileSync(postPath, 'utf8')) as Record<string, unknown>;
        raw.instagram = state;
        writeFileSync(postPath, `${JSON.stringify(raw, null, 2)}\n`);
      },
      now: () => new Date(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    });

    for (const line of log?.slice(firstCall) ?? []) console.log(`    ${line}`);
    const target = join(root, PATHS.published, post.id);
    if (live) {
      mkdirSync(join(root, PATHS.published), { recursive: true });
      renameSync(entry.dir, target);
    }
    const where = relative(process.cwd(), target);
    if (result.resumed && !result.mediaId) console.log(`    note   was already published by an earlier run; media ID unknown`);
    console.log(`  ✓ ${live ? 'published' : 'would publish'}${result.permalink ? ` ${result.permalink}` : ''} → ${live ? 'moved' : 'would move'} to ${where}\n`);
  } catch (err) {
    failures++;
    for (const line of log?.slice(firstCall) ?? []) console.log(`    ${line}`);
    console.log(`  ✗ ${(err as Error).message}\n`);
  }
}

if (failures) {
  console.log(`✗ ${failures} post(s) failed`);
  process.exit(1);
}
console.log(due.length ? `✓ done` : 'Nothing due.');
