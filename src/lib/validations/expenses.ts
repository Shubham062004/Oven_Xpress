import { z } from 'zod';
import {
  PaymentMethod,
  ExpenseStatus,
  ExpenseCategoryStatus,
  ExpenseFrequency,
  ExpenseTemplateStatus,
} from '@prisma/client';

export const createExpenseSchema = z.object({
  branchId: z.string().min(1, { message: 'Branch is required' }),
  categoryId: z.string().min(1, { message: 'Expense category is required' }),
  amount: z.coerce
    .number({ message: 'Amount must be a valid number' })
    .positive({ message: 'Amount must be greater than zero' })
    .max(10000000, { message: 'Amount cannot exceed ₹1,00,00,000' }),
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' }),
  description: z
    .string()
    .trim()
    .min(3, { message: 'Description must be at least 3 characters' })
    .max(500, { message: 'Description cannot exceed 500 characters' }),
  vendorName: z
    .string()
    .trim()
    .max(100, { message: 'Vendor name cannot exceed 100 characters' })
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    message: 'Valid payment method is required',
  }),
  referenceNumber: z
    .string()
    .trim()
    .max(100, { message: 'Reference number cannot exceed 100 characters' })
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
  receiptUrl: z
    .string()
    .trim()
    .max(500, { message: 'Receipt path cannot exceed 500 characters' })
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
  notes: z
    .string()
    .trim()
    .max(1000, { message: 'Notes cannot exceed 1000 characters' })
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
  status: z
    .nativeEnum(ExpenseStatus)
    .optional()
    .default(ExpenseStatus.PENDING_APPROVAL),
  templateId: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object({
  categoryId: z.string().min(1, { message: 'Expense category is required' }).optional(),
  amount: z.coerce
    .number({ message: 'Amount must be a valid number' })
    .positive({ message: 'Amount must be greater than zero' })
    .max(10000000, { message: 'Amount cannot exceed ₹1,00,00,000' })
    .optional(),
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
    .optional(),
  description: z
    .string()
    .trim()
    .min(3, { message: 'Description must be at least 3 characters' })
    .max(500, { message: 'Description cannot exceed 500 characters' })
    .optional(),
  vendorName: z
    .string()
    .trim()
    .max(100, { message: 'Vendor name cannot exceed 100 characters' })
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  referenceNumber: z
    .string()
    .trim()
    .max(100, { message: 'Reference number cannot exceed 100 characters' })
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
  receiptUrl: z
    .string()
    .trim()
    .max(500, { message: 'Receipt path cannot exceed 500 characters' })
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
  notes: z
    .string()
    .trim()
    .max(1000, { message: 'Notes cannot exceed 1000 characters' })
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
  status: z.nativeEnum(ExpenseStatus).optional(),
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const approveExpenseSchema = z.object({
  expenseId: z.string().min(1, { message: 'Expense ID is required' }),
  notes: z
    .string()
    .trim()
    .max(500, { message: 'Notes cannot exceed 500 characters' })
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
});

export type ApproveExpenseInput = z.infer<typeof approveExpenseSchema>;

export const rejectExpenseSchema = z.object({
  expenseId: z.string().min(1, { message: 'Expense ID is required' }),
  rejectionReason: z
    .string()
    .trim()
    .min(3, { message: 'Rejection reason must be at least 3 characters' })
    .max(500, { message: 'Rejection reason cannot exceed 500 characters' }),
});

export type RejectExpenseInput = z.infer<typeof rejectExpenseSchema>;

export const cancelExpenseSchema = z.object({
  expenseId: z.string().min(1, { message: 'Expense ID is required' }),
  cancellationReason: z
    .string()
    .trim()
    .min(3, { message: 'Cancellation reason must be at least 3 characters' })
    .max(500, { message: 'Cancellation reason cannot exceed 500 characters' }),
});

export type CancelExpenseInput = z.infer<typeof cancelExpenseSchema>;

export const expenseCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Category name must be at least 2 characters' })
    .max(50, { message: 'Category name cannot exceed 50 characters' })
    .transform((v) => v.trim().toUpperCase()),
  description: z
    .string()
    .trim()
    .max(300, { message: 'Description cannot exceed 300 characters' })
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
  status: z.nativeEnum(ExpenseCategoryStatus).default(ExpenseCategoryStatus.ACTIVE),
});

export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;

export const expenseTemplateSchema = z.object({
  branchId: z.string().min(1, { message: 'Branch is required' }),
  categoryId: z.string().min(1, { message: 'Expense category is required' }),
  description: z
    .string()
    .trim()
    .min(3, { message: 'Description must be at least 3 characters' })
    .max(300, { message: 'Description cannot exceed 300 characters' }),
  amount: z.coerce
    .number({ message: 'Amount must be a valid number' })
    .positive({ message: 'Amount must be greater than zero' })
    .max(10000000, { message: 'Amount cannot exceed ₹1,00,00,000' }),
  frequency: z.nativeEnum(ExpenseFrequency, {
    message: 'Valid frequency (WEEKLY, MONTHLY, YEARLY) is required',
  }),
  nextDueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Next due date must be in YYYY-MM-DD format' }),
  vendorName: z
    .string()
    .trim()
    .max(100, { message: 'Vendor name cannot exceed 100 characters' })
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().nullable(),
  status: z.nativeEnum(ExpenseTemplateStatus).default(ExpenseTemplateStatus.ACTIVE),
});

export type ExpenseTemplateInput = z.infer<typeof expenseTemplateSchema>;

export const expenseFilterSchema = z.object({
  branchId: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ExpenseFilterInput = z.infer<typeof expenseFilterSchema>;
