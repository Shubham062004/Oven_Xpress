/**
 * Centralized Abuse, Anti-Bot & Multi-Tiered Rate Limiting Protection Service
 *
 * Implements defenses against:
 * 1. Credential stuffing and brute force login attempts (per-email + per-IP).
 * 2. Automated account creation and phantom user flooding.
 * 3. AI generation and LLM endpoint quota drainage.
 * 4. API endpoint abuse and automated data scraping (curl, python, scrapy, headless browsers).
 * 5. Automated bot form submissions via honeypot traps.
 */

import { checkRateLimit, resetRateLimit, type RateLimitResult } from './rate-limit';

export interface AbuseCheckResult {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds: number;
  remaining?: number;
}

// Default honeypot field name embedded in forms
export const HONEYPOT_FIELD_NAME = '_hp_security_check';

// ─────────────────────────────────────────────────────────────────────────────
// 1. LOGIN ABUSE PROTECTION (Dual-Layer: Email + IP)
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginAbuseOptions {
  email: string;
  clientIp?: string;
}

/**
 * Enforces dual-layer sliding window rate limits on authentication:
 * - Layer A: Max 5 failed attempts per 15 minutes per email address.
 * - Layer B: Max 25 failed attempts per 15 minutes per client IP across all emails.
 */
export function checkLoginAbuse(options: LoginAbuseOptions): AbuseCheckResult {
  const cleanEmail = options.email.trim().toLowerCase();
  const clientIp = options.clientIp || 'unknown';

  // 1. Check Per-Email Threshold
  const emailKey = `login-email:${cleanEmail}`;
  const emailLimit = checkRateLimit(emailKey, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  });

  if (!emailLimit.allowed) {
    return {
      allowed: false,
      reason: `Account login throttled. Too many attempts for ${cleanEmail}.`,
      retryAfterSeconds: emailLimit.retryAfterSeconds,
      remaining: 0,
    };
  }

  // 2. Check Per-IP Threshold (Blocks credential stuffing across multiple accounts)
  if (clientIp !== 'unknown') {
    const ipKey = `login-ip:${clientIp}`;
    const ipLimit = checkRateLimit(ipKey, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 25,
    });

    if (!ipLimit.allowed) {
      return {
        allowed: false,
        reason: `IP address throttled due to excessive authentication attempts.`,
        retryAfterSeconds: ipLimit.retryAfterSeconds,
        remaining: 0,
      };
    }
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: emailLimit.remaining,
  };
}

/**
 * Clears the login rate limits upon successful credential verification.
 */
