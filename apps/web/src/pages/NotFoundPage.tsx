import { useNavigate, Link as RouterLink } from 'react-router';
import {
  Box, Container, Typography, Button, Paper, Stack, Chip,
  Divider, useTheme,
} from '@mui/material';
import {
  Home as HomeIcon,
  Search as SearchIcon,
  Logout as LogoutIcon,
  Login as LoginIcon,
  ExploreOff as ExploreOffIcon,
  ShoppingBag as ShoppingBagIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/auth.store';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const { user, isAuthenticated, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <Box
      sx={{
        minHeight: '75vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: { xs: 8, md: 12 },
        px: 2,
        bgcolor: isLight ? '#F5F6F7' : '#0B0F19',
        transition: 'background-color 0.3s ease',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3.5, sm: 5.5 },
            borderRadius: '16px',
            bgcolor: isLight ? '#FFFFFF' : '#111827',
            border: `1px solid ${isLight ? '#E5E7EB' : '#1E293B'}`,
            textAlign: 'center',
            boxShadow: isLight
              ? '0 20px 40px -15px rgba(23, 43, 48, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          }}
        >
          {/* Subtle Tag */}
          <Chip
            icon={<ExploreOffIcon sx={{ fontSize: '15px !important', color: '#FF7900 !important' }} />}
            label="404 • PAGE NOT FOUND"
            size="small"
            sx={{
              bgcolor: isLight ? 'rgba(255, 121, 0, 0.08)' : 'rgba(255, 121, 0, 0.15)',
              color: '#FF7900',
              fontWeight: 800,
              fontSize: '0.75rem',
              letterSpacing: 0.5,
              mb: 2.5,
              border: '1px solid rgba(255, 121, 0, 0.25)',
            }}
          />

          {/* Large Gradient 404 */}
          <Typography
            variant="h1"
            sx={{
              fontWeight: 900,
              fontSize: { xs: '5rem', sm: '7rem' },
              lineHeight: 1,
              letterSpacing: '-0.04em',
              background: isLight
                ? 'linear-gradient(135deg, #FF7900 0%, #172B30 80%)'
                : 'linear-gradient(135deg, #FF7900 0%, #F8FAFC 80%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1.5,
            }}
          >
            404
          </Typography>

          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              color: isLight ? '#172B30' : '#F8FAFC',
              letterSpacing: '-0.02em',
              mb: 1.5,
            }}
          >
            We couldn't find that page
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: isLight ? '#4B5563' : '#94A3B8',
              maxWidth: 420,
              mx: 'auto',
              lineHeight: 1.6,
              mb: 3.5,
            }}
          >
            The link you followed may be broken, or the product or department may have been moved, renamed, or temporarily discontinued.
          </Typography>

          {/* User Session Banner (if signed in) */}
          {isAuthenticated && user && (
            <Box
              sx={{
                mb: 3.5,
                p: 1.5,
                borderRadius: '8px',
                bgcolor: isLight ? '#F5F6F7' : '#1E293B',
                border: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.08)'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Typography variant="caption" sx={{ color: isLight ? '#374151' : '#CBD5E1', fontWeight: 600 }}>
                Signed in as: <strong>{user.email}</strong>
              </Typography>
            </Box>
          )}

          {/* Action Buttons */}
          <Stack spacing={1.75} sx={{ maxWidth: 360, mx: 'auto' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<HomeIcon />}
              onClick={() => navigate('/')}
              sx={{
                bgcolor: '#FF7900',
                color: '#FFFFFF',
                fontWeight: 700,
                py: 1.4,
                borderRadius: '8px',
                '&:hover': { bgcolor: '#E85D04' },
              }}
            >
              Back to Store Home
            </Button>

            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                fullWidth
                size="medium"
                startIcon={<SearchIcon />}
                onClick={() => navigate('/search')}
                sx={{
                  borderColor: isLight ? '#E5E7EB' : '#334155',
                  color: isLight ? '#172B30' : '#F8FAFC',
                  fontWeight: 600,
                  borderRadius: '8px',
                  '&:hover': {
                    borderColor: '#FF7900',
                    color: '#FF7900',
                    bgcolor: isLight ? 'rgba(255, 121, 0, 0.04)' : 'rgba(255, 121, 0, 0.1)',
                  },
                }}
              >
                Search Catalog
              </Button>

              <Button
                variant="outlined"
                fullWidth
                size="medium"
                startIcon={<ShoppingBagIcon />}
                onClick={() => navigate('/orders')}
                sx={{
                  borderColor: isLight ? '#E5E7EB' : '#334155',
                  color: isLight ? '#172B30' : '#F8FAFC',
                  fontWeight: 600,
                  borderRadius: '8px',
                  '&:hover': {
                    borderColor: '#FF7900',
                    color: '#FF7900',
                    bgcolor: isLight ? 'rgba(255, 121, 0, 0.04)' : 'rgba(255, 121, 0, 0.1)',
                  },
                }}
              >
                My Orders
              </Button>
            </Stack>

            <Divider sx={{ my: 1.5 }}>
              <Typography variant="caption" sx={{ color: isLight ? '#9CA3AF' : '#64748B', fontWeight: 600 }}>
                ACCOUNT OPTIONS
              </Typography>
            </Divider>

            {isAuthenticated ? (
              <Button
                variant="outlined"
                color="error"
                size="medium"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{
                  fontWeight: 700,
                  py: 1.2,
                  borderRadius: '8px',
                  borderColor: isLight ? '#FCA5A5' : '#7F1D1D',
                  color: isLight ? '#DC2626' : '#F87171',
                  '&:hover': {
                    borderColor: '#EF4444',
                    bgcolor: isLight ? '#FEF2F2' : 'rgba(239, 68, 68, 0.15)',
                  },
                }}
              >
                Sign Out / Logout
              </Button>
            ) : (
              <Button
                variant="outlined"
                size="medium"
                startIcon={<LoginIcon />}
                component={RouterLink}
                to="/login"
                sx={{
                  fontWeight: 700,
                  py: 1.2,
                  borderRadius: '8px',
                  borderColor: isLight ? '#E5E7EB' : '#334155',
                  color: isLight ? '#172B30' : '#F8FAFC',
                  '&:hover': {
                    borderColor: '#FF7900',
                    color: '#FF7900',
                    bgcolor: isLight ? 'rgba(255, 121, 0, 0.04)' : 'rgba(255, 121, 0, 0.1)',
                  },
                }}
              >
                Sign In to Account
              </Button>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
