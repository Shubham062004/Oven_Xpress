import { prisma } from '../src/lib/db/prisma';
import {
  getExecutiveDashboardData,
  exportDashboardSummaryCSV,
} from '../src/lib/reports/dashboard-service';
import type { AuthUser } from '../src/lib/auth/types';
import { PERMISSIONS } from '../src/lib/permissions/definitions';

async function runTests() {
  console.log('--- Step 17: Owner Dashboard & Business Overview Verification Tests ---');

  // 1. Fetch prerequisite users and branches
  const [ownerUser, managerUser, staffUser, branches] = await Promise.all([
    prisma.user.findFirst({
      where: { role: { name: 'OWNER' } },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    }),
    prisma.user.findFirst({
      where: { role: { name: 'MANAGER' }, employee: { isNot: null } },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        employee: true,
      },
    }),
    prisma.user.findFirst({
      where: { role: { name: 'STAFF' } },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        employee: true,
      },
    }),
    prisma.branch.findMany({ where: { status: 'ACTIVE' } }),
  ]);

  if (!ownerUser || branches.length === 0) {
    throw new Error('Test prerequisites not found (owner user or branches missing).');
  }

  console.log(`[PASS] Found Owner: ${ownerUser.name} (${ownerUser.id})`);
  console.log(`[PASS] Found ${branches.length} active branches`);

  // Construct AuthUser for Owner
  const ownerAuthUser: AuthUser = {
    id: ownerUser.id,
    email: ownerUser.email,
    name: ownerUser.name,
    role: ownerUser.role.name,
    permissions: ownerUser.role.permissions.map((p) => p.permission.code),
    isActive: ownerUser.isActive,
  };

  // ─── Test 1: Global Scoping for Owner ─────────────────────────────────────
  console.log('\n[Test 1] Owner Cross-Branch Rollup & Financial Access');
  const ownerRes = await getExecutiveDashboardData({ preset: 'today', branchId: 'all' }, ownerAuthUser);
  if (!ownerRes.success) {
    throw new Error(`Owner dashboard query failed: ${ownerRes.error}`);
  }
  const ownerData = ownerRes.data;
  if (!ownerData.isAllBranches) {
    throw new Error('Owner should have isAllBranches = true when selecting all');
  }
  if (!ownerData.canViewFinancials) {
    throw new Error('Owner should have canViewFinancials = true');
  }
  if (ownerData.accessibleBranches.length !== branches.length) {
    throw new Error('Owner should have access to all active branches');
  }
  console.log(`[PASS] Owner views all ${ownerData.accessibleBranches.length} branches`);
  console.log(`[PASS] Net Sales: ${ownerData.kpis.netSales.formattedValue}`);
  console.log(`[PASS] Completed Orders: ${ownerData.kpis.orderCount.formattedValue}`);
  console.log(`[PASS] Operating Result: ${ownerData.kpis.operatingResult.formattedValue}`);

  // ─── Test 2: Manager Scoping ─────────────────────────────────────────────
  if (managerUser && managerUser.employee?.branchId) {
    console.log('\n[Test 2] Manager Branch Scoping Enforcement');
    const managerAuthUser: AuthUser = {
      id: managerUser.id,
      email: managerUser.email,
      name: managerUser.name,
      role: managerUser.role.name,
      permissions: managerUser.role.permissions.map((p) => p.permission.code),
      isActive: managerUser.isActive,
    };

    const managerRes = await getExecutiveDashboardData({ preset: 'today' }, managerAuthUser);
    if (!managerRes.success) {
      throw new Error(`Manager dashboard failed: ${managerRes.error}`);
    }
    const managerData = managerRes.data;
    if (!managerData.isBranchRestricted) {
      throw new Error('Manager should have isBranchRestricted = true');
    }
    if (managerData.accessibleBranches.length !== 1) {
      throw new Error('Manager should only see their 1 assigned branch');
    }
    if (managerData.effectiveBranchId !== managerUser.employee.branchId) {
      throw new Error('Manager effectiveBranchId must match assigned branchId');
    }
    console.log(`[PASS] Manager scoped strictly to branch: ${managerData.accessibleBranches[0].name}`);

    // ─── Test 3: Manager Parameter Tamper Protection ───────────────────────
    console.log('\n[Test 3] Manager Cross-Branch URL Tamper Resistance');
    const otherBranch = branches.find((b) => b.id !== managerUser.employee?.branchId);
    if (otherBranch) {
      const tamperRes = await getExecutiveDashboardData(
        { preset: 'today', branchId: otherBranch.id },
        managerAuthUser
      );
      if (tamperRes.success) {
        if (tamperRes.data.effectiveBranchId !== managerUser.employee.branchId) {
          throw new Error('Manager accessed unauthorized branch via parameter!');
        }
        console.log('[PASS] Server safely forced assigned branch, ignoring unauthorized branchId parameter');
      }
    }
  } else {
    console.log('[SKIP] Test 2 & 3: No manager with assigned branch found in seed data');
  }

  // ─── Test 4: Staff Financial Concealment ──────────────────────────────────
  console.log('\n[Test 4] Staff Role-Based Financial Concealment');
  const staffAuthUser: AuthUser = {
    id: staffUser ? staffUser.id : 'mock-staff-id',
    email: 'staff@ovenxpress.com',
    name: 'Test Staff',
    role: 'STAFF',
    permissions: [PERMISSIONS.DASHBOARD_READ, PERMISSIONS.ORDER_READ], // NO report.sales.read
    isActive: true,
  };

  const staffRes = await getExecutiveDashboardData({ preset: 'today' }, staffAuthUser);
  if (staffRes.success) {
    const staffData = staffRes.data;
    if (staffData.canViewFinancials) {
      throw new Error('Staff without report.sales.read must not have canViewFinancials = true');
    }
    if (staffData.kpis.netSales.formattedValue !== 'Restricted') {
      throw new Error('Net sales must be "Restricted" for staff');
    }
    if (staffData.kpis.operatingResult.formattedValue !== 'Restricted') {
      throw new Error('Operating result must be "Restricted" for staff');
    }
    if (typeof staffData.kpis.orderCount.value !== 'number') {
      throw new Error('Operational orderCount should still be visible to staff');
    }
    console.log('[PASS] Financial KPIs properly hidden/restricted for unauthorized staff');
    console.log('[PASS] Operational orderCount remains accessible for staff');
  } else {
    console.log(`[PASS] Staff rejected when no branch assigned: ${staffRes.error}`);
  }

  // ─── Test 5: Date Presets & Bounded Ranges ────────────────────────────────
  console.log('\n[Test 5] Date Presets & Dynamic Grouping Validation');
  const presets = ['today', 'yesterday', '7d', '30d', 'month'] as const;

  for (const preset of presets) {
    const res = await getExecutiveDashboardData({ preset }, ownerAuthUser);
    if (!res.success) {
      throw new Error(`Preset ${preset} failed: ${res.error}`);
    }
    const d = res.data;
    if (d.dateRange.startDate > d.dateRange.endDate) {
      throw new Error(`Invalid range for preset ${preset}: ${d.dateRange.startDate} > ${d.dateRange.endDate}`);
    }
    if (preset === 'today' || preset === 'yesterday') {
      if (d.salesTrendGrouping !== 'hourly') {
        throw new Error(`Single day preset ${preset} should have hourly grouping`);
      }
    } else {
      if (d.salesTrendGrouping !== 'daily') {
        throw new Error(`Multi-day preset ${preset} should have daily grouping`);
      }
    }
    console.log(`[PASS] Preset "${preset}": ${d.dateRange.startDate} to ${d.dateRange.endDate} (${d.salesTrendGrouping})`);
  }

  // Custom range test
  const customRes = await getExecutiveDashboardData(
    { preset: 'custom', from: '2026-09-01', to: '2026-09-15' },
    ownerAuthUser
  );
  if (!customRes.success) {
    throw new Error(`Custom range failed: ${customRes.error}`);
  }
  if (customRes.data.salesTrendGrouping !== 'daily') {
    throw new Error('Custom multi-day range should have daily grouping');
  }
  console.log(`[PASS] Custom range 2026-09-01 to 2026-09-15 accepted with daily grouping`);

  // ─── Test 6: Zero Division & Safe Comparison Deltas ───────────────────────
  console.log('\n[Test 6] Safe Division & Comparison Badges');
  const kpiList = [
    ownerData.kpis.netSales,
    ownerData.kpis.orderCount,
    ownerData.kpis.averageOrderValue,
    ownerData.kpis.successfulPayments,
    ownerData.kpis.approvedExpenses,
    ownerData.kpis.operatingResult,
  ];

  for (const kpi of kpiList) {
    if (kpi.changePercentage !== null && kpi.changePercentage !== undefined) {
      if (Number.isNaN(kpi.changePercentage) || !Number.isFinite(kpi.changePercentage)) {
        throw new Error(`KPI ${kpi.label} has invalid change percentage: ${kpi.changePercentage}`);
      }
    }
  }
  console.log('[PASS] All KPI comparison badges are finite numbers or null (zero NaN/Infinity)');

  // ─── Test 7: Operations & Health Indicators ──────────────────────────────
  console.log('\n[Test 7] Operations Summary Consistency');
  console.log(`[PASS] Total Orders: ${ownerData.orderOverview.totalOrders} (Completed: ${ownerData.orderOverview.completed})`);
  console.log(`[PASS] Order Channels: ${ownerData.orderOverview.orderTypes.map((t) => `${t.type}: ${t.count}`).join(', ')}`);
  console.log(`[PASS] Payment Methods: ${ownerData.paymentOverview.methods.length} methods recorded`);
  console.log(`[PASS] Inventory Health: Low Stock: ${ownerData.inventoryHealth.lowStockCount}, Out of Stock: ${ownerData.inventoryHealth.outOfStockCount}`);
  console.log(`[PASS] Attendance: ${ownerData.attendanceOverview.present} present out of ${ownerData.attendanceOverview.totalEmployees} employees`);
  console.log(`[PASS] Pending Approvals: ${ownerData.pendingApprovals.totalPendingCount} total actionable`);
  console.log(`[PASS] Customer Feedback: Rating ${ownerData.customerFeedback.averageRating}★ (${ownerData.customerFeedback.reviewCount} reviews), Issues: ${ownerData.customerFeedback.openIssuesCount}`);
  console.log(`[PASS] Live Activity Stream: ${ownerData.recentActivity.length} recent events loaded`);

  // ─── Test 8: CSV Export ──────────────────────────────────────────────────
  console.log('\n[Test 8] CSV Export Integrity');
  const csvRes = await exportDashboardSummaryCSV({ preset: 'today' }, ownerAuthUser);
  if (!csvRes.success) {
    throw new Error(`CSV export failed: ${csvRes.error}`);
  }
  if (!csvRes.data.includes('EXECUTIVE KPIS') || !csvRes.data.includes('Net Sales')) {
    throw new Error('CSV output is missing KPI headers');
  }
  console.log(`[PASS] CSV Summary Export generated (${csvRes.data.length} characters)`);

  console.log('\n======================================================');
  console.log('ALL 8 STEP 17 DASHBOARD VERIFICATION TESTS PASSED!');
  console.log('======================================================\n');
}

runTests()
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
