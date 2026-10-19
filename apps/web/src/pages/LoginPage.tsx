import { useState, type FormEvent } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router';
import {
  Box, Container, Typography, Paper, TextField, Button,
  Divider, Alert, Stack,
} from '@mui/material';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.data.accessToken, data.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoAdmin = () => {
    setEmail('admin@ornate.dev');
    setPassword('Admin@1234');
  };

  return (
    <Container maxWidth="xs" sx={{ py: 10 }}>
      <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" fontWeight={800} textAlign="center" letterSpacing="-0.02em" sx={{ mb: 1 }}>
          Welcome back
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
          Sign in to your account
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleLogin}>
          <Stack spacing={2.5}>
            <TextField
              label="Email Address"
              type="email"
              required
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              required
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={isLoading}
              sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}
            >
              {isLoading ? 'Signing in…' : 'Sign In'}
            </Button>
          </Stack>
        </form>

        <Divider sx={{ my: 3 }}>
          <Typography variant="caption" color="text.secondary">OR</Typography>
        </Divider>

        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={fillDemoAdmin}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Fill Super Admin Demo (admin@ornate.dev)
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" textAlign="center">
          Don't have an account?{' '}
          <Button component={RouterLink} to="/register" sx={{ textTransform: 'none', fontWeight: 700, p: 0 }}>
            Sign up
          </Button>
        </Typography>
      </Paper>
    </Container>
  );
}
