import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth/guards';
import { ROLES } from '@/lib/permissions/definitions';
import { getBugReportsForOwner } from '@/lib/bug-reports/service';
import { OwnerBugReportsClient } from '@/components/dashboard/owner-bug-reports-client';
import type { BugReportCategory, BugReportStatus } from '@prisma/client';

export const metadata: Metadata = {
  title: 'Bug Reports | Owner Executive Center',
  description: 'Technical issue tracking and system error alerts for Oven Xpress.',
};

interface OwnerBugReportsPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function OwnerBugReportsPage({
  searchParams,
}: OwnerBugReportsPageProps) {
  // Enforce Owner role strictly on the server
  await requireRole(ROLES.OWNER);

  const resolvedParams = await searchParams;
  const status = (resolvedParams.status as BugReportStatus) || 'ALL';
  const category = (resolvedParams.category as BugReportCategory) || 'ALL';
  const search = resolvedParams.search || undefined;
  const page = parseInt(resolvedParams.page || '1', 10);

  const data = await getBugReportsForOwner({
    status: status as any,
    category: category as any,
    search,
    page,
    limit: 15,
  });

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto space-y-6">
      <OwnerBugReportsClient initialData={data} />
    </div>
  );
}
