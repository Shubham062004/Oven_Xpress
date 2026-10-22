'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission, requireAuthentication, getAuthorizedBranchScope, isBranchAuthorized } from '@/lib/auth/guards';
import { PERMISSIONS, ROLES } from '@/lib/permissions/definitions';
import { hashPassword } from '@/lib/auth/password';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  resetEmployeePasswordSchema,
  createLoginAccountSchema,
  assignBranchWorkSchema,
  type AssignBranchWorkInput,
  APPROVED_DESIGNATIONS,
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
  branchId: string | null;
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
  } | null;
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
  createdCredentials?: {
    loginId: string;
    temporaryPassword: string;
  };
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

    if (employee.branchId) {
      if (!isBranchAuthorized(scope, employee.branchId)) {
        return { success: false, error: 'Unauthorized to view employee from this branch.' };
      }
    } else if (!scope.isAllBranches) {
      return { success: false, error: 'Unauthorized to view unassigned employee.' };
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
      if (group.branchId) {
        branchCounts[group.branchId] = group._count._all;
      }
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
        ...(!scope.isAllBranches ? { id: { in: scope.branchIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
      },
      orderBy: [
        { status: 'asc' },
        { name: 'asc' },
      ],
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
 * Fetches approved employee designations.
 */
export async function getEmployeeDesignations(): Promise<ActionResult<string[]>> {
  try {
    await requirePermission(PERMISSIONS.EMPLOYEE_READ);

    return {
      success: true,
      data: [...APPROVED_DESIGNATIONS],
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

    // Branch authorization check (if branchId is provided)
    let resolvedBranchId: string | null = null;
    if (input.branchId && input.branchId.trim().length > 0) {
      const scope = await getAuthorizedBranchScope(currentUser);
      if (!isBranchAuthorized(scope, input.branchId)) {
        return {
          success: false,
          error: 'Unauthorized: You do not have access to create employees for this branch.',
          fieldErrors: { branchId: ['Unauthorized branch selection.'] },
        };
      }

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

      resolvedBranchId = input.branchId;
    }

    // Rule 9: Explicit user linking or inline account creation
    let linkedUserId: string | null = null;
    let createdCredentials: { loginId: string; temporaryPassword: string } | undefined;

    if (input.createLoginAccount && input.loginEmail && input.loginPassword) {
      // Inline account creation requested
      const normalizedEmail = input.loginEmail.trim().toLowerCase();
      const existingUserEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUserEmail) {
        return {
          success: false,
          error: 'A system user with this login ID (email) already exists.',
          fieldErrors: { loginEmail: ['This login ID is already registered to another account.'] },
        };
      }

      // Determine least-privileged role based on designation
      const isManager = input.designation.toLowerCase().includes('manager');
      const targetRoleName = isManager ? ROLES.MANAGER : ROLES.STAFF;
      const roleRecord = await prisma.role.findUnique({
        where: { name: targetRoleName },
      });

      if (!roleRecord) {
        return {
          success: false,
          error: `System role "${targetRoleName}" not configured. Please contact administrator.`,
        };
      }

      const hashedPassword = await hashPassword(input.loginPassword);

      // Parse dates
      const joiningDate = new Date(input.joiningDate);
      const dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;

      // Create User and Employee atomically in a transaction
      const { newEmployee, newUser } = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            name: `${input.firstName} ${input.lastName}`,
            email: normalizedEmail,
            passwordHash: hashedPassword,
            phone: input.phone,
            roleId: roleRecord.id,
            isActive: input.employmentStatus === 'ACTIVE',
            emailVerified: new Date(),
          },
        });

        const emp = await tx.employee.create({
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
            userId: createdUser.id,
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

        return { newEmployee: emp, newUser: createdUser };
      });

      // Audit logs
      await createAuditLog({
        actorUserId: currentUser.id,
        branchId: newEmployee.branchId,
        action: AUDIT_ACTIONS.CREATE,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: newUser.id,
        description: `Created system login account "${newUser.email}" for employee "${newEmployee.firstName} ${newEmployee.lastName}" with role ${targetRoleName}`,
        afterData: { email: newUser.email, role: targetRoleName },
      }).catch((e: unknown) => console.error('Failed to create user audit log:', e));

      await createAuditLog({
        actorUserId: currentUser.id,
        branchId: newEmployee.branchId,
        action: AUDIT_ACTIONS.CREATE,
        entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
        entityId: newEmployee.id,
        description: `Created employee "${newEmployee.firstName} ${newEmployee.lastName}" (${newEmployee.employeeCode}) as ${newEmployee.designation} with linked account`,
        afterData: {
          employeeCode: newEmployee.employeeCode,
          firstName: newEmployee.firstName,
          lastName: newEmployee.lastName,
          designation: newEmployee.designation,
          branchId: newEmployee.branchId,
          employmentStatus: newEmployee.employmentStatus,
          salary: Number(newEmployee.salary),
          salaryType: newEmployee.salaryType,
        },
      }).catch((e: unknown) => console.error('Failed to create employee audit log:', e));

      revalidatePath('/employees');
      revalidatePath('/owner/employees');

      return {
        success: true,
        data: {
          ...newEmployee,
          salary: Number(newEmployee.salary),
        },
        createdCredentials: {
          loginId: newUser.email,
          temporaryPassword: input.loginPassword,
        },
      };
    }

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
        designation: input.designation || 'Unassigned',
        branchId: resolvedBranchId,
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
    revalidatePath('/owner/employees');
    return {
      success: true,
      data: {
        ...employee,
        salary: Number(employee.salary),
      },
      createdCredentials,
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

    // Branch authorization check on existing record (if assigned)
    const scope = await getAuthorizedBranchScope(currentUser);
    if (existing.branchId && !isBranchAuthorized(scope, existing.branchId)) {
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
    revalidatePath('/owner/employees');
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
    if (existing.branchId) {
      if (!isBranchAuthorized(scope, existing.branchId)) {
        return {
          success: false,
          error: 'Unauthorized: You do not have permission to change employee status in this branch.',
        };
      }
    } else if (!scope.isAllBranches) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to change unassigned employee status.',
      };
    }

    const newStatus: EmploymentStatus =
      existing.employmentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    // If reactivating, verify branch is active
    if (newStatus === 'ACTIVE' && existing.branch && existing.branch.status !== 'ACTIVE') {
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

    // If deactivating, also deactivate linked user account and revoke active sessions
    if (newStatus === 'INACTIVE' && existing.userId) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: { isActive: false },
      });
      await prisma.session.deleteMany({
        where: { userId: existing.userId },
      });
    } else if (newStatus === 'ACTIVE' && existing.userId) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: { isActive: true },
      });
    }

    revalidatePath('/employees');
    revalidatePath('/owner/employees');
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

