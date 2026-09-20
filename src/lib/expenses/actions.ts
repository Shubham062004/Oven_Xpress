'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { Prisma, ExpenseStatus, ExpenseCategoryStatus, ExpenseTemplateStatus } from '@prisma/client';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import type { AuthUser } from '@/lib/auth/types';
import {
  createExpenseSchema,
  updateExpenseSchema,
  approveExpenseSchema,
  rejectExpenseSchema,
  cancelExpenseSchema,
  expenseCategorySchema,
  expenseTemplateSchema,
  expenseFilterSchema,
  type CreateExpenseInput,
  type UpdateExpenseInput,
  type ExpenseCategoryInput,
  type ExpenseTemplateInput,
  type ExpenseFilterInput,
} from '@/lib/validations/expenses';
import type {
  ExpenseListItem,
  ExpenseDetail,
  ExpenseStats,
  ExpenseCategoryItem,
  ExpenseTemplateItem,
  PaginationMeta,
} from '@/lib/expenses/types';

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
 * Resolves authorized branch scope for the authenticated user.
 * OWNER and ADMIN have access across all branches.
 * MANAGER and STAFF are restricted to their assigned branch.
 */
async function getAuthorizedBranchScope(
  user: AuthUser
): Promise<{ isAllBranches: boolean; branchIds: string[] }> {
  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    return { isAllBranches: true, branchIds: [] };
  }

  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    select: { branchId: true },
  });

  if (employee?.branchId) {
    return { isAllBranches: false, branchIds: [employee.branchId] };
  }

  return { isAllBranches: false, branchIds: [] };
}

function isBranchAuthorized(
  scope: { isAllBranches: boolean; branchIds: string[] },
  branchId: string
): boolean {
  return scope.isAllBranches || scope.branchIds.includes(branchId);
}

/**
 * Concurrency-safe sequential expense number generator.
 * Format: EXP-YYYY-000001
 * Uses PostgreSQL advisory transaction lock to guarantee uniqueness under concurrent requests.
 */
