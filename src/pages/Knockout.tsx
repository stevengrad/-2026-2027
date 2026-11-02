import { BracketMatch } from '../components/standings/BracketMatch';
import { Empty, ErrorNote, Skeleton } from '../components/ui/States';
import { usePublicMatches } from '../hooks/useTournament';
import { STAGE_LABEL, type PublicMatch, type Stage } from '../lib/types';

const ROUNDS: Stage[] = ['round_of_64', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final'];

export default function Knockout() {
  const { data, isLoading, isError } = usePublicMatches();
  if (isLoading) return <Skeleton className="h-96" />;
  if (isError) return <ErrorNote />;
  const by = (s: Stage) => (data ?? []).filter((m) => m.stage === s);
  const rounds = ROUNDS.map((s) => ({ s, ms: by(s) })).filter((r) => r.ms.length);
  const third = by('third_place');
  if (!rounds.length && !third.length) return <Empty>لم يتم الإعلان عن الأدوار الإقصائية بعد.</Empty>;
  return (<div className="space-y-10">
    {/* Desktop: connected bracket. First round on the right (RTL), final on the left. */}
    <div className="hidden overflow-x-auto pb-4 md:block"><div className="flex min-w-max gap-10" role="group" aria-label="شجرة الأدوار الإقصائية">
      {rounds.map(({ s, ms }, ri) => {
        const last = ri === rounds.length - 1, pairs: PublicMatch[][] = [];
        if (!last) for (let i = 0; i < ms.length; i += 2) pairs.push(ms.slice(i, i + 2));
        return (<div key={s} className="flex w-60 flex-col"><h3 className="mb-4 text-center font-heading text-gold">{STAGE_LABEL[s]}</h3>
          <div className="flex flex-1 flex-col justify-around gap-4">
            {last ? ms.map((m) => <div key={m.id} className="relative"><BracketMatch m={m} /></div>)
              : pairs.map((p, k) => (<div key={k} className="relative flex flex-col gap-4">
                  {p.map((m) => <div key={m.id} className="relative"><BracketMatch m={m} /><span aria-hidden="true" className="absolute -left-5 top-1/2 h-px w-5 bg-gold/50" /></div>)}
                  {p.length === 2 && <span aria-hidden="true" className="absolute -left-5 bottom-12 top-12 w-px bg-gold/50" />}
                  <span aria-hidden="true" className="absolute -left-10 top-1/2 h-px w-5 bg-gold/50" /></div>))}
          </div></div>);
      })}</div></div>
    {/* Mobile: round-by-round list */}
    <div className="space-y-8 md:hidden">{rounds.map(({ s, ms }) => <section key={s}><h3 className="mb-3 font-heading text-gold">{STAGE_LABEL[s]}</h3><div className="space-y-3">{ms.map((m) => <BracketMatch key={m.id} m={m} />)}</div></section>)}</div>
    {third.length > 0 && <section className="mx-auto max-w-sm"><h3 className="mb-3 text-center font-heading text-gold">{STAGE_LABEL.third_place}</h3>{third.map((m) => <BracketMatch key={m.id} m={m} />)}</section>}
  </div>);
}
