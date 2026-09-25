'use server';

import { revalidatePath } from 'next/cache';
import {
  Prisma,
  SalaryType,
  SalaryStructureStatus,
  BonusType,
  BonusStatus,
  IncrementStatus,
  SalaryRecordStatus,
  EmploymentStatus,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser, getAuthorizedBranchScope, isBranchAuthorized } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { createAuditLog } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit/audit-types';
import {
  reviseSalarySchema,
  createBonusSchema,
  approveBonusSchema,
  rejectBonusSchema,
  cancelBonusSchema,
  createIncentiveSchema,
  createSalaryRecordSchema,
  approveSalaryRecordSchema,
  cancelSalaryRecordSchema,
  type ReviseSalaryInput,
  type CreateBonusInput,
  type ApproveBonusInput,
  type RejectBonusInput,
  type CancelBonusInput,
  type CreateIncentiveInput,
  type CreateSalaryRecordInput,
  type ApproveSalaryRecordInput,
  type CancelSalaryRecordInput,
} from '@/lib/validations/salary';
import type {
  SalaryDashboardStats,
  SalaryListItem,
  SalaryDetail,
  IncrementItem,
  BonusItem,
  IncentiveItem,
  AttendancePeriodSummary,
  EmployeeCompensationSummary,
  PaginationMeta,
} from '@/lib/salary/types';

// ─── Helpers & Scoping ───────────────────────────────────────────────────────

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as Record<string, string>).digest === 'string' &&
    ((error as Record<string, string>).digest.startsWith('NEXT_REDIRECT') ||
      (error as Record<string, string>).digest === 'DYNAMIC_SERVER_USAGE')
  );
}



/**
 * Concurrency-safe sequential salary record number generator.
 * Format: SAL-YYYY-000001
 * Uses PostgreSQL advisory transaction lock to guarantee uniqueness under concurrent requests.
 */
