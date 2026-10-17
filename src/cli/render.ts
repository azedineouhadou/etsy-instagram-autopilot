import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { PATHS } from '../lib/library.js';
import { renderSpec, type RenderSpec } from '../render/spec.js';
import { REEL_TIMING } from '../video/timing.js';

const { values } = parseArgs({
  options: {
    root: { type: 'string', default: '.' },
    post: { type: 'string', multiple: true },
  },
});
const root = resolve(values.root);
const queueDir = join(root, PATHS.queue);
const productsDir = join(root, PATHS.products);
const audioDir = join(root, 'assets/audio');
// Remotion copies its whole public dir into the bundle, so only the files these posts use are staged
const stageDir = resolve('.cache/render-public');

type Job = { id: string; dir: string; spec: RenderSpec; productFolder: string };

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function imagesOf(spec: RenderSpec): string[] {
  switch (spec.template) {
    case 'spotlight':
      return [spec.mockup];
    case 'carousel':
      return spec.slides.map((s) => s.image);
    case 'page-flip-reel':
      return [...spec.pages, spec.mockup];
  }
}

function loadJob(id: string): Job {
  const dir = join(queueDir, id);
  const specPath = join(dir, 'render.json');
  const postPath = join(dir, 'post.json');
  if (!existsSync(specPath)) fail(`${id}: missing render.json`);
  if (!existsSync(postPath)) fail(`${id}: missing post.json`);

  const parsed = renderSpec.safeParse(JSON.parse(readFileSync(specPath, 'utf8')));
  if (!parsed.success) {
    fail(`${id}: render.json\n${parsed.error.issues.map((i) => `    ${i.path.join('.')}: ${i.message}`).join('\n')}`);
  }

  const { listingId } = JSON.parse(readFileSync(postPath, 'utf8')) as { listingId?: string };
  const productFolder = existsSync(productsDir)
    ? readdirSync(productsDir).find((f) => f.startsWith(`${listingId}-`))
    : undefined;
  if (!productFolder) fail(`${id}: no product folder for listing ${listingId} in ${PATHS.products}`);

  for (const image of imagesOf(parsed.data)) {
    if (!existsSync(join(productsDir, productFolder, image))) fail(`${id}: ${productFolder}/${image} not found`);
  }
  const music = parsed.data.template === 'page-flip-reel' ? parsed.data.music : undefined;
  if (music && !existsSync(join(audioDir, music))) fail(`${id}: assets/audio/${music} not found`);

  return { id, dir, spec: parsed.data, productFolder };
}

function stage(jobs: Job[]) {
  rmSync(stageDir, { recursive: true, force: true });
  for (const folder of new Set(jobs.map((j) => j.productFolder))) {
    for (const sub of ['mockups', 'interior']) {
      const from = join(productsDir, folder, sub);
      if (existsSync(from)) cpSync(from, join(stageDir, 'products', folder, sub), { recursive: true });
    }
  }
  for (const job of jobs) {
    if (job.spec.template === 'page-flip-reel' && job.spec.music) {
      cpSync(join(audioDir, job.spec.music), join(stageDir, 'audio', job.spec.music));
    }
  }
  mkdirSync(stageDir, { recursive: true });
}

async function renderJob(serveUrl: string, job: Job): Promise<Record<string, unknown>> {
  const mediaDir = join(job.dir, 'media');
  // media/ only ever holds render output, so it is rebuilt from scratch
  rmSync(mediaDir, { recursive: true, force: true });
  mkdirSync(mediaDir, { recursive: true });
  const productDir = `products/${job.productFolder}`;

  const still = async (id: string, inputProps: Record<string, unknown>, file: string, frame = 0) => {
    const composition = await selectComposition({ serveUrl, id, inputProps });
    await renderStill({ serveUrl, composition, inputProps, frame, output: join(mediaDir, file), imageFormat: 'png' });
    return `media/${file}`;
  };

  const { spec } = job;
  switch (spec.template) {
    case 'spotlight': {
      const { template: _, ...props } = spec;
      return { type: 'image', file: await still('Spotlight', { ...props, productDir }, '01.png') };
    }
    case 'carousel': {
      const files: string[] = [];
      for (const [index, slide] of spec.slides.entries()) {
        const name = `${String(index + 1).padStart(2, '0')}.png`;
        files.push(await still('CarouselSlide', { productDir, slide, index, total: spec.slides.length }, name));
      }
      return { type: 'carousel', files };
    }
    case 'page-flip-reel': {
      const { template: _, ...rest } = spec;
      const props = { ...rest, productDir };
      const composition = await selectComposition({ serveUrl, id: 'PageFlipReel', inputProps: props });
      let lastPct = -1;
      await renderMedia({
        serveUrl,
        composition,
        inputProps: props,
        codec: 'h264',
        outputLocation: join(mediaDir, 'reel.mp4'),
        onProgress: ({ progress }) => {
          const pct = Math.floor(progress * 10) * 10;
          if (pct !== lastPct) process.stdout.write(`  ${pct}%`);
          lastPct = pct;
        },
      });
      process.stdout.write('\n');
      // Cover = end of the hook scene, once every word has landed
      const cover = await still('PageFlipReel', props, 'cover.png', REEL_TIMING.hook - 12);
      return { type: 'reel', video: 'media/reel.mp4', cover, shareToFeed: true };
    }
  }
}

function writeMedia(job: Job, media: Record<string, unknown>) {
  const postPath = join(job.dir, 'post.json');
  const post = JSON.parse(readFileSync(postPath, 'utf8')) as Record<string, unknown>;
  post.media = media;
  writeFileSync(postPath, `${JSON.stringify(post, null, 2)}\n`);
}

const ids =
  values.post ??
  (existsSync(queueDir) ? readdirSync(queueDir).filter((f) => existsSync(join(queueDir, f, 'render.json'))).sort() : []);
if (!ids.length) fail(`nothing to render in ${queueDir}`);

const jobs = ids.map(loadJob);
stage(jobs);

console.log(`Bundling templates for ${jobs.length} post(s)…`);
await ensureBrowser();
const serveUrl = await bundle({ entryPoint: resolve('src/video/index.ts'), publicDir: stageDir });

for (const job of jobs) {
  console.log(`→ ${job.id} (${job.spec.template})`);
  writeMedia(job, await renderJob(serveUrl, job));
}
console.log(`\n✓ rendered ${jobs.length} post(s). Run validate next.`);
