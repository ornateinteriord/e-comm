import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { sellerTheme } from './styles/theme';
import { useSellerAuthStore } from './store/auth.store';

import SellerLayout from './layouts/SellerLayout';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import ProfilePage from './pages/ProfilePage';
import RegisterSellerPage from './pages/RegisterSellerPage';
import LoginSellerPage from './pages/LoginSellerPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useSellerAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function GuestRoute({ children }: { children?: React.ReactNode }) {
  const { isAuthenticated } = useSellerAuthStore();
  const location = useLocation();

  if (isAuthenticated) {
    const params = new URLSearchParams(location.search);
    const redirectTo = params.get('redirect') || '/';
    return <Navigate to={redirectTo} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={sellerTheme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            {/* Guest-only Auth Routes: Logged-in sellers are redirected away */}
            <Route element={<GuestRoute />}>
              <Route path="/register" element={<RegisterSellerPage />} />
              <Route path="/login" element={<LoginSellerPage />} />
            </Route>

            {/* Protected Seller Portal Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <SellerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:orderNumber" element={<OrderDetailPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
