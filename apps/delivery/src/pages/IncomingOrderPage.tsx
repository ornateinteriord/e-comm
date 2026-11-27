import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  Check as AcceptIcon,
  Close as RejectIcon,
  Lock as LockIcon,
  NotificationsActive as BellIcon,
  Storefront as PickupIcon,
  VolumeOff as MuteIcon,
  VolumeUp as SoundOnIcon,
} from '@mui/icons-material';
import type { DeliveryAssignment } from '@ornate/types';
import api from '../api/client';
import { useDeliveryAuthStore } from '../store/auth.store';
import type { GeolocationSyncState } from '../hooks/useGeolocationSync';
import { formatRupeesFromPaise } from '../utils/navigation';
import {
  ORDER_BELL_DURATION_MS,
  markNativeAssignmentHandled,
  playConfirmationChime,
  startOrderBellAlert,
  stopOrderBellAlert,
} from '../utils/orderAlertAudio';

const TOTAL_RING_SECONDS = ORDER_BELL_DURATION_MS / 1000;

export default function IncomingOrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { partner, updatePartnerProfile } = useDeliveryAuthStore();
  const outletCtx = useOutletContext<{
    geo?: GeolocationSyncState;
    isKycVerified?: boolean;
    isFullyVerified?: boolean;
  } | null>();

  const [isRinging, setIsRinging] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_RING_SECONDS);
  const [actionError, setActionError] = useState<string | null>(null);

  const cachedAssignment =
    queryClient
      .getQueryData<DeliveryAssignment[]>(['delivery-active-assignments'])
      ?.find((item) => item.id === id || item.assignmentCode === id || item.orderNumber === id) ||
    undefined;

  const {
    data: assignment,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<DeliveryAssignment | null>({
    queryKey: ['delivery-assignment-detail', id],
    initialData: cachedAssignment,
    queryFn: async () => {
      if (!id) return null;
      const resp = await api.get(`/delivery/assignments/${id}`);
      return resp.data?.data || null;
    },
    enabled: Boolean(id),
    refetchInterval: 4_000,
    retry: 2,
  });

  useEffect(() => {
    if (!assignment) return;
    if (assignment.status !== 'assigned') {
      stopOrderBellAlert();
      if (['accepted', 'arrived_pickup', 'picked_up', 'in_transit', 'arrived_customer', 'delivered'].includes(assignment.status)) {
        navigate(`/deliveries/${assignment.id}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [assignment, navigate]);

  useEffect(() => {
    if (!assignment || assignment.status !== 'assigned') return;

    setIsRinging(true);
    setSecondsLeft(TOTAL_RING_SECONDS);

    startOrderBellAlert({
      assignmentId: assignment.id,
      orderNumber: assignment.orderNumber,
      pickupName: assignment.pickupLocation.name,
      pickupCity: assignment.pickupLocation.city,
      payoutText: formatRupeesFromPaise(assignment.payoutPaise),
      durationMs: ORDER_BELL_DURATION_MS,
      onTimeout: () => {
        setIsRinging(false);
        setSecondsLeft(0);
      },
    });

    return () => {
      stopOrderBellAlert();
    };
  }, [assignment?.id, assignment?.status]);

  useEffect(() => {
    if (!isRinging) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          stopOrderBellAlert();
          setIsRinging(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRinging]);

  const isKycVerified = outletCtx?.isKycVerified ?? partner?.kycStatus === 'verified';
  const isFullyVerified =
    outletCtx?.isFullyVerified ??
    (partner?.status === 'active' && Boolean(partner?.isActive) && isKycVerified);
  const isOnDuty =
    partner?.availabilityStatus === 'online' || partner?.availabilityStatus === 'on_delivery';
  const isGpsReady = outletCtx?.geo?.isGpsReady ?? false;
  const canAccept = isFullyVerified && isOnDuty && isGpsReady;

  const blockedReason = !isKycVerified
    ? 'Complete KYC verification before accepting orders.'
    : !isGpsReady
      ? 'Live GPS is required before accepting this delivery.'
      : !isOnDuty
        ? 'Switch your status to Online before accepting this delivery.'
        : null;

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!assignment) throw new Error('Assignment missing');
      await markNativeAssignmentHandled(assignment.id);
      const resp = await api.post(`/delivery/assignments/${assignment.id}/accept`);
      return resp.data?.data as DeliveryAssignment;
    },
    onSuccess: (accepted) => {
      setIsRinging(false);
      setActionError(null);
      updatePartnerProfile({ availabilityStatus: 'on_delivery' });
      playConfirmationChime();
      queryClient.invalidateQueries({ queryKey: ['delivery-me'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-active-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-available-orders'] });
      navigate(`/deliveries/${accepted.id}`, { replace: true });
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setActionError(axiosErr.response?.data?.error?.message || 'Could not accept assignment.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!assignment) return;
      await markNativeAssignmentHandled(assignment.id);
      await api.post(`/delivery/assignments/${assignment.id}/reject`, {
        reason: 'Declined by delivery partner',
      });
    },
    onSuccess: () => {
      setIsRinging(false);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['delivery-me'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-active-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-history-assignments'] });
      navigate('/', { replace: true });
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setActionError(axiosErr.response?.data?.error?.message || 'Could not decline assignment.');
    },
  });

  const handleGoOnlineQuick = async () => {
    setActionError(null);
    const coords = outletCtx?.geo?.coords || (await outletCtx?.geo?.pingNow());
    if (!coords) {
      setActionError('Enable device GPS to go online and accept this job.');
      return;
    }
    try {
      const resp = await api.patch('/delivery/me/availability', {
        availabilityStatus: 'online',
        lat: coords.lat,
        lng: coords.lng,
      });
      if (resp.data?.success && resp.data.data) {
        updatePartnerProfile(resp.data.data);
      }
    } catch {
      setActionError('Could not switch online right now.');
    }
  };

  if (isLoading && !assignment) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const errorStatus = (error as { response?: { status?: number } } | null)?.response?.status;
  if (!assignment && isError && errorStatus !== 404) {
    return (
      <Box sx={{ maxWidth: 460, mx: 'auto', py: 6, px: 2, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Unable to Load Order Details
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Network connection interrupted while loading this delivery assignment. Tap retry or check your server connection.
        </Typography>
        <Stack direction="row" spacing={1.25} justifyContent="center">
          <Button variant="outlined" onClick={() => navigate('/', { replace: true })}>
            Back to Dispatch
          </Button>
          <Button variant="contained" onClick={() => refetch()}>
            Retry
          </Button>
        </Stack>
      </Box>
    );
  }

  if (!assignment) {
    if (id) {
      markNativeAssignmentHandled(id).catch(() => undefined);
    }
    return (
      <Box sx={{ maxWidth: 460, mx: 'auto', py: 6, px: 2, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Order Assignment Unavailable
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          This delivery assignment was already handled or cancelled.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/', { replace: true })}>
          Back to Dispatch
        </Button>
      </Box>
    );
  }

  const progressPct = Math.max(0, Math.min(100, (secondsLeft / TOTAL_RING_SECONDS) * 100));
  const totalItemQty = assignment.itemsSummary.reduce(
    (sum, item) => sum + Number(item.quantity || 1),
    0,
  );
  const dropZoneLabel =
    assignment.dropAreaLabel ||
    [assignment.dropLocation?.city, assignment.dropLocation?.pincode].filter(Boolean).join(' - ') ||
    'Delivery Zone';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#F9FAFB',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 540,
        mx: 'auto',
      }}
    >
      {/* Top Urgent Header */}
      <Box sx={{ bgcolor: '#111827', color: '#FFFFFF', px: 2.5, pt: 2.5, pb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                bgcolor: isRinging ? '#FF7900' : '#374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BellIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#FDBA74', fontWeight: 800, letterSpacing: '0.06em' }}>
                INCOMING DELIVERY ORDER
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
                Order #{assignment.orderNumber}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Chip
              size="small"
              label={isRinging ? `${secondsLeft}s` : 'Muted'}
              sx={{
                bgcolor: isRinging ? '#EA580C' : '#374151',
                color: '#FFFFFF',
                fontWeight: 800,
                minWidth: 52,
              }}
            />
            <IconButton
              size="small"
              onClick={() => {
                if (isRinging) {
                  stopOrderBellAlert();
                  setIsRinging(false);
                }
              }}
              sx={{ color: '#E5E7EB', bgcolor: 'rgba(255,255,255,0.08)' }}
              aria-label="Mute ringtone"
            >
              {isRinging ? <SoundOnIcon fontSize="small" /> : <MuteIcon fontSize="small" />}
            </IconButton>
          </Stack>
        </Stack>

        <LinearProgress
          variant="determinate"
          value={isRinging ? progressPct : 0}
          sx={{
            mt: 1.75,
            height: 6,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.14)',
            '& .MuiLinearProgress-bar': {
              bgcolor: secondsLeft <= 8 ? '#EF4444' : '#FF7900',
              borderRadius: 999,
            },
          }}
        />
        <Typography variant="caption" sx={{ color: '#D1D5DB', display: 'block', mt: 0.75 }}>
          {isRinging
            ? `Bell ringtone playing (${secondsLeft}s) — tap Accept or Decline to stop`
            : 'Bell sound stopped after 30s — Accept or Decline below'}
        </Typography>
      </Box>

      {/* Main Details */}
      <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {actionError && <Alert severity="error">{actionError}</Alert>}

        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                TRIP PAYOUT
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#059669' }}>
                {formatRupeesFromPaise(assignment.payoutPaise)}
              </Typography>
            </Box>
            <Stack alignItems="flex-end" spacing={0.5}>
              <Chip
                size="small"
                label={assignment.isCod ? `COD ${formatRupeesFromPaise(assignment.codAmountPaise)}` : 'PREPAID'}
                sx={{
                  fontWeight: 700,
                  bgcolor: assignment.isCod ? '#FEF3C7' : '#DCFCE7',
                  color: assignment.isCod ? '#B45309' : '#15803D',
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                {totalItemQty} {totalItemQty === 1 ? 'item' : 'items'}
                {typeof assignment.distanceKm === 'number' ? ` • ${assignment.distanceKm} km away` : ''}
              </Typography>
            </Stack>
          </Stack>
        </Paper>

        {/* Pickup Address ONLY */}
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #FED7AA', bgcolor: '#FFFBF7' }}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <PickupIcon sx={{ color: '#EA580C', mt: 0.25 }} />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#C2410C' }}>
                PICKUP STORE ADDRESS
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {assignment.pickupLocation.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {assignment.pickupLocation.line1}
                {assignment.pickupLocation.line2 ? `, ${assignment.pickupLocation.line2}` : ''},{' '}
                {assignment.pickupLocation.city} - {assignment.pickupLocation.pincode}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Drop Zone Locked */}
        <Paper elevation={0} sx={{ p: 1.75, borderRadius: 2, border: '1px solid #E5E7EB', bgcolor: '#FFFFFF' }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <LockIcon fontSize="small" sx={{ color: '#6B7280' }} />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#374151' }}>
                DELIVERY ZONE: {dropZoneLabel}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Customer name, phone, and exact drop address unlock only after pickup confirmation.
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {!canAccept && blockedReason && (
          <Alert
            severity="warning"
            action={
              isFullyVerified && (!isGpsReady || !isOnDuty) ? (
                <Button size="small" color="inherit" onClick={handleGoOnlineQuick}>
                  {!isGpsReady ? 'Enable GPS' : 'Go Online'}
                </Button>
              ) : undefined
            }
          >
            {blockedReason}
          </Alert>
        )}
      </Box>

      {/* Bottom Sticky Accept / Decline Controls */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderTop: '1px solid #E5E7EB',
          bgcolor: '#FFFFFF',
          borderRadius: 0,
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ mb: 1 }}>
          <Button
            fullWidth
            size="large"
            variant="outlined"
            color="error"
            disabled={acceptMutation.isPending || rejectMutation.isPending}
            onClick={() => {
              stopOrderBellAlert();
              setIsRinging(false);
              rejectMutation.mutate();
            }}
            startIcon={rejectMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <RejectIcon />}
          >
            {rejectMutation.isPending ? 'Declining...' : 'Decline'}
          </Button>
          <Button
            fullWidth
            size="large"
            variant="contained"
            color="success"
            disabled={!canAccept || acceptMutation.isPending || rejectMutation.isPending}
            onClick={() => {
              stopOrderBellAlert();
              setIsRinging(false);
              acceptMutation.mutate();
            }}
            startIcon={acceptMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <AcceptIcon />}
          >
            {acceptMutation.isPending ? 'Accepting...' : 'Accept Order'}
          </Button>
        </Stack>

        <Divider sx={{ my: 1 }} />
        <Button
          fullWidth
          size="small"
          color="inherit"
          disabled={acceptMutation.isPending || rejectMutation.isPending}
          onClick={async () => {
            if (assignment) {
              await markNativeAssignmentHandled(assignment.id);
            }
            setIsRinging(false);
            navigate('/', { replace: true });
          }}
          sx={{ color: '#6B7280', fontSize: '0.78rem' }}
        >
          Mute & Decide Later in My Tasks
        </Button>
      </Paper>
    </Box>
  );
}
