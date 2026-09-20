import type { OrderType, OrderStatus, IngredientUnit } from '@prisma/client';

export interface KitchenOrderItem {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  notes: string | null;
  preparationTimeMinutes: number;
  hasRecipe: boolean;
}

export interface KitchenOrderCardData {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  orderType: OrderType;
  status: OrderStatus;
  tableId: string | null;
  tableNumber: string | null;
  customerName: string | null;
  deliveryNotes: string | null;
  notes: string | null;
  createdAt: string;
  confirmedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  elapsedMinutes: number;
  prepMinutes: number | null;
  targetPrepMinutes: number;
  inventoryConsumed: boolean;
  hasMissingRecipe: boolean;
  items: KitchenOrderItem[];
}

export interface KitchenStats {
  newOrdersCount: number;
  preparingOrdersCount: number;
  readyOrdersCount: number;
  totalActiveCount: number;
}

export interface KitchenBoardData {
  stats: KitchenStats;
  newOrders: KitchenOrderCardData[];
  preparingOrders: KitchenOrderCardData[];
  readyOrders: KitchenOrderCardData[];
  lastSyncedAt: string;
}

export interface InsufficientStockDetail {
  ingredientId: string;
  ingredientName: string;
  requiredQuantity: number;
  availableQuantity: number;
  unit: IngredientUnit;
}

export interface KitchenStartOrderResult {
  orderId: string;
  status: OrderStatus;
  inventoryConsumed: boolean;
  ingredientsDeducted: number;
  warnings?: string[];
  shortages?: InsufficientStockDetail[];
}
