import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  LocalShipping as ShippingIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import api from '../api/client';
import { useStoreAuthStore } from '../store/auth.store';

const STATUS_TABS = [
  { label: 'All Orders', value: '' },
  { label: 'Pending / Confirmed', value: 'pending' },
  { label: 'Packed', value: 'packed' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'Delivered', value: 'delivered' },
];

export default function OrdersPage() {
  const { store } = useStoreAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const url = selectedStatus
        ? `/store/orders?status=${selectedStatus}`
        : '/store/orders';
      const resp = await api.get(url);
      if (resp.data?.success) {
        setOrders(resp.data.data?.items || []);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [selectedStatus]);

  const getStatusStyle = (status: string) => {
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
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#172B30' }}>
          Customer Orders Fulfillment
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
          Viewing customer orders containing items in <strong>{store?.categoryName || 'your category'}</strong>.
        </Typography>
      </Box>

      {/* Filter Tabs */}
      <Paper elevation={0} sx={{ mb: 3, borderRadius: 2.5, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF', px: 2 }}>
        <Tabs
          value={selectedStatus}
          onChange={(_e, val) => setSelectedStatus(val)}
          textColor="primary"
          indicatorColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          {STATUS_TABS.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              label={tab.label}
              sx={{ fontWeight: 700, textTransform: 'none', py: 2 }}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Orders Table */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF', overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress size={32} sx={{ color: '#FF7900' }} />
          </Box>
        ) : orders.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center', color: '#94A3B8' }}>
            <ShippingIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography variant="body1" sx={{ fontWeight: 600 }}>No orders found for this status.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Order Number</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Customer</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Delivery City</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Your Category Items</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Fulfillment Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => {
                  const items = order.items || [];
                  const firstStatus = items[0]?.itemStatus || order.fulfilmentStatus;
                  const statusStyle = getStatusStyle(firstStatus);

                  return (
                    <TableRow key={order._id || order.orderNumber} hover>
                      <TableCell sx={{ fontWeight: 800, color: '#FF7900' }}>
                        {order.orderNumber}
                      </TableCell>
                      <TableCell sx={{ color: '#64748B', fontSize: '0.85rem' }}>
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                          {order.customerName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748B' }}>
                          {order.customerEmail}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: '#334155' }}>
                        {order.shippingAddress?.city}, {order.shippingAddress?.pincode}
                      </TableCell>
                      <TableCell>
                        {items.map((it: any, idx: number) => (
                          <Box key={idx} sx={{ mb: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#172B30', display: 'block' }}>
                              {it.name} × {it.quantity}
                            </Typography>
                            {it.courierName && (
                              <Typography variant="caption" sx={{ color: '#7E22CE', display: 'block' }}>
                                via {it.courierName} ({it.trackingNumber || 'No tracking'})
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={firstStatus}
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
                          variant="contained"
                          size="small"
                          startIcon={<VisibilityIcon />}
                          sx={{ fontSize: '0.75rem', py: 0.5 }}
                        >
                          Fulfill & Dispatch
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