async function generateSalaryNumber(tx: Prisma.TransactionClient): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `SAL-${currentYear}-`;

  const lockKey = `salary_number_seq_${currentYear}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const latestRecord = await tx.salaryRecord.findFirst({
    where: {
      salaryNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      salaryNumber: 'desc',
    },
    select: {
      salaryNumber: true,
    },
  });

  let nextSequence = 1;
  if (latestRecord?.salaryNumber) {
    const parts = latestRecord.salaryNumber.split('-');
    if (parts.length === 3) {
      const parsedSeq = parseInt(parts[2], 10);
      if (!isNaN(parsedSeq)) {
        nextSequence = parsedSeq + 1;
      }
    }
  }

  return `${prefix}${String(nextSequence).padStart(6, '0')}`;
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export async function getSalaryDashboardStats(
  filterBranchId?: string
): Promise<{ success: boolean; data?: SalaryDashboardStats; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.SALARY_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (filterBranchId && !isBranchAuthorized(scope, filterBranchId)) {
      return { success: false, error: 'Forbidden: Access to requested branch denied' };
    }

    const branchFilter: Prisma.EmployeeWhereInput = {
      ...(filterBranchId
        ? { branchId: filterBranchId }
        : !scope.isAllBranches
          ? { branchId: { in: scope.branchIds } }
          : {}),
    };

    const recordBranchFilter: Prisma.SalaryRecordWhereInput = {
      ...(filterBranchId
        ? { branchId: filterBranchId }
        : !scope.isAllBranches
          ? { branchId: { in: scope.branchIds } }
          : {}),
    };

    const bonusBranchFilter: Prisma.BonusWhereInput = {
      ...(filterBranchId
        ? { branchId: filterBranchId }
        : !scope.isAllBranches
          ? { branchId: { in: scope.branchIds } }
          : {}),
    };

    const incrementBranchFilter: Prisma.SalaryIncrementWhereInput = {
      ...(filterBranchId
        ? { branchId: filterBranchId }
        : !scope.isAllBranches
          ? { branchId: { in: scope.branchIds } }
          : {}),
    };

    const [
      activeEmployeesWithSalary,
      pendingSalaryReviews,
      approvedSalaryRecords,
      approvedBonusesResult,
      recentIncrementsCount,
    ] = await Promise.all([
      prisma.employee.count({
        where: {
          ...branchFilter,
          employmentStatus: EmploymentStatus.ACTIVE,
          salary: { gt: 0 },
        },
      }),
      prisma.salaryRecord.count({
        where: {
          ...recordBranchFilter,
          status: SalaryRecordStatus.PENDING_REVIEW,
        },
      }),
      prisma.salaryRecord.count({
        where: {
          ...recordBranchFilter,
          status: SalaryRecordStatus.APPROVED,
        },
      }),
      prisma.bonus.aggregate({
        where: {
          ...bonusBranchFilter,
          status: BonusStatus.APPROVED,
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.salaryIncrement.count({
        where: {
          ...incrementBranchFilter,
          status: IncrementStatus.APPLIED,
          effectiveDate: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        activeEmployeesWithSalary,
        pendingSalaryReviews,
        approvedSalaryRecords,
        totalApprovedBonuses: approvedBonusesResult._sum.amount
          ? Number(approvedBonusesResult._sum.amount)
          : 0,
        recentIncrementsCount,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error fetching salary dashboard stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch dashboard stats',
    };
  }
}

// ─── Salary Records List & Detail ───────────────────────────────────────────

export async function getSalaryRecords(params: {
  branchId?: string;
  employeeId?: string;
  status?: SalaryRecordStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  success: boolean;
  data?: { records: SalaryListItem[]; pagination: PaginationMeta };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.SALARY_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (params.branchId && !isBranchAuthorized(scope, params.branchId)) {
      return { success: false, error: 'Forbidden: Access to requested branch denied' };
    }

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));
    const skip = (page - 1) * pageSize;

    const where: Prisma.SalaryRecordWhereInput = {
      ...(params.branchId
        ? { branchId: params.branchId }
        : !scope.isAllBranches
          ? { branchId: { in: scope.branchIds } }
          : {}),
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { salaryNumber: { contains: params.search, mode: 'insensitive' } },
              {
                employee: {
                  OR: [
                    { firstName: { contains: params.search, mode: 'insensitive' } },
                    { lastName: { contains: params.search, mode: 'insensitive' } },
                    { employeeCode: { contains: params.search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [totalItems, records] = await Promise.all([
      prisma.salaryRecord.count({ where }),
      prisma.salaryRecord.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              branchId: true,
              branch: { select: { name: true } },
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
        orderBy: { periodStart: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    const formattedRecords: SalaryListItem[] = records.map((r) => ({
      id: r.id,
      salaryNumber: r.salaryNumber,
      employee: {
        id: r.employee.id,
        employeeCode: r.employee.employeeCode,
        firstName: r.employee.firstName,
        lastName: r.employee.lastName,
        designation: r.employee.designation,
        branchId: r.employee.branchId,
        branchName: r.employee.branch.name,
      },
      branch: {
        id: r.branch.id,
        name: r.branch.name,
        city: r.branch.city,
      },
      periodStart: r.periodStart.toISOString(),
      periodEnd: r.periodEnd.toISOString(),
      baseSalary: Number(r.baseSalary),
      bonusAmount: Number(r.bonusAmount),
      incentiveAmount: Number(r.incentiveAmount),
      adjustmentAmount: Number(r.adjustmentAmount),
      grossAmount: Number(r.grossAmount),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      success: true,
      data: {
        records: formattedRecords,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error fetching salary records:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch salary records',
    };
  }
}

export async function getSalaryRecordById(
  id: string
): Promise<{ success: boolean; data?: SalaryDetail; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.SALARY_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const record = await prisma.salaryRecord.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            branchId: true,
            phone: true,
            branch: { select: { name: true } },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        bonuses: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                designation: true,
                branch: { select: { name: true } },
              },
            },
            branch: { select: { id: true, name: true, city: true } },
          },
        },
        incentives: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                designation: true,
                branch: { select: { name: true } },
              },
            },
            branch: { select: { id: true, name: true, city: true } },
          },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!record) {
      return { success: false, error: 'Salary record not found' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, record.branchId)) {
      return { success: false, error: 'Forbidden: Access to branch denied' };
    }

    const formatted: SalaryDetail = {
      id: record.id,
      salaryNumber: record.salaryNumber,
      employeeId: record.employeeId,
      employee: {
        id: record.employee.id,
        employeeCode: record.employee.employeeCode,
        firstName: record.employee.firstName,
        lastName: record.employee.lastName,
        designation: record.employee.designation,
        branchId: record.employee.branchId,
        branchName: record.employee.branch.name,
        phone: record.employee.phone,
      },
      branchId: record.branchId,
      branch: {
        id: record.branch.id,
        name: record.branch.name,
        city: record.branch.city,
      },
      periodStart: record.periodStart.toISOString(),
      periodEnd: record.periodEnd.toISOString(),
      baseSalary: Number(record.baseSalary),
      bonusAmount: Number(record.bonusAmount),
      incentiveAmount: Number(record.incentiveAmount),
      adjustmentAmount: Number(record.adjustmentAmount),
      grossAmount: Number(record.grossAmount),
      status: record.status,
      notes: record.notes,
      attendanceSummary: record.attendanceSummary as unknown as AttendancePeriodSummary | null,
      bonuses: record.bonuses.map((b) => ({
        id: b.id,
        employeeId: b.employeeId,
        employee: {
          id: b.employee.id,
          employeeCode: b.employee.employeeCode,
          firstName: b.employee.firstName,
          lastName: b.employee.lastName,
          designation: b.employee.designation,
          branchName: b.employee.branch.name,
        },
        branch: {
          id: b.branch.id,
          name: b.branch.name,
          city: b.branch.city,
        },
        amount: Number(b.amount),
        type: b.type,
        reason: b.reason,
        bonusDate: b.bonusDate.toISOString(),
        status: b.status,
        rejectionReason: b.rejectionReason,
        createdBy: b.createdBy,
        approvedBy: b.approvedBy,
        approvedAt: b.approvedAt ? b.approvedAt.toISOString() : null,
        createdAt: b.createdAt.toISOString(),
      })),
      incentives: record.incentives.map((i) => ({
        id: i.id,
        employeeId: i.employeeId,
        employee: {
          id: i.employee.id,
          employeeCode: i.employee.employeeCode,
          firstName: i.employee.firstName,
          lastName: i.employee.lastName,
          designation: i.employee.designation,
          branchName: i.employee.branch.name,
        },
        branch: {
          id: i.branch.id,
          name: i.branch.name,
          city: i.branch.city,
        },
        amount: Number(i.amount),
        reason: i.reason,
        incentiveDate: i.incentiveDate.toISOString(),
        status: i.status,
        rejectionReason: i.rejectionReason,
        createdBy: i.createdBy,
        approvedBy: i.approvedBy,
        approvedAt: i.approvedAt ? i.approvedAt.toISOString() : null,
        createdAt: i.createdAt.toISOString(),
      })),
      auditLogs: record.auditLogs.map((a) => ({
        id: a.id,
        action: a.action,
        fromStatus: a.fromStatus,
        toStatus: a.toStatus,
        grossAmount: a.grossAmount ? Number(a.grossAmount) : null,
        performedBy: a.performedBy,
        notes: a.notes,
        metadata: a.metadata as Record<string, unknown> | null,
        createdAt: a.createdAt.toISOString(),
      })),
      createdBy: record.createdBy,
      approvedBy: record.approvedBy,
      approvedAt: record.approvedAt ? record.approvedAt.toISOString() : null,
      cancelledBy: record.cancelledBy,
      cancelledAt: record.cancelledAt ? record.cancelledAt.toISOString() : null,
      cancellationReason: record.cancellationReason,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };

    return { success: true, data: formatted };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error fetching salary record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch salary record',
    };
  }
}

// ─── Salary Period Creation & Calculation ────────────────────────────────────

/**
 * Previews the calculated components for an employee's salary period:
 * - Historical base salary structure effective during the period
 * - Approved bonuses within the period dates
 * - Approved incentives within the period dates
 * - Attendance summary aggregation (informational, non-deducting)
 */
export async function previewSalaryRecord(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  success: boolean;
  data?: {
    baseSalary: number;
    bonusAmount: number;
    incentiveAmount: number;
    bonuses: BonusItem[];
    incentives: IncentiveItem[];
    attendanceSummary: AttendancePeriodSummary;
    salaryStructureId: string | null;
  };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.SALARY_READ) && !hasPermission(user, PERMISSIONS.SALARY_CREATE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { branch: true },
    });

    if (!employee) return { success: false, error: 'Employee not found' };

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, employee.branchId)) {
      return { success: false, error: 'Forbidden: Access to branch denied' };
    }

    // 1. Retrieve applicable historical salary structure effective during the period
    // Matches: effectiveFrom <= periodEnd AND (effectiveTo IS NULL OR effectiveTo >= periodStart)
    const applicableStructures = await prisma.salaryStructure.findMany({
      where: {
        employeeId,
        effectiveFrom: { lte: periodEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
        status: { in: [SalaryStructureStatus.ACTIVE, SalaryStructureStatus.SUPERSEDED] },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    let baseSalary = Number(employee.salary);
    let structureId: string | null = null;

    if (applicableStructures.length > 0) {
      baseSalary = Number(applicableStructures[0].salary);
      structureId = applicableStructures[0].id;
    }

    // 2. Retrieve approved bonuses within period
    const approvedBonuses = await prisma.bonus.findMany({
      where: {
        employeeId,
        status: BonusStatus.APPROVED,
        bonusDate: {
          gte: periodStart,
          lte: periodEnd,
        },
        salaryRecordId: null, // Only unassigned bonuses
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            branch: { select: { name: true } },
          },
        },
        branch: { select: { id: true, name: true, city: true } },
      },
    });

    const bonusAmount = approvedBonuses.reduce(
      (sum, b) => sum + Number(b.amount),
      0
    );

    // 3. Retrieve approved incentives within period
    const approvedIncentives = await prisma.incentive.findMany({
      where: {
        employeeId,
        status: BonusStatus.APPROVED,
        incentiveDate: {
          gte: periodStart,
          lte: periodEnd,
        },
        salaryRecordId: null,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            branch: { select: { name: true } },
          },
        },
        branch: { select: { id: true, name: true, city: true } },
      },
    });

    const incentiveAmount = approvedIncentives.reduce(
      (sum, i) => sum + Number(i.amount),
      0
    );

    // 4. Retrieve attendance records and compile informational summary
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    const attendanceSummary: AttendancePeriodSummary = {
      totalWorkingDays: attendances.length,
      present: attendances.filter((a) => a.status === 'PRESENT').length,
      absent: attendances.filter((a) => a.status === 'ABSENT').length,
      halfDay: attendances.filter((a) => a.status === 'HALF_DAY').length,
      leave: attendances.filter((a) => a.status === 'LEAVE').length,
      lateArrivals: attendances.filter((a) => a.lateMinutes > 0).length,
      earlyDepartures: attendances.filter((a) => a.earlyDepartureMinutes > 0).length,
    };

    return {
      success: true,
      data: {
        baseSalary,
        bonusAmount,
        incentiveAmount,
        bonuses: approvedBonuses.map((b) => ({
          id: b.id,
          employeeId: b.employeeId,
          employee: {
            id: b.employee.id,
            employeeCode: b.employee.employeeCode,
            firstName: b.employee.firstName,
            lastName: b.employee.lastName,
            designation: b.employee.designation,
            branchName: b.employee.branch.name,
          },
          branch: {
            id: b.branch.id,
            name: b.branch.name,
            city: b.branch.city,
          },
          amount: Number(b.amount),
          type: b.type,
          reason: b.reason,
          bonusDate: b.bonusDate.toISOString(),
          status: b.status,
          rejectionReason: b.rejectionReason,
          createdBy: b.createdBy,
          approvedBy: b.approvedBy,
          approvedAt: b.approvedAt ? b.approvedAt.toISOString() : null,
          createdAt: b.createdAt.toISOString(),
        })),
        incentives: approvedIncentives.map((i) => ({
          id: i.id,
          employeeId: i.employeeId,
          employee: {
            id: i.employee.id,
            employeeCode: i.employee.employeeCode,
            firstName: i.employee.firstName,
            lastName: i.employee.lastName,
            designation: i.employee.designation,
            branchName: i.employee.branch.name,
          },
          branch: {
            id: i.branch.id,
            name: i.branch.name,
            city: i.branch.city,
          },
          amount: Number(i.amount),
          reason: i.reason,
          incentiveDate: i.incentiveDate.toISOString(),
          status: i.status,
          rejectionReason: i.rejectionReason,
          createdBy: i.createdBy,
          approvedBy: i.approvedBy,
          approvedAt: i.approvedAt ? i.approvedAt.toISOString() : null,
          createdAt: i.createdAt.toISOString(),
        })),
        attendanceSummary,
        salaryStructureId: structureId,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error previewing salary period:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to preview salary period',
    };
  }
}

export async function createSalaryRecord(
  input: CreateSalaryRecordInput
): Promise<{ success: boolean; data?: SalaryListItem; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.SALARY_CREATE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const validation = createSalaryRecordSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message || 'Invalid input' };
    }

    const { employeeId, periodStart, periodEnd, adjustmentAmount, notes, status } = validation.data;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { branch: true },
    });

    if (!employee) return { success: false, error: 'Employee not found' };

    // Inactive employee check
    if (employee.employmentStatus === EmploymentStatus.INACTIVE) {
      return {
        success: false,
        error: 'Cannot create a new salary period for an inactive employee. Reactivate employee first.',
      };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, employee.branchId)) {
      return { success: false, error: 'Forbidden: Access to branch denied' };
    }

    // Check for overlapping non-cancelled periods for this employee
    const overlappingRecord = await prisma.salaryRecord.findFirst({
      where: {
        employeeId,
        status: { not: SalaryRecordStatus.CANCELLED },
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
    });

    if (overlappingRecord) {
      return {
        success: false,
        error: `Overlapping salary period detected with record ${overlappingRecord.salaryNumber} (${overlappingRecord.periodStart.toISOString().split('T')[0]} to ${overlappingRecord.periodEnd.toISOString().split('T')[0]}).`,
      };
    }

    // Execute atomic creation transaction
    const result = await prisma.$transaction(async (tx) => {
      const salaryNumber = await generateSalaryNumber(tx);

      // 1. Fetch effective salary structure
      const applicableStructures = await tx.salaryStructure.findMany({
        where: {
          employeeId,
          effectiveFrom: { lte: periodEnd },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
          status: { in: [SalaryStructureStatus.ACTIVE, SalaryStructureStatus.SUPERSEDED] },
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      const baseSalaryDecimal =
        applicableStructures.length > 0
          ? applicableStructures[0].salary
          : employee.salary;

      // 2. Fetch approved bonuses
      const bonuses = await tx.bonus.findMany({
        where: {
          employeeId,
          status: BonusStatus.APPROVED,
          bonusDate: { gte: periodStart, lte: periodEnd },
          salaryRecordId: null,
        },
      });

      const bonusSumDecimal = bonuses.reduce(
        (acc, b) => acc.add(b.amount),
        new Prisma.Decimal(0)
      );

      // 3. Fetch approved incentives
      const incentives = await tx.incentive.findMany({
        where: {
          employeeId,
          status: BonusStatus.APPROVED,
          incentiveDate: { gte: periodStart, lte: periodEnd },
          salaryRecordId: null,
        },
      });

      const incentiveSumDecimal = incentives.reduce(
        (acc, i) => acc.add(i.amount),
        new Prisma.Decimal(0)
      );

      const adjustmentDecimal = new Prisma.Decimal(adjustmentAmount || 0);

      // 4. Calculate gross
      const grossDecimal = baseSalaryDecimal
        .add(bonusSumDecimal)
        .add(incentiveSumDecimal)
        .add(adjustmentDecimal);

      if (grossDecimal.lessThan(0)) {
        throw new Error('Calculated gross salary cannot be negative');
      }

      // 5. Gather attendance summary
      const attendances = await tx.attendance.findMany({
        where: {
          employeeId,
          date: { gte: periodStart, lte: periodEnd },
        },
      });

      const attendanceSummary: AttendancePeriodSummary = {
        totalWorkingDays: attendances.length,
        present: attendances.filter((a) => a.status === 'PRESENT').length,
        absent: attendances.filter((a) => a.status === 'ABSENT').length,
        halfDay: attendances.filter((a) => a.status === 'HALF_DAY').length,
        leave: attendances.filter((a) => a.status === 'LEAVE').length,
        lateArrivals: attendances.filter((a) => a.lateMinutes > 0).length,
        earlyDepartures: attendances.filter((a) => a.earlyDepartureMinutes > 0).length,
      };

      // 6. Create record
      const newRecord = await tx.salaryRecord.create({
        data: {
          salaryNumber,
          employeeId,
          branchId: employee.branchId,
          periodStart,
          periodEnd,
          baseSalary: baseSalaryDecimal,
          bonusAmount: bonusSumDecimal,
          incentiveAmount: incentiveSumDecimal,
          adjustmentAmount: adjustmentDecimal,
          grossAmount: grossDecimal,
          status: status || SalaryRecordStatus.PENDING_REVIEW,
          notes,
          attendanceSummary: attendanceSummary as unknown as Prisma.InputJsonValue,
          createdBy: user.name,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              branchId: true,
              branch: { select: { name: true } },
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
      });

      // Link bonuses & incentives to this salary period
      if (bonuses.length > 0) {
        await tx.bonus.updateMany({
          where: { id: { in: bonuses.map((b) => b.id) } },
          data: { salaryRecordId: newRecord.id },
        });
      }

      if (incentives.length > 0) {
        await tx.incentive.updateMany({
          where: { id: { in: incentives.map((i) => i.id) } },
          data: { salaryRecordId: newRecord.id },
        });
      }

      // 7. Audit log
      await tx.salaryAuditLog.create({
        data: {
          salaryRecordId: newRecord.id,
          action: 'CREATED',
          fromStatus: null,
          toStatus: newRecord.status,
          grossAmount: grossDecimal,
          performedBy: user.name,
          notes: notes || 'Salary period created',
          metadata: {
            baseSalary: Number(baseSalaryDecimal),
            bonusAmount: Number(bonusSumDecimal),
            incentiveAmount: Number(incentiveSumDecimal),
            adjustmentAmount: Number(adjustmentDecimal),
          },
        },
      });

      return newRecord;
    });

    revalidatePath('/salary');
    revalidatePath(`/employees/${employeeId}`);

    return {
      success: true,
      data: {
        id: result.id,
        salaryNumber: result.salaryNumber,
        employee: {
          id: result.employee.id,
          employeeCode: result.employee.employeeCode,
          firstName: result.employee.firstName,
          lastName: result.employee.lastName,
          designation: result.employee.designation,
          branchId: result.employee.branchId,
          branchName: result.employee.branch.name,
        },
        branch: {
          id: result.branch.id,
          name: result.branch.name,
          city: result.branch.city,
        },
        periodStart: result.periodStart.toISOString(),
        periodEnd: result.periodEnd.toISOString(),
        baseSalary: Number(result.baseSalary),
        bonusAmount: Number(result.bonusAmount),
        incentiveAmount: Number(result.incentiveAmount),
        adjustmentAmount: Number(result.adjustmentAmount),
        grossAmount: Number(result.grossAmount),
        status: result.status,
        createdAt: result.createdAt.toISOString(),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error creating salary record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create salary record',
    };
  }
}

export async function approveSalaryRecord(
  input: ApproveSalaryRecordInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.SALARY_APPROVE)) {
      return { success: false, error: 'Forbidden: Insufficient approval permissions' };
    }

    const validation = approveSalaryRecordSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message || 'Invalid input' };
    }

    const record = await prisma.salaryRecord.findUnique({
      where: { id: validation.data.salaryRecordId },
    });

    if (!record) return { success: false, error: 'Salary record not found' };

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, record.branchId)) {
      return { success: false, error: 'Forbidden: Access to branch denied' };
    }

    // Immutability check: once APPROVED, do not allow re-approval
    if (record.status === SalaryRecordStatus.APPROVED) {
      return { success: false, error: 'Record is already approved and immutable' };
    }

    if (record.status === SalaryRecordStatus.CANCELLED) {
      return { success: false, error: 'Cancelled records cannot be approved' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.salaryRecord.update({
        where: { id: record.id },
        data: {
          status: SalaryRecordStatus.APPROVED,
          approvedBy: user.name,
          approvedAt: new Date(),
        },
      });

      await tx.salaryAuditLog.create({
        data: {
          salaryRecordId: record.id,
          action: 'APPROVED',
          fromStatus: record.status,
          toStatus: SalaryRecordStatus.APPROVED,
          grossAmount: record.grossAmount,
          performedBy: user.name,
          notes: 'Salary record approved for compensation ledger',
        },
      });
    });

    revalidatePath('/salary');
    revalidatePath(`/salary/${record.id}`);
    revalidatePath(`/employees/${record.employeeId}`);

    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error approving salary record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve salary record',
    };
  }
}

export async function cancelSalaryRecord(
  input: CancelSalaryRecordInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.SALARY_CANCEL)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const validation = cancelSalaryRecordSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message || 'Invalid input' };
    }

    const record = await prisma.salaryRecord.findUnique({
      where: { id: validation.data.salaryRecordId },
    });

    if (!record) return { success: false, error: 'Salary record not found' };

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, record.branchId)) {
      return { success: false, error: 'Forbidden: Access to branch denied' };
    }

    if (record.status === SalaryRecordStatus.CANCELLED) {
      return { success: false, error: 'Record is already cancelled' };
    }

    await prisma.$transaction(async (tx) => {
      // Unlink attached bonuses and incentives so they can be included in future/corrected periods
      await tx.bonus.updateMany({
        where: { salaryRecordId: record.id },
        data: { salaryRecordId: null },
      });

      await tx.incentive.updateMany({
        where: { salaryRecordId: record.id },
        data: { salaryRecordId: null },
      });

      await tx.salaryRecord.update({
        where: { id: record.id },
        data: {
          status: SalaryRecordStatus.CANCELLED,
          cancelledBy: user.name,
          cancelledAt: new Date(),
          cancellationReason: validation.data.reason,
        },
      });

      await tx.salaryAuditLog.create({
        data: {
          salaryRecordId: record.id,
          action: 'CANCELLED',
          fromStatus: record.status,
          toStatus: SalaryRecordStatus.CANCELLED,
          grossAmount: record.grossAmount,
          performedBy: user.name,
          notes: validation.data.reason,
        },
      });
    });

    revalidatePath('/salary');
    revalidatePath(`/salary/${record.id}`);
    revalidatePath(`/employees/${record.employeeId}`);

    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error cancelling salary record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel salary record',
    };
  }
}

// ─── Salary Revision & Increments ───────────────────────────────────────────

export async function reviseSalary(
  input: ReviseSalaryInput
): Promise<{ success: boolean; data?: IncrementItem; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.INCREMENT_CREATE)) {
      return { success: false, error: 'Forbidden: Insufficient increment permissions' };
    }

    const validation = reviseSalarySchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message || 'Invalid input' };
    }

    const { employeeId, newSalary, salaryType, effectiveDate, reason, notes } = validation.data;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { branch: true },
    });

    if (!employee) return { success: false, error: 'Employee not found' };

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, employee.branchId)) {
      return { success: false, error: 'Forbidden: Access to branch denied' };
    }

    // Find current active salary structure
    const currentActiveStructure = await prisma.salaryStructure.findFirst({
      where: {
        employeeId,
        status: SalaryStructureStatus.ACTIVE,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    const previousSalaryNumber = currentActiveStructure
      ? Number(currentActiveStructure.salary)
      : Number(employee.salary);

    const differenceNumber = newSalary - previousSalaryNumber;
    const percentageNumber =
      previousSalaryNumber > 0
        ? Number(((differenceNumber / previousSalaryNumber) * 100).toFixed(2))
        : 0;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Close current structure if active
      if (currentActiveStructure) {
        const dayBefore = new Date(effectiveDate);
        dayBefore.setDate(dayBefore.getDate() - 1);

        await tx.salaryStructure.update({
          where: { id: currentActiveStructure.id },
          data: {
            effectiveTo: dayBefore,
            status: SalaryStructureStatus.SUPERSEDED,
          },
        });
      }

      // 2. Create new active SalaryStructure
      const newStructure = await tx.salaryStructure.create({
        data: {
          employeeId,
          branchId: employee.branchId,
          salary: new Prisma.Decimal(newSalary),
          salaryType: salaryType || SalaryType.MONTHLY,
          effectiveFrom: effectiveDate,
          effectiveTo: null,
          reason,
          status: SalaryStructureStatus.ACTIVE,
          createdBy: user.name,
        },
      });

      // 3. Create SalaryIncrement record
      const increment = await tx.salaryIncrement.create({
        data: {
          employeeId,
          branchId: employee.branchId,
          previousSalary: new Prisma.Decimal(previousSalaryNumber),
          newSalary: new Prisma.Decimal(newSalary),
          difference: new Prisma.Decimal(differenceNumber),
          percentage: new Prisma.Decimal(percentageNumber),
          effectiveDate,
          reason,
          notes,
          status: IncrementStatus.APPLIED,
          salaryStructureId: newStructure.id,
          createdBy: user.name,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              branch: { select: { name: true } },
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
      });

      // 4. Update employee current salary baseline
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          salary: new Prisma.Decimal(newSalary),
          salaryType: salaryType || SalaryType.MONTHLY,
        },
      });

      // 5. Audit log
      await createAuditLog(
        {
          actorUserId: user.id,
          branchId: employee.branchId,
          action: AUDIT_ACTIONS.SALARY_UPDATE,
          entityType: AUDIT_ENTITY_TYPES.SALARY,
          entityId: newStructure.id,
          description: `Revised salary for ${employee.firstName} ${employee.lastName} (${employee.employeeCode}) from ₹${previousSalaryNumber} to ₹${newSalary} (${percentageNumber >= 0 ? '+' : ''}${percentageNumber}%).`,
          beforeData: {
            salary: previousSalaryNumber,
            structureId: currentActiveStructure?.id ?? null,
          },
          afterData: {
            salary: newSalary,
            salaryType: salaryType || SalaryType.MONTHLY,
            structureId: newStructure.id,
            incrementId: increment.id,
            effectiveDate,
          },
          metadata: {
            employeeId,
            employeeCode: employee.employeeCode,
            reason,
            percentage: percentageNumber,
            difference: differenceNumber,
          },
        },
        tx
      );

      return increment;
    });

    revalidatePath('/salary');
    revalidatePath('/salary/increments');
    revalidatePath(`/employees/${employeeId}`);

    return {
      success: true,
      data: {
        id: result.id,
        employeeId: result.employeeId,
        employee: {
          id: result.employee.id,
          employeeCode: result.employee.employeeCode,
          firstName: result.employee.firstName,
          lastName: result.employee.lastName,
          designation: result.employee.designation,
          branchName: result.employee.branch.name,
        },
        branch: {
          id: result.branch.id,
          name: result.branch.name,
          city: result.branch.city,
        },
        previousSalary: Number(result.previousSalary),
        newSalary: Number(result.newSalary),
        difference: Number(result.difference),
        percentage: Number(result.percentage),
        effectiveDate: result.effectiveDate.toISOString(),
        reason: result.reason,
        notes: result.notes,
        status: result.status,
        createdBy: result.createdBy,
        createdAt: result.createdAt.toISOString(),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error revising salary:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revise salary',
    };
  }
}

export async function getIncrements(params: {
  branchId?: string;
  employeeId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  success: boolean;
  data?: { increments: IncrementItem[]; pagination: PaginationMeta };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.INCREMENT_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (params.branchId && !isBranchAuthorized(scope, params.branchId)) {
      return { success: false, error: 'Forbidden: Access to requested branch denied' };
    }

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));
    const skip = (page - 1) * pageSize;

    const where: Prisma.SalaryIncrementWhereInput = {
      ...(params.branchId
        ? { branchId: params.branchId }
        : !scope.isAllBranches
          ? { branchId: { in: scope.branchIds } }
          : {}),
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.search
        ? {
            employee: {
              OR: [
                { firstName: { contains: params.search, mode: 'insensitive' } },
                { lastName: { contains: params.search, mode: 'insensitive' } },
                { employeeCode: { contains: params.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [totalItems, increments] = await Promise.all([
      prisma.salaryIncrement.count({ where }),
      prisma.salaryIncrement.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              branch: { select: { name: true } },
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
        orderBy: { effectiveDate: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    const formatted: IncrementItem[] = increments.map((inc) => ({
      id: inc.id,
      employeeId: inc.employeeId,
      employee: {
        id: inc.employee.id,
        employeeCode: inc.employee.employeeCode,
        firstName: inc.employee.firstName,
        lastName: inc.employee.lastName,
        designation: inc.employee.designation,
        branchName: inc.employee.branch.name,
      },
      branch: {
        id: inc.branch.id,
        name: inc.branch.name,
        city: inc.branch.city,
      },
      previousSalary: Number(inc.previousSalary),
      newSalary: Number(inc.newSalary),
      difference: Number(inc.difference),
      percentage: Number(inc.percentage),
      effectiveDate: inc.effectiveDate.toISOString(),
      reason: inc.reason,
      notes: inc.notes,
      status: inc.status,
      createdBy: inc.createdBy,
      createdAt: inc.createdAt.toISOString(),
    }));

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      success: true,
      data: {
        increments: formatted,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error fetching increments:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch increments',
    };
  }
}

// ─── Bonus & Incentive Management ───────────────────────────────────────────

export async function getBonuses(params: {
  branchId?: string;
  employeeId?: string;
  status?: BonusStatus;
  type?: BonusType;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  success: boolean;
  data?: { bonuses: BonusItem[]; pagination: PaginationMeta };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.BONUS_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (params.branchId && !isBranchAuthorized(scope, params.branchId)) {
      return { success: false, error: 'Forbidden: Access to requested branch denied' };
    }

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));
    const skip = (page - 1) * pageSize;

    const where: Prisma.BonusWhereInput = {
      ...(params.branchId
        ? { branchId: params.branchId }
        : !scope.isAllBranches
          ? { branchId: { in: scope.branchIds } }
          : {}),
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.search
        ? {
            employee: {
              OR: [
                { firstName: { contains: params.search, mode: 'insensitive' } },
                { lastName: { contains: params.search, mode: 'insensitive' } },
                { employeeCode: { contains: params.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [totalItems, bonuses] = await Promise.all([
      prisma.bonus.count({ where }),
      prisma.bonus.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              branch: { select: { name: true } },
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
        orderBy: { bonusDate: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    const formatted: BonusItem[] = bonuses.map((b) => ({
      id: b.id,
      employeeId: b.employeeId,
      employee: {
        id: b.employee.id,
        employeeCode: b.employee.employeeCode,
        firstName: b.employee.firstName,
        lastName: b.employee.lastName,
        designation: b.employee.designation,
        branchName: b.employee.branch.name,
      },
      branch: {
        id: b.branch.id,
        name: b.branch.name,
        city: b.branch.city,
      },
      amount: Number(b.amount),
      type: b.type,
      reason: b.reason,
      bonusDate: b.bonusDate.toISOString(),
      status: b.status,
      rejectionReason: b.rejectionReason,
      createdBy: b.createdBy,
      approvedBy: b.approvedBy,
      approvedAt: b.approvedAt ? b.approvedAt.toISOString() : null,
      createdAt: b.createdAt.toISOString(),
    }));

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      success: true,
      data: {
        bonuses: formatted,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error fetching bonuses:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch bonuses',
    };
  }
}

export async function createBonus(
  input: CreateBonusInput
): Promise<{ success: boolean; data?: BonusItem; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.BONUS_CREATE)) {
      return { success: false, error: 'Forbidden: Insufficient bonus permissions' };
    }

    const validation = createBonusSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message || 'Invalid input' };
    }

    const { employeeId, amount, type, reason, bonusDate, status } = validation.data;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { branch: true },
    });

    if (!employee) return { success: false, error: 'Employee not found' };

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, employee.branchId)) {
      return { success: false, error: 'Forbidden: Access to branch denied' };
    }

    const bonus = await prisma.bonus.create({
      data: {
        employeeId,
        branchId: employee.branchId,
        amount: new Prisma.Decimal(amount),
        type,
        reason,
        bonusDate,
        status: status || BonusStatus.PENDING_APPROVAL,
        createdBy: user.name,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            branch: { select: { name: true } },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    });

    await createAuditLog({
      actorUserId: user.id,
      branchId: employee.branchId,
      action: AUDIT_ACTIONS.BONUS_CREATE,
      entityType: AUDIT_ENTITY_TYPES.BONUS,
      entityId: bonus.id,
      description: `Created bonus of ₹${amount} (${type}) for employee ${employee.firstName} ${employee.lastName}. Reason: ${reason}`,
      afterData: {
        amount,
        type,
        status: bonus.status,
      },
      metadata: {
        employeeId,
        employeeCode: employee.employeeCode,
        reason,
      },
    });

    revalidatePath('/salary');
    revalidatePath('/salary/bonuses');
    revalidatePath(`/employees/${employeeId}`);

    return {
      success: true,
      data: {
        id: bonus.id,
        employeeId: bonus.employeeId,
        employee: {
          id: bonus.employee.id,
          employeeCode: bonus.employee.employeeCode,
          firstName: bonus.employee.firstName,
          lastName: bonus.employee.lastName,
          designation: bonus.employee.designation,
          branchName: bonus.employee.branch.name,
        },
        branch: {
          id: bonus.branch.id,
          name: bonus.branch.name,
          city: bonus.branch.city,
        },
        amount: Number(bonus.amount),
        type: bonus.type,
        reason: bonus.reason,
        bonusDate: bonus.bonusDate.toISOString(),
        status: bonus.status,
        rejectionReason: bonus.rejectionReason,
        createdBy: bonus.createdBy,
        approvedBy: bonus.approvedBy,
        approvedAt: bonus.approvedAt ? bonus.approvedAt.toISOString() : null,
        createdAt: bonus.createdAt.toISOString(),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error creating bonus:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create bonus',
    };
  }
}

export async function approveBonus(
  input: ApproveBonusInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.BONUS_APPROVE)) {
      return { success: false, error: 'Forbidden: Insufficient bonus approval permissions' };
    }

    const validation = approveBonusSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message || 'Invalid input' };
    }

    const bonus = await prisma.bonus.findUnique({
      where: { id: validation.data.bonusId },
    });

    if (!bonus) return { success: false, error: 'Bonus not found' };

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, bonus.branchId)) {
      return { success: false, error: 'Forbidden: Access to branch denied' };
    }

    if (bonus.status === BonusStatus.APPROVED) {
      return { success: false, error: 'Bonus is already approved' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.bonus.update({
        where: { id: bonus.id },
        data: {
          status: BonusStatus.APPROVED,
          approvedBy: user.name,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      });

      await createAuditLog(
        {
          actorUserId: user.id,
          branchId: bonus.branchId,
          action: AUDIT_ACTIONS.BONUS_APPROVE,
          entityType: AUDIT_ENTITY_TYPES.BONUS,
          entityId: bonus.id,
          description: `Approved bonus of ₹${bonus.amount} for employee.`,
          beforeData: { status: bonus.status },
          afterData: { status: BonusStatus.APPROVED },
          metadata: {
            bonusId: bonus.id,
            employeeId: bonus.employeeId,
            amount: Number(bonus.amount),
          },
        },
        tx
      );
    });

    revalidatePath('/salary');
    revalidatePath('/salary/bonuses');
    revalidatePath(`/employees/${bonus.employeeId}`);

    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error approving bonus:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve bonus',
    };
  }
}

export async function rejectBonus(
  input: RejectBonusInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.BONUS_APPROVE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const validation = rejectBonusSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message || 'Invalid input' };
    }

    const { bonusId, reason } = validation.data;

    const bonus = await prisma.bonus.findUnique({
      where: { id: bonusId },
    });

    if (!bonus) return { success: false, error: 'Bonus not found' };

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, bonus.branchId)) {
      return { success: false, error: 'Forbidden: Access to branch denied' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.bonus.update({
        where: { id: bonus.id },
        data: {
          status: BonusStatus.REJECTED,
          rejectionReason: reason,
        },
      });

      await createAuditLog(
        {
          actorUserId: user.id,
          branchId: bonus.branchId,
          action: AUDIT_ACTIONS.BONUS_REJECT,
          entityType: AUDIT_ENTITY_TYPES.BONUS,
          entityId: bonus.id,
          description: `Rejected bonus of ₹${bonus.amount} for employee. Reason: ${reason}`,
          beforeData: { status: bonus.status },
          afterData: { status: BonusStatus.REJECTED, rejectionReason: reason },
          metadata: {
            bonusId: bonus.id,
            employeeId: bonus.employeeId,
            amount: Number(bonus.amount),
            reason,
          },
        },
        tx
      );
    });

    revalidatePath('/salary');
    revalidatePath('/salary/bonuses');
    revalidatePath(`/employees/${bonus.employeeId}`);

    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error rejecting bonus:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reject bonus',
    };
  }
}

export async function cancelBonus(
  input: CancelBonusInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.BONUS_CANCEL)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const validation = cancelBonusSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message || 'Invalid input' };
    }

    const bonus = await prisma.bonus.findUnique({
      where: { id: validation.data.bonusId },
    });

    if (!bonus) return { success: false, error: 'Bonus not found' };

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, bonus.branchId)) {
      return { success: false, error: 'Forbidden: Access to branch denied' };
    }

    await prisma.bonus.update({
      where: { id: bonus.id },
      data: {
        status: BonusStatus.CANCELLED,
        rejectionReason: validation.data.reason || 'Cancelled by user',
      },
    });

    revalidatePath('/salary');
    revalidatePath('/salary/bonuses');
    revalidatePath(`/employees/${bonus.employeeId}`);

    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error cancelling bonus:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel bonus',
    };
  }
}

export async function createIncentive(
  input: CreateIncentiveInput
): Promise<{ success: boolean; data?: IncentiveItem; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.BONUS_CREATE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const validation = createIncentiveSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message || 'Invalid input' };
    }

    const { employeeId, amount, reason, incentiveDate, status } = validation.data;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { branch: true },
    });

    if (!employee) return { success: false, error: 'Employee not found' };

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, employee.branchId)) {
      return { success: false, error: 'Forbidden: Access to branch denied' };
    }

    const incentive = await prisma.incentive.create({
      data: {
        employeeId,
        branchId: employee.branchId,
        amount: new Prisma.Decimal(amount),
        reason,
        incentiveDate,
        status: status || BonusStatus.APPROVED,
        createdBy: user.name,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            branch: { select: { name: true } },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    });

    revalidatePath('/salary');
    revalidatePath('/salary/bonuses');
    revalidatePath(`/employees/${employeeId}`);

    return {
      success: true,
      data: {
        id: incentive.id,
        employeeId: incentive.employeeId,
        employee: {
          id: incentive.employee.id,
          employeeCode: incentive.employee.employeeCode,
          firstName: incentive.employee.firstName,
          lastName: incentive.employee.lastName,
          designation: incentive.employee.designation,
          branchName: incentive.employee.branch.name,
        },
        branch: {
          id: incentive.branch.id,
          name: incentive.branch.name,
          city: incentive.branch.city,
        },
        amount: Number(incentive.amount),
        reason: incentive.reason,
        incentiveDate: incentive.incentiveDate.toISOString(),
        status: incentive.status,
        rejectionReason: incentive.rejectionReason,
        createdBy: incentive.createdBy,
        approvedBy: incentive.approvedBy,
        approvedAt: incentive.approvedAt ? incentive.approvedAt.toISOString() : null,
        createdAt: incentive.createdAt.toISOString(),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error creating incentive:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create incentive',
    };
  }
}

// ─── Employee Compensation Timeline / Profile Section ────────────────────────

export async function getEmployeeCompensation(
  employeeId: string
): Promise<{ success: boolean; data?: EmployeeCompensationSummary; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!hasPermission(user, PERMISSIONS.SALARY_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        branch: {
          select: { id: true, name: true, city: true },
        },
      },
    });

    if (!employee) return { success: false, error: 'Employee not found' };

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, employee.branchId)) {
      return { success: false, error: 'Forbidden: Access to branch denied' };
    }

    const [structures, increments, bonuses, incentives, salaryRecords] = await Promise.all([
      prisma.salaryStructure.findMany({
        where: { employeeId },
        orderBy: { effectiveFrom: 'desc' },
      }),
      prisma.salaryIncrement.findMany({
        where: { employeeId },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              branch: { select: { name: true } },
            },
          },
          branch: { select: { id: true, name: true, city: true } },
        },
        orderBy: { effectiveDate: 'desc' },
      }),
      prisma.bonus.findMany({
        where: { employeeId },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              branch: { select: { name: true } },
            },
          },
          branch: { select: { id: true, name: true, city: true } },
        },
        orderBy: { bonusDate: 'desc' },
      }),
      prisma.incentive.findMany({
        where: { employeeId },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              branch: { select: { name: true } },
            },
          },
          branch: { select: { id: true, name: true, city: true } },
        },
        orderBy: { incentiveDate: 'desc' },
      }),
      prisma.salaryRecord.findMany({
        where: { employeeId },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              branchId: true,
              branch: { select: { name: true } },
            },
          },
          branch: { select: { id: true, name: true, city: true } },
        },
        orderBy: { periodStart: 'desc' },
      }),
    ]);

    const activeStructure = structures.find((s) => s.status === SalaryStructureStatus.ACTIVE) || null;

    return {
      success: true,
      data: {
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          firstName: employee.firstName,
          lastName: employee.lastName,
          designation: employee.designation,
          branchId: employee.branchId,
          branchName: employee.branch.name,
          employmentStatus: employee.employmentStatus,
        },
        currentStructure: activeStructure
          ? {
              id: activeStructure.id,
              employeeId: activeStructure.employeeId,
              salary: Number(activeStructure.salary),
              salaryType: activeStructure.salaryType,
              effectiveFrom: activeStructure.effectiveFrom.toISOString(),
              effectiveTo: activeStructure.effectiveTo ? activeStructure.effectiveTo.toISOString() : null,
              reason: activeStructure.reason,
              status: activeStructure.status,
              createdBy: activeStructure.createdBy,
              createdAt: activeStructure.createdAt.toISOString(),
            }
          : null,
        structures: structures.map((s) => ({
          id: s.id,
          employeeId: s.employeeId,
          salary: Number(s.salary),
          salaryType: s.salaryType,
          effectiveFrom: s.effectiveFrom.toISOString(),
          effectiveTo: s.effectiveTo ? s.effectiveTo.toISOString() : null,
          reason: s.reason,
          status: s.status,
          createdBy: s.createdBy,
          createdAt: s.createdAt.toISOString(),
        })),
        increments: increments.map((inc) => ({
          id: inc.id,
          employeeId: inc.employeeId,
          employee: {
            id: inc.employee.id,
            employeeCode: inc.employee.employeeCode,
            firstName: inc.employee.firstName,
            lastName: inc.employee.lastName,
            designation: inc.employee.designation,
            branchName: inc.employee.branch.name,
          },
          branch: {
            id: inc.branch.id,
            name: inc.branch.name,
            city: inc.branch.city,
          },
          previousSalary: Number(inc.previousSalary),
          newSalary: Number(inc.newSalary),
          difference: Number(inc.difference),
          percentage: Number(inc.percentage),
          effectiveDate: inc.effectiveDate.toISOString(),
          reason: inc.reason,
          notes: inc.notes,
          status: inc.status,
          createdBy: inc.createdBy,
          createdAt: inc.createdAt.toISOString(),
        })),
        bonuses: bonuses.map((b) => ({
          id: b.id,
          employeeId: b.employeeId,
          employee: {
            id: b.employee.id,
            employeeCode: b.employee.employeeCode,
            firstName: b.employee.firstName,
            lastName: b.employee.lastName,
            designation: b.employee.designation,
            branchName: b.employee.branch.name,
          },
          branch: {
            id: b.branch.id,
            name: b.branch.name,
            city: b.branch.city,
          },
          amount: Number(b.amount),
          type: b.type,
          reason: b.reason,
          bonusDate: b.bonusDate.toISOString(),
          status: b.status,
          rejectionReason: b.rejectionReason,
          createdBy: b.createdBy,
          approvedBy: b.approvedBy,
          approvedAt: b.approvedAt ? b.approvedAt.toISOString() : null,
          createdAt: b.createdAt.toISOString(),
        })),
        incentives: incentives.map((i) => ({
          id: i.id,
          employeeId: i.employeeId,
          employee: {
            id: i.employee.id,
            employeeCode: i.employee.employeeCode,
            firstName: i.employee.firstName,
            lastName: i.employee.lastName,
            designation: i.employee.designation,
            branchName: i.employee.branch.name,
          },
          branch: {
            id: i.branch.id,
            name: i.branch.name,
            city: i.branch.city,
          },
          amount: Number(i.amount),
          reason: i.reason,
          incentiveDate: i.incentiveDate.toISOString(),
          status: i.status,
          rejectionReason: i.rejectionReason,
          createdBy: i.createdBy,
          approvedBy: i.approvedBy,
          approvedAt: i.approvedAt ? i.approvedAt.toISOString() : null,
          createdAt: i.createdAt.toISOString(),
        })),
        salaryRecords: salaryRecords.map((r) => ({
          id: r.id,
          salaryNumber: r.salaryNumber,
          employee: {
            id: r.employee.id,
            employeeCode: r.employee.employeeCode,
            firstName: r.employee.firstName,
            lastName: r.employee.lastName,
            designation: r.employee.designation,
            branchId: r.employee.branchId,
            branchName: r.employee.branch.name,
          },
          branch: {
            id: r.branch.id,
            name: r.branch.name,
            city: r.branch.city,
          },
          periodStart: r.periodStart.toISOString(),
          periodEnd: r.periodEnd.toISOString(),
          baseSalary: Number(r.baseSalary),
          bonusAmount: Number(r.bonusAmount),
          incentiveAmount: Number(r.incentiveAmount),
          adjustmentAmount: Number(r.adjustmentAmount),
          grossAmount: Number(r.grossAmount),
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error fetching employee compensation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch employee compensation',
    };
  }
}

/**
 * Utility helper to fetch active employees for dropdowns (branch scoped)
 */
export async function getActiveEmployeesForSelect(
  branchId?: string
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation: string;
    branchId: string;
    branchName: string;
    salary: number;
    salaryType: SalaryType;
  }>;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const scope = await getAuthorizedBranchScope(user);
    if (branchId && !isBranchAuthorized(scope, branchId)) {
      return { success: false, error: 'Forbidden: Access to branch denied' };
    }

    const where: Prisma.EmployeeWhereInput = {
      employmentStatus: EmploymentStatus.ACTIVE,
      ...(branchId
        ? { branchId }
        : !scope.isAllBranches
          ? { branchId: { in: scope.branchIds } }
          : {}),
    };

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        designation: true,
        branchId: true,
        salary: true,
        salaryType: true,
        branch: { select: { name: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return {
      success: true,
      data: employees.map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        firstName: e.firstName,
        lastName: e.lastName,
        designation: e.designation,
        branchId: e.branchId,
        branchName: e.branch.name,
        salary: Number(e.salary),
        salaryType: e.salaryType,
      })),
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error fetching employees for select:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch employees',
    };
  }
}
