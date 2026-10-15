import { prisma } from '@/lib/db/prisma';
import {
  BugReportCategory,
  BugReportStatus,
  NotificationType,
  NotificationSeverity,
} from '@prisma/client';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { saveBugReportScreenshot } from '@/lib/storage/bug-reports';
import { createNotification } from '@/lib/notifications/notification-service';
import { publishBugReport } from '@/lib/realtime/event-bus';
import {
  createBugReportSchema,
  updateBugReportStatusSchema,
  bugReportFilterSchema,
  type CreateBugReportInput,
  type UpdateBugReportStatusInput,
  type BugReportFilterInput,
} from '@/lib/validations/bug-reports';

export interface SubmitBugReportOptions {
  input: CreateBugReportInput;
  screenshotFile?: File | null;
  currentUserId?: string | null;
  clientIp?: string;
}

export interface BugReportItem {
  id: string;
  reportNumber: string;
  title: string;
  description: string;
  category: BugReportCategory;
  status: BugReportStatus;
  userId: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterPhone: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  deviceInfo: any;
  screenshotUrl: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BugReportStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

export interface BugReportListResponse {
  reports: BugReportItem[];
  stats: BugReportStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Generates an idempotent, unique bug report reference number:
 * e.g. BUG-20261014-A8F2
 */
async function generateUniqueReportNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `BUG-${year}${month}${day}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const randomHex = Math.random().toString(16).substring(2, 6).toUpperCase();
    const candidate = `${datePrefix}-${randomHex}`;

    const exists = await prisma.bugReport.findUnique({
      where: { reportNumber: candidate },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }
  }

  // Fallback with timestamp millis
  return `${datePrefix}-${Date.now().toString().slice(-4)}`;
}

/**
 * Submits a new bug report from customer or guest.
 * Includes rate-limiting abuse protection and notifies Owner role ONLY.
 */
export async function createBugReport(
  options: SubmitBugReportOptions
): Promise<{ success: boolean; report?: BugReportItem; error?: string }> {
  const { input, screenshotFile, currentUserId, clientIp = '127.0.0.1' } = options;

  // 1. Rate Limiting: Max 5 bug reports per 15 minutes per IP
  const rateLimitKey = `bug-report:${clientIp}`;
  const rateCheck = checkRateLimit(rateLimitKey, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  });

  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many submissions. Please wait ${rateCheck.retryAfterSeconds} seconds before submitting another bug report.`,
    };
  }

  // 2. Validate input schema
  const parsed = createBugReportSchema.safeParse(input);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((e) => e.message).join(', ');
    return { success: false, error: errorMsg };
  }
  const data = parsed.data;

  // 3. Process optional screenshot file if attached
  let screenshotUrl: string | null = null;
  if (screenshotFile && screenshotFile.size > 0) {
    try {
      const arrayBuffer = await screenshotFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const uploadRes = await saveBugReportScreenshot(
        buffer,
        screenshotFile.type,
        screenshotFile.name
      );
      screenshotUrl = uploadRes.url;
    } catch (err: any) {
      return {
        success: false,
        error: `Screenshot upload failed: ${err.message || 'Invalid image file'}`,
      };
    }
  }

  // 4. Generate unique report reference
  const reportNumber = await generateUniqueReportNumber();

  // 5. Save report to DB
  const created = await prisma.bugReport.create({
    data: {
      reportNumber,
      title: data.title,
      description: data.description,
      category: data.category,
      status: BugReportStatus.OPEN,
      userId: currentUserId || null,
      reporterName: data.reporterName || null,
      reporterEmail: data.reporterEmail || null,
      reporterPhone: data.reporterPhone || null,
      pageUrl: data.pageUrl || null,
      userAgent: data.userAgent || null,
      deviceInfo: data.deviceInfo ?? undefined,
      screenshotUrl,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // 6. Notify OWNER role accounts ONLY
  try {
    const ownerUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        role: {
          name: 'OWNER',
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    for (const owner of ownerUsers) {
      await createNotification({
        recipientUserId: owner.id,
        branchId: null, // System-wide technical issue
        type: NotificationType.BUG_REPORT,
        severity: NotificationSeverity.WARNING,
        title: `Bug Report: ${created.reportNumber}`,
        message: `[${created.category}] ${created.title}`,
        entityType: 'BugReport',
        entityId: created.id,
        actionUrl: `/owner/bug-reports/${created.id}`,
        dedupeKey: `bug-report:${created.id}:${owner.id}`,
      });
    }

    // Emit real-time bug report event strictly to the owner channel
    try {
      publishBugReport({
        reportId: created.id,
        reportNumber: created.reportNumber,
        title: created.title,
        category: created.category,
        createdAt: created.createdAt.toISOString(),
      });
    } catch (realtimeErr) {
      console.error('[Realtime] Failed to emit owner bug report event:', realtimeErr);
    }
  } catch (notifyErr) {
    console.error('[BugReport] Failed to dispatch owner notifications:', notifyErr);
    // Don't fail the user report submission if notification dispatch encountered an error
  }

  return {
    success: true,
    report: mapBugReportToItem(created),
  };
}

/**
 * Retrieves paginated bug reports for the Owner dashboard.
 * Requires caller to be an active OWNER.
 */
export async function getBugReportsForOwner(
  filterInput: Partial<BugReportFilterInput>
): Promise<BugReportListResponse> {
  const filter = bugReportFilterSchema.parse(filterInput);

  const whereClause: any = {};

  if (filter.status && filter.status !== 'ALL') {
    whereClause.status = filter.status;
  }

  if (filter.category && filter.category !== 'ALL') {
    whereClause.category = filter.category;
  }

  if (filter.search && filter.search.trim()) {
    const s = filter.search.trim();
    whereClause.OR = [
      { reportNumber: { contains: s, mode: 'insensitive' } },
      { title: { contains: s, mode: 'insensitive' } },
      { description: { contains: s, mode: 'insensitive' } },
      { reporterName: { contains: s, mode: 'insensitive' } },
      { reporterEmail: { contains: s, mode: 'insensitive' } },
    ];
  }

  const [total, reports, openCount, inProgressCount, resolvedCount, closedCount] =
    await Promise.all([
      prisma.bugReport.count({ where: whereClause }),
      prisma.bugReport.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      prisma.bugReport.count({ where: { status: 'OPEN' } }),
      prisma.bugReport.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.bugReport.count({ where: { status: 'RESOLVED' } }),
      prisma.bugReport.count({ where: { status: 'CLOSED' } }),
    ]);

  const totalAll = openCount + inProgressCount + resolvedCount + closedCount;

  return {
    reports: reports.map(mapBugReportToItem),
    stats: {
      total: totalAll,
      open: openCount,
      inProgress: inProgressCount,
      resolved: resolvedCount,
      closed: closedCount,
    },
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.ceil(total / filter.limit) || 1,
    },
  };
}

/**
 * Retrieves details for a specific bug report.
 * Requires caller to be an active OWNER.
 */
export async function getBugReportDetails(
  idOrReportNumber: string
): Promise<BugReportItem | null> {
  const report = await prisma.bugReport.findFirst({
    where: {
      OR: [{ id: idOrReportNumber }, { reportNumber: idOrReportNumber }],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!report) return null;
  return mapBugReportToItem(report);
}

/**
 * Updates status and resolution notes of a bug report.
 * Requires caller to be an active OWNER.
 */
export async function updateBugReportStatus(
  reportId: string,
  input: UpdateBugReportStatusInput,
  resolvedByUserName: string
): Promise<{ success: boolean; report?: BugReportItem; error?: string }> {
  const parsed = updateBugReportStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((e) => e.message).join(', '),
    };
  }

  const existing = await prisma.bugReport.findUnique({
    where: { id: reportId },
  });

  if (!existing) {
    return { success: false, error: 'Bug report not found' };
  }

  const { status, resolutionNote } = parsed.data;
  const isClosingOrResolving = status === 'RESOLVED' || status === 'CLOSED';

  const updated = await prisma.bugReport.update({
    where: { id: reportId },
    data: {
      status,
      resolutionNote: resolutionNote ?? existing.resolutionNote,
      resolvedBy: isClosingOrResolving ? resolvedByUserName : existing.resolvedBy,
      resolvedAt: isClosingOrResolving ? new Date() : existing.resolvedAt,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return {
    success: true,
    report: mapBugReportToItem(updated),
  };
}

function mapBugReportToItem(report: any): BugReportItem {
  return {
    id: report.id,
    reportNumber: report.reportNumber,
    title: report.title,
    description: report.description,
    category: report.category,
    status: report.status,
    userId: report.userId,
    user: report.user || null,
    reporterName: report.reporterName,
    reporterEmail: report.reporterEmail,
    reporterPhone: report.reporterPhone,
    pageUrl: report.pageUrl,
    userAgent: report.userAgent,
    deviceInfo: report.deviceInfo,
    screenshotUrl: report.screenshotUrl,
    resolvedBy: report.resolvedBy,
    resolvedAt: report.resolvedAt ? report.resolvedAt.toISOString() : null,
    resolutionNote: report.resolutionNote,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}
