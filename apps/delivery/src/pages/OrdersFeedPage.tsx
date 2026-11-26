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
  Check as AcceptIcon,
  Close as RejectIcon,
  DirectionsBike as BikeIcon,
  LocalShipping as ShippingIcon,
  Place as PlaceIcon,
  Refresh as RefreshIcon,
  Storefront as StoreIcon,
} from '@mui/icons-material';
import type { AvailableDeliveryOrder, DeliveryAssignment } from '@ornate/types';
import api from '../api/client';
import { useDeliveryAuthStore } from '../store/auth.store';
import type { GeolocationSyncState } from '../hooks/useGeolocationSync';

const formatRupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function OrdersFeedPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { partner } = useDeliveryAuthStore();
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
  });

  const {
    data: activeAssignments = [],
    isLoading: isLoadingActive,
    refetch: refetchActive,
  } = useQuery<DeliveryAssignment[]>({
    queryKey: ['delivery-active-assignments'],
    queryFn: async () => {
      const resp = await api.get('/delivery/assignments?scope=active');
      return resp.data?.data?.items || [];
    },
    refetchInterval: 15_000,
  });

  const { data: historyAssignments = [], isLoading: isLoadingHistory } = useQuery<DeliveryAssignment[]>({
    queryKey: ['delivery-history-assignments'],
    queryFn: async () => {
      const resp = await api.get('/delivery/assignments?scope=history');
      return resp.data?.data?.items || [];
    },
    enabled: tab === 2,
  });

  const invalidateAll = () => {
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
      const resp = await api.post(`/delivery/assignments/${assignmentId}/accept`);
      return resp.data?.data as DeliveryAssignment;
    },
    onSuccess: (assignment) => {
      setActionError(null);
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
      await api.post(`/delivery/assignments/${assignmentId}/reject`, {
        reason: 'Declined by delivery partner',
      });
    },
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
  });

  const refreshAll = () => {
    refetchAvailable();
    refetchActive();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">Delivery Dispatch</Typography>
          <Typography variant="body2" color="text.secondary">
            Claim available deliveries or manage assigned pickups
          </Typography>
        </Box>
        <IconButton onClick={refreshAll} sx={{ bgcolor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <RefreshIcon />
        </IconButton>
      </Stack>

      {!canClaimOrAccept && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          {!isKycVerified
            ? 'Complete KYC verification in Profile before claiming or accepting orders.'
            : !isGpsReady
              ? 'Enable live GPS and switch Online to claim or accept orders.'
              : 'You are currently Offline. Switch Online in the top bar to claim orders.'}
        </Alert>
      )}

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <Paper elevation={0} sx={{ mb: 2.5, border: '1px solid #E2E8F0', borderRadius: 2.5 }}>
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
        <Stack spacing={2}>
          {isLoadingAvailable ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : availableOrders.length === 0 ? (
            <Paper elevation={0} sx={{ p: 5, textAlign: 'center', border: '1px solid #E2E8F0', borderRadius: 3 }}>
              <ShippingIcon sx={{ fontSize: 46, color: '#94A3B8', mb: 1 }} />
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
                sx={{ p: 2.25, border: '1px solid #E2E8F0', borderRadius: 3 }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      #{order.orderNumber}
                    </Typography>
                    <Chip
                      size="small"
                      label={order.isCod ? `COD ${formatRupees(order.codAmountPaise)}` : 'PREPAID'}
                      sx={{
                        fontWeight: 800,
                        fontSize: '0.7rem',
                        bgcolor: order.isCod ? '#FEF3C7' : '#DCFCE7',
                        color: order.isCod ? '#B45309' : '#15803D',
                      }}
                    />
                  </Stack>
                  <Chip
                    size="small"
                    label={`Earn ${formatRupees(order.estimatedPayoutPaise)}`}
                    sx={{ fontWeight: 800, bgcolor: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}
                  />
                </Stack>

                <Stack spacing={1.25} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                    <StoreIcon sx={{ fontSize: 18, color: '#FF7900', mt: 0.2 }} />
                    <Box>
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
                    <PlaceIcon sx={{ fontSize: 18, color: '#10B981', mt: 0.2 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        DROP • {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {order.dropLocation.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.dropLocation.line1}, {order.dropLocation.city} - {order.dropLocation.pincode}
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
                  {canClaimOrAccept ? 'Claim & Start Delivery' : 'Go Online & Verified to Claim'}
                </Button>
              </Paper>
            ))
          )}
        </Stack>
      )}

      {/* TAB 1: ACTIVE / ADMIN-ASSIGNED TASKS */}
      {tab === 1 && (
        <Stack spacing={2}>
          {isLoadingActive ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : activeAssignments.length === 0 ? (
            <Paper elevation={0} sx={{ p: 5, textAlign: 'center', border: '1px solid #E2E8F0', borderRadius: 3 }}>
              <BikeIcon sx={{ fontSize: 46, color: '#94A3B8', mb: 1 }} />
              <Typography variant="subtitle1">No active delivery tasks</Typography>
              <Typography variant="body2" color="text.secondary">
                Claim an order from the Available tab or wait for dispatch assignment.
              </Typography>
            </Paper>
          ) : (
            activeAssignments.map((task) => (
              <Paper
                key={task.id}
                elevation={0}
                sx={{ p: 2.25, border: '1px solid #E2E8F0', borderRadius: 3 }}
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
                    sx={{ fontWeight: 800, fontSize: '0.7rem' }}
                  />
                </Stack>

                <Divider sx={{ my: 1.25 }} />

                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>Pickup:</strong> {task.pickupLocation.name} ({task.pickupLocation.city} - {task.pickupLocation.pincode})
                </Typography>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  <strong>Drop:</strong> {task.dropLocation.line1}, {task.dropLocation.city} - {task.dropLocation.pincode}
                </Typography>

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
                      sx={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
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
                    Open Live Trip ({formatRupees(task.payoutPaise)})
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
            <Paper elevation={0} sx={{ p: 5, textAlign: 'center', border: '1px solid #E2E8F0', borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary">
                No completed or past deliveries yet.
              </Typography>
            </Paper>
          ) : (
            historyAssignments.map((item) => (
              <Paper
                key={item.id}
                elevation={0}
                sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2.5 }}
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
                      sx={{ fontWeight: 800, fontSize: '0.68rem' }}
                    />
                    {item.status === 'delivered' && (
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#047857' }}>
                        +{formatRupees(item.payoutPaise + (item.tipPaise || 0))}
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
