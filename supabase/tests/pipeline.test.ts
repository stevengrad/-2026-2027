// Run from a folder WITHOUT package.json (copy supabase/ there): deno test --config deno.json --allow-env --allow-net --allow-read supabase/tests/pipeline.test.ts
// deno.json = {"nodeModulesDir":"auto"}. Simulates Supabase + Cloudflare with a stubbed fetch.
Deno.env.set('SUPABASE_URL', 'http://sb.local'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'k');
Deno.env.set('SUPABASE_ANON_KEY', 'k'); Deno.env.set('TURNSTILE_SECRET_KEY', 's'); Deno.env.set('ALLOWED_ORIGINS', 'https://x.github.io');
const { publicEndpoint, teamSchema } = await import('../functions/_shared/http.ts');
const assertEquals = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };

let calls: string[] = [], captchaOk = true, limitOk = true, limitMax = -1;
globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('turnstile')) { calls.push('captcha'); return Response.json({ success: captchaOk }); }
  if (url.includes('/rpc/rate_limit_hit')) { calls.push('ratelimit'); limitMax = JSON.parse(String(init?.body)).p_max; return Response.json(limitOk); }
  if (url.includes('/rest/v1/tournaments')) return Response.json({ id: 'tid' });
  if (url.includes('/rpc/register_team_tx')) { calls.push('register'); return Response.json('team-1'); }
  throw new Error('unexpected ' + url);
}) as typeof fetch;

const handler = publicEndpoint(teamSchema, 'team', 40, (db, i, t) => db.rpc('register_team_tx', { p_tournament: t, p_saint: i.saintId, p_players: i.players, p_key: i.idempotencyKey }));
const body = JSON.stringify({ saintId: crypto.randomUUID(), turnstileToken: 'tok', idempotencyKey: 'k'.repeat(20),
  players: ['مينا جرجس', 'بيشوي سمير', 'كيرلس عادل', 'مارك نبيل'].map((name) => ({ name, class: 'داود النبي' })) });
const send = () => handler(new Request('http://f/', { method: 'POST', body, headers: { 'content-type': 'application/json' } }));
const reset = (c = true, l = true) => { calls = []; captchaOk = c; limitOk = l; };

Deno.test('failed captcha never consumes the visitor\'s rate-limit quota', async () => {
  reset(false); const r = await send(); assertEquals(r.status, 403); assertEquals(calls, ['captcha']);
});
Deno.test('rate limit is checked only after captcha passes', async () => {
  reset(true, false); const r = await send(); assertEquals(r.status, 429); assertEquals(calls, ['captcha', 'ratelimit']);
});
Deno.test('normal registration succeeds, with a limit that tolerates shared networks', async () => {
  reset(); const r = await send(); assertEquals(r.status, 200); assertEquals(calls, ['captcha', 'ratelimit', 'register']); assertEquals(limitMax, 40);
});
