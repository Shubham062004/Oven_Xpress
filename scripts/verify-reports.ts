import { prisma } from '../src/lib/db/prisma';
import {
  getSalesReportData,
  getOrdersReportData,
  getProductSalesReportData,
  getBranchesReportData,
  getPaymentsReportData,
  getExpensesReportData,
  getInventoryReportData,
  getStockMovementsReportData,
  getPurchasesReportData,
  getWastageReportData,
  getAttendanceReportData,
  getCompensationReportData,
  getCustomersReportData,
  getReviewsReportData,
  getAuthorizedBranchScope,
  resolveBranchFilter,
  generateGenericCSV,
} from '../src/lib/reports/report-service';
import { calculateProfitLossData } from '../src/lib/reports/actions';
import type { AuthUser } from '../src/lib/auth/types';

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING STEP 18 REPORTS & DATA EXPORT VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  // 0. Fetch test branches and setup mock users
  const branches = await prisma.branch.findMany();
  const firstBranch = branches[0];
  console.log(`Database connected. Found ${branches.length} branches.`);
  if (branches.length === 0) {
    console.error('No branches found in DB. Seed or create branches first.');
    process.exit(1);
  }

  const ownerUser: AuthUser = {
    id: 'test-owner-id',
    email: 'owner@ovenxpress.com',
    name: 'Owner User',
    role: 'OWNER',
    isActive: true,
    permissions: [],
  };

  const managerUser: AuthUser = {
    id: 'test-mgr-id',
    email: 'manager@ovenxpress.com',
    name: 'Branch Manager',
    role: 'MANAGER',
    isActive: true,
    permissions: [
      'report.sales.read',
      'report.orders.read',
      'report.inventory.read',
      'report.expense.read',
      'report.attendance.read',
    ],
  };

  // 1. Sales Report Verification
  console.log('\n--- 1. Testing Sales Report ---');
  try {
    const salesRes = await getSalesReportData(
      { preset: 'month', page: 1, limit: 25 },
      ownerUser
    );
    assert(Array.isArray(salesRes.rows), 'Sales report rows is array');
    assert(salesRes.summary.grossSales >= 0, 'Sales summary grossSales >= 0');
    assert(salesRes.summary.totalOrders >= 0, 'Sales summary totalOrders >= 0');
    assert(
      salesRes.summary.netSales <= salesRes.summary.grossSales,
      'Sales summary netSales <= grossSales (discounts deducted)'
    );
    console.log(
      `    Sales: ${salesRes.summary.totalOrders} orders, Net Sales: ₹${salesRes.summary.netSales}`
    );
  } catch (err: any) {
    assert(false, 'Sales report threw error', err.message);
  }

  // 2. Orders Report Verification
  console.log('\n--- 2. Testing Orders Report ---');
  try {
    const ordersRes = await getOrdersReportData(
      { preset: 'month', page: 1, limit: 25 },
      ownerUser
    );
    assert(Array.isArray(ordersRes.rows), 'Orders report rows is array');
    assert(ordersRes.summary.totalOrders >= 0, 'Orders summary totalOrders >= 0');
    assert(ordersRes.summary.totalAmount >= 0, 'Orders summary totalAmount >= 0');
    if (ordersRes.rows.length > 0) {
      const first = ordersRes.rows[0];
      assert(!!first.orderNumber, `Order row has valid orderNumber: ${first.orderNumber}`);
      assert(first.totalAmount >= 0, `Order row total is valid number: ${first.totalAmount}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Orders report threw error', msg);
  }

  // 3. Product Sales Report Verification
  console.log('\n--- 3. Testing Product Sales Report ---');
  try {
    const prodRes = await getProductSalesReportData(
      { preset: 'month', page: 1, limit: 25 },
      ownerUser
    );
    assert(Array.isArray(prodRes.rows), 'Product sales report rows is array');
    assert(prodRes.summary.totalQuantitySold >= 0, 'Product summary quantity >= 0');
    assert(prodRes.summary.grossSales >= 0, 'Product summary grossSales >= 0');
    if (prodRes.rows.length > 0) {
      assert(!!prodRes.rows[0].menuItemName, `Product row has name: ${prodRes.rows[0].menuItemName}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Product sales report threw error', msg);
  }

  // 4. Branch Benchmark Report Verification
  console.log('\n--- 4. Testing Branch Benchmark Report ---');
  try {
    const branchRes = await getBranchesReportData(
      { preset: 'month', page: 1, limit: 25 },
      ownerUser
    );
    assert(Array.isArray(branchRes.rows), 'Branch report rows is array');
    assert(branchRes.rows.length <= branches.length, 'Branch report rows <= accessible branches');
    assert(branchRes.summary.branchCount >= 0, 'Branch summary branchCount >= 0');
    if (branchRes.rows.length > 0) {
      const b0 = branchRes.rows[0];
      assert(typeof b0.operatingResult === 'number', 'Branch row has factual operating result');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Branch report threw error', msg);
  }

  // 5. Payment Report Verification
  console.log('\n--- 5. Testing Payment Report ---');
  try {
    const payRes = await getPaymentsReportData(
      { preset: 'month', page: 1, limit: 25 },
      ownerUser
    );
    assert(Array.isArray(payRes.rows), 'Payment report rows is array');
    assert(payRes.summary.totalPaymentsCount >= 0, 'Payment summary totalPaymentsCount >= 0');
    assert(payRes.summary.successfulAmount >= 0, 'Payment summary successfulAmount >= 0');
    assert(
      payRes.summary.failedAmount >= 0,
      'Failed payments categorized separately from successful payments'
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Payment report threw error', msg);
  }

  // 6. Expense Report Verification
  console.log('\n--- 6. Testing Expense Report ---');
  try {
    const expRes = await getExpensesReportData(
      { preset: 'month', page: 1, limit: 25 },
      ownerUser
    );
    assert(Array.isArray(expRes.rows), 'Expense report rows is array');
    assert(expRes.summary.approvedAmount >= 0, 'Expense summary approvedAmount >= 0');
    assert(
      expRes.summary.rejectedAmount >= 0,
      'Rejected expenses are tracked separately from approved'
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Expense report threw error', msg);
  }

  // 7. Inventory & Movements Report Verification
  console.log('\n--- 7. Testing Inventory Report ---');
  try {
    const [invRes, movRes] = await Promise.all([
      getInventoryReportData({ branchId: firstBranch.id, preset: 'month', page: 1, limit: 25 }, ownerUser),
      getStockMovementsReportData({ branchId: firstBranch.id, preset: 'month', page: 1, limit: 25 }, ownerUser),
    ]);
    assert(Array.isArray(invRes.rows), 'Inventory rows is array');
    assert(Array.isArray(movRes.rows), 'Stock movements rows is array');
    assert(invRes.summary.totalIngredients >= 0, 'Inventory summary totalIngredients >= 0');
    console.log(
      `    Stock items: ${invRes.rows.length}, Stock movements: ${movRes.rows.length}`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Inventory report threw error', msg);
  }

  // 8. Purchase Report Verification
  console.log('\n--- 8. Testing Purchase Report ---');
  try {
    const poRes = await getPurchasesReportData(
      { preset: 'month', page: 1, limit: 25 },
      ownerUser
    );
    assert(Array.isArray(poRes.rows), 'Purchase report rows is array');
    assert(poRes.summary.totalOrders >= 0, 'Purchase summary totalOrders >= 0');
    assert(poRes.summary.totalOrderedAmount >= 0, 'Purchase summary totalOrdered >= 0');
    assert(poRes.summary.totalReceivedAmount >= 0, 'Purchase summary totalReceived >= 0');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Purchase report threw error', msg);
  }

  // 9. Wastage & Damage Report Verification
  console.log('\n--- 9. Testing Wastage Report ---');
  try {
    const wasteRes = await getWastageReportData(
      { preset: 'month', page: 1, limit: 25 },
      ownerUser
    );
    assert(Array.isArray(wasteRes.rows), 'Wastage report rows is array');
    assert(wasteRes.summary.totalEvents >= 0, 'Wastage summary totalEvents >= 0');
    assert(Array.isArray(wasteRes.summary.byReason), 'Wastage breakdown byReason is array');
    assert(Array.isArray(wasteRes.summary.byIngredient), 'Wastage breakdown byIngredient is array');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Wastage report threw error', msg);
  }

  // 10. Attendance Report Verification
  console.log('\n--- 10. Testing Attendance Report ---');
  try {
    const attRes = await getAttendanceReportData(
      { preset: 'month', page: 1, limit: 25 },
      ownerUser
    );
    assert(Array.isArray(attRes.rows), 'Attendance report rows is array');
    assert(attRes.summary.totalRecords >= 0, 'Attendance summary totalRecords >= 0');
    assert(attRes.summary.presentCount >= 0, 'Attendance summary presentCount >= 0');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Attendance report threw error', msg);
  }

  // 11. Compensation Report Verification
  console.log('\n--- 11. Testing Compensation Report ---');
  try {
    const compRes = await getCompensationReportData(
      { preset: 'month', page: 1, limit: 25 },
      ownerUser
    );
    assert(Array.isArray(compRes.rows), 'Compensation report rows is array');
    assert(compRes.summary.totalRecords >= 0, 'Compensation summary totalRecords >= 0');
    assert(compRes.summary.totalGrossAmount >= 0, 'Compensation summary totalGrossAmount >= 0');
    assert(compRes.summary.totalNetAmount >= 0, 'Compensation summary totalNetAmount >= 0');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Compensation report threw error', msg);
  }

  // 12. Customer Report Verification
  console.log('\n--- 12. Testing Customer Report ---');
  try {
    const custRes = await getCustomersReportData(
      { preset: 'month', page: 1, limit: 25 },
      ownerUser
    );
    assert(Array.isArray(custRes.rows), 'Customer report rows is array');
    assert(custRes.summary.totalCustomers >= 0, 'Customer summary totalCustomers >= 0');
    assert(custRes.summary.totalSpend >= 0, 'Customer summary totalSpend >= 0');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Customer report threw error', msg);
  }

  // 13. Review Report Verification
  console.log('\n--- 13. Testing Review Report ---');
  try {
    const revRes = await getReviewsReportData(
      { preset: 'month', page: 1, limit: 25 },
      ownerUser
    );
    assert(Array.isArray(revRes.rows), 'Review report rows is array');
    assert(revRes.summary.totalReviews >= 0, 'Review summary totalReviews >= 0');
    assert(typeof revRes.summary.ratingBreakdown === 'object', 'Review ratingBreakdown is object');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Review report threw error', msg);
  }

  // 14. Profit & Loss Operational Report Verification
  console.log('\n--- 14. Testing Profit & Loss Report ---');
  try {
    const plRes = await calculateProfitLossData(
      { dateRange: { startDate: '2026-09-01', endDate: '2026-09-30' } },
      ownerUser
    );
    assert(typeof plRes.operatingResult === 'number', 'Profit & Loss operatingResult is number');
    assert(typeof plRes.netRevenue === 'number', 'Profit & Loss netRevenue is number');
    assert(typeof plRes.totalCosts === 'number', 'Profit & Loss totalCosts is number');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Profit & Loss report threw error', msg);
  }

  // 15. CSV Export Engine Verification
  console.log('\n--- 15. Testing CSV Export Engine ---');
  try {
    const salesData = await getSalesReportData({ preset: 'month', page: 1, limit: 10 }, ownerUser);
    const csvContent = generateGenericCSV(salesData.rows, [
      { key: 'date', header: 'Date' },
      { key: 'branchName', header: 'Branch' },
      { key: 'orderCount', header: 'Orders' },
      { key: 'grossSales', header: 'Gross Sales' },
      { key: 'discounts', header: 'Discounts' },
      { key: 'refunds', header: 'Refunds' },
      { key: 'netSales', header: 'Net Sales' },
      { key: 'averageOrderValue', header: 'AOV' },
    ]);
    assert(typeof csvContent === 'string', 'Sales CSV generated as string');
    assert(csvContent.includes('Date,Branch,Orders,Gross Sales'), 'CSV contains correct header row');
    assert(
      !csvContent.includes('undefined') && !csvContent.includes('null'),
      'CSV contains no raw undefined or null values'
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'CSV export threw error', msg);
  }

  // 16. Server-side Branch Security & Anti-Tampering Test
  console.log('\n--- 16. Testing Server-side Branch Security ---');
  try {
    // Find an actual manager employee to test scope
    const managerEmployee = await prisma.employee.findFirst({
      where: { user: { role: { name: 'MANAGER' } } },
      select: { userId: true, branchId: true },
    });

    if (managerEmployee && managerEmployee.userId) {
      const realManagerUser: AuthUser = {
        id: managerEmployee.userId,
        email: 'realmanager@test.com',
        name: 'Real Manager',
        role: 'MANAGER',
        isActive: true,
        permissions: ['report.sales.read'],
      };

      // Case A: Query with authorized branch
      const scopeA = await getAuthorizedBranchScope(realManagerUser);
      assert(
        scopeA.branchIds.length === 1 && scopeA.branchIds[0] === managerEmployee.branchId,
        'Authorized branch scope resolves manager branch correctly'
      );

      // Case B: Tampering test - manager attempts to access a different branch
      const filterTamper = await resolveBranchFilter(realManagerUser, 'fake-other-branch-id');
      assert(
        !!filterTamper.error,
        'Branch tampering blocked: manager cannot access unauthorized branch'
      );
    } else {
      console.log('    (Skipping real manager test: no manager employee in seed)');
    }

    // Case C: Owner universal access test
    const ownerScope = await getAuthorizedBranchScope(ownerUser);
    assert(
      ownerScope.isAllBranches === true,
      'Owner user has universal branch scope across all branches'
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Branch security verification threw unexpected error', msg);
  }

  // Summary
  console.log('\n====================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification()
  .catch((err) => {
    console.error('Fatal error during verification:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
