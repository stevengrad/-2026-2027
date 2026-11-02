import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, RefreshCw, Trophy } from 'lucide-react';
import { callFunction, supabase } from '../../lib/supabase';
import { Empty, Skeleton } from '../../components/ui/States';
import { SaintAvatar } from '../../components/ui/SaintAvatar';
import { STAGE_LABEL, type Stage } from '../../lib/types';
import { num } from '../../lib/format';

type TargetSize = 2 | 4 | 8 | 16 | 32 | 64;
const TARGETS: Array<{ value: TargetSize; label: string }> = [
  { value: 64, label: 'دور الـ٦٤ — ٦٤ فريقاً' }, { value: 32, label: 'دور الـ٣٢ — ٣٢ فريقاً' },
  { value: 16, label: 'دور الـ١٦ — ١٦ فريقاً' }, { value: 8, label: 'ربع النهائي — ٨ فرق' },
  { value: 4, label: 'نصف النهائي — ٤ فرق' }, { value: 2, label: 'النهائي — فريقان' },
];

interface PreviewTeam {
  id: string; saintName: string; portraitPath: string | null; seed: number; qualification: string;
  pts: number; gd: number; gf: number; yellowCards: number; redCards: number;
}
interface TieTeam { id: string; saintName: string; pts: number; gd: number; gf: number; yellowCards: number; redCards: number }
interface PenaltyTie { key: string; label: string; teams: TieTeam[]; resolved: boolean }
interface PreviewMatch { matchNumber: number; stage: Stage; seedA: number; seedB: number; homeTeam: PreviewTeam | null; awayTeam: PreviewTeam | null }
interface KnockoutPreviewResponse {
  targetSize: TargetSize; groupCount: number; qualifiedCount: number; bracketSize: number; byes: number;
  stages: Stage[]; firstRoundStage: Stage; firstRoundMatches: PreviewMatch[]; qualifiedTeams: PreviewTeam[];
  tiebreaks: PenaltyTie[]; canExecute: boolean; includeThirdPlace: boolean;
}
interface PenaltyTiebreak { key: string; rankings: Array<{ teamId: string; rank: number }> }
interface ExistingMatch {
  id: string; stage: Stage; status: string; home_score: number | null; away_score: number | null; winner_team_id: string | null;
  home_team: { saint: { name_ar: string; portrait_path: string | null } | null } | null;
  away_team: { saint: { name_ar: string; portrait_path: string | null } | null } | null;
}

function orderedRanks(tie: PenaltyTie, saved: PenaltyTiebreak[]) {
  const current = saved.find((item) => item.key === tie.key);
  return tie.teams.map((team, index) => ({ teamId: team.id, rank: current?.rankings.find((rank) => rank.teamId === team.id)?.rank ?? index + 1 }));
}