/**
 * Safely deletes or deactivates an employee.
 * - If historical operational records exist (attendance, salary, bonuses, etc.),
 *   permanent deletion is prohibited: active employees are safely deactivated
 *   and already-inactive employees are preserved for audit compliance.
 * - If zero historical records exist, clean deletion of the employee and
 *   their linked user account is performed.
 */
export async function deleteEmployee(
  id: string
): Promise<ActionResult<{ deactivated: boolean }>> {
  try {
    const currentUser = await requirePermission(PERMISSIONS.EMPLOYEE_DEACTIVATE);

    const existing = await prisma.employee.findUnique({
      where: { id },
      include: { branch: true, user: true },
    });

    if (!existing) {
      return { success: false, error: 'Employee not found.' };
    }

    const scope = await getAuthorizedBranchScope(currentUser);
    if (existing.branchId) {
      if (!isBranchAuthorized(scope, existing.branchId)) {
        return {
          success: false,
          error: 'Unauthorized: You do not have permission to delete or deactivate employees in this branch.',
        };
      }
    } else if (!scope.isAllBranches) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to delete unassigned employees.',
      };
    }

    // Check historical operational records
    const [
      attendanceCount,
      salaryRecordCount,
      salaryStructureCount,
      bonusCount,
      incentiveCount,
      issueCount,
    ] = await Promise.all([
      prisma.attendance.count({ where: { employeeId: id } }),
      prisma.salaryRecord.count({ where: { employeeId: id } }),
      prisma.salaryStructure.count({ where: { employeeId: id } }),
      prisma.bonus.count({ where: { employeeId: id } }),
      prisma.incentive.count({ where: { employeeId: id } }),
      prisma.customerIssue.count({ where: { assignedTo: id } }),
    ]);

    const totalRecords =
      attendanceCount +
      salaryRecordCount +
      salaryStructureCount +
      bonusCount +
      incentiveCount +
      issueCount;

    if (totalRecords > 0) {
      // Historical records must NEVER be deleted.
      if (existing.employmentStatus === 'ACTIVE') {
        // Safe deactivation workflow
        await prisma.$transaction(async (tx) => {
          await tx.employee.update({
            where: { id },
            data: { employmentStatus: 'INACTIVE' },
          });

          if (existing.userId) {
            await tx.user.update({
              where: { id: existing.userId },
              data: { isActive: false },
            });
            await tx.session.deleteMany({
              where: { userId: existing.userId },
            });
          }
        });

        await createAuditLog({
          actorUserId: currentUser.id,
          branchId: existing.branchId,
          action: AUDIT_ACTIONS.DEACTIVATE,
          entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
          entityId: existing.id,
          description: `Safely deactivated employee "${existing.firstName} ${existing.lastName}" (${existing.employeeCode}) to preserve ${totalRecords} historical records`,
          beforeData: { employmentStatus: 'ACTIVE' },
          afterData: { employmentStatus: 'INACTIVE' },
        }).catch((e) => console.error('Failed to create audit log for safe deactivation:', e));

        revalidatePath('/employees');
        revalidatePath('/owner/employees');
        revalidatePath(`/employees/${id}`);

        return {
          success: true,
          data: { deactivated: true },
          message: `Employee "${existing.firstName} ${existing.lastName}" has ${totalRecords} historical operational records and was safely deactivated instead of deleted to preserve compliance records.`,
        };
      } else {
        // Already inactive and has operational history
        return {
          success: false,
          error: `Cannot permanently delete employee "${existing.firstName} ${existing.lastName}" because historical records (${totalRecords} attendance, salary, or payroll records) must be preserved for auditing. This employee is already deactivated.`,
        };
      }
    }

    // Zero historical records: Clean delete permitted
    await prisma.$transaction(async (tx) => {
      await tx.employee.delete({
        where: { id },
      });

      if (existing.userId) {
        await tx.session.deleteMany({ where: { userId: existing.userId } });
        await tx.user.delete({ where: { id: existing.userId } });
      }
    });

    await createAuditLog({
      actorUserId: currentUser.id,
      branchId: existing.branchId,
      action: AUDIT_ACTIONS.DELETE,
      entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
      entityId: existing.id,
      description: `Deleted employee "${existing.firstName} ${existing.lastName}" (${existing.employeeCode}) who had no operational history`,
    }).catch((e) => console.error('Failed to create audit log for employee deletion:', e));

    revalidatePath('/employees');
    revalidatePath('/owner/employees');

    return {
      success: true,
      data: { deactivated: false },
      message: `Employee "${existing.firstName} ${existing.lastName}" has been permanently removed.`,
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to delete employee:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting the employee. Please try again.',
    };
  }
}

