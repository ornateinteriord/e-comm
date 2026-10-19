import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import {
  Box, Container, Typography, Grid, Card, CardContent, CardMedia,
  Button, CircularProgress, IconButton, Paper,
} from '@mui/material';
import {
  ShoppingCart as CartIcon,
  DeleteOutline as DeleteIcon,
  FavoriteBorder as WishlistEmptyIcon,
} from '@mui/icons-material';
import api from '../api/client';
import { useCartStore } from '../store/cart.store';
import type { PublicProduct } from '@ornate/types';

export default function WishlistPage() {
  const queryClient = useQueryClient();
  const addItem = useCartStore((s) => s.addItem);

  const { data: productIds, isLoading } = useQuery<string[]>({
    queryKey: ['wishlist-ids'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/wishlist');
        return data.data;
      } catch {
        return [];
      }
    },
  });

  const { data: products } = useQuery<PublicProduct[]>({
    queryKey: ['wishlist-products', productIds],
    queryFn: async () => {
      if (!productIds || productIds.length === 0) return [];
      const { data } = await api.get(`/products?limit=50`);
      const all = data.data.items as PublicProduct[];
      return all.filter((p) => productIds.includes(p.id));
    },
    enabled: Boolean(productIds && productIds.length > 0),
  });

  const removeMutation = useMutation({
    mutationFn: async (productId: string) => {
      await api.delete(`/wishlist/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-ids'] });
    },
  });

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em" sx={{ mb: 4 }}>
        My Wishlist ({products?.length || 0})
      </Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress />
        </Box>
      ) : !products || products.length === 0 ? (
        <Paper elevation={0} sx={{ p: 8, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
          <WishlistEmptyIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Your wishlist is empty</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Save items that you like and want to buy later.
          </Typography>
          <Button variant="contained" component={RouterLink} to="/search" sx={{ borderRadius: 2, fontWeight: 700 }}>
            Discover Products
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {products.map((product) => {
            const applicablePrice = product.pricing?.applicablePrice ?? product.pricing?.sellingPrice ?? 0;
            const mrp = product.pricing?.mrp ?? applicablePrice;

            return (
              <Grid item xs={12} sm={6} md={3} key={product.id}>
                <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ position: 'relative', pt: '80%', bgcolor: '#f8fafc' }}>
                    <CardMedia
                      component="img"
                      image={product.images?.[0]?.url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80'}
                      alt={product.name}
                      sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <IconButton
                      size="small"
                      color="error"
                      sx={{ position: 'absolute', top: 12, right: 12, bgcolor: 'white' }}
                      onClick={() => removeMutation.mutate(product.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <CardContent sx={{ p: 2 }}>
                    <Typography
                      component={RouterLink}
                      to={`/products/${product.slug}`}
                      variant="subtitle2"
                      fontWeight={700}
                      noWrap
                      sx={{ textDecoration: 'none', color: 'text.primary', display: 'block' }}
                    >
                      {product.name}
                    </Typography>

                    <Typography variant="subtitle1" fontWeight={800} sx={{ my: 1 }}>
                      ₹{(applicablePrice / 100).toFixed(0)}
                    </Typography>

                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<CartIcon />}
                      size="small"
                      sx={{ borderRadius: 2, fontWeight: 700 }}
                      onClick={() => {
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
                        removeMutation.mutate(product.id);
                      }}
                    >
                      Move to Cart
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Container>
  );
}
