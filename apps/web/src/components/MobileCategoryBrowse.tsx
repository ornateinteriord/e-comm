import { useState, useRef, useCallback } from 'react';
import {
  Box, Typography, CircularProgress, Grid, Skeleton, useTheme,
} from '@mui/material';
import {
  Category as CategoryIcon,
  GridView as GridViewIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import ProductCard from './ProductCard';
import type { PublicProduct } from '@ornate/types';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  icon?: string;
}

interface MobileCategoryBrowseProps {
  /** If provided, the panel scrolls/resets to show this slug on mount */
  initialSlug?: string;
}

// Map category name → emoji icon fallback
function getCategoryEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('phone') || n.includes('mobile')) return '📱';
  if (n.includes('laptop') || n.includes('computer')) return '💻';
  if (n.includes('watch') || n.includes('wrist')) return '⌚';
  if (n.includes('cloth') || n.includes('fashion') || n.includes('apparel') || n.includes('wear')) return '👗';
  if (n.includes('shoe') || n.includes('footwear') || n.includes('sneaker')) return '👟';
  if (n.includes('bag') || n.includes('handbag') || n.includes('purse')) return '👜';
  if (n.includes('toy') || n.includes('game') || n.includes('gaming')) return '🎮';
  if (n.includes('book') || n.includes('stationery')) return '📚';
  if (n.includes('beauty') || n.includes('cosmetic') || n.includes('makeup')) return '💄';
  if (n.includes('food') || n.includes('grocery') || n.includes('kitchen')) return '🛒';
  if (n.includes('sport') || n.includes('fitness') || n.includes('gym')) return '🏋️';
  if (n.includes('home') || n.includes('furniture') || n.includes('decor')) return '🛋️';
  if (n.includes('electric') || n.includes('appliance')) return '⚡';
  if (n.includes('health') || n.includes('medical') || n.includes('pharma')) return '💊';
  if (n.includes('jewel') || n.includes('gold') || n.includes('silver')) return '💍';
  if (n.includes('pet')) return '🐾';
  if (n.includes('camera') || n.includes('photo')) return '📷';
  if (n.includes('music') || n.includes('audio') || n.includes('headphone')) return '🎵';
  if (n.includes('travel') || n.includes('luggage')) return '🧳';
  if (n.includes('baby') || n.includes('infant') || n.includes('kid')) return '🍼';
  if (n.includes('garden') || n.includes('plant') || n.includes('outdoor')) return '🌿';
  if (n.includes('tool') || n.includes('hardware')) return '🔧';
  if (n.includes('car') || n.includes('auto') || n.includes('vehicle')) return '🚗';
  return '🛍️';
}

