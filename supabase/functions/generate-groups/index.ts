// Admin-only. Uses caller's JWT for RLS and is_admin() checks.
import { z } from 'npm:zod@3';
import { cors, dbError, json, userClient } from '../_shared/http.ts';
import { generateGroups } from '../_shared/tournament.ts';

const body = z.object({
  action: z.enum(['preview', 'execute']),
  seed: z.number().int().min(0).max(2 ** 32 - 1).optional(),
}).strict();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(req, { error: 'validation', message: 'طلب غير صالح.' }, 400);

  const db = userClient(req);
  const { data: admin } = await db.rpc('is_admin');
  if (admin !== true) return json(req, { error: 'forbidden', message: 'غير مصرّح لك بهذا الإجراء.' }, 403);

  const { data: t } = await db.from('tournaments').select('id').limit(1).single();
  if (!t) return json(req, { error: 'server_error', message: 'البطولة غير مُعدّة بعد.' }, 500);

  const { data: teams, error: e1 } = await db
    .from('teams')
    .select('id, team_number, saint:saints(id, name_ar, portrait_path)')
    .eq('tournament_id', t.id)
    .eq('status', 'approved')
    .order('team_number');

  if (e1) return dbError(req, e1.message);
  if (!teams || teams.length < 3) {
    return json(req, { error: 'not_enough_teams', message: 'يلزم ٣ فرق معتمدة على الأقل لإنشاء المجموعات.' }, 422);
  }

  const seed = parsed.data.seed ?? crypto.getRandomValues(new Uint32Array(1))[0];
  const groupRes = generateGroups(teams.map((x) => x.id), seed);
  if (!groupRes.ok) {
    if (groupRes.reason === 'five_teams_needs_admin_choice') {
      return json(req, {
        error: 'five_teams_needs_admin_choice',
        message: 'يوجد ٥ فرق معتمدة. نظام المجموعات يتطلب ٣ أو ٤ فرق للمجموعة. يرجى اعتماد فريق إضافي أو تعديل التقسيم.',
      }, 422);
    }
    return json(req, { error: 'invalid_team_count', message: 'عدد الفرق غير صالح لتقسيم المجموعات.' }, 422);
  }

  if (parsed.data.action === 'preview') {
    const teamMap = new Map(teams.map((tm) => [tm.id, tm]));
    const groups = groupRes.groups.map((ids, idx) => ({
      groupNumber: idx + 1,
      groupName: `المجموعة ${idx + 1}`,
      teams: ids.map((id) => {
        const team = teamMap.get(id);
        const saint = Array.isArray(team?.saint) ? team.saint[0] : team?.saint;
        return {
          id,
          teamNumber: team?.team_number,
          saintName: saint?.name_ar ?? 'بدون اسم',
          portraitPath: saint?.portrait_path ?? null,
        };
      }),
    }));
    return json(req, {
      seed,
      teamCount: teams.length,
      groupCount: groups.length,
      groups,
    });
  }

  const { error } = await db.rpc('publish_groups', {
    p_tournament: t.id,
    p_seed: seed,
    p_groups: groupRes.groups,
  });

  if (error) return dbError(req, error.message);
  return json(req, { ok: true, seed, groupCount: groupRes.groups.length });
});
