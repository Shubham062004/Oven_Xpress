# Reports & Data Export Module Documentation

## 1. Overview & Architectural Philosophy

The **Reports & Data Export** module (`/reports`) is a centralized reporting suite designed for the multi-branch Oven Xpress restaurant platform. It provides role-aware business intelligence, financial reconciliation, operational audits, native print styling, and RFC-4180 CSV export across all operational domains.

### Core Architectural Tenets:
1. **Zero Duplicate Tables or Caches:** All 14 reports dynamically query primary source-of-truth Prisma database models (`Order`, `OrderItem`, `Payment`, `PaymentRefund`, `Expense`, `InventoryItem`, `StockTransaction`, `PurchaseOrder`, `Attendance`, `SalaryRecord`, `Customer`, `Review`). No secondary reporting ledgers or materialized shadow tables exist.
2. **Server-Side Branch Scoping & Anti-Tampering:** Branch access is strictly resolved on the server using `getAuthorizedBranchScope(user)`. Branch IDs provided via client query parameters or server action payloads cannot bypass assigned permissions. If a restricted user attempts to request an unauthorized branch, the request is immediately rejected or sanitized to their assigned branch.
3. **Role-Based Financial Concealment:** Financial reports (`sales`, `compensation`, `expenses`, `profit-loss`) require explicit granular permissions (`report.sales.read`, `report.compensation.read`, `report.finance.read`). Unauthorized roles (such as store staff) cannot access or view financial figures.
4. **Standardized Query Performance:** Database aggregations utilize parallel Prisma queries (`Promise.all`), indexed lookups, and bounded date boundaries ($\le 366$ days) to prevent unconstrained full-table scans.
5. **Reproducible Calculations:** Historical snapshots (e.g., `OrderItem.unitPrice`, `Payment.amount`) are respected without recalculating past orders with present-day catalog prices.

---

## 2. Available Reports & Route Structure

The reports hub (`/reports`) organizes reports into 5 functional categories:

| Category | Route | Report Name | Data Source Models | Required Permission |
| :--- | :--- | :--- | :--- | :--- |
| **Sales & Orders** | `/reports/sales` | Sales Report | `Order`, `PaymentRefund` | `report.sales.read` / `order.read` |
| | `/reports/orders` | Orders Report | `Order`, `OrderItem`, `Customer` | `report.orders.read` / `order.read` |
| | `/reports/products` | Product Sales Report | `OrderItem`, `MenuItem`, `MenuCategory` | `report.product.read` / `menu.item.read` |
| | `/reports/branches` | Branch Benchmark Report | `Branch`, `Order`, `Expense` | `report.branch.read` / `branch.read` |
| **Financial Flow** | `/reports/payments` | Payment Reconciliation | `Payment`, `PaymentRefund`, `Order` | `report.payment.read` / `payment.read` |
| | `/reports/expenses` | Expense Ledger Report | `Expense`, `ExpenseCategory` | `report.expense.read` / `expense.read` |
| | `/reports/profit-loss` | Operating Profit & Loss | `Order`, `PaymentRefund`, `Expense`, `SalaryRecord` | `report.finance.read` / `report.sales.read` |
| **Supply & Inventory** | `/reports/inventory` | Inventory & Movements | `InventoryItem`, `StockTransaction`, `Ingredient` | `report.inventory.read` / `inventory.read` |
| | `/reports/purchases` | Purchase Orders Report | `PurchaseOrder`, `PurchaseOrderItem`, `Supplier` | `report.purchase.read` / `purchase.read` |
| | `/reports/wastage` | Spoilage & Wastage Report | `StockTransaction`, `Ingredient` | `report.wastage.read` / `inventory.read` |
| **Workforce & HR** | `/reports/attendance` | Attendance & Punctuality | `Attendance`, `Employee`, `Shift` | `report.attendance.read` / `attendance.read` |
| | `/reports/compensation` | Salary & Compensation | `SalaryRecord`, `Employee` | `report.compensation.read` / `salary.read` |
| **Customer Experience** | `/reports/customers` | Customer Frequency & Spend | `Customer`, `Order`, `Review` | `report.customer.read` / `customer.read` |
| | `/reports/reviews` | Reviews & Feedback Report | `Review`, `Customer`, `Order` | `report.review.read` / `review.read` |

