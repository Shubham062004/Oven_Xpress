import type { PurchaseOrderStatus, IngredientUnit } from '@prisma/client';

export interface PurchaseOrderListItem {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  status: PurchaseOrderStatus;
  orderDate: Date;
  expectedDate: Date | null;
  totalAmount: number;
  itemsCount: number;
  totalOrderedQuantity: number;
  totalReceivedQuantity: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrderItemDetail {
  id: string;
  ingredientId: string;
  ingredientName: string;
  unit: IngredientUnit;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseReceivingLogItem {
  id: string;
  purchaseOrderItemId: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: IngredientUnit;
}

export interface PurchaseReceivingLog {
  id: string;
  receivingNumber: string;
  receivedBy: string;
  receivedAt: Date;
  notes: string | null;
  items: PurchaseReceivingLogItem[];
}

export interface PurchaseOrderDetail {
  id: string;
  purchaseNumber: string;
  status: PurchaseOrderStatus;
  orderDate: Date;
  expectedDate: Date | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  supplier: {
    id: string;
    name: string;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
  };
  branch: {
    id: string;
    name: string;
    code: string;
    address: string;
    city: string;
  };
  items: PurchaseOrderItemDetail[];
  receivingLogs: PurchaseReceivingLog[];
  subtotal: number;
  totalOrderedQuantity: number;
  totalReceivedQuantity: number;
  fulfillmentPercentage: number;
}

export interface PurchaseStats {
  totalOrders: number;
  draftOrders: number;
  orderedOrders: number;
  partiallyReceivedOrders: number;
  receivedOrders: number;
  cancelledOrders: number;
  totalSpend: number;
}
