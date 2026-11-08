import { cairoToIso } from './schedule';
const nf = new Intl.NumberFormat('ar-EG');
export const num = (n: number) => nf.format(n);
export const pad2 = (n: number) => (n < 10 ? '٠' : '') + nf.format(n);
/** Arabic search normalisation: strips diacritics, unifies alef/ya/ta-marbuta forms. */
export const norm = (s: string) => s.replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim().toLowerCase();

const TZ = 'Africa/Cairo';
const fmtDay = new Intl.DateTimeFormat('ar-EG', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = new Intl.DateTimeFormat('ar-EG', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
const fmtKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });
export const dayLabel = (iso: string) => fmtDay.format(new Date(iso));
export const timeLabel = (iso: string) => fmtTime.format(new Date(iso));
/** yyyy-mm-dd in Africa/Cairo, used to group matches by calendar day. */
export const dayKey = (iso: string) => fmtKey.format(new Date(iso));

// ----- Africa/Cairo <-> <input type="datetime-local"> (never uses the device timezone) -----
const fmtDeadline = new Intl.DateTimeFormat('ar-EG', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
/** e.g. "الجمعة، ١٣ نوفمبر ٢٠٢٦ في ١٢:٠٠ ص" */
export const deadlineLabel = (iso: string) => fmtDeadline.format(new Date(iso));
export function isoToCairoLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}
export function cairoLocalToIso(local: string): string | null {
  const [d, t] = local.split('T');
  return /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') && /^\d{2}:\d{2}/.test(t ?? '') ? cairoToIso(d, t.slice(0, 5)) : null;
}
