/**
 * Centralized Audit Service
 *
 * Provides transactional audit log creation, server-side branch isolation,
 * search & filter capabilities, before/after diff calculation, and pagination.
 *
 * Immutability Guarantee:
 * - Append-only: Only `createAuditLog` and read queries (`getAuditLogs`, `getAuditLogById`) exist.
 * - No update or delete methods exist in this service or repository.
 */

import { headers } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type { AuthUser } from '@/lib/auth/types';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getAuthorizedBranchScope } from '@/lib/reports/report-service';
import {
  parseDateRange,
  getDateRangeFromPreset,
  formatDateLocal,
} from '@/lib/reports/constants';
import type { DateRangePreset } from '@/lib/reports/types';
import {
  CreateAuditLogInput,
  AuditFilterParams,
  AuditPaginationMeta,
  AuditLogListItem,
  AuditLogDetail,
  AuditSummaryStats,
} from './audit-types';
import { sanitizeAuditData, calculateFieldDiff } from './audit-sanitizer';

/**
 * Safely extracts client IP and User-Agent from incoming Next.js request headers.
 * Does not throw when called outside an HTTP request context (e.g., background scripts).
 */
export async function getClientContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get('x-forwarded-for');
    const ipAddress = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : headerList.get('x-real-ip') || null;
    const userAgent = headerList.get('user-agent') || null;
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Creates an immutable audit log record.
 * Supports passing an existing Prisma transaction client (`tx`) for atomic mutations.
 * All before/after/metadata payloads are recursively sanitized prior to persistence.
 */
export async function createAuditLog(
  input: CreateAuditLogInput,
  tx?: Prisma.TransactionClient
) {
  // If IP/User-Agent wasn't explicitly supplied, attempt to resolve from request context
  let resolvedIp = input.ipAddress ?? null;
  let resolvedUa = input.userAgent ?? null;

  if (!resolvedIp || !resolvedUa) {
    const context = await getClientContext();
    if (!resolvedIp) resolvedIp = context.ipAddress;
    if (!resolvedUa) resolvedUa = context.userAgent;
  }

  // Ensure all data objects are deeply sanitized
  const sanitizedBefore = input.beforeData
    ? (sanitizeAuditData(input.beforeData) as Prisma.InputJsonValue)
    : Prisma.JsonNull;
  const sanitizedAfter = input.afterData
    ? (sanitizeAuditData(input.afterData) as Prisma.InputJsonValue)
    : Prisma.JsonNull;
  const sanitizedMeta = input.metadata
    ? (sanitizeAuditData(input.metadata) as Prisma.InputJsonValue)
    : Prisma.JsonNull;

  const data: Prisma.AuditLogCreateInput = {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    description: input.description.trim(),
    beforeData: sanitizedBefore,
    afterData: sanitizedAfter,
    metadata: sanitizedMeta,
    ipAddress: resolvedIp,
    userAgent: resolvedUa,
    ...(input.actorUserId ? { actorUser: { connect: { id: input.actorUserId } } } : {}),
    ...(input.branchId ? { branch: { connect: { id: input.branchId } } } : {}),
  };

  const client = tx || prisma;
  return await client.auditLog.create({
    data,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      description: true,
      createdAt: true,
      branchId: true,
      actorUserId: true,
    },
  });
}

/**
 * Retrieves paginated audit logs scoped strictly to the user's authorized branch access.
 */
