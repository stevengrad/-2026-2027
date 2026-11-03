import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Shuffle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Pencil,
  Trash2,
  Save,
  X,
} from 'lucide-react';
import { supabase, callFunction } from '../../lib/supabase';
import { Empty, ErrorNote, Skeleton } from '../../components/ui/States';
import { num } from '../../lib/format';
import { adminPath } from '../../lib/adminRoute';
import { TOURNAMENT_CLASSES } from '../../lib/classes';
import { individualFormSchema } from '../../lib/schemas';

interface WaitingPlayer {
  id: string;
  full_name_ar: string;
  class_name_ar: string;
  created_at: string;
}

interface PreviewTeam {
  size: number;
  saint: { id: string; name_ar: string } | null;
  needsSaint: boolean;
  players: { id: string; name: string }[];
}

interface PreviewResponse {
  seed: number;
  availablePlayers: number;
  teamCount: number;
  teams: PreviewTeam[];
  unassigned: number;
  notice: string | null;
}

export default function AdminAutoTeams() {
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000));
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<WaitingPlayer | null>(null);
  const [editName, setEditName] = useState('');
  const [editClassName, setEditClassName] = useState('');
  const [deletingPlayer, setDeletingPlayer] = useState<WaitingPlayer | null>(null);
  const [playerDialogError, setPlayerDialogError] = useState<string | null>(null);

  // Fetch waiting individual players
  const { data: waiting, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin_waiting_players'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('players')
        .select('id, full_name_ar, class_name_ar, created_at')
        .eq('pool_status', 'waiting')
        .is('team_id', null)
        .eq('source', 'individual')
        .order('created_at');
      if (error) throw error;
      return (data as WaitingPlayer[]) ?? [];
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
      const res = await callFunction<PreviewResponse>('generate-teams', {
        action: 'preview',
        seed,
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
      const res = await callFunction<{ ok: boolean; teamIds: string[]; seed: number }>('generate-teams', {
        action: 'execute',
        seed,
      });
      if (res.ok) {
        setSuccess(`تم بنجاح تشكيل ${num(res.teamIds.length)} فرق جديدة من قائمة الانتظار.`);
        setPreview(null);
        refetch();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذّر تنفيذ إنشاء الفرق.');
    } finally {
      setBusy(false);
    }
  };

  const openPlayerEditor = (player: WaitingPlayer) => {
    setError(null);
    setPlayerDialogError(null);
    setSuccess(null);
    setEditingPlayer(player);
    setEditName(player.full_name_ar);
    setEditClassName(player.class_name_ar);
  };

  const handleSavePlayer = async () => {
    if (!editingPlayer || !supabase || busy) return;
    setError(null);
    setSuccess(null);

    const parsed = individualFormSchema.safeParse({ name: editName, class: editClassName });
    if (!parsed.success) {
      setPlayerDialogError(parsed.error.issues[0]?.message ?? 'راجع اسم اللاعب والفصل ثم حاول مرة أخرى.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: updateError } = await supabase
        .from('players')
        .update({
          full_name_ar: parsed.data.name,
          class_name_ar: parsed.data.class,
        })
        .eq('id', editingPlayer.id)
        .eq('source', 'individual')
        .eq('pool_status', 'waiting')
        .is('team_id', null)
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!data) throw new Error('player_not_editable');

      setSuccess(`تم تحديث بيانات اللاعب «${parsed.data.name}» بنجاح.`);
      setPlayerDialogError(null);
      setEditingPlayer(null);
      setPreview(null);
      await refetch();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      setPlayerDialogError(message.includes('player_not_editable')
        ? 'لم يعد هذا اللاعب ضمن قائمة الانتظار. حدّث القائمة ثم حاول مرة أخرى.'
        : message || 'تعذّر حفظ بيانات اللاعب.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePlayer = async () => {
    if (!deletingPlayer || !supabase || busy) return;
    setError(null);
    setSuccess(null);
    setBusy(true);

    try {
      const { data, error: deleteError } = await supabase
        .from('players')
        .delete()
        .eq('id', deletingPlayer.id)
        .eq('source', 'individual')
        .eq('pool_status', 'waiting')
        .is('team_id', null)
        .select('id')
        .maybeSingle();

      if (deleteError) throw deleteError;
      if (!data) throw new Error('player_not_deletable');

      setSuccess(`تم حذف اللاعب «${deletingPlayer.full_name_ar}» من قائمة المسجلين الفرديين.`);
      setPlayerDialogError(null);
      setDeletingPlayer(null);
      setPreview(null);
      await refetch();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      const errorCode = typeof e === 'object' && e !== null && 'code' in e
        ? String((e as { code?: unknown }).code ?? '')
        : '';
      setPlayerDialogError(message.includes('player_not_deletable')
        ? 'لم يعد هذا اللاعب ضمن قائمة الانتظار. حدّث القائمة ثم حاول مرة أخرى.'
        : message.includes('23503') || errorCode === '23503'
          ? 'لا يمكن حذف هذا اللاعب لارتباطه ببيانات مباراة. تواصل مع مسؤول النظام.'
          : message || 'تعذّر حذف اللاعب.');
    } finally {
      setBusy(false);
    }
  };

  const waitingCount = waiting?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ivory/10 pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">توليد الفرق التلقائية</h1>
          <p className="mt-1 text-sm text-ivory/70">
            تجميع اللاعبين المسجلين بشكل فردي في فرق متوازنة (من ٤ إلى ٧ لاعبين) وتعيين قديس لكل فريق بالقرعة.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-ghost !min-h-9 !px-3 text-xs"
          disabled={isLoading || busy}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger/50 bg-danger/10 p-4 text-sm text-danger">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div role="status" className="flex items-center justify-between rounded-xl border border-gold/50 bg-gold/10 p-4 text-sm text-gold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{success}</span>
          </div>
          <Link to={adminPath('teams')} className="btn-gold !min-h-8 !px-3 text-xs">
            الذهاب لقائمة الفرق للاعتماد
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Overview Card */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-5 text-center">
          <Users className="mx-auto mb-2 h-7 w-7 text-gold" />
          <div className="num font-heading text-3xl font-bold">{num(waitingCount)}</div>
          <p className="text-xs text-ivory/70">لاعب في قائمة الانتظار</p>
        </div>

        <div className="panel p-5 text-center">
          <Shuffle className="mx-auto mb-2 h-7 w-7 text-sky-400" />
          <div className="num font-heading text-3xl font-bold">
            {waitingCount < 4 ? num(0) : num(Math.ceil(waitingCount / 7))}
          </div>
          <p className="text-xs text-ivory/70">عدد الفرق المقترح تكوينها</p>
        </div>

        <div className="panel p-5 text-center">
          <HelpCircle className="mx-auto mb-2 h-7 w-7 text-gold" />
          <div className="font-heading text-base font-bold text-ivory">قواعد التشكيل</div>
          <p className="mt-1 text-xs text-ivory/70">
            أقل حجم للفريق ٤ لاعبين، الحد الأقصى ٧ لاعبين. التوزيع متساوٍ وعشوائي ومثبت بـ seed للشفافية.
          </p>
        </div>
      </div>

      {/* Generation Control Panel */}
      <div className="panel p-6">
        <h2 className="mb-4 font-heading text-lg font-bold text-gold">التحكم في القرعة العشوائية</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="seed-val">
              معامل العشوائية (Seed):
            </label>
            <input
              id="seed-val"
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
            title="توليد رقم seed جديد"
            disabled={busy}
          >
            <Shuffle className="h-4 w-4" />
            معامل عشوائي جديد
          </button>

          <button
            onClick={handlePreview}
            className="btn-ghost !min-h-11 !px-4 text-xs"
            disabled={waitingCount < 4 || busy}
          >
            {busy ? 'جارٍ المعاينة…' : 'معاينة التشكيل'}
          </button>

          {preview && (
            <button
              onClick={handleExecute}
              className="btn-gold !min-h-11 !px-6 text-xs font-bold"
              disabled={busy}
            >
              {busy ? 'جارٍ الإنشاء…' : 'تأكيد وإنشاء الفرق الآن'}
            </button>
          )}
        </div>

        {waitingCount < 4 && (
          <p className="mt-3 text-xs text-yellow-300">
            * عدد اللاعبين الحالي ({num(waitingCount)}) أقل من ٤ لاعبين، لا يمكن تشكيل فريق حتى اكتمال ٤ لاعبين على الأقل.
          </p>
        )}
      </div>

      {/* Preview Section */}
      {preview && (
        <div className="panel border-gold/40 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-ivory/10 pb-3">
            <h2 className="font-heading text-lg font-bold text-gold">
              معاينة تشكيل الفرق المقترحة ({num(preview.teams.length)} فرق)
            </h2>
            <span className="rounded-md bg-ivory/10 px-2 py-1 font-mono text-xs text-ivory/80">
              Seed: {preview.seed}
            </span>
          </div>

          {preview.notice && (
            <p className="mb-4 text-xs text-yellow-300">{preview.notice}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {preview.teams.map((t, idx) => (
              <div key={idx} className="card !p-4">
                <div className="flex items-center justify-between border-b border-ivory/10 pb-2">
                  <span className="font-heading font-bold text-gold">
                    {t.saint?.name_ar ?? 'بدون قديس (يلزم تعيين)'}
                  </span>
                  <span className="text-xs text-ivory/70">
                    {num(t.size)} لاعبين
                  </span>
                </div>
                <ul className="mt-3 space-y-1 text-xs">
                  {t.players.map((p, pi) => (
                    <li key={p.id} className="text-ivory/90">
                      {num(pi + 1)}. {p.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waiting Players List */}
      <div className="panel p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-bold text-ivory">
            قائمة اللاعبين الفرديين المسجلين ({num(waitingCount)})
          </h2>
          <span className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-[11px] text-sky-200">
            اللاعبون الذين لم يتم توزيعهم على فرق بعد
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : isError ? (
          <ErrorNote>تعذّر تحميل قائمة الانتظار.</ErrorNote>
        ) : waitingCount === 0 ? (
          <Empty>لا يوجد لاعبون مسجلون في قائمة الانتظار حالياً.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-ivory/10 text-ivory/60">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">اسم اللاعب</th>
                  <th className="p-2.5">الفصل</th>
                  <th className="p-2.5">تاريخ التسجيل</th>
                  <th className="p-2.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {waiting!.map((p, idx) => (
                  <tr key={p.id} className="border-b border-ivory/5 hover:bg-emerald/20">
                    <td className="num p-2.5 text-ivory/50">{num(idx + 1)}</td>
                    <td className="p-2.5 font-semibold text-ivory">{p.full_name_ar}</td>
                    <td className="p-2.5 text-ivory/80">{p.class_name_ar}</td>
                    <td className="p-2.5 text-ivory/60">
                      {new Intl.DateTimeFormat('ar-EG', {
                        timeZone: 'Africa/Cairo',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(new Date(p.created_at))}
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openPlayerEditor(p)}
                          disabled={busy}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-2.5 text-[11px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50"
                          aria-label={`تعديل بيانات ${p.full_name_ar}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => { setError(null); setPlayerDialogError(null); setDeletingPlayer(p); }}
                          disabled={busy}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-2.5 text-[11px] font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-50"
                          aria-label={`حذف ${p.full_name_ar}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/80 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="edit-individual-player-title" className="w-full max-w-lg rounded-2xl border border-gold/30 bg-midnight p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 id="edit-individual-player-title" className="font-heading text-lg font-bold text-gold">تعديل بيانات اللاعب</h2>
              <button type="button" onClick={() => { setEditingPlayer(null); setPlayerDialogError(null); }} className="rounded-lg p-2 text-ivory/60 transition hover:bg-ivory/10 hover:text-ivory" aria-label="إغلاق" disabled={busy}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {playerDialogError && <p role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs leading-5 text-danger">{playerDialogError}</p>}
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-individual-player-name" className="mb-1.5 block text-sm font-semibold text-ivory">اسم اللاعب</label>
                <input
                  id="edit-individual-player-name"
                  className="field"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  maxLength={80}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="edit-individual-player-class" className="mb-1.5 block text-sm font-semibold text-ivory">الفصل</label>
                <select
                  id="edit-individual-player-class"
                  className="field"
                  value={editClassName}
                  onChange={(event) => setEditClassName(event.target.value)}
                >
                  <option value="" disabled>اختر الفصل…</option>
                  {TOURNAMENT_CLASSES.map((className) => <option key={className} value={className}>{className}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { setEditingPlayer(null); setPlayerDialogError(null); }} className="btn-ghost !min-h-10 !px-4 text-xs" disabled={busy}>إلغاء</button>
              <button type="button" onClick={handleSavePlayer} className="btn-gold !min-h-10 !px-4 text-xs" disabled={busy}>
                <Save className="h-4 w-4" />
                {busy ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/80 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-individual-player-title" className="w-full max-w-md rounded-2xl border border-danger/40 bg-midnight p-6 shadow-2xl">
            <h2 id="delete-individual-player-title" className="font-heading text-lg font-bold text-danger">حذف اللاعب؟</h2>
            {playerDialogError && <p role="alert" className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs leading-5 text-danger">{playerDialogError}</p>}
            <p className="mt-3 text-sm leading-6 text-ivory/80">
              هل أنت متأكد من حذف اللاعب «{deletingPlayer.full_name_ar}» نهائياً من قائمة التسجيل الفردي؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => { setDeletingPlayer(null); setPlayerDialogError(null); }} className="btn-ghost !min-h-9 !px-3 text-xs" disabled={busy}>إلغاء</button>
              <button type="button" onClick={handleDeletePlayer} className="btn !min-h-9 !px-4 bg-danger text-xs text-white hover:bg-danger/80" disabled={busy}>
                <Trash2 className="h-4 w-4" />
                {busy ? 'جارٍ الحذف…' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
