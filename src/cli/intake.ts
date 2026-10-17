import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { parseEtsyLink, slugify } from '../lib/etsy-link.js';
import { PATHS } from '../lib/library.js';
import { INSTAGRAM_LIMITS } from '../schemas/instagram-limits.js';

/**
 * Prepares new books dropped into assets/products/: reads link.txt, renames the
 * folder to <listingId>-<slug> and cleans the link. Writing product.json is left
 * to Claude, which reads the live listing in Chrome.
 */
const { values } = parseArgs({ options: { root: { type: 'string', default: '.' } } });
const base = join(values.root, PATHS.products);

const isImage = (f: string) => (INSTAGRAM_LIMITS.imageExtensions as readonly string[]).includes(extname(f).toLowerCase());
const images = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter(isImage) : []);

const problems: string[] = [];
const ready: { folder: string; url: string; mockups: number; interior: number }[] = [];

const folders = existsSync(base)
  ? readdirSync(base, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
  : [];

for (const folder of folders) {
  const dir = join(base, folder);
  if (existsSync(join(dir, 'product.json'))) continue;

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
  ready.push({ folder: target, url: link.url, mockups, interior });
}

if (ready.length) {
  console.log('Ready for Claude to write product.json:');
  for (const r of ready) console.log(`  ${r.folder}  (${r.mockups} mockup(s), ${r.interior} interior)  ${r.url}`);
}
for (const p of problems) console.log(`  fix    ${p}`);
if (!ready.length && !problems.length) console.log('No new books — every folder already has product.json.');
if (problems.length) process.exit(1);
