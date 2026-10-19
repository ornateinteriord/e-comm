import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import {
  Box, Container, Grid, Typography, Button, TextField, MenuItem,
  FormControl, Select, Slider, FormControlLabel, Checkbox, Pagination,
  CircularProgress, Paper, Divider, Stack, Drawer, IconButton,
  useMediaQuery, useTheme, Chip,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Close as CloseIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import type { SearchResult } from '@ornate/types';

export default function SearchPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [searchParams, setSearchParams] = useSearchParams();

  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const sortParam = searchParams.get('sort') || 'newest';
  const pageParam = Number(searchParams.get('page') || 1);

  const [q, setQ] = useState(queryParam);
  const [category, setCategory] = useState(categoryParam);
  const [sort, setSort] = useState(sortParam);
  const [page, setPage] = useState(pageParam);
  const [inStock, setInStock] = useState(false);
  const [priceRange, setPriceRange] = useState<number[]>([0, 150000]); // in rupees
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  useEffect(() => {
    setQ(queryParam);
  }, [queryParam]);

  const { data: searchData, isLoading } = useQuery<SearchResult>({
    queryKey: ['search-products', queryParam, categoryParam, sortParam, page, inStock, priceRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryParam) params.set('q', queryParam);
      if (categoryParam) params.set('category', categoryParam);
      if (sortParam) params.set('sort', sortParam);
      params.set('page', String(page));
      params.set('limit', '12');
      if (inStock) params.set('inStock', 'true');
      if (priceRange[0] > 0) params.set('minPrice', String(priceRange[0] * 100));
      if (priceRange[1] < 150000) params.set('maxPrice', String(priceRange[1] * 100));

      const { data } = await api.get(`/search?${params.toString()}`);
      return data.data as SearchResult;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['all-categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data as Array<{ id: string; name: string; slug: string }>;
    },
  });

  const applyFilters = () => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (category) next.set('category', category);
    if (sort) next.set('sort', sort);
    next.set('page', '1');
    setSearchParams(next);
    setPage(1);
    setMobileFilterOpen(false);
  };

  const handleClearFilters = () => {
    setQ('');
    setCategory('');
    setSort('newest');
    setInStock(false);
    setPriceRange([0, 150000]);
    setSearchParams(new URLSearchParams());
    setPage(1);
    setMobileFilterOpen(false);
  };

  const filterSidebarContent = (
    <Box sx={{ p: { xs: 2.5, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterIcon sx={{ color: '#4f46e5' }} />
          <Typography variant="subtitle1" fontWeight={800}>Filter Catalog</Typography>
        </Box>
        {isMobile && (
          <IconButton size="small" onClick={() => setMobileFilterOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Divider sx={{ mb: 3 }} />

      {/* Keywords */}
      <Typography variant="caption" fontWeight={800} color="text.secondary" textTransform="uppercase" sx={{ mb: 1, display: 'block' }}>
        Keyword
      </Typography>
      <TextField
        fullWidth
        size="small"
        placeholder="Product, brand, or SKU…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 3 }}
      />

      {/* Category */}
      <Typography variant="caption" fontWeight={800} color="text.secondary" textTransform="uppercase" sx={{ mb: 1, display: 'block' }}>
        Department
      </Typography>
      <FormControl fullWidth size="small" sx={{ mb: 3 }}>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          displayEmpty
          sx={{ borderRadius: 2 }}
        >
          <MenuItem value="">All Departments</MenuItem>
          {categories?.map((cat) => (
            <MenuItem key={cat.id} value={cat.slug}>{cat.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Price Range */}
      <Typography variant="caption" fontWeight={800} color="text.secondary" textTransform="uppercase" sx={{ mb: 1, display: 'block' }}>
        Max Price: ₹{priceRange[1].toLocaleString('en-IN')}
      </Typography>
      <Slider
        value={priceRange[1]}
        onChange={(_, v) => setPriceRange([priceRange[0], v as number])}
        min={1000}
        max={150000}
        step={2000}
        sx={{ color: '#4f46e5', mb: 2 }}
      />

      {/* In Stock */}
      <FormControlLabel
        control={<Checkbox checked={inStock} onChange={(e) => setInStock(e.target.checked)} sx={{ color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }} />}
        label={<Typography variant="body2" fontWeight={600}>In Stock Only</Typography>}
        sx={{ mb: 3 }}
      />

      {/* Action Buttons */}
      <Stack spacing={1.5}>
        <Button
          variant="contained"
          fullWidth
          onClick={applyFilters}
          sx={{ bgcolor: '#0f172a', fontWeight: 700, borderRadius: 1, py: 1.2, '&:hover': { bgcolor: '#1e293b' } }}
        >
          Apply Filters
        </Button>
        <Button
          variant="text"
          fullWidth
          onClick={handleClearFilters}
          sx={{ color: '#64748b', fontWeight: 700 }}
        >
          Reset All
        </Button>
      </Stack>
    </Box>
  );

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, pb: { xs: 12, md: 8 } }}>
      {/* Search Header Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} letterSpacing="-0.03em" sx={{ fontSize: { xs: '1.6rem', md: '2.25rem' } }}>
            {queryParam ? `Results for "${queryParam}"` : 'Browse Flagship Catalog'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {searchData?.total ?? 0} authentic verified products found
          </Typography>
        </Box>

        {/* Sort & Mobile Filter Trigger */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          {isMobile && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<TuneIcon />}
              onClick={() => setMobileFilterOpen(true)}
              sx={{ borderColor: '#cbd5e1', color: '#0f172a', fontWeight: 700, borderRadius: 1 }}
            >
              Filters
            </Button>
          )}

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                const next = new URLSearchParams(searchParams);
                next.set('sort', e.target.value);
                setSearchParams(next);
              }}
              sx={{ borderRadius: 1, fontWeight: 700, fontSize: '0.85rem' }}
            >
              <MenuItem value="newest">Newest First</MenuItem>
              <MenuItem value="price_asc">Price: Low to High</MenuItem>
              <MenuItem value="price_desc">Price: High to Low</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Box>

      {/* Main Grid */}
      <Grid container spacing={{ xs: 2, md: 4 }}>
        {/* Desktop Sidebar */}
        {!isMobile && (
          <Grid item xs={12} md={3.2}>
            <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 4, bgcolor: 'background.paper', position: 'sticky', top: 90 }}>
              {filterSidebarContent}
            </Paper>
          </Grid>
        )}

        {/* Product Grid */}
        <Grid item xs={12} md={isMobile ? 12 : 8.8}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
              <CircularProgress />
            </Box>
          ) : !searchData?.products?.length ? (
            <Box sx={{ py: 10, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 4, border: '1px solid #e2e8f0', p: 4 }}>
              <Typography variant="h6" fontWeight={800}>No matching products found</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                Try relaxing your price filters or searching with different keywords.
              </Typography>
              <Button variant="outlined" onClick={handleClearFilters} sx={{ borderRadius: 2, fontWeight: 700 }}>
                Clear All Filters
              </Button>
            </Box>
          ) : (
            <Box>
              <Grid container spacing={{ xs: 2, sm: 2.5 }}>
                {searchData.products.map((product) => (
                  <Grid item xs={6} sm={6} md={4} key={product.id}>
                    <ProductCard product={product} />
                  </Grid>
                ))}
              </Grid>

              {/* Pagination */}
              {searchData.totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
                  <Pagination
                    count={searchData.totalPages}
                    page={page}
                    onChange={(_, val) => {
                      setPage(val);
                      const next = new URLSearchParams(searchParams);
                      next.set('page', String(val));
                      setSearchParams(next);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    color="primary"
                    shape="rounded"
                  />
                </Box>
              )}
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Mobile Filters Drawer */}
      <Drawer
        anchor="bottom"
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '85vh',
          },
        }}
      >
        {filterSidebarContent}
      </Drawer>
    </Container>
  );
}
