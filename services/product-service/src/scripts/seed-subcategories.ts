import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import slugify from 'slugify';
import { createLogger } from '@ornate/logger';
import { Category } from '../models/category.model.js';
import { Product } from '../models/product.model.js';

const log = createLogger('seed-subcategories');

interface SubcatDef {
  name: string;
  slug: string;
  description: string;
  order: number;
}

interface RootCatDef {
  name: string;
  slug: string;
  description: string;
  order: number;
  subcategories: SubcatDef[];
}

const TAXONOMY: RootCatDef[] = [
  {
    name: 'Electronics & Audio',
    slug: 'electronics',
    description: 'Flagship headphones, mechanical gear, and premium personal audio.',
    order: 1,
    subcategories: [
      {
        name: 'Audio & Headphones',
        slug: 'audio-headphones',
        description: 'Industry-leading noise cancelling headphones, high-res earbuds, and audio DACs.',
        order: 1,
      },
      {
        name: 'Smartphones & Wearables',
        slug: 'smartphones-wearables',
        description: 'Flagship smartphones, cellular smartwatches, fitness trackers and accessories.',
        order: 2,
      },
      {
        name: 'Laptops & Computers',
        slug: 'laptops-computers',
        description: 'Custom mechanical keyboards, high-performance laptops, monitors and workstation gear.',
        order: 3,
      },
      {
        name: 'Cameras & Drones',
        slug: 'cameras-drones',
        description: 'Mirrorless cameras, 4K action cams, stabilizer gimbals and aerial drones.',
        order: 4,
      },
    ],
  },
  {
    name: 'Fashion & Apparel',
    slug: 'clothing',
    description: 'Tailored luxury essentials, heavyweight cotton tees, and designer outerwear.',
    order: 2,
    subcategories: [
      {
        name: "Men's Wear",
        slug: 'mens-wear',
        description: 'Heavyweight French terry hoodies, structured tees, trousers and streetwear.',
        order: 1,
      },
      {
        name: "Women's Wear",
        slug: 'womens-wear',
        description: 'Designer dresses, tailored outerwear, relaxed linen sets and luxury staples.',
        order: 2,
      },
      {
        name: 'Footwear & Sneakers',
        slug: 'footwear-sneakers',
        description: 'Limited edition sneakers, Goodyear welted boots, loafers and formal footwear.',
        order: 3,
      },
      {
        name: 'Winter & Outerwear',
        slug: 'winter-outerwear',
        description: 'Insulated parkas, wool overcoats, technical windbreakers and shearling jackets.',
        order: 4,
      },
    ],
  },
  {
    name: 'Watches & Accessories',
    slug: 'accessories',
    description: 'Precision timepieces, Italian leather wallets, and everyday luxury carry.',
    order: 3,
    subcategories: [
      {
        name: 'Luxury Watches',
        slug: 'luxury-watches',
        description: 'Swiss chronographs, titanium divers, automatic movements and leather watch straps.',
        order: 1,
      },
      {
        name: 'Leather Goods & Wallets',
        slug: 'leather-goods-wallets',
        description: 'Full-grain bifold wallets, slim cardholders, passport sleeves and key organizers.',
        order: 2,
      },
      {
        name: 'Bags & Backpacks',
        slug: 'bags-backpacks',
        description: 'Water-resistant totpack backpacks, weekender duffels and leather messenger bags.',
        order: 3,
      },
      {
        name: 'Eyewear & Sunglasses',
        slug: 'eyewear-sunglasses',
        description: 'Handcrafted acetate frames, polarized UV400 lenses and titanium glasses.',
        order: 4,
      },
    ],
  },
  {
    name: 'Home, Living & Coffee',
    slug: 'home-kitchen',
    description: 'Specialty pour-over coffee makers, ergonomic living, and artisan homeware.',
    order: 4,
    subcategories: [
      {
        name: 'Coffee & Tea Makers',
        slug: 'coffee-tea-makers',
        description: 'Precision electric burr grinders, gooseneck kettles, drippers and espresso machines.',
        order: 1,
      },
      {
        name: 'Ergonomic Furniture & Chairs',
        slug: 'ergonomic-furniture-chairs',
        description: 'Pneumatic ergonomic office chairs, solid walnut sit-stand desks and desk pads.',
        order: 2,
      },
      {
        name: 'Cookware & Kitchen Knives',
        slug: 'cookware-kitchen-knives',
        description: 'Japanese Damascus santoku knives, enameled Dutch ovens and cast iron skillets.',
        order: 3,
      },
      {
        name: 'Home Decor & Lighting',
        slug: 'home-decor-lighting',
        description: 'Warm ambient LED desk lamps, ceramic vases, incense holders and wool throws.',
        order: 4,
      },
    ],
  },
  {
    name: 'Fitness & Outdoors',
    slug: 'sports',
    description: 'Performance running shoes, high-density yoga mats, and recovery tech.',
    order: 5,
    subcategories: [
      {
        name: 'Running & Performance Footwear',
        slug: 'running-performance-footwear',
        description: 'High-rebound road running shoes, trail runners and carbon-plated race shoes.',
        order: 1,
      },
      {
        name: 'Yoga & Pilates Gear',
        slug: 'yoga-pilates-gear',
        description: '5mm high-density non-slip studio yoga mats, cork blocks and resistance bands.',
        order: 2,
      },
      {
        name: 'Gym & Strength Equipment',
        slug: 'gym-strength-equipment',
        description: 'Cast iron kettlebells, Olympic barbell sets and heavy-duty gym racks.',
        order: 3,
      },
      {
        name: 'Recovery & Mobility Tech',
        slug: 'recovery-mobility-tech',
        description: 'High-torque percussion massage guns, vibrating foam rollers and cryo packs.',
        order: 4,
      },
    ],
  },
  {
    name: 'Books & Stationery',
    slug: 'books',
    description: 'Hardcover architecture, software craftsmanship, and premium journals.',
    order: 6,
    subcategories: [
      {
        name: 'Architecture & Design Books',
        slug: 'architecture-design-books',
        description: 'Monographs on mid-century modern architecture, typography and brutalism.',
        order: 1,
      },
      {
        name: 'Software Craftsmanship',
        slug: 'software-craftsmanship',
        description: 'Hardcover collector editions on clean architecture, systems engineering and code.',
        order: 2,
      },
      {
        name: 'Premium Notebooks & Journals',
        slug: 'premium-notebooks-journals',
        description: '120GSM fountain-pen friendly clothbound notebooks, dotted grids and sketchbooks.',
        order: 3,
      },
      {
        name: 'Fine Writing Instruments',
        slug: 'fine-writing-instruments',
        description: 'Machined brass fountain pens, weighted rollerballs and 0.5mm mechanical pencils.',
        order: 4,
      },
    ],
  },
];

