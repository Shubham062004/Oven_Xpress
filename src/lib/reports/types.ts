/**
 * Sales & Financial Reporting — Type Definitions
 *
 * All report types used by the reporting server actions and UI components.
 */

// ─── Date Range ─────────────────────────────────────────────────────────────

export type DateRangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export interface ReportDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

// ─── Sales Overview ─────────────────────────────────────────────────────────

export interface SalesOverview {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  grossSales: number;        // sum of totalAmount for completed orders
  discounts: number;         // sum of discountAmount for completed orders
  taxCollected: number;      // sum of taxAmount for completed orders
  deliveryCharges: number;   // sum of deliveryCharge for completed orders
  refunds: number;           // sum of successful refund amounts
  netRevenue: number;        // grossSales - discounts - refunds
  successfulPayments: number; // sum of successful payment amounts
  failedPayments: number;    // sum of failed payment amounts
  approvedExpenses: number;  // sum of approved expense amounts
  approvedSalary: number;    // sum of approved/paid salary record grossAmounts
  operatingResult: number;   // netRevenue - approvedExpenses - approvedSalary
  averageOrderValue: number; // netRevenue / completedOrders (0 if no orders)
}

// ─── Daily Sales ────────────────────────────────────────────────────────────

export interface DailySalesRow {
  date: string; // YYYY-MM-DD
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  averageOrderValue: number;
}

// ─── Order-Type Breakdown ───────────────────────────────────────────────────

export interface OrderTypeSalesRow {
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  orderCount: number;
  revenue: number;
  percentage: number; // of total order count
}

// ─── Payment Method Breakdown ───────────────────────────────────────────────

export interface PaymentMethodRow {
  method: string;
  count: number;
  amount: number;
}

export interface PaymentMethodBreakdown {
  methods: PaymentMethodRow[];
  failedPayments: { count: number; amount: number };
  refundedAmount: number;
}

// ─── Branch Comparison ──────────────────────────────────────────────────────

export interface BranchSalesRow {
  branchId: string;
  branchName: string;
  branchCode: string;
  orderCount: number;
  grossSales: number;
  refunds: number;
  netSales: number;
  expenses: number;
  operatingResult: number;
}

// ─── Product Sales ──────────────────────────────────────────────────────────

export interface ProductSalesRow {
  menuItemId: string;
  menuItemName: string;
  categoryId: string;
  categoryName: string;
  quantitySold: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  orderCount: number; // number of distinct orders containing this item
}

// ─── Category Sales ─────────────────────────────────────────────────────────

export interface CategorySalesRow {
  categoryId: string;
  categoryName: string;
  quantitySold: number;
  revenue: number;
  percentage: number; // of total revenue
}

// ─── Hourly Breakdown ───────────────────────────────────────────────────────

export interface HourlyBreakdownRow {
  hour: number; // 0-23
  orderCount: number;
  sales: number;
}

// ─── Revenue Over Time ──────────────────────────────────────────────────────

export interface RevenueTimePoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  orders: number;
}

// ─── Profit & Loss Statement ────────────────────────────────────────────────

export interface ProfitLossStatement {
  // Revenue section
  grossSales: number;
  discounts: number;
  refunds: number;
  taxCollected: number;
  deliveryCharges: number;
  netRevenue: number;

  // Costs section
  approvedExpenses: number;
  expenseCategories: Array<{
    categoryName: string;
    amount: number;
  }>;
  approvedSalary: number;
  totalCosts: number;

  // Result
  operatingResult: number;

  // Metadata
  dateRange: ReportDateRange;
  branchName: string | null; // null = all branches
}

// ─── Purchase Report ────────────────────────────────────────────────────────

export interface PurchaseReportRow {
  purchaseOrderId: string;
  purchaseNumber: string;
  supplierName: string;
  branchName: string;
  branchCode: string;
  orderDate: string;
  status: string;
  totalAmount: number;
  receivedAmount: number;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardData {
  todaySales: number;
  todayOrders: number;
  todayExpenses: number;
  operatingResult: number;
  paymentBreakdown: PaymentMethodRow[];
  orderTypeBreakdown: OrderTypeSalesRow[];
  branchOverview: BranchSalesRow[];
  topSellingItems: Array<{
    menuItemName: string;
    quantitySold: number;
    revenue: number;
  }>;
  lowStockCount: number;
  pendingExpenseApprovals: number;
  pendingSalaryReviews: number;
}
