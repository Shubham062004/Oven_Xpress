import { NextRequest, NextResponse } from 'next/server';
import { getAvatarBuffer } from '@/lib/storage/avatars';
import { sanitizeFilename } from '@/lib/security/input-sanitizer';

interface RouteContext {
  params: Promise<{ filename: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { filename: rawFilename } = await context.params;
  const cleanFilename = sanitizeFilename(rawFilename);

  try {
    const avatar = await getAvatarBuffer(cleanFilename);

    return new NextResponse(avatar.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': avatar.mimeType,
        'Content-Length': String(avatar.contentLength),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const statusCode = (error as unknown as { statusCode?: number })?.statusCode || 500;
    if (statusCode === 404) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to retrieve avatar' }, { status: 500 });
  }
}
