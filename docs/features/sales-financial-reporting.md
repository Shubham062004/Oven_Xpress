# Sales, Revenue & Profit/Loss Reporting

## Purpose

The Sales, Revenue & Profit/Loss Reporting module provides the operational financial intelligence layer for the Oven Xpress multi-branch restaurant platform. It unifies transaction records from Orders, Payments, Refunds, Operating Expenses, Salary/Payroll, and Purchases into high-level business metrics, daily performance trends, product sales breakdowns, and executive dashboards.

> [!IMPORTANT]
> **Primary Source of Truth Architecture**: In accordance with the system design rules, this module **does not** create a duplicate `Sales` transaction table. All sales, revenue, average ticket sizes, and cost metrics are derived deterministically on-the-fly from the underlying operational records:
> - `Order` & `OrderItem`
> - `Payment` & `PaymentRefund`
> - `Expense`
> - `SalaryRecord`
> - `PurchaseOrder`

---

## Architecture & Data Flow

```
   ┌───────────┐      ┌─────────────┐      ┌─────────────┐
   │   Order   │      │   Payment   │      │PaymentRefund│
   └─────┬─────┘      └──────┬──────┘      └──────┬──────┘
         │                   │                    │
         │ COMPLETED         │ SUCCESS            │ SUCCESS
         ▼                   ▼                    ▼
   ┌─────────────────────────────────────────────────────┐
   │            Sales & Revenue Calculations             │
   │  Gross Sales = SUM(Order.totalAmount)               │
   │  Discounts   = SUM(Order.discountAmount)            │
   │  Refunds     = SUM(PaymentRefund.amount)            │
   │  Net Revenue = Gross Sales − Discounts − Refunds    │
   └──────────────────────────┬──────────────────────────┘
                              │
   ┌───────────┐              │              ┌─────────────┐
   │  Expense  ├──────────────┼──────────────┤SalaryRecord │
   └─────┬─────┘              │              └──────┬──────┘
         │ APPROVED           │                     │ APPROVED/PAID
         ▼                    ▼                     ▼
   ┌─────────────────────────────────────────────────────┐
   │               Operational Result (P&L)              │
   │  Total Costs = Approved Expenses + Approved Salary  │
   │  Operating Result = Net Revenue − Total Costs       │
   └─────────────────────────────────────────────────────┘
```

---

## Calculation Rules & Revenue Definitions

### 1. Revenue & Order Inclusions
- **Gross Sales**: `SUM(order.totalAmount)` where `order.status IN ('COMPLETED', 'REFUNDED')`.
- **Discounts**: `SUM(order.discountAmount)` for completed orders.
- **Tax Collected**: `SUM(order.taxAmount)` for completed orders.
- **Delivery Charges**: `SUM(order.deliveryCharge)` for completed orders.
- **Customer Refunds**: `SUM(refund.amount)` where `refund.status = 'SUCCESS'`.
- **Net Revenue**: `Gross Sales − Discounts − Refunds`.
- **Average Order Value (AOV)**: `Net Revenue / Completed Orders` (returns `0` if completed orders is 0; safe division protects against division by zero).

### 2. Excluded from Revenue
- **Cancelled Orders**: Orders with status `CANCELLED` are tracked separately and excluded from revenue metrics.
- **Pending/In-Flight Orders**: Orders with status `PENDING`, `CONFIRMED`, `PREPARING`, or `READY` have not yet settled and are excluded from completed sales figures.
- **Failed Payments**: Payments with status `FAILED` or `CANCELLED` are recorded for audit purposes but excluded from collections.

### 3. Expense Integration
- Only expenses with status `APPROVED` within the chosen date range (`expenseDate`) are counted towards operating expenditures.
- Pending or rejected expenses are excluded.

### 4. Payroll / Salary Integration
- Only `SalaryRecord` entries with status `APPROVED` or `PAID` are counted.
- Because `SalaryRecord.grossAmount` already embeds base salary, approved bonuses, and incentives, only the record gross amounts are queried to prevent double-counting.
- Selected records must have compensation period overlap (`periodStart <= endDate` and `periodEnd >= startDate`).

### 5. Purchase Treatment (Independent)
- In accordance with restaurant operational accounting, inventory purchases (`PurchaseOrder`) are tracked and reported **separately** from operating expenses and are not deducted from the Operating Result.
- Procurement is evaluated on an ordered vs. received basis.

### 6. Product Sales & Historical Pricing
- Product performance queries the `OrderItem` table directly.
- **Historical Accuracy**: Item revenue is calculated using `OrderItem.unitPrice` and `OrderItem.discountAmount` rather than current `MenuItem.price` to ensure price increases or menu revisions do not distort historical records.

---

## Role-Based Access Control (RBAC)

The module introduces 6 fine-grained permissions:

| Permission Code | Description | Role Assignments |
|-----------------|-------------|------------------|
| `report.sales.read` | View sales overview, daily sales, order-type and payment breakdowns | `OWNER`, `ADMIN`, `MANAGER` |
| `report.sales.export` | Download sales reports as CSV | `OWNER`, `ADMIN` |
| `report.finance.read` | View P&L statements, expense and salary cost breakdowns | `OWNER`, `ADMIN` |
| `report.finance.export` | Download financial and P&L reports as CSV | `OWNER`, `ADMIN` |
| `report.branch.read` | Compare multi-branch performance | `OWNER`, `ADMIN`, `MANAGER` |
| `report.product.read` | View menu item velocity and category revenue shares | `OWNER`, `ADMIN`, `MANAGER` |

### Multi-Branch Scoping:
- **`OWNER` & `ADMIN`**: Access cross-branch performance summaries, or filter dynamically by any branch.
- **`MANAGER` & `STAFF`**: Scoped strictly at the database query level (`WHERE branchId = ...`) to their assigned branch. Attempts to query unauthorized branches return a 403 Forbidden error.

---

## Pages & Routes

1. **Executive Dashboard (`/`)**:
   - Live operational command center for the current day.
   - Today's Net Sales, Completed Orders, Approved Expenses, and Operating Result.
   - Live alerts for Low Stock, Pending Expense Approvals, and Pending Salary Reviews.
   - Top 5 selling items today, order type split, payment settlement split, and branch overview.

2. **Sales & Revenue Overview (`/sales`)**:
   - 8 primary KPI cards.
   - **Daily Sales Ledger**: Tabular daily audit of gross sales, discounts, refunds, net sales, and AOV.
   - **Trends & Hourly**: Visual area chart of daily revenue and bar chart of hourly sales velocity.
   - **Order Types & Payments**: Donut charts showing Dine-In / Takeaway / Delivery distribution and settlement method totals.
   - **Branch Comparison**: Cross-branch revenue and margin comparisons for multi-unit owners.

3. **Product & Category Sales (`/sales/products`)**:
   - Menu item velocity table with search, sorting by sales/quantity/name, and category filtering.
   - Category revenue share donut chart and category ranking table.

4. **Profit & Loss Statement (`/reports/profit-loss`)**:
   - Hierarchical operational management statement (Revenue Collections − Operating Expenses − Payroll Costs = Operating Result).
   - Category-wise expense breakdown with share percentages.
   - Detailed audit of included salary records.
   - Separate inventory procurement tracking tab.

---

## Exporting & Performance

- **Streaming CSV Export**: Dedicated server actions generate RFC-4180 compliant CSV exports for sales summaries, item sales, branch comparisons, and P&L statements.
- **Database Index Optimization**: All queries run against indexed fields (`branchId`, `status`, `createdAt`, `expenseDate`, `processedAt`, `[periodStart, periodEnd]`) to ensure fast response times even across large historical volumes.
