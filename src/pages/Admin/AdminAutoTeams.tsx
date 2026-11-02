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
} from 'lucide-react';
import { supabase, callFunction } from '../../lib/supabase';
import { Empty, ErrorNote, Skeleton } from '../../components/ui/States';
import { num } from '../../lib/format';
import { adminPath } from '../../lib/adminRoute';

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
        <h2 className="mb-4 font-heading text-lg font-bold text-ivory">
          قائمة اللاعبين الفرديين المسجلين ({num(waitingCount)})
        </h2>

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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