async function generateExpenseNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `EXP-${currentYear}-`;

  await tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(hashtext('expense_number_seq_${currentYear}'))`
  );

  const latestExpense = await tx.expense.findFirst({
    where: {
      expenseNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      expenseNumber: 'desc',
    },
    select: {
      expenseNumber: true,
    },
  });

  let nextSequence = 1;
  if (latestExpense?.expenseNumber) {
    const parts = latestExpense.expenseNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  return `${prefix}${nextSequence.toString().padStart(6, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch paginated, filtered expenses list.
 */
export async function getExpenses(
  filterInput: Partial<ExpenseFilterInput> = {}
): Promise<{
  success: boolean;
  data?: {
    expenses: ExpenseListItem[];
    pagination: PaginationMeta;
  };
  error?: string;
}> {
  try {
    const user = await requirePermission(PERMISSIONS.EXPENSE_READ);

    const parsedFilter = expenseFilterSchema.safeParse(filterInput);
    const filter = parsedFilter.success ? parsedFilter.data : { page: 1, pageSize: 20 };

    const branchScope = await getAuthorizedBranchScope(user);

    const where: Prisma.ExpenseWhereInput = {};

    // Branch scoping
    if (filter.branchId && filter.branchId !== 'all') {
      if (!isBranchAuthorized(branchScope, filter.branchId)) {
        return { success: false, error: 'Unauthorized branch access' };
      }
      where.branchId = filter.branchId;
    } else if (!branchScope.isAllBranches) {
      where.branchId = { in: branchScope.branchIds };
    }

    // Category filter
    if (filter.categoryId && filter.categoryId !== 'all') {
      where.categoryId = filter.categoryId;
    }

    // Status filter
    if (filter.status) {
      where.status = filter.status;
    }

    // Payment method filter
    if (filter.paymentMethod) {
      where.paymentMethod = filter.paymentMethod;
    }

    // Date range filter (on expenseDate)
    if (filter.startDate || filter.endDate) {
      where.expenseDate = {};
      if (filter.startDate) {
        where.expenseDate.gte = new Date(`${filter.startDate}T00:00:00Z`);
      }
      if (filter.endDate) {
        where.expenseDate.lte = new Date(`${filter.endDate}T23:59:59Z`);
      }
    }

    // Text search (expenseNumber, vendorName, description)
    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { expenseNumber: { contains: q, mode: 'insensitive' } },
        { vendorName: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { referenceNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.expense.count({ where });

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        category: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    });

    // Resolve user names
    const userIds = new Set<string>();
    expenses.forEach((e: { createdBy: string; approvedBy: string | null }) => {
      if (e.createdBy) userIds.add(e.createdBy);
      if (e.approvedBy) userIds.add(e.approvedBy);
    });

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u: { id: string; name: string }) => [u.id, u.name]));

    const formattedExpenses: ExpenseListItem[] = expenses.map((e) => ({
      id: e.id,
      expenseNumber: e.expenseNumber,
      branchId: e.branchId,
      branchName: e.branch.name,
      branchCode: e.branch.code,
      categoryId: e.categoryId,
      categoryName: e.category.name,
      amount: Number(e.amount),
      expenseDate: e.expenseDate.toISOString().split('T')[0],
      description: e.description,
      vendorName: e.vendorName,
      paymentMethod: e.paymentMethod,
      referenceNumber: e.referenceNumber,
      status: e.status,
      receiptUrl: e.receiptUrl,
      createdBy: e.createdBy,
      createdByName: userMap.get(e.createdBy) || 'System',
      approvedBy: e.approvedBy,
      approvedByName: e.approvedBy ? userMap.get(e.approvedBy) || 'Authorized User' : undefined,
      approvedAt: e.approvedAt ? e.approvedAt.toISOString() : null,
      createdAt: e.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        expenses: formattedExpenses,
        pagination: {
          total,
          page: filter.page,
          pageSize: filter.pageSize,
          totalPages: Math.ceil(total / filter.pageSize),
        },
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error fetching expenses:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch expenses',
    };
  }
}

/**
 * Fetch detailed expense record by ID.
 */
export async function getExpenseById(
  id: string
): Promise<{ success: boolean; data?: ExpenseDetail; error?: string }> {
  try {
    const user = await requirePermission(PERMISSIONS.EXPENSE_READ);

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        category: {
          select: { id: true, name: true },
        },
        template: {
          select: { id: true, description: true },
        },
        auditLogs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!expense) {
      return { success: false, error: 'Expense record not found' };
    }

    const branchScope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(branchScope, expense.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    // Resolve user names
    const userIds = new Set<string>();
    if (expense.createdBy) userIds.add(expense.createdBy);
    if (expense.approvedBy) userIds.add(expense.approvedBy);
    if (expense.cancelledBy) userIds.add(expense.cancelledBy);
    expense.auditLogs.forEach((log: { performedBy: string }) => {
      if (log.performedBy) userIds.add(log.performedBy);
    });

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u: { id: string; name: string }) => [u.id, u.name]));

    const detail: ExpenseDetail = {
      id: expense.id,
      expenseNumber: expense.expenseNumber,
      branchId: expense.branchId,
      branchName: expense.branch.name,
      branchCode: expense.branch.code,
      categoryId: expense.categoryId,
      categoryName: expense.category.name,
      amount: Number(expense.amount),
      expenseDate: expense.expenseDate.toISOString().split('T')[0],
      description: expense.description,
      vendorName: expense.vendorName,
      paymentMethod: expense.paymentMethod,
      referenceNumber: expense.referenceNumber,
      status: expense.status,
      receiptUrl: expense.receiptUrl,
      notes: expense.notes,
      rejectionReason: expense.rejectionReason,
      cancellationReason: expense.cancellationReason,
      cancelledBy: expense.cancelledBy,
      cancelledByName: expense.cancelledBy ? userMap.get(expense.cancelledBy) || undefined : undefined,
      cancelledAt: expense.cancelledAt ? expense.cancelledAt.toISOString() : null,
      createdBy: expense.createdBy,
      createdByName: userMap.get(expense.createdBy) || 'System',
      approvedBy: expense.approvedBy,
      approvedByName: expense.approvedBy ? userMap.get(expense.approvedBy) || undefined : undefined,
      approvedAt: expense.approvedAt ? expense.approvedAt.toISOString() : null,
      templateId: expense.templateId,
      templateDescription: expense.template?.description,
      auditLogs: expense.auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        amount: log.amount ? Number(log.amount) : null,
        performedBy: log.performedBy,
        performedByName: userMap.get(log.performedBy) || 'User',
        notes: log.notes,
        metadata: log.metadata as Record<string, unknown> | null,
        createdAt: log.createdAt.toISOString(),
      })),
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
    };

    return { success: true, data: detail };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error fetching expense details:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch expense details',
    };
  }
}

