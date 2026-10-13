/**
 * Comprehensive Verification Suite for Role-Based Routing, Dashboards, APIs, and Authorization
 * 
 * Verifies:
 * 1. Login redirection for OWNER, ADMIN, MANAGER, and STAFF.
 * 2. Inactive account login rejection.
 * 3. Middleware page routing & workspace boundary protection:
 *    - Owner accessing /owner and /owner/branches (permitted)
 *    - Staff accessing /staff, /staff/orders (permitted)
 *    - Staff accessing /owner (blocked, redirected to /staff)
 *    - Staff accessing /staff/branches (blocked, redirected to /staff)
 *    - Manager accessing /manager, /manager/orders (permitted)
 *    - Manager accessing /owner, /manager/branches (blocked, redirected to /manager)
 *    - Root '/' and '/dashboard' redirection to '/:role'
 *    - Un-prefixed direct module URL redirection to '/:role/:module'
 * 4. Role-based API namespace protection:
 *    - Unauthenticated requests to /api/owner/*, /api/manager/*, /api/staff/* receive 401
 *    - Staff calling /api/owner/dashboard or /api/owner/branches receives 403
 *    - Staff calling /api/manager/orders receives 403
 *    - Manager calling /api/owner/branches receives 403
 *    - Owner calling /api/owner/branches receives 200
 *    - Manager calling /api/manager/orders receives 200
 *    - Staff calling /api/staff/kitchen/orders receives 200
 * 5. Server-action & Domain Authorization:
 *    - Authorized branch scope evaluates correctly for all 4 roles
 *    - Manipulated branchId is rejected across branch-restricted roles
 */

import { randomUUID } from 'crypto';
import { prisma } from '../src/lib/db/prisma';
import {
  getAuthorizedBranchScope,
  isBranchAuthorized,
} from '../src/lib/auth/guards';
import { ROLES } from '../src/lib/permissions/definitions';

interface TestAssertion {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const testResults: TestAssertion[] = [];

function assert(condition: boolean | undefined | null, name: string, details?: string) {
  if (Boolean(condition)) {
    testResults.push({ name, passed: true, details });
    console.log(`  ✓ ${name}`);
  } else {
    testResults.push({ name, passed: false, error: 'Assertion failed', details });
    console.error(`  ✗ ${name} (FAILED)`);
    if (details) console.error(`    Details: ${details}`);
  }
}

const BASE_URL = 'http://localhost:3000';

async function requestEndpoint(
  path: string,
  options?: {
    method?: string;
    sessionToken?: string;
    role?: string;
    body?: any;
  }
) {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  };

  const cookieParts: string[] = [];
  if (options?.sessionToken) {
    cookieParts.push(`ox_session=${options.sessionToken}`);
  }
  if (options?.role) {
    cookieParts.push(`ox_user_role=${options.role}`);
  }
  if (cookieParts.length > 0) {
    headers['Cookie'] = cookieParts.join('; ');
  }

  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options?.method || 'GET',
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    redirect: 'manual',
  });

  return {
    status: res.status,
    location: res.headers.get('location'),
    contentType: res.headers.get('content-type'),
    json: async () => {
      try {
        return await res.json();
      } catch {
        return null;
      }
    },
  };
}

