// Admin-only knockout generation. Qualification is computed only after every
// group match is complete, with fair-play cards and penalty tiebreaks included.
import { z } from 'npm:zod@3';
import { cors, dbError, json, userClient } from '../_shared/http.ts';
import { bracketPairings, compareNormalizedPerformance, normalizedPerformanceKey, normalizedPerThree, orderQualifiedSeeds } from '../_shared/tournament.ts';

type TargetSize = 2 | 4 | 8 | 16 | 32 | 64;
type Stage = 'round_of_64' | 'round_of_32' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'final';

const body = z.object({
  action: z.enum(['preview', 'execute']),
  targetSize: z.union([z.literal(2), z.literal(4), z.literal(8), z.literal(16), z.literal(32), z.literal(64)]),
  penaltyTiebreaks: z.array(z.object({
    key: z.string().min(1).max(200),
    rankings: z.array(z.object({ teamId: z.string().uuid(), rank: z.number().int().min(1).max(64) })).min(2).max(64),
  })).max(32).default([]),
  includeThirdPlace: z.boolean().default(true),
  clearExisting: z.boolean().default(false),
}).strict();

interface TeamStanding {
  id: string; groupId: string; groupName: string; saintName: string; portraitPath: string | null;
  pts: number; gd: number; gf: number; yellowCards: number; redCards: number; played: number;
}
interface QualificationTeam extends TeamStanding { seed: number; qualification: string; groupPosition: number; normalizedPts: number }
interface TieBreak {
  key: string; label: string;
  teams: Pick<TeamStanding, 'id' | 'saintName' | 'pts' | 'gd' | 'gf' | 'yellowCards' | 'redCards' | 'played'>[];
  resolved: boolean;
}

