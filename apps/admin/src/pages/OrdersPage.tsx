import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel, TextField,
  CircularProgress, IconButton, Stack, Tooltip, Alert, Divider, Grid,
} from '@mui/material';
import {
  Edit as EditIcon,
  Receipt as InvoiceIcon,
  LocalShipping as ShippingIcon,
  Timeline as TrackIcon,
  Print as PrintIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  HourglassEmpty as PendingIcon,
  InfoOutlined as InfoIcon,
  OpenInNew as OpenInNewIcon,
  TwoWheeler as BikeIcon,
} from '@mui/icons-material';
import api from '../api/client';
import InvoiceViewerDialog from '../components/InvoiceViewerDialog';
import type { DeliveryAssignment, DeliveryPartnerProfile, Order } from '@ornate/types';

const FULFILMENT_STATUSES = [
  'pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'
];

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [newSellerAcceptanceStatus, setNewSellerAcceptanceStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingProvider, setShippingProvider] = useState('');
  const [note, setNote] = useState('');

  const { data: ordersData, isLoading } = useQuery<{ items: Order[]; total: number }>({
    queryKey: ['admin-orders-list'],
    queryFn: async () => {
      const { data } = await api.get('/admin/orders?limit=50');
      return data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) return;
      const targetId = (selectedOrder as any)._id || selectedOrder.orderNumber || selectedOrder.id;
      await api.patch(`/admin/orders/${targetId}/status`, {
        fulfilmentStatus: newStatus,
        sellerAcceptanceStatus: newSellerAcceptanceStatus,
        trackingNumber: trackingNumber || undefined,
        shippingProvider: shippingProvider || undefined,
        note: note || `Status updated to ${newStatus}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders-list'] });
      setSelectedOrder(null);
    },
  });

  const openStatusDialog = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.fulfilmentStatus);
    setNewSellerAcceptanceStatus((order.sellerAcceptanceStatus as any) || 'pending');
    setTrackingNumber(order.trackingNumber || '');
    setShippingProvider(order.shippingProvider || '');
    setNote('');
  };

  // Shadowfax Dispatch Dialog State
  const [orderToDispatch, setOrderToDispatch] = useState<Order | null>(null);
  const [dispatchQuote, setDispatchQuote] = useState<any | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState<any | null>(null);

  // Shadowfax Tracking Dialog State
  const [orderToTrack, setOrderToTrack] = useState<Order | null>(null);
  const [trackingData, setTrackingData] = useState<any | null>(null);
  const [isLoadingTracking, setIsLoadingTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  // Internal Delivery Partner Assignment & Tracking State
  const [orderToAssignPartner, setOrderToAssignPartner] = useState<Order | null>(null);
  const [availablePartners, setAvailablePartners] = useState<DeliveryPartnerProfile[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [isAssigningPartner, setIsAssigningPartner] = useState(false);
  const [assignPartnerError, setAssignPartnerError] = useState<string | null>(null);
  const [internalTrackOrder, setInternalTrackOrder] = useState<Order | null>(null);
  const [internalAssignment, setInternalAssignment] = useState<DeliveryAssignment | null>(null);
  const [isLoadingInternalTrack, setIsLoadingInternalTrack] = useState(false);

  const openAssignPartnerDialog = async (order: Order) => {
    setOrderToAssignPartner(order);
    setAssignPartnerError(null);
    setSelectedPartnerId('');
    try {
      const resp = await api.get('/admin/delivery-partners?status=active');
      if (resp.data?.success) {
        const list = (resp.data.data || []) as DeliveryPartnerProfile[];
        setAvailablePartners(list);
        const firstVerified = list.find((p) => p.kycStatus === 'verified');
        if (firstVerified) setSelectedPartnerId(firstVerified.partnerId);
      }
    } catch {
      setAssignPartnerError('Failed to load active delivery partners.');
    }
  };

  const handleConfirmAssignPartner = async () => {
    if (!orderToAssignPartner || !selectedPartnerId) return;
    setIsAssigningPartner(true);
    setAssignPartnerError(null);
    try {
      const targetId = (orderToAssignPartner as any)._id || orderToAssignPartner.orderNumber || orderToAssignPartner.id;
      const resp = await api.post(`/admin/orders/${targetId}/delivery/assign`, {
        partnerId: selectedPartnerId,
      });
      if (resp.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['admin-orders-list'] });
        setOrderToAssignPartner(null);
      }
    } catch (err: any) {
      setAssignPartnerError(err.response?.data?.error?.message || 'Failed to assign delivery partner.');
    } finally {
      setIsAssigningPartner(false);
    }
  };

  const openInternalTrackDialog = async (order: Order) => {
    setInternalTrackOrder(order);
    setInternalAssignment(null);
    setIsLoadingInternalTrack(true);
    try {
      const targetId = (order as any)._id || order.orderNumber || order.id;
      const resp = await api.get(`/admin/orders/${targetId}/delivery/track`);
      if (resp.data?.success) {
        setInternalAssignment(resp.data.data);
      }
    } catch {
      setInternalAssignment(null);
    } finally {
      setIsLoadingInternalTrack(false);
    }
  };

  const handleCancelInternalAssignment = async (order: Order) => {
    if (!window.confirm(`Cancel E-Shopy delivery assignment for #${order.orderNumber}?`)) return;
    const targetId = (order as any)._id || order.orderNumber || order.id;
    await api.post(`/admin/orders/${targetId}/delivery/cancel`, { reason: 'Reassigned by admin' });
    setInternalTrackOrder(null);
    queryClient.invalidateQueries({ queryKey: ['admin-orders-list'] });
  };

  const openDispatchDialog = async (order: Order) => {
    setOrderToDispatch(order);
    setDispatchError(null);
    setDispatchSuccess(null);
    setDispatchQuote(null);
    setIsLoadingQuote(true);

    try {
      const targetId = (order as any)._id || order.orderNumber || order.id;
      const resp = await api.get(`/admin/orders/${targetId}/shadowfax/quote`);
      if (resp.data?.success) {
        setDispatchQuote(resp.data.data);
      }
    } catch (err: any) {
      console.warn('Could not pre-fetch quote', err);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!orderToDispatch) return;
    setIsDispatching(true);
    setDispatchError(null);

    try {
      const targetId = (orderToDispatch as any)._id || orderToDispatch.orderNumber || orderToDispatch.id;
      const resp = await api.post(`/admin/orders/${targetId}/shadowfax/create`);
      if (resp.data?.success) {
        setDispatchSuccess(resp.data.data);
        queryClient.invalidateQueries({ queryKey: ['admin-orders-list'] });
      }
    } catch (err: any) {
      setDispatchError(err.response?.data?.error?.message || err.message || 'Failed to dispatch via Shadowfax');
    } finally {
      setIsDispatching(false);
    }
  };

  const openTrackDialog = async (order: Order) => {
    setOrderToTrack(order);
    setTrackingError(null);
    setTrackingData(null);
    setIsLoadingTracking(true);

    try {
      const targetId = (order as any)._id || order.orderNumber || order.id;
      const resp = await api.get(`/admin/orders/${targetId}/shadowfax/track`);
      if (resp.data?.success) {
        setTrackingData(resp.data.data);
      }
    } catch (err: any) {
      setTrackingError(err.response?.data?.error?.message || 'Failed to load live tracking details.');
    } finally {
      setIsLoadingTracking(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
          Orders & Fulfillment
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track customer purchases, update dispatch lifecycle stages, and monitor payments.
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Order #</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Customer Name</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Total (₹)</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Payment</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Ready to Pickup</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Fulfillment</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Delivery Dispatch</TableCell>
                  <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ordersData?.items?.map((order) => (
                  <TableRow key={order.id || order.orderNumber} hover>
                    <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>{order.orderNumber}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{(order as any).customerName || order.shippingAddress?.name || 'Customer'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>{(order as any).customerEmail || '-'}</TableCell>
                    <TableCell sx={{ fontSize: '0.85rem' }}>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell sx={{ fontWeight: 900, color: '#0f172a' }}>
                      ₹{(((order.pricing?.grandTotal ?? 0) / 100)).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.paymentStatus?.toUpperCase()}
                        size="small"
                        sx={{
                          fontWeight: 800,
                          fontSize: 10,
                          bgcolor: order.paymentStatus === 'paid' ? '#dcfce7' : '#fef3c7',
                          color: order.paymentStatus === 'paid' ? '#15803d' : '#b45309',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const status = order.sellerAcceptanceStatus || 'pending';
                        if (status === 'accepted') {
                          return (
                            <Tooltip title={order.sellerAcceptedAt ? `Ready for pickup (Confirmed on ${new Date(order.sellerAcceptedAt).toLocaleString()})` : 'Ready for pickup'}>
                              <Chip
                                icon={<CheckCircleIcon sx={{ fontSize: '13px !important' }} />}
                                label="Yes"
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: 11,
                                  bgcolor: '#dcfce7',
                                  color: '#15803d',
                                  border: '1px solid #86efac',
                                  px: 0.5,
                                }}
                              />
                            </Tooltip>
                          );
                        }
                        if (status === 'rejected') {
                          return (
                            <Tooltip title={`Not ready - Seller rejected: ${order.sellerRejectionReason || 'No reason provided'}`}>
                              <Chip
                                icon={<CancelIcon sx={{ fontSize: '13px !important' }} />}
                                label="No"
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: 11,
                                  bgcolor: '#fee2e2',
                                  color: '#b91c1c',
                                  border: '1px solid #fca5a5',
                                  px: 0.5,
                                }}
                              />
                            </Tooltip>
                          );
                        }
                        return (
                          <Tooltip title="Not ready - Awaiting seller confirmation">
                            <Chip
                              icon={<PendingIcon sx={{ fontSize: '13px !important' }} />}
                              label="No"
                              size="small"
                              sx={{
                                fontWeight: 800,
                                fontSize: 11,
                                bgcolor: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                px: 0.5,
                              }}
                            />
                          </Tooltip>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.fulfilmentStatus?.toUpperCase()}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: 10,
                          borderRadius: 1,
                          bgcolor: order.fulfilmentStatus === 'delivered' ? '#dcfce7' : order.fulfilmentStatus === 'shipped' ? '#eff6ff' : '#f1f5f9',
                          color: order.fulfilmentStatus === 'delivered' ? '#15803d' : order.fulfilmentStatus === 'shipped' ? '#1d4ed8' : '#475569',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const internal = order.deliveryDetails;
                        const sfx = (order as any).shadowfaxDetails;
                        const awb = sfx?.awbNumber || (order.shippingProvider === 'Shadowfax' ? order.trackingNumber : null);

                        if (internal?.assignmentCode && internal.status !== 'cancelled') {
                          return (
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Chip
                                icon={<BikeIcon sx={{ fontSize: '14px !important' }} />}
                                label={`${internal.partnerId || 'Rider'} (${(internal.status || 'assigned').replace(/_/g, ' ')})`}
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: 10,
                                  bgcolor: internal.status === 'delivered' ? '#dcfce7' : '#fff7ed',
                                  color: internal.status === 'delivered' ? '#15803d' : '#c2410c',
                                  border: '1px solid #fed7aa',
                                }}
                              />
                              <Tooltip title="Track E-Shopy Delivery Partner">
                                <IconButton size="small" onClick={() => openInternalTrackDialog(order)} sx={{ color: '#FF7900' }}>
                                  <TrackIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          );
                        }

                        if (awb) {
                          return (
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Chip
                                label={`AWB: ${awb}`}
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: 10,
                                  bgcolor: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                }}
                              />
                              <Tooltip title="Live Shadowfax Tracking">
                                <IconButton size="small" onClick={() => openTrackDialog(order)} sx={{ color: '#2563eb' }}>
                                  <TrackIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {sfx?.labelUrl && (
                                <Tooltip title="Print Shipping Label PDF">
                                  <IconButton
                                    size="small"
                                    component="a"
                                    href={sfx.labelUrl}
                                    target="_blank"
                                    sx={{ color: '#059669' }}
                                  >
                                    <PrintIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          );
                        }

                        const isAccepted = order.sellerAcceptanceStatus === 'accepted';
                        const isRejected = order.sellerAcceptanceStatus === 'rejected';
                        const isCancelled = order.fulfilmentStatus === 'cancelled';

                        let disabledTooltip = '';
                        if (isCancelled) disabledTooltip = 'Order is cancelled';
                        else if (isRejected) disabledTooltip = `Seller rejected order: ${order.sellerRejectionReason || ''}`;
                        else if (!isAccepted) disabledTooltip = 'Awaiting seller acceptance before dispatching';

                        const canDispatch = isAccepted && !isCancelled;

                        return (
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Tooltip title={disabledTooltip || 'Assign internal E-Shopy delivery partner'}>
                              <span>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={!canDispatch}
                                  onClick={() => openAssignPartnerDialog(order)}
                                  startIcon={<BikeIcon sx={{ fontSize: 15 }} />}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.7rem',
                                    py: 0.35,
                                    px: 1,
                                    borderColor: '#FF7900',
                                    color: '#EA580C',
                                  }}
                                >
                                  Assign Rider
                                </Button>
                              </span>
                            </Tooltip>
                            <Tooltip title={disabledTooltip || 'Book delivery with Shadowfax Forward Logistics'}>
                              <span>
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={!canDispatch}
                                  onClick={() => openDispatchDialog(order)}
                                  startIcon={<ShippingIcon sx={{ fontSize: 15 }} />}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.7rem',
                                    py: 0.35,
                                    px: 1,
                                    bgcolor: canDispatch ? '#FF7900' : undefined,
                                    '&:hover': { bgcolor: '#e66d00' },
                                  }}
                                >
                                  Shadowfax
                                </Button>
                              </span>
                            </Tooltip>
                          </Stack>
                        );
                      })()}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', minWidth: 100 }}>
                      <Tooltip title="View Tax Invoice">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setActiveInvoiceOrder(order);
                            setInvoiceModalOpen(true);
                          }}
                        >
                          <InvoiceIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Update Status">
                        <IconButton size="small" onClick={() => openStatusDialog(order)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Status Update Dialog */}
      <Dialog open={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          Update Order #{selectedOrder?.orderNumber}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Fulfilment Status</InputLabel>
              <Select
                value={newStatus}
                label="Fulfilment Status"
                onChange={(e) => setNewStatus(e.target.value)}
              >
                {FULFILMENT_STATUSES.map((st) => (
                  <MenuItem key={st} value={st}>{st.toUpperCase()}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Ready to Pickup</InputLabel>
              <Select
                value={newSellerAcceptanceStatus}
                label="Ready to Pickup"
                onChange={(e) => setNewSellerAcceptanceStatus(e.target.value as any)}
              >
                <MenuItem value="accepted">Yes (Confirmed & Ready for Pickup)</MenuItem>
                <MenuItem value="pending">No (Pending Seller Confirmation)</MenuItem>
                <MenuItem value="rejected">No (Seller Rejected Order)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Shipping Provider (e.g. Blue Dart, Delhivery)"
              fullWidth
              size="small"
              value={shippingProvider}
              onChange={(e) => setShippingProvider(e.target.value)}
            />

            <TextField
              label="Tracking Number / AWB"
              fullWidth
              size="small"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />

            <TextField
              label="Status Change Note"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Package dispatched from Bangalore warehouse"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setSelectedOrder(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            sx={{ fontWeight: 700 }}
          >
            {updateMutation.isPending ? 'Updating…' : 'Save Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Shadowfax Dispatch Confirmation Dialog */}
      <Dialog
        open={Boolean(orderToDispatch)}
        onClose={() => {
          if (!isDispatching) setOrderToDispatch(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShippingIcon sx={{ color: '#FF7900' }} />
          Dispatch Order #{orderToDispatch?.orderNumber} via Shadowfax
        </DialogTitle>
        <DialogContent dividers>
          {dispatchSuccess ? (
            <Box sx={{ py: 2 }}>
              <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Shadowfax Delivery Booked Successfully!
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  The shipment has been assigned AWB Number: <strong>{dispatchSuccess.awbNumber}</strong>.
                  Destination Hub: <strong>{dispatchSuccess.destinationHub || 'Forward Hub'}</strong>.
                </Typography>
              </Alert>

              {dispatchSuccess.labelUrl && (
                <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #bbf7d0', bgcolor: '#f0fdf4', borderRadius: 2, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#166534', mb: 1 }}>
                    Printable Shipping Label Ready
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#15803d', mb: 2 }}>
                    Download or print the official Shadowfax barcode shipping label for the package.
                  </Typography>
                  <Button
                    variant="contained"
                    color="success"
                    component="a"
                    href={dispatchSuccess.labelUrl}
                    target="_blank"
                    startIcon={<PrintIcon />}
                    sx={{ fontWeight: 800 }}
                  >
                    Open Shipping Label (PDF)
                  </Button>
                </Paper>
              )}
            </Box>
          ) : (
            <Stack spacing={2.5}>
              {dispatchError && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {dispatchError}
                </Alert>
              )}

              {isLoadingQuote ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4, gap: 2 }}>
                  <CircularProgress size={28} sx={{ color: '#FF7900' }} />
                  <Typography variant="body2" sx={{ color: '#64748B' }}>
                    Verifying Shadowfax serviceability and rate quote…
                  </Typography>
                </Box>
              ) : dispatchQuote ? (
                <>
                  {/* Serviceability Badges */}
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 0.5 }}>
                          SELLER PICKUP LOCATION
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                          {dispatchQuote.pickup?.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.85rem' }}>
                          {dispatchQuote.pickup?.address_line_1}, {dispatchQuote.pickup?.city} - {dispatchQuote.pickup?.pincode}
                        </Typography>
                        <Chip
                          label={dispatchQuote.pickup?.serviceable ? 'Pickup Serviceable' : 'Pickup Not Serviceable'}
                          size="small"
                          color={dispatchQuote.pickup?.serviceable ? 'success' : 'error'}
                          sx={{ mt: 1, fontWeight: 700, fontSize: 10 }}
                        />
                      </Paper>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 0.5 }}>
                          CUSTOMER DESTINATION
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                          {(orderToDispatch as any)?.customerName || orderToDispatch?.shippingAddress?.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.85rem' }}>
                          {orderToDispatch?.shippingAddress?.line1}, {dispatchQuote.delivery?.city} - {dispatchQuote.delivery?.pincode}
                        </Typography>
                        <Chip
                          label={dispatchQuote.delivery?.serviceable ? `Delivery Serviceable (${dispatchQuote.delivery?.services?.join(', ') || 'Regular'})` : 'Delivery Unserviceable'}
                          size="small"
                          color={dispatchQuote.delivery?.serviceable ? 'success' : 'error'}
                          sx={{ mt: 1, fontWeight: 700, fontSize: 10 }}
                        />
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Estimated Rate Quote */}
                  {dispatchQuote.rate && (
                    <Paper elevation={0} sx={{ p: 2, border: '1px solid #fed7aa', bgcolor: '#fff7ed', borderRadius: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#9a3412', mb: 0.5 }}>
                        Shadowfax Shipping Rate Quote
                      </Typography>
                      <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#7c2d12' }}>Zone</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>{dispatchQuote.rate.zone}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#7c2d12' }}>Base Rate</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>₹{dispatchQuote.rate.shippingRate}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#7c2d12' }}>GST (18%)</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>₹{dispatchQuote.rate.gst}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#7c2d12' }}>Estimated Total</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 900, color: '#ea580c' }}>
                            ₹{dispatchQuote.rate.total}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  )}

                  {/* Order Items Summary */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 1 }}>
                      Shipment Items ({orderToDispatch?.items?.length || 0})
                    </Typography>
                    <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden' }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="center">Qty</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">Declared Value</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {orderToDispatch?.items?.map((it, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ fontWeight: 600 }}>{it.name}</TableCell>
                              <TableCell sx={{ color: '#64748B', fontSize: '0.85rem' }}>{it.sku}</TableCell>
                              <TableCell align="center">{it.quantity}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>
                                ₹{((it.lineTotal || 0) / 100).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Paper>
                  </Box>
                </>
              ) : null}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {dispatchSuccess ? (
            <Button variant="contained" onClick={() => setOrderToDispatch(null)}>
              Done
            </Button>
          ) : (
            <>
              <Button onClick={() => setOrderToDispatch(null)} disabled={isDispatching}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleConfirmDispatch}
                disabled={isDispatching || isLoadingQuote || (dispatchQuote && !dispatchQuote.delivery?.serviceable)}
                startIcon={isDispatching ? <CircularProgress size={18} color="inherit" /> : <ShippingIcon />}
                sx={{ fontWeight: 800, bgcolor: '#FF7900', '&:hover': { bgcolor: '#e66d00' } }}
              >
                {isDispatching ? 'Booking Shadowfax…' : 'Confirm & Book Delivery'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Shadowfax Live Tracking Dialog */}
      <Dialog
        open={Boolean(orderToTrack)}
        onClose={() => setOrderToTrack(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrackIcon sx={{ color: '#2563eb' }} />
          Shadowfax Delivery Tracking
        </DialogTitle>
        <DialogContent dividers>
          {isLoadingTracking ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6, gap: 2 }}>
              <CircularProgress size={28} sx={{ color: '#2563eb' }} />
              <Typography variant="body2" sx={{ color: '#64748B' }}>
                Fetching real-time tracking from Shadowfax network…
              </Typography>
            </Box>
          ) : trackingError ? (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {trackingError}
            </Alert>
          ) : trackingData ? (
            <Stack spacing={2.5}>
              {/* Status Header Card */}
              <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#1d4ed8' }}>
                      AWB NUMBER
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 900, color: '#1e3a8a' }}>
                      {trackingData.awbNumber}
                    </Typography>
                  </Box>
                  <Chip
                    label={trackingData.orderDetails?.status_display || trackingData.orderDetails?.status || 'Active'}
                    color="primary"
                    sx={{ fontWeight: 800, textTransform: 'capitalize' }}
                  />
                </Stack>
                {trackingData.orderDetails?.destination_hub && (
                  <Typography variant="body2" sx={{ color: '#1e40af', mt: 1 }}>
                    Destination Hub: <strong>{trackingData.orderDetails.destination_hub}</strong>
                  </Typography>
                )}
              </Paper>

              {/* Event Timeline */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b', mb: 1.5 }}>
                  Tracking History
                </Typography>
                {(!trackingData.trackingDetails || trackingData.trackingDetails.length === 0) ? (
                  <Typography variant="body2" sx={{ color: '#64748B', py: 2, textAlign: 'center' }}>
                    Shipment registered. Pending pickup by Shadowfax rider.
                  </Typography>
                ) : (
                  <Stack spacing={2} sx={{ pl: 1 }}>
                    {trackingData.trackingDetails.map((evt: any, i: number) => (
                      <Box
                        key={i}
                        sx={{
                          position: 'relative',
                          pl: 2.5,
                          borderLeft: '2px solid #3b82f6',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            left: -5,
                            top: 4,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: '#3b82f6',
                          },
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                            {evt.status || evt.status_id}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748B' }}>
                            {evt.created ? new Date(evt.created).toLocaleString('en-IN') : ''}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.85rem' }}>
                          {evt.remarks || 'Status updated'}
                        </Typography>
                        {evt.location && (
                          <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.25 }}>
                            Location: {evt.location}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {orderToTrack?.shadowfaxDetails?.labelUrl && (
            <Button
              component="a"
              href={orderToTrack.shadowfaxDetails.labelUrl}
              target="_blank"
              startIcon={<PrintIcon />}
              sx={{ fontWeight: 700, mr: 'auto' }}
            >
              Print Label
            </Button>
          )}
          <Button onClick={() => setOrderToTrack(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Assign Internal Delivery Partner Dialog */}
      <Dialog
        open={Boolean(orderToAssignPartner)}
        onClose={() => !isAssigningPartner && setOrderToAssignPartner(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <BikeIcon sx={{ color: '#FF7900' }} />
          Assign Rider to #{orderToAssignPartner?.orderNumber}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {assignPartnerError && <Alert severity="error">{assignPartnerError}</Alert>}
            {availablePartners.length === 0 ? (
              <Alert severity="info">
                No active delivery partners found. Approve or create a rider in Delivery Partners first.
              </Alert>
            ) : (
              <FormControl fullWidth size="small">
                <InputLabel>Select Delivery Partner</InputLabel>
                <Select
                  value={selectedPartnerId}
                  label="Select Delivery Partner"
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                >
                  {availablePartners.map((p) => {
                    const isVerified = p.kycStatus === 'verified';
                    return (
                      <MenuItem key={p.partnerId} value={p.partnerId} disabled={!isVerified}>
                        {p.name} ({p.partnerId}) — {isVerified ? p.availabilityStatus.toUpperCase() : 'KYC PENDING'} • {p.city}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOrderToAssignPartner(null)} disabled={isAssigningPartner}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!selectedPartnerId || isAssigningPartner}
            onClick={handleConfirmAssignPartner}
            sx={{ bgcolor: '#FF7900', fontWeight: 800 }}
          >
            {isAssigningPartner ? 'Assigning...' : 'Assign Rider'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Internal Delivery Partner Live Tracking Dialog */}
      <Dialog
        open={Boolean(internalTrackOrder)}
        onClose={() => setInternalTrackOrder(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <BikeIcon sx={{ color: '#FF7900' }} />
          E-Shopy Delivery Tracking — #{internalTrackOrder?.orderNumber}
        </DialogTitle>
        <DialogContent dividers>
          {isLoadingInternalTrack ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : internalAssignment ? (
            <Stack spacing={2}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle2" fontWeight={800}>
                      {internalAssignment.partnerName} ({internalAssignment.partnerId})
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      +91 {internalAssignment.partnerPhone} • {internalAssignment.vehicleType.toUpperCase()} ({internalAssignment.vehicleNumber || 'N/A'})
                    </Typography>
                  </Box>
                  <Chip
                    label={internalAssignment.status.replace(/_/g, ' ').toUpperCase()}
                    color={internalAssignment.status === 'delivered' ? 'success' : 'warning'}
                    sx={{ fontWeight: 800 }}
                  />
                </Stack>
                {internalAssignment.deliveryOtp && (
                  <Typography variant="body2" sx={{ mt: 1, fontWeight: 700, color: '#9A3412' }}>
                    Customer Delivery OTP: <strong>{internalAssignment.deliveryOtp}</strong>
                  </Typography>
                )}
                {internalAssignment.lastKnownLocation && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Last GPS: {internalAssignment.lastKnownLocation.lat}, {internalAssignment.lastKnownLocation.lng}
                  </Typography>
                )}
              </Paper>

              {internalAssignment.podPhotoUrl && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75 }}>
                    Proof of Delivery Photo
                  </Typography>
                  <img
                    src={internalAssignment.podPhotoUrl}
                    alt="POD"
                    style={{ maxHeight: 180, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                </Box>
              )}

              <Box>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                  Delivery Timeline
                </Typography>
                <Stack spacing={1}>
                  {(internalAssignment.trackingHistory || []).map((evt, idx) => (
                    <Box key={idx} sx={{ pl: 2, borderLeft: '2px solid #FF7900' }}>
                      <Typography variant="caption" fontWeight={800}>
                        {evt.status.replace(/_/g, ' ').toUpperCase()} • {new Date(evt.timestamp).toLocaleString('en-IN')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {evt.note}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Stack>
          ) : (
            <Alert severity="info">No assignment details available.</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {internalAssignment && !['delivered', 'failed', 'cancelled'].includes(internalAssignment.status) && internalTrackOrder && (
            <Button
              color="error"
              onClick={() => handleCancelInternalAssignment(internalTrackOrder)}
              sx={{ mr: 'auto', fontWeight: 700 }}
            >
              Cancel Assignment
            </Button>
          )}
          <Button onClick={() => setInternalTrackOrder(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Official Tax Invoice Viewer Dialog */}
      <InvoiceViewerDialog
        open={invoiceModalOpen}
        onClose={() => {
          setInvoiceModalOpen(false);
          setActiveInvoiceOrder(null);
        }}
        invoiceIdentifier={activeInvoiceOrder?.orderNumber || (activeInvoiceOrder as any)?._id || activeInvoiceOrder?.id || null}
        orderNumber={activeInvoiceOrder?.orderNumber}
      />
    </Box>
  );
}
