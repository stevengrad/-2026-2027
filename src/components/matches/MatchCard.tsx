import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { SaintAvatar } from '../ui/SaintAvatar';
import { dayLabel, num, timeLabel } from '../../lib/format';
import { STAGE_LABEL, STATUS_LABEL, type PublicMatch } from '../../lib/types';

function Side({ name, portrait, win }: { name: string | null; portrait: string | null; win: boolean }) {
  return (<div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
    {name ? <SaintAvatar name={name} path={portrait} className="h-16 w-12" /> : <div className="h-16 w-12 rounded-lg border border-dashed border-ivory/25" />}
    <span className={`line-clamp-2 font-heading text-sm leading-snug ${win ? 'text-gold' : ''}`}>{name ?? 'يُحدَّد لاحقاً'}</span></div>);
}

export function MatchCard({ m }: { m: PublicMatch }) {
  const done = m.status === 'completed' || m.status === 'live';
  return (
    <Link to={`/match/${m.id}`} className="card group block !p-4" aria-label={`${m.home_saint ?? 'فريق'} ضد ${m.away_saint ?? 'فريق'}`}>
      <div className="mb-3 flex items-center justify-between text-xs text-ivory/70">
        <span>{STAGE_LABEL[m.stage]}</span>
        <span className={`rounded-full px-2 py-0.5 ${m.status === 'live' ? 'bg-danger/80 text-ivory' : 'bg-ivory/10'}`}>{STATUS_LABEL[m.status]}</span></div>
      <div className="flex items-center gap-2">
        <Side name={m.home_saint} portrait={m.home_portrait} win={!!m.winner_team_id && m.winner_team_id === m.home_team_id} />
        <div className="w-24 shrink-0 text-center">
          {done ? <div className="num font-heading text-3xl text-gold" dir="ltr">{num(m.home_score ?? 0)} - {num(m.away_score ?? 0)}</div>
            : <div className="font-heading text-lg text-gold">{m.scheduled_at ? timeLabel(m.scheduled_at) : '—'}</div>}
          {m.decision === 'penalties' && m.home_pens != null && <div className="num text-xs text-ivory/70" dir="ltr">ر.ج {num(m.home_pens)} - {num(m.away_pens ?? 0)}</div>}
        </div>
        <Side name={m.away_saint} portrait={m.away_portrait} win={!!m.winner_team_id && m.winner_team_id === m.away_team_id} />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-ivory/10 pt-2 text-xs text-ivory/70">
        <span>{m.scheduled_at ? `${dayLabel(m.scheduled_at)}` : 'الموعد لم يُحدَّد بعد'}</span>
        {m.score_discrepancy && <span className="flex items-center gap-1 text-gold"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />النتيجة قيد التدقيق</span>}
      </div>
    </Link>);
}
