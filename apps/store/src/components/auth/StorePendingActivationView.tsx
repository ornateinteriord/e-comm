import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  Grid,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  HourglassTop as HourglassIcon,
  Refresh as RefreshIcon,
  Storefront as StorefrontIcon,
  CheckCircle as CheckCircleIcon,
  Place as PlaceIcon,
  VerifiedUser as VerifiedIcon,
  Category as CategoryIcon,
  Logout as LogoutIcon,
  HelpOutline as HelpIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useStoreAuthStore } from '../../store/auth.store';
import api from '../../api/client';
import { useNavigate } from 'react-router';

export default function StorePendingActivationView() {
  const { store, updateStoreProfile, clearAuth } = useStoreAuthStore();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setStatusMessage(null);
    try {
      const resp = await api.get('/store/me');
      if (resp.data?.success && resp.data.data) {
        const latestStore = resp.data.data;
        updateStoreProfile(latestStore);
        if (latestStore.status === 'active' && latestStore.isActive) {
          setStatusMessage('Congratulations! Your store is now active. Refreshing dashboard...');
          setTimeout(() => {
            window.location.reload();
          }, 1200);
          return;
        } else {
          setStatusMessage('Your store application is currently in review. Our admin team will activate it shortly.');
        }
      }
    } catch (err: any) {
      console.error('Failed to refresh store status', err);
      setStatusMessage('Unable to connect to verification server. Please try again in a moment.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC', py: { xs: 4, sm: 8 } }}>
      <Container maxWidth="md">
        {/* Brand Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            component="img"
            src="/logo-dark.svg"
            alt="E-Shopy"
            sx={{ height: 40, width: 'auto', maxWidth: 200, objectFit: 'contain', mx: 'auto', mb: 2 }}
          />
          <Chip
            icon={<HourglassIcon sx={{ fontSize: '15px !important', color: '#B45309' }} />}
            label="PENDING ADMIN ACTIVATION"
            sx={{
              bgcolor: '#FEF3C7',
              color: '#92400E',
              fontWeight: 800,
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
              px: 1,
              py: 0.5,
              border: '1px solid #FDE68A',
            }}
          />
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#172B30', mt: 2, mb: 1 }}>
            Store Application Received & Under Review
          </Typography>
          <Typography variant="body1" sx={{ color: '#64748B', maxWidth: 620, mx: 'auto' }}>
            Welcome, <strong>{store?.ownerName || 'Partner'}</strong>! Your store registration for{' '}
            <strong>{store?.name || 'your store'}</strong> has been recorded. Our administration team is reviewing your category allocation and store coordinates.
          </Typography>
        </Box>

        {statusMessage && (
          <Alert
            severity={store?.status === 'active' ? 'success' : 'info'}
            sx={{ mb: 3, borderRadius: 2.5 }}
          >
            {statusMessage}
          </Alert>
        )}

        {/* Main Card */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            bgcolor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
          }}
        >
          {/* Store Profile Summary */}
          <Box sx={{ mb: 3.5 }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Registered Store Profile
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mt: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#172B30' }}>
                  {store?.name}
                </Typography>
                <Typography variant="body2" sx={{ color: '#FF7900', fontWeight: 700 }}>
                  Store ID: {store?.storeId}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  icon={<CategoryIcon sx={{ fontSize: '14px !important', color: '#EA580C' }} />}
                  label={`Category: ${store?.categoryName || 'Assigned'}`}
                  size="small"
                  sx={{ bgcolor: '#FFF7ED', color: '#C2410C', fontWeight: 700, border: '1px solid #FFEDD5' }}
                />
                <Chip
                  label={store?.typeOfStore || 'Standard (Fulfillment Hub)'}
                  size="small"
                  sx={{ bgcolor: '#F1F5F9', color: '#475569', fontWeight: 600 }}
                />
              </Stack>
            </Box>

            <Grid container spacing={2} sx={{ mt: 1.5 }}>
              <Grid item xs={12} sm={6}>
                <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                    Store Address & Location
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#172B30', mt: 0.5 }}>
                    {store?.address?.line1 || 'Registered Address'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <PlaceIcon sx={{ fontSize: 14, color: '#94A3B8' }} />
                    {store?.address?.city}, {store?.address?.state} - {store?.address?.pincode}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                    Verified Sponsor / Vendor
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#172B30', mt: 0.5 }}>
                    {store?.referralName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#2563EB', fontWeight: 700, display: 'block', mt: 0.5 }}>
                    Code: {store?.referralCode} ({store?.referralType === 'vendor' ? 'Authorized Vendor' : 'Partner Store'})
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Verification Steps Roadmap */}
          <Box sx={{ mb: 3.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#172B30', mb: 2 }}>
              Verification & Activation Roadmap
            </Typography>

            <Stack spacing={2}>
              {/* Step 1 */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: '#ECFDF5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CheckCircleIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                    1. Application & Credentials Created
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    Your partner credentials and exclusive category reservation have been securely registered.
                  </Typography>
                </Box>
              </Box>

              {/* Step 2 */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: '#FEF3C7',
                    color: '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    animation: 'pulse 2s infinite',
                  }}
                >
                  <HourglassIcon sx={{ fontSize: 18 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#D97706' }}>
                    2. Admin Verification & Territory Check (In Progress)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    The central administrator is currently reviewing the exclusivity of your assigned category ({store?.categoryName}) and verifying location coverage.
                  </Typography>
                </Box>
              </Box>

              {/* Step 3 */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, opacity: 0.6 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: '#F1F5F9',
                    color: '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <StorefrontIcon sx={{ fontSize: 18 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748B' }}>
                    3. Store Operational Activation
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                    Once activated by admin, your dashboard will automatically unlock for adding category products and fulfilling customer orders.
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Action Row */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleCheckStatus}
              disabled={isChecking}
              startIcon={isChecking ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
              sx={{ fontWeight: 700, px: 3, py: 1.25 }}
            >
              {isChecking ? 'Checking Status...' : 'Check Approval Status'}
            </Button>

            <Button
              variant="outlined"
              color="secondary"
              onClick={handleLogout}
              startIcon={<LogoutIcon />}
              sx={{ borderColor: '#CBD5E1', color: '#475569' }}
            >
              Sign Out
            </Button>
          </Box>
        </Paper>

        {/* Footer Support Info */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="caption" sx={{ color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            <EmailIcon sx={{ fontSize: 14 }} /> Need priority activation? Contact admin team at <strong>admin@ornate.dev</strong>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

