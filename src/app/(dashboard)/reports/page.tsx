import type { Metadata } from 'next';
import { requireAuthentication } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { ReportHubClient } from '@/components/reports/report-hub-client';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Reports & Analytics Hub | Oven Xpress',
  description: 'Centralized operational, sales, inventory, and business performance reports.',
};

export default async function ReportsPage() {
  const user = await requireAuthentication('/reports');

  const isOwner = user.role === 'OWNER';

  // Check if the user has any report viewing capability
  const reportPermissions = [
    PERMISSIONS.REPORT_SALES_READ,
    PERMISSIONS.REPORT_ORDERS_READ,
    PERMISSIONS.REPORT_PRODUCT_READ,
    PERMISSIONS.REPORT_BRANCH_READ,
    PERMISSIONS.REPORT_PAYMENT_READ,
    PERMISSIONS.REPORT_EXPENSE_READ,
    PERMISSIONS.REPORT_INVENTORY_READ,
    PERMISSIONS.REPORT_PURCHASE_READ,
    PERMISSIONS.REPORT_WASTAGE_READ,
    PERMISSIONS.REPORT_ATTENDANCE_READ,
    PERMISSIONS.REPORT_COMPENSATION_READ,
    PERMISSIONS.REPORT_CUSTOMER_READ,
    PERMISSIONS.REPORT_REVIEW_READ,
    PERMISSIONS.REPORT_FINANCE_READ,
    // Or base module fallback permissions
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.EXPENSE_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.CUSTOMER_READ,
  ];

  const hasAnyAccess = isOwner || reportPermissions.some((p) => user.permissions.includes(p));

  if (!hasAnyAccess) {
    redirect('/unauthorized');
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      <ReportHubClient
        userPermissions={user.permissions}
        isOwner={isOwner}
      />
    </div>
  );
}
