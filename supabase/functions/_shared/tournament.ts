// Pure tournament logic. The database/Edge Functions remain the source of truth;
// these functions are reused by Edge Functions (Deno) and unit-tested here.

export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const a = [...items], rnd = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fewest teams so none exceeds 7, split as evenly as possible. n<4 => []. */
export function teamSizes(n: number): number[] {
  if (n < 4) return [];
  const k = Math.ceil(n / 7), base = Math.floor(n / k), extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

export function generateTeams(playerIds: readonly string[], seed: number) {
  const unique = [...new Set(playerIds)];
  const sizes = teamSizes(unique.length);
  if (!sizes.length) return { teams: [] as string[][], waiting: unique, seed };
  const mixed = shuffle(unique, seed);
  let off = 0;
  const teams = sizes.map((s) => { const t = mixed.slice(off, off + s); off += s; return t; });
  return { teams, waiting: [] as string[], seed };
}

/** Groups of 4 preferred, 3 allowed. null => no valid partition (e.g. 5 teams, <3 teams). */
export function groupSizes(n: number): number[] | null {
  if (n < 3) return null;
  const g = Math.ceil(n / 4);
  if (3 * g > n) return null;
  const fours = n - 3 * g;
  return Array.from({ length: g }, (_, i) => (i < fours ? 4 : 3));
}

export function generateGroups<T>(teamIds: readonly T[], seed: number) {
  const sizes = groupSizes(teamIds.length);
  if (!sizes) return { ok: false as const, reason: teamIds.length === 5 ? 'five_teams_needs_admin_choice' : 'invalid_team_count' };
  const mixed = shuffle(teamIds, seed);
  let off = 0;
  return { ok: true as const, seed, groups: sizes.map((s) => { const g = mixed.slice(off, off + s); off += s; return g; }) };
}

export function roundRobin<T>(teams: readonly T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) out.push([teams[i], teams[j]]);
  return out;
}

export interface Result { home: string; away: string; hs: number; as: number }
export interface Row { team: string; p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number; tied?: boolean }

