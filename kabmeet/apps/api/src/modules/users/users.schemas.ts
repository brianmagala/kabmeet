import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
  reason: z.string().trim().max(240).optional(),
});

export type UpdateUserRoleDto = z.infer<typeof updateUserRoleSchema>;

export const updateMyProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  nickname: z.string().trim().max(40).nullable().optional(),
  department: z.string().trim().max(80).nullable().optional(),
  avatarUrl: z
    .string()
    .trim()
    .max(450_000)
    .refine(
      (val) =>
        val === '' ||
        /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(val) ||
        /^https:\/\/[^\s]+$/.test(val),
      'Invalid image format.',
    )
    .nullable()
    .optional(),
});

export type UpdateMyProfileDto = z.infer<typeof updateMyProfileSchema>;
