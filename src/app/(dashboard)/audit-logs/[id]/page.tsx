import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getAuditLogByIdAction } from '@/lib/audit/actions';
import { AuditLogDetailClient } from '@/components/audit/audit-log-detail-client';

export const metadata: Metadata = {
  title: 'Audit Record Detail | Oven Xpress',
  description: 'Detailed inspection of system audit activity record.',
};

interface AuditLogDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AuditLogDetailPage({ params }: AuditLogDetailPageProps) {
  const user = await requireAuthentication('/audit-logs');

  if (!hasPermission(user, PERMISSIONS.AUDIT_READ)) {
    redirect('/unauthorized');
  }

  const { id } = await params;
  const res = await getAuditLogByIdAction(id);

  if (!res.success || !res.data) {
    notFound();
  }

  return (
    <div className="p-6 md:p-8">
      <AuditLogDetailClient log={res.data} />
    </div>
  );
}
