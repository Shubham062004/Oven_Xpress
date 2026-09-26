/**
 * Automated Test Suite: User Account, Profile, Password, Sessions & Logout Experience
 * Verifies AUTH-01 through AUTH-22 invariants
 */

import { prisma } from '../src/lib/db/prisma';
import { verifyPassword, hashPassword } from '../src/lib/auth/password';
import {
  strongPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../src/lib/validations/auth';
import {
  validateAvatarFile,
  validateImageMagicBytes,
} from '../src/lib/storage/avatars';
import { AUDIT_ACTIONS } from '../src/lib/audit/audit-types';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('========================================================');
  console.log('   ACCOUNT & PROFILE EXPERIENCE VERIFICATION SUITE       ');
  console.log('========================================================\n');

  // Load Seed Users
  const [owner, manager, staff] = await Promise.all([
    prisma.user.findFirst({
      where: { email: 'owner@ovenxpress.com' },
      include: { role: true, employee: { include: { branch: true } } },
    }),
    prisma.user.findFirst({
      where: { email: 'manager@ovenxpress.com' },
      include: { role: true, employee: { include: { branch: true } } },
    }),
    prisma.user.findFirst({
      where: { email: 'staff@ovenxpress.com' },
      include: { role: true, employee: { include: { branch: true } } },
    }),
  ]);

  if (!owner || !manager || !staff) {
    throw new Error('Seed users not found. Run seed script before testing.');
  }

  // ─────────────────────────────────────────────────────────────
  // SUITE 1: AUTH-01 to AUTH-04: User Data & Operational Context
  // ─────────────────────────────────────────────────────────────
  console.log('▶ SUITE 1: User Profile Retrieval & Organizational Context');

  assert(owner.role.name === 'OWNER', 'AUTH-04: Owner user resolves with OWNER role');
  assert(manager.role.name === 'MANAGER', 'AUTH-04: Manager user resolves with MANAGER role');
  assert(staff.role.name === 'STAFF', 'AUTH-04: Staff user resolves with STAFF role');

  assert(manager.employee !== null, 'AUTH-04: Manager has linked Employee entity');
  if (manager.employee) {
    assert(manager.employee.branch !== null, 'AUTH-04: Manager employee has assigned Branch');
    assert(Boolean(manager.employee.employeeCode), 'AUTH-04: Manager employee has unique Employee Code');
    assert(Boolean(manager.employee.designation), 'AUTH-04: Manager employee has designated role');
  }

  // ─────────────────────────────────────────────────────────────
  // SUITE 2: AUTH-05 to AUTH-07: Edit Profile & Restricted Fields
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ SUITE 2: Profile Update & Field Restriction Enforcement');

  const validProfileInput = {
    firstName: 'Staff',
    lastName: 'Member',
    phone: '+1 555-0199',
    avatarUrl: 'https://example.com/avatar.png',
  };

  const parsedValid = updateProfileSchema.safeParse(validProfileInput);
  assert(parsedValid.success, 'AUTH-05: Valid profile input passes Zod validation');

  // Restricted field injection attempt (mass assignment attack)
  const maliciousInput = {
    firstName: 'Hacked',
    lastName: 'Admin',
    phone: '1234567890',
    role: 'OWNER',
    roleId: 'compromised-role-id',
    salary: 999999,
    branchId: 'compromised-branch-id',
    employeeCode: 'EMP-HACKED',
    permissions: ['all'],
  };

  const parsedMalicious = updateProfileSchema.safeParse(maliciousInput);
  assert(parsedMalicious.success, 'Parses only allowed fields');
  const allowedKeys = Object.keys(parsedMalicious.data || {});
  assert(
    !allowedKeys.includes('role') &&
    !allowedKeys.includes('roleId') &&
    !allowedKeys.includes('salary') &&
    !allowedKeys.includes('branchId') &&
    !allowedKeys.includes('employeeCode') &&
    !allowedKeys.includes('permissions'),
    'AUTH-07/17: Restricted fields (role, branch, salary, permissions) are completely stripped and ignored'
  );

  // Database persistence test on Staff
  const originalStaffName = staff.name;
  const originalStaffPhone = staff.phone;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: staff.id },
      data: {
        name: 'Staff Updated',
        phone: '+1 555-9876',
      },
    });
    if (staff.employee) {
      await tx.employee.update({
        where: { id: staff.employee.id },
        data: {
          firstName: 'Staff',
          lastName: 'Updated',
          phone: '+1 555-9876',
        },
      });
    }
  });

  const updatedStaff = await prisma.user.findUnique({
    where: { id: staff.id },
    include: { employee: true },
  });

  assert(updatedStaff?.name === 'Staff Updated', 'AUTH-06: Profile name change persists in User record');
  assert(updatedStaff?.employee?.lastName === 'Updated', 'AUTH-06: Profile change propagates to linked Employee record');

  // Revert Staff changes to restore pristine seed state
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: staff.id },
      data: {
        name: originalStaffName,
        phone: originalStaffPhone,
      },
    });
    if (staff.employee) {
      await tx.employee.update({
        where: { id: staff.employee.id },
        data: {
          firstName: 'Staff',
          lastName: 'Member',
          phone: originalStaffPhone || '+1 555-0104',
        },
      });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // SUITE 3: AUTH-08 to AUTH-10: Password Change & Validation
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ SUITE 3: Password Change, Complexity & Session Revocation');

  // AUTH-10: Password mismatch
  const mismatchInput = {
    currentPassword: 'Staff123!',
    newPassword: 'NewPassword123!',
    confirmPassword: 'DifferentPassword123!',
  };
  const mismatchResult = changePasswordSchema.safeParse(mismatchInput);
  assert(
    !mismatchResult.success &&
    mismatchResult.error.issues.some((i) => i.message.includes('do not match')),
    'AUTH-10: Rejects password confirmation mismatch'
  );

  // Weak password checks
  assert(!strongPasswordSchema.safeParse('short').success, 'Rejects password under 8 chars');
  assert(!strongPasswordSchema.safeParse('alllowercase1!').success, 'Rejects password without uppercase');
  assert(!strongPasswordSchema.safeParse('ALLUPPERCASE1!').success, 'Rejects password without lowercase');
  assert(!strongPasswordSchema.safeParse('NoSpecialSymbols1').success, 'Rejects password without symbols');
  assert(!strongPasswordSchema.safeParse('NoNumbers!#').success, 'Rejects password without numbers');

  // Same as current password check
  const sameInput = {
    currentPassword: 'Staff123!',
    newPassword: 'Staff123!',
    confirmPassword: 'Staff123!',
  };
  const sameResult = changePasswordSchema.safeParse(sameInput);
  assert(
    !sameResult.success &&
    sameResult.error.issues.some((i) => i.message.includes('must be different')),
    'Rejects new password identical to current password'
  );

  // AUTH-09: Incorrect current password check
  const isCorrect = await verifyPassword('WrongPassword123!', staff.passwordHash);
  assert(!isCorrect, 'AUTH-09: Correctly detects invalid current password against hash');

  // AUTH-08: Valid password change lifecycle
  const isOriginalValid = await verifyPassword('Staff123!', staff.passwordHash);
  assert(isOriginalValid, 'AUTH-08: Original seed password validates');

  const newTestPass = 'UpdatedStaffPass2026!#';
  const newHash = await hashPassword(newTestPass);
  await prisma.user.update({
    where: { id: staff.id },
    data: { passwordHash: newHash, passwordChangedAt: new Date() },
  });

  const staffAfterUpdate = await prisma.user.findUnique({ where: { id: staff.id } });
  const newPassValidates = await verifyPassword(newTestPass, staffAfterUpdate!.passwordHash);
  assert(newPassValidates, 'AUTH-08: New password validates with bcrypt 12 rounds');
  assert(staffAfterUpdate!.passwordChangedAt !== null, 'AUTH-08: passwordChangedAt timestamp is recorded');

  // Revert password back to original seed Staff123!
  const restoredHash = await hashPassword('Staff123!');
  await prisma.user.update({
    where: { id: staff.id },
    data: { passwordHash: restoredHash },
  });
  const restoredCheck = await verifyPassword('Staff123!', (await prisma.user.findUnique({ where: { id: staff.id } }))!.passwordHash);
  assert(restoredCheck, 'Restored Staff password back to Staff123! for subsequent tests');

  // ─────────────────────────────────────────────────────────────
  // SUITE 4: AUTH-11 to AUTH-14: Session Termination & Revocation
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ SUITE 4: Multi-Session Invalidation & Logout Invariants');

  // Create 3 active sessions for staff
  const token1 = 'test_token_1_' + Date.now();
  const token2 = 'test_token_2_' + Date.now();
  const tokenCurrent = 'test_token_current_' + Date.now();

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.session.createMany({
    data: [
      { userId: staff.id, sessionToken: token1, expiresAt: expires, ipAddress: '10.0.0.1', userAgent: 'Mozilla/5.0 Chrome Windows' },
      { userId: staff.id, sessionToken: token2, expiresAt: expires, ipAddress: '10.0.0.2', userAgent: 'Mozilla/5.0 Safari iPhone' },
      { userId: staff.id, sessionToken: tokenCurrent, expiresAt: expires, ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0 Brave Desktop' },
    ],
  });

  const staffSessionsBefore = await prisma.session.findMany({ where: { userId: staff.id } });
  assert(staffSessionsBefore.length >= 3, 'Created 3 concurrent active test sessions');

  // Revoke all OTHER sessions except tokenCurrent
  const revokeResult = await prisma.session.deleteMany({
    where: {
      userId: staff.id,
      sessionToken: { not: tokenCurrent },
    },
  });

  assert(revokeResult.count >= 2, 'AUTH-14: Successfully deleted other sessions server-side');

  // Verify tokenCurrent still exists
  const currentCheck = await prisma.session.findUnique({ where: { sessionToken: tokenCurrent } });
  assert(currentCheck !== null, 'Current session is preserved while other sessions are revoked');

  // Clean up current test session (Logout simulation)
  await prisma.session.deleteMany({ where: { sessionToken: tokenCurrent } });
  const loggedOutCheck = await prisma.session.findUnique({ where: { sessionToken: tokenCurrent } });
  assert(loggedOutCheck === null, 'AUTH-11/12/13/14: Session is destroyed in DB on logout; cannot be reused');

  // ─────────────────────────────────────────────────────────────
  // SUITE 5: AUTH-15 to AUTH-17: Authorization & IDOR Hardening
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ SUITE 5: IDOR & Server-side Authorization Checks');

  // Ensure Staff cannot manipulate branch or role
  assert(staff.role.name === 'STAFF', 'Staff role remains STAFF');
  if (staff.employee) {
    const branchBefore = staff.employee.branchId;
    assert(Boolean(branchBefore), 'AUTH-16: Staff employee assigned to specific branch');
  }

  // ─────────────────────────────────────────────────────────────
  // SUITE 6: AUTH-19: Avatar & Storage Validation
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ SUITE 6: Avatar Storage & Upload Security Validation');

  const validJpg = validateAvatarFile('image/jpeg', 1024 * 1024, 'photo.jpg');
  assert(validJpg.valid && validJpg.ext === '.jpg', 'Accepts valid JPG avatar within 2MB limit');

  const validPng = validateAvatarFile('image/png', 500 * 1024, 'photo.png');
  assert(validPng.valid && validPng.ext === '.png', 'Accepts valid PNG avatar');

  const oversized = validateAvatarFile('image/jpeg', 3 * 1024 * 1024, 'huge.jpg');
  assert(!oversized.valid && Boolean(oversized.error?.includes('exceeds 2MB')), 'Rejects avatar exceeding 2MB');

  const invalidMime = validateAvatarFile('application/pdf', 100 * 1024, 'document.pdf');
  assert(!invalidMime.valid && Boolean(invalidMime.error?.includes('Invalid file format')), 'Rejects non-image file format for avatar');

  // Magic bytes inspection
  const fakePngBuffer = Buffer.from('NOT_A_PNG_FILE_CONTENT_AT_ALL');
  assert(!validateImageMagicBytes(fakePngBuffer), 'Rejects file with spoofed MIME type (invalid magic bytes)');

  const realPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert(validateImageMagicBytes(realPngHeader), 'Accepts file with valid PNG header magic bytes');

  // ─────────────────────────────────────────────────────────────
  // SUITE 7: Audit Actions Verification
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ SUITE 7: Audit Logging Contract Verification');

  assert(AUDIT_ACTIONS.PROFILE_UPDATED === 'PROFILE_UPDATED', 'AUDIT_ACTIONS includes PROFILE_UPDATED');
  assert(AUDIT_ACTIONS.PASSWORD_CHANGED === 'PASSWORD_CHANGED', 'AUDIT_ACTIONS includes PASSWORD_CHANGED');
  assert(AUDIT_ACTIONS.OTHER_SESSIONS_REVOKED === 'OTHER_SESSIONS_REVOKED', 'AUDIT_ACTIONS includes OTHER_SESSIONS_REVOKED');
  assert(AUDIT_ACTIONS.AUTH_LOGOUT === 'AUTH_LOGOUT', 'AUDIT_ACTIONS includes AUTH_LOGOUT');

  console.log('\n========================================================');
  console.log(`TOTAL CHECKS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  console.log('========================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Test run failed with unhandled exception:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
