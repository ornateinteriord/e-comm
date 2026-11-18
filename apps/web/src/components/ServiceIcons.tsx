import type { SVGProps } from "react";

export type ServiceIconProps = SVGProps<SVGSVGElement>;

export function ShoppingServiceIcon(props: ServiceIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
      {...(props as any)}
    >
      <defs>
        <linearGradient id="shopBagGrad" x1="12" y1="18" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFA726" />
          <stop offset="45%" stopColor="#FF7043" />
          <stop offset="100%" stopColor="#E64A19" />
        </linearGradient>
        <linearGradient id="shopHandleGrad" x1="22" y1="6" x2="42" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFCC80" />
          <stop offset="100%" stopColor="#FB8C00" />
        </linearGradient>
        <linearGradient id="shopShine" x1="16" y1="20" x2="30" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id="shopShadow" x="-2" y="2" width="68" height="64" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#EA580C" floodOpacity="0.32" />
        </filter>
      </defs>
      {/* Handle Behind */}
      <path
        d="M24 22V14C24 9.58 27.58 6 32 6C36.42 6 40 9.58 40 14V22"
        stroke="url(#shopHandleGrad)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Bag Body */}
      <path
        d="M14 21C14 19.34 15.34 18 17 18H47C48.66 18 50 19.34 50 21L53.5 51.5C53.5 54.54 51.04 57 48 57H16C12.96 57 10.5 54.54 10.5 51.5L14 21Z"
        fill="url(#shopBagGrad)"
        filter="url(#shopShadow)"
      />
      {/* Front Specular Shine */}
      <path d="M14 21L18 56H46L50 21H14Z" fill="url(#shopShine)" />
      {/* Handle Rim Shine */}
      <path
        d="M24 20V14C24 9.58 27.58 6 32 6C36.42 6 40 9.58 40 14V20"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Shopy Tag Icon */}
      <circle cx="32" cy="37" r="4.5" fill="#FFFFFF" opacity="0.95" />
      <path
        d="M30 37L31.5 38.5L34.5 35.5"
        stroke="#E64A19"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlightServiceIcon(props: ServiceIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
      {...(props as any)}
    >
      <defs>
        <filter id="flightDropShadow" x="-4" y="0" width="72" height="68" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="3.5" stdDeviation="3" floodColor="#1E3A5F" floodOpacity="0.22" />
        </filter>
        <linearGradient id="flightWingGrad" x1="16" y1="12" x2="32" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67B6E9" />
          <stop offset="100%" stopColor="#4A9CE0" />
        </linearGradient>
      </defs>

      <g filter="url(#flightDropShadow)">
        {/* Top Wing (Upper / Far Side) */}
        <path
          d="M27 23.5L18.2 14.5C17.4 13.7 18 12.2 19.2 12.2L28 15.5L34 20L27 23.5Z"
          fill="url(#flightWingGrad)"
          stroke="#1E3A5F"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Fuselage & Integrated Tail Fin */}
        <path
          d="M51 17C52.8 18.6 52.2 21.2 49.5 22.8L37.5 28.5L20 36C17 37.2 12.5 36.2 8.5 32L6 29C4.8 27.8 5.6 25.8 7.2 26.2L14.5 27.5L21 24.5L35 18L46.5 13.5C48.8 12.6 49.8 14.8 51 17Z"
          fill="#EDF6FD"
          stroke="#1E3A5F"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Tail Inner Contour Highlight */}
        <path
          d="M10.5 27.5L17.5 30.5L14 34.5"
          stroke="#C8E1F7"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Bottom Wing (Lower / Near Side) */}
        <path
          d="M34.5 25.5L24.8 48C24.2 49.4 22.4 49.6 21.4 48.4L20.8 47.8C20 46.8 20.4 45.2 21.6 44.2L29 31L34.5 25.5Z"
          fill="url(#flightWingGrad)"
          stroke="#1E3A5F"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Wing Leading Edge Specular Shine */}
        <path
          d="M33 26.5L24 46.5"
          stroke="#BAE6FD"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>
    </svg>
  );
}

