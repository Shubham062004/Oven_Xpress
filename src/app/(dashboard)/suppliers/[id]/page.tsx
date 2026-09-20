import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getSupplierById } from '@/lib/suppliers/actions';
import { SupplierDetailClient } from '@/components/suppliers/supplier-detail-client';

interface SupplierDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: SupplierDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const res = await getSupplierById(id);

  if (!res.success || !res.data) {
    return { title: 'Supplier Not Found' };
  }

  return {
    title: `${res.data.name} - Supplier Profile`,
    description: `Contact information and purchase order history for ${res.data.name}.`,
  };
}

export default async function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  await requirePermission(PERMISSIONS.SUPPLIER_READ);

  const { id } = await params;
  const res = await getSupplierById(id);

  if (!res.success || !res.data) {
    notFound();
  }

  return <SupplierDetailClient supplier={res.data} />;
}
