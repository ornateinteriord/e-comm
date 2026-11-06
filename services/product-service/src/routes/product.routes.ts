import { Router } from 'express';
import {
  listProducts, getProductBySlug, getFeaturedProduct,
  adminListProducts, createProduct, updateProduct, deleteProduct, getAdminProduct, setSponsorProduct,
  storeListProducts, storeCreateProduct, storeUpdateProduct,
} from '../controllers/product.controller.js';
import { listCategories, getCategoryBySlug, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller.js';
import { attachUser, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema.js';
import { uploadImages, deleteImage, uploadSingleImage, uploadMultipleStandaloneImages } from '../controllers/image.controller.js';

const router: Router = Router();

// ---- Public product routes ----
router.get('/api/v1/products/featured', getFeaturedProduct);
router.get('/products/featured', getFeaturedProduct);
router.get('/api/v1/products', listProducts);
router.get('/products', listProducts);
router.get('/api/v1/products/:slug', getProductBySlug);
router.get('/products/:slug', getProductBySlug);

// ---- Public category routes ----
router.get('/api/v1/categories', listCategories);
router.get('/categories', listCategories);
router.get('/api/v1/categories/:slug', getCategoryBySlug);
router.get('/categories/:slug', getCategoryBySlug);

// ---- Store product routes ----
router.get('/api/v1/store/products', attachUser, requireRole('store'), storeListProducts);
router.get('/store/products', attachUser, requireRole('store'), storeListProducts);
router.post('/api/v1/store/products', attachUser, requireRole('store'), storeCreateProduct);
router.post('/store/products', attachUser, requireRole('store'), storeCreateProduct);
router.post('/api/v1/store/products/upload-images', attachUser, requireRole('store'), uploadMultipleStandaloneImages);
router.post('/store/products/upload-images', attachUser, requireRole('store'), uploadMultipleStandaloneImages);
router.post('/api/v1/store/products/upload-image', attachUser, requireRole('store'), uploadSingleImage);
router.post('/store/products/upload-image', attachUser, requireRole('store'), uploadSingleImage);
router.patch('/api/v1/store/products/:id', attachUser, requireRole('store'), storeUpdateProduct);
router.patch('/store/products/:id', attachUser, requireRole('store'), storeUpdateProduct);

// ---- Admin product routes ----
router.get('/api/v1/admin/products', attachUser, requireRole('catalog_manager'), adminListProducts);
router.get('/admin/products', attachUser, requireRole('catalog_manager'), adminListProducts);
router.post('/api/v1/admin/products', attachUser, requireRole('catalog_manager'), validate(createProductSchema), createProduct);
router.post('/admin/products', attachUser, requireRole('catalog_manager'), validate(createProductSchema), createProduct);

// ---- Standalone product image upload to ImageKit ----
router.post('/api/v1/admin/products/upload-images', attachUser, requireRole('catalog_manager'), uploadMultipleStandaloneImages);
router.post('/admin/products/upload-images', attachUser, requireRole('catalog_manager'), uploadMultipleStandaloneImages);
router.post('/api/v1/admin/products/upload-image', attachUser, requireRole('catalog_manager'), uploadSingleImage);
router.post('/admin/products/upload-image', attachUser, requireRole('catalog_manager'), uploadSingleImage);
router.post('/api/v1/admin/products/:id/sponsor', attachUser, requireRole('catalog_manager'), setSponsorProduct);
router.post('/admin/products/:id/sponsor', attachUser, requireRole('catalog_manager'), setSponsorProduct);
router.get('/api/v1/admin/products/:id', attachUser, requireRole('catalog_manager'), getAdminProduct);
router.get('/admin/products/:id', attachUser, requireRole('catalog_manager'), getAdminProduct);
router.patch('/api/v1/admin/products/:id', attachUser, requireRole('catalog_manager'), validate(updateProductSchema), updateProduct);
router.patch('/admin/products/:id', attachUser, requireRole('catalog_manager'), validate(updateProductSchema), updateProduct);
router.delete('/api/v1/admin/products/:id', attachUser, requireRole('admin'), deleteProduct);
router.delete('/admin/products/:id', attachUser, requireRole('admin'), deleteProduct);

// ---- Admin image routes ----
router.post('/api/v1/admin/products/:id/images', attachUser, requireRole('catalog_manager'), uploadImages);
router.delete('/api/v1/admin/products/:id/images/:imageId', attachUser, requireRole('catalog_manager'), deleteImage);

// ---- Admin category routes ----
router.get('/api/v1/admin/categories', attachUser, requireRole('catalog_manager'), listCategories);
router.post('/api/v1/admin/categories', attachUser, requireRole('catalog_manager'), createCategory);
router.patch('/api/v1/admin/categories/:id', attachUser, requireRole('catalog_manager'), updateCategory);
router.delete('/api/v1/admin/categories/:id', attachUser, requireRole('admin'), deleteCategory);

export default router;