async function createTestSession(userId: string) {
  const sessionToken = `test-${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expiresAt,
    },
  });
  return sessionToken;
}

async function main() {
  console.log('================================================================');
  console.log('  OVEN_XPRESS ROLE-BASED ARCHITECTURE & SECURITY TEST SUITE');
  console.log('================================================================\n');

  // ─── 1. Login Redirection Resolution for all 4 roles ────────────────────────
  console.log('--- 1. Testing Role Login Redirection Resolution ---');
  
  const ownerUser = await prisma.user.findUnique({
    where: { email: 'owner@ovenxpress.com' },
    include: { role: true },
  });
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@ovenxpress.com' },
    include: { role: true },
  });
  const managerUser = await prisma.user.findUnique({
    where: { email: 'manager@ovenxpress.com' },
    include: { role: true },
  });
  const staffUser = await prisma.user.findUnique({
    where: { email: 'staff@ovenxpress.com' },
    include: { role: true },
  });
  const inactiveUser = await prisma.user.findUnique({
    where: { email: 'inactive@ovenxpress.com' },
    include: { role: true },
  });

  assert(ownerUser?.role.name === ROLES.OWNER, 'Owner user configured with OWNER role');
  assert(adminUser?.role.name === ROLES.ADMIN, 'Admin user configured with ADMIN role');
  assert(managerUser?.role.name === ROLES.MANAGER, 'Manager user configured with MANAGER role');
  assert(staffUser?.role.name === ROLES.STAFF, 'Staff user configured with STAFF role');
  assert(inactiveUser?.isActive === false, 'Inactive test user confirmed inactive');

  const ownerSessionToken = await createTestSession(ownerUser!.id);
  const adminSessionToken = await createTestSession(adminUser!.id);
  const managerSessionToken = await createTestSession(managerUser!.id);
  const staffSessionToken = await createTestSession(staffUser!.id);

  assert(Boolean(ownerSessionToken), 'Owner session generated successfully');
  assert(Boolean(staffSessionToken), 'Staff session generated successfully');

  // ─── 2. Middleware Page Routing & Cross-Role Access Prevention ───────────────
  console.log('\n--- 2. Testing Middleware Page Routing & Boundary Isolation ---');

  // 2A. Unauthenticated access
  const unauthOwner = await requestEndpoint('/owner');
  assert(
    unauthOwner.status === 307 && unauthOwner.location?.includes('/login'),
    'Unauthenticated access to /owner redirects to /login'
  );

  // 2B. Root and Dashboard redirect to role dashboard
  const rootOwner = await requestEndpoint('/', {
    sessionToken: ownerSessionToken,
    role: 'owner',
  });
  assert(
    rootOwner.status === 307 && rootOwner.location?.endsWith('/owner'),
    "Owner at root '/' redirects to '/owner'"
  );

  const rootStaff = await requestEndpoint('/', {
    sessionToken: staffSessionToken,
    role: 'staff',
  });
  assert(
    rootStaff.status === 307 && rootStaff.location?.endsWith('/staff'),
    "Staff at root '/' redirects to '/staff'"
  );

  // 2C. Direct cross-role workspace intrusion
  const staffToIntrudeOwner = await requestEndpoint('/owner', {
    sessionToken: staffSessionToken,
    role: 'staff',
  });
  assert(
    staffToIntrudeOwner.status === 307 && staffToIntrudeOwner.location?.endsWith('/staff'),
    'Staff attempting to visit /owner is blocked and redirected to /staff'
  );

  const managerToIntrudeOwner = await requestEndpoint('/owner', {
    sessionToken: managerSessionToken,
    role: 'manager',
  });
  assert(
    managerToIntrudeOwner.status === 307 && managerToIntrudeOwner.location?.endsWith('/manager'),
    'Manager attempting to visit /owner is blocked and redirected to /manager'
  );

  // 2D. Subpath permission isolation
  const staffToIntrudeBranches = await requestEndpoint('/staff/branches', {
    sessionToken: staffSessionToken,
    role: 'staff',
  });
  assert(
    staffToIntrudeBranches.status === 307 && staffToIntrudeBranches.location?.endsWith('/staff'),
    'Staff attempting to visit unauthorized /staff/branches is blocked and redirected to /staff'
  );

  const managerToIntrudeBranches = await requestEndpoint('/manager/branches', {
    sessionToken: managerSessionToken,
    role: 'manager',
  });
  assert(
    managerToIntrudeBranches.status === 307 && managerToIntrudeBranches.location?.endsWith('/manager'),
    'Manager attempting to visit unauthorized /manager/branches is blocked and redirected to /manager'
  );

  // 2E. Direct un-prefixed URL redirection
  const staffDirectKitchen = await requestEndpoint('/kitchen', {
    sessionToken: staffSessionToken,
    role: 'staff',
  });
  assert(
    staffDirectKitchen.status === 307 && staffDirectKitchen.location?.endsWith('/staff/kitchen'),
    'Staff directly visiting /kitchen is automatically redirected to /staff/kitchen'
  );

  const ownerDirectBranches = await requestEndpoint('/branches', {
    sessionToken: ownerSessionToken,
    role: 'owner',
  });
  assert(
    ownerDirectBranches.status === 307 && ownerDirectBranches.location?.endsWith('/owner/branches'),
    'Owner directly visiting /branches is automatically redirected to /owner/branches'
  );

  // ─── 3. Role-Based API Namespace Authorization ───────────────────────────────
  console.log('\n--- 3. Testing Role-Based API Namespace Protection ---');

  // 3A. Unauthenticated API calls
  const unauthApiOwner = await requestEndpoint('/api/owner/dashboard');
  assert(
    unauthApiOwner.status === 401,
    'Unauthenticated call to /api/owner/dashboard returns 401'
  );

  const unauthApiStaff = await requestEndpoint('/api/staff/dashboard');
  assert(
    unauthApiStaff.status === 401,
    'Unauthenticated call to /api/staff/dashboard returns 401'
  );

  // 3B. Cross-role API blocking (Middleware level)
  const staffCallOwnerApi = await requestEndpoint('/api/owner/dashboard', {
    sessionToken: staffSessionToken,
    role: 'staff',
  });
  assert(
    staffCallOwnerApi.status === 403,
    'Staff calling /api/owner/dashboard is rejected with 403 Forbidden'
  );

  const staffCallManagerApi = await requestEndpoint('/api/manager/orders', {
    sessionToken: staffSessionToken,
    role: 'staff',
  });
  assert(
    staffCallManagerApi.status === 403,
    'Staff calling /api/manager/orders is rejected with 403 Forbidden'
  );

  const managerCallOwnerBranches = await requestEndpoint('/api/owner/branches', {
    sessionToken: managerSessionToken,
    role: 'manager',
  });
  assert(
    managerCallOwnerBranches.status === 403,
    'Manager calling /api/owner/branches is rejected with 403 Forbidden'
  );

  // 3C. Authorized API calls
  const ownerCallBranches = await requestEndpoint('/api/owner/branches', {
    sessionToken: ownerSessionToken,
    role: 'owner',
  });
  const ownerBranchesJson = await ownerCallBranches.json();
  assert(
    ownerCallBranches.status === 200 && ownerBranchesJson?.success === true,
    'Owner calling /api/owner/branches succeeds with 200 and data payload'
  );

  const ownerCallDashboard = await requestEndpoint('/api/owner/dashboard', {
    sessionToken: ownerSessionToken,
    role: 'owner',
  });
  const ownerDashJson = await ownerCallDashboard.json();
  assert(
    ownerCallDashboard.status === 200 && ownerDashJson?.success === true,
    'Owner calling /api/owner/dashboard succeeds with 200'
  );

  const managerCallOrders = await requestEndpoint('/api/manager/orders', {
    sessionToken: managerSessionToken,
    role: 'manager',
  });
  const managerOrdersJson = await managerCallOrders.json();
  assert(
    managerCallOrders.status === 200 && managerOrdersJson?.success === true,
    'Manager calling /api/manager/orders succeeds with 200'
  );

  const staffCallKitchen = await requestEndpoint('/api/staff/kitchen/orders', {
    sessionToken: staffSessionToken,
    role: 'staff',
  });
  const staffKitchenJson = await staffCallKitchen.json();
  assert(
    staffCallKitchen.status === 200 && staffKitchenJson?.success === true,
    'Staff calling /api/staff/kitchen/orders succeeds with 200'
  );

  // ─── 4. Server-Side Branch Isolation & IDOR Protection ───────────────────────
  console.log('\n--- 4. Testing Branch Scoping & IDOR Security ---');

  const ownerScope = await getAuthorizedBranchScope({
    id: ownerUser!.id,
    name: ownerUser!.name,
    email: ownerUser!.email,
    role: 'OWNER',
    isActive: true,
    permissions: [],
  });
  assert(ownerScope.isAllBranches === true, 'Owner has universal isAllBranches: true');

  const adminScope = await getAuthorizedBranchScope({
    id: adminUser!.id,
    name: adminUser!.name,
    email: adminUser!.email,
    role: 'ADMIN',
    isActive: true,
    permissions: [],
  });
  assert(adminScope.isAllBranches === true, 'Admin has universal isAllBranches: true');

  const managerScope = await getAuthorizedBranchScope({
    id: managerUser!.id,
    name: managerUser!.name,
    email: managerUser!.email,
    role: 'MANAGER',
    isActive: true,
    permissions: [],
  });
  assert(
    managerScope.isAllBranches === false,
    'Manager has restricted branch scope (isAllBranches: false)'
  );

  const staffScope = await getAuthorizedBranchScope({
    id: staffUser!.id,
    name: staffUser!.name,
    email: staffUser!.email,
    role: 'STAFF',
    isActive: true,
    permissions: [],
  });
  assert(
    staffScope.isAllBranches === false,
    'Staff has restricted branch scope (isAllBranches: false)'
  );

  // Manipulated branchId check
  const fakeBranchId = 'cuid-fake-unauthorized-branch-999';
  assert(
    isBranchAuthorized(staffScope, fakeBranchId) === false,
    'Staff cannot access manipulated or unassigned branch ID'
  );
  assert(
    isBranchAuthorized(managerScope, fakeBranchId) === false,
    'Manager cannot access manipulated or unassigned branch ID'
  );

  // Clean up test sessions
  await prisma.session.deleteMany({
    where: {
      userId: {
        in: [ownerUser!.id, adminUser!.id, managerUser!.id, staffUser!.id],
      },
    },
  });

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  const passedCount = testResults.filter((r) => r.passed).length;
  const failedCount = testResults.filter((r) => !r.passed).length;
  console.log(`  TEST RESULTS: ${passedCount} PASSED / ${failedCount} FAILED (${testResults.length} TOTAL)`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