export function HotelServiceIcon(props: ServiceIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
      {...(props as any)}
    >
      <defs>
        <linearGradient id="hotelBedGrad" x1="8" y1="16" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E879F9" />
          <stop offset="45%" stopColor="#C026D3" />
          <stop offset="100%" stopColor="#7E22CE" />
        </linearGradient>
        <linearGradient id="duvetGrad" x1="20" y1="30" x2="56" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5D0FE" />
          <stop offset="100%" stopColor="#E879F9" />
        </linearGradient>
        <filter id="hotelShadow" x="-2" y="2" width="68" height="64" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#9333EA" floodOpacity="0.32" />
        </filter>
      </defs>
      <g filter="url(#hotelShadow)">
        {/* Headboard (Left) */}
        <rect x="8" y="16" width="7" height="36" rx="3.5" fill="url(#hotelBedGrad)" />
        {/* Footboard (Right) */}
        <rect x="51" y="28" width="6" height="24" rx="3" fill="url(#hotelBedGrad)" />
        {/* Base Frame */}
        <path d="M12 40H54C55.1 40 56 40.9 56 42V45C56 46.1 55.1 47 54 47H12C10.9 47 10 46.1 10 45V42C10 40.9 10.9 40 12 40Z" fill="#581C87" />
        {/* Mattress / Duvet */}
        <rect x="15" y="30" width="37" height="11" rx="4" fill="url(#duvetGrad)" />
        {/* Folded Blanket Section */}
        <rect x="27" y="30" width="25" height="11" rx="3" fill="url(#hotelBedGrad)" />
        {/* Pillow */}
        <rect x="17" y="26" width="10" height="7" rx="3" fill="#FFFFFF" />
        {/* Sleeper Accent */}
        <circle cx="22" cy="22" r="4" fill="url(#hotelBedGrad)" />
        {/* Luxury Sparkle */}
        <path d="M43 16L44 18.5L46.5 19.5L44 20.5L43 23L42 20.5L39.5 19.5L42 18.5L43 16Z" fill="#FDE047" />
      </g>
    </svg>
  );
}

export function TaxiServiceIcon(props: ServiceIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
      {...(props as any)}
    >
      <defs>
        <linearGradient id="taxiBodyGrad" x1="10" y1="16" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="40%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="taxiWindshield" x1="18" y1="20" x2="46" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <filter id="taxiShadow" x="-2" y="2" width="68" height="64" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#D97706" floodOpacity="0.32" />
        </filter>
      </defs>
      <g filter="url(#taxiShadow)">
        {/* Tires */}
        <rect x="12" y="46" width="7" height="8" rx="3" fill="#0F172A" />
        <rect x="45" y="46" width="7" height="8" rx="3" fill="#0F172A" />
        {/* Roof Sign */}
        <rect x="25" y="12" width="14" height="6" rx="2" fill="#EA580C" />
        <rect x="27" y="14" width="10" height="2" rx="1" fill="#FFFFFF" />
        {/* Roof Pillar */}
        <path d="M19 28L23 18C23.5 16.8 24.6 16 26 16H38C39.4 16 40.5 16.8 41 18L45 28H19Z" fill="url(#taxiBodyGrad)" />
        {/* Windshield */}
        <path d="M21 28L24.5 19H39.5L43 28H21Z" fill="url(#taxiWindshield)" />
        <path d="M25 21L23 27H26L28 21H25Z" fill="#FFFFFF" opacity="0.6" />
        {/* Lower Car Body */}
        <rect x="10" y="27" width="44" height="22" rx="6" fill="url(#taxiBodyGrad)" />
        {/* Headlights */}
        <circle cx="17" cy="36" r="4" fill="#FEF08A" />
        <circle cx="17" cy="36" r="2.5" fill="#FFFFFF" />
        <circle cx="47" cy="36" r="4" fill="#FEF08A" />
        <circle cx="47" cy="36" r="2.5" fill="#FFFFFF" />
        {/* Front Grille */}
        <rect x="24" y="38" width="16" height="5" rx="2.5" fill="#0F172A" />
        <circle cx="28" cy="40.5" r="1" fill="#FDE047" />
        <circle cx="32" cy="40.5" r="1" fill="#FDE047" />
        <circle cx="36" cy="40.5" r="1" fill="#FDE047" />
      </g>
    </svg>
  );
}

export function RechargeServiceIcon(props: ServiceIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
      {...(props as any)}
    >
      <defs>
        <linearGradient id="phoneBodyGrad" x1="14" y1="8" x2="50" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="phoneScreenGrad" x1="20" y1="16" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
        <filter id="phoneShadow" x="-2" y="2" width="68" height="64" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#2563EB" floodOpacity="0.32" />
        </filter>
      </defs>
      <g filter="url(#phoneShadow)">
        {/* Smartphone Chassis */}
        <rect x="16" y="8" width="32" height="48" rx="8" fill="url(#phoneBodyGrad)" />
        {/* Screen */}
        <rect x="19" y="13" width="26" height="38" rx="5" fill="url(#phoneScreenGrad)" />
        {/* Glare Shine */}
        <path d="M21 15L35 15L23 39H20L21 15Z" fill="#FFFFFF" opacity="0.25" />
        {/* Lightning Bolt */}
        <path
          d="M33 22L26 31H31L29 40L38 29H32L34 22H33Z"
          fill="#FACC15"
          filter="drop-shadow(0 2px 4px rgba(250, 204, 21, 0.45))"
        />
        {/* Ear Speaker */}
        <rect x="29" y="10.5" width="6" height="1.5" rx="0.75" fill="#93C5FD" />
      </g>
    </svg>
  );
}

