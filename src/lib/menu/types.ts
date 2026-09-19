import type { MenuStatus, IngredientUnit } from '@prisma/client';
import type { ActionResult } from '@/lib/auth/types';

// ─── Entity Interfaces ──────────────────────────────────────────────────────

export interface CategoryItem {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  status: MenuStatus;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    items: number;
  };
}

export interface IngredientItem {
  id: string;
  name: string;
  description: string | null;
  unit: IngredientUnit;
  status: MenuStatus;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    recipes: number;
  };
}

export interface BranchMenuItemItem {
  id: string;
  branchId: string;
  menuItemId: string;
  price: number | null;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
  branch: {
    id: string;
    name: string;
    code: string;
    city: string;
  };
}

export interface RecipeIngredientItem {
  id: string;
  menuItemId: string;
  ingredientId: string;
  quantity: number;
  unit: IngredientUnit;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  ingredient: {
    id: string;
    name: string;
    unit: IngredientUnit;
    status: MenuStatus;
  };
}

export interface MenuItemListItem {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  price: number;
  preparationTimeMinutes: number;
  imageUrl: string | null;
  status: MenuStatus;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
  };
  recipeConfigured: boolean;
  ingredientCount: number;
  availableBranchCount: number;
  totalBranchesConfigured: number;
}

export interface MenuItemDetailItem {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  price: number;
  preparationTimeMinutes: number;
  imageUrl: string | null;
  status: MenuStatus;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
  };
  branchAvailability: BranchMenuItemItem[];
  recipeIngredients: RecipeIngredientItem[];
}

// ─── Summary / KPI Stats ────────────────────────────────────────────────────

export interface MenuSummaryStats {
  totalItems: number;
  activeItems: number;
  totalCategories: number;
  totalIngredients: number;
  itemsWithRecipe: number;
  recipePercentage: number;
  totalBranches: number;
}

// ─── Action Result Form States ──────────────────────────────────────────────

export interface MenuFormState<T = unknown> extends ActionResult<T> {
  fieldErrors?: Record<string, string[]>;
}

// ─── Filter Parameters ──────────────────────────────────────────────────────

export interface MenuItemListParams {
  search?: string;
  categoryId?: string;
  status?: MenuStatus | 'ALL';
  branchId?: string;
}

export interface CategoryListParams {
  search?: string;
  status?: MenuStatus | 'ALL';
}

export interface IngredientListParams {
  search?: string;
  unit?: IngredientUnit | 'ALL';
  status?: MenuStatus | 'ALL';
}
