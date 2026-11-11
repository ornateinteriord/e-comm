import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Storefront as StorefrontIcon,
  Login as LoginIcon,
} from '@mui/icons-material';
import api from '../api/client';
import { useStoreAuthStore } from '../store/auth.store';

export default function LoginStorePage() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useStoreAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('Please enter your Store ID / Mobile Number and Password.');
      return;
    }

    setIsLoading(true);
    try {
      const resp = await api.post('/store/login', {
        identifier: identifier.trim(),
        password,
      });

      if (resp.data?.success) {
        const { accessToken, store } = resp.data.data;
        setAuth(accessToken, store);
        navigate('/');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message || 'Login failed. Please check your credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Paper
          elevation={1}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            bgcolor: '#FFFFFF',
            textAlign: 'center',
          }}
        >
          {/* Brand Logo */}
          <Box
            component="img"
            src="/logo.svg"
            alt="E-Shopy"
            sx={{ height: 38, width: 'auto', maxWidth: 200, objectFit: 'contain', mx: 'auto', mb: 2 }}
          />

          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#172B30' }}>
              Store Portal Sign In
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
              Manage your products, live inventory, and customer orders
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2, textAlign: 'left' }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                fullWidth
                label="Store ID or Mobile Number"
                placeholder="e.g. STR00001 or 9876543210"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoFocus
              />

              <TextField
                fullWidth
                type={showPassword ? 'text' : 'password'}
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
                sx={{ py: 1.25, fontWeight: 800 }}
              >
                {isLoading ? 'Signing In...' : 'Sign In to Store'}
              </Button>
            </Stack>
          </Box>

          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #E2E8F0' }}>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Don't have a partner store yet?{' '}
              <Button
                component={RouterLink}
                to="/register"
                sx={{ textTransform: 'none', fontWeight: 700, color: '#FF7900' }}
              >
                Register Store
              </Button>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

