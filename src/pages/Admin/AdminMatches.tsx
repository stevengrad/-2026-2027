import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Goal,
  Square,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  RotateCcw,
} from 'lucide-react';
import { supabase, callFunction } from '../../lib/supabase';
import { SaintAvatar } from '../../components/ui/SaintAvatar';
import { Empty, ErrorNote, Skeleton } from '../../components/ui/States';
import { dayLabel, num, timeLabel } from '../../lib/format';
import { STAGE_LABEL, STATUS_LABEL, type Stage, type MatchStatus } from '../../lib/types';

interface MatchTeamData {
  id: string;
  team_number: number;
  saint: { id: string; name_ar: string; portrait_path: string | null } | null;
  players?: { id: string; full_name_ar: string }[];
}

interface AdminMatch {
  id: string;
  stage: Stage;
  bracket_order: number | null;
  group_id: string | null;
  scheduled_at: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  score_manual: boolean;
  decision: 'regular' | 'extra_time' | 'penalties' | null;
  home_pens: number | null;
  away_pens: number | null;
  winner_team_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team: MatchTeamData | null;
  away_team: MatchTeamData | null;
  events?: AdminMatchEvent[];
  events_home?: number;
  events_away?: number;
  score_discrepancy?: boolean;
}

interface AdminMatchEvent {
  id: string;
  match_id: string;
  team_id: string;
  event_type: 'goal' | 'yellow_card' | 'red_card';
  is_own_goal: boolean;
  event_minute: number | null;
  notes: string | null;
  player_id: string | null;
  player: { id: string; full_name_ar: string } | null;
}

