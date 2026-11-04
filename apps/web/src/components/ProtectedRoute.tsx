import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '../store/auth.store';

/**
 * Route protection wrapper for customer-only storefront pages.
 * Ensures the user is authenticated and has role === 'customer'.
 * If unauthenticated or non-customer, redirects to /login with redirect query param.
 */
export default function ProtectedRoute() {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user || user.role !== 'customer') {
    const targetUrl = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(targetUrl)}`} replace />;
  }

  return <Outlet />;
}

