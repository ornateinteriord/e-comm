import React, { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Button,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Share as ShareIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  QrCode2 as QrCodeIcon,
} from '@mui/icons-material';
import StoreReferralQrDialog from './StoreReferralQrDialog';

interface StoreReferralCardProps {
  storeId: string;
  storeName?: string;
}

export default function StoreReferralCard({ storeId, storeName }: StoreReferralCardProps) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5175';
  const referralLink = `${origin}/register?ref=${storeId}`;

  const handleCopyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join E-Shopy Partner Stores',
          text: `Register your store on E-Shopy using our sponsor code: ${storeId}`,
          url: referralLink,
        });
        return;
      } catch {
        // Fallback to QR dialog
      }
    }
    setQrOpen(true);
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: '20px',
          bgcolor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Header with Share Icon */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                bgcolor: 'rgba(255, 121, 0, 0.1)',
                color: '#FF7900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShareIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0F172A', lineHeight: 1.2 }}>
                Invite Partner Stores
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Share your referral link & QR code with new store partners
              </Typography>
            </Box>
          </Box>

          <Tooltip title="Share Referral">
            <IconButton
              size="small"
              onClick={handleShare}
              sx={{
                bgcolor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                color: '#64748B',
                '&:hover': { bgcolor: '#F1F5F9', color: '#FF7900' },
              }}
            >
              <ShareIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Dashed Box with Sponsor Code, QR Code Button & Copy Link Button */}
        <Box
          sx={{
            p: 2,
            borderRadius: '12px',
            bgcolor: '#F8FAFC',
            border: '1px dashed #CBD5E1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: 2,
            gap: 2,
            flexWrap: { xs: 'wrap', sm: 'nowrap' },
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, display: 'block', fontSize: '0.72rem' }}>
              YOUR UNIQUE SPONSOR CODE
            </Typography>
            <Typography variant="h6" fontWeight={900} sx={{ color: '#FF7900', letterSpacing: '0.05em' }}>
              {storeId}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {/* QR Code Dialog Trigger Button */}
            <Button
              variant="contained"
              size="small"
              startIcon={<QrCodeIcon />}
              onClick={() => setQrOpen(true)}
              sx={{
                bgcolor: '#059669',
                color: '#FFFFFF',
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: '8px',
                px: 2,
                py: 0.8,
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                '&:hover': {
                  bgcolor: '#047857',
                },
              }}
            >
              QR Code
            </Button>

            {/* Copy Link Button */}
            <Button
              variant="outlined"
              size="small"
              startIcon={copied ? <CheckIcon /> : <CopyIcon />}
              onClick={handleCopyReferral}
              sx={{
                borderColor: copied ? '#16A34A' : '#FF7900',
                color: copied ? '#16A34A' : '#FF7900',
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: '8px',
                px: 2,
                py: 0.8,
                flexShrink: 0,
                '&:hover': {
                  borderColor: '#E06B00',
                  bgcolor: 'rgba(255, 121, 0, 0.06)',
                },
              }}
            >
              {copied ? 'Copied' : 'Copy Link'}
            </Button>
          </Stack>
        </Box>

        {/* Helper Footer text */}
        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 1.75, lineHeight: 1.5 }}>
          When another store registers with your referral link or scans your QR code, they will be registered as a partner store under your network.
        </Typography>
      </Paper>

      {/* Store Partner QR Dialog */}
      <StoreReferralQrDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        storeId={storeId}
        storeName={storeName}
        referralLink={referralLink}
      />
    </>
  );
}
