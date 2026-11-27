import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Call as CallIcon,
  CheckCircle as CheckIcon,
  Close as RejectIcon,
  ContentCopy as CopyIcon,
  DirectionsBike as BikeIcon,
  GpsFixed as GpsIcon,
  Lock as LockIcon,
  MyLocation as LocateIcon,
  Place as DropIcon,
  ReportProblem as IssueIcon,
  Schedule as TimerIcon,
  Storefront as PickupIcon,
} from '@mui/icons-material';
import type { DeliveryAssignment, DeliveryAssignmentStatus } from '@ornate/types';
import api from '../api/client';
import { useDeliveryAuthStore } from '../store/auth.store';
import type { GeolocationSyncState } from '../hooks/useGeolocationSync';
import DeliveryRouteMap from '../components/map/DeliveryRouteMap';
import ProofOfDeliveryDialog from '../components/delivery/ProofOfDeliveryDialog';
import DeliveryFailureDialog from '../components/delivery/DeliveryFailureDialog';
import SwipeToConfirmButton from '../components/delivery/SwipeToConfirmButton';
import {
  areAllItemsChecked,
  calculateStopDistanceKm,
  evaluateStopGeofence,
  formatRupeesFromPaise,
  isAssignmentDropUnlocked,
} from '../utils/navigation';
import {
  markNativeAssignmentHandled,
  playConfirmationChime,
  stopOrderBellAlert,
} from '../utils/orderAlertAudio';

const COMPACT_MILESTONES: Array<{ key: DeliveryAssignmentStatus; label: string }> = [
  { key: 'accepted', label: 'Accepted' },
  { key: 'arrived_pickup', label: 'At Store' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'in_transit', label: 'On Way' },
  { key: 'delivered', label: 'Delivered' },
];

