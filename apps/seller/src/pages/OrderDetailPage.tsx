import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Stack,
  Chip,
  CircularProgress,
  TextField,
  MenuItem,
  Alert,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  LocalShipping as ShippingIcon,
  CheckCircle as CheckCircleIcon,
  Place as PlaceIcon,
  Person as PersonIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  WarningAmber as WarningIcon,
  Cancel as CancelIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import api from '../api/client';
import { useSellerAuthStore } from '../store/auth.store';

export default function OrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const { seller } = useSellerAuthStore();

  const [order, setOrder] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status update form state
  const [status, setStatus] = useState<string>('dispatched');
  const [courierName, setCourierName] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  // Seller Accept / Reject state
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState('Out of stock / Inventory shortage');
  const [customReason, setCustomReason] = useState('');

  const loadOrder = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await api.get(`/seller/orders/${orderNumber}`);
      if (resp.data?.success) {
        setOrder(resp.data.data);
        const firstItem = resp.data.data?.items?.[0];
        if (firstItem?.itemStatus) {
          setStatus(firstItem.itemStatus);
        }
        if (firstItem?.courierName) setCourierName(firstItem.courierName);
        if (firstItem?.trackingNumber) setTrackingNumber(firstItem.trackingNumber);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load order details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [orderNumber]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateMsg(null);
    try {
      const resp = await api.patch(`/seller/orders/${orderNumber}/status`, {
        status,
        courierName: courierName.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
      });

      if (resp.data?.success) {
        setUpdateMsg(`Order items updated to "${status}" successfully.`);
        loadOrder();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update order status.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAcceptOrder = async () => {
    setIsAccepting(true);
    setError(null);
    setUpdateMsg(null);
    try {
      const resp = await api.post(`/seller/orders/${orderNumber}/accept`);
      if (resp.data?.success) {
        setUpdateMsg('Order accepted successfully! You can now prepare and pack the items.');
        loadOrder();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to accept order.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleRejectOrder = async () => {
    const finalReason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
    if (!finalReason) {
      setError('Please provide a reason for rejecting this order.');
      return;
    }

    setIsRejecting(true);
    setError(null);
    setUpdateMsg(null);
    try {
      const resp = await api.post(`/seller/orders/${orderNumber}/reject`, { reason: finalReason });
      if (resp.data?.success) {
        setRejectDialogOpen(false);
        setUpdateMsg(`Order rejected: ${finalReason}`);
        loadOrder();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to reject order.');
    } finally {
      setIsRejecting(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress size={36} sx={{ color: '#FF7900' }} />
      </Box>
    );
  }

  if (error || !order) {
    return (
      <Box sx={{ py: 6 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Order not found.'}</Alert>
        <Button component={RouterLink} to="/orders" startIcon={<ArrowBackIcon />}>
          Back to Orders
        </Button>
      </Box>
    );
  }

  const items = order.items || [];
  const shipping = order.shippingAddress || {};

  return (
    <Box>
      {/* Back button & Title */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Button
          component={RouterLink}
          to="/orders"
          startIcon={<ArrowBackIcon />}
          variant="outlined"
          size="small"
        >
          Back
        </Button>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#172B30' }}>
            Order #{order.orderNumber}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Placed on {new Date(order.createdAt).toLocaleString('en-IN')}
          </Typography>
        </Box>
      </Stack>

      {updateMsg && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
          {updateMsg}
        </Alert>
      )}

      {/* Seller Acceptance Status Banner */}
      {(!order.sellerAcceptanceStatus || order.sellerAcceptanceStatus === 'pending') && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            bgcolor: '#FFFBEB',
            border: '2px solid #FCD34D',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: '#FEF3C7',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <WarningIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#92400E' }}>
                Ready to Pickup Confirmation (Yes / No)
              </Typography>
              <Typography variant="body2" sx={{ color: '#B45309' }}>
                Confirm whether items are packed and ready for courier pickup dispatch.
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<CloseIcon />}
              onClick={() => setRejectDialogOpen(true)}
              disabled={isAccepting || isRejecting}
              sx={{ fontWeight: 700 }}
            >
              No, Reject Order
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={isAccepting ? <CircularProgress size={18} color="inherit" /> : <ThumbUpIcon />}
              onClick={handleAcceptOrder}
              disabled={isAccepting || isRejecting}
              sx={{ fontWeight: 800, px: 3, bgcolor: '#059669', '&:hover': { bgcolor: '#047857' } }}
            >
              {isAccepting ? 'Confirming...' : 'Yes, Ready to Pickup'}
            </Button>
          </Stack>
        </Paper>
      )}

      {order.sellerAcceptanceStatus === 'accepted' && (
        <Alert
          severity="success"
          icon={<CheckCircleIcon fontSize="inherit" />}
          sx={{
            mb: 3,
            borderRadius: 2.5,
            border: '1px solid #A7F3D0',
            bgcolor: '#ECFDF5',
            color: '#065F46',
            fontWeight: 600,
          }}
        >
          <strong>Ready to Pickup: Yes</strong> — Confirmed on{' '}
          {order.sellerAcceptedAt ? new Date(order.sellerAcceptedAt).toLocaleString('en-IN') : 'confirmation'}.
          Items are confirmed ready for courier dispatch.
        </Alert>
      )}

      {order.sellerAcceptanceStatus === 'rejected' && (
        <Alert
          severity="error"
          icon={<CancelIcon fontSize="inherit" />}
          sx={{
            mb: 3,
            borderRadius: 2.5,
            border: '1px solid #FECACA',
            bgcolor: '#FEF2F2',
            color: '#991B1B',
            fontWeight: 600,
          }}
        >
          <strong>Order Rejected:</strong> You declined this order on{' '}
          {order.sellerRejectedAt ? new Date(order.sellerRejectedAt).toLocaleString('en-IN') : 'review'}.
          <br />
          <strong>Reason:</strong> {order.sellerRejectionReason || 'No specific reason entered.'}
        </Alert>
      )}

      {/* Reject Order Confirmation Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E293B' }}>
          Reject Order #{order.orderNumber}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
            Please select the reason for rejecting this order. The reason will be recorded for Admin review and customer updates.
          </Typography>
          <FormControl component="fieldset" fullWidth>
            <FormLabel sx={{ fontWeight: 700, mb: 1, color: '#334155' }}>Reason for Rejection *</FormLabel>
            <RadioGroup
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
            >
              <FormControlLabel value="Out of stock / Inventory shortage" control={<Radio />} label="Out of stock / Inventory shortage" />
              <FormControlLabel value="Item damaged or defective" control={<Radio />} label="Item damaged or defective" />
              <FormControlLabel value="Cannot service delivery location" control={<Radio />} label="Cannot service delivery location" />
              <FormControlLabel value="Pricing or specification discrepancy" control={<Radio />} label="Pricing or specification discrepancy" />
              <FormControlLabel value="Other" control={<Radio />} label="Other reason (specify below)" />
            </RadioGroup>
          </FormControl>

          {selectedReason === 'Other' && (
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Describe the exact reason for rejecting this order..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={isRejecting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRejectOrder}
            disabled={isRejecting || (selectedReason === 'Other' && !customReason.trim())}
            startIcon={isRejecting ? <CircularProgress size={18} color="inherit" /> : <CloseIcon />}
            sx={{ fontWeight: 800 }}
          >
            {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
          </Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={3}>
        {/* Left Column: Items to Fulfill */}
        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF', mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#172B30' }}>
                Items to Fulfill ({items.length})
              </Typography>
              <Chip
                label={seller?.categoryName || 'Your Category'}
                size="small"
                sx={{ bgcolor: '#FFF7ED', color: '#FF7900', fontWeight: 700 }}
              />
            </Box>

            <TableContainer sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Table size="small" sx={{ minWidth: 500 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Qty</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Item Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((it: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          {it.image && (
                            <Box
                              component="img"
                              src={it.image}
                              alt={it.name}
                              sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1.5, border: '1px solid #E2E8F0' }}
                            />
                          )}
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                              {it.name}
                            </Typography>
                            <Chip
                              label={`Status: ${it.itemStatus || 'pending'}`}
                              size="small"
                              sx={{ fontSize: '0.65rem', height: 18, mt: 0.5 }}
                            />
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ color: '#64748B' }}>{it.sku}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>{it.quantity}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#172B30' }}>
                        ₹{((it.lineTotal || 0) / 100).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Customer Delivery Address */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <PlaceIcon sx={{ color: '#FF7900' }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#172B30' }}>
                Customer Shipping Destination
              </Typography>
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
              {shipping.name || order.customerName}
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>
              {shipping.line1} {shipping.line2}
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569' }}>
              {shipping.city}, {shipping.state} - <strong>{shipping.pincode}</strong>
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>
              Phone: <strong>{shipping.phone}</strong>
            </Typography>
          </Paper>
        </Grid>

        {/* Right Column: Dispatch Action Card */}
        <Grid item xs={12} md={5}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1.5px solid #E2E8F0',
              bgcolor: '#FFFFFF',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ShippingIcon sx={{ color: '#FF7900' }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#172B30' }}>
                Update Fulfillment & Delivery
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#64748B', mb: 2.5 }}>
              Update dispatch and delivery details for the items from your seller inventory.
            </Typography>

            <Box component="form" onSubmit={handleUpdateStatus}>
              <Stack spacing={2.5}>
                <TextField
                  select
                  fullWidth
                  label="Delivery Status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="packed">Packed & Ready</MenuItem>
                  <MenuItem value="dispatched">Dispatched / Shipped</MenuItem>
                  <MenuItem value="delivered">Delivered to Customer</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </TextField>

                <TextField
                  fullWidth
                  label="Courier / Delivery Partner"
                  placeholder="e.g. Delhivery, BlueDart, or Seller Direct Delivery"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                />

                <TextField
                  fullWidth
                  label="Tracking / AWB Number"
                  placeholder="e.g. DLV-987654321"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />

                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isUpdating}
                  startIcon={isUpdating ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
                  sx={{ py: 1.25, fontWeight: 800 }}
                >
                  {isUpdating ? 'Saving...' : 'Update Status'}
                </Button>
              </Stack>
            </Box>
          </Paper>

          {/* Status History Notes */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#F8FAFC', mt: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30', mb: 1.5 }}>
                Status History Log
              </Typography>
              <Stack spacing={1}>
                {order.statusHistory.slice(-4).reverse().map((hist: any, i: number) => (
                  <Box key={i} sx={{ borderLeft: '2px solid #FF7900', pl: 1.5, py: 0.25 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#172B30', textTransform: 'capitalize' }}>
                      {hist.status} • {hist.changedBy}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                      {hist.note || 'Status updated'} ({new Date(hist.changedAt).toLocaleTimeString('en-IN')})
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