/**
 * Fetch operational dashboard summary metrics for expenses.
 */
export async function getExpenseStats(
  branchId?: string
): Promise<{ success: boolean; data?: ExpenseStats; error?: string }> {
  try {
    const user = await requirePermission(PERMISSIONS.EXPENSE_READ);

    const branchScope = await getAuthorizedBranchScope(user);

    const where: Prisma.ExpenseWhereInput = {};

    if (branchId && branchId !== 'all') {
      if (!isBranchAuthorized(branchScope, branchId)) {
        return { success: false, error: 'Unauthorized branch access' };
      }
      where.branchId = branchId;
    } else if (!branchScope.isAllBranches) {
      where.branchId = { in: branchScope.branchIds };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayStart = new Date(`${todayStr}T00:00:00Z`);
    const todayEnd = new Date(`${todayStr}T23:59:59Z`);

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // Today's total (Approved + Pending)
    const todayExpenses = await prisma.expense.findMany({
      where: {
        ...where,
        expenseDate: { gte: todayStart, lte: todayEnd },
        status: { in: [ExpenseStatus.APPROVED, ExpenseStatus.PENDING_APPROVAL] },
      },
      select: { amount: true },
    });
    const todayTotal = todayExpenses.reduce(
      (sum: number, e: { amount: Prisma.Decimal }) => sum + Number(e.amount),
      0
    );

    // This month's total (Approved)
    const monthExpenses = await prisma.expense.findMany({
      where: {
        ...where,
        expenseDate: { gte: monthStart },
        status: ExpenseStatus.APPROVED,
      },
      select: { amount: true },
    });
    const monthTotal = monthExpenses.reduce(
      (sum: number, e: { amount: Prisma.Decimal }) => sum + Number(e.amount),
      0
    );

    // Pending Approval count & sum
    const pendingExpenses = await prisma.expense.findMany({
      where: {
        ...where,
        status: ExpenseStatus.PENDING_APPROVAL,
      },
      select: { amount: true },
    });
    const pendingTotal = pendingExpenses.reduce(
      (sum: number, e: { amount: Prisma.Decimal }) => sum + Number(e.amount),
      0
    );

    // Approved count & sum
    const approvedExpenses = await prisma.expense.findMany({
      where: {
        ...where,
        status: ExpenseStatus.APPROVED,
      },
      select: { amount: true },
    });
    const approvedTotal = approvedExpenses.reduce(
      (sum: number, e: { amount: Prisma.Decimal }) => sum + Number(e.amount),
      0
    );

    // Top categories (Approved expenses this month or overall)
    const categoryAggregates = await prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        ...where,
        status: ExpenseStatus.APPROVED,
      },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: {
        _sum: {
          amount: 'desc',
        },
      },
      take: 5,
    });

    const categoryIds = categoryAggregates.map((c: { categoryId: string }) => c.categoryId);
    const categories = await prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const catMap = new Map(categories.map((c: { id: string; name: string }) => [c.id, c.name]));

    const totalCategorySpend = categoryAggregates.reduce(
      (sum: number, c: { _sum: { amount: Prisma.Decimal | null } }) =>
        sum + (c._sum.amount ? Number(c._sum.amount) : 0),
      0
    );

    const topCategories = categoryAggregates.map((c: { categoryId: string; _sum: { amount: Prisma.Decimal | null }; _count: { id: number } }) => {
      const amt = c._sum.amount ? Number(c._sum.amount) : 0;
      return {
        categoryId: c.categoryId,
        categoryName: catMap.get(c.categoryId) || 'Unknown',
        amount: amt,
        count: c._count.id,
        percentage: totalCategorySpend > 0 ? Math.round((amt / totalCategorySpend) * 100) : 0,
      };
    });

    return {
      success: true,
      data: {
        todayTotal,
        todayCount: todayExpenses.length,
        monthTotal,
        monthCount: monthExpenses.length,
        pendingTotal,
        pendingCount: pendingExpenses.length,
        approvedTotal,
        approvedCount: approvedExpenses.length,
        topCategories,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error fetching expense stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch expense metrics',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a new expense.
 */
export async function createExpense(
  data: CreateExpenseInput
): Promise<{ success: boolean; data?: { id: string; expenseNumber: string }; error?: string }> {
  try {
    const user = await requirePermission(PERMISSIONS.EXPENSE_CREATE);

    const validation = createExpenseSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Invalid expense submission',
      };
    }

    const {
      branchId,
      categoryId,
      amount,
      expenseDate,
      description,
      vendorName,
      paymentMethod,
      referenceNumber,
      receiptUrl,
      notes,
      status,
      templateId,
    } = validation.data;

    // Verify branch authorization
    const branchScope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(branchScope, branchId)) {
      return { success: false, error: 'Unauthorized branch specified' };
    }

    // Verify active branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, status: true },
    });
    if (!branch || branch.status !== 'ACTIVE') {
      return { success: false, error: 'Specified branch is inactive or does not exist' };
    }

    // Verify active category exists
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, status: true, name: true },
    });
    if (!category || category.status !== ExpenseCategoryStatus.ACTIVE) {
      return { success: false, error: 'Specified expense category is inactive or does not exist' };
    }

    // Execute atomic write with advisory lock for sequence generation
    const expense = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const expenseNumber = await generateExpenseNumber(tx);
      const expenseDateUtc = new Date(`${expenseDate}T00:00:00Z`);

      const created = await tx.expense.create({
        data: {
          expenseNumber,
          branchId,
          categoryId,
          amount: new Prisma.Decimal(amount.toFixed(2)),
          expenseDate: expenseDateUtc,
          description,
          vendorName,
          paymentMethod,
          referenceNumber,
          receiptUrl,
          notes,
          status,
          templateId,
          createdBy: user.id,
        },
      });

      // Write audit log
      await tx.expenseAuditLog.create({
        data: {
          expenseId: created.id,
          action: status === ExpenseStatus.DRAFT ? 'CREATED_DRAFT' : 'SUBMITTED_FOR_APPROVAL',
          toStatus: status,
          amount: created.amount,
          performedBy: user.id,
          notes: `Expense ${expenseNumber} created under category ${category.name}`,
        },
      });

      return created;
    });

    revalidatePath('/expenses');
    revalidatePath(`/expenses/${expense.id}`);

    return {
      success: true,
      data: { id: expense.id, expenseNumber: expense.expenseNumber },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error creating expense:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create expense',
    };
  }
}