function resolveMilestoneIndex(status: DeliveryAssignmentStatus): number {
  if (status === 'arrived_customer') return 3;
  const idx = COMPACT_MILESTONES.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

function formatElapsedSince(isoDate?: string | null, nowMs = Date.now()): string | null {
  if (!isoDate) return null;
  const startedMs = new Date(isoDate).getTime();
  if (Number.isNaN(startedMs)) return null;
  const totalSec = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function ActiveDeliveryPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { updatePartnerProfile } = useDeliveryAuthStore();
  const outletCtx = useOutletContext<{
    geo?: GeolocationSyncState;
    primaryActiveAssignment?: DeliveryAssignment;
  } | null>();

  const [podOpen, setPodOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [resolvedDropCoords, setResolvedDropCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

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
    refetchInterval: 10_000,
  });

  useEffect(() => {
    setCheckedItems({});
    setResolvedDropCoords(null);
  }, [assignment?.id]);

  const handleDropCoordsResolved = useCallback((coords: { lat: number; lng: number } | null) => {
    setResolvedDropCoords(coords);
  }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['delivery-me'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-assignment-detail'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-active-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-available-orders'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-history-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-earnings'] });
  };

  const progressMutation = useMutation({
    mutationFn: async (nextStatus: DeliveryAssignmentStatus) => {
      const liveCoords = outletCtx?.geo?.isGpsReady ? outletCtx.geo.coords : null;
      const resp = await api.patch(`/delivery/assignments/${assignment!.id}/status`, {
        status: nextStatus,
        lat: liveCoords?.lat,
        lng: liveCoords?.lng,
      });
      return resp.data?.data as DeliveryAssignment;
    },
    onSuccess: (_updated, nextStatus) => {
      setActionError(null);
      if (nextStatus === 'picked_up') {
        playConfirmationChime();
      }
      invalidate();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setActionError(axiosErr.response?.data?.error?.message || 'Failed to update delivery status.');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      await markNativeAssignmentHandled(assignment!.id);
      const resp = await api.post(`/delivery/assignments/${assignment!.id}/accept`);
      return resp.data?.data as DeliveryAssignment;
    },
    onSuccess: () => {
      setActionError(null);
      stopOrderBellAlert();
      updatePartnerProfile({ availabilityStatus: 'on_delivery' });
      playConfirmationChime();
      invalidate();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setActionError(axiosErr.response?.data?.error?.message || 'Could not accept assignment.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await markNativeAssignmentHandled(assignment!.id);
      await api.post(`/delivery/assignments/${assignment!.id}/reject`, {
        reason: 'Declined by delivery partner',
      });
    },
    onSuccess: () => {
      stopOrderBellAlert();
      invalidate();
      navigate('/');
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
      <Paper elevation={0} sx={{ p: 4.5, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 2 }}>
        <BikeIcon sx={{ fontSize: 44, color: '#9CA3AF', mb: 1 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>
          No Active Delivery Trip
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Claim an available order from the dispatch feed or wait for an assigned task.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Browse Available Orders
        </Button>
      </Paper>
    );
  }

  const activeMilestoneIdx = resolveMilestoneIndex(assignment.status);
  const dropUnlocked = isAssignmentDropUnlocked(assignment);
  const isTerminal =
    assignment.status === 'delivered' ||
    assignment.status === 'failed' ||
    assignment.status === 'cancelled';

  const liveRiderCoords = outletCtx?.geo?.isGpsReady ? outletCtx.geo.coords : null;
  const mapRiderCoords = liveRiderCoords || assignment.lastKnownLocation;
  const effectiveDropLocation = {
    ...assignment.dropLocation,
    lat: assignment.dropLocation.lat ?? resolvedDropCoords?.lat,
    lng: assignment.dropLocation.lng ?? resolvedDropCoords?.lng,
  };
  const activeStopCoords = dropUnlocked ? effectiveDropLocation : assignment.pickupLocation;
  const displayDistanceKm = calculateStopDistanceKm(
    mapRiderCoords?.lat,
    mapRiderCoords?.lng,
    activeStopCoords.lat,
    activeStopCoords.lng,
  );

  // Strict GPS-only geofence validation for BOTH pickup & customer arrival/delivery
  const pickupBlockReason = evaluateStopGeofence({
    milestone: 'pickup',
    liveRiderCoords,
    pickupLocation: assignment.pickupLocation,
  });

  const customerBlockReason = evaluateStopGeofence({
    milestone: 'customer',
    liveRiderCoords,
    pickupLocation: assignment.pickupLocation,
    dropLocation: effectiveDropLocation,
  });

  const allItemsChecked = areAllItemsChecked(assignment.itemsSummary.length, checkedItems);
  const checkedCount = assignment.itemsSummary.filter((_, idx) => Boolean(checkedItems[idx])).length;
  const confirmPickupDisabled = Boolean(pickupBlockReason) || !allItemsChecked;

  const stageTimerLabel =
    assignment.status === 'arrived_pickup'
      ? `Store Wait: ${formatElapsedSince(assignment.arrivedPickupAt, nowMs) || '00:00'}`
      : dropUnlocked && !isTerminal
        ? `Ride: ${formatElapsedSince(assignment.pickedUpAt || assignment.acceptedAt, nowMs) || '00:00'}`
        : !isTerminal && assignment.acceptedAt
          ? `Trip: ${formatElapsedSince(assignment.acceptedAt, nowMs) || '00:00'}`
          : null;

  const fullDropAddress = [
    assignment.dropLocation.line1,
    assignment.dropLocation.line2,
    assignment.dropLocation.city,
    assignment.dropLocation.state,
    assignment.dropLocation.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard?.writeText(fullDropAddress);
      setCopiedAddress(true);
      window.setTimeout(() => setCopiedAddress(false), 2000);
    } catch {
      // Clipboard unsupported
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/')} size="small" color="inherit">
          All Orders
        </Button>
        <Stack direction="row" spacing={0.75} alignItems="center">
          {stageTimerLabel && (
            <Chip
              size="small"
              icon={<TimerIcon sx={{ fontSize: '14px !important' }} />}
              label={stageTimerLabel}
              sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 700 }}
            />
          )}
          <Chip
            size="small"
            label={assignment.status.replace(/_/g, ' ').toUpperCase()}
            color={assignment.status === 'delivered' ? 'success' : assignment.status === 'failed' ? 'error' : 'primary'}
            sx={{ fontWeight: 700 }}
          />
        </Stack>
      </Stack>

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 1.5 }}>
          {actionError}
        </Alert>
      )}

      {/* Compact Order Header & Non-Scrolling 5-Step Progress Track */}
      <Paper elevation={0} sx={{ p: 2, mb: 1.75, border: '1px solid #E5E7EB', borderRadius: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
              Order #{assignment.orderNumber}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {assignment.assignmentCode} • Payout {formatRupeesFromPaise(assignment.payoutPaise)}
              {displayDistanceKm !== null
                ? ` • ~${displayDistanceKm} km to ${dropUnlocked ? 'drop' : 'pickup'}`
                : ''}
            </Typography>
          </Box>
          {assignment.isCod ? (
            <Chip
              size="small"
              label={`COD ${formatRupeesFromPaise(assignment.codAmountPaise)}`}
              sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700, flexShrink: 0 }}
            />
          ) : (
            <Chip
              size="small"
              label="PREPAID"
              sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 700, flexShrink: 0 }}
            />
          )}
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: `repeat(${COMPACT_MILESTONES.length}, 1fr)`,
            gap: 0.75,
          }}
        >
          {COMPACT_MILESTONES.map((step, idx) => {
            const done = idx <= activeMilestoneIdx;
            const current = idx === activeMilestoneIdx;
            return (
              <Box key={step.key} sx={{ textAlign: 'center', minWidth: 0 }}>
                <Box
                  sx={{
                    height: 4,
                    borderRadius: 999,
                    mb: 0.65,
                    bgcolor: done ? (step.key === 'picked_up' || step.key === 'delivered' ? '#059669' : '#FF7900') : '#E5E7EB',
                  }}
                />
                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    display: 'block',
                    fontSize: '0.64rem',
                    fontWeight: current ? 800 : 600,
                    color: current ? '#111827' : done ? '#374151' : '#9CA3AF',
                  }}
                >
                  {step.key === 'in_transit' && assignment.status === 'arrived_customer' ? 'At Door' : step.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* Route Map with Road Polyline */}
      <Paper elevation={0} sx={{ p: 1.75, mb: 1.75, border: '1px solid #E5E7EB', borderRadius: 2 }}>
        <DeliveryRouteMap
          pickupLocation={assignment.pickupLocation}
          dropLocation={assignment.dropLocation}
          riderLocation={mapRiderCoords}
          showDrop={dropUnlocked}
          onDropCoordsResolved={handleDropCoordsResolved}
        />
      </Paper>

      {/* STAGE 1: PICKUP MODE (Before pickup confirmation) */}
      {!dropUnlocked && (
        <Stack spacing={1.75} sx={{ mb: 1.75 }}>
          <Paper
            elevation={0}
            sx={{ p: 2, border: '1px solid #FED7AA', bgcolor: '#FFFBF7', borderRadius: 2 }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
              <Box sx={{ display: 'flex', gap: 1.25, minWidth: 0, flex: 1 }}>
                <PickupIcon sx={{ color: '#EA580C', mt: 0.25, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#C2410C' }}>
                    STEP 1 • PICKUP FROM STORE
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#111827' }}>
                    {assignment.pickupLocation.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {assignment.pickupLocation.line1}
                    {assignment.pickupLocation.line2 ? `, ${assignment.pickupLocation.line2}` : ''},{' '}
                    {assignment.pickupLocation.city} - {assignment.pickupLocation.pincode}
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                component="a"
                href={`tel:${assignment.pickupLocation.phone}`}
                startIcon={<CallIcon />}
                sx={{ flexShrink: 0, whiteSpace: 'nowrap', bgcolor: '#FFFFFF' }}
              >
                Call Store
              </Button>
            </Stack>

            <Divider sx={{ my: 1.5, borderColor: '#FED7AA' }} />

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1.25, px: 1.5, py: 1, bgcolor: '#FFFFFF', borderRadius: 1.5, border: '1px solid #FDBA74' }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                PICKUP ORDER #
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#EA580C' }}>
                #{assignment.orderNumber}
              </Typography>
            </Stack>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#374151' }}>
                CONFIRM PRODUCTS ({checkedCount}/{assignment.itemsSummary.length} checked)
              </Typography>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: allItemsChecked ? '#059669' : '#B45309' }}
              >
                {allItemsChecked ? 'All items verified' : 'Tick all items first'}
              </Typography>
            </Stack>

            <Stack spacing={0.75}>
              {assignment.itemsSummary.map((it, idx) => {
                const isChecked = Boolean(checkedItems[idx]);
                return (
                  <Box
                    key={idx}
                    onClick={() => setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                    sx={{
                      p: 1,
                      borderRadius: 1.5,
                      bgcolor: isChecked ? '#ECFDF5' : '#FFFFFF',
                      border: `1px solid ${isChecked ? '#6EE7B7' : '#E5E7EB'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      cursor: 'pointer',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                      <Checkbox checked={isChecked} size="small" color="success" sx={{ p: 0.25 }} />
                      {it.image && (
                        <Avatar src={it.image} variant="rounded" sx={{ width: 30, height: 30 }} />
                      )}
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {it.name}
                      </Typography>
                    </Stack>
                    <Chip label={`x${it.quantity}`} size="small" sx={{ fontWeight: 700, flexShrink: 0 }} />
                  </Box>
                );
              })}
            </Stack>
          </Paper>

          {/* Compact Drop Zone Lock Strip */}
          <Paper
            elevation={0}
            sx={{ px: 2, py: 1.5, border: '1px solid #E5E7EB', bgcolor: '#FFFFFF', borderRadius: 2 }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <LockIcon fontSize="small" sx={{ color: '#6B7280', flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary">
                <strong>
                  Drop Zone:{' '}
                  {assignment.dropAreaLabel ||
                    [assignment.dropLocation.city, assignment.dropLocation.pincode].filter(Boolean).join(' - ')}
                </strong>{' '}
                — Customer address & phone unlock after pickup confirmation.
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      )}

      {/* STAGE 2: CUSTOMER DELIVERY MODE (Unlocked after pickup confirmation) */}
      {dropUnlocked && (
        <Stack spacing={1.75} sx={{ mb: 1.75 }}>
          <Paper
            elevation={0}
            sx={{
              px: 2,
              py: 1.15,
              borderRadius: 2,
              bgcolor: '#ECFDF5',
              border: '1px solid #A7F3D0',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                <CheckIcon fontSize="small" sx={{ color: '#059669', flexShrink: 0 }} />
                <Typography variant="caption" noWrap sx={{ fontWeight: 700, color: '#065F46' }}>
                  Picked up from {assignment.pickupLocation.name}
                  {assignment.pickedUpAt
                    ? ` · ${new Date(assignment.pickedUpAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : ''}
                </Typography>
              </Stack>
              <Button
                size="small"
                component="a"
                href={`tel:${assignment.pickupLocation.phone}`}
                sx={{ flexShrink: 0, minWidth: 'auto', fontSize: '0.72rem', color: '#065F46' }}
              >
                Call Store
              </Button>
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{ p: 2, border: '1px solid #A7F3D0', bgcolor: '#FFFFFF', borderRadius: 2 }}
          >
            <Alert
              severity={assignment.isCod ? 'warning' : 'success'}
              sx={{ mb: 1.75, fontWeight: 700, borderRadius: 1.5, py: 0.5 }}
            >
              {assignment.isCod
                ? `Collect Cash on Delivery: ${formatRupeesFromPaise(assignment.codAmountPaise)}`
                : 'Prepaid Order — Do NOT collect cash from customer.'}
            </Alert>

            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
              <Box sx={{ display: 'flex', gap: 1.25, minWidth: 0, flex: 1 }}>
                <DropIcon sx={{ color: '#059669', mt: 0.25, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#059669' }}>
                    STEP 2 • DELIVER TO CUSTOMER
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {assignment.dropLocation.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {fullDropAddress}
                  </Typography>
                </Box>
              </Box>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                <IconButton
                  size="small"
                  onClick={handleCopyAddress}
                  title="Copy customer address"
                  sx={{ border: '1px solid #E5E7EB' }}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  component="a"
                  href={`tel:${assignment.dropLocation.phone}`}
                  startIcon={<CallIcon />}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Call
                </Button>
              </Stack>
            </Stack>

            {copiedAddress && (
              <Typography variant="caption" sx={{ color: '#059669', fontWeight: 700, display: 'block', mt: 0.75 }}>
                ✓ Address copied
              </Typography>
            )}

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#4B5563', display: 'block', mb: 0.75 }}>
              PARCEL ITEMS ({assignment.itemsSummary.length})
            </Typography>
            <Stack spacing={0.5}>
              {assignment.itemsSummary.map((it, idx) => (
                <Stack key={idx} direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {it.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                    Qty: {it.quantity}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Stack>
      )}

      {/* Primary Action Controls */}
      {!isTerminal && (
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #E5E7EB', borderRadius: 2 }}>
          <Stack spacing={1.25}>
            {assignment.status === 'assigned' && (
              <Stack direction="row" spacing={1.25}>
                <Button
                  fullWidth
                  size="large"
                  variant="outlined"
                  color="error"
                  disabled={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate()}
                  startIcon={<RejectIcon />}
                >
                  Decline
                </Button>
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  color="success"
                  disabled={acceptMutation.isPending}
                  onClick={() => acceptMutation.mutate()}
                  startIcon={<CheckIcon />}
                >
                  {acceptMutation.isPending ? 'Accepting...' : 'Accept Job'}
                </Button>
              </Stack>
            )}

            {/* Pickup GPS & Geofence Warning */}
            {!dropUnlocked &&
              assignment.status !== 'assigned' &&
              pickupBlockReason && (
                <Alert
                  severity={!liveRiderCoords ? 'warning' : 'info'}
                  icon={!liveRiderCoords ? <GpsIcon /> : <LocateIcon />}
                  action={
                    !liveRiderCoords ? (
                      <Button size="small" color="inherit" onClick={() => outletCtx?.geo?.pingNow()}>
                        Refresh GPS
                      </Button>
                    ) : undefined
                  }
                  sx={{ borderRadius: 1.5 }}
                >
                  {pickupBlockReason}
                </Alert>
              )}

            {/* Product Checkbox Gate Notice */}
            {!dropUnlocked &&
              assignment.status !== 'assigned' &&
              !allItemsChecked && (
                <Alert severity="warning" sx={{ borderRadius: 1.5 }}>
                  Tick all {assignment.itemsSummary.length} product checkboxes above before confirming pickup ({checkedCount}/{assignment.itemsSummary.length} verified).
                </Alert>
              )}

            {assignment.status === 'accepted' && (
              <>
                <SwipeToConfirmButton
                  label="Slide When Arrived at Pickup"
                  loadingLabel="Marking Arrived..."
                  color="orange"
                  disabled={Boolean(pickupBlockReason)}
                  isLoading={progressMutation.isPending}
                  onConfirm={() => progressMutation.mutate('arrived_pickup')}
                />
                <Button
                  size="small"
                  color="inherit"
                  disabled={confirmPickupDisabled || progressMutation.isPending}
                  onClick={() => progressMutation.mutate('picked_up')}
                  sx={{ color: '#4B5563', fontSize: '0.78rem' }}
                >
                  Verified all items? Confirm Pickup Now
                </Button>
              </>
            )}

            {assignment.status === 'arrived_pickup' && (
              <SwipeToConfirmButton
                label="Slide to Confirm Pickup"
                loadingLabel="Unlocking Delivery..."
                color="green"
                disabled={confirmPickupDisabled}
                isLoading={progressMutation.isPending}
                onConfirm={() => progressMutation.mutate('picked_up')}
              />
            )}

            {/* Delivery Ride & Customer GPS Geofence Warning */}
            {assignment.status === 'picked_up' && (
              <>
                {!liveRiderCoords && (
                  <Alert
                    severity="warning"
                    icon={<GpsIcon />}
                    action={
                      <Button size="small" color="inherit" onClick={() => outletCtx?.geo?.pingNow()}>
                        Refresh GPS
                      </Button>
                    }
                    sx={{ borderRadius: 1.5 }}
                  >
                    Turn on live GPS before starting your ride to the customer.
                  </Alert>
                )}
                <SwipeToConfirmButton
                  label="Slide to Start Customer Ride"
                  loadingLabel="Starting Transit..."
                  color="blue"
                  disabled={!liveRiderCoords}
                  isLoading={progressMutation.isPending}
                  onConfirm={() => progressMutation.mutate('in_transit')}
                />
              </>
            )}

            {(assignment.status === 'in_transit' || assignment.status === 'arrived_customer') &&
              customerBlockReason && (
                <Alert
                  severity={!liveRiderCoords ? 'warning' : 'info'}
                  icon={!liveRiderCoords ? <GpsIcon /> : <LocateIcon />}
                  action={
                    !liveRiderCoords ? (
                      <Button size="small" color="inherit" onClick={() => outletCtx?.geo?.pingNow()}>
                        Refresh GPS
                      </Button>
                    ) : undefined
                  }
                  sx={{ borderRadius: 1.5 }}
                >
                  {customerBlockReason}
                </Alert>
              )}

            {assignment.status === 'in_transit' && (
              <SwipeToConfirmButton
                label="Slide When Arrived at Customer"
                loadingLabel="Marking Arrived..."
                color="orange"
                disabled={Boolean(customerBlockReason)}
                isLoading={progressMutation.isPending}
                onConfirm={() => progressMutation.mutate('arrived_customer')}
              />
            )}

            {assignment.status === 'arrived_customer' && (
              <Button
                fullWidth
                size="large"
                variant="contained"
                color="success"
                disabled={Boolean(customerBlockReason)}
                onClick={() => setPodOpen(true)}
                startIcon={<CheckIcon />}
                sx={{ fontWeight: 700 }}
              >
                Complete Delivery (Customer OTP & POD)
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
        <Alert severity="success" sx={{ borderRadius: 2 }}>
          Delivered on {assignment.deliveredAt ? new Date(assignment.deliveredAt).toLocaleString('en-IN') : 'today'} •
          Trip payout {formatRupeesFromPaise(assignment.payoutPaise)} credited!
        </Alert>
      )}

      <ProofOfDeliveryDialog
        open={podOpen}
        assignment={assignment}
        coords={liveRiderCoords}
        onClose={() => setPodOpen(false)}
        onCompleted={() => {
          setPodOpen(false);
          updatePartnerProfile({ availabilityStatus: 'online' });
          playConfirmationChime();
          invalidate();
        }}
      />

      <DeliveryFailureDialog
        open={failOpen}
        assignmentId={assignment.id}
        coords={liveRiderCoords}
        onClose={() => setFailOpen(false)}
        onFailed={() => {
          setFailOpen(false);
          updatePartnerProfile({ availabilityStatus: 'online' });
          invalidate();
          navigate('/');
        }}
      />
    </Box>
  );
}