---

## 3. Metric & KPI Definitions

All report calculations adhere strictly to Step 14 operational financial semantics:

- **Gross Sales:** Sum of `totalAmount` for all orders with status `COMPLETED`. Cancelled or in-flight orders are excluded.
- **Discounts:** Sum of `discountAmount` across completed orders.
- **Refunds:** Sum of `amount` from `PaymentRefund` records with status `COMPLETED`.
- **Net Sales / Net Revenue:** $\text{Gross Sales} - \text{Discounts} - \text{Refunds}$.
- **Average Order Value (AOV):** $\text{Net Sales} \div \text{Completed Orders Count}$ (guarded against division by zero; returns 0 if count is 0).
- **Approved Operating Expenses:** Sum of `Expense.amount` where `status = 'APPROVED'`. Pending or rejected expenses are excluded.
- **Approved Payroll / Salary:** Sum of `SalaryRecord.grossAmount` where `status = 'APPROVED'`.
- **Operating Result:** $\text{Net Revenue} - \text{Approved Expenses} - \text{Approved Salary}$.
  *(Note: Clearly designated as an operational management result, not statutory/GAAP P&L, since tax depreciation and COGS are handled separately).*
- **Current Inventory Stock:** Calculated dynamically from the immutable stock transaction ledger:
  $$\text{Current Stock} = \sum \text{IN transactions} - \sum \text{OUT transactions}$$

---

## 4. Filters & Date Scoping

All reports share a standardized filter control bar (`ReportViewContainer`):
- **Date Presets:**
  - `Today` (midnight to 23:59:59 in local business time)
  - `Yesterday`
  - `Last 7 days`
  - `Last 30 days`
  - `Current month`
  - `Custom range` (bounded: start date $\le$ end date, maximum window $\le 366$ days)
- **Branch Selector:**
  - Shows "All Branches" (for Owner/Admin) or single assigned branch (for Manager/Staff).
  - Client parameter changes update URL query string for shareability.
