import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getAuditLogsAction, getAuditFilterOptionsAction } from '@/lib/audit/actions';
import { AuditLogsClient } from '@/components/audit/audit-logs-client';
import type { AuditDatePreset } from '@/lib/audit/audit-types';

export const metadata: Metadata = {
  title: 'Audit Logs & Activity Ledger | Oven Xpress',
  description: 'Tamper-resistant audit trail of administrative, financial, order, and inventory operations.',
};

interface AuditLogsPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const user = await requireAuthentication('/audit-logs');

  if (!hasPermission(user, PERMISSIONS.AUDIT_READ)) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;
  const preset = (resolved.preset as AuditDatePreset) || (!resolved.startDate && !resolved.endDate ? 'today' : 'custom');

  const [logsRes, filterOptsRes] = await Promise.all([
    getAuditLogsAction({
      branchId: resolved.branchId,
      action: resolved.action,
      entityType: resolved.entityType,
      search: resolved.search,
      preset,
      startDate: resolved.startDate,
      endDate: resolved.endDate,
      page,
      limit: 25,
    }),
    getAuditFilterOptionsAction(),
  ]);

  if (!logsRes.success || !logsRes.data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load audit logs</p>
        <p className="text-sm mt-1">{logsRes.error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  const branches = filterOptsRes.data?.branches || [];
  const actionTypes = filterOptsRes.data?.actions || [];
  const entityTypes = filterOptsRes.data?.entityTypes || [];
  const canExport = hasPermission(user, PERMISSIONS.AUDIT_EXPORT);

  // If user only has access to 1 branch, lock branch selection
  const isBranchRestricted = user.role !== 'OWNER' && user.role !== 'ADMIN' && branches.length === 1;
  const selectedBranchId = resolved.branchId || (isBranchRestricted && branches[0] ? branches[0].id : 'all');

  return (
    <div className="p-6 md:p-8">
      <AuditLogsClient
        rows={logsRes.data.logs}
        summary={logsRes.data.summary}
        pagination={logsRes.data.pagination}
        branches={branches}
        actionTypes={actionTypes}
        entityTypes={entityTypes}
        selectedBranchId={selectedBranchId}
        isBranchRestricted={isBranchRestricted}
        selectedPreset={preset}
        startDate={resolved.startDate}
        endDate={resolved.endDate}
        selectedAction={resolved.action || 'all'}
        selectedEntity={resolved.entityType || 'all'}
        currentSearch={resolved.search || ''}
        canExport={canExport}
      />
    </div>
  );
}
