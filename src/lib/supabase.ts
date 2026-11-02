import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const supabase = url && key ? createClient(url, key) : null;   // publishable key only — safe for the browser
export const isConfigured = Boolean(supabase);

/** Public Storage bucket "saints". Returns null when no approved portrait exists (a branded placeholder is shown). */
export const portraitUrl = (path?: string | null) => (path && url ? `${url}/storage/v1/object/public/saints/${path}` : null);

export class ApiError extends Error {
  constructor(public code: string, message: string, public issues?: { path: string; message: string }[]) { super(message); }
}

export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  if (!url || !key) throw new ApiError('not_configured', 'الموقع غير مُهيّأ بعد، حاول لاحقاً.');
  let token = key;
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) token = session.access_token;
  }
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/${name}`, { method: 'POST', body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${token}` } });
  } catch { throw new ApiError('network', 'تعذّر الاتصال بالإنترنت، تحقق من الشبكة وأعد المحاولة.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'server_error', data.message ?? 'حدث خطأ غير متوقع، حاول مرة أخرى.', data.issues);
  return data as T;
}
