import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/guards';
import { ROLES } from '@/lib/permissions/definitions';
import { createBugReport, getBugReportsForOwner } from '@/lib/bug-reports/service';
import type { BugReportCategory } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || undefined;

    const user = await getCurrentUser();

    let title = '';
    let description = '';
    let category: BugReportCategory = 'OTHER';
    let reporterName: string | undefined = user?.name || undefined;
    let reporterEmail: string | undefined = user?.email || undefined;
    let reporterPhone: string | undefined = undefined;
    let pageUrl: string | undefined = undefined;
    let deviceInfo: any = undefined;
    let screenshotFile: File | null = null;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      title = (formData.get('title') as string) || '';
      description = (formData.get('description') as string) || '';
      category = (formData.get('category') as BugReportCategory) || 'OTHER';
      reporterName = (formData.get('reporterName') as string) || reporterName;
      reporterEmail = (formData.get('reporterEmail') as string) || reporterEmail;
      reporterPhone = (formData.get('reporterPhone') as string) || undefined;
      pageUrl = (formData.get('pageUrl') as string) || undefined;

      const rawDeviceInfo = formData.get('deviceInfo');
      if (rawDeviceInfo && typeof rawDeviceInfo === 'string') {
        try {
          deviceInfo = JSON.parse(rawDeviceInfo);
        } catch {
          // ignore
        }
      }

      screenshotFile = formData.get('screenshot') as File | null;
    } else {
      const body = await request.json();
      title = body.title || '';
      description = body.description || '';
      category = body.category || 'OTHER';
      reporterName = body.reporterName || reporterName;
      reporterEmail = body.reporterEmail || reporterEmail;
      reporterPhone = body.reporterPhone || undefined;
      pageUrl = body.pageUrl || undefined;
      deviceInfo = body.deviceInfo || undefined;
    }

    const res = await createBugReport({
      input: {
        title,
        description,
        category,
        reporterName,
        reporterEmail,
        reporterPhone,
        pageUrl,
        userAgent,
        deviceInfo,
      },
      screenshotFile: screenshotFile && screenshotFile.size > 0 ? screenshotFile : null,
      currentUserId: user?.id || null,
      clientIp,
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        reportNumber: res.report?.reportNumber,
        data: res.report,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('API /api/bug-reports POST error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // Only OWNER role can view bug reports
    if (user.role !== ROLES.OWNER) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Owner role required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
    const category = searchParams.get('category') || 'ALL';
    const search = searchParams.get('search') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const data = await getBugReportsForOwner({
      status: status as any,
      category: category as any,
      search,
      page,
      limit,
    });

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: any) {
    console.error('API /api/bug-reports GET error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
