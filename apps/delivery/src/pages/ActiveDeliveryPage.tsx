import { useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Call as CallIcon,
  CheckCircle as CheckIcon,
  DirectionsBike as BikeIcon,
  LocalShipping as DispatchIcon,
  Place as DropIcon,
  ReportProblem as IssueIcon,
  Storefront as PickupIcon,
} from '@mui/icons-material';
import type { DeliveryAssignment, DeliveryAssignmentStatus } from '@ornate/types';
import api from '../api/client';
import type { GeolocationSyncState } from '../hooks/useGeolocationSync';
import DeliveryRouteMap from '../components/map/DeliveryRouteMap';
import ProofOfDeliveryDialog from '../components/delivery/ProofOfDeliveryDialog';
import DeliveryFailureDialog from '../components/delivery/DeliveryFailureDialog';

const PIPELINE_STEPS: Array<{ key: DeliveryAssignmentStatus; label: string }> = [
  { key: 'accepted', label: 'Accepted' },
  { key: 'arrived_pickup', label: 'At Store' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'in_transit', label: 'On Way' },
  { key: 'arrived_customer', label: 'At Door' },
  { key: 'delivered', label: 'Delivered' },
];

const NEXT_STEP_CONFIG: Partial<
  Record<DeliveryAssignmentStatus, { next: DeliveryAssignmentStatus; label: string }>
> = {
  accepted: { next: 'arrived_pickup', label: 'Mark Arrived at Pickup Store' },
  arrived_pickup: { next: 'picked_up', label: 'Confirm Pickup & Collect Items' },
  picked_up: { next: 'in_transit', label: 'Start Transit to Customer' },
  in_transit: { next: 'arrived_customer', label: 'Mark Arrived at Customer' },
};

