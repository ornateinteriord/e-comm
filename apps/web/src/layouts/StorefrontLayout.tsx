import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link as RouterLink } from 'react-router';
import {
  AppBar, Toolbar, IconButton, Typography, InputBase, Badge,
  Box, Drawer, List, ListItem, ListItemText, ListItemButton, ListItemIcon,
  BottomNavigation, BottomNavigationAction, Paper, useMediaQuery,
  useTheme, Menu, MenuItem, Divider, Avatar, Chip, Stack, Button,
} from '@mui/material';
import {
  Search as SearchIcon,
  ShoppingCart as CartIcon,
  FavoriteBorder as WishlistIcon,
  Home as HomeIcon,
  Category as CategoryIcon,
  Person as PersonIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  FmdGood as LocationIcon,
  AutoAwesome as SparklesIcon,
  ChevronRight as ChevronRightIcon,
  Inventory2 as OrdersIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useCartStore } from '../store/cart.store';
import { useAuthStore } from '../store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '../hooks/useDebounce';
import api from '../api/client';
import Footer from '../components/Footer.tsx';

export default function StorefrontLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const itemCount = useCartStore((s) => s.itemCount);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const debouncedSearch = useDebounce(searchValue, 250);

  const { data: suggestions } = useQuery({
    queryKey: ['search-suggestions', debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get(`/search/suggestions?q=${encodeURIComponent(debouncedSearch)}`);
      return data.data as Array<{ type: string; label: string; slug?: string }>;
    },
    enabled: debouncedSearch.length >= 2,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories-header'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data as Array<{ id: string; name: string; slug: string; description?: string }>;
    },
    staleTime: 1000 * 60 * 10,
  });

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchValue.trim()) {
        navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
        setSearchOpen(false);
        setSearchValue('');
      }
    },
    [searchValue, navigate],
  );

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    clearAuth();
    setAnchorEl(null);
    navigate('/');
  };

  const getBottomNavValue = () => {
    if (location.pathname === '/') return 0;
    if (location.pathname.startsWith('/categories')) return 1;
    if (location.pathname.startsWith('/search')) return 2;
    if (location.pathname.startsWith('/wishlist')) return 3;
    if (location.pathname.startsWith('/account') || location.pathname.startsWith('/login')) return 4;
    return 0;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* ---- Desktop Top Banner ---- */}
      {!isMobile && (
        <Box
          sx={{
            bgcolor: '#020617',
            color: '#94a3b8',
            py: 0.75,
            px: 4,
            fontSize: '0.8125rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #1e293b',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#e2e8f0' }}>
              <LocationIcon sx={{ fontSize: 15, color: '#60a5fa' }} />
              <span>Deliver to <strong>Mumbai 400021</strong> - Next Day Delivery Available</span>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span>Express Shipping on Orders Over ₹500</span>
            <Divider orientation="vertical" flexItem sx={{ borderColor: '#334155', my: 0.5 }} />
            <Box
              component={RouterLink}
              to="http://localhost:5174"
              target="_blank"
              sx={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600, '&:hover': { color: '#93c5fd' } }}
            >
              Merchant Admin
            </Box>
          </Box>
        </Box>
      )}

      {/* ---- Main Desktop Header ---- */}
      {!isMobile && (
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Toolbar sx={{ px: { xs: 2, md: 5 }, py: 1, gap: 3 }}>
            {/* Brand Logo */}
            <Typography
              component={RouterLink}
              to="/"
              variant="h5"
              sx={{
                color: 'white',
                textDecoration: 'none',
                fontWeight: 900,
                letterSpacing: '-0.04em',
                fontSize: '1.6rem',
                display: 'flex',
                alignItems: 'center',
                mr: 2,
              }}
            >
              ORNATE<Box component="span" sx={{ color: '#6366f1' }}>.</Box>
            </Typography>

            {/* Category Navigation Links */}
            <Box sx={{ display: 'flex', gap: 0.5, mr: 'auto' }}>
              {categories?.slice(0, 5).map((cat) => (
                <Typography
                  key={cat.id}
                  component={RouterLink}
                  to={`/categories/${cat.slug}`}
                  sx={{
                    color: location.pathname === `/categories/${cat.slug}` ? '#ffffff' : 'rgba(255,255,255,0.75)',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    px: 1.75,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: location.pathname === `/categories/${cat.slug}` ? 'rgba(255,255,255,0.1)' : 'transparent',
                    '&:hover': {
                      color: 'white',
                      bgcolor: 'rgba(255,255,255,0.08)',
                    },
                    transition: 'all 0.15s',
                  }}
                >
                  {cat.name}
                </Typography>
              ))}
            </Box>

            {/* Live Search Bar */}
            <Box sx={{ position: 'relative', width: 340 }}>
              <Box
                component="form"
                onSubmit={handleSearch}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: 3,
                  px: 2,
                  py: 0.8,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  '&:focus-within': {
                    bgcolor: 'rgba(255, 255, 255, 0.14)',
                    borderColor: '#818cf8',
                    boxShadow: '0 0 0 3px rgba(129, 140, 248, 0.2)',
                  },
                  transition: 'all 0.2s',
                }}
              >
                <SearchIcon sx={{ color: 'rgba(255,255,255,0.6)', mr: 1.5, fontSize: 20 }} />
                <InputBase
                  placeholder="Search flagship gear, watches, apparel…"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  fullWidth
                  sx={{
                    color: 'white',
                    fontSize: '0.875rem',
                    '& input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
                  }}
                />
              </Box>

              {/* Autocomplete Suggestions Dropdown */}
              {suggestions && suggestions.length > 0 && debouncedSearch.length >= 2 && (
                <Paper
                  elevation={6}
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    mt: 1,
                    p: 1,
                    bgcolor: '#1e293b',
                    color: 'white',
                    border: '1px solid #334155',
                    borderRadius: 2,
                    zIndex: 1300,
                  }}
                >
                  {suggestions.map((sug, i) => (
                    <Box
                      key={i}
                      onClick={() => {
                        navigate(sug.slug ? `/products/${sug.slug}` : `/search?q=${encodeURIComponent(sug.label)}`);
                        setSearchValue('');
                      }}
                      sx={{
                        px: 2,
                        py: 1,
                        borderRadius: 1,
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: '#818cf8' },
                      }}
                    >
                      <span>{sug.label}</span>
                      <Chip label={sug.type} size="small" sx={{ height: 18, fontSize: 10, bgcolor: '#334155', color: '#cbd5e1' }} />
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>

            {/* Quick Actions */}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <IconButton
                component={RouterLink}
                to="/wishlist"
                sx={{
                  color: 'white',
                  bgcolor: 'rgba(255,255,255,0.05)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                }}
              >
                <WishlistIcon fontSize="small" />
              </IconButton>

              <IconButton
                component={RouterLink}
                to="/cart"
                sx={{
                  color: 'white',
                  bgcolor: 'rgba(255,255,255,0.05)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                }}
              >
                <Badge
                  badgeContent={itemCount}
                  color="secondary"
                  sx={{
                    '& .MuiBadge-badge': {
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      height: 20,
                      minWidth: 20,
                      bgcolor: '#6366f1',
                    },
                  }}
                >
                  <CartIcon fontSize="small" />
                </Badge>
              </IconButton>

              {/* User Avatar Menu */}
              <IconButton
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{ ml: 0.5, p: 0.5 }}
              >
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: isAuthenticated ? '#4f46e5' : '#334155',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                  }}
                >
                  {user?.name?.[0]?.toUpperCase() ?? <PersonIcon fontSize="small" />}
                </Avatar>
              </IconButton>
            </Stack>
          </Toolbar>
        </AppBar>
      )}

      {/* ---- Mobile Header (App Style) ---- */}
      {isMobile && (
        <Box sx={{ position: 'sticky', top: 0, zIndex: 1200 }}>
          <AppBar
            position="static"
            elevation={0}
            sx={{
              bgcolor: '#0f172a',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <Toolbar sx={{ px: 2, minHeight: 56, display: 'flex', justifyContent: 'space-between' }}>
              <IconButton
                sx={{ color: 'white', p: 1 }}
                onClick={() => setDrawerOpen(true)}
              >
                <MenuIcon />
              </IconButton>

              <Typography
                component={RouterLink}
                to="/"
                variant="h6"
                sx={{
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  fontSize: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                ORNATE<Box component="span" sx={{ color: '#6366f1' }}>.</Box>
              </Typography>

              <Stack direction="row" spacing={1}>
                <IconButton
                  component={RouterLink}
                  to="/wishlist"
                  sx={{ color: 'white', p: 1 }}
                >
                  <WishlistIcon fontSize="small" />
                </IconButton>
                <IconButton
                  component={RouterLink}
                  to="/cart"
                  sx={{ color: 'white', p: 1 }}
                >
                  <Badge badgeContent={itemCount} color="secondary">
                    <CartIcon fontSize="small" />
                  </Badge>
                </IconButton>
              </Stack>
            </Toolbar>

            {/* Mobile Touch-friendly Search Bar */}
            <Box sx={{ px: 2, pb: 1.5 }}>
              <Box
                component="form"
                onSubmit={handleSearch}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 2.5,
                  px: 1.5,
                  py: 0.6,
                }}
              >
                <SearchIcon sx={{ color: 'rgba(255,255,255,0.6)', mr: 1, fontSize: 18 }} />
                <InputBase
                  placeholder="Search 12+ flagship products…"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  fullWidth
                  sx={{
                    color: 'white',
                    fontSize: '0.85rem',
                    '& input::placeholder': { color: 'rgba(255,255,255,0.6)' },
                  }}
                />
              </Box>
            </Box>
          </AppBar>
        </Box>
      )}

      {/* Mobile Drawer (Side sheet) */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 290,
            bgcolor: '#0f172a',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b' }}>
          <Typography variant="h6" fontWeight={900}>
            ORNATE<Box component="span" sx={{ color: '#6366f1' }}>.</Box>
          </Typography>
          <IconButton sx={{ color: '#94a3b8' }} onClick={() => setDrawerOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* User Card in Drawer */}
        <Box sx={{ p: 2.5, bgcolor: '#1e293b', borderBottom: '1px solid #334155' }}>
          {isAuthenticated ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: '#4f46e5', width: 44, height: 44, fontWeight: 700 }}>
                {user?.name?.[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="subtitle2" fontWeight={800}>{user?.name}</Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>{user?.email}</Typography>
              </Box>
            </Stack>
          ) : (
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Welcome to Ornate</Typography>
              <Button
                variant="contained"
                size="small"
                fullWidth
                component={RouterLink}
                to="/login"
                onClick={() => setDrawerOpen(false)}
                sx={{ bgcolor: '#2563eb', fontWeight: 700, borderRadius: 1, py: 1, '&:hover': { bgcolor: '#1d4ed8' } }}
              >
                Sign In / Register
              </Button>
            </Box>
          )}
        </Box>

        {/* Category Links */}
        <List sx={{ px: 1.5, py: 2 }}>
          <Typography variant="caption" sx={{ px: 2, color: '#64748b', fontWeight: 800, letterSpacing: '0.05em' }}>
            DEPARTMENTS
          </Typography>
          {categories?.map((cat) => (
            <ListItem key={cat.id} disablePadding sx={{ mt: 0.5 }}>
              <ListItemButton
                component={RouterLink}
                to={`/categories/${cat.slug}`}
                onClick={() => setDrawerOpen(false)}
                sx={{
                  borderRadius: 2,
                  py: 1,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                }}
              >
                <ListItemText
                  primary={cat.name}
                  primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }}
                />
                <ChevronRightIcon sx={{ color: '#64748b', fontSize: 18 }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Box sx={{ mt: 'auto', p: 2, borderTop: '1px solid #1e293b' }}>
          <Button
            component={RouterLink}
            to="http://localhost:5174"
            target="_blank"
            fullWidth
            variant="outlined"
            size="small"
            sx={{ borderColor: '#334155', color: '#94a3b8', borderRadius: 1, fontWeight: 600, py: 1 }}
          >
            Admin Management Console
          </Button>
        </Box>
      </Drawer>

      {/* Account Menu */}
      <Menu
        id="account-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 4,
          sx: {
            mt: 1.5,
            minWidth: 220,
            borderRadius: 3,
            p: 1,
            border: '1px solid #e2e8f0',
          },
        }}
      >
        {isAuthenticated ? [
          <Box key="header" sx={{ px: 2, py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={800}>{user?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
          </Box>,
          <Divider key="div1" sx={{ my: 1 }} />,
          <MenuItem key="orders" component={RouterLink} to="/orders" onClick={() => setAnchorEl(null)} sx={{ borderRadius: 1.5 }}>
            <OrdersIcon fontSize="small" sx={{ mr: 1.5, color: '#64748b' }} />
            My Orders
          </MenuItem>,
          <MenuItem key="wishlist" component={RouterLink} to="/wishlist" onClick={() => setAnchorEl(null)} sx={{ borderRadius: 1.5 }}>
            <WishlistIcon fontSize="small" sx={{ mr: 1.5, color: '#64748b' }} />
            My Wishlist
          </MenuItem>,
          <MenuItem key="account" component={RouterLink} to="/account" onClick={() => setAnchorEl(null)} sx={{ borderRadius: 1.5 }}>
            <PersonIcon fontSize="small" sx={{ mr: 1.5, color: '#64748b' }} />
            Saved Addresses & Profile
          </MenuItem>,
          <Divider key="div2" sx={{ my: 1 }} />,
          <MenuItem key="logout" onClick={handleLogout} sx={{ borderRadius: 1.5, color: 'error.main', fontWeight: 600 }}>
            <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} />
            Sign Out
          </MenuItem>,
        ] : [
          <MenuItem key="login" component={RouterLink} to="/login" onClick={() => setAnchorEl(null)} sx={{ borderRadius: 1.5, fontWeight: 700 }}>
            Sign In to Ornate
          </MenuItem>,
          <MenuItem key="register" component={RouterLink} to="/register" onClick={() => setAnchorEl(null)} sx={{ borderRadius: 1.5 }}>
            Create New Account
          </MenuItem>,
        ]}
      </Menu>

      {/* Main Page Outlet */}
      <Box component="main" sx={{ flex: 1, pb: isMobile ? '80px' : 0 }}>
        <Outlet />
      </Box>

      {/* Global Footer */}
      <Footer />

      {/* ---- Mobile Native Bottom App Bar (Android / iOS feel) ---- */}
      {isMobile && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            bgcolor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(0, 0, 0, 0.08)',
            paddingBottom: 'env(safe-area-inset-bottom, 8px)',
          }}
        >
          <BottomNavigation
            value={getBottomNavValue()}
            showLabels
            sx={{
              height: 60,
              bgcolor: 'transparent',
              '& .MuiBottomNavigationAction-root': {
                color: '#64748b',
                minWidth: 'auto',
                py: 0.5,
                '&.Mui-selected': {
                  color: '#4f46e5',
                  fontWeight: 800,
                },
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  mt: 0.25,
                },
              },
            }}
          >
            <BottomNavigationAction
              label="Home"
              icon={<HomeIcon />}
              component={RouterLink}
              to="/"
            />
            <BottomNavigationAction
              label="Categories"
              icon={<CategoryIcon />}
              onClick={() => setDrawerOpen(true)}
            />
            <BottomNavigationAction
              label="Search"
              icon={<SearchIcon />}
              component={RouterLink}
              to="/search"
            />
            <BottomNavigationAction
              label="Cart"
              icon={
                <Badge badgeContent={itemCount} color="secondary">
                  <CartIcon />
                </Badge>
              }
              component={RouterLink}
              to="/cart"
            />
            <BottomNavigationAction
              label={isAuthenticated ? 'Account' : 'Sign In'}
              icon={<PersonIcon />}
              component={RouterLink}
              to={isAuthenticated ? '/account' : '/login'}
            />
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