/**
 * Update an existing expense (Draft only).
 */
export async function updateExpense(
  id: string,
  data: UpdateExpenseInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requirePermission(PERMISSIONS.EXPENSE_UPDATE);

    const validation = updateExpenseSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Invalid expense update payload',
      };
    }

    const existing = await prisma.expense.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!existing) {
      return { success: false, error: 'Expense not found' };
    }

    const branchScope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(branchScope, existing.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    // Strict immutability check
    if (
      existing.status === ExpenseStatus.APPROVED ||
      existing.status === ExpenseStatus.REJECTED ||
      existing.status === ExpenseStatus.CANCELLED
    ) {
      return {
        success: false,
        error: `Expense in status ${existing.status} cannot be modified. Financial audit integrity preserved.`,
      };
    }

    const updateData: Prisma.ExpenseUpdateInput = {};

    if (validation.data.categoryId) {
      const cat = await prisma.expenseCategory.findUnique({
        where: { id: validation.data.categoryId },
      });
      if (!cat || cat.status !== ExpenseCategoryStatus.ACTIVE) {
        return { success: false, error: 'Specified category is inactive or invalid' };
      }
      updateData.category = { connect: { id: validation.data.categoryId } };
    }

    if (validation.data.amount !== undefined) {
      updateData.amount = new Prisma.Decimal(validation.data.amount.toFixed(2));
    }

    if (validation.data.expenseDate) {
      updateData.expenseDate = new Date(`${validation.data.expenseDate}T00:00:00Z`);
    }

    if (validation.data.description !== undefined) updateData.description = validation.data.description;
    if (validation.data.vendorName !== undefined) updateData.vendorName = validation.data.vendorName;
    if (validation.data.paymentMethod !== undefined) updateData.paymentMethod = validation.data.paymentMethod;
    if (validation.data.referenceNumber !== undefined) updateData.referenceNumber = validation.data.referenceNumber;
    if (validation.data.receiptUrl !== undefined) updateData.receiptUrl = validation.data.receiptUrl;
    if (validation.data.notes !== undefined) updateData.notes = validation.data.notes;
    if (validation.data.status !== undefined) updateData.status = validation.data.status;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.expense.update({
        where: { id },
        data: updateData,
      });

      await tx.expenseAuditLog.create({
        data: {
          expenseId: id,
          action: 'UPDATED',
          fromStatus: existing.status,
          toStatus: validation.data.status || existing.status,
          amount: updateData.amount as Prisma.Decimal | undefined,
          performedBy: user.id,
          notes: 'Expense record updated',
        },
      });
    });

    revalidatePath('/expenses');
    revalidatePath(`/expenses/${id}`);

    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error updating expense:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update expense',
    };
  }
}

