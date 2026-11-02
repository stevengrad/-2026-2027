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
