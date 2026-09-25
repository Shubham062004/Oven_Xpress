'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission, getAuthorizedBranchScope } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  updateBranchMenuItemSchema,
} from '@/lib/validations/menu';
import type { ActionResult } from '@/lib/auth/types';
import type {
  MenuItemListItem,
  MenuItemDetailItem,
  MenuItemListParams,
  MenuSummaryStats,
  MenuFormState,
  BranchMenuItemItem,
} from '@/lib/menu/types';
import { MenuStatus, Prisma } from '@prisma/client';

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
 * Fetches all menu items with category, branch availability count, and recipe indicator.
 */
export async function getMenuItems(
  params?: MenuItemListParams
): Promise<ActionResult<MenuItemListItem[]>> {
  try {
    await requirePermission(PERMISSIONS.MENU_ITEM_READ);

    const { search, categoryId, status, branchId } = params ?? {};
    const where: Prisma.MenuItemWhereInput = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (categoryId && categoryId !== 'ALL') {
      where.categoryId = categoryId;
    }

    if (search && search.trim().length > 0) {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    if (branchId && branchId !== 'ALL') {
      where.branchAvailability = {
        some: {
          branchId,
          isAvailable: true,
        },
      };
    }

    const items = await prisma.menuItem.findMany({
      where,
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
      include: {
        category: {
          select: { id: true, name: true },
        },
        recipeIngredients: {
          select: { id: true },
        },
        branchAvailability: {
          select: { id: true, isAvailable: true, branchId: true },
        },
      },
    });

    const formatted: MenuItemListItem[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      categoryId: item.categoryId,
      price: Number(item.price),
      preparationTimeMinutes: item.preparationTimeMinutes,
      imageUrl: item.imageUrl,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      category: item.category,
      recipeConfigured: item.recipeIngredients.length > 0,
      ingredientCount: item.recipeIngredients.length,
      availableBranchCount: item.branchAvailability.filter((b) => b.isAvailable).length,
      totalBranchesConfigured: item.branchAvailability.length,
    }));

    return { success: true, data: formatted };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch menu items:', error);
    return { success: false, error: 'Failed to load menu items. Please try again.' };
  }
}

/**
 * Fetches a single menu item with complete recipe BOM and branch pricing details.
 */
export async function getMenuItemById(
  id: string
): Promise<ActionResult<MenuItemDetailItem>> {
  try {
    await requirePermission(PERMISSIONS.MENU_ITEM_READ);

    const item = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true },
        },
        branchAvailability: {
          include: {
            branch: {
              select: { id: true, name: true, code: true, city: true },
            },
          },
          orderBy: { branch: { name: 'asc' } },
        },
        recipeIngredients: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, status: true },
            },
          },
          orderBy: { ingredient: { name: 'asc' } },
        },
      },
    });

    if (!item) {
      return { success: false, error: 'Menu item not found.' };
    }

    const formatted: MenuItemDetailItem = {
      id: item.id,
      name: item.name,
      description: item.description,
      categoryId: item.categoryId,
      price: Number(item.price),
      preparationTimeMinutes: item.preparationTimeMinutes,
      imageUrl: item.imageUrl,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      category: item.category,
      branchAvailability: item.branchAvailability.map((b) => ({
        id: b.id,
        branchId: b.branchId,
        menuItemId: b.menuItemId,
        price: b.price !== null ? Number(b.price) : null,
        isAvailable: b.isAvailable,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        branch: b.branch,
      })),
      recipeIngredients: item.recipeIngredients.map((r) => ({
        id: r.id,
        menuItemId: r.menuItemId,
        ingredientId: r.ingredientId,
        quantity: Number(r.quantity),
        unit: r.unit,
        notes: r.notes,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        ingredient: r.ingredient,
      })),
    };

    return { success: true, data: formatted };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch menu item details:', error);
    return { success: false, error: 'Failed to load menu item details.' };
  }
}

/**
 * Creates a new menu item and initializes branch availability for all active branches.
 */
export async function createMenuItem(
  data: Record<string, unknown>
): Promise<MenuFormState<MenuItemDetailItem>> {
  try {
    await requirePermission(PERMISSIONS.MENU_ITEM_CREATE);

    const parsed = createMenuItemSchema.safeParse(data);
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

    // Verify category exists
    const category = await prisma.menuCategory.findUnique({
      where: { id: input.categoryId },
    });

    if (!category) {
      return {
        success: false,
        error: 'Selected category does not exist.',
        fieldErrors: { categoryId: ['Please select a valid category.'] },
      };
    }

    // Create menu item and initialize branch availability in a transaction
    const activeBranches = await prisma.branch.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.menuItem.create({
        data: {
          name: input.name,
          description: input.description || null,
          categoryId: input.categoryId,
          price: new Prisma.Decimal(input.price),
          preparationTimeMinutes: input.preparationTimeMinutes ?? 0,
          imageUrl: input.imageUrl || null,
          status: input.status,
        },
      });

      // Initialize branch availability records
      if (activeBranches.length > 0) {
        await tx.branchMenuItem.createMany({
          data: activeBranches.map((b) => ({
            branchId: b.id,
            menuItemId: created.id,
            isAvailable: true,
            price: null, // Default to base price
          })),
        });
      }

      return created;
    });

    revalidatePath('/menu');
    const result = await getMenuItemById(item.id);
    if (!result.success || !result.data) {
      return { success: false, error: 'Menu item created but failed to load record.' };
    }

    return { success: true, data: result.data };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to create menu item:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating the menu item.',
    };
  }
}

/**
 * Updates an existing menu item.
 */