/**
 * Approve a pending expense.
 */
export async function approveExpense(
  input: { expenseId: string; notes?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requirePermission(PERMISSIONS.EXPENSE_APPROVE);

    const validation = approveExpenseSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Invalid approval payload',
      };
    }

    const { expenseId, notes } = validation.data;

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) {
      return { success: false, error: 'Expense not found' };
    }

    const branchScope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(branchScope, expense.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    // State machine check
    if (expense.status !== ExpenseStatus.PENDING_APPROVAL) {
      return {
        success: false,
        error: `Only expenses in PENDING_APPROVAL status can be approved. Current status: ${expense.status}`,
      };
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: ExpenseStatus.APPROVED,
          approvedBy: user.id,
          approvedAt: new Date(),
        },
      });

      await tx.expenseAuditLog.create({
        data: {
          expenseId,
          action: 'APPROVED',
          fromStatus: ExpenseStatus.PENDING_APPROVAL,
          toStatus: ExpenseStatus.APPROVED,
          amount: expense.amount,
          performedBy: user.id,
          notes: notes || 'Expense authorized and approved',
        },
      });
    });

    revalidatePath('/expenses');
    revalidatePath(`/expenses/${expenseId}`);

    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error approving expense:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve expense',
    };
  }
}

/**
 * Reject a pending expense (Mandatory reason required).
 */
