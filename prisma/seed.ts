import {
  PrismaClient,
  Prisma,
  BranchStatus,
  EmploymentStatus,
  SalaryType,
  ShiftStatus,
  AttendanceStatus,
  MenuStatus,
  IngredientUnit,
  InventoryStatus,
  StockTransactionType,
  WastageReason,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Permissions
  const permissionsData = [
    // Dashboard
    { code: 'dashboard.read', module: 'dashboard', description: 'View dashboard overview and metrics' },
    // Users
    { code: 'users.read', module: 'users', description: 'View user list and user profiles' },
    { code: 'users.create', module: 'users', description: 'Create new application users' },
    { code: 'users.update', module: 'users', description: 'Update existing user details' },
    { code: 'users.delete', module: 'users', description: 'Delete or deactivate users' },
    // Branch Management
    { code: 'branch.read', module: 'branch', description: 'View branch list and branch details' },
    { code: 'branch.create', module: 'branch', description: 'Create new restaurant branches' },
    { code: 'branch.update', module: 'branch', description: 'Update existing branch details' },
    { code: 'branch.deactivate', module: 'branch', description: 'Activate or deactivate branches' },
    // Employee Management
    { code: 'employee.read', module: 'employee', description: 'View employee directory and employee profiles' },
    { code: 'employee.create', module: 'employee', description: 'Create and onboard new restaurant employees' },
    { code: 'employee.update', module: 'employee', description: 'Update employee details and compensation' },
    { code: 'employee.deactivate', module: 'employee', description: 'Activate or deactivate restaurant employees' },
    // Attendance Management
    { code: 'attendance.read', module: 'attendance', description: 'View staff attendance records and daily summaries' },
    { code: 'attendance.create', module: 'attendance', description: 'Mark employee check-in, check-out, and attendance' },
    { code: 'attendance.update', module: 'attendance', description: 'Correct or update employee attendance records' },
    // Shift Management
    { code: 'shift.read', module: 'shift', description: 'View restaurant shift schedules' },
    { code: 'shift.create', module: 'shift', description: 'Create new shift schedules per branch' },
    { code: 'shift.update', module: 'shift', description: 'Update shift schedules and timing' },
    { code: 'shift.deactivate', module: 'shift', description: 'Activate or deactivate branch shifts' },
    // Settings
    { code: 'settings.read', module: 'settings', description: 'View system and branch settings' },
    { code: 'settings.update', module: 'settings', description: 'Modify system and branch settings' },
    // Menu Category Management
    { code: 'menu.category.read', module: 'menu', description: 'View menu categories' },
    { code: 'menu.category.create', module: 'menu', description: 'Create menu categories' },
    { code: 'menu.category.update', module: 'menu', description: 'Update menu categories' },
    { code: 'menu.category.deactivate', module: 'menu', description: 'Activate or deactivate menu categories' },
    // Ingredient Management
    { code: 'menu.ingredient.read', module: 'menu', description: 'View raw ingredients' },
    { code: 'menu.ingredient.create', module: 'menu', description: 'Create raw ingredients' },
    { code: 'menu.ingredient.update', module: 'menu', description: 'Update raw ingredients' },
    { code: 'menu.ingredient.deactivate', module: 'menu', description: 'Activate or deactivate raw ingredients' },
    // Menu Item Management
    { code: 'menu.item.read', module: 'menu', description: 'View menu items' },
    { code: 'menu.item.create', module: 'menu', description: 'Create menu items' },
    { code: 'menu.item.update', module: 'menu', description: 'Update menu items' },
    { code: 'menu.item.deactivate', module: 'menu', description: 'Activate or deactivate menu items' },
    // Recipe / BOM Management
    { code: 'menu.recipe.read', module: 'menu', description: 'View recipes and bills of materials' },
    { code: 'menu.recipe.create', module: 'menu', description: 'Create recipes and bills of materials' },
    { code: 'menu.recipe.update', module: 'menu', description: 'Update recipes and bills of materials' },
    // Branch Menu Availability & Pricing
    { code: 'menu.branch.read', module: 'menu', description: 'View branch menu availability and branch pricing' },
    { code: 'menu.branch.update', module: 'menu', description: 'Update branch menu availability and branch pricing' },
    // Inventory & Stock Management
    { code: 'inventory.read', module: 'inventory', description: 'View stock levels, alerts, and ledger history' },
    { code: 'inventory.create', module: 'inventory', description: 'Record opening stock and stock receipts' },
    { code: 'inventory.update', module: 'inventory', description: 'Update minimum stock and reorder thresholds' },
    { code: 'inventory.adjust', module: 'inventory', description: 'Perform manual stock adjustments' },
    { code: 'inventory.transfer', module: 'inventory', description: 'Execute branch-to-branch stock transfers' },
    { code: 'inventory.wastage', module: 'inventory', description: 'Log operational wastage and damaged stock' },
    { code: 'inventory.reconcile', module: 'inventory', description: 'Reconcile physical stock counts with system counts' },
    { code: 'inventory.deactivate', module: 'inventory', description: 'Activate or deactivate tracked inventory items' },
  ];

  console.log('  → Seeding permissions...');
  const permissionsMap = new Map<string, string>();
  for (const perm of permissionsData) {
    const record = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description, module: perm.module },
      create: perm,
    });
    permissionsMap.set(record.code, record.id);
  }

  // 2. Seed Roles
  const rolesData = [
    {
      name: 'OWNER',
      description: 'Restaurant Owner - Full system access across all modules and branches',
      permissions: [
        'dashboard.read',
        'users.read',
        'users.create',
        'users.update',
        'users.delete',
        'branch.read',
        'branch.create',
        'branch.update',
        'branch.deactivate',
        'employee.read',
        'employee.create',
        'employee.update',
        'employee.deactivate',
        'attendance.read',
        'attendance.create',
        'attendance.update',
        'shift.read',
        'shift.create',
        'shift.update',
        'shift.deactivate',
        'settings.read',
        'settings.update',
        'menu.category.read',
        'menu.category.create',
        'menu.category.update',
        'menu.category.deactivate',
        'menu.ingredient.read',
        'menu.ingredient.create',
        'menu.ingredient.update',
        'menu.ingredient.deactivate',
        'menu.item.read',
        'menu.item.create',
        'menu.item.update',
        'menu.item.deactivate',
        'menu.recipe.read',
        'menu.recipe.create',
        'menu.recipe.update',
        'menu.branch.read',
        'menu.branch.update',
        'inventory.read',
        'inventory.create',
        'inventory.update',
        'inventory.adjust',
        'inventory.transfer',
        'inventory.wastage',
        'inventory.reconcile',
        'inventory.deactivate',
      ],
    },
    {
      name: 'ADMIN',
      description: 'System Administrator - User, branch, and staff management without destructive owner controls',
      permissions: [
        'dashboard.read',
        'users.read',
        'users.create',
        'users.update',
        'branch.read',
        'branch.create',
        'branch.update',
        'employee.read',
        'employee.create',
        'employee.update',
        'employee.deactivate',
        'attendance.read',
        'attendance.create',
        'attendance.update',
        'shift.read',
        'shift.create',
        'shift.update',
        'shift.deactivate',
        'settings.read',
        'menu.category.read',
        'menu.category.create',
        'menu.category.update',
        'menu.category.deactivate',
        'menu.ingredient.read',
        'menu.ingredient.create',
        'menu.ingredient.update',
        'menu.ingredient.deactivate',
        'menu.item.read',
        'menu.item.create',
        'menu.item.update',
        'menu.item.deactivate',
        'menu.recipe.read',
        'menu.recipe.create',
        'menu.recipe.update',
        'menu.branch.read',
        'menu.branch.update',
        'inventory.read',
        'inventory.create',
        'inventory.update',
        'inventory.adjust',
        'inventory.transfer',
        'inventory.wastage',
        'inventory.reconcile',
        'inventory.deactivate',
      ],
    },
    {
      name: 'MANAGER',
      description: 'Branch Manager - Operational oversight, team reporting, and employee management',
      permissions: [
        'dashboard.read',
        'users.read',
        'branch.read',
        'employee.read',
        'employee.create',
        'employee.update',
        'attendance.read',
        'attendance.create',
        'attendance.update',
        'shift.read',
        'shift.create',
        'shift.update',
        'settings.read',
        'menu.category.read',
        'menu.ingredient.read',
        'menu.item.read',
        'menu.recipe.read',
        'menu.branch.read',
        'menu.branch.update',
        'inventory.read',
        'inventory.create',
        'inventory.update',
        'inventory.adjust',
        'inventory.transfer',
        'inventory.wastage',
        'inventory.reconcile',
      ],
    },
    {
      name: 'STAFF',
      description: 'Branch Staff - Operational tasks and shift view only',
      permissions: [
        'dashboard.read',
        'branch.read',
        'menu.category.read',
        'menu.item.read',
        'inventory.read',
      ],
    },
  ];

  console.log('  → Seeding roles and role-permissions...');
  const rolesMap = new Map<string, string>();
  for (const roleData of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      update: { description: roleData.description },
      create: {
        name: roleData.name,
        description: roleData.description,
      },
    });
    rolesMap.set(role.name, role.id);

    // Link permissions to role
    for (const permCode of roleData.permissions) {
      const permId = permissionsMap.get(permCode);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permId,
          },
        });
      }
    }
  }

  // 3. Seed Users with environment variable credentials (or safe dev defaults)
  const usersToSeed = [
    {
      name: 'Sarah Jenkins (Owner)',
      email: process.env.SEED_OWNER_EMAIL || 'owner@ovenxpress.com',
      password: process.env.SEED_OWNER_PASSWORD || 'Owner123!',
      roleName: 'OWNER',
      isActive: true,
    },
    {
      name: 'Marcus Vance (Admin)',
      email: process.env.SEED_ADMIN_EMAIL || 'admin@ovenxpress.com',
      password: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
      roleName: 'ADMIN',
      isActive: true,
    },
    {
      name: 'Elena Rostova (Manager)',
      email: process.env.SEED_MANAGER_EMAIL || 'manager@ovenxpress.com',
      password: process.env.SEED_MANAGER_PASSWORD || 'Manager123!',
      roleName: 'MANAGER',
      isActive: true,
    },
    {
      name: 'David Chen (Staff)',
      email: process.env.SEED_STAFF_EMAIL || 'staff@ovenxpress.com',
      password: process.env.SEED_STAFF_PASSWORD || 'Staff123!',
      roleName: 'STAFF',
      isActive: true,
    },
    {
      name: 'Inactive User (Test)',
      email: process.env.SEED_INACTIVE_EMAIL || 'inactive@ovenxpress.com',
      password: process.env.SEED_INACTIVE_PASSWORD || 'Inactive123!',
      roleName: 'STAFF',
      isActive: false,
    },
  ];

  console.log('  → Seeding development users...');
  for (const u of usersToSeed) {
    const roleId = rolesMap.get(u.roleName);
    if (!roleId) continue;

    const passwordHash = await hashPassword(u.password);

    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash,
        roleId,
        isActive: u.isActive,
      },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        roleId,
        isActive: u.isActive,
      },
    });
    console.log(`    ✓ [${u.roleName}] ${u.email} (active: ${u.isActive})`);
  }

  // 4. Seed Sample Branches
  const branchesData: Prisma.BranchCreateInput[] = [
    {
      name: 'Downtown Central',
      code: 'DT-CENTRAL',
      description: 'Flagship location in the heart of downtown, serving since 2020.',
      address: '42 MG Road, Fort Area',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      phone: '+91 22 2345 6789',
      email: 'downtown@ovenxpress.com',
      openingTime: '09:00',
      closingTime: '23:00',
      status: BranchStatus.ACTIVE,
    },
    {
      name: 'Bandra West',
      code: 'BW-001',
      description: 'Popular suburban branch near Linking Road.',
      address: '15 Hill Road, Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400050',
      phone: '+91 22 2678 1234',
      email: 'bandra@ovenxpress.com',
      openingTime: '10:00',
      closingTime: '22:30',
      status: BranchStatus.ACTIVE,
    },
    {
      name: 'Andheri Hub',
      code: 'AND-HUB',
      description: 'High-traffic location near Andheri station, perfect for office crowd.',
      address: '88 SV Road, Andheri West',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400058',
      phone: '+91 22 2634 5678',
      email: 'andheri@ovenxpress.com',
      openingTime: '08:00',
      closingTime: '23:30',
      status: BranchStatus.ACTIVE,
    },
    {
      name: 'Pune Camp',
      code: 'PUNE-CAMP',
      description: 'First expansion outside Mumbai. Currently undergoing renovation.',
      address: '5 East Street, Camp',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      phone: '+91 20 2612 3456',
      email: 'pune@ovenxpress.com',
      openingTime: '10:00',
      closingTime: '22:00',
      status: BranchStatus.INACTIVE,
    },
  ];

  console.log('  → Seeding sample branches...');
  for (const b of branchesData) {
    await prisma.branch.upsert({
      where: { code: b.code },
      update: {
        name: b.name,
        description: b.description,
        address: b.address,
        city: b.city,
        state: b.state,
        postalCode: b.postalCode,
        phone: b.phone,
        email: b.email,
        openingTime: b.openingTime,
        closingTime: b.closingTime,
        status: b.status,
      },
      create: b,
    });
    console.log(`    ✓ [${b.status}] ${b.name} (${b.code})`);
  }

  // 5. Seed Sample Employees
  console.log('  → Seeding sample employees...');
  const dtBranch = await prisma.branch.findUnique({ where: { code: 'DT-CENTRAL' } });
  const bwBranch = await prisma.branch.findUnique({ where: { code: 'BW-001' } });
  const andBranch = await prisma.branch.findUnique({ where: { code: 'AND-HUB' } });
  const puneBranch = await prisma.branch.findUnique({ where: { code: 'PUNE-CAMP' } });

  const managerEmail = process.env.SEED_MANAGER_EMAIL || 'manager@ovenxpress.com';
  const staffEmail = process.env.SEED_STAFF_EMAIL || 'staff@ovenxpress.com';

  const managerUser = await prisma.user.findUnique({ where: { email: managerEmail } });
  const staffUser = await prisma.user.findUnique({ where: { email: staffEmail } });

  if (!dtBranch || !bwBranch || !andBranch || !puneBranch) {
    throw new Error('Required seeded branches were not found to seed employees, shifts, and attendance.');
  }

  const employeesData: Prisma.EmployeeUncheckedCreateInput[] = [
    {
      employeeCode: 'EMP-0001',
      firstName: 'Elena',
      lastName: 'Rostova',
      phone: '+91 98201 11223',
      email: managerEmail,
      joiningDate: new Date('2022-03-15'),
      designation: 'General Manager',
      branchId: dtBranch.id,
      employmentStatus: EmploymentStatus.ACTIVE,
      salary: 65000,
      salaryType: SalaryType.MONTHLY,
      address: '14 Marine Drive, Nariman Point, Mumbai',
      emergencyContactName: 'Sergei Rostov',
      emergencyContactPhone: '+91 98201 99887',
      userId: managerUser?.id ?? null,
    },
    {
      employeeCode: 'EMP-0002',
      firstName: 'David',
      lastName: 'Chen',
      phone: '+91 98334 22334',
      email: staffEmail,
      joiningDate: new Date('2023-06-01'),
      designation: 'Senior Server',
      branchId: dtBranch.id,
      employmentStatus: EmploymentStatus.ACTIVE,
      salary: 25000,
      salaryType: SalaryType.MONTHLY,
      address: '22 Colaba Causeway, Mumbai',
      emergencyContactName: 'Mei Chen',
      emergencyContactPhone: '+91 98334 88776',
      userId: staffUser?.id ?? null,
    },
    {
      employeeCode: 'EMP-0003',
      firstName: 'Rajesh',
      lastName: 'Kumar',
      phone: '+91 98112 33445',
      email: 'rajesh.chef@ovenxpress.com',
      joiningDate: new Date('2021-01-10'),
      designation: 'Head Chef',
      branchId: dtBranch.id,
      employmentStatus: EmploymentStatus.ACTIVE,
      salary: 55000,
      salaryType: SalaryType.MONTHLY,
      address: '5 Sion West, Mumbai',
      emergencyContactName: 'Sunita Kumar',
      emergencyContactPhone: '+91 98112 77665',
      userId: null,
    },
    {
      employeeCode: 'EMP-0004',
      firstName: 'Amit',
      lastName: 'Patel',
      phone: '+91 98765 44321',
      email: 'amit.p@ovenxpress.com',
      joiningDate: new Date('2023-11-20'),
      designation: 'Delivery Staff',
      branchId: bwBranch.id,
      employmentStatus: EmploymentStatus.ACTIVE,
      salary: 150,
      salaryType: SalaryType.HOURLY,
      address: '77 Bandra Bazaar, Mumbai',
      emergencyContactName: 'Ramesh Patel',
      emergencyContactPhone: '+91 98765 11223',
      userId: null,
    },
    {
      employeeCode: 'EMP-0005',
      firstName: 'Priya',
      lastName: 'Sharma',
      phone: '+91 98920 55667',
      email: 'priya.s@ovenxpress.com',
      joiningDate: new Date('2024-01-05'),
      designation: 'Cashier & Front Desk',
      branchId: andBranch.id,
      employmentStatus: EmploymentStatus.ACTIVE,
      salary: 28000,
      salaryType: SalaryType.MONTHLY,
      address: '102 Lokhandwala, Andheri, Mumbai',
      emergencyContactName: 'Anil Sharma',
      emergencyContactPhone: '+91 98920 11234',
      userId: null,
    },
    {
      employeeCode: 'EMP-0006',
      firstName: 'Vikram',
      lastName: 'Singh',
      phone: '+91 98231 66778',
      email: 'vikram.s@ovenxpress.com',
      joiningDate: new Date('2023-04-12'),
      designation: 'Kitchen Assistant',
      branchId: puneBranch.id,
      employmentStatus: EmploymentStatus.INACTIVE,
      salary: 22000,
      salaryType: SalaryType.MONTHLY,
      address: '34 Koregaon Park, Pune',
      emergencyContactName: 'Geeta Singh',
      emergencyContactPhone: '+91 98231 99001',
      userId: null,
    },
  ];

  for (const emp of employeesData) {
    await prisma.employee.upsert({
      where: { employeeCode: emp.employeeCode },
      update: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        phone: emp.phone,
        email: emp.email,
        joiningDate: emp.joiningDate,
        designation: emp.designation,
        branchId: emp.branchId,
        employmentStatus: emp.employmentStatus,
        salary: emp.salary,
        salaryType: emp.salaryType,
        address: emp.address,
        emergencyContactName: emp.emergencyContactName,
        emergencyContactPhone: emp.emergencyContactPhone,
        userId: emp.userId,
      },
      create: emp,
    });
    console.log(`    ✓ [${emp.employmentStatus}] ${emp.firstName} ${emp.lastName} (${emp.employeeCode}) - ${emp.designation}`);
  }

  // 6. Seed Shifts
  console.log('  → Seeding sample shifts...');
  const shiftsData: Prisma.ShiftUncheckedCreateInput[] = [
    {
      name: 'Morning Shift',
      branchId: dtBranch.id,
      startTime: '08:00',
      endTime: '16:00',
      status: ShiftStatus.ACTIVE,
    },
    {
      name: 'Evening Shift',
      branchId: dtBranch.id,
      startTime: '15:00',
      endTime: '23:00',
      status: ShiftStatus.ACTIVE,
    },
    {
      name: 'Full Day Shift',
      branchId: bwBranch.id,
      startTime: '10:00',
      endTime: '19:00',
      status: ShiftStatus.ACTIVE,
    },
    {
      name: 'Night Shift',
      branchId: bwBranch.id,
      startTime: '18:00',
      endTime: '02:00',
      status: ShiftStatus.ACTIVE,
    },
    {
      name: 'General Shift',
      branchId: andBranch.id,
      startTime: '09:00',
      endTime: '18:00',
      status: ShiftStatus.ACTIVE,
    },
  ];

  const seededShifts: Record<string, string> = {};
  for (const s of shiftsData) {
    const existing = await prisma.shift.findFirst({
      where: { name: s.name, branchId: s.branchId },
    });
    const record = existing
      ? await prisma.shift.update({
          where: { id: existing.id },
          data: s as Prisma.ShiftUncheckedUpdateInput,
        })
      : await prisma.shift.create({ data: s });
    seededShifts[`${s.branchId}_${s.name}`] = record.id;
    console.log(`    ✓ [${record.status}] ${record.name} (${s.startTime} - ${s.endTime})`);
  }

  // Assign current shifts to employees
  const dtMorningShiftId = seededShifts[`${dtBranch.id}_Morning Shift`];
  const dtEveningShiftId = seededShifts[`${dtBranch.id}_Evening Shift`];
  const bwFullDayShiftId = seededShifts[`${bwBranch.id}_Full Day Shift`];
  const andGeneralShiftId = seededShifts[`${andBranch.id}_General Shift`];

  if (dtMorningShiftId) {
    await prisma.employee.updateMany({
      where: { employeeCode: { in: ['EMP-0001', 'EMP-0003'] } },
      data: { currentShiftId: dtMorningShiftId },
    });
  }
  if (dtEveningShiftId) {
    await prisma.employee.updateMany({
      where: { employeeCode: 'EMP-0002' },
      data: { currentShiftId: dtEveningShiftId },
    });
  }
  if (bwFullDayShiftId) {
    await prisma.employee.updateMany({
      where: { employeeCode: 'EMP-0004' },
      data: { currentShiftId: bwFullDayShiftId },
    });
  }
  if (andGeneralShiftId) {
    await prisma.employee.updateMany({
      where: { employeeCode: 'EMP-0005' },
      data: { currentShiftId: andGeneralShiftId },
    });
  }

  // 7. Seed Attendance Records for Today
  console.log('  → Seeding sample attendance records...');
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  const emp1 = await prisma.employee.findUnique({ where: { employeeCode: 'EMP-0001' } });
  const emp2 = await prisma.employee.findUnique({ where: { employeeCode: 'EMP-0002' } });
  const emp3 = await prisma.employee.findUnique({ where: { employeeCode: 'EMP-0003' } });
  const emp4 = await prisma.employee.findUnique({ where: { employeeCode: 'EMP-0004' } });
  const emp5 = await prisma.employee.findUnique({ where: { employeeCode: 'EMP-0005' } });

  if (emp1 && dtMorningShiftId) {
    const checkIn1 = new Date(today);
    checkIn1.setHours(7, 55, 0, 0);
    const data: Prisma.AttendanceUncheckedCreateInput = {
      employeeId: emp1.id,
      branchId: dtBranch.id,
      shiftId: dtMorningShiftId,
      date: today,
      status: AttendanceStatus.PRESENT,
      checkIn: checkIn1,
      checkOut: null,
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
      note: 'On time for morning opening',
      markedBy: 'System Auto-CheckIn',
    };
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: emp1.id, date: today } },
      update: data as Prisma.AttendanceUncheckedUpdateInput,
      create: data,
    });
  }

  if (emp2 && dtEveningShiftId) {
    const checkIn2 = new Date(today);
    checkIn2.setHours(15, 17, 0, 0); // 17 mins late
    const data: Prisma.AttendanceUncheckedCreateInput = {
      employeeId: emp2.id,
      branchId: dtBranch.id,
      shiftId: dtEveningShiftId,
      date: today,
      status: AttendanceStatus.PRESENT,
      checkIn: checkIn2,
      checkOut: null,
      lateMinutes: 17,
      earlyDepartureMinutes: 0,
      note: 'Delayed due to metro signal delay',
      markedBy: 'Elena Rostova',
    };
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: emp2.id, date: today } },
      update: data as Prisma.AttendanceUncheckedUpdateInput,
      create: data,
    });
  }

  if (emp3 && dtMorningShiftId) {
    const checkIn3 = new Date(today);
    checkIn3.setHours(8, 0, 0, 0);
    const data: Prisma.AttendanceUncheckedCreateInput = {
      employeeId: emp3.id,
      branchId: dtBranch.id,
      shiftId: dtMorningShiftId,
      date: today,
      status: AttendanceStatus.PRESENT,
      checkIn: checkIn3,
      checkOut: null,
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
      note: 'Breakfast kitchen prep',
      markedBy: 'System Auto-CheckIn',
    };
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: emp3.id, date: today } },
      update: data as Prisma.AttendanceUncheckedUpdateInput,
      create: data,
    });
  }

  if (emp4 && bwFullDayShiftId) {
    const checkIn4 = new Date(today);
    checkIn4.setHours(10, 0, 0, 0);
    const checkOut4 = new Date(today);
    checkOut4.setHours(14, 0, 0, 0); // Half-day
    const data: Prisma.AttendanceUncheckedCreateInput = {
      employeeId: emp4.id,
      branchId: bwBranch.id,
      shiftId: bwFullDayShiftId,
      date: today,
      status: AttendanceStatus.HALF_DAY,
      checkIn: checkIn4,
      checkOut: checkOut4,
      lateMinutes: 0,
      earlyDepartureMinutes: 300,
      note: 'Approved personal emergency half-day',
      markedBy: 'Marcus Vance',
    };
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: emp4.id, date: today } },
      update: data as Prisma.AttendanceUncheckedUpdateInput,
      create: data,
    });
  }

  if (emp5 && andGeneralShiftId) {
    const data: Prisma.AttendanceUncheckedCreateInput = {
      employeeId: emp5.id,
      branchId: andBranch.id,
      shiftId: andGeneralShiftId,
      date: today,
      status: AttendanceStatus.LEAVE,
      checkIn: null,
      checkOut: null,
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
      note: 'Pre-approved medical leave',
      markedBy: 'Sarah Jenkins',
    };
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: emp5.id, date: today } },
      update: data as Prisma.AttendanceUncheckedUpdateInput,
      create: data,
    });
 }

  // 8. Seed Menu Categories, Ingredients, Menu Items, Branch Availability, and Recipe BOMs
  console.log('  → Seeding menu categories...');
  const categoriesData = [
    { name: 'Pizzas', description: 'Freshly baked artisanal stone-oven pizzas', sortOrder: 1 },
    { name: 'Burgers', description: 'Gourmet handcrafted burgers with premium brioche buns', sortOrder: 2 },
    { name: 'Sides & Appetizers', description: 'Crispy finger foods and accompaniment sides', sortOrder: 3 },
    { name: 'Beverages', description: 'Specialty espresso, cold drinks, and refreshments', sortOrder: 4 },
    { name: 'Desserts', description: 'Housemade sweet treats and ice creams', sortOrder: 5 },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoriesData) {
    const record = await prisma.menuCategory.upsert({
      where: { name: cat.name },
      update: { description: cat.description, sortOrder: cat.sortOrder },
      create: {
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
        status: MenuStatus.ACTIVE,
      },
    });
    categoryMap.set(cat.name, record.id);
    console.log(`    ✓ Category: ${record.name}`);
  }

  console.log('  → Seeding raw ingredients with centralized units...');
  const ingredientsData: { name: string; description: string; unit: IngredientUnit }[] = [
    { name: 'Pizza Dough', description: 'Fermented artisanal pizza dough balls', unit: IngredientUnit.KG },
    { name: 'Mozzarella Cheese', description: 'Fresh shredded full-cream mozzarella', unit: IngredientUnit.KG },
    { name: 'Tomato Sauce', description: 'San Marzano seasoned pizza sauce', unit: IngredientUnit.LITRE },
    { name: 'Pepperoni', description: 'Cured and sliced beef pepperoni', unit: IngredientUnit.KG },
    { name: 'Burger Bun', description: 'Toasted sesame brioche buns', unit: IngredientUnit.PIECE },
    { name: 'Beef Patty', description: '150g prime Angus beef seasoned patty', unit: IngredientUnit.PIECE },
    { name: 'Cheddar Cheese Slice', description: 'Aged sharp yellow cheddar slice', unit: IngredientUnit.PIECE },
    { name: 'Special Burger Sauce', description: 'House tangy mayonnaise blend', unit: IngredientUnit.ML },
    { name: 'Iceberg Lettuce', description: 'Crisp shredded iceberg lettuce', unit: IngredientUnit.GRAM },
    { name: 'Red Onion', description: 'Freshly thinly sliced red onions', unit: IngredientUnit.GRAM },
    { name: 'Potato Fries', description: 'Cut and blanched russet potatoes', unit: IngredientUnit.KG },
    { name: 'Cooking Oil', description: 'High-smoke-point pure vegetable frying oil', unit: IngredientUnit.LITRE },
    { name: 'Table Salt', description: 'Fine sea salt seasoning', unit: IngredientUnit.GRAM },
    { name: 'Espresso Coffee Beans', description: 'Dark roasted Arabica blend beans', unit: IngredientUnit.KG },
    { name: 'Whole Milk', description: 'Pasteurized whole milk 3.5% fat', unit: IngredientUnit.LITRE },
    { name: 'Fudge Brownie', description: 'Rich Belgian chocolate baked brownie', unit: IngredientUnit.PIECE },
    { name: 'Vanilla Ice Cream', description: 'Madagascar vanilla bean dairy ice cream', unit: IngredientUnit.ML },
  ];

  const ingredientMap = new Map<string, string>();
  for (const ing of ingredientsData) {
    const record = await prisma.ingredient.upsert({
      where: { name: ing.name },
      update: { description: ing.description, unit: ing.unit },
      create: {
        name: ing.name,
        description: ing.description,
        unit: ing.unit,
        status: MenuStatus.ACTIVE,
      },
    });
    ingredientMap.set(ing.name, record.id);
    console.log(`    ✓ Ingredient: ${record.name} (${record.unit})`);
  }

  console.log('  → Seeding menu items...');
  const menuItemsData = [
    {
      name: 'Margherita Pizza',
      description: 'Classic Italian pizza with tomato sauce, fresh mozzarella, and aromatic basil olive oil.',
      categoryName: 'Pizzas',
      price: new Prisma.Decimal('12.99'),
      preparationTimeMinutes: 15,
      recipe: [
        { ingredient: 'Pizza Dough', quantity: new Prisma.Decimal('0.250'), unit: IngredientUnit.KG, notes: 'Stretched to 12 inches' },
        { ingredient: 'Tomato Sauce', quantity: new Prisma.Decimal('0.100'), unit: IngredientUnit.LITRE, notes: 'Evenly spread' },
        { ingredient: 'Mozzarella Cheese', quantity: new Prisma.Decimal('0.150'), unit: IngredientUnit.KG, notes: 'Topped generously' },
      ],
    },
    {
      name: 'Pepperoni Feast Pizza',
      description: 'Spicy seasoned pepperoni layered over mozzarella cheese and rich tomato base.',
      categoryName: 'Pizzas',
      price: new Prisma.Decimal('15.99'),
      preparationTimeMinutes: 18,
      recipe: [
        { ingredient: 'Pizza Dough', quantity: new Prisma.Decimal('0.250'), unit: IngredientUnit.KG, notes: 'Stretched to 12 inches' },
        { ingredient: 'Tomato Sauce', quantity: new Prisma.Decimal('0.100'), unit: IngredientUnit.LITRE, notes: 'Evenly spread' },
        { ingredient: 'Mozzarella Cheese', quantity: new Prisma.Decimal('0.150'), unit: IngredientUnit.KG, notes: 'Base cheese' },
        { ingredient: 'Pepperoni', quantity: new Prisma.Decimal('0.080'), unit: IngredientUnit.KG, notes: '24 slices' },
      ],
    },
    {
      name: 'Classic Cheeseburger',
      description: '150g grilled Angus beef patty, melted cheddar, lettuce, onions, and signature burger sauce in a brioche bun.',
      categoryName: 'Burgers',
      price: new Prisma.Decimal('9.99'),
      preparationTimeMinutes: 12,
      recipe: [
        { ingredient: 'Burger Bun', quantity: new Prisma.Decimal('1.000'), unit: IngredientUnit.PIECE, notes: 'Lightly toasted' },
        { ingredient: 'Beef Patty', quantity: new Prisma.Decimal('1.000'), unit: IngredientUnit.PIECE, notes: 'Flame grilled' },
        { ingredient: 'Cheddar Cheese Slice', quantity: new Prisma.Decimal('1.000'), unit: IngredientUnit.PIECE, notes: 'Melted over patty' },
        { ingredient: 'Special Burger Sauce', quantity: new Prisma.Decimal('20.000'), unit: IngredientUnit.ML, notes: 'Applied to both buns' },
        { ingredient: 'Iceberg Lettuce', quantity: new Prisma.Decimal('15.000'), unit: IngredientUnit.GRAM, notes: 'Bottom bun layer' },
        { ingredient: 'Red Onion', quantity: new Prisma.Decimal('15.000'), unit: IngredientUnit.GRAM, notes: 'Top layer' },
      ],
    },
    {
      name: 'Crispy French Fries',
      description: 'Golden fried russet potato fingers lightly tossed in fine sea salt.',
      categoryName: 'Sides & Appetizers',
      price: new Prisma.Decimal('4.49'),
      preparationTimeMinutes: 8,
      recipe: [
        { ingredient: 'Potato Fries', quantity: new Prisma.Decimal('0.200'), unit: IngredientUnit.KG, notes: 'Deep fried at 175°C' },
        { ingredient: 'Cooking Oil', quantity: new Prisma.Decimal('0.050'), unit: IngredientUnit.LITRE, notes: 'Frying absorption estimate' },
        { ingredient: 'Table Salt', quantity: new Prisma.Decimal('2.000'), unit: IngredientUnit.GRAM, notes: 'Tossed hot' },
      ],
    },
    {
      name: 'Caffe Latte',
      description: 'Velvety steamed whole milk poured over a rich double shot of dark-roast espresso.',
      categoryName: 'Beverages',
      price: new Prisma.Decimal('3.99'),
      preparationTimeMinutes: 5,
      recipe: [
        { ingredient: 'Espresso Coffee Beans', quantity: new Prisma.Decimal('0.020'), unit: IngredientUnit.KG, notes: 'Double shot extraction' },
        { ingredient: 'Whole Milk', quantity: new Prisma.Decimal('0.250'), unit: IngredientUnit.LITRE, notes: 'Steamed with silky microfoam' },
      ],
    },
    {
      name: 'Warm Fudge Brownie with Ice Cream',
      description: 'Gooey warm Belgian chocolate fudge brownie served with a scoop of vanilla bean ice cream.',
      categoryName: 'Desserts',
      price: new Prisma.Decimal('6.99'),
      preparationTimeMinutes: 7,
      recipe: [
        { ingredient: 'Fudge Brownie', quantity: new Prisma.Decimal('1.000'), unit: IngredientUnit.PIECE, notes: 'Warmed in oven' },
        { ingredient: 'Vanilla Ice Cream', quantity: new Prisma.Decimal('60.000'), unit: IngredientUnit.ML, notes: 'One scoop on top' },
      ],
    },
  ];

  const allBranches = [dtBranch, bwBranch, andBranch, puneBranch];

  for (const itemData of menuItemsData) {
    const categoryId = categoryMap.get(itemData.categoryName);
    if (!categoryId) continue;

    let menuItem = await prisma.menuItem.findFirst({
      where: { name: itemData.name },
    });

    if (menuItem) {
      menuItem = await prisma.menuItem.update({
        where: { id: menuItem.id },
        data: {
          description: itemData.description,
          categoryId,
          price: itemData.price,
          preparationTimeMinutes: itemData.preparationTimeMinutes,
          status: MenuStatus.ACTIVE,
        },
      });
    } else {
      menuItem = await prisma.menuItem.create({
        data: {
          name: itemData.name,
          description: itemData.description,
          categoryId,
          price: itemData.price,
          preparationTimeMinutes: itemData.preparationTimeMinutes,
          status: MenuStatus.ACTIVE,
        },
      });
    }

    console.log(`    ✓ Menu Item: ${menuItem.name} ($${menuItem.price})`);

    // Seed Branch Availability
    for (const b of allBranches) {
      // In Downtown branch, offer special premium branch price for Classic Cheeseburger ($10.99)
      const isDtCheeseburger = b.code === 'OX-DT-001' && itemData.name === 'Classic Cheeseburger';
      const branchPrice = isDtCheeseburger ? new Prisma.Decimal('10.99') : null;

      await prisma.branchMenuItem.upsert({
        where: {
          branchId_menuItemId: {
            branchId: b.id,
            menuItemId: menuItem.id,
          },
        },
        update: {
          isAvailable: true,
          price: branchPrice,
        },
        create: {
          branchId: b.id,
          menuItemId: menuItem.id,
          isAvailable: true,
          price: branchPrice,
        },
      });
    }

    // Seed Recipe / BOM
    for (const ing of itemData.recipe) {
      const ingredientId = ingredientMap.get(ing.ingredient);
      if (!ingredientId) continue;

      await prisma.recipeIngredient.upsert({
        where: {
          menuItemId_ingredientId: {
            menuItemId: menuItem.id,
            ingredientId,
          },
        },
        update: {
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes,
        },
        create: {
          menuItemId: menuItem.id,
          ingredientId,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes,
        },
      });
    }
    console.log(`      ↳ BOM configured: ${itemData.recipe.length} ingredients`);
  }

  // 9. Seed Inventory Items & Stock Transactions
  console.log('  → Seeding inventory items and stock ledger...');
  const inventoryBranches = [dtBranch, bwBranch, andBranch];
  const allIngredientRecords = await prisma.ingredient.findMany();

  // Create InventoryItem records and OPENING transactions for all ingredients
  for (const b of inventoryBranches) {
    for (const ing of allIngredientRecords) {
      await prisma.inventoryItem.upsert({
        where: {
          branchId_ingredientId: {
            branchId: b.id,
            ingredientId: ing.id,
          },
        },
        update: {
          minimumStock: new Prisma.Decimal('10.000'),
          reorderLevel: new Prisma.Decimal('20.000'),
          status: InventoryStatus.ACTIVE,
        },
        create: {
          branchId: b.id,
          ingredientId: ing.id,
          minimumStock: new Prisma.Decimal('10.000'),
          reorderLevel: new Prisma.Decimal('20.000'),
          status: InventoryStatus.ACTIVE,
        },
      });

      // Check if opening stock already exists
      const existingOpening = await prisma.stockTransaction.findFirst({
        where: {
          branchId: b.id,
          ingredientId: ing.id,
          type: StockTransactionType.OPENING,
        },
      });

      if (!existingOpening) {
        // Generous initial stock based on unit
        const openingQty =
          ing.unit === 'KG'
            ? '50.000'
            : ing.unit === 'LITRE'
              ? '40.000'
              : ing.unit === 'PIECE'
                ? '100.000'
                : '30.000';

        await prisma.stockTransaction.create({
          data: {
            branchId: b.id,
            ingredientId: ing.id,
            type: StockTransactionType.OPENING,
            quantity: new Prisma.Decimal(openingQty),
            unit: ing.unit,
            note: 'Initial opening stock setup for branch launch',
            performedBy: 'System Seed',
          },
        });
      }
    }
  }

  // Seed sample transactions for Downtown Flagship
  const doughIng = allIngredientRecords.find((i) => i.name === 'Pizza Dough');
  const mozzIng = allIngredientRecords.find((i) => i.name === 'Mozzarella Cheese');
  const sauceIng = allIngredientRecords.find((i) => i.name === 'Tomato Sauce');

  if (doughIng && mozzIng && sauceIng) {
    // 1. Stock Receipt
    await prisma.stockTransaction.create({
      data: {
        branchId: dtBranch.id,
        ingredientId: mozzIng.id,
        type: StockTransactionType.RECEIPT,
        quantity: new Prisma.Decimal('25.000'),
        unit: mozzIng.unit,
        referenceId: 'RCV-2026-001',
        note: 'Fresh dairy supplier batch delivery',
        performedBy: 'Aarav Patel',
      },
    });

    // 2. Kitchen Wastage
    await prisma.stockTransaction.create({
      data: {
        branchId: dtBranch.id,
        ingredientId: sauceIng.id,
        type: StockTransactionType.WASTAGE,
        reason: WastageReason.SPOILED,
        quantity: new Prisma.Decimal('2.500'),
        unit: sauceIng.unit,
        note: 'Expired batch discovered during morning stock check',
        performedBy: 'Aarav Patel',
      },
    });

    // 3. Physical Damage
    await prisma.stockTransaction.create({
      data: {
        branchId: dtBranch.id,
        ingredientId: doughIng.id,
        type: StockTransactionType.DAMAGE,
        reason: WastageReason.DROPPED,
        quantity: new Prisma.Decimal('1.000'),
        unit: doughIng.unit,
        note: 'Tray dropped during prep station rotation',
        performedBy: 'Priya Sharma',
      },
    });

    // 4. Branch Stock Transfer: Downtown -> Bandra West
    const transferRef = 'TRF-SEED-001';
    await prisma.stockTransaction.create({
      data: {
        branchId: dtBranch.id,
        ingredientId: mozzIng.id,
        type: StockTransactionType.TRANSFER_OUT,
        quantity: new Prisma.Decimal('5.000'),
        unit: mozzIng.unit,
        referenceId: transferRef,
        note: 'Transfer to Bandra West - Weekend evening backup',
        performedBy: 'Aarav Patel',
      },
    });

    await prisma.stockTransaction.create({
      data: {
        branchId: bwBranch.id,
        ingredientId: mozzIng.id,
        type: StockTransactionType.TRANSFER_IN,
        quantity: new Prisma.Decimal('5.000'),
        unit: mozzIng.unit,
        referenceId: transferRef,
        note: 'Transfer from Downtown Flagship - Weekend evening backup',
        performedBy: 'Aarav Patel',
      },
    });

    // 5. Stock Reconciliation Adjustment
    await prisma.stockTransaction.create({
      data: {
        branchId: dtBranch.id,
        ingredientId: doughIng.id,
        type: StockTransactionType.ADJUSTMENT_IN,
        quantity: new Prisma.Decimal('2.000'),
        unit: doughIng.unit,
        note: 'Physical Reconciliation: Count=51, System=49, Variance=+2 KG | Verified extra batch made yesterday',
        performedBy: 'Aarav Patel',
      },
    });
  }

  console.log(`    ✓ Inventory items and initial transactions seeded across ${inventoryBranches.length} branches`);

  console.log('✅ Seed completed successfully!');
  console.log('\n⚠️  SECURITY NOTICE: The seeded credentials are for local development/testing only.');
  console.log('   Change environment variables for production deployments.\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