- **Module-Specific Filters:**
  - Order Type (`DINE_IN`, `TAKEAWAY`, `DELIVERY`)
  - Status filters (`COMPLETED`, `CANCELLED`, `PENDING`, `APPROVED`, `REJECTED`, etc.)
  - Category selectors (Menu categories, Expense categories)
  - Full-text search with debounce (order #, customer name, ingredient name, vendor name, etc.)
- **Server-Side Pagination:** Standard `page` and `limit` controls with total count and page indicators.

---

## 5. Branch Security & Anti-Tampering Enforcement

Branch access verification is enforced at two distinct layers:
1. **Server Action Entrypoint (`resolveReportContext`):**
   Calls `getAuthorizedBranchScope(user)`. If the user has role `MANAGER` or `STAFF`, their accessible branch list contains strictly `[employee.branchId]`.
2. **Service Layer Execution (`resolveBranchFilter`):**
   If an incoming request provides `?branchId=<another-branch>`, the server rejects the request with an unauthorized error or forces `branchId = user.branchId`.
3. **CSV Export Layer:**
   The CSV generation actions re-run the exact same branch resolution logic, guaranteeing that export requests cannot bypass authorization.

---

## 6. CSV Export Behavior

- **Format:** Fully RFC-4180 compliant CSV stream.
- **Escaping:** Fields containing commas, double quotes, or newlines are wrapped in double quotes; existing double quotes are escaped as `""`.
- **Encoding:** UTF-8 encoded with clean timestamped filenames (e.g., `sales-report-2026-09-21.csv`).
- **Data Parity:** Export queries use the exact same filters, date bounds, and branch scope as the UI view.
- **Data Volume:** Server action enforces an export threshold (up to 5,000 records per export) to maintain responsive database query throughput.

---

## 7. Print-Friendly Report View

- **Trigger:** Interactive "Print" button on every report page triggers native `window.print()`.
- **Print Styling (`@media print`):**
  - Hides sidebars, navigation bars, header breadcrumbs, interactive filter dropdowns, pagination buttons, and action bars.
  - Generates a clean top header displaying Report Name, Applied Date Range, Target Branch, and Generation Timestamp.
  - Expands table widths to 100% with high-contrast text and clean borders for physical printing or PDF saving.

---

## 8. Permissions Matrix

| Permission Code | Description | Default Roles |
| :--- | :--- | :--- |
| `report.sales.read` | View sales and revenue reports | OWNER, ADMIN, MANAGER |
| `report.sales.export` | Export sales reports to CSV | OWNER, ADMIN |
| `report.orders.read` | View orders reports | OWNER, ADMIN, MANAGER |
| `report.orders.export` | Export orders reports to CSV | OWNER, ADMIN |
| `report.product.read` | View product velocity reports | OWNER, ADMIN, MANAGER |
| `report.product.export` | Export product reports to CSV | OWNER, ADMIN |
| `report.branch.read` | View multi-branch operational benchmarks | OWNER, ADMIN |
| `report.branch.export` | Export branch benchmarks to CSV | OWNER, ADMIN |
| `report.payment.read` | View payment reconciliation reports | OWNER, ADMIN, MANAGER |
| `report.payment.export` | Export payment reports to CSV | OWNER, ADMIN |
| `report.expense.read` | View operating expense reports | OWNER, ADMIN, MANAGER |
| `report.expense.export` | Export expense reports to CSV | OWNER, ADMIN |
| `report.inventory.read` | View inventory and ledger movements | OWNER, ADMIN, MANAGER |
| `report.inventory.export` | Export inventory reports to CSV | OWNER, ADMIN |
| `report.purchase.read` | View procurement and purchase reports | OWNER, ADMIN, MANAGER |
| `report.purchase.export` | Export purchase reports to CSV | OWNER, ADMIN |
| `report.wastage.read` | View wastage and damage reports | OWNER, ADMIN, MANAGER |
| `report.wastage.export` | Export wastage reports to CSV | OWNER, ADMIN |
| `report.attendance.read`| View employee attendance and punctuality | OWNER, ADMIN, MANAGER |
| `report.attendance.export`| Export attendance reports to CSV | OWNER, ADMIN |
| `report.compensation.read`| View confidential salary and payroll facts | OWNER, ADMIN |
| `report.compensation.export`| Export compensation reports to CSV | OWNER, ADMIN |
| `report.customer.read` | View customer frequency and lifetime spend | OWNER, ADMIN, MANAGER |
| `report.customer.export` | Export customer reports to CSV | OWNER, ADMIN |
| `report.review.read` | View customer reviews and star ratings | OWNER, ADMIN, MANAGER |
| `report.review.export` | Export reviews reports to CSV | OWNER, ADMIN |
| `report.finance.read` | View operational Profit & Loss statements | OWNER, ADMIN |
| `report.finance.export` | Export financial statements to CSV | OWNER, ADMIN |

---

## 9. Known Limitations & Non-Goals

1. **Statutory & Tax Accounting:** The Profit & Loss report represents an *operational management result* ($\text{Revenue} - \text{Expenses} - \text{Salaries}$). It does not compute statutory corporate income taxes, depreciation/amortization of capital assets, balance sheets, or official GST filings.
2. **COGS Inventory Valuations:** Stock valuation is based on procurement receipt prices and physical transaction quantities; periodic FIFO/LIFO lot matching is not implemented.
3. **Automated Scheduled Email Delivery:** Automated recurring cron email dispatch of PDF/CSV reports is outside the scope of Step 18 and belongs to future scheduled reporting integrations.
