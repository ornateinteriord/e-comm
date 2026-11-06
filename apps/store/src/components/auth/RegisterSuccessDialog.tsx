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
} from '@mui/icons-material';

export interface StoreRegistrationDetails {
  storeId: string;
  name: string;
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
      'Store Portal Login: https://store.eshopy.biz/login',
      '========================================',
    ].join('\n');

    copyToClipboard(lines, 'all');
  };

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: { xs: 2, sm: 3 },
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Stack spacing={2.5} alignItems="center" textAlign="center">
          {/* Header Icon */}
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: '#ECFDF5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 40, color: '#10B981' }} />
          </Box>

          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#172B30' }}>
              Store Created Successfully!
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
              Welcome to the E-Shophy Partner Network. Please copy and record your store credentials below.
            </Typography>
          </Box>

          <Alert severity="warning" sx={{ width: '100%', borderRadius: 2, textAlign: 'left', fontSize: '0.85rem' }}>
            <strong>Important:</strong> Your contact mobile number is your store login username. Please copy your password securely now.
          </Alert>

          {/* Credentials Box */}
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              p: 2.5,
              borderRadius: 2.5,
              bgcolor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              textAlign: 'left',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockIcon sx={{ fontSize: 18, color: '#FF7900' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                  Store Credentials
                </Typography>
              </Box>
              <Chip label="Confidential" size="small" color="error" sx={{ fontSize: '0.7rem', height: 22 }} />
            </Box>

            <Stack spacing={1.75}>
              {/* Store ID */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>Store ID</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#FF7900' }}>
                    {details.storeId}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => copyToClipboard(details.storeId, 'storeId')}
                  startIcon={copiedField === 'storeId' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                  sx={{ py: 0.25, px: 1, minWidth: 70, fontSize: '0.75rem' }}
                >
                  {copiedField === 'storeId' ? 'Copied' : 'Copy'}
                </Button>
              </Box>

              <Divider sx={{ borderColor: '#E2E8F0' }} />

              {/* Username (Mobile) */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>Username (Mobile Number)</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#172B30' }}>
                    {details.mobileNumber}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => copyToClipboard(details.mobileNumber, 'mobile')}
                  startIcon={copiedField === 'mobile' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                  sx={{ py: 0.25, px: 1, minWidth: 70, fontSize: '0.75rem' }}
                >
                  {copiedField === 'mobile' ? 'Copied' : 'Copy'}
                </Button>
              </Box>

              <Divider sx={{ borderColor: '#E2E8F0' }} />

              {/* Password */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>Password</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#172B30' }}>
                    {showPassword ? details.password : '••••••••••••'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => copyToClipboard(details.password, 'password')}
                    startIcon={copiedField === 'password' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                    sx={{ py: 0.25, px: 1, minWidth: 70, fontSize: '0.75rem' }}
                  >
                    {copiedField === 'password' ? 'Copied' : 'Copy'}
                  </Button>
                </Stack>
              </Box>

              <Divider sx={{ borderColor: '#E2E8F0' }} />

              {/* Category & Store Name */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>Store Name & Assigned Category</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#172B30' }}>
                    {details.name} • <Chip label={details.categoryName} size="small" sx={{ bgcolor: '#FFF7ED', color: '#FF7900', fontWeight: 700, height: 20 }} />
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </Paper>

          {/* Sponsor Summary */}
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              p: 2,
              borderRadius: 2,
              bgcolor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              textAlign: 'left',
            }}
          >
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
              VERIFIED REFERRING SPONSOR
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#172B30' }}>
                {details.referralName} ({details.referralCode})
              </Typography>
              <Chip
                label={details.referralType === 'vendor' ? 'Vendor Sponsor' : 'Store Referral'}
                size="small"
                sx={{ bgcolor: '#EFF6FF', color: '#2563EB', fontWeight: 700, fontSize: '0.7rem' }}
              />
            </Box>
          </Paper>

          {/* Copy All Button */}
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            onClick={handleCopyAll}
            startIcon={copiedField === 'all' ? <CheckIcon /> : <ContentCopyIcon />}
            sx={{ py: 1.25, fontWeight: 700 }}
          >
            {copiedField === 'all' ? 'All Credentials Copied!' : 'Copy All Details to Clipboard'}
          </Button>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 0, mt: 3, display: 'flex', gap: 1.5 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={onGoToLogin}
          startIcon={<LoginIcon />}
          sx={{ py: 1.25 }}
        >
          Go to Sign In
        </Button>
        <Button
          fullWidth
          variant="contained"
          onClick={onProceedToDashboard}
          endIcon={<ArrowForwardIcon />}
          sx={{ py: 1.25 }}
        >
          Proceed to Dashboard
        </Button>
      </DialogActions>
    </Dialog>
  );
}

