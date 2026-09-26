import { z } from 'zod';
import { sanitizeRedirectUrl } from '@/lib/security/url-validation';

const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'admin123',
  'admin1234',
  'ovenxpress',
  'restaurant',
  'welcome123',
  'letmein123',
]);

/**
 * Enterprise-grade strong password schema:
 * - At least 8 characters
 * - At least one uppercase character
 * - At least one lowercase character
 * - At least one number
 * - At least one special symbol
 * - Not a commonly used weak password
 */
export const strongPasswordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters long' })
  .max(128, { message: 'Password cannot exceed 128 characters' })
  .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  .regex(/[0-9]/, { message: 'Password must contain at least one number' })
  .regex(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character' })
  .refine((val) => !COMMON_WEAK_PASSWORDS.has(val.toLowerCase()), {
    message: 'This password is too common and easily guessed. Please choose a stronger password.',
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email address is required' })
    .email({ message: 'Please enter a valid email address' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' }),
  callbackUrl: z
    .string()
    .optional()
    .transform((val) => sanitizeRedirectUrl(val, '/')),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email address is required' })
    .email({ message: 'Please enter a valid email address' }),
});

export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(32, { message: 'Invalid or missing password reset token' })
      .max(128, { message: 'Invalid reset token format' }),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, { message: 'Please confirm your new password' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const verifyEmailSchema = z.object({
  token: z
    .string()
    .trim()
    .min(32, { message: 'Invalid or missing email verification token' })
    .max(128, { message: 'Invalid verification token format' }),
});

export const resendVerificationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email address is required' })
    .email({ message: 'Please enter a valid email address' }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'Current password is required' }),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, { message: 'Please confirm your new password' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { message: 'First name is required' })
    .max(50, { message: 'First name cannot exceed 50 characters' }),
  lastName: z
    .string()
    .trim()
    .min(1, { message: 'Last name is required' })
    .max(50, { message: 'Last name cannot exceed 50 characters' }),
  phone: z
    .string()
    .trim()
    .max(20, { message: 'Phone number cannot exceed 20 characters' })
    .optional()
    .nullable(),
  avatarUrl: z
    .string()
    .trim()
    .optional()
    .nullable(),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