export default function MobileCategoryBrowse({ initialSlug }: MobileCategoryBrowseProps) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // ── Fetch categories ───────────────────────────────────────────────────────
  const { data: categories = [], isLoading: catsLoading } = useQuery<Category[]>({
    queryKey: ['categories-mobile-browse'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data as Category[];
    },
    staleTime: 1000 * 60 * 10,
  });

  // ── Fetch products for selected category ──────────────────────────────────
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['mobile-category-products', selectedSlug],
    queryFn: async () => {
      const url = selectedSlug
        ? `/search?category=${selectedSlug}&limit=40`
        : `/search?limit=40`;
      const { data } = await api.get(url);
      return data.data as { products: PublicProduct[]; total: number };
    },
    staleTime: 1000 * 60 * 2,
  });

  const products = productsData?.products ?? [];

  // ── Handle category selection ──────────────────────────────────────────────
  const handleSelectCategory = useCallback((slug: string | null) => {
    setSelectedSlug(slug);
    // Scroll right panel back to top on category change
    if (rightPanelRef.current) {
      rightPanelRef.current.scrollTop = 0;
    }
  }, []);

  // ── Colours ────────────────────────────────────────────────────────────────
  const bgLeft  = isLight ? '#F8FAFC' : '#0F172A';
  const bgRight = isLight ? '#FFFFFF' : '#111827';
  const activeBg   = isLight ? 'rgba(255,121,0,0.12)' : 'rgba(255,121,0,0.18)';
  const hoverBg    = isLight ? 'rgba(0,0,0,0.04)'     : 'rgba(255,255,255,0.05)';
  const borderColor = isLight ? '#E5E7EB'              : 'rgba(255,255,255,0.08)';
  const textPrimary = isLight ? '#172B30'              : '#F8FAFC';
  const textSecondary = isLight ? '#64748B'            : '#94A3B8';

  // ── LEFT sidebar item ─────────────────────────────────────────────────────
  const SidebarItem = ({ cat, isActive }: { cat: Category | null; isActive: boolean }) => {
    const name = cat?.name ?? 'All';
    const emoji = cat ? getCategoryEmoji(name) : '🏠';

    return (
      <Box
        onClick={() => handleSelectCategory(cat ? cat.slug : null)}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 1.25,
          px: 0.5,
          mx: 0.5,
          my: 0.25,
          borderRadius: '10px',
          cursor: 'pointer',
          bgcolor: isActive ? activeBg : 'transparent',
          borderLeft: isActive ? `3px solid #FF7900` : '3px solid transparent',
          transition: 'all 0.15s ease',
          '&:hover': {
            bgcolor: isActive ? activeBg : hoverBg,
          },
          minHeight: 64,
          position: 'relative',
        }}
      >
        {/* Category image or emoji */}
        {cat?.image ? (
          <Box
            component="img"
            src={cat.image}
            alt={name}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
            sx={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              objectFit: 'cover',
              mb: 0.5,
              border: isActive ? `2px solid #FF7900` : `2px solid transparent`,
              transition: 'border-color 0.15s',
            }}
          />
        ) : (
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              bgcolor: isActive ? 'rgba(255,121,0,0.15)' : (isLight ? '#E5E7EB' : '#1E293B'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 0.5,
              fontSize: '1.3rem',
              lineHeight: 1,
              border: isActive ? `2px solid #FF7900` : `2px solid transparent`,
              transition: 'all 0.15s',
            }}
          >
            {emoji}
          </Box>
        )}

        {/* Category label — truncated, hidden if too narrow via CSS */}
        <Typography
          sx={{
            fontSize: '0.6rem',
            fontWeight: isActive ? 800 : 600,
            color: isActive ? '#FF7900' : textSecondary,
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            px: 0.25,
            // Hide text on very narrow screens; show on slightly wider ones
            display: { xs: 'none', sm: 'block' },
          }}
        >
          {name}
        </Typography>
      </Box>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        bgcolor: bgRight,
      }}
    >
      {/* ════════════════════════ LEFT SIDEBAR ════════════════════════ */}
      <Box
        sx={{
          width: 72,
          flexShrink: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          bgcolor: bgLeft,
          borderRight: `1px solid ${borderColor}`,
          '&::-webkit-scrollbar': { width: 2 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#FF7900', borderRadius: 4 },
          // Keep this column fixed while right panel scrolls
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          maxHeight: '100%',
          // On XS (phones < 400px wide) shrink to icons-only width
          '@media (max-width: 380px)': { width: 56 },
        }}
      >
        {/* "All" pseudo-category at top */}
        <SidebarItem cat={null} isActive={selectedSlug === null} />

        {/* Divider */}
        <Box sx={{ mx: 1, my: 0.5, height: 1, bgcolor: borderColor }} />

        {/* Real categories */}
        {catsLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Box key={i} sx={{ px: 1, py: 0.75 }}>
                <Skeleton variant="rounded" width={40} height={40} sx={{ mx: 'auto', mb: 0.5, borderRadius: '8px' }} />
                <Skeleton variant="text" width="80%" sx={{ mx: 'auto', fontSize: '0.6rem', display: { xs: 'none', sm: 'block' } }} />
              </Box>
            ))
          : categories.map((cat) => (
              <SidebarItem key={cat.id} cat={cat} isActive={selectedSlug === cat.slug} />
            ))}
      </Box>

      {/* ════════════════════════ RIGHT PRODUCT PANEL ════════════════════════ */}
      <Box
        ref={rightPanelRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          bgcolor: bgRight,
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#FF7900', borderRadius: 4 },
        }}
      >
        {/* Panel header */}
        <Box
          sx={{
            px: 1.5,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: `1px solid ${borderColor}`,
            bgcolor: isLight ? '#FAFBFC' : '#0F172A',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          {selectedSlug ? (
            <CategoryIcon sx={{ fontSize: 16, color: '#FF7900' }} />
          ) : (
            <GridViewIcon sx={{ fontSize: 16, color: '#FF7900' }} />
          )}
          <Typography
            sx={{
              fontSize: '0.78rem',
              fontWeight: 800,
              color: textPrimary,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {selectedSlug
              ? (categories.find((c) => c.slug === selectedSlug)?.name ?? selectedSlug)
              : 'All Products'}
          </Typography>
          {!productsLoading && (
            <Typography sx={{ fontSize: '0.65rem', color: textSecondary, fontWeight: 600, flexShrink: 0 }}>
              {products.length} items
            </Typography>
          )}
        </Box>

        {/* Product grid */}
        <Box sx={{ p: 1 }}>
          {productsLoading ? (
            <Grid container spacing={1}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Grid item xs={6} key={i}>
                  <Skeleton variant="rounded" width="100%" sx={{ aspectRatio: '3/4', borderRadius: '10px' }} />
                </Grid>
              ))}
            </Grid>
          ) : products.length === 0 ? (
            <Box
              sx={{
                py: 8,
                px: 2,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography sx={{ fontSize: '2.5rem' }}>🛒</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: textPrimary }}>
                No products here yet
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: textSecondary }}>
                Check back soon or try another category
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={1}>
              {products.map((product) => (
                <Grid item xs={6} key={product.id}>
                  <ProductCard product={product} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Box>
    </Box>
  );
}