export async function rejectExpense(
  input: { expenseId: string; rejectionReason: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requirePermission(PERMISSIONS.EXPENSE_REJECT);

    const validation = rejectExpenseSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Rejection reason is required',
      };
    }

    const { expenseId, rejectionReason } = validation.data;

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) {
      return { success: false, error: 'Expense not found' };
    }

    const branchScope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(branchScope, expense.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    // State machine check
    if (expense.status !== ExpenseStatus.PENDING_APPROVAL) {
      return {
        success: false,
        error: `Only expenses in PENDING_APPROVAL status can be rejected. Current status: ${expense.status}`,
      };
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: ExpenseStatus.REJECTED,
          rejectionReason,
        },
      });

      await tx.expenseAuditLog.create({
        data: {
          expenseId,
          action: 'REJECTED',
          fromStatus: ExpenseStatus.PENDING_APPROVAL,
          toStatus: ExpenseStatus.REJECTED,
          amount: expense.amount,
          performedBy: user.id,
          notes: `Rejection reason: ${rejectionReason}`,
        },
      });
    });

    revalidatePath('/expenses');
    revalidatePath(`/expenses/${expenseId}`);

    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error rejecting expense:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reject expense',
    };
  }
}

/**
 * Cancel an expense (DRAFT or PENDING_APPROVAL only, mandatory reason).
 */
export async function cancelExpense(
  input: { expenseId: string; cancellationReason: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requirePermission(PERMISSIONS.EXPENSE_CANCEL);

    const validation = cancelExpenseSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Cancellation reason is required',
      };
    }

    const { expenseId, cancellationReason } = validation.data;

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) {
      return { success: false, error: 'Expense not found' };
    }

    const branchScope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(branchScope, expense.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    // State machine check: Cannot cancel APPROVED or REJECTED
    if (
      expense.status !== ExpenseStatus.DRAFT &&
      expense.status !== ExpenseStatus.PENDING_APPROVAL
    ) {
      return {
        success: false,
        error: `Only expenses in DRAFT or PENDING_APPROVAL status can be cancelled. Current status: ${expense.status}`,
      };
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: ExpenseStatus.CANCELLED,
          cancellationReason,
          cancelledBy: user.id,
          cancelledAt: new Date(),
        },
      });

      await tx.expenseAuditLog.create({
        data: {
          expenseId,
          action: 'CANCELLED',
          fromStatus: expense.status,
          toStatus: ExpenseStatus.CANCELLED,
          amount: expense.amount,
          performedBy: user.id,
          notes: `Cancellation reason: ${cancellationReason}`,
        },
      });
    });

    revalidatePath('/expenses');
    revalidatePath(`/expenses/${expenseId}`);

    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error cancelling expense:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel expense',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function getExpenseCategories(
  includeInactive: boolean = false
): Promise<{ success: boolean; data?: ExpenseCategoryItem[]; error?: string }> {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_CATEGORY_READ);

    const where: Prisma.ExpenseCategoryWhereInput = {};
    if (!includeInactive) {
      where.status = ExpenseCategoryStatus.ACTIVE;
    }

    const categories = await prisma.expenseCategory.findMany({
      where,
      include: {
        _count: {
          select: { expenses: true },
        },
        expenses: {
          where: { status: ExpenseStatus.APPROVED },
          select: { amount: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formatted: ExpenseCategoryItem[] = categories.map((c: { id: string; name: string; description: string | null; status: ExpenseCategoryStatus; _count: { expenses: number }; expenses: { amount: Prisma.Decimal }[]; createdAt: Date; updatedAt: Date }) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      status: c.status,
      expenseCount: c._count.expenses,
      totalAmount: c.expenses.reduce((sum: number, e: { amount: Prisma.Decimal }) => sum + Number(e.amount), 0),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return { success: true, data: formatted };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error fetching categories:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch categories',
    };
  }
}

export async function createExpenseCategory(
  data: ExpenseCategoryInput
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_CATEGORY_CREATE);

    const validation = expenseCategorySchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Invalid category details',
      };
    }

    const existing = await prisma.expenseCategory.findUnique({
      where: { name: validation.data.name },
    });
    if (existing) {
      return { success: false, error: 'A category with this name already exists' };
    }

    const category = await prisma.expenseCategory.create({
      data: {
        name: validation.data.name,
        description: validation.data.description,
        status: validation.data.status,
      },
    });

    revalidatePath('/expenses');
    revalidatePath('/expenses/categories');

    return { success: true, data: { id: category.id } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error creating category:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create category',
    };
  }
}

