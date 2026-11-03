import { useState } from 'react';

// Original, hand-built SVG night-stadium scene (no third-party artwork, free to use).
// If the owner adds a licensed/free photo at public/assets/stadium/hero.jpg it is blended on top automatically.
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const TOP = 470, BOT = 760;
const xl = (y: number) => lerp(380, -200, (y - TOP) / (BOT - TOP));
const xr = (y: number) => lerp(1060, 1640, (y - TOP) / (BOT - TOP));
const stripes = Array.from({ length: 9 }, (_, i) => {
  const y1 = TOP + (BOT - TOP) * Math.pow(i / 9, 1.7), y2 = TOP + (BOT - TOP) * Math.pow((i + 1) / 9, 1.7);
  return { i, d: `${xl(y1)},${y1} ${xr(y1)},${y1} ${xr(y2)},${y2} ${xl(y2)},${y2}` };
});
const towers = [{ x: 150, h: 150 }, { x: 470, h: 120 }, { x: 970, h: 120 }, { x: 1290, h: 150 }];

export function StadiumScene({ className = '' }: { className?: string }) {
  const [photo, setPhoto] = useState(true);
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <svg viewBox="0 0 1440 760" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#070C11" /><stop offset=".6" stopColor="#101820" /><stop offset="1" stopColor="#102D25" /></linearGradient>
          <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F3EFE5" stopOpacity=".5" /><stop offset=".7" stopColor="#F3EFE5" stopOpacity=".06" /><stop offset="1" stopColor="#F3EFE5" stopOpacity="0" /></linearGradient>
          <radialGradient id="haze" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#C6A568" stopOpacity=".28" /><stop offset="1" stopColor="#C6A568" stopOpacity="0" /></radialGradient>
          <linearGradient id="pitch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1B4A3F" /><stop offset="1" stopColor="#0F2E26" /></linearGradient>
          <pattern id="crowd" width="13" height="9" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="2.1" fill="#C6A568" fillOpacity=".5" /><circle cx="9.5" cy="6.5" r="2" fill="#F3EFE5" fillOpacity=".38" />
            <circle cx="9.5" cy="1.5" r="1.6" fill="#718477" fillOpacity=".6" /><circle cx="3" cy="8" r="1.6" fill="#B83F45" fillOpacity=".35" />
          </pattern>
          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#101820" stopOpacity="0" /><stop offset="1" stopColor="#101820" /></linearGradient>
        </defs>
        <rect width="1440" height="760" fill="url(#sky)" />
        <ellipse cx="720" cy="300" rx="720" ry="220" fill="url(#haze)" />

        {/* stands: back tier, side tiers, roof edge */}
        <polygon points="0,290 1440,290 1440,478 0,478" fill="#0B1218" />
        <polygon points="0,290 1440,290 1440,478 0,478" fill="url(#crowd)" opacity=".55" />
        <polygon points="0,200 330,300 380,478 0,520" fill="#0A1015" /><polygon points="0,200 330,300 380,478 0,520" fill="url(#crowd)" opacity=".4" />
        <polygon points="1440,200 1110,300 1060,478 1440,520" fill="#0A1015" /><polygon points="1440,200 1110,300 1060,478 1440,520" fill="url(#crowd)" opacity=".4" />
        <path d="M0 270 Q720 205 1440 270 L1440 296 Q720 232 0 296Z" fill="#17222B" /><path d="M0 296 Q720 232 1440 296" fill="none" stroke="#C6A568" strokeOpacity=".5" strokeWidth="2" />
        <rect x="0" y="470" width="1440" height="10" fill="#101820" />

        {/* pitch */}
        <polygon points={`380,${TOP} 1060,${TOP} 1640,${BOT} -200,${BOT}`} fill="url(#pitch)" />
        {stripes.filter((s) => s.i % 2 === 0).map((s) => <polygon key={s.i} points={s.d} fill="#fff" fillOpacity=".045" />)}
        <g fill="none" stroke="#F3EFE5" strokeOpacity=".5" strokeWidth="2">
          <polygon points={`380,${TOP} 1060,${TOP} 1640,${BOT} -200,${BOT}`} />
          <ellipse cx="720" cy="610" rx="200" ry="44" />
        </g>
        {/* subtle gold cross at the centre spot, laid flat on the pitch */}
        <g transform="translate(720 610) scale(1 .38)" fill="#C6A568" opacity=".9"><path d="M-9-46h18v30h30v18h-30v46h-18V2h-30v-18h30z" /></g>

        {/* floodlights */}
        {towers.map((t, k) => {
          const left = t.x < 720, bx = left ? t.x - 250 : t.x - 90, bw = 340;
          return (
            <g key={k}>
              <g className="origin-top animate-sway" style={{ transformOrigin: `${t.x}px ${t.h}px`, animationDelay: `${k * -2.2}s` }}>
                <polygon points={`${t.x - 22},${t.h} ${t.x + 22},${t.h} ${bx + bw},${BOT - 20} ${bx},${BOT - 20}`} fill="url(#beam)" opacity=".7" />
              </g>
              <rect x={t.x - 3} y={t.h} width="6" height={TOP - t.h + 20} fill="#1B2630" />
              <rect x={t.x - 34} y={t.h - 26} width="68" height="30" rx="4" fill="#1B2630" stroke="#C6A568" strokeOpacity=".5" />
              {Array.from({ length: 10 }, (_, i) => <circle key={i} cx={t.x - 27 + (i % 5) * 13.5} cy={t.h - 18 + Math.floor(i / 5) * 13} r="4" fill="#F7F1DF" />)}
              <circle cx={t.x} cy={t.h - 10} r="60" fill="#F3EFE5" opacity=".08" />
            </g>);
        })}
        <rect y="620" width="1440" height="140" fill="url(#fade)" />
      </svg>
      {photo && <img src={`${import.meta.env.BASE_URL}assets/stadium/hero.jpg`} alt="" onError={() => setPhoto(false)} className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-luminosity" />}
      {/* On narrow screens the wide SVG viewBox is cropped at both sides, which hides its outer floodlight towers.
          Add a compact, purpose-built pair of lights so the stadium illumination remains visible on phones. */}
      <div className="stadium-mobile-floodlights sm:hidden" aria-hidden="true">
        {(['left', 'right'] as const).map((side) => (
          <div key={side} className={`stadium-mobile-bank stadium-mobile-bank-${side}`}>
            <span className="stadium-mobile-beam" />
            <span className="stadium-mobile-lamp-grid">
              {Array.from({ length: 8 }, (_, i) => <i key={i} />)}
            </span>
          </div>
        ))}
      </div>
    </div>);
}
