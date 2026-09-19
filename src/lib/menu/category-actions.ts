'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  createCategorySchema,
  updateCategorySchema,
} from '@/lib/validations/menu';
import type { ActionResult } from '@/lib/auth/types';
import type {
  CategoryItem,
  CategoryListParams,
  MenuFormState,
} from '@/lib/menu/types';
import { MenuStatus } from '@prisma/client';

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
 * Fetches categories with optional search and status filter.
 */
export async function getCategories(
  params?: CategoryListParams
): Promise<ActionResult<CategoryItem[]>> {
  try {
    await requirePermission(PERMISSIONS.MENU_CATEGORY_READ);

    const { search, status } = params ?? {};
    const where: Record<string, unknown> = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search && search.trim().length > 0) {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    const categories = await prisma.menuCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return { success: true, data: categories };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch categories:', error);
    return { success: false, error: 'Failed to load categories. Please try again.' };
  }
}

/**
 * Fetches a single category by ID.
 */
export async function getCategoryById(
  id: string
): Promise<ActionResult<CategoryItem>> {
  try {
    await requirePermission(PERMISSIONS.MENU_CATEGORY_READ);

    const category = await prisma.menuCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    if (!category) {
      return { success: false, error: 'Category not found.' };
    }

    return { success: true, data: category };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch category:', error);
    return { success: false, error: 'Failed to load category details.' };
  }
}

/**
 * Creates a new menu category after validating inputs and checking uniqueness.
 */
export async function createCategory(
  data: Record<string, unknown>
): Promise<MenuFormState<CategoryItem>> {
  try {
    await requirePermission(PERMISSIONS.MENU_CATEGORY_CREATE);

    const parsed = createCategorySchema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? '_form';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return {
        success: false,
        error: 'Please resolve the validation errors below.',
        fieldErrors,
      };
    }

    const input = parsed.data;

    // Check duplicate name (case-insensitive)
    const existing = await prisma.menuCategory.findFirst({
      where: {
        name: { equals: input.name, mode: 'insensitive' },
      },
    });

    if (existing) {
      return {
        success: false,
        error: 'A category with this name already exists.',
        fieldErrors: { name: ['Category name must be unique.'] },
      };
    }

    const category = await prisma.menuCategory.create({
      data: {
        name: input.name,
        description: input.description || null,
        sortOrder: input.sortOrder ?? 0,
        status: input.status,
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    revalidatePath('/menu');
    return { success: true, data: category };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to create category:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating the category.',
    };
  }
}

/**
 * Updates an existing category.
 */
export async function updateCategory(
  id: string,
  data: Record<string, unknown>
): Promise<MenuFormState<CategoryItem>> {
  try {
    await requirePermission(PERMISSIONS.MENU_CATEGORY_UPDATE);

    const parsed = updateCategorySchema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? '_form';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return {
        success: false,
        error: 'Please resolve the validation errors below.',
        fieldErrors,
      };
    }

    const existing = await prisma.menuCategory.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'Category not found.' };
    }

    const input = parsed.data;

    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.menuCategory.findFirst({
        where: {
          id: { not: id },
          name: { equals: input.name, mode: 'insensitive' },
        },
      });

      if (duplicate) {
        return {
          success: false,
          error: 'A category with this name already exists.',
          fieldErrors: { name: ['Category name must be unique.'] },
        };
      }
    }

    const updated = await prisma.menuCategory.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        description: input.description !== undefined ? (input.description || null) : existing.description,
        sortOrder: input.sortOrder !== undefined ? input.sortOrder : existing.sortOrder,
        status: input.status ?? existing.status,
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    revalidatePath('/menu');
    return { success: true, data: updated };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to update category:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating the category.',
    };
  }
}

/**
 * Toggles category status between ACTIVE and INACTIVE.
 */
export async function toggleCategoryStatus(
  id: string
): Promise<ActionResult<CategoryItem>> {
  try {
    await requirePermission(PERMISSIONS.MENU_CATEGORY_DEACTIVATE);

    const category = await prisma.menuCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { items: true } },
      },
    });

    if (!category) {
      return { success: false, error: 'Category not found.' };
    }

    const newStatus =
      category.status === MenuStatus.ACTIVE ? MenuStatus.INACTIVE : MenuStatus.ACTIVE;

    const updated = await prisma.menuCategory.update({
      where: { id },
      data: { status: newStatus },
      include: {
        _count: { select: { items: true } },
      },
    });

    revalidatePath('/menu');
    return { success: true, data: updated };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to toggle category status:', error);
    return {
      success: false,
      error: 'Failed to update category status. Please try again.',
    };
  }
}