/**
 * Resets the password for an employee's linked system user account.
 * Requires Owner authority. Hashes password with bcrypt,
 * invalidates existing sessions, and writes audit record.
 */
export async function resetEmployeePassword(
  employeeId: string,
  newPassword: string,
  confirmPassword?: string
): Promise<ActionResult> {
  try {
    const currentUser = await requireAuthentication();

    if (currentUser.role !== 'OWNER') {
      return {
        success: false,
        error: 'Unauthorized: Only restaurant owners can reset employee login credentials.',
      };
    }

    const parsed = resetEmployeePasswordSchema.safeParse({
      employeeId,
      newPassword,
      confirmPassword: confirmPassword || newPassword,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid password format.',
      };
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true },
    });

    if (!employee || !employee.userId || !employee.user) {
      return {
        success: false,
        error: 'Employee does not have a linked system user account.',
      };
    }

    const scope = await getAuthorizedBranchScope(currentUser);
    if (employee.branchId) {
      if (!isBranchAuthorized(scope, employee.branchId)) {
        return {
          success: false,
          error: 'Unauthorized: You do not have permission to modify employees in this branch.',
        };
      }
    } else if (!scope.isAllBranches) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to modify unassigned employees.',
      };
    }

    const hashedPassword = await hashPassword(parsed.data.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: employee.userId! },
        data: {
          passwordHash: hashedPassword,
          passwordChangedAt: new Date(),
        },
      }),
      // Invalidate all existing sessions according to session management policy
      prisma.session.deleteMany({
        where: { userId: employee.userId! },
      }),
    ]);

    await createAuditLog({
      actorUserId: currentUser.id,
      branchId: employee.branchId,
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: employee.userId,
      description: `Reset password for employee user account "${employee.user.email}" (${employee.firstName} ${employee.lastName}) and invalidated active sessions`,
      metadata: { employeeId: employee.id, userEmail: employee.user.email },
    }).catch((e) => console.error('Failed to log password reset audit:', e));

    return {
      success: true,
      message: 'Password reset successfully. Active sessions have been invalidated.',
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to reset employee password:', error);
    return {
      success: false,
      error: 'Failed to reset employee password. Please try again.',
    };
  }
}

/**
 * Creates a system login account for an existing employee who does not have one yet.
 * Assigns least-privileged role (MANAGER if designation contains Manager, otherwise STAFF).
 */
