import { NavLink, Outlet } from 'react-router-dom';
import { Goal, LayoutGrid, Medal, Swords, Users, type LucideIcon } from 'lucide-react';
import { VerseBanner } from '../../components/ui/VerseBanner';
import { DavidEmblem } from '../../components/art/DavidEmblem';
import { LeagueNewsTicker } from '../../components/dashboard/LeagueNewsTicker';
import { BRAND, SEASON } from '../../lib/brand';

const TABS: [string, string, LucideIcon][] = [['/teams', 'الفرق', Users], ['/groups', 'المجموعات', LayoutGrid], ['/knockout', 'الأدوار الإقصائية', Swords], ['/sunday', 'مباريات الأحد', Medal], ['/scorers', 'الهدافون', Goal]];

/** Shared frame for all public tournament views. Every tab is a real, deep-linkable route. */
export default function DashboardShell() {
  return (<div>
    <div className="pattern-cross border-b border-gold/15 bg-gradient-to-b from-emerald to-midnight">
      <div className="mx-auto max-w-6xl px-4 pb-0 pt-8">
        <div className="flex items-center gap-4">
          <DavidEmblem className="w-16 shrink-0 sm:w-20" />
          <div><h1 className="text-2xl font-extrabold sm:text-4xl">{BRAND} <bdi dir="ltr" className="text-gold">{SEASON}</bdi></h1>
            <p className="mt-1 text-ivory/70">لوحة البطولة</p></div></div>
        <div className="mt-5"><LeagueNewsTicker /></div>
        <div className="mt-5"><VerseBanner /></div>
        <nav aria-label="أقسام لوحة البطولة" className="-mb-px mt-6 flex gap-1 overflow-x-auto">
          {TABS.map(([to, label, Icon]) => <NavLink key={to} to={to} className={({ isActive }) => `flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm transition sm:text-base ${isActive ? 'border-gold font-semibold text-gold' : 'border-transparent text-ivory/75 hover:text-gold'}`}><Icon className="h-4 w-4" aria-hidden="true" />{label}</NavLink>)}
        </nav></div></div>
    <div className="mx-auto max-w-6xl px-4 py-8"><Outlet /></div>
  </div>);
}
