import mongoose, { Schema, Document } from 'mongoose';

export interface IWishlist extends Document {
  userId: string;
  products: string[];
  createdAt: Date;
  updatedAt: Date;
}

const wishlistSchema = new Schema<IWishlist>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    products: [{ type: String, required: true }],
  },
  { timestamps: true },
);

export const Wishlist = mongoose.model<IWishlist>('Wishlist', wishlistSchema);
