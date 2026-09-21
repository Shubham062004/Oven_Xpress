import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().min(2, 'Customer name must be at least 2 characters').max(100),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?[0-9\s-]{7,15})?$/, 'Invalid phone number format')
    .optional()
    .nullable(),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  address: z.string().max(255).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateCustomerSchema = customerSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const customerFilterSchema = z.object({
  search: z.string().optional(),
  branchId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['name', 'totalOrders', 'totalSpend', 'lastOrderDate', 'createdAt'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createReviewSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  customerId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  menuItemId: z.string().optional().nullable(),
  rating: z.coerce
    .number()
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating cannot exceed 5'),
  title: z.string().max(100).optional().nullable(),
  comment: z.string().max(1000).optional().nullable(),
});

export const moderateReviewSchema = z.object({
  reviewId: z.string().min(1, 'Review ID is required'),
  status: z.enum(['PUBLISHED', 'HIDDEN', 'RESOLVED']),
  notes: z.string().max(500).optional().nullable(),
});

export const reviewFilterSchema = z.object({
  branchId: z.string().optional(),
  rating: z
    .union([z.coerce.number().int().min(1).max(5), z.literal('all')])
    .optional()
    .default('all'),
  status: z.enum(['PENDING', 'PUBLISHED', 'HIDDEN', 'RESOLVED', 'all']).optional().default('all'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createCustomerIssueSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  customerId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  type: z.enum([
    'FOOD_QUALITY',
    'WRONG_ORDER',
    'MISSING_ITEM',
    'LATE_ORDER',
    'PAYMENT',
    'STAFF_SERVICE',
    'CLEANLINESS',
    'DELIVERY',
    'OTHER',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  description: z.string().min(5, 'Description must be at least 5 characters').max(2000),
  assignedTo: z.string().optional().nullable(),
});

export const assignIssueSchema = z.object({
  issueId: z.string().min(1, 'Issue ID is required'),
  employeeId: z.string().min(1, 'Employee is required'),
});

export const resolveIssueSchema = z.object({
  issueId: z.string().min(1, 'Issue ID is required'),
  resolutionNote: z
    .string()
    .min(5, 'Resolution note is mandatory and must be at least 5 characters')
    .max(1000),
});

export const updateIssueStatusSchema = z.object({
  issueId: z.string().min(1, 'Issue ID is required'),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED']),
  resolutionNote: z.string().max(1000).optional().nullable(),
});

export const issueFilterSchema = z.object({
  branchId: z.string().optional(),
  type: z
    .enum([
      'FOOD_QUALITY',
      'WRONG_ORDER',
      'MISSING_ITEM',
      'LATE_ORDER',
      'PAYMENT',
      'STAFF_SERVICE',
      'CLEANLINESS',
      'DELIVERY',
      'OTHER',
      'all',
    ])
    .optional()
    .default('all'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'all']).optional().default('all'),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED', 'all']).optional().default('all'),
  assignedTo: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
export type CreateCustomerIssueInput = z.infer<typeof createCustomerIssueSchema>;
export type AssignIssueInput = z.infer<typeof assignIssueSchema>;
export type ResolveIssueInput = z.infer<typeof resolveIssueSchema>;
export type UpdateIssueStatusInput = z.infer<typeof updateIssueStatusSchema>;
