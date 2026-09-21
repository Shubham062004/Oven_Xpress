/**
 * Audit Logs Sanitizer & Diff Calculator
 *
 * Implements recursive credential sanitization and structured field-level diffing.
 * Ensures zero passwords, tokens, API keys, card credentials, or session secrets
 * are ever stored or exposed in audit trails.
 */

import { FieldChangeDiff } from './audit-types';

/** Regex matching sensitive keys that must be redacted or omitted */
const SENSITIVE_KEY_PATTERN =
  /^(password|passwordhash|password_hash|token|refreshtoken|refresh_token|accesstoken|access_token|secret|sessionsecret|session_secret|apikey|api_key|stripe_secret|stripesecret|cvv|cvc|cardnumber|card_number|creditcard|credit_card|credential|credentials|otp|authsecret|auth_secret|privatekey|private_key|database_url|databaseurl)$/i;

/** Substring match for broader safety */
const SENSITIVE_SUBSTRING_PATTERN =
  /(password|passwd|secret|token|credential|bearer|session_token|auth_token|cvv|cvc|card_num|cardnum|credit_card|creditcard|otp|pincode|pin_code|database_url|private_key)/i;

/** Redaction placeholder */
export const REDACTED_VALUE = '[REDACTED]';

/** Maximum recursion depth to prevent stack overflows on circular or deep structures */
const MAX_DEPTH = 6;

/** Maximum string length preserved in audit metadata to prevent payload bloat */
const MAX_STRING_LENGTH = 1000;

/**
 * Checks if a key name represents sensitive information.
 */
export function isSensitiveKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const cleanKey = key.trim().toLowerCase();
  if (SENSITIVE_KEY_PATTERN.test(cleanKey)) return true;
  return SENSITIVE_SUBSTRING_PATTERN.test(cleanKey);
}

/**
 * Checks if a string value appears to be a secret token, connection string, or bearer header.
 */
function isSensitiveStringValue(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const lower = val.toLowerCase();
  if (lower.startsWith('bearer ') || lower.startsWith('basic ')) return true;
  if (lower.startsWith('postgres://') || lower.startsWith('postgresql://') || lower.startsWith('mysql://')) return true;
  if (lower.startsWith('sk_test_') || lower.startsWith('sk_live_')) return true;
  return false;
}

/**
 * Recursively sanitizes any object, array, or primitive before storing in AuditLog.
 * - Redacts/omits sensitive keys
 * - Masks sensitive string patterns
 * - Caps string lengths
 * - Prevents circular references
 */
export function sanitizeAuditData<T = unknown>(data: T, depth = 0, seen = new WeakSet()): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (depth > MAX_DEPTH) {
    return '[TRUNCATED_DEPTH]' as unknown as T;
  }

  // Primitive types
  if (typeof data === 'string') {
    if (isSensitiveStringValue(data)) {
      return REDACTED_VALUE as unknown as T;
    }
    if (data.length > MAX_STRING_LENGTH) {
      return `${data.slice(0, MAX_STRING_LENGTH)}... [TRUNCATED]` as unknown as T;
    }
    return data;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (typeof data === 'bigint') {
    return Number(data) as unknown as T;
  }

  if (data instanceof Date) {
    return data.toISOString() as unknown as T;
  }

  if (typeof data === 'function' || typeof data === 'symbol') {
    return undefined as unknown as T;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item, depth + 1, seen)) as unknown as T;
  }

  // Handle objects
  if (typeof data === 'object') {
    if (seen.has(data as object)) {
      return '[CIRCULAR]' as unknown as T;
    }
    seen.add(data as object);

    const sanitizedObj: Record<string, unknown> = {};
    const entries = Object.entries(data as Record<string, unknown>);

    for (const [key, value] of entries) {
      if (isSensitiveKey(key)) {
        // Redact or omit sensitive fields
        sanitizedObj[key] = REDACTED_VALUE;
        continue;
      }

      // Skip internal framework properties or Prisma metadata if any
      if (key.startsWith('__') || key.startsWith('$')) {
        continue;
      }

      sanitizedObj[key] = sanitizeAuditData(value, depth + 1, seen);
    }

    return sanitizedObj as unknown as T;
  }

  return data;
}

/**
 * Determines whether two values are deeply equivalent for diffing purposes.
 */
function areValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return a === b;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Calculates a structured field-level diff between beforeData and afterData.
 * Omits unchanged fields and guarantees all output values are sanitized.
 *
 * Example Output:
 * {
 *   "price": { "from": 250, "to": 275 },
 *   "status": { "from": "ACTIVE", "to": "INACTIVE" }
 * }
 */
export function calculateFieldDiff(
  beforeData?: Record<string, unknown> | null,
  afterData?: Record<string, unknown> | null
): FieldChangeDiff {
  const diff: FieldChangeDiff = {};

  if (!beforeData && !afterData) {
    return diff;
  }

  const cleanBefore = (beforeData && typeof beforeData === 'object' ? beforeData : {}) as Record<string, unknown>;
  const cleanAfter = (afterData && typeof afterData === 'object' ? afterData : {}) as Record<string, unknown>;

  // Combine unique keys from both objects
  const allKeys = Array.from(new Set([...Object.keys(cleanBefore), ...Object.keys(cleanAfter)]));

  for (const key of allKeys) {
    // Ignore internal keys
    if (key.startsWith('__') || key.startsWith('$') || key === 'updatedAt') {
      continue;
    }

    // Check if sensitive
    if (isSensitiveKey(key)) {
      if (!areValuesEqual(cleanBefore[key], cleanAfter[key])) {
        diff[key] = {
          from: cleanBefore[key] !== undefined ? REDACTED_VALUE : undefined,
          to: cleanAfter[key] !== undefined ? REDACTED_VALUE : undefined,
        };
      }
      continue;
    }

    const valBefore = cleanBefore[key];
    const valAfter = cleanAfter[key];

    if (!areValuesEqual(valBefore, valAfter)) {
      diff[key] = {
        from: valBefore !== undefined ? sanitizeAuditData(valBefore) : undefined,
        to: valAfter !== undefined ? sanitizeAuditData(valAfter) : undefined,
      };
    }
  }

  return diff;
}
