import { useState } from "react";
import { useNavigate } from "react-router";
import { Box, Typography, Container, useTheme, Snackbar, Alert } from "@mui/material";
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

export interface ServiceItem {
  id: string;
  name: string;
  IconComponent: React.ComponentType<any>;
  path?: string;
  comingSoon?: boolean;
  hint?: string;
  tintColor?: string;
}

const SERVICES: ServiceItem[] = [
  {
    id: "shopping",
    name: "Shopping",
    IconComponent: ShoppingServiceIcon,
    path: "/search",
    tintColor: "rgba(249, 115, 22, 0.08)",
  },
  {
    id: "flight",
    name: "Flight",
    IconComponent: FlightServiceIcon,
    comingSoon: true,
    hint: "✈️ Flight bookings are launching soon! Explore travel gear in our catalog.",
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
    path: "/account",
    comingSoon: true,
    hint: "📱 Mobile recharge and payments coming soon!",
    tintColor: "rgba(37, 99, 235, 0.08)",
  },
  {
    id: "bills",
    name: "Bills",
    IconComponent: BillsServiceIcon,
    path: "/account",
    comingSoon: true,
    hint: "📄 Utility bill payments coming soon!",
    tintColor: "rgba(100, 116, 139, 0.08)",
  },
  {
    id: "gift-card",
    name: "Gift Card",
    IconComponent: GiftCardServiceIcon,
    path: "/search?q=gift+card",
    tintColor: "rgba(225, 29, 72, 0.08)",
  },
  {
    id: "more",
    name: "More",
    IconComponent: MoreServiceIcon,
    path: "/categories",
    tintColor: "rgba(71, 85, 105, 0.08)",
  },
];

export default function QuickServicesGrid() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isLight = theme.palette.mode === "light";
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleClick = (service: ServiceItem) => {
    if (service.path && !service.comingSoon) {
      navigate(service.path);
      return;
    }

    if (service.comingSoon) {
      setToastMessage(service.hint || `${service.name} services are coming soon to Shopy!`);
      return;
    }

    if (service.path) {
      navigate(service.path);
    }
  };

  return (
    <Box
      component="section"
      aria-label="Quick Services"
      sx={{
        width: "100%",
        bgcolor: isLight ? "#FFFFFF" : "#0B1120",
        borderBottom: `1px solid ${isLight ? "#E5E7EB" : "rgba(255, 255, 255, 0.08)"}`,
        py: { xs: 2.25, sm: 2.5, md: 3 },
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2, md: 3 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(4, 1fr)",
              sm: "repeat(4, 1fr)",
              md: "repeat(8, 1fr)",
            },
            columnGap: { xs: 1, sm: 2, md: 3 },
            rowGap: { xs: 2, sm: 2.5, md: 3 },
            alignItems: "start",
            justifyContent: "center",
          }}
        >
          {SERVICES.map((item) => {
            const Icon = item.IconComponent;
            return (
              <Box
                key={item.id}
                onClick={() => handleClick(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClick(item);
                  }
                }}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  cursor: "pointer",
                  userSelect: "none",
                  py: 0.5,
                  px: { xs: 0.25, sm: 0.75 },
                  borderRadius: 2.5,
                  transition: "all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  outline: "none",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    "& .service-icon-box": {
                      transform: "scale(1.08)",
                    },
                    "& .service-label": {
                      color: "#FF7900",
                    },
                  },
                  "&:active": {
                    transform: "translateY(0px) scale(0.96)",
                  },
                  "&:focus-visible": {
                    boxShadow: "0 0 0 2px #FF7900",
                  },
                }}
              >
                <Box
                  className="service-icon-box"
                  sx={{
                    width: { xs: 54, sm: 58, md: 62 },
                    height: { xs: 54, sm: 58, md: 62 },
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 0.75,
                    transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                >
                  <Icon />
                </Box>

                <Typography
                  className="service-label"
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: "0.76rem", sm: "0.82rem", md: "0.84rem" },
                    color: isLight ? "#0F172A" : "#F8FAFC",
                    textAlign: "center",
                    lineHeight: 1.2,
                    letterSpacing: "-0.015em",
                    transition: "color 0.15s ease",
                  }}
                >
                  {item.name}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Container>

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3500}
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
            fontWeight: 600,
            bgcolor: "#0F172A",
            color: "#FFFFFF",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            "& .MuiAlert-icon": { color: "#FF7900" },
          }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
