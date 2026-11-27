import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  CheckCircle as CheckCircleIcon,
  CurrencyRupee as RupeeIcon,
  VerifiedUser as OtpIcon,
} from '@mui/icons-material';
import type { DeliveryAssignment } from '@ornate/types';
import api from '../../api/client';
import { resolveVisibleReceiverName } from '../../utils/navigation';
import SignaturePad from './SignaturePad';

interface ProofOfDeliveryDialogProps {
  open: boolean;
  assignment: DeliveryAssignment;
  coords?: { lat: number; lng: number } | null;
  onClose: () => void;
  onCompleted: (updated: DeliveryAssignment) => void;
}

export default function ProofOfDeliveryDialog({
  open,
  assignment,
  coords,
  onClose,
  onCompleted,
}: ProofOfDeliveryDialogProps) {
  const [otp, setOtp] = useState('');
  const [recipientName, setRecipientName] = useState(() => resolveVisibleReceiverName(assignment));
  const [notes, setNotes] = useState('');
  const [codCollected, setCodCollected] = useState(!assignment.isCod);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(undefined);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCodCollected(!assignment.isCod);
    const unlockedName = resolveVisibleReceiverName(assignment);
    if (unlockedName) {
      setRecipientName(unlockedName);
    }
  }, [open, assignment.id, assignment.status, assignment.isCod, assignment.dropLocation?.name]);

  useEffect(() => {
    setOtp('');
    setNotes('');
    setPhotoUrl(undefined);
    setSignatureDataUrl(undefined);
    setRecipientName(resolveVisibleReceiverName(assignment));
    setCodCollected(!assignment.isCod);
  }, [assignment.id]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const resp = await api.post('/delivery/upload-pod', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (resp.data?.success && resp.data.data?.url) {
        setPhotoUrl(resp.data.data.url);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotoUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (otp.trim().length < 4) {
      setError('Enter the 4-digit delivery OTP shared by the customer.');
      return;
    }

    if (assignment.isCod && !codCollected) {
      setError(`Confirm collection of ₹${(assignment.codAmountPaise / 100).toFixed(2)} Cash on Delivery.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const fallbackName = resolveVisibleReceiverName(assignment) || undefined;
      const resp = await api.post(`/delivery/assignments/${assignment.id}/complete`, {
        otp: otp.trim(),
        photoUrl,
        signatureDataUrl,
        recipientName: recipientName.trim() || fallbackName,
        notes: notes.trim() || undefined,
        codCollected: assignment.isCod ? codCollected : false,
        codCollectedPaise: assignment.isCod ? assignment.codAmountPaise : 0,
        lat: coords?.lat,
        lng: coords?.lng,
      });

      if (resp.data?.success) {
        onCompleted(resp.data.data);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(axiosErr.response?.data?.error?.message || axiosErr.message || 'Failed to complete delivery.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !isSubmitting && onClose()}
      fullWidth
      maxWidth="sm"
      scroll="paper"
    >
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.05rem', py: 1.75 }}>
        Complete Delivery — Verification
      </DialogTitle>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
      >
        <DialogContent dividers sx={{ py: 2 }}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}

            {assignment.isCod && (
              <Paper
                elevation={0}
                sx={{
                  p: 1.75,
                  bgcolor: '#FFFBEB',
                  border: '1px solid #F59E0B',
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                  <RupeeIcon fontSize="small" sx={{ color: '#B45309' }} />
                  <Typography variant="subtitle2" sx={{ color: '#92400E', fontWeight: 800 }}>
                    Collect Cash on Delivery: ₹
                    {(assignment.codAmountPaise / 100).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </Typography>
                </Stack>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={codCollected}
                      onChange={(e) => setCodCollected(e.target.checked)}
                      color="warning"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#78350F' }}>
                      I have collected the full cash amount
                    </Typography>
                  }
                />
              </Paper>
            )}

            <Box>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                <OtpIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" sx={{ color: '#111827', fontWeight: 700 }}>
                  Customer 4-Digit OTP
                </Typography>
              </Stack>
              <TextField
                fullWidth
                placeholder="Enter 4-digit customer OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{
                  inputMode: 'numeric',
                  maxLength: 6,
                  style: {
                    fontSize: otp ? '1.3rem' : '0.95rem',
                    letterSpacing: otp ? '0.35em' : 'normal',
                    fontWeight: otp ? 800 : 500,
                    textAlign: 'center',
                  },
                }}
                autoFocus
              />
            </Box>

            <TextField
              fullWidth
              label="Received By (Customer / Recipient Name)"
              placeholder="Enter recipient name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#4B5563', display: 'block', mb: 0.75 }}>
                Parcel Photo Proof (Optional)
              </Typography>
              <Button
                component="label"
                variant="outlined"
                fullWidth
                disabled={isUploadingPhoto}
                startIcon={isUploadingPhoto ? <CircularProgress size={18} /> : <CameraIcon />}
              >
                {isUploadingPhoto ? 'Uploading Photo...' : photoUrl ? 'Retake / Replace Photo' : 'Capture / Upload Photo'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={handlePhotoUpload}
                />
              </Button>
              {photoUrl && (
                <Box sx={{ mt: 1.25, borderRadius: 2, overflow: 'hidden', border: '1px solid #E5E7EB', maxHeight: 150 }}>
                  <img
                    src={photoUrl}
                    alt="POD Preview"
                    style={{ width: '100%', maxHeight: 150, objectFit: 'cover', display: 'block' }}
                  />
                </Box>
              )}
            </Box>

            <SignaturePad onChange={setSignatureDataUrl} />

            <TextField
              fullWidth
              multiline
              rows={2}
              label="Handover Notes (Optional)"
              placeholder="e.g. Handed over at gate"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, bgcolor: '#FFFFFF' }}>
          <Button onClick={onClose} disabled={isSubmitting} color="inherit">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="success"
            disabled={isSubmitting || isUploadingPhoto}
            startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
          >
            {isSubmitting ? 'Verifying...' : 'Confirm Delivery'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
