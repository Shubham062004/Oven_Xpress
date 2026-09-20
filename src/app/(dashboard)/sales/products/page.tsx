import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { prisma } from '@/lib/db/prisma';
import {
  getProductSales,
  getCategorySales,
  getReportBranches,
} from '@/lib/reports/actions';
import { getDateRangeFromPreset } from '@/lib/reports/constants';
import { ProductSalesClient } from '@/components/reports/product-sales-client';

export const metadata: Metadata = {
  title: 'Product & Category Sales | Oven Xpress',
  description:
    'Detailed item velocity, historical sales pricing, discount impact, and category revenue share.',
};

interface ProductSalesPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ProductSalesPage({ searchParams }: ProductSalesPageProps) {
  const user = await requirePermission(PERMISSIONS.REPORT_PRODUCT_READ);
  const resolvedParams = await searchParams;

  const isRestrictedBranchUser = user.role === 'MANAGER' || user.role === 'STAFF';
  let userBranchId: string | null = null;

  if (isRestrictedBranchUser) {
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });
    userBranchId = employee?.branchId ?? null;
  }

  const branchId = userBranchId || resolvedParams.branchId || 'all';
  const effectiveBranchId = branchId === 'all' ? undefined : branchId;

  const dateRange =
    resolvedParams.startDate && resolvedParams.endDate
      ? { startDate: resolvedParams.startDate, endDate: resolvedParams.endDate }
      : getDateRangeFromPreset('month');

  const [productsRes, categoriesRes, branchesRes] = await Promise.all([
    getProductSales({ branchId: effectiveBranchId, dateRange }),
    getCategorySales({ branchId: effectiveBranchId, dateRange }),
    getReportBranches(),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <ProductSalesClient
        initialProducts={productsRes.success ? productsRes.data : []}
        initialCategories={categoriesRes.success ? categoriesRes.data : []}
        branches={branchesRes.success ? branchesRes.data : []}
        isBranchRestricted={isRestrictedBranchUser}
        selectedBranchId={branchId}
        initialDateRange={dateRange}
      />
    </div>
  );
}
