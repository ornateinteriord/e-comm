import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel, TextField,
  CircularProgress, IconButton, Stack, Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Receipt as InvoiceIcon,
} from '@mui/icons-material';
import api from '../api/client';
import type { Order } from '@ornate/types';

const FULFILMENT_STATUSES = [
  'pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'
];

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState('');
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
    setTrackingNumber(order.trackingNumber || '');
    setShippingProvider(order.shippingProvider || '');
    setNote('');
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
                  <TableCell sx={{ fontWeight: 800 }}>Fulfillment</TableCell>
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
                    <TableCell sx={{ textAlign: 'right', minWidth: 100 }}>
                      <Tooltip title="View Tax Invoice">
                        <IconButton
                          size="small"
                          component="a"
                          href={`http://localhost:4000/api/v1/invoices/${order.id || order.orderNumber}/html`}
                          target="_blank"
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
    </Box>
  );
}
