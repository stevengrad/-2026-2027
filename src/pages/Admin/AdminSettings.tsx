import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Calendar, CheckCircle2, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTournament } from '../../hooks/useTournament';
import { Countdown } from '../../components/ui/Countdown';
import { Skeleton } from '../../components/ui/States';
import { cairoLocalToIso, deadlineLabel, isoToCairoLocal } from '../../lib/format';
import { nextWeekday } from '../../lib/schedule';

export default function AdminSettings() {
  const qc = useQueryClient();
  const { data: t, isLoading } = useTournament();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [ok, setOk] = useState<string | null>(null);
  useEffect(() => { if (t?.registration_deadline) setValue(isoToCairoLocal(t.registration_deadline)); }, [t?.registration_deadline]);

  if (isLoading || !t) return <Skeleton className="h-64" />;
  const iso = cairoLocalToIso(value);
  const open = new Date(t.registration_deadline).getTime() > Date.now();
  const willClose = !!iso && new Date(iso).getTime() <= Date.now();
  const unchanged = iso === new Date(t.registration_deadline).toISOString();

  const save = async () => {
    if (!iso) { setError('اختر تاريخاً ووقتاً صحيحين.'); return; }
    setError(null); setOk(null); setBusy(true);
    try {
      const { error: e } = await supabase!.rpc('set_registration_deadline', { p_deadline: iso });
      if (e) throw e;
      await qc.invalidateQueries({ queryKey: ['tournament'] });
      setOk(`تم تحديث موعد إغلاق التسجيل إلى ${deadlineLabel(iso)} بتوقيت القاهرة.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذّر حفظ الموعد.'); } finally { setBusy(false); }
  };
  const fridayMidnight = () => setValue(`${nextWeekday(5)}T00:00`);

  return (
    <div className="space-y-6">
      <div className="border-b border-ivory/10 pb-4">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">الإعدادات</h1>
        <p className="mt-1 text-sm text-ivory/70">التحكم في موعد إغلاق التسجيل. التطبيق على الخادم بساعة قاعدة البيانات، لا بساعة جهاز الزائر.</p>
      </div>

      <section className="panel p-6" aria-labelledby="deadline-title">
        <h2 id="deadline-title" className="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-gold"><Calendar className="h-5 w-5" aria-hidden="true" />موعد إغلاق التسجيل</h2>
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-ivory/10 bg-midnight/40 p-4">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${open ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
            {open ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}{open ? 'التسجيل مفتوح' : 'التسجيل مغلق'}
          </span>
          <span className="text-sm">الموعد الحالي: <b className="text-gold">{deadlineLabel(t.registration_deadline)}</b></span>
        </div>
        {open && <div className="mb-5"><Countdown deadline={t.registration_deadline} /></div>}

        <div className="grid gap-3 sm:max-w-md">
          <label className="text-xs font-semibold" htmlFor="deadline-input">الموعد الجديد (بتوقيت القاهرة)</label>
          <input id="deadline-input" type="datetime-local" className="field" value={value} onChange={(e) => { setValue(e.target.value); setOk(null); }} />
          <button type="button" onClick={fridayMidnight} className="btn-ghost !min-h-9 text-xs">الجمعة القادمة ١٢:٠٠ ص</button>
        </div>
        {willClose && <p role="status" className="mt-3 text-xs text-yellow-300">هذا الموعد في الماضي، لذلك سيُغلق التسجيل فوراً.</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={save} className="btn-gold text-sm" disabled={busy || !iso || unchanged}>{busy ? 'جارٍ الحفظ…' : willClose ? 'حفظ وإغلاق التسجيل' : 'حفظ الموعد وإعادة فتح التسجيل'}</button>
          {unchanged && <span className="text-xs text-ivory/60">هذا هو الموعد الحالي.</span>}
        </div>
        {error && <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-danger/50 bg-danger/10 p-3 text-xs text-danger"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />{error}</div>}
        {ok && <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-gold/50 bg-gold/10 p-3 text-xs text-gold"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />{ok}</div>}
      </section>
    </div>
  );
}
