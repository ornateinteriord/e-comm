import React, { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Button,
} from '@mui/material';
import {
  Share as ShareIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';

interface StoreReferralCardProps {
  storeId: string;
  storeName?: string;
}

export default function StoreReferralCard({ storeId }: StoreReferralCardProps) {
  const [copied, setCopied] = useState(false);

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

  return (
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
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
            Share your referral link with new store partners
          </Typography>
        </Box>
      </Box>

      {/* Dashed Box with Sponsor Code & Copy Link Button */}
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
      </Box>

      {/* Helper Footer text - Absolutely NO "earn" word! */}
      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 1.75, lineHeight: 1.5 }}>
        When another store registers with your referral link, they will be registered as a partner store under your network.
      </Typography>
    </Paper>
  );
}
