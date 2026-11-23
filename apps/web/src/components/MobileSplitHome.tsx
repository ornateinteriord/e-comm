import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Grid,
  Skeleton,
  useTheme,
  Snackbar,
  Alert,
  Chip,
  Button,
  InputBase,
  IconButton,
} from "@mui/material";
import {
  Category as CategoryIcon,
  GridView as GridViewIcon,
  ArrowBack as ArrowBackIcon,
  Headphones as HeadphonesIcon,
  Checkroom as CheckroomIcon,
  Watch as WatchIcon,
  Coffee as CoffeeIcon,
  FitnessCenter as FitnessCenterIcon,
  MenuBook as MenuBookIcon,
  ShoppingBag as ShoppingBagIcon,
  LocalOffer as DealIcon,
  Search as SearchIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import {
  ShoppingServiceIcon,
  FlightServiceIcon,
  HotelServiceIcon,
  TaxiServiceIcon,
  RechargeServiceIcon,
  BillsServiceIcon,
  GiftCardServiceIcon,
  MoreServiceIcon,
} from "./ServiceIcons";
import { useDebounce } from "../hooks/useDebounce";
import api from "../api/client";
import ProductCard from "./ProductCard";
import type { PublicProduct } from "@ornate/types";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  productCount?: number;
}

interface ServiceItem {
  id: string;
  name: string;
  IconComponent: React.ComponentType<any>;
  comingSoon?: boolean;
  hint?: string;
  tintColor?: string;
}

const SERVICES: ServiceItem[] = [
  {
    id: "shopping",
    name: "Shopping",
    IconComponent: ShoppingServiceIcon,
    tintColor: "rgba(249, 115, 22, 0.08)",
  },
  {
    id: "flight",
    name: "Flight",
    IconComponent: FlightServiceIcon,
    comingSoon: true,
    hint: "✈️ Flight bookings are launching soon! Explore our travel gear in the catalog.",
    tintColor: "rgba(14, 165, 233, 0.08)",
  },
  {
    id: "hotel",
    name: "Hotel",
    IconComponent: HotelServiceIcon,
    comingSoon: true,
    hint: "🏨 Hotel reservations are coming soon to Shopy!",
    tintColor: "rgba(168, 85, 247, 0.08)",
  },
  {
    id: "taxi",
    name: "Taxi",
    IconComponent: TaxiServiceIcon,
    comingSoon: true,
    hint: "🚕 Taxi & cab ride bookings coming soon!",
    tintColor: "rgba(245, 158, 11, 0.08)",
  },
  {
    id: "recharge",
    name: "Recharge",
    IconComponent: RechargeServiceIcon,
    comingSoon: true,
    hint: "📱 Mobile recharge and payments coming soon!",
    tintColor: "rgba(37, 99, 235, 0.08)",
  },
  {
    id: "bills",
    name: "Bills",
    IconComponent: BillsServiceIcon,
    comingSoon: true,
    hint: "📄 Utility bill payments coming soon!",
    tintColor: "rgba(100, 116, 139, 0.08)",
  },
  {
    id: "gift-card",
    name: "Gift Card",
    IconComponent: GiftCardServiceIcon,
    comingSoon: true,
    hint: "🎁 Gift Cards & vouchers are coming soon!",
    tintColor: "rgba(225, 29, 72, 0.08)",
  },
  {
    id: "more",
    name: "More",
    IconComponent: MoreServiceIcon,
    comingSoon: true,
    hint: "✨ More on-demand lifestyle services arriving soon!",
    tintColor: "rgba(71, 85, 105, 0.08)",
  },
];

