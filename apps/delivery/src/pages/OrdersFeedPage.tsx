import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  ArrowForward as ArrowIcon,
  Check as AcceptIcon,
  Close as RejectIcon,
  DirectionsBike as BikeIcon,
  LocalShipping as ShippingIcon,
  Lock as LockIcon,
  Place as PlaceIcon,
  Refresh as RefreshIcon,
  Storefront as StoreIcon,
} from '@mui/icons-material';
import type { AvailableDeliveryOrder, DeliveryAssignment, DeliveryAssignmentStatus } from '@ornate/types';
import api from '../api/client';
import { useDeliveryAuthStore } from '../store/auth.store';
import type { GeolocationSyncState } from '../hooks/useGeolocationSync';
import DispatchRadarSearch from '../components/common/DispatchRadarSearch';
import { formatRupeesFromPaise, isAssignmentDropUnlocked } from '../utils/navigation';
import { playConfirmationChime, stopOrderBellAlert } from '../utils/orderAlertAudio';

const STATUS_DISPLAY: Record<DeliveryAssignmentStatus, string> = {
  assigned: 'New Assignment — Accept or Decline',
  accepted: 'Head to Pickup Store',
  arrived_pickup: 'Arrived at Store — Confirm Pickup',
  picked_up: 'Picked Up — Ready for Delivery',
  in_transit: 'On the Way to Customer',
  arrived_customer: 'At Customer Door — Verify OTP',
  delivered: 'Delivered',
  failed: 'Delivery Issue Reported',
  cancelled: 'Cancelled',
};

