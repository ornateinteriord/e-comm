import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link as RouterLink } from 'react-router';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  Avatar,
  Button,
  IconButton,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Inventory2 as ProductsIcon,
  LocalShipping as OrdersIcon,
  Storefront as StorefrontIcon,
  Person as ProfileIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Place as PlaceIcon,
} from '@mui/icons-material';
import { useStoreAuthStore } from '../store/auth.store';
import StorePendingActivationView from '../components/auth/StorePendingActivationView';

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
  { text: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { text: 'Category Products', path: '/products', icon: <ProductsIcon /> },
  { text: 'Customer Orders', path: '/orders', icon: <OrdersIcon /> },
  { text: 'Store Profile & Map', path: '/profile', icon: <ProfileIcon /> },
];

export default function StoreLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { store, clearAuth } = useStoreAuthStore();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  // If store is not yet activated by admin, display the pending review view
  if (store && (store.status !== 'active' || !store.isActive)) {
    return <StorePendingActivationView />;
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0F172A', color: '#F8FAFC' }}>
      {/* Brand Header */}
      <Toolbar sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box
          component="img"
          src="/logo-dark.svg"
          alt="E-Shophy"
          sx={{ height: 34, width: 160, objectFit: 'contain' }}
        />
        {isMobile && (
          <IconButton onClick={() => setMobileDrawerOpen(false)} sx={{ color: '#CBD5E1' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Toolbar>

      {/* Store Identity Card in Sidebar */}
      <Box sx={{ px: 2, py: 1.5, mx: 1.5, my: 1, borderRadius: 2, bgcolor: '#1E293B', border: '1px solid #334155' }}>
        <Typography variant="caption" sx={{ color: '#CBD5E1', fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.05em', display: 'block' }}>
          PARTNER STORE
        </Typography>
        <Typography noWrap variant="subtitle2" sx={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.92rem' }}>
          {store?.name || 'My Store'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
          <Chip
            label={store?.categoryName || 'General'}
            size="small"
            sx={{ bgcolor: '#FF7900', color: '#FFFFFF', fontWeight: 700, fontSize: '0.68rem', height: 20 }}
          />
          <Typography variant="caption" sx={{ color: '#CBD5E1', fontWeight: 600, fontSize: '0.72rem' }}>
            {store?.storeId}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: '#1E293B' }} />

      {/* Navigation Links with High-Visibility Crisp Colors */}
      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isSelected = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.75 }}>
              <ListItemButton
                component={RouterLink}
                to={item.path}
                onClick={() => isMobile && setMobileDrawerOpen(false)}
                sx={{
                  borderRadius: '8px',
                  py: 1.25,
                  px: 2,
                  bgcolor: isSelected ? '#FF7900' : 'transparent',
                  background: isSelected ? 'linear-gradient(135deg, #FF7900 0%, #FF9E00 100%)' : 'transparent',
                  color: isSelected ? '#FFFFFF' : '#CBD5E1',
                  boxShadow: isSelected ? '0 4px 14px rgba(255, 121, 0, 0.45)' : 'none',
                  transition: 'all 0.15s ease-in-out',
                  '&:hover': {
                    bgcolor: isSelected ? '#E85D04' : 'rgba(255, 255, 255, 0.08)',
                    color: '#FFFFFF',
                    '& .MuiListItemIcon-root': { color: '#FFFFFF' },
                  },
                }}
              >
                <ListItemIcon sx={{ color: isSelected ? '#FFFFFF' : '#CBD5E1', minWidth: 38 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isSelected ? 700 : 600,
                    letterSpacing: '0.01em',
                    color: isSelected ? '#FFFFFF' : '#CBD5E1',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: '#1E293B' }} />

      {/* Logout Action */}
      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          onClick={handleLogout}
          startIcon={<LogoutIcon />}
          sx={{
            borderColor: '#475569',
            color: '#E2E8F0',
            fontWeight: 600,
            py: 1,
            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#FCA5A5', borderColor: '#EF4444' },
          }}
        >
          Sign Out
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      {/* Top Navbar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: '#FFFFFF',
          color: '#172B30',
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 } }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {isMobile && (
              <IconButton edge="start" onClick={() => setMobileDrawerOpen(true)} sx={{ color: '#172B30' }}>
                <MenuIcon />
              </IconButton>
            )}
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#172B30' }}>
                {store?.name || 'Partner Store Portal'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Assigned Category: <strong>{store?.categoryName || 'General'}</strong>
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip
              label="Live Store"
              size="small"
              sx={{ bgcolor: '#ECFDF5', color: '#047857', fontWeight: 700, fontSize: '0.75rem' }}
            />
            <Avatar sx={{ bgcolor: '#FF7900', width: 34, height: 34, fontWeight: 700, fontSize: '0.85rem' }}>
              {(store?.ownerName || store?.name || 'S').charAt(0).toUpperCase()}
            </Avatar>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawers */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {/* Mobile Drawer */}
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileDrawerOpen}
            onClose={() => setMobileDrawerOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none' },
            }}
          >
            {drawerContent}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: '1px solid #1E293B' },
            }}
            open
          >
            {drawerContent}
          </Drawer>
        )}
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: '64px',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
