import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { supabase, callFunction } from '../../lib/supabase';
import { Empty, Skeleton } from '../../components/ui/States';
import { SaintAvatar } from '../../components/ui/SaintAvatar';
import { STAGE_LABEL, type Stage } from '../../lib/types';
import { num } from '../../lib/format';

interface KnockoutPreviewMatch {
  matchNumber: number;
  stage: Stage;
  seedA: number;
  seedB: number;
  homeTeam: { id: string; saintName: string; portraitPath: string | null } | null;
  awayTeam: { id: string; saintName: string; portraitPath: string | null } | null;
  isBye: boolean;
}

interface KnockoutPreviewResponse {
  qualifiedCount: number;
  bracketSize: number;
  byes: number;
  stages: Stage[];
  firstRoundStage: Stage;
  firstRoundMatches: KnockoutPreviewMatch[];
  includeThirdPlace: boolean;
}

interface KnockoutMatchRow {
  id: string;
  stage: Stage;
  status: string;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: string | null;
  home_team: { id: string; saint: { name_ar: string; portrait_path: string | null } | null } | null;
  away_team: { id: string; saint: { name_ar: string; portrait_path: string | null } | null } | null;
}

export default function AdminKnockout() {
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState<number>(2);
  const [includeThirdPlace, setIncludeThirdPlace] = useState<boolean>(true);
  const [clearExisting, setClearExisting] = useState<boolean>(false);
  const [preview, setPreview] = useState<KnockoutPreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch existing knockout matches
  const { data: existingKnockout, isLoading: loadingKnockout, refetch } = useQuery({
    queryKey: ['admin_existing_knockout'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id, stage, status, home_score, away_score, winner_team_id,
          home_team:teams!matches_home_team_id_fkey(id, saint:saints(name_ar, portrait_path)),
          away_team:teams!matches_away_team_id_fkey(id, saint:saints(name_ar, portrait_path))
        `)
        .neq('stage', 'group')
        .order('created_at');
      if (error) throw error;
      return (data as unknown as KnockoutMatchRow[]) ?? [];
    },
  });

  // Fetch group standings to see how many teams qualify
  const { data: standings } = useQuery({
    queryKey: ['admin_group_standings_preview'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('public_group_standings')
        .select('*')
        .order('position')
        .order('pts', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handlePreview = async () => {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await callFunction<KnockoutPreviewResponse>('generate-knockout', {
        action: 'preview',
        qualifiersPerGroup,
        includeThirdPlace,
      });
      setPreview(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذّر إتمام المعاينة.');
    } finally {
      setBusy(false);
    }
  };

  const handleExecute = async () => {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await callFunction<{ ok: boolean; matchesCreated: number; bracketSize: number }>('generate-knockout', {
        action: 'execute',
        qualifiersPerGroup,
        includeThirdPlace,
        clearExisting,
      });
      if (res.ok) {
        setSuccess(`تم بنجاح توليد شجرة الأدوار الإقصائية وجدولة ${num(res.matchesCreated)} مباراة.`);
        setPreview(null);
        refetch();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذّر إنشاء الأدوار الإقصائية.');
    } finally {
      setBusy(false);
    }
  };

  const hasExistingMatches = (existingKnockout ?? []).length > 0;
  const hasCompletedMatches = (existingKnockout ?? []).some((m) => m.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ivory/10 pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">الأدوار الإقصائية (Knockout)</h1>
          <p className="mt-1 text-sm text-ivory/70">
            توليد شجرة المباريات الإقصائية من الفرق المتأهلة عن المجموعات وفق الترتيب والنقاط.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-ghost !min-h-9 !px-3 text-xs"
          disabled={busy || loadingKnockout}
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

      {/* Generation Panel */}
      <div className="panel p-6">
        <h2 className="mb-4 font-heading text-lg font-bold text-gold">إعدادات شجرة الإقصائيات</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="q-per-group">
              عدد المتأهلين من كل مجموعة:
            </label>
            <select
              id="q-per-group"
              className="field text-xs"
              value={qualifiersPerGroup}
              onChange={(e) => {
                setQualifiersPerGroup(Number(e.target.value));
                setPreview(null);
              }}
            >
              <option value={1}>الأول فقط (متصدر المجموعة)</option>
              <option value={2}>الأول والثاني (الافتراضي)</option>
              <option value={3}>أول ٣ فرق</option>
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 text-xs text-ivory/90">
              <input
                type="checkbox"
                checked={includeThirdPlace}
                onChange={(e) => {
                  setIncludeThirdPlace(e.target.checked);
                  setPreview(null);
                }}
                className="h-4 w-4 rounded border-ivory/30 bg-midnight text-gold focus:ring-gold"
              />
              <span>تضمين مباراة تحديد المركز الثالث</span>
            </label>
          </div>

          {hasExistingMatches && (
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 text-xs text-danger">
                <input
                  type="checkbox"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                  className="h-4 w-4 rounded border-danger/40 bg-midnight text-danger focus:ring-danger"
                />
                <span>حذف مباريات الأدوار الإقصائية الحالية وإعادة إنشائها</span>
              </label>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={handlePreview}
            className="btn-ghost !min-h-11 !px-4 text-xs"
            disabled={busy || !standings?.length}
          >
            {busy ? 'جارٍ المعاينة…' : 'معاينة شجرة الإقصائيات'}
          </button>

          {preview && (
            <button
              onClick={handleExecute}
              className="btn-gold !min-h-11 !px-6 text-xs font-bold"
              disabled={busy || (hasCompletedMatches && !clearExisting)}
            >
              {busy ? 'جارٍ الإنشاء…' : 'تأكيد وإنشاء جدول الأدوار الإقصائية'}
            </button>
          )}
        </div>

        {hasCompletedMatches && !clearExisting && (
          <p className="mt-3 text-xs text-yellow-300">
            * توجد مباريات إقصائية منتهية بالفعل. لإعادة الإنشاء، يرجى تفعيل خيار &quot;حذف مباريات الأدوار الإقصائية الحالية&quot;.
          </p>
        )}
      </div>

      {/* Preview Section */}
      {preview && (
        <div className="panel border-gold/40 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-ivory/10 pb-3">
            <h2 className="font-heading text-lg font-bold text-gold">
              معاينة شجرة البطولة ({STAGE_LABEL[preview.firstRoundStage]} — {num(preview.firstRoundMatches.length)} مباريات)
            </h2>
            <div className="flex gap-2 text-xs">
              <span className="rounded bg-ivory/10 px-2 py-1">حجم الشجرة: {num(preview.bracketSize)}</span>
              <span className="rounded bg-ivory/10 px-2 py-1">المتأهلون: {num(preview.qualifiedCount)}</span>
              {preview.byes > 0 && (
                <span className="rounded bg-gold/20 px-2 py-1 text-gold">
                  باي (تأهل تلقائي): {num(preview.byes)}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {preview.firstRoundMatches.map((m) => (
              <div key={m.matchNumber} className="card !p-3 text-xs">
                <div className="mb-2 flex items-center justify-between text-ivory/60">
                  <span>مباراة #{num(m.matchNumber)}</span>
                  <span>{STAGE_LABEL[m.stage]}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="num font-bold text-gold">#{num(m.seedA)}</span>
                    <span className="font-heading font-semibold text-ivory">
                      {m.homeTeam?.saintName ?? 'يُحدَّد لاحقاً'}
                    </span>
                  </div>
                  <div className="h-px bg-ivory/10" />
                  <div className="flex items-center gap-2">
                    <span className="num font-bold text-gold">#{num(m.seedB)}</span>
                    <span className="font-heading font-semibold text-ivory">
                      {m.isBye ? '— باي (تأهل مباشر) —' : (m.awayTeam?.saintName ?? 'يُحدَّد لاحقاً')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Matches List */}
      <div className="panel p-6">
        <h2 className="mb-4 font-heading text-lg font-bold text-ivory">
          المباريات الإقصائية الحالية ({num(existingKnockout?.length ?? 0)})
        </h2>

        {loadingKnockout ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : (existingKnockout ?? []).length === 0 ? (
          <Empty>لم يتم إنشاء أي مباريات إقصائية بعد.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {existingKnockout!.map((m) => {
              const homeSaint = Array.isArray(m.home_team?.saint) ? m.home_team?.saint[0] : m.home_team?.saint;
              const awaySaint = Array.isArray(m.away_team?.saint) ? m.away_team?.saint[0] : m.away_team?.saint;

              return (
                <div key={m.id} className="card !p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-ivory/70">
                    <span className="font-heading text-gold">{STAGE_LABEL[m.stage]}</span>
                    <span className="rounded-full bg-ivory/10 px-2 py-0.5">{m.status}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <SaintAvatar name={homeSaint?.name_ar ?? 'فريق'} path={homeSaint?.portrait_path} className="h-8 w-6" />
                      <span className="font-heading">{homeSaint?.name_ar ?? 'يُحدَّد لاحقاً'}</span>
                    </div>
                    <div className="num font-bold text-gold">
                      {m.home_score != null ? `${num(m.home_score)} - ${num(m.away_score ?? 0)}` : 'ضد'}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading">{awaySaint?.name_ar ?? 'يُحدَّد لاحقاً'}</span>
                      <SaintAvatar name={awaySaint?.name_ar ?? 'فريق'} path={awaySaint?.portrait_path} className="h-8 w-6" />
                    </div>
                  </div>
                  {m.winner_team_id && (
                    <div className="mt-2 flex items-center gap-1 border-t border-ivory/10 pt-2 text-[11px] text-gold">
                      <Trophy className="h-3.5 w-3.5" />
                      الفائز متأهل للدور التالي
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
