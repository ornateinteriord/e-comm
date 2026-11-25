import { Router } from 'express';
import {
  listProducts, getProductBySlug, getFeaturedProduct,
  adminListProducts, createProduct, updateProduct, deleteProduct, getAdminProduct, setSponsorProduct,
  sellerListProducts, sellerCreateProduct, sellerUpdateProduct,
  storeListProducts, storeCreateProduct, storeUpdateProduct, adminAutoAssignStock,
  getPublicSellerProducts,
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

// ---- Public seller/store products route ----
router.get('/api/v1/seller/:storeId/products', getPublicSellerProducts);
router.get('/seller/:storeId/products', getPublicSellerProducts);
router.get('/api/v1/sellers/:storeId/products', getPublicSellerProducts);
router.get('/sellers/:storeId/products', getPublicSellerProducts);
router.get('/api/v1/store/:storeId/products', getPublicSellerProducts);
router.get('/store/:storeId/products', getPublicSellerProducts);

// ---- Seller product routes ----
router.get('/api/v1/seller/products', attachUser, requireRole('seller'), sellerListProducts);
router.get('/seller/products', attachUser, requireRole('seller'), sellerListProducts);
router.post('/api/v1/seller/products', attachUser, requireRole('seller'), sellerCreateProduct);
router.post('/seller/products', attachUser, requireRole('seller'), sellerCreateProduct);
router.post('/api/v1/seller/products/upload-images', attachUser, requireRole('seller'), uploadMultipleStandaloneImages);
router.post('/seller/products/upload-images', attachUser, requireRole('seller'), uploadMultipleStandaloneImages);
router.post('/api/v1/seller/products/upload-image', attachUser, requireRole('seller'), uploadSingleImage);
router.post('/seller/products/upload-image', attachUser, requireRole('seller'), uploadSingleImage);
router.patch('/api/v1/seller/products/:id', attachUser, requireRole('seller'), sellerUpdateProduct);
router.patch('/seller/products/:id', attachUser, requireRole('seller'), sellerUpdateProduct);

// ---- Store product routes (legacy aliases) ----
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

// ---- Seller/Store auto-assign stock routes ----
router.post('/api/v1/admin/sellers/:sellerId/auto-assign-stock', attachUser, requireRole('catalog_manager'), adminAutoAssignStock);
router.post('/admin/sellers/:sellerId/auto-assign-stock', attachUser, requireRole('catalog_manager'), adminAutoAssignStock);
router.post('/api/v1/admin/stores/:storeId/auto-assign-stock', attachUser, requireRole('catalog_manager'), adminAutoAssignStock);
router.post('/admin/stores/:storeId/auto-assign-stock', attachUser, requireRole('catalog_manager'), adminAutoAssignStock);

// ---- Admin category routes ----
router.get('/api/v1/admin/categories', attachUser, requireRole('catalog_manager'), listCategories);
router.get('/admin/categories', attachUser, requireRole('catalog_manager'), listCategories);
router.post('/api/v1/admin/categories', attachUser, requireRole('catalog_manager'), createCategory);
router.post('/admin/categories', attachUser, requireRole('catalog_manager'), createCategory);
router.patch('/api/v1/admin/categories/:id', attachUser, requireRole('catalog_manager'), updateCategory);
router.patch('/admin/categories/:id', attachUser, requireRole('catalog_manager'), updateCategory);
router.delete('/api/v1/admin/categories/:id', attachUser, requireRole('admin'), deleteCategory);
router.delete('/admin/categories/:id', attachUser, requireRole('admin'), deleteCategory);

export default router;
