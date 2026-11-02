import { Link } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { usePublicTeams } from '../../hooks/useTournament';
import { SaintAvatar } from '../ui/SaintAvatar';

/** Newly approved teams appear here automatically through the public-teams polling query. */
export function LeagueNewsTicker() {
  const teams = usePublicTeams().data ?? [];
  if (teams.length === 0) return null;
  const repeatedTeams = [...teams, ...teams];

  return <section aria-label="أخبار الدوري" className="overflow-hidden rounded-2xl border border-gold/25 bg-midnight/60 shadow-lg shadow-black/20">
    <div className="flex items-center gap-2 border-b border-gold/15 bg-gold/10 px-4 py-2 text-gold">
      <Newspaper className="h-4 w-4" aria-hidden="true" />
      <h2 className="font-heading text-sm font-bold">أخبار الدوري</h2>
      <span className="text-xs text-ivory/70">الفرق المعتمدة</span>
    </div>
    <div className="league-news-mask overflow-hidden py-2" dir="ltr">
      <div className="league-news-track flex w-max items-center gap-2 pe-2">
        {repeatedTeams.map((team, index) => <Link dir="rtl" to={`/teams/${team.id}`} key={`${index}-${team.id}`} className="group flex min-w-max items-center gap-2 rounded-full border border-ivory/10 bg-emerald/60 py-1.5 ps-1.5 pe-3 text-sm transition hover:border-gold/60 hover:bg-emerald">
          <SaintAvatar name={team.saint_name_ar} path={team.portrait_path} className="h-10 w-10 transition duration-300 group-hover:scale-110" shape="circle" fit="cover" />
          <span className="font-heading text-ivory">فريق {team.saint_name_ar}</span>
        </Link>)}
      </div>
    </div>
  </section>;
}
