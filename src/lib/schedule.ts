import { readFileSync } from 'node:fs';
import { z } from 'zod';

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const time = z.string().regex(/^\d{2}:\d{2}$/);

const scheduleSchema = z.object({
  timezone: z.string(),
  days: z.record(
    z.enum(WEEKDAYS),
    z.object({
      windows: z.array(z.string()),
      preferred: z.array(time).min(1),
      bestDay: z.boolean().optional(),
      lowEngagement: z.boolean().optional(),
    }),
  ),
});

export type Schedule = z.infer<typeof scheduleSchema>;
export type Slot = { date: string; weekday: Weekday; time: string; scheduledAt: string };

export function loadSchedule(path = 'brand/schedule.json'): Schedule {
  return scheduleSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

/** Minutes the zone is ahead of UTC at that instant, e.g. -240 for New York in summer */
function zoneOffsetMinutes(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return Math.round((asUtc - instant) / 60_000);
}

/**
 * "2026-11-02" + "18:00" in America/New_York → "2026-11-02T18:00:00-05:00".
 * Computed from the tz database so daylight-saving changes can't be gotten wrong by hand.
 */
export function zonedIso(date: string, hhmm: string, timeZone: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = hhmm.split(':').map(Number) as [number, number];
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes settle the offset when the guess lands on the other side of a DST change
  let offset = zoneOffsetMinutes(wallAsUtc, timeZone);
  offset = zoneOffsetMinutes(wallAsUtc - offset * 60_000, timeZone);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date}T${hhmm}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Today's calendar date in the given zone, as YYYY-MM-DD */
export function todayIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The Monday on or after `date` */
export function nextMonday(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(date, (8 - dow) % 7 || 7);
}

// Which days to use first when the week has fewer posts than days: best day, then normal days, low-engagement days last
const DAY_PRIORITY: Weekday[] = ['wednesday', 'tuesday', 'thursday', 'sunday', 'monday', 'friday', 'saturday'];

/** Posting slots for the week starting `monday`, in calendar order. `days` overrides the automatic pick. */
export function weekSlots(schedule: Schedule, monday: string, count: number, days?: Weekday[]): Slot[] {
  const ranked = [...DAY_PRIORITY].sort((a, b) => rank(schedule, a) - rank(schedule, b));
  const chosen = days ?? ranked.slice(0, Math.min(count, 7));
  return WEEKDAYS.flatMap((weekday, i) => {
    if (!chosen.includes(weekday)) return [];
    const date = addDays(monday, i);
    const time = schedule.days[weekday]?.preferred[0] ?? '18:00';
    return [{ date, weekday, time, scheduledAt: zonedIso(date, time, schedule.timezone) }];
  });
}

function rank(schedule: Schedule, day: Weekday): number {
  const info = schedule.days[day];
  const base = DAY_PRIORITY.indexOf(day);
  if (info?.bestDay) return base - 100;
  if (info?.lowEngagement) return base + 100;
  return base;
}
