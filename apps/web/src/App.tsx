import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router';
import { CircularProgress, Box } from '@mui/material';
import StorefrontLayout from './layouts/StorefrontLayout.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import ScrollToTop from './components/ScrollToTop.tsx';

// Lazy-loaded pages for code splitting
const HomePage = React.lazy(() => import('./pages/HomePage.tsx'));
const SearchPage = React.lazy(() => import('./pages/SearchPage.tsx'));
const CategoryPage = React.lazy(() => import('./pages/CategoryPage.tsx'));
const ProductDetailPage = React.lazy(() => import('./pages/ProductDetailPage.tsx'));
const CartPage = React.lazy(() => import('./pages/CartPage.tsx'));
const CheckoutPage = React.lazy(() => import('./pages/CheckoutPage.tsx'));
const OrdersPage = React.lazy(() => import('./pages/OrdersPage.tsx'));
const OrderDetailPage = React.lazy(() => import('./pages/OrderDetailPage.tsx'));
const WishlistPage = React.lazy(() => import('./pages/WishlistPage.tsx'));
const AccountPage = React.lazy(() => import('./pages/AccountPage.tsx'));
const LoginPage = React.lazy(() => import('./pages/LoginPage.tsx'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage.tsx'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage.tsx'));
const TermsPage = React.lazy(() => import('./pages/TermsPage.tsx'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage.tsx'));

function PageLoader() {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress />
    </Box>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<StorefrontLayout />}>
            <Route index element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="categories/:slug" element={<CategoryPage />} />
            <Route path="products/:slug" element={<ProductDetailPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="terms-and-conditions" element={<TermsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
