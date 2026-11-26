import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material';
import { ReportProblem as ProblemIcon } from '@mui/icons-material';
import api from '../../api/client';

const FAILURE_REASONS = [
  'Customer unavailable / phone unreachable',
  'Incorrect or incomplete delivery address',
  'Customer refused to accept order / COD',
  'Premises closed / gate locked',
  'Package damaged in transit',
  'Other',
];

interface DeliveryFailureDialogProps {
  open: boolean;
  assignmentId: string;
  coords?: { lat: number; lng: number } | null;
  onClose: () => void;
  onFailed: () => void;
}

export default function DeliveryFailureDialog({
  open,
  assignmentId,
  coords,
  onClose,
  onFailed,
}: DeliveryFailureDialogProps) {
  const [selectedReason, setSelectedReason] = useState(FAILURE_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const reason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
    if (!reason) {
      setError('Please enter a failure reason.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const resp = await api.patch(`/delivery/assignments/${assignmentId}/status`, {
        status: 'failed',
        reason,
        note: reason,
        lat: coords?.lat,
        lng: coords?.lng,
      });
      if (resp.data?.success) {
        onFailed();
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(axiosErr.response?.data?.error?.message || axiosErr.message || 'Failed to report exception.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !isSubmitting && onClose()} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, color: '#B91C1C' }}>
        <ProblemIcon />
        Report Delivery Issue
      </DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <FormControl>
              <RadioGroup value={selectedReason} onChange={(e) => setSelectedReason(e.target.value)}>
                {FAILURE_REASONS.map((r) => (
                  <FormControlLabel key={r} value={r} control={<Radio size="small" />} label={r} />
                ))}
              </RadioGroup>
            </FormControl>

            {selectedReason === 'Other' && (
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Specify Reason"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                required
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={isSubmitting}>
            Back
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="error"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isSubmitting ? 'Submitting...' : 'Mark Undelivered'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
