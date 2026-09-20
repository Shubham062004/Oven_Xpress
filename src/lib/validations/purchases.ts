import { z } from 'zod';
import { IngredientUnit, PurchaseOrderStatus } from '@prisma/client';

export const purchaseOrderItemInputSchema = z.object({
  ingredientId: z.string().min(1, { message: 'Ingredient is required' }),
  orderedQuantity: z.coerce
    .number({ message: 'Quantity must be a valid number' })
    .positive({ message: 'Quantity must be greater than 0' }),
  unit: z.nativeEnum(IngredientUnit),
  unitPrice: z.coerce
    .number({ message: 'Unit price must be a valid number' })
    .min(0, { message: 'Unit price must be 0 or greater' }),
});

export const createPurchaseOrderSchema = z
  .object({
    supplierId: z.string().min(1, { message: 'Please select a supplier' }),
    branchId: z.string().min(1, { message: 'Please select a branch' }),
    orderDate: z.string().or(z.date()).optional(),
    expectedDate: z.string().or(z.date()).optional().nullable(),
    notes: z
      .string()
      .trim()
      .max(500, { message: 'Notes must be 500 characters or less' })
      .optional()
      .or(z.literal('')),
    status: z
      .enum([PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.ORDERED])
      .default(PurchaseOrderStatus.ORDERED),
    items: z
      .array(purchaseOrderItemInputSchema)
      .min(1, { message: 'Purchase order must have at least one ingredient' }),
  })
  .refine(
    (data) => {
      const ingredientIds = data.items.map((i) => i.ingredientId);
      return new Set(ingredientIds).size === ingredientIds.length;
    },
    {
      message: 'Duplicate ingredients are not allowed within the same purchase order',
      path: ['items'],
    }
  );

export const receiveItemInputSchema = z.object({
  purchaseOrderItemId: z.string().min(1, { message: 'Item ID is required' }),
  receivedNow: z.coerce
    .number({ message: 'Received quantity must be a number' })
    .positive({ message: 'Received quantity must be greater than 0' }),
});

export const receiveStockSchema = z.object({
  purchaseOrderId: z.string().min(1, { message: 'Purchase order ID is required' }),
  receivedDate: z.string().or(z.date()).optional(),
  note: z
    .string()
    .trim()
    .max(500, { message: 'Note must be 500 characters or less' })
    .optional()
    .or(z.literal('')),
  items: z
    .array(receiveItemInputSchema)
    .min(1, { message: 'At least one item must have a quantity to receive' }),
});

export const cancelPurchaseOrderSchema = z.object({
  purchaseOrderId: z.string().min(1, { message: 'Purchase order ID is required' }),
  reason: z
    .string()
    .trim()
    .max(500, { message: 'Reason must be 500 characters or less' })
    .optional()
    .or(z.literal('')),
});

export const purchaseFilterSchema = z.object({
  branchId: z.string().optional(),
  supplierId: z.string().optional(),
  status: z
    .enum([
      'ALL',
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.ORDERED,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
      PurchaseOrderStatus.RECEIVED,
      PurchaseOrderStatus.CANCELLED,
    ])
    .default('ALL'),
  search: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(50),
});

export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemInputSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type ReceiveItemInput = z.infer<typeof receiveItemInputSchema>;
export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;
export type CancelPurchaseOrderInput = z.infer<typeof cancelPurchaseOrderSchema>;
export type PurchaseFilterInput = z.infer<typeof purchaseFilterSchema>;
