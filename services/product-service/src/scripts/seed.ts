import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { connectDB, disconnectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import { Category } from '../models/category.model.js';
import { Product } from '../models/product.model.js';
import { SearchIndexEvent } from '../models/search-index-event.model.js';

const log = createLogger('seed');

const categories = [
  {
    name: 'Electronics & Audio',
    slug: 'electronics',
    description: 'Flagship headphones, mechanical gear, and premium personal audio.',
    order: 1,
  },
  {
    name: 'Fashion & Apparel',
    slug: 'clothing',
    description: 'Tailored luxury essentials, heavyweight cotton tees, and designer outerwear.',
    order: 2,
  },
  {
    name: 'Watches & Accessories',
    slug: 'accessories',
    description: 'Precision timepieces, Italian leather wallets, and everyday luxury carry.',
    order: 3,
  },
  {
    name: 'Home, Living & Coffee',
    slug: 'home-kitchen',
    description: 'Specialty pour-over coffee makers, ergonomic living, and artisan homeware.',
    order: 4,
  },
  {
    name: 'Fitness & Outdoors',
    slug: 'sports',
    description: 'Performance running shoes, high-density yoga mats, and recovery tech.',
    order: 5,
  },
  {
    name: 'Books & Stationery',
    slug: 'books',
    description: 'Hardcover architecture, software craftsmanship, and premium journals.',
    order: 6,
  },
];

// All prices in paise (INR). 100 paise = ₹1.
// Curated Unsplash images with auto=format&fit=crop for ultra crisp rendering.
const products = [
  // 1. Sony WH-1000XM5
  {
    name: 'Sony WH-1000XM5 Wireless Noise-Cancelling Headphones',
    sku: 'SNY-WH-XM5-BLK',
    brand: 'Sony',
    shortDescription: 'Industry-leading noise cancellation with 8 microphones, 30-hour battery life, and crystal clear hands-free calling.',
    longDescription: 'The Sony WH-1000XM5 redefines distraction-free listening. Two processors control eight microphones for unprecedented noise cancellation and exceptional call quality. Newly developed 30mm precision-engineered drivers provide natural sound with high-res audio certification.',
    categorySlug: 'electronics',
    pricing: {
      mrp: 3499000,         // ₹34,990
      sellingPrice: 2899000, // ₹28,990
      dealPrice: 2599000,    // ₹25,990 (Special Deal)
      inwardPrice: 1950000,  // ₹19,500
      deal: {
        isActive: true,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        maxQtyPerOrder: 2,
      },
    },
    stock: 42,
    lowStockThreshold: 5,
    images: [
      { id: 'img-sny-1', url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80', alt: 'Sony WH-1000XM5 Front', order: 0 },
      { id: 'img-sny-2', url: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=1000&q=80', alt: 'Sony WH-1000XM5 Angle', order: 1 },
      { id: 'img-sny-3', url: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1000&q=80', alt: 'Sony WH-1000XM5 Lifestyle', order: 2 },
    ],
    attributes: [
      { key: 'Driver Size', value: '30mm Carbon Fiber' },
      { key: 'Battery Life', value: '30 Hours (ANC On)' },
      { key: 'Bluetooth', value: 'v5.2 with LDAC' },
      { key: 'Weight', value: '250g' },
    ],
    variants: [
      { id: 'var-sny-blk', sku: 'SNY-WH-XM5-BLK', attributes: [{ key: 'Color', value: 'Midnight Black' }], stock: 25 },
      { id: 'var-sny-slv', sku: 'SNY-WH-XM5-SLV', attributes: [{ key: 'Color', value: 'Platinum Silver' }], stock: 17 },
    ],
    status: 'active' as const,
    isPublished: true,
  },

  // 2. Apple Watch Ultra 2
  {
    name: 'Apple Watch Ultra 2 GPS + Cellular 49mm Titanium',
    sku: 'APL-WCH-ULT2',
    brand: 'Apple',
    shortDescription: 'Rugged and capable, built for endurance athletes, outdoor adventurers, and ocean explorers with 3000-nit display.',
    longDescription: 'The most capable and rugged Apple Watch pushes the limits again. Featuring the all-new S9 SiP, a magical new double tap gesture, and a brighter display. Up to 36 hours of normal battery life and up to 72 hours in Low Power Mode.',
    categorySlug: 'accessories',
    pricing: {
      mrp: 8990000,         // ₹89,900
      sellingPrice: 8490000, // ₹84,900
      dealPrice: null,
      inwardPrice: 6800000,  // ₹68,000
      deal: null,
    },
    stock: 18,
    lowStockThreshold: 4,
    images: [
      { id: 'img-apl-1', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80', alt: 'Apple Watch Ultra Front', order: 0 },
      { id: 'img-apl-2', url: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=1000&q=80', alt: 'Apple Watch Ultra Wrist', order: 1 },
    ],
    attributes: [
      { key: 'Case Material', value: 'Aerospace-Grade Titanium' },
      { key: 'Display', value: '49mm Always-On Retina 3000 nits' },
      { key: 'Water Resistance', value: '100m / Dive certified to 40m' },
    ],
    variants: [
      { id: 'var-apl-org', sku: 'APL-WCH-ULT2-ORG', attributes: [{ key: 'Band', value: 'Orange Ocean Band' }], stock: 10 },
      { id: 'var-apl-gry', sku: 'APL-WCH-ULT2-GRY', attributes: [{ key: 'Band', value: 'Grey Trail Loop' }], stock: 8 },
    ],
    status: 'active' as const,
    isPublished: true,
  },

  // 3. Keychron Q1 Pro Mechanical Keyboard
  {
    name: 'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
    sku: 'KCR-Q1P-KBN',
    brand: 'Keychron',
    shortDescription: 'Full aluminum CNC 75% mechanical keyboard with hot-swappable switches, double-gasket mount, and QMK/VIA support.',
    longDescription: 'Engineered for uncompromising typing feel and acoustic acoustics. The Keychron Q1 Pro features a full metal body machined from 6063 aluminum, double-gasket mounting design, pre-lubed mechanical switches, and seamless Bluetooth 5.1 / wired USB connectivity.',
    categorySlug: 'electronics',
    pricing: {
      mrp: 1899000,         // ₹18,990
      sellingPrice: 1549000, // ₹15,490
      dealPrice: 1399000,    // ₹13,990
      inwardPrice: 980000,   // ₹9,800
      deal: {
        isActive: true,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        maxQtyPerOrder: 3,
      },
    },
    stock: 28,
    lowStockThreshold: 5,
    images: [
      { id: 'img-kcr-1', url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=80', alt: 'Keychron Q1 Pro Overhead', order: 0 },
      { id: 'img-kcr-2', url: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=1000&q=80', alt: 'Keychron Q1 Pro Keycaps', order: 1 },
    ],
    attributes: [
      { key: 'Switch Type', value: 'K Pro Red (Linear)' },
      { key: 'Layout', value: '75% Compact (81 Keys)' },
      { key: 'Chassis', value: 'Anodized CNC Aluminum' },
    ],
    variants: [
      { id: 'var-kcr-blk', sku: 'KCR-Q1P-BLK', attributes: [{ key: 'Color', value: 'Carbon Black' }], stock: 16 },
      { id: 'var-kcr-slv', sku: 'KCR-Q1P-SLV', attributes: [{ key: 'Color', value: 'Silver Grey' }], stock: 12 },
    ],
    status: 'active' as const,
    isPublished: true,
  },

  // 4. Herman Miller Aeron Chair
  {
    name: 'Herman Miller Aeron Ergonomic Office Chair - Graphite',
    sku: 'HML-ARN-GPH',
    brand: 'Herman Miller',
    shortDescription: 'The pinnacle of ergonomic seating with Pellicle 8Z breathable suspension and PostureFit SL adjustable back support.',
    longDescription: 'Pioneered by Bill Stumpf and Don Chadwick, Aeron has remained the undisputed gold standard of ergonomic chairs for 30 years. Features dynamic 8Z Pellicle mesh that varies tension across eight zones to eliminate pressure points, forward tilt mechanism, and 12-year warranty.',
    categorySlug: 'home-kitchen',
    pricing: {
      mrp: 14500000,        // ₹1,45,000
      sellingPrice: 12900000,// ₹1,29,000
      dealPrice: null,
      inwardPrice: 8500000,  // ₹85,000
      deal: null,
    },
    stock: 12,
    lowStockThreshold: 3,
    images: [
      { id: 'img-hml-1', url: 'https://images.unsplash.com/photo-1580481077195-c3a821a58875?auto=format&fit=crop&w=1000&q=80', alt: 'Herman Miller Chair Front', order: 0 },
      { id: 'img-hml-2', url: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=1000&q=80', alt: 'Aeron Detail Mesh', order: 1 },
    ],
    attributes: [
      { key: 'Size', value: 'Size B (Medium Standard)' },
      { key: 'Material', value: '8Z Pellicle Elastomeric Mesh' },
      { key: 'Warranty', value: '12-Year Official Manufacturer' },
    ],
    variants: [],
    status: 'active' as const,
    isPublished: true,
  },

  // 5. Nike Invincible 3 Running Shoes
  {
    name: 'Nike ZoomX Invincible Run FK 3 Road Running Shoes',
    sku: 'NKE-INV-003',
    brand: 'Nike',
    shortDescription: 'Maximum cushioning engineered to support every mile. Loaded with ultralight ZoomX foam for maximum bounce and energy return.',
    longDescription: 'With maximum cushioning to support every stride, the Invincible 3 gives you the highest level of comfort underfoot to help you stay on your feet today, tomorrow and beyond. Rocker-shaped ZoomX foam midsole cushions high impacts and propels you forward.',
    categorySlug: 'sports',
    pricing: {
      mrp: 1699500,         // ₹16,995
      sellingPrice: 1349500, // ₹13,495
      dealPrice: 1199500,    // ₹11,995 (Deal)
      inwardPrice: 750000,   // ₹7,500
      deal: {
        isActive: true,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        maxQtyPerOrder: 2,
      },
    },
    stock: 65,
    lowStockThreshold: 10,
    images: [
      { id: 'img-nke-1', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80', alt: 'Nike Invincible 3 Crimson Red', order: 0 },
      { id: 'img-nke-2', url: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1000&q=80', alt: 'Nike Shoe Profile', order: 1 },
    ],
    attributes: [
      { key: 'Cushioning', value: 'Super-High ZoomX Foam' },
      { key: 'Upper', value: 'Flyknit Breathable' },
      { key: 'Offset', value: '9mm' },
    ],
    variants: [
      { id: 'var-nke-8', sku: 'NKE-INV-003-8', attributes: [{ key: 'Size', value: 'UK 8' }], stock: 15 },
      { id: 'var-nke-9', sku: 'NKE-INV-003-9', attributes: [{ key: 'Size', value: 'UK 9' }], stock: 25 },
      { id: 'var-nke-10', sku: 'NKE-INV-003-10', attributes: [{ key: 'Size', value: 'UK 10' }], stock: 25 },
    ],
    status: 'active' as const,
    isPublished: true,
  },

  // 6. Fellow Ode Gen 2 Coffee Grinder
  {
    name: 'Fellow Ode Gen 2 Brew Coffee Grinder - Matte Black',
    sku: 'FLW-ODE-G2-BLK',
    brand: 'Fellow',
    shortDescription: 'Award-winning electric burr grinder with 64mm commercial-grade flat burrs and 31 precise grind settings.',
    longDescription: 'Ode Gen 2 transforms coffee mornings into cafe experiences. Engineered specifically for pour-over, French press, drip, and cold brew with professional-grade 64mm stainless steel flat burrs, ionizer anti-static technology, and quiet auto-stop operation.',
    categorySlug: 'home-kitchen',
    pricing: {
      mrp: 3250000,         // ₹32,500
      sellingPrice: 2890000, // ₹28,900
      dealPrice: null,
      inwardPrice: 1900000,  // ₹19,000
      deal: null,
    },
    stock: 22,
    lowStockThreshold: 4,
    images: [
      { id: 'img-flw-1', url: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=1000&q=80', alt: 'Fellow Coffee Equipment', order: 0 },
      { id: 'img-flw-2', url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1000&q=80', alt: 'Fresh Ground Coffee Detail', order: 1 },
    ],
    attributes: [
      { key: 'Burr Size', value: '64mm Flat Burrs' },
      { key: 'Grind Settings', value: '31 Stepped Settings' },
      { key: 'Hopper Capacity', value: '100g Single Dose' },
    ],
    variants: [],
    status: 'active' as const,
    isPublished: true,
  },

  // 7. Bellroy Tokyo Leather Totepack
  {
    name: 'Bellroy Tokyo Totepack - Premium Water-Resistant Canvas & Leather',
    sku: 'BLY-TKY-TOT',
    brand: 'Bellroy',
    shortDescription: 'Dual-carry backpack and tote with padded 15" laptop sleeve, pop pockets for water bottle, and environmentally certified leather.',
    longDescription: 'Casual when you want it, professional when you need it. The Tokyo Totepack lets you tuck the backpack straps away and carry it comfortably as a tote, or wear it on your back for hands-free commuting across cities.',
    categorySlug: 'accessories',
    pricing: {
      mrp: 1950000,         // ₹19,500
      sellingPrice: 1690000, // ₹16,900
      dealPrice: 1490000,    // ₹14,900
      inwardPrice: 950000,   // ₹9,500
      deal: {
        isActive: true,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        maxQtyPerOrder: 2,
      },
    },
    stock: 34,
    lowStockThreshold: 6,
    images: [
      { id: 'img-bly-1', url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80', alt: 'Bellroy Totepack Black', order: 0 },
      { id: 'img-bly-2', url: 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=1000&q=80', alt: 'Bellroy Leather Details', order: 1 },
    ],
    attributes: [
      { key: 'Capacity', value: '20 Liters' },
      { key: 'Laptop Fit', value: 'Up to 16" MacBook Pro' },
      { key: 'Fabric', value: 'Recycled Baida Nylon & Leather' },
    ],
    variants: [
      { id: 'var-bly-blk', sku: 'BLY-TKY-TOT-BLK', attributes: [{ key: 'Color', value: 'Raven Black' }], stock: 20 },
      { id: 'var-bly-olv', sku: 'BLY-TKY-TOT-OLV', attributes: [{ key: 'Color', value: 'Ranger Green' }], stock: 14 },
    ],
    status: 'active' as const,
    isPublished: true,
  },

  // 8. Heavyweight French Terry Hoodie
  {
    name: 'Threadsmith 450GSM Heavyweight French Terry Hoodie',
    sku: 'TSM-HDY-450',
    brand: 'Threadsmith',
    shortDescription: 'Custom-milled 100% organic cotton 450GSM loopback French Terry hoodie with drop shoulders and double-layered hood.',
    longDescription: 'Crafted without compromises from 450GSM combed organic cotton. Featuring a relaxed drop-shoulder silhouette, thick 2x2 ribbed cuffs, kangaroo pocket with concealed interior phone sleeve, and preshrunk wash treatment.',
    categorySlug: 'clothing',
    pricing: {
      mrp: 650000,          // ₹6,500
      sellingPrice: 480000,  // ₹4,800
      dealPrice: 399000,    // ₹3,990
      inwardPrice: 190000,  // ₹1,900
      deal: {
        isActive: true,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        maxQtyPerOrder: 3,
      },
    },
    stock: 85,
    lowStockThreshold: 12,
    images: [
      { id: 'img-hdy-1', url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1000&q=80', alt: 'Heavyweight Hoodie Oatmeal', order: 0 },
      { id: 'img-hdy-2', url: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=1000&q=80', alt: 'Hoodie Texture and Seams', order: 1 },
    ],
    attributes: [
      { key: 'Fabric Weight', value: '450 GSM Heavyweight' },
      { key: 'Composition', value: '100% GOTS Organic Cotton' },
      { key: 'Fit', value: 'Boxy Relaxed Drop Shoulder' },
    ],
    variants: [
      { id: 'var-hdy-s', sku: 'TSM-HDY-450-S', attributes: [{ key: 'Size', value: 'S' }], stock: 18 },
      { id: 'var-hdy-m', sku: 'TSM-HDY-450-M', attributes: [{ key: 'Size', value: 'M' }], stock: 32 },
      { id: 'var-hdy-l', sku: 'TSM-HDY-450-L', attributes: [{ key: 'Size', value: 'L' }], stock: 25 },
      { id: 'var-hdy-xl', sku: 'TSM-HDY-450-XL', attributes: [{ key: 'Size', value: 'XL' }], stock: 10 },
    ],
    status: 'active' as const,
    isPublished: true,
  },

  // 9. Lululemon Align Reversible Yoga Mat 5mm
  {
    name: 'Lululemon 5mm Studio Reversible Yoga Mat',
    sku: 'LLM-YGA-5MM',
    brand: 'Lululemon',
    shortDescription: 'Natural rubber base mat with textured polyurethane top layer for extraordinary wet and dry grip during intense practices.',
    longDescription: 'Designed for yoga, pilates and mindful movement. Made with natural rubber that cushions joints while the innovative top layer absorbs sweat to maintain a secure grip even in high-heat sweaty vinyasa sessions.',
    categorySlug: 'sports',
    pricing: {
      mrp: 880000,          // ₹8,800
      sellingPrice: 720000,  // ₹7,200
      dealPrice: null,
      inwardPrice: 380000,  // ₹3,800
      deal: null,
    },
    stock: 50,
    lowStockThreshold: 8,
    images: [
      { id: 'img-yga-1', url: 'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?auto=format&fit=crop&w=1000&q=80', alt: 'Yoga Mat Studio Roll', order: 0 },
      { id: 'img-yga-2', url: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=1000&q=80', alt: 'Yoga Mat Alignment Lines', order: 1 },
    ],
    attributes: [
      { key: 'Thickness', value: '5mm Cushion' },
      { key: 'Material', value: 'FSC-Certified Natural Rubber & Polyurethane' },
      { key: 'Weight', value: '2.38 kg' },
    ],
    variants: [
      { id: 'var-yga-blk', sku: 'LLM-YGA-5MM-BLK', attributes: [{ key: 'Color', value: 'Black Marble' }], stock: 30 },
      { id: 'var-yga-grn', sku: 'LLM-YGA-5MM-GRN', attributes: [{ key: 'Color', value: 'Sage Green' }], stock: 20 },
    ],
    status: 'active' as const,
    isPublished: true,
  },

  // 10. Clean Code & Architecture Hardcover Set
  {
    name: 'Clean Craftsmanship & Architecture Hardcover Collector Edition',
    sku: 'PRN-CLN-SET',
    brand: 'Prentice Hall',
    shortDescription: 'The definitive Robert C. Martin collector edition detailing clean agile craftsmanship, testing disciplines, and architecture.',
    longDescription: 'A timeless masterwork for software engineers and architects. Covers test-driven development, agile discipline, SOLID design principles, and enterprise component boundaries with practical case studies.',
    categorySlug: 'books',
    pricing: {
      mrp: 550000,          // ₹5,500
      sellingPrice: 420000,  // ₹4,200
      dealPrice: 360000,    // ₹3,600
      inwardPrice: 210000,  // ₹2,100
      deal: {
        isActive: true,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        maxQtyPerOrder: 5,
      },
    },
    stock: 95,
    lowStockThreshold: 15,
    images: [
      { id: 'img-bk-1', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1000&q=80', alt: 'Clean Code Hardcover Open', order: 0 },
      { id: 'img-bk-2', url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1000&q=80', alt: 'Books Stacked on Wood Desk', order: 1 },
    ],
    attributes: [
      { key: 'Format', value: 'Linen Cloth Hardcover with Ribbon Bookmark' },
      { key: 'Pages', value: '464 Pages' },
      { key: 'Language', value: 'English' },
    ],
    variants: [],
    status: 'active' as const,
    isPublished: true,
  },

  // 11. Bose QuietComfort Ultra Wireless Earbuds
  {
    name: 'Bose QuietComfort Ultra True Wireless Noise-Cancelling Earbuds',
    sku: 'BSE-QCU-EAR',
    brand: 'Bose',
    shortDescription: 'Breakthrough spatialized audio with CustomTune calibration and world-class quiet acoustic cancellation.',
    longDescription: 'What you are hearing is placed just in front of you, so it sounds like you are not wearing earbuds at all. Bose Immersive Audio pushes the boundary of what it means to listen, paired with CustomTune technology that measures your ear canal acoustics automatically.',
    categorySlug: 'electronics',
    pricing: {
      mrp: 2990000,         // ₹29,900
      sellingPrice: 2590000, // ₹25,900
      dealPrice: 2290000,    // ₹22,900
      inwardPrice: 1700000,  // ₹17,000
      deal: {
        isActive: true,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        maxQtyPerOrder: 2,
      },
    },
    stock: 38,
    lowStockThreshold: 5,
    images: [
      { id: 'img-bse-1', url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1000&q=80', alt: 'Wireless Earbuds in Charging Case', order: 0 },
      { id: 'img-bse-2', url: 'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?auto=format&fit=crop&w=1000&q=80', alt: 'Bose Earbud Detail', order: 1 },
    ],
    attributes: [
      { key: 'Battery Life', value: 'Up to 6 hours (24 hrs with case)' },
      { key: 'Noise Cancellation', value: 'Bose CustomTune & QuietMode' },
      { key: 'Water Rating', value: 'IPX4 Sweat Resistant' },
    ],
    variants: [
      { id: 'var-bse-blk', sku: 'BSE-QCU-EAR-BLK', attributes: [{ key: 'Color', value: 'Black' }], stock: 20 },
      { id: 'var-bse-wht', sku: 'BSE-QCU-EAR-WHT', attributes: [{ key: 'Color', value: 'White Smoke' }], stock: 18 },
    ],
    status: 'active' as const,
    isPublished: true,
  },

  // 12. Artisan Chef Damascus Santoku Knife 7"
  {
    name: 'Sakai 67-Layer VG-10 Damascus Steel 7" Santoku Knife',
    sku: 'SKI-DM-7SAN',
    brand: 'Sakai Takayuki',
    shortDescription: 'Japanese handcrafted chef santoku knife forged from 67 layers of VG-10 high carbon Damascus steel with octagonal Pakkawood handle.',
    longDescription: 'Forged by master blacksmiths in Sakai, Japan. The VG-10 core is vacuum heat-treated to 60-62 HRC for razor-sharp edge retention. Ideal for slicing, dicing, and mincing with effortless balance and non-stick hammered tsuchime finish.',
    categorySlug: 'home-kitchen',
    pricing: {
      mrp: 1499000,         // ₹14,990
      sellingPrice: 1199000, // ₹11,990
      dealPrice: null,
      inwardPrice: 720000,   // ₹7,200
      deal: null,
    },
    stock: 19,
    lowStockThreshold: 4,
    images: [
      { id: 'img-knf-1', url: 'https://images.unsplash.com/photo-1593618998160-e34014e67546?auto=format&fit=crop&w=1000&q=80', alt: 'Japanese Damascus Chef Knife', order: 0 },
      { id: 'img-knf-2', url: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=1000&q=80', alt: 'Damascus Blade Pattern Macro', order: 1 },
    ],
    attributes: [
      { key: 'Steel Core', value: 'Japanese VG-10 Super Steel' },
      { key: 'Hardness', value: '60±2 HRC' },
      { key: 'Blade Length', value: '7 Inches (180mm)' },
    ],
    variants: [],
    status: 'active' as const,
    isPublished: true,
  },
];

async function seed(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
  const dbName = process.env.PRODUCT_DB_NAME ?? 'ornate_products';

  log.info({ dbName }, 'Starting comprehensive catalog seeding on MongoDB Atlas...');
  await connectDB(uri, dbName);

  // 1. Wipe existing categories & products for a clean slate
  log.info('Clearing old categories and products...');
  await Promise.all([
    Category.deleteMany({}),
    Product.deleteMany({}),
    SearchIndexEvent.deleteMany({}),
  ]);

  // 2. Insert Categories
  log.info('Inserting 6 rich categories...');
  const categoryDocs = await Category.insertMany(categories);
  const categoryMap = new Map(categoryDocs.map((c) => [c.slug, c._id]));

  // 3. Prepare & Insert Products
  log.info(`Inserting ${products.length} flagship products...`);
  const productDocs = products.map((p) => {
    const categoryId = categoryMap.get(p.categorySlug);
    if (!categoryId) {
      throw new Error(`Category not found for slug: ${p.categorySlug}`);
    }

    const { categorySlug, ...rest } = p;
    const slug = `${p.brand.toLowerCase()}-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

    return {
      ...rest,
      slug,
      category: categoryId,
      status: 'active' as const,
      isPublished: true,
      priceHistory: [
        {
          changedBy: 'System Catalog Seeder',
          changedAt: new Date(),
          snapshot: p.pricing,
        },
      ],
    };
  });

  const insertedProducts = await Product.insertMany(productDocs);
  log.info({ count: insertedProducts.length }, 'Successfully seeded flagship products!');

  // 4. Create search sync events
  const searchEvents = insertedProducts.map((p) => ({
    productId: p._id.toString(),
    action: 'upsert' as const,
    status: 'pending' as const,
  }));
  await SearchIndexEvent.insertMany(searchEvents);
  log.info('Queued search indexing events.');

  await disconnectDB();
  log.info('Catalog seeding finished cleanly.');
}

seed().catch((err) => {
  log.error({ err }, 'Seeding failed');
  process.exit(1);
});