export default function AdminMatches() {
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Score Modal
  const [scoringMatch, setScoringMatch] = useState<AdminMatch | null>(null);
  const [homeScoreInput, setHomeScoreInput] = useState<number>(0);
  const [awayScoreInput, setAwayScoreInput] = useState<number>(0);
  const [markComplete, setMarkComplete] = useState<boolean>(true);
  const [decisionInput, setDecisionInput] = useState<'regular' | 'extra_time' | 'penalties'>('regular');
  const [homePensInput, setHomePensInput] = useState<number>(0);
  const [awayPensInput, setAwayPensInput] = useState<number>(0);

  // Schedule & Status Modal
  const [scheduleMatch, setScheduleMatch] = useState<AdminMatch | null>(null);
  const [schedDateInput, setSchedDateInput] = useState<string>('');
  const [statusInput, setStatusInput] = useState<MatchStatus>('scheduled');

  // Assign Teams Modal (for Knockout slots)
  const [assignMatch, setAssignMatch] = useState<AdminMatch | null>(null);
  const [assignHomeId, setAssignHomeId] = useState<string>('');
  const [assignAwayId, setAssignAwayId] = useState<string>('');

  // Add Event Form State
  const [eventTeamId, setEventTeamId] = useState<string>('');
  const [eventType, setEventType] = useState<'goal' | 'yellow_card' | 'red_card'>('goal');
  const [eventPlayerId, setEventPlayerId] = useState<string>('');
  const [isOwnGoal, setIsOwnGoal] = useState<boolean>(false);
  const [eventMinute, setEventMinute] = useState<string>('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch approved teams (for slot assignment)
  const { data: approvedTeams } = useQuery({
    queryKey: ['admin_matches_approved_teams'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('teams')
        .select('id, team_number, saint:saints(name_ar)')
        .eq('status', 'approved')
        .order('team_number');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch all matches with full details and events
  const { data: matches, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin_matches_list'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id, stage, bracket_order, group_id, scheduled_at, status, home_score, away_score, score_manual,
          decision, home_pens, away_pens, winner_team_id, home_team_id, away_team_id,
          home_team:teams!matches_home_team_id_fkey(
            id, team_number,
            saint:saints(id, name_ar, portrait_path),
            players(id, full_name_ar)
          ),
          away_team:teams!matches_away_team_id_fkey(
            id, team_number,
            saint:saints(id, name_ar, portrait_path),
            players(id, full_name_ar)
          ),
          events:match_events(
            id, match_id, team_id, event_type, is_own_goal, event_minute, notes, player_id,
            player:players(id, full_name_ar)
          )
        `)
        .order('stage')
        .order('bracket_order', { ascending: true, nullsFirst: false })
        .order('scheduled_at', { ascending: true, nullsFirst: false });

      if (error) throw error;

      // Calculate discrepancy
      return (data as unknown as AdminMatch[]).map((m) => {
        const events = m.events ?? [];
        const homeGoals = events.filter((e) => e.event_type === 'goal' && e.team_id === m.home_team_id).length;
        const awayGoals = events.filter((e) => e.event_type === 'goal' && e.team_id === m.away_team_id).length;
        const discrepancy =
          (m.status === 'completed' || m.score_manual) &&
          (m.home_score !== homeGoals || m.away_score !== awayGoals);
        return {
          ...m,
          events_home: homeGoals,
          events_away: awayGoals,
          score_discrepancy: discrepancy,
        };
      });
    },
  });

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Open Score Modal
  const openScoreModal = (m: AdminMatch) => {
    setScoringMatch(m);
    setHomeScoreInput(m.home_score ?? 0);
    setAwayScoreInput(m.away_score ?? 0);
    setMarkComplete(m.status === 'completed' || true);
    setDecisionInput(m.decision ?? 'regular');
    setHomePensInput(m.home_pens ?? 0);
    setAwayPensInput(m.away_pens ?? 0);
  };

  // Save Score
  const handleSaveScore = async () => {
    if (!scoringMatch) return;
    clearMessages();
    setBusy(true);
    try {
      await callFunction('manage-match', {
        action: 'set_score',
        matchId: scoringMatch.id,
        homeScore: homeScoreInput,
        awayScore: awayScoreInput,
        complete: markComplete,
        decision: decisionInput,
        homePens: decisionInput === 'penalties' ? homePensInput : null,
        awayPens: decisionInput === 'penalties' ? awayPensInput : null,
      });
      setSuccess('تم حفظ نتيجة المباراة بنجاح.');
      setScoringMatch(null);
      refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذّر حفظ النتيجة.');
    } finally {
      setBusy(false);
    }
  };

  // Open Schedule Modal
  const openScheduleModal = (m: AdminMatch) => {
    setScheduleMatch(m);
    setStatusInput(m.status);
    if (m.scheduled_at) {
      const dt = new Date(m.scheduled_at);
      const iso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setSchedDateInput(iso);
    } else {
      setSchedDateInput('');
    }
  };

  // Save Schedule & Status
  const handleSaveSchedule = async () => {
    if (!scheduleMatch) return;
    clearMessages();
    setBusy(true);
    try {
      const iso = schedDateInput ? new Date(schedDateInput).toISOString() : null;
      await callFunction('manage-match', {
        action: 'update_details',
        matchId: scheduleMatch.id,
        scheduledAt: iso,
        status: statusInput,
      });
      setSuccess('تم تحديث موعد وحالة المباراة بنجاح.');
      setScheduleMatch(null);
      refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذّر تحديث موعد المباراة.');
    } finally {
      setBusy(false);
    }
  };

  // Open Assign Teams Modal
  const openAssignModal = (m: AdminMatch) => {
    setAssignMatch(m);
    setAssignHomeId(m.home_team_id ?? '');
    setAssignAwayId(m.away_team_id ?? '');
  };

  // Save Assigned Teams
  const handleSaveAssign = async () => {
    if (!assignMatch) return;
    clearMessages();
    setBusy(true);
    try {
      await callFunction('manage-match', {
        action: 'update_details',
        matchId: assignMatch.id,
        homeTeamId: assignHomeId || null,
        awayTeamId: assignAwayId || null,
      });
      setSuccess('تم تحديث أطراف المباراة بنجاح.');
      setAssignMatch(null);
      refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذّر تحديث أطراف المباراة.');
    } finally {
      setBusy(false);
    }
  };

  // Add Event
  const handleAddEvent = async (matchId: string) => {
    if (!eventTeamId) {
      setError('يرجى اختيار الفريق.');
      return;
    }
    clearMessages();
    setBusy(true);
    try {
      const min = eventMinute.trim() ? Number(eventMinute) : null;
      await callFunction('manage-match', {
        action: 'add_event',
        matchId,
        teamId: eventTeamId,
        eventType,
        playerId: eventPlayerId || null,
        isOwnGoal: eventType === 'goal' ? isOwnGoal : false,
        eventMinute: min,
      });
      setSuccess('تم تسجيل الحدث بنجاح.');
      setEventPlayerId('');
      setEventMinute('');
      setIsOwnGoal(false);
      refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذّر تسجيل الحدث.');
    } finally {
      setBusy(false);
    }
  };

  // Delete Event
  const handleDeleteEvent = async (eventId: string) => {
    clearMessages();
    setBusy(true);
    try {
      await callFunction('manage-match', {
        action: 'delete_event',
        eventId,
      });
      setSuccess('تم حذف الحدث بنجاح.');
      refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذّر حذف الحدث.');
    } finally {
      setBusy(false);
    }
  };

  // Reset Score to match events
  const handleResetScore = async (matchId: string) => {
    clearMessages();
    setBusy(true);
    try {
      await callFunction('manage-match', {
        action: 'reset_score_to_events',
        matchId,
      });
      setSuccess('تمت إعادة مزامنة النتيجة بنجاح مع أحداث الأهداف.');
      refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذّر إعادة مزامنة النتيجة.');
    } finally {
      setBusy(false);
    }
  };

  const filteredMatches = (matches ?? [])
    .filter((m) => (stageFilter === 'all' ? true : m.stage === stageFilter))
    .filter((m) => (statusFilter === 'all' ? true : m.status === statusFilter))
    .filter((m) => {
      if (!search.trim()) return true;
      const s = search.trim().toLowerCase();
      const home = m.home_team?.saint?.name_ar?.toLowerCase() ?? '';
      const away = m.away_team?.saint?.name_ar?.toLowerCase() ?? '';
      return home.includes(s) || away.includes(s);
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ivory/10 pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">إدارة المباريات والنتائج</h1>
          <p className="mt-1 text-sm text-ivory/70">
            تحديد مواعيد المباريات، إدخال النتائج وركلات الترجيح، وتسجيل أحداث الأهداف والبطاقات.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-ghost !min-h-9 !px-3 text-xs"
          disabled={busy || isLoading}
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

      {/* Filters */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="filter-stage">
            المرحلة / الدور:
          </label>
          <select
            id="filter-stage"
            className="field text-xs"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="all">جميع المراحل</option>
            <option value="group">دور المجموعات</option>
            <option value="round_of_16">دور الـ١٦</option>
            <option value="quarter_final">ربع النهائي</option>
            <option value="semi_final">نصف النهائي</option>
            <option value="third_place">المركز الثالث</option>
            <option value="final">النهائي</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="filter-status">
            حالة المباراة:
          </label>
          <select
            id="filter-status"
            className="field text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">جميع الحالات</option>
            <option value="scheduled">لم تبدأ</option>
            <option value="live">جارية الآن</option>
            <option value="completed">انتهت</option>
            <option value="postponed">مؤجلة</option>
            <option value="cancelled">ملغاة</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="filter-search">
            بحث باسم الفريق:
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted" aria-hidden="true" />
            <input
              id="filter-search"
              className="field !ps-9 text-xs"
              placeholder="ابحث عن قديس أو فريق…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Matches List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : isError ? (
        <ErrorNote>تعذّر تحميل قائمة المباريات.</ErrorNote>
      ) : filteredMatches.length === 0 ? (
        <Empty>لا توجد مباريات مطابقة للبحث.</Empty>
      ) : (
        <div className="space-y-4">
          {filteredMatches.map((m) => {
            const isExpanded = expandedMatchId === m.id;
            const homeSaint = Array.isArray(m.home_team?.saint) ? m.home_team?.saint[0] : m.home_team?.saint;
            const awaySaint = Array.isArray(m.away_team?.saint) ? m.away_team?.saint[0] : m.away_team?.saint;

            return (
              <div
                key={m.id}
                className={`panel transition border ${
                  m.status === 'live'
                    ? 'border-danger/60 bg-danger/10'
                    : m.status === 'completed'
                    ? 'border-ivory/15 bg-emerald/40'
                    : 'border-ivory/10 bg-midnight/60'
                }`}
              >
                {/* Header Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ivory/10 px-4 py-2.5 text-xs text-ivory/70">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-semibold text-gold">
                      {STAGE_LABEL[m.stage]}
                    </span>
                    {m.stage !== 'group' && m.bracket_order != null && (
                      <span className="rounded bg-gold/10 px-2 py-0.5 text-[11px] text-gold">مباراة #{num(m.bracket_order)}</span>
                    )}
                    {m.scheduled_at && (
                      <span>
                        · {dayLabel(m.scheduled_at)} — {timeLabel(m.scheduled_at)}
                      </span>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      m.status === 'live'
                        ? 'bg-danger text-white'
                        : m.status === 'completed'
                        ? 'bg-gold/20 text-gold'
                        : 'bg-ivory/10 text-ivory/70'
                    }`}
                  >
                    {STATUS_LABEL[m.status]}
                  </span>
                </div>

                {/* Score Discrepancy Alert */}
                {m.score_discrepancy && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/30 bg-gold/10 px-4 py-2 text-xs text-gold">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>
                        تنبيه: النتيجة المسجلة ({num(m.home_score ?? 0)} - {num(m.away_score ?? 0)}) تختلف عن عدد الأهداف في الأحداث ({num(m.events_home ?? 0)} - {num(m.events_away ?? 0)}).
                      </span>
                    </div>
                    <button
                      onClick={() => handleResetScore(m.id)}
                      disabled={busy}
                      className="btn-ghost !min-h-7 !px-2.5 text-[11px] hover:bg-gold hover:text-midnight"
                      title="تحديث النتيجة لتتطابق تلقائياً مع أحداث الأهداف"
                    >
                      <RotateCcw className="h-3 w-3" />
                      مزامنة النتيجة مع الأهداف
                    </button>
                  </div>
                )}

                {/* Match Row */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                  {/* Teams and Score */}
                  <div className="flex flex-1 items-center gap-3">
                    <div className="flex flex-1 items-center justify-end gap-2 text-end">
                      <span className="font-heading text-sm font-semibold sm:text-base">
                        {homeSaint?.name_ar ?? 'يُحدَّد لاحقاً'}
                      </span>
                      <SaintAvatar
                        name={homeSaint?.name_ar ?? 'فريق'}
                        path={homeSaint?.portrait_path}
                        className="h-10 w-8"
                      />
                    </div>

                    <div className="min-w-[70px] text-center">
                      <div className="num font-heading text-2xl font-bold text-gold sm:text-3xl" dir="ltr">
                        {m.home_score != null ? `${num(m.home_score)} - ${num(m.away_score ?? 0)}` : 'ضد'}
                      </div>
                      {m.decision === 'penalties' && m.home_pens != null && (
                        <div className="text-[11px] text-ivory/60" dir="ltr">
                          ر.ج {num(m.home_pens)} - {num(m.away_pens ?? 0)}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 items-center gap-2">
                      <SaintAvatar
                        name={awaySaint?.name_ar ?? 'فريق'}
                        path={awaySaint?.portrait_path}
                        className="h-10 w-8"
                      />
                      <span className="font-heading text-sm font-semibold sm:text-base">
                        {awaySaint?.name_ar ?? 'يُحدَّد لاحقاً'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => openScoreModal(m)}
                      disabled={busy}
                      className="btn-gold !min-h-8 !px-3 text-xs"
                      title="تسجيل أو تعديل نتيجة المباراة"
                    >
                      <Goal className="h-3.5 w-3.5" />
                      النتيجة
                    </button>

                    <button
                      onClick={() => openScheduleModal(m)}
                      disabled={busy}
                      className="btn-ghost !min-h-8 !px-3 text-xs"
                      title="تعديل موعد وحالة المباراة"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      الموعد
                    </button>

                    {m.stage !== 'group' && (
                      <button
                        onClick={() => openAssignModal(m)}
                        disabled={busy}
                        className="btn-ghost !min-h-8 !px-3 text-xs"
                        title="تعيين الفرق المتأهلة لهذه الخانة"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        الفرق
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setExpandedMatchId(isExpanded ? null : m.id);
                        if (!isExpanded) {
                          setEventTeamId(m.home_team_id ?? '');
                        }
                      }}
                      className={`btn-ghost !min-h-8 !px-3 text-xs ${
                        isExpanded ? 'bg-gold/15 text-gold' : ''
                      }`}
                      title="عرض وإضافة أحداث المباراة (أهداف وبطاقات)"
                    >
                      الأحداث ({num(m.events?.length ?? 0)})
                    </button>
                  </div>
                </div>

                {/* Expanded Events Panel */}
                {isExpanded && (
                  <div className="border-t border-ivory/10 bg-midnight/50 p-4">
                    <h3 className="mb-3 font-heading text-xs font-bold text-gold">
                      أحداث وبطاقات المباراة ({num(m.events?.length ?? 0)}):
                    </h3>

                    {/* Events List */}
                    {(m.events ?? []).length === 0 ? (
                      <p className="mb-4 text-xs text-ivory/60">لم يتم تسجيل أحداث لهذه المباراة بعد.</p>
                    ) : (
                      <div className="mb-4 grid gap-2 sm:grid-cols-2">
                        {m.events!.map((ev) => {
                          const isHome = ev.team_id === m.home_team_id;
                          const teamSaint = isHome ? homeSaint : awaySaint;

                          return (
                            <div
                              key={ev.id}
                              className="flex items-center justify-between rounded-lg border border-ivory/10 bg-emerald/20 p-2 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                {ev.event_type === 'goal' ? (
                                  <Goal className="h-4 w-4 text-gold" />
                                ) : (
                                  <Square
                                    className={`h-4 w-4 ${
                                      ev.event_type === 'red_card'
                                        ? 'fill-danger text-danger'
                                        : 'fill-yellow-400 text-yellow-400'
                                    }`}
                                  />
                                )}
                                <div>
                                  <span className="font-heading font-semibold text-ivory">
                                    {ev.player?.full_name_ar ?? 'غير منسوب'}
                                  </span>
                                  {ev.is_own_goal && (
                                    <span className="ms-1 text-[10px] text-danger">(هدف عكسي)</span>
                                  )}
                                  <span className="ms-1 text-ivory/60">
                                    ({teamSaint?.name_ar ?? 'فريق'})
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {ev.event_minute != null && (
                                  <span className="num text-ivory/70">{num(ev.event_minute)}&apos;</span>
                                )}
                                <button
                                  onClick={() => handleDeleteEvent(ev.id)}
                                  className="text-danger hover:opacity-80"
                                  title="حذف هذا الحدث"
                                  disabled={busy}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add Event Form */}
                    <div className="rounded-xl border border-ivory/10 bg-midnight/70 p-3">
                      <h4 className="mb-2 text-xs font-semibold text-ivory">إضافة حدث جديد:</h4>
                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-5">
                        {/* Team Picker */}
                        <div>
                          <label className="mb-1 block text-[11px] text-ivory/70">الفريق:</label>
                          <select
                            className="field !min-h-8 text-xs"
                            value={eventTeamId}
                            onChange={(e) => {
                              setEventTeamId(e.target.value);
                              setEventPlayerId('');
                            }}
                          >
                            <option value="">-- اختر الفريق --</option>
                            {m.home_team_id && (
                              <option value={m.home_team_id}>
                                {homeSaint?.name_ar ?? 'الفريق الأول'}
                              </option>
                            )}
                            {m.away_team_id && (
                              <option value={m.away_team_id}>
                                {awaySaint?.name_ar ?? 'الفريق الثاني'}
                              </option>
                            )}
                          </select>
                        </div>

                        {/* Event Type */}
                        <div>
                          <label className="mb-1 block text-[11px] text-ivory/70">نوع الحدث:</label>
                          <select
                            className="field !min-h-8 text-xs"
                            value={eventType}
                            onChange={(e) => setEventType(e.target.value as 'goal' | 'yellow_card' | 'red_card')}
                          >
                            <option value="goal">هدف</option>
                            <option value="yellow_card">بطاقة صفراء</option>
                            <option value="red_card">بطاقة حمراء</option>
                          </select>
                        </div>

                        {/* Player Picker */}
                        <div>
                          <label className="mb-1 block text-[11px] text-ivory/70">اللاعب:</label>
                          <select
                            className="field !min-h-8 text-xs"
                            value={eventPlayerId}
                            onChange={(e) => setEventPlayerId(e.target.value)}
                          >
                            <option value="">-- {eventType === 'goal' ? 'غير منسوب' : 'اختر اللاعب'} --</option>
                            {(() => {
                              // If own goal, player is from the opponent team
                              const teamObj = isOwnGoal
                                ? (eventTeamId === m.home_team_id ? m.away_team : m.home_team)
                                : (eventTeamId === m.home_team_id ? m.home_team : m.away_team);
                              return (teamObj?.players ?? []).map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.full_name_ar}
                                </option>
                              ));
                            })()}
                          </select>
                        </div>

                        {/* Minute */}
                        <div>
                          <label className="mb-1 block text-[11px] text-ivory/70">الدقيقة (٠-١٣٠):</label>
                          <input
                            type="number"
                            min="0"
                            max="130"
                            className="field !min-h-8 text-xs"
                            placeholder="مثال: ٤٥"
                            value={eventMinute}
                            onChange={(e) => setEventMinute(e.target.value)}
                          />
                        </div>

                        {/* Submit Button */}
                        <div className="flex flex-col justify-end">
                          <button
                            type="button"
                            onClick={() => handleAddEvent(m.id)}
                            disabled={!eventTeamId || busy}
                            className="btn-gold !min-h-8 !px-3 text-xs"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            إضافة الحدث
                          </button>
                        </div>
                      </div>

                      {eventType === 'goal' && (
                        <div className="mt-2">
                          <label className="flex items-center gap-2 text-xs text-danger">
                            <input
                              type="checkbox"
                              checked={isOwnGoal}
                              onChange={(e) => setIsOwnGoal(e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-ivory/30 bg-midnight text-danger"
                            />
                            <span>هدف عكسي (يسجله لاعب من الفريق الخصم في مرماه ويُحتسب لهذا الفريق)</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Score Modal */}
      {scoringMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gold/40 bg-midnight p-6 shadow-2xl">
            <h2 className="font-heading text-lg font-bold text-gold">تسجيل نتيجة المباراة</h2>
            <p className="mt-1 text-xs text-ivory/70">
              {scoringMatch.home_team?.saint?.name_ar ?? 'الفريق الأول'} ضد{' '}
              {scoringMatch.away_team?.saint?.name_ar ?? 'الفريق الثاني'}
            </p>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <label className="mb-1 block text-xs font-semibold text-ivory">
                    {scoringMatch.home_team?.saint?.name_ar ?? 'الفريق الأول'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="field !min-h-12 w-20 text-center font-heading text-2xl text-gold"
                    value={homeScoreInput}
                    onChange={(e) => setHomeScoreInput(Number(e.target.value))}
                  />
                </div>
                <span className="font-heading text-xl text-ivory/50">:</span>
                <div className="text-center">
                  <label className="mb-1 block text-xs font-semibold text-ivory">
                    {scoringMatch.away_team?.saint?.name_ar ?? 'الفريق الثاني'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="field !min-h-12 w-20 text-center font-heading text-2xl text-gold"
                    value={awayScoreInput}
                    onChange={(e) => setAwayScoreInput(Number(e.target.value))}
                  />
                </div>
              </div>

              {scoringMatch.stage !== 'group' && homeScoreInput === awayScoreInput && (
                <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3">
                  <label className="mb-1 block text-xs font-semibold text-yellow-300">
                    طريقة حسم التعادل (مطلوبة في الأدوار الإقصائية):
                  </label>
                  <select
                    className="field !min-h-8 text-xs"
                    value={decisionInput}
                    onChange={(e) => setDecisionInput(e.target.value as 'regular' | 'extra_time' | 'penalties')}
                  >
                    <option value="penalties">ركلات الترجيح</option>
                    <option value="extra_time">وقت إضافي</option>
                  </select>

                  {decisionInput === 'penalties' && (
                    <div className="mt-3 flex items-center justify-center gap-3">
                      <input
                        type="number"
                        min="0"
                        className="field !min-h-9 w-16 text-center text-sm"
                        placeholder="ر.ج"
                        value={homePensInput}
                        onChange={(e) => setHomePensInput(Number(e.target.value))}
                      />
                      <span className="text-xs text-ivory/60">ركلات الترجيح</span>
                      <input
                        type="number"
                        min="0"
                        className="field !min-h-9 w-16 text-center text-sm"
                        placeholder="ر.ج"
                        value={awayPensInput}
                        onChange={(e) => setAwayPensInput(Number(e.target.value))}
                      />
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-ivory">
                <input
                  type="checkbox"
                  checked={markComplete}
                  onChange={(e) => setMarkComplete(e.target.checked)}
                  className="h-4 w-4 rounded border-ivory/30 bg-midnight text-gold focus:ring-gold"
                />
                <span>اعتماد المباراة كمنتهية رسمياً (Completed)</span>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setScoringMatch(null)}
                className="btn-ghost !min-h-9 !px-3 text-xs"
                disabled={busy}
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveScore}
                className="btn-gold !min-h-9 !px-4 text-xs"
                disabled={busy}
              >
                {busy ? 'جارٍ الحفظ…' : 'حفظ النتيجة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gold/40 bg-midnight p-6 shadow-2xl">
            <h2 className="font-heading text-lg font-bold text-gold">تعديل موعد وحالة المباراة</h2>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="match-sched">
                  تاريخ ووقت المباراة (بتوقيت القاهرة):
                </label>
                <input
                  id="match-sched"
                  type="datetime-local"
                  className="field text-xs"
                  value={schedDateInput}
                  onChange={(e) => setSchedDateInput(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="match-stat">
                  حالة المباراة:
                </label>
                <select
                  id="match-stat"
                  className="field text-xs"
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value as MatchStatus)}
                >
                  <option value="scheduled">لم تبدأ (Scheduled)</option>
                  <option value="live">جارية الآن (Live)</option>
                  <option value="completed">انتهت (Completed)</option>
                  <option value="postponed">مؤجلة (Postponed)</option>
                  <option value="cancelled">ملغاة (Cancelled)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setScheduleMatch(null)}
                className="btn-ghost !min-h-9 !px-3 text-xs"
                disabled={busy}
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveSchedule}
                className="btn-gold !min-h-9 !px-4 text-xs"
                disabled={busy}
              >
                {busy ? 'جارٍ التحديث…' : 'حفظ التغييرات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Teams Modal (Knockout slots) */}
      {assignMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gold/40 bg-midnight p-6 shadow-2xl">
            <h2 className="font-heading text-lg font-bold text-gold">
              تعيين أطراف المباراة ({STAGE_LABEL[assignMatch.stage]}){assignMatch.bracket_order != null ? ` — #${num(assignMatch.bracket_order)}` : ''}
            </h2>
            <p className="mt-1 text-xs text-ivory/70">
              اختر الفرق المتأهلة لهذه المباراة من الفرق المعتمدة.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="assign-home">
                  الفريق الأول (Home):
                </label>
                <select
                  id="assign-home"
                  className="field text-xs"
                  value={assignHomeId}
                  onChange={(e) => setAssignHomeId(e.target.value)}
                >
                  <option value="">-- يُحدَّد لاحقاً --</option>
                  {(approvedTeams ?? []).map((t) => {
                    const saint = Array.isArray(t.saint) ? t.saint[0] : t.saint;
                    return (
                      <option key={t.id} value={t.id}>
                        {saint?.name_ar ?? `فريق #${t.team_number}`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="assign-away">
                  الفريق الثاني (Away):
                </label>
                <select
                  id="assign-away"
                  className="field text-xs"
                  value={assignAwayId}
                  onChange={(e) => setAssignAwayId(e.target.value)}
                >
                  <option value="">-- يُحدَّد لاحقاً --</option>
                  {(approvedTeams ?? []).map((t) => {
                    const saint = Array.isArray(t.saint) ? t.saint[0] : t.saint;
                    return (
                      <option key={t.id} value={t.id}>
                        {saint?.name_ar ?? `فريق #${t.team_number}`}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setAssignMatch(null)}
                className="btn-ghost !min-h-9 !px-3 text-xs"
                disabled={busy}
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveAssign}
                className="btn-gold !min-h-9 !px-4 text-xs"
                disabled={busy}
              >
                {busy ? 'جارٍ التعيين…' : 'حفظ التعيين'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
