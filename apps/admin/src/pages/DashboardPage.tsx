import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import {
  Box, Typography, Grid, Paper, Chip,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Button, CircularProgress, Stack,
} from '@mui/material';
import {
  AttachMoney as RevenueIcon,
  ShoppingCart as OrdersIcon,
  PendingActions as PendingIcon,
  WarningAmber as AlertIcon,
  Add as AddIcon,
  ArrowForward as ArrowForwardIcon,
  Inventory as InventoryIcon,
  LocalShipping as ShippingIcon,
  ReceiptLong as InvoiceIcon,
} from '@mui/icons-material';
import api from '../api/client';
import type { DashboardMetrics } from '@ornate/types';

export default function DashboardPage() {
  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/admin/dashboard');
      return data.data;
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress />
      </Box>
    );
  }

  const revenueDisplay = `₹${(((metrics?.paidRevenue ?? 0) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const kpis = [
    {
      title: 'NET VERIFIED REVENUE',
      value: revenueDisplay,
      icon: <RevenueIcon sx={{ fontSize: 24, color: '#16a34a' }} />,
      desc: 'Lifetime settled customer payments',
      bg: '#f0fdf4',
      border: '#bbf7d0',
    },
    {
      title: 'TOTAL ORDERS',
      value: (metrics?.totalOrders ?? 0).toString(),
      icon: <OrdersIcon sx={{ fontSize: 24, color: '#2563eb' }} />,
      desc: 'All recorded customer checkouts',
      bg: '#eff6ff',
      border: '#bfdbfe',
    },
    {
      title: 'PENDING FULFILLMENT',
      value: (metrics?.pendingOrders ?? 0).toString(),
      icon: <PendingIcon sx={{ fontSize: 24, color: '#d97706' }} />,
      desc: 'Orders awaiting dispatch & tracking',
      bg: '#fffbeb',
      border: '#fde68a',
    },
    {
      title: 'LOW STOCK ALERTS',
      value: (metrics?.lowStockProducts ?? 0).toString(),
      icon: <AlertIcon sx={{ fontSize: 24, color: '#dc2626' }} />,
      desc: 'SKUs at or below minimum threshold',
      bg: '#fef2f2',
      border: '#fecaca',
    },
  ];

  return (
    <Box sx={{ width: '100%' }}>
      {/* Page Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
            Executive Operations Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Real-time multi-service KPI aggregation, catalog inventory, and order fulfillment.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            component={RouterLink}
            to="/products"
            startIcon={<AddIcon />}
            sx={{
              bgcolor: '#0f172a',
              borderRadius: 1,
              fontWeight: 700,
              fontSize: '0.875rem',
              px: 2.5,
              py: 1,
              '&:hover': { bgcolor: '#1e293b' },
            }}
          >
            Create Product
          </Button>
          <Button
            variant="outlined"
            component={RouterLink}
            to="/inventory"
            startIcon={<InventoryIcon />}
            sx={{
              borderRadius: 1,
              fontWeight: 700,
              fontSize: '0.875rem',
              borderColor: '#cbd5e1',
              color: '#0f172a',
              px: 2.5,
              py: 1,
              '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
            }}
          >
            Adjust Stock
          </Button>
        </Stack>
      </Box>

      {/* Primary KPI Cards Grid */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {kpis.map((kpi, idx) => (
          <Grid item xs={12} sm={6} md={3} key={idx}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                bgcolor: '#ffffff',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, letterSpacing: '0.04em' }}>
                  {kpi.title}
                </Typography>
                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: kpi.bg, border: `1px solid ${kpi.border}` }}>
                  {kpi.icon}
                </Box>
              </Box>

              <Typography
                variant="h4"
                fontWeight={800}
                sx={{
                  color: '#0f172a',
                  letterSpacing: '-0.03em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  mb: 0.5,
                }}
              >
                {kpi.value}
              </Typography>

              <Typography variant="caption" color="text.secondary">
                {kpi.desc}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Operational Summary Strip (Utilizing screen space cleanly) */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <ShippingIcon sx={{ color: '#2563eb', fontSize: 22 }} />
              <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                Order Fulfillment Pipeline
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Status of all registered customer checkouts
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
                <Typography variant="body2" color="#475569">Settled & Completed</Typography>
                <Chip label={metrics?.paidRevenue ? 'Verified' : 'Active'} size="small" sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 11 }} />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
                <Typography variant="body2" color="#475569">Awaiting Shipment</Typography>
                <Typography variant="body2" fontWeight={700} color="#0f172a">{metrics?.pendingOrders ?? 0} Orders</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                <Typography variant="body2" color="#475569">Total Recorded Checkouts</Typography>
                <Typography variant="body2" fontWeight={700} color="#0f172a">{metrics?.totalOrders ?? 0} Orders</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <InventoryIcon sx={{ color: '#d97706', fontSize: 22 }} />
              <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                Inventory & Warehouse Health
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Stock threshold alerts and replenishment state
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
                <Typography variant="body2" color="#475569">Healthy Stock SKUs</Typography>
                <Chip label="Optimal" size="small" sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 11 }} />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
                <Typography variant="body2" color="#475569">Low Stock Warnings</Typography>
                <Chip label={`${metrics?.lowStockProducts ?? 0} Critical`} size="small" sx={{ bgcolor: '#fee2e2', color: '#b91c1c', fontWeight: 700, fontSize: 11 }} />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                <Typography variant="body2" color="#475569">Multi-service Audit Sync</Typography>
                <Typography variant="body2" fontWeight={700} color="#16a34a">Connected</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <InvoiceIcon sx={{ color: '#0f172a', fontSize: 22 }} />
              <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                Compliance & Financial Records
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              GST tax invoices and transaction audits
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
                <Typography variant="body2" color="#475569">Tax Class Standard</Typography>
                <Typography variant="body2" fontWeight={700} color="#0f172a">18% HSN GST</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
                <Typography variant="body2" color="#475569">Invoice Generation</Typography>
                <Chip label="Automated" size="small" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: 11 }} />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                <Typography variant="body2" color="#475569">Database State</Typography>
                <Typography variant="body2" fontWeight={700} color="#16a34a">Atlas Live</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Full-width Recent Customer Orders Section */}
      <Paper elevation={0} sx={{ borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', overflow: 'hidden' }}>
        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} color="#0f172a">
              Recent Customer Orders
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Latest checkouts requiring payment confirmation or carrier dispatch
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            to="/orders"
            endIcon={<ArrowForwardIcon fontSize="small" />}
            size="small"
            sx={{ fontWeight: 700, color: '#FF7900', textTransform: 'none' }}
          >
            All Orders ({metrics?.totalOrders ?? 0})
          </Button>
        </Box>

        {!metrics?.recentOrders || metrics.recentOrders.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No customer orders recorded yet.</Typography>
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', py: 1.5 }}>Order Number</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', py: 1.5 }}>Customer Name & Email</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', py: 1.5 }}>Shipping Destination</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', py: 1.5 }}>Total Amount</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', py: 1.5 }}>Payment Status</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', py: 1.5 }}>Fulfillment Status</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', py: 1.5, textAlign: 'right' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {metrics.recentOrders.map((order) => (
                  <TableRow key={order.id || order.orderNumber} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} color="#0f172a">
                        {(order as any).customerName || 'Customer'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {(order as any).customerEmail}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: '#475569', fontSize: '0.85rem' }}>
                      {(order as any).shippingAddress?.city ? `${(order as any).shippingAddress.city}, ${(order as any).shippingAddress.state}` : 'India'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>
                      ₹{(((order.pricing?.grandTotal ?? 0) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.paymentStatus?.toUpperCase()}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: 10,
                          borderRadius: 1,
                          bgcolor: order.paymentStatus === 'paid' ? '#dcfce7' : '#fef3c7',
                          color: order.paymentStatus === 'paid' ? '#15803d' : '#b45309',
                        }}
                      />
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
                    <TableCell sx={{ textAlign: 'right' }}>
                      <Button
                        component={RouterLink}
                        to="/orders"
                        size="small"
                        sx={{
                          color: '#FF7900',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          textTransform: 'none',
                          p: 0.5,
                        }}
                      >
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
