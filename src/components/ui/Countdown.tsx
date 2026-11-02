import { useCountdown } from '../../hooks/useTournament';
import { pad2 } from '../../lib/format';

export function Countdown({ deadline }: { deadline?: string }) {
  const c = useCountdown(deadline);
  if (c.closed) return <p className="font-heading text-lg text-gold">انتهى موعد التسجيل</p>;
  const items: [number, string][] = [[c.days, 'يوم'], [c.hours, 'ساعة'], [c.minutes, 'دقيقة'], [c.seconds, 'ثانية']];
  return (<div role="timer" aria-label="الوقت المتبقي لإغلاق التسجيل" className="flex justify-center gap-2 sm:gap-3" dir="rtl">
    {items.map(([v, l]) => (<div key={l} className="w-16 rounded-xl border border-gold/40 bg-midnight/60 py-2 text-center sm:w-20">
      <div className="font-heading text-2xl text-gold sm:text-3xl" aria-hidden="true">{pad2(v)}</div><div className="text-xs text-ivory/70">{l}</div></div>))}</div>);
}
