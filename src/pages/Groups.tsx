import { SaintAvatar } from '../components/ui/SaintAvatar';
import { Empty, ErrorNote, Skeleton } from '../components/ui/States';
import { useStandings } from '../hooks/useTournament';
import { num } from '../lib/format';
import type { Standing } from '../lib/types';

const QUALIFY = 2; // default: top two per group (admin-configurable on the knockout step)
const COLS: [keyof Standing, string, string][] = [['played', 'لعب', 'المباريات'], ['won', 'فاز', 'فوز'], ['drawn', 'تعادل', 'تعادل'], ['lost', 'خسر', 'خسارة'], ['gf', 'له', 'أهداف له'], ['ga', 'عليه', 'أهداف عليه'], ['gd', 'فارق', 'فارق الأهداف']];

export default function Groups() {
  const { data, isLoading, isError } = useStandings();
  if (isLoading) return <div className="grid gap-6 lg:grid-cols-2">{[1, 2].map((i) => <Skeleton key={i} className="h-64" />)}</div>;
  if (isError) return <ErrorNote />;
  if (!data?.length) return <Empty>لم يتم الإعلان عن المجموعات بعد.</Empty>;
  const groups = [...new Set(data.map((r) => r.group_id))].map((id) => data.filter((r) => r.group_id === id).sort((a, b) => a.position - b.position || b.pts - a.pts));
  return (<div className="grid gap-6 lg:grid-cols-2">{groups.map((rows) => (
    <section key={rows[0].group_id} className="panel overflow-hidden" aria-labelledby={`g-${rows[0].group_id}`}>
      <h2 id={`g-${rows[0].group_id}`} className="flex items-center justify-between border-b border-gold/20 bg-emerald px-4 py-3 text-lg font-bold"><span>المجموعة {rows[0].group_name}</span><span className="text-xs font-normal text-ivory/70">يتأهل الأوائل</span></h2>
      <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-center text-sm">
        <caption className="sr-only">ترتيب المجموعة {rows[0].group_name}</caption>
        <thead className="text-xs text-ivory/70"><tr><th scope="col" className="w-10 p-2">#</th><th scope="col" className="p-2 text-start">الفريق</th>
          {COLS.map(([k, s, full]) => <th key={k} scope="col" className="p-2"><abbr title={full} className="no-underline">{s}</abbr></th>)}<th scope="col" className="p-2 text-gold">نقاط</th></tr></thead>
        <tbody>{rows.map((r) => { const q = r.position <= QUALIFY; return (
          <tr key={r.team_id} className={`border-t border-ivory/10 ${q ? 'bg-gold/[.07]' : ''}`}>
            <td className="p-2"><span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${q ? 'bg-gold text-midnight' : 'bg-ivory/10'}`}>{num(r.position)}</span></td>
            <td className="p-2 text-start"><div className="flex items-center gap-2"><SaintAvatar name={r.saint_name_ar} path={r.portrait_path} className="h-9 w-7" /><span className="font-heading">{r.saint_name_ar}</span></div></td>
            {COLS.map(([k]) => <td key={k} className="num p-2">{num(r[k] as number)}</td>)}
            <td className="num p-2 font-heading text-base text-gold">{num(r.pts)}</td></tr>); })}</tbody></table></div>
      <p className="border-t border-ivory/10 px-4 py-2 text-xs text-ivory/60">الترتيب: النقاط ثم فارق الأهداف ثم الأهداف المسجَّلة. المراكز المظلَّلة تتأهل للأدوار الإقصائية.</p>
    </section>))}</div>);
}
