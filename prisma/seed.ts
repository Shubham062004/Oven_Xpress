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
        'settings.read',
      ],
    },
    {
      name: 'MANAGER',
      description: 'Branch Manager - Operational oversight and team reporting',
      permissions: [
        'dashboard.read',
        'users.read',
        'settings.read',
      ],
    },
    {
      name: 'STAFF',
      description: 'Branch Staff - Operational tasks and shift view only',
      permissions: [
        'dashboard.read',
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
