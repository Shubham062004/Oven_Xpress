import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getCustomerDetail } from '@/lib/customers/actions';
import { getBranches } from '@/lib/branches/actions';
import { CustomerDetailClient } from '@/components/customers/customer-detail-client';

export const metadata: Metadata = {
  title: 'Customer Profile & Order History | Oven Xpress',
  description: 'Detailed customer profile, historical order totals, review ratings, and complaints.',
};

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const resolvedParams = await params;
  const customerId = resolvedParams.id;

  const [detailRes, branchesRes] = await Promise.all([
    getCustomerDetail(customerId),
    getBranches({ status: 'ACTIVE' }),
  ]);

  if (!detailRes.success || !detailRes.data) {
    notFound();
  }

  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name }))
      : [];

  return <CustomerDetailClient data={detailRes.data} branches={branches} />;
}
