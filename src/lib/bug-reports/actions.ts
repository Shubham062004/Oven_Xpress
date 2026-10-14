'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/guards';
import { ROLES } from '@/lib/permissions/definitions';
import {
  createBugReport,
  getBugReportsForOwner,
  getBugReportDetails,
  updateBugReportStatus,
  type BugReportItem,
  type BugReportListResponse,
} from './service';
import type {
  BugReportCategory,
  CreateBugReportInput,
  UpdateBugReportStatusInput,
  BugReportFilterInput,
} from '@/lib/validations/bug-reports';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  reportNumber?: string;
}

/**
 * Server action to submit a customer bug report.
 * Supports both guest and authenticated customers.
 * Accepts FormData with optional screenshot attachment.
 */
export async function submitBugReportAction(
  formData: FormData
): Promise<ActionResponse<BugReportItem>> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get('x-forwarded-for');
    const clientIp = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : headerList.get('x-real-ip') || '127.0.0.1';

    const userAgent = headerList.get('user-agent') || undefined;

    // Optional logged in user
    const user = await getCurrentUser();

    const title = (formData.get('title') as string) || '';
    const description = (formData.get('description') as string) || '';
    const category = (formData.get('category') as BugReportCategory) || 'OTHER';
    const reporterName =
      (formData.get('reporterName') as string) || (user?.name ?? undefined);
    const reporterEmail =
      (formData.get('reporterEmail') as string) || (user?.email ?? undefined);
    const reporterPhone = (formData.get('reporterPhone') as string) || undefined;
    const pageUrl = (formData.get('pageUrl') as string) || undefined;

    let deviceInfo: any = undefined;
    const rawDeviceInfo = formData.get('deviceInfo');
    if (rawDeviceInfo && typeof rawDeviceInfo === 'string') {
      try {
        deviceInfo = JSON.parse(rawDeviceInfo);
      } catch {
        // Ignore JSON parse errors for deviceInfo
      }
    }

    const screenshotFile = formData.get('screenshot') as File | null;

    const input: CreateBugReportInput = {
      title,
      description,
      category,
      reporterName: reporterName || undefined,
      reporterEmail: reporterEmail || undefined,
      reporterPhone: reporterPhone || undefined,
      pageUrl: pageUrl || undefined,
      userAgent: userAgent || undefined,
      deviceInfo,
    };

    const res = await createBugReport({
      input,
      screenshotFile: screenshotFile && screenshotFile.size > 0 ? screenshotFile : null,
      currentUserId: user?.id || null,
      clientIp,
    });

    if (!res.success) {
      return { success: false, error: res.error };
    }

    return {
      success: true,
      data: res.report,
      reportNumber: res.report?.reportNumber,
    };
  } catch (error: any) {
    console.error('[BugReportAction] submit error:', error);
    return {
      success: false,
      error: error?.message || 'Failed to submit bug report. Please try again.',
    };
  }
}

/**
 * Server action: Retrieve bug reports for Owner only.
 */
export async function getOwnerBugReportsAction(
  filterInput?: Partial<BugReportFilterInput>
): Promise<ActionResponse<BugReportListResponse>> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== ROLES.OWNER) {
      return {
        success: false,
        error: 'Forbidden: Only the restaurant Owner can access system bug reports.',
      };
    }

    const data = await getBugReportsForOwner(filterInput || {});
    return { success: true, data };
  } catch (error: any) {
    console.error('[BugReportAction] fetch error:', error);
    return { success: false, error: error?.message || 'Failed to load bug reports.' };
  }
}

/**
 * Server action: Retrieve details for a single bug report (Owner only).
 */
export async function getBugReportDetailsAction(
  id: string
): Promise<ActionResponse<BugReportItem>> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== ROLES.OWNER) {
      return {
        success: false,
        error: 'Forbidden: Only the restaurant Owner can view bug report details.',
      };
    }

    const report = await getBugReportDetails(id);
    if (!report) {
      return { success: false, error: 'Bug report not found.' };
    }

    return { success: true, data: report };
  } catch (error: any) {
    console.error('[BugReportAction] detail fetch error:', error);
    return { success: false, error: error?.message || 'Failed to load report.' };
  }
}

/**
 * Server action: Update bug report status (Owner only).
 */
export async function updateBugReportStatusAction(
  id: string,
  input: UpdateBugReportStatusInput
): Promise<ActionResponse<BugReportItem>> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== ROLES.OWNER) {
      return {
        success: false,
        error: 'Forbidden: Only the restaurant Owner can update bug report statuses.',
      };
    }

    const res = await updateBugReportStatus(
      id,
      input,
      user.name || user.email || 'Owner'
    );

    if (!res.success) {
      return { success: false, error: res.error };
    }

    revalidatePath('/owner/bug-reports');
    revalidatePath(`/owner/bug-reports/${id}`);
    revalidatePath('/notifications');

    return { success: true, data: res.report };
  } catch (error: any) {
    console.error('[BugReportAction] update status error:', error);
    return { success: false, error: error?.message || 'Failed to update status.' };
  }
}
