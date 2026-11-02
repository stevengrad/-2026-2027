import { Link } from 'react-router-dom';
import { SaintFrame } from '../components/ui/SaintFrame';
import { Empty, ErrorNote, Skeleton } from '../components/ui/States';
import { usePublicTeams } from '../hooks/useTournament';
import { num } from '../lib/format';

export default function Teams() {
  const { data, isLoading, isError } = usePublicTeams();
  return (<div>
    {isLoading && <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72" />)}</div>}
    {isError && <ErrorNote />}
    {data && (data.length === 0 ? <Empty>لم يتم اعتماد أي فرق حتى الآن.</Empty> :
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{data.map((t) => (
        <article key={t.id} className="card group relative flex flex-col items-center gap-3 overflow-hidden text-center">
          <div className="pattern-cross pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
          <span className="absolute start-3 top-3 grid h-7 min-w-7 place-items-center rounded-full bg-gold px-1 text-xs font-bold text-midnight">{num(t.team_number)}</span>
          <SaintFrame name={t.saint_name_ar} path={t.portrait_path} className="relative w-28 transition duration-300 group-hover:scale-105" />
          <h2 className="relative font-heading text-base">{t.saint_name_ar}</h2>
          <p className="relative text-sm text-ivory/70">{num(t.players_count)} لاعبين</p>
          <Link to={`/teams/${t.id}`} className="btn-ghost relative mt-auto w-full !min-h-10 text-sm">تفاصيل الفريق</Link></article>))}</div>)}
  </div>);
}
