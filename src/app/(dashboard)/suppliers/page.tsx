import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getSuppliers, getSupplierStats } from '@/lib/suppliers/actions';
import { SupplierListClient } from '@/components/suppliers/supplier-list-client';

export const metadata: Metadata = {
  title: 'Suppliers Directory',
  description: 'Manage master vendor profiles, contact details, and procurement history.',
};

export default async function SuppliersPage() {
  await requirePermission(PERMISSIONS.SUPPLIER_READ);

  const [suppliersRes, statsRes] = await Promise.all([
    getSuppliers(),
    getSupplierStats(),
  ]);

  const suppliers = suppliersRes.success && suppliersRes.data ? suppliersRes.data : [];
  const stats =
    statsRes.success && statsRes.data
      ? statsRes.data
      : {
          totalSuppliers: 0,
          activeSuppliers: 0,
          inactiveSuppliers: 0,
          totalOrdersCount: 0,
        };

  return <SupplierListClient initialSuppliers={suppliers} initialStats={stats} />;
}
