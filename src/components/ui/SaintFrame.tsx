import { useState } from 'react';
import { portraitUrl } from '../../lib/supabase';
import { CrossMark } from './CrossMark';

/** One consistent frame for every saint portrait. Artwork is never cropped or altered (object-contain). */
export function SaintFrame({ name, path, className = 'w-24' }: { name: string; path?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : portraitUrl(path);
  return (
    <div className={`${className} aspect-[3/4] shrink-0 rounded-xl border-2 border-gold/70 bg-emerald p-1 shadow-lg shadow-black/30`}>
      {src ? <img src={src} alt={`أيقونة ${name}`} loading="lazy" onError={() => setFailed(true)} className="h-full w-full rounded-lg bg-midnight object-contain" />
        : (<div role="img" aria-label={`${name} — لا توجد أيقونة معتمدة بعد`} className="pattern flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg bg-emerald p-2 text-center">
            <CrossMark className="h-1/4 w-1/4 text-gold" /><span className="font-heading text-xs leading-snug text-ivory">{name}</span></div>)}
    </div>);
}
