import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { TOURNAMENT_CLASSES } from './classes.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const origins = env('ALLOWED_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean);

export const cors = (req: Request) => ({
  'Access-Control-Allow-Origin': origins.includes(req.headers.get('origin') ?? '') ? req.headers.get('origin')! : (origins[0] ?? ''),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Vary': 'Origin',
});
export const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

export const serviceClient = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
export const userClient = (req: Request) => createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'),
  { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } });

// Error codes raised by the database -> Arabic messages. Technical details are never sent to the browser.
export const ERRORS: Record<string, [number, string]> = {
  registration_closed: [403, 'انتهى موعد التسجيل.'],
  saint_taken: [409, 'هذا القديس مختار بالفعل لفريق آخر، اختر قديساً آخر.'],
  saint_unavailable: [409, 'هذا القديس غير متاح حالياً.'],
  duplicate_players: [422, 'يوجد لاعب مكرر في قائمة الفريق.'],
  invalid_player_count: [422, 'عدد لاعبي الفريق يجب أن يكون من ٤ إلى ٧.'],
  player_not_waiting: [409, 'تغيّرت قائمة الانتظار، أعد المعاينة.'],
  invalid_team_size: [422, 'حجم الفريق يجب أن يكون من ٤ إلى ٧ لاعبين.'],
  forbidden: [403, 'غير مصرّح لك بهذا الإجراء.'],
  groups_locked_results_exist: [409, 'لا يمكن تعديل المجموعات لوجود نتائج مسجلة.'],
  invalid_group_size: [422, 'حجم المجموعة يجب أن يكون ٣ أو ٤ فرق.'],
  team_not_approved: [422, 'أحد الفرق غير معتمد.'],
  penalties_required: [422, 'يلزم تسجيل نتيجة ركلات الترجيح عند التعادل في الأدوار الإقصائية.'],
  not_pending: [409, 'الفريق ليس في حالة انتظار.'],
  saint_required: [422, 'يجب تعيين قديس للفريق قبل اعتماده.'],
  team_not_in_match: [422, 'الفريق المحدد ليس طرفاً في هذه المباراة.'],
  player_not_in_team: [422, 'اللاعب لا ينتمي لهذا الفريق.'],
  own_goal_player_must_be_opponent: [422, 'مسجل الهدف العكسي يجب أن يكون من الفريق الخصم.'],
};
export function dbError(req: Request, message: string) {
  const code = Object.keys(ERRORS).find((k) => message.includes(k));
  if (code) return json(req, { error: code, message: ERRORS[code][1] }, ERRORS[code][0]);
  console.error('db_error', message);
  return json(req, { error: 'server_error', message: 'حدث خطأ غير متوقع، حاول مرة أخرى لاحقاً.' }, 500);
}

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyTurnstile(token: string, ip: string) {
  const secret = env('TURNSTILE_SECRET_KEY');
  if (!secret) return false;                                    // fail closed
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  return r.ok && (await r.json()).success === true;
}

export const arabicName = z.string().trim().min(2, 'الاسم قصير جداً').max(80, 'الاسم طويل جداً')
  .regex(/^[\u0600-\u06FF\u0750-\u077F][\u0600-\u06FF\u0750-\u077F .'-]*$/, 'اكتب الاسم بالحروف العربية');
export const className = z.enum(TOURNAMENT_CLASSES, { errorMap: () => ({ message: 'اختر الفصل من القائمة.' }) });
const base = { turnstileToken: z.string().min(1, 'أكمل التحقق الأمني'), idempotencyKey: z.string().min(16).max(100) };

export const teamSchema = z.object({
  saintId: z.string().uuid('اختر قديساً من القائمة'),
  players: z.array(z.object({ name: arabicName, class: className })).min(4, 'أضف ٤ لاعبين على الأقل لتسجيل فريق.').max(7, 'الحد الأقصى ٧ لاعبين'),
  ...base,
}).strict();
export const individualSchema = z.object({ name: arabicName, class: className, ...base }).strict();

/** Shared pipeline for public endpoints: method -> validate -> captcha -> rate limit -> run (service role). */
export function publicEndpoint<S extends z.ZodTypeAny>(
  schema: S, bucket: string, perHour: number,
  run: (db: ReturnType<typeof serviceClient>, input: z.infer<S>, tournamentId: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
    if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json(req, { error: 'validation', message: 'تحقق من البيانات المُدخلة.',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) }, 400);
    const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const db = serviceClient();
    if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) return json(req, { error: 'captcha_failed', message: 'فشل التحقق الأمني، أعد المحاولة.' }, 403);
    // Turnstile is the main bot defence, so it runs first: failed captchas never use up a real visitor's quota.
    // The per-IP cap is only a safety net and is generous because many people share one IP (church Wi-Fi, mobile carrier NAT).
    const { data: ok } = await db.rpc('rate_limit_hit', { p_key: `${bucket}:${await sha256(ip)}`, p_max: perHour, p_window: '1 hour' });
    if (!ok) return json(req, { error: 'rate_limited', message: 'محاولات كثيرة من هذه الشبكة، انتظر قليلاً ثم حاول مرة أخرى.' }, 429);
    const { data: t } = await db.from('tournaments').select('id').limit(1).single();
    if (!t) return json(req, { error: 'server_error', message: 'البطولة غير مُعدّة بعد.' }, 500);
    const { data, error } = await run(db, parsed.data, t.id);
    if (error) return dbError(req, error.message);
    return json(req, { ok: true, id: data });
  };
}
