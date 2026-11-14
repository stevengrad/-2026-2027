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

export type RuleType = 'interval' | 'from_start' | 'to_end';

export interface TeamScheduleRule {
  id: string;
  teamId: string;
  teamName: string;
  type: RuleType;
  startTime: string; // 'HH:MM'
  endTime: string;   // 'HH:MM'
}

export const RULES_STORAGE_KEY = 'anbia_team_schedule_rules';
export const RANDOMIZE_STORAGE_KEY = 'anbia_schedule_randomize';

export function loadScheduleRules(): TeamScheduleRule[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(RULES_STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveScheduleRules(rules: TeamScheduleRule[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    }
  } catch {}
}

export function loadScheduleRandomize(): boolean {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(RANDOMIZE_STORAGE_KEY) === 'true' : false;
  } catch {
    return false;
  }
}

export function saveScheduleRandomize(val: boolean) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(RANDOMIZE_STORAGE_KEY, String(val));
    }
  } catch {}
}

/**
 * Gives every fixture a slot.
 * When rules are present:
 *  - Constrained teams (e.g. David the Prophet) are assigned exclusively to slots matching their time window.
 *  - Matches are spaced to avoid back-to-back playing.
 *  - If randomize is enabled, matches of the constrained team are randomized within that window,
 *    and remaining matches are randomized in the remaining slots.
 */
export function scheduleFixtures(
  fixtures: readonly Fixture[],
  o: ScheduleOptions,
  rules: readonly TeamScheduleRule[] = [],
  randomize = false
): Assigned[] {
  const slots = buildSlots(fixtures.length, o);
  const stepMs = (o.matchMinutes + o.gapMinutes) * 60000;

  if (!rules.length) {
    // Standard deterministic / randomized scheduling without constraints
    const pool = fixtures.map((f, i) => ({ f, i, rand: Math.random() })),
      lastAt = new Map<string, number>(),
      played = new Map<string, number>(),
      out: Assigned[] = [];

    for (const slot of slots) {
      const at = Date.parse(slot.iso);
      let bestK = -1;
      let best: [number, number, number] = [9, 999, 999];

      pool.forEach(({ f, i, rand }, k) => {
        const back2back = [f.home, f.away].some((t) => lastAt.has(t) && at - lastAt.get(t)! <= stepMs) ? 1 : 0;
        const load = (played.get(f.home) ?? 0) + (played.get(f.away) ?? 0);
        const tie = randomize ? rand : i;
        const s: [number, number, number] = [back2back, load, tie];
        if (bestK < 0 || s[0] < best[0] || (s[0] === best[0] && (s[1] < best[1] || (s[1] === best[1] && s[2] < best[2])))) {
          bestK = k;
          best = s;
        }
      });

      const { f } = pool.splice(bestK, 1)[0];
      for (const t of [f.home, f.away]) {
        lastAt.set(t, at);
        played.set(t, (played.get(t) ?? 0) + 1);
      }
      out.push({ id: f.id, ...slot });
    }
    return out;
  }

  // Two-pass constrained scheduling:
  const assignedSlots = new Map<number, Fixture>();
  const lastAt = new Map<string, number>();
  const played = new Map<string, number>();

  const isSlotAllowedForTeam = (slot: Slot, rule: TeamScheduleRule): boolean => {
    const slotStartMin = toMin(slot.time);
    const slotEndMin = slotStartMin + o.matchMinutes;
    const rStart = rule.type === 'from_start' ? toMin(o.dayStart) : toMin(rule.startTime);
    const rEnd = rule.type === 'to_end' ? toMin(o.dayEnd) : toMin(rule.endTime);
    return slotStartMin >= rStart && slotEndMin <= rEnd;
  };

  const constrainedFixtures: Fixture[] = [];
  const normalFixtures: Fixture[] = [];

  for (const f of fixtures) {
    const hasRule = rules.some(
      (r) => r.teamId === f.home || r.teamName === f.home || r.teamId === f.away || r.teamName === f.away
    );
    if (hasRule) {
      constrainedFixtures.push(f);
    } else {
      normalFixtures.push(f);
    }
  }

  if (randomize) {
    constrainedFixtures.sort(() => Math.random() - 0.5);
  }

  // Pass 1: assign constrained fixtures to allowed slots
  for (const f of constrainedFixtures) {
    const fRules = rules.filter(
      (r) => r.teamId === f.home || r.teamName === f.home || r.teamId === f.away || r.teamName === f.away
    );

    let chosenSlotIdx = -1;
    for (let idx = 0; idx < slots.length; idx++) {
      if (assignedSlots.has(idx)) continue;
      const slot = slots[idx];
      const at = Date.parse(slot.iso);

      const allRulesPass = fRules.every((r) => isSlotAllowedForTeam(slot, r));
      if (!allRulesPass) continue;

      const isBackToBack = [f.home, f.away].some(
        (t) => lastAt.has(t) && Math.abs(at - lastAt.get(t)!) <= stepMs
      );
      if (isBackToBack) continue;

      chosenSlotIdx = idx;
      break;
    }

    if (chosenSlotIdx === -1) {
      // Fallback: pick any slot within window even if tight
      for (let idx = 0; idx < slots.length; idx++) {
        if (assignedSlots.has(idx)) continue;
        const slot = slots[idx];
        if (fRules.every((r) => isSlotAllowedForTeam(slot, r))) {
          chosenSlotIdx = idx;
          break;
        }
      }
    }

    if (chosenSlotIdx !== -1) {
      assignedSlots.set(chosenSlotIdx, f);
      const at = Date.parse(slots[chosenSlotIdx].iso);
      for (const t of [f.home, f.away]) {
        lastAt.set(t, at);
        played.set(t, (played.get(t) ?? 0) + 1);
      }
    } else {
      normalFixtures.push(f);
    }
  }

  // Pass 2: fill remaining slots with remaining fixtures
  const remainingPool = normalFixtures.map((f, i) => ({ f, i, rand: Math.random() }));
  if (randomize) {
    remainingPool.sort((a, b) => a.rand - b.rand);
  }

  for (let idx = 0; idx < slots.length; idx++) {
    if (assignedSlots.has(idx)) continue;
    const slot = slots[idx];
    const at = Date.parse(slot.iso);

    let bestK = -1;
    let best: [number, number, number] = [9, 999, 999];

    remainingPool.forEach(({ f, i, rand }, k) => {
      const back2back = [f.home, f.away].some(
        (t) => lastAt.has(t) && Math.abs(at - lastAt.get(t)!) <= stepMs
      ) ? 1 : 0;
      const load = (played.get(f.home) ?? 0) + (played.get(f.away) ?? 0);
      const tie = randomize ? rand : i;
      const s: [number, number, number] = [back2back, load, tie];
      if (
        bestK < 0 ||
        s[0] < best[0] ||
        (s[0] === best[0] && (s[1] < best[1] || (s[1] === best[1] && s[2] < best[2])))
      ) {
        bestK = k;
        best = s;
      }
    });

    if (bestK !== -1) {
      const { f } = remainingPool.splice(bestK, 1)[0];
      assignedSlots.set(idx, f);
      const at2 = Date.parse(slots[idx].iso);
      for (const t of [f.home, f.away]) {
        lastAt.set(t, at2);
        played.set(t, (played.get(t) ?? 0) + 1);
      }
    }
  }

  const out: Assigned[] = [];
  for (let idx = 0; idx < slots.length; idx++) {
    const f = assignedSlots.get(idx);
    if (f) {
      out.push({ id: f.id, ...slots[idx] });
    }
  }
  return out;
}
