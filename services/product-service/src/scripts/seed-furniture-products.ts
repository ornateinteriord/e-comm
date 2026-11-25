import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '../../.env' });

import mongoose from 'mongoose';
import slugify from 'slugify';
import { Category } from '../models/category.model.js';
import { Product } from '../models/product.model.js';
import { allocateStockForProduct } from '../utils/stock-allocation.js';

interface SeedProductSpec {
  sku: string;
  name: string;
  brand: string;
  shortDescription: string;
  longDescription: string;
  mrpRupees: number;
  sellingRupees: number;
  inwardRupees: number;
  dealRupees?: number;
  stock: number;
  isFeatured?: boolean;
  imageUrl: string;
  attributes: Array<{ key: string; label: string; value: string }>;
}

const FURNITURE_CATALOG: Record<string, { description: string; products: SeedProductSpec[] }> = {
  'living-room-furniture': {
    description: 'Sofas, accent chairs, coffee tables, and modular living room seating.',
    products: [
      {
        sku: 'FRN-LIV-001',
        name: 'Nordic 3-Seater Solid Ash Fabric Sofa',
        brand: 'Urban Ladder',
        shortDescription: 'Deep-cushioned 3-seater linen-weave sofa on kiln-dried ash legs.',
        longDescription: 'Handcrafted solid ash wood frame paired with high-resilience 40D foam cushions and breathable stone-gray performance upholstery for everyday living spaces.',
        mrpRupees: 48999,
        sellingRupees: 37999,
        inwardRupees: 25500,
        dealRupees: 34999,
        stock: 14,
        isFeatured: true,
        imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'material', label: 'Frame', value: 'Solid Ash Wood & Woven Linen' },
          { key: 'dimensions', label: 'Dimensions', value: '212 x 88 x 78 cm' },
          { key: 'warranty', label: 'Warranty', value: '3 Years Structural Warranty' },
        ],
      },
      {
        sku: 'FRN-LIV-002',
        name: 'Kyoto Sheesham & Travertine Coffee Table',
        brand: 'Pepperfry Woods',
        shortDescription: 'Low-profile center table with slatted lower shelf and honed stone top.',
        longDescription: 'Seasoned Indian Sheesham wood base finished in warm honey matte polish paired with a rounded bevel stone top for magazines, trays, and daily entertaining.',
        mrpRupees: 18499,
        sellingRupees: 13999,
        inwardRupees: 9200,
        stock: 22,
        imageUrl: 'https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'material', label: 'Material', value: 'Solid Sheesham Wood' },
          { key: 'dimensions', label: 'Dimensions', value: '115 x 60 x 42 cm' },
        ],
      },
      {
        sku: 'FRN-LIV-003',
        name: 'Oslo Boucle Curved Lounge Accent Chair',
        brand: 'Atelier Living',
        shortDescription: 'Swivel-free sculpted bouclé armchair with walnut splayed base.',
        longDescription: 'Tactile cream bouclé upholstery wrapped around a steam-bent hardwood shell delivering ergonomic lumbar contour for reading corners and formal lounges.',
        mrpRupees: 24999,
        sellingRupees: 18999,
        inwardRupees: 12400,
        dealRupees: 17499,
        stock: 18,
        imageUrl: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'material', label: 'Upholstery', value: 'Textured Boucle Fabric' },
          { key: 'finish', label: 'Color', value: 'Warm Ivory' },
        ],
      },
      {
        sku: 'FRN-LIV-004',
        name: 'Milan 65-Inch Fluted Oak TV Media Console',
        brand: 'Hometown Craft',
        shortDescription: 'Sliding tambour media unit with concealed cable routing ports.',
        longDescription: 'Engineered white oak veneer TV stand featuring twin fluted tambour doors, adjustable inner shelves, and rear ventilation cutouts for AV receivers and consoles.',
        mrpRupees: 29999,
        sellingRupees: 22999,
        inwardRupees: 15200,
        stock: 16,
        imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'material', label: 'Material', value: 'White Oak Veneer & Engineered Wood' },
          { key: 'tvSize', label: 'Supports TVs Up To', value: '75 Inches' },
        ],
      },
    ],
  },
  'bedroom-furniture': {
    description: 'Solid wood platform beds, upholstered headboards, nightstands, and dressers.',
    products: [
      {
        sku: 'FRN-BED-001',
        name: 'Alps Hydraulic Storage Queen Bed (Teak Finish)',
        brand: 'Wakefit Home',
        shortDescription: 'Pneumatic lift-up queen bed with 920L under-mattress storage bay.',
        longDescription: 'Heavy-duty steel lift pistons effortlessly raise the orthopedic birch-slat mattress deck to expose dust-sealed compartment storage underneath.',
        mrpRupees: 39999,
        sellingRupees: 29999,
        inwardRupees: 20500,
        dealRupees: 27499,
        stock: 15,
        isFeatured: true,
        imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'size', label: 'Mattress Fit', value: 'Queen (78 x 60 Inches)' },
          { key: 'storage', label: 'Storage', value: 'Hydraulic Box Storage' },
        ],
      },
      {
        sku: 'FRN-BED-002',
        name: 'Haven Upholstered King Platform Bed',
        brand: 'Urban Ladder',
        shortDescription: 'Tufted linen wingback headboard with quiet slatted hardwood support.',
        longDescription: 'Noise-free interlocking steel corners and solid rubberwood frame clad in stain-resistant oatmeal fabric, styled with tall cushioned wingback pillows.',
        mrpRupees: 45999,
        sellingRupees: 35999,
        inwardRupees: 24200,
        stock: 12,
        imageUrl: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'size', label: 'Mattress Fit', value: 'King (78 x 72 Inches)' },
          { key: 'material', label: 'Upholstery', value: 'Oatmeal Performance Linen' },
        ],
      },
      {
        sku: 'FRN-BED-003',
        name: 'Soren Two-Drawer Rattan Bedside Nightstand',
        brand: 'Pepperfry Woods',
        shortDescription: 'Warm walnut bedside table with woven cane drawer fronts and brass pulls.',
        longDescription: 'Soft-close telescopic runner drawers topped with an open cubby for bedside books, lamps, and overnight charging cables.',
        mrpRupees: 11999,
        sellingRupees: 8499,
        inwardRupees: 5400,
        stock: 30,
        imageUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'material', label: 'Material', value: 'Acacia Wood & Natural Rattan Cane' },
          { key: 'dimensions', label: 'Dimensions', value: '48 x 40 x 56 cm' },
        ],
      },
      {
        sku: 'FRN-BED-004',
        name: 'Vogue 6-Drawer Wide Oak Bedroom Dresser',
        brand: 'Hometown Craft',
        shortDescription: 'Extra-wide horizontal chest of drawers with beveled edge pulls.',
        longDescription: 'Six full-extension gliding drawers reinforced with dual center brackets to store heavy winter knitwear, linens, and folded garments without sagging.',
        mrpRupees: 32999,
        sellingRupees: 24999,
        inwardRupees: 16800,
        stock: 14,
        imageUrl: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'drawers', label: 'Drawers', value: '6 Soft-Close Drawers' },
          { key: 'dimensions', label: 'Dimensions', value: '145 x 45 x 82 cm' },
        ],
      },
    ],
  },
  'dining-room-furniture': {
    description: 'Dining tables, upholstered dining chairs, benches, and crockery buffets.',
    products: [
      {
        sku: 'FRN-DIN-001',
        name: 'Verona 6-Seater Solid Mango Wood Dining Set',
        brand: 'Pepperfry Woods',
        shortDescription: 'Spacious 6-person dining table with 6 cushioned solid-wood chairs.',
        longDescription: 'Hand-rubbed provincial walnut stain brings out rich grain variation across seasoned mango wood planks, bundled with six ergonomic slat-back chairs.',
        mrpRupees: 52999,
        sellingRupees: 41999,
        inwardRupees: 28900,
        dealRupees: 38999,
        stock: 11,
        isFeatured: true,
        imageUrl: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'capacity', label: 'Seating Capacity', value: '6 Seater (Table + 6 Chairs)' },
          { key: 'material', label: 'Wood', value: 'Solid Mango Wood' },
        ],
      },
      {
        sku: 'FRN-DIN-002',
        name: 'Tuscany Sintered Marble 4-Seater Dining Table',
        brand: 'Urban Ladder',
        shortDescription: 'Scratch-resistant ceramic stone top over brushed brass steel base.',
        longDescription: 'Stain-proof Italian-inspired Carrara sintered stone tabletop withstands hot cookware effortlessly while seating four comfortably in compact dining nooks.',
        mrpRupees: 34999,
        sellingRupees: 26999,
        inwardRupees: 18200,
        stock: 16,
        imageUrl: 'https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'top', label: 'Top Material', value: '12mm Sintered Marble Stone' },
          { key: 'capacity', label: 'Seating Capacity', value: '4 Seater' },
        ],
      },
      {
        sku: 'FRN-DIN-003',
        name: 'Copenhagen Cognac Vegan Leather Dining Chairs (Set of 2)',
        brand: 'Atelier Living',
        shortDescription: 'Curved matte-black frame chairs with stitched cognac seat pads.',
        longDescription: 'Sold as a matched pair with powder-coated tubular steel frames and wipe-clean cognac faux leather contoured cushions.',
        mrpRupees: 14999,
        sellingRupees: 11499,
        inwardRupees: 7300,
        stock: 28,
        imageUrl: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'pack', label: 'Set Quantity', value: 'Set of 2 Chairs' },
          { key: 'seatHeight', label: 'Seat Height', value: '46 cm' },
        ],
      },
      {
        sku: 'FRN-DIN-004',
        name: 'Bistro Sheesham Crockery & Wine Sideboard',
        brand: 'Hometown Craft',
        shortDescription: '4-door buffet cabinet with built-in wine bottle cubbies and glassware shelf.',
        longDescription: 'Solid wood dining sideboard organizing dinnerware stacks, linen napkins, and stemware while doubling as a generous buffet serving surface.',
        mrpRupees: 28999,
        sellingRupees: 21999,
        inwardRupees: 14600,
        stock: 13,
        imageUrl: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'material', label: 'Material', value: 'Sheesham Hardwood' },
          { key: 'dimensions', label: 'Dimensions', value: '150 x 45 x 85 cm' },
        ],
      },
    ],
  },
  'office-furniture': {
    description: 'Ergonomic task chairs, sit-stand desks, conference tables, and work-from-home stations.',
    products: [
      {
        sku: 'FRN-OFF-001',
        name: 'Apex Pro Mesh Ergonomic Office Chair',
        brand: 'Featherlite Studio',
        shortDescription: '4D armrests, dynamic lumbar tension, and breathable Korean elastomer mesh.',
        longDescription: 'Engineered for 10+ hour workdays with synchro-tilt 135-degree recline lock, seat-depth slider, Class-4 BIFMA gas lift, and quiet PU casters.',
        mrpRupees: 24999,
        sellingRupees: 17999,
        inwardRupees: 11500,
        dealRupees: 15999,
        stock: 35,
        isFeatured: true,
        imageUrl: 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'adjustments', label: 'Adjustments', value: '4D Arms, Seat Depth & Lumbar' },
          { key: 'warranty', label: 'Warranty', value: '3 Years Mechanism & Gas Lift' },
        ],
      },
      {
        sku: 'FRN-OFF-002',
        name: 'Stride Dual-Motor Electric Standing Desk (140x70 cm)',
        brand: 'Wakefit Home',
        shortDescription: 'Whisper-quiet dual motor frame with 4 memory height presets and walnut top.',
        longDescription: 'Transitions smoothly between 65 cm and 128 cm at 38 mm/sec with anti-collision sensor protection, steel cable tray, and headphone hook.',
        mrpRupees: 34999,
        sellingRupees: 26999,
        inwardRupees: 18500,
        stock: 20,
        imageUrl: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'motors', label: 'Actuators', value: 'Dual Motor (<45 dB)' },
          { key: 'desktop', label: 'Top Size', value: '140 x 70 cm Acoustic Walnut' },
        ],
      },
      {
        sku: 'FRN-OFF-003',
        name: 'Studio Architect Solid Oak Writing Desk',
        brand: 'Urban Ladder',
        shortDescription: 'Tapered-leg work desk with dual pencil drawers and monitor riser shelf.',
        longDescription: 'Clean Scandinavian workspace proportions crafted from solid oak with satin matte lacquer resisting coffee rings and daily writing wear.',
        mrpRupees: 21999,
        sellingRupees: 16499,
        inwardRupees: 10900,
        stock: 24,
        imageUrl: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'material', label: 'Material', value: 'Solid European Oak' },
          { key: 'dimensions', label: 'Dimensions', value: '130 x 65 x 76 cm' },
        ],
      },
      {
        sku: 'FRN-OFF-004',
        name: 'Vault 3-Drawer Lockable Under-Desk Metal Pedestal',
        brand: 'Featherlite Studio',
        shortDescription: 'Pre-assembled powder-coated steel filing cabinet on 5 anti-tilt casters.',
        longDescription: 'Fits cleanly underneath standard desks with central single-key lock, A4/Legal suspension file rails, and stationery organizer tray.',
        mrpRupees: 9499,
        sellingRupees: 6999,
        inwardRupees: 4400,
        stock: 40,
        imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'security', label: 'Lock', value: 'Central Key Lock (2 Keys)' },
          { key: 'material', label: 'Body', value: 'Cold-Rolled Powder Steel' },
        ],
      },
    ],
  },
  'outdoor-furniture': {
    description: 'Weatherproof patio loungers, balcony bistro sets, garden benches, and rattan swings.',
    products: [
      {
        sku: 'FRN-OUT-001',
        name: 'Riviera All-Weather Wicker 4-Piece Patio Set',
        brand: 'Nilkamal Patio',
        shortDescription: 'UV-stabilized PE rattan loveseat, 2 armchairs, and tempered glass table.',
        longDescription: 'Built around a rustproof powder-coated aluminum skeleton wrapped in hand-woven HDPE wicker with quick-dry hydrophobic foam cushions.',
        mrpRupees: 38999,
        sellingRupees: 29499,
        inwardRupees: 19600,
        dealRupees: 26999,
        stock: 14,
        isFeatured: true,
        imageUrl: 'https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'weatherproof', label: 'Resistance', value: 'UV & Rain Resistant HDPE Wicker' },
          { key: 'pieces', label: 'Set Pieces', value: '4 Pieces + Washable Cushions' },
        ],
      },
      {
        sku: 'FRN-OUT-002',
        name: 'Breeze Eucalyptus Folding Balcony Bistro Set',
        brand: 'Urban Ladder',
        shortDescription: 'Compact 2-chair + round café table folding set for urban balconies.',
        longDescription: 'FSC-certified oiled eucalyptus hardwood folds flat in seconds for monsoon storage while bringing warm terrace café charm to compact apartments.',
        mrpRupees: 13999,
        sellingRupees: 9999,
        inwardRupees: 6500,
        stock: 25,
        imageUrl: 'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'material', label: 'Timber', value: 'FSC Oiled Eucalyptus Wood' },
          { key: 'foldable', label: 'Portability', value: 'Flat-Fold Space Saver' },
        ],
      },
      {
        sku: 'FRN-OUT-003',
        name: 'Cocoon Hanging Egg Swing Chair with Stand',
        brand: 'Nilkamal Patio',
        shortDescription: 'Freestanding steel tripod basket swing with plush tufted pillow set.',
        longDescription: 'Supports up to 135 kg comfortably on a galvanized heavy-gauge steel stand suitable for terraces, sunlit verandas, and garden lawns.',
        mrpRupees: 19999,
        sellingRupees: 14499,
        inwardRupees: 9300,
        stock: 19,
        imageUrl: 'https://images.unsplash.com/photo-1519947486511-46149fa0a254?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'capacity', label: 'Max Load', value: '135 kg Static Weight' },
          { key: 'stand', label: 'Mount', value: 'Powder-Coated Freestanding Base' },
        ],
      },
      {
        sku: 'FRN-OUT-004',
        name: 'Solstice Reclining Teak Sun Lounger',
        brand: 'Atelier Living',
        shortDescription: '5-position backrest outdoor pool lounger with smooth transport wheels.',
        longDescription: 'Slatted Grade-A plantation teak lounger featuring a slide-out drink coaster tray and multi-angle reclining notch support.',
        mrpRupees: 24999,
        sellingRupees: 18499,
        inwardRupees: 12100,
        stock: 15,
        imageUrl: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'positions', label: 'Recline', value: '5 Backrest Angles (Flat to 70°)' },
          { key: 'material', label: 'Wood', value: 'Seasoned Teak Wood' },
        ],
      },
    ],
  },
  'storage-furniture': {
    description: 'Sliding wardrobes, open bookshelves, shoe cabinets, and modular organizers.',
    products: [
      {
        sku: 'FRN-STR-001',
        name: 'Monarch 3-Door Mirror Wardrobe with Drawers',
        brand: 'Wakefit Home',
        shortDescription: 'Full-length dressing mirror wardrobe with hanging rails and lockable safe drawer.',
        longDescription: 'Moisture-resistant 18mm engineered board engineered with dual brushed steel garment rods, five deep shelving bays, and smooth Euro hinges.',
        mrpRupees: 35999,
        sellingRupees: 26499,
        inwardRupees: 17900,
        dealRupees: 24499,
        stock: 14,
        isFeatured: true,
        imageUrl: 'https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'doors', label: 'Configuration', value: '3-Door + External Lock Drawer' },
          { key: 'dimensions', label: 'Dimensions', value: '120 x 52 x 195 cm' },
        ],
      },
      {
        sku: 'FRN-STR-002',
        name: 'Athena 5-Tier Ladder Steel & Walnut Bookcase',
        brand: 'Urban Ladder',
        shortDescription: 'Open architectural shelving rack for art books, vinyl records, and planters.',
        longDescription: 'Matte black steel uprights anchor five graduated warm walnut shelves capable of holding 25 kg per tier without wall drilling.',
        mrpRupees: 12499,
        sellingRupees: 8999,
        inwardRupees: 5700,
        stock: 32,
        imageUrl: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'shelves', label: 'Tiers', value: '5 Open Shelves' },
          { key: 'load', label: 'Per Shelf Load', value: '25 kg' },
        ],
      },
      {
        sku: 'FRN-STR-003',
        name: 'Entryway 18-Pair Ventilated Shoe Cabinet with Bench',
        brand: 'Hometown Craft',
        shortDescription: 'Slatted double-door foyer organizer with cushioned seating top.',
        longDescription: 'Built-in breathable air vents prevent footwear odor while adjustable tilted shelves accommodate sneakers, heels, and ankle boots.',
        mrpRupees: 15999,
        sellingRupees: 11999,
        inwardRupees: 7800,
        stock: 26,
        imageUrl: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'capacity', label: 'Capacity', value: 'Up to 18 Pairs + Top Bench' },
          { key: 'dimensions', label: 'Dimensions', value: '95 x 36 x 105 cm' },
        ],
      },
      {
        sku: 'FRN-STR-004',
        name: 'CubeGrid 9-Cubby Modular Toy & File Organizer',
        brand: 'Pepperfry Woods',
        shortDescription: 'Square-cubby room divider shelf compatible with 33 cm fabric baskets.',
        longDescription: 'Finished identically front and back so it functions flush against study walls or cleanly partitions studio living zones.',
        mrpRupees: 11499,
        sellingRupees: 8299,
        inwardRupees: 5200,
        stock: 29,
        imageUrl: 'https://images.unsplash.com/photo-1505693314120-0d443867891c?auto=format&fit=crop&w=900&q=85',
        attributes: [
          { key: 'cubbies', label: 'Compartments', value: '9 Cube Bays (3x3 Grid)' },
          { key: 'dimensions', label: 'Dimensions', value: '110 x 35 x 110 cm' },
        ],
      },
    ],
  },
};

