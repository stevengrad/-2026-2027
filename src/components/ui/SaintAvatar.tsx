import { useState } from 'react';
import { portraitUrl } from '../../lib/supabase';
import { CrossMark } from './CrossMark';

/** Compact saint portrait. Circle + cover is used for the supplied square icon catalogue. */
export function SaintAvatar({ name, path, className = 'h-12 w-10', shape = 'rounded', fit = 'contain' }: {
  name: string; path?: string | null; className?: string; shape?: 'rounded' | 'circle'; fit?: 'contain' | 'cover';
}) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : portraitUrl(path);
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-lg';
  const objectFit = fit === 'cover' ? 'object-cover' : 'object-contain';
  return (<div className={`${className} ${radius} shrink-0 overflow-hidden border border-gold/70 bg-emerald p-0.5 shadow-md shadow-black/30`}>
    {src ? <img src={src} alt={`أيقونة ${name}`} loading="lazy" onError={() => setFailed(true)} className={`h-full w-full ${radius} bg-midnight ${objectFit}`} />
      : <div role="img" aria-label={`${name} — لا توجد أيقونة معتمدة بعد`} className={`pattern flex h-full w-full items-center justify-center ${radius} bg-emerald text-gold`}><CrossMark className="h-1/2 w-1/2" /></div>}
  </div>);
}
