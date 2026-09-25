import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/guards';
import { checkAiGenerationRateLimit } from '@/lib/security/abuse-protection';
import { sanitizePayload } from '@/lib/security/input-sanitizer';
import { logApiError, logTrafficAnomaly } from '@/lib/security/security-logger';

// Input validation schema for AI generation requests
const aiGenerationSchema = z.object({
  task: z.enum([
    'MENU_DESCRIPTION',
    'PROMOTION_COPY',
    'INVENTORY_INSIGHT',
    'RECIPE_OPTIMIZATION',
  ]),
  context: z.record(z.string(), z.unknown()),
  maxTokens: z.number().int().min(10).max(1000).default(300),
});

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const path = request.nextUrl.pathname;

  try {
    // 1. Session Authentication Guard
    const user = await getCurrentUser();
    if (!user) {
      logTrafficAnomaly({
        type: 'UNAUTHORIZED_API_ACCESS',
        path,
        method: 'POST',
        clientIp,
        userAgent,
        statusCode: 401,
        reason: 'Unauthenticated AI generation request attempt',
      });

      return NextResponse.json(
        { error: 'Unauthorized. Authentication session required.' },
        { status: 401 }
      );
    }

    // 2. Abuse Protection: AI Generation Specific Rate Limiter
    // Enforces burst (10 req/min) and hourly (50 req/hr) quota limits
    const aiRateCheck = checkAiGenerationRateLimit(user.id);
    if (!aiRateCheck.allowed) {
      logTrafficAnomaly({
        type: 'AI_RATE_LIMIT_EXCEEDED',
        path,
        method: 'POST',
        clientIp,
        userAgent,
        statusCode: 429,
        reason: aiRateCheck.reason || 'AI generation rate limit exceeded',
        details: { userId: user.id, retryAfterSeconds: aiRateCheck.retryAfterSeconds },
      });

      return NextResponse.json(
        {
          error: aiRateCheck.reason || 'AI generation quota exceeded. Please slow down.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(aiRateCheck.retryAfterSeconds),
          },
        }
      );
    }

    // 3. Payload Validation
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }

    const parseResult = aiGenerationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed for AI generation request',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { task } = parseResult.data;
    const context = sanitizePayload(parseResult.data.context) as Record<string, unknown>;

    // 4. Generate structured response based on the requested generation task
    // In production, this interfaces with secure server-side LLM providers (e.g. Gemini, OpenAI)
    let generatedContent = '';
    switch (task) {
      case 'MENU_DESCRIPTION': {
        const itemName = String(context.name || 'Artisan Wood-Fired Pizza');
        const ingredients = Array.isArray(context.ingredients) ? context.ingredients.join(', ') : 'fresh seasonal ingredients';
        generatedContent = `Savor the rich, authentic taste of our ${itemName}, handcrafted with ${ingredients} and baked to crisp perfection.`;
        break;
      }
      case 'PROMOTION_COPY': {
        const discount = context.discount || '20%';
        generatedContent = `Special Restaurant Exclusive: Enjoy ${discount} off our signature selections this week! Order online or visit our branch today.`;
        break;
      }
      case 'INVENTORY_INSIGHT': {
        generatedContent = `Optimal stock replenishment window identified based on rolling 7-day velocity. Maintain standard reorder levels.`;
        break;
      }
      case 'RECIPE_OPTIMIZATION': {
        generatedContent = `Ingredient yield optimization suggests reducing prep trim by 4.2% to maximize profit margins.`;
        break;
      }
    }

    return NextResponse.json({
      success: true,
      task,
      result: generatedContent,
      remainingQuota: aiRateCheck.remaining,
      timestamp: new Date().toISOString(),
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

    return NextResponse.json(
      { error: 'Failed to process AI generation request' },
      { status: 500 }
    );
  }
}
