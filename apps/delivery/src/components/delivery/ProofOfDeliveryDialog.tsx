import { useState } from 'react';
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
  const [recipientName, setRecipientName] = useState(assignment.dropLocation?.name || '');
  const [notes, setNotes] = useState('');
  const [codCollected, setCodCollected] = useState(!assignment.isCod);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(undefined);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const resp = await api.post(`/delivery/assignments/${assignment.id}/complete`, {
        otp: otp.trim(),
        photoUrl,
        signatureDataUrl,
        recipientName: recipientName.trim() || assignment.dropLocation?.name,
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
    <Dialog open={open} onClose={() => !isSubmitting && onClose()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Complete Delivery — Proof of Delivery</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}

            {assignment.isCod && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: '#FFFBEB',
                  border: '1.5px solid #F59E0B',
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <RupeeIcon sx={{ color: '#B45309' }} />
                  <Typography variant="subtitle1" sx={{ color: '#92400E', fontWeight: 800 }}>
                    Collect Cash on Delivery: ₹{(assignment.codAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                      I have collected the full cash amount from the customer
                    </Typography>
                  }
                />
              </Paper>
            )}

            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <OtpIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" sx={{ color: '#172B30', fontWeight: 700 }}>
                  Customer Verification OTP (Required)
                </Typography>
              </Stack>
              <TextField
                fullWidth
                placeholder="Enter 4-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{
                  inputMode: 'numeric',
                  maxLength: 6,
                  style: { fontSize: '1.35rem', letterSpacing: '0.35em', fontWeight: 800, textAlign: 'center' },
                }}
                autoFocus
              />
            </Box>

            <TextField
              fullWidth
              label="Received By (Name)"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 0.75 }}>
                Delivery Photo Proof (Camera / Upload)
              </Typography>
              <Button
                component="label"
                variant="outlined"
                fullWidth
                disabled={isUploadingPhoto}
                startIcon={isUploadingPhoto ? <CircularProgress size={18} /> : <CameraIcon />}
              >
                {isUploadingPhoto ? 'Uploading Photo...' : photoUrl ? 'Retake / Replace Photo' : 'Capture / Upload Parcel Photo'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={handlePhotoUpload}
                />
              </Button>
              {photoUrl && (
                <Box sx={{ mt: 1.5, borderRadius: 2, overflow: 'hidden', border: '1px solid #E2E8F0', maxHeight: 160 }}>
                  <img
                    src={photoUrl}
                    alt="POD Preview"
                    style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }}
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
              placeholder="e.g. Left at security desk per customer request"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="success"
            disabled={isSubmitting || isUploadingPhoto}
            startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
            sx={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
          >
            {isSubmitting ? 'Verifying...' : 'Confirm Delivery'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
