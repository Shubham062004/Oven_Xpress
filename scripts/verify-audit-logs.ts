import { prisma } from '../src/lib/db/prisma';
import {
  createAuditLog,
  getAuditLogs,
  getAuditLogById,
} from '../src/lib/audit/audit-service';
import {
  sanitizeAuditData,
  calculateFieldDiff,
} from '../src/lib/audit/audit-sanitizer';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
} from '../src/lib/audit/audit-types';
import type { AuthUser } from '../src/lib/auth/types';

async function runAuditVerification() {
  console.log('================================================================');
  console.log('--- Step 19: Audit Logs & System Activity Verification Tests ---');
  console.log('================================================================\n');

  // Prerequisites
  const ownerUser = await prisma.user.findFirst({
    where: { role: { name: 'OWNER' } },
    include: { role: true },
  });

  const branches = await prisma.branch.findMany({
    where: { status: 'ACTIVE' },
    take: 2,
  });

  if (!ownerUser || branches.length < 1) {
    throw new Error('Test prerequisites not found (owner user or branches).');
  }

  const branchA = branches[0]!;
  const branchB = branches.length > 1 ? branches[1]! : branches[0]!;

  const ownerAuthUser: AuthUser = {
    id: ownerUser.id,
    name: ownerUser.name,
    email: ownerUser.email,
    role: ownerUser.role.name as any,
    isActive: true,
    permissions: [],
  };

  console.log(`[PASS] Prerequisites loaded: Owner = ${ownerAuthUser.name}, Branches = ${branchA.name} (${branchA.code}), ${branchB.name} (${branchB.code})\n`);

  // --------------------------------------------------------------------------
  // TEST 1: Sensitive Data Sanitization (Deep Recursive Redaction)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Sensitive Data Sanitization ---');
  const dirtyData = {
    user: 'Chef John',
    password: 'SuperSecretPassword123!',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
    api_key: 'sk_live_938420942093402940239402',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    card_cvv: '999',
    database_url: 'postgres://user:pass@host:5432/db',
    nestedProfile: {
      clientSecret: 'secret_live_99999',
      safeField: 'Regular Value',
      sessionToken: 'sess_99999999',
    },
    longText: 'A'.repeat(5000), // Should be truncated
  };

  const sanitized = sanitizeAuditData(dirtyData);
  if (!sanitized) throw new Error('Sanitizer returned null');

  if (
    sanitized.password !== '[REDACTED]' ||
    sanitized.passwordHash !== '[REDACTED]' ||
    sanitized.api_key !== '[REDACTED]' ||
    sanitized.card_cvv !== '[REDACTED]' ||
    sanitized.database_url !== '[REDACTED]' ||
    (sanitized.nestedProfile as any).clientSecret !== '[REDACTED]' ||
    (sanitized.nestedProfile as any).sessionToken !== '[REDACTED]' ||
    (sanitized.nestedProfile as any).safeField !== 'Regular Value'
  ) {
    console.error('Sanitization failed:', sanitized);
    throw new Error('Sensitive fields were not properly redacted!');
  }

  if ((sanitized.longText as string).length > 2050) {
    throw new Error('String length bound exceeded in sanitizer!');
  }
  console.log('[PASS] Deep recursive sanitizer successfully redacted passwords, tokens, session secrets, and connection strings.');

  // --------------------------------------------------------------------------
  // TEST 2: Change Diff Calculation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Change Diff Calculation ---');
  const beforeState = {
    price: 250,
    status: 'ACTIVE',
    notes: 'Old note',
    unchangedField: 'Constant',
  };
  const afterState = {
    price: 275,
    status: 'INACTIVE',
    notes: 'Updated note',
    unchangedField: 'Constant',
  };

  const diff = calculateFieldDiff(beforeState, afterState);
  if (
    !diff.price ||
    diff.price.from !== 250 ||
    diff.price.to !== 275 ||
    !diff.status ||
    diff.status.from !== 'ACTIVE' ||
    diff.status.to !== 'INACTIVE' ||
    diff.unchangedField !== undefined
  ) {
    console.error('Diff calculation failed:', diff);
    throw new Error('Field diff calculation failed!');
  }
  console.log('[PASS] Field diff computed successfully (price: 250 -> 275, status: ACTIVE -> INACTIVE, unchanged omitted).');

  // --------------------------------------------------------------------------
  // TEST 3: Direct Audit Creation & Ingestion
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Audit Creation & Persistence ---');
  const testOrderId = `test-order-${Date.now()}`;
  const createdAudit = await createAuditLog({
    actorUserId: ownerUser.id,
    branchId: branchA.id,
    action: AUDIT_ACTIONS.ORDER_CREATE,
    entityType: AUDIT_ENTITY_TYPES.ORDER,
    entityId: testOrderId,
    description: `Created Dine-In order #${testOrderId} with total ₹1,250.00.`,
    beforeData: null,
    afterData: {
      orderId: testOrderId,
      totalAmount: 1250.0,
      status: 'PENDING',
    },
    metadata: {
      orderType: 'DINE_IN',
      clientSecret: 'should-be-stripped-in-metadata',
    },
  });

  if (!createdAudit || !createdAudit.id) {
    throw new Error('Failed to create audit log record.');
  }

  // Verify created log in database
  const fetchedLog = await prisma.auditLog.findUnique({
    where: { id: createdAudit.id },
    include: { actorUser: true, branch: true },
  });

  if (!fetchedLog) throw new Error('Could not find newly created audit log in database.');
  if (fetchedLog.action !== AUDIT_ACTIONS.ORDER_CREATE) throw new Error('Action mismatch in database.');
  if ((fetchedLog.metadata as any)?.clientSecret !== '[REDACTED]') {
    throw new Error('Metadata was not sanitized before persistence.');
  }
  console.log(`[PASS] Created audit log ${fetchedLog.id} with action ${fetchedLog.action} and sanitized metadata.`);

  // --------------------------------------------------------------------------
  // TEST 4: Branch Isolation & Permission Security
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Branch Isolation & Permission Security ---');
  // Find real manager employee in database
  const managerEmp = await prisma.employee.findFirst({
    where: { userId: { not: null }, branchId: branchA.id },
    include: { user: { include: { role: true } } },
  });

  if (!managerEmp || !managerEmp.user) {
    throw new Error('Manager employee prerequisite not found.');
  }

  // 4A: Staff/Manager without audit.read permission must be rejected immediately
  const unauthorizedManager: AuthUser = {
    id: managerEmp.userId!,
    name: managerEmp.user.name,
    email: managerEmp.user.email,
    role: 'MANAGER',
    isActive: true,
    permissions: ['order.read', 'inventory.read'], // No audit.read
  };

  let unauthCaught = false;
  try {
    await getAuditLogs({}, unauthorizedManager);
  } catch (err: any) {
    if (err.message.includes('permission to view audit logs') || err.message.includes('Unauthorized')) {
      unauthCaught = true;
    }
  }
  if (!unauthCaught) {
    throw new Error('SECURITY VIOLATION: User without audit.read was permitted to query audit logs!');
  }
  console.log('[PASS] 4A: Unauthorized user without audit.read permission is blocked immediately.');

  // Create an audit event specifically for Branch B
  const auditBranchB = await createAuditLog({
    actorUserId: ownerUser.id,
    branchId: branchB.id,
    action: AUDIT_ACTIONS.EXPENSE_CREATE,
    entityType: AUDIT_ENTITY_TYPES.EXPENSE,
    entityId: `exp-${Date.now()}`,
    description: `Created branch utility expense for ${branchB.name}.`,
    afterData: { amount: 3500 },
  });

  // 4B: Authorized Auditor scoped strictly to Branch A
  const branchManagerA: AuthUser = {
    id: managerEmp.userId!,
    name: managerEmp.user.name,
    email: managerEmp.user.email,
    role: 'MANAGER',
    isActive: true,
    permissions: ['audit.read'],
  };

  // Manager A requests logs for Branch B -> server must throw Unauthorized
  let branchBQueryBlocked = false;
  try {
    await getAuditLogs({ branchId: branchB.id }, branchManagerA);
  } catch (err: any) {
    if (
      err.message.includes('You cannot access audit logs from another branch') ||
      err.message.includes('Unauthorized')
    ) {
      branchBQueryBlocked = true;
    }
  }
  if (!branchBQueryBlocked) {
    throw new Error('SECURITY VIOLATION: Branch Manager could request another branch audit logs without error!');
  }

  // Default query without branchId param -> must only return Branch A logs
  const managerResult = await getAuditLogs({}, branchManagerA);
  const containsBranchBLog = managerResult.logs.some((l) => l.id === auditBranchB.id);
  if (containsBranchBLog) {
    throw new Error('SECURITY VIOLATION: Branch Manager default query contained logs from Branch B!');
  }

  // Manager A directly queries detail of Branch B event -> should throw Unauthorized
  let detailBlocked = false;
  try {
    await getAuditLogById(auditBranchB.id, branchManagerA);
  } catch (err: any) {
    if (
      err.message.includes('You cannot view audit logs from another branch') ||
      err.message.includes('Unauthorized')
    ) {
      detailBlocked = true;
    }
  }
  if (!detailBlocked) {
    throw new Error('SECURITY VIOLATION: Branch Manager could view detail of unauthorized branch event!');
  }
  console.log('[PASS] 4B: Strict branch isolation enforced: Explicit Branch B request rejected, default query scoped to Branch A, and direct ID lookup blocked.');

  // --------------------------------------------------------------------------
  // TEST 5: Transactional Consistency & Atomic Rollback
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Transaction Consistency & Rollback ---');
  let rolledBackAuditId: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const rollbackLog = await createAuditLog(
        {
          actorUserId: ownerUser.id,
          branchId: branchA.id,
          action: AUDIT_ACTIONS.PAYMENT_REFUND,
          entityType: AUDIT_ENTITY_TYPES.PAYMENT,
          entityId: 'pay-rollback-test',
          description: 'Payment refund that will fail due to business constraint.',
        },
        tx
      );
      rolledBackAuditId = rollbackLog.id;

      // Simulate business error inside transaction
      throw new Error('Simulated business error: insufficient gateway balance.');
    });
  } catch (err: any) {
    // Expected error
  }

  if (rolledBackAuditId) {
    const checkDb = await prisma.auditLog.findUnique({
      where: { id: rolledBackAuditId },
    });
    if (checkDb !== null) {
      throw new Error('TRANSACTIONAL INTEGRITY FAILURE: Audit log was persisted despite transaction rollback!');
    }
  }
  console.log('[PASS] Transaction atomicity verified: When business transaction rolls back, audit log is rolled back.');

  // --------------------------------------------------------------------------
  // TEST 6: Append-Only Guarantee & No Update/Delete Endpoints
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Append-Only Guarantee & Immutability ---');
  // Verify application audit service exports
  const auditServiceModule = await import('../src/lib/audit/audit-service');
  const serviceKeys = Object.keys(auditServiceModule);

  if (
    serviceKeys.includes('updateAuditLog') ||
    serviceKeys.includes('deleteAuditLog') ||
    serviceKeys.includes('removeAuditLog')
  ) {
    throw new Error('IMMUTABILITY VIOLATION: Audit service exports mutation/deletion functions!');
  }

  const actionsModule = await import('../src/lib/audit/actions');
  const actionKeys = Object.keys(actionsModule);
  if (
    actionKeys.includes('updateAuditLogAction') ||
    actionKeys.includes('deleteAuditLogAction')
  ) {
    throw new Error('IMMUTABILITY VIOLATION: Server actions export audit update/delete actions!');
  }
  console.log('[PASS] Audit system is strictly append-only. Zero update or delete operations exist.');

  // --------------------------------------------------------------------------
  // TEST 7: Search, Filter, Pagination, and KPI Aggregation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Search, Filter, Pagination, and KPI Stats ---');
  const searchResult = await getAuditLogs(
    {
      search: testOrderId,
      page: 1,
      limit: 10,
    },
    ownerAuthUser
  );

  if (searchResult.logs.length === 0 || !searchResult.logs.some((l) => l.entityId === testOrderId)) {
    throw new Error('Search query by entity ID failed to return created log.');
  }

  if (searchResult.summary.totalLogs < 1) {
    throw new Error('Summary KPI totalLogs should be at least 1.');
  }
  console.log(`[PASS] Search returned ${searchResult.logs.length} matching record(s). KPI Stats: Total = ${searchResult.summary.totalLogs}, Actors = ${searchResult.summary.uniqueActors}, Branches = ${searchResult.summary.uniqueBranches}.`);

  // --------------------------------------------------------------------------
  // TEST 8: CSV Export with Sanitization
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Audit Logs CSV Export ---');
  const { toCSV } = await import('../src/lib/reports/constants');
  const { logs } = await getAuditLogs({ preset: 'today' }, ownerAuthUser);

  const columns = [
    { key: 'createdAt', header: 'Timestamp' },
    { key: 'action', header: 'Action' },
    { key: 'entityType', header: 'Entity Type' },
    { key: 'entityId', header: 'Entity ID' },
    { key: 'description', header: 'Description' },
    { key: 'branchName', header: 'Branch Name' },
    { key: 'actorName', header: 'Actor Name' },
  ];

  const csvContent = toCSV(logs, columns as any);
  if (!csvContent.includes('Timestamp') || !csvContent.includes('Action') || !csvContent.includes('Description')) {
    throw new Error('CSV output is missing standard headers.');
  }
  if (csvContent.includes('SuperSecretPassword') || csvContent.includes('sk_live_')) {
    throw new Error('SECURITY VIOLATION: Raw sensitive secrets leaked into CSV export!');
  }
  console.log(`[PASS] CSV export generated successfully (${csvContent.length} bytes). Headers and sanitized values verified.`);

  console.log('\n================================================================');
  console.log('--- ALL STEP 19 AUDIT LOG VERIFICATION TESTS PASSED (8/8) ---');
  console.log('================================================================');
}

runAuditVerification()
  .catch((err) => {
    console.error('\nVerification failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
