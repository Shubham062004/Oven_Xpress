# Feature Specification: Executive Dashboard & Business Overview (Step 17)

## 1. Overview

The Executive Dashboard provides restaurant owners, administrators, and general managers with a centralized, real-time command center for observing and analyzing the operational state of the Oven Xpress multi-branch restaurant business.

From a single interface, decision-makers can answer critical operational questions without manually navigating into individual sub-modules:
- **Sales & Volume**: How much revenue did the business generate, and how many orders were fulfilled?
- **Branch Performance**: How are individual locations performing side-by-side?
- **Product Velocity**: What dishes and items are selling the highest volumes?
- **Financial Flow**: What tender types were collected, what expenses were approved, and what is the resulting operational margin?
- **Inventory & Wastage Health**: Which items are low or out of stock, and are there material stock variances or kitchen wastage issues?
- **Workforce Facts**: What are the daily attendance facts, including present/absent rates, late arrivals, and early departures?
- **Actionable Approvals Queue**: How many expenses, bonus awards, salary reviews, and purchase orders are pending management action?
- **Customer Sentiment & Friction**: What are the latest review ratings and open customer issue volumes?
- **Live Activity**: What are the most recent operational events taking place across stores?

---

## 2. Routes & Role-Based Access

The dashboard is mounted at the root dashboard route with full `/dashboard` parity:
- `/` (Root application dashboard)
- `/dashboard` (Parity route re-exporting `/`)

### Role Gating & Information Privacy

| Role | Accessible Scope | Financial KPIs & Reports | Branch Filter |
| :--- | :--- | :--- | :--- |
| **OWNER** | Cross-Branch Rollup (All Branches) | Full Access (Sales, Expenses, Salary, P&L) | Can switch between All Branches and any individual branch |
| **ADMIN** | Cross-Branch Rollup (All Branches) | Full Access (Sales, Expenses, Salary, P&L) | Can switch between All Branches and any individual branch |
| **MANAGER** | Assigned Branch Only (`employee.branchId`) | Full Access for assigned branch | Locked to their single branch; cross-branch tampering rejected server-side |
| **STAFF** | Assigned Branch Only (`employee.branchId`) | **Masked / Restricted** (Financial cards hidden/labeled Restricted) | Locked to their assigned branch; operational metrics only |

---

## 3. Global Filter State & URL Synchronization

The dashboard supports persistent, shareable filter states synchronized with URL query parameters (`/dashboard?preset=...&branchId=...&from=...&to=...`).

### Date Range Presets

| Preset | Date Range Covered | Trend Grouping | Comparison Basis |
| :--- | :--- | :--- | :--- |
| **Today** (Default) | Today 00:00:00 to 23:59:59 | Hourly (8 AM - 11 PM) | Equivalent prior 24 hours (Yesterday) |
| **Yesterday** | Yesterday 00:00:00 to 23:59:59 | Hourly (8 AM - 11 PM) | Day before yesterday |
| **Last 7 Days** | Today - 6 days to Today | Daily | Preceding 7-day window |
| **Last 30 Days** | Today - 29 days to Today | Daily | Preceding 30-day window |
| **This Month** | 1st day of current month to Today | Daily | Preceding calendar month |
| **Custom Range** | User-selected `from` and `to` (bounded to $\le 366$ days) | Daily | Equivalent preceding window ($D = \text{to} - \text{from}$) |

### Security & Tamper Resistance
- Query parameter `branchId` is never trusted directly from the client.
- The server resolves the authenticated user's active session and evaluates `getAuthorizedBranchScope()`.
- For `MANAGER` and `STAFF`, any client-supplied `branchId` referencing an unauthorized location is overridden server-side to their assigned branch.

---

## 4. Key Performance Indicators (Executive Summary)

All financial KPI calculations strictly follow the Step 14 reporting formulas derived dynamically from existing source-of-truth tables without synthetic duplicate tables:

1. **Net Sales**:
   $$\text{Gross Sales} = \sum_{\text{COMPLETED, REFUNDED}} \text{order.totalAmount}$$
   $$\text{Discounts} = \sum_{\text{COMPLETED, REFUNDED}} \text{order.discountAmount}$$
   $$\text{Refunds} = \sum_{\text{SUCCESS}} \text{refund.amount}$$
   $$\text{Net Sales} = \max(0, \text{Gross Sales} - \text{Discounts} - \text{Refunds})$$

2. **Completed Orders**: Count of distinct orders with status `COMPLETED` or `REFUNDED` in the period.
3. **Average Order Value (AOV)**:
   $$\text{AOV} = \frac{\text{Net Sales}}{\text{Completed Orders}} \quad (\text{0 if completed orders} = 0)$$

