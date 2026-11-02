import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { CrossMark } from '../ui/CrossMark';
import { DavidEmblem } from '../art/DavidEmblem';
import { Divider } from '../art/Ornament';
import { BRAND, BRAND_SHORT, SEASON, TAGLINE } from '../../lib/brand';

export const NAV = [
  { to: '/', label: 'الرئيسية' }, { to: '/register', label: 'تسجيل فريق' }, { to: '/teams', label: 'الفرق المشاركة' },
  { to: '/groups', label: 'المجموعات' }, { to: '/knockout', label: 'الأدوار الإقصائية' }, { to: '/sunday', label: 'مباريات الأحد' }, { to: '/scorers', label: 'الهدافون' },
];
const link = ({ isActive }: { isActive: boolean }) => `rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-gold/15 text-gold' : 'text-ivory/80 hover:text-gold'}`;

export function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-midnight">تخطَّ إلى المحتوى</a>
      <header className="sticky top-0 z-30 border-b border-gold/15 bg-midnight/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 font-heading font-bold text-gold">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/60 bg-emerald"><CrossMark className="h-5 w-5" /></span>
            <span className="truncate text-sm sm:text-base"><span className="hidden sm:inline">{BRAND}</span><span className="sm:hidden">{BRAND_SHORT}</span> <bdi dir="ltr" className="text-ivory/80">{SEASON}</bdi></span>
          </Link>
          <nav aria-label="التنقل الرئيسي" className="hidden gap-1 xl:flex">{NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/'} className={link}>{n.label}</NavLink>)}</nav>
          <button className="btn-ghost !px-3 xl:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        </div>
        {open && <nav id="mobile-nav" aria-label="التنقل الرئيسي" className="flex animate-rise flex-col gap-1 border-t border-ivory/10 p-3 xl:hidden">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/'} className={(s) => link(s) + ' !py-3 text-base'}>{n.label}</NavLink>)}</nav>}
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <footer className="pattern-cross border-t border-gold/20 bg-emerald/40 py-10 text-center text-sm text-ivory/70">
        <DavidEmblem className="mx-auto mb-3 w-24" /><p className="font-heading text-base text-ivory">{BRAND} <bdi dir="ltr">{SEASON}</bdi></p>
        <Divider className="my-3" /><p>{TAGLINE}</p></footer>
    </div>);
}
