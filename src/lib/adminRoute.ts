/**
 * The route is a convenience layer, never an authorisation control. Every
 * administrative operation is still protected by Supabase Auth, RLS and the
 * admin_users table.
 */
const configuredSegment = (import.meta.env.VITE_ADMIN_ROUTE_SEGMENT as string | undefined)?.trim() || 'admin';

export const ADMIN_SEGMENT = configuredSegment.replace(/^\/+|\/+$/g, '') || 'admin';
export const ADMIN_BASE = `/${ADMIN_SEGMENT}`;

export function adminPath(part = '') {
  const cleanPart = part.replace(/^\/+|\/+$/g, '');
  return cleanPart ? `${ADMIN_BASE}/${cleanPart}` : ADMIN_BASE;
}
