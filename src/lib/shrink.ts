import { existsSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import sharp, { type Sharp } from 'sharp';

// Templates draw product images at ≤ 760 px on a 1080 px canvas, so 1600 px leaves 2× headroom
// while keeping a book to ~1–3 MB in this public repo (git history never forgets a big file).
export const MAX_LONG_SIDE = 1600;

const SHRINKABLE = ['.png', '.jpg', '.jpeg'];

export type ShrinkResult = { file: string; before: number; after: number };

/** Downscales one image in place if its long side exceeds `maxLongSide`; keeps name and format. */
export async function shrinkImage(path: string, maxLongSide = MAX_LONG_SIDE): Promise<ShrinkResult | null> {
  const ext = extname(path).toLowerCase();
  if (!SHRINKABLE.includes(ext)) return null;

  const { width = 0, height = 0 } = await sharp(path).metadata();
  if (Math.max(width, height) <= maxLongSide) return null;

  const before = statSync(path).size;
  const resized = sharp(path).resize({ width: maxLongSide, height: maxLongSide, fit: 'inside', withoutEnlargement: true });
  let encoded: Sharp;
  if (ext !== '.png') {
    encoded = resized.jpeg({ quality: 88, mozjpeg: true });
  } else if (await isGreyscale(path)) {
    // Downscaled line art gains grey edge pixels that bloat a full-colour PNG; 16 grey levels
    // look identical on screen and come out ~5× smaller than the print original
    encoded = resized.flatten({ background: '#ffffff' }).toColourspace('b-w').png({ palette: true, colours: 16, compressionLevel: 9 });
  } else {
    encoded = resized.png({ compressionLevel: 9 });
  }
  const buffer = await encoded.toBuffer();
  // Smaller pixels don't always mean a smaller file; the point is repo size, so never grow it
  if (buffer.length >= before) return null;

  // Write beside, then swap, so an interrupted run never leaves a half-written image
  const tmp = `${path}.shrinking`;
  writeFileSync(tmp, buffer);
  renameSync(tmp, path);
  return { file: path, before, after: buffer.length };
}

/** True when every sampled pixel is grey (R≈G≈B) — i.e. black-and-white line art, not a colour mockup */
async function isGreyscale(path: string): Promise<boolean> {
  const { data, info } = await sharp(path).flatten({ background: '#ffffff' }).resize(64, 64, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  if (info.channels < 3) return true;
  for (let i = 0; i < data.length; i += info.channels) {
    const [r = 0, g = 0, b = 0] = [data[i], data[i + 1], data[i + 2]];
    if (Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b)) > 12) return false;
  }
  return true;
}

/** Shrinks every oversized image in a book's mockups/ and interior/ folders. */
export async function shrinkBook(bookDir: string, maxLongSide = MAX_LONG_SIDE): Promise<ShrinkResult[]> {
  const results: ShrinkResult[] = [];
  for (const sub of ['mockups', 'interior']) {
    const dir = join(bookDir, sub);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      const result = await shrinkImage(join(dir, name), maxLongSide);
      if (result) results.push(result);
    }
  }
  return results;
}
