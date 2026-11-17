import { Box, Container, Grid, Typography, Link, Divider, useTheme } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import {
  LocationOnOutlined as LocationIcon,
  PhoneOutlined as PhoneIcon,
  EmailOutlined as EmailIcon,
} from '@mui/icons-material';

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
        pb: { xs: '84px', md: 5 },
        mt: 'auto',
        borderTop: isLight ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
        transition: 'background-color 0.2s ease',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* 1. Brand & Overview */}
          <Grid item xs={12} md={3.5}>
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
                src="/logo-dark.svg"
                alt="E-Shopy"
                sx={{
                  height: 44,
                  width: 'auto',
                  maxWidth: 180,
                  objectFit: 'contain',
                  transition: 'transform 0.2s ease',
                  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))',
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: '#94A3B8', lineHeight: 1.7, maxWidth: 320, mb: 2 }}>
              Your premium destination for curated electronics, fashion, home essentials, and lifestyle accessories. Direct warehouse inventory with express delivery across India.
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', display: 'block', lineHeight: 1.5 }}>
              100% Secure Payments via Razorpay & Cashfree. GST compliant invoices generated automatically on order confirmation.
            </Typography>
          </Grid>

          {/* 2. Shop Categories */}
          <Grid item xs={6} sm={3} md={2}>
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

          {/* 3. Customer Care */}
          <Grid item xs={6} sm={3} md={2.5}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2, textTransform: 'uppercase', color: '#E2E8F0', letterSpacing: '0.05em' }}>
              Customer Care
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Link component={RouterLink} to="/orders" sx={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem', '&:hover': { color: '#FF7900' }, transition: 'color 0.15s' }}>Track Orders</Link>
              <Link component={RouterLink} to="/wishlist" sx={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem', '&:hover': { color: '#FF7900' }, transition: 'color 0.15s' }}>Wishlist</Link>
              <Link component={RouterLink} to="/contact" sx={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem', '&:hover': { color: '#FF7900' }, transition: 'color 0.15s' }}>Contact Us</Link>
              <Link component={RouterLink} to="/privacy-policy" sx={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem', '&:hover': { color: '#FF7900' }, transition: 'color 0.15s' }}>Privacy Policy</Link>
              <Link component={RouterLink} to="/terms-and-conditions" sx={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem', '&:hover': { color: '#FF7900' }, transition: 'color 0.15s' }}>Terms & Conditions</Link>
            </Box>
          </Grid>

          {/* 4. Contact Us: Address, Mobile & Email */}
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2, textTransform: 'uppercase', color: '#E2E8F0', letterSpacing: '0.05em' }}>
              Contact & Address
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Office Address */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <LocationIcon sx={{ fontSize: 20, color: '#FF7900', mt: 0.25, flexShrink: 0 }} />
                <Box>
                  <Typography variant="body2" sx={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.45 }}>
                    Shop No. G2, Asha Chandra Trade Center, Court Road
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.25 }}>
                    Udupi, Karnataka, India - 576101
                  </Typography>
                </Box>
              </Box>

              {/* Mobile / Helpline */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <PhoneIcon sx={{ fontSize: 20, color: '#FF7900', mt: 0.25, flexShrink: 0 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                  <Link
                    href="tel:+917676518566"
                    sx={{
                      color: '#E2E8F0',
                      textDecoration: 'none',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      '&:hover': { color: '#FF7900' },
                      transition: 'color 0.15s ease',
                    }}
                  >
                    +91 7676518566
                  </Link>
                  <Link
                    href="tel:+917411011100"
                    sx={{
                      color: '#94A3B8',
                      textDecoration: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      '&:hover': { color: '#FF7900' },
                      transition: 'color 0.15s ease',
                    }}
                  >
                    +91 7411011100
                  </Link>
                </Box>
              </Box>

              {/* Email Addresses */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <EmailIcon sx={{ fontSize: 20, color: '#FF7900', mt: 0.25, flexShrink: 0 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                  <Link
                    href="mailto:eshopy650@gmail.com"
                    sx={{
                      color: '#E2E8F0',
                      textDecoration: 'none',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      wordBreak: 'break-all',
                      '&:hover': { color: '#FF7900' },
                      transition: 'color 0.15s ease',
                    }}
                  >
                    eshopy650@gmail.com
                  </Link>
                  <Link
                    href="mailto:77411011100sandeep@gmail.com"
                    sx={{
                      color: '#94A3B8',
                      textDecoration: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      wordBreak: 'break-all',
                      '&:hover': { color: '#FF7900' },
                      transition: 'color 0.15s ease',
                    }}
                  >
                    77411011100sandeep@gmail.com
                  </Link>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, borderColor: isLight ? 'rgba(255, 255, 255, 0.12)' : '#1E293B' }} />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
            © {new Date().getFullYear()} BLUSKY MICRO SERVICES FOUNDATION (E-Shopy). All rights reserved.
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Flagship Reliability · Verified Genuine Products
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
