import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getPurchaseById } from '@/lib/purchases/actions';
import { PurchaseDetailClient } from '@/components/purchases/purchase-detail-client';

interface PurchaseDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PurchaseDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const res = await getPurchaseById(id);

  if (!res.success || !res.data) {
    return { title: 'Purchase Order Not Found' };
  }

  return {
    title: `${res.data.purchaseNumber} - Purchase Order Details`,
    description: `Purchase order ${res.data.purchaseNumber} from ${res.data.supplier.name} for ${res.data.branch.name}.`,
  };
}

export default async function PurchaseDetailPage({ params }: PurchaseDetailPageProps) {
  await requirePermission(PERMISSIONS.PURCHASE_READ);

  const { id } = await params;
  const res = await getPurchaseById(id);

  if (!res.success || !res.data) {
    notFound();
  }

  return <PurchaseDetailClient purchase={res.data} />;
}
