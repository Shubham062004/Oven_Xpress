'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { createBranchSchema, updateBranchSchema } from '@/lib/validations/branch';
import type { ActionResult } from '@/lib/auth/types';
import type { Branch, BranchStatus } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BranchFormState extends ActionResult<Branch> {
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

// ─── Read Operations ────────────────────────────────────────────────────────

/**
 * Fetches all branches with optional search and status filter.
 */
export async function getBranches(
  params?: BranchListParams
): Promise<ActionResult<Branch[]>> {
  try {
    await requirePermission(PERMISSIONS.BRANCH_READ);

    const { search, status } = params ?? {};

    const where: Record<string, unknown> = {};

    // Status filter
    if (status && status !== 'ALL') {
      where.status = status;
    }

    // Search filter: name, code, or city
    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { code: { contains: searchTerm, mode: 'insensitive' } },
        { city: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const branches = await prisma.branch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: branches };
  } catch (error) {
    // Let Next.js handle redirect errors from requirePermission
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch branches:', error);
    return { success: false, error: 'Failed to load branches. Please try again.' };
  }
}

/**
 * Fetches a single branch by ID.
 */
export async function getBranchById(
  id: string
): Promise<ActionResult<Branch>> {
  try {
    await requirePermission(PERMISSIONS.BRANCH_READ);

    const branch = await prisma.branch.findUnique({
      where: { id },
    });

    if (!branch) {
      return { success: false, error: 'Branch not found.' };
    }

    return { success: true, data: branch };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch branch:', error);
    return { success: false, error: 'Failed to load branch details. Please try again.' };
  }
}

/**
 * Fetches aggregate branch statistics.
 */
export async function getBranchStats(): Promise<ActionResult<BranchStats>> {
  try {
    await requirePermission(PERMISSIONS.BRANCH_READ);

    const [total, active, inactive] = await Promise.all([
      prisma.branch.count(),
      prisma.branch.count({ where: { status: 'ACTIVE' } }),
      prisma.branch.count({ where: { status: 'INACTIVE' } }),
    ]);

    return { success: true, data: { total, active, inactive } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch branch stats:', error);
    return { success: false, error: 'Failed to load branch statistics.' };
  }
}

// ─── Write Operations ───────────────────────────────────────────────────────

/**
 * Creates a new branch after verifying permission, validation, and code uniqueness.
 */
export async function createBranch(
  data: Record<string, unknown>
): Promise<BranchFormState> {
  try {
    await requirePermission(PERMISSIONS.BRANCH_CREATE);

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
        status: 'ACTIVE',
      },
    });

    revalidatePath('/branches');
    return { success: true, data: branch };
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
 * Updates an existing branch. Branch code is immutable.
 */
export async function updateBranch(
  id: string,
  data: Record<string, unknown>
): Promise<BranchFormState> {
  try {
    await requirePermission(PERMISSIONS.BRANCH_UPDATE);

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
    const existing = await prisma.branch.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'Branch not found.' };
    }

    const input = parsed.data;

    // Update the branch
    const branch = await prisma.branch.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description || null,
        address: input.address,
        city: input.city,
        state: input.state || null,
        postalCode: input.postalCode || null,
        phone: input.phone || null,
        email: input.email || null,
        openingTime: input.openingTime || null,
        closingTime: input.closingTime || null,
      },
    });

    revalidatePath('/branches');
    revalidatePath(`/branches/${id}`);
    return { success: true, data: branch };
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
 * Toggles a branch between ACTIVE and INACTIVE status.
 */
export async function toggleBranchStatus(
  id: string
): Promise<ActionResult<Branch>> {
  try {
    await requirePermission(PERMISSIONS.BRANCH_DEACTIVATE);

    const existing = await prisma.branch.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'Branch not found.' };
    }

    const newStatus: BranchStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const branch = await prisma.branch.update({
      where: { id },
      data: { status: newStatus },
    });

    revalidatePath('/branches');
    revalidatePath(`/branches/${id}`);
    return { success: true, data: branch };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to toggle branch status:', error);
    return {
      success: false,
      error: 'Failed to update branch status. Please try again.',
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
