import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DEFAULT_SCHEDULE, nextSunday, scheduleFixtures, slotsPerDay, validateSchedule, type Assigned, type ScheduleOptions } from '../../lib/schedule';
import { dayLabel, num, timeLabel } from '../../lib/format';

export interface SchedState { opts: ScheduleOptions; auto: boolean }
export const initialSched = (): SchedState => ({ opts: { startDate: nextSunday(), ...DEFAULT_SCHEDULE }, auto: true });

export interface PlanItem extends Assigned { home: string; away: string }
type Side = { saint?: { name_ar: string } | { name_ar: string }[] | null } | null;
const nameOf = (t: Side) => { const s = Array.isArray(t?.saint) ? t?.saint[0] : t?.saint; return s?.name_ar ?? 'فريق'; };

/** Group matches that can still be scheduled, in group order then creation order. */
export async function buildPlan(opts: ScheduleOptions, onlyUnscheduled: boolean): Promise<PlanItem[]> {
  const bad = validateSchedule(opts);
  if (bad) throw new Error(bad);
  const [{ data: groups, error: e1 }, { data: rows, error: e2 }] = await Promise.all([
    supabase!.from('groups').select('id, sort_order'),
    supabase!.from('matches').select(`id, group_id, status, scheduled_at, created_at, home_team_id, away_team_id,
      home:teams!matches_home_team_id_fkey(saint:saints(name_ar)), away:teams!matches_away_team_id_fkey(saint:saints(name_ar))`)
      .eq('stage', 'group').in('status', ['scheduled', 'postponed']).order('created_at').order('id'),
  ]);
  if (e1 || e2) throw e1 ?? e2;
  const order = new Map((groups ?? []).map((g) => [g.id as string, g.sort_order as number]));
  const list = (rows ?? []).filter((m) => m.home_team_id && m.away_team_id && (!onlyUnscheduled || !m.scheduled_at))
    .sort((a, b) => (order.get(a.group_id as string) ?? 0) - (order.get(b.group_id as string) ?? 0));
  const names = new Map(list.map((m) => [m.id as string, { home: nameOf(m.home as unknown as Side), away: nameOf(m.away as unknown as Side) }]));
  return scheduleFixtures(list.map((m) => ({ id: m.id as string, home: m.home_team_id as string, away: m.away_team_id as string })), opts)
    .map((a) => ({ ...a, ...names.get(a.id)! }));
}
export async function applyPlan(items: PlanItem[]): Promise<number> {
  const { data, error } = await supabase!.rpc('apply_group_schedule', { p_items: items.map((i) => ({ id: i.id, at: i.iso })) });
  if (error) throw error;
  return Number(data ?? 0);
}
export const rangeLabel = (items: PlanItem[]) => items.length ? `من ${dayLabel(items[0].iso)} إلى ${dayLabel(items[items.length - 1].iso)}` : '';

