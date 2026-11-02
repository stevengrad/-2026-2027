import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { DavidEmblem } from '../../components/art/DavidEmblem';
import { BRAND, SEASON } from '../../lib/brand';
import { adminPath } from '../../lib/adminRoute';

export default function AdminLogin() {
  const { user, isAdmin, isLoading, error: authError, login } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  if (!isLoading && user && isAdmin) {
    return <Navigate to={adminPath()} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setFormError('يرجى ملء جميع الحقول المطلوبة.');
      return;
    }
    setFormError('');
    setSubmitting(true);
    const res = await login(email, password);
    setSubmitting(false);
    if (res.success) {
      navigate(adminPath(), { replace: true });
    } else if (res.error) {
      setFormError(res.error);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center px-4 py-12">
      <div className="pattern-cross w-full max-w-md rounded-3xl border border-gold/30 bg-midnight/90 p-6 shadow-2xl shadow-black/60 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <DavidEmblem className="mb-3 w-24" />
          <div className="flex items-center gap-2 text-gold">
            <ShieldCheck className="h-6 w-6" />
            <h1 className="font-heading text-2xl font-bold">بوابة إدارة البطولة</h1>
          </div>
          <p className="mt-1 text-sm text-ivory/70">{BRAND} — <bdi dir="ltr">{SEASON}</bdi></p>
        </div>

        {(formError || authError) && (
          <div role="alert" className="mb-5 rounded-xl border border-danger/50 bg-danger/10 p-3 text-center text-sm text-danger">
            {formError || authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="mb-1 block text-sm font-semibold text-ivory/90" htmlFor="admin-email">
              البريد الإلكتروني للإدارة
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3 top-3 h-5 w-5 text-muted" aria-hidden="true" />
              <input
                id="admin-email"
                type="email"
                dir="ltr"
                className="field !ps-10"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-ivory/90" htmlFor="admin-pass">
              كلمة المرور
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3 top-3 h-5 w-5 text-muted" aria-hidden="true" />
              <input
                id="admin-pass"
                type="password"
                dir="ltr"
                className="field !ps-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-gold mt-2 w-full !text-base"
            disabled={submitting || isLoading}
          >
            {submitting ? 'جارٍ التحقق…' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="mt-6 border-t border-ivory/10 pt-4 text-center">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-gold hover:underline">
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            العودة للموقع العام
          </Link>
        </div>
      </div>
    </div>
  );
}
