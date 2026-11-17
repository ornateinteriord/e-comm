import { Link as RouterLink } from "react-router";
import { Box, Typography, Chip, Skeleton } from "@mui/material";
import { ArrowForward as ArrowForwardIcon, LocalOffer as LocalOfferIcon } from "@mui/icons-material";
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

function SectionHeading({ title, to }: { title: string; to?: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 2,
        mb: 1.25,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <LocalOfferIcon sx={{ fontSize: 18, color: ORANGE }} />
        <Typography sx={{ fontWeight: 900, fontSize: "1rem", letterSpacing: "-0.01em" }}>
          {title}
        </Typography>
      </Box>
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
            fontSize: "0.78rem",
            textDecoration: "none",
          }}
        >
          See all
          <ArrowForwardIcon sx={{ fontSize: 15 }} />
        </Box>
      )}
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
        flex: "0 0 86%",
        scrollSnapAlign: "start",
        aspectRatio: "16 / 10",
        borderRadius: "10px",
        overflow: "hidden",
        display: "block",
        textDecoration: "none",
        bgcolor: "#F5F6F7",
        boxShadow: "0 6px 18px -10px rgba(23, 43, 48, 0.35)",
      }}
    >
      <Box
        component="img"
        src={imageOf(product)}
        alt={product.name}
        loading="lazy"
        sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
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

      <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, p: 1.75 }}>
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
            fontSize: "1rem",
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
          <Typography sx={{ color: "#FFFFFF", fontWeight: 900, fontSize: "1.05rem" }}>
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
  const banners = products.slice(0, 5);
  const deals = products.slice(0, 6);

  return (
    <Box
      sx={{
        display: { xs: "block", md: "none" },
        py: 2,
        bgcolor: "background.default",
        borderBottom: (theme) =>
          `1px solid ${theme.palette.mode === "light" ? "#E5E7EB" : "rgba(255, 255, 255, 0.08)"}`,
      }}
    >
      <SectionHeading title="Today's Deals" to="/search" />

      {isLoading ? (
        <Box sx={{ display: "flex", gap: 1.5, px: 2, overflow: "hidden" }}>
          {[0, 1].map((i) => (
            <Skeleton
              key={i}
              variant="rounded"
              animation="wave"
              sx={{ flex: "0 0 86%", aspectRatio: "16 / 10", borderRadius: "10px" }}
            />
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            display: "flex",
            gap: 1.5,
            px: 2,
            pb: 1,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {banners.map((product) => (
            <PromoBanner key={product.id} product={product} />
          ))}
        </Box>
      )}

      {(isLoading || deals.length > 0) && (
        <Box sx={{ px: 2, mt: 2 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1.25,
            }}
          >
            <Typography sx={{ fontWeight: 900, fontSize: "1rem", letterSpacing: "-0.01em" }}>
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
                fontSize: "0.78rem",
                textDecoration: "none",
              }}
            >
              View all
              <ArrowForwardIcon sx={{ fontSize: 15 }} />
            </Box>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            {isLoading
              ? [0, 1, 2, 3].map((i) => (
                  <Skeleton
                    key={i}
                    variant="rounded"
                    animation="wave"
                    sx={{ height: 260, borderRadius: "8px" }}
                  />
                ))
              : deals.map((product) => <ProductCard key={product.id} product={product} />)}
          </Box>
        </Box>
      )}
    </Box>
  );
}
