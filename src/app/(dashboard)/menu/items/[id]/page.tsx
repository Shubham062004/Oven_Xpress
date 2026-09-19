import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getMenuItemById } from '@/lib/menu/item-actions';
import { getCategories } from '@/lib/menu/category-actions';
import { getIngredients } from '@/lib/menu/ingredient-actions';
import { MenuItemDetailClient } from '@/components/menu/menu-item-detail-client';

interface MenuItemDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MenuItemDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getMenuItemById(id);

  if (!result.success || !result.data) {
    return { title: 'Item Not Found | Oven Xpress' };
  }

  return {
    title: `${result.data.name} | Menu Details`,
    description: `Recipe Bill of Materials and branch availability for ${result.data.name}`,
  };
}

export default async function MenuItemDetailPage({
  params,
}: MenuItemDetailPageProps) {
  await requirePermission(PERMISSIONS.MENU_ITEM_READ);

  const { id } = await params;
  const [itemRes, categoriesRes, ingredientsRes] = await Promise.all([
    getMenuItemById(id),
    getCategories({ status: 'ACTIVE' }),
    getIngredients({ status: 'ACTIVE' }),
  ]);

  if (!itemRes.success || !itemRes.data) {
    notFound();
  }

  const categories = categoriesRes.success ? (categoriesRes.data ?? []) : [];
  const ingredients = ingredientsRes.success ? (ingredientsRes.data ?? []) : [];

  return (
    <MenuItemDetailClient
      item={itemRes.data}
      categories={categories}
      availableIngredients={ingredients}
    />
  );
}
