import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  HourglassTop as HourglassIcon,
  Logout as LogoutIcon,
  Refresh as RefreshIcon,
  TwoWheeler as BikeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router';
import api from '../../api/client';
import { useDeliveryAuthStore } from '../../store/auth.store';

export default function DeliveryPendingActivationView() {
  const { partner, updatePartnerProfile, clearAuth } = useDeliveryAuthStore();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setStatusMessage(null);
    try {
      const resp = await api.get('/delivery/me');
      if (resp.data?.success && resp.data.data) {
        const latest = resp.data.data;
        updatePartnerProfile(latest);
        if (latest.status === 'active' && latest.isActive) {
          setStatusMessage('Approved! Your delivery partner account is now active.');
          setTimeout(() => window.location.reload(), 900);
          return;
        }
        setStatusMessage('Your KYC application is still under admin review. Please check back shortly.');
      }
    } catch {
      setStatusMessage('Could not reach verification server. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC', py: { xs: 4, sm: 7 }, px: 2 }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 3.5 }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="E-Shopy"
            sx={{ height: 38, width: 'auto', mx: 'auto', mb: 2 }}
          />
          <Chip
            icon={<HourglassIcon sx={{ fontSize: '15px !important', color: '#B45309' }} />}
            label={partner?.status === 'suspended' ? 'ACCOUNT SUSPENDED' : 'KYC VERIFICATION IN PROGRESS'}
            sx={{
              bgcolor: partner?.status === 'suspended' ? '#FEE2E2' : '#FEF3C7',
              color: partner?.status === 'suspended' ? '#991B1B' : '#92400E',
              fontWeight: 800,
              fontSize: '0.72rem',
            }}
          />
          <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>
            Welcome, {partner?.name || 'Partner'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your Rider ID <strong>{partner?.partnerId}</strong> ({partner?.vehicleType?.toUpperCase()} •{' '}
            {partner?.vehicleNumber}) is awaiting admin KYC verification before you can go online.
          </Typography>
        </Box>

        {statusMessage && (
          <Alert severity={partner?.status === 'active' ? 'success' : 'info'} sx={{ mb: 2.5 }}>
            {statusMessage}
          </Alert>
        )}

        <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3 }}>
          <Stack spacing={2.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CheckCircleIcon sx={{ color: '#10B981' }} />
              <Box>
                <Typography variant="subtitle2" sx={{ color: '#172B30' }}>
                  1. Partner Profile & Vehicle Submitted
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Service City: {partner?.city}, {partner?.state} ({partner?.pincode})
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <HourglassIcon sx={{ color: '#F59E0B' }} />
              <Box>
                <Typography variant="subtitle2" sx={{ color: '#B45309' }}>
                  2. Admin Document & License Approval
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  An administrator verifies your driving license & vehicle details in the Admin Portal.
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, opacity: 0.65 }}>
              <BikeIcon sx={{ color: '#64748B' }} />
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  3. Go Online & Accept Deliveries
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Start claiming orders, navigating routes, and earning per trip.
                </Typography>
              </Box>
            </Box>
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleCheckStatus}
              disabled={isChecking}
              startIcon={isChecking ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
            >
              {isChecking ? 'Checking...' : 'Check Approval Status'}
            </Button>
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              onClick={handleLogout}
              startIcon={<LogoutIcon />}
            >
              Sign Out
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
