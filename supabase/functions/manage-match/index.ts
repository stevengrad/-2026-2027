// Admin-only match operations: schedule, scores, events, team slot assignments.
import { z } from 'npm:zod@3';
import { cors, dbError, json, userClient } from '../_shared/http.ts';

const updateDetailsSchema = z.object({
  action: z.literal('update_details'),
  matchId: z.string().uuid(),
  scheduledAt: z.string().nullable().optional(),
  status: z.enum(['scheduled', 'live', 'completed', 'postponed', 'cancelled']).optional(),
  homeTeamId: z.string().uuid().nullable().optional(),
  awayTeamId: z.string().uuid().nullable().optional(),
});

const setScoreSchema = z.object({
  action: z.literal('set_score'),
  matchId: z.string().uuid(),
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  complete: z.boolean().default(false),
  decision: z.enum(['regular', 'extra_time', 'penalties']).default('regular'),
  homePens: z.number().int().min(0).nullable().optional(),
  awayPens: z.number().int().min(0).nullable().optional(),
});

const addEventSchema = z.object({
  action: z.literal('add_event'),
  matchId: z.string().uuid(),
  teamId: z.string().uuid(),
  eventType: z.enum(['goal', 'yellow_card', 'red_card']),
  playerId: z.string().uuid().nullable().optional(),
  isOwnGoal: z.boolean().default(false),
  eventMinute: z.number().int().min(0).max(130).nullable().optional(),
  notes: z.string().max(200).nullable().optional(),
});

const deleteEventSchema = z.object({
  action: z.literal('delete_event'),
  eventId: z.string().uuid(),
});

const resetScoreSchema = z.object({
  action: z.literal('reset_score_to_events'),
  matchId: z.string().uuid(),
});

const bodySchema = z.discriminatedUnion('action', [
  updateDetailsSchema,
  setScoreSchema,
  addEventSchema,
  deleteEventSchema,
  resetScoreSchema,
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json(req, {
      error: 'validation',
      message: 'بيانات غير صالحة.',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    }, 400);
  }

  const db = userClient(req);
  const { data: admin } = await db.rpc('is_admin');
  if (admin !== true) return json(req, { error: 'forbidden', message: 'غير مصرّح لك بهذا الإجراء.' }, 403);

  const payload = parsed.data;

  if (payload.action === 'update_details') {
    const updateObj: Record<string, unknown> = {};
    if (payload.scheduledAt !== undefined) updateObj.scheduled_at = payload.scheduledAt;
    if (payload.homeTeamId !== undefined) updateObj.home_team_id = payload.homeTeamId;
    if (payload.awayTeamId !== undefined) updateObj.away_team_id = payload.awayTeamId;

    if (Object.keys(updateObj).length > 0) {
      const { error } = await db.from('matches').update(updateObj).eq('id', payload.matchId);
      if (error) return dbError(req, error.message);
    }

    if (payload.status !== undefined) {
      const { data: current, error: currentError } = await db.from('matches')
        .select('id, stage, status, home_score, away_score, decision, home_pens, away_pens')
        .eq('id', payload.matchId).single();
      if (currentError || !current) return dbError(req, currentError?.message ?? 'match_not_found');

      // Marking a knockout fixture as completed through the status editor must use
      // the same score RPC as the score editor, so the winner is calculated and
      // advanced automatically. Reopening a completed fixture also clears its
      // unplayed downstream slot safely.
      if (current.stage !== 'group' && (payload.status === 'completed' || current.status === 'completed')) {
        if (payload.status === 'completed' && (current.home_score == null || current.away_score == null)) {
          return json(req, { error: 'score_required', message: 'أدخل نتيجة المباراة أولاً قبل اعتماد انتهائها.' }, 422);
        }
        const { error: scoreError } = await db.rpc('set_match_score', {
          p_match: payload.matchId,
          p_home: current.home_score ?? 0,
          p_away: current.away_score ?? 0,
          p_complete: payload.status === 'completed',
          p_decision: current.decision ?? 'regular',
          p_hp: current.home_pens,
          p_ap: current.away_pens,
        });
        if (scoreError) return dbError(req, scoreError.message);

        if (payload.status !== 'completed') {
          const { error: statusError } = await db.from('matches').update({ status: payload.status }).eq('id', payload.matchId);
          if (statusError) return dbError(req, statusError.message);
        }
      } else {
        const { error: statusError } = await db.from('matches').update({ status: payload.status }).eq('id', payload.matchId);
        if (statusError) return dbError(req, statusError.message);
      }
    }

    const { data, error } = await db.from('matches').select('*').eq('id', payload.matchId).single();
    if (error) return dbError(req, error.message);
    return json(req, { ok: true, match: data });
  }

  if (payload.action === 'set_score') {
    const { error } = await db.rpc('set_match_score', {
      p_match: payload.matchId,
      p_home: payload.homeScore,
      p_away: payload.awayScore,
      p_complete: payload.complete,
      p_decision: payload.decision,
      p_hp: payload.homePens ?? null,
      p_ap: payload.awayPens ?? null,
    });
    if (error) return dbError(req, error.message);
    return json(req, { ok: true });
  }

  if (payload.action === 'add_event') {
    const { data, error } = await db
      .from('match_events')
      .insert({
        match_id: payload.matchId,
        team_id: payload.teamId,
        event_type: payload.eventType,
        player_id: payload.playerId ?? null,
        is_own_goal: payload.isOwnGoal,
        event_minute: payload.eventMinute ?? null,
        notes: payload.notes ?? null,
      })
      .select()
      .single();

    if (error) return dbError(req, error.message);
    return json(req, { ok: true, event: data });
  }

  if (payload.action === 'delete_event') {
    const { error } = await db.from('match_events').delete().eq('id', payload.eventId);
    if (error) return dbError(req, error.message);
    return json(req, { ok: true });
  }

  if (payload.action === 'reset_score_to_events') {
    // Recount goals from events
    const { data: match, error: eM } = await db.from('matches').select('id, home_team_id, away_team_id').eq('id', payload.matchId).single();
    if (eM || !match) return dbError(req, eM?.message ?? 'match_not_found');

    const [{ count: homeGoals }, { count: awayGoals }] = await Promise.all([
      db.from('match_events').select('*', { count: 'exact', head: true }).eq('match_id', payload.matchId).eq('event_type', 'goal').eq('team_id', match.home_team_id),
      db.from('match_events').select('*', { count: 'exact', head: true }).eq('match_id', payload.matchId).eq('event_type', 'goal').eq('team_id', match.away_team_id),
    ]);

    const { error } = await db
      .from('matches')
      .update({
        score_manual: false,
        home_score: homeGoals ?? 0,
        away_score: awayGoals ?? 0,
      })
      .eq('id', payload.matchId);

    if (error) return dbError(req, error.message);
    return json(req, { ok: true, home_score: homeGoals ?? 0, away_score: awayGoals ?? 0 });
  }

  return json(req, { error: 'invalid_action' }, 400);
});
