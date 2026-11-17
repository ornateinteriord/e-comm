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
  Person as ProfileIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useSellerAuthStore } from '../store/auth.store';
import SellerPendingActivationView from '../components/auth/SellerPendingActivationView';

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
  { text: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { text: 'Category Products', path: '/products', icon: <ProductsIcon /> },
  { text: 'Customer Orders', path: '/orders', icon: <OrdersIcon /> },
  { text: 'Seller Profile & Map', path: '/profile', icon: <ProfileIcon /> },
];

export default function SellerLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { seller, clearAuth } = useSellerAuthStore();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  // If seller is not yet activated by admin, display the pending review view
  if (seller && (seller.status !== 'active' || !seller.isActive)) {
    return <SellerPendingActivationView />;
  }

  const effectiveId = seller?.sellerId || (seller as any)?.storeId || '';

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0F172A', color: '#F8FAFC' }}>
      {/* Brand Header */}
      <Toolbar sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box
          component="img"
          src="/logo-dark.svg"
          alt="E-Shopy"
          sx={{ height: 34, width: 'auto', maxWidth: 160, objectFit: 'contain' }}
        />
        {isMobile && (
          <IconButton onClick={() => setMobileDrawerOpen(false)} sx={{ color: '#CBD5E1' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Toolbar>

      {/* Seller Identity Card in Sidebar */}
      <Box sx={{ px: 2, py: 1.5, mx: 1.5, my: 1, borderRadius: 2, bgcolor: '#1E293B', border: '1px solid #334155' }}>
        <Typography variant="caption" sx={{ color: '#CBD5E1', fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.05em', display: 'block' }}>
          PARTNER SELLER
        </Typography>
        <Typography noWrap variant="subtitle2" sx={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.92rem' }}>
          {seller?.name || 'My Seller Account'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
          <Chip
            label={seller?.categoryName || 'General'}
            size="small"
            sx={{ bgcolor: '#FF7900', color: '#FFFFFF', fontWeight: 700, fontSize: '0.68rem', height: 20 }}
          />
          <Typography variant="caption" sx={{ color: '#CBD5E1', fontWeight: 600, fontSize: '0.72rem' }}>
            {effectiveId}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: '#1E293B' }} />

      {/* Navigation Links */}
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
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1.5, sm: 3 } }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0, flex: 1, mr: 1 }}>
            {isMobile && (
              <IconButton edge="start" onClick={() => setMobileDrawerOpen(true)} sx={{ color: '#172B30', p: 1 }}>
                <MenuIcon />
              </IconButton>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap variant="subtitle1" sx={{ fontWeight: 800, color: '#172B30', fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                {seller?.name || 'Partner Seller Portal'}
              </Typography>
              <Typography noWrap variant="caption" sx={{ color: '#64748B', display: { xs: 'none', sm: 'block' } }}>
                Assigned Category: <strong>{seller?.categoryName || 'General'}</strong>
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
            <Chip
              label="Live Seller"
              size="small"
              sx={{
                bgcolor: '#ECFDF5',
                color: '#047857',
                fontWeight: 700,
                fontSize: '0.72rem',
                height: 24,
                display: { xs: 'none', sm: 'inline-flex' },
              }}
            />
            <Avatar sx={{ bgcolor: '#FF7900', width: 34, height: 34, fontWeight: 700, fontSize: '0.85rem' }}>
              {(seller?.ownerName || seller?.name || 'S').charAt(0).toUpperCase()}
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

