import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useNavigate } from "react-router";
import {
  Box, Container, Typography, Button, Grid, Chip,
  CircularProgress, Stack, Paper, Avatar, useTheme,
} from "@mui/material";
import {
  LocalShipping as ShippingIcon,
  Security as SecurityIcon,
  Autorenew as ReturnIcon,
  Headphones as SupportIcon,
  ArrowForward as ArrowForwardIcon,
  ElectricBolt as BoltIcon,
  Verified as VerifiedIcon,
  Headphones as HeadphonesIcon,
  Checkroom as CheckroomIcon,
  Watch as WatchIcon,
  Coffee as CoffeeIcon,
  FitnessCenter as FitnessCenterIcon,
  MenuBook as MenuBookIcon,
  Category as CategoryIcon,
} from "@mui/icons-material";
import api from "../api/client";
import ProductCard from "../components/ProductCard";
import type { PublicProduct } from "@ornate/types";


interface CategoryDisplayMeta {
  image: string;
  tag: string;
  icon: React.ReactNode;
  subtitle: string;
}

const CATEGORY_META: Record<string, CategoryDisplayMeta> = {
  electronics: {
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85",
    tag: "AUDIO & GEAR",
    icon: <HeadphonesIcon sx={{ fontSize: 16 }} />,
    subtitle: "Headphones, mechanical keyboards, and personal audio",
  },
  clothing: {
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=85",
    tag: "APPAREL",
    icon: <CheckroomIcon sx={{ fontSize: 16 }} />,
    subtitle: "Essentials, casual wear, and outerwear for everyday use",
  },
  accessories: {
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=85",
    tag: "ACCESSORIES",
    icon: <WatchIcon sx={{ fontSize: 16 }} />,
    subtitle: "Watches, wallets, and everyday carry items",
  },
  "home-kitchen": {
    image: "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=800&q=85",
    tag: "HOME & KITCHEN",
    icon: <CoffeeIcon sx={{ fontSize: 16 }} />,
    subtitle: "Coffee makers, cookware, and home organisation",
  },
  sports: {
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=85",
    tag: "FITNESS",
    icon: <FitnessCenterIcon sx={{ fontSize: 16 }} />,
    subtitle: "Running shoes, training gear, and outdoor equipment",
  },
  books: {
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=85",
    tag: "BOOKS",
    icon: <MenuBookIcon sx={{ fontSize: 16 }} />,
    subtitle: "Design, architecture, and reference editions",
  },
};

const DEFAULT_CATEGORY_META: CategoryDisplayMeta = {
  image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=85",
  tag: "CATEGORY",
  icon: <CategoryIcon sx={{ fontSize: 16 }} />,
  subtitle: "Browse products in this category",
};

