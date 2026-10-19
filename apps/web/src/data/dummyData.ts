import type { PublicProduct, SearchResult, SearchSuggestion } from '@ornate/types';

export interface DummyCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  order: number;
  image?: string;
}

export const DUMMY_CATEGORIES: DummyCategory[] = [
  {
    id: 'cat-electronics',
    name: 'Electronics & Audio',
    slug: 'electronics',
    description: 'Flagship headphones, mechanical gear, and premium personal audio.',
    order: 1,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'cat-clothing',
    name: 'Fashion & Apparel',
    slug: 'clothing',
    description: 'Tailored luxury essentials, heavyweight cotton tees, and designer outerwear.',
    order: 2,
    image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'cat-accessories',
    name: 'Watches & Accessories',
    slug: 'accessories',
    description: 'Precision timepieces, Italian leather wallets, and everyday luxury carry.',
    order: 3,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'cat-home-kitchen',
    name: 'Home, Living & Coffee',
    slug: 'home-kitchen',
    description: 'Specialty pour-over coffee makers, ergonomic living, and artisan homeware.',
    order: 4,
    image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'cat-sports',
    name: 'Fitness & Outdoors',
    slug: 'sports',
    description: 'Performance running shoes, high-density yoga mats, and recovery tech.',
    order: 5,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'cat-books',
    name: 'Books & Stationery',
    slug: 'books',
    description: 'Hardcover architecture, software craftsmanship, and premium journals.',
    order: 6,
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
  },
];

