import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getCategories } from '@/lib/menu/category-actions';
import { getIngredients } from '@/lib/menu/ingredient-actions';
import { getMenuItems, getMenuSummaryStats } from '@/lib/menu/item-actions';
import { getBranches } from '@/lib/branches/actions';
import { MenuManagementClient } from '@/components/menu/menu-management-client';

export const metadata: Metadata = {
  title: 'Menu & Recipes',
  description: 'Manage restaurant menu catalog, ingredient recipes (BOM), and branch pricing.',
};

export default async function MenuPage() {
  await requirePermission(PERMISSIONS.MENU_ITEM_READ);

  const [
    categoriesRes,
    ingredientsRes,
    itemsRes,
    statsRes,
    branchesRes,
  ] = await Promise.all([
    getCategories(),
    getIngredients(),
    getMenuItems(),
    getMenuSummaryStats(),
    getBranches({ status: 'ACTIVE' }),
  ]);

  const categories = categoriesRes.success ? (categoriesRes.data ?? []) : [];
  const ingredients = ingredientsRes.success ? (ingredientsRes.data ?? []) : [];
  const items = itemsRes.success ? (itemsRes.data ?? []) : [];
  const stats = statsRes.success
    ? (statsRes.data ?? {
        totalItems: 0,
        activeItems: 0,
        totalCategories: 0,
        totalIngredients: 0,
        itemsWithRecipe: 0,
        recipePercentage: 0,
        totalBranches: 0,
      })
    : {
        totalItems: 0,
        activeItems: 0,
        totalCategories: 0,
        totalIngredients: 0,
        itemsWithRecipe: 0,
        recipePercentage: 0,
        totalBranches: 0,
      };

  const branches = (branchesRes.success && branchesRes.data
    ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, code: b.code }))
    : []);

  return (
    <MenuManagementClient
      initialCategories={categories}
      initialIngredients={ingredients}
      initialItems={items}
      initialStats={stats}
      branches={branches}
    />
  );
}
