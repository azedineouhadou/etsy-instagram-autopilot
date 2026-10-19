import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import sharp from 'sharp';
import { shrinkBook, shrinkImage } from './shrink.js';

const dir = mkdtempSync(join(tmpdir(), 'shrink-test-'));
after(() => rmSync(dir, { recursive: true, force: true }));

async function image(path: string, width: number, height: number, background = '#ffcc88') {
  await sharp({ create: { width, height, channels: 3, background } }).toFile(path);
}

/** A black-and-white "line art" page: white with black stripes */
async function lineArt(path: string, width: number, height: number) {
  const stripes = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${Array.from({ length: 40 }, (_, i) => `<line x1="0" y1="${i * 80}" x2="${width}" y2="${i * 80 + 40}" stroke="black" stroke-width="8"/>`).join('')}</svg>`,
  );
  await sharp({ create: { width, height, channels: 4, background: '#ffffffff' } }).composite([{ input: stripes }]).png().toFile(path);
}

describe('shrinkImage', () => {
  it('downscales a print-size line-art page to 1600 px as compact greyscale, keeping proportions and format', async () => {
    const file = join(dir, 'page.png');
    await lineArt(file, 2550, 3300);
    const result = await shrinkImage(file);
    assert.ok(result);
    assert.ok(result.after < result.before);
    const meta = await sharp(file).metadata();
    assert.equal(meta.format, 'png');
    assert.equal(meta.height, 1600);
    assert.equal(meta.width, Math.round((2550 * 1600) / 3300));
    assert.equal(meta.isPalette, true);
  });

  it('keeps colour images in colour', async () => {
    const file = join(dir, 'colour.png');
    await image(file, 2000, 2400, '#e07b39');
    await shrinkImage(file);
    const { data } = await sharp(file).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
    assert.notEqual(data[0], data[2]);
  });

  it('shrinks landscape JPEGs by their width', async () => {
    const file = join(dir, 'mockup.jpg');
    await image(file, 3000, 2000);
    await shrinkImage(file);
    const meta = await sharp(file).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.deepEqual([meta.width, meta.height], [1600, 1067]);
  });

  it('leaves images that are already small enough untouched', async () => {
    const file = join(dir, 'small.png');
    await image(file, 912, 1168);
    assert.equal(await shrinkImage(file), null);
  });

  it('ignores files that are not images', async () => {
    assert.equal(await shrinkImage(join(dir, 'notes.txt')), null);
  });
});

describe('shrinkBook', () => {
  it('only touches oversized images in mockups/ and interior/, and a second run changes nothing', async () => {
    const book = join(dir, '1234567890-test-book');
    mkdirSync(join(book, 'mockups'), { recursive: true });
    mkdirSync(join(book, 'interior'), { recursive: true });
    await image(join(book, 'mockups', '1.png'), 900, 1100);
    await lineArt(join(book, 'interior', '01.png'), 2550, 3300);
    await lineArt(join(book, 'interior', '02.png'), 2550, 3300);

    const first = await shrinkBook(book);
    assert.deepEqual(
      first.map((r) => r.file.slice(book.length + 1)),
      ['interior/01.png', 'interior/02.png'],
    );
    assert.deepEqual(await shrinkBook(book), []);
  });
});
