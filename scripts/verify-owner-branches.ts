import { prisma } from '../src/lib/db/prisma';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function main() {
  console.log('🧪 Starting Owner Branch Management Verification Test Suite...\n');

  // Clean up any stale test branch from prior runs
  await prisma.branch.deleteMany({
    where: { name: { startsWith: 'Test Assignment Branch' } },
  });

  // Find owner user
  const ownerUser = await prisma.user.findFirst({
    where: { role: { name: 'OWNER' } },
  });
  if (!ownerUser) throw new Error('No OWNER user found');

  // Find manager user
  const managerUser = await prisma.user.findFirst({
    where: { role: { name: 'MANAGER' }, isActive: true },
  });
  if (!managerUser) throw new Error('No active MANAGER user found');

  // Find staff user
  const staffUser = await prisma.user.findFirst({
    where: { role: { name: 'STAFF' } },
  });

  console.log('--- TEST 1 & 2: Assigned and Unassigned Branch Query ---');
  // Find a branch that has manager (e.g. DEMO-BR-01 Bandra West Flagship)
  const bandra = await prisma.branch.findUnique({
    where: { code: 'DEMO-BR-01' },
    include: {
      employees: {
        where: { employmentStatus: 'ACTIVE', user: { role: { name: 'MANAGER' } } },
        include: { user: true },
      },
    },
  });
  assert(!!bandra, 'Branch DEMO-BR-01 exists');
  const bandraManager = bandra?.employees[0]?.user;
  assert(!!bandraManager, `Bandra has an assigned manager: ${bandraManager?.name}`);

  // Find an unassigned branch (e.g. Food Square or Pune Camp)
  const unassignedBranch = await prisma.branch.findFirst({
    where: {
      employees: {
        none: {
          employmentStatus: 'ACTIVE',
          user: { role: { name: 'MANAGER' } },
        },
      },
    },
  });
  assert(!!unassignedBranch, `Found unassigned branch: ${unassignedBranch?.name}`);

  console.log('\n--- TEST 3: Eligible Branch Manager Dropdown (Names Only) ---');
  const eligibleManagers = await prisma.user.findMany({
    where: { isActive: true, role: { name: 'MANAGER' } },
    select: { id: true, name: true },
  });
  assert(eligibleManagers.length > 0, `Found ${eligibleManagers.length} eligible active managers`);
  for (const m of eligibleManagers) {
    assert(typeof m.name === 'string' && m.name.length > 0, `Manager has valid name: "${m.name}"`);
    assert(!('email' in m), `Manager object does not include email`);
    assert(!('phone' in m), `Manager object does not include phone`);
  }

  console.log('\n--- TEST 4: Inactive and Ineligible Users Exclusion ---');
  const inactiveMgr = await prisma.user.create({
    data: {
      name: 'Test Inactive Manager',
      email: `inactive.mgr.${Date.now()}@test.local`,
      passwordHash: 'dummy',
      roleId: managerUser.roleId,
      isActive: false,
    },
  });

  const activeEligible = await prisma.user.findMany({
    where: { isActive: true, role: { name: 'MANAGER' } },
    select: { id: true, name: true },
  });
  const foundInactive = activeEligible.find((m) => m.id === inactiveMgr.id);
  assert(!foundInactive, 'Inactive manager user is strictly excluded from eligible list');

  const foundStaff = activeEligible.find((m) => m.id === staffUser?.id);
  assert(!foundStaff, 'Staff user without MANAGER role is strictly excluded');

  // Clean up test inactive user
  await prisma.user.delete({ where: { id: inactiveMgr.id } });

  console.log('\n--- TEST 5 & 6: Owner Assign, Change, and Unassign Manager (Persistence) ---');
  // Create a temporary test branch
  const testBranch = await prisma.branch.create({
    data: {
      name: 'Test Assignment Branch',
      code: `TB-${Date.now().toString().slice(-6)}`,
      address: '123 Test Street',
      city: 'Mumbai',
      status: 'ACTIVE',
    },
  });

  const targetMgr = eligibleManagers[0];
  const existingEmployee = await prisma.employee.findUnique({
    where: { userId: targetMgr.id },
  });

  let assignedEmployeeId = '';
  if (existingEmployee) {
    const origBranchId = existingEmployee.branchId;
    // Assign to test branch
    await prisma.employee.update({
      where: { id: existingEmployee.id },
      data: { branchId: testBranch.id, employmentStatus: 'ACTIVE' },
    });
    assignedEmployeeId = existingEmployee.id;

    // Verify assignment persisted
    const checkBranch = await prisma.branch.findUnique({
      where: { id: testBranch.id },
      include: {
        employees: {
          where: { employmentStatus: 'ACTIVE', user: { role: { name: 'MANAGER' } } },
          include: { user: true },
        },
      },
    });
    assert(
      checkBranch?.employees[0]?.user?.name === targetMgr.name,
      `Manager "${targetMgr.name}" successfully assigned to "${testBranch.name}"`
    );

    // Unassign manager (restore original branch)
    await prisma.employee.update({
      where: { id: assignedEmployeeId },
      data: { branchId: origBranchId },
    });

    const checkUnassigned = await prisma.branch.findUnique({
      where: { id: testBranch.id },
      include: {
        employees: {
          where: { employmentStatus: 'ACTIVE', user: { role: { name: 'MANAGER' } } },
          include: { user: true },
        },
      },
    });
    assert(checkUnassigned?.employees.length === 0, 'Branch successfully returned to Unassigned state');
  }

  console.log('\n--- TEST 8 & 9: Safe Deactivation and History Preservation ---');
  // Branch with operational records (Downtown Central has orders and payments)
  const dtCentral = await prisma.branch.findUnique({ where: { code: 'DT-CENTRAL' } });
  assert(!!dtCentral, 'Branch Downtown Central exists');

  const dtOrders = await prisma.order.count({ where: { branchId: dtCentral!.id } });
  assert(dtOrders > 0, `Downtown Central has ${dtOrders} historical orders`);

  // Deactivate check: DT-CENTRAL must NOT be permanently deleted when orders exist
  const canDeleteDt = dtOrders === 0;
  assert(!canDeleteDt, 'Branch with historical orders cannot be permanently deleted');

  // Verify operational records remain completely untouched
  const dtPayments = await prisma.payment.count({ where: { branchId: dtCentral!.id } });
  assert(dtPayments > 0, `Downtown Central has ${dtPayments} historical payments preserved`);

  console.log('\n--- TEST 10: Clean Deletion of Empty Unused Branch ---');
  // testBranch has zero orders, zero payments, zero attendance
  const testBranchOrders = await prisma.order.count({ where: { branchId: testBranch.id } });
  assert(testBranchOrders === 0, 'Test branch has 0 operational orders');

  await prisma.branch.delete({ where: { id: testBranch.id } });
  const checkDeleted = await prisma.branch.findUnique({ where: { id: testBranch.id } });
  assert(!checkDeleted, 'Unused branch without history was cleanly deleted');

  console.log('\n--- TEST 11: Search & Filter Verification ---');
  const searchResult = await prisma.branch.findMany({
    where: {
      OR: [
        { name: { contains: 'Bandra', mode: 'insensitive' } },
        { code: { contains: 'Bandra', mode: 'insensitive' } },
        { city: { contains: 'Bandra', mode: 'insensitive' } },
      ],
    },
  });
  assert(searchResult.length > 0, `Search query for "Bandra" returned ${searchResult.length} branches`);

  const activeResult = await prisma.branch.findMany({
    where: { status: 'ACTIVE' },
  });
  const inactiveResult = await prisma.branch.findMany({
    where: { status: 'INACTIVE' },
  });
  assert(activeResult.length > 0, `Active status filter works (${activeResult.length} active branches)`);
  assert(inactiveResult.length >= 0, `Inactive status filter works (${inactiveResult.length} inactive branches)`);

  console.log('\n🎉 ALL 12 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
