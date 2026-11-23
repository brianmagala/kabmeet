import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email('Please enter a valid university or personal email.').toLowerCase(),
  fullName: z
    .string()
    .trim()
    .min(2, 'Please enter your full name.')
    .max(100, 'Full name must be 100 characters or fewer.'),
  universityId: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .optional(),
  department: z.string().trim().min(2).max(80).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password must be 128 characters or fewer.'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').toLowerCase(),
  password: z.string().min(1, 'Please enter your password.').max(128),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
