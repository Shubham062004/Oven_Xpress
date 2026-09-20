import { z } from 'zod';
import { TableStatus } from '@prisma/client';

export const createTableSchema = z.object({
  branchId: z.string().min(1, { message: 'Branch is required' }),
  tableNumber: z
    .string()
    .trim()
    .min(1, { message: 'Table number is required' })
    .max(20, { message: 'Table number must be 20 characters or less' }),
  capacity: z.coerce
    .number({ message: 'Capacity must be a number' })
    .int({ message: 'Capacity must be an integer' })
    .min(1, { message: 'Capacity must be at least 1 person' })
    .max(50, { message: 'Capacity cannot exceed 50 people' })
    .default(4),
  status: z.nativeEnum(TableStatus).default(TableStatus.AVAILABLE),
});

export const updateTableSchema = z.object({
  tableNumber: z
    .string()
    .trim()
    .min(1, { message: 'Table number is required' })
    .max(20, { message: 'Table number must be 20 characters or less' })
    .optional(),
  capacity: z.coerce
    .number({ message: 'Capacity must be a number' })
    .int({ message: 'Capacity must be an integer' })
    .min(1, { message: 'Capacity must be at least 1 person' })
    .max(50, { message: 'Capacity cannot exceed 50 people' })
    .optional(),
  status: z.nativeEnum(TableStatus).optional(),
});

export const updateTableStatusSchema = z.object({
  tableId: z.string().min(1, { message: 'Table ID is required' }),
  status: z.nativeEnum(TableStatus, { message: 'Valid table status is required' }),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
export type UpdateTableStatusInput = z.infer<typeof updateTableStatusSchema>;
