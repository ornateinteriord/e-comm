import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import {
  Box, Container, Typography, Paper, Chip, Button, Grid,
  CircularProgress, Stack,
} from '@mui/material';
import { ShoppingBagOutlined as OrderIcon } from '@mui/icons-material';
import api from '../api/client';
import type { Order } from '@ornate/types';

export default function OrdersPage() {
  const { data, isLoading } = useQuery<{ items: Order[]; total: number }>({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const { data } = await api.get('/orders');
      return data.data;
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'success';
      case 'shipped': case 'processing': case 'packed': return 'primary';
      case 'confirmed': return 'info';
      case 'cancelled': return 'error';
      default: return 'warning';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em" sx={{ mb: 4 }}>
        My Orders
      </Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress />
        </Box>
      ) : !data?.items || data.items.length === 0 ? (
        <Paper elevation={0} sx={{ p: 8, textAlign: 'center', borderRadius: '8px', border: '1px dashed', borderColor: 'divider' }}>
          <OrderIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>No orders placed yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Explore our curated products and place your first order today.
          </Typography>
          <Button variant="contained" component={RouterLink} to="/search" sx={{ borderRadius: '6px', fontWeight: 700 }}>
            Start Shopping
          </Button>
        </Paper>
      ) : (
        <Stack spacing={3}>
          {data.items.map((order) => (
            <Paper
              key={order.id || order.orderNumber}
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08)' },
              }}
            >
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>ORDER NUMBER</Typography>
                  <Typography variant="subtitle1" fontWeight={800}>{order.orderNumber}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </Typography>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL AMOUNT</Typography>
                  <Typography variant="subtitle1" fontWeight={800} color="primary">
                    ₹{((order.pricing?.grandTotal || 0) / 100).toFixed(0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {order.items?.length || 1} item(s)
                  </Typography>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>STATUS</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={order.fulfilmentStatus?.toUpperCase()}
                      size="small"
                      color={getStatusColor(order.fulfilmentStatus) as any}
                      sx={{ fontWeight: 700 }}
                    />
                  </Box>
                </Grid>

                <Grid item xs={12} sm={3} sx={{ textAlign: { sm: 'right' } }}>
                  <Button
                    variant="outlined"
                    component={RouterLink}
                    to={`/orders/${order.id || order.orderNumber}`}
                    sx={{ borderRadius: '6px', fontWeight: 700 }}
                  >
                    View Details
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Stack>
      )}
    </Container>
  );
}