export async function updateExpenseCategory(
  id: string,
  data: ExpenseCategoryInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_CATEGORY_UPDATE);

    const validation = expenseCategorySchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Invalid category details',
      };
    }

    const existing = await prisma.expenseCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false, error: 'Category not found' };
    }

    if (validation.data.name !== existing.name) {
      const duplicate = await prisma.expenseCategory.findUnique({
        where: { name: validation.data.name },
      });
      if (duplicate && duplicate.id !== id) {
        return { success: false, error: 'Another category with this name already exists' };
      }
    }

    await prisma.expenseCategory.update({
      where: { id },
      data: {
        name: validation.data.name,
        description: validation.data.description,
        status: validation.data.status,
      },
    });

    revalidatePath('/expenses');
    revalidatePath('/expenses/categories');

    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error updating category:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update category',
    };
  }
}

export async function toggleExpenseCategoryStatus(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_CATEGORY_DEACTIVATE);

    const category = await prisma.expenseCategory.findUnique({
      where: { id },
    });
    if (!category) {
      return { success: false, error: 'Category not found' };
    }

    const newStatus =
      category.status === ExpenseCategoryStatus.ACTIVE
        ? ExpenseCategoryStatus.INACTIVE
        : ExpenseCategoryStatus.ACTIVE;

    await prisma.expenseCategory.update({
      where: { id },
      data: { status: newStatus },
    });

    revalidatePath('/expenses');
    revalidatePath('/expenses/categories');

    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error toggling category status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle category status',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECURRING EXPENSE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export async function getExpenseTemplates(
  branchId?: string
): Promise<{ success: boolean; data?: ExpenseTemplateItem[]; error?: string }> {
  try {
    const user = await requirePermission(PERMISSIONS.EXPENSE_TEMPLATE_READ);

    const branchScope = await getAuthorizedBranchScope(user);

    const where: Prisma.ExpenseTemplateWhereInput = {};
    if (branchId && branchId !== 'all') {
      if (!isBranchAuthorized(branchScope, branchId)) {
        return { success: false, error: 'Unauthorized branch access' };
      }
      where.branchId = branchId;
    } else if (!branchScope.isAllBranches) {
      where.branchId = { in: branchScope.branchIds };
    }

    const templates = await prisma.expenseTemplate.findMany({
      where,
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        category: {
          select: { id: true, name: true },
        },
      },
      orderBy: { nextDueDate: 'asc' },
    });

    const userIds: string[] = Array.from(new Set(templates.map((t: { createdBy: string }) => t.createdBy)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u: { id: string; name: string }) => [u.id, u.name]));

    const formatted: ExpenseTemplateItem[] = templates.map((t) => ({
      id: t.id,
      branchId: t.branchId,
      branchName: t.branch.name,
      branchCode: t.branch.code,
      categoryId: t.categoryId,
      categoryName: t.category.name,
      description: t.description,
      amount: Number(t.amount),
      frequency: t.frequency,
      nextDueDate: t.nextDueDate.toISOString().split('T')[0],
      status: t.status,
      vendorName: t.vendorName,
      paymentMethod: t.paymentMethod,
      createdBy: t.createdBy,
      createdByName: userMap.get(t.createdBy) || 'User',
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return { success: true, data: formatted };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error fetching expense templates:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch templates',
    };
  }
}

export async function createExpenseTemplate(
  data: ExpenseTemplateInput
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  try {
    const user = await requirePermission(PERMISSIONS.EXPENSE_TEMPLATE_CREATE);

    const validation = expenseTemplateSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Invalid template details',
      };
    }

    const {
      branchId,
      categoryId,
      description,
      amount,
      frequency,
      nextDueDate,
      vendorName,
      paymentMethod,
      status,
    } = validation.data;

    const branchScope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(branchScope, branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    const template = await prisma.expenseTemplate.create({
      data: {
        branchId,
        categoryId,
        description,
        amount: new Prisma.Decimal(amount.toFixed(2)),
        frequency,
        nextDueDate: new Date(`${nextDueDate}T00:00:00Z`),
        vendorName,
        paymentMethod,
        status,
        createdBy: user.id,
      },
    });

    revalidatePath('/expenses');
    revalidatePath('/expenses/templates');

    return { success: true, data: { id: template.id } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error creating template:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create template',
    };
  }
}

