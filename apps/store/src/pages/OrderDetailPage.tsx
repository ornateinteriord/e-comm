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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  LocalShipping as ShippingIcon,
  CheckCircle as CheckCircleIcon,
  Place as PlaceIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import api from '../api/client';
import { useStoreAuthStore } from '../store/auth.store';

export default function OrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const { store } = useStoreAuthStore();

  const [order, setOrder] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status update form state
  const [status, setStatus] = useState<string>('dispatched');
  const [courierName, setCourierName] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const loadOrder = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await api.get(`/store/orders/${orderNumber}`);
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
      const resp = await api.patch(`/store/orders/${orderNumber}/status`, {
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

      <Grid container spacing={3}>
        {/* Left Column: Items to Fulfill */}
        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF', mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#172B30' }}>
                Items to Fulfill ({items.length})
              </Typography>
              <Chip
                label={store?.categoryName || 'Your Category'}
                size="small"
                sx={{ bgcolor: '#FFF7ED', color: '#FF7900', fontWeight: 700 }}
              />
            </Box>

            <TableContainer>
              <Table size="small">
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
              Update dispatch and delivery details for the items from your store.
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
                  placeholder="e.g. Delhivery, BlueDart, or Store Delivery"
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