export function SchedulePanel({ state, onChange, hasGroups }: { state: SchedState; onChange: (s: SchedState) => void; hasGroups: boolean }) {
  const qc = useQueryClient();
  const { opts, auto } = state;
  const set = (patch: Partial<ScheduleOptions>) => { onChange({ ...state, opts: { ...opts, ...patch } }); setPlan(null); };
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const [overwrite, setOverwrite] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [done, setDone] = useState<string | null>(null);
  const invalid = validateSchedule(opts), perDay = invalid ? 0 : slotsPerDay(opts);

  const preview = async () => {
    setError(null); setDone(null); setBusy(true);
    try { const p = await buildPlan(opts, !overwrite); if (!p.length) setError(overwrite ? 'لا توجد مباريات مجموعات قابلة للجدولة.' : 'كل مباريات المجموعات لها مواعيد بالفعل. فعّل «إعادة جدولة المباريات التي لها موعد» لتغييرها.'); setPlan(p); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذّرت المعاينة.'); } finally { setBusy(false); }
  };
  const apply = async () => {
    if (!plan?.length) return;
    setError(null); setBusy(true);
    try { const n = await applyPlan(plan); setDone(`تمت جدولة ${num(n)} مباراة ${rangeLabel(plan)}.`); setPlan(null); qc.invalidateQueries(); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذّر تطبيق الجدولة.'); } finally { setBusy(false); }
  };
  const days = plan ? [...new Set(plan.map((p) => p.date))] : [];
  const input = 'field !min-h-10 text-xs';

  return (
    <section className="panel p-6" aria-labelledby="sched-title">
      <h2 id="sched-title" className="mb-1 flex items-center gap-2 font-heading text-lg font-bold text-gold"><CalendarClock className="h-5 w-5" aria-hidden="true" />الجدولة التلقائية لمباريات المجموعات</h2>
      <p className="mb-4 text-xs leading-6 text-ivory/70">
        تُوزَّع المباريات تلقائياً بحسب الأوقات أدناه، مع تجنّب أن يلعب الفريق مباراتين متتاليتين قدر الإمكان. الأوقات بتوقيت القاهرة.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold">أول يوم للمباريات
          <input type="date" className={`${input} mt-1`} value={opts.startDate} onChange={(e) => set({ startDate: e.target.value })} /></label>
        <label className="text-xs font-semibold">أيام اللعب
          <select className={`${input} mt-1`} value={opts.days} onChange={(e) => set({ days: e.target.value as ScheduleOptions['days'] })}>
            <option value="sundays">أيام الأحد فقط</option><option value="daily">كل يوم</option></select></label>
        <label className="text-xs font-semibold">بداية أول مباراة
          <input type="time" className={`${input} mt-1`} value={opts.dayStart} onChange={(e) => set({ dayStart: e.target.value })} /></label>
        <label className="text-xs font-semibold">أقصى وقت لانتهاء آخر مباراة
          <input type="time" className={`${input} mt-1`} value={opts.dayEnd} onChange={(e) => set({ dayEnd: e.target.value })} /></label>
        <label className="text-xs font-semibold">مدة المباراة (دقيقة)
          <input type="number" min={1} max={120} className={`${input} mt-1`} value={opts.matchMinutes} onChange={(e) => set({ matchMinutes: Number(e.target.value) })} /></label>
        <label className="text-xs font-semibold">فاصل بين مباراتين (دقيقة)
          <input type="number" min={0} max={60} className={`${input} mt-1`} value={opts.gapMinutes} onChange={(e) => set({ gapMinutes: Number(e.target.value) })} /></label>
      </div>
      <p className="mt-3 text-xs text-ivory/70">{invalid ? <span className="text-danger">{invalid}</span> : <>يتسع اليوم الواحد لـ <b className="text-gold">{num(perDay)}</b> مباراة.</>}</p>
      <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={auto} onChange={(e) => onChange({ ...state, auto: e.target.checked })} className="h-4 w-4 rounded border-ivory/30 bg-midnight text-gold focus:ring-gold" />جدولة المباريات تلقائياً عند نشر المجموعات</label>

      {hasGroups && (
        <div className="mt-5 border-t border-ivory/10 pt-4">
          <label className="mb-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={overwrite} onChange={(e) => { setOverwrite(e.target.checked); setPlan(null); }} className="h-4 w-4 rounded border-ivory/30 bg-midnight text-gold focus:ring-gold" />إعادة جدولة المباريات التي لها موعد بالفعل</label>
          <div className="flex flex-wrap gap-3">
            <button onClick={preview} className="btn-ghost !min-h-10 text-xs" disabled={busy || !!invalid}>{busy && !plan ? 'جارٍ الحساب…' : 'معاينة الجدولة'}</button>
            {!!plan?.length && <button onClick={apply} className="btn-gold !min-h-10 text-xs" disabled={busy}>{busy ? 'جارٍ التطبيق…' : `تطبيق الجدولة (${num(plan.length)} مباراة)`}</button>}
          </div>
        </div>
      )}
      {error && <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-danger/50 bg-danger/10 p-3 text-xs text-danger"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />{error}</div>}
      {done && <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-gold/50 bg-gold/10 p-3 text-xs text-gold"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />{done}</div>}

      {!!plan?.length && (
        <div className="mt-5 space-y-4">
          {days.map((d) => (
            <div key={d}>
              <h3 className="mb-2 font-heading text-sm text-gold">{dayLabel(plan.find((p) => p.date === d)!.iso)}</h3>
              <ul className="divide-y divide-ivory/10 rounded-xl border border-ivory/10">
                {plan.filter((p) => p.date === d).map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <span className="num w-20 shrink-0 font-bold text-gold">{timeLabel(p.iso)}</span>
                    <span className="font-heading">{p.home}</span><span className="text-ivory/50">ضد</span><span className="font-heading">{p.away}</span>
                  </li>))}
              </ul>
            </div>))}
        </div>
      )}
    </section>
  );
}
