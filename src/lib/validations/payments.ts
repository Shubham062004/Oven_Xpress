import { z } from 'zod';
import {
  PaymentMethod,
  PaymentStatus,
  ReconciliationStatus,
} from '@prisma/client';

export const createPaymentSchema = z.object({
  orderId: z.string().min(1, { message: 'Order ID is required' }),
  amount: z.coerce
    .number({ message: 'Amount must be a valid number' })
    .positive({ message: 'Payment amount must be greater than 0' }),
  method: z.nativeEnum(PaymentMethod, {
    message: 'Please select a valid payment method',
  }),
  referenceNumber: z
    .string()
    .trim()
    .max(100, { message: 'Reference number cannot exceed 100 characters' })
    .optional()
    .nullable()
    .or(z.literal('')),
  notes: z
    .string()
    .trim()
    .max(500, { message: 'Notes cannot exceed 500 characters' })
    .optional()
    .nullable()
    .or(z.literal('')),
  status: z
    .nativeEnum(PaymentStatus)
    .optional()
    .default(PaymentStatus.SUCCESS),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const createRefundSchema = z.object({
  paymentId: z.string().min(1, { message: 'Payment ID is required' }),
  amount: z.coerce
    .number({ message: 'Refund amount must be a valid number' })
    .positive({ message: 'Refund amount must be greater than 0' }),
  reason: z
    .string()
    .trim()
    .min(3, { message: 'Reason must be at least 3 characters' })
    .max(300, { message: 'Reason cannot exceed 300 characters' }),
  referenceNumber: z
    .string()
    .trim()
    .max(100, { message: 'Reference number cannot exceed 100 characters' })
    .optional()
    .nullable()
    .or(z.literal('')),
  notes: z
    .string()
    .trim()
    .max(500, { message: 'Notes cannot exceed 500 characters' })
    .optional()
    .nullable()
    .or(z.literal('')),
});

export type CreateRefundInput = z.infer<typeof createRefundSchema>;

export const submitReconciliationSchema = z.object({
  branchId: z.string().min(1, { message: 'Branch ID is required' }),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' }),
  actualCash: z.coerce
    .number({ message: 'Actual cash count must be a number' })
    .min(0, { message: 'Actual cash cannot be negative' }),
  note: z
    .string()
    .trim()
    .max(500, { message: 'Note cannot exceed 500 characters' })
    .optional()
    .nullable()
    .or(z.literal('')),
  status: z
    .nativeEnum(ReconciliationStatus)
    .optional()
    .default(ReconciliationStatus.RECONCILED),
});

export type SubmitReconciliationInput = z.infer<typeof submitReconciliationSchema>;

export const paymentFilterSchema = z.object({
  branchId: z.string().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaymentFilterInput = z.infer<typeof paymentFilterSchema>;
