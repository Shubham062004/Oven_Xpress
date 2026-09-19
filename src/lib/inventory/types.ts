import type {
  InventoryStatus,
  StockTransactionType,
  WastageReason,
  IngredientUnit,
} from '@prisma/client';

export type StockHealthStatus = 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface InventoryItemListItem {
  id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  ingredientId: string;
  ingredientName: string;
  unit: IngredientUnit;
  currentStock: number;
  minimumStock: number;
  reorderLevel: number;
  healthStatus: StockHealthStatus;
  status: InventoryStatus;
  updatedAt: string;
}

export interface StockTransactionItem {
  id: string;
  branchId: string;
  branchName: string;
  ingredientId: string;
  ingredientName: string;
  type: StockTransactionType;
  typeLabel: string;
  direction: 'IN' | 'OUT';
  quantity: number;
  unit: IngredientUnit;
  referenceId: string | null;
  reason: WastageReason | null;
  reasonLabel: string | null;
  note: string | null;
  performedBy: string;
  createdAt: string;
}

export interface InventorySummaryStats {
  totalTrackedItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  todayReceiptsCount: number;
  todayWastageCount: number;
  activeBranchesCount: number;
}

export interface InventoryDashboardData {
  stats: InventorySummaryStats;
  items: InventoryItemListItem[];
  recentTransactions: StockTransactionItem[];
  branches: { id: string; name: string; code: string }[];
  ingredients: { id: string; name: string; unit: IngredientUnit }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InventoryItemDetail {
  id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  ingredientId: string;
  ingredientName: string;
  ingredientDescription: string | null;
  unit: IngredientUnit;
  currentStock: number;
  minimumStock: number;
  reorderLevel: number;
  healthStatus: StockHealthStatus;
  status: InventoryStatus;
  createdAt: string;
  updatedAt: string;
  summary: {
    totalReceipts: number;
    totalConsumption: number;
    totalTransfersIn: number;
    totalTransfersOut: number;
    totalDamage: number;
    totalWastage: number;
    totalAdjustmentsIn: number;
    totalAdjustmentsOut: number;
  };
  transactions: StockTransactionItem[];
}

export const IN_TRANSACTION_TYPES: readonly StockTransactionType[] = [
  'OPENING',
  'RECEIPT',
  'TRANSFER_IN',
  'ADJUSTMENT_IN',
];

export const OUT_TRANSACTION_TYPES: readonly StockTransactionType[] = [
  'CONSUMPTION',
  'TRANSFER_OUT',
  'DAMAGE',
  'WASTAGE',
  'ADJUSTMENT_OUT',
];

export function getTransactionDirection(type: StockTransactionType): 'IN' | 'OUT' {
  return IN_TRANSACTION_TYPES.includes(type) ? 'IN' : 'OUT';
}

export function calculateStockHealth(
  currentStock: number,
  minimumStock: number,
  reorderLevel: number
): StockHealthStatus {
  if (currentStock <= 0) return 'OUT_OF_STOCK';
  if (currentStock <= minimumStock || currentStock <= reorderLevel) return 'LOW_STOCK';
  return 'HEALTHY';
}
