import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link as RouterLink } from 'react-router';
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
  ListItem, ListItemButton, ListItemIcon, ListItemText, Chip,
  Avatar, Button, Container, IconButton, Stack, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Inventory2 as ProductsIcon,
  Category as CategoriesIcon,
  ShoppingCart as OrdersIcon,
  Warehouse as InventoryIcon,
  ReceiptLong as InvoicesIcon,
  People as CustomersIcon,
  LocalOffer as CouponsIcon,
  History as AuditIcon,
  Logout as LogoutIcon,
  Storefront as StorefrontIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAdminAuthStore } from '../store/auth.store';

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
  { text: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { text: 'Products & Pricing', path: '/products', icon: <ProductsIcon /> },
  { text: 'Categories', path: '/categories', icon: <CategoriesIcon /> },
  { text: 'Orders & Fulfillment', path: '/orders', icon: <OrdersIcon /> },
  { text: 'Live Inventory', path: '/inventory', icon: <InventoryIcon /> },
  { text: 'Tax Invoices', path: '/invoices', icon: <InvoicesIcon /> },
  { text: 'Customers', path: '/customers', icon: <CustomersIcon /> },
  { text: 'Coupons & Promos', path: '/coupons', icon: <CouponsIcon /> },
  { text: 'Audit Logs', path: '/audit-logs', icon: <AuditIcon /> },
];

export default function AdminLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearAuth } = useAdminAuthStore();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0f172a', color: '#f8fafc' }}>
      {/* Brand Header */}
      <Toolbar sx={{ px: 3, py: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            component="img"
            src="/logo-dark.svg"
            alt="E-Shophy"
            sx={{ height: 35, width: 180, objectFit: 'contain' }}
          />
        </Box>
        {isMobile && (
          <IconButton onClick={() => setMobileDrawerOpen(false)} sx={{ color: '#94a3b8' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Toolbar>

      <Divider sx={{ borderColor: '#1e293b' }} />

      {/* Nav List */}
      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isSelected = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={RouterLink}
                to={item.path}
                onClick={() => isMobile && setMobileDrawerOpen(false)}
                sx={{
                  borderRadius: '6px',
                  py: 1.25,
                  px: 2,
                  bgcolor: isSelected ? '#FF7900' : 'transparent',
                  color: isSelected ? '#ffffff' : '#94a3b8',
                  boxShadow: isSelected ? '0 4px 12px rgba(255, 121, 0, 0.35)' : 'none',
                  '&:hover': {
                    bgcolor: isSelected ? '#E85D04' : '#1e293b',
                    color: '#ffffff',
                  },
                  transition: 'all 0.15s ease',
                }}
              >
                <ListItemIcon sx={{ color: isSelected ? '#ffffff' : '#94a3b8', minWidth: 38 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isSelected ? 800 : 600,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: '#1e293b' }} />

      {/* Storefront Link & User footer */}
      <Box sx={{ p: 2 }}>
        <Button
          component={RouterLink}
          to="http://localhost:5173"
          target="_blank"
          startIcon={<StorefrontIcon />}
          fullWidth
          variant="outlined"
          size="small"
          sx={{
            borderColor: '#334155',
            color: '#cbd5e1',
            borderRadius: '6px',
            mb: 2,
            fontWeight: 700,
            textTransform: 'none',
            '&:hover': { borderColor: '#94a3b8', color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' },
          }}
        >
          View Live Storefront
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 1, bgcolor: '#1e293b', borderRadius: '6px' }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: '#FF7900', fontSize: '0.85rem', fontWeight: 800 }}>
            {user?.name?.[0]?.toUpperCase() || 'A'}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="caption" fontWeight={800} color="white" noWrap display="block">
              {user?.name || 'Admin'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 10 }} noWrap display="block">
              {user?.email || 'admin@ornate.dev'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleLogout} sx={{ color: '#ef4444' }} title="Sign Out">
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      {/* Desktop Permanent Drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: 'none',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile Slide-Out Drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: 'none',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid #e2e8f0',
            color: '#0f172a',
          }}
        >
          <Toolbar sx={{ px: { xs: 2, md: 4 }, display: 'flex', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {isMobile && (
                <IconButton onClick={() => setMobileDrawerOpen(true)} sx={{ color: '#0f172a' }}>
                  <MenuIcon />
                </IconButton>
              )}
              <Typography variant="subtitle1" fontWeight={800} sx={{ letterSpacing: '-0.02em', color: '#0f172a' }}>
                {NAV_ITEMS.find((n) => n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path))?.text || 'Console'}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip
                label="SUPER ADMIN"
                size="small"
                sx={{
                  bgcolor: '#f1f5f9',
                  color: '#334155',
                  fontWeight: 800,
                  fontSize: 11,
                  display: { xs: 'none', sm: 'inline-flex' },
                }}
              />
            </Stack>
          </Toolbar>
        </AppBar>

        {/* Content Body */}
        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3, md: 4 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
