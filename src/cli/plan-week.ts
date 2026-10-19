import { parseArgs } from 'node:util';
import { loadPosts, loadProducts } from '../lib/library.js';
import { assignBooks, audience, formatMix } from '../lib/plan.js';
import { loadSchedule, nextMonday, todayIn, weekSlots, WEEKDAYS, type Weekday } from '../lib/schedule.js';

/**
 * Plans a week: which days and times (US Eastern, correct DST offset), which format, which book.
 * The /weekly-batch command starts from this, then writes the posts.
 */
const { values } = parseArgs({
  options: {
    week: { type: 'string' },
    posts: { type: 'string', default: '5' },
    days: { type: 'string' },
    json: { type: 'boolean', default: false },
  },
});

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const schedule = loadSchedule();
const count = Number(values.posts);
if (!Number.isInteger(count) || count < 1 || count > 7) fail('--posts must be 1–7');

const short = Object.fromEntries(WEEKDAYS.map((d) => [d.slice(0, 3), d])) as Record<string, Weekday>;
const days = values.days?.split(',').map((d) => short[d.trim().toLowerCase().slice(0, 3)] ?? fail(`unknown day "${d}"`));

// Week = the Monday it starts on; by default the next one in New York (not the local or UTC date)
const monday = values.week ?? nextMonday(todayIn(schedule.timezone, new Date()));
if (!/^\d{4}-\d{2}-\d{2}$/.test(monday) || new Date(`${monday}T12:00:00Z`).getUTCDay() !== 1) {
  fail(`--week must be a Monday as YYYY-MM-DD (got "${monday}")`);
}

const products = loadProducts('.').flatMap((p) => (p.value ? [p.value] : []));
if (!products.length) fail('no books in assets/products — add one first');
const history = [...loadPosts('.', 'published'), ...loadPosts('.', 'queue')].flatMap((p) => (p.value ? [p.value] : []));

const slots = weekSlots(schedule, monday, count, days);
const plan = assignBooks(slots, formatMix(slots.length), products, history);
const clashes = plan.filter((p) => history.some((h) => Date.parse(h.scheduledAt) === Date.parse(p.slot.scheduledAt)));

if (values.json) {
  console.log(
    JSON.stringify(
      plan.map((p) => ({
        folder: `queue/${p.slot.date}-<slug>`,
        scheduledAt: p.slot.scheduledAt,
        weekday: p.slot.weekday,
        format: p.format,
        listingId: p.product.listingId,
        title: p.product.title,
        audience: audience(p.product),
        warnings: p.warnings,
      })),
      null,
      2,
    ),
  );
  process.exit(0);
}

const label = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

console.log(`Week of ${label(monday)} · ${plan.length} posts · ${products.length} book(s) in the library · times in ${schedule.timezone}\n`);
for (const p of plan) {
  console.log(
    `  ${label(p.slot.date).padEnd(11)} ${p.slot.time} ET  ${p.slot.scheduledAt}  ${p.format.padEnd(9)}  ${p.product.title} (${audience(p.product)}, ${p.product.listingId})`,
  );
  for (const w of p.warnings) console.log(`${' '.repeat(17)}warn  rotation: ${w}`);
}
for (const c of clashes) console.log(`\n  warn  ${c.slot.scheduledAt} is already taken by a queued or published post — pick another time`);
if (products.length < 3) console.log(`\n  tip   with ${products.length} book(s) some posts repeat a book; 3–5 books let a 5-post week rotate cleanly`);
console.log(`\nPost folders: queue/<date>-<short-name>/  (e.g. queue/${plan[0]!.slot.date}-${plan[0]!.format})`);
