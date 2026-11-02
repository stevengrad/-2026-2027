import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '../components/layout/Layout';
import DashboardShell from '../pages/Dashboard/DashboardShell';
import Home from '../pages/Home';
import Register from '../pages/Register';
import Teams from '../pages/Teams';
import TeamDetails from '../pages/TeamDetails';
import Groups from '../pages/Groups';
import Knockout from '../pages/Knockout';
import Sunday from '../pages/Sunday';
import Scorers from '../pages/Scorers';
import MatchDetails from '../pages/MatchDetails';
import Soon from '../pages/Soon';
import PsalmPreservation from '../pages/PsalmPreservation';

// Admin Pages
import AdminLogin from '../pages/Admin/AdminLogin';
import AdminGuard from '../pages/Admin/AdminGuard';
import AdminShell from '../pages/Admin/AdminShell';
import AdminTeams from '../pages/Admin/AdminTeams';
import AdminAcceptedTeams from '../pages/Admin/AdminAcceptedTeams';
import AdminAutoTeams from '../pages/Admin/AdminAutoTeams';
import AdminGroups from '../pages/Admin/AdminGroups';
import AdminKnockout from '../pages/Admin/AdminKnockout';
import AdminMatches from '../pages/Admin/AdminMatches';
import AdminSaints from '../pages/Admin/AdminSaints';
import { ADMIN_SEGMENT, adminPath } from '../lib/adminRoute';

const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <HashRouter>
        <Routes>
          {/* Public Tournament Website */}
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="register" element={<Register />} />
            <Route path="psalm-preservation" element={<PsalmPreservation />} />
            <Route path="match/:id" element={<MatchDetails />} />
            <Route element={<DashboardShell />}>
              <Route path="teams" element={<Teams />} />
              <Route path="teams/:id" element={<TeamDetails />} />
              <Route path="groups" element={<Groups />} />
              <Route path="knockout" element={<Knockout />} />
              <Route path="sunday" element={<Sunday />} />
              <Route path="scorers" element={<Scorers />} />
            </Route>
            <Route path="*" element={<Soon title="الصفحة غير موجودة" />} />
          </Route>

          {/* Admin Authentication */}
          <Route path={`${ADMIN_SEGMENT}/login`} element={<AdminLogin />} />

          {/* Protected Admin Panel */}
          <Route path={ADMIN_SEGMENT} element={<AdminGuard />}>
            <Route element={<AdminShell />}>
              <Route index element={<Navigate to={adminPath('teams')} replace />} />
              <Route path="teams" element={<AdminTeams />} />
              <Route path="accepted-teams" element={<AdminAcceptedTeams />} />
              <Route path="auto-teams" element={<AdminAutoTeams />} />
              <Route path="groups" element={<AdminGroups />} />
              <Route path="knockout" element={<AdminKnockout />} />
              <Route path="matches" element={<AdminMatches />} />
              <Route path="saints" element={<AdminSaints />} />
            </Route>
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}
