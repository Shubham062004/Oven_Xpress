import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { saveAvatarBuffer, validateAvatarFile } from '@/lib/storage/avatars';
import { logApiError, logTrafficAnomaly } from '@/lib/security/security-logger';

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const path = request.nextUrl.pathname;

  try {
    const user = await getCurrentUser();
    if (!user) {
      logTrafficAnomaly({
        type: 'UNAUTHORIZED_API_ACCESS',
        path,
        method: 'POST',
        clientIp,
        userAgent,
        statusCode: 401,
        reason: 'Unauthenticated POST attempt to avatar upload API',
      });

      return NextResponse.json(
        {
          success: false,
          code: 'AUTH_SESSION_EXPIRED',
          error: 'Your session has expired. Please log in again.',
          message: 'Your session has expired. Please log in again.',
        },
        { status: 401 }
      );
    }

    // Rate limiting: 10 avatar uploads per 5 minutes per user
    const rateLimit = checkRateLimit(`upload:avatar:${user.id}`, {
      windowMs: 5 * 60 * 1000,
      maxRequests: 10,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Upload rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds} second(s).`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No image file provided or invalid file payload' },
        { status: 400 }
      );
    }

    const validation = validateAvatarFile(file.type, file.size, file.name);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await saveAvatarBuffer(buffer, file.type, user.id, file.name);

    return NextResponse.json({
      success: true,
      url: result.url,
      filename: result.filename,
    });
  } catch (error) {
    logApiError({
      path,
      method: 'POST',
      statusCode: 500,
      error,
      clientIp,
      userAgent,
    });

    const message = error instanceof Error ? error.message : 'Avatar upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
