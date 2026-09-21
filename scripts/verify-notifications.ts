import { prisma } from '../src/lib/db/prisma';
import { resolveEligibleRecipients, getUserBranchScope } from '../src/lib/notifications/recipient-resolver';
import {
  createNotification,
  createNotificationsForEligibleUsers,
  resolveNotificationsForEntity,
  getUnreadNotificationCount,
  markNotificationAsRead,
} from '../src/lib/notifications/notification-service';
import { evaluateAlerts } from '../src/lib/notifications/alert-service';
import { PERMISSIONS } from '../src/lib/permissions/definitions';

async function runTests() {
  console.log('--- Step 16: Notifications & Alerts Verification Tests ---');

  // Find sample users
  const ownerUser = await prisma.user.findFirst({
    where: { role: { name: 'OWNER' } },
  });

  const branch = await prisma.branch.findFirst({
    where: { status: 'ACTIVE' },
  });

  if (!ownerUser || !branch) {
    throw new Error('Test prerequisites not found (ownerUser or branch).');
  }

  console.log(`[PASS] Found Owner User: ${ownerUser.name} (${ownerUser.id})`);
  console.log(`[PASS] Found Branch: ${branch.name} (${branch.id})`);

  // Test 1: getUserBranchScope
  const ownerScope = await getUserBranchScope(ownerUser.id);
  if (!ownerScope.isAllBranches) {
    throw new Error('Owner scope should have isAllBranches: true');
  }
  console.log('[PASS] Owner has global branch scope (isAllBranches: true)');

  // Test 2: resolveEligibleRecipients for INVENTORY_READ
  const inventoryRecipients = await resolveEligibleRecipients(
    PERMISSIONS.INVENTORY_READ,
    branch.id
  );
  if (!inventoryRecipients.some((r) => r.id === ownerUser.id)) {
    throw new Error('Owner should be an eligible recipient for INVENTORY_READ');
  }
  console.log(`[PASS] Resolved ${inventoryRecipients.length} eligible recipients for INVENTORY_READ`);

  // Test 3: Notification Creation & Deduplication Key
  const testEntityId = `test-entity-${Date.now()}`;
  const notification1 = await createNotification({
    recipientUserId: ownerUser.id,
    branchId: branch.id,
    type: 'LOW_STOCK',
    severity: 'WARNING',
    title: 'Test Low Stock Alert',
    message: 'Test message for verification',
    entityType: 'InventoryItem',
    entityId: testEntityId,
    actionUrl: '/inventory',
  });

  if (!notification1) {
    throw new Error('Failed to create initial test notification');
  }
  console.log(`[PASS] Created notification with id: ${notification1.id}`);

  // Test 4: Duplicate Prevention
  const notificationDuplicate = await createNotification({
    recipientUserId: ownerUser.id,
    branchId: branch.id,
    type: 'LOW_STOCK',
    severity: 'WARNING',
    title: 'Test Low Stock Alert',
    message: 'Test message for verification',
    entityType: 'InventoryItem',
    entityId: testEntityId,
    actionUrl: '/inventory',
  });

  if (notificationDuplicate !== null) {
    throw new Error('Duplicate notification was created! Expected null due to dedupeKey.');
  }
  console.log('[PASS] Duplicate prevention confirmed (null returned on second creation)');

  // Test 5: Unread Notification Count
  const unreadCountBefore = await getUnreadNotificationCount(ownerUser.id);
  if (unreadCountBefore < 1) {
    throw new Error('Unread count should be >= 1 after notification creation');
  }
  console.log(`[PASS] Unread count correctly reports: ${unreadCountBefore}`);

  // Test 6: Mark As Read
  const markedRead = await markNotificationAsRead(ownerUser.id, notification1.id);
  if (!markedRead) {
    throw new Error('Failed to mark notification as read');
  }
  const unreadCountAfter = await getUnreadNotificationCount(ownerUser.id);
  if (unreadCountAfter !== unreadCountBefore - 1) {
    throw new Error('Unread count did not decrement after marking as read');
  }
  console.log('[PASS] Mark as read correctly updated status and decremented unread count');

  // Test 7: Auto-resolution on entity state change
  const resolvedCount = await resolveNotificationsForEntity('InventoryItem', testEntityId);
  if (resolvedCount < 1) {
    throw new Error('Failed to auto-resolve notification for entity');
  }
  console.log('[PASS] Auto-resolution marked notification as dismissed/resolved');

  // Test 8: Batch creation for eligible users
  const batchCreated = await createNotificationsForEligibleUsers({
    type: 'PENDING_EXPENSE_APPROVAL',
    severity: 'WARNING',
    title: 'Batch Verification Pending Expense',
    message: 'Testing batch eligible user notification creation',
    branchId: branch.id,
    entityType: 'Expense',
    entityId: `test-exp-${Date.now()}`,
    actionUrl: '/expenses',
    requiredPermission: PERMISSIONS.EXPENSE_APPROVE,
  });
  console.log(`[PASS] createNotificationsForEligibleUsers created ${batchCreated} notifications`);

  // Test 9: Alert Evaluation Engine
  const evalResult = await evaluateAlerts({ branchId: branch.id });
  console.log(`[PASS] evaluateAlerts completed safely:`, {
    evaluatedCount: evalResult.evaluatedCount,
    generatedCount: evalResult.generatedCount,
    resolvedCount: evalResult.resolvedCount,
  });

  // Test 10: Idempotent Alert Evaluation (Running twice produces zero new duplicates)
  const secondEval = await evaluateAlerts({ branchId: branch.id });
  if (secondEval.generatedCount !== 0) {
    throw new Error(`Second evaluation created ${secondEval.generatedCount} duplicates!`);
  }
  console.log('[PASS] Alert evaluation idempotency confirmed (0 duplicate notifications created on repeat scan)');

  // Clean up test records
  await prisma.notification.deleteMany({
    where: {
      entityId: { in: [testEntityId] },
    },
  });
  console.log('[PASS] Test cleanup completed');

  console.log('\n>>> ALL 10 TESTS PASSED SUCCESSFULLY! <<<');
}

runTests()
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