// Map category name to icon fallback
function getCategoryIcon(name: string, slug?: string): React.ReactNode {
  const n = (name + " " + (slug || "")).toLowerCase();
  if (n.includes("phone") || n.includes("mobile") || n.includes("audio") || n.includes("electronic") || n.includes("headphone")) {
    return <HeadphonesIcon sx={{ fontSize: 22, color: "#FF7900" }} />;
  }
  if (n.includes("cloth") || n.includes("fashion") || n.includes("apparel") || n.includes("wear")) {
    return <CheckroomIcon sx={{ fontSize: 22, color: "#E11D48" }} />;
  }
  if (n.includes("watch") || n.includes("wrist") || n.includes("accessories")) {
    return <WatchIcon sx={{ fontSize: 22, color: "#0EA5E9" }} />;
  }
  if (n.includes("home") || n.includes("kitchen") || n.includes("furniture") || n.includes("decor") || n.includes("cup") || n.includes("coffee")) {
    return <CoffeeIcon sx={{ fontSize: 22, color: "#8B5CF6" }} />;
  }
  if (n.includes("sport") || n.includes("fitness") || n.includes("gym") || n.includes("shoe")) {
    return <FitnessCenterIcon sx={{ fontSize: 22, color: "#10B981" }} />;
  }
  if (n.includes("book") || n.includes("stationery")) {
    return <MenuBookIcon sx={{ fontSize: 22, color: "#F59E0B" }} />;
  }
  return <CategoryIcon sx={{ fontSize: 22, color: "#FF7900" }} />;
}

interface MobileSplitStorefrontProps {
  initialQuery?: string;
  initialCategory?: string;
  autoFocusSearch?: boolean;
}