// Product name/SKU mapping heuristics to assign to the most appropriate subcategory slug
function determineSubcategorySlug(p: any): string {
  const text = `${p.name || ''} ${p.sku || ''} ${p.brand || ''} ${p.shortDescription || ''}`.toLowerCase();

  if (text.includes('wh-1000xm5') || text.includes('quietcomfort') || text.includes('headphone') || text.includes('earbud')) {
    return 'audio-headphones';
  }
  if (text.includes('apple watch') || text.includes('smartwatch') || text.includes('watch ultra')) {
    return 'smartphones-wearables';
  }
  if (text.includes('keychron') || text.includes('keyboard') || text.includes('laptop') || text.includes('mouse')) {
    return 'laptops-computers';
  }
  if (text.includes('aeron') || text.includes('herman miller') || text.includes('chair') || text.includes('desk')) {
    return 'ergonomic-furniture-chairs';
  }
  if (text.includes('zoomx') || text.includes('invincible') || text.includes('running shoe') || text.includes('sneaker')) {
    return 'running-performance-footwear';
  }
  if (text.includes('fellow ode') || text.includes('coffee') || text.includes('grinder') || text.includes('kettle')) {
    return 'coffee-tea-makers';
  }
  if (text.includes('bellroy') || text.includes('totepack') || text.includes('backpack') || text.includes('bag')) {
    return 'bags-backpacks';
  }
  if (text.includes('hoodie') || text.includes('french terry') || text.includes('shirt') || text.includes('t-shirt')) {
    return "mens-wear";
  }
  if (text.includes('yoga') || text.includes('lululemon') || text.includes('mat')) {
    return 'yoga-pilates-gear';
  }
  if (text.includes('clean craftsmanship') || text.includes('software') || text.includes('architecture')) {
    return 'software-craftsmanship';
  }
  if (text.includes('santoku') || text.includes('knife') || text.includes('cookware') || text.includes('damascus')) {
    return 'cookware-kitchen-knives';
  }

  // Fallbacks based on categorySlug if available
  const catSlug = p.categorySlug || '';
  if (catSlug.includes('electronic')) return 'audio-headphones';
  if (catSlug.includes('clothing')) return "mens-wear";
  if (catSlug.includes('accessories')) return 'luxury-watches';
  if (catSlug.includes('home') || catSlug.includes('kitchen')) return 'coffee-tea-makers';
  if (catSlug.includes('sport')) return 'running-performance-footwear';
  if (catSlug.includes('book')) return 'software-craftsmanship';

  return 'audio-headphones';
}