export default function HomePage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const { data } = await api.get("/products?limit=12");
      return data.data as { items: PublicProduct[]; total: number };
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories-list"],
    queryFn: async () => {
      const { data } = await api.get("/categories");
      return data.data as Array<{ id: string; name: string; slug: string; description?: string }>;
    },
  });

  const finalProducts = productsData?.items ?? [];
  const finalCategories = categories ?? [];

  const dealProducts = finalProducts.filter((p) => p.pricing?.dealActive || (p.pricing?.savingsPercent ?? 0) > 15);
  const standardProducts = finalProducts;

  return (
    <Box sx={{ pb: { xs: 6, md: 10 } }}>
      {/* Mobile Category Scroll Strip */}
      <Box
        sx={{
          display: { xs: "flex", md: "none" },
          overflowX: "auto",
          py: 2,
          px: 2,
          gap: 2,
          bgcolor: "background.paper",
          borderBottom: `1px solid ${isLight ? "#E5E7EB" : "rgba(255, 255, 255, 0.08)"}`,
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {finalCategories?.map((cat) => {
          const meta = CATEGORY_META[cat.slug] || DEFAULT_CATEGORY_META;
          return (
            <Box
              key={cat.id}
              component={RouterLink}
              to={`/categories/${cat.slug}`}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textDecoration: "none",
                color: "text.primary",
                minWidth: 68,
              }}
            >
              <Avatar
                src={meta.image}
                alt={cat.name}
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: isLight ? "#F5F6F7" : "#1E293B",
                  color: isLight ? "#172B30" : "#FFFFFF",
                  fontWeight: 800,
                  fontSize: "1rem",
                  border: "2px solid #FF7900",
                  boxShadow: "0 2px 8px rgba(255, 121, 0, 0.2)",
                  mb: 0.75,
                  "& img": { objectFit: "cover" },
                }}
              >
                {cat.name.charAt(0)}
              </Avatar>
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{
                  fontSize: "0.72rem",
                  textAlign: "center",
                  lineHeight: 1.2,
                  color: isLight ? "#172B30" : "#F8FAFC",
                }}
              >
                {cat.name.split(" ")[0]}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Hero Section */}
      <Box
        sx={{
          bgcolor: isLight ? "#F5F6F7" : "#0B1120",
          color: isLight ? "#172B30" : "white",
          pt: { xs: 5, md: 8 },
          pb: { xs: 6, md: 10 },
          borderBottom: `1px solid ${isLight ? "#E5E7EB" : "rgba(255, 255, 255, 0.08)"}`,
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip
                  icon={<VerifiedIcon sx={{ fontSize: 15, color: "#FF7900 !important" }} />}
                  label="DIRECT-TO-CONSUMER"
                  size="small"
                  sx={{
                    bgcolor: isLight ? "rgba(255, 121, 0, 0.08)" : "rgba(255, 121, 0, 0.15)",
                    color: "#FF7900",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    borderRadius: 1,
                    border: "1px solid rgba(255, 121, 0, 0.3)",
                  }}
                />
                <Chip
                  label="PROMOTIONAL PRICING"
                  size="small"
                  sx={{
                    bgcolor: "#D92D20",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    borderRadius: 1,
                  }}
                />
              </Stack>

              <Typography
                variant="h1"
                sx={{
                  fontWeight: 900,
                  letterSpacing: "-0.035em",
                  fontSize: { xs: "2.2rem", sm: "3rem", md: "3.5rem" },
                  lineHeight: { xs: 1.15, md: 1.1 },
                  color: isLight ? "#172B30" : "#FFFFFF",
                  mb: 2.5,
                }}
              >
                Electronics, Apparel <br />
                and Home Essentials
              </Typography>

              <Typography
                variant="body1"
                sx={{
                  color: isLight ? "#374151" : "#94A3B8",
                  maxWidth: 540,
                  fontSize: { xs: "0.95rem", md: "1.05rem" },
                  lineHeight: 1.6,
                  mb: 3.5,
                }}
              >
                Genuine products across electronics, fashion, accessories, and home goods. GST-inclusive pricing, real inventory, and delivery across India.
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate("/search")}
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    bgcolor: "#FF7900",
                    px: 3.5,
                    py: 1.5,
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    borderRadius: 1,
                    color: "#FFFFFF",
                    "&:hover": { bgcolor: "#E85D04" },
                  }}
                >
                  Browse Products
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate("/categories/electronics")}
                  sx={{
                    borderColor: isLight ? "#E5E7EB" : "rgba(255, 255, 255, 0.25)",
                    color: isLight ? "#172B30" : "#FFFFFF",
                    px: 3,
                    py: 1.5,
                    borderRadius: 1,
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    "&:hover": {
                      borderColor: "#FF7900",
                      color: "#FF7900",
                      bgcolor: isLight ? "rgba(255, 121, 0, 0.04)" : "rgba(255, 121, 0, 0.1)",
                    },
                  }}
                >
                  Electronics & Audio
                </Button>
              </Stack>
            </Grid>

            {/* Desktop Hero Image */}
            <Grid item xs={12} md={5} sx={{ display: { xs: "none", md: "block" } }}>
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  height: 420,
                  borderRadius: '8px',
                  overflow: "hidden",
                  boxShadow: isLight ? "0 20px 40px -15px rgba(23, 43, 48, 0.15)" : "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
                  border: `1px solid ${isLight ? "#E5E7EB" : "rgba(255, 255, 255, 0.1)"}`,
                }}
              >
                <Box
                  component="img"
                  src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80"
                  alt="Sony WH-1000XM5 headphones"
                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "65%",
                    background: "linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.7) 45%, rgba(15, 23, 42, 0.2) 72%, transparent 100%)",
                    pointerEvents: "none",
                  }}
                />
                <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, p: 3 }}>
                  <Chip
                    label="FEATURED PRODUCT"
                    size="small"
                    sx={{ bgcolor: "#FF7900", color: "white", fontWeight: 800, mb: 1, borderRadius: 1 }}
                  />
                  <Typography variant="h6" fontWeight={800} color="white">
                    Sony WH-1000XM5 Noise Cancelling
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#CBD5E1" }}>
                    Special Deal: Rs. 25,990 (Save Rs. 9,000)
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Value Propositions */}
      <Container maxWidth="lg" sx={{ mt: { xs: -3, md: -5 }, position: "relative", zIndex: 10 }}>
        <Paper
          elevation={4}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: '8px',
            bgcolor: "background.paper",
            border: `1px solid ${isLight ? "#E5E7EB" : "rgba(255, 255, 255, 0.08)"}`,
            boxShadow: isLight ? "0 12px 30px -10px rgba(0, 0, 0, 0.06)" : "0 12px 30px -10px rgba(0, 0, 0, 0.5)",
          }}
        >
          <Grid container spacing={{ xs: 2, md: 4 }}>
            {[
              { icon: <ShippingIcon sx={{ fontSize: 28, color: "#FF7900" }} />, title: "Free Express Shipping", desc: "On orders above Rs. 500" },
              { icon: <SecurityIcon sx={{ fontSize: 28, color: "#16A34A" }} />, title: "100% Genuine Products", desc: "Direct from authorized suppliers" },
              { icon: <ReturnIcon sx={{ fontSize: 28, color: "#F59E0B" }} />, title: "7-Day Return Policy", desc: "Doorstep pickup and replacement" },
              { icon: <SupportIcon sx={{ fontSize: 28, color: "#FF7900" }} />, title: "Customer Support", desc: "Available 9am to 9pm daily" },
            ].map((prop, idx) => (
              <Grid item xs={12} sm={6} md={3} key={idx}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: '6px', bgcolor: isLight ? "#F5F6F7" : "rgba(255, 255, 255, 0.05)", flexShrink: 0 }}>
                    {prop.icon}
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: "0.9rem", color: isLight ? "#172B30" : "#F8FAFC" }}>
                      {prop.title}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: "0.78rem", color: isLight ? "#374151" : "#94A3B8" }}>
                      {prop.desc}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Container>

      {/* Browse by Category */}
      <Container maxWidth="lg" sx={{ mt: { xs: 6, md: 10 } }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "flex-end" },
            gap: 2,
            mb: { xs: 3, md: 4 },
          }}
        >
          <Box>
            <Typography variant="overline" sx={{ color: "#FF7900", fontWeight: 800, letterSpacing: "0.08em", display: "block" }}>
              DEPARTMENTS
            </Typography>
            <Typography
              variant="h4"
              fontWeight={900}
              letterSpacing="-0.03em"
              sx={{ color: isLight ? "#172B30" : "#F8FAFC", fontSize: { xs: "1.75rem", md: "2.1rem" }, lineHeight: 1.15 }}
            >
              Browse by Category
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            to="/search"
            endIcon={<ArrowForwardIcon />}
            sx={{
              fontWeight: 700,
              color: "#FF7900",
              px: 2.5,
              py: 1,
              borderRadius: 1,
              border: "1px solid rgba(255, 121, 0, 0.35)",
              bgcolor: isLight ? "rgba(255, 121, 0, 0.05)" : "rgba(255, 121, 0, 0.1)",
              "&:hover": { bgcolor: "#FF7900", color: "#FFFFFF", borderColor: "#FF7900" },
            }}
          >
            View All
          </Button>
        </Box>

        <Grid container spacing={{ xs: 2, md: 2.5 }}>
          {finalCategories?.map((cat, idx) => {
            const meta = CATEGORY_META[cat.slug] || DEFAULT_CATEGORY_META;
            const isHero = idx === 0;
            const isSideHero = idx === 1;
            const gridSpan = isHero ? { xs: 12, md: 7 } : isSideHero ? { xs: 12, md: 5 } : { xs: 12, sm: 6, md: 3 };
            const cardHeight = isHero || isSideHero ? { xs: 260, sm: 300, md: 360 } : { xs: 220, sm: 240, md: 280 };

            return (
              <Grid item key={cat.id} {...gridSpan}>
                <Paper
                  component={RouterLink}
                  to={`/categories/${cat.slug}`}
                  elevation={0}
                  sx={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    height: cardHeight,
                    p: { xs: 2.5, md: 3 },
                    borderRadius: '8px',
                    overflow: "hidden",
                    textDecoration: "none",
                    color: "#FFFFFF",
                    border: `1px solid ${isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)"}`,
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      borderColor: "#FF7900",
                      boxShadow: "0 20px 40px -12px rgba(255, 121, 0, 0.3)",
                      "& .cat-bg-image": { transform: "scale(1.06)" },
                      "& .cat-arrow-btn": { bgcolor: "#FF7900", color: "#FFFFFF" },
                    },
                  }}
                >
                  <Box
                    className="cat-bg-image"
                    sx={{
                      position: "absolute",
                      inset: 0,
                      backgroundImage: `url(${meta.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      transition: "transform 0.5s ease",
                      zIndex: 0,
                    }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(180deg, rgba(15, 23, 42, 0.2) 0%, rgba(15, 23, 42, 0.55) 50%, rgba(15, 23, 42, 0.95) 100%)",
                      zIndex: 1,
                      pointerEvents: "none",
                    }}
                  />

                  {/* Top Badge */}
                  <Box sx={{ position: "relative", zIndex: 2 }}>
                    <Box
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.75,
                        px: 1.25,
                        py: 0.5,
                        borderRadius: 1,
                        bgcolor: "rgba(15, 23, 42, 0.7)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#FFFFFF",
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      <Box sx={{ display: "flex", color: "#FF7900" }}>{meta.icon}</Box>
                      <span>{meta.tag}</span>
                    </Box>
                  </Box>

                  {/* Bottom Content */}
                  <Box sx={{ position: "relative", zIndex: 2 }}>
                    <Typography
                      variant={isHero ? "h4" : "h6"}
                      fontWeight={800}
                      letterSpacing="-0.02em"
                      sx={{
                        color: "#FFFFFF",
                        mb: 0.5,
                        lineHeight: 1.2,
                        fontSize: isHero ? { xs: "1.4rem", md: "1.75rem" } : { xs: "1.05rem", md: "1.2rem" },
                      }}
                    >
                      {cat.name}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "rgba(255, 255, 255, 0.78)",
                        fontSize: isHero ? "0.875rem" : "0.78rem",
                        lineHeight: 1.35,
                        mb: 2,
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {meta.subtitle}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{ color: "rgba(255, 255, 255, 0.85)", letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.72rem" }}
                      >
                        Shop Now
                      </Typography>
                      <Box
                        className="cat-arrow-btn"
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: 1,
                          bgcolor: "rgba(255, 255, 255, 0.18)",
                          backdropFilter: "blur(8px)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#FFFFFF",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <ArrowForwardIcon sx={{ fontSize: 15 }} />
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Container>

      {/* Promotional Deals */}
      {dealProducts.length > 0 && (
        <Container maxWidth="lg" sx={{ mt: { xs: 5, md: 10 } }}>
          <Box
            sx={{
              p: { xs: 2.5, md: 3.5 },
              borderRadius: '8px',
              bgcolor: isLight ? "#172B30" : "#111827",
              border: `1px solid ${isLight ? "transparent" : "rgba(255, 255, 255, 0.08)"}`,
              color: "white",
              mb: 3.5,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <BoltIcon sx={{ color: "#FF7900", fontSize: 18 }} />
                  <Typography variant="caption" fontWeight={800} sx={{ color: "#FFA04D", letterSpacing: "0.08em" }}>
                    PROMOTIONAL PRICING
                  </Typography>
                </Stack>
                <Typography variant="h5" fontWeight={800} letterSpacing="-0.02em">
                  Current Deals
                </Typography>
              </Box>
              <Chip
                label="Manufacturer Discount"
                size="small"
                sx={{ bgcolor: "rgba(255,255,255,0.12)", color: "#FFFFFF", fontWeight: 600, borderRadius: 1 }}
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

      {/* All Products */}
      <Container maxWidth="lg" sx={{ mt: { xs: 6, md: 10 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 3 }}>
          <Box>
            <Typography variant="overline" sx={{ color: "#FF7900", fontWeight: 800, letterSpacing: "0.08em" }}>
              CATALOG
            </Typography>
            <Typography variant="h4" fontWeight={900} letterSpacing="-0.03em" sx={{ color: isLight ? "#172B30" : "#F8FAFC" }}>
              All Products
            </Typography>
          </Box>
          <Button component={RouterLink} to="/search" endIcon={<ArrowForwardIcon />} sx={{ fontWeight: 700, color: "#FF7900" }}>
            View All
          </Button>
        </Box>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
            <CircularProgress sx={{ color: "#FF7900" }} />
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
