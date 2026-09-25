import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { saveReceiptBuffer, validateReceiptFile } from '@/lib/storage/receipts';
import { logApiError, logTrafficAnomaly } from '@/lib/security/security-logger';

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const path = request.nextUrl.pathname;

  try {
    // 1. Authenticate user without redirect
    const user = await getCurrentUser();
    if (!user) {
      logTrafficAnomaly({
        type: 'UNAUTHORIZED_API_ACCESS',
        path,
        method: 'POST',
        clientIp,
        userAgent,
        statusCode: 401,
        reason: 'Unauthenticated POST attempt to receipt upload API',
      });

      return NextResponse.json(
        { error: 'Unauthorized. Authentication session required.' },
        { status: 401 }
      );
    }

    // 2. Authorize user (must have permission to record expenses or purchases)
    const canUpload = hasAnyPermission(user, [
      PERMISSIONS.EXPENSE_CREATE,
      PERMISSIONS.EXPENSE_UPDATE,
      PERMISSIONS.PURCHASE_CREATE,
      PERMISSIONS.PURCHASE_UPDATE,
    ]);

    if (!canUpload) {
      logTrafficAnomaly({
        type: 'FORBIDDEN_RESOURCE_ACCESS',
        path,
        method: 'POST',
        clientIp,
        userAgent,
        statusCode: 403,
        reason: `User ${user.id} (${user.role}) lacks required permissions to upload receipts`,
      });

      return NextResponse.json(
        { error: 'Forbidden. Insufficient permissions to upload receipts.' },
        { status: 403 }
      );
    }

    // 3. Rate limiting: 20 uploads per minute per user
    const rateLimit = checkRateLimit(`upload:${user.id}`, {
      windowMs: 60 * 1000,
      maxRequests: 20,
    });

    if (!rateLimit.allowed) {
      logTrafficAnomaly({
        type: 'RATE_LIMIT_EXCEEDED',
        path,
        method: 'POST',
        clientIp,
        userAgent,
        statusCode: 429,
        reason: `User ${user.id} exceeded receipt upload rate limit (retryAfter: ${rateLimit.retryAfterSeconds}s)`,
      });

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

    // 4. Validate payload
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      logApiError({
        path,
        method: 'POST',
        statusCode: 400,
        error: 'Missing or invalid file payload in multipart form data',
        clientIp,
        userAgent,
        userId: user.id,
      });

      return NextResponse.json(
        { error: 'No file provided or invalid file payload' },
        { status: 400 }
      );
    }

    const validation = validateReceiptFile(file.type, file.size, file.name);
    if (!validation.valid) {
      logApiError({
        path,
        method: 'POST',
        statusCode: 400,
        error: `Receipt validation rejected: ${validation.error}`,
        clientIp,
        userAgent,
        userId: user.id,
        details: { filename: file.name, mimeType: file.type, sizeBytes: file.size },
      });

      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await saveReceiptBuffer(buffer, file.type, file.name);

    return NextResponse.json({
      success: true,
      url: result.url,
      filename: result.filename,
      size: file.size,
      type: file.type,
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

    const message = error instanceof Error ? error.message : 'File upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/uploads/receipt?file=[filename]
 *
 * Query-parameter fallback that redirects to the authenticated streaming endpoint.
 */
export async function GET(request: NextRequest) {
  const fileParam =
    request.nextUrl.searchParams.get('file') ||
    request.nextUrl.searchParams.get('filename');

  if (!fileParam) {
    return NextResponse.json(
      { error: 'Missing file query parameter' },
      { status: 400 }
    );
  }

  const clean = fileParam.trim().replace(/^\/+/, '').split('/').pop() || '';
  return NextResponse.redirect(new URL(`/api/uploads/receipt/${encodeURIComponent(clean)}`, request.url));
}
