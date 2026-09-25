'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission, getAuthorizedBranchScope, isBranchAuthorized } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import type { ActionResult } from '@/lib/auth/types';
import {
  createTableSchema,
  updateTableSchema,
  updateTableStatusSchema,
  type CreateTableInput,
  type UpdateTableInput,
  type UpdateTableStatusInput,
} from '@/lib/validations/tables';
import type { TableItem } from '@/lib/tables/types';
import { TableStatus, OrderStatus } from '@prisma/client';

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as Record<string, unknown>).digest === 'string' &&
    ((error as Record<string, string>).digest.startsWith('NEXT_REDIRECT') ||
      (error as Record<string, string>).digest === 'DYNAMIC_SERVER_USAGE')
  );
}



/**
 * Fetches all tables for a given branch with active order details.
 */
export async function getBranchTables(
  branchId: string
): Promise<ActionResult<TableItem[]>> {
  try {
    const user = await requirePermission(PERMISSIONS.TABLE_READ);
    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    const tables = await prisma.restaurantTable.findMany({
      where: { branchId },
      orderBy: { tableNumber: 'asc' },
      include: {
        branch: { select: { name: true, code: true } },
        orders: {
          where: {
            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                OrderStatus.PREPARING,
                OrderStatus.READY,
              ],
            },
          },
          select: { id: true, orderNumber: true },
          take: 1,
        },
      },
    });

    const items: TableItem[] = tables.map((t) => ({
      id: t.id,
      branchId: t.branchId,
      branchName: t.branch.name,
      branchCode: t.branch.code,
      tableNumber: t.tableNumber,
      capacity: t.capacity,
      status: t.status,
      activeOrderId: t.orders[0]?.id || null,
      activeOrderNumber: t.orders[0]?.orderNumber || null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return { success: true, data: items };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to get branch tables:', error);
    return { success: false, error: 'Failed to retrieve tables' };
  }
}

/**
 * Creates a new restaurant table for a branch.
 */
export async function createTable(
  input: CreateTableInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.TABLE_CREATE);
    const parsed = createTableSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid table data' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, parsed.data.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    // Check duplicate tableNumber within branch
    const existing = await prisma.restaurantTable.findUnique({
      where: {
        branchId_tableNumber: {
          branchId: parsed.data.branchId,
          tableNumber: parsed.data.tableNumber,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Table "${parsed.data.tableNumber}" already exists in this branch`,
      };
    }

    const table = await prisma.restaurantTable.create({
      data: {
        branchId: parsed.data.branchId,
        tableNumber: parsed.data.tableNumber,
        capacity: parsed.data.capacity,
        status: parsed.data.status,
      },
    });

    revalidatePath('/orders');
    revalidatePath('/orders/new');
    return { success: true, data: { id: table.id } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to create table:', error);
    return { success: false, error: 'Failed to create table' };
  }
}

/**
 * Updates table details (number, capacity, status).
 */
export async function updateTable(
  id: string,
  input: UpdateTableInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.TABLE_UPDATE);
    const parsed = updateTableSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid update data' };
    }

    const table = await prisma.restaurantTable.findUnique({
      where: { id },
    });

    if (!table) {
      return { success: false, error: 'Table not found' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, table.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    // If changing table number, verify uniqueness
    if (parsed.data.tableNumber && parsed.data.tableNumber !== table.tableNumber) {
      const existing = await prisma.restaurantTable.findUnique({
        where: {
          branchId_tableNumber: {
            branchId: table.branchId,
            tableNumber: parsed.data.tableNumber,
          },
        },
      });
      if (existing) {
        return {
          success: false,
          error: `Table "${parsed.data.tableNumber}" already exists in this branch`,
        };
      }
    }

    await prisma.restaurantTable.update({
      where: { id },
      data: {
        ...(parsed.data.tableNumber && { tableNumber: parsed.data.tableNumber }),
        ...(parsed.data.capacity !== undefined && { capacity: parsed.data.capacity }),
        ...(parsed.data.status && { status: parsed.data.status }),
      },
    });

    revalidatePath('/orders');
    revalidatePath('/orders/new');
    return { success: true, data: { id } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to update table:', error);
    return { success: false, error: 'Failed to update table' };
  }
}

/**
 * Updates table status (e.g. AVAILABLE -> CLEANING -> AVAILABLE).
 */
export async function updateTableStatus(
  input: UpdateTableStatusInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.TABLE_STATUS);
    const parsed = updateTableStatusSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid status data' };
    }

    const table = await prisma.restaurantTable.findUnique({
      where: { id: parsed.data.tableId },
      include: {
        orders: {
          where: {
            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                OrderStatus.PREPARING,
                OrderStatus.READY,
              ],
            },
          },
        },
      },
    });

    if (!table) {
      return { success: false, error: 'Table not found' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, table.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    // If attempting to set to AVAILABLE but an active order exists, block
    if (
      parsed.data.status === TableStatus.AVAILABLE &&
      table.orders.length > 0
    ) {
      return {
        success: false,
        error: `Cannot set table to AVAILABLE while active order ${table.orders[0].orderNumber} is assigned`,
      };
    }

    await prisma.restaurantTable.update({
      where: { id: parsed.data.tableId },
      data: { status: parsed.data.status },
    });

    revalidatePath('/orders');
    revalidatePath('/orders/new');
    return { success: true, data: { id: table.id } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to update table status:', error);
    return { success: false, error: 'Failed to update table status' };
  }
}
