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
  SupplierStatus,
  PurchaseOrderStatus,
  OrderType,
  OrderStatus,
  TableStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  ReconciliationStatus,
  ExpenseStatus,
  ExpenseCategoryStatus,
  ExpenseFrequency,
  ExpenseTemplateStatus,
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
    // Supplier Management
    { code: 'supplier.read', module: 'supplier', description: 'View supplier directory and details' },
    { code: 'supplier.create', module: 'supplier', description: 'Create new suppliers' },
    { code: 'supplier.update', module: 'supplier', description: 'Update supplier details' },
    { code: 'supplier.deactivate', module: 'supplier', description: 'Activate or deactivate suppliers' },
    // Purchase Order Management
    { code: 'purchase.read', module: 'purchase', description: 'View purchase orders and details' },
    { code: 'purchase.create', module: 'purchase', description: 'Create purchase orders' },
    { code: 'purchase.update', module: 'purchase', description: 'Update purchase orders' },
    { code: 'purchase.receive', module: 'purchase', description: 'Receive purchase order stock into inventory' },
    { code: 'purchase.cancel', module: 'purchase', description: 'Cancel purchase orders' },
    // Order Management
    { code: 'order.read', module: 'order', description: 'View restaurant orders and order history' },
    { code: 'order.create', module: 'order', description: 'Create dine-in, takeaway, and delivery orders' },
    { code: 'order.update', module: 'order', description: 'Update pending restaurant orders' },
    { code: 'order.status', module: 'order', description: 'Progress order lifecycle status' },
    { code: 'order.cancel', module: 'order', description: 'Cancel active restaurant orders' },
    // Customer Management
    { code: 'customer.read', module: 'customer', description: 'View customer directory and order history' },
    { code: 'customer.create', module: 'customer', description: 'Register or link new customers' },
    { code: 'customer.update', module: 'customer', description: 'Update customer contact and address details' },
    // Table Management
    { code: 'table.read', module: 'table', description: 'View branch tables and occupancy status' },
    { code: 'table.create', module: 'table', description: 'Add new restaurant dining tables' },
    { code: 'table.update', module: 'table', description: 'Update table number, capacity, and details' },
    { code: 'table.status', module: 'table', description: 'Update table occupancy and cleaning status' },
    // Kitchen Display System & Food Preparation
    { code: 'kitchen.read', module: 'kitchen', description: 'View kitchen display system (KDS) and active order queue' },
    { code: 'kitchen.start', module: 'kitchen', description: 'Start order preparation and trigger atomic inventory consumption' },
    { code: 'kitchen.ready', module: 'kitchen', description: 'Mark prepared orders as ready for service or delivery' },
    { code: 'kitchen.complete', module: 'kitchen', description: 'Mark ready kitchen orders as completed' },
    // Payment Management & Reconciliation
    { code: 'payment.read', module: 'payment', description: 'View payments, transaction ledger, and summary metrics' },
    { code: 'payment.create', module: 'payment', description: 'Record customer tender and digital order payments' },
    { code: 'payment.update', module: 'payment', description: 'Update payment notes and metadata' },
    { code: 'payment.refund', module: 'payment', description: 'Process payment reversals and refunds' },
    { code: 'payment.reconcile', module: 'payment', description: 'Perform daily tender reconciliation and record cash variances' },
    { code: 'payment.cancel', module: 'payment', description: 'Cancel pending payment attempts' },
    // Expense Management
    { code: 'expense.read', module: 'expense', description: 'View expenses, ledger, and summary metrics' },
    { code: 'expense.create', module: 'expense', description: 'Record new branch operational expenses' },
    { code: 'expense.update', module: 'expense', description: 'Update draft or pending branch expenses' },
    { code: 'expense.approve', module: 'expense', description: 'Approve pending branch expenses' },
    { code: 'expense.reject', module: 'expense', description: 'Reject pending branch expenses with reason' },
    { code: 'expense.cancel', module: 'expense', description: 'Cancel draft or pending branch expenses' },
    // Expense Category Management
    { code: 'expense.category.read', module: 'expense', description: 'View expense category configuration' },
    { code: 'expense.category.create', module: 'expense', description: 'Create new expense categories' },
    { code: 'expense.category.update', module: 'expense', description: 'Update expense categories' },
    { code: 'expense.category.deactivate', module: 'expense', description: 'Activate or deactivate expense categories' },
    // Expense Template Management
    { code: 'expense.template.read', module: 'expense', description: 'View recurring expense templates' },
    { code: 'expense.template.create', module: 'expense', description: 'Create recurring expense templates' },
    { code: 'expense.template.update', module: 'expense', description: 'Update recurring expense templates' },
    { code: 'expense.template.deactivate', module: 'expense', description: 'Activate or deactivate recurring expense templates' },
    // Salary, Bonus & Increment Management
    { code: 'salary.read', module: 'salary', description: 'View salary structures, employee compensation history, and salary period records' },
    { code: 'salary.create', module: 'salary', description: 'Create initial salary structures and salary period records' },
    { code: 'salary.update', module: 'salary', description: 'Modify draft salary structures or salary period records' },
    { code: 'salary.approve', module: 'salary', description: 'Review and approve salary period compensation records' },
    { code: 'salary.cancel', module: 'salary', description: 'Cancel pending or draft salary period records' },
    { code: 'bonus.read', module: 'bonus', description: 'View employee bonuses and incentives' },
    { code: 'bonus.create', module: 'bonus', description: 'Draft and submit employee bonus awards' },
    { code: 'bonus.update', module: 'bonus', description: 'Update draft employee bonuses' },
    { code: 'bonus.approve', module: 'bonus', description: 'Approve pending employee bonus awards' },
    { code: 'bonus.cancel', module: 'bonus', description: 'Cancel draft or rejected employee bonuses' },
    { code: 'increment.read', module: 'increment', description: 'View employee salary revision and increment ledger' },
    { code: 'increment.create', module: 'increment', description: 'Record employee salary revisions and increments' },
    { code: 'increment.update', module: 'increment', description: 'Update employee salary revision details' },
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
        'supplier.read',
        'supplier.create',
        'supplier.update',
        'supplier.deactivate',
        'purchase.read',
        'purchase.create',
        'purchase.update',
        'purchase.receive',
        'purchase.cancel',
        'order.read',
        'order.create',
        'order.update',
        'order.status',
        'order.cancel',
        'customer.read',
        'customer.create',
        'customer.update',
        'table.read',
        'table.create',
        'table.update',
        'table.status',
        'kitchen.read',
        'kitchen.start',
        'kitchen.ready',
        'kitchen.complete',
        'payment.read',
        'payment.create',
        'payment.update',
        'payment.refund',
        'payment.reconcile',
        'payment.cancel',
        'expense.read',
        'expense.create',
        'expense.update',
        'expense.approve',
        'expense.reject',
        'expense.cancel',
        'expense.category.read',
        'expense.category.create',
        'expense.category.update',
        'expense.category.deactivate',
        'expense.template.read',
        'expense.template.create',
        'expense.template.update',
        'expense.template.deactivate',
        'salary.read',
        'salary.create',
        'salary.update',
        'salary.approve',
        'salary.cancel',
        'bonus.read',
        'bonus.create',
        'bonus.update',
        'bonus.approve',
        'bonus.cancel',
        'increment.read',
        'increment.create',
        'increment.update',
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
        'supplier.read',
        'supplier.create',
        'supplier.update',
        'supplier.deactivate',
        'purchase.read',
        'purchase.create',
        'purchase.update',
        'purchase.receive',
        'purchase.cancel',
        'order.read',
        'order.create',
        'order.update',
        'order.status',
        'order.cancel',
        'customer.read',
        'customer.create',
        'customer.update',
        'table.read',
        'table.create',
        'table.update',
        'table.status',
        'kitchen.read',
        'kitchen.start',
        'kitchen.ready',
        'kitchen.complete',
        'payment.read',
        'payment.create',
        'payment.update',
        'payment.refund',
        'payment.reconcile',
        'payment.cancel',
        'expense.read',
        'expense.create',
        'expense.update',
        'expense.approve',
        'expense.reject',
        'expense.cancel',
        'expense.category.read',
        'expense.category.create',
        'expense.category.update',
        'expense.category.deactivate',
        'expense.template.read',
        'expense.template.create',
        'expense.template.update',
        'expense.template.deactivate',
        'salary.read',
        'salary.create',
        'salary.update',
        'salary.approve',
        'salary.cancel',
        'bonus.read',
        'bonus.create',
        'bonus.update',
        'bonus.approve',
        'bonus.cancel',
        'increment.read',
        'increment.create',
        'increment.update',
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
        'supplier.read',
        'supplier.create',
        'supplier.update',
        'purchase.read',
        'purchase.create',
        'purchase.update',
        'purchase.receive',
        'purchase.cancel',
        'order.read',
        'order.create',
        'order.update',
        'order.status',
        'order.cancel',
        'customer.read',
        'customer.create',
        'customer.update',
        'table.read',
        'table.create',
        'table.update',
        'table.status',
        'kitchen.read',
        'kitchen.start',
        'kitchen.ready',
        'kitchen.complete',
        'payment.read',
        'payment.create',
        'payment.update',
        'payment.reconcile',
        'payment.cancel',
        'expense.read',
        'expense.create',
        'expense.update',
        'expense.approve',
        'expense.reject',
        'expense.cancel',
        'expense.category.read',
        'expense.template.read',
        'expense.template.create',
        'expense.template.update',
        'expense.template.deactivate',
        'salary.read',
        'salary.create',
        'salary.update',
        'bonus.read',
        'bonus.create',
        'bonus.update',
        'increment.read',
        'increment.create',
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
        'supplier.read',
        'purchase.read',
        'order.read',
        'order.create',
        'order.status',
        'customer.read',
        'customer.create',
        'table.read',
        'table.status',
        'kitchen.read',
        'kitchen.start',
        'kitchen.ready',
        'payment.read',
        'payment.create',
        'expense.read',
        'expense.create',
        'expense.category.read',
        'expense.template.read',
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
    const rolePerms = roleData.permissions
      .map((code) => permissionsMap.get(code))
      .filter((id): id is string => !!id)
      .map((permissionId) => ({
        roleId: role.id,
        permissionId,
      }));
    if (rolePerms.length > 0) {
      await prisma.rolePermission.createMany({
        data: rolePerms,
        skipDuplicates: true,
      });
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

  // 10. Seed Suppliers & Purchase Orders
  console.log('  → Seeding suppliers and purchase orders...');
  const suppliersData = [
    {
      name: 'Metro Dairy & Cheese',
      contactPerson: 'Sunil Mehta',
      phone: '+91 98200 44556',
      email: 'orders@metrodairy.com',
      address: 'Plot 45, APMC Market, Turbhe',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      postalCode: '400705',
      notes: 'Primary dairy vendor for fresh mozzarella, cheddar, and whole milk. Deliveries Mon-Sat mornings.',
      status: SupplierStatus.ACTIVE,
    },
    {
      name: 'Golden Harvest Flour Mills',
      contactPerson: 'Anand Kulkarni',
      phone: '+91 98190 33221',
      email: 'sales@goldenharvest.in',
      address: 'Industrial Area Phase 2, Rabale',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      postalCode: '400701',
      notes: 'Supplies high-protein pizza dough and fresh brioche burger buns.',
      status: SupplierStatus.ACTIVE,
    },
    {
      name: 'San Marzano Agro Supplies',
      contactPerson: 'Roberto Rossi',
      phone: '+91 98330 99881',
      email: 'roberto@sanmarzanoagro.com',
      address: 'Warehousing Complex, Bhiwandi',
      city: 'Thane',
      state: 'Maharashtra',
      postalCode: '421302',
      notes: 'Seasoned San Marzano pizza sauces, herbs, and pure vegetable frying oils.',
      status: SupplierStatus.ACTIVE,
    },
    {
      name: 'Prime Choice Meats & Cold Cuts',
      contactPerson: 'Zakir Hussain',
      phone: '+91 98211 77665',
      email: 'contact@primechoicemeats.com',
      address: 'Deonar Abattoir Road, Govandi',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400043',
      notes: 'Cold storage distributor for beef patties and beef pepperoni.',
      status: SupplierStatus.ACTIVE,
    },
    {
      name: 'Green Valley Organic Farms',
      contactPerson: 'Kavita Deshmukh',
      phone: '+91 98900 11223',
      email: 'kavita@greenvalleyfarms.in',
      address: 'Wadgaon Farm Outpost',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '412105',
      notes: 'Fresh lettuce, onions, and seasonal produce. Currently under seasonal restructuring.',
      status: SupplierStatus.INACTIVE,
    },
  ];

  const seededSuppliers = new Map<string, string>();
  for (const s of suppliersData) {
    const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
    const record = existing
      ? await prisma.supplier.update({ where: { id: existing.id }, data: s })
      : await prisma.supplier.create({ data: s });
    seededSuppliers.set(s.name, record.id);
    console.log(`    ✓ Supplier: ${record.name} (${record.status})`);
  }

  // Seed sample Purchase Orders
  const metroSupplierId = seededSuppliers.get('Metro Dairy & Cheese')!;
  const goldenHarvestId = seededSuppliers.get('Golden Harvest Flour Mills')!;
  const sanMarzanoId = seededSuppliers.get('San Marzano Agro Supplies')!;
  const primeMeatsId = seededSuppliers.get('Prime Choice Meats & Cold Cuts')!;

  const bunIng = allIngredientRecords.find((i) => i.name === 'Burger Bun');
  const pepperoniIng = allIngredientRecords.find((i) => i.name === 'Pepperoni');
  const pattyIng = allIngredientRecords.find((i) => i.name === 'Beef Patty');

  // PO 1: Fully RECEIVED
  const existingPO1 = await prisma.purchaseOrder.findUnique({
    where: { purchaseNumber: 'PO-2026-000001' },
  });

  if (!existingPO1 && mozzIng) {
    const po1 = await prisma.purchaseOrder.create({
      data: {
        purchaseNumber: 'PO-2026-000001',
        supplierId: metroSupplierId,
        branchId: dtBranch.id,
        status: PurchaseOrderStatus.RECEIVED,
        orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        expectedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        notes: 'Urgent weekend restocking for mozzarella cheese',
        createdBy: 'Elena Rostova',
        items: {
          create: [
            {
              ingredientId: mozzIng.id,
              orderedQuantity: new Prisma.Decimal('25.000'),
              unit: mozzIng.unit,
              unitPrice: new Prisma.Decimal('350.00'),
              receivedQuantity: new Prisma.Decimal('25.000'),
            },
          ],
        },
      },
      include: { items: true },
    });

    // Create receiving log
    await prisma.purchaseReceiving.create({
      data: {
        purchaseOrderId: po1.id,
        receivingNumber: 'RCV-PO-2026-000001-01',
        receivedBy: 'Elena Rostova',
        receivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        notes: 'Full delivery received in pristine condition at 4°C cold chain',
        items: {
          create: [
            {
              purchaseOrderItemId: po1.items[0].id,
              ingredientId: mozzIng.id,
              quantity: new Prisma.Decimal('25.000'),
              unit: mozzIng.unit,
            },
          ],
        },
      },
    });
    console.log(`    ✓ Purchase Order: PO-2026-000001 (RECEIVED)`);
  }

  // PO 2: PARTIALLY_RECEIVED
  const existingPO2 = await prisma.purchaseOrder.findUnique({
    where: { purchaseNumber: 'PO-2026-000002' },
  });

  if (!existingPO2 && doughIng && bunIng) {
    const po2 = await prisma.purchaseOrder.create({
      data: {
        purchaseNumber: 'PO-2026-000002',
        supplierId: goldenHarvestId,
        branchId: dtBranch.id,
        status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
        orderDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        expectedDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        notes: 'Mid-week bakery replenishment. Second delivery batch expected tomorrow.',
        createdBy: 'Elena Rostova',
        items: {
          create: [
            {
              ingredientId: doughIng.id,
              orderedQuantity: new Prisma.Decimal('50.000'),
              unit: doughIng.unit,
              unitPrice: new Prisma.Decimal('60.00'),
              receivedQuantity: new Prisma.Decimal('30.000'),
            },
            {
              ingredientId: bunIng.id,
              orderedQuantity: new Prisma.Decimal('100.000'),
              unit: bunIng.unit,
              unitPrice: new Prisma.Decimal('12.00'),
              receivedQuantity: new Prisma.Decimal('100.000'),
            },
          ],
        },
      },
      include: { items: true },
    });

    const doughItem = po2.items.find((i) => i.ingredientId === doughIng.id)!;
    const bunItem = po2.items.find((i) => i.ingredientId === bunIng.id)!;

    await prisma.purchaseReceiving.create({
      data: {
        purchaseOrderId: po2.id,
        receivingNumber: 'RCV-PO-2026-000002-01',
        receivedBy: 'Elena Rostova',
        receivedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        notes: 'First delivery: 30 KG dough and all 100 burger buns received. Remaining 20 KG dough arriving tomorrow morning.',
        items: {
          create: [
            {
              purchaseOrderItemId: doughItem.id,
              ingredientId: doughIng.id,
              quantity: new Prisma.Decimal('30.000'),
              unit: doughIng.unit,
            },
            {
              purchaseOrderItemId: bunItem.id,
              ingredientId: bunIng.id,
              quantity: new Prisma.Decimal('100.000'),
              unit: bunIng.unit,
            },
          ],
        },
      },
    });

    // Create corresponding StockTransactions for this receipt
    await prisma.stockTransaction.create({
      data: {
        branchId: dtBranch.id,
        ingredientId: doughIng.id,
        type: StockTransactionType.RECEIPT,
        quantity: new Prisma.Decimal('30.000'),
        unit: doughIng.unit,
        referenceId: 'PO-2026-000002',
        note: 'Partial PO Receipt PO-2026-000002 (Batch 01)',
        performedBy: 'Elena Rostova',
      },
    });

    await prisma.stockTransaction.create({
      data: {
        branchId: dtBranch.id,
        ingredientId: bunIng.id,
        type: StockTransactionType.RECEIPT,
        quantity: new Prisma.Decimal('100.000'),
        unit: bunIng.unit,
        referenceId: 'PO-2026-000002',
        note: 'Full PO Receipt PO-2026-000002 for Burger Buns',
        performedBy: 'Elena Rostova',
      },
    });

    console.log(`    ✓ Purchase Order: PO-2026-000002 (PARTIALLY_RECEIVED)`);
  }

  // PO 3: ORDERED (Awaiting Delivery)
  const existingPO3 = await prisma.purchaseOrder.findUnique({
    where: { purchaseNumber: 'PO-2026-000003' },
  });

  if (!existingPO3 && sauceIng) {
    await prisma.purchaseOrder.create({
      data: {
        purchaseNumber: 'PO-2026-000003',
        supplierId: sanMarzanoId,
        branchId: bwBranch.id,
        status: PurchaseOrderStatus.ORDERED,
        orderDate: new Date(),
        expectedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        notes: 'San Marzano sauce drums for Bandra West branch',
        createdBy: 'Marcus Vance',
        items: {
          create: [
            {
              ingredientId: sauceIng.id,
              orderedQuantity: new Prisma.Decimal('40.000'),
              unit: sauceIng.unit,
              unitPrice: new Prisma.Decimal('120.00'),
              receivedQuantity: new Prisma.Decimal('0.000'),
            },
          ],
        },
      },
    });
    console.log(`    ✓ Purchase Order: PO-2026-000003 (ORDERED)`);
  }

  // PO 4: DRAFT
  const existingPO4 = await prisma.purchaseOrder.findUnique({
    where: { purchaseNumber: 'PO-2026-000004' },
  });

  if (!existingPO4 && pepperoniIng && pattyIng) {
    await prisma.purchaseOrder.create({
      data: {
        purchaseNumber: 'PO-2026-000004',
        supplierId: primeMeatsId,
        branchId: andBranch.id,
        status: PurchaseOrderStatus.DRAFT,
        orderDate: new Date(),
        expectedDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        notes: 'Draft estimate for Andheri Hub weekend burger festival',
        createdBy: 'Marcus Vance',
        items: {
          create: [
            {
              ingredientId: pepperoniIng.id,
              orderedQuantity: new Prisma.Decimal('20.000'),
              unit: pepperoniIng.unit,
              unitPrice: new Prisma.Decimal('450.00'),
              receivedQuantity: new Prisma.Decimal('0.000'),
            },
            {
              ingredientId: pattyIng.id,
              orderedQuantity: new Prisma.Decimal('60.000'),
              unit: pattyIng.unit,
              unitPrice: new Prisma.Decimal('110.00'),
              receivedQuantity: new Prisma.Decimal('0.000'),
            },
          ],
        },
      },
    });
    console.log(`    ✓ Purchase Order: PO-2026-000004 (DRAFT)`);
  }

  // 14. Seed Restaurant Tables
  console.log('  → Seeding restaurant dining tables...');
  const tableConfigs = [
    // Downtown Central
    { branchId: dtBranch.id, tableNumber: 'T-01', capacity: 2, status: TableStatus.AVAILABLE },
    { branchId: dtBranch.id, tableNumber: 'T-02', capacity: 4, status: TableStatus.OCCUPIED },
    { branchId: dtBranch.id, tableNumber: 'T-03', capacity: 4, status: TableStatus.AVAILABLE },
    { branchId: dtBranch.id, tableNumber: 'T-04', capacity: 6, status: TableStatus.AVAILABLE },
    { branchId: dtBranch.id, tableNumber: 'T-05', capacity: 8, status: TableStatus.AVAILABLE },
    // Bandra West
    { branchId: bwBranch.id, tableNumber: 'T-01', capacity: 2, status: TableStatus.AVAILABLE },
    { branchId: bwBranch.id, tableNumber: 'T-02', capacity: 4, status: TableStatus.AVAILABLE },
    { branchId: bwBranch.id, tableNumber: 'T-03', capacity: 4, status: TableStatus.AVAILABLE },
    { branchId: bwBranch.id, tableNumber: 'T-04', capacity: 6, status: TableStatus.AVAILABLE },
    // Andheri Hub
    { branchId: andBranch.id, tableNumber: 'T-01', capacity: 2, status: TableStatus.AVAILABLE },
    { branchId: andBranch.id, tableNumber: 'T-02', capacity: 4, status: TableStatus.AVAILABLE },
    { branchId: andBranch.id, tableNumber: 'T-03', capacity: 4, status: TableStatus.AVAILABLE },
  ];

  const seededTables = new Map<string, string>();
  for (const tc of tableConfigs) {
    const table = await prisma.restaurantTable.upsert({
      where: {
        branchId_tableNumber: {
          branchId: tc.branchId,
          tableNumber: tc.tableNumber,
        },
      },
      update: { capacity: tc.capacity, status: tc.status },
      create: tc,
    });
    seededTables.set(`${tc.branchId}_${tc.tableNumber}`, table.id);
  }
  console.log(`    ✓ Seeded ${tableConfigs.length} restaurant tables across 3 branches`);

  // 15. Seed Customers
  console.log('  → Seeding customers directory...');
  const customersData = [
    {
      name: 'Rahul Sharma',
      phone: '+91 98201 12345',
      email: 'rahul.sharma@example.com',
      address: 'Flat 402, Sea Green Apts, Worli, Mumbai',
      notes: 'VIP guest, prefers corner tables',
    },
    {
      name: 'Priya Patel',
      phone: '+91 98202 23456',
      email: 'priya.patel@example.com',
      address: '12 Pali Hill Road, Bandra West, Mumbai',
      notes: 'Lactose intolerant, requests dairy-free cheese',
    },
    {
      name: 'Amit Verma',
      phone: '+91 98203 34567',
      email: 'amit.verma@example.com',
      address: 'Flat 801, Oberoi Splendor, JVLR, Andheri East, Mumbai',
      notes: 'Regular delivery customer',
    },
    {
      name: 'Ananya Desai',
      phone: '+91 98204 45678',
      email: 'ananya.desai@example.com',
      address: '24 Marine Drive, Nariman Point, Mumbai',
      notes: 'Office lunch orders',
    },
  ];

  const seededCustomers = new Map<string, string>();
  for (const cd of customersData) {
    const cust = await prisma.customer.upsert({
      where: { phone: cd.phone },
      update: { name: cd.name, email: cd.email, address: cd.address, notes: cd.notes },
      create: cd,
    });
    seededCustomers.set(cd.name, cust.id);
  }
  console.log(`    ✓ Seeded ${customersData.length} customer records`);

  // 16. Seed Sample Orders
  console.log('  → Seeding restaurant orders...');
  const margheritaItem = await prisma.menuItem.findFirst({
    where: { name: { contains: 'Margherita' } },
  });
  const pepperoniItem = await prisma.menuItem.findFirst({
    where: { name: { contains: 'Pepperoni' } },
  });
  const burgerItem = await prisma.menuItem.findFirst({
    where: { name: { contains: 'Cheeseburger' } },
  });

  const rahulId = seededCustomers.get('Rahul Sharma');
  const priyaId = seededCustomers.get('Priya Patel');
  const amitId = seededCustomers.get('Amit Verma');
  const dtT02Id = seededTables.get(`${dtBranch.id}_T-02`);
  const dtT01Id = seededTables.get(`${dtBranch.id}_T-01`);

  // Order 1: DINE_IN, CONFIRMED (Downtown Central, Table T-02)
  if (margheritaItem && burgerItem && dtT02Id) {
    const existingOrd1 = await prisma.order.findUnique({
      where: { orderNumber: 'ORD-2026-000001' },
    });
    if (!existingOrd1) {
      await prisma.order.create({
        data: {
          orderNumber: 'ORD-2026-000001',
          branchId: dtBranch.id,
          orderType: OrderType.DINE_IN,
          status: OrderStatus.CONFIRMED,
          customerId: rahulId,
          tableId: dtT02Id,
          customerName: 'Rahul Sharma',
          customerPhone: '+91 98201 12345',
          subtotal: new Prisma.Decimal('35.97'),
          discountAmount: new Prisma.Decimal('0.00'),
          taxAmount: new Prisma.Decimal('1.80'),
          deliveryCharge: new Prisma.Decimal('0.00'),
          totalAmount: new Prisma.Decimal('37.77'),
          notes: 'Customer requested extra napkins and crushed red peppers',
          createdBy: 'Sarah Jenkins',
          items: {
            create: [
              {
                menuItemId: margheritaItem.id,
                itemName: margheritaItem.name,
                quantity: 2,
                unitPrice: margheritaItem.price,
                discountAmount: new Prisma.Decimal('0.00'),
                totalPrice: new Prisma.Decimal(margheritaItem.price.toNumber() * 2),
                notes: 'Crispy crust',
              },
              {
                menuItemId: burgerItem.id,
                itemName: burgerItem.name,
                quantity: 1,
                unitPrice: burgerItem.price,
                discountAmount: new Prisma.Decimal('0.00'),
                totalPrice: burgerItem.price,
                notes: 'Medium well, no onions',
              },
            ],
          },
        },
      });
      console.log('    ✓ Order: ORD-2026-000001 (DINE_IN, CONFIRMED)');
    }
  }

  // Order 2: DINE_IN, COMPLETED (Downtown Central, Table T-01)
  if (pepperoniItem && dtT01Id) {
    const existingOrd2 = await prisma.order.findUnique({
      where: { orderNumber: 'ORD-2026-000002' },
    });
    if (!existingOrd2) {
      await prisma.order.create({
        data: {
          orderNumber: 'ORD-2026-000002',
          branchId: dtBranch.id,
          orderType: OrderType.DINE_IN,
          status: OrderStatus.COMPLETED,
          customerId: null,
          tableId: dtT01Id,
          customerName: 'Guest Diner',
          customerPhone: null,
          subtotal: new Prisma.Decimal('31.98'),
          discountAmount: new Prisma.Decimal('3.00'),
          taxAmount: new Prisma.Decimal('1.45'),
          deliveryCharge: new Prisma.Decimal('0.00'),
          totalAmount: new Prisma.Decimal('30.43'),
          notes: 'Dine-in guest bill completed',
          createdBy: 'Sarah Jenkins',
          items: {
            create: [
              {
                menuItemId: pepperoniItem.id,
                itemName: pepperoniItem.name,
                quantity: 2,
                unitPrice: pepperoniItem.price,
                discountAmount: new Prisma.Decimal('3.00'),
                totalPrice: new Prisma.Decimal(pepperoniItem.price.toNumber() * 2 - 3),
                notes: 'Standard prep',
              },
            ],
          },
        },
      });
      console.log('    ✓ Order: ORD-2026-000002 (DINE_IN, COMPLETED)');
    }
  }

  // Order 3: TAKEAWAY, READY (Bandra West)
  if (margheritaItem && pepperoniItem) {
    const existingOrd3 = await prisma.order.findUnique({
      where: { orderNumber: 'ORD-2026-000003' },
    });
    if (!existingOrd3) {
      await prisma.order.create({
        data: {
          orderNumber: 'ORD-2026-000003',
          branchId: bwBranch.id,
          orderType: OrderType.TAKEAWAY,
          status: OrderStatus.READY,
          customerId: priyaId,
          tableId: null,
          customerName: 'Priya Patel',
          customerPhone: '+91 98202 23456',
          subtotal: new Prisma.Decimal('28.98'),
          discountAmount: new Prisma.Decimal('0.00'),
          taxAmount: new Prisma.Decimal('1.45'),
          deliveryCharge: new Prisma.Decimal('0.00'),
          totalAmount: new Prisma.Decimal('30.43'),
          notes: 'Customer will pick up at 7:30 PM. Box with green ribbon',
          createdBy: 'Marcus Vance',
          items: {
            create: [
              {
                menuItemId: margheritaItem.id,
                itemName: margheritaItem.name,
                quantity: 1,
                unitPrice: margheritaItem.price,
                discountAmount: new Prisma.Decimal('0.00'),
                totalPrice: margheritaItem.price,
              },
              {
                menuItemId: pepperoniItem.id,
                itemName: pepperoniItem.name,
                quantity: 1,
                unitPrice: pepperoniItem.price,
                discountAmount: new Prisma.Decimal('0.00'),
                totalPrice: pepperoniItem.price,
              },
            ],
          },
        },
      });
      console.log('    ✓ Order: ORD-2026-000003 (TAKEAWAY, READY)');
    }
  }

  // Order 4: DELIVERY, PREPARING (Andheri Hub)
  if (burgerItem && margheritaItem) {
    const existingOrd4 = await prisma.order.findUnique({
      where: { orderNumber: 'ORD-2026-000004' },
    });
    if (!existingOrd4) {
      await prisma.order.create({
        data: {
          orderNumber: 'ORD-2026-000004',
          branchId: andBranch.id,
          orderType: OrderType.DELIVERY,
          status: OrderStatus.PREPARING,
          customerId: amitId,
          tableId: null,
          customerName: 'Amit Verma',
          customerPhone: '+91 98203 34567',
          deliveryAddress: 'Flat 801, Oberoi Splendor, JVLR, Andheri East, Mumbai',
          deliveryNotes: 'Call upon arrival; leave at gate security if tenant is unreachable.',
          subtotal: new Prisma.Decimal('22.98'),
          discountAmount: new Prisma.Decimal('0.00'),
          taxAmount: new Prisma.Decimal('1.15'),
          deliveryCharge: new Prisma.Decimal('4.00'),
          totalAmount: new Prisma.Decimal('28.13'),
          notes: 'Deliver hot with thermal bag',
          createdBy: 'Elena Rostova',
          items: {
            create: [
              {
                menuItemId: burgerItem.id,
                itemName: burgerItem.name,
                quantity: 1,
                unitPrice: burgerItem.price,
                discountAmount: new Prisma.Decimal('0.00'),
                totalPrice: burgerItem.price,
              },
              {
                menuItemId: margheritaItem.id,
                itemName: margheritaItem.name,
                quantity: 1,
                unitPrice: margheritaItem.price,
                discountAmount: new Prisma.Decimal('0.00'),
                totalPrice: margheritaItem.price,
              },
            ],
          },
        },
      });
      console.log('    ✓ Order: ORD-2026-000004 (DELIVERY, PREPARING)');
    }
  }

  // Order 5: DELIVERY, CANCELLED (Downtown Central)
  if (margheritaItem) {
    const existingOrd5 = await prisma.order.findUnique({
      where: { orderNumber: 'ORD-2026-000005' },
    });
    if (!existingOrd5) {
      await prisma.order.create({
        data: {
          orderNumber: 'ORD-2026-000005',
          branchId: dtBranch.id,
          orderType: OrderType.DELIVERY,
          status: OrderStatus.CANCELLED,
          customerId: null,
          tableId: null,
          customerName: 'Ananya Desai',
          customerPhone: '+91 98204 45678',
          deliveryAddress: '24 Marine Drive, Nariman Point, Mumbai',
          deliveryNotes: 'Near Air India building',
          subtotal: new Prisma.Decimal('12.99'),
          discountAmount: new Prisma.Decimal('0.00'),
          taxAmount: new Prisma.Decimal('0.65'),
          deliveryCharge: new Prisma.Decimal('3.50'),
          totalAmount: new Prisma.Decimal('17.14'),
          notes: 'Cancelled before kitchen dispatch',
          cancellationReason: 'Customer called to cancel due to meeting reschedule',
          cancelledAt: new Date(),
          cancelledBy: 'Sarah Jenkins',
          createdBy: 'Sarah Jenkins',
          items: {
            create: [
              {
                menuItemId: margheritaItem.id,
                itemName: margheritaItem.name,
                quantity: 1,
                unitPrice: margheritaItem.price,
                discountAmount: new Prisma.Decimal('0.00'),
                totalPrice: margheritaItem.price,
              },
            ],
          },
        },
      });
      console.log('    ✓ Order: ORD-2026-000005 (DELIVERY, CANCELLED)');
    }
  }

  // 12. Seed Sample Payments & Reconciliations
  console.log('  → Seeding sample payments and daily reconciliation...');
  const order1 = await prisma.order.findUnique({ where: { orderNumber: 'ORD-2026-000001' } });
  const order2 = await prisma.order.findUnique({ where: { orderNumber: 'ORD-2026-000002' } });
  const order3 = await prisma.order.findUnique({ where: { orderNumber: 'ORD-2026-000003' } });
  const order4 = await prisma.order.findUnique({ where: { orderNumber: 'ORD-2026-000004' } });

  if (order1) {
    const existingP1 = await prisma.payment.findUnique({ where: { paymentNumber: 'PAY-2026-000001' } });
    if (!existingP1) {
      await prisma.payment.create({
        data: {
          paymentNumber: 'PAY-2026-000001',
          orderId: order1.id,
          branchId: order1.branchId,
          amount: order1.totalAmount,
          method: PaymentMethod.CASH,
          status: PaymentStatus.SUCCESS,
          referenceNumber: 'CASH-REG-01',
          notes: 'Customer paid exact cash at counter',
          processedBy: 'Sarah Jenkins',
        },
      });
      console.log('    ✓ Payment: PAY-2026-000001 (CASH, Full Paid)');
    }
  }

  if (order2) {
    const existingP2 = await prisma.payment.findUnique({ where: { paymentNumber: 'PAY-2026-000002' } });
    if (!existingP2) {
      await prisma.payment.create({
        data: {
          paymentNumber: 'PAY-2026-000002',
          orderId: order2.id,
          branchId: order2.branchId,
          amount: order2.totalAmount,
          method: PaymentMethod.UPI,
          status: PaymentStatus.SUCCESS,
          referenceNumber: 'UPI-982341762109',
          notes: 'Google Pay scanned at delivery counter',
          processedBy: 'Sarah Jenkins',
        },
      });
      console.log('    ✓ Payment: PAY-2026-000002 (UPI, Full Paid)');
    }
  }

  if (order3) {
    const existingP3 = await prisma.payment.findUnique({ where: { paymentNumber: 'PAY-2026-000003' } });
    if (!existingP3) {
      const p3 = await prisma.payment.create({
        data: {
          paymentNumber: 'PAY-2026-000003',
          orderId: order3.id,
          branchId: order3.branchId,
          amount: order3.totalAmount,
          method: PaymentMethod.CARD,
          status: PaymentStatus.PARTIALLY_REFUNDED,
          referenceNumber: 'POS-AUTH-449102',
          notes: 'Dine-in credit card swipe',
          processedBy: 'David Kim',
        },
      });

      // Partial refund on order 3
      const existingR1 = await prisma.paymentRefund.findUnique({ where: { refundNumber: 'REF-2026-000001' } });
      if (!existingR1) {
        await prisma.paymentRefund.create({
          data: {
            refundNumber: 'REF-2026-000001',
            paymentId: p3.id,
            amount: new Prisma.Decimal('5.00'),
            reason: 'Customer reported cold beverage, manager approved goodwill courtesy refund',
            status: RefundStatus.SUCCESS,
            processedBy: 'David Kim',
          },
        });
      }
      console.log('    ✓ Payment: PAY-2026-000003 (CARD, Partially Refunded with REF-2026-000001)');
    }
  }

  if (order4) {
    // Split tender: Partial CASH + Failed UPI attempt
    const existingP4 = await prisma.payment.findUnique({ where: { paymentNumber: 'PAY-2026-000004' } });
    if (!existingP4) {
      await prisma.payment.create({
        data: {
          paymentNumber: 'PAY-2026-000004',
          orderId: order4.id,
          branchId: order4.branchId,
          amount: new Prisma.Decimal('15.00'),
          method: PaymentMethod.CASH,
          status: PaymentStatus.SUCCESS,
          referenceNumber: null,
          notes: 'Customer paid partial cash deposit',
          processedBy: 'Sarah Jenkins',
        },
      });

      // Failed UPI attempt
      await prisma.payment.create({
        data: {
          paymentNumber: 'PAY-2026-000005',
          orderId: order4.id,
          branchId: order4.branchId,
          amount: new Prisma.Decimal('10.00'),
          method: PaymentMethod.UPI,
          status: PaymentStatus.FAILED,
          referenceNumber: 'UPI-FAIL-TIMEOUT',
          notes: 'Customer bank server timed out, transaction failed',
          processedBy: 'Sarah Jenkins',
        },
      });
      console.log('    ✓ Payment: PAY-2026-000004 (Partial CASH) & PAY-2026-000005 (FAILED UPI)');
    }
  }

  // Daily Reconciliation Seed for Downtown Central
  const todayRec = new Date();
  const todayDateOnly = new Date(Date.UTC(todayRec.getFullYear(), todayRec.getMonth(), todayRec.getDate()));
  const existingReconciliation = await prisma.paymentReconciliation.findFirst({
    where: {
      branchId: dtBranch.id,
      date: todayDateOnly,
    },
  });

  if (!existingReconciliation) {
    await prisma.paymentReconciliation.create({
      data: {
        branchId: dtBranch.id,
        date: todayDateOnly,
        systemCash: new Prisma.Decimal('15.00'),
        actualCash: new Prisma.Decimal('15.00'),
        variance: new Prisma.Decimal('0.00'),
        note: 'Mid-day drawer audit completed. Physical drawer perfectly balanced.',
        reconciledBy: 'Sarah Jenkins',
        status: ReconciliationStatus.RECONCILED,
      },
    });
    console.log('    ✓ Daily Reconciliation: Downtown Central (RECONCILED, Balanced)');
  }

  // 17. Seed Expense Management
  console.log('  → Seeding Expense Categories, Templates, and Sample Expenses...');
  const initialCategories = [
    { name: 'RAW_MATERIAL', description: 'Direct kitchen food ingredients, spices, and supplies' },
    { name: 'PACKAGING', description: 'Takeaway boxes, paper bags, cups, cutlery, and wrapping' },
    { name: 'UTILITIES', description: 'Electricity, commercial gas cylinders, water supply, internet' },
    { name: 'RENT', description: 'Branch commercial lease and property occupancy rental fees' },
    { name: 'SALARY', description: 'Staff wages, stipends, bonuses, and contractual payments' },
    { name: 'MAINTENANCE', description: 'Regular servicing of kitchen hoods, freezers, and ovens' },
    { name: 'REPAIRS', description: 'Emergency repairs for plumbing, electricals, and appliances' },
    { name: 'MARKETING', description: 'Local flyers, online campaigns, social media promotions' },
    { name: 'DELIVERY', description: 'Delivery fleet fuel, third-party logistics, vehicle repairs' },
    { name: 'CLEANING', description: 'Commercial sanitizers, degreasers, trash bags, mop service' },
    { name: 'EQUIPMENT', description: 'Purchase of small kitchen tools, pans, blenders, utensils' },
    { name: 'LICENSES', description: 'FSSAI food license, fire NOC, municipal health certificates' },
    { name: 'TRANSPORT', description: 'Market procurement trips, employee local transit fares' },
    { name: 'MISCELLANEOUS', description: 'Uncategorized petty expenses and contingency cash outflows' },
  ];

  const expenseCategoryMap = new Map<string, string>();
  for (const cat of initialCategories) {
    const record = await prisma.expenseCategory.upsert({
      where: { name: cat.name },
      update: { description: cat.description },
      create: {
        name: cat.name,
        description: cat.description,
        status: ExpenseCategoryStatus.ACTIVE,
      },
    });
    expenseCategoryMap.set(record.name, record.id);
  }
  console.log(`    ✓ ${initialCategories.length} Expense Categories seeded/verified`);

  // Recurring Templates
  const rentCatId = expenseCategoryMap.get('RENT');
  const packCatId = expenseCategoryMap.get('PACKAGING');
  const utilCatId = expenseCategoryMap.get('UTILITIES');

  if (rentCatId && packCatId && utilCatId) {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 5);

    const dtTemplates = [
      {
        branchId: dtBranch.id,
        categoryId: rentCatId,
        description: 'Downtown Central Store Commercial Rent',
        amount: new Prisma.Decimal('45000.00'),
        frequency: ExpenseFrequency.MONTHLY,
        nextDueDate: nextMonth,
        status: ExpenseTemplateStatus.ACTIVE,
        createdBy: 'Sarah Jenkins',
      },
      {
        branchId: dtBranch.id,
        categoryId: packCatId,
        description: 'Weekly Bulk Pizza Boxes & Brown Bags Delivery',
        amount: new Prisma.Decimal('8500.00'),
        frequency: ExpenseFrequency.WEEKLY,
        nextDueDate: nextWeek,
        status: ExpenseTemplateStatus.ACTIVE,
        createdBy: 'Elena Rostova',
      },
      {
        branchId: bwBranch.id,
        categoryId: utilCatId,
        description: 'Bandra West Commercial Kitchen Cylinder Refill',
        amount: new Prisma.Decimal('6200.00'),
        frequency: ExpenseFrequency.WEEKLY,
        nextDueDate: nextWeek,
        status: ExpenseTemplateStatus.ACTIVE,
        createdBy: 'Marcus Vance',
      },
    ];

    for (const t of dtTemplates) {
      const existing = await prisma.expenseTemplate.findFirst({
        where: { branchId: t.branchId, description: t.description },
      });
      if (!existing) {
        await prisma.expenseTemplate.create({ data: t });
      }
    }
    console.log('    ✓ 3 Recurring Expense Templates seeded');
  }

  // Sample Expenses Across Lifecycles
  const sampleExpenses = [
    {
      expenseNumber: 'EXP-2026-000001',
      branchId: dtBranch.id,
      categoryId: expenseCategoryMap.get('UTILITIES')!,
      amount: new Prisma.Decimal('8750.00'),
      expenseDate: new Date('2026-09-15'),
      description: 'Monthly Commercial Electricity Bill',
      vendorName: 'Adani Electricity Mumbai Ltd',
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      referenceNumber: 'NEFT-ADANI-8839201',
      status: ExpenseStatus.APPROVED,
      receiptUrl: null,
      notes: 'Peak billing tariff settled directly via corporate net banking.',
      createdBy: 'Elena Rostova',
      approvedBy: 'Sarah Jenkins',
      approvedAt: new Date('2026-09-16T11:30:00Z'),
      auditLogs: [
        { action: 'CREATED', fromStatus: null, toStatus: ExpenseStatus.DRAFT, performedBy: 'Elena Rostova', notes: 'Initial draft expense record' },
        { action: 'SUBMITTED', fromStatus: ExpenseStatus.DRAFT, toStatus: ExpenseStatus.PENDING_APPROVAL, performedBy: 'Elena Rostova', notes: 'Submitted for owner approval' },
        { action: 'APPROVED', fromStatus: ExpenseStatus.PENDING_APPROVAL, toStatus: ExpenseStatus.APPROVED, performedBy: 'Sarah Jenkins', notes: 'Verified against meter reading slip' },
      ],
    },
    {
      expenseNumber: 'EXP-2026-000002',
      branchId: dtBranch.id,
      categoryId: expenseCategoryMap.get('PACKAGING')!,
      amount: new Prisma.Decimal('14200.00'),
      expenseDate: new Date('2026-09-18'),
      description: '5000 Custom Corrugated Pizza Delivery Boxes (10-inch & 12-inch)',
      vendorName: 'EcoPack Paper Packaging LLP',
      paymentMethod: PaymentMethod.CARD,
      referenceNumber: 'TXN-CARD-98442',
      status: ExpenseStatus.APPROVED,
      receiptUrl: null,
      notes: 'Delivered to Downtown stockroom. Verified batch seal and print clarity.',
      createdBy: 'David Chen',
      approvedBy: 'Elena Rostova',
      approvedAt: new Date('2026-09-18T16:45:00Z'),
      auditLogs: [
        { action: 'CREATED', fromStatus: null, toStatus: ExpenseStatus.PENDING_APPROVAL, performedBy: 'David Chen', notes: 'Direct submission from shift purchase' },
        { action: 'APPROVED', fromStatus: ExpenseStatus.PENDING_APPROVAL, toStatus: ExpenseStatus.APPROVED, performedBy: 'Elena Rostova', notes: 'Delivery slip inspected and confirmed' },
      ],
    },
    {
      expenseNumber: 'EXP-2026-000003',
      branchId: dtBranch.id,
      categoryId: expenseCategoryMap.get('REPAIRS')!,
      amount: new Prisma.Decimal('3450.00'),
      expenseDate: new Date('2026-09-19'),
      description: 'Gas Deck Oven Thermostat Calibration and Gasket Replacement',
      vendorName: 'Speedy Kitchen Appliance Care',
      paymentMethod: PaymentMethod.UPI,
      referenceNumber: 'UPI/628109923812',
      status: ExpenseStatus.PENDING_APPROVAL,
      receiptUrl: null,
      notes: 'Emergency repair on oven #2 heating coil gasket after morning shift.',
      createdBy: 'Elena Rostova',
      approvedBy: null,
      approvedAt: null,
      auditLogs: [
        { action: 'CREATED', fromStatus: null, toStatus: ExpenseStatus.PENDING_APPROVAL, performedBy: 'Elena Rostova', notes: 'Logged under emergency maintenance workflow' },
      ],
    },
    {
      expenseNumber: 'EXP-2026-000004',
      branchId: bwBranch.id,
      categoryId: expenseCategoryMap.get('CLEANING')!,
      amount: new Prisma.Decimal('12500.00'),
      expenseDate: new Date('2026-09-17'),
      description: 'Deep Kitchen Degreasing & Hood Duct Cleaning Service',
      vendorName: 'SparklePro Hygiene Services',
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      referenceNumber: null,
      status: ExpenseStatus.REJECTED,
      rejectionReason: 'Vendor quote exceeds approved quarterly cleaning budget. Obtain 2 alternative competitive bids before rescheduling duct service.',
      receiptUrl: null,
      notes: 'Quotation submitted for duct cleaning.',
      createdBy: 'Marcus Vance',
      auditLogs: [
        { action: 'CREATED', fromStatus: null, toStatus: ExpenseStatus.PENDING_APPROVAL, performedBy: 'Marcus Vance', notes: 'Vendor quotation submitted' },
        { action: 'REJECTED', fromStatus: ExpenseStatus.PENDING_APPROVAL, toStatus: ExpenseStatus.REJECTED, performedBy: 'Sarah Jenkins', notes: 'Vendor quote exceeds approved quarterly cleaning budget' },
      ],
    },
    {
      expenseNumber: 'EXP-2026-000005',
      branchId: bwBranch.id,
      categoryId: expenseCategoryMap.get('RAW_MATERIAL')!,
      amount: new Prisma.Decimal('4200.00'),
      expenseDate: new Date('2026-09-20'),
      description: 'Emergency Market Procurements: Extra Fresh Mozzarella & Basil',
      vendorName: 'Vashi Wholesale Dairy Mandi',
      paymentMethod: PaymentMethod.CASH,
      referenceNumber: null,
      status: ExpenseStatus.DRAFT,
      receiptUrl: null,
      notes: 'Procured during sudden Saturday dinner rush due to stockout.',
      createdBy: 'Marcus Vance',
      auditLogs: [
        { action: 'CREATED', fromStatus: null, toStatus: ExpenseStatus.DRAFT, performedBy: 'Marcus Vance', notes: 'Saved as draft pending paper cash memo receipt upload' },
      ],
    },
    {
      expenseNumber: 'EXP-2026-000006',
      branchId: andBranch.id,
      categoryId: expenseCategoryMap.get('MAINTENANCE')!,
      amount: new Prisma.Decimal('2800.00'),
      expenseDate: new Date('2026-09-14'),
      description: 'Preventative AC Filter Cleaning & Outdoor Unit Pressure Wash',
      vendorName: 'CoolAir HVAC Technicians',
      paymentMethod: PaymentMethod.CASH,
      referenceNumber: null,
      status: ExpenseStatus.CANCELLED,
      cancellationReason: 'Duplicate expense slip entered. Service was already covered under annual maintenance contract (AMC invoice #AMC-4412).',
      receiptUrl: null,
      notes: 'Logged twice by accident by different shift supervisors.',
      createdBy: 'David Chen',
      cancelledBy: 'Elena Rostova',
      cancelledAt: new Date('2026-09-15T10:00:00Z'),
      auditLogs: [
        { action: 'CREATED', fromStatus: null, toStatus: ExpenseStatus.DRAFT, performedBy: 'David Chen', notes: 'Draft created' },
        { action: 'CANCELLED', fromStatus: ExpenseStatus.DRAFT, toStatus: ExpenseStatus.CANCELLED, performedBy: 'Elena Rostova', notes: 'Duplicate expense slip entered' },
      ],
    },
  ];

  for (const exp of sampleExpenses) {
    const existing = await prisma.expense.findUnique({ where: { expenseNumber: exp.expenseNumber } });
    if (!existing) {
      const { auditLogs, ...expenseData } = exp;
      const createdExpense = await prisma.expense.create({
        data: expenseData,
      });

      if (auditLogs && auditLogs.length > 0) {
        for (const log of auditLogs) {
          await prisma.expenseAuditLog.create({
            data: {
              expenseId: createdExpense.id,
              ...log,
            },
          });
        }
      }
    }
  }
  console.log(`    ✓ ${sampleExpenses.length} Sample Expenses seeded with full audit trail`);

  // 17. Seed Baseline Salary Structures for Employees
  console.log('  → Seeding baseline salary structures for employees...');
  const allEmployees = await prisma.employee.findMany();
  let seededStructures = 0;
  for (const emp of allEmployees) {
    const existing = await prisma.salaryStructure.findFirst({
      where: { employeeId: emp.id, status: 'ACTIVE' },
    });
    if (!existing) {
      await prisma.salaryStructure.create({
        data: {
          employeeId: emp.id,
          branchId: emp.branchId,
          salary: emp.salary,
          salaryType: emp.salaryType,
          effectiveFrom: emp.joiningDate,
          effectiveTo: null,
          reason: 'Initial onboarding salary agreement',
          status: 'ACTIVE',
          createdBy: 'System Seed',
        },
      });
      seededStructures++;
    }
  }
  console.log(`    ✓ ${seededStructures} Baseline Salary Structures seeded`);

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
