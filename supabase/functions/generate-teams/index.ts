// Admin-only. Uses the CALLER's JWT, so RLS and is_admin() inside the RPCs authorise every step.
import { z } from 'npm:zod@3';
import { cors, dbError, json, userClient } from '../_shared/http.ts';
import { generateTeams, shuffle } from '../_shared/tournament.ts';

const body = z.object({ action: z.enum(['preview', 'execute']), seed: z.number().int().min(0).max(2 ** 32 - 1).optional() }).strict();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(req, { error: 'validation', message: 'طلب غير صالح.' }, 400);

  const db = userClient(req);
  const { data: admin } = await db.rpc('is_admin');
  if (admin !== true) return json(req, { error: 'forbidden', message: 'غير مصرّح لك بهذا الإجراء.' }, 403);

  const { data: t } = await db.from('tournaments').select('id').limit(1).single();
  const { data: waiting, error: e1 } = await db.from('players').select('id, full_name_ar, class_name_ar')
    .eq('pool_status', 'waiting').is('team_id', null).eq('source', 'individual').order('created_at');
  if (e1 || !t) return dbError(req, e1?.message ?? 'no_tournament');

  // Saints not used by any pending/approved team.
  const [{ data: saints }, { data: used }] = await Promise.all([
    db.from('saints').select('id, name_ar').eq('is_approved', true).eq('is_active', true),
    db.from('teams').select('saint_id').in('status', ['pending', 'approved']).not('saint_id', 'is', null),
  ]);
  const usedIds = new Set((used ?? []).map((u) => u.saint_id));
  const free = (saints ?? []).filter((s) => !usedIds.has(s.id));

  const seed = parsed.data.seed ?? crypto.getRandomValues(new Uint32Array(1))[0];
  const { teams, waiting: stillWaiting } = generateTeams((waiting ?? []).map((p) => p.id), seed);
  const pickedSaints = shuffle(free, seed ^ 0x9e3779b9).slice(0, teams.length);   // never reused; missing => null (admin must assign)
  const saintFor = (i: number) => pickedSaints[i] ?? null;

  if (parsed.data.action === 'preview') {
    const byId = new Map((waiting ?? []).map((p) => [p.id, p]));
    return json(req, {
      seed, availablePlayers: waiting?.length ?? 0, teamCount: teams.length,
      teams: teams.map((ids, i) => ({ size: ids.length, saint: saintFor(i), needsSaint: !saintFor(i),
        players: ids.map((id) => ({ id, name: byId.get(id)!.full_name_ar })) })),
      unassigned: stillWaiting.length,
      notice: stillWaiting.length ? 'عدد اللاعبين أقل من ٤، سيبقون في قائمة الانتظار.' : null,
    });
  }
  if (!teams.length) return json(req, { error: 'not_enough_players', message: 'لا يوجد لاعبون كافون لتكوين فريق.' }, 409);
  const { data, error } = await db.rpc('create_generated_teams', {
    p_tournament: t.id, p_seed: seed, p_teams: teams, p_saints: teams.map((_, i) => saintFor(i)?.id ?? null) });
  if (error) return dbError(req, error.message);
  return json(req, { ok: true, teamIds: data, seed });
});
