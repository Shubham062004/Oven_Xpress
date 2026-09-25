'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission, getAuthorizedBranchScope, isBranchAuthorized } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
} from '@/lib/validations/employee';
import type { ActionResult } from '@/lib/auth/types';
import type { EmploymentStatus, SalaryType } from '@prisma/client';
import { createAuditLog } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit/audit-types';
import { checkAccountCreationRateLimit } from '@/lib/security/abuse-protection';
import { logTrafficAnomaly } from '@/lib/security/security-logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmployeeItem {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  dateOfBirth: Date | null;
  joiningDate: Date;
  designation: string;
  branchId: string;
  employmentStatus: EmploymentStatus;
  salary: number;
  salaryType: SalaryType;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  branch: {
    id: string;
    name: string;
    code: string;
    city: string;
    status: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    role: {
      name: string;
    };
  } | null;
}

export interface EmployeeFormState extends ActionResult<EmployeeItem> {
  fieldErrors?: Record<string, string[]>;
}

export interface EmployeeListParams {
  search?: string;
  branchId?: string;
  status?: EmploymentStatus | 'ALL';
  designation?: string;
}

export interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  branchCounts: Record<string, number>;
}

export interface BranchOption {
  id: string;
  name: string;
  code: string;
  city: string;
}

export interface UserOption {
  id: string;
  name: string;
  email: string;
  roleName: string;
}

// ─── Read Operations ────────────────────────────────────────────────────────

/**
 * Fetches employees with optional search, branch, status, and designation filters.
 * Enforces server-side branch scope isolation.
 */
