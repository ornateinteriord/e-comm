import { useState, type MouseEvent } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Card, CardContent, CardMedia, Typography, Box, Chip,
  IconButton, Button, Stack,
} from '@mui/material';
import {
  ShoppingCart as CartIcon,
  Favorite as FavoriteFilledIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Check as CheckIcon,
  RemoveShoppingCart as OutOfStockIcon,
} from '@mui/icons-material';
import { useCartStore } from '../store/cart.store';
import api from '../api/client';
import type { PublicProduct } from '@ornate/types';

interface ProductCardProps {
  product: PublicProduct;
  featured?: boolean;
}

export default function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [addedAnim, setAddedAnim] = useState(false);

  const applicablePrice = product.pricing?.applicablePrice ?? product.pricing?.sellingPrice ?? 0;
  const mrp = product.pricing?.mrp ?? applicablePrice;
  const hasDiscount = mrp > applicablePrice;
  const savingsPercent = product.pricing?.savingsPercent ?? (hasDiscount ? Math.round(((mrp - applicablePrice) / mrp) * 100) : 0);
  const isDeal = product.pricing?.dealActive;
  const isOutOfStock = (product.stock ?? 0) <= 0;
  const isLowStock = !isOutOfStock && product.stock > 0 && product.stock <= 5;

  const primaryImage = (product.images && product.images.length > 0)
    ? ([...product.images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]?.url || product.images[0]?.url)
    : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80';

  const handleAddToCart = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    addItem({
      productId: product.id,
      variantId: null,
      productName: product.name,
      productSlug: product.slug,
      productImage: primaryImage,
      sku: product.sku,
      quantity: 1,
      unitApplicablePrice: applicablePrice,
      unitMrp: mrp,
    });
    setAddedAnim(true);
    setTimeout(() => setAddedAnim(false), 1200);
  };

  const handleToggleWishlist = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
    try {
      if (!isWishlisted) {
        await api.post('/wishlist', { productId: product.id });
      } else {
        await api.delete(`/wishlist/${product.id}`);
      }
    } catch {
      // optimistic
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: isOutOfStock ? '#e2e8f0' : 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        position: 'relative',
        opacity: isOutOfStock ? 0.92 : 1,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: isOutOfStock ? 'none' : { xs: 'none', sm: 'translateY(-6px)' },
          boxShadow: isOutOfStock ? 'none' : '0 20px 30px -10px rgba(255, 121, 0, 0.12)',
          borderColor: isOutOfStock ? '#cbd5e1' : '#FF7900',
          '& .product-image': {
            transform: isOutOfStock ? 'none' : 'scale(1.05)',
          },
        },
      }}
    >
      {/* Product Image Stage */}
      <Box
        component={RouterLink}
        to={`/products/${product.slug}`}
        sx={{
          position: 'relative',
          pt: { xs: '105%', sm: '100%' },
          bgcolor: (theme) => theme.palette.mode === 'light' ? '#F5F6F7' : '#1e293b',
          overflow: 'hidden',
          display: 'block',
        }}
      >
        <CardMedia
          component="img"
          className="product-image"
          image={primaryImage}
          alt={product.name}
          loading="lazy"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.4s ease',
            filter: isOutOfStock ? 'grayscale(70%) opacity(0.7)' : 'none',
          }}
        />

        {/* Center Out of Stock Banner over Image - Clean & Subtle */}
        {isOutOfStock && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(15, 23, 42, 0.35)',
              backdropFilter: 'blur(1.5px)',
              zIndex: 1,
            }}
          >
            <Chip
              label="OUT OF STOCK"
              size="small"
              sx={{
                bgcolor: 'rgba(15, 23, 42, 0.88)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: { xs: '0.62rem', sm: '0.75rem' },
                letterSpacing: '0.04em',
                height: { xs: 22, sm: 26 },
                px: 0.5,
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
              }}
            />
          </Box>
        )}

        {/* Badges Overlay */}
        <Stack
          direction="column"
          spacing={0.5}
          sx={{
            position: 'absolute',
            top: { xs: 6, sm: 10 },
            left: { xs: 6, sm: 10 },
            zIndex: 2,
          }}
        >
          {!isOutOfStock && (
            <>
              {hasDiscount && (
                <Chip
                  label={`${savingsPercent}% OFF`}
                  size="small"
                  sx={{
                    bgcolor: '#D92D20', // Discount label #D92D20
                    color: 'white',
                    fontWeight: 800,
                    fontSize: { xs: '0.62rem', sm: '0.7rem' },
                    height: { xs: 18, sm: 22 },
                    borderRadius: 1,
                  }}
                />
              )}

              {isDeal && (
                <Chip
                  label="DEAL"
                  size="small"
                  sx={{
                    bgcolor: '#FF7900',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: { xs: '0.6rem', sm: '0.68rem' },
                    height: { xs: 18, sm: 20 },
                    borderRadius: 1,
                  }}
                />
              )}

              {isLowStock && (
                <Chip
                  label={`Only ${product.stock} left`}
                  size="small"
                  sx={{
                    bgcolor: '#fef3c7',
                    color: '#b45309',
                    fontWeight: 800,
                    fontSize: { xs: '0.6rem', sm: '0.68rem' },
                    height: { xs: 18, sm: 20 },
                  }}
                />
              )}
            </>
          )}
        </Stack>

        {/* Compact Wishlist Button */}
        <IconButton
          size="small"
          onClick={handleToggleWishlist}
          sx={{
            position: 'absolute',
            top: { xs: 6, sm: 10 },
            right: { xs: 6, sm: 10 },
            width: { xs: 28, sm: 34 },
            height: { xs: 28, sm: 34 },
            p: 0,
            bgcolor: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(8px)',
            color: isWishlisted ? '#f43f5e' : '#64748b',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            '&:hover': {
              bgcolor: 'white',
              color: '#f43f5e',
              transform: 'scale(1.08)',
            },
            transition: 'all 0.2s',
            zIndex: 2,
          }}
        >
          {isWishlisted ? (
            <FavoriteFilledIcon sx={{ fontSize: { xs: 15, sm: 18 } }} />
          ) : (
            <FavoriteBorderIcon sx={{ fontSize: { xs: 15, sm: 18 } }} />
          )}
        </IconButton>
      </Box>

      {/* Product Content Details */}
      <CardContent
        sx={{
          flexGrow: 1,
          p: { xs: 1, sm: 2 },
          '&:last-child': { pb: { xs: 1, sm: 2 } },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Brand Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.35 }}>
          <Typography
            variant="caption"
            sx={{
              color: '#FF7900',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontSize: { xs: '0.62rem', sm: '0.7rem' },
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '65%',
            }}
          >
            {product.brand || product.categoryName || 'FLAGSHIP'}
          </Typography>

          <Typography
            variant="caption"
            sx={{
              fontSize: { xs: '0.64rem', sm: '0.72rem' },
              fontWeight: 800,
              color: isOutOfStock ? '#dc2626' : '#16a34a',
              flexShrink: 0,
            }}
          >
            {isOutOfStock ? 'Out of Stock' : 'In Stock'}
          </Typography>
        </Box>

        {/* Product Title */}
        <Typography
          component={RouterLink}
          to={`/products/${product.slug}`}
          variant="subtitle2"
          sx={{
            color: isOutOfStock ? 'text.secondary' : 'text.primary',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: { xs: '0.78rem', sm: '0.92rem' },
            lineHeight: 1.3,
            mb: product.netQuantity ? 0.25 : 0.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: { xs: 32, sm: 38 },
            '&:hover': { color: isOutOfStock ? 'text.secondary' : '#FF7900' },
          }}
        >
          {product.name}
        </Typography>

        {product.netQuantity && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontWeight: 700,
              fontSize: { xs: '0.66rem', sm: '0.74rem' },
              mb: 0.4,
              display: 'block',
            }}
          >
            Net Qty: {product.netQuantity}
          </Typography>
        )}

        {/* 4-Tier Pricing Showcase */}
        <Box sx={{ mt: 'auto', pt: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography
              variant="h6"
              fontWeight={900}
              sx={{
                color: isOutOfStock ? '#94a3b8' : (isDeal ? '#D92D20' : 'text.primary'),
                fontSize: { xs: '0.92rem', sm: '1.2rem' },
                letterSpacing: '-0.02em',
              }}
            >
              ₹{(applicablePrice / 100).toLocaleString('en-IN')}
            </Typography>

            {hasDiscount && (
              <Typography
                variant="body2"
                sx={{
                  color: '#94a3b8',
                  textDecoration: 'line-through',
                  fontSize: { xs: '0.7rem', sm: '0.82rem' },
                  fontWeight: 500,
                }}
              >
                ₹{(mrp / 100).toLocaleString('en-IN')}
              </Typography>
            )}
          </Box>

          {hasDiscount && (
            <Typography
              variant="caption"
              sx={{
                color: isOutOfStock ? '#94a3b8' : '#10b981',
                fontWeight: 700,
                fontSize: { xs: '0.62rem', sm: '0.72rem' },
                display: 'block',
                mt: 0.2,
              }}
            >
              Save ₹{((mrp - applicablePrice) / 100).toLocaleString('en-IN')}
            </Typography>
          )}
        </Box>

        {/* Fast Add to Cart Button */}
        <Button
          variant="contained"
          fullWidth
          size="small"
          disabled={isOutOfStock}
          onClick={handleAddToCart}
          startIcon={isOutOfStock ? <OutOfStockIcon sx={{ fontSize: '0.9rem' }} /> : (addedAnim ? <CheckIcon sx={{ fontSize: '0.9rem' }} /> : <CartIcon sx={{ fontSize: '0.9rem' }} />)}
          sx={{
            mt: { xs: 1, sm: 1.5 },
            py: { xs: 0.6, sm: 0.85 },
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: { xs: '0.72rem', sm: '0.82rem' },
            bgcolor: isOutOfStock ? '#f1f5f9 !important' : (addedAnim ? '#16a34a' : '#FF7900'),
            color: isOutOfStock ? '#94a3b8 !important' : 'white',
            border: isOutOfStock ? '1px solid #e2e8f0' : 'none',
            boxShadow: 'none',
            cursor: isOutOfStock ? 'not-allowed' : 'pointer',
            '&:hover': {
              bgcolor: isOutOfStock ? '#f1f5f9 !important' : (addedAnim ? '#15803d' : '#E85D04'),
              boxShadow: isOutOfStock ? 'none' : '0 4px 12px rgba(255, 121, 0, 0.25)',
            },
          }}
        >
          {isOutOfStock ? 'Out of Stock' : (addedAnim ? 'Added to Bag' : 'Add to Cart')}
        </Button>
      </CardContent>
    </Card>
  );
}
