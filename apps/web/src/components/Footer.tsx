import { Box, Container, Grid, Typography, Link, Divider, useTheme } from '@mui/material';
import { Link as RouterLink } from 'react-router';

export default function Footer() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: isLight ? '#172B30' : '#0B0F19',
        color: '#FFFFFF',
        pt: 7,
        pb: 5,
        mt: 'auto',
        borderTop: isLight ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
        transition: 'background-color 0.2s ease',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Box
              component={RouterLink}
              to="/"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                textDecoration: 'none',
                mb: 2,
                '&:hover img': { transform: 'scale(1.03)' },
              }}
            >
              <Box
                component="img"
                src="/logo.svg"
                alt="E-Shophy"
                sx={{
                  height: 42,
                  width: 'auto',
                  maxWidth: 180,
                  objectFit: 'contain',
                  transition: 'transform 0.2s ease',
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: '#94A3B8', lineHeight: 1.7, maxWidth: 320 }}>
              Your premium destination for curated electronics, fashion, home essentials, and lifestyle accessories. Direct warehouse inventory with express delivery across India.
            </Typography>
          </Grid>

          <Grid item xs={6} md={2}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2, textTransform: 'uppercase', color: '#E2E8F0', letterSpacing: '0.05em' }}>
              Shop
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Link component={RouterLink} to="/categories/electronics" sx={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem', '&:hover': { color: '#FF7900' }, transition: 'color 0.15s' }}>Electronics</Link>
              <Link component={RouterLink} to="/categories/fashion-apparel" sx={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem', '&:hover': { color: '#FF7900' }, transition: 'color 0.15s' }}>Fashion</Link>
              <Link component={RouterLink} to="/categories/watches-accessories" sx={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem', '&:hover': { color: '#FF7900' }, transition: 'color 0.15s' }}>Watches</Link>
              <Link component={RouterLink} to="/categories/home-living" sx={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem', '&:hover': { color: '#FF7900' }, transition: 'color 0.15s' }}>Home & Living</Link>
            </Box>
          </Grid>

          <Grid item xs={6} md={3}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2, textTransform: 'uppercase', color: '#E2E8F0', letterSpacing: '0.05em' }}>
              Customer Care
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Link component={RouterLink} to="/orders" sx={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem', '&:hover': { color: '#FF7900' }, transition: 'color 0.15s' }}>Track Orders</Link>
              <Link component={RouterLink} to="/wishlist" sx={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem', '&:hover': { color: '#FF7900' }, transition: 'color 0.15s' }}>Wishlist</Link>
              <Link component={RouterLink} to="/privacy-policy" sx={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem', '&:hover': { color: '#FF7900' }, transition: 'color 0.15s' }}>Privacy Policy</Link>
              <Link component={RouterLink} to="/terms-and-conditions" sx={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem', '&:hover': { color: '#FF7900' }, transition: 'color 0.15s' }}>Terms & Conditions</Link>
            </Box>
          </Grid>

          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2, textTransform: 'uppercase', color: '#E2E8F0', letterSpacing: '0.05em' }}>
              Secure Shopping
            </Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8', mb: 2, lineHeight: 1.6 }}>
              100% Secure Payments via Razorpay. Fast & verified dispatch across India.
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', display: 'block', lineHeight: 1.5 }}>
              GST compliant invoices generated automatically on order confirmation.
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, borderColor: isLight ? 'rgba(255, 255, 255, 0.12)' : '#1E293B' }} />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
            © {new Date().getFullYear()} E-Shophy Pvt Ltd. All rights reserved.
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Flagship Reliability · Verified Genuine Products
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
