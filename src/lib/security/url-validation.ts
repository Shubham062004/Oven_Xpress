/**
 * URL and Redirect Security Utilities
 *
 * Prevents open redirect attacks (CWE-601) by enforcing strict validation
 * on user-supplied return/callback URLs.
 */

/**
 * Validates that a callback URL is a safe, strictly relative application path.
 *
 * Rules:
 * 1. Must be a non-empty string.
 * 2. Must start with a single forward slash ('/').
 * 3. Must NOT start with double slashes ('//') which browsers treat as protocol-relative URLs.
 * 4. Must NOT start with '/\' or contain backslashes, which can trick path parsers.
 * 5. Must NOT contain control characters (ASCII 0-31), tabs, or newlines (header injection).
 * 6. Must NOT contain URI schemes (e.g. 'javascript:', 'data:', 'http:').
 */
export function isSafeRedirectUrl(url: unknown): url is string {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmed = url.trim();

  // Must start with '/' and not '//' or '/\'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return false;
  }

  // Reject backslashes anywhere in path
  if (trimmed.includes('\\')) {
    return false;
  }

  // Reject control characters or newlines
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return false;
  }

  // Reject explicit protocol specifications
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Returns a sanitized redirect destination URL.
 * Falls back to the provided fallback (default: '/') if unsafe.
 */
export function sanitizeRedirectUrl(url: unknown, fallback = '/'): string {
  if (isSafeRedirectUrl(url)) {
    return url.trim();
  }
  return fallback;
}
