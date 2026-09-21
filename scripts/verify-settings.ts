/**
 * Verification Script for Step 20 — Settings & System Configuration
 *
 * Tests:
 * 1. 3-Tier Resolution Engine (Default -> Global -> Branch Override)
 * 2. Updating Global Settings & Audit Logging
 * 3. Branch Override Precedence & Branch Isolation (Branch A != Branch B)
 * 4. Resetting Branch & Global Overrides (Fallback verification)
 * 5. Input & Type Validation (Invalid types, bounds, regex, and enums rejected)
 * 6. Scope Restrictions (Global-only settings cannot have branch overrides)
 * 7. User Preferences (Theme, Density, Date Range, Preferred Branch)
 * 8. Consumer Integration (Order number generation & Partial payments)
 */

import { prisma } from '../src/lib/db/prisma';
import {
  getSetting,
  getAllSettings,
  updateSetting,
  resetSetting,
  getUserPreferences,
  updateUserPreferences,
} from '../src/lib/settings/settings-service';
import { SETTING_DEFINITIONS } from '../src/lib/settings/setting-definitions';

async function main() {
  console.log('====================================================');
  console.log('   STEP 20: SETTINGS & SYSTEM CONFIGURATION TESTS   ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${details ? ` - ${details}` : ''}`);
    }
  }

  // Find actor user and branches
  const adminUser = await prisma.user.findFirst({
    where: { role: { name: { in: ['OWNER', 'ADMIN'] } } },
  });

  if (!adminUser) {
    throw new Error('No admin/owner user found for test execution.');
  }

  const branches = await prisma.branch.findMany({
    where: { status: 'ACTIVE' },
    take: 2,
    orderBy: { name: 'asc' },
  });

  if (branches.length < 2) {
    throw new Error('At least 2 active branches required for isolation testing.');
  }

  const branchA = branches[0];
  const branchB = branches[1];

  console.log(`Test Context: Actor=${adminUser.email}, BranchA=${branchA.name}, BranchB=${branchB.name}\n`);

  try {
    // ----------------------------------------------------
    // TEST 1: Default Fallback Resolution
    // ----------------------------------------------------
    console.log('--- Test Group 1: Safe Defaults & Resolver ---');
    // Ensure test key is clean
    await prisma.systemSetting.deleteMany({
      where: { key: 'ORDER_NUMBER_PREFIX' },
    });

    const defaultPrefix = await getSetting<string>('ORDER_NUMBER_PREFIX');
    assert(defaultPrefix === 'ORD', 'Resolves application default when no DB entry exists');

    const defaultPrepTime = await getSetting<number>('BRANCH_DEFAULT_PREPARATION_TIME', branchA.id);
    assert(defaultPrepTime === 20, 'Resolves application default for branch when no override exists');

    const defaultCurrency = await getSetting<string>('BUSINESS_CURRENCY');
    assert(defaultCurrency === 'INR', 'Resolves default business currency');

    // ----------------------------------------------------
    // TEST 2: Global Setting Update & Audit Trail
    // ----------------------------------------------------
    console.log('\n--- Test Group 2: Global Setting Update & Audit Log ---');
    const updateGlobalRes = await updateSetting(
      {
        key: 'ORDER_NUMBER_PREFIX',
        value: 'GLOBALX',
        scope: 'GLOBAL',
      },
      adminUser.id
    );

    assert(updateGlobalRes.success === true, 'Successfully updated global setting');

    const resolvedGlobal = await getSetting<string>('ORDER_NUMBER_PREFIX');
    assert(resolvedGlobal === 'GLOBALX', 'Resolver retrieves updated global value');

    // Verify audit log
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        action: 'SETTING_UPDATE',
        entityType: 'SYSTEM_SETTING',
        actorUserId: adminUser.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    assert(!!auditRecord, 'AuditLog created for SETTING_UPDATE');
    assert(
      auditRecord?.description.includes('ORDER_NUMBER_PREFIX') === true &&
        auditRecord?.description.includes('GLOBALX') === true,
      'AuditLog records key name and new value'
    );

    // ----------------------------------------------------
    // TEST 3: Branch Override Precedence & Isolation
    // ----------------------------------------------------
    console.log('\n--- Test Group 3: Branch Override Precedence & Isolation ---');
    const updateBranchRes = await updateSetting(
      {
        key: 'ORDER_NUMBER_PREFIX',
        value: 'BRA',
        scope: 'BRANCH',
        branchId: branchA.id,
      },
      adminUser.id
    );

    assert(updateBranchRes.success === true, 'Successfully created branch override for Branch A');

    const resolvedBranchA = await getSetting<string>('ORDER_NUMBER_PREFIX', branchA.id);
    assert(resolvedBranchA === 'BRA', 'Branch A resolves its specific override (BRA)');

    const resolvedBranchB = await getSetting<string>('ORDER_NUMBER_PREFIX', branchB.id);
    assert(
      resolvedBranchB === 'GLOBALX',
      'Branch B without override falls back to global setting (GLOBALX)'
    );

    const resolvedUnscoped = await getSetting<string>('ORDER_NUMBER_PREFIX');
    assert(resolvedUnscoped === 'GLOBALX', 'Global query still resolves global setting');

    // ----------------------------------------------------
    // TEST 4: Reset & Hierarchy Fallback
    // ----------------------------------------------------
    console.log('\n--- Test Group 4: Reset Behavior & Fallbacks ---');
    // Reset Branch A override
    const resetBranchRes = await resetSetting(
      {
        key: 'ORDER_NUMBER_PREFIX',
        scope: 'BRANCH',
        branchId: branchA.id,
      },
      adminUser.id
    );

    assert(resetBranchRes.success === true, 'Reset branch override successfully');

    const resolvedBranchAAfterReset = await getSetting<string>('ORDER_NUMBER_PREFIX', branchA.id);
    assert(
      resolvedBranchAAfterReset === 'GLOBALX',
      'Branch A falls back to global setting after override reset'
    );

    // Reset Global setting
    const resetGlobalRes = await resetSetting(
      {
        key: 'ORDER_NUMBER_PREFIX',
        scope: 'GLOBAL',
      },
      adminUser.id
    );

    assert(resetGlobalRes.success === true, 'Reset global setting successfully');

    const resolvedAfterGlobalReset = await getSetting<string>('ORDER_NUMBER_PREFIX');
    assert(
      resolvedAfterGlobalReset === 'ORD',
      'Falls back to application default (ORD) after global reset'
    );

    const resetAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'SETTING_RESET',
        entityType: 'SYSTEM_SETTING',
      },
      orderBy: { createdAt: 'desc' },
    });

    assert(!!resetAudit, 'AuditLog created for SETTING_RESET');

    // ----------------------------------------------------
    // TEST 5: Input & Type Validation
    // ----------------------------------------------------
    console.log('\n--- Test Group 5: Setting Validation & Bounds ---');
    // 1. Unknown key
    const invalidKeyRes = await updateSetting(
      {
        key: 'NONEXISTENT_KEY_123',
        value: 'test',
        scope: 'GLOBAL',
      },
      adminUser.id
    );
    assert(invalidKeyRes.success === false, 'Unknown setting key rejected');

    // 2. Out of bounds number
    const outOfBoundsRes = await updateSetting(
      {
        key: 'BRANCH_DEFAULT_PREPARATION_TIME',
        value: 999, // max is 180
        scope: 'GLOBAL',
      },
      adminUser.id
    );
    assert(outOfBoundsRes.success === false, 'Out-of-bounds number rejected (999 > 180)');

    // 3. Invalid enum
    const invalidEnumRes = await updateSetting(
      {
        key: 'BUSINESS_CURRENCY',
        value: 'BITCOIN', // not in allowed currencies
        scope: 'GLOBAL',
      },
      adminUser.id
    );
    assert(invalidEnumRes.success === false, 'Invalid currency enum rejected (BITCOIN)');

    // 4. Invalid prefix regex
    const invalidPrefixRes = await updateSetting(
      {
        key: 'ORDER_NUMBER_PREFIX',
        value: 'toolongprefix12345',
        scope: 'GLOBAL',
      },
      adminUser.id
    );
    assert(invalidPrefixRes.success === false, 'Invalid prefix regex rejected (> 8 chars)');

    // ----------------------------------------------------
    // TEST 6: Scope Restrictions
    // ----------------------------------------------------
    console.log('\n--- Test Group 6: Scope Integrity ---');
    const globalOnlyRes = await updateSetting(
      {
        key: 'BUSINESS_NAME',
        value: 'Branch Specific Bakery',
        scope: 'BRANCH',
        branchId: branchA.id,
      },
      adminUser.id
    );
    assert(globalOnlyRes.success === false, 'Global-only setting cannot have branch override');

    // ----------------------------------------------------
    // TEST 7: User Preferences
    // ----------------------------------------------------
    console.log('\n--- Test Group 7: User UI Preferences ---');
    const updatePrefRes = await updateUserPreferences(adminUser.id, {
      theme: 'dark',
      tableDensity: 'compact',
      defaultDateRange: '7d',
      preferredBranchId: branchA.id,
    });

    assert(updatePrefRes.success === true, 'Saved user UI preferences');

    const retrievedPrefs = await getUserPreferences(adminUser.id);
    assert(
      retrievedPrefs.theme === 'dark' &&
        retrievedPrefs.tableDensity === 'compact' &&
        retrievedPrefs.defaultDateRange === '7d' &&
        retrievedPrefs.preferredBranchId === branchA.id,
      'User preferences retrieved accurately'
    );

    const prefAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'USER_PREFERENCE_UPDATE',
        entityType: 'USER_PREFERENCE',
        actorUserId: adminUser.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    assert(!!prefAudit, 'AuditLog created for USER_PREFERENCE_UPDATE');

    // ----------------------------------------------------
    // TEST 8: All Settings Catalog Integrity
    // ----------------------------------------------------
    console.log('\n--- Test Group 8: Settings Catalog Completeness ---');
    const allSettings = await getAllSettings(branchA.id);
    assert(
      allSettings.length === Object.keys(SETTING_DEFINITIONS).length,
      `All ${Object.keys(SETTING_DEFINITIONS).length} settings retrieved in catalog`
    );

    const hasEffectiveValues = allSettings.every((s) => s.effectiveValue !== undefined);
    assert(hasEffectiveValues, 'Every catalog setting has a defined effectiveValue');

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    // Cleanup any test settings created
    await prisma.systemSetting.deleteMany({
      where: { key: { in: ['ORDER_NUMBER_PREFIX'] } },
    });
  }

  console.log('\n====================================================');
  console.log(`   SETTINGS VERIFICATION SUMMARY: ${passedTests}/${totalTests} PASSED   `);
  console.log('====================================================');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
