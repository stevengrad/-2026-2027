import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SaintAvatar } from '../../components/ui/SaintAvatar';
import { Empty, ErrorNote, Skeleton } from '../../components/ui/States';
import { dayLabel, num, timeLabel } from '../../lib/format';

interface AdminPlayer {
  id: string;
  full_name_ar: string;
  class_name_ar: string;
  source: 'team_registration' | 'individual';
  pool_status: string;
}

interface AdminTeam {
  id: string;
  team_number: number;
  status: 'pending' | 'approved' | 'rejected';
  source: 'manual' | 'automatic';
  rejection_reason: string | null;
  submitted_at: string;
  approved_at: string | null;
  saint: { id: string; name_ar: string; portrait_path: string | null } | null;
  players: AdminPlayer[];
}

export default function AdminTeams() {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Reject modal state
  const [rejectingTeam, setRejectingTeam] = useState<AdminTeam | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [returnPlayers, setReturnPlayers] = useState(true);

  // Assign saint modal state
  const [assigningTeam, setAssigningTeam] = useState<AdminTeam | null>(null);
  const [selectedSaintId, setSelectedSaintId] = useState('');

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch teams with full admin details
  const { data: teams, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin_teams'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id, team_number, status, source, rejection_reason, submitted_at, approved_at,
          saint:saints(id, name_ar, portrait_path),
          players(id, full_name_ar, class_name_ar, source, pool_status)
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return (data as unknown as AdminTeam[]) ?? [];
    },
  });

  // Fetch all approved active saints for assignment
  const { data: saints } = useQuery({
    queryKey: ['admin_saints_available'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('saints')
        .select('id, name_ar')
        .eq('is_approved', true)
        .eq('is_active', true)
        .order('name_ar');
      if (error) throw error;
      return data;
    },
  });

  const clearMessages = () => {
    setActionError(null);
    setActionSuccess(null);
  };

  const handleApprove = async (team: AdminTeam) => {
    clearMessages();
    if (!team.saint) {
      setActionError('لا يمكن اعتماد الفريق بدون تحديد اسم القديس أولاً. يرجى تعيين قديس.');
      setAssigningTeam(team);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase!.rpc('approve_team', { p_team: team.id });
      if (error) throw error;
      setActionSuccess(`تم اعتماد فريق "${team.saint.name_ar}" بنجاح.`);
      refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'تعذّر اعتماد الفريق.';
      setActionError(msg.includes('saint_required') ? 'يجب تعيين قديس للفريق قبل اعتماده.' : msg);
    } finally {
      setBusy(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingTeam) return;
    clearMessages();
    setBusy(true);
    try {
      const { error } = await supabase!.rpc('reject_team', {
        p_team: rejectingTeam.id,
        p_reason: rejectReason.trim() || null,
        p_return_players: returnPlayers,
      });
      if (error) throw error;
      setActionSuccess('تم رفض الفريق بنجاح وتحديث حالته.');
      setRejectingTeam(null);
      setRejectReason('');
      refetch();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'تعذّر رفض الفريق.');
    } finally {
      setBusy(false);
    }
  };

  const handleAssignSaintConfirm = async () => {
    if (!assigningTeam || !selectedSaintId) return;
    clearMessages();
    setBusy(true);
    try {
      const { error } = await supabase!.rpc('assign_team_saint', {
        p_team: assigningTeam.id,
        p_saint: selectedSaintId,
      });
      if (error) throw error;
      setActionSuccess('تم تعيين القديس للفريق بنجاح.');
      setAssigningTeam(null);
      setSelectedSaintId('');
      refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'تعذّر تعيين القديس.';
      setActionError(msg.includes('saint_taken') ? 'هذا القديس محجوز لفريق آخر بالفعل.' : msg);
    } finally {
      setBusy(false);
    }
  };

  const pendingCount = (teams ?? []).filter((t) => t.status === 'pending').length;
  const approvedCount = (teams ?? []).filter((t) => t.status === 'approved').length;
  const rejectedCount = (teams ?? []).filter((t) => t.status === 'rejected').length;

  const filteredTeams = (teams ?? [])
    .filter((t) => (filter === 'all' ? true : t.status === filter))
    .filter((t) => {
      if (!search.trim()) return true;
      const s = search.trim().toLowerCase();
      const saintName = t.saint?.name_ar?.toLowerCase() ?? '';
      const playerMatch = t.players.some((p) => p.full_name_ar.toLowerCase().includes(s));
      return saintName.includes(s) || playerMatch || String(t.team_number).includes(s);
    });

  return (
    <div className="space-y-6">
      {/* Header & Status Notice */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ivory/10 pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">إدارة واعتماد الفرق</h1>
          <p className="mt-1 text-sm text-ivory/70">
            مراجعة طلبات الفرق المسجلة، تعيين القديسين، واعتماد القوائم النهائية.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-ghost !min-h-9 !px-3 text-xs"
          disabled={isLoading || busy}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          تحديث القائمة
        </button>
      </div>

      {actionError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger/50 bg-danger/10 p-4 text-sm text-danger">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-gold/50 bg-gold/10 p-4 text-sm text-gold">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`btn !min-h-9 !px-3 text-xs ${
              filter === 'pending' ? 'bg-gold text-midnight' : 'border border-ivory/20 text-ivory/80'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            قيد الانتظار ({num(pendingCount)})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`btn !min-h-9 !px-3 text-xs ${
              filter === 'approved' ? 'bg-gold text-midnight' : 'border border-ivory/20 text-ivory/80'
            }`}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            المعتمدة ({num(approvedCount)})
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`btn !min-h-9 !px-3 text-xs ${
              filter === 'rejected' ? 'bg-gold text-midnight' : 'border border-ivory/20 text-ivory/80'
            }`}
          >
            <XCircle className="h-3.5 w-3.5" />
            المرفوضة ({num(rejectedCount)})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`btn !min-h-9 !px-3 text-xs ${
              filter === 'all' ? 'bg-gold text-midnight' : 'border border-ivory/20 text-ivory/80'
            }`}
          >
            جميع الفرق ({num(teams?.length ?? 0)})
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted" aria-hidden="true" />
          <input
            className="field !min-h-9 !ps-9 text-xs"
            placeholder="بحث باسم القديس أو اللاعب…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Teams List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : isError ? (
        <ErrorNote>تعذّر تحميل بيانات الفرق. تأكد من اتصالك بالإنترنت وصلاحيات الإدارة.</ErrorNote>
      ) : filteredTeams.length === 0 ? (
        <Empty>لا توجد فرق تطابق الاختيار المحدد.</Empty>
      ) : (
        <div className="space-y-4">
          {filteredTeams.map((team) => {
            const isExpanded = expandedTeamId === team.id;
            const hasIndividualPlayers = team.players.some((p) => p.source === 'individual');

            return (
              <div
                key={team.id}
                className={`panel transition border ${
                  team.status === 'pending'
                    ? 'border-gold/40 bg-emerald/60'
                    : team.status === 'approved'
                    ? 'border-ivory/15 bg-midnight/60'
                    : 'border-danger/30 bg-danger/5 opacity-80'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <SaintAvatar
                      name={team.saint?.name_ar ?? 'فريق'}
                      path={team.saint?.portrait_path}
                      className="h-14 w-11"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-heading text-lg font-bold text-gold">
                          {team.saint?.name_ar ?? 'فريق بدون قديس (توليد تلقائي)'}
                        </h2>
                        <span className="rounded-md bg-ivory/10 px-2 py-0.5 text-xs text-ivory/80">
                          فريق #{num(team.team_number)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            team.status === 'approved'
                              ? 'bg-gold/20 text-gold'
                              : team.status === 'rejected'
                              ? 'bg-danger/20 text-danger'
                              : 'bg-yellow-400/20 text-yellow-300'
                          }`}
                        >
                          {team.status === 'approved'
                            ? 'معتمد'
                            : team.status === 'rejected'
                            ? 'مرفوض'
                            : 'قيد المراجعة'}
                        </span>
                        {team.source === 'automatic' && (
                          <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[11px] text-sky-300">
                            فريق تلقائي
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ivory/60">
                        {num(team.players.length)} لاعبين · تم التقديم:{' '}
                        {dayLabel(team.submitted_at)} — {timeLabel(team.submitted_at)}
                      </p>
                      {team.rejection_reason && (
                        <p className="mt-1 text-xs text-danger">
                          سبب الرفض: {team.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {team.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(team)}
                          disabled={busy}
                          className="btn-gold !min-h-9 !px-3 text-xs"
                          title="اعتماد الفريق والموافقة على مشاركته"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          اعتماد الفريق
                        </button>

                        <button
                          onClick={() => {
                            setRejectingTeam(team);
                            setRejectReason('');
                            setReturnPlayers(hasIndividualPlayers);
                          }}
                          disabled={busy}
                          className="btn-ghost !min-h-9 !px-3 text-xs text-danger hover:border-danger hover:text-danger"
                          title="رفض طلب تسجيل الفريق"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          رفض
                        </button>

                        <button
                          onClick={() => {
                            setAssigningTeam(team);
                            setSelectedSaintId(team.saint?.id ?? '');
                          }}
                          disabled={busy}
                          className="btn-ghost !min-h-9 !px-3 text-xs"
                          title="تحديد أو تغيير اسم القديس"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          {team.saint ? 'تغيير القديس' : 'تعيين قديس'}
                        </button>
                      </>
                    )}

                    {team.status === 'approved' && (
                      <button
                        onClick={() => {
                          setAssigningTeam(team);
                          setSelectedSaintId(team.saint?.id ?? '');
                        }}
                        disabled={busy}
                        className="btn-ghost !min-h-9 !px-3 text-xs"
                        title="تعديل قديس الفريق"
                      >
                        تعديل القديس
                      </button>
                    )}

                    <button
                      onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                      className="btn-ghost !min-h-9 !px-2 text-xs"
                      aria-label={isExpanded ? 'إخفاء اللاعبين' : 'عرض اللاعبين'}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Player Roster */}
                {isExpanded && (
                  <div className="border-t border-ivory/10 bg-midnight/40 p-4">
                    <h3 className="mb-2 text-xs font-semibold text-gold">
                      قائمة لاعبي الفريق ({num(team.players.length)}):
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {team.players.map((p, i) => (
                        <div
                          key={p.id}
                          className="rounded-lg border border-ivory/10 bg-emerald/30 p-2 text-xs"
                        >
                          <div className="font-heading font-semibold text-ivory">
                            {num(i + 1)}. {p.full_name_ar}
                          </div>
                          <div className="mt-0.5 text-ivory/60">الفصل: {p.class_name_ar}</div>
                          {p.source === 'individual' && (
                            <div className="mt-1 text-[10px] text-sky-300">
                              (تسجيل فردي — تم ضمه تلقائياً)
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-danger/40 bg-midnight p-6 shadow-2xl">
            <h2 className="font-heading text-lg font-bold text-danger">
              تأكيد رفض الفريق: {rejectingTeam.saint?.name_ar ?? `فريق #${rejectingTeam.team_number}`}
            </h2>
            <p className="mt-2 text-xs text-ivory/70">
              سيتم وضع الفريق في حالة &quot;مرفوض&quot; وتحرير اسم القديس ليتاح لفرق أخرى.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="rej-reason">
                  سبب الرفض (اختياري، يظهر للإدارة):
                </label>
                <textarea
                  id="rej-reason"
                  className="field !min-h-[70px] text-xs"
                  placeholder="مثال: أسماء مكررة، فصل غير مطابق، الخ..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>

              {rejectingTeam.players.some((p) => p.source === 'individual') && (
                <label className="flex items-center gap-2 text-xs text-ivory/90">
                  <input
                    type="checkbox"
                    checked={returnPlayers}
                    onChange={(e) => setReturnPlayers(e.target.checked)}
                    className="h-4 w-4 rounded border-ivory/30 bg-midnight text-gold focus:ring-gold"
                  />
                  <span>إعادة اللاعبين المسجلين فردياً إلى قائمة الانتظار لتشكيل فريق آخر</span>
                </label>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setRejectingTeam(null)}
                className="btn-ghost !min-h-9 !px-3 text-xs"
                disabled={busy}
              >
                إلغاء
              </button>
              <button
                onClick={handleRejectConfirm}
                className="btn !min-h-9 !px-4 bg-danger text-xs text-white hover:bg-danger/80"
                disabled={busy}
              >
                {busy ? 'جارٍ الرفض…' : 'تأكيد الرفض'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Saint Modal */}
      {assigningTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gold/40 bg-midnight p-6 shadow-2xl">
            <h2 className="font-heading text-lg font-bold text-gold">
              تعيين قديس لفريق #{num(assigningTeam.team_number)}
            </h2>
            <p className="mt-1 text-xs text-ivory/70">
              اختر قديساً معتمداً لم يحجزه أي فريق نشط آخر.
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="saint-select">
                اختر القديس:
              </label>
              <select
                id="saint-select"
                className="field text-xs"
                value={selectedSaintId}
                onChange={(e) => setSelectedSaintId(e.target.value)}
              >
                <option value="">-- اختر قديساً من القائمة --</option>
                {(saints ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setAssigningTeam(null)}
                className="btn-ghost !min-h-9 !px-3 text-xs"
                disabled={busy}
              >
                إلغاء
              </button>
              <button
                onClick={handleAssignSaintConfirm}
                className="btn-gold !min-h-9 !px-4 text-xs"
                disabled={!selectedSaintId || busy}
              >
                {busy ? 'جارٍ الحفظ…' : 'حفظ التعيين'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
