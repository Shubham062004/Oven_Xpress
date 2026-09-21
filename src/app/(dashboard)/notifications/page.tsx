import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { prisma } from '@/lib/db/prisma';
import { getUserBranchScope } from '@/lib/notifications/recipient-resolver';
import { evaluateAlerts } from '@/lib/notifications/alert-service';
import { getNotifications } from '@/lib/notifications/notification-service';
import { NotificationCenterClient } from '@/components/notifications/notification-center-client';

export const metadata: Metadata = {
  title: 'Notifications & Alerts | Oven Xpress',
  description: 'Operational alerts, low stock warnings, pending approvals, and system notifications.',
};

interface NotificationsPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const user = await requirePermission(PERMISSIONS.NOTIFICATION_READ);
  const scope = await getUserBranchScope(user.id);
  const resolvedParams = await searchParams;

  const branchIdParam = resolvedParams.branchId;
  let effectiveBranchId: string | undefined = undefined;

  if (!scope.isAllBranches) {
    effectiveBranchId = scope.branchIds[0];
  } else if (branchIdParam && branchIdParam !== 'all') {
    effectiveBranchId = branchIdParam;
  }

  // Idempotently evaluate alerts for the active branch scope so the user sees fresh operational status
  await evaluateAlerts({ branchId: effectiveBranchId });

  // Fetch branches if user has global branch access
  let branches: Array<{ id: string; name: string; code: string }> = [];
  if (scope.isAllBranches) {
    branches = await prisma.branch.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  // Fetch initial notifications
  const initialData = await getNotifications(user.id, {
    branchId: effectiveBranchId,
    page: 1,
    limit: 20,
    isDismissed: false,
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <NotificationCenterClient
        initialData={initialData}
        branches={branches}
        canFilterBranches={scope.isAllBranches}
        selectedBranchId={effectiveBranchId || 'all'}
      />
    </div>
  );
}
