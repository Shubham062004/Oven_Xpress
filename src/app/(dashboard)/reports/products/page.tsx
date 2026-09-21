import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getProductSalesReportAction } from '@/lib/reports/actions';
import { ProductsReportClient } from '@/components/reports/products-report-client';
import type { DateRangePreset } from '@/lib/reports/types';

export const metadata: Metadata = {
  title: 'Product Sales Report | Oven Xpress',
  description: 'Menu item sales performance, item quantities sold, category breakdown, and item discounts.',
};

interface ProductsReportPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ProductsReportPage({ searchParams }: ProductsReportPageProps) {
  const user = await requireAuthentication('/reports/products');

  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_PRODUCT_READ,
      PERMISSIONS.REPORT_SALES_READ,
      PERMISSIONS.MENU_ITEM_READ,
    ])
  ) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;
  const preset = (resolved.preset as DateRangePreset) || (!resolved.startDate && !resolved.endDate ? 'today' : 'custom');

  const res = await getProductSalesReportAction({
    branchId: resolved.branchId,
    preset,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    categoryId: resolved.categoryId,
    search: resolved.search,
    page,
    limit: 25,
  });

  if (!res.success) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load product sales report</p>
        <p className="text-sm mt-1">{res.error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <ProductsReportClient
        rows={res.data.rows}
        summary={res.data.summary}
        pagination={res.data.pagination}
        branches={res.data.branches}
        categories={res.data.categories}
        selectedBranchId={res.data.selectedBranchId}
        isBranchRestricted={res.data.isBranchRestricted}
        selectedPreset={preset}
        startDate={resolved.startDate}
        endDate={resolved.endDate}
      />
    </div>
  );
}
