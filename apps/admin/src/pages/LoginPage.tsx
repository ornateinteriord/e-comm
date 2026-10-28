import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Box, Container, Typography, Paper, TextField, Button,
  Alert, Stack, Divider,
} from '@mui/material';
import {
  LockOutlined as LockIcon,
  Storefront as StorefrontIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useAdminAuthStore } from '../store/auth.store';
import api from '../api/client';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAdminAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('admin@ornate.dev');
  const [password, setPassword] = useState('Admin@1234');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data } = await api.post('/auth/login', { email, password });
      const loggedUser = data.data.user;
      const allowedRoles = ['super_admin', 'admin', 'catalog_manager', 'inventory_manager', 'order_manager', 'finance_manager', 'support'];
      if (!allowedRoles.includes(loggedUser.role)) {
        setError('Access denied. This account does not have administrative permissions.');
        return;
      }
      setAuth(data.data.accessToken, loggedUser);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: '#0f172a' }}>
      <Container maxWidth="xs">
        <Paper elevation={0} sx={{ p: 5, borderRadius: '10px', bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Box
                component="img"
                src="/logo.svg"
                alt="E-Shophy"
                sx={{ height: 46, width: 'auto', maxWidth: 180, objectFit: 'contain' }}
              />
            </Box>
            <Typography variant="h5" fontWeight={900} letterSpacing="-0.02em" sx={{ color: '#172B30' }}>
              E-Shophy Admin
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in with your administrative credentials
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <Stack spacing={2.5}>
              <TextField
                label="Admin Email"
                type="email"
                required
                fullWidth
                size="small"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Password"
                type="password"
                required
                fullWidth
                size="small"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={isLoading}
                sx={{ py: 1.25, fontWeight: 700 }}
              >
                {isLoading ? 'Authenticating…' : 'Sign In to Console'}
              </Button>
            </Stack>
          </form>

          <Divider sx={{ my: 2.5 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, letterSpacing: 0.5 }}>
              OR
            </Typography>
          </Divider>

          <Button
            variant="outlined"
            fullWidth
            size="large"
            startIcon={<StorefrontIcon />}
            endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
            onClick={() => window.open('https://vendor.eshopy.biz/login', '_blank', 'noopener,noreferrer')}
            sx={{
              py: 1.25,
              fontWeight: 700,
              borderRadius: '8px',
              borderColor: '#e2e8f0',
              color: '#0f172a',
              bgcolor: '#f8fafc',
              textTransform: 'none',
              fontSize: '0.95rem',
              '&:hover': {
                borderColor: '#FF7900',
                color: '#FF7900',
                bgcolor: 'rgba(255, 121, 0, 0.05)',
              },
            }}
          >
            Login as Vendor
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}
