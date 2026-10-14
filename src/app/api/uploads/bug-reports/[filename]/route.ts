import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/guards';
import { getBugReportScreenshotBuffer } from '@/lib/storage/bug-reports';
import { sanitizeFilename } from '@/lib/security/input-sanitizer';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // Only OWNER role can view bug report screenshots
    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Owner privileges required' },
        { status: 403 }
      );
    }

    const { filename } = await params;
    const cleanFilename = sanitizeFilename(filename);

    const { buffer, mimeType, contentLength } = await getBugReportScreenshotBuffer(cleanFilename);

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(contentLength),
        'Cache-Control': 'private, max-age=3600, no-transform',
      },
    });
  } catch (error) {
    console.error('Bug report screenshot fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Screenshot not found' },
      { status: 404 }
    );
  }
}
