import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Stack,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Shield as ShieldIcon,
  DeleteForever as DeleteIcon,
  Block as RejectIcon,
  CheckCircle as CheckCircleIcon,
  PendingActions as PendingIcon,
  Refresh as RefreshIcon,
  WarningAmber as WarningIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import api from '../api/client';

interface DeletionRequest {
  id: string;
  _id: string;
  userId: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  reason: string;
  notes?: string;
  status: 'pending' | 'completed' | 'rejected' | 'cancelled';
  adminNotes?: string;
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
}

interface DeletionResponse {
  items: DeletionRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  counts: {
    totalAll: number;
    pending: number;
    completed: number;
    rejected: number;
  };
}

export default function DataDeletionRequestsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<DeletionRequest | null>(null);
  const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<DeletionResponse>({
    queryKey: ['admin-dpdp-requests', statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      params.append('limit', '50');

      const res = await api.get(`/admin/privacy/deletion-requests?${params.toString()}`);
      return {
        items: res.data.data,
        pagination: res.data.pagination,
        counts: res.data.counts,
      };
    },
  });

  // Mutation to execute data deletion
  const executeMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await api.post(`/admin/privacy/deletion-requests/${id}/execute`, { adminNotes: notes });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dpdp-requests'] });
      setIsExecuteDialogOpen(false);
      setSelectedRequest(null);
      setAdminNotes('');
      setActionSuccess('Customer personal data successfully erased in compliance with DPDP Act.');
      setTimeout(() => setActionSuccess(null), 5000);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.error?.message || 'Failed to execute data deletion.');
    },
  });

  // Mutation to reject data deletion
  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await api.post(`/admin/privacy/deletion-requests/${id}/reject`, { adminNotes: notes });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dpdp-requests'] });
      setIsRejectDialogOpen(false);
      setSelectedRequest(null);
      setAdminNotes('');
      setActionSuccess('Data deletion request rejected.');
      setTimeout(() => setActionSuccess(null), 5000);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.error?.message || 'Failed to reject data deletion request.');
    },
  });

  const handleOpenExecute = (req: DeletionRequest) => {
    setSelectedRequest(req);
    setAdminNotes('');
    setActionError(null);
    setIsExecuteDialogOpen(true);
  };

  const handleOpenReject = (req: DeletionRequest) => {
    setSelectedRequest(req);
    setAdminNotes('');
    setActionError(null);
    setIsRejectDialogOpen(true);
  };

  const counts = data?.counts || { totalAll: 0, pending: 0, completed: 0, rejected: 0 };

  return (
    <Box sx={{ pb: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 3.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                bgcolor: 'rgba(255, 121, 0, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FF7900',
              }}
            >
              <ShieldIcon />
            </Box>
            <Typography variant="h4" fontWeight={900} letterSpacing="-0.02em" sx={{ color: '#0f172a' }}>
              DPDP Data Deletion Requests
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Manage customer personal data erasure requests in compliance with Section 12 of the Digital Personal Data Protection Act, 2023.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => refetch()}
          disabled={isFetching}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '8px',
            borderColor: '#e2e8f0',
            color: '#475569',
            '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' },
          }}
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
      </Box>

      {/* Metric Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '12px', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Requests
              </Typography>
              <Typography variant="h4" fontWeight={900} sx={{ color: '#0f172a', mt: 0.5 }}>
                {counts.totalAll}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              border: '1.5px solid #fed7aa',
              borderRadius: '12px',
              bgcolor: '#fffbeb',
            }}
          >
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 800, textTransform: 'uppercase' }}>
                  Pending Review
                </Typography>
                <PendingIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
              </Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: '#b45309', mt: 0.5 }}>
                {counts.pending}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: '1px solid #bbf7d0', borderRadius: '12px', bgcolor: '#f0fdf4' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 800, textTransform: 'uppercase' }}>
                  Data Erased
                </Typography>
                <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20 }} />
              </Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: '#15803d', mt: 0.5 }}>
                {counts.completed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: '1px solid #fecaca', borderRadius: '12px', bgcolor: '#fef2f2' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 800, textTransform: 'uppercase' }}>
                  Rejected
                </Typography>
                <RejectIcon sx={{ color: '#dc2626', fontSize: 20 }} />
              </Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: '#b91c1c', mt: 0.5 }}>
                {counts.rejected}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Global Success / Error Alerts */}
      {actionSuccess && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: '10px' }} onClose={() => setActionSuccess(null)}>
          {actionSuccess}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: { xs: 1, md: 0 } }}>
          {(['all', 'pending', 'completed', 'rejected'] as const).map((tab) => (
            <Button
              key={tab}
              size="small"
              variant={statusFilter === tab ? 'contained' : 'outlined'}
              onClick={() => setStatusFilter(tab)}
              sx={{
                textTransform: 'capitalize',
                fontWeight: 700,
                borderRadius: '8px',
                px: 2,
                bgcolor: statusFilter === tab ? '#FF7900' : 'transparent',
                borderColor: statusFilter === tab ? '#FF7900' : '#cbd5e1',
                color: statusFilter === tab ? '#ffffff' : '#475569',
                '&:hover': {
                  bgcolor: statusFilter === tab ? '#e06b00' : '#f1f5f9',
                  borderColor: statusFilter === tab ? '#e06b00' : '#94a3b8',
                },
              }}
            >
              {tab === 'all' ? 'All Requests' : tab}
            </Button>
          ))}
        </Stack>

        <TextField
          size="small"
          placeholder="Search customer name, email, phone…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: '100%', md: 340 },
            '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#f8fafc' },
          }}
        />
      </Paper>

      {/* Table of Requests */}
      <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : !data?.items || data.items.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <ShieldIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1.5 }} />
            <Typography variant="h6" fontWeight={700} sx={{ color: '#334155' }}>
              No Data Deletion Requests Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {statusFilter !== 'all'
                ? `There are no requests matching the '${statusFilter}' filter.`
                : 'Customers who request personal data erasure under DPDP Act will appear here.'}
            </Typography>
          </Box>
        ) : (
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Requested Date</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Customer Name</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Email & Contact</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Reason for Deletion</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Compliance Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((req) => {
                const reqDate = new Date(req.requestedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <TableRow key={req._id || req.id} hover>
                    <TableCell sx={{ color: '#475569', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {reqDate}
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" fontWeight={800} sx={{ color: '#0f172a' }}>
                        {req.customerName}
                      </Typography>
                      {req.customerId && (
                        <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                          ID: {req.customerId}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#0f172a' }}>
                        {req.customerEmail}
                      </Typography>
                      {req.customerPhone && (
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          +91 {req.customerPhone}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#1e293b' }}>
                        {req.reason}
                      </Typography>
                      {req.notes && (
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                          Note: "{req.notes}"
                        </Typography>
                      )}
                      {req.adminNotes && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            mt: 0.5,
                            color: req.status === 'rejected' ? '#dc2626' : '#15803d',
                            fontWeight: 600,
                          }}
                        >
                          Admin: {req.adminNotes}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      {req.status === 'pending' && (
                        <Chip
                          label="Pending Review"
                          size="small"
                          sx={{
                            bgcolor: '#fff7ed',
                            color: '#c2410c',
                            fontWeight: 800,
                            border: '1px solid #fed7aa',
                            fontSize: '0.75rem',
                          }}
                        />
                      )}
                      {req.status === 'completed' && (
                        <Chip
                          label="Data Erased"
                          size="small"
                          sx={{
                            bgcolor: '#f0fdf4',
                            color: '#15803d',
                            fontWeight: 800,
                            border: '1px solid #bbf7d0',
                            fontSize: '0.75rem',
                          }}
                        />
                      )}
                      {req.status === 'rejected' && (
                        <Chip
                          label="Rejected"
                          size="small"
                          sx={{
                            bgcolor: '#fef2f2',
                            color: '#b91c1c',
                            fontWeight: 800,
                            border: '1px solid #fecaca',
                            fontSize: '0.75rem',
                          }}
                        />
                      )}
                      {req.status === 'cancelled' && (
                        <Chip
                          label="Cancelled by User"
                          size="small"
                          sx={{
                            bgcolor: '#f1f5f9',
                            color: '#475569',
                            fontWeight: 700,
                            border: '1px solid #cbd5e1',
                            fontSize: '0.75rem',
                          }}
                        />
                      )}
                    </TableCell>

                    <TableCell>
                      {req.status === 'pending' ? (
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => handleOpenExecute(req)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              py: 0.5,
                              px: 1.5,
                              bgcolor: '#dc2626',
                              '&:hover': { bgcolor: '#b91c1c' },
                            }}
                          >
                            Erase Data
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<RejectIcon />}
                            onClick={() => handleOpenReject(req)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              py: 0.5,
                              px: 1.5,
                              borderColor: '#cbd5e1',
                              color: '#64748b',
                              '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
                            }}
                          >
                            Reject
                          </Button>
                        </Stack>
                      ) : req.status === 'completed' ? (
                        <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 600 }}>
                          Erased on {new Date(req.processedAt || '').toLocaleDateString('en-IN')}
                          {req.processedBy && ` by ${req.processedBy}`}
                        </Typography>
                      ) : req.status === 'rejected' ? (
                        <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 600 }}>
                          Rejected on {new Date(req.processedAt || '').toLocaleDateString('en-IN')}
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          No action required
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Modal: Confirm Data Erasure */}
      <Dialog
        open={isExecuteDialogOpen}
        onClose={() => !executeMutation.isPending && setIsExecuteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                bgcolor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <WarningIcon />
            </Box>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a' }}>
              Confirm Personal Data Erasure
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setIsExecuteDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1.5 }}>
          {actionError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
              {actionError}
            </Alert>
          )}

          <Typography variant="body2" sx={{ color: '#334155', mb: 2, lineHeight: 1.6 }}>
            You are about to execute a permanent personal data erasure for{' '}
            <strong>{selectedRequest?.customerName}</strong> ({selectedRequest?.customerEmail}) under Section 12 of the
            DPDP Act, 2023.
          </Typography>

          <Box sx={{ bgcolor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', p: 2, mb: 2.5 }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#991b1b', mb: 1 }}>
              The following actions will be executed permanently:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#7f1d1d', fontSize: '0.85rem', lineHeight: 1.6 }}>
              <li>All saved delivery addresses will be permanently deleted.</li>
              <li>Customer wishlist items will be permanently cleared.</li>
              <li>
                Personal identification records (name, email, phone number, credentials) will be scrubbed and anonymized.
              </li>
              <li>Customer account will be deactivated and cannot be logged into.</li>
              <li>Historical statutory order totals are retained in anonymized form for GST/tax compliance.</li>
            </ul>
          </Box>

          <TextField
            label="Compliance / Admin Notes (Optional)"
            fullWidth
            size="small"
            multiline
            rows={2}
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="e.g. Verified by compliance officer, identity confirmed via email."
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            variant="outlined"
            onClick={() => setIsExecuteDialogOpen(false)}
            disabled={executeMutation.isPending}
            sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={executeMutation.isPending}
            onClick={() => {
              if (selectedRequest) {
                executeMutation.mutate({ id: selectedRequest._id || selectedRequest.id, notes: adminNotes });
              }
            }}
            startIcon={executeMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
            sx={{
              textTransform: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              bgcolor: '#dc2626',
              '&:hover': { bgcolor: '#b91c1c' },
            }}
          >
            {executeMutation.isPending ? 'Erasing Data…' : 'Confirm & Erase Data'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Reject Data Erasure */}
      <Dialog
        open={isRejectDialogOpen}
        onClose={() => !rejectMutation.isPending && setIsRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a' }}>
            Reject Data Deletion Request
          </Typography>
          <IconButton size="small" onClick={() => setIsRejectDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1.5 }}>
          {actionError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
              {actionError}
            </Alert>
          )}

          <Typography variant="body2" sx={{ color: '#334155', mb: 2 }}>
            Provide a compliance reason for rejecting the request of{' '}
            <strong>{selectedRequest?.customerName}</strong>:
          </Typography>

          <TextField
            label="Rejection Reason *"
            required
            fullWidth
            size="small"
            multiline
            rows={3}
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="e.g. Active dispute/order currently pending fulfillment. Request can be re-submitted after delivery completion."
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            variant="outlined"
            onClick={() => setIsRejectDialogOpen(false)}
            disabled={rejectMutation.isPending}
            sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={rejectMutation.isPending || !adminNotes.trim()}
            onClick={() => {
              if (selectedRequest) {
                rejectMutation.mutate({ id: selectedRequest._id || selectedRequest.id, notes: adminNotes });
              }
            }}
            startIcon={rejectMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <RejectIcon />}
            sx={{
              textTransform: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              bgcolor: '#0f172a',
              '&:hover': { bgcolor: '#1e293b' },
            }}
          >
            {rejectMutation.isPending ? 'Rejecting…' : 'Reject Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
