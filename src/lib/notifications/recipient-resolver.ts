import { prisma } from '@/lib/db/prisma';

export interface EligibleRecipient {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId: string | null;
}

/**
 * Resolves eligible recipient users based on:
 * 1. Required RBAC permission code.
 * 2. Active user account status.
 * 3. Branch-level isolation:
 *    - OWNER and ADMIN receive alerts globally across all branches.
 *    - MANAGER and STAFF receive alerts only for their assigned active branch.
 *    - Sensitive financial/salary/bonus alerts are never resolved for users lacking permission.
 */
export async function resolveEligibleRecipients(
  requiredPermission: string,
  branchId?: string | null
): Promise<EligibleRecipient[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: {
        permissions: {
          some: {
            permission: {
              code: requiredPermission,
            },
          },
        },
      },
    },
    include: {
      role: true,
      employee: true,
    },
  });

  return users
    .filter((user) => {
      // OWNER and ADMIN receive alerts across all branches
      if (user.role.name === 'OWNER' || user.role.name === 'ADMIN') {
        return true;
      }

      // If notification has no branch specified (global operational event), allow
      if (!branchId) {
        return true;
      }

      // If notification belongs to a specific branch, recipient must be active at that branch
      return (
        user.employee?.employmentStatus === 'ACTIVE' &&
        user.employee.branchId === branchId
      );
    })
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      branchId: user.employee?.branchId ?? null,
    }));
}

/**
 * Resolves the authorized branch scope for a given user ID.
 */
export async function getUserBranchScope(userId: string): Promise<{
  isAllBranches: boolean;
  role: string;
  branchIds: string[];
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      employee: true,
    },
  });

  if (!user) {
    return { isAllBranches: false, role: '', branchIds: [] };
  }

  if (user.role.name === 'OWNER' || user.role.name === 'ADMIN') {
    return { isAllBranches: true, role: user.role.name, branchIds: [] };
  }

  if (user.employee?.branchId && user.employee.employmentStatus === 'ACTIVE') {
    return { isAllBranches: false, role: user.role.name, branchIds: [user.employee.branchId] };
  }

  return { isAllBranches: false, role: user.role.name, branchIds: [] };
}
