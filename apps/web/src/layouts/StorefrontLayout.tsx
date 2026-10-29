import { useState, useCallback, type FormEvent } from 'react';
import { Outlet, useNavigate, useLocation, Link as RouterLink } from 'react-router';
import {
  AppBar, Toolbar, IconButton, Typography, InputBase, Badge,
  Box, Drawer, List, ListItem, ListItemText, ListItemButton,
  BottomNavigation, BottomNavigationAction, Paper, useMediaQuery,
  useTheme, Menu, MenuItem, Divider, Avatar, Chip, Stack, Button, Tooltip,
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
  ChevronRight as ChevronRightIcon,
  Inventory2 as OrdersIcon,
  Logout as LogoutIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
} from '@mui/icons-material';
import { useCartStore } from '../store/cart.store';
import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';
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
  const { mode, toggleTheme } = useThemeStore();
  const isLight = mode === 'light';

  const [searchValue, setSearchValue] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const debouncedSearch = useDebounce(searchValue, 250);

  const { data: apiSuggestions } = useQuery({
    queryKey: ['search-suggestions', debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get(`/search/suggestions?q=${encodeURIComponent(debouncedSearch)}`);
      return data.data as Array<{ type: string; label: string; slug?: string }>;
    },
    enabled: debouncedSearch.length >= 2,
  });

  const suggestions = apiSuggestions ?? [];

  const { data: apiCategories } = useQuery({
    queryKey: ['categories-header'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data as Array<{ id: string; name: string; slug: string; description?: string }>;
    },
    staleTime: 1000 * 60 * 10,
  });

  const categories = apiCategories ?? [];

  const handleSearch = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (searchValue.trim()) {
        navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
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
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      {/* ---- Desktop Top Banner ---- */}
      {!isMobile && (
        <Box
          sx={{
            bgcolor: isLight ? '#172B30' : '#0B0F19',
            color: '#FFFFFF',
            py: 0.8,
            px: 4,
            fontSize: '0.8125rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `1px solid ${isLight ? 'rgba(255,255,255,0.08)' : '#1E293B'}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#F3F4F6' }}>
              <LocationIcon sx={{ fontSize: 16, color: '#FF7900' }} />
              <span>Deliver to <strong>Mumbai 400021</strong> - Next Day Delivery Available</span>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, color: '#E5E7EB' }}>
            <span>Express Shipping on Orders Over ₹500</span>
          </Box>
        </Box>
      )}

      {/* ---- Main Desktop Header ---- */}
      {!isMobile && (
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(15, 23, 42, 0.98)',
            backdropFilter: 'blur(16px)',
            borderBottom: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.08)'}`,
            color: isLight ? '#172B30' : '#FFFFFF',
            width: '100%',
            maxWidth: '100vw',
          }}
        >
          {/* Row 1: Logo, Search & Actions */}
          <Toolbar sx={{ px: { xs: 2, md: 5 }, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Brand Logo */}
            <Box
              component={RouterLink}
              to="/"
              sx={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                mr: 3,
                flexShrink: 0,
                '&:hover img': {
                  transform: 'scale(1.04)',
                },
              }}
            >
              <Box
                component="img"
                src={isLight ? '/logo.svg' : '/logo-dark.svg'}
                alt="E-Shophy"
                sx={{
                  height: 40,
                  width: 'auto',
                  maxWidth: 160,
                  objectFit: 'contain',
                  transition: 'transform 0.2s ease',
                }}
              />
            </Box>

            {/* Live Search Bar */}
            <Box sx={{ position: 'relative', flex: 1, maxWidth: 640, mx: { md: 2, lg: 4 } }}>
              <Box
                component="form"
                onSubmit={handleSearch}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: isLight ? '#F5F6F7' : 'rgba(255, 255, 255, 0.08)',
                  borderRadius: 2.5,
                  px: 2,
                  py: 0.8,
                  border: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.12)'}`,
                  '&:focus-within': {
                    bgcolor: isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.14)',
                    borderColor: '#FF7900',
                    boxShadow: '0 0 0 3px rgba(255, 121, 0, 0.15)',
                  },
                  transition: 'all 0.2s',
                }}
              >
                <SearchIcon sx={{ color: isLight ? '#9CA3AF' : 'rgba(255,255,255,0.6)', mr: 1.5, fontSize: 20 }} />
                <InputBase
                  placeholder="Search flagship gear, watches, apparel…"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  fullWidth
                  sx={{
                    color: isLight ? '#172B30' : 'white',
                    fontSize: '0.875rem',
                    '& input::placeholder': { color: isLight ? '#9CA3AF' : 'rgba(255,255,255,0.5)', opacity: 1 },
                  }}
                />
              </Box>

              {/* Autocomplete Suggestions Dropdown */}
              {suggestions && suggestions.length > 0 && debouncedSearch.length >= 2 && (
                <Paper
                  elevation={8}
                  sx={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    zIndex: 1300,
                    bgcolor: isLight ? '#FFFFFF' : '#1e293b',
                    color: isLight ? '#172B30' : 'white',
                    borderRadius: '8px',
                    border: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255,255,255,0.1)'}`,
                    overflow: 'hidden',
                    p: 1,
                  }}
                >
                  {suggestions.slice(0, 5).map((sug, idx) => (
                    <Box
                      key={`${sug.type}-${sug.label}-${idx}`}
                      onClick={() => {
                        setSearchValue(sug.label);
                        navigate(`/search?q=${encodeURIComponent(sug.label)}`);
                      }}
                      sx={{
                        p: 1.5,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.875rem',
                        '&:hover': { bgcolor: isLight ? '#F5F6F7' : 'rgba(255,255,255,0.08)' },
                      }}
                    >
                      <span>{sug.label}</span>
                      <Chip label={sug.type} size="small" sx={{ height: 18, fontSize: 10, bgcolor: isLight ? '#E5E7EB' : '#334155', color: isLight ? '#374151' : '#cbd5e1' }} />
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>

            {/* Quick Actions */}
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
              {/* Theme Toggle Button */}
              <Tooltip title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}>
                <IconButton
                  onClick={toggleTheme}
                  sx={{
                    color: isLight ? '#374151' : '#F8FAFC',
                    bgcolor: isLight ? '#F5F6F7' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255,255,255,0.1)'}`,
                    '&:hover': {
                      bgcolor: isLight ? '#E5E7EB' : 'rgba(255,255,255,0.14)',
                      color: '#FF7900',
                    },
                    transition: 'all 0.2s',
                  }}
                >
                  {isLight ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" sx={{ color: '#FF7900' }} />}
                </IconButton>
              </Tooltip>

              <IconButton
                component={RouterLink}
                to="/wishlist"
                sx={{
                  color: isLight ? '#374151' : 'white',
                  bgcolor: isLight ? '#F5F6F7' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isLight ? '#E5E7EB' : 'transparent'}`,
                  '&:hover': { bgcolor: isLight ? '#E5E7EB' : 'rgba(255,255,255,0.12)', color: '#FF7900' },
                }}
              >
                <WishlistIcon fontSize="small" />
              </IconButton>

              <IconButton
                component={RouterLink}
                to="/cart"
                sx={{
                  color: isLight ? '#374151' : 'white',
                  bgcolor: isLight ? '#F5F6F7' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isLight ? '#E5E7EB' : 'transparent'}`,
                  '&:hover': { bgcolor: isLight ? '#E5E7EB' : 'rgba(255,255,255,0.12)', color: '#FF7900' },
                }}
              >
                <Badge
                  badgeContent={itemCount}
                  sx={{
                    '& .MuiBadge-badge': {
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      height: 20,
                      minWidth: 20,
                      bgcolor: '#FF7900',
                      color: 'white',
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
                    bgcolor: isAuthenticated ? '#FF7900' : isLight ? '#F5F6F7' : '#334155',
                    color: isAuthenticated ? '#FFFFFF' : isLight ? '#172B30' : '#FFFFFF',
                    border: `1px solid ${isLight ? '#E5E7EB' : 'transparent'}`,
                    fontSize: '0.9rem',
                    fontWeight: 700,
                  }}
                >
                  {isAuthenticated && user?.name?.[0] ? user.name[0].toUpperCase() : <PersonIcon fontSize="small" />}
                </Avatar>
              </IconButton>
            </Stack>
          </Toolbar>

          {/* Row 2: Category Navigation Strip */}
          <Box
            sx={{
              bgcolor: isLight ? 'rgba(248, 250, 252, 0.95)' : 'rgba(30, 41, 59, 0.95)',
              borderTop: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.08)'}`,
              px: { xs: 2, md: 5 },
              py: 0.75,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              overflowX: 'auto',
              '&::-webkit-scrollbar': { display: 'none' },
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            }}
          >
            <Typography
              component={RouterLink}
              to="/search"
              sx={{
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                flexShrink: 0,
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: location.pathname === '/search' ? '#FF7900' : isLight ? '#475569' : '#CBD5E1',
                textDecoration: 'none',
                px: 1.25,
                py: 0.5,
                borderRadius: '6px',
                bgcolor: location.pathname === '/search' ? (isLight ? 'rgba(255, 121, 0, 0.08)' : 'rgba(255, 121, 0, 0.15)') : 'transparent',
                '&:hover': { color: '#FF7900', bgcolor: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.06)' },
                transition: 'all 0.15s',
              }}
            >
              All Categories
            </Typography>

            <Divider orientation="vertical" flexItem sx={{ height: 16, my: 'auto', borderColor: isLight ? '#E2E8F0' : '#334155' }} />

            {categories?.map((cat) => (
              <Typography
                key={cat.id}
                component={RouterLink}
                to={`/categories/${cat.slug}`}
                sx={{
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: location.pathname === `/categories/${cat.slug}`
                    ? '#FF7900'
                    : isLight ? '#475569' : '#CBD5E1',
                  textDecoration: 'none',
                  px: 1.25,
                  py: 0.5,
                  borderRadius: '6px',
                  bgcolor: location.pathname === `/categories/${cat.slug}`
                    ? (isLight ? 'rgba(255, 121, 0, 0.08)' : 'rgba(255, 121, 0, 0.15)')
                    : 'transparent',
                  '&:hover': {
                    color: '#FF7900',
                    bgcolor: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.06)',
                  },
                  transition: 'all 0.15s',
                }}
              >
                {cat.name}
              </Typography>
            ))}
          </Box>
        </AppBar>
      )}

      {/* ---- Mobile Header (App Style) ---- */}
      {isMobile && (
        <Box sx={{ position: 'sticky', top: 0, zIndex: 1200 }}>
          <AppBar
            position="static"
            elevation={0}
            sx={{
              bgcolor: isLight ? '#FFFFFF' : '#0F172A',
              color: isLight ? '#172B30' : '#FFFFFF',
              borderBottom: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.08)'}`,
            }}
          >
            <Toolbar sx={{ px: 2, minHeight: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <IconButton
                sx={{ color: isLight ? '#172B30' : 'white', p: 1 }}
                onClick={() => setDrawerOpen(true)}
              >
                <MenuIcon />
              </IconButton>

              <Box
                component={RouterLink}
                to="/"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                }}
              >
                <Box
                  component="img"
                  src="/logo.svg"
                  alt="E-Shophy"
                  sx={{
                    height: 32,
                    width: 'auto',
                    maxWidth: 130,
                    objectFit: 'contain',
                  }}
                />
              </Box>

              <Stack direction="row" spacing={0.5} alignItems="center">
                <IconButton
                  onClick={toggleTheme}
                  size="small"
                  sx={{
                    color: isLight ? '#374151' : '#F8FAFC',
                    p: 1,
                  }}
                >
                  {isLight ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" sx={{ color: '#FF7900' }} />}
                </IconButton>

                <IconButton
                  component={RouterLink}
                  to="/cart"
                  sx={{ color: isLight ? '#172B30' : 'white', p: 1 }}
                >
                  <Badge
                    badgeContent={itemCount}
                    sx={{
                      '& .MuiBadge-badge': {
                        bgcolor: '#FF7900',
                        color: 'white',
                        fontWeight: 800,
                        fontSize: '0.7rem',
                      },
                    }}
                  >
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
                  bgcolor: isLight ? '#F5F6F7' : 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 2.5,
                  px: 1.5,
                  py: 0.6,
                  border: `1px solid ${isLight ? '#E5E7EB' : 'transparent'}`,
                }}
              >
                <SearchIcon sx={{ color: isLight ? '#9CA3AF' : 'rgba(255,255,255,0.6)', mr: 1, fontSize: 18 }} />
                <InputBase
                  placeholder="Search products…"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  fullWidth
                  sx={{
                    color: isLight ? '#172B30' : 'white',
                    fontSize: '0.85rem',
                    '& input::placeholder': { color: isLight ? '#9CA3AF' : 'rgba(255,255,255,0.6)' },
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
            bgcolor: isLight ? '#FFFFFF' : '#0F172A',
            color: isLight ? '#172B30' : 'white',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${isLight ? '#E5E7EB' : '#1E293B'}` }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="E-Shophy"
            sx={{
              height: 32,
              width: 'auto',
              maxWidth: 130,
              objectFit: 'contain',
            }}
          />
          <IconButton sx={{ color: isLight ? '#64748B' : '#94A3B8' }} onClick={() => setDrawerOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* User Card in Drawer */}
        <Box sx={{ p: 2.5, bgcolor: isLight ? '#F5F6F7' : '#1E293B', borderBottom: `1px solid ${isLight ? '#E5E7EB' : '#334155'}` }}>
          {isAuthenticated ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: '#FF7900', color: 'white', width: 44, height: 44, fontWeight: 700 }}>
                {user?.name?.[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="subtitle2" fontWeight={800} color={isLight ? '#172B30' : 'white'}>{user?.name}</Typography>
                <Typography variant="caption" sx={{ color: isLight ? '#64748B' : '#94A3B8' }}>{user?.email}</Typography>
              </Box>
            </Stack>
          ) : (
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: isLight ? '#172B30' : 'white' }}>Welcome to E-Shophy</Typography>
              <Button
                variant="contained"
                size="small"
                fullWidth
                component={RouterLink}
                to="/login"
                onClick={() => setDrawerOpen(false)}
                sx={{ bgcolor: '#FF7900', color: 'white', fontWeight: 700, borderRadius: 1, py: 1, '&:hover': { bgcolor: '#E85D04' } }}
              >
                Sign In / Register
              </Button>
            </Box>
          )}
        </Box>

        {/* Category Links */}
        <List sx={{ px: 1.5, py: 2 }}>
          <Typography variant="caption" sx={{ px: 2, color: isLight ? '#6B7280' : '#64748b', fontWeight: 800, letterSpacing: '0.05em' }}>
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
                  '&:hover': { bgcolor: isLight ? '#F5F6F7' : 'rgba(255,255,255,0.06)' },
                }}
              >
                <ListItemText
                  primary={cat.name}
                  primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600, color: isLight ? '#172B30' : 'white' }}
                />
                <ChevronRightIcon sx={{ color: isLight ? '#9CA3AF' : '#64748b', fontSize: 18 }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Box sx={{ mt: 'auto', p: 2, borderTop: `1px solid ${isLight ? '#E5E7EB' : '#1E293B'}` }}>
          <Button
            component={RouterLink}
            to="http://localhost:5174"
            target="_blank"
            fullWidth
            variant="outlined"
            size="small"
            sx={{ borderColor: isLight ? '#E5E7EB' : '#334155', color: isLight ? '#6B7280' : '#94A3B8', borderRadius: 1, fontWeight: 600, py: 1 }}
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
            borderRadius: '8px',
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
            Sign In to E-Shophy
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
            bgcolor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(20px)',
            borderTop: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.08)'}`,
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
                color: isLight ? '#64748B' : '#94A3B8',
                minWidth: 'auto',
                py: 0.5,
                '&.Mui-selected': {
                  color: '#FF7900',
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
