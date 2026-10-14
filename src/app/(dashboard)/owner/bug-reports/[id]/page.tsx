import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guards';
import { ROLES } from '@/lib/permissions/definitions';
import { getBugReportDetails } from '@/lib/bug-reports/service';
import { OwnerBugReportDetailClient } from '@/components/dashboard/owner-bug-report-detail-client';

export const metadata: Metadata = {
  title: 'Bug Report Details | Owner Center',
  description: 'Inspect technical issue details, client diagnostics, and update resolution status.',
};

interface BugReportDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BugReportDetailPage({
  params,
}: BugReportDetailPageProps) {
  // Enforce Owner role strictly on the server
  await requireRole(ROLES.OWNER);

  const { id } = await params;
  const report = await getBugReportDetails(id);

  if (!report) {
    notFound();
  }

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto py-4">
      <OwnerBugReportDetailClient report={report} />
    </div>
  );
}
