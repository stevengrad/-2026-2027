import { Link } from 'react-router-dom';
import { Award, Crown, Medal, Trophy } from 'lucide-react';
import { SaintAvatar } from '../ui/SaintAvatar';
import { num } from '../../lib/format';
import { getMatchPlacements, type FinalPlacement } from '../../lib/placements';
import type { PublicMatch } from '../../lib/types';

const PLACEMENT_STYLE: Record<FinalPlacement, { label: string; title: string; className: string; Icon: typeof Trophy }> = {
  winner: {
    label: 'WINNER', title: '1st place · Tournament champion',
    className: 'border-gold/70 bg-gold/20 text-gold shadow-[0_0_12px_rgba(198,165,104,.16)]', Icon: Crown,
  },
  second: {
    label: '2ND', title: '2nd place · Runner-up',
    className: 'border-slate-300/35 bg-slate-200/10 text-slate-200', Icon: Medal,
  },
  third: {
    label: '3RD', title: '3rd place',
    className: 'border-orange-300/40 bg-orange-300/10 text-orange-200', Icon: Award,
  },
  fourth: {
    label: '4TH', title: '4th place',
    className: 'border-ivory/20 bg-ivory/5 text-ivory/65', Icon: Award,
  },
};

function PlacementBadge({ placement }: { placement?: FinalPlacement | null }) {
  if (!placement) return null;
  const config = PLACEMENT_STYLE[placement];
  const Icon = config.Icon;
  return (
    <span
      aria-label={config.title}
      title={config.title}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-1 text-[8px] font-black leading-none tracking-wide ${config.className}`}
      dir="ltr"
    >
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}

function Row({ name, placeholder, portrait, score, pens, win, placement }: {
  name: string | null;
  placeholder?: string;
  portrait: string | null;
  score: number | null;
  pens: number | null;
  win: boolean;
  placement?: FinalPlacement | null;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-2 ${win ? 'bg-gold/15 font-semibold text-gold' : ''}`} style={{ height: '3rem' }}>
      {name ? <SaintAvatar name={name} path={portrait} className="h-8 w-6" /> : <span className="h-8 w-6 rounded-md border border-dashed border-ivory/25" />}
      <span className="min-w-0 flex-1 truncate text-sm">{name ?? placeholder ?? 'يُحدَّد لاحقاً'}</span>
      <PlacementBadge placement={placement} />
      <span className="num min-w-[1.1rem] text-end font-heading text-lg" dir="ltr">
        {score ?? '–'}{pens != null && <sup className="ms-0.5 text-[10px]">({num(pens)})</sup>}
      </span>
    </div>
  );
}

/** Fixed 6rem tall so bracket connectors line up exactly. */
export function BracketMatch({ m, homePlaceholder, awayPlaceholder }: {
  m: PublicMatch;
  homePlaceholder?: string;
  awayPlaceholder?: string;
}) {
  const done = m.status === 'completed';
  const placements = getMatchPlacements(m);
  return (
    <Link
      to={`/match/${m.id}`}
      className={`block h-24 w-full overflow-hidden rounded-xl border bg-emerald/80 transition hover:border-gold/60 ${placements.home === 'winner' || placements.away === 'winner' ? 'border-gold/60 shadow-[0_0_20px_rgba(198,165,104,.12)]' : 'border-ivory/15'}`}
    >
      <Row
        name={m.home_saint}
        placeholder={homePlaceholder}
        portrait={m.home_portrait}
        score={done ? m.home_score : null}
        pens={m.decision === 'penalties' ? m.home_pens : null}
        win={!!m.winner_team_id && m.winner_team_id === m.home_team_id}
        placement={placements.home}
      />
      <div className="h-px bg-ivory/10" />
      <Row
        name={m.away_saint}
        placeholder={awayPlaceholder}
        portrait={m.away_portrait}
        score={done ? m.away_score : null}
        pens={m.decision === 'penalties' ? m.away_pens : null}
        win={!!m.winner_team_id && m.winner_team_id === m.away_team_id}
        placement={placements.away}
      />
    </Link>
  );
}
