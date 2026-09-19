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
        'settings.read',
        'settings.update',
      ],
    },
    {
      name: 'ADMIN',
      description: 'System Administrator - User and branch management without destructive owner controls',
      permissions: [
        'dashboard.read',
        'users.read',
        'users.create',
        'users.update',
        'branch.read',
        'branch.create',
        'branch.update',
        'settings.read',
      ],
    },
    {
      name: 'MANAGER',
      description: 'Branch Manager - Operational oversight and team reporting',
      permissions: [
        'dashboard.read',
        'users.read',
        'branch.read',
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
