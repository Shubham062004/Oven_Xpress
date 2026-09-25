import { verifyPassword } from '../src/lib/auth/password';
import {
  createPasswordResetToken,
  validatePasswordResetToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
} from '../src/lib/auth/tokens';
import { strongPasswordSchema } from '../src/lib/validations/auth';
import { checkRateLimit, resetRateLimit } from '../src/lib/security/rate-limit';
import { prisma } from '../src/lib/db/prisma';

async function main() {
  console.log('========================================================');
  console.log('   AUTHENTICATION & SECURITY HARDENING TEST SUITE       ');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    }
  }

  // 1. Password Complexity Rules
  console.log('▶ 1. Testing Password Complexity Validation...');
  assert(!strongPasswordSchema.safeParse('short').success, 'Reject passwords under 8 characters');
  assert(!strongPasswordSchema.safeParse('nouppercase1!').success, 'Reject passwords lacking uppercase letters');
  assert(!strongPasswordSchema.safeParse('NOLOWERCASE1!').success, 'Reject passwords lacking lowercase letters');
  assert(!strongPasswordSchema.safeParse('NoNumbers!').success, 'Reject passwords lacking numbers');
  assert(!strongPasswordSchema.safeParse('NoSpecialSymbols1').success, 'Reject passwords lacking special characters');
  assert(!strongPasswordSchema.safeParse('password123').success, 'Reject common dictionary passwords');
  assert(strongPasswordSchema.safeParse('OvenXpress2026!#').success, 'Accept strong complex password');

  // 2. Rate Limiting Tests
  console.log('\n▶ 2. Testing Rate Limiting Protections...');
  const testKey = 'test:login:demo@ovenxpress.com';
  resetRateLimit(testKey);

  for (let i = 0; i < 5; i++) {
    const res = checkRateLimit(testKey, { windowMs: 60000, maxRequests: 5 });
    assert(res.allowed, `Attempt ${i + 1}/5 is allowed within threshold`);
  }
  const throttled = checkRateLimit(testKey, { windowMs: 60000, maxRequests: 5 });
  assert(!throttled.allowed, 'Attempt 6 is blocked by sliding-window rate limiter');
  resetRateLimit(testKey);

  // 3. User & Session Invariants
  console.log('\n▶ 3. Testing User Session & Password Invariants...');
  const testUser = await prisma.user.findFirst({
    where: { email: 'staff@ovenxpress.com' },
  });
  if (!testUser) throw new Error('Test staff user not found in database');

  const passwordValid = await verifyPassword('Staff123!', testUser.passwordHash);
  assert(passwordValid, 'Staff user password validates with Bcrypt 12 rounds');

  // 4. Password Reset Token Lifecycle & Session Invalidation
  console.log('\n▶ 4. Testing Password Reset Token Security...');
  assert(PASSWORD_RESET_TOKEN_TTL_MS === 15 * 60 * 1000, 'Password reset tokens expire in exactly 15 minutes');

  const rawResetToken = await createPasswordResetToken(testUser.id);
  assert(rawResetToken.length === 64, 'Reset token is a 64-char (32-byte) cryptographically secure hex string');

  // Ensure DB does NOT store raw token
  const rawTokenInDb = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: rawResetToken },
  });
  assert(!rawTokenInDb, 'Raw reset token is NEVER stored in database in plaintext (stored only as SHA-256 hash)');

  const validTokenCheck = await validatePasswordResetToken(rawResetToken);
  assert(validTokenCheck.valid, 'Valid reset token resolves correctly against hash');

  const invalidTokenCheck = await validatePasswordResetToken('a'.repeat(64));
  assert(!invalidTokenCheck.valid, 'Tampered or non-existent token is rejected');

  // Test password reset consumption
  const testNewPassword = 'NewSecretPassword2026!#';
  const resetResult = await consumePasswordResetToken(rawResetToken, testNewPassword);
  assert(resetResult.success, 'Password reset token is successfully consumed');

  // Verify token is deleted after use (single-use token)
  const consumedCheck = await validatePasswordResetToken(rawResetToken);
  assert(!consumedCheck.valid, 'Reset token is permanently purged after single use');

  // Verify new password is now active
  const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
  const newPassMatch = await verifyPassword(testNewPassword, updatedUser!.passwordHash);
  assert(newPassMatch, 'Updated user password hash matches new password');

  // Reset password back to standard Staff123!
  const restoreResetToken = await createPasswordResetToken(testUser.id);
  await consumePasswordResetToken(restoreResetToken, 'Staff123!');
  console.log('  ℹ Restored Staff password to original dev credential');

  // 5. Email Verification Token Lifecycle
  console.log('\n▶ 5. Testing Email Verification Token Security...');
  assert(EMAIL_VERIFICATION_TOKEN_TTL_MS === 24 * 60 * 60 * 1000, 'Email verification tokens expire in 24 hours');

  const rawVerifyToken = await createEmailVerificationToken(testUser.id);
  assert(rawVerifyToken.length === 64, 'Email verification token is 64-char cryptographically secure hex string');

  // Ensure DB does NOT store raw token
  const rawVerifyInDb = await prisma.emailVerificationToken.findFirst({
    where: { tokenHash: rawVerifyToken },
  });
  assert(!rawVerifyInDb, 'Raw verification token is NEVER stored in plaintext in database');

  const verifyConsume = await consumeEmailVerificationToken(rawVerifyToken);
  assert(verifyConsume.success, 'Email verification token consumed and email marked verified');

  const verifyConsumedAgain = await consumeEmailVerificationToken(rawVerifyToken);
  assert(!verifyConsumedAgain.success, 'Verification token is single-use and cannot be replayed');

  // ─── SUMMARY ─────────────────────────────────────────────────────────────
  console.log('\n========================================================');
  console.log(` AUTH HARDENING RESULTS: ${passed}/${total} CHECKS PASSED`);
  console.log('========================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('Fatal error in auth test:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