export async function updateMenuItem(
  id: string,
  data: Record<string, unknown>
): Promise<MenuFormState<MenuItemDetailItem>> {
  try {
    await requirePermission(PERMISSIONS.MENU_ITEM_UPDATE);

    const parsed = updateMenuItemSchema.safeParse(data);
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

    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'Menu item not found.' };
    }

    const input = parsed.data;

    if (input.categoryId) {
      const category = await prisma.menuCategory.findUnique({
        where: { id: input.categoryId },
      });
      if (!category) {
        return {
          success: false,
          error: 'Selected category does not exist.',
          fieldErrors: { categoryId: ['Please select a valid category.'] },
        };
      }
    }

    await prisma.menuItem.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        description:
          input.description !== undefined
            ? input.description || null
            : existing.description,
        categoryId: input.categoryId ?? existing.categoryId,
        price:
          input.price !== undefined
            ? new Prisma.Decimal(input.price)
            : existing.price,
        preparationTimeMinutes:
          input.preparationTimeMinutes !== undefined
            ? input.preparationTimeMinutes
            : existing.preparationTimeMinutes,
        imageUrl:
          input.imageUrl !== undefined
            ? input.imageUrl || null
            : existing.imageUrl,
        status: input.status ?? existing.status,
      },
    });

    revalidatePath('/menu');
    revalidatePath(`/menu/items/${id}`);

    const result = await getMenuItemById(id);
    if (!result.success || !result.data) {
      return { success: false, error: 'Updated but failed to reload menu item.' };
    }

    return { success: true, data: result.data };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to update menu item:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating the menu item.',
    };
  }
}

/**
 * Toggles menu item status between ACTIVE and INACTIVE.
 */
export async function toggleMenuItemStatus(
  id: string
): Promise<ActionResult<MenuItemDetailItem>> {
  try {
    await requirePermission(PERMISSIONS.MENU_ITEM_DEACTIVATE);

    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) {
      return { success: false, error: 'Menu item not found.' };
    }

    const newStatus =
      item.status === MenuStatus.ACTIVE ? MenuStatus.INACTIVE : MenuStatus.ACTIVE;

    await prisma.menuItem.update({
      where: { id },
      data: { status: newStatus },
    });

    revalidatePath('/menu');
    revalidatePath(`/menu/items/${id}`);

    const result = await getMenuItemById(id);
    return result;
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to toggle menu item status:', error);
    return {
      success: false,
      error: 'Failed to update menu item status. Please try again.',
    };
  }
}

/**
 * Updates availability and optional price override for a menu item at a specific branch.
 * Enforces strict branch-aware security: Managers can ONLY modify their assigned branch.
 */
export async function updateBranchAvailability(
  data: Record<string, unknown>
): Promise<MenuFormState<BranchMenuItemItem>> {
  try {
    const user = await requirePermission(PERMISSIONS.MENU_BRANCH_UPDATE);

    const parsed = updateBranchMenuItemSchema.safeParse(data);
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

    // Server-side branch security guard
    const branchScope = await getAuthorizedBranchScope(user);
    if (!branchScope.isAllBranches && !branchScope.branchIds.includes(input.branchId)) {
      return {
        success: false,
        error: 'You do not have permission to modify menu availability for this branch.',
      };
    }

    // Verify branch and menu item exist
    const [branch, menuItem] = await Promise.all([
      prisma.branch.findUnique({ where: { id: input.branchId } }),
      prisma.menuItem.findUnique({ where: { id: input.menuItemId } }),
    ]);

    if (!branch) return { success: false, error: 'Branch not found.' };
    if (!menuItem) return { success: false, error: 'Menu item not found.' };

    const branchPrice =
      input.price !== undefined && input.price !== null
        ? new Prisma.Decimal(input.price)
        : null;

    const record = await prisma.branchMenuItem.upsert({
      where: {
        branchId_menuItemId: {
          branchId: input.branchId,
          menuItemId: input.menuItemId,
        },
      },
      create: {
        branchId: input.branchId,
        menuItemId: input.menuItemId,
        isAvailable: input.isAvailable,
        price: branchPrice,
      },
      update: {
        isAvailable: input.isAvailable,
        price: branchPrice,
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true, city: true },
        },
      },
    });

    revalidatePath('/menu');
    revalidatePath(`/menu/items/${input.menuItemId}`);

    return {
      success: true,
      data: {
        id: record.id,
        branchId: record.branchId,
        menuItemId: record.menuItemId,
        price: record.price ? Number(record.price) : null,
        isAvailable: record.isAvailable,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        branch: record.branch,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to update branch availability:', error);
    return {
      success: false,
      error: 'Failed to update branch availability. Please try again.',
    };
  }
}

/**
 * Calculates top-level summary metrics for the Menu dashboard tab.
 */
export async function getMenuSummaryStats(): Promise<ActionResult<MenuSummaryStats>> {
  try {
    await requirePermission(PERMISSIONS.MENU_ITEM_READ);

    const [
      totalItems,
      activeItems,
      totalCategories,
      totalIngredients,
      itemsWithRecipeCount,
      totalBranches,
    ] = await Promise.all([
      prisma.menuItem.count(),
      prisma.menuItem.count({ where: { status: MenuStatus.ACTIVE } }),
      prisma.menuCategory.count(),
      prisma.ingredient.count(),
      prisma.menuItem.count({
        where: {
          recipeIngredients: { some: {} },
        },
      }),
      prisma.branch.count({ where: { status: 'ACTIVE' } }),
    ]);

    const recipePercentage =
      totalItems > 0 ? Math.round((itemsWithRecipeCount / totalItems) * 100) : 0;

    return {
      success: true,
      data: {
        totalItems,
        activeItems,
        totalCategories,
        totalIngredients,
        itemsWithRecipe: itemsWithRecipeCount,
        recipePercentage,
        totalBranches,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to calculate menu statistics:', error);
    return { success: false, error: 'Failed to load menu statistics.' };
  }
}
