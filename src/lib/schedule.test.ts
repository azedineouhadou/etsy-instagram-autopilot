import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadSchedule, nextMonday, todayIn, weekSlots, zonedIso } from './schedule.js';

const NY = 'America/New_York';

describe('zonedIso', () => {
  it('uses -04:00 in US summer time and -05:00 after the November change', () => {
    assert.equal(zonedIso('2026-10-19', '18:00', NY), '2026-10-19T18:00:00-04:00');
    assert.equal(zonedIso('2026-10-31', '21:00', NY), '2026-10-31T21:00:00-04:00');
    // Clocks go back at 02:00 on Sun 1 Nov 2026
    assert.equal(zonedIso('2026-11-01', '19:00', NY), '2026-11-01T19:00:00-05:00');
    assert.equal(zonedIso('2026-11-02', '18:00', NY), '2026-11-02T18:00:00-05:00');
  });

  it('switches back to -04:00 when US summer time starts (Sun 14 Mar 2027)', () => {
    assert.equal(zonedIso('2027-03-13', '12:00', NY), '2027-03-13T12:00:00-05:00');
    assert.equal(zonedIso('2027-03-14', '19:00', NY), '2027-03-14T19:00:00-04:00');
  });

  it('produces the same instant as the wall-clock time it names', () => {
    const iso = zonedIso('2026-11-04', '12:00', NY);
    const shown = new Intl.DateTimeFormat('en-US', { timeZone: NY, hour: 'numeric', hourCycle: 'h23' }).format(new Date(iso));
    assert.equal(shown, '12');
  });
});

describe('dates', () => {
  it('finds the next Monday (never today)', () => {
    assert.equal(nextMonday('2026-10-19'), '2026-10-26'); // a Monday → the following one
    assert.equal(nextMonday('2026-10-21'), '2026-10-26');
    assert.equal(nextMonday('2026-10-25'), '2026-10-26'); // Sunday
  });

  it("reads today's date in New York, not UTC", () => {
    // 02:30 UTC on the 20th is still the evening of the 19th in New York
    assert.equal(todayIn(NY, new Date('2026-10-20T02:30:00Z')), '2026-10-19');
  });
});

describe('weekSlots', () => {
  const schedule = loadSchedule();

  it('5 posts: picks the best and normal days, skips the low-engagement ones, in calendar order', () => {
    const slots = weekSlots(schedule, '2026-10-26', 5);
    assert.deepEqual(
      slots.map((s) => s.weekday),
      ['monday', 'tuesday', 'wednesday', 'thursday', 'sunday'],
    );
    assert.equal(slots[0]?.scheduledAt, '2026-10-26T18:00:00-04:00');
    // The week straddles the clock change: Sunday 1 Nov is already -05:00
    assert.equal(slots.at(-1)?.scheduledAt, '2026-11-01T19:00:00-05:00');
  });

  it('3 posts: Wednesday first, then Tuesday and Thursday', () => {
    assert.deepEqual(
      weekSlots(schedule, '2026-11-02', 3).map((s) => s.weekday),
      ['tuesday', 'wednesday', 'thursday'],
    );
  });

  it('honours an explicit list of days', () => {
    assert.deepEqual(
      weekSlots(schedule, '2026-11-02', 3, ['monday', 'wednesday', 'friday']).map((s) => `${s.weekday} ${s.time}`),
      ['monday 18:00', 'wednesday 12:00', 'friday 11:00'],
    );
  });
});
