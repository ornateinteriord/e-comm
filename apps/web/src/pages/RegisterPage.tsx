import { useState, type FormEvent } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router';
import {
  Box, Container, Typography, Paper, TextField, Button,
  Alert, Stack,
} from '@mui/material';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      setAuth(data.data.accessToken, data.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Registration failed. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: 10 }}>
      <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="E-Shophy Logo"
            sx={{ width: 48, height: 48, objectFit: 'contain', borderRadius: '10px' }}
          />
        </Box>
        <Typography variant="h5" fontWeight={800} textAlign="center" letterSpacing="-0.02em" sx={{ mb: 1 }}>
          Create an account
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
          Join E-Shophy today
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleRegister}>
          <Stack spacing={2.5}>
            <TextField
              label="Full Name"
              required
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              label="Email Address"
              type="email"
              required
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password (min 8 chars)"
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
              {isLoading ? 'Creating account…' : 'Sign Up'}
            </Button>
          </Stack>
        </form>

        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 3 }}>
          Already have an account?{' '}
          <Button component={RouterLink} to="/login" sx={{ textTransform: 'none', fontWeight: 700, p: 0 }}>
            Sign in
          </Button>
        </Typography>
      </Paper>
    </Container>
  );
}
