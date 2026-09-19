'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  createIngredientSchema,
  updateIngredientSchema,
  areUnitsCompatible,
} from '@/lib/validations/menu';
import type { ActionResult } from '@/lib/auth/types';
import type {
  IngredientItem,
  IngredientListParams,
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
 * Fetches ingredients with optional search, unit, and status filter.
 */
export async function getIngredients(
  params?: IngredientListParams
): Promise<ActionResult<IngredientItem[]>> {
  try {
    await requirePermission(PERMISSIONS.MENU_INGREDIENT_READ);

    const { search, unit, status } = params ?? {};
    const where: Record<string, unknown> = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (unit && unit !== 'ALL') {
      where.unit = unit;
    }

    if (search && search.trim().length > 0) {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    const ingredients = await prisma.ingredient.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { recipes: true },
        },
      },
    });

    return { success: true, data: ingredients };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch ingredients:', error);
    return { success: false, error: 'Failed to load ingredients. Please try again.' };
  }
}

/**
 * Fetches a single ingredient by ID.
 */
export async function getIngredientById(
  id: string
): Promise<ActionResult<IngredientItem>> {
  try {
    await requirePermission(PERMISSIONS.MENU_INGREDIENT_READ);

    const ingredient = await prisma.ingredient.findUnique({
      where: { id },
      include: {
        _count: {
          select: { recipes: true },
        },
      },
    });

    if (!ingredient) {
      return { success: false, error: 'Ingredient not found.' };
    }

    return { success: true, data: ingredient };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch ingredient:', error);
    return { success: false, error: 'Failed to load ingredient details.' };
  }
}

/**
 * Creates a new raw ingredient.
 */
export async function createIngredient(
  data: Record<string, unknown>
): Promise<MenuFormState<IngredientItem>> {
  try {
    await requirePermission(PERMISSIONS.MENU_INGREDIENT_CREATE);

    const parsed = createIngredientSchema.safeParse(data);
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

    // Check duplicate name
    const existing = await prisma.ingredient.findFirst({
      where: {
        name: { equals: input.name, mode: 'insensitive' },
      },
    });

    if (existing) {
      return {
        success: false,
        error: 'An ingredient with this name already exists.',
        fieldErrors: { name: ['Ingredient name must be unique.'] },
      };
    }

    const ingredient = await prisma.ingredient.create({
      data: {
        name: input.name,
        description: input.description || null,
        unit: input.unit,
        status: input.status,
      },
      include: {
        _count: {
          select: { recipes: true },
        },
      },
    });

    revalidatePath('/menu');
    return { success: true, data: ingredient };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to create ingredient:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating the ingredient.',
    };
  }
}

/**
 * Updates an existing raw ingredient.
 */
export async function updateIngredient(
  id: string,
  data: Record<string, unknown>
): Promise<MenuFormState<IngredientItem>> {
  try {
    await requirePermission(PERMISSIONS.MENU_INGREDIENT_UPDATE);

    const parsed = updateIngredientSchema.safeParse(data);
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

    const existing = await prisma.ingredient.findUnique({
      where: { id },
      include: {
        recipes: { select: { unit: true } },
      },
    });

    if (!existing) {
      return { success: false, error: 'Ingredient not found.' };
    }

    const input = parsed.data;

    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.ingredient.findFirst({
        where: {
          id: { not: id },
          name: { equals: input.name, mode: 'insensitive' },
        },
      });

      if (duplicate) {
        return {
          success: false,
          error: 'An ingredient with this name already exists.',
          fieldErrors: { name: ['Ingredient name must be unique.'] },
        };
      }
    }

    // If unit is changing, verify compatibility with all existing recipe usage
    if (input.unit && input.unit !== existing.unit && existing.recipes.length > 0) {
      const incompatibleRecipe = existing.recipes.find(
        (r) => !areUnitsCompatible(input.unit!, r.unit)
      );
      if (incompatibleRecipe) {
        return {
          success: false,
          error: `Cannot change unit to ${input.unit} because it is incompatible with existing recipe usage (${incompatibleRecipe.unit}).`,
          fieldErrors: {
            unit: [
              `Incompatible unit change: used in ${existing.recipes.length} recipe(s).`,
            ],
          },
        };
      }
    }

    const updated = await prisma.ingredient.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        description:
          input.description !== undefined
            ? input.description || null
            : existing.description,
        unit: input.unit ?? existing.unit,
        status: input.status ?? existing.status,
      },
      include: {
        _count: {
          select: { recipes: true },
        },
      },
    });

    revalidatePath('/menu');
    return { success: true, data: updated };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to update ingredient:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating the ingredient.',
    };
  }
}

/**
 * Toggles ingredient status between ACTIVE and INACTIVE.
 */
export async function toggleIngredientStatus(
  id: string
): Promise<ActionResult<IngredientItem>> {
  try {
    await requirePermission(PERMISSIONS.MENU_INGREDIENT_DEACTIVATE);

    const ingredient = await prisma.ingredient.findUnique({
      where: { id },
      include: {
        _count: { select: { recipes: true } },
      },
    });

    if (!ingredient) {
      return { success: false, error: 'Ingredient not found.' };
    }

    const newStatus =
      ingredient.status === MenuStatus.ACTIVE ? MenuStatus.INACTIVE : MenuStatus.ACTIVE;

    const updated = await prisma.ingredient.update({
      where: { id },
      data: { status: newStatus },
      include: {
        _count: { select: { recipes: true } },
      },
    });

    revalidatePath('/menu');
    return { success: true, data: updated };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to toggle ingredient status:', error);
    return {
      success: false,
      error: 'Failed to update ingredient status. Please try again.',
    };
  }
}
