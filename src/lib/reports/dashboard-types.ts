/**
 * Executive Dashboard & Business Overview — Type Definitions
 *
 * Strongly typed structures for executive KPIs, sales trends, branch benchmarks,
 * order/payment breakdowns, inventory health, attendance facts, pending approvals,
 * customer feedback, and consolidated recent activity.
 */

export type DashboardDatePreset =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'month'
  | 'custom';

export interface DashboardDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

// ─── Executive Summary KPI ──────────────────────────────────────────────────

export interface KPICardValue {
  label: string;
  value: number;
  formattedValue: string;
  previousValue?: number;
  changePercentage?: number | null; // null if previous period is 0 or unavailable
  trend?: 'up' | 'down' | 'neutral';
  helperText?: string;
  isFinancial?: boolean;
}

export interface ExecutiveKPIs {
  netSales: KPICardValue;
  orderCount: KPICardValue;
  averageOrderValue: KPICardValue;
  successfulPayments: KPICardValue;
  approvedExpenses: KPICardValue;
  operatingResult: KPICardValue;
}

// ─── Sales Trend ────────────────────────────────────────────────────────────

export interface SalesTrendPoint {
  key: string;       // hour "14:00" or date "2026-09-21"
  label: string;     // display label: "2 PM" or "21 Sep"
  netSales: number;
  orderCount: number;
}

// ─── Branch Performance ─────────────────────────────────────────────────────

export interface BranchPerformanceItem {
  branchId: string;
  branchName: string;
  branchCode: string;
  orderCount: number;
  grossSales: number;
  netSales: number;
  averageOrderValue: number;
  successfulPayments: number;
  approvedExpenses: number;
  operatingResult: number;
}

// ─── Order Overview ─────────────────────────────────────────────────────────

export interface OrderStatusCount {
  status: string;
  count: number;
}

export interface OrderTypeCount {
  type: string;
  count: number;
  amount: number;
}

export interface OrderOverviewStats {
  totalOrders: number;
  pending: number;
  confirmed: number;
  preparing: number;
  ready: number;
  completed: number;
  cancelled: number;
  refunded: number;
  orderTypes: OrderTypeCount[];
}

// ─── Payment Overview ───────────────────────────────────────────────────────

export interface PaymentMethodStat {
  method: string;
  count: number;
  amount: number;
}

export interface PaymentOverviewStats {
  methods: PaymentMethodStat[];
  totalSuccessfulAmount: number;
  totalSuccessfulCount: number;
  failedCount: number;
  failedAmount: number;
  refundedAmount: number;
}

// ─── Top Selling Products ───────────────────────────────────────────────────

export interface TopProductItem {
  menuItemId: string;
  menuItemName: string;
  categoryName: string;
  quantitySold: number;
  netSales: number;
}

// ─── Inventory Health ───────────────────────────────────────────────────────

export interface RecentInventoryIssue {
  id: string;
  itemName: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'VARIANCE' | 'WASTAGE';
  message: string;
  branchName: string;
  createdAt: string;
}

export interface InventoryHealthStats {
  lowStockCount: number;
  outOfStockCount: number;
  stockVarianceCount: number;
  damageWastageQty: number;
  damageWastageCost: number;
  recentIssues: RecentInventoryIssue[];
}

// ─── Attendance Overview ────────────────────────────────────────────────────

export interface AttendanceOverviewStats {
  totalEmployees: number;
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  lateArrivals: number;
  earlyDepartures: number;
}

// ─── Pending Approvals ──────────────────────────────────────────────────────

export interface PendingApprovalsStats {
  expenseApprovals: number;
  bonusApprovals: number;
  salaryReviews: number;
  purchaseOrdersRequiringAction: number;
  totalPendingCount: number;
}

// ─── Customer & Review Overview ─────────────────────────────────────────────

export interface CustomerFeedbackStats {
  newCustomers: number;
  completedCustomerOrders: number;
  reviewCount: number;
  averageRating: number;
  openIssuesCount: number;
  highUrgentIssuesCount: number;
}

// ─── Recent Activity Feed ───────────────────────────────────────────────────

export type RecentActivityType =
  | 'ORDER_COMPLETED'
  | 'PAYMENT_RECEIVED'
  | 'PURCHASE_RECEIVED'
  | 'STOCK_ADJUSTED'
  | 'WASTAGE_RECORDED'
  | 'EXPENSE_APPROVED'
  | 'REVIEW_SUBMITTED'
  | 'CUSTOMER_ISSUE';

export interface RecentActivityItem {
  id: string;
  type: RecentActivityType;
  title: string;
  description: string;
  timestamp: string; // ISO string
  branchName?: string;
  amount?: number;
  link?: string;
}

// ─── Master Dashboard Bundle ────────────────────────────────────────────────

export interface ExecutiveDashboardData {
  // Filters & Context
  dateRange: DashboardDateRange;
  preset: DashboardDatePreset;
  selectedBranchId: string;
  effectiveBranchId?: string;
  isAllBranches: boolean;
  isBranchRestricted: boolean;
  canViewFinancials: boolean;
  canViewBranches: boolean;
  userRole: string;
  userName: string;
  accessibleBranches: Array<{ id: string; name: string; code: string }>;

  // Sections
  kpis: ExecutiveKPIs;
  salesTrend: SalesTrendPoint[];
  salesTrendGrouping: 'hourly' | 'daily';
  branchPerformance: BranchPerformanceItem[];
  orderOverview: OrderOverviewStats;
  paymentOverview: PaymentOverviewStats;
  topProducts: TopProductItem[];
  inventoryHealth: InventoryHealthStats;
  attendanceOverview: AttendanceOverviewStats;
  pendingApprovals: PendingApprovalsStats;
  customerFeedback: CustomerFeedbackStats;
  recentActivity: RecentActivityItem[];
}
