import { useState, useEffect } from 'react';
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


export default function CategoryPage() {
  const { slug } = useParams();
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const [selectedSubSlug, setSelectedSubSlug] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSubSlug(null);
  }, [slug]);

  const { data: categoryData } = useQuery({
    queryKey: ['category-detail', slug],
    queryFn: async () => {
      const { data } = await api.get(`/categories/${slug}`);
      return data.data as {
        id: string;
        name: string;
        slug: string;
        description?: string;
        subcategories?: Array<{ id: string; name: string; slug: string }>;
      };
    },
    enabled: Boolean(slug),
  });

  const activeCategorySlug = selectedSubSlug || slug;

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['category-products', activeCategorySlug],
    queryFn: async () => {
      const { data } = await api.get(`/search?category=${activeCategorySlug}&limit=24`);
      return data.data as { products: PublicProduct[]; total: number };
    },
    enabled: Boolean(activeCategorySlug),
  });

  const currentCategory = categoryData;

  const products = productsData?.products ?? [];

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
          mb: currentCategory?.subcategories?.length ? 2.5 : 4,
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

      {/* Subcategory Filter Pills */}
      {currentCategory?.subcategories && currentCategory.subcategories.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
          <Chip
            label={`All ${currentCategory.name}`}
            clickable
            onClick={() => setSelectedSubSlug(null)}
            sx={{
              fontWeight: 700,
              bgcolor: selectedSubSlug === null ? '#FF7900' : (isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)'),
              color: selectedSubSlug === null ? '#FFFFFF' : 'text.primary',
              '&:hover': { bgcolor: selectedSubSlug === null ? '#E85D04' : (isLight ? '#E2E8F0' : 'rgba(255,255,255,0.14)') },
            }}
          />
          {currentCategory.subcategories.map((sub) => {
            const active = selectedSubSlug === sub.slug;
            return (
              <Chip
                key={sub.id}
                label={sub.name}
                clickable
                onClick={() => setSelectedSubSlug(sub.slug)}
                sx={{
                  fontWeight: 700,
                  bgcolor: active ? '#FF7900' : (isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)'),
                  color: active ? '#FFFFFF' : 'text.primary',
                  '&:hover': { bgcolor: active ? '#E85D04' : (isLight ? '#E2E8F0' : 'rgba(255,255,255,0.14)') },
                }}
              />
            );
          })}
        </Stack>
      )}

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