4. **Successful Payments**: Sum of payments with status `SUCCESS` in the period.
5. **Approved Expenses**: Sum of operating expenses with status `APPROVED` in the period (excluding inventory purchase orders).
6. **Operating Result**:
   $$\text{Operating Result} = \text{Net Sales} - \text{Approved Expenses} - \text{Approved Salary}$$
   *(Approved Salary represents `SalaryRecord` with status `APPROVED` or `PAID` overlapping the selected date range).*

### Comparison Badges & Zero-Division Safety
- Each KPI card calculates percentage change compared to the previous equivalent period:
  $$\Delta = \left(\frac{\text{Current} - \text{Previous}}{\text{Previous}}\right) \times 100$$
- If `Previous === 0` or unavailable, the delta evaluates to `null` and displays `vs prev period: N/A`, preventing misleading infinite percentages or division-by-zero errors.

---

## 5. Dashboard Sections

### 1. Sales & Order Velocity Trend
- Visualizes revenue and order volume concurrently via Recharts.
- Uses dynamic grouping:
  - **Hourly (8 AM - 11 PM)** for 1-day ranges (Today, Yesterday).
  - **Daily** for multi-day periods.
- Dual-axis display: Net Sales area gradient on the primary axis, Order Count bars on the secondary axis.
- Uses hydration-safe `useSyncExternalStore` mounting to prevent SSR mismatches.

### 2. Live Activity Stream
- Pulls a real-time stream of the top 8 recent operational events from primary records:
  - Orders fulfilled (`Order` status `COMPLETED`)
  - Payments collected (`Payment` status `SUCCESS`)
  - Purchase orders received (`PurchaseOrder` status `RECEIVED`)
  - Wastage / Damage logged (`StockTransaction` types `DAMAGE`, `WASTAGE`)
  - Reviews submitted (`Review`)
- Includes event badge, description, store location, timestamp, and clickable deep-link.

### 3. Branch Performance Benchmark
- Displays accessible branches in a factual, side-by-side comparison table.
- Metrics: Orders, Net Sales, Average Order Value, Payments Settled, Approved Expenses, Operating Result.
- User-controlled sorting (by branch name, order count, net sales, or operating result).
- **Zero Evaluative Labels**: Does not rank branches as "best" or "worst".

### 4. Operations & Health Indicators Grid
- **Orders Breakdown**: Pipeline status counts (Pending, Preparing, Ready, Completed, Cancelled, Refunded) and Dining Channel split (Dine-in, Takeaway, Delivery).
- **Payment Methods**: Tender distribution (Cash, UPI, Card, Online, Other) and settled vs failed transactions.
- **Top Selling Products**: Descriptive sales ranking showing item name, category, quantity sold, and revenue generated.
- **Inventory Health**: Real-time counts for low-stock ingredients, out-of-stock items, manual stock variances, and total wastage volume with quick links to `/inventory`.
- **Attendance Facts**: Breakdown of Present, Absent, Half Day, Leave, Late Arrivals, and Early Departures.
- **Pending Approvals**: Actionable badge counts for pending expenses (`/expenses`), pending bonuses (`/salaries`), pending salary reviews (`/salaries`), and pending purchase orders (`/purchases`).
- **Customer Feedback**: Average review rating, total review count, and open customer issues with urgent priority indicators.

### 5. Operational Alerts Integration (Step 16)
- Integrates `DashboardAlertWidget` at the top of the dashboard.
- Highlights unread `CRITICAL` and `WARNING` notifications (e.g. out of stock items, reconciliation variances, pending approvals) with one-click dismiss and action links.

---

## 6. Performance & Anti-N+1 Strategy

To guarantee rapid loading even with extensive historical records:
1. **Parallel Aggregations**: All 16 database queries are dispatched concurrently in a single `Promise.all` server-side roundtrip.
2. **Database-Side Grouping**: Branch benchmarks use `prisma.order.groupBy({ by: ['branchId'], ... })`, `prisma.payment.groupBy`, and `prisma.expense.groupBy`. All branches are aggregated in $O(1)$ queries rather than $N$ queries per branch.
3. **Batch Stock Calculation**: Inventory health evaluates stock levels across all ingredients in a single SQL query via `calculateBatchStock(branchIds)`.
4. **Bounded Range Enforcement**: Custom date ranges are validated with Zod and strictly capped at 366 days to eliminate runaway query execution.
5. **No Client-Side Bulk Transfers**: Raw records are never sent to the browser for aggregation; all metric summarization occurs in PostgreSQL.

---

## 7. CSV Export

An integrated CSV summary export is accessible via the "Export CSV" button:
- Invokes `exportDashboardSummaryCSV(filters)`.
- Generates a structured CSV file with Executive KPIs, Branch Performance benchmarks, and Top Selling dishes.
- Triggers a clean client-side file download without third-party dependencies.
