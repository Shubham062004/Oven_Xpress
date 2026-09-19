import { z } from 'zod';
import { IngredientUnit, MenuStatus } from '@prisma/client';

// ─── Unit Compatibility & Conversion System ─────────────────────────────────

export const UNIT_FAMILIES = {
  MASS: ['KG', 'GRAM'] as const,
  VOLUME: ['LITRE', 'ML'] as const,
  COUNT: ['PIECE', 'PACK', 'DOZEN'] as const,
};

export const ALL_UNITS = ['KG', 'GRAM', 'LITRE', 'ML', 'PIECE', 'PACK', 'DOZEN'] as const;

export const UNIT_LABELS: Record<IngredientUnit, string> = {
  KG: 'Kilogram (kg)',
  GRAM: 'Gram (g)',
  LITRE: 'Litre (L)',
  ML: 'Millilitre (ml)',
  PIECE: 'Piece (pc)',
  PACK: 'Pack (pk)',
  DOZEN: 'Dozen (dz)',
};

export function getUnitFamily(unit: IngredientUnit | string): 'MASS' | 'VOLUME' | 'COUNT' | null {
  if (UNIT_FAMILIES.MASS.includes(unit as any)) return 'MASS';
  if (UNIT_FAMILIES.VOLUME.includes(unit as any)) return 'VOLUME';
  if (UNIT_FAMILIES.COUNT.includes(unit as any)) return 'COUNT';
  return null;
}

export function areUnitsCompatible(
  baseUnit: IngredientUnit | string,
  recipeUnit: IngredientUnit | string
): boolean {
  const baseFamily = getUnitFamily(baseUnit);
  const recipeFamily = getUnitFamily(recipeUnit);
  return baseFamily !== null && baseFamily === recipeFamily;
}

export function getCompatibleUnits(unit: IngredientUnit | string): IngredientUnit[] {
  const family = getUnitFamily(unit);
  if (family === 'MASS') return [...UNIT_FAMILIES.MASS] as IngredientUnit[];
  if (family === 'VOLUME') return [...UNIT_FAMILIES.VOLUME] as IngredientUnit[];
  if (family === 'COUNT') return [...UNIT_FAMILIES.COUNT] as IngredientUnit[];
  return [unit as IngredientUnit];
}

// ─── Category Validation ────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Category name must be at least 2 characters' })
    .max(50, { message: 'Category name must not exceed 50 characters' }),
  description: z
    .string()
    .trim()
    .max(255, { message: 'Description must not exceed 255 characters' })
    .optional()
    .or(z.literal('')),
  sortOrder: z.coerce
    .number({ message: 'Sort order must be a valid number' })
    .int({ message: 'Sort order must be an integer' })
    .min(0, { message: 'Sort order cannot be negative' })
    .default(0),
  status: z.enum(['ACTIVE', 'INACTIVE'], {
    message: 'Status must be ACTIVE or INACTIVE',
  }).default('ACTIVE'),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ─── Ingredient Validation ──────────────────────────────────────────────────

export const createIngredientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Ingredient name must be at least 2 characters' })
    .max(60, { message: 'Ingredient name must not exceed 60 characters' }),
  description: z
    .string()
    .trim()
    .max(255, { message: 'Description must not exceed 255 characters' })
    .optional()
    .or(z.literal('')),
  unit: z.enum(ALL_UNITS, {
    message: 'Please select a valid measurement unit',
  }),
  status: z.enum(['ACTIVE', 'INACTIVE'], {
    message: 'Status must be ACTIVE or INACTIVE',
  }).default('ACTIVE'),
});

export const updateIngredientSchema = createIngredientSchema.partial();

export type CreateIngredientInput = z.infer<typeof createIngredientSchema>;
export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>;

// ─── Menu Item Validation ───────────────────────────────────────────────────

