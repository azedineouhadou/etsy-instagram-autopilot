import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Post } from '../schemas/post.js';
import type { Product } from '../schemas/product.js';
import { assignBooks, formatMix } from './plan.js';
import type { Slot } from './schedule.js';

function book(listingId: string, interior = 6): Product {
  return {
    listingId,
    title: `Book ${listingId}`,
    url: `https://www.etsy.com/listing/${listingId}/x`,
    theme: 'test',
    ageRange: { min: 18, max: null },
    pageCount: 50,
    format: 'digital',
    sellingPoints: ['x'],
    keywords: [],
    mockups: ['mockups/1.png'],
    interior: Array.from({ length: interior }, (_, i) => `interior/${i + 1}.png`),
    sourceCheckedAt: '2026-10-19',
  };
}

function slot(date: string): Slot {
  return { date, weekday: 'monday', time: '18:00', scheduledAt: `${date}T18:00:00-04:00` };
}

function posted(listingId: string, date: string): Post {
  return {
    id: `${date}-x`,
    listingId,
    scheduledAt: `${date}T18:00:00-04:00`,
    approved: true,
    media: { type: 'image', file: 'media/01.jpg' },
    caption: 'x',
    hashtags: [],
  };
}

const WEEK = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-11-01'].map(slot);

describe('formatMix', () => {
  it('5 posts: 2 reels, 2 carousels, 1 single image, never the same format twice in a row', () => {
    assert.deepEqual(formatMix(5), ['reel', 'carousel', 'spotlight', 'reel', 'carousel']);
  });
  it('small weeks still get a reel', () => {
    assert.deepEqual(formatMix(1), ['reel']);
    assert.deepEqual(formatMix(3), ['reel', 'carousel', 'carousel']);
  });
});

describe('assignBooks', () => {
  it('with enough books, follows every rotation rule', () => {
    const books = ['1111111', '2222222', '3333333'].map((id) => book(id));
    const plan = assignBooks(WEEK, formatMix(5), books, []);
    assert.ok(plan.every((p) => p.warnings.length === 0), JSON.stringify(plan.map((p) => p.warnings)));
    // No book twice within 3 days
    const ids = plan.map((p) => p.product.listingId);
    assert.notEqual(ids[0], ids[1]);
    assert.notEqual(ids[1], ids[2]);
  });

  it('starts with the book featured longest ago', () => {
    const books = [book('1111111'), book('2222222')];
    const history = [posted('1111111', '2026-10-24'), posted('2222222', '2026-10-10')];
    assert.equal(assignBooks([WEEK[0]!], ['spotlight'], books, history)[0]?.product.listingId, '2222222');
  });

  it('with too few books, still fills every slot but says which rule it breaks', () => {
    const plan = assignBooks(WEEK, formatMix(5), [book('1111111'), book('2222222')], []);
    assert.equal(plan.length, 5);
    assert.ok(plan.some((p) => p.warnings.length > 0));
  });

  it("never gives a carousel to a book that doesn't have the pages for it", () => {
    const plan = assignBooks([WEEK[0]!], ['carousel'], [book('1111111', 2), book('2222222', 8)], []);
    assert.equal(plan[0]?.product.listingId, '2222222');
  });
});
