import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Box, CircularProgress } from '@mui/material';
import AdminLayout from './layouts/AdminLayout.tsx';
import { useAdminAuthStore } from './store/auth.store.ts';

const LoginPage = React.lazy(() => import('./pages/LoginPage.tsx'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage.tsx'));
const ProductsPage = React.lazy(() => import('./pages/ProductsPage.tsx'));
const CategoriesPage = React.lazy(() => import('./pages/CategoriesPage.tsx'));
const OrdersPage = React.lazy(() => import('./pages/OrdersPage.tsx'));
const InventoryPage = React.lazy(() => import('./pages/InventoryPage.tsx'));
const InvoicesPage = React.lazy(() => import('./pages/InvoicesPage.tsx'));
const CustomersPage = React.lazy(() => import('./pages/CustomersPage.tsx'));
const CouponsPage = React.lazy(() => import('./pages/CouponsPage.tsx'));
const AuditLogsPage = React.lazy(() => import('./pages/AuditLogsPage.tsx'));
const SystemHealthPage = React.lazy(() => import('./pages/SystemHealthPage.tsx'));

function PageLoader() {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress />
    </Box>
  );
}

function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { isAuthenticated } = useAdminAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Hidden Developer Diagnostic Route - accessible without login */}
        <Route path="/system-health" element={<SystemHealthPage />} />
        <Route path="/dev/health" element={<SystemHealthPage />} />

        <Route
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="coupons" element={<CouponsPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          {/* Also accessible inside admin shell if logged in */}
          <Route path="system-health" element={<SystemHealthPage />} />
          <Route path="dev/health" element={<SystemHealthPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