export async function getEmployees(
  params?: EmployeeListParams
): Promise<ActionResult<EmployeeItem[]>> {
  try {
    const user = await requirePermission(PERMISSIONS.EMPLOYEE_READ);
    const scope = await getAuthorizedBranchScope(user);

    const { search, branchId, status, designation } = params ?? {};

    const where: Record<string, unknown> = {};

    // Branch filter with authorization check
    if (branchId && branchId !== 'ALL') {
      if (!isBranchAuthorized(scope, branchId)) {
        return { success: false, error: 'Unauthorized branch access.' };
      }
      where.branchId = branchId;
    } else if (!scope.isAllBranches) {
      where.branchId = { in: scope.branchIds };
    }

    // Status filter
    if (status && status !== 'ALL') {
      where.employmentStatus = status;
    }

    // Designation filter
    if (designation && designation !== 'ALL') {
      where.designation = designation;
    }

    // Search filter: name, code, phone, or email
    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      where.OR = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { employeeCode: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted: EmployeeItem[] = employees.map((emp) => ({
      ...emp,
      salary: Number(emp.salary),
    }));

    return { success: true, data: formatted };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch employees:', error);
    return { success: false, error: 'Failed to load employees. Please try again.' };
  }
}

/**
 * Fetches a single employee by ID with full branch and user relations.
 * Verifies caller has branch scope access for the requested employee.
 */
export async function getEmployeeById(
  id: string
): Promise<ActionResult<EmployeeItem>> {
  try {
    const user = await requirePermission(PERMISSIONS.EMPLOYEE_READ);
    const scope = await getAuthorizedBranchScope(user);

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      return { success: false, error: 'Employee not found.' };
    }

    if (!isBranchAuthorized(scope, employee.branchId)) {
      return { success: false, error: 'Unauthorized to view employee from this branch.' };
    }

    return {
      success: true,
      data: {
        ...employee,
        salary: Number(employee.salary),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch employee details:', error);
    return { success: false, error: 'Failed to load employee details. Please try again.' };
  }
}

/**
 * Fetches aggregate employee statistics scoped to user's authorized branches.
 */
export async function getEmployeeStats(): Promise<ActionResult<EmployeeStats>> {
  try {
    const user = await requirePermission(PERMISSIONS.EMPLOYEE_READ);
    const scope = await getAuthorizedBranchScope(user);

    const branchFilter = !scope.isAllBranches
      ? { branchId: { in: scope.branchIds } }
      : {};

    const [total, active, inactive, branchGroup] = await Promise.all([
      prisma.employee.count({ where: branchFilter }),
      prisma.employee.count({ where: { ...branchFilter, employmentStatus: 'ACTIVE' } }),
      prisma.employee.count({ where: { ...branchFilter, employmentStatus: 'INACTIVE' } }),
      prisma.employee.groupBy({
        by: ['branchId'],
        where: branchFilter,
        _count: { _all: true },
      }),
    ]);

    const branchCounts: Record<string, number> = {};
    for (const group of branchGroup) {
      branchCounts[group.branchId] = group._count._all;
    }

    return {
      success: true,
      data: {
        total,
        active,
        inactive,
        branchCounts,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch employee statistics:', error);
    return { success: false, error: 'Failed to load employee statistics.' };
  }
}

/**
 * Fetches active branches for dropdown selection in employee forms (scoped to authorized branches).
 */
export async function getActiveBranchesForSelect(): Promise<ActionResult<BranchOption[]>> {
  try {
    const user = await requirePermission(PERMISSIONS.EMPLOYEE_READ);
    const scope = await getAuthorizedBranchScope(user);

    const branches = await prisma.branch.findMany({
      where: {
        status: 'ACTIVE',
        ...(!scope.isAllBranches ? { id: { in: scope.branchIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
      },
      orderBy: { name: 'asc' },
    });

    return { success: true, data: branches };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to load branches for selection:', error);
    return { success: false, error: 'Failed to load branches.' };
  }
}

/**
 * Fetches available User accounts that can be linked to an employee.
 * Returns active users without an employee, plus optionally the user currently linked.
 */
export async function getAvailableUsersForLinking(
  currentEmployeeId?: string
): Promise<ActionResult<UserOption[]>> {
  try {
    await requirePermission(PERMISSIONS.EMPLOYEE_READ);

    // Find users who either have no employee or are already linked to this employee
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { employee: null },
          ...(currentEmployeeId
            ? [{ employee: { id: currentEmployeeId } }]
            : []),
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        roleName: u.role.name,
      })),
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to load available users:', error);
    return { success: false, error: 'Failed to load available user accounts.' };
  }
}

/**
 * Fetches unique designations across all employees for filter dropdown.
 */
export async function getEmployeeDesignations(): Promise<ActionResult<string[]>> {
  try {
    await requirePermission(PERMISSIONS.EMPLOYEE_READ);

    const designations = await prisma.employee.findMany({
      select: { designation: true },
      distinct: ['designation'],
      orderBy: { designation: 'asc' },
    });

    return {
      success: true,
      data: designations.map((d) => d.designation),
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to load designations:', error);
    return { success: false, error: 'Failed to load designations.' };
  }
}

// ─── Write Operations ───────────────────────────────────────────────────────

/**
 * Creates a new employee after verifying permission, validation, and business rules.
 */
export async function createEmployee(
  data: Record<string, unknown>
): Promise<EmployeeFormState> {
  try {
    const currentUser = await requirePermission(PERMISSIONS.EMPLOYEE_CREATE);

    // Abuse Protection: Max 10 account creations per 10 minutes per administrator
    const rateLimitCheck = checkAccountCreationRateLimit(currentUser.id);
    if (!rateLimitCheck.allowed) {
      logTrafficAnomaly({
        type: 'ACCOUNT_CREATION_THROTTLED',
        path: '/employees/actions',
        method: 'POST',
        userId: currentUser.id,
        reason: rateLimitCheck.reason || 'Account creation burst limit exceeded',
        details: { retryAfterSeconds: rateLimitCheck.retryAfterSeconds },
      });

      return {
        success: false,
        error: `Account creation rate limit reached. Please wait ${rateLimitCheck.retryAfterSeconds} second(s) before creating another staff account.`,
      };
    }

    // Validate input
    const parsed = createEmployeeSchema.safeParse(data);
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

    // Branch authorization check
    const scope = await getAuthorizedBranchScope(currentUser);
    if (!isBranchAuthorized(scope, input.branchId)) {
      return {
        success: false,
        error: 'Unauthorized: You do not have access to create employees for this branch.',
        fieldErrors: { branchId: ['Unauthorized branch selection.'] },
      };
    }

    // Rule 1: Employee code must be unique
    const existingCode = await prisma.employee.findUnique({
      where: { employeeCode: input.employeeCode },
    });

    if (existingCode) {
      return {
        success: false,
        error: 'An employee with this code already exists.',
        fieldErrors: { employeeCode: ['This employee code is already in use.'] },
      };
    }

    // Rule 2: Active employees should belong to a valid active branch
    const branch = await prisma.branch.findUnique({
      where: { id: input.branchId },
    });

    if (!branch) {
      return {
        success: false,
        error: 'Selected branch does not exist.',
        fieldErrors: { branchId: ['Invalid branch selected.'] },
      };
    }

    if (input.employmentStatus === 'ACTIVE' && branch.status !== 'ACTIVE') {
      return {
        success: false,
        error: 'Active employees cannot be assigned to an inactive branch.',
        fieldErrors: { branchId: ['Cannot assign an active employee to an inactive branch.'] },
      };
    }

    // Rule 9: Explicit user linking - verify user exists and is not already linked
    let linkedUserId: string | null = null;
    if (input.userId && input.userId.trim().length > 0) {
      const targetUser = await prisma.user.findUnique({
        where: { id: input.userId },
        include: { employee: true },
      });

      if (!targetUser) {
        return {
          success: false,
          error: 'The selected user account does not exist.',
          fieldErrors: { userId: ['Selected user account was not found.'] },
        };
      }

      if (targetUser.employee) {
        return {
          success: false,
          error: 'This user account is already linked to another employee.',
          fieldErrors: { userId: ['User account is already linked to another staff member.'] },
        };
      }

      linkedUserId = targetUser.id;
    }

    // Parse dates
    const joiningDate = new Date(input.joiningDate);
    const dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;

    // Create employee
    const employee = await prisma.employee.create({
      data: {
        employeeCode: input.employeeCode,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email || null,
        dateOfBirth,
        joiningDate,
        designation: input.designation,
        branchId: input.branchId,
        employmentStatus: input.employmentStatus,
        salary: input.salary,
        salaryType: input.salaryType,
        address: input.address || null,
        emergencyContactName: input.emergencyContactName || null,
        emergencyContactPhone: input.emergencyContactPhone || null,
        userId: linkedUserId,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    await createAuditLog({
      actorUserId: currentUser.id,
      branchId: employee.branchId,
      action: AUDIT_ACTIONS.CREATE,
      entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
      entityId: employee.id,
      description: `Created employee "${employee.firstName} ${employee.lastName}" (${employee.employeeCode}) as ${employee.designation}`,
      afterData: {
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        designation: employee.designation,
        branchId: employee.branchId,
        employmentStatus: employee.employmentStatus,
        salary: Number(employee.salary),
        salaryType: employee.salaryType,
      },
    }).catch((e: unknown) => console.error('Failed to create employee audit log:', e));

    revalidatePath('/employees');
    return {
      success: true,
      data: {
        ...employee,
        salary: Number(employee.salary),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to create employee:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating the employee. Please try again.',
    };
  }
}

/**
 * Updates an existing employee. Employee code is immutable.
 */
export async function updateEmployee(
  id: string,
  data: Record<string, unknown>
): Promise<EmployeeFormState> {
  try {
    const currentUser = await requirePermission(PERMISSIONS.EMPLOYEE_UPDATE);

    // Validate input
    const parsed = updateEmployeeSchema.safeParse(data);
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

    // Verify employee exists
    const existing = await prisma.employee.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false, error: 'Employee not found.' };
    }

    // Branch authorization check on existing record
    const scope = await getAuthorizedBranchScope(currentUser);
    if (!isBranchAuthorized(scope, existing.branchId)) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to modify employees in this branch.',
      };
    }

    const input = parsed.data;

    // Rule 3: Branch must exist and if changing branch, verify it
    if (input.branchId && input.branchId !== existing.branchId) {
      if (!isBranchAuthorized(scope, input.branchId)) {
        return {
          success: false,
          error: 'Unauthorized: You do not have permission to transfer an employee to that branch.',
          fieldErrors: { branchId: ['Unauthorized destination branch.'] },
        };
      }

      const newBranch = await prisma.branch.findUnique({
        where: { id: input.branchId },
      });

      if (!newBranch) {
        return {
          success: false,
          error: 'Selected branch does not exist.',
          fieldErrors: { branchId: ['Invalid branch selected.'] },
        };
      }

      if (
        (input.employmentStatus ?? existing.employmentStatus) === 'ACTIVE' &&
        newBranch.status !== 'ACTIVE'
      ) {
        return {
          success: false,
          error: 'Active employees cannot be assigned to an inactive branch.',
          fieldErrors: { branchId: ['Cannot assign an active employee to an inactive branch.'] },
        };
      }
    }

    // Rule 9: User linking validation
    let resolvedUserId = existing.userId;
    if (input.userId !== undefined) {
      if (input.userId === null || input.userId.trim() === '') {
        resolvedUserId = null;
      } else if (input.userId !== existing.userId) {
        const targetUser = await prisma.user.findUnique({
          where: { id: input.userId },
          include: { employee: true },
        });

        if (!targetUser) {
          return {
            success: false,
            error: 'The selected user account does not exist.',
            fieldErrors: { userId: ['Selected user account was not found.'] },
          };
        }

        if (targetUser.employee && targetUser.employee.id !== id) {
          return {
            success: false,
            error: 'This user account is already linked to another employee.',
            fieldErrors: { userId: ['User account is already linked to another staff member.'] },
          };
        }

        resolvedUserId = targetUser.id;
      }
    }

    // Parse dates if provided
    const joiningDate = input.joiningDate ? new Date(input.joiningDate) : undefined;
    const dateOfBirth =
      input.dateOfBirth !== undefined
        ? input.dateOfBirth
          ? new Date(input.dateOfBirth)
          : null
        : undefined;

    // Update employee
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined && { firstName: input.firstName }),
        ...(input.lastName !== undefined && { lastName: input.lastName }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.email !== undefined && { email: input.email || null }),
        ...(dateOfBirth !== undefined && { dateOfBirth }),
        ...(joiningDate !== undefined && { joiningDate }),
        ...(input.designation !== undefined && { designation: input.designation }),
        ...(input.branchId !== undefined && { branchId: input.branchId }),
        ...(input.employmentStatus !== undefined && { employmentStatus: input.employmentStatus }),
        ...(input.salary !== undefined && { salary: input.salary }),
        ...(input.salaryType !== undefined && { salaryType: input.salaryType }),
        ...(input.address !== undefined && { address: input.address || null }),
        ...(input.emergencyContactName !== undefined && {
          emergencyContactName: input.emergencyContactName || null,
        }),
        ...(input.emergencyContactPhone !== undefined && {
          emergencyContactPhone: input.emergencyContactPhone || null,
        }),
        userId: resolvedUserId,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    await createAuditLog({
      actorUserId: currentUser.id,
      branchId: employee.branchId,
      action: AUDIT_ACTIONS.UPDATE,
      entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
      entityId: employee.id,
      description: `Updated employee "${employee.firstName} ${employee.lastName}" (${employee.employeeCode})`,
      beforeData: {
        firstName: existing.firstName,
        lastName: existing.lastName,
        designation: existing.designation,
        branchId: existing.branchId,
        employmentStatus: existing.employmentStatus,
        salary: Number(existing.salary),
        salaryType: existing.salaryType,
        phone: existing.phone,
      },
      afterData: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        designation: employee.designation,
        branchId: employee.branchId,
        employmentStatus: employee.employmentStatus,
        salary: Number(employee.salary),
        salaryType: employee.salaryType,
        phone: employee.phone,
      },
    }).catch((e: unknown) => console.error('Failed to create employee update audit log:', e));

    revalidatePath('/employees');
    revalidatePath(`/employees/${id}`);
    return {
      success: true,
      data: {
        ...employee,
        salary: Number(employee.salary),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to update employee:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating the employee. Please try again.',
    };
  }
}

/**
 * Toggles an employee between ACTIVE and INACTIVE status.
 * Preserves all historical records.
 */
export async function toggleEmployeeStatus(
  id: string
): Promise<ActionResult<EmployeeItem>> {
  try {
    const currentUser = await requirePermission(PERMISSIONS.EMPLOYEE_DEACTIVATE);

    const existing = await prisma.employee.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!existing) {
      return { success: false, error: 'Employee not found.' };
    }

    const scope = await getAuthorizedBranchScope(currentUser);
    if (!isBranchAuthorized(scope, existing.branchId)) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to change employee status in this branch.',
      };
    }

    const newStatus: EmploymentStatus =
      existing.employmentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    // If reactivating, verify branch is active
    if (newStatus === 'ACTIVE' && existing.branch.status !== 'ACTIVE') {
      return {
        success: false,
        error: 'Cannot activate employee because their assigned branch is currently inactive.',
      };
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: { employmentStatus: newStatus },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    await createAuditLog({
      actorUserId: currentUser.id,
      branchId: employee.branchId,
      action: newStatus === 'ACTIVE' ? AUDIT_ACTIONS.ACTIVATE : AUDIT_ACTIONS.DEACTIVATE,
      entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
      entityId: employee.id,
      description: `${newStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'} employee "${employee.firstName} ${employee.lastName}" (${employee.employeeCode})`,
      beforeData: { employmentStatus: existing.employmentStatus },
      afterData: { employmentStatus: employee.employmentStatus },
    }).catch((e: unknown) => console.error('Failed to create employee toggle audit log:', e));

    revalidatePath('/employees');
    revalidatePath(`/employees/${id}`);
    return {
      success: true,
      data: {
        ...employee,
        salary: Number(employee.salary),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to toggle employee status:', error);
    return {
      success: false,
      error: 'Failed to update employee status. Please try again.',
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