export function resetLoginRateLimit(email: string, clientIp?: string): void {
  const cleanEmail = email.trim().toLowerCase();
  resetRateLimit(`login-email:${cleanEmail}`);
  if (clientIp && clientIp !== 'unknown') {
    resetRateLimit(`login-ip:${clientIp}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ACCOUNT CREATION RATE LIMITING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Limits employee and user account creation to prevent spam and database bloat:
 * - Max 10 account creations per 10-minute window per IP / actor.
 */
export function checkAccountCreationRateLimit(identifier: string): AbuseCheckResult {
  const key = `account-create:${identifier}`;
  const result: RateLimitResult = checkRateLimit(key, {
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 10,
  });

  if (!result.allowed) {
    return {
      allowed: false,
      reason: `Account creation rate limit exceeded. Please wait ${result.retryAfterSeconds} second(s).`,
      retryAfterSeconds: result.retryAfterSeconds,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: result.remaining,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AI GENERATION REQUEST RATE LIMITING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Protects AI generation / LLM endpoints against cost spikes, denial of wallet,
 * and automated prompt spam:
 * - Short window: Max 10 generation requests per minute per user/IP.
 * - Long window: Max 50 generation requests per hour per user/IP.
 */
export function checkAiGenerationRateLimit(identifier: string): AbuseCheckResult {
  // Short-burst limiter: 10 requests / 1 minute
  const minuteKey = `ai-gen-min:${identifier}`;
  const minuteResult = checkRateLimit(minuteKey, {
    windowMs: 60 * 1000,
    maxRequests: 10,
  });

  if (!minuteResult.allowed) {
    return {
      allowed: false,
      reason: `AI generation rate limit exceeded. Burst limit reached. Please wait ${minuteResult.retryAfterSeconds} second(s).`,
      retryAfterSeconds: minuteResult.retryAfterSeconds,
      remaining: 0,
    };
  }

  // Hourly quota: 50 requests / 1 hour
  const hourKey = `ai-gen-hr:${identifier}`;
  const hourResult = checkRateLimit(hourKey, {
    windowMs: 60 * 60 * 1000,
    maxRequests: 50,
  });

  if (!hourResult.allowed) {
    return {
      allowed: false,
      reason: `Hourly AI generation quota exceeded. Please wait ${Math.ceil(hourResult.retryAfterSeconds / 60)} minute(s).`,
      retryAfterSeconds: hourResult.retryAfterSeconds,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: minuteResult.remaining,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. API TIERED ENDPOINT RATE LIMITING
// ─────────────────────────────────────────────────────────────────────────────

export type ApiRateLimitTier = 'standard' | 'sensitive' | 'export';

const TIER_CONFIGS: Record<ApiRateLimitTier, { windowMs: number; maxRequests: number }> = {
  standard: { windowMs: 60 * 1000, maxRequests: 120 }, // 120 reqs / min
  sensitive: { windowMs: 60 * 1000, maxRequests: 30 },  // 30 reqs / min
  export: { windowMs: 60 * 1000, maxRequests: 15 },     // 15 CSV/data exports / min
};

/**
 * Enforces tiered rate limiting on specific API endpoints.
 */
export function checkApiEndpointRateLimit(
  endpoint: string,
  clientIp: string,
  tier: ApiRateLimitTier = 'standard'
): AbuseCheckResult {
  const config = TIER_CONFIGS[tier];
  const key = `api-tier:${tier}:${endpoint}:${clientIp}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    return {
      allowed: false,
      reason: `API endpoint rate limit exceeded for tier [${tier}]. Retry in ${result.retryAfterSeconds}s.`,
      retryAfterSeconds: result.retryAfterSeconds,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: result.remaining,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ANTI-BOT & SCRAPER DETECTION
// ─────────────────────────────────────────────────────────────────────────────

// Regex patterns for automated scraping libraries, CLI tools, and headless engines
const BOT_SCRAPER_PATTERNS = [
  /^curl\//i,
  /^wget\//i,
  /^python-requests/i,
  /^python-urllib/i,
  /^requests\//i,
  /^scrapy/i,
  /^httpx/i,
  /^aiohttp/i,
  /^libwww-perl/i,
  /^guzzlehttp/i,
  /^go-http-client/i,
  /^apache-httpclient/i,
  /headlesschrome/i,
  /phantomjs/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /bytespider/i,
  /gptbot/i,
  /ccbot/i,
  /claudebot/i,
  /semrushbot/i,
  /ahrefsbot/i,
];

/**
 * Evaluates whether a User-Agent matches known scraper, CLI client, or bot signatures.
 */
export function isAutomatedBotOrScraper(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim().length === 0) {
    return true; // Missing User-Agent is a primary indicator of automated scraping
  }

  const trimmed = userAgent.trim();
  for (const pattern of BOT_SCRAPER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. HONEYPOT ANTI-BOT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates whether a form submission triggered a hidden honeypot trap.
 * Bots blindly populate all input elements. Real browser users never see or fill this field.
 *
 * @returns `true` if human (honeypot is empty/valid); `false` if automated bot detected.
 */
export function validateHoneypot(
  formData: FormData,
  fieldName = HONEYPOT_FIELD_NAME
): boolean {
  const value = formData.get(fieldName);
  // Valid only if field is completely absent or empty string
  if (value && typeof value === 'string' && value.trim().length > 0) {
    return false; // Trapped bot
  }
  return true;
}
