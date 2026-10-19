import { Request, Response, NextFunction } from 'express';
import ImageKit from 'imagekit';
import multer from 'multer';
import crypto from 'node:crypto';
const uuidv4 = () => crypto.randomUUID();
import { Product } from '../models/product.model.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('image-controller');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY ?? '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY ?? '',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT ?? '',
});

// In-memory storage; we upload directly to ImageKit
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed.'));
      return;
    }
    cb(null, true);
  },
});

export async function uploadImages(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    upload.array('images', 10)(req, res, async (err) => {
      if (err) {
        res.status(400).json({
          success: false,
          error: { code: 'UPLOAD_ERROR', message: err.message },
        });
        return;
      }

      const { id } = req.params;
      const product = await Product.findById(id);
      if (!product) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Product not found.' },
        });
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_FILES', message: 'No image files provided.' },
        });
        return;
      }

      const uploaded = await Promise.all(
        files.map(async (file) => {
          const imageId = uuidv4();
          const result = await imagekit.upload({
            file: file.buffer,
            fileName: `${imageId}.${file.mimetype.split('/')[1]}`,
            folder: `/ornate/products/${id}`,
            tags: [`product:${id}`],
          });
          return {
            id: imageId,
            url: result.url,
            alt: product.name,
            order: product.images.length,
          };
        }),
      );

      product.images.push(...uploaded);
      await product.save();

      log.info({ productId: id, count: uploaded.length }, 'Images uploaded');
      res.json({ success: true, data: { images: product.images } });
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, imageId } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.' } });
      return;
    }

    const imgIndex = product.images.findIndex((img) => img.id === imageId);
    if (imgIndex === -1) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Image not found.' } });
      return;
    }

    // Delete from ImageKit
    try {
      await imagekit.deleteFile(String(imageId));
    } catch (ikErr) {
      log.warn({ ikErr, imageId }, 'ImageKit delete failed (continuing)');
    }

    product.images.splice(imgIndex, 1);
    // Reorder remaining images
    product.images.forEach((img, i) => { img.order = i; });
    await product.save();

    res.json({ success: true, data: { images: product.images } });
  } catch (err) {
    next(err);
  }
}
