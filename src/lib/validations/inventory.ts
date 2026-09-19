import { z } from 'zod';
import { InventoryStatus, StockTransactionType, WastageReason, IngredientUnit } from '@prisma/client';

// ─── Wastage Reason Labels ──────────────────────────────────────────────────

export const WASTAGE_REASON_LABELS: Record<WastageReason, string> = {
  BURNED: 'Burned during cooking/baking',
  SPILLED: 'Spilled or dropped liquid',
  SPOILED: 'Spoiled or moldy',
  EXPIRED: 'Expired shelf life',
  DROPPED: 'Dropped on floor',
  OVER_PREPARED: 'Over-prepared surplus',
  PREPARATION_ERROR: 'Preparation or recipe error',
  DELIVERY_DAMAGE: 'Damaged in transit/delivery',
  PACKAGING_DAMAGE: 'Packaging breached or torn',
  OTHER: 'Other operational loss',
};

export const TRANSACTION_TYPE_LABELS: Record<StockTransactionType, string> = {
  OPENING: 'Opening Stock',
  RECEIPT: 'Stock Received',
  CONSUMPTION: 'Recipe Consumption',
  TRANSFER_IN: 'Transfer Received',
  TRANSFER_OUT: 'Transfer Sent',
  DAMAGE: 'Physical Damage',
  WASTAGE: 'Kitchen Wastage',
  ADJUSTMENT_IN: 'Adjustment (Surplus)',
  ADJUSTMENT_OUT: 'Adjustment (Deficit)',
};

// ─── Validation Schemas ─────────────────────────────────────────────────────

export const openingStockSchema = z.object({
  branchId: z.string().min(1, { message: 'Branch is required' }),
  ingredientId: z.string().min(1, { message: 'Ingredient is required' }),
  quantity: z.coerce
    .number({ message: 'Quantity must be a valid number' })
    .positive({ message: 'Opening quantity must be greater than 0' }),
  minimumStock: z.coerce
    .number({ message: 'Minimum stock must be a valid number' })
    .min(0, { message: 'Minimum stock cannot be negative' })
    .optional()
    .default(0),
  reorderLevel: z.coerce
    .number({ message: 'Reorder level must be a valid number' })
    .min(0, { message: 'Reorder level cannot be negative' })
    .optional()
    .default(0),
  note: z
    .string()
    .trim()
    .max(500, { message: 'Note must not exceed 500 characters' })
    .optional()
    .or(z.literal('')),
});

export const stockReceiptSchema = z.object({
  branchId: z.string().min(1, { message: 'Branch is required' }),
  ingredientId: z.string().min(1, { message: 'Ingredient is required' }),
  quantity: z.coerce
    .number({ message: 'Quantity must be a valid number' })
    .positive({ message: 'Received quantity must be greater than 0' }),
  referenceId: z
    .string()
    .trim()
    .max(100, { message: 'Reference ID must not exceed 100 characters' })
    .optional()
    .or(z.literal('')),
  note: z
    .string()
    .trim()
    .max(500, { message: 'Note must not exceed 500 characters' })
    .optional()
    .or(z.literal('')),
});

export const wastageDamageSchema = z.object({
  branchId: z.string().min(1, { message: 'Branch is required' }),
  ingredientId: z.string().min(1, { message: 'Ingredient is required' }),
  type: z.enum(['DAMAGE', 'WASTAGE'], {
    message: 'Type must be DAMAGE or WASTAGE',
  }),
  reason: z.nativeEnum(WastageReason, {
    message: 'Valid wastage reason is required',
  }),
  quantity: z.coerce
    .number({ message: 'Quantity must be a valid number' })
    .positive({ message: 'Quantity must be greater than 0' }),
  note: z
    .string()
    .trim()
    .max(500, { message: 'Note must not exceed 500 characters' })
    .optional()
    .or(z.literal('')),
});

export const stockAdjustmentSchema = z.object({
  branchId: z.string().min(1, { message: 'Branch is required' }),
  ingredientId: z.string().min(1, { message: 'Ingredient is required' }),
  direction: z.enum(['IN', 'OUT'], {
    message: 'Adjustment direction must be IN or OUT',
  }),
  quantity: z.coerce
    .number({ message: 'Adjustment quantity must be a valid number' })
    .positive({ message: 'Adjustment quantity must be greater than 0' }),
  reason: z
    .string()
    .trim()
    .min(3, { message: 'Audit reason must be at least 3 characters' })
    .max(500, { message: 'Reason must not exceed 500 characters' }),
});

export const stockTransferSchema = z
  .object({
    sourceBranchId: z.string().min(1, { message: 'Source branch is required' }),
    destinationBranchId: z.string().min(1, { message: 'Destination branch is required' }),
    ingredientId: z.string().min(1, { message: 'Ingredient is required' }),
    quantity: z.coerce
      .number({ message: 'Transfer quantity must be a valid number' })
      .positive({ message: 'Transfer quantity must be greater than 0' }),
    note: z
      .string()
      .trim()
      .max(500, { message: 'Note must not exceed 500 characters' })
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => data.sourceBranchId !== data.destinationBranchId, {
    message: 'Source and destination branches must be different',
    path: ['destinationBranchId'],
  });

export const stockReconciliationSchema = z.object({
  branchId: z.string().min(1, { message: 'Branch is required' }),
  ingredientId: z.string().min(1, { message: 'Ingredient is required' }),
  physicalCount: z.coerce
    .number({ message: 'Physical count must be a valid number' })
    .min(0, { message: 'Physical count cannot be negative' }),
  reason: z
    .string()
    .trim()
    .max(500, { message: 'Reason must not exceed 500 characters' })
    .optional()
    .or(z.literal('')),
});

export const updateInventoryItemSchema = z.object({
  minimumStock: z.coerce
    .number({ message: 'Minimum stock must be a valid number' })
    .min(0, { message: 'Minimum stock cannot be negative' }),
  reorderLevel: z.coerce
    .number({ message: 'Reorder level must be a valid number' })
    .min(0, { message: 'Reorder level cannot be negative' }),
  status: z.nativeEnum(InventoryStatus, {
    message: 'Valid inventory status is required',
  }),
});

export const inventoryFilterSchema = z.object({
  branchId: z.string().optional(),
  categoryId: z.string().optional(),
  stockStatus: z.enum(['ALL', 'HEALTHY', 'LOW_STOCK', 'OUT_OF_STOCK']).optional(),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().optional().default(20),
});

export type OpeningStockInput = z.infer<typeof openingStockSchema>;
export type StockReceiptInput = z.infer<typeof stockReceiptSchema>;
export type WastageDamageInput = z.infer<typeof wastageDamageSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type StockTransferInput = z.infer<typeof stockTransferSchema>;
export type StockReconciliationInput = z.infer<typeof stockReconciliationSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type InventoryFilterInput = z.infer<typeof inventoryFilterSchema>;
