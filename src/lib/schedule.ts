// Automatic group-stage scheduling (pure; Africa/Cairo wall-clock times).
// Defaults: matches start 4:45 pm, every match lasts 10 min, 5 min spare between two matches,
// and the last match must be finished by 7:30 pm  =>  a new match every 15 minutes, 11 matches per day.

export interface ScheduleOptions {
  startDate: string;                 // 'YYYY-MM-DD' – first day that may be used (a Cairo calendar date)
  days: 'sundays' | 'daily';         // which days matches may be played on
  dayStart: string;                  // 'HH:MM' kick-off of the first match of each day
  dayEnd: string;                    // 'HH:MM' latest moment a match may END
  matchMinutes: number;
  gapMinutes: number;
}
export const DEFAULT_SCHEDULE = { days: 'sundays', dayStart: '16:45', dayEnd: '19:30', matchMinutes: 10, gapMinutes: 5 } as const;

export interface Fixture { id: string; home: string; away: string }
export interface Slot { date: string; time: string; iso: string }
export interface Assigned extends Slot { id: string }

const toMin = (hhmm: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm); return m ? +m[1] * 60 + +m[2] : NaN; };
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Validation message (Arabic) or null when the options are usable. */
export function validateSchedule(o: ScheduleOptions): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.startDate)) return 'اختر تاريخ أول يوم للمباريات.';
  if (Number.isNaN(toMin(o.dayStart)) || Number.isNaN(toMin(o.dayEnd))) return 'صيغة الوقت غير صحيحة.';
  if (!(o.matchMinutes >= 1) || !(o.gapMinutes >= 0)) return 'مدة المباراة يجب أن تكون ١ دقيقة على الأقل.';
  if (slotsPerDay(o) < 1) return 'الوقت المحدد لا يتسع لمباراة واحدة.';
  return null;
}

/** Kick-off minutes (since midnight) available in one day. */
export function dayStarts(o: ScheduleOptions): number[] {
  const out: number[] = [], step = o.matchMinutes + o.gapMinutes, end = toMin(o.dayEnd);
  for (let t = toMin(o.dayStart); t + o.matchMinutes <= end; t += step) out.push(t);
  return out;
}
export const slotsPerDay = (o: ScheduleOptions) => dayStarts(o).length;

// ----- Africa/Cairo wall-clock -> instant (handles Egypt's daylight saving time) -----
function cairoOffsetMin(utcMs: number) {
  const v = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', timeZoneName: 'shortOffset' }).formatToParts(new Date(utcMs)).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = /GMT([+-])(\d+)(?::(\d+))?/.exec(v);
  return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +(m[3] ?? 0)) : 0;
}
export function cairoToIso(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number), min = toMin(time);
  const asUtc = Date.UTC(y, mo - 1, d, 0, min);
  let t = asUtc - cairoOffsetMin(asUtc) * 60000;
  t = asUtc - cairoOffsetMin(t) * 60000;
  return new Date(t).toISOString();
}
/** Today's date in Cairo, 'YYYY-MM-DD'. */
export const cairoToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(now);
/** The next given weekday (0 = Sunday ... 5 = Friday) strictly after `from` (a Cairo date). */
export function nextWeekday(dow: number, from = cairoToday()): string {
  const [y, m, d] = from.split('-').map(Number), dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + (((dow - dt.getUTCDay() + 7) % 7) || 7));
  return dt.toISOString().slice(0, 10);
}
export const nextSunday = (from = cairoToday()) => nextWeekday(0, from);

/** The first `count` slots, day after day, starting at o.startDate. */
export function buildSlots(count: number, o: ScheduleOptions): Slot[] {
  const starts = dayStarts(o), slots: Slot[] = [];
  const [y, m, d] = o.startDate.split('-').map(Number), cursor = new Date(Date.UTC(y, m - 1, d));
  for (let guard = 0; slots.length < count && starts.length && guard < 400; guard++, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (o.days === 'sundays' && cursor.getUTCDay() !== 0) continue;
    const date = cursor.toISOString().slice(0, 10);
    for (const t of starts) { if (slots.length >= count) break; slots.push({ date, time: hhmm(t), iso: cairoToIso(date, hhmm(t)) }); }
  }
  return slots;
}

/**
 * Gives every fixture a slot. Deterministic. Rules, in priority order:
 *  1) a team should not play in two consecutive slots (back-to-back) when another fixture can be placed instead;
 *  2) teams that have played fewer matches so far go first, so every team's matches are spread over the days;
 *  3) otherwise keep the order the fixtures were given in.
 */
export function scheduleFixtures(fixtures: readonly Fixture[], o: ScheduleOptions): Assigned[] {
  const slots = buildSlots(fixtures.length, o);
  const pool = fixtures.map((f, i) => ({ f, i })), lastAt = new Map<string, number>(), played = new Map<string, number>(), out: Assigned[] = [];
  const stepMs = (o.matchMinutes + o.gapMinutes) * 60000;
  for (const slot of slots) {
    const at = Date.parse(slot.iso);
    let bestK = -1, best: [number, number, number] = [9, 0, 0];
    pool.forEach(({ f, i }, k) => {
      const back2back = [f.home, f.away].some((t) => lastAt.has(t) && at - lastAt.get(t)! <= stepMs) ? 1 : 0;
      const load = (played.get(f.home) ?? 0) + (played.get(f.away) ?? 0);
      const s: [number, number, number] = [back2back, load, i];
      if (bestK < 0 || s[0] < best[0] || (s[0] === best[0] && (s[1] < best[1] || (s[1] === best[1] && s[2] < best[2])))) { bestK = k; best = s; }
    });
    const { f } = pool.splice(bestK, 1)[0];
    for (const t of [f.home, f.away]) { lastAt.set(t, at); played.set(t, (played.get(t) ?? 0) + 1); }
    out.push({ id: f.id, ...slot });
  }
  return out;
}
