/**
 * Production Environment & Secrets Security Validator
 *
 * Validates that:
 * 1. Critical server secrets (DATABASE_URL, AUTH_SECRET) are configured with adequate entropy.
 * 2. Database connections enforce SSL encryption in production (sslmode=require).
 * 3. Secrets are NEVER accidentally exposed to the client bundle via NEXT_PUBLIC_ prefixes.
 * 4. Application URLs enforce HTTPS in production environments.
 */

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  environment: 'development' | 'production' | 'test';
}

const WEAK_SECRETS = new Set([
  'secret',
  'changeme',
  'password',
  '12345678901234567890123456789012',
  'default-secret',
  'auth-secret-key-must-be-at-least-32-chars',
]);

const SENSITIVE_KEYWORD_PATTERNS = [
  /DATABASE/i,
  /SECRET/i,
  /PASSWORD/i,
  /PRIVATE_KEY/i,
  /CREDENTIAL/i,
];

/**
 * Validates the runtime environment against production security benchmarks.
 */
export function validateEnvironment(): EnvValidationResult {
  const env = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  const isProd = env === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    errors.push('DATABASE_URL is not set. A valid database connection string is required.');
  } else {
    // In production, enforce TLS/SSL connection parameter
    if (isProd) {
      const hasSsl =
        databaseUrl.includes('sslmode=require') ||
        databaseUrl.includes('sslmode=verify-full') ||
        databaseUrl.includes('sslmode=verify-ca');

      if (!hasSsl) {
        errors.push(
          'DATABASE_URL must enforce SSL encryption in production (e.g. ?sslmode=require).'
        );
      }
    }
  }

  // 2. Validate AUTH_SECRET
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret || authSecret.trim().length === 0) {
    if (isProd) {
      errors.push('AUTH_SECRET is required in production.');
    } else {
      warnings.push('AUTH_SECRET is not set; using development fallback. Must configure before deployment.');
    }
  } else {
    if (authSecret.length < 32) {
      const msg = 'AUTH_SECRET must be at least 32 characters (256 bits of entropy) to resist cryptographic attacks.';
      if (isProd) errors.push(msg);
      else warnings.push(msg);
    }

    if (WEAK_SECRETS.has(authSecret.trim().toLowerCase())) {
      const msg = 'AUTH_SECRET is set to an insecure default placeholder. Generate a strong random key (e.g. openssl rand -hex 32).';
      if (isProd) errors.push(msg);
      else warnings.push(msg);
    }
  }

  // 3. Validate Public Environment Variables (Prevent Frontend Secret Leakage)
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('NEXT_PUBLIC_')) {
      const hasSensitiveKeyword = SENSITIVE_KEYWORD_PATTERNS.some((pattern) => pattern.test(key));
      if (hasSensitiveKeyword && value && value.length > 5) {
        errors.push(
          `Security violation: Sensitive environment variable "${key}" is prefixed with NEXT_PUBLIC_ and would be leaked to browser clients!`
        );
      }
    }
  }

  // 4. Validate Application URL / HTTPS enforcement in production
  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (isProd && appUrl) {
    if (!appUrl.startsWith('https://')) {
      warnings.push(
        `Production application URL "${appUrl}" does not use the https:// protocol.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    environment: env,
  };
}

/**
 * Asserts that the environment is secure. Throws in production if security invariants fail.
 */
export function assertSecureEnvironment(): void {
  const result = validateEnvironment();

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.warn(`[SECURITY WARNING] ${warning}`);
    }
  }

  if (!result.valid) {
    const message = `[FATAL SECURITY CONFIGURATION ERROR] Environment validation failed:\n${result.errors.map((e) => `  - ${e}`).join('\n')}`;
    if (result.environment === 'production') {
      throw new Error(message);
    } else {
      console.error(message);
    }
  }
}
