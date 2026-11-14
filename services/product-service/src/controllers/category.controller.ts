import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
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
  if (!parentId || !mongoose.Types.ObjectId.isValid(parentId)) return [];
  const parent = await Category.findById(parentId);
  if (!parent) return [];
  return [...parent.ancestors, { id: parent.id as string, name: parent.name, slug: parent.slug }];
}

// GET /api/v1/categories
export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parentId = req.query.parent as string | undefined;
    const tree = req.query.tree === 'true';
    const filter: Record<string, unknown> = { isActive: true };

    if (!tree) {
      if (parentId === 'null' || parentId === '') filter.parent = null;
      else if (parentId) filter.parent = parentId;
    }

    const categories = await Category.find(filter).sort({ order: 1, name: 1 });
    const formatted = categories.map((cat) => {
      const obj = cat.toObject();
      const parentStr = cat.parent ? cat.parent.toString() : null;
      return {
        ...obj,
        id: cat._id.toString(),
        _id: cat._id.toString(),
        parent: parentStr,
        parentId: parentStr,
      };
    });

    if (tree) {
      // Build hierarchical category tree
      const roots: any[] = [];
      const childrenMap = new Map<string, any[]>();

      for (const item of formatted) {
        if (!item.parent) {
          roots.push({ ...item, children: [] });
        } else {
          const list = childrenMap.get(item.parent) || [];
          list.push(item);
          childrenMap.set(item.parent, list);
        }
      }

      for (const root of roots) {
        root.children = childrenMap.get(root.id) || [];
      }

      res.json({ success: true, data: roots });
      return;
    }

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
    const { name, description, image, parent, parentId, order, seoTitle, seoDescription } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: { code: 'NAME_REQUIRED', message: 'Category name is required.' } });
      return;
    }

    const targetParent = parent || parentId || null;
    let parentDoc: any = null;

    if (targetParent) {
      if (!mongoose.Types.ObjectId.isValid(targetParent)) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARENT_ID', message: 'Invalid parent category ID.' } });
        return;
      }
      parentDoc = await Category.findById(targetParent);
      if (!parentDoc) {
        res.status(404).json({ success: false, error: { code: 'PARENT_NOT_FOUND', message: 'Parent category not found.' } });
        return;
      }
    }

    let baseSlug = buildSlug(name.trim());
    let slug = baseSlug;
    let counter = 1;
    while (await Category.findOne({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const ancestors = parentDoc ? await buildAncestors(parentDoc._id.toString()) : [];
    const category = await Category.create({
      name: name.trim(),
      slug,
      description: description?.trim() || undefined,
      image,
      parent: parentDoc ? parentDoc._id : null,
      ancestors,
      order: order ?? 0,
      seoTitle,
      seoDescription,
    });

    log.info({ categoryId: category.id, slug, parentId: parentDoc?._id }, 'Category created');
    res.status(201).json({
      success: true,
      data: {
        ...category.toObject(),
        id: category._id.toString(),
        _id: category._id.toString(),
        parent: parentDoc ? parentDoc._id.toString() : null,
        parentId: parentDoc ? parentDoc._id.toString() : null,
      },
    });
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ success: false, error: { code: 'DUPLICATE_SLUG', message: 'Category slug already exists.' } });
      return;
    }
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
