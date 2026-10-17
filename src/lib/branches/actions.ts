'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission, getAuthorizedBranchScope, isBranchAuthorized } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { createBranchSchema, updateBranchSchema } from '@/lib/validations/branch';
import type { ActionResult } from '@/lib/auth/types';
import type { Branch, BranchStatus } from '@prisma/client';
import { createAuditLog } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit/audit-types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BranchWithManager extends Branch {
  manager?: {
    id: string;
    name: string;
  } | null;
  managerName?: string | null;
}

export interface BranchFormState extends ActionResult<BranchWithManager> {
  fieldErrors?: Record<string, string[]>;
}

export interface BranchListParams {
  search?: string;
  status?: BranchStatus | 'ALL';
}

export interface BranchStats {
  total: number;
  active: number;
  inactive: number;
}

export interface EligibleManager {
  id: string;
  name: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const branchManagerInclude = {
  employees: {
    where: {
      employmentStatus: 'ACTIVE' as const,
      user: {
        isActive: true,
        role: { name: 'MANAGER' },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
};

function transformBranchWithManager<
  T extends Branch & {
    employees?: Array<{
      user: { id: string; name: string } | null;
    } | null>;
  },
>(branch: T): BranchWithManager {
  const managerUser = branch.employees?.[0]?.user ?? null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { employees, ...rest } = branch;
  return {
    ...rest,
    manager: managerUser ? { id: managerUser.id, name: managerUser.name } : null,
    managerName: managerUser ? managerUser.name : null,
  };
}

// ─── Read Operations ────────────────────────────────────────────────────────

/**
 * Fetches all branches with optional search and status filter.
 * Scoped to authorized branches for branch-restricted users.
 * Includes assigned Branch Manager details.
 */
export async function getBranches(
  params?: BranchListParams
): Promise<ActionResult<BranchWithManager[]>> {
  try {
    const user = await requirePermission(PERMISSIONS.BRANCH_READ);
    const scope = await getAuthorizedBranchScope(user);

    const { search, status } = params ?? {};

    const where: Record<string, unknown> = {};

    if (!scope.isAllBranches) {
      where.id = { in: scope.branchIds };
    }

    // Status filter
    if (status && status !== 'ALL') {
      where.status = status;
    }

    // Search filter: name, code, city, or assigned manager name
    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { code: { contains: searchTerm, mode: 'insensitive' } },
        { city: { contains: searchTerm, mode: 'insensitive' } },
        {
          employees: {
            some: {
              employmentStatus: 'ACTIVE',
              user: {
                isActive: true,
                name: { contains: searchTerm, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }

    const branches = await prisma.branch.findMany({
      where,
      include: branchManagerInclude,
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: branches.map(transformBranchWithManager) };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch branches:', error);
    return { success: false, error: 'Failed to load branches. Please try again.' };
  }
}

/**
 * Fetches a single branch by ID with ownership/authorization validation and assigned manager.
 */
export async function getBranchById(
  id: string
): Promise<ActionResult<BranchWithManager>> {
  try {
    const user = await requirePermission(PERMISSIONS.BRANCH_READ);
    const scope = await getAuthorizedBranchScope(user);

    if (!isBranchAuthorized(scope, id)) {
      return { success: false, error: 'Forbidden: Access to this branch is denied.' };
    }

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: branchManagerInclude,
    });

    if (!branch) {
      return { success: false, error: 'Branch not found.' };
    }

    return { success: true, data: transformBranchWithManager(branch) };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch branch:', error);
    return { success: false, error: 'Failed to load branch details. Please try again.' };
  }
}

/**
 * Fetches aggregate branch statistics scoped to authorized branches.
 */
export async function getBranchStats(): Promise<ActionResult<BranchStats>> {
  try {
    const user = await requirePermission(PERMISSIONS.BRANCH_READ);
    const scope = await getAuthorizedBranchScope(user);

    const branchWhere = !scope.isAllBranches ? { id: { in: scope.branchIds } } : {};

    const [total, active, inactive] = await Promise.all([
      prisma.branch.count({ where: branchWhere }),
      prisma.branch.count({ where: { ...branchWhere, status: 'ACTIVE' } }),
      prisma.branch.count({ where: { ...branchWhere, status: 'INACTIVE' } }),
    ]);

    return { success: true, data: { total, active, inactive } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch branch stats:', error);
    return { success: false, error: 'Failed to load branch statistics.' };
  }
}

/**
 * Fetches active users with the Branch Manager role.
 * Restricts details to ID and name only (no email, phone, or other personal details).
 */
export async function getEligibleBranchManagers(): Promise<
  ActionResult<EligibleManager[]>
> {
  try {
    const user = await requirePermission(PERMISSIONS.BRANCH_READ);
    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return {
        success: false,
        error: 'Forbidden: Requires OWNER or ADMIN role privileges.',
      };
    }

    const managers = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: 'MANAGER' },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return { success: true, data: managers };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch eligible managers:', error);
    return { success: false, error: 'Failed to load eligible branch managers.' };
  }
}

// ─── Write Operations ───────────────────────────────────────────────────────

/**
 * Helper to assign or change a branch manager user association.
 */
async function syncBranchManager(branchId: string, managerUserId: string | null | undefined) {
  if (managerUserId === undefined) return;

  const isUnassigning = !managerUserId || managerUserId === 'UNASSIGNED' || managerUserId === 'NONE';

  if (isUnassigning) {
    // Unlink any active manager employee from this branch
    const existingMgr = await prisma.employee.findFirst({
      where: {
        branchId,
        employmentStatus: 'ACTIVE',
        user: { role: { name: 'MANAGER' } },
      },
    });

    if (existingMgr) {
      await prisma.employee.update({
        where: { id: existingMgr.id },
        data: { userId: null },
      });
    }
    return;
  }

  // Validate manager user
  const managerUser = await prisma.user.findUnique({
    where: { id: managerUserId },
    include: { role: true, employee: true },
  });

  if (!managerUser || !managerUser.isActive || managerUser.role.name !== 'MANAGER') {
    throw new Error('Selected user is not an active Branch Manager.');
  }

  // Unlink any previous manager employee on this branch
  const previousBranchMgr = await prisma.employee.findFirst({
    where: {
      branchId,
      employmentStatus: 'ACTIVE',
      user: { role: { name: 'MANAGER' } },
    },
  });

  if (previousBranchMgr && previousBranchMgr.userId !== managerUser.id) {
    await prisma.employee.update({
      where: { id: previousBranchMgr.id },
      data: { userId: null },
    });
  }

  // Associate manager with this branch
  if (managerUser.employee) {
    await prisma.employee.update({
      where: { id: managerUser.employee.id },
      data: {
        branchId,
        employmentStatus: 'ACTIVE',
      },
    });
  } else {
    const nameParts = managerUser.name.trim().split(/\s+/);
    await prisma.employee.create({
      data: {
        employeeCode: `EMP-MGR-${Date.now().toString().slice(-6)}`,
        firstName: nameParts[0] || 'Branch',
        lastName: nameParts.slice(1).join(' ') || 'Manager',
        phone: managerUser.phone || '+91 98000 00000',
        email: managerUser.email,
        joiningDate: new Date(),
        designation: 'Branch Manager',
        salary: 65000,
        salaryType: 'MONTHLY',
        branchId,
        employmentStatus: 'ACTIVE',
        userId: managerUser.id,
      },
    });
  }
}

/**
 * Creates a new branch after verifying permission, validation, and code uniqueness.
 * Strictly restricted to OWNER.
 */
export async function createBranch(
  data: Record<string, unknown>
): Promise<BranchFormState> {
  try {
    const user = await requirePermission(PERMISSIONS.BRANCH_CREATE);
    if (user.role !== 'OWNER') {
      return {
        success: false,
        error: 'Forbidden: Only the Owner can create new restaurant branches.',
      };
    }

    // Validate input
    const parsed = createBranchSchema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? '_form';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return {
        success: false,
        error: 'Please fix the validation errors below.',
        fieldErrors,
      };
    }

    const input = parsed.data;

    // Check uniqueness of branch code
    const existingCode = await prisma.branch.findUnique({
      where: { code: input.code },
    });

    if (existingCode) {
      return {
        success: false,
        error: 'A branch with this code already exists.',
        fieldErrors: { code: ['This branch code is already in use.'] },
      };
    }

    // Create the branch
    const branch = await prisma.branch.create({
      data: {
        name: input.name,
        code: input.code,
        description: input.description || null,
        address: input.address,
        city: input.city,
        state: input.state || null,
        postalCode: input.postalCode || null,
        phone: input.phone || null,
        email: input.email || null,
        openingTime: input.openingTime || null,
        closingTime: input.closingTime || null,
        status: input.status || 'ACTIVE',
      },
    });

    // Handle manager assignment if provided
    if (input.managerId) {
      await syncBranchManager(branch.id, input.managerId);
    }

    await createAuditLog({
      actorUserId: user.id,
      branchId: branch.id,
      action: AUDIT_ACTIONS.BRANCH_CREATE,
      entityType: AUDIT_ENTITY_TYPES.BRANCH,
      entityId: branch.id,
      description: `Created branch "${branch.name}" (${branch.code}) in ${branch.city}`,
      afterData: {
        name: branch.name,
        code: branch.code,
        city: branch.city,
        status: branch.status,
      },
    }).catch((e: unknown) => console.error('Failed to create branch audit log:', e));

    revalidatePath('/branches');
    revalidatePath('/owner/branches');

    const createdBranch = await prisma.branch.findUnique({
      where: { id: branch.id },
      include: branchManagerInclude,
    });

    return {
      success: true,
      data: createdBranch ? transformBranchWithManager(createdBranch) : (branch as BranchWithManager),
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to create branch:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating the branch. Please try again.',
    };
  }
}

/**
 * Updates an existing branch and optionally assigns/changes manager and status.
 * Strictly restricted to OWNER.
 */
export async function updateBranch(
  id: string,
  data: Record<string, unknown>
): Promise<BranchFormState> {
  try {
    const user = await requirePermission(PERMISSIONS.BRANCH_UPDATE);
    if (user.role !== 'OWNER') {
      return {
        success: false,
        error: 'Forbidden: Only the Owner can modify branches and manager assignments.',
      };
    }

    // Validate input
    const parsed = updateBranchSchema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? '_form';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return {
        success: false,
        error: 'Please fix the validation errors below.',
        fieldErrors,
      };
    }

    // Verify the branch exists
    const existing = await prisma.branch.findUnique({
      where: { id },
      include: branchManagerInclude,
    });
    if (!existing) {
      return { success: false, error: 'Branch not found.' };
    }

    const input = parsed.data;

    // If branch code changed, check uniqueness
    if (input.code && input.code !== existing.code) {
      const existingCode = await prisma.branch.findUnique({
        where: { code: input.code },
      });
      if (existingCode && existingCode.id !== id) {
        return {
          success: false,
          error: 'A branch with this code already exists.',
          fieldErrors: { code: ['This branch code is already in use.'] },
        };
      }
    }

    // Sync manager assignment
    if (input.managerId !== undefined) {
      try {
        await syncBranchManager(id, input.managerId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid manager selection.';
        return {
          success: false,
          error: message,
          fieldErrors: { managerId: [message] },
        };
      }
    }

    // Update the branch
    const branch = await prisma.branch.update({
      where: { id },
      data: {
        name: input.name,
        ...(input.code ? { code: input.code } : {}),
        description: input.description || null,
        address: input.address,
        city: input.city,
        state: input.state || null,
        postalCode: input.postalCode || null,
        phone: input.phone || null,
        email: input.email || null,
        openingTime: input.openingTime || null,
        closingTime: input.closingTime || null,
        ...(input.status ? { status: input.status } : {}),
      },
    });

    const previousManager = existing.employees?.[0]?.user?.name ?? 'Unassigned';

    await createAuditLog({
      actorUserId: user.id,
      branchId: branch.id,
      action: AUDIT_ACTIONS.BRANCH_UPDATE,
      entityType: AUDIT_ENTITY_TYPES.BRANCH,
      entityId: branch.id,
      description: `Updated branch "${branch.name}" (${branch.code})`,
      beforeData: {
        name: existing.name,
        code: existing.code,
        city: existing.city,
        status: existing.status,
        manager: previousManager,
      },
      afterData: {
        name: branch.name,
        code: branch.code,
        city: branch.city,
        status: branch.status,
      },
    }).catch((e: unknown) => console.error('Failed to create branch update audit log:', e));

    revalidatePath('/branches');
    revalidatePath(`/branches/${id}`);
    revalidatePath('/owner/branches');

    const updatedWithManager = await prisma.branch.findUnique({
      where: { id },
      include: branchManagerInclude,
    });

    return {
      success: true,
      data: updatedWithManager ? transformBranchWithManager(updatedWithManager) : (branch as BranchWithManager),
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to update branch:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating the branch. Please try again.',
    };
  }
}

/**
 * Safely deletes or deactivates a branch.
 * Strictly restricted to OWNER.
 * - If the branch is ACTIVE, safely deactivates it to preserve historical records.
 * - If the branch is ALREADY INACTIVE, prevents deletion if operational records exist.
 * - If ZERO operational records exist, deletes cleanly.
 */
export async function deleteBranch(
  id: string
): Promise<ActionResult<{ deactivated: boolean; message: string; branch?: BranchWithManager }>> {
  try {
    const user = await requirePermission(PERMISSIONS.BRANCH_DEACTIVATE);
    if (user.role !== 'OWNER') {
      return {
        success: false,
        error: 'Forbidden: Only the Owner can delete or deactivate restaurant branches.',
      };
    }

    const existing = await prisma.branch.findUnique({
      where: { id },
      include: branchManagerInclude,
    });

    if (!existing) {
      return { success: false, error: 'Branch not found.' };
    }

    // Check associated operational history
    const [
      orderCount,
      paymentCount,
      attendanceCount,
      stockCount,
      purchaseCount,
      employeeCount,
    ] = await Promise.all([
      prisma.order.count({ where: { branchId: id } }),
      prisma.payment.count({ where: { branchId: id } }),
      prisma.attendance.count({ where: { branchId: id } }),
      prisma.stockTransaction.count({ where: { branchId: id } }),
      prisma.purchaseOrder.count({ where: { branchId: id } }),
      prisma.employee.count({ where: { branchId: id } }),
    ]);

    const totalOperationalRecords =
      orderCount + paymentCount + attendanceCount + stockCount + purchaseCount;

    // 1. If branch is currently ACTIVE, safe deactivation is required to preserve history
    if (existing.status === 'ACTIVE') {
      const updated = await prisma.branch.update({
        where: { id },
        data: { status: 'INACTIVE' },
        include: branchManagerInclude,
      });

      await createAuditLog({
        actorUserId: user.id,
        branchId: id,
        action: AUDIT_ACTIONS.BRANCH_DEACTIVATE,
        entityType: AUDIT_ENTITY_TYPES.BRANCH,
        entityId: id,
        description: `Safely deactivated branch "${existing.name}" (${existing.code}) to preserve historical operational records`,
        beforeData: { status: existing.status },
        afterData: { status: 'INACTIVE' },
      }).catch((e: unknown) => console.error('Failed to create deactivation audit log:', e));

      revalidatePath('/branches');
      revalidatePath(`/branches/${id}`);
      revalidatePath('/owner/branches');

      return {
        success: true,
        data: {
          deactivated: true,
          message: `Branch "${existing.name}" has been safely deactivated to preserve historical operational records.`,
          branch: transformBranchWithManager(updated),
        },
      };
    }

    // 2. If branch is ALREADY INACTIVE:
    // Prohibit permanent deletion if historical operational records or staff exist
    if (totalOperationalRecords > 0 || employeeCount > 0) {
      return {
        success: false,
        error: `Cannot permanently delete "${existing.name}": ${totalOperationalRecords} historical records (orders, payments, inventory, or attendance) exist. The branch must remain deactivated to preserve operational integrity.`,
      };
    }

    // 3. Zero operational history: safe to purge empty configuration records and delete
    await prisma.shift.deleteMany({ where: { branchId: id } });
    await prisma.restaurantTable.deleteMany({ where: { branchId: id } });
    await prisma.branchMenuItem.deleteMany({ where: { branchId: id } });
    await prisma.inventoryItem.deleteMany({ where: { branchId: id } });
    await prisma.branch.delete({ where: { id } });

    await createAuditLog({
      actorUserId: user.id,
      action: AUDIT_ACTIONS.BRANCH_DEACTIVATE,
      entityType: AUDIT_ENTITY_TYPES.BRANCH,
      entityId: id,
      description: `Permanently removed unused branch "${existing.name}" (${existing.code})`,
      beforeData: { name: existing.name, code: existing.code, city: existing.city },
    }).catch((e: unknown) => console.error('Failed to create permanent deletion audit log:', e));

    revalidatePath('/branches');
    revalidatePath('/owner/branches');

    return {
      success: true,
      data: {
        deactivated: false,
        message: `Branch "${existing.name}" was permanently removed.`,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to delete/deactivate branch:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while processing the branch deletion.',
    };
  }
}

/**
 * Toggles a branch between ACTIVE and INACTIVE status.
 */
export async function toggleBranchStatus(
  id: string
): Promise<ActionResult<BranchWithManager>> {
  try {
    const user = await requirePermission(PERMISSIONS.BRANCH_DEACTIVATE);
    const scope = await getAuthorizedBranchScope(user);

    if (!isBranchAuthorized(scope, id)) {
      return {
        success: false,
        error: 'Forbidden: You do not have permission to modify this branch status.',
      };
    }

    const existing = await prisma.branch.findUnique({
      where: { id },
      include: branchManagerInclude,
    });
    if (!existing) {
      return { success: false, error: 'Branch not found.' };
    }

    const newStatus: BranchStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const branch = await prisma.branch.update({
      where: { id },
      data: { status: newStatus },
      include: branchManagerInclude,
    });

    await createAuditLog({
      actorUserId: user.id,
      branchId: branch.id,
      action: newStatus === 'ACTIVE' ? AUDIT_ACTIONS.BRANCH_ACTIVATE : AUDIT_ACTIONS.BRANCH_DEACTIVATE,
      entityType: AUDIT_ENTITY_TYPES.BRANCH,
      entityId: branch.id,
      description: `${newStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'} branch "${branch.name}" (${branch.code})`,
      beforeData: { status: existing.status },
      afterData: { status: branch.status },
    }).catch((e: unknown) => console.error('Failed to create branch toggle audit log:', e));

    revalidatePath('/branches');
    revalidatePath(`/branches/${id}`);
    revalidatePath('/owner/branches');
    return { success: true, data: transformBranchWithManager(branch) };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to toggle branch status:', error);
    return {
      success: false,
      error: 'Failed to update branch status. Please try again.',
    };
  }
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Detects Next.js redirect errors so they propagate correctly
 * instead of being caught as generic failures.
 */
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
