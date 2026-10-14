import { z } from 'zod';
import { BugReportCategory, BugReportStatus } from '@prisma/client';

export { BugReportCategory, BugReportStatus };

export const BUG_CATEGORIES: { value: BugReportCategory; label: string; description: string }[] = [
  {
    value: 'LOGIN_REGISTRATION',
    label: 'Login / Registration',
    description: 'Issues signing in, creating accounts, or password resets',
  },
  {
    value: 'MENU',
    label: 'Menu & Items',
    description: 'Menu browsing, item details, variants, or pricing errors',
  },
  {
    value: 'CART',
    label: 'Cart & Basket',
    description: 'Adding/removing items, quantity updates, or discounts',
  },
  {
    value: 'CHECKOUT_PAYMENT',
    label: 'Checkout & Payment',
    description: 'Payment gateway failures, address entry, or payment confirmations',
  },
  {
    value: 'ORDER_TRACKING',
    label: 'Order Tracking',
    description: 'Live order tracking, status discrepancies, or delivery updates',
  },
  {
    value: 'ACCOUNT',
    label: 'Customer Account',
    description: 'Profile updates, order history, or saved preferences',
  },
  {
    value: 'UI_DISPLAY',
    label: 'UI & Visual Glitches',
    description: 'Broken layouts, misaligned buttons, or unresponsive views',
  },
  {
    value: 'OTHER',
    label: 'Other Technical Bug',
    description: 'Any other system bug or unexpected application error',
  },
];

export const createBugReportSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Bug title must be at least 3 characters')
    .max(120, 'Bug title cannot exceed 120 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Please provide more details (at least 10 characters)')
    .max(3000, 'Description cannot exceed 3,000 characters'),
  category: z.nativeEnum(BugReportCategory),
  reporterName: z
    .string()
    .trim()
    .max(80, 'Name cannot exceed 80 characters')
    .optional()
    .or(z.literal('')),
  reporterEmail: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .max(120, 'Email cannot exceed 120 characters')
    .optional()
    .or(z.literal('')),
  reporterPhone: z
    .string()
    .trim()
    .max(20, 'Phone number cannot exceed 20 characters')
    .optional()
    .or(z.literal('')),
  pageUrl: z
    .string()
    .trim()
    .max(500, 'URL cannot exceed 500 characters')
    .optional()
    .or(z.literal('')),
  userAgent: z
    .string()
    .trim()
    .max(500, 'User agent cannot exceed 500 characters')
    .optional()
    .or(z.literal('')),
  deviceInfo: z
    .record(z.string(), z.any())
    .optional(),
});

export const updateBugReportStatusSchema = z.object({
  status: z.nativeEnum(BugReportStatus),
  resolutionNote: z
    .string()
    .trim()
    .max(1000, 'Resolution note cannot exceed 1,000 characters')
    .optional()
    .or(z.literal('')),
});

export const bugReportFilterSchema = z.object({
  status: z.nativeEnum(BugReportStatus).or(z.literal('ALL')).optional().default('ALL'),
  category: z.nativeEnum(BugReportCategory).or(z.literal('ALL')).optional().default('ALL'),
  search: z.string().trim().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
});

export type CreateBugReportInput = z.infer<typeof createBugReportSchema>;
export type UpdateBugReportStatusInput = z.infer<typeof updateBugReportStatusSchema>;
export type BugReportFilterInput = z.infer<typeof bugReportFilterSchema>;
