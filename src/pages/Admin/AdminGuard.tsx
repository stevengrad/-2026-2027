import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { Skeleton } from '../../components/ui/States';
import { DavidEmblem } from '../../components/art/DavidEmblem';
import { adminPath } from '../../lib/adminRoute';

export default function AdminGuard() {
  const { user, isAdmin, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
        <DavidEmblem className="mb-4 w-20 animate-pulse" />
        <Skeleton className="h-8 w-48" />
        <p className="mt-4 text-sm text-ivory/60">جارٍ التحقق من صلاحيات الإدارة…</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to={adminPath('login')} replace />;
  }

  return <Outlet />;
}
