import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { parseEtsyLink, slugify } from '../lib/etsy-link.js';
import { PATHS } from '../lib/library.js';
import { convertColourPngs, MAX_LONG_SIDE, shrinkBook } from '../lib/shrink.js';
import { INSTAGRAM_LIMITS } from '../schemas/instagram-limits.js';

/**
 * Prepares new books dropped into assets/products/: reads link.txt, renames the
 * folder to <listingId>-<slug> and cleans the link, then shrinks oversized images
 * in every book. Writing product.json is left to Claude, which reads the live
 * listing in Chrome.
 */
const { values } = parseArgs({ options: { root: { type: 'string', default: '.' } } });
const base = join(values.root, PATHS.products);

const isImage = (f: string) => (INSTAGRAM_LIMITS.imageExtensions as readonly string[]).includes(extname(f).toLowerCase());
const images = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter(isImage) : []);

// Gitignored, so set-aside files never get committed
const CACHE_ASIDE = '.cache/intake-set-aside';
const problems: string[] = [];
const ready: { folder: string; url: string; mockups: number; interior: number }[] = [];
const converted: { before: number; after: number }[] = [];

const folders = existsSync(base)
  ? readdirSync(base, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
  : [];

const setAside: string[] = [];
for (const folder of folders) {
  const dir = join(base, folder);
  const productPath = join(dir, 'product.json');
  if (existsSync(productPath)) {
    // A folder duplicated from another book carries that book's product.json; set it aside so the book is processed
    const linkPath = join(dir, 'link.txt');
    const link = existsSync(linkPath) ? parseEtsyLink(readFileSync(linkPath, 'utf8')) : null;
    const owner = (JSON.parse(readFileSync(productPath, 'utf8')) as { listingId?: string }).listingId;
    if (!link || 'error' in link || link.listingId === owner) continue;
    const aside = join(CACHE_ASIDE, `${folder}-product.json`);
    mkdirSync(CACHE_ASIDE, { recursive: true });
    renameSync(productPath, aside);
    setAside.push(`${folder}: product.json belonged to listing ${owner} (copied from another book?) — moved to ${aside}`);
  }

  const linkPath = join(dir, 'link.txt');
  if (!existsSync(linkPath)) {
    problems.push(`${folder}: add link.txt with the Etsy listing link`);
    continue;
  }

  const link = parseEtsyLink(readFileSync(linkPath, 'utf8'));
  if ('error' in link) {
    problems.push(`${folder}/link.txt: ${link.error}`);
    continue;
  }

  const mockups = images(join(dir, 'mockups')).length;
  const interior = images(join(dir, 'interior')).length;
  const loose = readdirSync(dir).filter(isImage);
  if (loose.length) problems.push(`${folder}: move ${loose.join(', ')} into mockups/ or interior/`);
  if (!mockups) problems.push(`${folder}: mockups/ needs at least 1 image`);
  if (loose.length || !mockups) continue;

  const target = `${link.listingId}-${link.slug || slugify(folder) || 'book'}`;
  const other = folders.find((f) => f !== folder && f.startsWith(`${link.listingId}-`));
  if (other) {
    problems.push(`${folder}: listing ${link.listingId} already has a folder (${other})`);
    continue;
  }
  if (target !== folder) renameSync(dir, join(base, target));
  writeFileSync(join(base, target, 'link.txt'), `${link.url}\n`);
  converted.push(...(await convertColourPngs(join(base, target))));
  ready.push({ folder: target, url: link.url, mockups, interior });
}

// Every book, not just new ones: images replaced later get caught too, and already-small ones are skipped
const MB = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;
const shrunk = [];
for (const folder of readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory())) {
  shrunk.push(...(await shrinkBook(join(base, folder.name))));
}
for (const note of setAside) console.log(`  note   ${note}`);
if (setAside.length) console.log('');
if (converted.length) {
  const before = converted.reduce((sum, r) => sum + r.before, 0);
  const after = converted.reduce((sum, r) => sum + r.after, 0);
  console.log(`Converted ${converted.length} colour PNG(s) to JPG: ${MB(before)} → ${MB(after)}`);
}
if (shrunk.length) {
  const before = shrunk.reduce((sum, r) => sum + r.before, 0);
  const after = shrunk.reduce((sum, r) => sum + r.after, 0);
  console.log(`Shrank ${shrunk.length} image(s) to ${MAX_LONG_SIDE} px max: ${MB(before)} → ${MB(after)}\n`);
}

if (ready.length) {
  console.log('Ready for Claude to write product.json:');
  for (const r of ready) console.log(`  ${r.folder}  (${r.mockups} mockup(s), ${r.interior} interior)  ${r.url}`);
}
for (const p of problems) console.log(`  fix    ${p}`);
if (!ready.length && !problems.length) console.log('No new books — every folder already has product.json.');
if (problems.length) process.exit(1);
