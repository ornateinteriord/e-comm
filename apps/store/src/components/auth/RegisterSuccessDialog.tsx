import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Stack,
  Button,
  IconButton,
  Chip,
  Paper,
  Divider,
  Alert,
  Grid,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  Visibility,
  VisibilityOff,
  Storefront as StorefrontIcon,
  Lock as LockIcon,
  Login as LoginIcon,
  ArrowForward as ArrowForwardIcon,
  HourglassTop as HourglassIcon,
  Place as PlaceIcon,
} from '@mui/icons-material';

export interface StoreRegistrationDetails {
  storeId: string;
  name: string;
  typeOfStore?: string;
  ownerName: string;
  email: string;
  mobileNumber: string;
  password: string;
  categoryName: string;
  referralCode: string;
  referralName: string;
  referralType: 'vendor' | 'store';
  city?: string;
  state?: string;
}

interface RegisterSuccessDialogProps {
  open: boolean;
  details: StoreRegistrationDetails | null;
  onProceedToDashboard: () => void;
  onGoToLogin: () => void;
}

export default function RegisterSuccessDialog({
  open,
  details,
  onProceedToDashboard,
  onGoToLogin,
}: RegisterSuccessDialogProps) {
  const [showPassword, setShowPassword] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!details) return null;

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
      setTimeout(() => setCopiedField(null), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleCopyAll = () => {
    const lines = [
      '========================================',
      'E-SHOPHY PARTNER STORE CREDENTIALS',
      '========================================',
      `Store ID: ${details.storeId}`,
      `Store Name: ${details.name}`,
      `Store Type: ${details.typeOfStore || 'Standard (Fulfillment Hub)'}`,
      `Assigned Category: ${details.categoryName}`,
      `Owner Name: ${details.ownerName}`,
      `Username (Mobile): ${details.mobileNumber}`,
      `Password: ${details.password}`,
      '',
      'SPONSOR DETAILS:',
      `Sponsor Name: ${details.referralName}`,
      `Sponsor Code: ${details.referralCode}`,
      `Sponsor Type: ${details.referralType === 'vendor' ? 'Authorized Vendor' : 'Partner Store'}`,
      '',
      'LOCATION:',
      `City / State: ${details.city || ''}, ${details.state || ''}`,
      'Status: Pending Administrative Activation',
      'LOCATION:',
      `City / State: ${details.city || ''}, ${details.state || ''}`,
      'Status: Pending Administrative Activation',
      'Store Portal Login: http://localhost:5175/login',

      '========================================',
    ].join('\n');

    copyToClipboard(lines, 'all');
  };

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: { xs: 2.5, sm: 3 },
          maxWidth: 820,
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Header Ribbon */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                bgcolor: '#ECFDF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#172B30', lineHeight: 1.2 }}>
                Store Account Registered!
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Save your login credentials securely. Your store is submitted for administrator review.
              </Typography>
            </Box>
          </Box>

          <Chip
            icon={<HourglassIcon sx={{ fontSize: '14px !important', color: '#B45309' }} />}
            label="Pending Admin Activation"
            size="small"
            sx={{
              bgcolor: '#FEF3C7',
              color: '#92400E',
              fontWeight: 700,
              fontSize: '0.72rem',
              border: '1px solid #FDE68A',
            }}
          />
        </Box>

        <Alert severity="warning" sx={{ mb: 2.5, py: 0.5, borderRadius: 2, fontSize: '0.8rem' }}>
          <strong>Notice:</strong> Your mobile number is your store login username. Keep your password confidential.
        </Alert>

        {/* 2-Column Wide Grid Layout */}
        <Grid container spacing={2.5}>
          {/* Column 1: Login Credentials */}
          <Grid item xs={12} sm={6}>
            <Paper
              elevation={0}
              sx={{
                height: '100%',
                p: 2,
                borderRadius: 2.5,
                bgcolor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <LockIcon sx={{ fontSize: 16, color: '#FF7900' }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                      Login Credentials
                    </Typography>
                  </Box>
                  <Chip label="Confidential" size="small" color="error" sx={{ fontSize: '0.65rem', height: 18 }} />
                </Box>

                <Stack spacing={1.25}>
                  {/* Store ID */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', lineHeight: 1 }}>
                        Store ID
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#FF7900' }}>
                        {details.storeId}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => copyToClipboard(details.storeId, 'storeId')}
                      startIcon={copiedField === 'storeId' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                      sx={{ py: 0.2, px: 1, minWidth: 64, fontSize: '0.7rem' }}
                    >
                      {copiedField === 'storeId' ? 'Copied' : 'Copy'}
                    </Button>
                  </Box>

                  <Divider sx={{ borderColor: '#E2E8F0' }} />

                  {/* Username (Mobile) */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', lineHeight: 1 }}>
                        Username (Mobile)
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                        {details.mobileNumber}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => copyToClipboard(details.mobileNumber, 'mobile')}
                      startIcon={copiedField === 'mobile' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                      sx={{ py: 0.2, px: 1, minWidth: 64, fontSize: '0.7rem' }}
                    >
                      {copiedField === 'mobile' ? 'Copied' : 'Copy'}
                    </Button>
                  </Box>

                  <Divider sx={{ borderColor: '#E2E8F0' }} />

                  {/* Password */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', lineHeight: 1 }}>
                        Password
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                        {showPassword ? details.password : '••••••••••••'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                      </IconButton>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => copyToClipboard(details.password, 'password')}
                        startIcon={copiedField === 'password' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                        sx={{ py: 0.2, px: 1, minWidth: 64, fontSize: '0.7rem' }}
                      >
                        {copiedField === 'password' ? 'Copied' : 'Copy'}
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            </Paper>
          </Grid>

          {/* Column 2: Store & Sponsor Profile */}
          <Grid item xs={12} sm={6}>
            <Paper
              elevation={0}
              sx={{
                height: '100%',
                p: 2,
                borderRadius: 2.5,
                bgcolor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Stack spacing={1.5}>
                {/* Store Profile Info */}
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                    Store Profile
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#172B30', mt: 0.25 }}>
                    {details.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip
                      label={details.categoryName}
                      size="small"
                      sx={{ bgcolor: '#FFF7ED', color: '#FF7900', fontWeight: 700, fontSize: '0.68rem', height: 20 }}
                    />
                    {details.typeOfStore && (
                      <Chip
                        label={details.typeOfStore}
                        size="small"
                        sx={{ bgcolor: '#F1F5F9', color: '#475569', fontWeight: 600, fontSize: '0.68rem', height: 20 }}
                      />
                    )}
                  </Box>
                  {details.city && (
                    <Typography variant="caption" sx={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
                      <PlaceIcon sx={{ fontSize: 13, color: '#94A3B8' }} /> {details.city}, {details.state}
                    </Typography>
                  )}
                </Box>

                <Divider sx={{ borderColor: '#E2E8F0' }} />

                {/* Verified Sponsor */}
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                    Verified Sponsor
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.25 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                        {details.referralName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>
                        Code: {details.referralCode}
                      </Typography>
                    </Box>
                    <Chip
                      label={details.referralType === 'vendor' ? 'Vendor' : 'Store'}
                      size="small"
                      sx={{ bgcolor: '#EFF6FF', color: '#2563EB', fontWeight: 700, fontSize: '0.68rem', height: 20 }}
                    />
                  </Box>
                </Box>
              </Stack>

              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                size="small"
                onClick={handleCopyAll}
                startIcon={copiedField === 'all' ? <CheckIcon /> : <ContentCopyIcon />}
                sx={{ mt: 1.5, py: 0.75, fontWeight: 700, fontSize: '0.75rem' }}
              >
                {copiedField === 'all' ? 'Copied Everything!' : 'Copy All Details'}
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 0, mt: 2.5, display: 'flex', gap: 1.5 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={onGoToLogin}
          startIcon={<LoginIcon />}
          sx={{ py: 1 }}
        >
          Go to Sign In
        </Button>
        <Button
          fullWidth
          variant="contained"
          onClick={onProceedToDashboard}
          endIcon={<ArrowForwardIcon />}
          sx={{ py: 1 }}
        >
          Proceed to Store Portal
        </Button>
      </DialogActions>
    </Dialog>
  );
}
