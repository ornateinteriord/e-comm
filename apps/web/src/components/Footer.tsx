import React from 'react';
import { Box, Container, Grid, Typography, Link, Divider } from '@mui/material';
import { Link as RouterLink } from 'react-router';

export default function Footer() {
  return (
    <Box sx={{ bgcolor: '#0f172a', color: 'white', pt: 6, pb: 4, mt: 'auto' }}>
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.03em', mb: 2 }}>
              ornate
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', lineHeight: 1.7, maxWidth: 320 }}>
              Your premium destination for curated electronics, fashion, home essentials, and lifestyle accessories. Designed for quality and reliability.
            </Typography>
          </Grid>

          <Grid item xs={6} md={2}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, textTransform: 'uppercase', color: '#cbd5e1' }}>
              Shop
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link component={RouterLink} to="/categories/electronics" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: 'white' } }}>Electronics</Link>
              <Link component={RouterLink} to="/categories/clothing" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: 'white' } }}>Clothing</Link>
              <Link component={RouterLink} to="/categories/books" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: 'white' } }}>Books</Link>
              <Link component={RouterLink} to="/categories/home-kitchen" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: 'white' } }}>Home & Kitchen</Link>
            </Box>
          </Grid>

          <Grid item xs={6} md={3}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, textTransform: 'uppercase', color: '#cbd5e1' }}>
              Customer Care
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link component={RouterLink} to="/orders" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: 'white' } }}>Track Orders</Link>
              <Link component={RouterLink} to="/wishlist" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: 'white' } }}>Wishlist</Link>
              <Link component={RouterLink} to="/privacy-policy" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: 'white' } }}>Privacy Policy</Link>
              <Link component={RouterLink} to="/terms-and-conditions" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: 'white' } }}>Terms & Conditions</Link>
            </Box>
          </Grid>

          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, textTransform: 'uppercase', color: '#cbd5e1' }}>
              Secure Shopping
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
              100% Secure Payments via Razorpay. Fast & verified delivery across India.
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              GST compliant invoices generated automatically on order confirmation.
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, borderColor: '#334155' }} />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            © {new Date().getFullYear()} Ornate / Ornate Store Pvt Ltd. All rights reserved.
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Crafted with modern microservice architecture & Turborepo.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
