// Admin-only. Uses caller's JWT for RLS and is_admin() checks.
import { z } from 'npm:zod@3';
import { cors, dbError, json, userClient } from '../_shared/http.ts';
import { bracketPairings } from '../_shared/tournament.ts';

const body = z.object({
  action: z.enum(['preview', 'execute']),
  qualifiersPerGroup: z.number().int().min(1).max(4).default(2),
  customTeamIds: z.array(z.string().uuid()).optional(),
  includeThirdPlace: z.boolean().default(true),
  clearExisting: z.boolean().default(false),
}).strict();

type Stage = 'round_of_16' | 'quarter_final' | 'semi_final' | 'final';

function getStagesForSize(size: number): Stage[] {
  if (size === 16) return ['round_of_16', 'quarter_final', 'semi_final', 'final'];
  if (size === 8) return ['quarter_final', 'semi_final', 'final'];
  if (size === 4) return ['semi_final', 'final'];
  return ['final'];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(req, { error: 'validation', message: 'بيانات غير صالحة.' }, 400);

  const db = userClient(req);
  const { data: admin } = await db.rpc('is_admin');
  if (admin !== true) return json(req, { error: 'forbidden', message: 'غير مصرّح لك بهذا الإجراء.' }, 403);

  const { data: t } = await db.from('tournaments').select('id').limit(1).single();
  if (!t) return json(req, { error: 'server_error', message: 'البطولة غير مُعدّة بعد.' }, 500);

  // Check existing knockout matches
  const { data: existingMatches, error: eExist } = await db
    .from('matches')
    .select('id, stage, status')
    .eq('tournament_id', t.id)
    .neq('stage', 'group');

  if (eExist) return dbError(req, eExist.message);

  const hasCompleted = (existingMatches ?? []).some((m) => m.status === 'completed');
  if (hasCompleted && !parsed.data.clearExisting) {
    return json(req, {
      error: 'knockout_locked_results_exist',
      message: 'توجد مباريات إقصائية منتهية بالفعل. يلزم تأكيد الحذف لإعادة الإنشاء.',
    }, 409);
  }

  // Get qualified teams
  interface QualifiedTeam {
    id: string;
    teamNumber?: number;
    saintName: string;
    portraitPath: string | null;
    seed: number;
  }

  let qualifiedTeams: QualifiedTeam[] = [];

  if (parsed.data.customTeamIds && parsed.data.customTeamIds.length >= 2) {
    const { data: teams, error: eT } = await db
      .from('teams')
      .select('id, team_number, saint:saints(id, name_ar, portrait_path)')
      .in('id', parsed.data.customTeamIds)
      .eq('status', 'approved');

    if (eT) return dbError(req, eT.message);
    const teamMap = new Map((teams ?? []).map((tm) => [tm.id, tm]));

    qualifiedTeams = parsed.data.customTeamIds.map((id, index) => {
      const tm = teamMap.get(id);
      const saint = Array.isArray(tm?.saint) ? tm.saint[0] : tm?.saint;
      return {
        id,
        teamNumber: tm?.team_number,
        saintName: saint?.name_ar ?? 'فريق',
        portraitPath: saint?.portrait_path ?? null,
        seed: index + 1,
      };
    });
  } else {
    // Get from group standings
    const { data: standings, error: eS } = await db
      .from('public_group_standings')
      .select('group_id, group_name, team_id, saint_name_ar, portrait_path, position, pts, gd, gf')
      .lte('position', parsed.data.qualifiersPerGroup)
      .order('position')
      .order('pts', { ascending: false })
      .order('gd', { ascending: false })
      .order('gf', { ascending: false });

    if (eS) return dbError(req, eS.message);

    if (!standings || standings.length < 2) {
      return json(req, {
        error: 'not_enough_qualifiers',
        message: 'يلزم فريقان على الأقل للتأهل إلى الأدوار الإقصائية.',
      }, 422);
    }

    qualifiedTeams = standings.map((s, index) => ({
      id: s.team_id,
      saintName: s.saint_name_ar,
      portraitPath: s.portrait_path,
      seed: index + 1,
    }));
  }

  if (qualifiedTeams.length < 2) {
    return json(req, {
      error: 'not_enough_qualifiers',
      message: 'يلزم فريقان على الأقل لإنشاء الأدوار الإقصائية.',
    }, 422);
  }

  const pairings = bracketPairings(qualifiedTeams.length);
  const stages = getStagesForSize(pairings.size);
  const teamBySeed = new Map(qualifiedTeams.map((q) => [q.seed, q]));

  // First round matchups
  const firstRoundMatches = pairings.pairs.map(([seedA, seedB], idx) => {
    const teamA = teamBySeed.get(seedA) ?? null;
    const teamB = teamBySeed.get(seedB) ?? null;
    return {
      matchNumber: idx + 1,
      stage: stages[0],
      seedA,
      seedB,
      homeTeam: teamA,
      awayTeam: teamB,
      isBye: !teamA || !teamB,
    };
  });

  if (parsed.data.action === 'preview') {
    return json(req, {
      qualifiedCount: qualifiedTeams.length,
      bracketSize: pairings.size,
      byes: pairings.byes,
      stages,
      firstRoundStage: stages[0],
      firstRoundMatches,
      includeThirdPlace: parsed.data.includeThirdPlace,
    });
  }

  // EXECUTE:
  // 1. Clear existing knockout matches
  if ((existingMatches ?? []).length > 0) {
    const ids = existingMatches!.map((m) => m.id);
    await db.from('match_events').delete().in('match_id', ids);
    const { error: eDel } = await db.from('matches').delete().in('id', ids);
    if (eDel) return dbError(req, eDel.message);
  }

  // 2. Build and insert match rows
  interface MatchInsert {
    tournament_id: string;
    stage: Stage | 'third_place';
    home_team_id: string | null;
    away_team_id: string | null;
    status: 'scheduled';
  }

  const toInsert: MatchInsert[] = [];

  // Round 1
  for (const match of firstRoundMatches) {
    toInsert.push({
      tournament_id: t.id,
      stage: stages[0],
      home_team_id: match.homeTeam?.id ?? null,
      away_team_id: match.awayTeam?.id ?? null,
      status: 'scheduled',
    });
  }

  // Subsequent rounds
  let matchCountForStage = pairings.size / 4;
  for (let s = 1; s < stages.length; s++) {
    const stageName = stages[s];
    for (let m = 0; m < matchCountForStage; m++) {
      toInsert.push({
        tournament_id: t.id,
        stage: stageName,
        home_team_id: null,
        away_team_id: null,
        status: 'scheduled',
      });
    }
    matchCountForStage = matchCountForStage / 2;
  }

  // Third place match
  if (parsed.data.includeThirdPlace && pairings.size >= 4) {
    toInsert.push({
      tournament_id: t.id,
      stage: 'third_place',
      home_team_id: null,
      away_team_id: null,
      status: 'scheduled',
    });
  }

  const { data: inserted, error: eIns } = await db.from('matches').insert(toInsert).select('id, stage');
  if (eIns) return dbError(req, eIns.message);

  return json(req, {
    ok: true,
    bracketSize: pairings.size,
    stages,
    matchesCreated: inserted?.length ?? 0,
  });
});
