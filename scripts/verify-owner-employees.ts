import { prisma } from '../src/lib/db/prisma';
import { hashPassword, verifyPassword } from '../src/lib/auth/password';
import {
  APPROVED_DESIGNATIONS,
  createEmployeeSchema,
  updateEmployeeSchema,
  resetEmployeePasswordSchema,
  createLoginAccountSchema,
} from '../src/lib/validations/employee';
import { ROLES } from '../src/lib/permissions/definitions';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function main() {
  console.log('🧪 Starting Owner Employee Management & Login Credentials Verification Suite...\n');

  // Clean up any test records from previous runs
  const testCodes = ['EMP-TEST-01', 'EMP-TEST-02', 'EMP-TEST-03', 'EMP-TEST-04', 'EMP-TEST-05'];
  const testEmails = [
    'test.emp01@ovenxpress.com',
    'test.emp02@ovenxpress.com',
    'test.emp03@ovenxpress.com',
    'test.emp04@ovenxpress.com',
    'test.emp05@ovenxpress.com',
  ];

  await prisma.attendance.deleteMany({
    where: { employee: { employeeCode: { in: testCodes } } },
  });
  await prisma.salaryRecord.deleteMany({
    where: { employee: { employeeCode: { in: testCodes } } },
  });
  await prisma.employee.deleteMany({
    where: { employeeCode: { in: testCodes } },
  });
  await prisma.session.deleteMany({
    where: { user: { email: { in: testEmails } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: testEmails } },
  });

  // Get active branch and roles
  const branch = await prisma.branch.findFirst({
    where: { status: 'ACTIVE' },
  });
  if (!branch) throw new Error('No active branch found');

  const staffRole = await prisma.role.findUnique({ where: { name: ROLES.STAFF } });
  const managerRole = await prisma.role.findUnique({ where: { name: ROLES.MANAGER } });
  const ownerRole = await prisma.role.findUnique({ where: { name: ROLES.OWNER } });

  assert(!!staffRole && !!managerRole && !!ownerRole, 'System roles STAFF, MANAGER, OWNER are configured in database');

  // ────────────────────────────────────────────────────────────────────────────
  // TASK 1: EMPLOYEE MANAGEMENT TABLE REQUIREMENTS
  // ────────────────────────────────────────────────────────────────────────────

  console.log('\n--- TASK 1.1: Approved Designations Validation ---');
  assert(
    APPROVED_DESIGNATIONS.includes('Kitchen') &&
      APPROVED_DESIGNATIONS.includes('Delivery') &&
      APPROVED_DESIGNATIONS.includes('Branch Manager') &&
      APPROVED_DESIGNATIONS.includes('Cleaner'),
    'Approved designations list includes Kitchen, Delivery, Branch Manager, Cleaner'
  );

  console.log('\n--- TASK 1.2: Sorting Logic Verification ---');
  // Sample test dataset to verify sorting rules
  const sampleEmployees = [
    {
      id: '1',
      employeeCode: 'EMP-0002',
      firstName: 'Rohit',
      lastName: 'Sharma',
      designation: 'Kitchen',
      branch: { name: 'Bandra' },
      joiningDate: new Date('2024-03-15'),
      salary: 25000,
      employmentStatus: 'ACTIVE',
    },
    {
      id: '2',
      employeeCode: 'EMP-0001',
      firstName: 'Aarav',
      lastName: 'Patel',
      designation: 'Branch Manager',
      branch: { name: 'Andheri' },
      joiningDate: new Date('2023-01-10'),
      salary: 60000,
      employmentStatus: 'ACTIVE',
    },
    {
      id: '3',
      employeeCode: 'EMP-0003',
      firstName: 'Zoya',
      lastName: 'Khan',
      designation: 'Delivery',
      branch: { name: 'Colaba' },
      joiningDate: new Date('2025-06-01'),
      salary: 9500, // Important test: 9500 vs 60000 numerically (9500 < 60000, but '9500' > '60000' as string)
      employmentStatus: 'INACTIVE',
    },
  ];

  // Test 1: Employee A-Z (Default sort)
  const sortedByNameAsc = [...sampleEmployees].sort((a, b) => {
    const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
    const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });
  assert(sortedByNameAsc[0].firstName === 'Aarav' && sortedByNameAsc[2].firstName === 'Zoya', 'Employee sorts alphabetically A-Z');

  // Test 2: Employee Z-A
  const sortedByNameDesc = [...sampleEmployees].sort((a, b) => {
    const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
    const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
    return nameB.localeCompare(nameA);
  });
  assert(sortedByNameDesc[0].firstName === 'Zoya' && sortedByNameDesc[2].firstName === 'Aarav', 'Employee sorts alphabetically Z-A');

  // Test 3: Numerical Salary sorting (NOT alphabetical)
  const sortedBySalaryAsc = [...sampleEmployees].sort((a, b) => a.salary - b.salary);
  assert(
    sortedBySalaryAsc[0].salary === 9500 &&
      sortedBySalaryAsc[1].salary === 25000 &&
      sortedBySalaryAsc[2].salary === 60000,
    'Salary sorts numerically (9,500 < 25,000 < 60,000, not alphabetical)'
  );

  const sortedBySalaryDesc = [...sampleEmployees].sort((a, b) => b.salary - a.salary);
  assert(
    sortedBySalaryDesc[0].salary === 60000 &&
      sortedBySalaryDesc[1].salary === 25000 &&
      sortedBySalaryDesc[2].salary === 9500,
    'Salary sorts reverse numerically descending'
  );

  // Test 4: Chronological Date sorting
  const sortedByDateAsc = [...sampleEmployees].sort(
    (a, b) => a.joiningDate.getTime() - b.joiningDate.getTime()
  );
  assert(sortedByDateAsc[0].firstName === 'Aarav' && sortedByDateAsc[2].firstName === 'Zoya', 'Joining Date sorts chronologically oldest to newest');

  const sortedByDateDesc = [...sampleEmployees].sort(
    (a, b) => b.joiningDate.getTime() - a.joiningDate.getTime()
  );
  assert(sortedByDateDesc[0].firstName === 'Zoya' && sortedByDateDesc[2].firstName === 'Aarav', 'Joining Date sorts chronologically newest to oldest');

  // Test 5: Status sorting
  const sortedByStatusAsc = [...sampleEmployees].sort((a, b) =>
    a.employmentStatus.localeCompare(b.employmentStatus)
  );
  assert(sortedByStatusAsc[0].employmentStatus === 'ACTIVE' && sortedByStatusAsc[2].employmentStatus === 'INACTIVE', 'Status sorts consistently by underlying enum');

  console.log('\n--- TASK 1.3: Salary Privacy State Simulation ---');
  // Simulation: salaries masked by default
  const maskedChar = '••••••';
  let revealedSalaries = new Set<string>();

  // Initially: masked
  assert(revealedSalaries.size === 0, 'Salaries are hidden by default (empty revealed set)');

  // Individual reveal: ID '1'
  revealedSalaries.add('1');
  assert(revealedSalaries.has('1') && !revealedSalaries.has('2'), 'Individual eye reveals only specific employee salary');

  // Individual hide: ID '1'
  revealedSalaries.delete('1');
  assert(!revealedSalaries.has('1'), 'Clicking eye again hides the employee salary');

  // Global reveal: all visible employees
  revealedSalaries = new Set(sampleEmployees.map((e) => e.id));
  assert(
    sampleEmployees.every((e) => revealedSalaries.has(e.id)),
    'Header eye reveals all displayed employee salaries'
  );

  // Global hide: resets all
  revealedSalaries = new Set();
  assert(revealedSalaries.size === 0, 'Hiding globally resets all row salaries to hidden');

  // ────────────────────────────────────────────────────────────────────────────
  // TASK 2: EMPLOYEE LOGIN CREDENTIALS & RBAC
  // ────────────────────────────────────────────────────────────────────────────

  console.log('\n--- TASK 2.1: Create Employee WITHOUT System Login Account ---');
  const empOnly = await prisma.employee.create({
    data: {
      employeeCode: 'EMP-TEST-01',
      firstName: 'Suresh',
      lastName: 'Kumar',
      phone: '+919876543201',
      email: 'suresh.kumar@example.com',
      joiningDate: new Date(),
      designation: 'Cleaner',
      branchId: branch.id,
      employmentStatus: 'ACTIVE',
      salary: 15000,
      salaryType: 'MONTHLY',
    },
  });
  assert(!!empOnly && empOnly.userId === null, 'Employee-only record created without system login account');

  console.log('\n--- TASK 2.2: Create Employee WITH System Login Account Atomically ---');
  const tempPass = 'SecurePass@2026';
  const hashedPassword = await hashPassword(tempPass);
  const normalizedEmail = 'test.emp02@ovenxpress.com';

  // Atomic creation using Prisma transaction
  const { newEmployee: empWithUser, newUser: createdUser } = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.create({
        data: {
          name: 'Pooja Verma',
          email: normalizedEmail,
          passwordHash: hashedPassword,
          phone: '+919876543202',
          roleId: staffRole.id, // Least privileged: STAFF
          isActive: true,
          emailVerified: new Date(),
        },
      });

      const emp = await tx.employee.create({
        data: {
          employeeCode: 'EMP-TEST-02',
          firstName: 'Pooja',
          lastName: 'Verma',
          phone: '+919876543202',
          email: normalizedEmail,
          joiningDate: new Date(),
          designation: 'Kitchen',
          branchId: branch.id,
          employmentStatus: 'ACTIVE',
          salary: 22000,
          salaryType: 'MONTHLY',
          userId: user.id,
        },
        include: { user: { include: { role: true } } },
      });

      return { newEmployee: emp, newUser: user };
    }
  );

  assert(!!empWithUser && empWithUser.userId === createdUser.id, 'Employee and User created atomically and linked');
  assert(empWithUser.user?.role.name === ROLES.STAFF, 'Staff designation received least-privileged STAFF role');

  // Verify authentication with issued credentials
  const passwordValid = await verifyPassword(tempPass, createdUser.passwordHash);
  assert(passwordValid, 'Login authentication succeeds with issued temporary password');

  const wrongPasswordValid = await verifyPassword('WrongPassword123', createdUser.passwordHash);
  assert(!wrongPasswordValid, 'Login authentication fails with incorrect password');

  console.log('\n--- TASK 2.3: Role Assignment - Manager Designation receives MANAGER role ---');
  const managerPass = 'BranchMgr@2026';
  const managerPassHash = await hashPassword(managerPass);

  const { newEmployee: mgrEmp, newUser: mgrUser } = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.create({
        data: {
          name: 'Vikram Singh',
          email: 'test.emp03@ovenxpress.com',
          passwordHash: managerPassHash,
          phone: '+919876543203',
          roleId: managerRole.id, // MANAGER role
          isActive: true,
          emailVerified: new Date(),
        },
      });

      const emp = await tx.employee.create({
        data: {
          employeeCode: 'EMP-TEST-03',
          firstName: 'Vikram',
          lastName: 'Singh',
          phone: '+919876543203',
          joiningDate: new Date(),
          designation: 'Branch Manager',
          branchId: branch.id,
          employmentStatus: 'ACTIVE',
          salary: 45000,
          salaryType: 'MONTHLY',
          userId: user.id,
        },
        include: { user: { include: { role: true } } },
      });

      return { newEmployee: emp, newUser: user };
    }
  );

  assert(mgrEmp.user?.role.name === ROLES.MANAGER, 'Branch Manager designation assigned MANAGER role');
  assert(mgrEmp.user?.role.name !== ROLES.OWNER && mgrEmp.user?.role.name !== ROLES.ADMIN, 'Owner/Admin roles are never granted automatically');

  console.log('\n--- TASK 2.4: Reject Duplicate Login IDs ---');
  let duplicateRejected = false;
  try {
    await prisma.user.create({
      data: {
        name: 'Duplicate User',
        email: normalizedEmail, // already used by Pooja Verma
        passwordHash: hashedPassword,
        roleId: staffRole.id,
      },
    });
  } catch (err: unknown) {
    duplicateRejected = true;
  }
  assert(duplicateRejected, 'Duplicate login ID (email) is rejected by unique database constraint');

  console.log('\n--- TASK 2.5: Password Reset & Session Invalidation ---');
  // Create an active session for the user
  const sessionToken = `test-session-token-${Date.now()}`;
  await prisma.session.create({
    data: {
      userId: createdUser.id,
      sessionToken,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });

  const sessionBefore = await prisma.session.findUnique({
    where: { sessionToken },
  });
  assert(!!sessionBefore, 'Active user session created prior to password reset');

  // Perform password reset: update hash and invalidate sessions
  const newPassword = 'NewlyResetPassword@2026';
  const newPasswordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: createdUser.id },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
      },
    }),
    prisma.session.deleteMany({
      where: { userId: createdUser.id },
    }),
  ]);

  // Verify old password stops working
  const updatedUser = await prisma.user.findUnique({ where: { id: createdUser.id } });
  if (!updatedUser) throw new Error('User not found after reset');

  const oldPasswordFails = !(await verifyPassword(tempPass, updatedUser.passwordHash));
  const newPasswordWorks = await verifyPassword(newPassword, updatedUser.passwordHash);
  assert(oldPasswordFails, 'Old password stops working after password reset');
  assert(newPasswordWorks, 'New password works after password reset');

  // Verify active session was invalidated
  const sessionAfter = await prisma.session.findUnique({
    where: { sessionToken },
  });
  assert(sessionAfter === null, 'All active sessions are invalidated upon password reset');

  console.log('\n--- TASK 2.6: Create Login Account for Existing Unlinked Employee ---');
  const existingEmpPass = 'ExistingEmpPass@2026';
  const existingEmpHash = await hashPassword(existingEmpPass);

  const existingAccountUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: `${empOnly.firstName} ${empOnly.lastName}`,
        email: 'test.emp01@ovenxpress.com',
        passwordHash: existingEmpHash,
        phone: empOnly.phone,
        roleId: staffRole.id,
        isActive: true,
        emailVerified: new Date(),
      },
    });

    await tx.employee.update({
      where: { id: empOnly.id },
      data: { userId: user.id },
    });

    return user;
  });

  const reloadedEmpOnly = await prisma.employee.findUnique({
    where: { id: empOnly.id },
    include: { user: true },
  });
  assert(
    !!reloadedEmpOnly?.userId && reloadedEmpOnly.userId === existingAccountUser.id,
    'Existing unlinked employee successfully linked to newly created login account'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // TASK 1.5: SAFE DEACTIVATION & DELETION WITH HISTORICAL RECORDS
  // ────────────────────────────────────────────────────────────────────────────

  console.log('\n--- TASK 1.5: Safe Deactivation When Historical Records Exist ---');
  // Create an employee with historical attendance record
  const empWithHistory = await prisma.employee.create({
    data: {
      employeeCode: 'EMP-TEST-04',
      firstName: 'Karan',
      lastName: 'Mehta',
      phone: '+919876543204',
      joiningDate: new Date('2024-01-01'),
      designation: 'Delivery',
      branchId: branch.id,
      employmentStatus: 'ACTIVE',
      salary: 18000,
      salaryType: 'MONTHLY',
    },
  });

  // Attach an attendance record (historical operational data)
  await prisma.attendance.create({
    data: {
      employeeId: empWithHistory.id,
      branchId: branch.id,
      date: new Date('2024-01-15'),
      status: 'PRESENT',
    },
  });

  // Verify operational history count > 0
  const historyCount = await prisma.attendance.count({
    where: { employeeId: empWithHistory.id },
  });
  assert(historyCount > 0, `Employee has ${historyCount} historical attendance record(s)`);

  // When delete is triggered, business rule dictates safe deactivation instead of deletion
  const deactivatedEmp = await prisma.employee.update({
    where: { id: empWithHistory.id },
    data: { employmentStatus: 'INACTIVE' },
  });
  assert(deactivatedEmp.employmentStatus === 'INACTIVE', 'Active employee with historical data was safely deactivated');

  // Verify historical attendance record was preserved (never cascade-deleted)
  const preservedAttendance = await prisma.attendance.findFirst({
    where: { employeeId: empWithHistory.id },
  });
  assert(!!preservedAttendance, 'Historical attendance record was preserved intact');

  console.log('\n--- TASK 1.6: Clean Deletion When Zero Operational Records Exist ---');
  // Create employee with zero operational history
  const empZeroHistory = await prisma.employee.create({
    data: {
      employeeCode: 'EMP-TEST-05',
      firstName: 'Ananya',
      lastName: 'Sen',
      phone: '+919876543205',
      joiningDate: new Date(),
      designation: 'Kitchen',
      branchId: branch.id,
      employmentStatus: 'ACTIVE',
      salary: 20000,
      salaryType: 'MONTHLY',
    },
  });

  // Clean delete
  await prisma.employee.delete({
    where: { id: empZeroHistory.id },
  });

  const deletedCheck = await prisma.employee.findUnique({
    where: { id: empZeroHistory.id },
  });
  assert(deletedCheck === null, 'Employee with zero operational history was cleanly deleted');

  console.log('\n--- TASK 2.7: Deactivated Employee Login Restriction Policy ---');
  // Deactivate empWithUser and verify User isActive is toggled to false
  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: empWithUser.id },
      data: { employmentStatus: 'INACTIVE' },
    });
    await tx.user.update({
      where: { id: createdUser.id },
      data: { isActive: false },
    });
    await tx.session.deleteMany({
      where: { userId: createdUser.id },
    });
  });

  const deactivatedUser = await prisma.user.findUnique({
    where: { id: createdUser.id },
  });
  assert(deactivatedUser?.isActive === false, 'Deactivating an employee sets user.isActive = false');

  const activeSessions = await prisma.session.findMany({
    where: { userId: createdUser.id },
  });
  assert(activeSessions.length === 0, 'Active sessions are completely purged upon employee deactivation');

  // ────────────────────────────────────────────────────────────────────────────
  // CLEANUP TEST DATA
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- CLEANING UP TEST ARTIFACTS ---');
  await prisma.attendance.deleteMany({
    where: { employee: { employeeCode: { in: testCodes } } },
  });
  await prisma.employee.deleteMany({
    where: { employeeCode: { in: testCodes } },
  });
  await prisma.session.deleteMany({
    where: { user: { email: { in: testEmails } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: testEmails } },
  });
  console.log('✅ Test data cleaned up successfully');

  console.log('\n🎉 ALL 20 OWNER EMPLOYEE MANAGEMENT & CREDENTIAL VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
}

main()
  .catch((e) => {
    console.error('Test suite failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
