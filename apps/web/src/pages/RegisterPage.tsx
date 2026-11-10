import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router';
import {
  Box,
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  Stack,
  Grid,
  MenuItem,
  InputAdornment,
  IconButton,
  CircularProgress,
  Chip,
  Dialog,
  DialogContent,
  DialogActions,
  Tooltip,
} from '@mui/material';
import {
  Storefront as StorefrontIcon,
  OpenInNew as OpenInNewIcon,
  Visibility,
  VisibilityOff,
  CheckCircle as CheckCircleIcon,
  VerifiedUser as VerifiedUserIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Lock as LockIcon,
  ShoppingBag as ShoppingBagIcon,
  Login as LoginIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';

export interface RegistrationSummary {
  accessToken: string;
  user: any;
  username: string;
  password: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  customerId?: string;
  sponsorName: string;
  sponsorCode: string;
  sponsorType: string;
  vendorId?: string;
  vendorName?: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth, isAuthenticated } = useAuthStore();

  // Dialog State for post-registration credentials & sponsor details
  const [successDetails, setSuccessDetails] = useState<RegistrationSummary | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showPasswordInDialog, setShowPasswordInDialog] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Redirect away if already logged in (skip if registration success dialog is active)
  useEffect(() => {
    if (isAuthenticated && !showSuccessDialog) {
      const redirectUrl = searchParams.get('redirect') || '/';
      navigate(redirectUrl, { replace: true });
    }
  }, [isAuthenticated, navigate, searchParams, showSuccessDialog]);

  // Copy helper with fallback support
  const copyToClipboard = async (text: string, fieldKey: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedField(fieldKey);
      setTimeout(() => {
        setCopiedField((curr) => (curr === fieldKey ? null : curr));
      }, 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const handleCopyAll = () => {
    if (!successDetails) return;
    const lines = [
      '========================================',
      '      E-SHOPY REGISTRATION DETAILS     ',
      '========================================',
      '',
      'LOGIN CREDENTIALS:',
      `  Username: ${successDetails.username}`,
      `  Password: ${successDetails.password}`,
      successDetails.customerId ? `  Customer ID: ${successDetails.customerId}` : null,
      `  Full Name: ${successDetails.fullName}`,
      `  Email: ${successDetails.email}`,
      `  Mobile: +91 ${successDetails.mobileNumber}`,
      '',
      'SPONSOR & VENDOR DETAILS:',
      `  Sponsor Name: ${successDetails.sponsorName}`,
      `  Sponsor Code: ${successDetails.sponsorCode}`,
      `  Sponsor Type: ${successDetails.sponsorType === 'vendor' ? 'Vendor Sponsor' : 'Customer Referral'}`,
      successDetails.vendorId || successDetails.vendorName
        ? `  Vendor (ID / Name): ${[successDetails.vendorId, successDetails.vendorName].filter(Boolean).join(' / ')}`
        : null,
      '',
      'Please save these credentials securely.',
      'Sign in at: https://eshopy.biz/login',
      '========================================',
    ]
      .filter((line) => line !== null)
      .join('\n');

    copyToClipboard(lines, 'all');
  };

  const handleProceedToAccount = () => {
    if (successDetails?.accessToken && successDetails?.user) {
      setAuth(successDetails.accessToken, successDetails.user);
    }
    setShowSuccessDialog(false);
    const redirectUrl = searchParams.get('redirect') || '/';
    navigate(redirectUrl, { replace: true });
  };

  const handleGoToLogin = () => {
    setShowSuccessDialog(false);
    navigate('/login');
  };

  // Form Fields
  const [referralCode, setReferralCode] = useState('');
  const [resolvedReferralCode, setResolvedReferralCode] = useState('');
  const [referralName, setReferralName] = useState('');
  const [referralType, setReferralType] = useState<'vendor' | 'customer' | ''>('');
  const [referralVendorId, setReferralVendorId] = useState('');
  const [referralVendorName, setReferralVendorName] = useState('');
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
  const handleVerifyReferral = async (overrideCode?: string) => {
    const code = (typeof overrideCode === 'string' ? overrideCode : referralCode).trim();
    if (!code) {
      setReferralError('Please enter a referral or sponsor code.');
      setIsReferralVerified(false);
      setReferralName('');
      setReferralVendorId('');
      setReferralVendorName('');
      return;
    }

    setIsVerifyingReferral(true);
    setReferralError(null);

    try {
      const { data } = await api.get(`/auth/verify-referral?code=${encodeURIComponent(code)}`);
      if (data.success && data.data?.valid) {
        setIsReferralVerified(true);
        const resolvedCode = data.data.member_code || data.data.referralCode || code;
        setResolvedReferralCode(resolvedCode);
        setReferralName(data.data.referralName || '');
        setReferralType(data.data.referralType || 'vendor');
        setReferralVendorId(data.data.member_code || data.data.vendor_id || resolvedCode);
        setReferralVendorName(data.data.vendor_name || data.data.referralName || '');
      } else {
        setIsReferralVerified(false);
        setResolvedReferralCode('');
        setReferralName('');
        setReferralVendorId('');
        setReferralVendorName('');
        setReferralError(data.error?.message || 'Invalid referral code. A valid sponsor is required.');
      }
    } catch (err: any) {
      setIsReferralVerified(false);
      setResolvedReferralCode('');
      setReferralName('');
      setReferralVendorId('');
      setReferralVendorName('');
      setReferralError(
        err.response?.data?.error?.message ||
        'Invalid referral code. Please check with your sponsor or vendor.'
      );
    } finally {
      setIsVerifyingReferral(false);
    }
  };

  // Auto-fill and auto-verify when /register?refercode=somevalue is accessed
  useEffect(() => {
    const queryCode =
      searchParams.get('refercode') ||
      searchParams.get('referCode') ||
      searchParams.get('referralCode') ||
      searchParams.get('referralcode') ||
      searchParams.get('referral_code') ||
      searchParams.get('ref') ||
      searchParams.get('code') ||
      searchParams.get('sponsor');

    if (queryCode && queryCode.trim()) {
      const cleanCode = queryCode.trim();
      setReferralCode(cleanCode);
      handleVerifyReferral(cleanCode);
    }
  }, [searchParams]);

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
        referralCode: (resolvedReferralCode || referralCode).trim(),
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
      const registeredUser = data?.data?.user;
      const vId = registeredUser?.vendor_id || referralVendorId || (referralType === 'vendor' ? (registeredUser?.referralCode || resolvedReferralCode || referralCode) : undefined);
      const vName = registeredUser?.vendor_name || referralVendorName || (referralType === 'vendor' ? (registeredUser?.referralName || referralName) : undefined);

      setSuccessDetails({
        accessToken: data?.data?.accessToken,
        user: registeredUser,
        username: registeredUser?.username || payload.username,
        password: payload.password,
        fullName: registeredUser?.fullName || payload.fullName,
        email: registeredUser?.email || payload.email,
        mobileNumber: registeredUser?.mobileNumber || payload.mobileNumber,
        customerId: registeredUser?.customerId || registeredUser?.customer_id,
        sponsorName: registeredUser?.referralName || referralName || 'Sponsor',
        sponsorCode: registeredUser?.referralCode || resolvedReferralCode || referralCode,
        sponsorType: registeredUser?.referralType || referralType || 'vendor',
        vendorId: vId,
        vendorName: vName,
      });
      setShowSuccessDialog(true);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
        'Registration failed. Please check your details and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated && !showSuccessDialog) {
    return null;
  }

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
            alt="E-Shopy"
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
          Enter your referral code to unlock registration on E-Shopy
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
                    label="Referral Code"
                    required
                    fullWidth
                    size="small"
                    value={referralCode}
                    onChange={(e) => {
                      setReferralCode(e.target.value);
                      setResolvedReferralCode('');
                      setIsReferralVerified(false);
                      setReferralName('');
                      setReferralVendorId('');
                      setReferralVendorName('');
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
                    onClick={() => handleVerifyReferral()}
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
                      label={referralType === 'vendor' ? 'Verified Sponsor (Vendor Code / Name)' : 'Verified Sponsor (Customer)'}
                      fullWidth
                      size="small"
                      value={
                        referralType === 'vendor'
                          ? (referralVendorId && referralVendorName
                              ? `${referralVendorId} / ${referralVendorName}`
                              : (resolvedReferralCode && resolvedReferralCode !== referralName
                                  ? `${resolvedReferralCode} / ${referralName}`
                                  : referralName))
                          : (resolvedReferralCode && resolvedReferralCode !== referralName
                              ? `${referralName} (${resolvedReferralCode})`
                              : referralName)
                      }
                      helperText={
                        referralType === 'customer' && (referralVendorId || referralVendorName)
                          ? `Assigned Vendor: ${[referralVendorId, referralVendorName].filter(Boolean).join(' / ')}`
                          : undefined
                      }
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
                  label="Full Name"
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
                  label="Gender"
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
                  label="Mobile Number"
                  type="tel"
                  required
                  fullWidth
                  value={mobileNumber}
                  onChange={(e) => {
                    const cleanDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setMobileNumber(cleanDigits);
                  }}
                  placeholder="Enter 10-digit mobile number"
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
                  label="Email Address"
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
                  label="Password (min 8 chars)"
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

        {/* <Divider sx={{ my: 3 }}>
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
        </Button> */}

        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 3 }}>
          Already have an account?{' '}
          <Button component={RouterLink} to="/login" sx={{ textTransform: 'none', fontWeight: 700, p: 0 }}>
            Sign in
          </Button>
        </Typography>
      </Paper>

      {/* Registration Success Dialog */}
      <Dialog
        open={showSuccessDialog}
        onClose={handleProceedToAccount}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={false}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            p: { xs: 2.5, sm: 3 },
            boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.25)',
            width: '100%',
            maxWidth: { sm: '760px' },
            m: { xs: 1.5, sm: 2 },
          },
        }}
      >
        {/* Header Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 2,
            mb: 2,
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                bgcolor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #a7f3d0',
                flexShrink: 0,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a', lineHeight: 1.2 }}>
                  Registration Successful
                </Typography>
                <Chip
                  label="Active Account"
                  size="small"
                  sx={{
                    bgcolor: '#ecfdf5',
                    color: '#059669',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    height: 22,
                    border: '1px solid #a7f3d0',
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Welcome, <strong>{successDetails?.fullName}</strong>. Please save your login credentials and sponsor details.
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={handleProceedToAccount}
            sx={{
              color: '#94a3b8',
              '&:hover': { color: '#0f172a', bgcolor: '#f1f5f9' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Content: 2 Columns Side by Side */}
        <DialogContent sx={{ p: 0, overflow: 'visible' }}>
          <Grid container spacing={2}>
            {/* Column 1: Login Credentials */}
            <Grid item xs={12} sm={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#0f172a' }}
                  >
                    <LockIcon sx={{ fontSize: 16, color: '#FF7900' }} />
                    Login Credentials
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                    Storefront Access
                  </Typography>
                </Box>

                <Stack spacing={1} sx={{ flex: 1 }}>
                  {/* Username */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 0.85,
                      px: 1.25,
                      bgcolor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      minHeight: 46,
                    }}
                  >
                    <Box sx={{ minWidth: 0, pr: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#64748b',
                          fontWeight: 700,
                          fontSize: '0.68rem',
                          textTransform: 'uppercase',
                          display: 'block',
                          lineHeight: 1.2,
                        }}
                      >
                        Username (Mobile)
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 800,
                          color: '#0f172a',
                          fontFamily: 'monospace',
                          letterSpacing: 0.5,
                          fontSize: '0.92rem',
                        }}
                      >
                        {successDetails?.username}
                      </Typography>
                    </Box>
                    <Tooltip title={copiedField === 'username' ? 'Copied!' : 'Copy Username'} arrow>
                      <IconButton
                        size="small"
                        onClick={() => successDetails && copyToClipboard(successDetails.username, 'username')}
                        sx={{
                          p: 0.5,
                          color: copiedField === 'username' ? '#16a34a' : '#64748b',
                          bgcolor: copiedField === 'username' ? '#ecfdf5' : 'transparent',
                          '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' },
                        }}
                      >
                        {copiedField === 'username' ? (
                          <CheckIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <ContentCopyIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Password */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 0.85,
                      px: 1.25,
                      bgcolor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      minHeight: 46,
                    }}
                  >
                    <Box sx={{ minWidth: 0, pr: 1, overflow: 'hidden' }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#64748b',
                          fontWeight: 700,
                          fontSize: '0.68rem',
                          textTransform: 'uppercase',
                          display: 'block',
                          lineHeight: 1.2,
                        }}
                      >
                        Password
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 800,
                          color: '#0f172a',
                          fontFamily: showPasswordInDialog ? 'monospace' : 'inherit',
                          letterSpacing: showPasswordInDialog ? 0.5 : 2,
                          fontSize: '0.92rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {showPasswordInDialog ? successDetails?.password : '••••••••••••'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Tooltip title={showPasswordInDialog ? 'Hide password' : 'Show password'} arrow>
                        <IconButton
                          size="small"
                          onClick={() => setShowPasswordInDialog((prev) => !prev)}
                          sx={{ p: 0.5, color: '#64748b' }}
                        >
                          {showPasswordInDialog ? (
                            <VisibilityOff sx={{ fontSize: 16 }} />
                          ) : (
                            <Visibility sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={copiedField === 'password' ? 'Copied!' : 'Copy Password'} arrow>
                        <IconButton
                          size="small"
                          onClick={() => successDetails && copyToClipboard(successDetails.password, 'password')}
                          sx={{
                            p: 0.5,
                            color: copiedField === 'password' ? '#16a34a' : '#64748b',
                            bgcolor: copiedField === 'password' ? '#ecfdf5' : 'transparent',
                            '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' },
                          }}
                        >
                          {copiedField === 'password' ? (
                            <CheckIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <ContentCopyIcon sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Customer ID */}
                  {successDetails?.customerId && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        py: 0.85,
                        px: 1.25,
                        bgcolor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        minHeight: 46,
                      }}
                    >
                      <Box sx={{ minWidth: 0, pr: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#64748b',
                            fontWeight: 700,
                            fontSize: '0.68rem',
                            textTransform: 'uppercase',
                            display: 'block',
                            lineHeight: 1.2,
                          }}
                        >
                          Customer ID
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 800,
                            color: '#0f172a',
                            fontFamily: 'monospace',
                            fontSize: '0.92rem',
                          }}
                        >
                          {successDetails.customerId}
                        </Typography>
                      </Box>
                      <Tooltip title={copiedField === 'customerId' ? 'Copied!' : 'Copy Customer ID'} arrow>
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(successDetails.customerId!, 'customerId')}
                          sx={{
                            p: 0.5,
                            color: copiedField === 'customerId' ? '#16a34a' : '#64748b',
                            bgcolor: copiedField === 'customerId' ? '#ecfdf5' : 'transparent',
                            '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' },
                          }}
                        >
                          {copiedField === 'customerId' ? (
                            <CheckIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <ContentCopyIcon sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}

                  {/* Account Email */}
                  <Box
                    sx={{
                      py: 0.75,
                      px: 1.25,
                      bgcolor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      minHeight: 42,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#64748b',
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        textTransform: 'uppercase',
                        display: 'block',
                        lineHeight: 1.2,
                      }}
                    >
                      Email Address
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: '#334155',
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {successDetails?.email}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Grid>

            {/* Column 2: Sponsor Details */}
            <Grid item xs={12} sm={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#0f172a' }}
                  >
                    <VerifiedUserIcon sx={{ fontSize: 16, color: '#16a34a' }} />
                    Sponsor Details
                  </Typography>
                  <Chip
                    label={successDetails?.sponsorType === 'vendor' ? 'Vendor Sponsor' : 'Customer Referral'}
                    size="small"
                    sx={{
                      bgcolor: successDetails?.sponsorType === 'vendor' ? '#fff7ed' : '#eff6ff',
                      color: successDetails?.sponsorType === 'vendor' ? '#c2410c' : '#1d4ed8',
                      border: '1px solid',
                      borderColor: successDetails?.sponsorType === 'vendor' ? '#fed7aa' : '#bfdbfe',
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      height: 20,
                    }}
                  />
                </Box>

                <Stack spacing={1} sx={{ flex: 1 }}>
                  {/* Sponsor Name */}
                  <Box
                    sx={{
                      py: 0.85,
                      px: 1.25,
                      bgcolor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      minHeight: 46,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#64748b',
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        textTransform: 'uppercase',
                        display: 'block',
                        lineHeight: 1.2,
                      }}
                    >
                      Sponsor Name
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        color: '#0f172a',
                        fontSize: '0.92rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {successDetails?.sponsorName}
                    </Typography>
                  </Box>

                  {/* Sponsor Code */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 0.85,
                      px: 1.25,
                      bgcolor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      minHeight: 46,
                    }}
                  >
                    <Box sx={{ minWidth: 0, pr: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#64748b',
                          fontWeight: 700,
                          fontSize: '0.68rem',
                          textTransform: 'uppercase',
                          display: 'block',
                          lineHeight: 1.2,
                        }}
                      >
                        Sponsor / Referral Code
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 800,
                          color: '#0f172a',
                          fontFamily: 'monospace',
                          letterSpacing: 0.5,
                          fontSize: '0.92rem',
                        }}
                      >
                        {successDetails?.sponsorCode}
                      </Typography>
                    </Box>
                    <Tooltip title={copiedField === 'sponsorCode' ? 'Copied!' : 'Copy Sponsor Code'} arrow>
                      <IconButton
                        size="small"
                        onClick={() => successDetails && copyToClipboard(successDetails.sponsorCode, 'sponsorCode')}
                        sx={{
                          p: 0.5,
                          color: copiedField === 'sponsorCode' ? '#16a34a' : '#64748b',
                          bgcolor: copiedField === 'sponsorCode' ? '#ecfdf5' : 'transparent',
                          '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' },
                        }}
                      >
                        {copiedField === 'sponsorCode' ? (
                          <CheckIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <ContentCopyIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Vendor ID / Vendor Name */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 0.85,
                      px: 1.25,
                      bgcolor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      minHeight: 46,
                    }}
                  >
                    <Box sx={{ minWidth: 0, pr: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#64748b',
                          fontWeight: 700,
                          fontSize: '0.68rem',
                          textTransform: 'uppercase',
                          display: 'block',
                          lineHeight: 1.2,
                        }}
                      >
                        Vendor Code / Vendor Name
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          color: '#0f172a',
                          fontSize: '0.92rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {successDetails?.vendorId && successDetails?.vendorName
                          ? `${successDetails.vendorId} / ${successDetails.vendorName}`
                          : successDetails?.vendorName || successDetails?.vendorId || successDetails?.sponsorName || 'Direct Network'}
                      </Typography>
                    </Box>
                    {successDetails?.vendorId && (
                      <Tooltip title={copiedField === 'vendorId' ? 'Copied!' : 'Copy Vendor Code'} arrow>
                        <IconButton
                          size="small"
                          onClick={() => successDetails && copyToClipboard(successDetails.vendorId!, 'vendorId')}
                          sx={{
                            p: 0.5,
                            color: copiedField === 'vendorId' ? '#16a34a' : '#64748b',
                            bgcolor: copiedField === 'vendorId' ? '#ecfdf5' : 'transparent',
                            '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' },
                          }}
                        >
                          {copiedField === 'vendorId' ? (
                            <CheckIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <ContentCopyIcon sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  {/* Referral Program Info */}
                  <Box
                    sx={{
                      py: 0.75,
                      px: 1.25,
                      bgcolor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      minHeight: 42,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#64748b',
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        textTransform: 'uppercase',
                        display: 'block',
                        lineHeight: 1.2,
                      }}
                    >
                      Referral Network
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: '#16a34a',
                        fontSize: '0.85rem',
                      }}
                    >
                      Verified & Connected
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Grid>
          </Grid>

          {/* Compact Reminder Strip */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              mt: 2,
              p: 1.25,
              px: 1.75,
              borderRadius: '8px',
              bgcolor: '#fffbeb',
              border: '1px solid #fef3c7',
            }}
          >
            <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 600, fontSize: '0.78rem' }}>
              Note: Use your Mobile Number (<strong>{successDetails?.username}</strong>) and Password to sign in. Please save these details.
            </Typography>
            <Button
              size="small"
              onClick={handleCopyAll}
              startIcon={
                copiedField === 'all' ? (
                  <CheckIcon sx={{ fontSize: 15, color: '#16a34a' }} />
                ) : (
                  <ContentCopyIcon sx={{ fontSize: 15 }} />
                )
              }
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                py: 0.4,
                px: 1.2,
                flexShrink: 0,
                borderRadius: '6px',
                borderColor: copiedField === 'all' ? '#86efac' : '#cbd5e1',
                color: copiedField === 'all' ? '#16a34a' : '#334155',
                bgcolor: copiedField === 'all' ? '#ecfdf5' : '#ffffff',
                border: '1px solid',
                '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' },
              }}
            >
              {copiedField === 'all' ? 'Copied' : 'Copy All'}
            </Button>
          </Box>
        </DialogContent>

        {/* Footer Actions */}
        <DialogActions
          sx={{
            p: 0,
            pt: 2.25,
            mt: 0.5,
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1.5,
          }}
        >
          <Button
            variant="text"
            onClick={handleGoToLogin}
            startIcon={<LoginIcon sx={{ fontSize: 17 }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: '#64748b',
              '&:hover': { color: '#0f172a', bgcolor: '#f8fafc' },
            }}
          >
            Go to Sign In
          </Button>

          <Button
            variant="contained"
            onClick={handleProceedToAccount}
            startIcon={<ShoppingBagIcon sx={{ fontSize: 18 }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.9rem',
              borderRadius: '8px',
              px: 3,
              py: 0.9,
              bgcolor: '#FF7900',
              boxShadow: '0 2px 8px rgba(255, 121, 0, 0.25)',
              '&:hover': {
                bgcolor: '#e66d00',
                boxShadow: '0 4px 12px rgba(255, 121, 0, 0.35)',
              },
            }}
          >
            Proceed to Shopping
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
