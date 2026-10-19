import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, CircularProgress, IconButton, Stack,
  Tabs, Tab, Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Tune as AdjustIcon,
  Warning as AlertIcon,
} from '@mui/icons-material';
import api from '../api/client';

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [delta, setDelta] = useState(10);
  const [reason, setReason] = useState('Stock restock received');

  const { data: invData, isLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['admin-inventory-list'],
    queryFn: async () => {
      const { data } = await api.get('/admin/inventory?limit=50');
      return data.data;
    },
  });

  const { data: movementsData } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['admin-movements-list'],
    queryFn: async () => {
      const { data } = await api.get('/admin/inventory/movements?limit=50');
      return data.data;
    },
    enabled: tab === 1,
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) return;
      await api.post('/admin/inventory/adjust', {
        productId: selectedItem.productId,
        variantId: selectedItem.variantId,
        delta: Number(delta),
        reason,
        type: Number(delta) > 0 ? 'restock' : 'adjustment',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-movements-list'] });
      setSelectedItem(null);
    },
  });

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
          Inventory Control
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Real-time stock monitoring, reserve balances, restock adjustments, and audit ledger.
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Current Stock Levels" sx={{ fontWeight: 700 }} />
        <Tab label="Stock Movement Audit Trail" sx={{ fontWeight: 700 }} />
      </Tabs>

      {tab === 0 && (
        <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : !invData?.items || invData.items.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">No inventory items tracked yet.</Typography>
            </Box>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Product Name</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>SKU</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>On-Hand Qty</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Reserved</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Available to Sell</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Alert Level</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invData.items.map((item) => (
                    <TableRow key={item._id || item.id} hover>
                      <TableCell sx={{ fontWeight: 800 }}>{item.productName}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{item.sku}</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>{item.quantity}</TableCell>
                      <TableCell sx={{ color: 'warning.main', fontWeight: 700 }}>{item.reserved}</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: item.available <= 5 ? 'error.main' : 'success.main' }}>
                        {item.available}
                      </TableCell>
                      <TableCell>
                        {item.quantity <= (item.lowStockThreshold || 5) ? (
                          <Chip
                            icon={<AlertIcon sx={{ fontSize: 16 }} />}
                            label="LOW STOCK"
                            size="small"
                            color="error"
                            sx={{ fontWeight: 800, fontSize: 10 }}
                          />
                        ) : (
                          <Chip label="OPTIMAL" size="small" color="success" sx={{ fontWeight: 800, fontSize: 10 }} />
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AdjustIcon />}
                          onClick={() => {
                            setSelectedItem(item);
                            setDelta(10);
                            setReason('Restock order received');
                          }}
                          sx={{ borderRadius: 1, fontWeight: 700 }}
                        >
                          Adjust Stock
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {tab === 1 && (
        <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>SKU</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Adjustment (Delta)</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Balance After</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Reason / Ref</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Performed By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movementsData?.items?.map((mov) => (
                  <TableRow key={mov._id || mov.id} hover>
                    <TableCell>{new Date(mov.createdAt).toLocaleString()}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{mov.sku}</TableCell>
                    <TableCell>
                      <Chip label={mov.type?.toUpperCase()} size="small" sx={{ fontWeight: 800, fontSize: 10 }} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, color: mov.delta > 0 ? 'success.main' : 'error.main' }}>
                      {mov.delta > 0 ? `+${mov.delta}` : mov.delta}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{mov.balanceAfter}</TableCell>
                    <TableCell>{mov.reason || '-'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{mov.performedBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Adjust Stock Dialog */}
      <Dialog open={Boolean(selectedItem)} onClose={() => setSelectedItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          Adjust Stock: {selectedItem?.productName}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Current Available: <strong>{selectedItem?.available}</strong> (Total on-hand: {selectedItem?.quantity})
            </Typography>

            <TextField
              label="Quantity Delta (+ for restock, - for audit deduction)"
              type="number"
              required
              fullWidth
              size="small"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
            />

            <TextField
              label="Reason for Adjustment"
              fullWidth
              size="small"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. New shipment arrived"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setSelectedItem(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => adjustMutation.mutate()}
            disabled={adjustMutation.isPending}
            sx={{ fontWeight: 700 }}
          >
            {adjustMutation.isPending ? 'Updating…' : 'Apply Adjustment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
