'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission, getAuthorizedBranchScope } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierFilterSchema,
  type CreateSupplierInput,
  type UpdateSupplierInput,
  type SupplierFilterInput,
} from '@/lib/validations/suppliers';
import type { ActionResult } from '@/lib/auth/types';
import type {
  SupplierListItem,
  SupplierDetail,
  SupplierStats,
  SupplierRecentPurchase,
} from '@/lib/suppliers/types';
import { SupplierStatus, Prisma } from '@prisma/client';

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
 * Retrieves supplier directory list with search and status filtering.
 */
export async function getSuppliers(
  filter?: Partial<SupplierFilterInput>
): Promise<ActionResult<SupplierListItem[]>> {
  try {
    const user = await requirePermission(PERMISSIONS.SUPPLIER_READ);
    const scope = await getAuthorizedBranchScope(user);

    const parsedFilter = supplierFilterSchema.safeParse(filter || {});
    const { search, status } = parsedFilter.success
      ? parsedFilter.data
      : { search: undefined, status: 'ALL' as const };

    const where: Prisma.SupplierWhereInput = {};

    if (status && status !== 'ALL') {
      where.status = status as SupplierStatus;
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ];
    }

    const branchPoFilter = !scope.isAllBranches ? { branchId: { in: scope.branchIds } } : undefined;

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        purchaseOrders: {
          where: branchPoFilter,
          select: {
            id: true,
            status: true,
            items: {
              select: {
                orderedQuantity: true,
                unitPrice: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const items: SupplierListItem[] = suppliers.map((s) => {
      let totalSpend = 0;
      for (const po of s.purchaseOrders) {
        if (po.status !== 'CANCELLED') {
          for (const item of po.items) {
            totalSpend += Number(item.orderedQuantity) * Number(item.unitPrice);
          }
        }
      }

      return {
        id: s.id,
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        address: s.address,
        city: s.city,
        state: s.state,
        postalCode: s.postalCode,
        notes: s.notes,
        status: s.status,
        totalOrders: s.purchaseOrders.length,
        totalSpend: Math.round(totalSpend * 100) / 100,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });

    return { success: true, data: items };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('getSuppliers error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch suppliers',
    };
  }
}

/**
 * Retrieves supplier KPIs and summary statistics.
 */
export async function getSupplierStats(): Promise<ActionResult<SupplierStats>> {
  try {
    const user = await requirePermission(PERMISSIONS.SUPPLIER_READ);
    const scope = await getAuthorizedBranchScope(user);

    const branchPoFilter = !scope.isAllBranches ? { branchId: { in: scope.branchIds } } : undefined;

    const [totalSuppliers, activeSuppliers, inactiveSuppliers, totalOrdersCount] =
      await Promise.all([
        prisma.supplier.count(),
        prisma.supplier.count({ where: { status: SupplierStatus.ACTIVE } }),
        prisma.supplier.count({ where: { status: SupplierStatus.INACTIVE } }),
        prisma.purchaseOrder.count({ where: branchPoFilter }),
      ]);

    return {
      success: true,
      data: {
        totalSuppliers,
        activeSuppliers,
        inactiveSuppliers,
        totalOrdersCount,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('getSupplierStats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch supplier stats',
    };
  }
}

/**
 * Retrieves a single supplier by ID with full details and purchase history.
 */
export async function getSupplierById(
  id: string
): Promise<ActionResult<SupplierDetail>> {
  try {
    const user = await requirePermission(PERMISSIONS.SUPPLIER_READ);
    const scope = await getAuthorizedBranchScope(user);

    const branchPoFilter = !scope.isAllBranches ? { branchId: { in: scope.branchIds } } : undefined;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          where: branchPoFilter,
          include: {
            branch: { select: { id: true, name: true, code: true } },
            items: {
              select: {
                id: true,
                orderedQuantity: true,
                unitPrice: true,
              },
            },
          },
          orderBy: { orderDate: 'desc' },
        },
      },
    });

    if (!supplier) {
      return { success: false, error: 'Supplier not found' };
    }

    let totalSpend = 0;
    const recentPurchases: SupplierRecentPurchase[] = supplier.purchaseOrders.map((po) => {
      let poTotal = 0;
      for (const item of po.items) {
        poTotal += Number(item.orderedQuantity) * Number(item.unitPrice);
      }
      if (po.status !== 'CANCELLED') {
        totalSpend += poTotal;
      }

      return {
        id: po.id,
        purchaseNumber: po.purchaseNumber,
        branchId: po.branch.id,
        branchName: po.branch.name,
        branchCode: po.branch.code,
        status: po.status,
        orderDate: po.orderDate,
        expectedDate: po.expectedDate,
        totalAmount: Math.round(poTotal * 100) / 100,
        itemsCount: po.items.length,
      };
    });

    const data: SupplierDetail = {
      id: supplier.id,
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      city: supplier.city,
      state: supplier.state,
      postalCode: supplier.postalCode,
      notes: supplier.notes,
      status: supplier.status,
      totalOrders: supplier.purchaseOrders.length,
      totalSpend: Math.round(totalSpend * 100) / 100,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      recentPurchases,
    };

    return { success: true, data };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('getSupplierById error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch supplier details',
    };
  }
}

/**
 * Creates a new supplier master record.
 */
export async function createSupplier(
  input: CreateSupplierInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission(PERMISSIONS.SUPPLIER_CREATE);

    const parsed = createSupplierSchema.parse(input);

    const supplier = await prisma.supplier.create({
      data: {
        name: parsed.name,
        contactPerson: parsed.contactPerson || null,
        phone: parsed.phone || null,
        email: parsed.email || null,
        address: parsed.address || null,
        city: parsed.city || null,
        state: parsed.state || null,
        postalCode: parsed.postalCode || null,
        notes: parsed.notes || null,
        status: parsed.status,
      },
    });

    revalidatePath('/suppliers');
    return { success: true, data: { id: supplier.id } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('createSupplier error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create supplier',
    };
  }
}

/**
 * Updates an existing supplier record.
 */
export async function updateSupplier(
  id: string,
  input: UpdateSupplierInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission(PERMISSIONS.SUPPLIER_UPDATE);

    const parsed = updateSupplierSchema.parse(input);

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'Supplier not found' };
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name: parsed.name,
        contactPerson: parsed.contactPerson || null,
        phone: parsed.phone || null,
        email: parsed.email || null,
        address: parsed.address || null,
        city: parsed.city || null,
        state: parsed.state || null,
        postalCode: parsed.postalCode || null,
        notes: parsed.notes || null,
        status: parsed.status,
      },
    });

    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${id}`);
    return { success: true, data: { id: updated.id } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('updateSupplier error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update supplier',
    };
  }
}

/**
 * Toggles supplier active / inactive status.
 */
export async function toggleSupplierStatus(
  id: string,
  status: SupplierStatus
): Promise<ActionResult<{ id: string; status: SupplierStatus }>> {
  try {
    await requirePermission(PERMISSIONS.SUPPLIER_DEACTIVATE);

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'Supplier not found' };
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: { status },
    });

    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${id}`);
    return { success: true, data: { id: updated.id, status: updated.status } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('toggleSupplierStatus error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update supplier status',
    };
  }
}

/**
 * Safe deletion: Only permitted if supplier has NO associated purchase orders.
 */
export async function deleteSupplier(id: string): Promise<ActionResult<void>> {
  try {
    await requirePermission(PERMISSIONS.SUPPLIER_DEACTIVATE);

    const purchaseCount = await prisma.purchaseOrder.count({
      where: { supplierId: id },
    });

    if (purchaseCount > 0) {
      return {
        success: false,
        error: `Cannot delete supplier: ${purchaseCount} purchase order(s) reference this supplier. Deactivate instead.`,
      };
    }

    await prisma.supplier.delete({ where: { id } });

    revalidatePath('/suppliers');
    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('deleteSupplier error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete supplier',
    };
  }
}
