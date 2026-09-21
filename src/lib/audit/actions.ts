'use server';

/**
 * Server Actions for Audit Logs
 *
 * Provides secured mutations/queries for:
 * - Querying paginated audit records
 * - Fetching deep event detail by ID
 * - Exporting audit logs to CSV
 * - Populating dynamic filter options (branches, actors)
 *
 * Note: Under Step 19 append-only rules, NO update/delete actions are defined.
 */

import { getCurrentUser } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { prisma } from '@/lib/db/prisma';
import { getAuthorizedBranchScope } from '@/lib/reports/report-service';
import { toCSV } from '@/lib/reports/constants';
import {
  AuditFilterParams,
  AuditLogListItem,
  AuditPaginationMeta,
  AuditSummaryStats,
  AuditLogDetail,
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
} from './audit-types';
import { getAuditLogs, getAuditLogById } from './audit-service';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch paginated audit logs for the current authorized user.
 */
export async function getAuditLogsAction(params: AuditFilterParams): Promise<
  ActionResult<{
    logs: AuditLogListItem[];
    pagination: AuditPaginationMeta;
    summary: AuditSummaryStats;
  }>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized. Please sign in.' };
    }

    if (!hasPermission(user, PERMISSIONS.AUDIT_READ)) {
      return { success: false, error: 'Access denied: Requires audit.read permission.' };
    }

    const result = await getAuditLogs(params, user);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error in getAuditLogsAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve audit logs.',
    };
  }
}

/**
 * Fetch a single audit log event by ID with branch validation and field diff.
 */
export async function getAuditLogByIdAction(
  id: string
): Promise<ActionResult<AuditLogDetail>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized. Please sign in.' };
    }

    if (!hasPermission(user, PERMISSIONS.AUDIT_READ)) {
      return { success: false, error: 'Access denied: Requires audit.read permission.' };
    }

    const log = await getAuditLogById(id, user);
    if (!log) {
      return { success: false, error: 'Audit log record not found.' };
    }

    return { success: true, data: log };
  } catch (error) {
    console.error('Error in getAuditLogByIdAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve audit log details.',
    };
  }
}

/**
 * Export audit logs to RFC-4180 compliant CSV.
 * Requires `audit.export` permission.
 */
export async function exportAuditLogsCSVAction(
  params: AuditFilterParams
): Promise<ActionResult<{ csv: string; filename: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized. Please sign in.' };
    }

    if (!hasPermission(user, PERMISSIONS.AUDIT_EXPORT)) {
      return { success: false, error: 'Access denied: Requires audit.export permission.' };
    }

    // Limit export to max 2000 rows for performance
    const exportParams = {
      ...params,
      page: 1,
      limit: 2000,
    };

    const { logs } = await getAuditLogs(exportParams, user);

    const columns: { key: keyof AuditLogListItem; header: string }[] = [
      { key: 'createdAt', header: 'Timestamp' },
      { key: 'action', header: 'Action' },
      { key: 'entityType', header: 'Entity Type' },
      { key: 'entityId', header: 'Entity ID' },
      { key: 'description', header: 'Description' },
      { key: 'branchName', header: 'Branch Name' },
      { key: 'branchCode', header: 'Branch Code' },
      { key: 'actorName', header: 'Actor Name' },
      { key: 'actorEmail', header: 'Actor Email' },
      { key: 'actorRole', header: 'Actor Role' },
      { key: 'ipAddress', header: 'IP Address' },
    ];

    const csvData = toCSV(logs, columns);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `audit_logs_${dateStr}.csv`;

    return {
      success: true,
      data: { csv: csvData, filename },
    };
  } catch (error) {
    console.error('Error in exportAuditLogsCSVAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export audit logs.',
    };
  }
}

/**
 * Retrieves dynamic filter options (accessible branches, active actors, available actions/entities).
 */
export async function getAuditFilterOptionsAction(): Promise<
  ActionResult<{
    branches: Array<{ id: string; name: string; code: string }>;
    actors: Array<{ id: string; name: string; email: string }>;
    actions: string[];
    entityTypes: string[];
  }>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized.' };
    }

    const scope = await getAuthorizedBranchScope(user);

    // Branches
    let branches: Array<{ id: string; name: string; code: string }> = [];
    if (scope.isAllBranches) {
      branches = await prisma.branch.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      });
    } else if (scope.branchIds.length > 0) {
      branches = await prisma.branch.findMany({
        where: { id: { in: scope.branchIds }, status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      });
    }

    // Actors who have generated audit logs
    const activeActorIds = await prisma.auditLog.findMany({
      distinct: ['actorUserId'],
      where: {
        actorUserId: { not: null },
        ...(scope.isAllBranches ? {} : { branchId: { in: scope.branchIds } }),
      },
      select: { actorUserId: true },
      take: 100,
    });

    const actorIds = activeActorIds
      .map((a: { actorUserId: string | null }) => a.actorUserId)
      .filter(Boolean) as string[];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      data: {
        branches,
        actors,
        actions: Object.values(AUDIT_ACTIONS),
        entityTypes: Object.values(AUDIT_ENTITY_TYPES),
      },
    };
  } catch (error) {
    console.error('Error fetching audit filter options:', error);
    return { success: false, error: 'Failed to fetch filter options.' };
  }
}
