import { Link } from 'react-router-dom';
import { SaintAvatar } from '../components/ui/SaintAvatar';
import { Empty, ErrorNote, Skeleton } from '../components/ui/States';
import { useScorers } from '../hooks/useTournament';
import { num } from '../lib/format';

const PODIUM = ['border-gold bg-gold/10 sm:order-2 sm:-mt-4', 'border-ivory/40 sm:order-1', 'border-gold-deep/70 sm:order-3'];

export default function Scorers() {
  const { data, isLoading, isError } = useScorers();
  if (isLoading) return <Skeleton className="h-72" />;
  if (isError) return <ErrorNote />;
  if (!data?.length) return <Empty>لم يتم تسجيل أهداف حتى الآن.</Empty>;
  const top = data.slice(0, 3), rest = data.slice(3);
  return (<div className="space-y-8">
    <div className="grid gap-4 sm:grid-cols-3">{top.map((s, i) => (
      <div key={s.player_id} className={`panel flex flex-col items-center gap-2 border-2 p-6 text-center ${PODIUM[i]}`}>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gold font-heading text-midnight">{num(s.rank)}</span>
        <SaintAvatar name={s.saint_name_ar} path={s.portrait_path} className="h-24 w-[4.5rem]" />
        <div className="font-heading text-lg">{s.full_name_ar}</div><Link to="/teams" className="text-sm text-ivory/70 hover:text-gold">{s.saint_name_ar}</Link>
        <div className="num font-heading text-4xl text-gold">{num(s.goals)}</div><div className="text-xs text-ivory/60">هدف</div></div>))}</div>
    {rest.length > 0 && <div className="panel overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><caption className="sr-only">ترتيب الهدافين</caption>
      <thead className="text-xs text-ivory/70"><tr><th scope="col" className="p-3 text-start">الترتيب</th><th scope="col" className="p-3 text-start">اللاعب</th><th scope="col" className="p-3 text-start">الفريق</th><th scope="col" className="p-3 text-gold">الأهداف</th></tr></thead>
      <tbody>{rest.map((s) => <tr key={s.player_id} className="border-t border-ivory/10"><td className="num p-3">{num(s.rank)}</td><td className="p-3 font-heading">{s.full_name_ar}</td>
        <td className="p-3"><span className="flex items-center gap-2"><SaintAvatar name={s.saint_name_ar} path={s.portrait_path} className="h-8 w-6" />{s.saint_name_ar}</span></td><td className="num p-3 text-center font-heading text-gold">{num(s.goals)}</td></tr>)}</tbody></table></div>}
    <p className="text-center text-xs text-ivory/60">لا تُحتسب الأهداف العكسية ضمن ترتيب الهدافين.</p></div>);
}
