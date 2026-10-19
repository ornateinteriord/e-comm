import { z } from 'zod';

const dealSchema = z
  .object({
    isActive: z.boolean(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    maxQtyPerOrder: z.number().int().positive().nullable().optional(),
  })
  .optional()
  .nullable();

const pricingSchema = z.object({
  mrp: z.number().int().nonnegative('MRP must be a non-negative integer (paise).'),
  sellingPrice: z.number().int().nonnegative(),
  dealPrice: z.number().int().nonnegative().nullable().optional(),
  inwardPrice: z.number().int().nonnegative(),
  deal: dealSchema,
});

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(250),
    sku: z.string().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/, 'SKU may only contain letters, numbers, underscores, and hyphens.'),
    brand: z.string().max(100).optional(),
    shortDescription: z.string().max(500).optional(),
    longDescription: z.string().max(10000).optional(),
    category: z.string().min(1, 'Category is required.'),
    subcategory: z.string().nullable().optional(),
    pricing: pricingSchema,
    stock: z.number().int().nonnegative().optional(),
    lowStockThreshold: z.number().int().nonnegative().optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
    isPublished: z.boolean().optional(),
    attributes: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
    variants: z
      .array(
        z.object({
          sku: z.string().min(1),
          attributes: z.array(z.object({ key: z.string(), value: z.string() })),
          stock: z.number().int().nonnegative(),
          sellingPriceOverride: z.number().int().nonnegative().nullable().optional(),
        }),
      )
      .optional(),
    seoTitle: z.string().max(70).optional(),
    seoDescription: z.string().max(160).optional(),
    taxClass: z.string().optional(),
    weight: z.number().nonnegative().optional(),
    dimensions: z
      .object({ l: z.number().nonnegative(), w: z.number().nonnegative(), h: z.number().nonnegative() })
      .optional(),
  }),
});

export const updateProductSchema = z.object({
  body: createProductSchema.shape.body.partial(),
});

export type CreateProductBody = z.infer<typeof createProductSchema>['body'];
export type UpdateProductBody = z.infer<typeof updateProductSchema>['body'];
