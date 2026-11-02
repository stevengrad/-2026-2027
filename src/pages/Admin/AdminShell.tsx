import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  UserCheck,
  Users,
  LayoutGrid,
  Swords,
  Calendar,
  Cross,
  LogOut,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { DavidEmblem } from '../../components/art/DavidEmblem';
import { BRAND, SEASON } from '../../lib/brand';
import { adminPath } from '../../lib/adminRoute';

const ADMIN_TABS = [
  { to: adminPath('teams'), label: 'اعتماد الفرق', icon: CheckSquare },
  { to: adminPath('accepted-teams'), label: 'الفرق المقبولة', icon: UserCheck },
  { to: adminPath('auto-teams'), label: 'توليد الفرق', icon: Users },
  { to: adminPath('groups'), label: 'المجموعات والقرعة', icon: LayoutGrid },
  { to: adminPath('knockout'), label: 'الأدوار الإقصائية', icon: Swords },
  { to: adminPath('matches'), label: 'إدارة المباريات', icon: Calendar },
  { to: adminPath('saints'), label: 'إدارة القديسين', icon: Cross },
];

export default function AdminShell() {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate(adminPath('login'), { replace: true });
  };

  return (
    <div className="min-h-screen bg-midnight text-ivory">
      {/* Admin Top Banner */}
      <header className="border-b border-gold/20 bg-emerald/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <DavidEmblem className="w-10 sm:w-12" />
            <div>
              <div className="flex items-center gap-2 font-heading font-bold text-gold">
                <Shield className="h-4 w-4" />
                <span>لوحة إدارة {BRAND}</span>
                <span className="rounded bg-gold/15 px-1.5 py-0.5 text-xs text-gold" dir="ltr">{SEASON}</span>
              </div>
              <p className="text-xs text-ivory/60">الحساب: <span className="font-mono text-ivory/90">{user?.email}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost !min-h-9 !px-3 text-xs"
              title="عرض الموقع العام في تبويب جديد"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">الموقع العام</span>
            </Link>
            <button
              onClick={handleLogout}
              className="btn-ghost !min-h-9 !px-3 text-xs text-danger hover:border-danger hover:text-danger"
              title="تسجيل الخروج من لوحة الإدارة"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-7xl px-4">
          <nav aria-label="أقسام الإدارة" className="-mb-px flex gap-1 overflow-x-auto pb-1 pt-2 sm:gap-2">
            {ADMIN_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    `flex shrink-0 items-center gap-2 rounded-t-xl border-b-2 px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${
                      isActive
                        ? 'border-gold bg-gold/10 text-gold'
                        : 'border-transparent text-ivory/70 hover:border-gold/40 hover:text-ivory'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Admin Workspace */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
