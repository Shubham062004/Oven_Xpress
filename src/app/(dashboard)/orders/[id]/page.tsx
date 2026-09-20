import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getOrderById } from '@/lib/orders/actions';
import { OrderDetailClient } from '@/components/orders/order-detail-client';

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: OrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const res = await getOrderById(id);

  if (!res.success || !res.data) {
    return { title: 'Order Not Found | Oven Xpress' };
  }

  return {
    title: `${res.data.orderNumber} - Order Details | Oven Xpress`,
    description: `Details, items, and status tracking for ${res.data.orderNumber}.`,
  };
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  await requirePermission(PERMISSIONS.ORDER_READ);

  const { id } = await params;
  const res = await getOrderById(id);

  if (!res.success || !res.data) {
    notFound();
  }

  return <OrderDetailClient initialOrder={res.data} />;
}
