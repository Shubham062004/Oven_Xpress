'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  saveRecipeSchema,
  areUnitsCompatible,
} from '@/lib/validations/menu';
import type { ActionResult } from '@/lib/auth/types';
import type { RecipeIngredientItem, MenuFormState } from '@/lib/menu/types';
import { Prisma } from '@prisma/client';

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
 * Fetches the Bill of Materials (BOM) for a specific menu item.
 */
export async function getRecipeByMenuItemId(
  menuItemId: string
): Promise<ActionResult<RecipeIngredientItem[]>> {
  try {
    await requirePermission(PERMISSIONS.MENU_RECIPE_READ);

    const recipe = await prisma.recipeIngredient.findMany({
      where: { menuItemId },
      include: {
        ingredient: {
          select: { id: true, name: true, unit: true, status: true },
        },
      },
      orderBy: { ingredient: { name: 'asc' } },
    });

    const formatted: RecipeIngredientItem[] = recipe.map((r) => ({
      id: r.id,
      menuItemId: r.menuItemId,
      ingredientId: r.ingredientId,
      quantity: Number(r.quantity),
      unit: r.unit,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      ingredient: r.ingredient,
    }));

    return { success: true, data: formatted };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch recipe BOM:', error);
    return { success: false, error: 'Failed to load recipe details.' };
  }
}

/**
 * Saves or updates a menu item's complete Bill of Materials (BOM) atomically.
 * Enforces unit compatibility against each ingredient's registered base unit,
 * verifies active status, and prevents duplicate ingredients.
 */
export async function saveRecipe(
  data: Record<string, unknown>
): Promise<MenuFormState<RecipeIngredientItem[]>> {
  try {
    await requirePermission(PERMISSIONS.MENU_RECIPE_UPDATE);

    const parsed = saveRecipeSchema.safeParse(data);
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

    const { menuItemId, ingredients } = parsed.data;

    // Verify menu item exists
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
    });

    if (!menuItem) {
      return { success: false, error: 'Menu item not found.' };
    }

    // Verify ingredients and unit compatibility
    if (ingredients.length > 0) {
      const ingredientIds = ingredients.map((i) => i.ingredientId);
      const existingIngredients = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds } },
      });

      const ingredientMap = new Map(existingIngredients.map((i) => [i.id, i]));

      for (let idx = 0; idx < ingredients.length; idx++) {
        const row = ingredients[idx];
        const ing = ingredientMap.get(row.ingredientId);

        if (!ing) {
          return {
            success: false,
            error: `Ingredient not found.`,
            fieldErrors: {
              [`ingredients.${idx}.ingredientId`]: ['Selected ingredient does not exist.'],
            },
          };
        }

        if (ing.status !== 'ACTIVE') {
          return {
            success: false,
            error: `Ingredient "${ing.name}" is currently inactive.`,
            fieldErrors: {
              [`ingredients.${idx}.ingredientId`]: [
                `"${ing.name}" is inactive. Please activate it first.`,
              ],
            },
          };
        }

        // Unit compatibility verification
        if (!areUnitsCompatible(ing.unit, row.unit)) {
          return {
            success: false,
            error: `Unit "${row.unit}" is incompatible with ingredient "${ing.name}" (base unit: ${ing.unit}).`,
            fieldErrors: {
              [`ingredients.${idx}.unit`]: [
                `Must belong to the same measurement family as ${ing.unit}.`,
              ],
            },
          };
        }
      }
    }

    // Execute atomic replace inside transaction
    await prisma.$transaction(async (tx) => {
      // Clear current recipe ingredients
      await tx.recipeIngredient.deleteMany({
        where: { menuItemId },
      });

      // Insert new recipe ingredients
      if (ingredients.length > 0) {
        await tx.recipeIngredient.createMany({
          data: ingredients.map((item) => ({
            menuItemId,
            ingredientId: item.ingredientId,
            quantity: new Prisma.Decimal(item.quantity),
            unit: item.unit,
            notes: item.notes || null,
          })),
        });
      }
    });

    revalidatePath('/menu');
    revalidatePath(`/menu/items/${menuItemId}`);

    const updated = await getRecipeByMenuItemId(menuItemId);
    return {
      success: true,
      data: updated.data ?? [],
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to save recipe BOM:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while saving the recipe BOM.',
    };
  }
}

/**
 * Removes a single ingredient from a menu item's recipe.
 */
export async function removeRecipeIngredient(
  recipeIngredientId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    await requirePermission(PERMISSIONS.MENU_RECIPE_UPDATE);

    const record = await prisma.recipeIngredient.findUnique({
      where: { id: recipeIngredientId },
      select: { menuItemId: true },
    });

    if (!record) {
      return { success: false, error: 'Recipe ingredient record not found.' };
    }

    await prisma.recipeIngredient.delete({
      where: { id: recipeIngredientId },
    });

    revalidatePath('/menu');
    revalidatePath(`/menu/items/${record.menuItemId}`);

    return { success: true, data: { success: true } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to remove ingredient from recipe:', error);
    return {
      success: false,
      error: 'Failed to remove ingredient. Please try again.',
    };
  }
}
