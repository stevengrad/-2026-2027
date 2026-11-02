import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminPath } from '../../lib/adminRoute';
import { SaintAvatar } from '../../components/ui/SaintAvatar';
import { Empty, ErrorNote, Skeleton } from '../../components/ui/States';
import { dayLabel, num, timeLabel } from '../../lib/format';
import { TOURNAMENT_CLASSES } from '../../lib/classes';
import { teamFormSchema } from '../../lib/schemas';

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

interface EditablePlayer {
  draftId: string;
  id?: string;
  name: string;
  className: string;
  source: AdminPlayer['source'];
}

/** `review` = new requests + rejected (before acceptance). `accepted` = the dedicated accepted-teams tab (after acceptance).
 *  Both modes can edit and delete teams. */
export default function AdminTeams({ mode = 'review' }: { mode?: 'review' | 'accepted' }) {
  const accepted = mode === 'accepted';
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const activeFilter = accepted ? 'approved' : filter;
  const [search, setSearch] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Reject modal state
  const [rejectingTeam, setRejectingTeam] = useState<AdminTeam | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [returnPlayers, setReturnPlayers] = useState(true);

  // Team editor and destructive-delete confirmation state
  const [editingTeam, setEditingTeam] = useState<AdminTeam | null>(null);
  const [editSaintId, setEditSaintId] = useState('');
  const [editPlayers, setEditPlayers] = useState<EditablePlayer[]>([]);
  const [deletingTeam, setDeletingTeam] = useState<AdminTeam | null>(null);
  const [deleteNeedsForce, setDeleteNeedsForce] = useState(false);

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

  // The team's current saint must stay selectable even if it was deactivated after the team was created.
  const editorSaints = [...(saints ?? [])];
  if (editingTeam?.saint && !editorSaints.some((x) => x.id === editingTeam.saint!.id)) editorSaints.unshift({ id: editingTeam.saint.id, name_ar: editingTeam.saint.name_ar });

  const clearMessages = () => {
    setActionError(null);
    setActionSuccess(null);
  };

  const openTeamEditor = (team: AdminTeam) => {
    clearMessages();
    setEditingTeam(team);
    setEditSaintId(team.saint?.id ?? '');
    setEditPlayers(team.players.map((player) => ({
      draftId: player.id,
      id: player.id,
      name: player.full_name_ar,
      className: player.class_name_ar,
      source: player.source,
    })));
  };

  const describeActionError = (e: unknown, fallback: string) => {
    const message = e instanceof Error ? e.message : '';
    if (message.includes('player_has_events')) return 'لا يمكن إزالة لاعب سُجِّلت له أهداف أو بطاقات في مباراة. عدّل اسمه فقط أو احتفظ به في القائمة.';
    if (message.includes('team_has_results')) return 'لا يمكن حذف فريق لعب مباريات منتهية، حفاظاً على نتائج البطولة.';
    if (message.includes('team_in_knockout')) return 'الفريق ضمن شجرة الأدوار الإقصائية. أعد إنشاء الشجرة أولاً ثم احذف الفريق.';
    if (message.includes('team_not_editable')) return 'لا يمكن تعديل فريق مرفوض. احذفه إذا أردت إزالته نهائياً.';
    if (message.includes('saint_taken')) return 'هذا القديس محجوز لفريق آخر بالفعل.';
    if (message.includes('invalid_player_count')) return 'يجب أن تضم القائمة من ٤ إلى ٧ لاعبين.';
    if (message.includes('duplicate_players')) return 'يوجد لاعب مكرر في القائمة.';
    if (message.includes('player_not_in_team')) return 'تغيّرت قائمة اللاعبين. حدّث الصفحة ثم حاول مرة أخرى.';
    return message || fallback;
  };

  const handleApprove = async (team: AdminTeam) => {
    clearMessages();
    if (!team.saint) {
      setActionError('لا يمكن اعتماد الفريق بدون تحديد اسم القديس أولاً. يرجى تعيين قديس.');
      openTeamEditor(team);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase!.rpc('approve_team', { p_team: team.id });
      if (error) throw error;
      setActionSuccess(`تم اعتماد فريق "${team.saint.name_ar}" بنجاح. يمكنك تعديله أو حذفه من تبويب «الفرق المقبولة».`);
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

  const handleUpdateTeamConfirm = async () => {
    if (!editingTeam) return;
    clearMessages();
    const parsed = teamFormSchema.safeParse({
      saintId: editSaintId,
      players: editPlayers.map((player) => ({ name: player.name, class: player.className })),
    });
    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? 'راجع بيانات الفريق ثم حاول مرة أخرى.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase!.rpc('update_team_roster', {
        p_team: editingTeam.id,
        p_saint: editSaintId,
        p_players: editPlayers.map((player) => ({
          ...(player.id ? { id: player.id } : {}),
          name: player.name.trim(),
          class: player.className,
        })),
      });
      if (error) throw error;
      const saintName = editorSaints.find((saint) => saint.id === editSaintId)?.name_ar ?? 'الفريق';
      setActionSuccess(`تم حفظ تعديلات فريق "${saintName}" بنجاح.`);
      setEditingTeam(null);
      setEditPlayers([]);
      refetch();
    } catch (e: unknown) {
      setActionError(describeActionError(e, 'تعذّر حفظ تعديلات الفريق.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTeamConfirm = async () => {
    if (!deletingTeam) return;
    clearMessages();
    setBusy(true);
    try {
      const { error } = await supabase!.rpc('delete_team', { p_team: deletingTeam.id, p_force: deleteNeedsForce });
      if (error) throw error;
      setActionSuccess(`تم حذف فريق "${deletingTeam.saint?.name_ar ?? `#${deletingTeam.team_number}`}" نهائياً.`);
      if (expandedTeamId === deletingTeam.id) setExpandedTeamId(null);
      setDeletingTeam(null);
      setDeleteNeedsForce(false);
      refetch();
    } catch (e: unknown) {
      // Team already sits in a group/fixtures: ask for an explicit second confirmation instead of failing.
      if (!deleteNeedsForce && e instanceof Error && e.message.includes('team_in_competition')) setDeleteNeedsForce(true);
      else { setActionError(describeActionError(e, 'تعذّر حذف الفريق.')); setDeletingTeam(null); setDeleteNeedsForce(false); }
    } finally {
      setBusy(false);
    }
  };

  const pendingCount = (teams ?? []).filter((t) => t.status === 'pending').length;
  const approvedCount = (teams ?? []).filter((t) => t.status === 'approved').length;
  const rejectedCount = (teams ?? []).filter((t) => t.status === 'rejected').length;

  const filteredTeams = (teams ?? [])
    .filter((t) => (activeFilter === 'all' ? true : t.status === activeFilter))
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
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">{accepted ? 'الفرق المقبولة' : 'إدارة واعتماد الفرق'}</h1>
          <p className="mt-1 text-sm text-ivory/70">
            {accepted
              ? 'الفرق المعتمدة والظاهرة للجميع. يمكنك تعديل اسم القديس وقائمة اللاعبين أو حذف أي فريق.'
              : 'مراجعة طلبات الفرق المسجلة، تعيين القديسين، وتعديل أو حذف الفرق قبل اعتمادها.'}
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
        {accepted ? (
          <p className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-gold">
            عدد الفرق المعتمدة: <b>{num(approvedCount)}</b>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('pending')}
              className={`btn !min-h-9 !px-3 text-xs ${filter === 'pending' ? 'bg-gold text-midnight' : 'border border-ivory/20 text-ivory/80'}`}
            >
              <Clock className="h-3.5 w-3.5" />
              قيد الانتظار ({num(pendingCount)})
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`btn !min-h-9 !px-3 text-xs ${filter === 'rejected' ? 'bg-gold text-midnight' : 'border border-ivory/20 text-ivory/80'}`}
            >
              <XCircle className="h-3.5 w-3.5" />
              المرفوضة ({num(rejectedCount)})
            </button>
            <Link to={adminPath('accepted-teams')} className="btn !min-h-9 !px-3 text-xs border border-gold/40 text-gold hover:bg-gold/10">
              <CheckCircle className="h-3.5 w-3.5" />
              الفرق المقبولة ({num(approvedCount)})
            </Link>
          </div>
        )}

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
        <Empty>{accepted ? 'لا توجد فرق معتمدة بعد.' : 'لا توجد فرق تطابق الاختيار المحدد.'}</Empty>
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

                      </>
                    )}

                    {team.status !== 'rejected' && (
                      <button
                        onClick={() => openTeamEditor(team)}
                        disabled={busy}
                        className="btn-ghost !min-h-9 !px-3 text-xs"
                        title="تعديل اسم القديس وقائمة لاعبي الفريق"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        تعديل الفريق
                      </button>
                    )}

                    <button
                      onClick={() => { setDeleteNeedsForce(false); setDeletingTeam(team); }}
                      disabled={busy}
                      className="btn-ghost !min-h-9 !px-3 text-xs text-danger hover:border-danger hover:text-danger"
                      title="حذف الفريق نهائياً"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </button>

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

      {/* Team Editor Modal */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-midnight/80 p-4 backdrop-blur-sm">
          <div className="mx-auto my-4 w-full max-w-3xl rounded-2xl border border-gold/40 bg-midnight p-5 shadow-2xl sm:p-6">
            <h2 className="font-heading text-lg font-bold text-gold">تعديل فريق #{num(editingTeam.team_number)}</h2>
            <p className="mt-1 text-xs leading-5 text-ivory/70">يمكنك تغيير اسم القديس وقائمة اللاعبين. يجب أن يبقى الفريق بين ٤ و٧ لاعبين.</p>

            <div className="mt-5">
              <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="team-editor-saint">اسم القديس</label>
              <select id="team-editor-saint" className="field text-sm" value={editSaintId} onChange={(e) => setEditSaintId(e.target.value)}>
                <option value="">-- اختر قديساً من القائمة --</option>
                {editorSaints.map((saint) => <option key={saint.id} value={saint.id}>{saint.name_ar}</option>)}
              </select>
            </div>

            <section className="mt-5 rounded-xl border border-ivory/10 bg-emerald/25 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="font-heading text-sm font-bold text-gold">قائمة اللاعبين ({num(editPlayers.length)} من ٧)</h3>
                  <p className="mt-1 text-[11px] text-ivory/60">الحد الأدنى ٤ لاعبين. إزالة لاعب فردي تعيده إلى قائمة الانتظار.</p></div>
                <button type="button" onClick={() => setEditPlayers((players) => [...players, { draftId: crypto.randomUUID(), name: '', className: '', source: 'team_registration' }])} disabled={editPlayers.length >= 7 || busy} className="btn-ghost !min-h-9 !px-3 text-xs">
                  <Plus className="h-3.5 w-3.5" /> إضافة لاعب
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {editPlayers.map((player, index) => <div key={player.draftId} className="rounded-xl border border-ivory/10 bg-midnight/50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2"><span className="font-heading text-xs text-gold">اللاعب {num(index + 1)}</span>
                    <div className="flex items-center gap-2">{player.source === 'individual' && <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-200">تسجيل فردي</span>}
                      {editPlayers.length > 4 && <button type="button" onClick={() => setEditPlayers((players) => players.filter((item) => item.draftId !== player.draftId))} disabled={busy} className="text-danger hover:text-danger/80" aria-label={`حذف اللاعب ${num(index + 1)}`}><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input className="field !min-h-10 text-sm" value={player.name} onChange={(e) => setEditPlayers((players) => players.map((item) => item.draftId === player.draftId ? { ...item, name: e.target.value } : item))} placeholder="اسم اللاعب" aria-label={`اسم اللاعب ${num(index + 1)}`} />
                    <select className="field !min-h-10 text-sm" value={player.className} onChange={(e) => setEditPlayers((players) => players.map((item) => item.draftId === player.draftId ? { ...item, className: e.target.value } : item))} aria-label={`فصل اللاعب ${num(index + 1)}`}>
                      <option value="">اختر الفصل…</option>{TOURNAMENT_CLASSES.map((className) => <option key={className} value={className}>{className}</option>)}
                    </select>
                  </div>
                </div>)}
              </div>
            </section>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => { setEditingTeam(null); setEditPlayers([]); }} className="btn-ghost !min-h-9 !px-3 text-xs" disabled={busy}>إلغاء</button>
              <button onClick={handleUpdateTeamConfirm} className="btn-gold !min-h-9 !px-4 text-xs" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation: a second, explicit step is required when the team already sits in a group or fixtures. */}
      {deletingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/80 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-danger/40 bg-midnight p-6 shadow-2xl">
            <h2 className="font-heading text-lg font-bold text-danger">حذف فريق {deletingTeam.saint?.name_ar ?? `#${num(deletingTeam.team_number)}`}؟</h2>
            <p className="mt-2 text-xs leading-5 text-ivory/75">هذا الإجراء نهائي. سيُحذف لاعبو التسجيل الجماعي، بينما يعود اللاعبون المسجلون فردياً إلى قائمة الانتظار، ويتحرر اسم القديس لفريق آخر.</p>
            {deleteNeedsForce && (
              <div role="alert" className="mt-3 rounded-xl border border-danger/50 bg-danger/10 p-3 text-xs leading-5 text-danger">
                هذا الفريق موجود بالفعل في مجموعة. المتابعة ستحذف الفريق وجميع مبارياته غير المنتهية في دور المجموعات، وقد تحتاج إلى إعادة قرعة المجموعات بعدها. لا يمكن حذف فريق لعب مباريات منتهية.
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => { setDeletingTeam(null); setDeleteNeedsForce(false); }} className="btn-ghost !min-h-9 !px-3 text-xs" disabled={busy}>إلغاء</button>
              <button onClick={handleDeleteTeamConfirm} className="btn !min-h-9 !px-4 bg-danger text-xs text-white hover:bg-danger/80" disabled={busy}>
                {busy ? 'جارٍ الحذف…' : deleteNeedsForce ? 'حذف الفريق ومبارياته' : 'حذف الفريق نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
