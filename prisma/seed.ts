import { PrismaClient } from '@prisma/client';
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
    // Settings
    { code: 'settings.read', module: 'settings', description: 'View system and branch settings' },
    { code: 'settings.update', module: 'settings', description: 'Modify system and branch settings' },
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
        'settings.read',
        'settings.update',
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
        'settings.read',
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
        'settings.read',
      ],
    },
    {
      name: 'STAFF',
      description: 'Branch Staff - Operational tasks and shift view only',
      permissions: [
        'dashboard.read',
        'branch.read',
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
  const branchesData = [
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
      status: 'ACTIVE' as const,
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
      status: 'ACTIVE' as const,
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
      status: 'ACTIVE' as const,
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
      status: 'INACTIVE' as const,
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

  const managerUser = await prisma.user.findUnique({ where: { email: 'manager@ovenxpress.com' } });
  const staffUser = await prisma.user.findUnique({ where: { email: 'staff@ovenxpress.com' } });

  if (dtBranch && bwBranch && andBranch && puneBranch) {
    const employeesData = [
      {
        employeeCode: 'EMP-0001',
        firstName: 'Elena',
        lastName: 'Rostova',
        phone: '+91 98201 11223',
        email: 'manager@ovenxpress.com',
        joiningDate: new Date('2022-03-15'),
        designation: 'General Manager',
        branchId: dtBranch.id,
        employmentStatus: 'ACTIVE' as const,
        salary: 65000,
        salaryType: 'MONTHLY' as const,
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
        email: 'staff@ovenxpress.com',
        joiningDate: new Date('2023-06-01'),
        designation: 'Senior Server',
        branchId: dtBranch.id,
        employmentStatus: 'ACTIVE' as const,
        salary: 25000,
        salaryType: 'MONTHLY' as const,
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
        employmentStatus: 'ACTIVE' as const,
        salary: 55000,
        salaryType: 'MONTHLY' as const,
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
        employmentStatus: 'ACTIVE' as const,
        salary: 150,
        salaryType: 'HOURLY' as const,
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
        employmentStatus: 'ACTIVE' as const,
        salary: 28000,
        salaryType: 'MONTHLY' as const,
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
        employmentStatus: 'INACTIVE' as const,
        salary: 22000,
        salaryType: 'MONTHLY' as const,
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
  }

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
