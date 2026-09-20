import type { OrderType, OrderStatus, TableStatus } from '@prisma/client';
import type { PaymentRecord, OrderPaymentSummary } from '@/lib/payments/types';

export interface OrderItemDetail {
  id: string;
  orderId: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalPrice: number;
  notes: string | null;
  createdAt: string;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  orderType: OrderType;
  status: OrderStatus;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  tableId: string | null;
  tableNumber: string | null;
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  deliveryCharge: number;
  totalAmount: number;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  branchId: string;
  branch: {
    id: string;
    name: string;
    code: string;
    phone: string | null;
    address: string;
    city: string;
  };
  orderType: OrderType;
  status: OrderStatus;
  customerId: string | null;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  tableId: string | null;
  table: {
    id: string;
    tableNumber: string;
    capacity: number;
    status: TableStatus;
  } | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  deliveryCharge: number;
  totalAmount: number;
  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  createdBy: string;
  items: OrderItemDetail[];
  paymentSummary: OrderPaymentSummary;
  payments: PaymentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderStats {
  todayOrders: number;
  activeOrders: number;
  preparingOrders: number;
  completedToday: number;
  todayRevenue: number;
}

export interface OrderListResponse {
  orders: OrderListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BranchTableOption {
  id: string;
  branchId: string;
  tableNumber: string;
  capacity: number;
  status: TableStatus;
}

export interface BranchMenuItemOption {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  price: number;
  isAvailable: boolean;
  preparationTimeMinutes: number;
}
