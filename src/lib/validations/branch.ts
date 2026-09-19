import { z } from 'zod';

/**
 * Time format validation: HH:mm (24-hour)
 */
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Phone validation: allows digits, spaces, dashes, parentheses, plus sign.
 * Intentionally permissive to support international formats.
 */
const phoneRegex = /^[+]?[\d\s\-()]{7,20}$/;

/**
 * Branch code: uppercase letters, digits, and hyphens only.
 */
const branchCodeRegex = /^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$|^[A-Z0-9]$/;

export const createBranchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Branch name is required' })
    .max(100, { message: 'Branch name must be 100 characters or less' }),
  code: z
    .string()
    .trim()
    .min(1, { message: 'Branch code is required' })
    .max(20, { message: 'Branch code must be 20 characters or less' })
    .transform((val) => val.toUpperCase())
    .pipe(
      z.string().regex(branchCodeRegex, {
        message: 'Branch code must contain only uppercase letters, digits, and hyphens',
      })
    ),
  description: z
    .string()
    .trim()
    .max(500, { message: 'Description must be 500 characters or less' })
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .trim()
    .min(1, { message: 'Address is required' })
    .max(250, { message: 'Address must be 250 characters or less' }),
  city: z
    .string()
    .trim()
    .min(1, { message: 'City is required' })
    .max(100, { message: 'City must be 100 characters or less' }),
  state: z
    .string()
    .trim()
    .max(100, { message: 'State must be 100 characters or less' })
    .optional()
    .or(z.literal('')),
  postalCode: z
    .string()
    .trim()
    .max(20, { message: 'Postal code must be 20 characters or less' })
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || phoneRegex.test(val), {
      message: 'Please enter a valid phone number',
    }),
  email: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || z.string().email().safeParse(val).success, {
      message: 'Please enter a valid email address',
    }),
  openingTime: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || timeRegex.test(val), {
      message: 'Opening time must be in HH:mm format (e.g. 09:00)',
    }),
  closingTime: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || timeRegex.test(val), {
      message: 'Closing time must be in HH:mm format (e.g. 22:00)',
    }),
});

/**
 * Update schema: same as create but without `code` (immutable after creation).
 */
export const updateBranchSchema = createBranchSchema.omit({ code: true });

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
