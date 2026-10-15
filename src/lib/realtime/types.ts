export type RealtimeEventType =
  | 'order:created'
  | 'order:status_changed'
  | 'kitchen:status_changed'
  | 'payment:updated'
  | 'inventory:updated'
  | 'attendance:updated'
  | 'notification:new'
  | 'bug_report:created'
  | 'system:ping';

export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: string;
  branchId: string;
  orderType: string;
  status: string;
  totalAmount: number;
  customerName?: string;
  tableNumber?: string | null;
  itemCount: number;
  createdAt: string;
}

export interface OrderStatusChangedPayload {
  orderId: string;
  orderNumber: string;
  branchId: string;
  fromStatus?: string;
  toStatus: string;
  orderType?: string;
  updatedAt: string;
}

export interface KitchenStatusChangedPayload {
  orderId: string;
  orderNumber: string;
  branchId: string;
  status: string;
  readyAt?: string | null;
  preparedBy?: string | null;
  updatedAt: string;
}

export interface PaymentUpdatedPayload {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  branchId: string;
  amount: number;
  status: string;
  method: string;
  updatedAt: string;
}

export interface InventoryUpdatedPayload {
  branchId: string;
  ingredientId: string;
  ingredientName?: string;
  type: string;
  quantity: number;
  updatedAt: string;
}

export interface AttendanceUpdatedPayload {
  branchId: string;
  employeeId: string;
  employeeName?: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'STATUS_CHANGE';
  updatedAt: string;
}

export interface NotificationNewPayload {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  targetUserId?: string | null;
  createdAt: string;
}

export interface BugReportCreatedPayload {
  reportId: string;
  reportNumber: string;
  title: string;
  category: string;
  createdAt: string;
}

export type RealtimePayloadMap = {
  'order:created': OrderCreatedPayload;
  'order:status_changed': OrderStatusChangedPayload;
  'kitchen:status_changed': KitchenStatusChangedPayload;
  'payment:updated': PaymentUpdatedPayload;
  'inventory:updated': InventoryUpdatedPayload;
  'attendance:updated': AttendanceUpdatedPayload;
  'notification:new': NotificationNewPayload;
  'bug_report:created': BugReportCreatedPayload;
  'system:ping': { timestamp: number };
};

export interface RealtimeMessage<T extends RealtimeEventType = RealtimeEventType> {
  id: string;
  type: T;
  channel: string;
  payload: RealtimePayloadMap[T];
  timestamp: number;
}
