import ImageKit from 'imagekit';
import multer from 'multer';
import crypto from 'node:crypto';

export const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'public_x4VbhPnuo3Ecml2h79YmHBx9K0Y=',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'private_QuoB/fs+y+q6ox3ST043Wq+D8fM=',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/ornateassets/ornatecom',
});

const storage = multer.memoryStorage();

export const uploadAvatarMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed.'));
      return;
    }
    cb(null, true);
  },
});

export async function uploadToImageKit(
  buffer: Buffer,
  originalName: string,
  folder: string = '/ornate/avatars',
): Promise<{ url: string; fileId: string; thumbnailUrl?: string }> {
  const safeName = (originalName || `avatar_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${crypto.randomUUID()}_${safeName}`;

  const result = await imagekit.upload({
    file: buffer,
    fileName,
    folder,
    tags: ['customer-avatar', 'profile-picture'],
  });

  return {
    url: result.url,
    fileId: result.fileId,
    thumbnailUrl: result.thumbnailUrl || result.url,
  };
}

