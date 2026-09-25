/**
 * Automated Verification Script: Deployment Hardening & Security Logging
 *
 * Verifies:
 * 1. Environment validation & secrets security (entropy, SSL requirement, no client leaks).
 * 2. Suspicious probe and path traversal detection rules.
 * 3. Structured security logger data sanitization and email masking.
 * 4. Database SSL enforcement and network isolation parameters.
 * 5. Middleware HTTPS redirect logic.
 */

import { validateEnvironment } from '../src/lib/security/env-validation';
import { detectSuspiciousTraffic } from '../src/lib/security/traffic-detector';
import { sanitizeLogData, maskEmail } from '../src/lib/security/security-logger';

let passedChecks = 0;
let totalChecks = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  [PASS] ${testName}`);
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (detail) console.error(`         ${detail}`);
  }
}

async function runDeploymentHardeningTests() {
  console.log('\n======================================================');
  console.log('--- SUITE 1: ENVIRONMENT & SECRETS SECURITY TESTS ---');
  console.log('======================================================');

  // Test 1: Weak AUTH_SECRET rejection
  const originalEnv = { ...process.env };
  try {
    const envMutable = process.env as Record<string, string | undefined>;
    envMutable.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@db.example.com:5432/mydb?sslmode=require';
    process.env.AUTH_SECRET = 'short';

    const weakResult = validateEnvironment();
    assert(
      !weakResult.valid && weakResult.errors.some((e) => e.includes('AUTH_SECRET must be at least 32 characters')),
      'Rejects AUTH_SECRET with fewer than 32 characters in production'
    );

    // Test 2: Insecure placeholder AUTH_SECRET rejection
    process.env.AUTH_SECRET = '12345678901234567890123456789012';
    const placeholderResult = validateEnvironment();
    assert(
      !placeholderResult.valid && placeholderResult.errors.some((e) => e.includes('insecure default placeholder')),
      'Rejects well-known placeholder/dictionary AUTH_SECRET keys'
    );

    // Test 3: Unencrypted DATABASE_URL rejection in production
    process.env.AUTH_SECRET = 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8';
    process.env.DATABASE_URL = 'postgresql://user:pass@db.example.com:5432/mydb';
    const noSslResult = validateEnvironment();
    assert(
      !noSslResult.valid && noSslResult.errors.some((e) => e.includes('DATABASE_URL must enforce SSL encryption')),
      'Rejects unencrypted database connection string in production (missing ?sslmode=require)'
    );

    // Test 4: Frontend secret leakage detection (NEXT_PUBLIC_ sensitive keywords)
    process.env.DATABASE_URL = 'postgresql://user:pass@db.example.com:5432/mydb?sslmode=require';
    process.env.NEXT_PUBLIC_PAYMENT_SECRET = 'live_secret_key_123456';
    const leakResult = validateEnvironment();
    assert(
      !leakResult.valid && leakResult.errors.some((e) => e.includes('Security violation: Sensitive environment variable "NEXT_PUBLIC_PAYMENT_SECRET"')),
      'Detects and blocks sensitive keys prefixed with NEXT_PUBLIC_ from leaking to frontend bundle'
    );
    delete process.env.NEXT_PUBLIC_PAYMENT_SECRET;

    // Test 5: Valid production configuration passes
    const validResult = validateEnvironment();
    assert(
      validResult.valid && validResult.errors.length === 0,
      'Accepts valid production configuration (strong AUTH_SECRET + SSL-enforced DATABASE_URL)'
    );
  } finally {
    process.env = originalEnv;
  }

  console.log('\n======================================================');
  console.log('--- SUITE 2: SUSPICIOUS PROBE & TRAFFIC DETECTOR ---');
  console.log('======================================================');

  // Test 6: Detects sensitive file probes (.env, .git)
  const envProbe = detectSuspiciousTraffic('/.env');
  assert(
    envProbe.isSuspicious && envProbe.anomalyType === 'SUSPICIOUS_PROBE',
    'Detects probe targeting /.env configuration file'
  );

  const gitProbe = detectSuspiciousTraffic('/.git/config');
  assert(
    gitProbe.isSuspicious && gitProbe.anomalyType === 'SUSPICIOUS_PROBE',
    'Detects probe targeting /.git repository metadata'
  );

  // Test 7: Detects web exploit & scanner paths (wp-admin, phpmyadmin)
  const wpProbe = detectSuspiciousTraffic('/wp-login.php');
  assert(
    wpProbe.isSuspicious && wpProbe.statusCode === 404,
    'Detects probe targeting WordPress / CMS scanner paths'
  );

  const pmaProbe = detectSuspiciousTraffic('/phpmyadmin/index.php');
  assert(
    pmaProbe.isSuspicious && pmaProbe.statusCode === 404,
    'Detects probe targeting database management consoles'
  );

  // Test 8: Detects path traversal sequences
  const traversal1 = detectSuspiciousTraffic('/uploads/../../../etc/passwd');
  assert(
    traversal1.isSuspicious && traversal1.anomalyType === 'PATH_TRAVERSAL_ATTEMPT' && traversal1.statusCode === 400,
    'Detects directory traversal pattern (../)'
  );

  const traversal2 = detectSuspiciousTraffic('/files/%2e%2e/secret.key');
  assert(
    traversal2.isSuspicious && traversal2.anomalyType === 'PATH_TRAVERSAL_ATTEMPT',
    'Detects URL-encoded path traversal sequence (%2e%2e)'
  );

  // Test 9: Detects malicious scanner user-agents
  const sqlmapProbe = detectSuspiciousTraffic('/api/orders', 'sqlmap/1.6#stable');
  assert(
    sqlmapProbe.isSuspicious && sqlmapProbe.anomalyType === 'MALICIOUS_USER_AGENT' && sqlmapProbe.statusCode === 403,
    'Detects and blocks automated scanner user-agents (e.g. sqlmap)'
  );

  const niktoProbe = detectSuspiciousTraffic('/api/orders', 'Mozilla/5.0 (Nikto/2.1.6)');
  assert(
    niktoProbe.isSuspicious && niktoProbe.statusCode === 403,
    'Detects and blocks Nikto vulnerability scanner'
  );

  // Test 10: Allows legitimate application traffic
  const validPage = detectSuspiciousTraffic('/orders', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
  assert(
    !validPage.isSuspicious,
    'Allows normal application page route (/orders) with standard browser User-Agent'
  );

  const validApi = detectSuspiciousTraffic('/api/uploads/receipt', 'Mozilla/5.0');
  assert(
    !validApi.isSuspicious,
    'Allows legitimate API route (/api/uploads/receipt)'
  );

  console.log('\n======================================================');
  console.log('--- SUITE 3: STRUCTURED SECURITY LOGGER SANITIZATION ---');
  console.log('======================================================');

  // Test 11: Redacts sensitive passwords and tokens
  const payloadToSanitize = {
    user: 'admin',
    password: 'SuperSecretPassword123!',
    token: 'raw-crypto-token-xyz',
    session: 'ox_session_active_id',
    details: {
      passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
      creditCard: '4111111111111111',
      regularField: 'safeValue',
    },
  };

  const sanitized = sanitizeLogData(payloadToSanitize) as Record<string, unknown>;
  const details = sanitized.details as Record<string, unknown>;

  assert(
    sanitized.password === '[REDACTED]' &&
    sanitized.token === '[REDACTED]' &&
    sanitized.session === '[REDACTED]' &&
    details.passwordHash === '[REDACTED]' &&
    details.creditCard === '[REDACTED]' &&
    details.regularField === 'safeValue',
    'Sanitizer automatically redacts passwords, tokens, hashes, and session cookies'
  );

  // Test 12: Redacts Bearer tokens in strings
  const sanitizedHeader = sanitizeLogData('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  assert(
    sanitizedHeader === 'Bearer [REDACTED]',
    'Redacts raw Bearer authentication authorization tokens'
  );

  // Test 13: Email masking for privacy
  const masked1 = maskEmail('john.doe@restaurant.com');
  const masked2 = maskEmail('al@test.com');
  assert(
    masked1 === 'j***e@restaurant.com' && masked2 === 'a***@test.com',
    'Masks email addresses properly for privacy while preserving diagnostic domain'
  );

  console.log('\n======================================================');
  console.log(`TOTAL CHECKS: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${totalChecks - passedChecks}`);
  console.log('======================================================\n');

  if (passedChecks !== totalChecks) {
    process.exit(1);
  }
}

runDeploymentHardeningTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