export async function getAuditLogs(
  params: AuditFilterParams,
  user: AuthUser
): Promise<{
  logs: AuditLogListItem[];
  pagination: AuditPaginationMeta;
  summary: AuditSummaryStats;
}> {
  if (!hasPermission(user, PERMISSIONS.AUDIT_READ)) {
    throw new Error('Unauthorized: You do not have permission to view audit logs.');
  }

  const scope = await getAuthorizedBranchScope(user);

  // Construct Prisma Where Input
  const where: Prisma.AuditLogWhereInput = {};

  // Branch Isolation
  if (!scope.isAllBranches) {
    if (scope.branchIds.length === 0) {
      // User has no assigned branch
      return {
        logs: [],
        pagination: { page: 1, limit: params.limit || 25, total: 0, totalPages: 0 },
        summary: { totalLogs: 0, uniqueActors: 0, uniqueBranches: 0, topAction: 'N/A' },
      };
    }
    const userBranchId = scope.branchIds[0];
    if (params.branchId && params.branchId !== 'all' && params.branchId !== userBranchId) {
      throw new Error('Unauthorized: You cannot access audit logs from another branch.');
    }
    where.branchId = userBranchId;
  } else {
    // Owner or Admin
    if (params.branchId && params.branchId !== 'all') {
      where.branchId = params.branchId;
    }
  }

  // Date Range Filtering
  let startDateTime: Date | undefined;
  let endDateTime: Date | undefined;

  if (params.preset && params.preset !== 'custom') {
    const range = getDateRangeFromPreset(params.preset as DateRangePreset);
    const parsed = parseDateRange(range);
    startDateTime = parsed.startDateTime;
    endDateTime = parsed.endDateTime;
  } else if (params.startDate && params.endDate) {
    const parsed = parseDateRange({
      startDate: params.startDate,
      endDate: params.endDate,
    });
    startDateTime = parsed.startDateTime;
    endDateTime = parsed.endDateTime;
  } else {
    // Default: Past 30 days
    const now = new Date();
    const past = new Date(now);
    past.setDate(past.getDate() - 30);
    const parsed = parseDateRange({
      startDate: formatDateLocal(past),
      endDate: formatDateLocal(now),
    });
    startDateTime = parsed.startDateTime;
    endDateTime = parsed.endDateTime;
  }

  if (startDateTime && endDateTime) {
    // Max boundary protection: 366 days
    const diffDays = Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 366) {
      throw new Error('Date range cannot exceed 366 days');
    }
    where.createdAt = {
      gte: startDateTime,
      lte: endDateTime,
    };
  }

  // Action Filter
  if (params.action && params.action !== 'all') {
    where.action = params.action;
  }

  // Entity Type Filter
  if (params.entityType && params.entityType !== 'all') {
    where.entityType = params.entityType;
  }

  // Actor User Filter
  if (params.actorUserId && params.actorUserId !== 'all') {
    where.actorUserId = params.actorUserId;
  }

  // Search filter (Description, entityId, or actor name)
  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    where.OR = [
      { description: { contains: term, mode: 'insensitive' } },
      { entityId: { contains: term, mode: 'insensitive' } },
      { action: { contains: term, mode: 'insensitive' } },
      { entityType: { contains: term, mode: 'insensitive' } },
      { actorUser: { name: { contains: term, mode: 'insensitive' } } },
    ];
  }

  // Pagination parameters
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
  const skip = (page - 1) * limit;

  // Execute database query with transaction or parallel count
  const [total, rawLogs, groupActions, groupActors, groupBranches] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        actorUser: {
          select: { id: true, name: true, email: true, role: { select: { name: true } } },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 1,
    }),
    prisma.auditLog.groupBy({
      by: ['actorUserId'],
      where: { ...where, actorUserId: { not: null } },
    }),
    prisma.auditLog.groupBy({
      by: ['branchId'],
      where: { ...where, branchId: { not: null } },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  const logs: AuditLogListItem[] = rawLogs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    description: log.description,
    branchId: log.branchId,
    branchName: log.branch?.name ?? null,
    branchCode: log.branch?.code ?? null,
    actorUserId: log.actorUserId,
    actorName: log.actorUser?.name ?? null,
    actorEmail: log.actorUser?.email ?? null,
    actorRole: log.actorUser?.role?.name ?? null,
    ipAddress: log.ipAddress,
  }));

  const summary: AuditSummaryStats = {
    totalLogs: total,
    uniqueActors: groupActors.length,
    uniqueBranches: groupBranches.length,
    topAction: groupActions[0]?.action ?? 'N/A',
  };

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    summary,
  };
}

/**
 * Retrieves a single audit log entry by ID with branch authorization verification
 * and calculated before/after field diffs.
 */
export async function getAuditLogById(
  id: string,
  user: AuthUser
): Promise<AuditLogDetail | null> {
  if (!hasPermission(user, PERMISSIONS.AUDIT_READ)) {
    throw new Error('Unauthorized: You do not have permission to view audit logs.');
  }

  const log = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      actorUser: {
        select: { id: true, name: true, email: true, role: { select: { name: true } } },
      },
      branch: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  if (!log) {
    return null;
  }

  // Branch Isolation Verification
  const scope = await getAuthorizedBranchScope(user);
  if (!scope.isAllBranches) {
    if (log.branchId && !scope.branchIds.includes(log.branchId)) {
      throw new Error('Unauthorized: You cannot view audit logs from another branch.');
    }
  }

  const beforeData = (log.beforeData as Record<string, unknown> | null) ?? null;
  const afterData = (log.afterData as Record<string, unknown> | null) ?? null;
  const metadata = (log.metadata as Record<string, unknown> | null) ?? null;

  // Calculate structured field changes
  const diff = calculateFieldDiff(beforeData, afterData);

  return {
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    description: log.description,
    branchId: log.branchId,
    branchName: log.branch?.name ?? null,
    branchCode: log.branch?.code ?? null,
    actorUserId: log.actorUserId,
    actorName: log.actorUser?.name ?? null,
    actorEmail: log.actorUser?.email ?? null,
    actorRole: log.actorUser?.role?.name ?? null,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    beforeData,
    afterData,
    metadata,
    diff,
  };
}
