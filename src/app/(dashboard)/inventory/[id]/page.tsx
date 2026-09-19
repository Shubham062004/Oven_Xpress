import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getInventoryItemDetail } from '@/lib/inventory/actions';
import { getBranches } from '@/lib/branches/actions';
import { getIngredients } from '@/lib/menu/ingredient-actions';
import { InventoryItemDetailClient } from '@/components/inventory/inventory-item-detail-client';

interface InventoryItemPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: InventoryItemPageProps): Promise<Metadata> {
  const { id } = await params;
  const res = await getInventoryItemDetail(id);

  if (!res.success || !res.data) {
    return { title: 'Inventory Item Not Found' };
  }

  return {
    title: `${res.data.ingredientName} (${res.data.branchName}) - Inventory`,
    description: `Stock tracking, ledger history, and replenishment controls for ${res.data.ingredientName}.`,
  };
}

export default async function InventoryItemPage({ params }: InventoryItemPageProps) {
  await requirePermission(PERMISSIONS.INVENTORY_READ);

  const { id } = await params;

  const [itemRes, branchesRes, ingredientsRes] = await Promise.all([
    getInventoryItemDetail(id),
    getBranches({ status: 'ACTIVE' }),
    getIngredients({ status: 'ACTIVE' }),
  ]);

  if (!itemRes.success || !itemRes.data) {
    notFound();
  }

  const branches = branchesRes.success && branchesRes.data
    ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, code: b.code }))
    : [];

  const ingredients = ingredientsRes.success && ingredientsRes.data
    ? ingredientsRes.data.map((i) => ({ id: i.id, name: i.name, unit: i.unit }))
    : [];

  return (
    <InventoryItemDetailClient
      item={itemRes.data}
      branches={branches}
      ingredients={ingredients}
    />
  );
}
