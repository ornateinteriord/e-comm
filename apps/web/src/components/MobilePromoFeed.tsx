import { useRef } from "react";
import { Link as RouterLink } from "react-router";
import {
  Box,
  Typography,
  Chip,
  Skeleton,
  Container,
  IconButton,
  Stack,
} from "@mui/material";
import {
  ArrowForward as ArrowForwardIcon,
  LocalOffer as LocalOfferIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";
import type { PublicProduct } from "@ornate/types";
import ProductCard from "./ProductCard";

interface MobilePromoFeedProps {
  products: PublicProduct[];
  isLoading?: boolean;
}

const ORANGE = "#FF7900";
const RED = "#D92D20";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80";

const imageOf = (product: PublicProduct) => {
  if (product.images && product.images.length > 0) {
    const sorted = [...product.images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const url = sorted[0]?.url || product.images[0]?.url;
    if (url) return url;
  }
  return FALLBACK_IMAGE;
};

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

function SectionHeading({
  title,
  to,
  onScrollLeft,
  onScrollRight,
}: {
  title: string;
  to?: string;
  onScrollLeft?: () => void;
  onScrollRight?: () => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: { xs: 2, sm: 2, md: 0 },
        mb: { xs: 1.5, md: 2 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LocalOfferIcon sx={{ fontSize: { xs: 18, md: 22 }, color: ORANGE }} />
        <Typography
          sx={{
            fontWeight: 900,
            fontSize: { xs: "1rem", md: "1.25rem" },
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </Typography>
      </Box>

      <Stack direction="row" alignItems="center" spacing={1.5}>
        {onScrollLeft && onScrollRight && (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ display: { xs: "none", md: "flex" } }}
          >
            <IconButton
              size="small"
              onClick={onScrollLeft}
              aria-label="Scroll left"
              sx={{
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                p: 0.6,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={onScrollRight}
              aria-label="Scroll right"
              sx={{
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                p: 0.6,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}

        {to && (
          <Box
            component={RouterLink}
            to={to}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.25,
              color: ORANGE,
              fontWeight: 800,
              fontSize: { xs: "0.78rem", md: "0.85rem" },
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            See all
            <ArrowForwardIcon sx={{ fontSize: 16 }} />
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function PromoBanner({ product }: { product: PublicProduct }) {
  const price = product.pricing?.applicablePrice ?? 0;
  const mrp = product.pricing?.mrp ?? price;
  const savingsPercent = product.pricing?.savingsPercent ?? 0;

  return (
    <Box
      component={RouterLink}
      to={`/products/${product.slug}`}
      sx={{
        position: "relative",
        flex: {
          xs: "0 0 86%",
          sm: "0 0 46%",
          md: "0 0 31%",
          lg: "0 0 23.5%",
        },
        maxWidth: { xs: "none", sm: 340 },
        scrollSnapAlign: "start",
        aspectRatio: { xs: "16 / 10", sm: "16 / 10.5" },
        borderRadius: "10px",
        overflow: "hidden",
        display: "block",
        textDecoration: "none",
        bgcolor: "#F5F6F7",
        boxShadow: "0 6px 18px -10px rgba(23, 43, 48, 0.35)",
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 14px 28px -10px rgba(23, 43, 48, 0.45)",
          "& .promo-banner-img": {
            transform: "scale(1.05)",
          },
        },
      }}
    >
      <Box
        component="img"
        className="promo-banner-img"
        src={imageOf(product)}
        alt={product.name}
        loading="lazy"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transition: "transform 0.4s ease",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(15, 23, 42, 0.94) 0%, rgba(15, 23, 42, 0.55) 45%, rgba(15, 23, 42, 0.05) 100%)",
        }}
      />

      {savingsPercent > 0 && (
        <Chip
          label={`${savingsPercent}% OFF`}
          size="small"
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            bgcolor: RED,
            color: "#FFFFFF",
            fontWeight: 900,
            fontSize: "0.7rem",
            height: 22,
            borderRadius: 1,
          }}
        />
      )}

      <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, p: { xs: 1.75, md: 2 } }}>
        <Typography
          variant="caption"
          sx={{
            color: "#FFB066",
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontSize: "0.68rem",
          }}
        >
          {product.brand || product.categoryName || "Featured"}
        </Typography>
        <Typography
          sx={{
            color: "#FFFFFF",
            fontWeight: 800,
            fontSize: { xs: "0.95rem", md: "1.02rem" },
            lineHeight: 1.25,
            mt: 0.25,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {product.name}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 0.5 }}>
          <Typography sx={{ color: "#FFFFFF", fontWeight: 900, fontSize: { xs: "1.05rem", md: "1.1rem" } }}>
            {rupees(price)}
          </Typography>
          {mrp > price && (
            <Typography
              sx={{
                color: "rgba(255, 255, 255, 0.65)",
                fontSize: "0.78rem",
                textDecoration: "line-through",
              }}
            >
              {rupees(mrp)}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default function MobilePromoFeed({ products, isLoading }: MobilePromoFeedProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const banners = products.slice(0, 8);
  const deals = products.slice(0, 8);

  const handleScrollLeft = () => {
    if (railRef.current) {
      railRef.current.scrollBy({ left: -340, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (railRef.current) {
      railRef.current.scrollBy({ left: 340, behavior: "smooth" });
    }
  };

  return (
    <Box
      component="section"
      aria-label="Deals and Promotions"
      sx={{
        display: "block", // Visible on BOTH mobile and desktop!
        py: { xs: 2.5, md: 4 },
        bgcolor: "background.default",
        borderBottom: (theme) =>
          `1px solid ${theme.palette.mode === "light" ? "#E5E7EB" : "rgba(255, 255, 255, 0.08)"}`,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 0, sm: 2, md: 3 } }}>
        <SectionHeading
          title="Today's Deals"
          to="/search"
          onScrollLeft={handleScrollLeft}
          onScrollRight={handleScrollRight}
        />

        {isLoading ? (
          <Box
            sx={{
              display: "flex",
              gap: { xs: 1.5, md: 2 },
              px: { xs: 2, sm: 2, md: 0 },
              overflow: "hidden",
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                variant="rounded"
                animation="wave"
                sx={{
                  flex: {
                    xs: "0 0 86%",
                    sm: "0 0 46%",
                    md: "0 0 31%",
                    lg: "0 0 23.5%",
                  },
                  aspectRatio: "16 / 10",
                  borderRadius: "10px",
                }}
              />
            ))}
          </Box>
        ) : (
          <Box
            ref={railRef}
            sx={{
              display: "flex",
              gap: { xs: 1.5, md: 2 },
              px: { xs: 2, sm: 2, md: 0 },
              pb: 1,
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
              scrollBehavior: "smooth",
            }}
          >
            {banners.map((product) => (
              <PromoBanner key={product.id} product={product} />
            ))}
          </Box>
        )}

        {(isLoading || deals.length > 0) && (
          <Box sx={{ px: { xs: 2, sm: 2, md: 0 }, mt: { xs: 2.5, md: 4 } }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: { xs: 1.5, md: 2 },
              }}
            >
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "1rem", md: "1.25rem" },
                  letterSpacing: "-0.01em",
                }}
              >
                Promotional Pricing
              </Typography>
              <Box
                component={RouterLink}
                to="/search"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.25,
                  color: ORANGE,
                  fontWeight: 800,
                  fontSize: { xs: "0.78rem", md: "0.85rem" },
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                View all
                <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </Box>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, 1fr)",
                  sm: "repeat(3, 1fr)",
                  md: "repeat(4, 1fr)",
                },
                gap: { xs: 1.5, md: 2.5 },
              }}
            >
              {isLoading
                ? [0, 1, 2, 3].map((i) => (
                    <Skeleton
                      key={i}
                      variant="rounded"
                      animation="wave"
                      sx={{ height: 260, borderRadius: "8px" }}
                    />
                  ))
                : deals.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  );
}
