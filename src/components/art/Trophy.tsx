export function Trophy({ className = 'h-48 w-auto' }: { className?: string }) {
  return (<svg viewBox="0 0 120 160" className={className} aria-hidden="true">
    <defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F3E4B8" /><stop offset=".5" stopColor="#C6A568" /><stop offset="1" stopColor="#8E713C" /></linearGradient>
      <radialGradient id="tglow" cx=".5" cy=".4" r=".6"><stop offset="0" stopColor="#C6A568" stopOpacity=".45" /><stop offset="1" stopColor="#C6A568" stopOpacity="0" /></radialGradient></defs>
    <ellipse cx="60" cy="70" rx="58" ry="66" fill="url(#tglow)" />
    <path d="M30 30H12c0 26 10 36 27 40M90 30h18c0 26-10 36-27 40" fill="none" stroke="url(#gold)" strokeWidth="6" strokeLinecap="round" />
    <path d="M28 16h64v40c0 24-14 40-32 42-18-2-32-18-32-42z" fill="url(#gold)" />
    <path d="M28 16h64" stroke="#F3E4B8" strokeWidth="3" />
    <path d="M40 24v32c0 14 6 24 14 30" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
    <path d="M56 34h8v10h10v8H64v16h-8V52H46v-8h10z" fill="#102D25" />
    <rect x="53" y="98" width="14" height="24" fill="url(#gold)" /><rect x="46" y="118" width="28" height="8" rx="3" fill="url(#gold)" />
    <path d="M36 128h48l6 22H30z" fill="url(#gold)" /><rect x="30" y="148" width="60" height="6" rx="2" fill="#8E713C" />
  </svg>);
}
