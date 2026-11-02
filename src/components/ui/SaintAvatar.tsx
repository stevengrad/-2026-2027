import { useState } from 'react';
import { portraitUrl } from '../../lib/supabase';
import { CrossMark } from './CrossMark';

/** Compact version of the saint frame for tables, match cards and bracket (same frame language, artwork never cropped). */
export function SaintAvatar({ name, path, className = 'h-12 w-10' }: { name: string; path?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : portraitUrl(path);
  return (<div className={`${className} shrink-0 rounded-lg border border-gold/70 bg-emerald p-0.5 shadow-md shadow-black/30`}>
    {src ? <img src={src} alt={`أيقونة ${name}`} loading="lazy" onError={() => setFailed(true)} className="h-full w-full rounded-md bg-midnight object-contain" />
      : <div role="img" aria-label={`${name} — لا توجد أيقونة معتمدة بعد`} className="pattern flex h-full w-full items-center justify-center rounded-md bg-emerald text-gold"><CrossMark className="h-1/2 w-1/2" /></div>}
  </div>);
}