export default function MobileSplitStorefront({
  initialQuery = "",
  initialCategory = "",
  autoFocusSearch = false,
}: MobileSplitStorefrontProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isLight = theme.palette.mode === "light";

  // URL tab param support: ?tab=categories or default
  const tabParam = searchParams.get("tab");
  const initialMode = tabParam === "categories" || initialCategory ? "categories" : "services";

  // ── State ──────────────────────────────────────────────────────────────────
  const [leftMode, setLeftMode] = useState<"services" | "categories">(initialMode);
  const [activeService, setActiveService] = useState<string>("shopping");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory || null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search input state inside right section
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const rightPanelRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync tab query param
  useEffect(() => {
    if (tabParam === "categories") {
      setLeftMode("categories");
    }
  }, [tabParam]);

  // Sync initial search query
  useEffect(() => {
    if (initialQuery && initialQuery !== searchTerm) {
      setSearchTerm(initialQuery);
    }
  }, [initialQuery]);

  // Auto focus if requested (e.g. on search tab)
  useEffect(() => {
    if (autoFocusSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [autoFocusSearch]);

  // ── Fetch all active products once to derive active category IDs ─────────────
  const { data: allActiveProducts = [] } = useQuery<PublicProduct[]>({
    queryKey: ["mobile-split-all-products-for-categories"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/search?limit=100");
        return (data.data?.products || data.data?.items || []) as PublicProduct[];
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  // ── Fetch categories (with hasProducts=true) ─────────────────────────────────
  const { data: categories = [], isLoading: catsLoading } = useQuery<Category[]>({
    queryKey: ["categories-mobile-split"],
    queryFn: async () => {
      const { data } = await api.get("/categories?hasProducts=true");
      return (data.data || []) as Category[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Filter out any category with 0 products (both via backend count & active products set)
  const activeCategoryIds = new Set(allActiveProducts.map((p) => p.categoryId).filter(Boolean));
  const activeCategoryNames = new Set(allActiveProducts.map((p) => p.categoryName?.toLowerCase()).filter(Boolean));
  const activeCategorySlugs = new Set(
    allActiveProducts.map((p) => (p as any).categorySlug || (p as any).category?.slug).filter(Boolean)
  );

  const visibleCategories = categories.filter((cat) => {
    // 1. If backend gave productCount, strictly respect it
    if (cat.productCount !== undefined) {
      return cat.productCount > 0;
    }
    // 2. If we have active products data, ensure category has at least one active product
    if (allActiveProducts.length > 0) {
      return (
        activeCategoryIds.has(cat.id) ||
        activeCategoryNames.has(cat.name?.toLowerCase()) ||
        activeCategorySlugs.has(cat.slug)
      );
    }
    return true;
  });

  // ── Fetch products for currently selected category or search query ──────────
  const isSearching = Boolean(debouncedSearch.trim());
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["mobile-split-products", selectedCategory, debouncedSearch],
    queryFn: async () => {
      let url = "";
      if (debouncedSearch.trim()) {
        const catPart = selectedCategory ? `&category=${encodeURIComponent(selectedCategory)}` : "";
        url = `/search?q=${encodeURIComponent(debouncedSearch.trim())}${catPart}&limit=30`;
      } else if (selectedCategory) {
        url = `/search?category=${encodeURIComponent(selectedCategory)}&limit=30`;
      } else {
        url = `/products?limit=24`;
      }

      const { data } = await api.get(url);
      if (data.data?.products) {
        return { items: data.data.products as PublicProduct[], total: data.data.total as number };
      }
      if (data.data?.items) {
        return { items: data.data.items as PublicProduct[], total: data.data.total as number };
      }
      return { items: [] as PublicProduct[], total: 0 };
    },
    staleTime: 1000 * 60 * 2,
  });

  // ── Fetch deals for promotional header ─────────────────────────────────────
  const { data: dealProductsData } = useQuery({
    queryKey: ["mobile-split-deals"],
    queryFn: async () => {
      const { data } = await api.get("/products?limit=8");
      const list = (data.data?.items || data.data?.products || []) as PublicProduct[];
      return list.filter((p) => p.pricing?.dealActive || (p.pricing?.savingsPercent ?? 0) > 15);
    },
    staleTime: 1000 * 60 * 5,
  });

  const products = productsData?.items ?? [];
  const dealProducts = dealProductsData ?? [];

  // ── Category selection handler ─────────────────────────────────────────────
  const handleSelectCategory = useCallback((slug: string | null) => {
    setSelectedCategory(slug);
    if (rightPanelRef.current) {
      rightPanelRef.current.scrollTop = 0;
    }
  }, []);

  // ── Service click handler ──────────────────────────────────────────────────
  const handleServiceClick = (service: ServiceItem) => {
    if (service.id === "shopping") {
      setActiveService("shopping");
      setLeftMode("categories");
      setSearchParams({ tab: "categories" });
      if (leftPanelRef.current) {
        leftPanelRef.current.scrollTop = 0;
      }
      return;
    }

    if (service.id === "more") {
      setLeftMode("categories");
      setSearchParams({ tab: "categories" });
      return;
    }

    if (service.comingSoon) {
      setActiveService(service.id);
      setToastMessage(service.hint || `${service.name} services are launching soon on Shopy!`);
      return;
    }
  };

  // ── Theme colors ───────────────────────────────────────────────────────────
  const bgLeft = isLight ? "#F8FAFC" : "#0B1120";
  const bgRight = isLight ? "#FFFFFF" : "#0F172A";
  const borderColor = isLight ? "#E5E7EB" : "rgba(255, 255, 255, 0.08)";
  const textPrimary = isLight ? "#0F172A" : "#F8FAFC";
  const textSecondary = isLight ? "#64748B" : "#94A3B8";
  const activeBg = isLight ? "rgba(255, 121, 0, 0.12)" : "rgba(255, 121, 0, 0.22)";
  const activeBorder = "#FF7900";

  return (
    <Box
      sx={{
        display: "flex",
        // Height fills space between top Toolbar (~56px) and bottom nav (~60px)
        height: "calc(100dvh - 56px - 60px)",
        maxHeight: "calc(100dvh - 56px - 60px)",
        width: "100%",
        overflow: "hidden",
        bgcolor: bgRight,
      }}
    >
      {/* ════════════════════════ LEFT FIXED SIDEBAR ════════════════════════ */}
      <Box
        ref={leftPanelRef}
        sx={{
          // Wider section width: 88px on xs, 98px on sm so text is clearly legible
          width: { xs: 88, sm: 98 },
          flexShrink: 0,
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          bgcolor: bgLeft,
          borderRight: `1px solid ${borderColor}`,
          WebkitOverflowScrolling: "touch",
          "&::-webkit-scrollbar": { width: 3 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255, 121, 0, 0.5)", borderRadius: 4 },
          display: "flex",
          flexDirection: "column",
          py: 0.75,
        }}
      >
        {/* If in CATEGORIES mode: show Back to Services button */}
        {leftMode === "categories" && (
          <Box
            onClick={() => {
              setLeftMode("services");
              setSearchParams({});
            }}
            role="button"
            tabIndex={0}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              minHeight: 56,
              py: 0.9,
              px: 0.5,
              mx: 0.75,
              mb: 0.75,
              borderRadius: "10px",
              cursor: "pointer",
              bgcolor: isLight ? "rgba(255, 121, 0, 0.06)" : "rgba(255, 121, 0, 0.12)",
              border: `1px solid ${isLight ? "rgba(255, 121, 0, 0.25)" : "rgba(255, 121, 0, 0.4)"}`,
              transition: "all 0.18s",
              "&:hover": { bgcolor: activeBg },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 19, color: "#FF7900" }} />
            <Typography
              sx={{
                fontSize: "0.66rem",
                fontWeight: 800,
                color: "#FF7900",
                textAlign: "center",
                lineHeight: 1.2,
                mt: 0.35,
                whiteSpace: "nowrap",
              }}
            >
              Services
            </Typography>
          </Box>
        )}

        {/* ── Mode 1: SERVICES (The 8 Icons) ─────────────────────────────────── */}
        {leftMode === "services" &&
          SERVICES.map((item) => {
            const Icon = item.IconComponent;
            const isActive = activeService === item.id;
            return (
              <Box
                key={item.id}
                onClick={() => handleServiceClick(item)}
                role="button"
                tabIndex={0}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  minHeight: 70,
                  py: 0.75,
                  px: 0.5,
                  mx: 0.5,
                  my: 0.35,
                  borderRadius: "10px",
                  cursor: "pointer",
                  userSelect: "none",
                  bgcolor: isActive ? activeBg : "transparent",
                  borderLeft: isActive ? `3.5px solid ${activeBorder}` : "3.5px solid transparent",
                  transition: "all 0.18s ease",
                  "&:hover": {
                    bgcolor: isActive ? activeBg : (isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)"),
                  },
                }}
              >
                {/* 3D Service Icon */}
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 0.35,
                    flexShrink: 0,
                    transform: isActive ? "scale(1.06)" : "scale(1)",
                    transition: "transform 0.18s ease",
                  }}
                >
                  <Icon />
                </Box>

                {/* Visible small text label under icon */}
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: isActive ? 800 : 700,
                    color: isActive ? "#FF7900" : textPrimary,
                    textAlign: "center",
                    lineHeight: 1.25,
                    whiteSpace: "nowrap",
                    width: "100%",
                    flexShrink: 0,
                    mt: 0.15,
                  }}
                >
                  {item.name}
                </Typography>
              </Box>
            );
          })}

        {/* ── Mode 2: CATEGORIES (only categories with products!) ─────────────── */}
        {leftMode === "categories" && (
          <>
            {/* "All" category button */}
            <Box
              onClick={() => handleSelectCategory(null)}
              role="button"
              tabIndex={0}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                minHeight: 66,
                py: 0.85,
                px: 0.5,
                mx: 0.5,
                my: 0.3,
                borderRadius: "10px",
                cursor: "pointer",
                bgcolor: selectedCategory === null ? activeBg : "transparent",
                borderLeft: selectedCategory === null ? `3.5px solid ${activeBorder}` : "3.5px solid transparent",
                transition: "all 0.18s ease",
              }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: "10px",
                  bgcolor: selectedCategory === null ? "rgba(255,121,0,0.2)" : (isLight ? "#E2E8F0" : "#1E293B"),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 0.4,
                }}
              >
                <GridViewIcon sx={{ fontSize: 21, color: selectedCategory === null ? "#FF7900" : textSecondary }} />
              </Box>
              <Typography
                sx={{
                  fontSize: "0.68rem",
                  fontWeight: selectedCategory === null ? 800 : 700,
                  color: selectedCategory === null ? "#FF7900" : textPrimary,
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                All
              </Typography>
            </Box>

            {/* List of Category Icons - ONLY THOSE WITH PRODUCTS */}
            {catsLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Box key={i} sx={{ px: 1, py: 0.85, textAlign: "center", flexShrink: 0 }}>
                    <Skeleton variant="rounded" width={38} height={38} sx={{ mx: "auto", mb: 0.5, borderRadius: "10px" }} />
                    <Skeleton variant="text" width="80%" sx={{ mx: "auto", fontSize: "0.6rem" }} />
                  </Box>
                ))
              : visibleCategories.map((cat) => {
                  const isSelected = selectedCategory === cat.slug;
                  return (
                    <Box
                      key={cat.id}
                      onClick={() => handleSelectCategory(cat.slug)}
                      role="button"
                      tabIndex={0}
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        flexShrink: 0,
                        minHeight: 68,
                        py: 0.85,
                        px: 0.5,
                        mx: 0.5,
                        my: 0.3,
                        borderRadius: "10px",
                        cursor: "pointer",
                        bgcolor: isSelected ? activeBg : "transparent",
                        borderLeft: isSelected ? `3.5px solid ${activeBorder}` : "3.5px solid transparent",
                        transition: "all 0.18s ease",
                        "&:hover": {
                          bgcolor: isSelected ? activeBg : (isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)"),
                        },
                      }}
                    >
                      {/* Icon image or custom SVG/MUI icon */}
                      {cat.image ? (
                        <Box
                          component="img"
                          src={cat.image}
                          alt={cat.name}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "10px",
                            objectFit: "cover",
                            mb: 0.4,
                            border: isSelected ? `2px solid #FF7900` : `1px solid ${borderColor}`,
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "10px",
                            bgcolor: isSelected ? "rgba(255,121,0,0.18)" : (isLight ? "#E2E8F0" : "#1E293B"),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mb: 0.4,
                            border: isSelected ? `2px solid #FF7900` : "1px solid transparent",
                            flexShrink: 0,
                          }}
                        >
                          {getCategoryIcon(cat.name, cat.slug)}
                        </Box>
                      )}

                      {/* Clearly visible category label: 11px font, 2-line wrap, proper line-height */}
                      <Typography
                        sx={{
                          fontSize: "0.68rem",
                          fontWeight: isSelected ? 800 : 700,
                          color: isSelected ? "#FF7900" : textPrimary,
                          textAlign: "center",
                          lineHeight: 1.25,
                          width: "100%",
                          px: 0.2,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          wordBreak: "break-word",
                        }}
                      >
                        {cat.name}
                      </Typography>
                    </Box>
                  );
                })}
          </>
        )}
      </Box>

      {/* ════════════════════════ RIGHT PRODUCTS PANEL ════════════════════════ */}
      <Box
        ref={rightPanelRef}
        sx={{
          flex: 1,
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          bgcolor: bgRight,
          WebkitOverflowScrolling: "touch",
          "&::-webkit-scrollbar": { width: 3 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255, 121, 0, 0.5)", borderRadius: 4 },
        }}
      >
        {/* ── SEARCH INPUT INSIDE RIGHT SECTION ON TOP ── */}
        <Box
          sx={{
            p: 1,
            pb: 0.75,
            bgcolor: isLight ? "#FFFFFF" : "#0F172A",
            borderBottom: `1px solid ${borderColor}`,
            position: "sticky",
            top: 0,
            zIndex: 15,
          }}
        >
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (searchInputRef.current) {
                searchInputRef.current.blur();
              }
            }}
            sx={{
              display: "flex",
              alignItems: "center",
              bgcolor: isLight ? "#F1F5F9" : "rgba(255, 255, 255, 0.08)",
              borderRadius: "10px",
              px: 1.25,
              py: 0.45,
              border: `1px solid ${isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.12)"}`,
              "&:focus-within": {
                bgcolor: isLight ? "#FFFFFF" : "rgba(255, 255, 255, 0.12)",
                borderColor: "#FF7900",
                boxShadow: "0 0 0 2px rgba(255, 121, 0, 0.15)",
              },
              transition: "all 0.18s ease",
            }}
          >
            <SearchIcon sx={{ color: isLight ? "#94A3B8" : "rgba(255,255,255,0.6)", mr: 1, fontSize: 18 }} />
            <InputBase
              inputRef={searchInputRef}
              placeholder="Search products, brands…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              fullWidth
              sx={{
                color: textPrimary,
                fontSize: "0.82rem",
                "& input::placeholder": { color: textSecondary, opacity: 1 },
              }}
            />
            {searchTerm && (
              <IconButton
                size="small"
                onClick={() => {
                  setSearchTerm("");
                  if (searchInputRef.current) searchInputRef.current.focus();
                }}
                sx={{ p: 0.25, color: textSecondary }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Section title & count header */}
        <Box
          sx={{
            px: 1.5,
            py: 0.85,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${borderColor}`,
            bgcolor: isLight ? "#FAFBFC" : "#0F172A",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            {isSearching ? (
              <SearchIcon sx={{ fontSize: 17, color: "#FF7900", flexShrink: 0 }} />
            ) : selectedCategory ? (
              <CategoryIcon sx={{ fontSize: 17, color: "#FF7900", flexShrink: 0 }} />
            ) : (
              <ShoppingBagIcon sx={{ fontSize: 17, color: "#FF7900", flexShrink: 0 }} />
            )}
            <Typography
              sx={{
                fontSize: "0.82rem",
                fontWeight: 900,
                color: textPrimary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {isSearching
                ? `Results for "${debouncedSearch}"`
                : selectedCategory
                ? visibleCategories.find((c) => c.slug === selectedCategory)?.name || selectedCategory
                : "Top Deals & Catalog"}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
            {isSearching && (
              <Chip
                label="Clear"
                size="small"
                onClick={() => setSearchTerm("")}
                sx={{
                  height: 20,
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              />
            )}
            {!productsLoading && (
              <Chip
                label={`${products.length} items`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  bgcolor: isLight ? "rgba(255,121,0,0.12)" : "rgba(255,121,0,0.22)",
                  color: "#FF7900",
                }}
              />
            )}
          </Box>
        </Box>

        {/* If user clicked a Coming Soon Service in Services view */}
        {leftMode === "services" && activeService !== "shopping" && !isSearching && (
          <Box
            sx={{
              p: 2,
              m: 1.5,
              borderRadius: "12px",
              bgcolor: isLight ? "#F8FAFC" : "#1E293B",
              border: `1px solid ${borderColor}`,
              textAlign: "center",
            }}
          >
            <Typography sx={{ fontSize: "1.8rem", mb: 1 }}>
              {activeService === "flight"
                ? "✈️"
                : activeService === "hotel"
                ? "🏨"
                : activeService === "taxi"
                ? "🚕"
                : activeService === "recharge"
                ? "📱"
                : activeService === "bills"
                ? "📄"
                : activeService === "gift-card"
                ? "🎁"
                : "✨"}
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: textPrimary, mb: 0.5 }}>
              {SERVICES.find((s) => s.id === activeService)?.name} Launching Soon
            </Typography>
            <Typography variant="caption" sx={{ color: textSecondary, display: "block", mb: 1.5 }}>
              {SERVICES.find((s) => s.id === activeService)?.hint}
            </Typography>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                setActiveService("shopping");
                setLeftMode("categories");
              }}
              sx={{
                bgcolor: "#FF7900",
                color: "#fff",
                fontWeight: 800,
                fontSize: "0.72rem",
                textTransform: "none",
                borderRadius: "8px",
                "&:hover": { bgcolor: "#E06B00" },
              }}
            >
              Browse Shopping Products
            </Button>
          </Box>
        )}

        {/* Deals rail when on "All" without search */}
        {selectedCategory === null && !isSearching && dealProducts.length > 0 && (
          <Box sx={{ pt: 1, pb: 0.5, borderBottom: `1px solid ${borderColor}` }}>
            <Box sx={{ px: 1.5, pb: 0.75, display: "flex", alignItems: "center", gap: 0.5 }}>
              <DealIcon sx={{ fontSize: 16, color: "#D92D20" }} />
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 900, color: "#D92D20" }}>
                Hot Deals & Offers
              </Typography>
            </Box>
            <Box
              sx={{
                display: "flex",
                gap: 1,
                overflowX: "auto",
                px: 1.5,
                pb: 1,
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >
              {dealProducts.slice(0, 5).map((deal) => (
                <Box
                  key={deal.id}
                  onClick={() => navigate(`/products/${deal.slug}`)}
                  sx={{
                    width: 120,
                    flexShrink: 0,
                    borderRadius: "8px",
                    bgcolor: isLight ? "#F8FAFC" : "#1E293B",
                    border: `1px solid ${borderColor}`,
                    p: 0.75,
                    cursor: "pointer",
                  }}
                >
                  <Box
                    component="img"
                    src={deal.images?.[0]?.url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80"}
                    alt={deal.name}
                    sx={{ width: "100%", height: 75, objectFit: "cover", borderRadius: "6px", mb: 0.5 }}
                  />
                  <Typography
                    sx={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      color: textPrimary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {deal.name}
                  </Typography>
                  <Typography sx={{ fontSize: "0.7rem", fontWeight: 900, color: "#FF7900" }}>
                    ₹{((deal.pricing?.applicablePrice ?? deal.pricing?.sellingPrice ?? 0) / 100).toLocaleString("en-IN")}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* 2-Column Product Grid */}
        <Box sx={{ p: 1 }}>
          {productsLoading ? (
            <Grid container spacing={1}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Grid item xs={6} key={i}>
                  <Skeleton variant="rounded" width="100%" sx={{ aspectRatio: "3/4", borderRadius: "8px" }} />
                </Grid>
              ))}
            </Grid>
          ) : products.length === 0 ? (
            <Box
              sx={{
                py: 6,
                px: 2,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Typography sx={{ fontSize: "2.2rem" }}>🛒</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: "0.85rem", color: textPrimary }}>
                {isSearching ? `No products matching "${debouncedSearch}"` : "No products found"}
              </Typography>
              <Typography sx={{ fontSize: "0.72rem", color: textSecondary }}>
                {isSearching ? "Try searching with other keywords" : "Try selecting another category on the left sidebar"}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setSearchTerm("");
                  handleSelectCategory(null);
                }}
                sx={{
                  borderColor: "#FF7900",
                  color: "#FF7900",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  mt: 0.5,
                }}
              >
                View All Products
              </Button>
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

      {/* Toast Alert for Coming Soon Services */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToastMessage(null)}
          severity="info"
          variant="filled"
          sx={{
            width: "100%",
            borderRadius: 2,
            fontWeight: 700,
            fontSize: "0.78rem",
            bgcolor: "#0F172A",
            color: "#FFFFFF",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            "& .MuiAlert-icon": { color: "#FF7900" },
          }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
