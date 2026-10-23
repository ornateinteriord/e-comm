import { useParams, Link as RouterLink } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Container, Typography, Breadcrumbs, Link, Grid,
  CircularProgress, Chip, Stack, useTheme,
} from '@mui/material';
import { NavigateNext as NextIcon } from '@mui/icons-material';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import type { PublicProduct } from '@ornate/types';
import { getDummyCategoryBySlug, getDummyProductsByCategory } from '../data/dummyData';

export default function CategoryPage() {
  const { slug } = useParams();
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  const { data: categoryData } = useQuery({
    queryKey: ['category-detail', slug],
    queryFn: async () => {
      const { data } = await api.get(`/categories/${slug}`);
      return data.data as { id: string; name: string; slug: string; description?: string };
    },
    enabled: Boolean(slug),
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['category-products', slug],
    queryFn: async () => {
      const { data } = await api.get(`/search?category=${slug}&limit=24`);
      return data.data as { products: PublicProduct[]; total: number };
    },
    enabled: Boolean(slug),
  });

  const fallbackCategory = slug ? getDummyCategoryBySlug(slug) : undefined;
  const currentCategory = categoryData || fallbackCategory;

  const fallbackProducts = slug ? getDummyProductsByCategory(slug) : [];
  const products = productsData?.products && productsData.products.length > 0
    ? productsData.products
    : fallbackProducts;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      {/* Breadcrumbs */}
      <Breadcrumbs separator={<NextIcon sx={{ fontSize: 14 }} />} sx={{ mb: 2.5 }}>
        <Link component={RouterLink} to="/" color="inherit" underline="hover" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
          Home
        </Link>
        <Link component={RouterLink} to="/search" color="inherit" underline="hover" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
          Departments
        </Link>
        <Typography color="text.primary" sx={{ fontSize: '0.85rem', fontWeight: 800 }}>
          {currentCategory?.name || slug}
        </Typography>
      </Breadcrumbs>

      {/* Header Banner */}
      <Box
        sx={{
          mb: 4,
          p: { xs: 3, md: 4 },
          borderRadius: '8px',
          bgcolor: isLight ? '#172B30' : '#111827',
          border: `1px solid ${isLight ? 'transparent' : 'rgba(255, 255, 255, 0.08)'}`,
          color: 'white',
          position: 'relative',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <Chip label="DEPARTMENT" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#FFFFFF', fontWeight: 700, fontSize: 11, borderRadius: '4px' }} />
          <Chip label={`${products.length} Products`} size="small" sx={{ bgcolor: '#FF7900', color: 'white', fontWeight: 700, fontSize: 11, borderRadius: '4px' }} />
        </Stack>

        <Typography variant="h3" fontWeight={900} letterSpacing="-0.03em" sx={{ fontSize: { xs: '1.8rem', md: '2.5rem' }, mb: 1, color: '#FFFFFF' }}>
          {currentCategory?.name || slug}
        </Typography>
        <Typography variant="body1" sx={{ color: '#E2E8F0', maxWidth: 600, fontSize: { xs: '0.9rem', md: '1rem' } }}>
          {currentCategory?.description || `Explore our curated selection of flagship ${currentCategory?.name || slug} with express shipping.`}
        </Typography>
      </Box>

      {/* Products Grid */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress sx={{ color: '#FF7900' }} />
        </Box>
      ) : products.length === 0 ? (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <Typography variant="h6" fontWeight={800}>No products found in this category.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Check back soon or browse other departments.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={{ xs: 2, sm: 3 }}>
          {products.map((product) => (
            <Grid item xs={6} md={3} key={product.id}>
              <ProductCard product={product} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
