import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/guards';
import { ROLES } from '@/lib/permissions/definitions';
import { getBugReportDetails } from '@/lib/bug-reports/service';
import { OwnerBugReportDetailClient } from '@/components/dashboard/owner-bug-report-detail-client';

export const metadata: Metadata = {
  title: 'Bug Report Details | Oven Xpress',
  description: 'Inspect technical issue details, client diagnostics, and update resolution status.',
};

interface BugReportDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BugReportDetailPage({
  params,
}: BugReportDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const { id } = await params;
  const isOwner = user.role === ROLES.OWNER;
  const report = await getBugReportDetails(id, user);

  if (!report) {
    notFound();
  }

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto py-4">
      <OwnerBugReportDetailClient report={report} isOwner={isOwner} />
    </div>
  );
}
