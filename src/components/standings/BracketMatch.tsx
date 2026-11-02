import { Link } from 'react-router-dom';
import { SaintAvatar } from '../ui/SaintAvatar';
import { num } from '../../lib/format';
import type { PublicMatch } from '../../lib/types';

function Row({ name, placeholder, portrait, score, pens, win }: { name: string | null; placeholder?: string; portrait: string | null; score: number | null; pens: number | null; win: boolean }) {
  return (<div className={`flex items-center gap-2 px-2 ${win ? 'bg-gold/15 font-semibold text-gold' : ''}`} style={{ height: '3rem' }}>
    {name ? <SaintAvatar name={name} path={portrait} className="h-8 w-6" /> : <span className="h-8 w-6 rounded-md border border-dashed border-ivory/25" />}
    <span className="min-w-0 flex-1 truncate text-sm">{name ?? placeholder ?? 'يُحدَّد لاحقاً'}</span>
    <span className="num font-heading text-lg" dir="ltr">{score ?? '–'}{pens != null && <sup className="ms-0.5 text-[10px]">({num(pens)})</sup>}</span></div>);
}
/** Fixed 6rem tall so bracket connectors line up exactly. */
export function BracketMatch({ m, homePlaceholder, awayPlaceholder }: { m: PublicMatch; homePlaceholder?: string; awayPlaceholder?: string }) {
  const done = m.status === 'completed';
  return (<Link to={`/match/${m.id}`} className="block h-24 w-full overflow-hidden rounded-xl border border-ivory/15 bg-emerald/80 transition hover:border-gold/60">
    <Row name={m.home_saint} placeholder={homePlaceholder} portrait={m.home_portrait} score={done ? m.home_score : null} pens={m.decision === 'penalties' ? m.home_pens : null} win={!!m.winner_team_id && m.winner_team_id === m.home_team_id} />
    <div className="h-px bg-ivory/10" />
    <Row name={m.away_saint} placeholder={awayPlaceholder} portrait={m.away_portrait} score={done ? m.away_score : null} pens={m.decision === 'penalties' ? m.away_pens : null} win={!!m.winner_team_id && m.winner_team_id === m.away_team_id} />
  </Link>);
}
