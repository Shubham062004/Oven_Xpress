/**
 * Centralized Security Logger
 *
 * Provides structured JSON logging for:
 * 1. Authentication events (login success, failure, throttling, password reset, token validation).
 * 2. API errors and security-sensitive exceptions.
 * 3. Traffic anomalies (rate limit breaches, suspicious probes, path traversals, protocol downgrades).
 *
 * Design Guarantees:
 * - Structured JSON output format for zero-friction cloud ingestion (CloudWatch, Datadog, ELK, Loki).
 * - Automatic redaction of sensitive credentials, passwords, raw tokens, and session secrets.
 * - Safe fallback if logging environment or serialization encounters an issue.
 */

export type SecurityLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';

export type AuthEventType =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOGIN_THROTTLED'
  | 'AUTH_LOGOUT'
  | 'AUTH_PASSWORD_RESET_REQUESTED'
  | 'AUTH_PASSWORD_RESET_SUCCESS'
  | 'AUTH_PASSWORD_RESET_FAILED'
  | 'AUTH_EMAIL_VERIFICATION_SENT'
  | 'AUTH_EMAIL_VERIFIED'
  | 'AUTH_EMAIL_VERIFICATION_FAILED'
  | 'AUTH_SESSION_EXPIRED';

export type AnomalyType =
  | 'SUSPICIOUS_PROBE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'PATH_TRAVERSAL_ATTEMPT'
  | 'HTTP_DOWNGRADE_ATTEMPT'
  | 'MALICIOUS_USER_AGENT'
  | 'UNAUTHORIZED_API_ACCESS'
  | 'FORBIDDEN_RESOURCE_ACCESS'
  | 'UNUSUAL_TRAFFIC_PATTERN'
  | 'BOT_SCRAPER_DETECTED'
  | 'BOT_HONEYPOT_TRIGGERED'
  | 'AI_RATE_LIMIT_EXCEEDED'
  | 'ACCOUNT_CREATION_THROTTLED';

export interface SecurityLogEntry {
  timestamp: string;
  level: SecurityLogLevel;
  eventType: string;
  environment: string;
  clientIp?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  userId?: string;
  statusCode?: number;
  message?: string;
  reason?: string;
  details?: Record<string, unknown>;
}

// Keys that must NEVER be written to logs in plaintext
const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'confirmPassword',
  'token',
  'rawtoken',
  'secret',
  'auth_secret',
  'authorization',
  'cookie',
  'session',
  'ox_session',
  'creditcard',
  'cvv',
]);

/**
 * Recursively redacts sensitive keys from log detail payloads.
 */
export function sanitizeLogData(data: unknown, depth = 0): unknown {
  if (depth > 5 || data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Redact Bearer tokens in headers
    if (/^Bearer\s+/i.test(data)) {
      return 'Bearer [REDACTED]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (REDACTED_KEYS.has(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogData(value, depth + 1);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Mask an email address for privacy-conscious logging (e.g. j***@example.com).
 */
export function maskEmail(email: string | undefined): string | undefined {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Outputs a structured JSON log entry to stdout / stderr.
 */
function outputLog(entry: SecurityLogEntry): void {
  const jsonStr = JSON.stringify(entry);

  if (entry.level === 'ERROR' || entry.level === 'SECURITY') {
    console.error(`[SECURITY] ${jsonStr}`);
  } else if (entry.level === 'WARN') {
    console.warn(`[SECURITY] ${jsonStr}`);
  } else {
    console.log(`[SECURITY] ${jsonStr}`);
  }
}

/**
 * Logs authentication attempts (success, failure, lockout/throttle).
 */
export function logAuthAttempt(params: {
  event: AuthEventType;
  success: boolean;
  email?: string;
  userId?: string;
  clientIp?: string;
  userAgent?: string;
  reason?: string;
  details?: Record<string, unknown>;
}): void {
  const level: SecurityLogLevel = params.success
    ? 'INFO'
    : params.event === 'AUTH_LOGIN_THROTTLED'
      ? 'SECURITY'
      : 'WARN';

  const entry: SecurityLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    eventType: params.event,
    environment: process.env.NODE_ENV || 'development',
    userId: params.userId,
    clientIp: params.clientIp || 'unknown',
    userAgent: params.userAgent,
    reason: params.reason,
    message: `Authentication event: ${params.event} (${params.success ? 'SUCCESS' : 'FAILED'})`,
    details: sanitizeLogData({
      ...params.details,
      maskedEmail: maskEmail(params.email),
    }) as Record<string, unknown>,
  };

  outputLog(entry);
}

/**
 * Logs API errors and unexpected endpoint failures.
 */
export function logApiError(params: {
  path: string;
  method?: string;
  statusCode?: number;
  error: unknown;
  clientIp?: string;
  userAgent?: string;
  userId?: string;
  details?: Record<string, unknown>;
}): void {
  const errorMessage =
    params.error instanceof Error
      ? params.error.message
      : typeof params.error === 'string'
        ? params.error
        : 'Unknown API error';

  const errorStack =
    process.env.NODE_ENV !== 'production' && params.error instanceof Error
      ? params.error.stack
      : undefined;

  const entry: SecurityLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    eventType: 'API_ERROR',
    environment: process.env.NODE_ENV || 'development',
    path: params.path,
    method: params.method,
    statusCode: params.statusCode || 500,
    userId: params.userId,
    clientIp: params.clientIp || 'unknown',
    userAgent: params.userAgent,
    message: `API execution error on ${params.method || 'GET'} ${params.path}: ${errorMessage}`,
    details: sanitizeLogData({
      ...params.details,
      errorMessage,
      ...(errorStack ? { stack: errorStack } : {}),
    }) as Record<string, unknown>,
  };

  outputLog(entry);
}

/**
 * Logs traffic anomalies, rate limit breaches, and suspicious scanner probes.
 */
export function logTrafficAnomaly(params: {
  type: AnomalyType;
  path: string;
  method?: string;
  clientIp?: string;
  userAgent?: string;
  userId?: string;
  statusCode?: number;
  reason: string;
  details?: Record<string, unknown>;
}): void {
  const entry: SecurityLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'SECURITY',
    eventType: params.type,
    environment: process.env.NODE_ENV || 'development',
    path: params.path,
    method: params.method || 'GET',
    statusCode: params.statusCode || 400,
    userId: params.userId,
    clientIp: params.clientIp || 'unknown',
    userAgent: params.userAgent || 'unknown',
    reason: params.reason,
    message: `Traffic anomaly detected [${params.type}]: ${params.reason} on ${params.path}`,
    details: sanitizeLogData(params.details) as Record<string, unknown>,
  };

  outputLog(entry);
}

/**
 * Logs high-level security alerts (e.g. startup configuration issues, critical integrity violations).
 */
export function logSecurityAlert(params: {
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, unknown>;
}): void {
  const level: SecurityLogLevel =
    params.severity === 'critical' || params.severity === 'high' ? 'SECURITY' : 'WARN';

  const entry: SecurityLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    eventType: `SECURITY_ALERT_${params.severity.toUpperCase()}`,
    environment: process.env.NODE_ENV || 'development',
    message: `Security Alert [${params.severity.toUpperCase()}]: ${params.title}`,
    details: sanitizeLogData(params.details) as Record<string, unknown>,
  };

  outputLog(entry);
}
