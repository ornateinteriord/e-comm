import React from 'react';
import { useNavigate } from 'react-router';
import {
  Box, Container, Typography, Paper, Button, Stack, Chip, Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Logout as LogoutIcon,
  MonitorHeart as MonitorHeartIcon,
  ArrowBack as ArrowBackIcon,
  SearchOff as SearchOffIcon,
} from '@mui/icons-material';
import { useAdminAuthStore } from '../store/auth.store';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { user, clearAuth, isAuthenticated } = useAdminAuthStore();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <Box
      sx={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, sm: 4 },
        bgcolor: '#f8fafc',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3.5, sm: 5 },
            borderRadius: '12px',
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.02)',
          }}
        >
          {/* Badge */}
          <Chip
            icon={<SearchOffIcon sx={{ fontSize: '15px !important', color: '#ea580c !important' }} />}
            label="404 • ROUTE NOT FOUND"
            size="small"
            sx={{
              bgcolor: '#fff7ed',
              color: '#ea580c',
              fontWeight: 800,
              fontSize: '0.75rem',
              letterSpacing: 0.5,
              mb: 2.5,
              border: '1px solid #fed7aa',
            }}
          />

          {/* Large 404 Accent */}
          <Typography
            variant="h1"
            sx={{
              fontWeight: 900,
              fontSize: { xs: '4.5rem', sm: '6rem' },
              lineHeight: 1,
              letterSpacing: '-0.04em',
              background: 'linear-gradient(135deg, #FF7900 0%, #0f172a 75%)',
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
              color: '#0f172a',
              letterSpacing: '-0.02em',
              mb: 1.5,
            }}
          >
            Admin Page Not Found
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: '#64748b',
              maxWidth: 420,
              mx: 'auto',
              lineHeight: 1.6,
              mb: 4,
            }}
          >
            The administrative endpoint or page you requested does not exist, has been relocated, or is no longer available in this deployment.
          </Typography>

          {/* User Session Info if authenticated */}
          {isAuthenticated && user && (
            <Box
              sx={{
                mb: 3.5,
                p: 1.5,
                borderRadius: '8px',
                bgcolor: '#f1f5f9',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                Signed in as: <strong>{user.email}</strong> ({user.role})
              </Typography>
            </Box>
          )}

          {/* Actions */}
          <Stack spacing={1.5} sx={{ maxWidth: 360, mx: 'auto' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<DashboardIcon />}
              onClick={() => navigate('/')}
              sx={{
                bgcolor: '#FF7900',
                color: '#ffffff',
                fontWeight: 700,
                py: 1.25,
                borderRadius: '8px',
                '&:hover': { bgcolor: '#E85D04' },
              }}
            >
              Return to Dashboard
            </Button>

            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                fullWidth
                size="medium"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate(-1)}
                sx={{
                  borderColor: '#cbd5e1',
                  color: '#334155',
                  fontWeight: 600,
                  borderRadius: '8px',
                  '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
                }}
              >
                Go Back
              </Button>

              <Button
                variant="outlined"
                fullWidth
                size="medium"
                startIcon={<MonitorHeartIcon />}
                onClick={() => navigate('/system-health')}
                sx={{
                  borderColor: '#cbd5e1',
                  color: '#334155',
                  fontWeight: 600,
                  borderRadius: '8px',
                  '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
                }}
              >
                System Health
              </Button>
            </Stack>

            <Divider sx={{ my: 1.5 }}>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                SESSION MANAGEMENT
              </Typography>
            </Divider>

            <Button
              variant="outlined"
              color="error"
              size="large"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{
                fontWeight: 700,
                py: 1.2,
                borderRadius: '8px',
                borderColor: '#fca5a5',
                color: '#dc2626',
                '&:hover': {
                  borderColor: '#ef4444',
                  bgcolor: '#fef2f2',
                },
              }}
            >
              Sign Out / Logout
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
