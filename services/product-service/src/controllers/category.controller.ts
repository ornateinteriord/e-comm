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
    const categoryIds = categories.map((cat) => cat._id);
    const categoryIdStrs = categoryIds.map((id) => id.toString());

    // Aggregate active products by both root category and subcategory fields
    const [catCounts, subObjCounts, subStrCounts] = await Promise.all([
      Product.aggregate([
        { $match: { category: { $in: categoryIds }, status: 'active', isPublished: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      Product.aggregate([
        { $match: { subcategory: { $in: categoryIds }, status: 'active', isPublished: true } },
        { $group: { _id: '$subcategory', count: { $sum: 1 } } },
      ]),
      Product.aggregate([
        { $match: { subcategoryId: { $in: categoryIdStrs }, status: 'active', isPublished: true } },
        { $group: { _id: '$subcategoryId', count: { $sum: 1 } } },
      ]),
    ]);

    const catCountMap = new Map<string, number>(catCounts.map((c: any) => [c._id.toString(), c.count]));
    const subObjMap = new Map<string, number>(subObjCounts.map((c: any) => [c._id.toString(), c.count]));
    const subStrMap = new Map<string, number>(subStrCounts.map((c: any) => [String(c._id), c.count]));

    let formatted = categories.map((cat) => {
      const obj = cat.toObject();
      const idStr = cat._id.toString();
      const parentStr = cat.parent ? cat.parent.toString() : null;
      const productCount = parentStr
        ? Math.max(subObjMap.get(idStr) || 0, subStrMap.get(idStr) || 0)
        : (catCountMap.get(idStr) || 0);

      return {
        ...obj,
        id: idStr,
        _id: idStr,
        parent: parentStr,
        parentId: parentStr,
        productCount,
      };
    });

    if (req.query.hasProducts === 'true' && !tree) {
      formatted = formatted.filter((cat) => (cat.productCount ?? 0) > 0);
    }

    if (tree) {
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
        let children = childrenMap.get(root.id) || [];
        if (req.query.hasProducts === 'true') {
          children = children.filter((c) => (c.productCount ?? 0) > 0);
        }
        root.children = children;
      }

      const finalRoots = req.query.hasProducts === 'true'
        ? roots.filter((r) => (r.productCount ?? 0) > 0 || (r.children && r.children.length > 0))
        : roots;

      res.json({ success: true, data: finalRoots });
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

    const children = await Category.find({ parent: category._id, isActive: true }).sort({ order: 1, name: 1 });
    const formatted = {
      ...category.toObject(),
      id: category._id.toString(),
      _id: category._id.toString(),
      parent: category.parent ? category.parent.toString() : null,
      parentId: category.parent ? category.parent.toString() : null,
      subcategories: children.map((c) => ({
        ...c.toObject(),
        id: c._id.toString(),
        _id: c._id.toString(),
        parent: category._id.toString(),
        parentId: category._id.toString(),
      })),
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
    if (!name || !String(name).trim()) {
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

    const baseSlug = buildSlug(String(name).trim());
    let slug = baseSlug;
    let counter = 1;
    while (await Category.findOne({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const ancestors = parentDoc ? await buildAncestors(parentDoc._id.toString()) : [];
    const category = await Category.create({
      name: String(name).trim(),
      slug,
      description: description ? String(description).trim() : undefined,
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
    const id = String(req.params.id || '');
    const updates: Record<string, any> = { ...req.body };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid category ID.' } });
      return;
    }

    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found.' } });
      return;
    }

    const previousName = category.name;
    const previousSlug = category.slug;

    const targetParent = 'parent' in updates ? updates.parent : 'parentId' in updates ? updates.parentId : undefined;
    if (targetParent !== undefined) {
      if (targetParent === null || targetParent === '') {
        updates.parent = null;
        updates.ancestors = [];
      } else {
        if (String(targetParent) === id) {
          res.status(422).json({ success: false, error: { code: 'CIRCULAR_REFERENCE', message: 'A category cannot be its own parent.' } });
          return;
        }
        if (!mongoose.Types.ObjectId.isValid(String(targetParent))) {
          res.status(400).json({ success: false, error: { code: 'INVALID_PARENT_ID', message: 'Invalid parent category ID.' } });
          return;
        }
        const parentDoc = await Category.findById(String(targetParent));
        if (!parentDoc) {
          res.status(404).json({ success: false, error: { code: 'PARENT_NOT_FOUND', message: 'Parent category not found.' } });
          return;
        }
        const wouldLoop = (parentDoc.ancestors || []).some((a) => String(a.id) === id);
        if (wouldLoop) {
          res.status(422).json({ success: false, error: { code: 'CIRCULAR_REFERENCE', message: 'Cannot move a parent category underneath its own subcategory.' } });
          return;
        }
        const childCount = await Category.countDocuments({ parent: category._id });
        if (childCount > 0) {
          res.status(409).json({
            success: false,
            error: { code: 'HAS_SUBCATEGORIES', message: 'Cannot convert a main category with subcategories into a subcategory.' },
          });
          return;
        }
        updates.parent = parentDoc._id;
        updates.ancestors = await buildAncestors(parentDoc._id.toString());
      }
      delete updates.parentId;
    }

    if ('name' in updates) {
      const trimmedName = String(updates.name ?? '').trim();
      if (!trimmedName) {
        res.status(400).json({ success: false, error: { code: 'NAME_REQUIRED', message: 'Category name is required.' } });
        return;
      }
      updates.name = trimmedName;
      const baseSlug = buildSlug(trimmedName);
      let candidateSlug = baseSlug || category.slug;
      let counter = 1;
      while (await Category.findOne({ slug: candidateSlug, _id: { $ne: category._id } })) {
        candidateSlug = `${baseSlug}-${counter++}`;
      }
      updates.slug = candidateSlug;
    }

    if ('description' in updates) {
      updates.description = updates.description ? String(updates.description).trim() : '';
    }

    Object.assign(category, updates);
    await category.save();

    // Cascade name/slug changes to descendants, products, and partner sellers
    if (category.name !== previousName || category.slug !== previousSlug) {
      await Category.updateMany(
        { 'ancestors.id': category._id.toString() },
        {
          $set: {
            'ancestors.$.name': category.name,
            'ancestors.$.slug': category.slug,
          },
        },
      );

      if (category.name !== previousName) {
        await Product.updateMany(
          { $or: [{ subcategory: category._id }, { subcategoryId: category._id.toString() }] },
          { $set: { subcategoryName: category.name } },
        );

        try {
          const authDb = mongoose.connection.useDb(process.env.AUTH_DB_NAME || 'ornate_auth', { useCache: true });
          const storesCol = authDb.collection('stores');
          const catIdStr = category._id.toString();
          await Promise.all([
            storesCol.updateMany({ categoryId: catIdStr }, { $set: { categoryName: category.name } }),
            storesCol.updateMany({ subcategoryId: catIdStr }, { $set: { subcategoryName: category.name } }),
          ]);
        } catch (syncErr) {
          log.warn({ syncErr, categoryId: id }, 'Non-fatal: failed to sync category rename to partner stores');
        }
      }
    }

    const parentStr = category.parent ? category.parent.toString() : null;
    log.info({ categoryId: category.id, slug: category.slug, parentId: parentStr }, 'Category updated');
    res.json({
      success: true,
      data: {
        ...category.toObject(),
        id: category._id.toString(),
        _id: category._id.toString(),
        parent: parentStr,
        parentId: parentStr,
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

// DELETE /api/v1/admin/categories/:id
export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    // Check for dependent products (either root category or subcategory)
    const productCount = await Product.countDocuments({
      $or: [
        { category: id },
        { subcategory: id },
        { subcategoryId: id },
      ],
    });
    if (productCount > 0) {
      res.status(409).json({
        success: false,
        error: {
          code: 'HAS_PRODUCTS',
          message: `Cannot delete: ${productCount} product(s) belong to this category/subcategory. Reassign them first.`,
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
