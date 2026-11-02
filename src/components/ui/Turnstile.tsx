import { useEffect, useRef } from 'react';

declare global { interface Window { turnstile?: { render: (el: HTMLElement, o: object) => string; remove: (id: string) => void } } }
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
export const turnstileConfigured = Boolean(siteKey);

function loadScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve();
    const existing = document.getElementById('cf-turnstile');
    const s = existing ?? Object.assign(document.createElement('script'), { id: 'cf-turnstile', async: true, src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit' });
    s.addEventListener('load', () => resolve()); s.addEventListener('error', () => reject());
    if (!existing) document.head.appendChild(s);
  });
}

/** Tokens are single-use: remount with a new `key` after every submission attempt. */
export function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | undefined, dead = false;
    if (!siteKey) return;
    loadScript().then(() => { if (!dead && ref.current) id = window.turnstile!.render(ref.current,
      { sitekey: siteKey, theme: 'dark', language: 'ar', callback: onToken, 'expired-callback': () => onToken(''), 'error-callback': () => onToken('') }); }).catch(() => onToken(''));
    return () => { dead = true; if (id) window.turnstile?.remove(id); };
  }, [onToken]);
  if (!siteKey) return <p role="alert" className="text-sm text-danger">التحقق الأمني غير مُهيّأ، لا يمكن إرسال الطلب حالياً.</p>;
  return <div ref={ref} className="flex min-h-[65px] justify-center" />;
}
