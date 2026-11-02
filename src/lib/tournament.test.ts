import { describe, it, expect } from 'vitest';
import * as T from './tournament';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe('team generation', () => {
  const expected: Record<number, number[]> = { 4:[4],5:[5],7:[7],8:[4,4],9:[5,4],10:[5,5],11:[6,5],12:[6,6],13:[7,6],14:[7,7],15:[5,5,5],16:[6,5,5],17:[6,6,5],18:[6,6,6] };
  for (const [n, s] of Object.entries(expected)) it(`${n} players -> ${s.join('+')}`, () => {
    const r = T.generateTeams(ids(+n), 42);
    expect(r.teams.map((t) => t.length)).toEqual(s);
    expect(r.waiting).toEqual([]);
  });
  it('0-3 players wait', () => { for (const n of [0,1,2,3]) expect(T.generateTeams(ids(n), 1).teams).toEqual([]); });
  it('every n in 4..200 stays within 4..7, no duplicates, nobody lost', () => {
    for (let n = 4; n <= 200; n++) {
      const r = T.generateTeams(ids(n), n), flat = r.teams.flat();
      expect(r.teams.every((t) => t.length >= 4 && t.length <= 7)).toBe(true);
      expect(new Set(flat).size).toBe(n);
    }
  });
  it('is deterministic per seed and varies across seeds', () => {
    expect(T.generateTeams(ids(12), 7)).toEqual(T.generateTeams(ids(12), 7));
    expect(T.generateTeams(ids(12), 7).teams).not.toEqual(T.generateTeams(ids(12), 8).teams);
  });
});

describe('groups', () => {
  const exp: Record<number, number[]> = { 3:[3],4:[4],6:[3,3],7:[4,3],8:[4,4],9:[3,3,3],10:[4,3,3],11:[4,4,3],12:[4,4,4],13:[4,3,3,3],14:[4,4,3,3],15:[4,4,4,3] };
  for (const [n, s] of Object.entries(exp)) it(`${n} teams`, () => expect(T.groupSizes(+n)).toEqual(s));
  it('five teams stop for admin; <3 invalid', () => {
    expect(T.generateGroups(ids(5), 1)).toEqual({ ok: false, reason: 'five_teams_needs_admin_choice' });
    expect(T.groupSizes(2)).toBeNull();
  });
  it('never makes 1- or 2-team groups', () => { for (let n = 3; n <= 80; n++) { const s: number[] | null = T.groupSizes(n); if (s) expect(s.every((x: number) => x === 3 || x === 4) && s.reduce((a: number, b: number) => a + b, 0) === n).toBe(true); } });
  it('round robin size', () => expect(T.roundRobin(ids(4)).length).toBe(6));
});

describe('standings', () => {
  it('points, GD, GF', () => {
    const r = T.standings(['A','B','C'], [
      { home:'A', away:'B', hs:2, as:0 }, { home:'B', away:'C', hs:1, as:1 }, { home:'A', away:'C', hs:0, as:1 }]);
    expect(r.map((x) => x.team)).toEqual(['C','A','B']);
    expect(r[0]).toMatchObject({ pts: 4, gd: 1, p: 2 });
  });
  it('head-to-head breaks full ties; unresolved flagged', () => {
    const r = T.standings(['A','B'], [{ home:'A', away:'B', hs:1, as:0 }]);
    expect(r.map((x) => x.team)).toEqual(['A','B']);
    const d = T.standings(['A','B'], [{ home:'A', away:'B', hs:1, as:1 }]);
    expect(d.every((x) => x.tied)).toBe(true);
  });
});

describe('scorers', () => {
  it('excludes own goals, unattributed goals and cards', () => {
    const r = T.topScorers([
      { type:'goal', playerId:'a', isOwnGoal:false }, { type:'goal', playerId:'a', isOwnGoal:false },
      { type:'goal', playerId:'b', isOwnGoal:true }, { type:'goal', playerId:null, isOwnGoal:false },
      { type:'yellow_card', playerId:'c', isOwnGoal:false }]);
    expect(r).toEqual([{ playerId:'a', goals:2 }]);
  });
});

describe('knockout byes and bracket pairings', () => {
  it.each([[8,8,0],[6,8,2],[5,8,3],[3,4,1],[12,16,4],[2,2,0]])('%i teams', (q, size, byes) => {
    const p = T.bracketPlan(q); expect(p.size).toBe(size); expect(p.byes).toBe(byes);
    expect(p.byeSeeds).toEqual(Array.from({ length: byes }, (_, i) => i + 1));
  });
  it('bracketSeedOrder generates correct sequence', () => {
    expect(T.bracketSeedOrder(2)).toEqual([1, 2]);
    expect(T.bracketSeedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(T.bracketSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(T.bracketSeedOrder(16)).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);
  });
  it('bracketPairings generates seeded matches', () => {
    const b8 = T.bracketPairings(8);
    expect(b8.pairs).toEqual([[1, 8], [4, 5], [2, 7], [3, 6]]);
    const b6 = T.bracketPairings(6);
    expect(b6.size).toBe(8);
    expect(b6.byes).toBe(2);
    expect(b6.byeSeeds).toEqual([1, 2]);
    expect(b6.pairs).toEqual([[1, 8], [4, 5], [2, 7], [3, 6]]);
  });
});

describe('deadline (Africa/Cairo)', () => {
  it('open 1s before, closed at and after', () => {
    expect(T.isRegistrationOpen(new Date('2026-11-07T21:58:59Z'))).toBe(true);
    expect(T.isRegistrationOpen(new Date('2026-11-07T21:59:00Z'))).toBe(false);
    expect(T.isRegistrationOpen(new Date('2026-11-08T00:00:00Z'))).toBe(false);
  });
  it('Sunday in Cairo, not UTC', () => {
    expect(T.isSundayInCairo(new Date('2026-11-01T22:30:00Z'))).toBe(false); // Sun 22:30 UTC = Mon 00:30 Cairo
    expect(T.isSundayInCairo(new Date('2026-11-01T10:00:00Z'))).toBe(true);
  });
});
