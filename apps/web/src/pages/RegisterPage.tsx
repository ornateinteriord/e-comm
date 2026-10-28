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
  Grid,
  MenuItem,
  InputAdornment,
  IconButton,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Storefront as StorefrontIcon,
  OpenInNew as OpenInNewIcon,
  Visibility,
  VisibilityOff,
  CheckCircle as CheckCircleIcon,
  VerifiedUser as VerifiedUserIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  // Form Fields
  const [referralCode, setReferralCode] = useState('');
  const [referralName, setReferralName] = useState('');
  const [referralType, setReferralType] = useState<'vendor' | 'customer' | ''>('');
  const [isReferralVerified, setIsReferralVerified] = useState(false);
  const [isVerifyingReferral, setIsVerifyingReferral] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say'>('prefer_not_to_say');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [country, setCountry] = useState('India');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Referral code verification handler
  const handleVerifyReferral = async () => {
    const code = referralCode.trim();
    if (!code) {
      setReferralError('Please enter a referral or sponsor code.');
      setIsReferralVerified(false);
      setReferralName('');
      return;
    }

    setIsVerifyingReferral(true);
    setReferralError(null);

    try {
      const { data } = await api.get(`/auth/verify-referral?code=${encodeURIComponent(code)}`);
      if (data.success && data.data?.valid) {
        setIsReferralVerified(true);
        setReferralCode(data.data.referralCode || code);
        setReferralName(data.data.referralName || '');
        setReferralType(data.data.referralType || 'vendor');
      } else {
        setIsReferralVerified(false);
        setReferralName('');
        setReferralError(data.error?.message || 'Invalid referral code. A valid sponsor is required.');
      }
    } catch (err: any) {
      setIsReferralVerified(false);
      setReferralName('');
      setReferralError(
        err.response?.data?.error?.message ||
          'Invalid referral code. Please check with your sponsor or vendor.'
      );
    } finally {
      setIsVerifyingReferral(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isReferralVerified || !referralCode.trim()) {
      setError('A verified referral code is mandatory to create an account.');
      return;
    }

    if (!fullName.trim() || !email.trim() || !mobileNumber.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!/^\d{10}$/.test(mobileNumber.trim())) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        referralCode: referralCode.trim(),
        fullName: fullName.trim(),
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        mobileNumber: mobileNumber.trim(),
        phone: mobileNumber.trim(),
        username: mobileNumber.trim(), // username = mobilenumber
        password,
        gender,
        country: country.trim() || 'India',
        state: state.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
      };

      const { data } = await api.post('/auth/register', payload);
      setAuth(data.data.accessToken, data.data.user);
      navigate('/');
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Registration failed. Please check your details and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 5 },
          borderRadius: '14px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
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
          sx={{ mb: 0.5, color: '#172B30' }}
        >
          Create an Account
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
          Enter your referral code to unlock registration on E-Shophy
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleRegister}>
          <Stack spacing={2.5}>
            {/* ---- 1. Referral Sponsor Section ---- */}
            <Box
              sx={{
                p: 2.5,
                bgcolor: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid',
                borderColor: isReferralVerified ? '#86efac' : '#e2e8f0',
                transition: 'all 0.2s ease',
              }}
            >
              <Typography
                variant="subtitle2"
                fontWeight={700}
                sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, color: '#1e293b' }}
              >
                <VerifiedUserIcon sx={{ fontSize: 20, color: isReferralVerified ? '#16a34a' : '#64748b' }} />
                Referral & Sponsor Details
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={7}>
                  <TextField
                    label="Referral Code *"
                    required
                    fullWidth
                    size="small"
                    value={referralCode}
                    onChange={(e) => {
                      setReferralCode(e.target.value);
                      setIsReferralVerified(false);
                      setReferralName('');
                      setReferralError(null);
                    }}
                    placeholder="Enter referral / sponsor code"
                    InputProps={{
                      endAdornment: isVerifyingReferral ? (
                        <InputAdornment position="end">
                          <CircularProgress size={20} />
                        </InputAdornment>
                      ) : isReferralVerified ? (
                        <InputAdornment position="end">
                          <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 22 }} />
                        </InputAdornment>
                      ) : null,
                    }}
                    helperText={
                      referralError
                        ? undefined
                        : isReferralVerified
                        ? 'Referral verified successfully'
                        : 'Press Verify after entering code'
                    }
                    error={Boolean(referralError)}
                  />
                </Grid>
                <Grid item xs={12} sm={5} sx={{ display: 'flex', alignItems: 'flex-start' }}>
                  <Button
                    variant="contained"
                    fullWidth
                    size="medium"
                    onClick={handleVerifyReferral}
                    disabled={isVerifyingReferral || !referralCode.trim()}
                    sx={{
                      py: 1,
                      fontWeight: 700,
                      borderRadius: '8px',
                      textTransform: 'none',
                      bgcolor: '#FF7900',
                      '&:hover': { bgcolor: '#e66d00' },
                    }}
                  >
                    {isVerifyingReferral ? 'Verifying…' : 'Verify Code'}
                  </Button>
                </Grid>

                {referralError && (
                  <Grid item xs={12}>
                    <Alert severity="error" sx={{ py: 0.5, px: 1.5, fontSize: '0.85rem' }}>
                      {referralError}
                    </Alert>
                  </Grid>
                )}

                {isReferralVerified && (
                  <Grid item xs={12}>
                    <TextField
                      label="Referral Name"
                      fullWidth
                      size="small"
                      value={referralName}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <Chip
                              label={referralType === 'vendor' ? 'Vendor Sponsor' : 'Customer Referral'}
                              size="small"
                              color={referralType === 'vendor' ? 'warning' : 'primary'}
                              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                            />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          bgcolor: '#ffffff',
                          fontWeight: 700,
                          color: '#0f172a',
                        },
                      }}
                    />
                  </Grid>
                )}
              </Grid>
            </Box>

            {/* ---- 2. Personal Information ---- */}
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#475569', mt: 1 }}>
              Personal Information
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={7}>
                <TextField
                  label="Full Name *"
                  required
                  fullWidth
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </Grid>

              <Grid item xs={12} sm={5}>
                <TextField
                  select
                  label="Gender *"
                  required
                  fullWidth
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                >
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                  <MenuItem value="prefer_not_to_say">Prefer not to say</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Mobile Number *"
                  type="tel"
                  required
                  fullWidth
                  value={mobileNumber}
                  onChange={(e) => {
                    const cleanDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setMobileNumber(cleanDigits);
                  }}
                  placeholder="9876543210"
                  inputProps={{
                    maxLength: 10,
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                          +91
                        </Typography>
                      </InputAdornment>
                    ),
                  }}
                  helperText={
                    mobileNumber.length > 0 && mobileNumber.length < 10
                      ? `${mobileNumber.length}/10 digits entered`
                      : 'Will also be your Username for login'
                  }
                  error={mobileNumber.length > 0 && mobileNumber.length !== 10}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Email Address *"
                  type="email"
                  required
                  fullWidth
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. name@example.com"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Password (min 8 chars) *"
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
              </Grid>
            </Grid>

            {/* ---- 3. Location / Address ---- */}
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#475569', mt: 1 }}>
              Address & Location
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Country"
                  fullWidth
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="State"
                  fullWidth
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Maharashtra"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="City"
                  fullWidth
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Mumbai"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Pincode"
                  fullWidth
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 400001"
                />
              </Grid>
            </Grid>

            {/* ---- Submit Button ---- */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={isLoading || !isReferralVerified}
              sx={{
                py: 1.6,
                mt: 1,
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
                  Creating account…
                </Box>
              ) : !isReferralVerified ? (
                'Verify Referral Code to Proceed'
              ) : (
                'Create Account'
              )}
            </Button>
          </Stack>
        </form>

        <Divider sx={{ my: 3 }}>
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
          onClick={() => window.open('https://e-shophy-cash.vercel.app/login', '_blank', 'noopener,noreferrer')}
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
          Already have an account?{' '}
          <Button component={RouterLink} to="/login" sx={{ textTransform: 'none', fontWeight: 700, p: 0 }}>
            Sign in
          </Button>
        </Typography>
      </Paper>
    </Container>
  );
}