export default function ActiveDeliveryPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const outletCtx = useOutletContext<{
    geo?: GeolocationSyncState;
    primaryActiveAssignment?: DeliveryAssignment;
  } | null>();

  const [podOpen, setPodOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const targetId = id || outletCtx?.primaryActiveAssignment?.id;

  const { data: assignment, isLoading } = useQuery<DeliveryAssignment | null>({
    queryKey: ['delivery-assignment-detail', targetId || 'latest'],
    queryFn: async () => {
      if (targetId) {
        const resp = await api.get(`/delivery/assignments/${targetId}`);
        return resp.data?.data || null;
      }
      const listResp = await api.get('/delivery/assignments?scope=active');
      const items = listResp.data?.data?.items || [];
      return items[0] || null;
    },
    refetchInterval: 15_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['delivery-assignment-detail'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-active-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-available-orders'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-earnings'] });
  };

  const progressMutation = useMutation({
    mutationFn: async (nextStatus: DeliveryAssignmentStatus) => {
      const resp = await api.patch(`/delivery/assignments/${assignment!.id}/status`, {
        status: nextStatus,
        lat: outletCtx?.geo?.coords?.lat,
        lng: outletCtx?.geo?.coords?.lng,
      });
      return resp.data?.data as DeliveryAssignment;
    },
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setActionError(axiosErr.response?.data?.error?.message || 'Failed to update delivery status.');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const resp = await api.post(`/delivery/assignments/${assignment!.id}/accept`);
      return resp.data?.data as DeliveryAssignment;
    },
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!assignment) {
    return (
      <Paper elevation={0} sx={{ p: 5, textAlign: 'center', border: '1px solid #E2E8F0', borderRadius: 3 }}>
        <BikeIcon sx={{ fontSize: 48, color: '#94A3B8', mb: 1 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>
          No Active Delivery Trip
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Claim an available order from the dispatch feed to start a trip.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Browse Available Orders
        </Button>
      </Paper>
    );
  }

  const activeStepIdx = Math.max(
    0,
    PIPELINE_STEPS.findIndex((s) => s.key === assignment.status),
  );
  const nextStep = NEXT_STEP_CONFIG[assignment.status];
  const canCompletePod =
    assignment.status === 'arrived_customer' || assignment.status === 'in_transit';
  const isTerminal =
    assignment.status === 'delivered' ||
    assignment.status === 'failed' ||
    assignment.status === 'cancelled';

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/')} size="small">
          All Orders
        </Button>
        <Chip
          size="small"
          label={assignment.status.replace(/_/g, ' ').toUpperCase()}
          color={assignment.status === 'delivered' ? 'success' : assignment.status === 'failed' ? 'error' : 'primary'}
          sx={{ fontWeight: 800 }}
        />
      </Stack>

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      {/* Header Card */}
      <Paper elevation={0} sx={{ p: 2.25, mb: 2, border: '1px solid #E2E8F0', borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Order #{assignment.orderNumber}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {assignment.assignmentCode} • Trip Payout ₹{(assignment.payoutPaise / 100).toFixed(0)}
            </Typography>
          </Box>
          {assignment.isCod ? (
            <Chip
              label={`COLLECT COD ₹${(assignment.codAmountPaise / 100).toFixed(0)}`}
              sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 800 }}
            />
          ) : (
            <Chip label="PREPAID" sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 800 }} />
          )}
        </Stack>

        <Box sx={{ mt: 2.5, overflowX: 'auto' }}>
          <Stepper activeStep={activeStepIdx} alternativeLabel sx={{ minWidth: 460 }}>
            {PIPELINE_STEPS.map((s) => (
              <Step key={s.key}>
                <StepLabel>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem' }}>
                    {s.label}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      </Paper>

      {/* Route Map + Deep Links */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid #E2E8F0', borderRadius: 3 }}>
        <DeliveryRouteMap
          pickupLocation={assignment.pickupLocation}
          dropLocation={assignment.dropLocation}
          riderLocation={outletCtx?.geo?.coords || assignment.lastKnownLocation}
        />
      </Paper>

      {/* Pickup & Drop Stops */}
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Paper elevation={0} sx={{ p: 2.25, border: '1px solid #E2E8F0', borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Box sx={{ display: 'flex', gap: 1.25 }}>
              <PickupIcon sx={{ color: '#FF7900', mt: 0.25 }} />
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#EA580C' }}>
                  1. SELLER PICKUP
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {assignment.pickupLocation.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {assignment.pickupLocation.line1}, {assignment.pickupLocation.city} - {assignment.pickupLocation.pincode}
                </Typography>
              </Box>
            </Box>
            <Button
              size="small"
              variant="outlined"
              component="a"
              href={`tel:${assignment.pickupLocation.phone}`}
              startIcon={<CallIcon />}
            >
              Call
            </Button>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 2.25, border: '1px solid #E2E8F0', borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Box sx={{ display: 'flex', gap: 1.25 }}>
              <DropIcon sx={{ color: '#10B981', mt: 0.25 }} />
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#059669' }}>
                  2. CUSTOMER DELIVERY
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {assignment.dropLocation.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {assignment.dropLocation.line1}{' '}
                  {assignment.dropLocation.line2 ? `, ${assignment.dropLocation.line2}` : ''},{' '}
                  {assignment.dropLocation.city} - {assignment.dropLocation.pincode}
                </Typography>
              </Box>
            </Box>
            <Button
              size="small"
              variant="outlined"
              color="success"
              component="a"
              href={`tel:${assignment.dropLocation.phone}`}
              startIcon={<CallIcon />}
            >
              Call
            </Button>
          </Stack>

          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', display: 'block', mb: 1 }}>
            PARCEL ITEMS ({assignment.itemsSummary.length})
          </Typography>
          <Stack spacing={0.75}>
            {assignment.itemsSummary.map((it, idx) => (
              <Stack key={idx} direction="row" justifyContent="space-between">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {it.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Qty: {it.quantity}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Stack>

      {/* Primary Action Controls */}
      {!isTerminal && (
        <Paper elevation={0} sx={{ p: 2.25, border: '1px solid #E2E8F0', borderRadius: 3 }}>
          <Stack spacing={1.5}>
            {assignment.status === 'assigned' && (
              <Button
                fullWidth
                size="large"
                variant="contained"
                color="success"
                disabled={acceptMutation.isPending}
                onClick={() => acceptMutation.mutate()}
                startIcon={<CheckIcon />}
                sx={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
              >
                {acceptMutation.isPending ? 'Accepting...' : 'Accept Delivery Job'}
              </Button>
            )}

            {nextStep && (
              <Button
                fullWidth
                size="large"
                variant="contained"
                disabled={progressMutation.isPending}
                onClick={() => progressMutation.mutate(nextStep.next)}
                startIcon={progressMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <DispatchIcon />}
              >
                {progressMutation.isPending ? 'Updating...' : nextStep.label}
              </Button>
            )}

            {canCompletePod && (
              <Button
                fullWidth
                size="large"
                variant="contained"
                color="success"
                onClick={() => setPodOpen(true)}
                startIcon={<CheckIcon />}
                sx={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
              >
                Complete Delivery (OTP & POD)
              </Button>
            )}

            {assignment.status !== 'assigned' && (
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<IssueIcon />}
                onClick={() => setFailOpen(true)}
              >
                Report Delivery Issue / Customer Unavailable
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {assignment.status === 'delivered' && (
        <Alert severity="success" sx={{ borderRadius: 2.5 }}>
          Delivered on {assignment.deliveredAt ? new Date(assignment.deliveredAt).toLocaleString('en-IN') : 'today'} •
          Trip payout ₹{(assignment.payoutPaise / 100).toFixed(2)} credited!
        </Alert>
      )}

      <ProofOfDeliveryDialog
        open={podOpen}
        assignment={assignment}
        coords={outletCtx?.geo?.coords}
        onClose={() => setPodOpen(false)}
        onCompleted={() => {
          setPodOpen(false);
          invalidate();
        }}
      />

      <DeliveryFailureDialog
        open={failOpen}
        assignmentId={assignment.id}
        coords={outletCtx?.geo?.coords}
        onClose={() => setFailOpen(false)}
        onFailed={() => {
          setFailOpen(false);
          invalidate();
          navigate('/');
        }}
      />
    </Box>
  );
}
