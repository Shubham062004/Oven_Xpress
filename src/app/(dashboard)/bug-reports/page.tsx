import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/guards';
import { ROLES } from '@/lib/permissions/definitions';
import { getBugReports } from '@/lib/bug-reports/service';
import { OwnerBugReportsClient } from '@/components/dashboard/owner-bug-reports-client';
import type { BugReportCategory, BugReportStatus } from '@prisma/client';

export const metadata: Metadata = {
  title: 'Bug Reports | Oven Xpress',
  description: 'Technical issue tracking and system error alerts for Oven Xpress.',
};

interface BugReportsPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function BugReportsPage({
  searchParams,
}: BugReportsPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?callbackUrl=/bug-reports');
  }

  const isOwner = user.role === ROLES.OWNER;
  const resolvedParams = await searchParams;
  const status = (resolvedParams.status as BugReportStatus) || 'ALL';
  const category = (resolvedParams.category as BugReportCategory) || 'ALL';
  const search = resolvedParams.search || undefined;
  const page = parseInt(resolvedParams.page || '1', 10);

  // If user is not an OWNER, strictly scope queries to their own submissions
  const data = await getBugReports({
    userId: isOwner ? undefined : user.id,
    status,
    category,
    search,
    page,
    limit: 15,
  });

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto space-y-6">
      <OwnerBugReportsClient initialData={data} isOwner={isOwner} />
    </div>
  );
}
