import { z } from 'zod';
import { SupplierStatus } from '@prisma/client';

/**
 * Phone validation: allows digits, spaces, dashes, parentheses, plus sign.
 * Matches the existing pattern across the application.
 */
const phoneRegex = /^[+]?[\d\s\-()]{7,20}$/;

export const createSupplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Supplier name is required' })
    .max(100, { message: 'Supplier name must be 100 characters or less' }),
  contactPerson: z
    .string()
    .trim()
    .max(100, { message: 'Contact person must be 100 characters or less' })
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || phoneRegex.test(val), {
      message: 'Please enter a valid phone number (7-20 digits/symbols)',
    }),
  email: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || z.string().email().safeParse(val).success, {
      message: 'Please enter a valid email address',
    }),
  address: z
    .string()
    .trim()
    .max(250, { message: 'Address must be 250 characters or less' })
    .optional()
    .or(z.literal('')),
  city: z
    .string()
    .trim()
    .max(100, { message: 'City must be 100 characters or less' })
    .optional()
    .or(z.literal('')),
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
  notes: z
    .string()
    .trim()
    .max(500, { message: 'Notes must be 500 characters or less' })
    .optional()
    .or(z.literal('')),
  status: z.nativeEnum(SupplierStatus).default(SupplierStatus.ACTIVE),
});

export const updateSupplierSchema = createSupplierSchema;

export const supplierFilterSchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).default('ALL'),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type SupplierFilterInput = z.infer<typeof supplierFilterSchema>;
