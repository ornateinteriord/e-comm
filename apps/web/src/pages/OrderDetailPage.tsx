import { useParams, Link as RouterLink } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Container, Typography, Paper, Grid, Chip, Button,
  Divider, Stack, Stepper, Step, StepLabel, CircularProgress,
  Alert,
} from '@mui/material';
import {
  Receipt as InvoiceIcon,
  CancelOutlined as CancelIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import api from '../api/client';
import type { Order } from '@ornate/types';

const STEPS = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered'];

export default function OrderDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: order, isLoading, error } = useQuery<Order>({
    queryKey: ['order-detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data;
    },
    enabled: Boolean(id),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/orders/${id}/cancel`, { reason: 'Cancelled by customer' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 16 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !order) {
    return (
      <Container maxWidth="md" sx={{ py: 12, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Order not found</Typography>
        <Button variant="contained" component={RouterLink} to="/orders">Back to Orders</Button>
      </Container>
    );
  }

  const currentStep = STEPS.indexOf(order.fulfilmentStatus);
  const isCancelled = order.fulfilmentStatus === 'cancelled';

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Button component={RouterLink} to="/orders" startIcon={<BackIcon />} sx={{ mb: 1, pl: 0 }}>
            Back to All Orders
          </Button>
          <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em">
            Order #{order.orderNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Placed on {new Date(order.createdAt).toLocaleString()}
          </Typography>
        </Box>

        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<InvoiceIcon />}
            href={`/api/v1/invoices/${order.id || order.orderNumber}/html`}
            target="_blank"
            sx={{ borderRadius: '6px', fontWeight: 700 }}
          >
            View Tax Invoice
          </Button>

          {!isCancelled && order.fulfilmentStatus === 'pending' && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => {
                if (confirm('Are you sure you want to cancel this order?')) {
                  cancelMutation.mutate();
                }
              }}
              disabled={cancelMutation.isPending}
              sx={{ borderRadius: '6px', fontWeight: 700 }}
            >
              Cancel Order
            </Button>
          )}
        </Stack>
      </Box>

      {/* Status Stepper */}
      <Paper elevation={0} sx={{ p: 4, borderRadius: '8px', border: '1px solid', borderColor: 'divider', mb: 4 }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 3 }}>
          FULFILMENT PROGRESS
        </Typography>

        {isCancelled ? (
          <Alert severity="error" sx={{ fontWeight: 600 }}>
            This order was cancelled.
          </Alert>
        ) : (
          <Stepper activeStep={currentStep >= 0 ? currentStep : 0} alternativeLabel>
            {STEPS.map((label) => (
              <Step key={label} completed={STEPS.indexOf(label) <= currentStep}>
                <StepLabel>
                  <Typography variant="caption" fontWeight={700} textTransform="uppercase">
                    {label}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        )}
      </Paper>

      <Grid container spacing={4}>
        {/* Items */}
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: '8px', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 3 }}>
              Ordered Items ({order.items?.length || 0})
            </Typography>

            <Stack spacing={2}>
              {order.items?.map((item, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Box sx={{ width: 64, height: 64, borderRadius: '6px', overflow: 'hidden', bgcolor: '#f8fafc', flexShrink: 0 }}>
                    <img
                      src={item.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&q=80'}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700}>{item.name}</Typography>
                    <Typography variant="caption" color="text.secondary">SKU: {item.sku} | Qty: {item.quantity}</Typography>
                  </Box>
                  <Typography variant="subtitle2" fontWeight={800}>
                    ₹{(item.lineTotal / 100).toFixed(0)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>

        {/* Shipping & Payment Details */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: '8px', border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>
              SHIPPING ADDRESS
            </Typography>
            <Typography variant="body2" fontWeight={700}>{order.shippingAddress?.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {order.shippingAddress?.line1} {order.shippingAddress?.line2}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Phone: {order.shippingAddress?.phone}
            </Typography>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, borderRadius: '8px', border: '1px solid', borderColor: 'divider', bgcolor: '#f8fafc' }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>
              PAYMENT BREAKDOWN
            </Typography>

            <Stack spacing={1} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                <Typography variant="body2" fontWeight={600}>₹{((order.pricing?.subtotal || 0) / 100).toFixed(0)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Shipping</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {order.pricing?.shippingCharge === 0 ? 'FREE' : `₹${((order.pricing?.shippingCharge || 0) / 100).toFixed(0)}`}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">GST (18%)</Typography>
                <Typography variant="body2" fontWeight={600}>₹{((order.pricing?.tax || 0) / 100).toFixed(0)}</Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography variant="subtitle1" fontWeight={800}>Total Paid</Typography>
                <Typography variant="h5" fontWeight={900} color="primary">
                  ₹{((order.pricing?.grandTotal || 0) / 100).toFixed(0)}
                </Typography>
              </Box>
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">Status</Typography>
              <Chip
                label={order.paymentStatus?.toUpperCase()}
                size="small"
                color={order.paymentStatus === 'paid' ? 'success' : 'warning'}
                sx={{ fontWeight: 800 }}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
