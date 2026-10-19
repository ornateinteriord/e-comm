import React, { useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Container, Grid, Typography, Button, Chip, Divider,
  Breadcrumbs, Link, CircularProgress, Paper, Stack, IconButton,
  Table, TableBody, TableCell, TableRow, Alert, useMediaQuery, useTheme,
} from '@mui/material';
import {
  ShoppingCart as CartIcon,
  FlashOn as BuyNowIcon,
  FavoriteBorder as WishlistIcon,
  Favorite as WishlistFilledIcon,
  NavigateNext as NextIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  LocalShipping as ShippingIcon,
  Shield as WarrantyIcon,
  Autorenew as ReturnIcon,
  Star as StarIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import api from '../api/client';
import { useCartStore } from '../store/cart.store';
import type { PublicProduct, ProductVariant } from '@ornate/types';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const addItem = useCartStore((s) => s.addItem);

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);

  const { data: product, isLoading, error } = useQuery<PublicProduct>({
    queryKey: ['product-detail', slug],
    queryFn: async () => {
      const { data } = await api.get(`/products/${slug}`);
      return data.data as PublicProduct;
    },
    enabled: Boolean(slug),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 16 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !product) {
    return (
      <Container maxWidth="md" sx={{ py: 12, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>Product Not Found</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          The product you are looking for does not exist or may have been unlisted.
        </Typography>
        <Button variant="contained" component={RouterLink} to="/" sx={{ borderRadius: 2.5, px: 4 }}>
          Back to Storefront
        </Button>
      </Container>
    );
  }

  const applicablePrice = selectedVariant?.sellingPriceOverride || product.pricing?.applicablePrice || product.pricing?.sellingPrice || 0;
  const mrp = product.pricing?.mrp ?? applicablePrice;
  const hasDiscount = mrp > applicablePrice;
  const savingsPercent = product.pricing?.savingsPercent ?? (hasDiscount ? Math.round(((mrp - applicablePrice) / mrp) * 100) : 0);
  const savingsAmount = mrp - applicablePrice;
  const isDeal = product.pricing?.dealActive;

  const images = product.images?.length
    ? product.images
    : [{ id: 'default', url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80', order: 0 }];

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      variantId: selectedVariant?.id || null,
      productName: selectedVariant ? `${product.name} (${selectedVariant.sku})` : product.name,
      productSlug: product.slug,
      productImage: images[0]?.url,
      sku: selectedVariant ? selectedVariant.sku : product.sku,
      quantity,
      unitApplicablePrice: applicablePrice,
      unitMrp: mrp,
    });
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2500);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate('/checkout');
  };

  return (
    <Box sx={{ pb: { xs: 12, md: 8 } }}>
      <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
        {/* Breadcrumbs */}
        <Breadcrumbs separator={<NextIcon sx={{ fontSize: 14 }} />} sx={{ mb: 3 }}>
          <Link component={RouterLink} to="/" color="inherit" underline="hover" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Home
          </Link>
          <Link component={RouterLink} to="/search" color="inherit" underline="hover" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
            {product.categoryName || 'Products'}
          </Link>
          <Typography color="text.primary" sx={{ fontSize: '0.85rem', fontWeight: 800 }} noWrap>
            {product.name}
          </Typography>
        </Breadcrumbs>

        {addedNotice && (
          <Alert
            icon={<CheckCircleIcon fontSize="inherit" />}
            severity="success"
            sx={{ mb: 3, borderRadius: 2.5, fontWeight: 700 }}
          >
            Successfully added to your shopping bag!
          </Alert>
        )}

        <Grid container spacing={{ xs: 3, md: 6 }}>
          {/* ---- Left Column: Image Gallery ---- */}
          <Grid item xs={12} md={6}>
            <Box sx={{ position: 'sticky', top: 90 }}>
              {/* Main Image Stage */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  pt: '100%',
                  bgcolor: '#f1f5f9',
                  borderRadius: { xs: 3, md: 4 },
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 8px 30px -10px rgba(0,0,0,0.06)',
                }}
              >
                <Box
                  component="img"
                  src={images[selectedImageIndex]?.url}
                  alt={product.name}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />

                {/* Badges on Gallery */}
                <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 16, left: 16 }}>
                  {hasDiscount && (
                    <Chip
                      label={`${savingsPercent}% OFF`}
                      sx={{ bgcolor: isDeal ? '#f43f5e' : '#0f172a', color: 'white', fontWeight: 800, fontSize: '0.75rem' }}
                    />
                  )}
                  {isDeal && (
                    <Chip
                      label="SPECIAL DEAL"
                      sx={{ bgcolor: '#2563eb', color: 'white', fontWeight: 800, fontSize: '0.75rem', borderRadius: 1 }}
                    />
                  )}
                </Stack>

                <IconButton
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(8px)',
                    color: isWishlisted ? '#f43f5e' : '#64748b',
                    '&:hover': { bgcolor: 'white' },
                  }}
                >
                  {isWishlisted ? <WishlistFilledIcon /> : <WishlistIcon />}
                </IconButton>
              </Box>

              {/* Thumbnails Row */}
              {images.length > 1 && (
                <Stack direction="row" spacing={1.5} sx={{ mt: 2, overflowX: 'auto', pb: 1 }}>
                  {images.map((img, idx) => (
                    <Box
                      key={img.id || idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      sx={{
                        width: 72,
                        height: 72,
                        borderRadius: 2,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: '2px solid',
                        borderColor: selectedImageIndex === idx ? '#4f46e5' : 'transparent',
                        opacity: selectedImageIndex === idx ? 1 : 0.65,
                        transition: 'all 0.2s',
                        flexShrink: 0,
                        '&:hover': { opacity: 1 },
                      }}
                    >
                      <Box component="img" src={img.url} alt={`Thumb ${idx}`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Grid>

          {/* ---- Right Column: Product Info & Purchase ---- */}
          <Grid item xs={12} md={6}>
            <Box>
              {/* Brand & Stock Pill */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="overline" sx={{ color: '#6366f1', fontWeight: 800, letterSpacing: '0.08em' }}>
                  {product.brand || 'PREMIUM COLLECTION'}
                </Typography>
                <Chip
                  label={product.stock > 0 ? `In Stock (${product.stock} units)` : 'Out of Stock'}
                  size="small"
                  sx={{
                    bgcolor: product.stock > 0 ? '#dcfce7' : '#fee2e2',
                    color: product.stock > 0 ? '#15803d' : '#b91c1c',
                    fontWeight: 800,
                  }}
                />
              </Box>

              {/* Title */}
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: '#0f172a',
                  lineHeight: 1.25,
                  mb: 1.5,
                  fontSize: { xs: '1.5rem', sm: '2rem', md: '2.25rem' },
                }}
              >
                {product.name}
              </Typography>

              {/* SKU & Availability */}
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  SKU: {selectedVariant ? selectedVariant.sku : product.sku}
                </Typography>
                <Typography variant="caption" color="text.secondary">·</Typography>
                <Typography variant="caption" color="#16a34a" fontWeight={700}>
                  {product.stock > 0 ? 'Verified In-Stock' : 'Out of Stock'}
                </Typography>
              </Stack>

              {/* 4-Tier Pricing Banner */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  mb: 3.5,
                  borderRadius: 3.5,
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="h3" fontWeight={900} sx={{ color: isDeal ? '#e11d48' : '#0f172a', letterSpacing: '-0.03em' }}>
                    ₹{(applicablePrice / 100).toLocaleString('en-IN')}
                  </Typography>

                  {hasDiscount && (
                    <Typography
                      variant="h6"
                      sx={{ color: '#94a3b8', textDecoration: 'line-through', fontWeight: 500 }}
                    >
                      MRP ₹{(mrp / 100).toLocaleString('en-IN')}
                    </Typography>
                  )}

                  {hasDiscount && (
                    <Chip
                      label={`Save ₹${(savingsAmount / 100).toLocaleString('en-IN')} (${savingsPercent}%)`}
                      color="success"
                      size="small"
                      sx={{ fontWeight: 800 }}
                    />
                  )}
                </Box>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1 }}>
                  Inclusive of all taxes · 18% GST invoice automatically provided with warranty
                </Typography>
              </Paper>

              {/* Short Description */}
              <Typography variant="body1" sx={{ color: '#475569', lineHeight: 1.7, mb: 3.5 }}>
                {product.shortDescription || product.longDescription}
              </Typography>

              {/* Variants Selector */}
              {product.variants && product.variants.length > 0 && (
                <Box sx={{ mb: 3.5 }}>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
                    Select Option / Variant:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {product.variants.map((v) => {
                      const isSelected = selectedVariant?.id === v.id;
                      const attrStr = v.attributes.map((a) => a.value).join(' · ');
                      return (
                        <Chip
                          key={v.id}
                          label={attrStr || v.sku}
                          onClick={() => setSelectedVariant(isSelected ? null : v)}
                          variant={isSelected ? 'filled' : 'outlined'}
                          sx={{
                            fontWeight: 700,
                            borderRadius: 2,
                            py: 2,
                            px: 1,
                            bgcolor: isSelected ? '#0f172a !important' : 'transparent',
                            color: isSelected ? 'white !important' : '#0f172a',
                            borderColor: isSelected ? '#0f172a' : '#cbd5e1',
                          }}
                        />
                      );
                    })}
                  </Stack>
                </Box>
              )}

              {/* Quantity Selector & Desktop Actions */}
              {!isMobile && (
                <Box sx={{ mb: 4 }}>
                  <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight={800}>Quantity:</Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        border: '1px solid #cbd5e1',
                        borderRadius: 2.5,
                        bgcolor: 'background.paper',
                      }}
                    >
                      <IconButton size="small" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                      <Typography sx={{ px: 2, fontWeight: 800 }}>{quantity}</Typography>
                      <IconButton size="small" onClick={() => setQuantity(quantity + 1)}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      startIcon={<CartIcon />}
                      onClick={handleAddToCart}
                      sx={{
                        bgcolor: '#0f172a',
                        py: 1.5,
                        borderRadius: 1,
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        '&:hover': { bgcolor: '#1e293b' },
                      }}
                    >
                      Add to Shopping Bag
                    </Button>
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      startIcon={<BuyNowIcon />}
                      onClick={handleBuyNow}
                      sx={{
                        bgcolor: '#2563eb',
                        py: 1.5,
                        borderRadius: 1,
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        '&:hover': { bgcolor: '#1d4ed8' },
                      }}
                    >
                      Buy Now
                    </Button>
                  </Stack>
                </Box>
              )}

              {/* Trust Value Cards */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', mb: 4 }}>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Stack spacing={0.5} alignItems="center" textAlign="center">
                      <ShippingIcon sx={{ color: '#4f46e5', fontSize: 24 }} />
                      <Typography variant="caption" fontWeight={800}>Free Express Delivery</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>Above ₹500</Typography>
                    </Stack>
                  </Grid>
                  <Grid item xs={4}>
                    <Stack spacing={0.5} alignItems="center" textAlign="center">
                      <WarrantyIcon sx={{ color: '#10b981', fontSize: 24 }} />
                      <Typography variant="caption" fontWeight={800}>Verified Warranty</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>Official Guarantee</Typography>
                    </Stack>
                  </Grid>
                  <Grid item xs={4}>
                    <Stack spacing={0.5} alignItems="center" textAlign="center">
                      <ReturnIcon sx={{ color: '#f59e0b', fontSize: 24 }} />
                      <Typography variant="caption" fontWeight={800}>7-Day Returns</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>Hassle-Free</Typography>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>

              {/* Specifications Table */}
              {product.attributes && product.attributes.length > 0 && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>Specifications & Details</Typography>
                  <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <Table size="small">
                      <TableBody>
                        {product.attributes.map((attr, idx) => (
                          <TableRow key={idx} sx={{ '&:nth-of-type(odd)': { bgcolor: '#f8fafc' } }}>
                            <TableCell sx={{ fontWeight: 700, width: '40%', color: '#64748b' }}>{attr.key}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{attr.value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* ---- Mobile Native Sticky Purchase Bar (Amazon / Nike / ASOS app style) ---- */}
      {isMobile && (
        <Paper
          elevation={12}
          sx={{
            position: 'fixed',
            bottom: 60, // Above bottom nav dock
            left: 0,
            right: 0,
            zIndex: 1050,
            p: 1.5,
            px: 2,
            bgcolor: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(16px)',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL PRICE</Typography>
            <Typography variant="h6" fontWeight={900} sx={{ color: isDeal ? '#e11d48' : '#0f172a', lineHeight: 1.1 }}>
              ₹{(applicablePrice / 100).toLocaleString('en-IN')}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flex: 1, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleAddToCart}
              sx={{
                py: 0.75,
                px: 2,
                borderRadius: 1,
                fontWeight: 700,
                color: '#0f172a',
                borderColor: '#0f172a',
                fontSize: '0.8rem',
              }}
            >
              Add to Bag
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleBuyNow}
              sx={{
                py: 0.75,
                px: 2.5,
                borderRadius: 1,
                fontWeight: 700,
                bgcolor: '#2563eb',
                fontSize: '0.8rem',
                '&:hover': { bgcolor: '#1d4ed8' },
              }}
            >
              Buy Now
            </Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
