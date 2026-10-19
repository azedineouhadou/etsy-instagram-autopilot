import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadPosts, loadProducts, type Loaded } from '../lib/library.js';
import { findRotationIssues } from '../lib/rotation.js';
import { CONTENT_RULES, findBannedPhrases } from '../schemas/content-rules.js';
import { INSTAGRAM_LIMITS } from '../schemas/instagram-limits.js';
import { mediaFiles, type Post } from '../schemas/post.js';
import type { Product } from '../schemas/product.js';

const { values } = parseArgs({ options: { root: { type: 'string', default: '.' } } });
const root = values.root;

const errors: string[] = [];
const warnings: string[] = [];

function checkFiles(owner: string, dir: string, files: string[], allowed: readonly string[]) {
  for (const file of files) {
    if (!existsSync(join(dir, file))) errors.push(`${owner}: file not found: ${file}`);
    if (!allowed.includes(extname(file).toLowerCase())) {
      errors.push(`${owner}: ${file} must be one of ${allowed.join(', ')}`);
    }
  }
}

function checkProduct({ dir, folder, value: product }: Loaded<Product> & { value: Product }) {
  const owner = `product ${folder}`;
  if (!folder.startsWith(`${product.listingId}-`)) {
    errors.push(`${owner}: folder must start with "${product.listingId}-"`);
  }
  checkFiles(owner, dir, [...product.mockups, ...product.interior], INSTAGRAM_LIMITS.imageExtensions);
}

function checkPost(
  { dir, folder, value: post }: Loaded<Post> & { value: Post },
  listingIds: Set<string>,
  now: number,
) {
  const owner = `post ${folder}`;
  if (post.id !== folder) errors.push(`${owner}: id "${post.id}" must match its folder name`);
  if (!listingIds.has(post.listingId)) {
    errors.push(`${owner}: listing ${post.listingId} is not in assets/products`);
  }

  const files = mediaFiles(post);
  if (post.media.type === 'reel') {
    checkFiles(owner, dir, [post.media.video], INSTAGRAM_LIMITS.videoExtensions);
    checkFiles(owner, dir, files.slice(1), INSTAGRAM_LIMITS.publishImageExtensions);
  } else {
    checkFiles(owner, dir, files, INSTAGRAM_LIMITS.publishImageExtensions);
  }

  if (post.media.type === 'carousel' && post.media.files.length < CONTENT_RULES.carouselRecommendedMinSlides) {
    warnings.push(`${owner}: ${post.media.files.length} slides — aim for ${CONTENT_RULES.carouselRecommendedMinSlides} to ${CONTENT_RULES.carouselMaxSlides}`);
  }

  // Caption, hashtags, alt text and every line of text drawn on the images
  const renderPath = join(dir, 'render.json');
  const onImage = existsSync(renderPath) ? readFileSync(renderPath, 'utf8') : '';
  const banned = findBannedPhrases([post.caption, ...post.hashtags, post.altText ?? '', onImage].join('\n'));
  if (banned.length) errors.push(`${owner}: off-limits wording ${banned.join(', ')} — see brand/voice.md`);

  if (Date.parse(post.scheduledAt) < now) warnings.push(`${owner}: scheduledAt is in the past, it will publish on the next run`);
  if (!post.approved) warnings.push(`${owner}: not approved, the publisher will skip it`);
}

function valid<T>(items: Loaded<T>[]): (Loaded<T> & { value: T })[] {
  for (const item of items) for (const e of item.errors) errors.push(`${item.folder}: ${e}`);
  return items.filter((i): i is Loaded<T> & { value: T } => i.value !== undefined);
}

const loadedProducts = loadProducts(root);
for (const p of loadedProducts.filter((p) => p.pending)) {
  warnings.push(`product ${p.folder}: new book waiting for product.json — run npm run intake, then ask Claude to "process new books"`);
}
const products = valid(loadedProducts);
const queued = valid(loadPosts(root, 'queue'));
const published = valid(loadPosts(root, 'published'));

const listingIds = new Set(products.map((p) => p.value.listingId));
products.forEach(checkProduct);

// Validation is a dev-time check, not app logic, so the wall clock is fine here
const now = Date.now();
queued.forEach((p) => checkPost(p, listingIds, now));

const slots = new Map<string, string>();
for (const { folder, value } of queued) {
  const at = new Date(value.scheduledAt).toISOString();
  const clash = slots.get(at);
  if (clash) errors.push(`post ${folder}: same scheduledAt as ${clash}`);
  else slots.set(at, folder);
}

warnings.push(
  ...findRotationIssues(
    queued.map((p) => p.value),
    published.map((p) => p.value),
  ),
);

console.log(`Checked ${products.length} product(s), ${queued.length} queued post(s), ${published.length} published post(s) in ${root}`);
for (const w of warnings) console.log(`  warn   ${w}`);
for (const e of errors) console.log(`  error  ${e}`);

if (errors.length) {
  console.log(`\n✗ ${errors.length} error(s)`);
  process.exit(1);
}
console.log('\n✓ valid');
