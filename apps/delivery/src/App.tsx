import React from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { deliveryTheme } from './styles/theme';
import { useDeliveryAuthStore } from './store/auth.store';

import DeliveryLayout from './layouts/DeliveryLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OrdersFeedPage from './pages/OrdersFeedPage';
import ActiveDeliveryPage from './pages/ActiveDeliveryPage';
import EarningsPage from './pages/EarningsPage';
import ProfilePage from './pages/ProfilePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useDeliveryAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function GuestRoute({ children }: { children?: React.ReactNode }) {
  const { isAuthenticated } = useDeliveryAuthStore();
  const location = useLocation();
  if (isAuthenticated) {
    const params = new URLSearchParams(location.search);
    return <Navigate to={params.get('redirect') || '/'} replace />;
  }
  return children ? <>{children}</> : <Outlet />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={deliveryTheme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            <Route element={<GuestRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DeliveryLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<OrdersFeedPage />} />
              <Route path="active" element={<ActiveDeliveryPage />} />
              <Route path="deliveries/:id" element={<ActiveDeliveryPage />} />
              <Route path="earnings" element={<EarningsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
