import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Lock,
  Plus,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTournament } from '../../hooks/useTournament';
import { Countdown } from '../../components/ui/Countdown';
import { Skeleton } from '../../components/ui/States';
import { cairoLocalToIso, deadlineLabel, isoToCairoLocal, num } from '../../lib/format';
import {
  nextWeekday,
  loadScheduleRules,
  saveScheduleRules,
  loadScheduleRandomize,
  saveScheduleRandomize,
  type TeamScheduleRule,
  type RuleType,
} from '../../lib/schedule';

export default function AdminSettings() {
  const qc = useQueryClient();
  const { data: t, isLoading } = useTournament();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [ok, setOk] = useState<string | null>(null);

  // Schedule Rules State
  const [rules, setRules] = useState<TeamScheduleRule[]>(() => loadScheduleRules());
  const [randomize, setRandomize] = useState<boolean>(() => loadScheduleRandomize());
  const [rulesOk, setRulesOk] = useState<string | null>(null);

  // New Rule Form State
  const [teamId, setTeamId] = useState('');
  const [weekScope, setWeekScope] = useState<'all' | 'specific'>('all');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [ruleType, setRuleType] = useState<RuleType>('interval');
  const [startTime, setStartTime] = useState('16:45');
  const [endTime, setEndTime] = useState('17:30');
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Query approved teams for rule assignment
  const { data: teamsList } = useQuery({
    queryKey: ['teams_for_schedule_rules'],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('teams')
        .select('id, team_number, saint:saints(name_ar)')
        .order('team_number');
      if (error) throw error;
      return (data ?? []).map((row) => {
        const s = Array.isArray(row.saint) ? row.saint[0] : row.saint;
        return {
          id: row.id as string,
          name: s?.name_ar || `فريق ${row.team_number ?? ''}`,
        };
      });
    },
  });

  useEffect(() => {
    if (t?.registration_deadline) setValue(isoToCairoLocal(t.registration_deadline));
  }, [t?.registration_deadline]);

  if (isLoading || !t) return <Skeleton className="h-64" />;
  const iso = cairoLocalToIso(value);
  const open = new Date(t.registration_deadline).getTime() > Date.now();
  const willClose = !!iso && new Date(iso).getTime() <= Date.now();
  const unchanged = iso === new Date(t.registration_deadline).toISOString();

  const save = async () => {
    if (!iso) {
      setError('اختر تاريخاً ووقتاً صحيحين.');
      return;
    }
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const { error: e } = await supabase!.rpc('set_registration_deadline', { p_deadline: iso });
      if (e) throw e;
      await qc.invalidateQueries({ queryKey: ['tournament'] });
      setOk(`تم تحديث موعد إغلاق التسجيل إلى ${deadlineLabel(iso)} بتوقيت القاهرة.`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : err instanceof Error
            ? err.message
            : 'تعذّر حفظ الموعد.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };
  const fridayMidnight = () => setValue(`${nextWeekday(5)}T00:00`);

  const handleAddRule = () => {
    setRuleError(null);
    setRulesOk(null);
    if (!teamId) {
      setRuleError('يرجى اختيار الفريق أولاً.');
      return;
    }
    const teamObj = teamsList?.find((tm) => tm.id === teamId);
    if (!teamObj) {
      setRuleError('فريق غير صالح.');
      return;
    }

    if (ruleType === 'interval' && startTime >= endTime) {
      setRuleError('وقت البداية يجب أن يكون قبل وقت النهاية.');
      return;
    }

    const ruleWeek = weekScope === 'specific' ? Number(selectedWeek) : 'all';
    const newRule: TeamScheduleRule = {
      id: crypto.randomUUID(),
      teamId: teamObj.id,
      teamName: teamObj.name,
      week: ruleWeek,
      type: ruleType,
      startTime: ruleType === 'from_start' ? '16:45' : startTime,
      endTime: ruleType === 'to_end' ? '19:30' : endTime,
    };

    // Replace rule if same team and same week scope exists, otherwise append
    const updated = [
      ...rules.filter((r) => !(r.teamId === teamObj.id && (r.week ?? 'all') === ruleWeek)),
      newRule,
    ];
    setRules(updated);
    saveScheduleRules(updated);
    setRulesOk(
      `تمت إضافة قاعدة مواعيد فريق «${teamObj.name}» (${
        ruleWeek === 'all' ? 'لكل الأسابيع' : `الأسبوع ${ruleWeek}`
      }).`
    );
    setTeamId('');
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    saveScheduleRules(updated);
    setRulesOk('تم حذف القاعدة بنجاح.');
  };

  const handleToggleRandomize = (checked: boolean) => {
    setRandomize(checked);
    saveScheduleRandomize(checked);
    setRulesOk(checked ? 'تم تفعيل التوزيع العشوائي للمباريات.' : 'تم إيقاف التوزيع العشوائي للمباريات.');
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-ivory/10 pb-4">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">الإعدادات</h1>
        <p className="mt-1 text-sm text-ivory/70">
          التحكم في موعد إغلاق التسجيل، وقواعد وتخصيص مواعيد مباريات الفرق في البطولة.
        </p>
      </div>

      {/* 1. موعد إغلاق التسجيل */}
      <section className="panel p-6" aria-labelledby="deadline-title">
        <h2 id="deadline-title" className="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-gold">
          <Calendar className="h-5 w-5" aria-hidden="true" />
          موعد إغلاق التسجيل
        </h2>
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-ivory/10 bg-midnight/40 p-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              open ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
            }`}
          >
            {open ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
            {open ? 'التسجيل مفتوح' : 'التسجيل مغلق'}
          </span>
          <span className="text-sm">
            الموعد الحالي: <b className="text-gold">{deadlineLabel(t.registration_deadline)}</b>
          </span>
        </div>
        {open && (
          <div className="mb-5">
            <Countdown deadline={t.registration_deadline} />
          </div>
        )}

        <div className="grid gap-3 sm:max-w-md">
          <label className="text-xs font-semibold" htmlFor="deadline-input">
            الموعد الجديد (بتوقيت القاهرة)
          </label>
          <input
            id="deadline-input"
            type="datetime-local"
            className="field"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOk(null);
            }}
          />
          <button type="button" onClick={fridayMidnight} className="btn-ghost !min-h-9 text-xs">
            الجمعة القادمة ١٢:٠٠ ص
          </button>
        </div>
        {willClose && <p role="status" className="mt-3 text-xs text-yellow-300">هذا الموعد في الماضي، لذلك سيُغلق التسجيل فوراً.</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={save} className="btn-gold text-sm" disabled={busy || !iso || unchanged}>
            {busy ? 'جارٍ الحفظ…' : willClose ? 'حفظ وإغلاق التسجيل' : 'حفظ الموعد وإعادة فتح التسجيل'}
          </button>
          {unchanged && <span className="text-xs text-ivory/60">هذا هو الموعد الحالي.</span>}
        </div>
        {error && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-danger/50 bg-danger/10 p-3 text-xs text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
        {ok && (
          <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-gold/50 bg-gold/10 p-3 text-xs text-gold">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {ok}
          </div>
        )}
      </section>

      {/* 2. قواعد وتخصيص مواعيد الفرق والمباريات */}
      <section className="panel p-6" aria-labelledby="schedule-rules-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-ivory/10 pb-3">
          <h2 id="schedule-rules-title" className="flex items-center gap-2 font-heading text-lg font-bold text-gold">
            <Clock className="h-5 w-5" aria-hidden="true" />
            قواعد مواعيد الفرق وجدولة المباريات
          </h2>
          <span className="rounded-full bg-gold/10 px-3 py-1 text-xs text-gold">
            {num(rules.length)} {rules.length === 1 ? 'قاعدة مفعلة' : 'قواعد مفعلة'}
          </span>
        </div>

        <p className="mb-4 text-xs leading-6 text-ivory/70">
          تتيح لك هذه القواعد التحكم في أوقات لعب فرق معينة (مثال: فريق <b>داود النبي</b> يلعب فقط بين الساعة <b>4:45 م و 5:30 م</b>)، مع إمكانية التوزيع العشوائي لباقي المباريات والمواعيد.
        </p>

        {/* خيار التوزيع العشوائي */}
        <div className="mb-6 rounded-xl border border-ivory/10 bg-midnight/40 p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={randomize}
              onChange={(e) => handleToggleRandomize(e.target.checked)}
              className="h-4 w-4 rounded border-ivory/30 bg-midnight text-gold focus:ring-gold"
            />
            <div>
              <span className="flex items-center gap-2 text-sm font-semibold text-ivory">
                <Shuffle className="h-4 w-4 text-gold" />
                توزيع عشوائي لترتيب المباريات
              </span>
              <p className="text-xs text-ivory/60 mt-0.5">
                عند التفعيل، يتم اختيار وترتيب مباريات الفريق المخصص عشوائياً ضمن وقته المحدد، ثم توزيع باقي المباريات عشوائياً في الأوقات المتبقية مع تجنب تتابع مباريات نفس الفريق.
              </p>
            </div>
          </label>
        </div>

        {/* إضافة قاعدة جديدة */}
        <div className="rounded-xl border border-gold/20 bg-emerald/20 p-4 space-y-4">
          <h3 className="font-heading text-sm font-bold text-gold flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            إضافة شرط موعد لفريق
          </h3>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* الفريق */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-ivory/80">اختر الفريق</label>
              <select
                className="field !min-h-10 text-xs"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value="">اختر الفريق المُراد تخصيصه…</option>
                {(teamsList ?? []).map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </select>
            </div>

            {/* نطاق الأسبوع */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-ivory/80">نطاق القاعدة</label>
              <select
                className="field !min-h-10 text-xs"
                value={weekScope}
                onChange={(e) => setWeekScope(e.target.value as 'all' | 'specific')}
              >
                <option value="all">لكل أسبوع (طوال البطولة)</option>
                <option value="specific">أسبوع محدد (حسب الأسبوع)</option>
              </select>
            </div>

            {/* اختيار الأسبوع عند التحديد */}
            {weekScope === 'specific' && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-ivory/80">اختر الأسبوع</label>
                <select
                  className="field !min-h-10 text-xs"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                >
                  <option value={1}>الأسبوع الأول (الجولة 1)</option>
                  <option value={2}>الأسبوع الثاني (الجولة 2)</option>
                  <option value={3}>الأسبوع الثالث (الجولة 3)</option>
                  <option value={4}>الأسبوع الرابع (الجولة 4)</option>
                  <option value={5}>الأسبوع الخامس (الجولة 5)</option>
                  <option value={6}>الأسبوع السادس (الجولة 6)</option>
                </select>
              </div>
            )}

            {/* نوع التقييد الزمني */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-ivory/80">نوع التقييد</label>
              <select
                className="field !min-h-10 text-xs"
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as RuleType)}
              >
                <option value="interval">فترة محددة (من ساعة إلى ساعة)</option>
                <option value="from_start">من بداية اليوم حتى ساعة محددة</option>
                <option value="to_end">من ساعة محددة حتى نهاية اليوم</option>
              </select>
            </div>

            {/* وقت البداية */}
            {(ruleType === 'interval' || ruleType === 'to_end') && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-ivory/80">
                  {ruleType === 'interval' ? 'من الساعة' : 'من الساعة وحتى النهاية'}
                </label>
                <input
                  type="time"
                  className="field !min-h-10 text-xs"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            )}

            {/* وقت النهاية */}
            {(ruleType === 'interval' || ruleType === 'from_start') && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-ivory/80">
                  {ruleType === 'interval' ? 'إلى الساعة' : 'من البداية وحتى الساعة'}
                </label>
                <input
                  type="time"
                  className="field !min-h-10 text-xs"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAddRule}
              className="btn-gold !min-h-9 text-xs"
            >
              حفظ وتطبيق القاعدة
            </button>
          </div>

          {ruleError && (
            <p role="alert" className="text-xs text-danger flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {ruleError}
            </p>
          )}
        </div>

        {rulesOk && (
          <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-gold/50 bg-gold/10 p-3 text-xs text-gold">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {rulesOk}
          </div>
        )}

        {/* قائمة القواعد المطبقة حالياً */}
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-bold text-ivory/80">القواعد المفعلة حالياً:</h3>
          {rules.length === 0 ? (
            <p className="rounded-xl border border-ivory/10 bg-midnight/30 p-4 text-center text-xs text-ivory/60">
              لا توجد قواعد مواعيد مخصصة حالياً. ستُجدول جميع الفرق بالتساوي وبشكل قياسي.
            </p>
          ) : (
            <div className="grid gap-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ivory/15 bg-midnight/60 p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 text-gold text-xs font-bold">
                      <Clock className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-heading text-sm font-bold text-ivory">{rule.teamName}</p>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                            rule.week === 'all' || !rule.week
                              ? 'bg-gold/15 text-gold'
                              : 'bg-emerald/40 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {rule.week === 'all' || !rule.week ? 'لكل الأسابيع' : `الأسبوع ${num(rule.week)} فقط`}
                        </span>
                      </div>
                      <p className="text-xs text-ivory/70 mt-0.5">
                        {rule.type === 'interval' && (
                          <>
                            يلعب فقط بين <b className="text-gold" dir="ltr">{rule.startTime}</b> و <b className="text-gold" dir="ltr">{rule.endTime}</b>
                          </>
                        )}
                        {rule.type === 'from_start' && (
                          <>
                            يلعب من بداية اليوم وحتى الساعة <b className="text-gold" dir="ltr">{rule.endTime}</b> كحد أقصى
                          </>
                        )}
                        {rule.type === 'to_end' && (
                          <>
                            يلعب من الساعة <b className="text-gold" dir="ltr">{rule.startTime}</b> فصاعداً وحتى نهاية اليوم
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="btn-ghost !min-h-8 !px-2 text-xs text-danger hover:border-danger hover:text-danger"
                    title="حذف هذه القاعدة"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
