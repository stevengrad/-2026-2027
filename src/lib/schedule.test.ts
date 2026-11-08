import { describe, it, expect } from 'vitest';
import * as S from './schedule';

const base: S.ScheduleOptions = { startDate: '2026-11-15', ...S.DEFAULT_SCHEDULE };   // 2026-11-15 is a Sunday
/** n teams, every team plays every other team once (round-robin) inside `groups` groups of `size`. */
const groupFixtures = (groups: number, size: number): S.Fixture[] => {
  const out: S.Fixture[] = [];
  for (let g = 0; g < groups; g++) for (let a = 0; a < size; a++) for (let b = a + 1; b < size; b++) out.push({ id: `g${g}-${a}-${b}`, home: `g${g}t${a}`, away: `g${g}t${b}` });
  return out;
};

describe('daily slots: 4:45 pm - 7:30 pm, 10 min match + 5 min spare', () => {
  it('11 matches fit in a day', () => expect(S.slotsPerDay(base)).toBe(11));
  it('first kick-off 16:45, last 19:15 (ends 19:25, before 19:30)', () => {
    const s = S.dayStarts(base);
    expect(s[0]).toBe(16 * 60 + 45); expect(s[s.length - 1]).toBe(19 * 60 + 15);
  });
  it('a 12th match would end after 7:30 pm, so it moves to the next day', () => {
    const slots = S.buildSlots(12, base);
    expect(slots[10].time).toBe('19:15'); expect(slots[11]).toMatchObject({ date: '2026-11-22', time: '16:45' });
  });
  it('kick-offs are exactly 15 minutes apart', () => {
    const slots = S.buildSlots(11, base);
    for (let i = 1; i < slots.length; i++) expect(Date.parse(slots[i].iso) - Date.parse(slots[i - 1].iso)).toBe(15 * 60000);
  });
});

describe('days and Cairo time', () => {
  it('Sundays only: a Wednesday start moves to the following Sunday', () => expect(S.buildSlots(1, { ...base, startDate: '2026-11-11' })[0].date).toBe('2026-11-15'));
  it('daily mode uses consecutive days', () => expect(S.buildSlots(12, { ...base, days: 'daily' })[11].date).toBe('2026-11-16'));
  it('winter (UTC+2): 16:45 Cairo = 14:45Z', () => expect(S.cairoToIso('2026-11-15', '16:45')).toBe('2026-11-15T14:45:00.000Z'));
  it('summer (UTC+3): 16:45 Cairo = 13:45Z', () => expect(S.cairoToIso('2026-07-05', '16:45')).toBe('2026-07-05T13:45:00.000Z'));
  it('nextSunday is strictly after today', () => { expect(S.nextSunday('2026-11-08')).toBe('2026-11-15'); expect(S.nextSunday('2026-11-11')).toBe('2026-11-15'); });
  it('next Friday (registration extension): from Sunday 8 Nov -> 13 Nov; from a Friday -> the following Friday', () => {
    expect(S.nextWeekday(5, '2026-11-08')).toBe('2026-11-13'); expect(S.nextWeekday(5, '2026-11-13')).toBe('2026-11-20');
  });
});

describe('assignment', () => {
  it('every fixture gets exactly one distinct slot', () => {
    const f = groupFixtures(2, 4), a = S.scheduleFixtures(f, base);
    expect(a).toHaveLength(12); expect(new Set(a.map((x) => x.id)).size).toBe(12); expect(new Set(a.map((x) => x.iso)).size).toBe(12);
    expect(a.filter((x) => x.date === '2026-11-15')).toHaveLength(11);
  });
  it('no team plays in two consecutive slots when avoidable (2 groups of 4)', () => {
    const f = groupFixtures(2, 4), byId = new Map(f.map((x) => [x.id, x])), a = S.scheduleFixtures(f, base);
    for (let i = 1; i < a.length; i++) {
      if (a[i].date !== a[i - 1].date) continue;
      const p = byId.get(a[i - 1].id)!, c = byId.get(a[i].id)!;
      expect([p.home, p.away].some((t) => t === c.home || t === c.away)).toBe(false);
    }
  });
  it('is deterministic', () => expect(S.scheduleFixtures(groupFixtures(3, 4), base)).toEqual(S.scheduleFixtures(groupFixtures(3, 4), base)));
  it('validation', () => {
    expect(S.validateSchedule(base)).toBeNull();
    expect(S.validateSchedule({ ...base, dayEnd: '16:50' })).not.toBeNull();   // 5 minutes cannot hold a 10-minute match
  });
});
