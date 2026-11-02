/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { emerald: { DEFAULT: '#102D25', 700: '#18423A', 600: '#1F5448' }, midnight: '#101820', gold: { DEFAULT: '#C6A568', soft: '#E3D3A8', deep: '#9C7F45' },
      ivory: '#F3EFE5', muted: '#718477', success: '#27845C', danger: '#B83F45' },
    fontFamily: { heading: ['Alexandria', 'sans-serif'], body: ['"IBM Plex Sans Arabic"', 'sans-serif'] },
    keyframes: {
      rise: { from: { opacity: 0, transform: 'translateY(14px)' }, to: { opacity: 1, transform: 'none' } },
      sway: { '0%,100%': { transform: 'rotate(-1.4deg)' }, '50%': { transform: 'rotate(1.4deg)' } },
      bounceBall: { '0%,100%': { transform: 'translateY(0) rotate(0)' }, '50%': { transform: 'translateY(-28px) rotate(180deg)' } },
      verseIn: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
      shine: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
    },
    animation: { rise: 'rise .6s ease-out both', sway: 'sway 9s ease-in-out infinite', ball: 'bounceBall 2.4s ease-in-out infinite', verse: 'verseIn .7s ease-out both', shine: 'shine 6s linear infinite' } } },
  plugins: [],
};
