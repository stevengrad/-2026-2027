export function Football({ className = 'h-16 w-16' }: { className?: string }) {
  const pent = [0, 1, 2, 3, 4].map((i) => { const a = (-90 + i * 72) * Math.PI / 180; return [50 + 14 * Math.cos(a), 50 + 14 * Math.sin(a), 50 + 34 * Math.cos(a), 50 + 34 * Math.sin(a)]; });
  return (<svg viewBox="0 0 100 100" className={className} aria-hidden="true">
    <defs><radialGradient id="ballg" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#D9D2BF" /></radialGradient></defs>
    <circle cx="50" cy="50" r="47" fill="url(#ballg)" stroke="#101820" strokeWidth="2.5" />
    <polygon points={pent.map((p) => `${p[0]},${p[1]}`).join(' ')} fill="#101820" />
    {pent.map((p, i) => <g key={i}><line x1={p[0]} y1={p[1]} x2={p[2]} y2={p[3]} stroke="#101820" strokeWidth="2.2" />
      <circle cx={50 + 44 * Math.cos((-90 + i * 72) * Math.PI / 180)} cy={50 + 44 * Math.sin((-90 + i * 72) * Math.PI / 180)} r="9" fill="#101820" /></g>)}
  </svg>);
}
