import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '../store/auth.store';

/**
 * Route protection wrapper for guest-only pages (e.g. /login, /register).
 * If the user is already authenticated, redirects them away to home (or the redirect param)
 * so they cannot re-register or re-login while logged in.
 */
export default function GuestRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (isAuthenticated) {
    const params = new URLSearchParams(location.search);
    const redirectTo = params.get('redirect') || '/';
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}

