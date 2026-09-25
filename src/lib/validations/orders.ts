import { z } from 'zod';
import { OrderType, OrderStatus } from '@prisma/client';
import { sanitizeText, sanitizeSearchQuery } from '@/lib/security/input-sanitizer';

export const orderItemInputSchema = z.object({
  menuItemId: z.string().min(1, { message: 'Menu item is required' }),
  quantity: z.coerce
    .number({ message: 'Quantity must be a valid number' })
    .int({ message: 'Quantity must be an integer' })
    .min(1, { message: 'Quantity must be at least 1' }),
  discountAmount: z.coerce
    .number({ message: 'Discount must be a number' })
    .min(0, { message: 'Discount cannot be negative' })
    .default(0),
  notes: z
    .string()
    .trim()
    .max(200, { message: 'Item notes must be 200 characters or less' })
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? sanitizeText(v) : v)),
});

export const createOrderSchema = z
  .object({
    branchId: z.string().min(1, { message: 'Branch is required' }),
    orderType: z.nativeEnum(OrderType, {
      message: 'Please select a valid order type (Dine-in, Takeaway, or Delivery)',
    }),
    tableId: z.string().optional().nullable().or(z.literal('')),
    customerId: z.string().optional().nullable().or(z.literal('')),
    customerName: z
      .string()
      .trim()
      .max(100, { message: 'Customer name must be 100 characters or less' })
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? sanitizeText(v) : v)),
    customerPhone: z
      .string()
      .trim()
      .max(20, { message: 'Customer phone must be 20 characters or less' })
      .optional()
      .or(z.literal('')),
    deliveryAddress: z
      .string()
      .trim()
      .max(300, { message: 'Delivery address must be 300 characters or less' })
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? sanitizeText(v) : v)),
    deliveryNotes: z
      .string()
      .trim()
      .max(300, { message: 'Delivery notes must be 300 characters or less' })
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? sanitizeText(v) : v)),
    discountAmount: z.coerce
      .number({ message: 'Order discount must be a number' })
      .min(0, { message: 'Discount cannot be negative' })
      .default(0),
    deliveryCharge: z.coerce
      .number({ message: 'Delivery charge must be a number' })
      .min(0, { message: 'Delivery charge cannot be negative' })
      .default(0),
    notes: z
      .string()
      .trim()
      .max(500, { message: 'Order notes must be 500 characters or less' })
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? sanitizeText(v) : v)),
    items: z
      .array(orderItemInputSchema)
      .min(1, { message: 'Order must have at least one menu item' }),
  })
  .refine(
    (data) => {
      if (data.orderType === OrderType.DINE_IN) {
        return !!data.tableId && data.tableId.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Dining table selection is required for Dine-in orders',
      path: ['tableId'],
    }
  )
  .refine(
    (data) => {
      if (data.orderType === OrderType.DELIVERY) {
        return !!data.customerName && data.customerName.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Customer name is required for Delivery orders',
      path: ['customerName'],
    }
  )
  .refine(
    (data) => {
      if (data.orderType === OrderType.DELIVERY) {
        return !!data.customerPhone && data.customerPhone.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Customer phone is required for Delivery orders',
      path: ['customerPhone'],
    }
  )
  .refine(
    (data) => {
      if (data.orderType === OrderType.DELIVERY) {
        return !!data.deliveryAddress && data.deliveryAddress.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Delivery address is required for Delivery orders',
      path: ['deliveryAddress'],
    }
  );

export const updateOrderSchema = z.object({
  customerName: z
    .string()
    .trim()
    .max(100, { message: 'Customer name must be 100 characters or less' })
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? sanitizeText(v) : v)),
  customerPhone: z
    .string()
    .trim()
    .max(20, { message: 'Customer phone must be 20 characters or less' })
    .optional()
    .or(z.literal('')),
  deliveryAddress: z
    .string()
    .trim()
    .max(300, { message: 'Delivery address must be 300 characters or less' })
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? sanitizeText(v) : v)),
  deliveryNotes: z
    .string()
    .trim()
    .max(300, { message: 'Delivery notes must be 300 characters or less' })
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? sanitizeText(v) : v)),
  notes: z
    .string()
    .trim()
    .max(500, { message: 'Order notes must be 500 characters or less' })
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? sanitizeText(v) : v)),
  discountAmount: z.coerce
    .number({ message: 'Discount must be a number' })
    .min(0, { message: 'Discount cannot be negative' })
    .optional(),
  deliveryCharge: z.coerce
    .number({ message: 'Delivery charge must be a number' })
    .min(0, { message: 'Delivery charge cannot be negative' })
    .optional(),
  items: z.array(orderItemInputSchema).min(1, { message: 'Order must contain at least 1 item' }).optional(),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1, { message: 'Order ID is required' }),
  status: z.nativeEnum(OrderStatus, { message: 'Valid order status is required' }),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1, { message: 'Order ID is required' }),
  reason: z
    .string()
    .trim()
    .min(3, { message: 'Cancellation reason must be at least 3 characters' })
    .max(500, { message: 'Cancellation reason must be 500 characters or less' })
    .transform(sanitizeText),
});

export const orderFilterSchema = z.object({
  branchId: z.string().optional().or(z.literal('')),
  orderType: z.nativeEnum(OrderType).optional().or(z.literal('ALL')),
  status: z.nativeEnum(OrderStatus).optional().or(z.literal('ALL')),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  search: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? sanitizeSearchQuery(v) : v)),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type OrderFilterInput = z.infer<typeof orderFilterSchema>;
