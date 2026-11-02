import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { SPORT_VERSES } from '../../lib/brand';
import { Ornament } from '../art/Ornament';
import { DavidEmblem } from '../art/DavidEmblem';

/** Rotating sports verses. `feature` = large home section, `banner` = slim dashboard strip. */
export function VerseBanner({ variant = 'banner' }: { variant?: 'banner' | 'feature' }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => { if (paused) return; const id = setInterval(() => setI((x) => (x + 1) % SPORT_VERSES.length), 9000); return () => clearInterval(id); }, [paused]);
  const v = SPORT_VERSES[i];
  const feature = variant === 'feature';
  return (
    <figure onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      className={`relative overflow-hidden border border-gold/30 bg-gradient-to-l from-emerald via-emerald-700 to-emerald ${feature ? 'rounded-3xl px-6 py-12 text-center sm:py-16 sm:ps-64 sm:pe-16 sm:text-start' : 'rounded-2xl px-5 py-4'}`}>
      <div className="pattern-cross pointer-events-none absolute inset-0" aria-hidden="true" />
      {feature && <><Ornament className="absolute end-4 top-4 h-9 w-9 text-gold/50" /><Ornament className="absolute bottom-4 end-4 h-9 w-9 text-gold/50" /></>}
      {feature && <div className="pointer-events-none absolute inset-y-0 start-8 hidden items-center sm:flex" aria-hidden="true"><DavidEmblem className="w-44" /></div>}
      <div key={i} className={`relative animate-verse ${feature ? '' : 'flex items-start gap-3'}`}>
        {!feature && <BookOpen className="mt-1 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />}
        <div className={feature ? 'max-w-3xl' : ''}>
          <blockquote className={`font-heading leading-loose ${feature ? 'text-xl sm:text-3xl sm:leading-[2.4rem]' : 'text-sm sm:text-base'}`}>“{v.text}”</blockquote>
          <figcaption className={`mt-2 text-gold ${feature ? 'text-lg' : 'text-sm'}`}>— {v.reference}</figcaption>
        </div>
      </div>
      <div className={`relative mt-3 flex gap-1.5 ${feature ? 'justify-center sm:justify-start' : 'justify-end'}`} role="tablist" aria-label="اختيار الآية">
        {SPORT_VERSES.map((_, k) => <button key={k} role="tab" aria-selected={k === i} aria-label={`الآية ${k + 1}`} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-gold' : 'w-2 bg-ivory/30'}`} />)}
      </div>
    </figure>);
}
