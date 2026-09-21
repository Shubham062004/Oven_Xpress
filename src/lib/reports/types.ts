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

// ─── Step 18: Standardized Reports & Data Export Types ───────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ReportFilterParams {
  branchId?: string;
  preset?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  status?: string;
  categoryId?: string;
  supplierId?: string;
  shiftId?: string;
  employeeId?: string;
  orderType?: string;
  paymentMethod?: string;
  reason?: string;
  rating?: number;
}

// 1. Sales Report
export interface SalesReportRow {
  date: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  orderCount: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  averageOrderValue: number;
}

export interface SalesReportSummary {
  totalOrders: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  averageOrderValue: number;
}

// 2. Orders Report
export interface OrdersReportRow {
  id: string;
  orderNumber: string;
  createdAt: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  orderType: string;
  status: string;
  customerName: string;
  customerPhone?: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  deliveryCharge: number;
  totalAmount: number;
  paymentStatus: string;
}

export interface OrdersReportSummary {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalAmount: number;
  totalDiscounts: number;
  totalNet: number;
  averageOrderTotal: number;
}

// 3. Product Sales Report
export interface ProductsReportRow {
  menuItemId: string;
  menuItemName: string;
  categoryName: string;
  branchName: string;
  quantitySold: number;
  grossSales: number;
  discounts: number;
  netSales: number;
}

export interface ProductsReportSummary {
  totalQuantitySold: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  uniqueItemsCount: number;
}

// 4. Branch Report
export interface BranchReportRow {
  branchId: string;
  branchName: string;
  branchCode: string;
  orderCount: number;
  netSales: number;
  averageOrderValue: number;
  successfulPayments: number;
  approvedExpenses: number;
  operatingResult: number;
}

export interface BranchReportSummary {
  branchCount: number;
  totalOrders: number;
  totalNetSales: number;
  totalPayments: number;
  totalExpenses: number;
  totalOperatingResult: number;
}

// 5. Payment Report
export interface PaymentsReportRow {
  id: string;
  paymentNumber: string;
  orderId: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  createdAt: string;
  amount: number;
  method: string;
  status: string;
  referenceNumber: string | null;
  processedBy: string;
  refundedAmount: number;
}

export interface PaymentsReportSummary {
  totalPaymentsCount: number;
  successfulCount: number;
  successfulAmount: number;
  failedCount: number;
  failedAmount: number;
  refundedAmount: number;
}

// 6. Expense Report
export interface ExpensesReportRow {
  id: string;
  expenseNumber: string;
  date: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  categoryName: string;
  amount: number;
  paymentMethod: string;
  vendor: string | null;
  status: string;
  description: string;
}

export interface ExpensesReportSummary {
  totalExpensesCount: number;
  approvedCount: number;
  approvedAmount: number;
  pendingCount: number;
  pendingAmount: number;
  rejectedCount: number;
  rejectedAmount: number;
}

// 7. Inventory Report
export interface InventoryReportRow {
  id: string;
  branchId: string;
  branchName: string;
  ingredientId: string;
  ingredientName: string;
  categoryName: string;
  unit: string;
  currentStock: number;
  minStock: number;
  reorderLevel: number;
  status: string;
  lastMovementDate: string | null;
}

export interface StockMovementReportRow {
  id: string;
  date: string;
  branchName: string;
  ingredientName: string;
  unit: string;
  type: string;
  quantity: number;
  referenceId: string | null;
  notes: string | null;
  createdBy: string;
}

export interface InventoryReportSummary {
  totalIngredients: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalMovementsCount: number;
}

// 8. Purchase Report
export interface PurchasesReportRow {
  id: string;
  purchaseNumber: string;
  supplierName: string;
  branchName: string;
  branchCode: string;
  orderDate: string;
  expectedDate: string | null;
  status: string;
  totalAmount: number;
  receivedAmount: number;
  itemCount: number;
}

export interface PurchasesReportSummary {
  totalOrders: number;
  totalOrderedAmount: number;
  totalReceivedAmount: number;
  receivedOrders: number;
  pendingOrders: number;
}

// 9. Wastage Report
export interface WastageReportRow {
  id: string;
  date: string;
  branchName: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  reason: string;
  notes: string | null;
  createdBy: string;
}

export interface WastageReportSummary {
  totalEvents: number;
  totalQuantity: number;
  byReason: Array<{ reason: string; quantity: number; count: number }>;
  byIngredient: Array<{ ingredientName: string; unit: string; quantity: number }>;
}

// 10. Attendance Report
export interface AttendanceReportRow {
  id: string;
  date: string;
  branchName: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  shiftName: string;
  status: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  lateMinutes: number;
  earlyDepartureMinutes: number;
}

export interface AttendanceReportSummary {
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  halfDayCount: number;
  leaveCount: number;
  lateArrivalsCount: number;
  earlyDeparturesCount: number;
}

// 11. Compensation Report
export interface CompensationReportRow {
  id: string;
  salaryRecordNumber: string;
  employeeName: string;
  employeeCode: string;
  branchName: string;
  periodMonth: number;
  periodYear: number;
  baseSalary: number;
  bonus: number;
  incentive: number;
  adjustment: number;
  grossAmount: number;
  netAmount: number;
  status: string;
}

export interface CompensationReportSummary {
  totalRecords: number;
  totalBaseSalary: number;
  totalBonus: number;
  totalIncentive: number;
  totalGrossAmount: number;
  totalNetAmount: number;
}

// 12. Customers Report
export interface CustomersReportRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  totalOrders: number;
  completedOrders: number;
  totalSpend: number;
  reviewCount: number;
  averageRating: number;
  lastOrderDate: string | null;
}

export interface CustomersReportSummary {
  totalCustomers: number;
  activeCustomers: number;
  customersWithOrders: number;
  totalSpend: number;
  averageRating: number;
}

// 13. Reviews Report
export interface ReviewsReportRow {
  id: string;
  createdAt: string;
  branchName: string;
  rating: number;
  status: string;
  customerName: string;
  orderNumber: string | null;
  comment: string | null;
  isPublished: boolean;
}

export interface ReviewsReportSummary {
  totalReviews: number;
  averageRating: number;
  ratingBreakdown: Record<number, number>;
  publishedCount: number;
  pendingCount: number;
  hiddenCount: number;
}
