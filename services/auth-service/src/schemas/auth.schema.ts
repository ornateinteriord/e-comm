import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    referralCode: z.string().min(1, 'Referral code is required.'),
    referralName: z.string().optional(),
    fullName: z.string().min(2, 'Full name must be at least 2 characters.').max(100).optional(),
    name: z.string().min(2, 'Name must be at least 2 characters.').max(100).optional(),
    email: z.string().email('Valid email required.'),
    mobileNumber: z.string().min(10, 'Valid 10-digit mobile number required.').max(15).optional(),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.'),
    country: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    pincode: z.string().optional(),
    gender: z.string().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().optional(),
    username: z.string().optional(),
    mobileNumber: z.string().optional(),
    password: z.string().min(1, 'Password is required.'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8),
  }),
});

export type RegisterBody = z.infer<typeof registerSchema>['body'];
export type LoginBody = z.infer<typeof loginSchema>['body'];
