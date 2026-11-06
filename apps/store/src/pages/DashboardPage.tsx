import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
} from '@mui/material';
import {
  Inventory2 as ProductsIcon,
  LocalShipping as ShippingIcon,
  CheckCircle as DeliveredIcon,
  HourglassTop as PendingIcon,
  ArrowForward as ArrowForwardIcon,
  Add as AddIcon,
  Place as PlaceIcon,
} from '@mui/icons-material';
import api from '../api/client';
import { useStoreAuthStore } from '../store/auth.store';

export default function DashboardPage() {
  const { store } = useStoreAuthStore();
  const [stats, setStats] = useState({
    totalProducts: 0,
    pendingOrders: 0,
    dispatchedOrders: 0,
    deliveredOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(true);
      try {
        const [prodResp, ordersResp] = await Promise.all([
          api.get('/store/products?limit=1').catch(() => ({ data: { data: { pagination: { total: 0 } } } })),
          api.get('/store/orders?limit=10').catch(() => ({ data: { data: { items: [] } } })),
        ]);

        const totalProds = prodResp.data?.data?.pagination?.total ?? 0;
        const orders = ordersResp.data?.data?.items ?? [];

        let pending = 0;
        let dispatched = 0;
        let delivered = 0;

        for (const o of orders) {
          for (const it of o.items || []) {
            if (['pending', 'confirmed', 'packed'].includes(it.itemStatus)) pending++;
            if (it.itemStatus === 'dispatched') dispatched++;
            if (it.itemStatus === 'delivered') delivered++;
          }
        }

        setStats({
          totalProducts: totalProds,
          pendingOrders: pending,
          dispatchedOrders: dispatched,
          deliveredOrders: delivered,
        });
        setRecentOrders(orders.slice(0, 5));
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return { bg: '#ECFDF5', color: '#047857' };
      case 'dispatched': return { bg: '#F3E8FF', color: '#7E22CE' };
      case 'packed': return { bg: '#EFF6FF', color: '#1D4ED8' };
      case 'confirmed': return { bg: '#E0F2FE', color: '#0369A1' };
      default: return { bg: '#FFFBEB', color: '#B45309' };
    }
  };

  return (
    <Box>
      {/* Welcome Banner */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: 3,
          bgcolor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          mb: 3,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#172B30' }}>
              Welcome, {store?.name || 'Partner Store'}
            </Typography>
            <Chip
              label={store?.categoryName || 'General'}
              size="small"
              sx={{ bgcolor: '#FFF7ED', color: '#FF7900', fontWeight: 700 }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            Store ID: <strong>{store?.storeId}</strong> • Manager: {store?.ownerName} • {store?.address?.city}, {store?.address?.state}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            component={RouterLink}
            to="/products"
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ fontWeight: 700 }}
          >
            Add Product
          </Button>
          <Button
            component={RouterLink}
            to="/orders"
            variant="outlined"
            color="secondary"
            sx={{ fontWeight: 700 }}
          >
            View Orders
          </Button>
        </Stack>
      </Paper>

      {/* 4 Metric Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Metric 1 */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                CATEGORY PRODUCTS
              </Typography>
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#FFF7ED', color: '#FF7900' }}>
                <ProductsIcon fontSize="small" />
              </Box>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#172B30', mt: 1 }}>
              {isLoading ? <CircularProgress size={24} /> : stats.totalProducts}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
              Active in {store?.categoryName}
            </Typography>
          </Paper>
        </Grid>

        {/* Metric 2 */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                PENDING DISPATCH
              </Typography>
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#FFFBEB', color: '#F59E0B' }}>
                <PendingIcon fontSize="small" />
              </Box>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#F59E0B', mt: 1 }}>
              {isLoading ? <CircularProgress size={24} /> : stats.pendingOrders}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
              Requires packing or pickup
            </Typography>
          </Paper>
        </Grid>

        {/* Metric 3 */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                IN TRANSIT / SHIPPED
              </Typography>
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#F3E8FF', color: '#9333EA' }}>
                <ShippingIcon fontSize="small" />
              </Box>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#7E22CE', mt: 1 }}>
              {isLoading ? <CircularProgress size={24} /> : stats.dispatchedOrders}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
              Out for delivery
            </Typography>
          </Paper>
        </Grid>

        {/* Metric 4 */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                COMPLETED DELIVERIES
              </Typography>
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#ECFDF5', color: '#10B981' }}>
                <DeliveredIcon fontSize="small" />
              </Box>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#047857', mt: 1 }}>
              {isLoading ? <CircularProgress size={24} /> : stats.deliveredOrders}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
              Successfully delivered
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Orders Action Queue */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF', mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#172B30' }}>
              Recent Orders For Your Category
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Orders containing products from your assigned category
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            to="/orders"
            endIcon={<ArrowForwardIcon />}
            sx={{ fontWeight: 700, color: '#FF7900' }}
          >
            All Orders
          </Button>
        </Box>

        {isLoading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <CircularProgress size={32} sx={{ color: '#FF7900' }} />
          </Box>
        ) : recentOrders.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', color: '#94A3B8' }}>
            <Typography variant="body2">No customer orders placed in your category yet.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Order #</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Customer</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Items in Category</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>City</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentOrders.map((order) => {
                  const statusStyle = getStatusColor(order.items?.[0]?.itemStatus || order.fulfilmentStatus);
                  return (
                    <TableRow key={order._id || order.orderNumber} hover>
                      <TableCell sx={{ fontWeight: 700, color: '#FF7900' }}>
                        {order.orderNumber}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#172B30' }}>
                        {order.customerName}
                      </TableCell>
                      <TableCell>
                        {order.items?.map((it: any, idx: number) => (
                          <Typography key={idx} variant="caption" sx={{ display: 'block', color: '#334155' }}>
                            {it.name} × {it.quantity}
                          </Typography>
                        ))}
                      </TableCell>
                      <TableCell sx={{ color: '#64748B' }}>
                        {order.shippingAddress?.city}, {order.shippingAddress?.pincode}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={order.items?.[0]?.itemStatus || order.fulfilmentStatus}
                          size="small"
                          sx={{
                            bgcolor: statusStyle.bg,
                            color: statusStyle.color,
                            fontWeight: 700,
                            textTransform: 'capitalize',
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          component={RouterLink}
                          to={`/orders/${order.orderNumber}`}
                          variant="outlined"
                          size="small"
                          sx={{ fontSize: '0.75rem', py: 0.25 }}
                        >
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