function stagesFor(targetSize: TargetSize): Stage[] {
  if (targetSize === 64) return ['round_of_64', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final'];
  if (targetSize === 32) return ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final'];
  if (targetSize === 16) return ['round_of_16', 'quarter_final', 'semi_final', 'final'];
  if (targetSize === 8) return ['quarter_final', 'semi_final', 'final'];
  if (targetSize === 4) return ['semi_final', 'final'];
  return ['final'];
}

function placeLabel(position: number, best: boolean) {
  const label = position === 1 ? 'متصدر المجموعة' : position === 2 ? 'وصيف المجموعة' : `المركز ${position}`;
  return best ? `أفضل فرق ${label}` : label;
}
function metricKey(team: TeamStanding, crossGroup = false) {
  return crossGroup ? normalizedPerformanceKey(team) : `${team.pts}|${team.gd}|${team.gf}|${team.yellowCards}|${team.redCards}`;
}
/** Points, goal difference and goals-for descend. Fewer cards is better. */
function compareMetrics(a: TeamStanding, b: TeamStanding) {
  return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.yellowCards - b.yellowCards || a.redCards - b.redCards;
}
function fallbackOrder(a: TeamStanding, b: TeamStanding) { return a.saintName.localeCompare(b.saintName, 'ar') || a.id.localeCompare(b.id); }

function rankTiedTeams(
  teams: TeamStanding[], scope: string, label: string, penaltyRanks: Map<string, Map<string, number>>,
  ties: Map<string, TieBreak>, crossGroup = false,
) {
  const compare = (a: TeamStanding, b: TeamStanding) => crossGroup
    ? compareNormalizedPerformance(a, b)
    : compareMetrics(a, b);
  const metricSorted = [...teams].sort((a, b) => compare(a, b) || fallbackOrder(a, b));
  const ranked: TeamStanding[] = [];
  for (let start = 0; start < metricSorted.length;) {
    let end = start + 1;
    while (end < metricSorted.length && metricKey(metricSorted[end], crossGroup) === metricKey(metricSorted[start], crossGroup)) end++;
    const cluster = metricSorted.slice(start, end);
    if (cluster.length > 1) {
      const key = `${scope}:${metricKey(cluster[0], crossGroup)}`;
      const ranks = penaltyRanks.get(key);
      const hasEveryRank = cluster.every((team) => ranks?.has(team.id));
      const resolved = Boolean(hasEveryRank && new Set(cluster.map((team) => ranks!.get(team.id))).size === cluster.length);
      ties.set(key, { key, label, teams: cluster.map(({ id, saintName, pts, gd, gf, yellowCards, redCards, played }) => ({ id, saintName, pts, gd, gf, yellowCards, redCards, played })), resolved });
      cluster.sort((a, b) => resolved ? ranks!.get(a.id)! - ranks!.get(b.id)! : fallbackOrder(a, b));
    }
    ranked.push(...cluster);
    start = end;
  }
  return ranked;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(req, { error: 'validation', message: 'بيانات غير صالحة.' }, 400);

  const db = userClient(req);
  const { data: admin } = await db.rpc('is_admin');
  if (admin !== true) return json(req, { error: 'forbidden', message: 'غير مصرّح لك بهذا الإجراء.' }, 403);
  const { data: tournament } = await db.from('tournaments').select('id').limit(1).single();
  if (!tournament) return json(req, { error: 'server_error', message: 'البطولة غير مُعدّة بعد.' }, 500);

  const { data: groupMatches, error: groupMatchesError } = await db.from('matches').select('id, status').eq('tournament_id', tournament.id).eq('stage', 'group');
  if (groupMatchesError) return dbError(req, groupMatchesError.message);
  if (!groupMatches?.length || groupMatches.some((match) => match.status !== 'completed')) {
    return json(req, { error: 'groups_not_finished', message: 'لا يمكن إنشاء الأدوار الإقصائية قبل انتهاء وتسجيل نتائج كل مباريات المجموعات.' }, 422);
  }

  const { data: rawStandings, error: standingsError } = await db.from('public_group_standings')
    .select('group_id, group_name, team_id, saint_name_ar, portrait_path, played, pts, gd, gf');
  if (standingsError) return dbError(req, standingsError.message);
  if (!rawStandings?.length || rawStandings.length < parsed.data.targetSize) {
    return json(req, { error: 'target_size_exceeds_teams', message: `لا يوجد عدد كافٍ من فرق المجموعات لاختيار ${parsed.data.targetSize} فريقاً.` }, 422);
  }

  const { data: cardEvents, error: cardError } = await db.from('match_events').select('team_id, event_type')
    .in('match_id', groupMatches.map((match) => match.id)).in('event_type', ['yellow_card', 'red_card']);
  if (cardError) return dbError(req, cardError.message);
  const cards = new Map<string, { yellow: number; red: number }>();
  for (const event of cardEvents ?? []) {
    const count = cards.get(event.team_id) ?? { yellow: 0, red: 0 };
    if (event.event_type === 'yellow_card') count.yellow++;
    if (event.event_type === 'red_card') count.red++;
    cards.set(event.team_id, count);
  }
  const penaltyRanks = new Map<string, Map<string, number>>();
  for (const tiebreak of parsed.data.penaltyTiebreaks) penaltyRanks.set(tiebreak.key, new Map(tiebreak.rankings.map((ranking) => [ranking.teamId, ranking.rank])));

  const groups = new Map<string, TeamStanding[]>();
  for (const row of rawStandings) {
    const rowCards = cards.get(row.team_id) ?? { yellow: 0, red: 0 };
    const standing: TeamStanding = {
      id: row.team_id, groupId: row.group_id, groupName: row.group_name, saintName: row.saint_name_ar, portraitPath: row.portrait_path ?? null,
      pts: Number(row.pts), gd: Number(row.gd), gf: Number(row.gf), yellowCards: rowCards.yellow, redCards: rowCards.red, played: Number(row.played),
    };
    groups.set(standing.groupId, [...(groups.get(standing.groupId) ?? []), standing]);
  }

  const groupCount = groups.size;
  const maxRelevantPosition = Math.max(1, Math.ceil(parsed.data.targetSize / groupCount));
  const ties = new Map<string, TieBreak>();
  const groupRankings = [...groups.values()].map((group) => rankTiedTeams(
    group, `group:${group[0].groupId}`, `ترتيب ${group[0].groupName}`, penaltyRanks, ties,
  ));

  const selected: Array<{ team: TeamStanding; qualification: string; groupPosition: number }> = [];
  let remaining = parsed.data.targetSize;
  for (let position = 0; remaining > 0 && position < maxRelevantPosition; position++) {
    const candidates = groupRankings.map((group) => group[position]).filter((team): team is TeamStanding => Boolean(team));
    if (!candidates.length) continue;
    if (remaining >= candidates.length) {
      selected.push(...candidates.map((team) => ({ team, qualification: placeLabel(position + 1, false), groupPosition: position + 1 })));
      remaining -= candidates.length;
    } else {
      const best = rankTiedTeams(candidates, `best:${position + 1}`, `مقارنة أفضل فرق ${placeLabel(position + 1, false)} (النقاط وفارق الأهداف لكل مباراة)`, penaltyRanks, ties, true);
      selected.push(...best.slice(0, remaining).map((team) => ({ team, qualification: placeLabel(position + 1, true), groupPosition: position + 1 })));
      remaining = 0;
    }
  }
  if (remaining > 0) return json(req, { error: 'not_enough_qualifiers', message: 'لا يوجد عدد كافٍ من الفرق المؤهلة للحجم المختار.' }, 422);

  // Fixed seeding: all group winners first, then runners-up, then third-place qualifiers.
  // Within each tier, compare points/GD/GF/cards per match to account for 3- and 4-team groups.
  const qualifiedTeams: QualificationTeam[] = orderQualifiedSeeds(selected.map(({ team, ...meta }) => ({ ...team, ...meta })))
    .map(({ qualification, ...team }, index) => ({ ...team, qualification, seed: index + 1, normalizedPts: normalizedPerThree(team.pts, team.played) }));
  const qualifiedById = new Map(qualifiedTeams.map((team) => [team.id, team]));
  const tiebreaks = [...ties.values()].filter((tie) => {
    const selectedTeams = tie.teams.map((team) => qualifiedById.get(team.id)).filter((team): team is QualificationTeam => Boolean(team));
    if (selectedTeams.length > 0 && selectedTeams.length < tie.teams.length) return true;
    // A tie inside one group must also be resolved when it spans different seed tiers
    // (for example, first place vs second place), even if every tied team qualifies.
    return tie.key.startsWith('group:') && new Set(selectedTeams.map((team) => team.groupPosition)).size > 1;
  });
  const unresolved = tiebreaks.filter((tie) => !tie.resolved);

  const { data: existingMatches, error: existingError } = await db.from('matches').select('id, stage, status')
    .eq('tournament_id', tournament.id).neq('stage', 'group');
  if (existingError) return dbError(req, existingError.message);
  if ((existingMatches ?? []).some((match) => match.status === 'completed') && !parsed.data.clearExisting) {
    return json(req, { error: 'knockout_locked_results_exist', message: 'توجد مباريات إقصائية منتهية بالفعل. يلزم تأكيد الحذف لإعادة الإنشاء.' }, 409);
  }

  const targetSize = parsed.data.targetSize as TargetSize;
  const pairings = bracketPairings(qualifiedTeams.length);
  const stages = stagesFor(targetSize);
  const teamBySeed = new Map(qualifiedTeams.map((team) => [team.seed, team]));
  const firstRoundMatches = pairings.pairs.map(([seedA, seedB], index) => ({
    matchNumber: index + 1, stage: stages[0], seedA, seedB,
    homeTeam: teamBySeed.get(seedA) ?? null, awayTeam: teamBySeed.get(seedB) ?? null, isBye: false,
  }));
  const preview = {
    targetSize, groupCount, qualifiedCount: qualifiedTeams.length, bracketSize: pairings.size, byes: 0, stages,
    firstRoundStage: stages[0], firstRoundMatches,
    qualifiedTeams,
    tiebreaks, canExecute: unresolved.length === 0, includeThirdPlace: parsed.data.includeThirdPlace,
  };
  if (parsed.data.action === 'preview') return json(req, preview);
  if (unresolved.length > 0) return json(req, { error: 'penalty_tiebreak_required', message: 'سجّل ترتيب ركلات الترجيح لكل تعادل مؤثر قبل إنشاء الشجرة.', tiebreaks }, 422);

  if ((existingMatches ?? []).length > 0) {
    const ids = existingMatches!.map((match) => match.id);
    await db.from('match_events').delete().in('match_id', ids);
    const { error: deleteError } = await db.from('matches').delete().in('id', ids);
    if (deleteError) return dbError(req, deleteError.message);
  }
  interface MatchInsert { tournament_id: string; stage: Stage | 'third_place'; home_team_id: string | null; away_team_id: string | null; status: 'scheduled'; bracket_order: number | null }
  const matches: MatchInsert[] = firstRoundMatches.map((match) => ({
    tournament_id: tournament.id, stage: stages[0], home_team_id: match.homeTeam?.id ?? null, away_team_id: match.awayTeam?.id ?? null, status: 'scheduled', bracket_order: match.matchNumber,
  }));
  let matchesAtStage = targetSize / 4;
  for (let stageIndex = 1; stageIndex < stages.length; stageIndex++) {
    for (let match = 0; match < matchesAtStage; match++) matches.push({ tournament_id: tournament.id, stage: stages[stageIndex], home_team_id: null, away_team_id: null, status: 'scheduled', bracket_order: match + 1 });
    matchesAtStage /= 2;
  }
  if (parsed.data.includeThirdPlace && targetSize >= 4) matches.push({ tournament_id: tournament.id, stage: 'third_place', home_team_id: null, away_team_id: null, status: 'scheduled', bracket_order: null });
  const { data: inserted, error: insertError } = await db.from('matches').insert(matches).select('id, stage');
  if (insertError) return dbError(req, insertError.message);
  return json(req, { ok: true, ...preview, matchesCreated: inserted?.length ?? 0 });
});
