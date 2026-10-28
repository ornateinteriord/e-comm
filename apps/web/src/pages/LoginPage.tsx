import { useState, type FormEvent } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router';
import {
  Box,
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Divider,
  Alert,
  Stack,
  InputAdornment,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Visibility,
  VisibilityOff,
  Storefront as StorefrontIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Restrict strictly to digits and maximum 10 numbers
    const cleanDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setMobileNumber(cleanDigits);
    if (error) setError(null);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // 10-digit strict input validation
    if (!/^\d{10}$/.test(mobileNumber)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const { data } = await api.post('/auth/login', {
        mobileNumber,
        username: mobileNumber,
        password,
      });
      setAuth(data.data.accessToken, data.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 6, sm: 10 } }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 },
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="E-Shophy"
            sx={{ height: 44, width: 'auto', maxWidth: 180, objectFit: 'contain' }}
          />
        </Box>
        <Typography
          variant="h5"
          fontWeight={800}
          textAlign="center"
          letterSpacing="-0.02em"
          sx={{ mb: 1, color: '#172B30' }}
        >
          Welcome back
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
          Sign in using your 10-digit mobile number
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleLogin}>
          <Stack spacing={2.5}>
            <TextField
              label="Mobile Number"
              type="tel"
              required
              fullWidth
              value={mobileNumber}
              onChange={handleMobileChange}
              placeholder="9876543210"
              inputProps={{
                maxLength: 10,
                inputMode: 'numeric',
                pattern: '[0-9]*',
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PhoneIcon sx={{ fontSize: 18, color: '#64748b' }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                        +91
                      </Typography>
                    </Box>
                  </InputAdornment>
                ),
              }}
              helperText={
                mobileNumber.length > 0 && mobileNumber.length < 10
                  ? `${mobileNumber.length}/10 digits entered`
                  : 'Enter 10-digit registered mobile number'
              }
              error={mobileNumber.length > 0 && mobileNumber.length < 10}
            />

            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              required
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={isLoading || mobileNumber.length !== 10 || !password}
              sx={{
                py: 1.5,
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '1rem',
                textTransform: 'none',
                bgcolor: '#FF7900',
                '&:hover': { bgcolor: '#e66d00' },
                '&.Mui-disabled': {
                  bgcolor: '#cbd5e1',
                  color: '#64748b',
                },
              }}
            >
              {isLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={20} color="inherit" />
                  Signing in…
                </Box>
              ) : (
                'Sign In'
              )}
            </Button>
          </Stack>
        </form>

        <Divider sx={{ my: 2.5 }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, letterSpacing: 0.5 }}>
            ARE YOU A SELLER / VENDOR?
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
            color: '#172B30',
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

        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 3 }}>
          Don't have an account?{' '}
          <Button component={RouterLink} to="/register" sx={{ textTransform: 'none', fontWeight: 700, p: 0 }}>
            Sign up
          </Button>
        </Typography>
      </Paper>
    </Container>
  );
}
