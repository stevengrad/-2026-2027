export function CrossMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (<svg viewBox="0 0 48 48" className={className} fill="currentColor" aria-hidden="true">
    <path d="M20 4h8v12h12v8H28v20h-8V24H8v-8h12z" /><rect x="14" y="8" width="20" height="3" rx="1.5" opacity=".55" /></svg>);
}
