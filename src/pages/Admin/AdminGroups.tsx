import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shuffle,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { supabase, callFunction } from '../../lib/supabase';
import { Empty, Skeleton } from '../../components/ui/States';
import { SaintAvatar } from '../../components/ui/SaintAvatar';
import { num } from '../../lib/format';
import { SchedulePanel, applyPlan, buildPlan, initialSched, rangeLabel, type SchedState } from './GroupScheduler';

interface PreviewTeam {
  id: string;
  teamNumber?: number;
  saintName: string;
  portraitPath: string | null;
}

interface PreviewGroup {
  groupNumber: number;
  groupName: string;
  teams: PreviewTeam[];
}

interface GroupsPreviewResponse {
  seed: number;
  teamCount: number;
  groupCount: number;
  groups: PreviewGroup[];
}

interface ExistingGroup {
  id: string;
  group_name: string;
  group_teams: {
    team: {
      id: string;
      team_number: number;
      saint: { id: string; name_ar: string; portrait_path: string | null } | null;
    } | null;
  }[];
}

export default function AdminGroups() {
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000));
  const [preview, setPreview] = useState<GroupsPreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sched, setSched] = useState<SchedState>(initialSched);

  // Fetch approved teams count
  const { data: approvedTeams } = useQuery({
    queryKey: ['admin_approved_teams_count'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('teams')
        .select('id, team_number, saint:saints(name_ar)')
        .eq('status', 'approved');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch existing groups
  const { data: existingGroups, isLoading: loadingGroups, refetch } = useQuery({
    queryKey: ['admin_existing_groups'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('groups')
        .select(`
          id, group_name,
          group_teams (
            team:teams (
              id, team_number,
              saint:saints (id, name_ar, portrait_path)
            )
          )
        `)
        .order('sort_order');
      if (error) throw error;
      return (data as unknown as ExistingGroup[]) ?? [];
    },
  });

  // Check if any group match has completed results
  const { data: groupMatchesLocked } = useQuery({
    queryKey: ['admin_group_matches_locked'],
    queryFn: async () => {
      if (!supabase) return false;
      const { data, error } = await supabase
        .from('matches')
        .select('id')
        .eq('stage', 'group')
        .eq('status', 'completed')
        .limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  });

  const generateRandomSeed = () => {
    setSeed(Math.floor(Math.random() * 1_000_000));
    setPreview(null);
  };

  const handlePreview = async () => {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await callFunction<GroupsPreviewResponse>('generate-groups', {
        action: 'preview',
        seed,
      });
      setPreview(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذّر إتمام معاينة القرعة.');
    } finally {
      setBusy(false);
    }
  };

  const handleExecute = async () => {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await callFunction<{ ok: boolean; groupCount: number; seed: number }>('generate-groups', {
        action: 'execute',
        seed,
      });
      if (res.ok) {
        let note = ' وتم إنشاء جدول مبارياتها.';
        setPreview(null);
        refetch();
        if (sched.auto) {
          try {
            const plan = await buildPlan(sched.opts, false);
            if (plan.length) { const n = await applyPlan(plan); note = ` وتمت جدولة ${num(n)} مباراة ${rangeLabel(plan)}.`; }
          } catch (se: unknown) {
            setError(`تم نشر المجموعات لكن تعذّرت الجدولة التلقائية: ${se instanceof Error ? se.message : 'خطأ غير معروف'}. يمكنك إعادة المحاولة من قسم «الجدولة التلقائية» أدناه.`);
            note = '';
          }
        }
        if (note) setSuccess(`تم بنجاح إجراء القرعة ونشر ${num(res.groupCount)} مجموعات${note}`);
        else setSuccess(`تم نشر ${num(res.groupCount)} مجموعات.`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذّر نشر المجموعات.');
    } finally {
      setBusy(false);
    }
  };

  const teamCount = approvedTeams?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ivory/10 pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">المجموعات وقرعة البطولة</h1>
          <p className="mt-1 text-sm text-ivory/70">
            توزيع الفرق المعتمدة على مجموعات عادلة (٣ أو ٤ فرق للمجموعة) وتوليد جدول مباريات دور المجموعات تلقائياً.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-ghost !min-h-9 !px-3 text-xs"
          disabled={busy || loadingGroups}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger/50 bg-danger/10 p-4 text-sm text-danger">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-gold/50 bg-gold/10 p-4 text-sm text-gold">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {groupMatchesLocked && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-yellow-400/50 bg-yellow-400/10 p-4 text-sm text-yellow-300">
          <Lock className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">المجموعات مغلقة لوجود نتائج مباريات مسجلة</p>
            <p className="text-xs text-yellow-300/80">
              لا يمكن إعادة إجراء القرعة لأن بعض مباريات المجموعات قد اكتملت بالفعل للحفاظ على نزاهة النتائج.
            </p>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-5 text-center">
          <div className="num font-heading text-3xl font-bold text-gold">{num(teamCount)}</div>
          <p className="text-xs text-ivory/70">فريق معتمد جاهز للقرعة</p>
        </div>
        <div className="panel p-5 text-center">
          <div className="num font-heading text-3xl font-bold text-sky-400">
            {num(existingGroups?.length ?? 0)}
          </div>
          <p className="text-xs text-ivory/70">مجموعات معتمدة حالياً</p>
        </div>
        <div className="panel p-5 text-center">
          <div className="font-heading text-base font-bold text-ivory">شروط القرعة</div>
          <p className="mt-1 text-xs text-ivory/70">
            يلزم ٣ فرق معتمدة كحد أدنى. كل مجموعة تضم ٣ أو ٤ فرق، ويلعب كل فريق ضد جميع فرق مجموعته.
          </p>
        </div>
      </div>

      {/* Draw Controls */}
      {!groupMatchesLocked && (
        <div className="panel p-6">
          <h2 className="mb-3 font-heading text-lg font-bold text-gold">إجراء القرعة</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-64">
              <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="draw-seed">
                معامل القرعة (Seed):
              </label>
              <input
                id="draw-seed"
                type="number"
                className="field text-xs font-mono"
                value={seed}
                onChange={(e) => {
                  setSeed(Number(e.target.value));
                  setPreview(null);
                }}
              />
            </div>

            <button
              onClick={generateRandomSeed}
              className="btn-ghost !min-h-11 !px-3 text-xs"
              title="توليد رقم عشوائي جديد"
              disabled={busy}
            >
              <Shuffle className="h-4 w-4" />
              رقم عشوائي جديد
            </button>

            <button
              onClick={handlePreview}
              className="btn-ghost !min-h-11 !px-4 text-xs"
              disabled={teamCount < 3 || busy}
            >
              {busy ? 'جارٍ المعاينة…' : 'معاينة توزيع المجموعات'}
            </button>

            {preview && (
              <button
                onClick={handleExecute}
                className="btn-gold !min-h-11 !px-6 text-xs font-bold"
                disabled={busy}
              >
                {busy ? 'جارٍ النشر…' : 'تأكيد ونشر المجموعات وجدولتها'}
              </button>
            )}
          </div>

          {teamCount < 3 && (
            <p className="mt-3 text-xs text-yellow-300">
              * يلزم اعتماد ٣ فرق على الأقل قبل إجراء القرعة. الفرق المعتمدة حالياً: {num(teamCount)}.
            </p>
          )}
        </div>
      )}

      <SchedulePanel state={sched} onChange={setSched} hasGroups={(existingGroups?.length ?? 0) > 0} />

      {/* Preview Section */}
      {preview && (
        <div className="panel border-gold/40 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-ivory/10 pb-3">
            <h2 className="font-heading text-lg font-bold text-gold">
              معاينة توزيع المجموعات ({num(preview.groups.length)} مجموعات)
            </h2>
            <span className="rounded-md bg-ivory/10 px-2 py-1 font-mono text-xs text-ivory/80">
              Seed: {preview.seed}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {preview.groups.map((g) => (
              <div key={g.groupNumber} className="card !p-4">
                <h3 className="mb-3 border-b border-ivory/10 pb-2 font-heading font-bold text-gold">
                  {g.groupName} ({num(g.teams.length)} فرق)
                </h3>
                <div className="space-y-2">
                  {g.teams.map((t, idx) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-lg bg-emerald/30 p-2 text-xs">
                      <span className="num font-bold text-ivory/50">{num(idx + 1)}.</span>
                      <SaintAvatar name={t.saintName} path={t.portraitPath} className="h-8 w-6" />
                      <span className="font-heading font-semibold text-ivory">{t.saintName}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Groups Display */}
      <div className="panel p-6">
        <h2 className="mb-4 font-heading text-lg font-bold text-ivory">المجموعات المنشورة الحالية</h2>
        {loadingGroups ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : (existingGroups ?? []).length === 0 ? (
          <Empty>لم يتم نشر أي مجموعات بعد.</Empty>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {existingGroups!.map((g) => (
              <div key={g.id} className="card !p-4">
                <h3 className="mb-3 border-b border-ivory/10 pb-2 font-heading font-bold text-gold">
                  {g.group_name}
                </h3>
                <div className="space-y-2">
                  {g.group_teams.map((gt, idx) => {
                    const saint = Array.isArray(gt.team?.saint) ? gt.team?.saint[0] : gt.team?.saint;
                    return (
                      <div
                        key={gt.team?.id ?? idx}
                        className="flex items-center gap-2 rounded-lg bg-emerald/30 p-2 text-xs"
                      >
                        <span className="num font-bold text-ivory/50">{num(idx + 1)}.</span>
                        <SaintAvatar
                          name={saint?.name_ar ?? 'فريق'}
                          path={saint?.portrait_path}
                          className="h-8 w-6"
                        />
                        <span className="font-heading font-semibold text-ivory">
                          {saint?.name_ar ?? 'فريق'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
