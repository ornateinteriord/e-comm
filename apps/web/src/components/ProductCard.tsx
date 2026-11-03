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

  const handleAddToCart = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    addItem({
      productId: product.id,
      variantId: null,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.images?.[0]?.url,
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

  const primaryImage = product.images?.[0]?.url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80';

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

        {/* Center Out of Stock Banner over Image */}
        {isOutOfStock && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(2px)',
              zIndex: 1,
            }}
          >
            <Chip
              label="OUT OF STOCK"
              sx={{
                bgcolor: 'rgba(15, 23, 42, 0.9)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: { xs: '0.72rem', sm: '0.8rem' },
                letterSpacing: '0.06em',
                py: 0.5,
                px: 1,
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
              }}
            />
          </Box>
        )}

        {/* Badges Overlay */}
        <Stack
          direction="column"
          spacing={0.75}
          sx={{
            position: 'absolute',
            top: { xs: 8, sm: 12 },
            left: { xs: 8, sm: 12 },
            zIndex: 2,
          }}
        >
          {isOutOfStock ? (
            <Chip
              label="OUT OF STOCK"
              size="small"
              sx={{
                bgcolor: '#dc2626',
                color: 'white',
                fontWeight: 800,
                fontSize: { xs: '0.65rem', sm: '0.72rem' },
                height: { xs: 20, sm: 24 },
                borderRadius: 1,
                letterSpacing: '0.02em',
              }}
            />
          ) : (
            <>
              {hasDiscount && (
                <Chip
                  label={`${savingsPercent}% OFF`}
                  size="small"
                  sx={{
                    bgcolor: '#D92D20', // Discount label #D92D20
                    color: 'white',
                    fontWeight: 800,
                    fontSize: { xs: '0.65rem', sm: '0.72rem' },
                    height: { xs: 20, sm: 24 },
                    borderRadius: 1,
                  }}
                />
              )}

              {isDeal && (
                <Chip
                  label="SPECIAL DEAL"
                  size="small"
                  sx={{
                    bgcolor: '#FF7900',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.65rem',
                    height: 20,
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
                    fontSize: '0.65rem',
                    height: 20,
                  }}
                />
              )}
            </>
          )}
        </Stack>

        {/* Wishlist Button */}
        <IconButton
          size="small"
          onClick={handleToggleWishlist}
          sx={{
            position: 'absolute',
            top: { xs: 8, sm: 12 },
            right: { xs: 8, sm: 12 },
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(8px)',
            color: isWishlisted ? '#f43f5e' : '#64748b',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            '&:hover': {
              bgcolor: 'white',
              color: '#f43f5e',
              transform: 'scale(1.1)',
            },
            transition: 'all 0.2s',
            zIndex: 2,
          }}
        >
          {isWishlisted ? <FavoriteFilledIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Product Content Details */}
      <CardContent
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2.5 },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Brand Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography
            variant="caption"
            sx={{
              color: '#FF7900',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontSize: { xs: '0.65rem', sm: '0.72rem' },
            }}
          >
            {product.brand || product.categoryName || 'FLAGSHIP'}
          </Typography>

          <Typography
            variant="caption"
            sx={{
              fontSize: '0.72rem',
              fontWeight: 800,
              color: isOutOfStock ? '#dc2626' : '#16a34a',
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
            fontSize: { xs: '0.85rem', sm: '0.95rem' },
            lineHeight: 1.35,
            mb: 1,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: { xs: 36, sm: 42 },
            '&:hover': { color: isOutOfStock ? 'text.secondary' : '#FF7900' },
          }}
        >
          {product.name}
        </Typography>

        {/* 4-Tier Pricing Showcase */}
        <Box sx={{ mt: 'auto', pt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              variant="h6"
              fontWeight={900}
              sx={{
                color: isOutOfStock ? '#94a3b8' : (isDeal ? '#D92D20' : 'text.primary'),
                fontSize: { xs: '1rem', sm: '1.25rem' },
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
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
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
                display: 'block',
                mt: 0.25,
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
          startIcon={isOutOfStock ? <OutOfStockIcon fontSize="small" /> : (addedAnim ? <CheckIcon fontSize="small" /> : <CartIcon fontSize="small" />)}
          sx={{
            mt: 2,
            py: { xs: 0.85, sm: 1 },
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: { xs: '0.75rem', sm: '0.85rem' },
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