export async function createLoginAccountForExistingEmployee(
  employeeId: string,
  loginEmail: string,
  temporaryPassword: string,
  confirmPassword?: string
): Promise<ActionResult<{ loginId: string; temporaryPassword: string }>> {
  try {
    const currentUser = await requireAuthentication();

    if (currentUser.role !== 'OWNER') {
      return {
        success: false,
        error: 'Unauthorized: Only restaurant owners can create employee login credentials.',
      };
    }

    const parsed = createLoginAccountSchema.safeParse({
      employeeId,
      email: loginEmail,
      password: temporaryPassword,
      confirmPassword: confirmPassword || temporaryPassword,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid credentials input.',
      };
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true },
    });

    if (!employee) {
      return { success: false, error: 'Employee not found.' };
    }

    if (employee.userId) {
      return {
        success: false,
        error: 'This employee already has a linked system user account.',
      };
    }

    const scope = await getAuthorizedBranchScope(currentUser);
    if (employee.branchId) {
      if (!isBranchAuthorized(scope, employee.branchId)) {
        return {
          success: false,
          error: 'Unauthorized: You do not have permission to modify employees in this branch.',
        };
      }
    } else if (!scope.isAllBranches) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to modify unassigned employees.',
      };
    }

    // Check unique email
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });

    if (existingUser) {
      return {
        success: false,
        error: 'A system user with this login email already exists. Please choose another email.',
      };
    }

    // Determine role: least-privileged
    const isManager = employee.designation.toLowerCase().includes('manager');
    const targetRoleName = isManager ? ROLES.MANAGER : ROLES.STAFF;
    const roleRecord = await prisma.role.findUnique({
      where: { name: targetRoleName },
    });

    if (!roleRecord) {
      return {
        success: false,
        error: `System role "${targetRoleName}" not configured.`,
      };
    }

    const hashedPassword = await hashPassword(parsed.data.password);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: `${employee.firstName} ${employee.lastName}`,
          email: parsed.data.email.toLowerCase(),
          passwordHash: hashedPassword,
          phone: employee.phone,
          roleId: roleRecord.id,
          isActive: employee.employmentStatus === 'ACTIVE',
          emailVerified: new Date(),
        },
      });

      await tx.employee.update({
        where: { id: employee.id },
        data: { userId: newUser.id },
      });

      return newUser;
    });

    await createAuditLog({
      actorUserId: currentUser.id,
      branchId: employee.branchId,
      action: AUDIT_ACTIONS.CREATE,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: user.id,
      description: `Created login account "${user.email}" for employee "${employee.firstName} ${employee.lastName}" with role ${targetRoleName}`,
      afterData: { email: user.email, role: targetRoleName },
    }).catch((e) => console.error('Failed to log user creation audit:', e));

    revalidatePath('/employees');
    revalidatePath('/owner/employees');
    revalidatePath(`/employees/${employeeId}`);

    return {
      success: true,
      data: {
        loginId: user.email,
        temporaryPassword: parsed.data.password,
      },
      message: `System login account created successfully for ${employee.firstName} ${employee.lastName}.`,
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to create login account for employee:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating the login account.',
    };
  }
}

/**
 * Checks whether a given email / login ID is available for account creation.
 */
export async function checkLoginIdAvailability(
  email: string
): Promise<ActionResult<{ available: boolean }>> {
  try {
    await requireAuthentication();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Invalid email address.' };
    }

    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true },
    });

    return {
      success: true,
      data: { available: !existing },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to check login ID availability:', error);
    return {
      success: false,
      error: 'Failed to verify login ID availability.',
    };
  }
}

/**
 * Assigns or reassigns an employee's restaurant branch and job designation/work.
 */
export async function assignBranchAndWork(
  data: AssignBranchWorkInput
): Promise<ActionResult<EmployeeItem>> {
  try {
    const user = await requirePermission(PERMISSIONS.EMPLOYEE_UPDATE);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = assignBranchWorkSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Invalid assignment data.',
      };
    }

    const { employeeId, branchId, designation } = parsed.data;

    // Branch authorization check
    if (!isBranchAuthorized(scope, branchId)) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to assign employees to this branch.',
      };
    }

    const existingEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { branch: true },
    });

    if (!existingEmployee) {
      return { success: false, error: 'Employee not found.' };
    }

    if (existingEmployee.branchId && !isBranchAuthorized(scope, existingEmployee.branchId)) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to reassign this employee.',
      };
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) {
      return { success: false, error: 'Selected branch does not exist.' };
    }

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        branchId,
        designation,
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
            role: { select: { name: true } },
          },
        },
      },
    });

    await createAuditLog({
      actorUserId: user.id,
      branchId,
      action: AUDIT_ACTIONS.UPDATE,
      entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
      entityId: employeeId,
      description: `Assigned branch "${updated.branch?.name}" and designation "${designation}" to employee ${updated.firstName} ${updated.lastName} (${updated.employeeCode})`,
      afterData: { branchId, designation },
    }).catch((e: unknown) => console.error('Failed to create audit log:', e));

    revalidatePath('/employees');
    revalidatePath('/owner/employees');

    return {
      success: true,
      data: {
        ...updated,
        salary: Number(updated.salary),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to assign branch and work:', error);
    return { success: false, error: 'Failed to assign branch and work. Please try again.' };
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