async function runSeed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  log.info({ uri: uri.replace(/:([^@]+)@/, ':****@') }, 'Connecting to MongoDB Atlas...');
  await mongoose.connect(uri, {
    dbName: process.env.PRODUCT_DB_NAME ?? 'ornate_products',
  });
  log.info('Connected to ornate_products DB.');

  const createdRoots = new Map<string, any>();
  const createdSubcats = new Map<string, any>();

  // 1. Upsert Root Categories
  for (const rootDef of TAXONOMY) {
    let root = await Category.findOne({
      $or: [{ slug: rootDef.slug }, { name: rootDef.name }],
      parent: null,
    });

    if (!root) {
      root = await Category.create({
        name: rootDef.name,
        slug: rootDef.slug,
        description: rootDef.description,
        order: rootDef.order,
        parent: null,
        ancestors: [],
        isActive: true,
      });
      log.info({ name: root.name, id: root.id }, 'Created root category');
    } else {
      root.name = rootDef.name;
      root.description = rootDef.description;
      root.order = rootDef.order;
      await root.save();
      log.info({ name: root.name, id: root.id }, 'Updated existing root category');
    }

    createdRoots.set(rootDef.slug, root);

    // 2. Upsert Subcategories for this root
    for (const subDef of rootDef.subcategories) {
      let subcat = await Category.findOne({
        $or: [{ slug: subDef.slug }, { name: subDef.name }],
        parent: root._id,
      });

      const ancestors = [
        {
          id: root._id.toString(),
          name: root.name,
          slug: root.slug,
        },
      ];

      if (!subcat) {
        subcat = await Category.create({
          name: subDef.name,
          slug: subDef.slug,
          description: subDef.description,
          order: subDef.order,
          parent: root._id,
          ancestors,
          isActive: true,
        });
        log.info({ name: subcat.name, parent: root.name, id: subcat.id }, 'Created subcategory');
      } else {
        subcat.name = subDef.name;
        subcat.description = subDef.description;
        subcat.parent = root._id;
        subcat.ancestors = ancestors;
        subcat.order = subDef.order;
        await subcat.save();
        log.info({ name: subcat.name, parent: root.name, id: subcat.id }, 'Updated existing subcategory');
      }

      createdSubcats.set(subDef.slug, subcat);
    }
  }

  // 3. Assign Products in DB to suitable subcategories
  const products = await Product.find({});
  log.info({ count: products.length }, 'Scanning products to assign subcategories...');

  let assignedCount = 0;
  for (const prod of products) {
    const targetSlug = determineSubcategorySlug(prod);
    const subcat = createdSubcats.get(targetSlug);

    if (subcat) {
      const rootCat = createdRoots.get(subcat.ancestors[0]?.slug) || subcat.parent;
      prod.category = rootCat?._id || prod.category;
      prod.subcategoryId = subcat._id.toString();
      prod.subcategoryName = subcat.name;

      if (!prod.assignedStock || prod.assignedStock === 0) {
        prod.assignedStock = prod.stock || 0;
        prod.unassignedStock = 0;
        prod.assignmentStatus = 'assigned';
      }

      await prod.save();
      assignedCount++;
      log.info(
        { product: prod.name, category: rootCat?.name, subcategory: subcat.name },
        'Assigned product to subcategory'
      );
    }
  }

  // 4. Update Stores in ornate_auth to bind to proper subcategories
  try {
    const conn: any = mongoose.connection;
    const client = typeof conn.getClient === 'function' ? conn.getClient() : conn.client;
    const authDb = client ? client.db('ornate_auth') : mongoose.connection.useDb('ornate_auth').db;

    const stores = await authDb.collection('stores').find({}).toArray();
    log.info({ storeCount: stores.length }, 'Updating existing stores with subcategory bindings...');

    for (const s of stores) {
      if (!s.subcategoryId) {
        // Find a matching subcategory based on s.categoryId or categoryName
        let matchedSubcat: any = null;
        for (const [_, sub] of createdSubcats.entries()) {
          const rootAncestor = sub.ancestors?.[0];
          if (
            rootAncestor &&
            (rootAncestor.id === String(s.categoryId) ||
              rootAncestor.name.toLowerCase().includes(String(s.categoryName || '').toLowerCase()))
          ) {
            matchedSubcat = sub;
            break;
          }
        }

        if (!matchedSubcat) {
          // Default to first subcategory
          matchedSubcat = createdSubcats.get('smartphones-wearables') || createdSubcats.values().next().value;
        }

        if (matchedSubcat) {
          await authDb.collection('stores').updateOne(
            { _id: s._id },
            {
              $set: {
                subcategoryId: matchedSubcat._id.toString(),
                subcategoryName: matchedSubcat.name,
                subcategorySlug: matchedSubcat.slug,
                maxStockLimit: s.maxStockLimit || 2500,
                currentStockTotal: s.currentStockTotal || 0,
              },
            }
          );
          log.info(
            { store: s.name, subcategory: matchedSubcat.name },
            'Assigned store to subcategory'
          );
        }
      }
    }
  } catch (storeErr) {
    log.warn({ storeErr }, 'Could not update stores in ornate_auth (will skip)');
  }

  console.log(`\n======================================================`);
  console.log(`🎉 Seed Subcategories & Product Assignment Complete!`);
  console.log(`- Root Categories: ${createdRoots.size}`);
  console.log(`- Subcategories Created: ${createdSubcats.size}`);
  console.log(`- Products Assigned: ${assignedCount}`);
  console.log(`======================================================\n`);

  await mongoose.disconnect();
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('Seed subcategories error:', err);
  process.exit(1);
});

