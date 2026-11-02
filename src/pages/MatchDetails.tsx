import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Goal, Square } from 'lucide-react';
import { SaintFrame } from '../components/ui/SaintFrame';
import { Empty, ErrorNote, Skeleton } from '../components/ui/States';
import { useMatchEvents, usePublicMatches, useRoster } from '../hooks/useTournament';
import { dayLabel, num, timeLabel } from '../lib/format';
import { STAGE_LABEL, STATUS_LABEL, type MatchEvent } from '../lib/types';

function EventLine({ e }: { e: MatchEvent }) {
  const icon = e.event_type === 'goal' ? <Goal className="h-4 w-4 text-gold" aria-hidden="true" /> : <Square className={`h-4 w-4 ${e.event_type === 'red_card' ? 'fill-danger text-danger' : 'fill-yellow-400 text-yellow-400'}`} aria-hidden="true" />;
  const label = e.event_type === 'goal' ? (e.is_own_goal ? 'هدف عكسي' : 'هدف') : e.event_type === 'yellow_card' ? 'بطاقة صفراء' : 'بطاقة حمراء';
  return (<li className="flex items-center gap-2 text-sm">{icon}<span className="num w-10 text-ivory/70">{e.event_minute != null ? `${num(e.event_minute)}'` : ''}</span><span className="font-heading">{e.player_name ?? 'غير منسوب للاعب'}</span><span className="text-xs text-ivory/60">({label})</span></li>);
}
function Roster({ teamId, title }: { teamId: string | null; title: string }) {
  const { data } = useRoster(teamId);
  return (<div className="panel p-4"><h3 className="mb-2 text-gold">{title}</h3>{data?.length ? <ul className="space-y-1 text-sm">{data.map((p) => <li key={p.id}>{p.full_name_ar}</li>)}</ul> : <p className="text-sm text-ivory/60">لا يوجد لاعبون لعرضهم.</p>}</div>);
}

export default function MatchDetails() {
  const { id } = useParams();
  const { data, isLoading, isError } = usePublicMatches();
  const ev = useMatchEvents(id);
  const m = data?.find((x) => x.id === id);
  if (isLoading) return <div className="mx-auto max-w-4xl p-6"><Skeleton className="h-72" /></div>;
  if (isError) return <div className="mx-auto max-w-4xl p-6"><ErrorNote /></div>;
  if (!m) return <div className="mx-auto max-w-xl p-10"><Empty>لم يتم العثور على هذه المباراة.</Empty></div>;
  const done = m.status === 'completed' || m.status === 'live';
  const events = ev.data ?? [];
  return (<div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <Link to="/sunday" className="inline-flex items-center gap-1 text-gold hover:underline"><ArrowRight className="h-4 w-4" aria-hidden="true" />لوحة البطولة</Link>
    <section className="pattern-cross relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-b from-emerald to-midnight p-6 text-center sm:p-10">
      <p className="text-sm text-gold">{STAGE_LABEL[m.stage]} · {STATUS_LABEL[m.status]}</p>
      <div className="mt-5 flex items-center justify-center gap-4 sm:gap-10">
        <div className="flex flex-1 flex-col items-center gap-3"><SaintFrame name={m.home_saint ?? 'فريق'} path={m.home_portrait} className="w-24 sm:w-32" /><span className="font-heading">{m.home_saint ?? 'يُحدَّد لاحقاً'}</span></div>
        <div><div className="num font-heading text-5xl text-gold sm:text-7xl" dir="ltr">{done ? `${num(m.home_score ?? 0)} - ${num(m.away_score ?? 0)}` : 'ضد'}</div>
          {m.decision === 'penalties' && <div className="num mt-1 text-sm text-ivory/70" dir="ltr">ركلات الترجيح {num(m.home_pens ?? 0)} - {num(m.away_pens ?? 0)}</div>}
          {m.decision === 'extra_time' && <div className="mt-1 text-sm text-ivory/70">بعد وقت إضافي</div>}</div>
        <div className="flex flex-1 flex-col items-center gap-3"><SaintFrame name={m.away_saint ?? 'فريق'} path={m.away_portrait} className="w-24 sm:w-32" /><span className="font-heading">{m.away_saint ?? 'يُحدَّد لاحقاً'}</span></div></div>
      <p className="mt-6 text-ivory/80">{m.scheduled_at ? `${dayLabel(m.scheduled_at)} — ${timeLabel(m.scheduled_at)}` : 'الموعد لم يُحدَّد بعد'}</p>
    </section>
    {m.score_discrepancy && <p role="status" className="flex items-center gap-2 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm"><AlertTriangle className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />النتيجة المعلنة تختلف عن عدد الأهداف المسجَّلة، وتجري مراجعتها من الإدارة.</p>}
    <section><h2 className="h-section mb-3">أحداث المباراة</h2>{ev.isError ? <ErrorNote /> : events.length === 0 ? <Empty>لم تُسجَّل أحداث لهذه المباراة بعد.</Empty> :
      <div className="grid gap-4 sm:grid-cols-2">{[m.home_team_id, m.away_team_id].map((tid, k) => <ul key={k} className="panel space-y-2 p-4">{events.filter((e) => e.team_id === tid).map((e) => <EventLine key={e.id} e={e} />)}</ul>)}</div>}</section>
    <section><h2 className="h-section mb-3">تشكيلة الفريقين</h2><div className="grid gap-4 sm:grid-cols-2"><Roster teamId={m.home_team_id} title={m.home_saint ?? 'الفريق الأول'} /><Roster teamId={m.away_team_id} title={m.away_saint ?? 'الفريق الثاني'} /></div></section>
  </div>);
}