async function run() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.PRODUCT_DB_NAME || 'ornate_products';
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri, { dbName });
  console.log(`Connected to MongoDB (${dbName})`);

  // 1. Find or create root Furnitures category
  let furnRoot = await Category.findOne({ slug: 'furnitures', parent: null });
  if (!furnRoot) {
    furnRoot = await Category.create({
      name: 'Furnitures',
      slug: 'furnitures',
      description: 'Home, living room, bedroom, dining, office, outdoor, and storage furniture.',
      parent: null,
      ancestors: [],
      order: 7,
      isActive: true,
    });
    console.log(`Created root Furnitures category: ${furnRoot._id}`);
  } else {
    console.log(`Found existing Furnitures root category: ${furnRoot._id} (${furnRoot.name})`);
  }

  // 2. Ensure every Furniture subcategory exists and collect active DB subcategories under Furnitures
  const existingSubs = await Category.find({ parent: furnRoot._id });
  const subBySlug = new Map(existingSubs.map((s) => [s.slug, s]));

  for (const [subSlug, meta] of Object.entries(FURNITURE_CATALOG)) {
    let subDoc = subBySlug.get(subSlug);
    if (!subDoc) {
      const displayName = subSlug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      subDoc = await Category.create({
        name: displayName,
        slug: subSlug,
        description: meta.description,
        parent: furnRoot._id,
        ancestors: [{ id: furnRoot._id.toString(), name: furnRoot.name, slug: furnRoot.slug }],
        isActive: true,
      });
      subBySlug.set(subSlug, subDoc);
      console.log(`Created missing Furniture subcategory: ${subDoc.name} (${subDoc.slug})`);
    } else if (!subDoc.description) {
      subDoc.description = meta.description;
      await subDoc.save();
    }
  }

  let createdCount = 0;
  let skippedCount = 0;
  const perSubcategorySummary: Array<{ subcategory: string; slug: string; totalProducts: number }> = [];

  // 3. Seed 4 products into each of the Furniture subcategories
  for (const [subSlug, meta] of Object.entries(FURNITURE_CATALOG)) {
    const subDoc = subBySlug.get(subSlug);
    if (!subDoc) continue;

    for (const spec of meta.products) {
      const existing = await Product.findOne({ sku: spec.sku });
      if (existing) {
        // Ensure category & subcategory fields stay linked
        existing.category = furnRoot._id;
        existing.subcategory = subDoc._id;
        existing.subcategoryId = subDoc._id.toString();
        existing.subcategoryName = subDoc.name;
        existing.status = 'active';
        existing.isPublished = true;
        await existing.save();
        skippedCount += 1;
        continue;
      }

      const mrp = Math.round(spec.mrpRupees * 100);
      const sellingPrice = Math.round(spec.sellingRupees * 100);
      const inwardPrice = Math.round(spec.inwardRupees * 100);
      const dealPrice = spec.dealRupees ? Math.round(spec.dealRupees * 100) : null;

      let assignedStock = 0;
      let unassignedStock = spec.stock;
      let assignmentStatus: 'assigned' | 'partially_assigned' | 'unassigned' = 'unassigned';
      let sellerId: string | null = null;
      let sellerName: string | null = null;
      let storeId: string | null = null;
      let storeName: string | null = null;

      try {
        const allocation = await allocateStockForProduct({
          subcategoryId: subDoc._id.toString(),
          categoryId: furnRoot._id.toString(),
          stock: spec.stock,
        });
        assignedStock = allocation.assignedStock;
        unassignedStock = allocation.unassignedStock;
        assignmentStatus = allocation.assignmentStatus;
        sellerId = allocation.sellerId;
        sellerName = allocation.sellerName;
        storeId = allocation.storeId;
        storeName = allocation.storeName;
      } catch {
        // Non-fatal fallback when no matching seller exists yet
      }

      const productSlug = `${slugify(spec.name, { lower: true, strict: true })}-${spec.sku.toLowerCase()}`;

      await Product.create({
        name: spec.name,
        slug: productSlug,
        sku: spec.sku,
        brand: spec.brand,
        shortDescription: spec.shortDescription,
        longDescription: spec.longDescription,
        category: furnRoot._id,
        subcategory: subDoc._id,
        subcategoryId: subDoc._id.toString(),
        subcategoryName: subDoc.name,
        sellerId,
        sellerName,
        storeId,
        storeName,
        pricing: {
          mrp,
          sellingPrice,
          inwardPrice,
          dealPrice,
          deal: dealPrice
            ? {
                isActive: true,
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              }
            : undefined,
        },
        stock: spec.stock,
        assignedStock,
        unassignedStock,
        assignmentStatus,
        lowStockThreshold: 4,
        status: 'active',
        isPublished: true,
        isFeatured: Boolean(spec.isFeatured),
        images: [
          {
            id: `${spec.sku.toLowerCase()}-1`,
            url: spec.imageUrl,
            alt: spec.name,
            order: 0,
          },
        ],
        attributes: spec.attributes,
      });
      createdCount += 1;
    }

    const totalInSub = await Product.countDocuments({
      $or: [{ subcategory: subDoc._id }, { subcategoryId: subDoc._id.toString() }],
    });
    perSubcategorySummary.push({
      subcategory: subDoc.name,
      slug: subDoc.slug,
      totalProducts: totalInSub,
    });
  }

  console.log(`Furniture seeding done. Created: ${createdCount}, Verified existing: ${skippedCount}`);
  console.table(perSubcategorySummary);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed seeding furniture products:', err);
  process.exit(1);
});
