import type { SupplierStatus, PurchaseOrderStatus } from '@prisma/client';

export interface SupplierListItem {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  notes: string | null;
  status: SupplierStatus;
  totalOrders: number;
  totalSpend: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierRecentPurchase {
  id: string;
  purchaseNumber: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  status: PurchaseOrderStatus;
  orderDate: Date;
  expectedDate: Date | null;
  totalAmount: number;
  itemsCount: number;
}

export interface SupplierDetail extends SupplierListItem {
  recentPurchases: SupplierRecentPurchase[];
}

export interface SupplierStats {
  totalSuppliers: number;
  activeSuppliers: number;
  inactiveSuppliers: number;
  totalOrdersCount: number;
}