// All prices in paise (INR). 100 paise = ₹1.
export const DUMMY_PRODUCTS: PublicProduct[] = [
  // 1. Sony WH-1000XM5
  {
    id: 'prod-sny-wh-xm5',
    name: 'Sony WH-1000XM5 Wireless Noise-Cancelling Headphones',
    slug: 'sony-sony-wh-1000xm5-wireless-noise-cancelling-headphones',
    sku: 'SNY-WH-XM5-BLK',
    brand: 'Sony',
    shortDescription: 'Industry-leading noise cancellation with 8 microphones, 30-hour battery life, and crystal clear hands-free calling.',
    longDescription: 'The Sony WH-1000XM5 redefines distraction-free listening. Two processors control eight microphones for unprecedented noise cancellation and exceptional call quality. Newly developed 30mm precision-engineered drivers provide natural sound with high-res audio certification.',
    categoryId: 'cat-electronics',
    categoryName: 'Electronics & Audio',
    pricing: {
      applicablePrice: 2599000, // ₹25,990
      mrp: 3499000,             // ₹34,990
      sellingPrice: 2899000,    // ₹28,990
      dealPrice: 2599000,
      dealActive: true,
      savingsAmount: 900000,    // ₹9,000
      savingsPercent: 26,
    },
    stock: 42,
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
    status: 'active',
    isPublished: true,
    seoTitle: 'Sony WH-1000XM5 Noise Cancelling Headphones - Premium Audio',
    seoDescription: 'Shop the flagship Sony WH-1000XM5 with industry-leading active noise cancellation.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // 2. Apple Watch Ultra 2
  {
    id: 'prod-apl-wch-ult2',
    name: 'Apple Watch Ultra 2 GPS + Cellular 49mm Titanium',
    slug: 'apple-apple-watch-ultra-2-gps-cellular-49mm-titanium',
    sku: 'APL-WCH-ULT2',
    brand: 'Apple',
    shortDescription: 'Rugged and capable, built for endurance athletes, outdoor adventurers, and ocean explorers with 3000-nit display.',
    longDescription: 'The most capable and rugged Apple Watch pushes the limits again. Featuring the all-new S9 SiP, a magical new double tap gesture, and a brighter display. Up to 36 hours of normal battery life and up to 72 hours in Low Power Mode.',
    categoryId: 'cat-accessories',
    categoryName: 'Watches & Accessories',
    pricing: {
      applicablePrice: 8490000, // ₹84,900
      mrp: 8990000,             // ₹89,900
      sellingPrice: 8490000,
      dealPrice: null,
      dealActive: false,
      savingsAmount: 500000,    // ₹5,000
      savingsPercent: 6,
    },
    stock: 18,
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
    status: 'active',
    isPublished: true,
    seoTitle: 'Apple Watch Ultra 2 GPS + Cellular 49mm Titanium',
    seoDescription: 'The ultimate sports watch crafted with aerospace titanium.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // 3. Keychron Q1 Pro
  {
    id: 'prod-kcr-q1p',
    name: 'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
    slug: 'keychron-keychron-q1-pro-wireless-custom-mechanical-keyboard',
    sku: 'KCR-Q1P-KBN',
    brand: 'Keychron',
    shortDescription: 'Full aluminum CNC 75% mechanical keyboard with hot-swappable switches, double-gasket mount, and QMK/VIA support.',
    longDescription: 'Engineered for uncompromising typing feel and acoustics. The Keychron Q1 Pro features a full metal body machined from 6063 aluminum, double-gasket mounting design, pre-lubed mechanical switches, and seamless Bluetooth 5.1 / wired USB connectivity.',
    categoryId: 'cat-electronics',
    categoryName: 'Electronics & Audio',
    pricing: {
      applicablePrice: 1399000, // ₹13,990
      mrp: 1899000,             // ₹18,990
      sellingPrice: 1549000,    // ₹15,490
      dealPrice: 1399000,
      dealActive: true,
      savingsAmount: 500000,    // ₹5,000
      savingsPercent: 26,
    },
    stock: 28,
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
    status: 'active',
    isPublished: true,
    seoTitle: 'Keychron Q1 Pro Custom Mechanical Keyboard',
    seoDescription: 'Premium wireless CNC machined mechanical keyboard.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // 4. Herman Miller Aeron Chair
  {
    id: 'prod-hml-arn',
    name: 'Herman Miller Aeron Ergonomic Office Chair - Graphite',
    slug: 'herman-miller-herman-miller-aeron-ergonomic-office-chair-graphite',
    sku: 'HML-ARN-GPH',
    brand: 'Herman Miller',
    shortDescription: 'The pinnacle of ergonomic seating with Pellicle 8Z breathable suspension and PostureFit SL adjustable back support.',
    longDescription: 'Pioneered by Bill Stumpf and Don Chadwick, Aeron has remained the undisputed gold standard of ergonomic chairs for 30 years. Features dynamic 8Z Pellicle mesh that varies tension across eight zones to eliminate pressure points, forward tilt mechanism, and 12-year warranty.',
    categoryId: 'cat-home-kitchen',
    categoryName: 'Home, Living & Coffee',
    pricing: {
      applicablePrice: 12900000,// ₹1,29,000
      mrp: 14500000,            // ₹1,45,000
      sellingPrice: 12900000,
      dealPrice: null,
      dealActive: false,
      savingsAmount: 1600000,   // ₹16,000
      savingsPercent: 11,
    },
    stock: 12,
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
    status: 'active',
    isPublished: true,
    seoTitle: 'Herman Miller Aeron Ergonomic Chair - Graphite Edition',
    seoDescription: 'Invest in unmatched lumbar ergonomics and breathable Pellicle mesh.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // 5. Nike Invincible 3 Running Shoes
  {
    id: 'prod-nke-inv',
    name: 'Nike ZoomX Invincible Run FK 3 Road Running Shoes',
    slug: 'nike-nike-zoomx-invincible-run-fk-3-road-running-shoes',
    sku: 'NKE-INV-003',
    brand: 'Nike',
    shortDescription: 'Maximum cushioning engineered to support every mile. Loaded with ultralight ZoomX foam for maximum bounce and energy return.',
    longDescription: 'With maximum cushioning to support every stride, the Invincible 3 gives you the highest level of comfort underfoot to help you stay on your feet today, tomorrow and beyond. Rocker-shaped ZoomX foam midsole cushions high impacts and propels you forward.',
    categoryId: 'cat-sports',
    categoryName: 'Fitness & Outdoors',
    pricing: {
      applicablePrice: 1199500, // ₹11,995
      mrp: 1699500,             // ₹16,995
      sellingPrice: 1349500,    // ₹13,495
      dealPrice: 1199500,
      dealActive: true,
      savingsAmount: 500000,    // ₹5,000
      savingsPercent: 29,
    },
    stock: 65,
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
    status: 'active',
    isPublished: true,
    seoTitle: 'Nike ZoomX Invincible Run 3 - Max Cushion Road Running',
    seoDescription: 'Experience unparalleled bounce and joint protection with ZoomX.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // 6. Fellow Ode Gen 2 Coffee Grinder
  {
    id: 'prod-flw-ode',
    name: 'Fellow Ode Gen 2 Brew Coffee Grinder - Matte Black',
    slug: 'fellow-fellow-ode-gen-2-brew-coffee-grinder-matte-black',
    sku: 'FLW-ODE-G2-BLK',
    brand: 'Fellow',
    shortDescription: 'Award-winning electric burr grinder with 64mm commercial-grade flat burrs and 31 precise grind settings.',
    longDescription: 'Ode Gen 2 transforms coffee mornings into cafe experiences. Engineered specifically for pour-over, French press, drip, and cold brew with professional-grade 64mm stainless steel flat burrs, ionizer anti-static technology, and quiet auto-stop operation.',
    categoryId: 'cat-home-kitchen',
    categoryName: 'Home, Living & Coffee',
    pricing: {
      applicablePrice: 2890000, // ₹28,900
      mrp: 3250000,             // ₹32,500
      sellingPrice: 2890000,
      dealPrice: null,
      dealActive: false,
      savingsAmount: 360000,    // ₹3,600
      savingsPercent: 11,
    },
    stock: 22,
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
    status: 'active',
    isPublished: true,
    seoTitle: 'Fellow Ode Gen 2 Brew Coffee Grinder - Matte Black',
    seoDescription: 'Precision 64mm flat burrs for exquisite filter coffee extraction.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // 7. Bellroy Tokyo Totepack
  {
    id: 'prod-bly-tky',
    name: 'Bellroy Tokyo Totepack - Premium Water-Resistant Canvas & Leather',
    slug: 'bellroy-bellroy-tokyo-totepack-premium-water-resistant-canvas-leather',
    sku: 'BLY-TKY-TOT',
    brand: 'Bellroy',
    shortDescription: 'Dual-carry backpack and tote with padded 15" laptop sleeve, pop pockets for water bottle, and environmentally certified leather.',
    longDescription: 'Casual when you want it, professional when you need it. The Tokyo Totepack lets you tuck the backpack straps away and carry it comfortably as a tote, or wear it on your back for hands-free commuting across cities.',
    categoryId: 'cat-accessories',
    categoryName: 'Watches & Accessories',
    pricing: {
      applicablePrice: 1490000, // ₹14,900
      mrp: 1950000,             // ₹19,500
      sellingPrice: 1690000,    // ₹16,900
      dealPrice: 1490000,
      dealActive: true,
      savingsAmount: 460000,    // ₹4,600
      savingsPercent: 24,
    },
    stock: 34,
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
    status: 'active',
    isPublished: true,
    seoTitle: 'Bellroy Tokyo Totepack - Urban Dual Mode Carry',
    seoDescription: 'Versatile tote and backpack hybrid made with eco-tanned leather.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // 8. Threadsmith Heavyweight Hoodie
  {
    id: 'prod-tsm-hdy',
    name: 'Threadsmith 450GSM Heavyweight French Terry Hoodie',
    slug: 'threadsmith-threadsmith-450gsm-heavyweight-french-terry-hoodie',
    sku: 'TSM-HDY-450',
    brand: 'Threadsmith',
    shortDescription: 'Custom-milled 100% organic cotton 450GSM loopback French Terry hoodie with drop shoulders and double-layered hood.',
    longDescription: 'Crafted without compromises from 450GSM combed organic cotton. Featuring a relaxed drop-shoulder silhouette, thick 2x2 ribbed cuffs, kangaroo pocket with concealed interior phone sleeve, and preshrunk wash treatment.',
    categoryId: 'cat-clothing',
    categoryName: 'Fashion & Apparel',
    pricing: {
      applicablePrice: 399000,  // ₹3,990
      mrp: 650000,              // ₹6,500
      sellingPrice: 480000,     // ₹4,800
      dealPrice: 399000,
      dealActive: true,
      savingsAmount: 251000,    // ₹2,510
      savingsPercent: 39,
    },
    stock: 85,
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
    status: 'active',
    isPublished: true,
    seoTitle: 'Threadsmith 450GSM Heavyweight Loopback Hoodie',
    seoDescription: 'Ultra heavy 100% organic cotton hoodie with tailored modern drape.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // 9. Lululemon Yoga Mat
  {
    id: 'prod-llm-yga',
    name: 'Lululemon 5mm Studio Reversible Yoga Mat',
    slug: 'lululemon-lululemon-5mm-studio-reversible-yoga-mat',
    sku: 'LLM-YGA-5MM',
    brand: 'Lululemon',
    shortDescription: 'Natural rubber base mat with textured polyurethane top layer for extraordinary wet and dry grip during intense practices.',
    longDescription: 'Designed for yoga, pilates and mindful movement. Made with natural rubber that cushions joints while the innovative top layer absorbs sweat to maintain a secure grip even in high-heat sweaty vinyasa sessions.',
    categoryId: 'cat-sports',
    categoryName: 'Fitness & Outdoors',
    pricing: {
      applicablePrice: 720000,  // ₹7,200
      mrp: 880000,              // ₹8,800
      sellingPrice: 720000,
      dealPrice: null,
      dealActive: false,
      savingsAmount: 160000,    // ₹1,600
      savingsPercent: 18,
    },
    stock: 50,
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
    status: 'active',
    isPublished: true,
    seoTitle: 'Lululemon 5mm Reversible Yoga Mat - Anti-Slip Grip',
    seoDescription: 'Engineered for exceptional grip and joint cushioning.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // 10. Clean Craftsmanship Hardcover
  {
    id: 'prod-prn-cln',
    name: 'Clean Craftsmanship & Architecture Hardcover Collector Edition',
    slug: 'prentice-hall-clean-craftsmanship-architecture-hardcover-collector-edition',
    sku: 'PRN-CLN-SET',
    brand: 'Prentice Hall',
    shortDescription: 'The definitive Robert C. Martin collector edition detailing clean agile craftsmanship, testing disciplines, and architecture.',
    longDescription: 'A timeless masterwork for software engineers and architects. Covers test-driven development, agile discipline, SOLID design principles, and enterprise component boundaries with practical case studies.',
    categoryId: 'cat-books',
    categoryName: 'Books & Stationery',
    pricing: {
      applicablePrice: 360000,  // ₹3,600
      mrp: 550000,              // ₹5,500
      sellingPrice: 420000,     // ₹4,200
      dealPrice: 360000,
      dealActive: true,
      savingsAmount: 190000,    // ₹1,900
      savingsPercent: 35,
    },
    stock: 95,
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
    status: 'active',
    isPublished: true,
    seoTitle: 'Clean Craftsmanship Collector Edition - Robert C. Martin',
    seoDescription: 'The essential architecture and engineering guide in collector hardcover.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // 11. Bose QuietComfort Ultra Earbuds
  {
    id: 'prod-bse-qcu',
    name: 'Bose QuietComfort Ultra True Wireless Noise-Cancelling Earbuds',
    slug: 'bose-bose-quietcomfort-ultra-true-wireless-noise-cancelling-earbuds',
    sku: 'BSE-QCU-EAR',
    brand: 'Bose',
    shortDescription: 'Breakthrough spatialized audio with CustomTune calibration and world-class quiet acoustic cancellation.',
    longDescription: 'What you are hearing is placed just in front of you, so it sounds like you are not wearing earbuds at all. Bose Immersive Audio pushes the boundary of what it means to listen, paired with CustomTune technology that measures your ear canal acoustics automatically.',
    categoryId: 'cat-electronics',
    categoryName: 'Electronics & Audio',
    pricing: {
      applicablePrice: 2290000, // ₹22,900
      mrp: 2990000,             // ₹29,900
      sellingPrice: 2590000,    // ₹25,900
      dealPrice: 2290000,
      dealActive: true,
      savingsAmount: 700000,    // ₹7,000
      savingsPercent: 23,
    },
    stock: 38,
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
    status: 'active',
    isPublished: true,
    seoTitle: 'Bose QuietComfort Ultra Earbuds - Immersive Spatial Audio',
    seoDescription: 'World-class active noise cancellation with breakthrough Bose immersive sound.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // 12. Sakai Damascus Santoku Knife
  {
    id: 'prod-ski-dm',
    name: 'Sakai 67-Layer VG-10 Damascus Steel 7" Santoku Knife',
    slug: 'sakai-takayuki-sakai-67-layer-vg-10-damascus-steel-7-santoku-knife',
    sku: 'SKI-DM-7SAN',
    brand: 'Sakai Takayuki',
    shortDescription: 'Japanese handcrafted chef santoku knife forged from 67 layers of VG-10 high carbon Damascus steel with octagonal Pakkawood handle.',
    longDescription: 'Forged by master blacksmiths in Sakai, Japan. The VG-10 core is vacuum heat-treated to 60-62 HRC for razor-sharp edge retention. Ideal for slicing, dicing, and mincing with effortless balance and non-stick hammered tsuchime finish.',
    categoryId: 'cat-home-kitchen',
    categoryName: 'Home, Living & Coffee',
    pricing: {
      applicablePrice: 1199000, // ₹11,990
      mrp: 1499000,             // ₹14,990
      sellingPrice: 1199000,
      dealPrice: null,
      dealActive: false,
      savingsAmount: 300000,    // ₹3,000
      savingsPercent: 20,
    },
    stock: 19,
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
    status: 'active',
    isPublished: true,
    seoTitle: 'Sakai 67-Layer VG-10 Damascus Santoku Knife 7 Inch',
    seoDescription: 'Handcrafted Japanese culinary cutlery forged in Sakai, Japan.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

// Helper Functions
export function getDummyProductBySlug(slug: string): PublicProduct | undefined {
  if (!slug) return undefined;
  const normalized = slug.toLowerCase().trim();
  return DUMMY_PRODUCTS.find(
    (p) => p.slug === normalized || p.id === normalized || p.sku.toLowerCase() === normalized,
  );
}

export function getDummyProductById(id: string): PublicProduct | undefined {
  return DUMMY_PRODUCTS.find((p) => p.id === id);
}

export function getDummyCategoryBySlug(slug: string): DummyCategory | undefined {
  if (!slug) return undefined;
  const normalized = slug.toLowerCase().trim();
  return DUMMY_CATEGORIES.find((c) => c.slug === normalized || c.id === normalized);
}

export function getDummyProductsByCategory(catSlug: string): PublicProduct[] {
  const cat = getDummyCategoryBySlug(catSlug);
  if (!cat) return [];
  return DUMMY_PRODUCTS.filter((p) => p.categoryId === cat.id);
}

export interface DummySearchOptions {
  q?: string;
  category?: string;
  sort?: string;
  page?: number;
  limit?: number;
  inStock?: boolean;
  minPrice?: number; // in paise
  maxPrice?: number; // in paise
}

export function searchDummyProducts(opts: DummySearchOptions = {}): SearchResult {
  const {
    q = '',
    category = '',
    sort = 'newest',
    page = 1,
    limit = 12,
    inStock = false,
    minPrice,
    maxPrice,
  } = opts;

  let results = [...DUMMY_PRODUCTS];

  // Filter by search query
  if (q.trim()) {
    const term = q.toLowerCase().trim();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.brand?.toLowerCase().includes(term) ||
        p.shortDescription?.toLowerCase().includes(term) ||
        p.categoryName.toLowerCase().includes(term) ||
        p.attributes.some((a) => a.value.toLowerCase().includes(term)),
    );
  }

  // Filter by category
  if (category.trim()) {
    const cat = getDummyCategoryBySlug(category);
    if (cat) {
      results = results.filter((p) => p.categoryId === cat.id);
    }
  }

  // Filter by stock
  if (inStock) {
    results = results.filter((p) => p.stock > 0);
  }

  // Filter by price in paise
  if (typeof minPrice === 'number' && minPrice > 0) {
    results = results.filter((p) => p.pricing.applicablePrice >= minPrice);
  }
  if (typeof maxPrice === 'number' && maxPrice > 0) {
    results = results.filter((p) => p.pricing.applicablePrice <= maxPrice);
  }

  // Sort
  if (sort === 'price_asc') {
    results.sort((a, b) => a.pricing.applicablePrice - b.pricing.applicablePrice);
  } else if (sort === 'price_desc') {
    results.sort((a, b) => b.pricing.applicablePrice - a.pricing.applicablePrice);
  } else if (sort === 'newest') {
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * limit;
  const paginatedProducts = results.slice(startIndex, startIndex + limit);

  return {
    products: paginatedProducts,
    total,
    page: currentPage,
    totalPages,
    hasMore: currentPage < totalPages,
  };
}

export function getDummySuggestions(query: string): SearchSuggestion[] {
  if (!query || query.trim().length < 2) return [];
  const term = query.toLowerCase().trim();
  const suggestions: SearchSuggestion[] = [];

  // Match categories
  for (const cat of DUMMY_CATEGORIES) {
    if (cat.name.toLowerCase().includes(term)) {
      suggestions.push({
        type: 'category',
        label: cat.name,
        slug: cat.slug,
      });
    }
  }

  // Match products
  for (const prod of DUMMY_PRODUCTS) {
    if (prod.name.toLowerCase().includes(term) || prod.brand?.toLowerCase().includes(term)) {
      suggestions.push({
        type: 'product',
        label: prod.name,
        slug: prod.slug,
        image: prod.images[0]?.url,
      });
    }
    if (suggestions.length >= 8) break;
  }

  return suggestions;
}

export function resolveDummyApiFallback(urlStr: string) {
  if (!urlStr) return null;
  // normalize url: strip domain and /api/v1 prefix if present
  const cleanUrl = urlStr.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?api\/v1/, '');
  const [rawPath, queryString] = cleanUrl.split('?');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const params = new URLSearchParams(queryString || '');

  // 1. Search suggestions
  if (path === '/search/suggestions') {
    const q = params.get('q') || '';
    return { success: true, data: getDummySuggestions(q) };
  }

  // 2. Search
  if (path === '/search') {
    const q = params.get('q') || '';
    const category = params.get('category') || '';
    const sort = params.get('sort') || 'newest';
    const page = Number(params.get('page') || 1);
    const limit = Number(params.get('limit') || 12);
    const inStock = params.get('inStock') === 'true';
    const minPrice = params.has('minPrice') ? Number(params.get('minPrice')) : undefined;
    const maxPrice = params.has('maxPrice') ? Number(params.get('maxPrice')) : undefined;

    return {
      success: true,
      data: searchDummyProducts({ q, category, sort, page, limit, inStock, minPrice, maxPrice }),
    };
  }

  // 3. Single category: /categories/:slug
  const categoryMatch = path.match(/^\/categories\/([^/]+)$/);
  if (categoryMatch) {
    const slug = categoryMatch[1];
    const cat = getDummyCategoryBySlug(slug) || DUMMY_CATEGORIES[0];
    return { success: true, data: cat };
  }

  // 4. Categories list: /categories
  if (path === '/categories' || path === '/categories/') {
    return { success: true, data: DUMMY_CATEGORIES };
  }

  // 5. Single product: /products/:slug
  const productMatch = path.match(/^\/products\/([^/]+)$/);
  if (productMatch) {
    const slug = productMatch[1];
    const prod = getDummyProductBySlug(slug) || DUMMY_PRODUCTS[0];
    return { success: true, data: prod };
  }

  // 6. Products list: /products
  if (path === '/products' || path === '/products/') {
    const limit = Number(params.get('limit') || 12);
    return {
      success: true,
      data: {
        items: DUMMY_PRODUCTS.slice(0, limit),
        total: DUMMY_PRODUCTS.length,
      },
    };
  }

  return null;
}
