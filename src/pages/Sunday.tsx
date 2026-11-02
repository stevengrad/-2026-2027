import { MatchCard } from '../components/matches/MatchCard';
import { Empty, ErrorNote, Skeleton } from '../components/ui/States';
import { usePublicMatches } from '../hooks/useTournament';
import { dayKey, dayLabel } from '../lib/format';
import type { PublicMatch } from '../lib/types';

function Days({ list }: { list: PublicMatch[] }) {
  const keys = [...new Set(list.map((m) => dayKey(m.scheduled_at!)))];
  return <div className="space-y-6">{keys.map((k) => { const ms = list.filter((m) => dayKey(m.scheduled_at!) === k);
    return (<section key={k}><h3 className="mb-3 flex items-center gap-2 text-gold"><span className="h-px flex-1 bg-gold/20" /><span>{dayLabel(ms[0].scheduled_at!)}</span><span className="h-px flex-1 bg-gold/20" /></h3>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{ms.map((m) => <MatchCard key={m.id} m={m} />)}</div></section>); })}</div>;
}

export default function Sunday() {
  const { data, isLoading, isError } = usePublicMatches();
  if (isLoading) return <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>;
  if (isError) return <ErrorNote />;
  const sundays = (data ?? []).filter((m) => m.is_sunday_cairo && m.scheduled_at);   // Africa/Cairo, computed in the database view
  const upcoming = sundays.filter((m) => m.status !== 'completed'), finished = sundays.filter((m) => m.status === 'completed').reverse();
  if (!sundays.length) return <Empty>لا توجد مباريات معلنة حالياً.</Empty>;
  return (<div className="space-y-10">
    <div><h2 className="h-section mb-4">المباريات القادمة</h2>{upcoming.length ? <Days list={upcoming} /> : <Empty>لا توجد مباريات قادمة.</Empty>}</div>
    <div><h2 className="h-section mb-4">المباريات المنتهية</h2>{finished.length ? <Days list={finished} /> : <Empty>لا توجد نتائج بعد.</Empty>}</div></div>);
}