export const createMenuItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Item name must be at least 2 characters' })
    .max(100, { message: 'Item name must not exceed 100 characters' }),
  description: z
    .string()
    .trim()
    .max(500, { message: 'Description must not exceed 500 characters' })
    .optional()
    .or(z.literal('')),
  categoryId: z
    .string()
    .trim()
    .min(1, { message: 'Please select a category' }),
  price: z.coerce
    .number({ message: 'Price must be a valid number' })
    .positive({ message: 'Price must be greater than zero' })
    .max(99999.99, { message: 'Price must not exceed 99,999.99' }),
  preparationTimeMinutes: z.coerce
    .number({ message: 'Preparation time must be a number' })
    .int({ message: 'Preparation time must be whole minutes' })
    .min(0, { message: 'Preparation time cannot be negative' })
    .max(720, { message: 'Preparation time cannot exceed 12 hours (720 mins)' })
    .default(0),
  imageUrl: z
    .string()
    .trim()
    .max(500, { message: 'Image URL must not exceed 500 characters' })
    .optional()
    .or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE'], {
    message: 'Status must be ACTIVE or INACTIVE',
  }).default('ACTIVE'),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;

// ─── Branch Menu Item Availability Validation ───────────────────────────────

export const updateBranchMenuItemSchema = z.object({
  branchId: z.string().trim().min(1, { message: 'Branch ID is required' }),
  menuItemId: z.string().trim().min(1, { message: 'Menu Item ID is required' }),
  price: z.coerce
    .number({ message: 'Price must be a valid number' })
    .positive({ message: 'Branch price must be greater than zero' })
    .max(99999.99, { message: 'Branch price must not exceed 99,999.99' })
    .nullable()
    .optional(),
  isAvailable: z.boolean(),
});

export const bulkBranchAvailabilitySchema = z.object({
  menuItemId: z.string().trim().min(1, { message: 'Menu Item ID is required' }),
  branches: z.array(
    z.object({
      branchId: z.string().trim().min(1, { message: 'Branch ID is required' }),
      price: z.coerce
        .number({ message: 'Price must be a valid number' })
        .positive({ message: 'Branch price must be greater than zero' })
        .max(99999.99, { message: 'Branch price must not exceed 99,999.99' })
        .nullable()
        .optional(),
      isAvailable: z.boolean(),
    })
  ),
});

export type UpdateBranchMenuItemInput = z.infer<typeof updateBranchMenuItemSchema>;
export type BulkBranchAvailabilityInput = z.infer<typeof bulkBranchAvailabilitySchema>;

// ─── Recipe / BOM Validation ────────────────────────────────────────────────

export const recipeItemIngredientSchema = z.object({
  ingredientId: z.string().trim().min(1, { message: 'Ingredient is required' }),
  quantity: z.coerce
    .number({ message: 'Quantity must be a number' })
    .positive({ message: 'Quantity must be greater than zero' })
    .max(99999.999, { message: 'Quantity must not exceed 99,999.999' }),
  unit: z.enum(ALL_UNITS, {
    message: 'Please select a valid unit',
  }),
  notes: z
    .string()
    .trim()
    .max(200, { message: 'Notes must not exceed 200 characters' })
    .optional()
    .or(z.literal('')),
});

export const saveRecipeSchema = z.object({
  menuItemId: z.string().trim().min(1, { message: 'Menu Item ID is required' }),
  ingredients: z
    .array(recipeItemIngredientSchema)
    .refine(
      (items) => {
        const ids = items.map((i) => i.ingredientId);
        return new Set(ids).size === ids.length;
      },
      {
        message: 'Duplicate ingredients are not allowed in the same recipe.',
      }
    ),
});

export type RecipeItemIngredientInput = z.infer<typeof recipeItemIngredientSchema>;
export type SaveRecipeInput = z.infer<typeof saveRecipeSchema>;

// ─── Filter Validation ──────────────────────────────────────────────────────

export const menuFilterSchema = z.object({
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).or(z.literal('ALL')).optional(),
  branchId: z.string().trim().optional(),
});

export type MenuFilterInput = z.infer<typeof menuFilterSchema>;
