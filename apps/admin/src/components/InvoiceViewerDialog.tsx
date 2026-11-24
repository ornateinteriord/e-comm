import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  CircularProgress,
  Alert,
  Typography,
  Stack,
  useTheme,
} from '@mui/material';
import {
  Print as PrintIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import api from '../api/client';

interface InvoiceViewerDialogProps {
  open: boolean;
  onClose: () => void;
  invoiceIdentifier: string | null; // Can be invoiceNumber (INV-2026-XXXX) or orderNumber (ORD-XXXX) or orderId
  orderNumber?: string;
}

export default function InvoiceViewerDialog({
  open,
  onClose,
  invoiceIdentifier,
  orderNumber,
}: InvoiceViewerDialogProps) {
  const theme = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoiceHtml = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Clean identifier: remove any leading slash
      const cleanId = id.trim();
      const response = await api.get(`/invoices/${encodeURIComponent(cleanId)}/html`, {
        responseType: 'text',
      });
      setHtmlContent(response.data);
    } catch (err: any) {
      console.error('Failed to load invoice html:', err);
      const msg = err.response?.data?.error?.message || err.message || 'Failed to load invoice document.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && invoiceIdentifier) {
      fetchInvoiceHtml(invoiceIdentifier);
    } else if (!open) {
      setHtmlContent(null);
      setError(null);
    }
  }, [open, invoiceIdentifier]);

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  const titleText = orderNumber
    ? `Tax Invoice · Order #${orderNumber}`
    : invoiceIdentifier
    ? `Tax Invoice · ${invoiceIdentifier}`
    : 'Tax Invoice';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px',
          overflow: 'hidden',
          minHeight: '80vh',
          maxHeight: '92vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: theme.palette.mode === 'light' ? '#f8fafc' : '#0f172a',
        }}
      >
        <Typography variant="h6" fontWeight={800} letterSpacing="-0.02em">
          {titleText}
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="contained"
            size="small"
            startIcon={<PrintIcon fontSize="small" />}
            onClick={handlePrint}
            disabled={!htmlContent || isLoading}
            sx={{
              bgcolor: '#FF7900',
              color: '#ffffff',
              fontWeight: 800,
              textTransform: 'none',
              borderRadius: '8px',
              px: 2,
              boxShadow: '0 2px 6px rgba(255,121,0,0.3)',
              '&:hover': { bgcolor: '#e66d00' },
            }}
          >
            Download / Print PDF
          </Button>

          <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#f8fafc' }}>
        {isLoading && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 12,
              gap: 2,
            }}
          >
            <CircularProgress sx={{ color: '#FF7900' }} />
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Loading official GST tax invoice…
            </Typography>
          </Box>
        )}

        {error && !isLoading && (
          <Box sx={{ p: 4 }}>
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={() => invoiceIdentifier && fetchInvoiceHtml(invoiceIdentifier)}
                >
                  Retry
                </Button>
              }
              sx={{ borderRadius: '8px' }}
            >
              {error}
            </Alert>
          </Box>
        )}

        {htmlContent && !isLoading && (
          <Box sx={{ flex: 1, width: '100%', height: 'calc(80vh - 70px)', p: 0 }}>
            <iframe
              ref={iframeRef}
              srcDoc={htmlContent}
              title="Official GST Tax Invoice"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
              }}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          justifyContent: 'space-between',
          bgcolor: theme.palette.mode === 'light' ? '#f8fafc' : '#0f172a',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Official GST Tax Invoice · Issued by BLUSKY MICRO SERVICES FOUNDATION
        </Typography>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 700, color: 'text.secondary' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
