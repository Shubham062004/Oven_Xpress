/**
 * Centralized Input Sanitization & Injection Defense Library
 *
 * Implements defenses against:
 * 1. Script Injection & Cross-Site Scripting (XSS / HTML injection).
 * 2. CSV Formula / Command Injection (CWE-1236 in exports).
 * 3. Path Traversal & Unsafe File Upload manipulation.
 * 4. Query Parameter & Search Injection.
 */

// Characters that trigger dynamic spreadsheet formula execution
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r', '|', '%']);

// Dangerous HTML tags that should never exist in raw text inputs
const DANGEROUS_HTML_TAGS = /<\s*\/?\s*(script|iframe|object|embed|applet|svg|link|style|meta|base|form|input|button)\b[^>]*>/gi;

// Event handler attributes (e.g. onload=, onerror=, onclick=)
const EVENT_HANDLER_ATTRIBUTES = /\s*on[a-z]+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi;

// JavaScript pseudoprotocol URI schemes (e.g. javascript:, vbscript:, data:text/html)
const DANGEROUS_PROTOCOLS = /(javascript|vbscript|data\s*:\s*text\/html)\s*:/gi;

/**
 * Sanitizes generic user text (e.g. names, notes, addresses, comments).
 * - Strips dangerous executable HTML tags.
 * - Strips inline event handlers (`onerror=`, `onload=`).
 * - Disarms javascript: pseudoprotocols.
 * - Encodes `<` and `>` into HTML entities.
 * - Strips control characters (ASCII 0-31, excluding \n, \r, \t).
 */
export function sanitizeText(input: unknown): string {
  if (input === null || input === undefined) {
    return '';
  }

  const str = String(input);
  if (str.length === 0) {
    return '';
  }

  // 1. Remove dangerous executable tags
  let cleaned = str.replace(DANGEROUS_HTML_TAGS, '');

  // 2. Remove inline event handlers (e.g. <img src=x onerror=alert(1)>)
  cleaned = cleaned.replace(EVENT_HANDLER_ATTRIBUTES, '');

  // 3. Disarm script protocols
  cleaned = cleaned.replace(DANGEROUS_PROTOCOLS, 'disarmed:');

  // 4. Strip non-printable control characters (except space, tab, newline, carriage return)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 5. HTML-encode remaining angle brackets to neutralize HTML parsing
  cleaned = cleaned
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return cleaned.trim();
}

/**
 * Sanitizes a CSV cell to prevent CSV Formula / Command Injection (CWE-1236).
 * Spreadsheet tools (Excel, LibreOffice, Google Sheets) execute formulas if a cell
 * starts with =, +, -, @, \t, or |. Prepending a single quote (') disables formula execution.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // If cell starts with formula trigger characters, neutralize it with a single quote prefix
  if (str.length > 0 && FORMULA_TRIGGERS.has(str[0])) {
    str = `'${str}`;
  }

  // Standard CSV escaping: wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Sanitizes an uploaded file's original name.
 * - Strips directory traversal sequences (../, ..\)
 * - Strips null bytes (\0)
 * - Restricts to safe alphanumeric characters, hyphens, underscores, dots, and spaces.
 * - Caps maximum length at 100 characters.
 */
export function sanitizeFilename(originalFilename: unknown): string {
  if (!originalFilename || typeof originalFilename !== 'string') {
    return 'unnamed_file';
  }

  // Strip null bytes
  let clean = originalFilename.replace(/\0/g, '');

  // Strip path traversal and slashes
  clean = clean.replace(/\\/g, '/');
  clean = clean.split('/').pop() || 'unnamed_file';

  // Remove any remaining traversal tokens
  clean = clean.replace(/\.{2,}/g, '.');

  // Remove non-whitelisted characters
  clean = clean.replace(/[^a-zA-Z0-9._\- ]/g, '_').trim();

  if (clean.length === 0 || clean === '.') {
    return 'unnamed_file';
  }

  // Ensure length does not exceed 100 characters while preserving extension
  if (clean.length > 100) {
    const lastDot = clean.lastIndexOf('.');
    if (lastDot > 0) {
      const ext = clean.substring(lastDot);
      clean = clean.substring(0, 100 - ext.length) + ext;
    } else {
      clean = clean.substring(0, 100);
    }
  }

  return clean;
}

/**
 * Sanitizes and bounds query parameters (search strings, filters).
 * - Trims and limits length to avoid Regex Denial of Service (ReDoS).
 * - Strips non-printable control characters.
 */
export function sanitizeSearchQuery(query: unknown, maxLength = 100): string {
  if (!query || typeof query !== 'string') {
    return '';
  }

  let cleaned = query.trim().slice(0, maxLength);
  cleaned = cleaned.replace(DANGEROUS_HTML_TAGS, '');
  cleaned = cleaned.replace(EVENT_HANDLER_ATTRIBUTES, '');
  cleaned = cleaned.replace(DANGEROUS_PROTOCOLS, 'disarmed:');
  // Strip control characters
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');

  return cleaned.trim();
}

/**
 * Safely parses and bounds pagination numbers (page, pageSize).
 * Prevents negative numbers, NaN, and exorbitant integers that could exhaust server memory.
 */
export function parseBoundedInt(
  val: unknown,
  fallback: number,
  min = 1,
  max = 1000
): number {
  if (typeof val === 'number' && !isNaN(val)) {
    return Math.max(min, Math.min(max, Math.floor(val)));
  }

  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      return Math.max(min, Math.min(max, parsed));
    }
  }

  return fallback;
}

/**
 * Recursively sanitizes all string properties in a payload object.
 */
export function sanitizePayload<T>(data: T, depth = 0): T {
  if (depth > 6 || data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeText(data) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizePayload(item, depth + 1)) as unknown as T;
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      // Do not sanitize password fields into HTML entities
      if (/password/i.test(key)) {
        result[key] = value;
      } else {
        result[key] = sanitizePayload(value, depth + 1);
      }
    }
    return result as T;
  }

  return data;
}
