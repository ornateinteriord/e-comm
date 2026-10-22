import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router';
import {
  Box, Container, Typography, Button, Grid, Chip,
  CircularProgress, Stack, Paper, Avatar, useTheme,
} from '@mui/material';
import {
  LocalShipping as ShippingIcon,
  Security as SecurityIcon,
  Autorenew as ReturnIcon,
  Headphones as SupportIcon,
  ArrowForward as ArrowForwardIcon,
  ElectricBolt as BoltIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import type { PublicProduct } from '@ornate/types';
import { DUMMY_PRODUCTS, DUMMY_CATEGORIES } from '../data/dummyData';

export default function HomePage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['featured-products'],
    queryFn: async () => {
      const { data } = await api.get('/products?limit=12');
      return data.data as { items: PublicProduct[]; total: number };
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories-list'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data as Array<{ id: string; name: string; slug: string; description?: string }>;
    },
  });

  const finalProducts = productsData?.items && productsData.items.length > 0 ? productsData.items : DUMMY_PRODUCTS;
  const finalCategories = categories && categories.length > 0 ? categories : DUMMY_CATEGORIES;

  const dealProducts = finalProducts.filter((p) => p.pricing?.dealActive || (p.pricing?.savingsPercent ?? 0) > 15);
  const standardProducts = finalProducts;

  return (
    <Box sx={{ pb: { xs: 6, md: 10 } }}>
      {/* ---- Mobile Category Story Bar (Android/iOS App feel) ---- */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          overflowX: 'auto',
          py: 2,
          px: 2,
          gap: 2,
          bgcolor: 'background.paper',
          borderBottom: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.08)'}`,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {finalCategories?.map((cat) => (
          <Box
            key={cat.id}
            component={RouterLink}
            to={`/categories/${cat.slug}`}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textDecoration: 'none',
              color: 'text.primary',
              minWidth: 64,
            }}
          >
            <Avatar
              sx={{
                width: 52,
                height: 52,
                bgcolor: isLight ? '#F5F6F7' : '#1E293B',
                color: isLight ? '#172B30' : '#FFFFFF',
                fontSize: '1rem',
                fontWeight: 800,
                border: '2px solid #FF7900',
                boxShadow: '0 4px 10px rgba(255, 121, 0, 0.25)',
                mb: 0.75,
              }}
            >
              {cat.name.charAt(0)}
            </Avatar>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.7rem', textAlign: 'center', lineHeight: 1.2 }}>
              {cat.name.split(' ')[0]}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ---- Hero Stage ---- */}
      <Box
        sx={{
          bgcolor: isLight ? '#F5F6F7' : '#0B1120',
          color: isLight ? '#172B30' : 'white',
          pt: { xs: 5, md: 8 },
          pb: { xs: 6, md: 10 },
          borderBottom: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.08)'}`,
          transition: 'all 0.2s ease',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip
                  icon={<VerifiedIcon sx={{ fontSize: 15, color: '#FF7900 !important' }} />}
                  label="DIRECT-TO-CONSUMER"
                  size="small"
                  sx={{
                    bgcolor: isLight ? 'rgba(255, 121, 0, 0.08)' : 'rgba(255, 121, 0, 0.15)',
                    color: '#FF7900',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    borderRadius: 1,
                    border: '1px solid rgba(255, 121, 0, 0.3)',
                  }}
                />
                <Chip
                  label="PROMOTIONAL PRICING"
                  size="small"
                  sx={{
                    bgcolor: '#D92D20',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    borderRadius: 1,
                  }}
                />
              </Stack>

              <Typography
                variant="h1"
                sx={{
                  fontWeight: 900,
                  letterSpacing: '-0.035em',
                  fontSize: { xs: '2.2rem', sm: '3rem', md: '3.5rem' },
                  lineHeight: { xs: 1.15, md: 1.1 },
                  color: isLight ? '#172B30' : '#FFFFFF',
                  mb: 2.5,
                }}
              >
                Curated Flagship Goods. <br />
                Everyday Reliability.
              </Typography>

              <Typography
                variant="body1"
                sx={{
                  color: isLight ? '#374151' : '#94A3B8',
                  maxWidth: 540,
                  fontSize: { xs: '0.95rem', md: '1.05rem' },
                  lineHeight: 1.6,
                  mb: 3.5,
                }}
              >
                Direct access to genuine electronics, ergonomic workspaces, Japanese culinary cutlery, and everyday apparel. Real warehouse inventory, transparent GST pricing, and expedited delivery across India.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/search')}
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    bgcolor: '#FF7900',
                    px: 3.5,
                    py: 1.5,
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    borderRadius: 1,
                    color: '#FFFFFF',
                    '&:hover': { bgcolor: '#E85D04' },
                  }}
                >
                  Browse Products
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate('/categories/electronics')}
                  sx={{
                    borderColor: isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.25)',
                    color: isLight ? '#172B30' : '#FFFFFF',
                    px: 3,
                    py: 1.5,
                    borderRadius: 1,
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    '&:hover': {
                      borderColor: '#FF7900',
                      color: '#FF7900',
                      bgcolor: isLight ? 'rgba(255, 121, 0, 0.04)' : 'rgba(255, 121, 0, 0.1)',
                    },
                  }}
                >
                  Electronics & Audio
                </Button>
              </Stack>
            </Grid>

            {/* Desktop Hero Visual Showcase */}
            <Grid item xs={12} md={5} sx={{ display: { xs: 'none', md: 'block' } }}>
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: 420,
                  borderRadius: 5,
                  overflow: 'hidden',
                  boxShadow: isLight ? '0 20px 40px -15px rgba(23, 43, 48, 0.15)' : '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                  border: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.15)'}`,
                }}
              >
                <Box
                  component="img"
                  src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80"
                  alt="Sony WH-1000XM5 Flagship"
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                {/* Progressive Fading Blur & Gradient Backdrop */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '65%',
                    background: isLight
                      ? 'linear-gradient(to top, rgba(23, 43, 48, 0.95) 0%, rgba(23, 43, 48, 0.7) 40%, rgba(23, 43, 48, 0.25) 70%, transparent 100%)'
                      : 'linear-gradient(to top, rgba(11, 17, 32, 0.96) 0%, rgba(11, 17, 32, 0.75) 40%, rgba(11, 17, 32, 0.25) 70%, transparent 100%)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 35%, rgba(0,0,0,0.6) 65%, rgba(0,0,0,0.15) 85%, transparent 100%)',
                    maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 35%, rgba(0,0,0,0.6) 65%, rgba(0,0,0,0.15) 85%, transparent 100%)',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                />

                {/* Content Overlay */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    p: 3,
                    zIndex: 2,
                  }}
                >
                  <Chip label="SPOTLIGHT ITEM" size="small" sx={{ bgcolor: '#FF7900', color: 'white', fontWeight: 800, mb: 1 }} />
                  <Typography variant="h6" fontWeight={800} color="white">Sony WH-1000XM5 Active Noise Cancelling</Typography>
                  <Typography variant="body2" sx={{ color: '#E5E7EB' }}>Special Deal: ₹25,990 (Save ₹9,000)</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ---- Value Propositions ---- */}
      <Container maxWidth="lg" sx={{ mt: { xs: -3, md: -5 }, position: 'relative', zIndex: 10 }}>
        <Paper
          elevation={4}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: { xs: 3, md: 4 },
            bgcolor: 'background.paper',
            border: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.08)'}`,
            boxShadow: isLight ? '0 12px 30px -10px rgba(0, 0, 0, 0.06)' : '0 12px 30px -10px rgba(0, 0, 0, 0.5)',
          }}
        >
          <Grid container spacing={{ xs: 2, md: 4 }}>
            {[
              { icon: <ShippingIcon sx={{ fontSize: 28, color: '#FF7900' }} />, title: 'Free Express Shipping', desc: 'Complimentary on orders above ₹500' },
              { icon: <SecurityIcon sx={{ fontSize: 28, color: '#10B981' }} />, title: '100% Verified Originals', desc: 'Direct from authorized manufacturers' },
              { icon: <ReturnIcon sx={{ fontSize: 28, color: '#F59E0B' }} />, title: '7-Day Return Guarantee', desc: 'Doorstep pickup & instant replacement' },
              { icon: <SupportIcon sx={{ fontSize: 28, color: '#FF7900' }} />, title: '24/7 Concierge Support', desc: 'Dedicated priority customer desk' },
            ].map((prop, idx) => (
              <Grid item xs={12} sm={6} md={3} key={idx}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: isLight ? '#F5F6F7' : 'rgba(255, 255, 255, 0.05)' }}>{prop.icon}</Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.9rem', color: isLight ? '#172B30' : '#F8FAFC' }}>{prop.title}</Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.78rem', color: isLight ? '#374151' : '#94A3B8' }}>{prop.desc}</Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Container>

      {/* ---- Curated Collections (Desktop Grid) ---- */}
      <Container maxWidth="lg" sx={{ mt: { xs: 6, md: 10 }, display: { xs: 'none', md: 'block' } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 4 }}>
          <Box>
            <Typography variant="overline" sx={{ color: '#FF7900', fontWeight: 800, letterSpacing: '0.08em' }}>DEPARTMENTS</Typography>
            <Typography variant="h4" fontWeight={900} letterSpacing="-0.03em" sx={{ color: isLight ? '#172B30' : '#F8FAFC' }}>Browse by Category</Typography>
          </Box>
          <Button component={RouterLink} to="/search" endIcon={<ArrowForwardIcon />} sx={{ fontWeight: 800, color: '#FF7900' }}>
            View Full Directory
          </Button>
        </Box>

        <Grid container spacing={2.5}>
          {finalCategories?.map((cat) => (
            <Grid item xs={12} sm={6} md={2} key={cat.id}>
              <Paper
                component={RouterLink}
                to={`/categories/${cat.slug}`}
                elevation={0}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  textDecoration: 'none',
                  color: 'inherit',
                  borderRadius: 3.5,
                  bgcolor: 'background.paper',
                  border: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.08)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1.5,
                  transition: 'all 0.25s ease',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    borderColor: '#FF7900',
                    boxShadow: '0 16px 28px -8px rgba(255, 121, 0, 0.18)',
                    '& .cat-avatar': {
                      bgcolor: '#FF7900',
                      color: 'white',
                    },
                  },
                }}
              >
                <Avatar
                  className="cat-avatar"
                  sx={{
                    width: 58,
                    height: 58,
                    bgcolor: isLight ? '#F5F6F7' : '#1E293B',
                    color: isLight ? '#172B30' : '#FFFFFF',
                    fontWeight: 900,
                    fontSize: '1.25rem',
                    transition: 'all 0.2s',
                  }}
                >
                  {cat.name.charAt(0)}
                </Avatar>
                <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.85rem', color: isLight ? '#172B30' : '#F8FAFC' }}>
                  {cat.name}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ---- Flash Deals Section ---- */}
      {dealProducts.length > 0 && (
        <Container maxWidth="lg" sx={{ mt: { xs: 5, md: 10 } }}>
          <Box
            sx={{
              p: { xs: 2.5, md: 3.5 },
              borderRadius: 2,
              bgcolor: isLight ? '#172B30' : '#111827',
              border: `1px solid ${isLight ? 'transparent' : 'rgba(255, 255, 255, 0.08)'}`,
              color: 'white',
              mb: 3.5,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <BoltIcon sx={{ color: '#FF7900', fontSize: 20 }} />
                  <Typography variant="caption" fontWeight={800} sx={{ color: '#FFA04D', letterSpacing: '0.08em' }}>
                    PROMOTIONAL PRICING
                  </Typography>
                </Stack>
                <Typography variant="h5" fontWeight={800} letterSpacing="-0.02em">
                  Special Promotional Deals
                </Typography>
              </Box>
              <Chip
                label="Direct Manufacturer Discount"
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#FFFFFF', fontWeight: 600, borderRadius: 1 }}
              />
            </Box>
          </Box>

          <Grid container spacing={{ xs: 2, sm: 3 }}>
            {dealProducts.slice(0, 4).map((product) => (
              <Grid item xs={6} md={3} key={product.id}>
                <ProductCard product={product} />
              </Grid>
            ))}
          </Grid>
        </Container>
      )}

      {/* ---- All Featured Products Grid ---- */}
      <Container maxWidth="lg" sx={{ mt: { xs: 6, md: 10 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 3 }}>
          <Box>
            <Typography variant="overline" sx={{ color: '#FF7900', fontWeight: 800, letterSpacing: '0.08em' }}>CATALOG</Typography>
            <Typography variant="h4" fontWeight={900} letterSpacing="-0.03em" sx={{ color: isLight ? '#172B30' : '#F8FAFC' }}>Trending Products</Typography>
          </Box>
          <Button component={RouterLink} to="/search" endIcon={<ArrowForwardIcon />} sx={{ fontWeight: 800, color: '#FF7900' }}>
            View All ({productsData?.total ?? 0})
          </Button>
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress sx={{ color: '#FF7900' }} />
          </Box>
        ) : (
          <Grid container spacing={{ xs: 2, sm: 3 }}>
            {standardProducts.map((product) => (
              <Grid item xs={6} md={3} key={product.id}>
                <ProductCard product={product} />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
