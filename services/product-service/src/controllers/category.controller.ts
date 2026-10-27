import { Request, Response, NextFunction } from 'express';
import slugify from 'slugify';
import { Category } from '../models/category.model.js';
import { Product } from '../models/product.model.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('category-controller');

function buildSlug(name: string): string {
  return slugify(name, { lower: true, strict: true });
}

async function buildAncestors(
  parentId?: string | null,
): Promise<Array<{ id: string; name: string; slug: string }>> {
  if (!parentId) return [];
  const parent = await Category.findById(parentId);
  if (!parent) return [];
  return [...parent.ancestors, { id: parent.id as string, name: parent.name, slug: parent.slug }];
}

// GET /api/v1/categories
export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parentId = req.query.parent as string | undefined;
    const filter: Record<string, unknown> = { isActive: true };
    if (parentId === 'null' || parentId === '') filter.parent = null;
    else if (parentId) filter.parent = parentId;

    const categories = await Category.find(filter).sort({ order: 1, name: 1 });
    const formatted = categories.map((cat) => ({
      ...cat.toObject(),
      id: cat._id.toString(),
      _id: cat._id.toString(),
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/categories/:slug
export async function getCategoryBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const category = await Category.findOne({ slug: req.params.slug, isActive: true });
    if (!category) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Category not found.' },
      });
      return;
    }
    const formatted = {
      ...category.toObject(),
      id: category._id.toString(),
      _id: category._id.toString(),
    };
    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/admin/categories
export async function createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description, image, parent, order, seoTitle, seoDescription } = req.body;
    const slug = buildSlug(name);

    // Validate circular parent
    if (parent) {
      const parentCat = await Category.findById(parent);
      if (!parentCat) {
        res.status(404).json({ success: false, error: { code: 'PARENT_NOT_FOUND', message: 'Parent category not found.' } });
        return;
      }
    }

    const ancestors = await buildAncestors(parent);
    const category = await Category.create({
      name, slug, description, image, parent: parent ?? null, ancestors,
      order: order ?? 0, seoTitle, seoDescription,
    });

    log.info({ categoryId: category.id, slug }, 'Category created');
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/admin/categories/:id
export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found.' } });
      return;
    }

    // Prevent circular references
    if (updates.parent) {
      if (updates.parent === id) {
        res.status(422).json({ success: false, error: { code: 'CIRCULAR_REFERENCE', message: 'A category cannot be its own parent.' } });
        return;
      }
      updates.ancestors = await buildAncestors(updates.parent);
    }

    if (updates.name) updates.slug = buildSlug(updates.name);
    Object.assign(category, updates);
    await category.save();

    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/admin/categories/:id
export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    // Check for dependent products
    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      res.status(409).json({
        success: false,
        error: {
          code: 'HAS_PRODUCTS',
          message: `Cannot delete: ${productCount} product(s) belong to this category. Reassign them first.`,
        },
      });
      return;
    }

    // Check for subcategories
    const childCount = await Category.countDocuments({ parent: id });
    if (childCount > 0) {
      res.status(409).json({
        success: false,
        error: {
          code: 'HAS_CHILDREN',
          message: `Cannot delete: ${childCount} subcategory(ies) exist. Remove them first.`,
        },
      });
      return;
    }

    await Category.findByIdAndDelete(id);
    log.info({ categoryId: id }, 'Category deleted');
    res.json({ success: true, data: null, message: 'Category deleted.' });
  } catch (err) {
    next(err);
  }
}
