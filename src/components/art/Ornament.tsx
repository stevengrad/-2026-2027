/** Flared cross with a small halo ring — replaces the old two-squares star. */
export function Ornament({ className = 'h-10 w-10' }: { className?: string }) {
  return (<svg viewBox="0 0 40 40" className={className} fill="currentColor" aria-hidden="true">
    <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M17.5 7h5v10.5H33v5H22.5V33h-5V22.5H7v-5h10.5z" /><circle cx="20" cy="20" r="2" fill="#102D25" /></svg>);
}
/** Section divider: line — cross — football — cross — line. */
export function Divider({ className = '' }: { className?: string }) {
  return (<div className={`flex items-center justify-center gap-3 text-gold ${className}`} aria-hidden="true">
    <span className="h-px w-16 bg-gradient-to-l from-gold/70 to-transparent" />
    <Ornament className="h-5 w-5" />
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10" /><path d="M12 7l4 3-1.5 5h-5L8 10z" fill="currentColor" stroke="none" /></svg>
    <Ornament className="h-5 w-5" />
    <span className="h-px w-16 bg-gradient-to-r from-gold/70 to-transparent" /></div>);
}
