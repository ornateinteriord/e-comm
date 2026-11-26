import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Login as LoginIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import api from '../api/client';
import { useDeliveryAuthStore } from '../store/auth.store';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useDeliveryAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('Enter your Partner ID / Mobile Number and password.');
      return;
    }

    setIsLoading(true);
    try {
      const resp = await api.post('/delivery/login', {
        identifier: identifier.trim(),
        password,
      });

      if (resp.data?.success) {
        const { accessToken, partner } = resp.data.data;
        setAuth(accessToken, partner);
        navigate('/');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || 'Invalid login credentials.');
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
        px: 2,
      }}
    >
      <Container maxWidth="xs">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            border: '1px solid #E2E8F0',
            textAlign: 'center',
          }}
        >
          <Box
            component="img"
            src="/logo.svg"
            alt="E-Shopy"
            sx={{ height: 38, width: 'auto', mx: 'auto', mb: 2 }}
          />
          <Typography variant="h5" sx={{ mb: 0.5 }}>
            Delivery Partner Sign In
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Go online, claim deliveries, navigate routes, and track your earnings
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, textAlign: 'left' }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.25}>
              <TextField
                fullWidth
                label="Partner ID, Mobile, or Email"
                placeholder="e.g. DLV00001 or 9876543210"
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
                      <IconButton onClick={() => setShowPassword((prev) => !prev)} edge="end">
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
                startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
            </Stack>
          </Box>

          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #E2E8F0' }}>
            <Typography variant="body2" color="text.secondary">
              New rider?{' '}
              <Button component={RouterLink} to="/register" sx={{ color: '#FF7900', minHeight: 32, p: 0.5 }}>
                Apply as Delivery Partner
              </Button>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
