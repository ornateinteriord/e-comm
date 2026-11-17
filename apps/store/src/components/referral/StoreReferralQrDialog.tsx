import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Download as DownloadIcon,
  Storefront as StorefrontIcon,
} from '@mui/icons-material';

// Inline SVG for WhatsApp
const WhatsAppIcon = ({ size = 18, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

export interface StoreReferralQrDialogProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  storeName?: string;
  referralLink: string;
}

export default function StoreReferralQrDialog({
  open,
  onClose,
  storeId,
  storeName = 'Partner Store',
  referralLink,
}: StoreReferralQrDialogProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);

  // Generate QR Code data URL
  useEffect(() => {
    if (!open || !referralLink) return;

    let isSubscribed = true;
    setIsGenerating(true);

    QRCode.toDataURL(referralLink, {
      width: 440,
      margin: 1,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (isSubscribed) {
          setQrDataUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate store referral QR code:', err);
        if (isSubscribed) {
          setIsGenerating(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [open, referralLink]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 600;
    const height = 700;
    canvas.width = width;
    canvas.height = height;

    if (ctx) {
      // White canvas background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Top brand header with store accent
      ctx.fillStyle = '#FF7900';
      ctx.fillRect(0, 0, width, 110);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('E-SHOPY PARTNER STORES', width / 2, 44);

      ctx.font = '600 15px sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText(`Partner Store • ${storeName}`, width / 2, 74);

      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`Sponsor Code: ${storeId}`, width / 2, 96);

      // Draw QR Image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const qrSize = 400;
        const qrX = (width - qrSize) / 2;
        const qrY = 140;

        ctx.strokeStyle = '#FED7AA';
        ctx.lineWidth = 2;
        ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);

        ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Scan with Phone Camera to Register Store', width / 2, 585);

        ctx.fillStyle = '#64748B';
        ctx.font = '500 14px sans-serif';
        ctx.fillText(`Sponsor code: ${storeId} is pre-filled automatically`, width / 2, 615);

        ctx.fillStyle = '#FF7900';
        ctx.font = '600 12px monospace';
        const displayLink = referralLink.length > 55 ? referralLink.slice(0, 52) + '...' : referralLink;
        ctx.fillText(displayLink, width / 2, 650);

        const dlLink = document.createElement('a');
        dlLink.download = `eshopy-store-qr-${storeId}.png`;
        dlLink.href = canvas.toDataURL('image/png');
        document.body.appendChild(dlLink);
        dlLink.click();
        document.body.removeChild(dlLink);
      };
      img.src = qrDataUrl;
    } else {
      const dlLink = document.createElement('a');
      dlLink.download = `eshopy-store-qr-${storeId}.png`;
      dlLink.href = qrDataUrl;
      document.body.appendChild(dlLink);
      dlLink.click();
      document.body.removeChild(dlLink);
    }
  };

  const handleShareWhatsApp = () => {
    const text = `Partner with E-Shopy! Register your store using our link:\n${referralLink}\n(Sponsor Code: ${storeId})`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          width: { xs: '95vw', sm: 580 },
          maxWidth: '580px',
          bgcolor: '#FFFFFF',
          boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.18)',
          overflow: 'hidden',
          m: { xs: 1.5, sm: 2 },
        },
      }}
    >
      {/* Header Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.75,
          borderBottom: '1px solid #F1F5F9',
          bgcolor: '#FFFFFF',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '9px',
              bgcolor: '#FFF7ED',
              color: '#FF7900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <StorefrontIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0F172A', lineHeight: 1.2 }}>
              Store Referral QR
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.74rem' }}>
              Invite partner stores to register under your network
            </Typography>
          </Box>
        </Box>

        <IconButton
          onClick={onClose}
          size="small"
          aria-label="close"
          sx={{
            color: '#64748B',
            bgcolor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            '&:hover': { bgcolor: '#F1F5F9', color: '#0F172A' },
          }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Dialog Body - Wide Side-by-Side Grid (No Vertical Scrolling) */}
      <DialogContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2.5,
            alignItems: 'stretch',
          }}
        >
          {/* LEFT COLUMN: Clean QR Code Box */}
          <Box
            sx={{
              width: { xs: '100%', sm: 200 },
              flexShrink: 0,
              bgcolor: '#F8FAFC',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            {isGenerating ? (
              <Box sx={{ py: 6 }}>
                <CircularProgress size={32} sx={{ color: '#FF7900' }} />
              </Box>
            ) : qrDataUrl ? (
              <Box
                component="img"
                src={qrDataUrl}
                alt={`QR code for store sponsor ${storeId}`}
                sx={{
                  width: 160,
                  height: 160,
                  display: 'block',
                  borderRadius: '10px',
                  bgcolor: '#FFFFFF',
                  p: 0.5,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                }}
              />
            ) : (
              <Typography variant="caption" color="error">
                Failed to load QR
              </Typography>
            )}

            <Typography
              variant="caption"
              sx={{
                color: '#64748B',
                fontWeight: 600,
                fontSize: '0.72rem',
                mt: 1.25,
                lineHeight: 1.3,
              }}
            >
              Scan with camera or scanner
            </Typography>
          </Box>

          {/* RIGHT COLUMN: Store Info + Link + Actions */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minWidth: 0,
              gap: 1.75,
            }}
          >
            {/* Store Details Pill Card */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: '14px',
                bgcolor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: '#FF7900',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <StorefrontIcon fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight={800}
                    noWrap
                    sx={{ color: '#0F172A', lineHeight: 1.2, fontSize: '0.9rem' }}
                  >
                    {storeName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.75rem' }}>
                    Sponsor Code:{' '}
                    <Box component="span" sx={{ color: '#FF7900', fontWeight: 800 }}>
                      {storeId}
                    </Box>
                  </Typography>
                </Box>
              </Box>

              <Chip
                label="Partner Store"
                size="small"
                sx={{
                  bgcolor: '#FFF7ED',
                  color: '#C2410C',
                  border: '1px solid #FED7AA',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  height: 24,
                  borderRadius: '6px',
                  flexShrink: 0,
                }}
              />
            </Box>

            {/* Referral Link Box */}
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: '#64748B',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  display: 'block',
                  mb: 0.5,
                }}
              >
                Store Registration Link
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  px: 1.25,
                  py: 0.5,
                  gap: 1,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: '#334155',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {referralLink}
                </Typography>

                <Button
                  size="small"
                  onClick={handleCopyLink}
                  startIcon={copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <CopyIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    bgcolor: copied ? '#DCFCE7' : '#F1F5F9',
                    color: copied ? '#15803D' : '#0F172A',
                    fontWeight: 700,
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    py: 0.4,
                    px: 1.2,
                    borderRadius: '7px',
                    minWidth: 'auto',
                    flexShrink: 0,
                    '&:hover': {
                      bgcolor: copied ? '#DCFCE7' : '#E2E8F0',
                    },
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </Box>
            </Box>

            {/* Action Buttons Row */}
            <Stack direction="row" spacing={1.25} sx={{ mt: 'auto', pt: 0.5 }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={handleDownloadQr}
                disabled={!qrDataUrl || isGenerating}
                startIcon={<DownloadIcon sx={{ fontSize: 18 }} />}
                sx={{
                  borderColor: '#FF7900',
                  color: '#FF7900',
                  bgcolor: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  py: 0.9,
                  borderRadius: '10px',
                  '&:hover': {
                    bgcolor: '#FFF7ED',
                    borderColor: '#E06B00',
                  },
                }}
              >
                Download QR
              </Button>

              <Button
                variant="contained"
                fullWidth
                onClick={handleShareWhatsApp}
                startIcon={<WhatsAppIcon size={18} color="#FFFFFF" />}
                sx={{
                  bgcolor: '#25D366',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  py: 0.9,
                  borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(37, 211, 102, 0.25)',
                  '&:hover': {
                    bgcolor: '#1EBE5D',
                  },
                }}
              >
                WhatsApp
              </Button>
            </Stack>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
