import type { TableStatus } from '@prisma/client';

export interface TableItem {
  id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  tableNumber: string;
  capacity: number;
  status: TableStatus;
  activeOrderId: string | null;
  activeOrderNumber: string | null;
  createdAt: string;
  updatedAt: string;
}