export async function toggleExpenseTemplateStatus(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requirePermission(PERMISSIONS.EXPENSE_TEMPLATE_DEACTIVATE);

    const template = await prisma.expenseTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    const branchScope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(branchScope, template.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    const newStatus =
      template.status === ExpenseTemplateStatus.ACTIVE
        ? ExpenseTemplateStatus.INACTIVE
        : ExpenseTemplateStatus.ACTIVE;

    await prisma.expenseTemplate.update({
      where: { id },
      data: { status: newStatus },
    });

    revalidatePath('/expenses');
    revalidatePath('/expenses/templates');

    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error toggling template status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle template status',
    };
  }
}

/**
 * Manual trigger: Create an expense from a recurring template.
 * Automatically advances the template's nextDueDate according to its frequency!
 */
export async function createExpenseFromTemplate(
  templateId: string,
  customExpenseDate?: string
): Promise<{ success: boolean; data?: { id: string; expenseNumber: string }; error?: string }> {
  try {
    const user = await requirePermission(PERMISSIONS.EXPENSE_CREATE);

    const template = await prisma.expenseTemplate.findUnique({
      where: { id: templateId },
      include: {
        category: true,
      },
    });

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    if (template.status !== ExpenseTemplateStatus.ACTIVE) {
      return { success: false, error: 'Cannot generate expense from inactive template' };
    }

    const branchScope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(branchScope, template.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    const expenseDate = customExpenseDate || template.nextDueDate.toISOString().split('T')[0];

    // Compute advanced nextDueDate
    const currentDueDate = new Date(template.nextDueDate);
    const nextDueDate = new Date(currentDueDate);
    if (template.frequency === 'WEEKLY') {
      nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 7);
    } else if (template.frequency === 'MONTHLY') {
      nextDueDate.setUTCMonth(nextDueDate.getUTCMonth() + 1);
    } else if (template.frequency === 'YEARLY') {
      nextDueDate.setUTCFullYear(nextDueDate.getUTCFullYear() + 1);
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const expenseNumber = await generateExpenseNumber(tx);
      const expenseDateUtc = new Date(`${expenseDate}T00:00:00Z`);

      const created = await tx.expense.create({
        data: {
          expenseNumber,
          branchId: template.branchId,
          categoryId: template.categoryId,
          amount: template.amount,
          expenseDate: expenseDateUtc,
          description: template.description,
          vendorName: template.vendorName,
          paymentMethod: template.paymentMethod || 'CASH',
          status: ExpenseStatus.PENDING_APPROVAL,
          templateId: template.id,
          createdBy: user.id,
        },
      });

      // Advance nextDueDate on template
      await tx.expenseTemplate.update({
        where: { id: template.id },
        data: {
          nextDueDate,
        },
      });

      // Audit log
      await tx.expenseAuditLog.create({
        data: {
          expenseId: created.id,
          action: 'CREATED_FROM_TEMPLATE',
          toStatus: ExpenseStatus.PENDING_APPROVAL,
          amount: created.amount,
          performedBy: user.id,
          notes: `Created from recurring template (${template.frequency}). Next due date advanced to ${nextDueDate.toISOString().split('T')[0]}`,
        },
      });

      return created;
    });

    revalidatePath('/expenses');
    revalidatePath('/expenses/templates');
    revalidatePath(`/expenses/${result.id}`);

    return {
      success: true,
      data: { id: result.id, expenseNumber: result.expenseNumber },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Error creating expense from template:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create expense from template',
    };
  }
}
