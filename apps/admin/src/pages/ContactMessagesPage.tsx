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
  TableContainer,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  MenuItem,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Alert,
  Snackbar,
  Card,
  CardContent,
  InputAdornment,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  MarkEmailUnread as UnreadIcon,
  CheckCircle as ResolvedIcon,
  PendingActions as InProgressIcon,
  ContactMail as ContactMailIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import api from '../api/client';
import type { ContactMessage, ContactMessageStatus } from '@ornate/types';

const STATUS_CONFIG: Record<
  ContactMessageStatus,
  { label: string; color: 'warning' | 'info' | 'success' | 'default'; bg: string }
> = {
  new: { label: 'New / Unread', color: 'warning', bg: 'rgba(245, 158, 11, 0.1)' },
  in_progress: { label: 'In Progress', color: 'info', bg: 'rgba(59, 130, 246, 0.1)' },
  resolved: { label: 'Resolved', color: 'success', bg: 'rgba(16, 185, 129, 0.1)' },
  archived: { label: 'Archived', color: 'default', bg: 'rgba(100, 116, 139, 0.1)' },
};

export default function ContactMessagesPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [targetStatus, setTargetStatus] = useState<ContactMessageStatus>('new');

  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    id: string | null;
    name: string;
  }>({
    open: false,
    id: null,
    name: '',
  });

  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showToast = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setToast({ open: true, message, severity });
  };

  // Fetch inquiries
  const { data, isLoading, refetch, isFetching } = useQuery<{
    items: ContactMessage[];
    total: number;
  }>({
    queryKey: ['admin-contact-messages', selectedStatus, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (search.trim()) params.append('search', search.trim());
      params.append('limit', '100');

      const res = await api.get(`/admin/contact?${params.toString()}`);
      return res.data.data;
    },
  });

  const messages = data?.items || [];
  const totalCount = data?.total || 0;

  // Status update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: ContactMessageStatus; notes?: string }) => {
      const res = await api.patch(`/admin/contact/${id}`, { status, adminNotes: notes });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contact-messages'] });
      showToast('Inquiry status updated successfully!');
      setViewDialogOpen(false);
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || 'Failed to update inquiry status', 'error');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/contact/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contact-messages'] });
      setDeleteConfirmDialog({ open: false, id: null, name: '' });
      showToast('Inquiry deleted successfully');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || 'Failed to delete inquiry', 'error');
    },
  });

  const openViewDialog = (msg: ContactMessage) => {
    setSelectedMessage(msg);
    setTargetStatus(msg.status);
    setAdminNotes(msg.adminNotes || '');
    setViewDialogOpen(true);
  };

  // Metrics
  const newCount = messages.filter((m) => m.status === 'new').length;
  const inProgressCount = messages.filter((m) => m.status === 'in_progress').length;
  const resolvedCount = messages.filter((m) => m.status === 'resolved').length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} letterSpacing="-0.02em">
            Customer Inquiries & Messages
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage incoming contact requests, feedback, and customer support inquiries
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={isFetching ? <CircularProgress size={18} /> : <RefreshIcon />}
          onClick={() => refetch()}
          disabled={isFetching}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
        >
          Refresh
        </Button>
      </Box>

      {/* Metric Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(255, 121, 0, 0.1)', color: '#FF7900' }}>
                <ContactMailIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
                  Total Inquiries
                </Typography>
                <Typography variant="h5" fontWeight={900}>
                  {totalCount}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
                <UnreadIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
                  New / Unread
                </Typography>
                <Typography variant="h5" fontWeight={900} color="#d97706">
                  {newCount}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>
                <InProgressIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
                  In Progress
                </Typography>
                <Typography variant="h5" fontWeight={900} color="#2563eb">
                  {inProgressCount}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                <ResolvedIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
                  Resolved
                </Typography>
                <Typography variant="h5" fontWeight={900} color="#059669">
                  {resolvedCount}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter and Search Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search by sender name, email, phone, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Tabs
              value={selectedStatus}
              onChange={(_, val) => setSelectedStatus(val)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ minHeight: 38 }}
            >
              <Tab label="All" value="all" sx={{ minHeight: 38, py: 0.5, fontWeight: 700 }} />
              <Tab label="New" value="new" sx={{ minHeight: 38, py: 0.5, fontWeight: 700 }} />
              <Tab label="In Progress" value="in_progress" sx={{ minHeight: 38, py: 0.5, fontWeight: 700 }} />
              <Tab label="Resolved" value="resolved" sx={{ minHeight: 38, py: 0.5, fontWeight: 700 }} />
              <Tab label="Archived" value="archived" sx={{ minHeight: 38, py: 0.5, fontWeight: 700 }} />
            </Tabs>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Date & Time</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Customer Details</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Subject</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Message Preview</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, color: '#475569' }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : messages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <ContactMailIcon sx={{ fontSize: 44, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
                    <Typography variant="body1" fontWeight={700} color="text.secondary">
                      No contact messages found
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Incoming inquiries from the web contact form will appear here.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                messages.map((item) => {
                  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
                  const formattedDate = new Date(item.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  });

                  return (
                    <TableRow key={item.id || item._id} hover>
                      <TableCell sx={{ fontSize: '0.85rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {formattedDate}
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={800}>
                          {item.name}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                          <EmailIcon sx={{ fontSize: 13 }} /> {item.email}
                        </Typography>
                        {item.phone && (
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                            <PhoneIcon sx={{ fontSize: 13 }} /> +91 {item.phone}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {item.subject || 'General Inquiry'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {item.message}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={cfg.label}
                          size="small"
                          color={cfg.color}
                          sx={{ fontWeight: 800, fontSize: '0.75rem' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="View Full Message & Update Status">
                            <IconButton size="small" color="primary" onClick={() => openViewDialog(item)}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Message">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() =>
                                setDeleteConfirmDialog({
                                  open: true,
                                  id: item.id || item._id || '',
                                  name: `${item.name} (${item.subject})`,
                                })
                              }
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* View & Update Details Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={800}>
            Inquiry Details
          </Typography>
          <IconButton size="small" onClick={() => setViewDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedMessage && (
            <Stack spacing={2.5}>
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      SENDER NAME
                    </Typography>
                    <Typography variant="subtitle2" fontWeight={800}>
                      {selectedMessage.name}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      EMAIL ADDRESS
                    </Typography>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {selectedMessage.email}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      PHONE NUMBER
                    </Typography>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {selectedMessage.phone ? `+91 ${selectedMessage.phone}` : 'Not provided'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      SUBMISSION DATE
                    </Typography>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {new Date(selectedMessage.createdAt).toLocaleString('en-IN')}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  SUBJECT
                </Typography>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0f172a' }}>
                  {selectedMessage.subject || 'General Inquiry'}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  CUSTOMER MESSAGE
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    mt: 0.5,
                    bgcolor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {selectedMessage.message}
                </Paper>
              </Box>

              <Divider />

              {/* Status and Admin Notes */}
              <TextField
                select
                label="Update Status"
                fullWidth
                size="small"
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as ContactMessageStatus)}
              >
                <MenuItem value="new">New / Unread</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </TextField>

              <TextField
                label="Admin Internal Notes (Optional)"
                fullWidth
                multiline
                rows={3}
                size="small"
                placeholder="Add internal notes about resolution or customer follow-up..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setViewDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={updateMutation.isPending}
            onClick={() => {
              if (selectedMessage) {
                updateMutation.mutate({
                  id: selectedMessage.id || selectedMessage._id || '',
                  status: targetStatus,
                  notes: adminNotes,
                });
              }
            }}
            sx={{
              bgcolor: '#FF7900',
              '&:hover': { bgcolor: '#e06b00' },
              fontWeight: 800,
              textTransform: 'none',
            }}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save & Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmDialog.open} onClose={() => setDeleteConfirmDialog({ open: false, id: null, name: '' })}>
        <DialogTitle fontWeight={800}>Confirm Inquiry Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to permanently delete the inquiry from{' '}
            <strong>{deleteConfirmDialog.name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteConfirmDialog({ open: false, id: null, name: '' })} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (deleteConfirmDialog.id) {
                deleteMutation.mutate(deleteConfirmDialog.id);
              }
            }}
            sx={{ fontWeight: 800, textTransform: 'none' }}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} sx={{ fontWeight: 700 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

