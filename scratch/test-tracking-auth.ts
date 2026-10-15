import { prisma } from '../src/lib/db/prisma';
import {
  generateTrackingToken,
  hashTrackingToken,
  verifyTrackingToken,
  authorizeOrderAccess,
  rotateOrderTrackingToken,
  revokeOrderTrackingToken,
} from '../src/lib/customer/tracking-token';
import {
  createCustomerOrderAction,
  getCustomerOrderDetails,
} from '../src/lib/customer/order-actions';
import type { AuthUser } from '../src/lib/auth/types';

async function runTests() {
  console.log('=== STARTING ORDER TRACKING AUTHORIZATION TEST SUITE ===\n');
  let testsPassed = 0;
  let testsTotal = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    testsTotal++;
    if (condition) {
      console.log(`[PASS] Test ${testsTotal}: ${testName}`);
      testsPassed++;
    } else {
      console.error(`[FAIL] Test ${testsTotal}: ${testName}${details ? ` -> ${details}` : ''}`);
    }
  }

  // Find active branch and menu item to place test orders
  const branch = await prisma.branch.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  });

  if (!branch) {
    throw new Error('No active branch found in DB for testing');
  }

  const menuItem = await prisma.menuItem.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, price: true },
  });

  if (!menuItem) {
    throw new Error('No active menu item found in DB for testing');
  }

  console.log(`Using Test Branch: "${branch.name}" (${branch.id})`);
  console.log(`Using Test MenuItem: "${menuItem.name}" (₹${menuItem.price})\n`);

  // --- SUITE 1: Cryptographic Token Generation & Hashing ---
  console.log('--- Suite 1: Token Generation, Entropy & Constant-Time Hashing ---');
  const { token: t1, tokenHash: h1 } = generateTrackingToken();
  const { token: t2, tokenHash: h2 } = generateTrackingToken();

  assert(
    t1.length === 64 && /^[0-9a-f]{64}$/.test(t1),
    'Token is 256-bit hex (64 hex characters)'
  );
  assert(
    h1.length === 64 && /^[0-9a-f]{64}$/.test(h1),
    'Token hash is SHA-256 hex (64 hex characters)'
  );
  assert(t1 !== t2 && h1 !== h2, 'Consecutive tokens are uniquely random and unpredictable');
  assert(
    verifyTrackingToken(t1, h1) === true,
    'Valid token validates correctly against stored hash'
  );
  assert(
    verifyTrackingToken('wrong-token', h1) === false,
    'Invalid token rejected'
  );
  assert(
    verifyTrackingToken(t1, h2) === false,
    'Token does not validate against another token hash'
  );
  assert(
    verifyTrackingToken(null, h1) === false && verifyTrackingToken(t1, null) === false,
    'Null or undefined token/hash rejected'
  );

  // --- SUITE 2: Guest Order Creation & Private Tracking Link ---
  console.log('\n--- Suite 2: Guest Order Creation & Private Link Generation ---');
  const testPhone1 = `+9199999${Math.floor(10000 + Math.random() * 90000)}`;
  const testPhone2 = `+9199999${Math.floor(10000 + Math.random() * 90000)}`;

  const guestOrderRes1 = await createCustomerOrderAction({
    branchId: branch.id,
    orderType: 'TAKEAWAY',
    customerName: 'Guest Alice',
    customerPhone: testPhone1,
    items: [{ menuItemId: menuItem.id, quantity: 1 }],
    paymentMethod: 'CASH',
  });

  assert(
    guestOrderRes1.success && Boolean(guestOrderRes1.orderNumber),
    'Guest order 1 created successfully',
    guestOrderRes1.error
  );

  if (!guestOrderRes1.success || !guestOrderRes1.orderNumber) {
    throw new Error(`Failed to create guest order 1: ${guestOrderRes1.error}`);
  }

  const orderNum1 = guestOrderRes1.orderNumber;
  const rawToken1 = guestOrderRes1.trackingToken;
  const trackingUrl1 = guestOrderRes1.trackingUrl;

  assert(
    Boolean(rawToken1) && rawToken1?.length === 64,
    'Guest checkout returns raw tracking token (64 hex chars)'
  );
  assert(
    trackingUrl1 === `/track/${orderNum1}?token=${rawToken1}`,
    'Guest checkout returns valid private tracking URL with token'
  );

  // Verify DB record: only hash is stored, never raw token
  const dbOrder1 = await prisma.order.findUnique({
    where: { orderNumber: orderNum1 },
    select: { id: true, trackingTokenHash: true, orderNumber: true, branchId: true },
  });

  assert(
    Boolean(dbOrder1?.trackingTokenHash),
    'Order DB row contains trackingTokenHash'
  );
  assert(
    dbOrder1?.trackingTokenHash !== rawToken1,
    'Order DB row DOES NOT store the raw token in plaintext'
  );
  assert(
    dbOrder1?.trackingTokenHash === hashTrackingToken(rawToken1!),
    'Stored trackingTokenHash in DB exactly matches SHA-256 hash of raw token'
  );

  // Create Guest Order 2 for IDOR cross-testing
  const guestOrderRes2 = await createCustomerOrderAction({
    branchId: branch.id,
    orderType: 'TAKEAWAY',
    customerName: 'Guest Bob',
    customerPhone: testPhone2,
    items: [{ menuItemId: menuItem.id, quantity: 2 }],
    paymentMethod: 'CASH',
  });

  if (!guestOrderRes2.success || !guestOrderRes2.orderNumber) {
    throw new Error(`Failed to create guest order 2: ${guestOrderRes2.error}`);
  }

  const orderNum2 = guestOrderRes2.orderNumber;
  const rawToken2 = guestOrderRes2.trackingToken!;

  // --- SUITE 3: IDOR Prevention on getCustomerOrderDetails ---
  console.log('\n--- Suite 3: IDOR & Server-side Authorization on Tracking Details ---');

  // Case A: Valid token provides full order details
  const authorizedView = await getCustomerOrderDetails(orderNum1, rawToken1);
  assert(
    authorizedView !== null && authorizedView.orderNumber === orderNum1,
    'Valid token allows tracking access to order details'
  );
  assert(
    authorizedView?.items.length === 1 && authorizedView?.customerName === 'Guest Alice',
    'Authorized view returns correct items and fulfillment data'
  );

  // Case B: Public order number WITHOUT token is DENIED
  const unauthenticatedView = await getCustomerOrderDetails(orderNum1);
  assert(
    unauthenticatedView === null,
    'Public order number without token returns null (IDOR BLOCKED)'
  );

  // Case C: Order number with fake/invalid token is DENIED
  const fakeTokenView = await getCustomerOrderDetails(orderNum1, 'deadbeef12345678deadbeef12345678');
  assert(
    fakeTokenView === null,
    'Order lookup with invalid/fake token returns null'
  );

  // Case D: URL Tampering — Order 2 number with Order 1 token is DENIED
  const tamperedView = await getCustomerOrderDetails(orderNum2, rawToken1);
  assert(
    tamperedView === null,
    'Tampered URL: orderNum2 with token1 returns null (Cross-order token mismatch DENIED)'
  );

  // --- SUITE 4: Authenticated Customer Authorization ---
  console.log('\n--- Suite 4: Authenticated Customer Ownership & Isolation ---');

  const mockCustomerUserA: AuthUser = {
    id: 'user-customer-a',
    email: 'customera@test.com',
    name: 'Customer A',
    role: 'CUSTOMER',
    branchId: null,
    permissions: [],
    isActive: true,
  };

  const mockCustomerUserB: AuthUser = {
    id: 'user-customer-b',
    email: 'customerb@test.com',
    name: 'Customer B',
    role: 'CUSTOMER',
    branchId: null,
    permissions: [],
    isActive: true,
  };

  const orderSubjectOwnedByA = {
    id: 'order-a-id',
    orderNumber: 'OX-TEST-A',
    branchId: branch.id,
    customerId: 'customer-profile-a',
    createdBy: 'user-customer-a',
    trackingTokenHash: h1,
  };

  // Customer A accesses their own order without guest token
  const authOwnResult = await authorizeOrderAccess(orderSubjectOwnedByA, mockCustomerUserA);
  assert(
    authOwnResult.authorized === true,
    'Authenticated Customer A can access their own order without a guest token'
  );

  // Customer B attempts to access Customer A's order without token
  const authBBlockedResult = await authorizeOrderAccess(orderSubjectOwnedByA, mockCustomerUserB);
  assert(
    authBBlockedResult.authorized === false,
    'Customer B CANNOT access Customer A order without token (Broken Access Control BLOCKED)'
  );

  // Customer B attempts to use their own token to access Customer A's order
  const authBTamperedResult = await authorizeOrderAccess(orderSubjectOwnedByA, mockCustomerUserB, t2);
  assert(
    authBTamperedResult.authorized === false,
    'Customer B using their own token cannot access Customer A order'
  );

  // Customer B with Customer A's valid guest token CAN access (guest link sharing scenario)
  const authBSharedResult = await authorizeOrderAccess(orderSubjectOwnedByA, mockCustomerUserB, t1);
  assert(
    authBSharedResult.authorized === true,
    'Valid private tracking token works for recipient of shared tracking link'
  );

  // --- SUITE 5: Role-Based & Branch Manager Scoping ---
  console.log('\n--- Suite 5: Staff & Executive ERP Scoping ---');

  const mockBranchManagerSameBranch: AuthUser = {
    id: 'mgr-1',
    email: 'mgr@ovenxpress.com',
    name: 'Branch Manager',
    role: 'MANAGER',
    branchId: branch.id,
    permissions: [],
    isActive: true,
  };

  const mockBranchManagerOtherBranch: AuthUser = {
    id: 'mgr-2',
    email: 'othermgr@ovenxpress.com',
    name: 'Other Branch Manager',
    role: 'MANAGER',
    branchId: 'some-other-branch-id',
    permissions: [],
    isActive: true,
  };

  const mockExecutiveOwner: AuthUser = {
    id: 'owner-1',
    email: 'owner@ovenxpress.com',
    name: 'Owner',
    role: 'OWNER',
    branchId: null,
    permissions: [],
    isActive: true,
  };

  const mgrSameBranchAccess = await authorizeOrderAccess(orderSubjectOwnedByA, mockBranchManagerSameBranch);
  assert(
    mgrSameBranchAccess.authorized === true,
    'Branch manager assigned to order branch has authorized access'
  );

  const mgrOtherBranchAccess = await authorizeOrderAccess(orderSubjectOwnedByA, mockBranchManagerOtherBranch);
  assert(
    mgrOtherBranchAccess.authorized === false,
    'Branch manager from a DIFFERENT branch is DENIED access'
  );

  const ownerAccess = await authorizeOrderAccess(orderSubjectOwnedByA, mockExecutiveOwner);
  assert(
    ownerAccess.authorized === true,
    'Executive Owner has authorized access across all orders'
  );

  // --- SUITE 6: Token Rotation and Revocation ---
  console.log('\n--- Suite 6: Token Rotation & Revocation Policy ---');

  // Rotate token for Order 1
  const newRotatedToken = await rotateOrderTrackingToken(dbOrder1!.id);
  assert(
    Boolean(newRotatedToken) && newRotatedToken !== rawToken1,
    'rotateOrderTrackingToken produces a fresh random token'
  );

  // Old token should now be DENIED
  const oldTokenAfterRotation = await getCustomerOrderDetails(orderNum1, rawToken1);
  assert(
    oldTokenAfterRotation === null,
    'Old token is immediately DENIED after rotation'
  );

  // New token should now SUCCEED
  const newTokenAfterRotation = await getCustomerOrderDetails(orderNum1, newRotatedToken);
  assert(
    newTokenAfterRotation !== null && newTokenAfterRotation.orderNumber === orderNum1,
    'New rotated token grants tracking access'
  );

  // Revoke token for Order 1
  await revokeOrderTrackingToken(dbOrder1!.id);

  // Both old and new token should now be DENIED
  const revokedAccess = await getCustomerOrderDetails(orderNum1, newRotatedToken);
  assert(
    revokedAccess === null,
    'Tracking access is immediately DENIED after token revocation'
  );

  // Clean up test orders
  await prisma.orderItem.deleteMany({ where: { orderId: { in: [dbOrder1!.id, guestOrderRes2.orderId!] } } });
  await prisma.payment.deleteMany({ where: { orderId: { in: [dbOrder1!.id, guestOrderRes2.orderId!] } } });
  await prisma.orderAuditLog.deleteMany({ where: { orderId: { in: [dbOrder1!.id, guestOrderRes2.orderId!] } } });
  await prisma.order.deleteMany({ where: { id: { in: [dbOrder1!.id, guestOrderRes2.orderId!] } } });

  console.log('\n=== TEST SUITE SUMMARY ===');
  console.log(`Passed: ${testsPassed}/${testsTotal} (${Math.round((testsPassed / testsTotal) * 100)}%)`);

  if (testsPassed === testsTotal) {
    console.log('ALL VERIFICATION CRITERIA MET SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error('SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