export function BillsServiceIcon(props: ServiceIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
      {...(props as any)}
    >
      <defs>
        <linearGradient id="billPaperGrad" x1="14" y1="8" x2="50" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
        <filter id="billShadow" x="-2" y="2" width="68" height="64" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#64748B" floodOpacity="0.3" />
        </filter>
      </defs>
      <g filter="url(#billShadow)">
        {/* Document Sheet */}
        <path
          d="M16 12C16 9.79 17.79 8 20 8H38L48 18V52C48 54.21 46.21 56 44 56H20C17.79 56 16 54.21 16 52V12Z"
          fill="url(#billPaperGrad)"
        />
        {/* Folded Corner */}
        <path d="M38 8V16C38 17.1 38.9 18 40 18H48L38 8Z" fill="#94A3B8" />
        {/* Bill Lines */}
        <rect x="22" y="24" width="20" height="3" rx="1.5" fill="#0284C7" />
        <rect x="22" y="31" width="16" height="2.5" rx="1.25" fill="#94A3B8" />
        <rect x="22" y="37" width="18" height="2.5" rx="1.25" fill="#94A3B8" />
        {/* Paid Checkmark Badge */}
        <circle cx="38" cy="46" r="6" fill="#10B981" />
        <path d="M35 46L37 48L41 44" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function GiftCardServiceIcon(props: ServiceIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
      {...(props as any)}
    >
      <defs>
        <linearGradient id="giftBoxGrad" x1="12" y1="18" x2="52" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="50%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#BE123C" />
        </linearGradient>
        <linearGradient id="giftRibbonGrad" x1="26" y1="8" x2="38" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
        <filter id="giftShadow" x="-2" y="2" width="68" height="64" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#E11D48" floodOpacity="0.32" />
        </filter>
      </defs>
      <g filter="url(#giftShadow)">
        {/* Gift Box Base */}
        <rect x="14" y="28" width="36" height="26" rx="4" fill="url(#giftBoxGrad)" />
        {/* Gift Box Lid */}
        <rect x="11" y="22" width="42" height="9" rx="3" fill="#F43F5E" />
        {/* Vertical Ribbon */}
        <rect x="28" y="22" width="8" height="32" fill="url(#giftRibbonGrad)" />
        {/* Horizontal Ribbon on Lid */}
        <rect x="11" y="25" width="42" height="3" fill="url(#giftRibbonGrad)" opacity="0.9" />
        {/* Bow Loops */}
        <path d="M31 22C31 22 23 20 22 15C21 10 27 11 30 17L31 22Z" fill="url(#giftRibbonGrad)" />
        <path d="M33 22C33 22 41 20 42 15C43 10 37 11 34 17L33 22Z" fill="url(#giftRibbonGrad)" />
        {/* Bow Center Knot */}
        <circle cx="32" cy="21" r="3" fill="#FEF08A" />
      </g>
    </svg>
  );
}

export function MoreServiceIcon(props: ServiceIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
      {...(props as any)}
    >
      <defs>
        <linearGradient id="moreBgGrad" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <filter id="moreShadow" x="-2" y="2" width="68" height="64" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#64748B" floodOpacity="0.25" />
        </filter>
      </defs>
      <g filter="url(#moreShadow)">
        {/* Circular Disk */}
        <circle cx="32" cy="32" r="22" fill="url(#moreBgGrad)" stroke="#CBD5E1" strokeWidth="1.5" />
        {/* Specular Shine Arc */}
        <path d="M18 24C21 18 28 14 36 14C38 14 41 15 43 16C39 15 34 14.5 30 16C24 18 20 21 18 24Z" fill="#FFFFFF" opacity="0.8" />
        {/* 3 Blue Dots */}
        <circle cx="21" cy="32" r="3.5" fill="#1E3A8A" />
        <circle cx="32" cy="32" r="3.5" fill="#2563EB" />
        <circle cx="43" cy="32" r="3.5" fill="#3B82F6" />
      </g>
    </svg>
  );
}

