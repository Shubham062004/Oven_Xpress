import { prisma } from '../src/lib/db/prisma';
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, RoleName } from '../src/lib/permissions/definitions';

async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 1500): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === retries - 1) throw err;
      console.log(`Connection attempt ${i + 1} failed (${err.message}). Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Retries exhausted');
}

async function main() {
  console.log('Connecting to database...');
  // 1. Fetch all existing permissions in DB
  const existingPermissions = await withRetry(() => prisma.permission.findMany());
  const existingMap = new Map(existingPermissions.map((p) => [p.code, p.id]));
  console.log(`Found ${existingMap.size} existing permissions in DB.`);

  // 2. Identify missing permissions
  const allCodes = Object.values(PERMISSIONS);
  const missingPerms = allCodes
    .filter((code) => !existingMap.has(code))
    .map((code) => ({
      code,
      module: code.split('.')[0] || 'general',
      description: `Permission: ${code}`,
    }));

  if (missingPerms.length > 0) {
    console.log(`Creating ${missingPerms.length} missing permissions...`);
    await withRetry(() =>
      prisma.permission.createMany({
        data: missingPerms,
        skipDuplicates: true,
      })
    );
    const refreshed = await withRetry(() => prisma.permission.findMany());
    for (const p of refreshed) {
      existingMap.set(p.code, p.id);
    }
    console.log(`Now total permissions: ${existingMap.size}`);
  }

  // 3. For each role, add missing rolePermissions in bulk
  const roles = await withRetry(() =>
    prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    })
  );

  for (const role of roles) {
    const roleName = role.name as RoleName;
    const expectedCodes = DEFAULT_ROLE_PERMISSIONS[roleName] || [];
    const currentCodeSet = new Set(role.permissions.map((p) => p.permission.code));
    const missingCodes = expectedCodes.filter((c) => !currentCodeSet.has(c));

    if (missingCodes.length > 0) {
      console.log(`Role ${role.name}: Adding ${missingCodes.length} missing permissions...`);
      const newRolePerms = missingCodes
        .map((code) => {
          const permId = existingMap.get(code);
          if (!permId) return null;
          return {
            roleId: role.id,
            permissionId: permId,
          };
        })
        .filter((item): item is { roleId: string; permissionId: string } => item !== null);

      if (newRolePerms.length > 0) {
        await withRetry(() =>
          prisma.rolePermission.createMany({
            data: newRolePerms,
            skipDuplicates: true,
          })
        );
      }
      console.log(`✓ Added ${newRolePerms.length} permissions to role ${role.name}.`);
    } else {
      console.log(`✓ Role ${role.name} already has all ${currentCodeSet.size} permissions.`);
    }
  }

  console.log('\nAll roles successfully synchronized!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