export default function OrdersFeedPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { partner, updatePartnerProfile } = useDeliveryAuthStore();
  const outletCtx = useOutletContext<{
    geo?: GeolocationSyncState;
    isKycVerified?: boolean;
  } | null>();

  const [tab, setTab] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const isKycVerified = outletCtx?.isKycVerified ?? partner?.kycStatus === 'verified';
  const isGpsReady = outletCtx?.geo?.isGpsReady ?? false;
  const isDutyOnline =
    partner?.availabilityStatus === 'online' || partner?.availabilityStatus === 'on_delivery';
  const canClaimOrAccept = isKycVerified && isDutyOnline && isGpsReady;

  const {
    data: availableOrders = [],
    isLoading: isLoadingAvailable,
    refetch: refetchAvailable,
  } = useQuery<AvailableDeliveryOrder[]>({
    queryKey: ['delivery-available-orders'],
    queryFn: async () => {
      const resp = await api.get('/delivery/orders/available');
      return resp.data?.data?.items || [];
    },
    refetchInterval: 15_000,
    placeholderData: (prev) => prev,
  });

  const {
    data: activeAssignments = [],
    refetch: refetchActive,
  } = useQuery<DeliveryAssignment[]>({
    queryKey: ['delivery-active-assignments'],
    queryFn: async () => {
      const resp = await api.get('/delivery/assignments?scope=active');
      return resp.data?.data?.items || [];
    },
    refetchInterval: 5_000,
    placeholderData: (prev) => prev,
  });

  const { data: historyAssignments = [], isLoading: isLoadingHistory } = useQuery<DeliveryAssignment[]>({
    queryKey: ['delivery-history-assignments'],
    queryFn: async () => {
      const resp = await api.get('/delivery/assignments?scope=history');
      return resp.data?.data?.items || [];
    },
    enabled: tab === 2,
    placeholderData: (prev) => prev,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['delivery-me'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-available-orders'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-active-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-history-assignments'] });
  };

  const claimMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const resp = await api.post(`/delivery/orders/${orderId}/claim`);
      return resp.data?.data as DeliveryAssignment;
    },
    onSuccess: (assignment) => {
      setActionError(null);
      updatePartnerProfile({ availabilityStatus: 'on_delivery' });
      playConfirmationChime();
      invalidateAll();
      navigate(`/deliveries/${assignment.id}`);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setActionError(axiosErr.response?.data?.error?.message || 'Could not claim order.');
      invalidateAll();
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      stopOrderBellAlert();
      const resp = await api.post(`/delivery/assignments/${assignmentId}/accept`);
      return resp.data?.data as DeliveryAssignment;
    },
    onSuccess: (assignment) => {
      setActionError(null);
      stopOrderBellAlert();
      updatePartnerProfile({ availabilityStatus: 'on_delivery' });
      playConfirmationChime();
      invalidateAll();
      navigate(`/deliveries/${assignment.id}`);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setActionError(axiosErr.response?.data?.error?.message || 'Could not accept assignment.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      stopOrderBellAlert();
      await api.post(`/delivery/assignments/${assignmentId}/reject`, {
        reason: 'Declined by delivery partner',
      });
    },
    onSuccess: () => {
      setActionError(null);
      stopOrderBellAlert();
      invalidateAll();
    },
  });

  const refreshAll = () => {
    refetchAvailable();
    refetchActive();
  };

  const ongoingTrip = activeAssignments.find((a) => a.status !== 'assigned');
  const pendingAssignedTrip = activeAssignments.find((a) => a.status === 'assigned');
  const bannerTrip = ongoingTrip || pendingAssignedTrip || null;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">Delivery Dispatch</Typography>
          <Typography variant="body2" color="text.secondary">
            Claim available deliveries or manage assigned pickups
          </Typography>
        </Box>
        <IconButton
          onClick={refreshAll}
          aria-label="Refresh orders"
          sx={{ bgcolor: '#FFFFFF', border: '1px solid #E5E7EB', flexShrink: 0 }}
        >
          <RefreshIcon />
        </IconButton>
      </Stack>

      {/* Active Trip Banner on Starting Page */}
      {bannerTrip && (
        <Paper
          elevation={0}
          sx={{
            p: 1.75,
            mb: 2,
            borderRadius: 2,
            bgcolor: '#111827',
            color: '#FFFFFF',
            border: '1px solid #1F2937',
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={1.5}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: bannerTrip.status === 'assigned' ? '#F59E0B' : '#10B981',
                    flexShrink: 0,
                  }}
                />
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#FDBA74', letterSpacing: '0.04em' }}>
                  {bannerTrip.status === 'assigned' ? 'PENDING ASSIGNMENT' : 'ACTIVE TRIP IN PROGRESS'} • #
                  {bannerTrip.orderNumber}
                </Typography>
              </Stack>
              <Typography variant="subtitle2" noWrap sx={{ color: '#FFFFFF', fontWeight: 700 }}>
                {STATUS_DISPLAY[bannerTrip.status]}
              </Typography>
              <Typography variant="caption" noWrap sx={{ color: '#D1D5DB', display: 'block' }}>
                {isAssignmentDropUnlocked(bannerTrip)
                  ? `Deliver to ${bannerTrip.dropLocation.name} (${bannerTrip.dropLocation.city})`
                  : `Pickup: ${bannerTrip.pickupLocation.name} (${bannerTrip.pickupLocation.city})`}
              </Typography>
            </Box>

            <Button
              variant="contained"
              size="small"
              endIcon={<ArrowIcon />}
              onClick={() =>
                navigate(
                  bannerTrip.status === 'assigned'
                    ? `/incoming-order/${bannerTrip.id}`
                    : `/deliveries/${bannerTrip.id}`,
                )
              }
              sx={{ flexShrink: 0, fontWeight: 700 }}
            >
              {bannerTrip.status === 'assigned' ? 'Review Order' : 'Open Active Trip'}
            </Button>
          </Stack>
        </Paper>
      )}

      {!canClaimOrAccept && (
        <Alert
          severity="info"
          action={
            isKycVerified && !isGpsReady ? (
              <Button size="small" color="inherit" onClick={() => outletCtx?.geo?.pingNow()}>
                Enable GPS
              </Button>
            ) : undefined
          }
          sx={{ mb: 2, borderRadius: 2 }}
        >
          {!isKycVerified
            ? 'Complete KYC verification in Profile before claiming or accepting orders.'
            : !isGpsReady
              ? 'Live GPS is off. Enable location access to update pickups and claim orders.'
              : 'You are currently Offline. Switch Online in the top bar to claim orders.'}
        </Alert>
      )}

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <Paper elevation={0} sx={{ mb: 2, border: '1px solid #E5E7EB', borderRadius: 2 }}>
        <Tabs
          value={tab}
          onChange={(_e, val) => setTab(val)}
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab label={`Available (${availableOrders.length})`} sx={{ fontWeight: 700 }} />
          <Tab label={`My Tasks (${activeAssignments.length})`} sx={{ fontWeight: 700 }} />
          <Tab label="History" sx={{ fontWeight: 700 }} />
        </Tabs>
      </Paper>

      {/* TAB 0: AVAILABLE POOL */}
      {tab === 0 && (
        <Stack spacing={1.75}>
          {isLoadingAvailable ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : availableOrders.length === 0 ? (
            <Paper elevation={0} sx={{ p: 4.5, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 2 }}>
              <ShippingIcon sx={{ fontSize: 42, color: '#9CA3AF', mb: 1 }} />
              <Typography variant="subtitle1">No unassigned orders ready right now</Typography>
              <Typography variant="body2" color="text.secondary">
                Stay online — new seller-packed orders will appear here automatically.
              </Typography>
            </Paper>
          ) : (
            availableOrders.map((order) => (
              <Paper
                key={order.id}
                elevation={0}
                sx={{ p: 2, border: '1px solid #E5E7EB', borderRadius: 2 }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      #{order.orderNumber}
                    </Typography>
                    <Chip
                      size="small"
                      label={order.isCod ? `COD ${formatRupeesFromPaise(order.codAmountPaise)}` : 'PREPAID'}
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        bgcolor: order.isCod ? '#FEF3C7' : '#DCFCE7',
                        color: order.isCod ? '#B45309' : '#15803D',
                      }}
                    />
                  </Stack>
                  <Chip
                    size="small"
                    label={`Earn ${formatRupeesFromPaise(order.estimatedPayoutPaise)}`}
                    sx={{ fontWeight: 700, bgcolor: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}
                  />
                </Stack>

                <Stack spacing={1.25} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                    <StoreIcon sx={{ fontSize: 18, color: '#FF7900', mt: 0.2 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        PICKUP • {order.estimatedDistanceKm ? `${order.estimatedDistanceKm} km away` : 'Seller Hub'}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {order.pickupLocation.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.pickupLocation.line1}, {order.pickupLocation.city} - {order.pickupLocation.pincode}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                    <LockIcon sx={{ fontSize: 17, color: '#6B7280', mt: 0.2 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        DELIVERY ZONE • {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#374151' }}>
                        {order.dropAreaLabel ||
                          [order.dropLocation.city, order.dropLocation.pincode].filter(Boolean).join(' - ')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Customer address unlocks after pickup confirmation
                      </Typography>
                    </Box>
                  </Box>
                </Stack>

                <Button
                  fullWidth
                  variant="contained"
                  disabled={!canClaimOrAccept || claimMutation.isPending}
                  onClick={() => claimMutation.mutate(order.id)}
                  startIcon={claimMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <BikeIcon />}
                >
                  {canClaimOrAccept ? 'Claim & Start Delivery' : 'Go Online & Enable GPS to Claim'}
                </Button>
              </Paper>
            ))
          )}
        </Stack>
      )}

      {/* TAB 1: ACTIVE / ADMIN-ASSIGNED TASKS */}
      {tab === 1 && (
        <Stack spacing={1.75}>
          {activeAssignments.length === 0 ? (
            <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}>
              <DispatchRadarSearch isOnline={isDutyOnline} />
            </Paper>
          ) : (
            activeAssignments.map((task) => (
              <Paper
                key={task.id}
                elevation={0}
                sx={{ p: 2, border: '1px solid #E5E7EB', borderRadius: 2 }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      Order #{task.orderNumber}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {task.assignmentCode} • {task.assignmentMode === 'admin_assigned' ? 'Admin Assigned' : 'Self Claimed'}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={task.status.replace(/_/g, ' ').toUpperCase()}
                    color="primary"
                    sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                  />
                </Stack>

                <Divider sx={{ my: 1.25 }} />

                <Typography variant="body2" sx={{ mb: 0.75 }}>
                  <strong>Pickup:</strong> {task.pickupLocation.name} — {task.pickupLocation.line1},{' '}
                  {task.pickupLocation.city} ({task.pickupLocation.pincode})
                </Typography>
                {isAssignmentDropUnlocked(task) ? (
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }}>
                    <PlaceIcon sx={{ fontSize: 17, color: '#059669' }} />
                    <Typography variant="body2">
                      <strong>Drop:</strong> {task.dropLocation.name} — {task.dropLocation.line1},{' '}
                      {task.dropLocation.city} ({task.dropLocation.pincode})
                    </Typography>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5, color: '#6B7280' }}>
                    <LockIcon sx={{ fontSize: 16 }} />
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Drop Zone:{' '}
                      {task.dropAreaLabel ||
                        [task.dropLocation.city, task.dropLocation.pincode].filter(Boolean).join(' - ')}{' '}
                      • Customer address unlocks after pickup
                    </Typography>
                  </Stack>
                )}

                {task.status === 'assigned' ? (
                  <Stack direction="row" spacing={1.25}>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      startIcon={<RejectIcon />}
                      disabled={rejectMutation.isPending}
                      onClick={() => rejectMutation.mutate(task.id)}
                    >
                      Decline
                    </Button>
                    <Button
                      fullWidth
                      variant="contained"
                      color="success"
                      startIcon={<AcceptIcon />}
                      disabled={!canClaimOrAccept || acceptMutation.isPending}
                      onClick={() => acceptMutation.mutate(task.id)}
                    >
                      Accept Job
                    </Button>
                  </Stack>
                ) : (
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => navigate(`/deliveries/${task.id}`)}
                    startIcon={<BikeIcon />}
                  >
                    Open Live Trip ({formatRupeesFromPaise(task.payoutPaise)})
                  </Button>
                )}
              </Paper>
            ))
          )}
        </Stack>
      )}

      {/* TAB 2: HISTORY */}
      {tab === 2 && (
        <Stack spacing={1.5}>
          {isLoadingHistory ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : historyAssignments.length === 0 ? (
            <Paper elevation={0} sx={{ p: 4.5, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">
                No completed or past deliveries yet.
              </Typography>
            </Paper>
          ) : (
            historyAssignments.map((item) => (
              <Paper
                key={item.id}
                elevation={0}
                sx={{ p: 2, border: '1px solid #E5E7EB', borderRadius: 2 }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      #{item.orderNumber}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.dropLocation.city} • {new Date(item.updatedAt).toLocaleString('en-IN')}
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end" spacing={0.5}>
                    <Chip
                      size="small"
                      label={item.status.toUpperCase()}
                      color={item.status === 'delivered' ? 'success' : 'error'}
                      sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                    />
                    {item.status === 'delivered' && (
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#047857' }}>
                        +{formatRupeesFromPaise(item.payoutPaise + (item.tipPaise || 0))}
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      )}
    </Box>
  );
}