export default function AdminKnockout() {
  const [targetSize, setTargetSize] = useState<TargetSize>(8);
  const [includeThirdPlace, setIncludeThirdPlace] = useState(true);
  const [clearExisting, setClearExisting] = useState(false);
  const [penaltyTiebreaks, setPenaltyTiebreaks] = useState<PenaltyTiebreak[]>([]);
  const [preview, setPreview] = useState<KnockoutPreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: existing, isLoading: existingLoading, refetch } = useQuery({
    queryKey: ['admin_existing_knockout'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error: requestError } = await supabase.from('matches').select(`
        id, stage, status, home_score, away_score, winner_team_id,
        home_team:teams!matches_home_team_id_fkey(saint:saints(name_ar, portrait_path)),
        away_team:teams!matches_away_team_id_fkey(saint:saints(name_ar, portrait_path))
      `).neq('stage', 'group').order('created_at');
      if (requestError) throw requestError;
      return (data as unknown as ExistingMatch[]) ?? [];
    },
  });
  const { data: standings } = useQuery({
    queryKey: ['admin_group_standings_preview'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error: requestError } = await supabase.from('public_group_standings').select('group_id');
      if (requestError) throw requestError;
      return data ?? [];
    },
  });

  const payload = (action: 'preview' | 'execute') => ({ action, targetSize, includeThirdPlace, clearExisting, penaltyTiebreaks });
  const displayError = (err: unknown) => {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('groups_not_finished')) return 'لا يمكن إنشاء الأدوار الإقصائية قبل انتهاء جميع مباريات دور المجموعات وتسجيل نتائجها.';
    if (message.includes('target_size_exceeds_teams')) return 'الحجم الذي اخترته أكبر من عدد فرق المجموعات المتاحة.';
    if (message.includes('penalty_tiebreak_required')) return 'هناك تعادل مؤثر. حدّد ترتيب ركلات الترجيح أدناه ثم اضغط «تحديث المعاينة».';
    if (message.includes('knockout_locked_results_exist')) return 'توجد مباريات إقصائية منتهية. فعّل خيار حذف الشجرة الحالية فقط إذا كنت متأكداً.';
    return message || 'تعذّر إكمال هذا الإجراء.';
  };
  const showPreview = async () => {
    setError(null); setSuccess(null); setBusy(true);
    try { setPreview(await callFunction<KnockoutPreviewResponse>('generate-knockout', payload('preview'))); }
    catch (err) { setError(displayError(err)); }
    finally { setBusy(false); }
  };
  const createBracket = async () => {
    setError(null); setSuccess(null); setBusy(true);
    try {
      const result = await callFunction<{ ok: boolean; matchesCreated: number }>('generate-knockout', payload('execute'));
      if (result.ok) { setSuccess(`تم إنشاء شجرة الإقصائيات وجدولة ${num(result.matchesCreated)} مباراة.`); setPreview(null); refetch(); }
    } catch (err) { setError(displayError(err)); }
    finally { setBusy(false); }
  };
  const updatePenaltyRank = (tie: PenaltyTie, teamId: string, rank: number) => {
    setPenaltyTiebreaks((current) => {
      const rankings = orderedRanks(tie, current).map((item) => item.teamId === teamId ? { ...item, rank } : item);
      return [...current.filter((item) => item.key !== tie.key), { key: tie.key, rankings }];
    });
  };
  const tieIsOrdered = (tie: PenaltyTie) => {
    const ranks = orderedRanks(tie, penaltyTiebreaks).map((item) => item.rank);
    return new Set(ranks).size === tie.teams.length && ranks.every((rank) => rank >= 1 && rank <= tie.teams.length);
  };
  const hasExisting = (existing ?? []).length > 0;
  const hasCompleted = (existing ?? []).some((match) => match.status === 'completed');

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ivory/10 pb-4">
      <div><h1 className="font-heading text-2xl font-bold sm:text-3xl">الأدوار الإقصائية</h1>
        <p className="mt-1 text-sm text-ivory/70">اختر حجم الشجرة بعد انتهاء المجموعات، ثم راجع المتأهلين قبل الإنشاء.</p></div>
      <button onClick={() => refetch()} className="btn-ghost !min-h-9 !px-3 text-xs" disabled={busy || existingLoading}><RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />تحديث</button>
    </div>
    {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger/50 bg-danger/10 p-4 text-sm text-danger"><AlertTriangle className="h-5 w-5 shrink-0" /><span>{error}</span></div>}
    {success && <div role="status" className="flex items-center gap-2 rounded-xl border border-gold/50 bg-gold/10 p-4 text-sm text-gold"><CheckCircle2 className="h-5 w-5 shrink-0" /><span>{success}</span></div>}

    <section className="panel p-5 sm:p-6">
      <h2 className="font-heading text-lg font-bold text-gold">اختيار المتأهلين</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-ivory/75">يختار النظام العدد الذي تحدده بالترتيب: أبطال المجموعات، ثم الوصافة، ثم أفضل أصحاب المركز التالي عند الحاجة. مقارنة أفضل الفرق تكون بالنقاط، ثم فارق الأهداف، ثم الأهداف المسجلة، ثم الأقل بطاقات صفراء وحمراء. التعادل المؤثر يحسمه المدير بركلات الترجيح.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><label htmlFor="target-size" className="mb-1 block text-xs font-semibold">بداية الإقصائيات</label>
          <select id="target-size" className="field text-sm" value={targetSize} onChange={(event) => { setTargetSize(Number(event.target.value) as TargetSize); setPreview(null); setPenaltyTiebreaks([]); }}>
            {TARGETS.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
          </select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-xs text-ivory/90"><input type="checkbox" checked={includeThirdPlace} onChange={(event) => { setIncludeThirdPlace(event.target.checked); setPreview(null); }} className="h-4 w-4 rounded border-ivory/30 bg-midnight text-gold focus:ring-gold" />إضافة مباراة المركز الثالث</label>
        {hasExisting && <label className="flex items-end gap-2 pb-2 text-xs text-danger"><input type="checkbox" checked={clearExisting} onChange={(event) => setClearExisting(event.target.checked)} className="h-4 w-4 rounded border-danger/40 bg-midnight text-danger focus:ring-danger" />حذف شجرة الإقصائيات الحالية وإعادة إنشائها</label>}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><button onClick={showPreview} className="btn-ghost text-sm" disabled={busy || !standings?.length}>{busy ? 'جارٍ الحساب…' : 'معاينة المتأهلين والشجرة'}</button>
        {preview && <button onClick={createBracket} className="btn-gold text-sm" disabled={busy || !preview.canExecute || (hasCompleted && !clearExisting)}>{busy ? 'جارٍ الإنشاء…' : 'تأكيد وإنشاء الشجرة'}</button>}</div>
      {hasCompleted && !clearExisting && <p className="mt-3 text-xs text-yellow-300">توجد مباريات إقصائية منتهية؛ لا يمكن استبدالها دون تفعيل خيار الحذف أعلاه.</p>}
    </section>

    {preview && <>
      <section className="panel border-gold/40 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-ivory/10 pb-3"><h2 className="font-heading text-lg font-bold text-gold">المتأهلون ({num(preview.qualifiedCount)})</h2>
        <span className="rounded bg-ivory/10 px-3 py-1 text-xs">{num(preview.groupCount)} مجموعات ← {TARGETS.find((target) => target.value === preview.targetSize)?.label}</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{preview.qualifiedTeams.map((team) => <div key={team.id} className="card flex items-center gap-3 !p-3"><SaintAvatar name={team.saintName} path={team.portraitPath} className="h-12 w-12" shape="circle" fit="cover" /><div className="min-w-0"><p className="font-heading text-sm">{team.saintName}</p><p className="text-xs text-gold">#{num(team.seed)} · {team.qualification}</p><p className="mt-1 text-[11px] text-ivory/60">{num(team.pts)} ن · {num(team.gd)} ف.أ · {num(team.gf)} هـ</p></div></div>)}</div>
      </section>

      {preview.tiebreaks.length > 0 && <section className="rounded-2xl border border-yellow-400/45 bg-yellow-400/10 p-5 sm:p-6"><h2 className="font-heading text-lg font-bold text-yellow-300">تعادل يحتاج إلى ركلات ترجيح</h2><p className="mt-1 text-sm text-ivory/75">بعد كل المعايير، هذا التعادل يغيّر هوية الفريق المتأهل. نفّذ ركلات الترجيح ثم سجّل ترتيبها أدناه، وبعدها اضغط «معاينة المتأهلين والشجرة» مرة أخرى.</p>
        <div className="mt-4 space-y-4">{preview.tiebreaks.map((tie) => <div key={tie.key} className="rounded-xl border border-yellow-300/30 bg-midnight/50 p-4"><h3 className="font-heading text-sm text-gold">{tie.label}</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{tie.teams.map((team) => <label key={team.id} className="flex items-center justify-between gap-3 rounded-lg border border-ivory/10 bg-emerald/40 p-2 text-xs"><span className="min-w-0"><b className="font-heading">{team.saintName}</b><span className="mt-1 block text-ivory/60">{num(team.pts)} ن · {num(team.gd)} ف.أ · {num(team.gf)} هـ · {num(team.yellowCards)} ص · {num(team.redCards)} ح</span></span>
          <select className="field !min-h-9 !w-24 !px-2 text-xs" value={orderedRanks(tie, penaltyTiebreaks).find((rank) => rank.teamId === team.id)?.rank ?? 1} onChange={(event) => updatePenaltyRank(tie, team.id, Number(event.target.value))}>{tie.teams.map((_, index) => <option key={index + 1} value={index + 1}>ترتيب {num(index + 1)}</option>)}</select></label>)}</div>
          {!tieIsOrdered(tie) && <p className="mt-2 text-xs text-danger">لكل فريق يجب اختيار ترتيب مختلف.</p>}</div>)}</div>
      </section>}

      <section className="panel p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-ivory/10 pb-3"><h2 className="font-heading text-lg font-bold text-gold">معاينة {STAGE_LABEL[preview.firstRoundStage]}</h2><span className="text-xs text-ivory/70">{num(preview.firstRoundMatches.length)} مباريات</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{preview.firstRoundMatches.map((match) => <div key={match.matchNumber} className="card !p-3 text-xs"><div className="mb-2 flex justify-between text-ivory/60"><span>مباراة #{num(match.matchNumber)}</span><span>{STAGE_LABEL[match.stage]}</span></div><div className="space-y-2"><p><b className="text-gold">#{num(match.seedA)}</b> {match.homeTeam?.saintName}</p><div className="h-px bg-ivory/10" /><p><b className="text-gold">#{num(match.seedB)}</b> {match.awayTeam?.saintName}</p></div></div>)}</div>
      </section>
    </>}

    <section className="panel p-5 sm:p-6"><h2 className="font-heading text-lg font-bold">شجرة الإقصائيات الحالية ({num(existing?.length ?? 0)})</h2>
      {existingLoading ? <Skeleton className="mt-4 h-36" /> : !existing?.length ? <div className="mt-4"><Empty>لم تُنشأ أي مباريات إقصائية بعد.</Empty></div> : <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{existing.map((match) => <div key={match.id} className="card !p-4"><div className="mb-2 flex items-center justify-between text-xs"><span className="font-heading text-gold">{STAGE_LABEL[match.stage]}</span><span className="text-ivory/60">{match.status}</span></div><div className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2"><SaintAvatar name={match.home_team?.saint?.name_ar ?? 'فريق'} path={match.home_team?.saint?.portrait_path} className="h-8 w-8" shape="circle" fit="cover" />{match.home_team?.saint?.name_ar ?? 'يُحدَّد لاحقاً'}</span><b className="text-gold">{match.home_score == null ? 'ضد' : `${num(match.home_score)} - ${num(match.away_score ?? 0)}`}</b><span className="flex items-center gap-2">{match.away_team?.saint?.name_ar ?? 'يُحدَّد لاحقاً'}<SaintAvatar name={match.away_team?.saint?.name_ar ?? 'فريق'} path={match.away_team?.saint?.portrait_path} className="h-8 w-8" shape="circle" fit="cover" /></span></div>{match.winner_team_id && <p className="mt-2 flex items-center gap-1 border-t border-ivory/10 pt-2 text-[11px] text-gold"><Trophy className="h-3.5 w-3.5" />الفائز يتأهل للدور التالي</p>}</div>)}</div>}
    </section>
  </div>;
}