function table(teams: string[], results: Result[]): Map<string, Row> {
  const m = new Map(teams.map((t) => [t, { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 } as Row]));
  for (const r of results) {
    const h = m.get(r.home), a = m.get(r.away);
    if (!h || !a) continue;
    h.p++; a.p++; h.gf += r.hs; h.ga += r.as; a.gf += r.as; a.ga += r.hs;
    if (r.hs > r.as) { h.w++; a.l++; h.pts += 3; }
    else if (r.hs < r.as) { a.w++; h.l++; a.pts += 3; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  m.forEach((r) => (r.gd = r.gf - r.ga));
  return m;
}

/** Completed results only. Order: points, GD, GF, head-to-head points; leftovers flagged `tied` for admin. */
export function standings(teams: string[], results: Result[]): Row[] {
  const rows = [...table(teams, results).values()];
  const key = (r: Row) => `${r.pts}|${r.gd}|${r.gf}`;
  rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  const out: Row[] = [];
  for (let i = 0; i < rows.length;) {
    let j = i; while (j < rows.length && key(rows[j]) === key(rows[i])) j++;
    const cluster = rows.slice(i, j);
    if (cluster.length > 1) {
      const ids = cluster.map((c) => c.team);
      const h2h = table(ids, results.filter((r) => ids.includes(r.home) && ids.includes(r.away)));
      cluster.sort((a, b) => h2h.get(b.team)!.pts - h2h.get(a.team)!.pts);
      cluster.forEach((c, k) => {
        const pts = h2h.get(c.team)!.pts;
        c.tied = cluster.some((o, q) => q !== k && h2h.get(o.team)!.pts === pts);
      });
    }
    out.push(...cluster); i = j;
  }
  return out;
}

export interface GoalEvent { type: 'goal' | 'yellow_card' | 'red_card'; playerId: string | null; isOwnGoal: boolean }
/** Compare teams from groups with different numbers of matches on a per-match basis.
 * Positive return means b ranks ahead of a.
 */
export interface GroupPerformance {
  pts: number; gd: number; gf: number; yellowCards: number; redCards: number; played: number;
}

export function normalizedPerThree(value: number, played: number): number {
  return played > 0 ? (value * 3) / played : 0;
}

function compareRateDescending(aValue: number, aPlayed: number, bValue: number, bPlayed: number) {
  return bValue * aPlayed - aValue * bPlayed;
}
function compareRateAscending(aValue: number, aPlayed: number, bValue: number, bPlayed: number) {
  return aValue * bPlayed - bValue * aPlayed;
}

export function compareNormalizedPerformance(a: GroupPerformance, b: GroupPerformance): number {
  const ap = Math.max(1, a.played), bp = Math.max(1, b.played);
  return compareRateDescending(a.pts, ap, b.pts, bp)
    || compareRateDescending(a.gd, ap, b.gd, bp)
    || compareRateDescending(a.gf, ap, b.gf, bp)
    || compareRateAscending(a.yellowCards, ap, b.yellowCards, bp)
    || compareRateAscending(a.redCards, ap, b.redCards, bp);
}

export interface QualifiedSeed extends GroupPerformance {
  id: string; saintName: string; groupPosition: number;
}

/** Group winners are always seeded before runners-up, then third-place qualifiers.
 * Within each tier, normalized performance determines the seed.
 */
export function orderQualifiedSeeds<T extends QualifiedSeed>(teams: readonly T[]): T[] {
  return [...teams].sort((a, b) => a.groupPosition - b.groupPosition
    || compareNormalizedPerformance(a, b)
    || a.saintName.localeCompare(b.saintName, 'ar')
    || a.id.localeCompare(b.id));
}

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** Stable key for detecting equal normalized records without floating-point rounding. */
export function normalizedPerformanceKey(team: GroupPerformance): string {
  const played = Math.max(1, team.played);
  return [team.pts, team.gd, team.gf, team.yellowCards, team.redCards]
    .map((value) => { const divisor = gcd(value, played); return `${value / divisor}/${played / divisor}`; })
    .join('|');
}

export function topScorers(events: GoalEvent[]) {
  const c = new Map<string, number>();
  for (const e of events) if (e.type === 'goal' && !e.isOwnGoal && e.playerId) c.set(e.playerId, (c.get(e.playerId) ?? 0) + 1);
  return [...c].map(([playerId, goals]) => ({ playerId, goals })).sort((a, b) => b.goals - a.goals);
}

/** Byes go to the highest seeds (seed 1 first). */
export function bracketPlan(qualified: number) {
  if (qualified < 2) throw new Error('need at least 2 qualified teams');
  const size = 2 ** Math.ceil(Math.log2(qualified)), byes = size - qualified;
  return { size, byes, byeSeeds: Array.from({ length: byes }, (_, i) => i + 1) };
}

export function bracketSeedOrder(size: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const nextSize = seeds.length * 2;
    const next: number[] = [];
    for (const s of seeds) next.push(s, nextSize + 1 - s);
    seeds = next;
  }
  return seeds;
}

export function bracketPairings(qualifiedCount: number) {
  const plan = bracketPlan(qualifiedCount);
  const seeds = bracketSeedOrder(plan.size);
  const pairs: [number, number][] = [];
  for (let i = 0; i < seeds.length; i += 2) pairs.push([seeds[i], seeds[i + 1]]);
  return { ...plan, pairs };
}

// 7 Nov 2026 23:59 Cairo (EET, UTC+2 on that date). DB check is authoritative (uses Africa/Cairo tz).
export const REGISTRATION_DEADLINE = new Date('2026-11-07T23:59:00+02:00');
export const isRegistrationOpen = (now: Date, deadline = REGISTRATION_DEADLINE) => now.getTime() < deadline.getTime();
export const isSundayInCairo = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'short' }).format(d) === 'Sun';
