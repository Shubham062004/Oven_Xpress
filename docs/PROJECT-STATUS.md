## Current Feature

Step 23 — Client UAT, Feedback & Final Bug-Fix Cycle

## Status

Completed

## Completed

- [x] Step 23 Client User Acceptance Testing (Client UAT) verification suite (`scripts/verify-client-uat.ts` with 20/20 passed scenarios)
- [x] Multi-role permission testing (Owner, Admin, Manager, Staff) validating operational and financial access boundaries
- [x] Realistic 10-stage Dine-In lifecycle, tableless Takeaway channel, and enforced customer Delivery channel
- [x] Multi-tender split payments (Cash + Card) and partial refund safeguards
- [x] Inventory ledger calculation verification ($100 + 50 - 30 - 5 = 115\text{ KG}$) and physical count reconciliation with variance tracking
- [x] Recipe Bill of Materials (BOM) stock consumption with double-click deduplication immunity
- [x] Purchase order receiving lifecycle bounds (`PARTIALLY_RECEIVED`, `RECEIVED`, over-receiving rejection)
- [x] Operational expense approval and rejection lifecycles
- [x] Single-day duplicate attendance punch rejection via database unique constraints
- [x] 3-tier settings engine override and reset fallback with append-only audit logging
- [x] Issue register (`docs/UAT-ISSUES.md`) classifying all findings by type, severity, and status (0 open P0/P1 bugs)
- [x] Client change requests catalog (`docs/CHANGE-REQUESTS.md`) capturing CR-01 (courier API), CR-02 (loyalty SMS), CR-03 (nightly PDF summary)
- [x] Practical operating manual and user guide (`docs/USER-GUIDE.md`) covering Owner, Manager, and Staff workflows
- [x] Formal UAT sign-off matrix (`docs/UAT-CHECKLIST.md`) and sign-off document (`docs/UAT-SIGNOFF.md`)
- [x] Step 22 Production Deployment, UAT & Production Launch (`docs/DEPLOYMENT.md`, `docs/PRODUCTION-CHECKLIST.md`, `.github/workflows/ci.yml`, `.env.example`, `scripts/verify-uat.ts`, `scripts/verify-production-hardening.ts`)
- [x] Settings & System Configuration database schema (`SystemSetting` and `UserPreference` models, `SettingScope` [GLOBAL, BRANCH], `SettingDataType` [STRING, NUMBER, BOOLEAN, JSON, TIME], and performance indexes)
- [x] Structured & typed configuration catalog with 42 settings across 8 operational categories (`BUSINESS`, `BRANCH`, `ORDERS`, `INVENTORY`, `NOTIFICATIONS`, `PAYMENTS`, `EXPENSES`, `ATTENDANCE`)
- [x] Hierarchical 3-tier resolution engine (`Branch Override -> Global Setting -> Application Default`) with seamless reset fallback
- [x] Server-side branch isolation & authorization (`settings.read`, `settings.update`), preventing branch managers from modifying unauthorized branches or global configurations
- [x] Step 19 Audit Logs integration (`SETTING_UPDATE`, `SETTING_RESET`, `USER_PREFERENCE_UPDATE` under entity types `SYSTEM_SETTING` and `USER_PREFERENCE`)
- [x] Zero infrastructure secrets in database settings (API keys, DB URLs, OAuth secrets remain safely in environment variables)
- [x] Consumer integrations across Orders (`ORDER_NUMBER_PREFIX`, `ORDER_ENABLE_*`), Payments (`PAYMENT_ALLOW_PARTIAL`, `PAYMENT_RECEIPT_REQUIRED`), and Alerts (`ALERT_*_ENABLED`, thresholds)
- [x] Responsive 2-column settings interface at `/settings` with category sidebar, branch selector, search filter, reset confirmation dialogs, and personal UI preferences
- [x] Automated test suite (`scripts/verify-settings.ts` with 26/26 passed tests) and comprehensive documentation (`docs/features/settings.md`)

- [x] Next.js project scaffolding
- [x] TypeScript configuration (strict mode)
- [x] Tailwind CSS v4 setup
- [x] shadcn/ui initialization (base-nova)
- [x] Design system tokens (light + dark)
- [x] Application shell (sidebar, header, responsive layout)
- [x] Component library (16 shadcn components)
- [x] Reusable state patterns (empty, loading, page header)
- [x] Demo page
- [x] Dark mode support
- [x] Database schema: User, Session, Role, Permission, RolePermission (PostgreSQL + Prisma)
- [x] Password hashing with bcryptjs (12 salt rounds)
- [x] Persistent HTTP-only secure cookie session engine
- [x] Centralized server-side authorization guards (`requireAuthentication`, `requireRole`, `requirePermission`)
- [x] Login page with validation, show/hide password, and loading states
- [x] 403 Access Denied page (`/unauthorized`)
- [x] Header integration: User name, role badge, avatar placeholder, and sign out
- [x] Sidebar permission-based navigation item filtering
- [x] Protected routes demonstrations: `/settings` (`settings.read`), `/users` (`users.read`)
- [x] Development database seed with 4 role test accounts (`owner`, `admin`, `manager`, `staff`) + inactive account
- [x] Docker compose for local PostgreSQL
- [x] Branch model (Prisma schema with BranchStatus enum, indexes on code/status/city)
- [x] Branch RBAC permissions (`branch.read`, `branch.create`, `branch.update`, `branch.deactivate`)
- [x] Branch validation schemas (Zod: createBranchSchema, updateBranchSchema)
- [x] Branch server actions (CRUD + status toggle with auth/permission/validation guards)
- [x] Branch list page (`/branches`) with search, filter, summary cards, responsive table
- [x] Branch detail page (`/branches/[id]`) with organized info sections
- [x] Branch create/edit dialog (reusable form, client + server validation)
- [x] Branch activate/deactivate dialog (confirmation with consequences)
- [x] Branch seed data (4 sample branches)
- [x] Branch management documentation (`docs/features/branch-management.md`)
- [x] Employee model (Prisma schema with EmploymentStatus & SalaryType enums, branch & user relations)
- [x] Employee RBAC permissions (`employee.read`, `employee.create`, `employee.update`, `employee.deactivate`)
- [x] Employee validation schemas (Zod: createEmployeeSchema, updateEmployeeSchema, employeeFilterSchema)
- [x] Employee server actions (getEmployees, getEmployeeById, getEmployeeStats, createEmployee, updateEmployee, toggleEmployeeStatus, account linking)
- [x] Employee list page (`/employees`) with search debouncing, branch/status/designation filters, summary cards, responsive table, and mobile cards
- [x] Employee detail page (`/employees/[id]`) with profile, employment, compensation, emergency contact, and user account linking cards
- [x] Employee create/edit dialog (unified modal, real-time code uppercase, account linker)
- [x] Employee activate/deactivate confirmation dialog
- [x] Employee seed data (6 sample employees across branches, linked/unlinked accounts)
- [x] Employee feature documentation (`docs/features/employee-management.md`)
- [x] Shift & Attendance models (Prisma schema: ShiftStatus, AttendanceStatus, composite indexes, `@@unique([employeeId, date])`)
- [x] Shift & Attendance RBAC permissions (7 permissions: `attendance.read`, `attendance.create`, `attendance.update`, `shift.read`, `shift.create`, `shift.update`, `shift.deactivate`)
- [x] Shift & Attendance validation schemas (Zod: shiftSchema, updateShiftSchema, attendanceRecordSchema, attendanceUpdateSchema, attendanceFilterSchema)
- [x] Attendance & Shift server actions (`getShifts`, `createShift`, `updateShift`, `toggleShiftStatus`, `getAttendanceRecords`, `getAttendanceById`, `getAttendanceSummary`, `markAttendance`, `updateAttendance`, `quickCheckIn`, `quickCheckOut`, `getAuthorizedBranches`, `getAuthorizedEmployees`)
- [x] Server-side branch scoping authorization & cross-entity branch verification
- [x] Late arrival & early departure calculations (with overnight schedule support)
- [x] Attendance dashboard (`/attendance`) with Daily Attendance & Shift Schedules tabs, date navigator, multi-filters, summary KPI cards, desktop table, and mobile cards
- [x] Attendance record details page (`/attendance/[id]`) with employee card, schedule vs actual timing, audit trail, and correction dialog
- [x] Manual attendance marking and correction dialog with real-time lateness preview
- [x] Centralized Reports Hub at `/reports` with factual categorization and permission-filtered report catalog
- [x] 14 dedicated operational and financial reports (`sales`, `orders`, `products`, `branches`, `payments`, `expenses`, `inventory`, `purchases`, `wastage`, `attendance`, `compensation`, `customers`, `reviews`, `profit-loss`)
- [x] RFC-4180 compliant CSV export engine across all reports respecting user branch scope and filters
- [x] Native print-friendly view styling (`@media print`)
- [x] Step 18 Feature Documentation (`docs/features/reports.md`)
- [x] Append-only, tamper-resistant `AuditLog` database model with relations to User and Branch, `Json?` columns, and 8 composite and single-field performance indexes
- [x] Granular RBAC permissions: `audit.read` and `audit.export` granted strictly to Owner and Admin roles
- [x] Deep recursive sensitive-data sanitizer (`sanitizeAuditData`) with zero password, hash, token, API key, CVV, or connection string exposure
- [x] Scalar and enum field diff calculator (`calculateFieldDiff`) comparing before and after mutation states
- [x] Transactional consistency: atomic audit logging inside `prisma.$transaction` for orders, inventory adjustments/transfers, payments, expenses, purchases, and bonuses
- [x] Integrated server-side audit generation across Auth, Branches, Employees, Orders, Payments, Inventory, Expenses, Purchases, Attendance, and Salary
- [x] Strict server-side branch isolation: Branch Managers cannot view, query, or inspect other branches' audit records; unauthorized cross-branch requests rejected
- [x] Dedicated UI at `/audit-logs`: executive KPI summary cards, multi-dimensional search & filter toolbar (date presets, branch, action, entity), responsive data table, server-side pagination, and CSV export
- [x] Audit record detail inspector at `/audit-logs/[id]`: event header, actor & network context, structured before/after change diff, formatted JSON payload tabs, and re-authorized entity deep links
- [x] Step 19 Feature Documentation (`docs/features/audit-logs.md`)
- [x] Automated test suite (`scripts/verify-audit-logs.ts`) passing all 8 validation suites

## Current Task

Step 19: Audit Logs & System Activity Tracking fully implemented, verified (8/8 automated verification assertions passed), and documented.

## Next

Awaiting user directive for the next operational milestone.

## Known Issues

None

- [x] Shift creation and editing dialog with live duration calculation
- [x] Shift activation/deactivation confirmation dialog
- [x] Seed data with 5 shifts and sample attendance records
- [x] Feature documentation (`docs/features/attendance-management.md`)
- [x] Menu Category, Ingredient, MenuItem, BranchMenuItem, and RecipeIngredient models (Prisma schema: MenuStatus, IngredientUnit enums, unique indexes)
- [x] Menu RBAC permissions (17 permissions covering `menu.category.*`, `menu.ingredient.*`, `menu.item.*`, `menu.branch.*`, `menu.recipe.*`)
- [x] Menu validation schemas with unit compatibility checks (`src/lib/validations/menu.ts`)
- [x] Menu server actions (`category-actions.ts`, `ingredient-actions.ts`, `item-actions.ts`, `recipe-actions.ts` with atomic `$transaction` recipe saves)
- [x] Menu management dashboard (`/menu`) with Overview, Dishes & Items, Categories, Ingredients, and Recipe BOM tabs
- [x] Menu item detail page (`/menu/items/[id]`) with specs, branch availability matrix, and recipe BOM explorer
- [x] Modals for category CRUD, ingredient CRUD, menu item CRUD, branch availability override, and dynamic recipe BOM builder
- [x] Database seed for 4 categories, 16 ingredients, 7 menu items, branch overrides, and complete recipe BOMs
- [x] Menu & Recipe documentation (`docs/features/menu-recipe-management.md`)
- [x] InventoryItem & StockTransaction models (Prisma schema: InventoryStatus, StockTransactionType, WastageReason enums, composite unique constraints & indexes)
- [x] Inventory RBAC permissions (8 permissions: `inventory.read`, `inventory.create`, `inventory.update`, `inventory.adjust`, `inventory.transfer`, `inventory.wastage`, `inventory.reconcile`, `inventory.deactivate`)
- [x] Branch-specific inventory architecture (`Branch → InventoryItem → Ingredient`) with canonical units from `Ingredient`
- [x] Dynamic current stock calculation from immutable ledger: Inflows - Outflows
- [x] High-performance batch stock calculation using Prisma `groupBy` aggregates (single DB query)
- [x] Non-negative stock protection on all debit transactions
- [x] Opening stock workflow with duplicate opening protection
- [x] Manual stock receiving workflow with reference ID traceability
- [x] Damage & Wastage workflow with 10 structured `WastageReason` enum reasons and audit notes
- [x] Manual stock adjustment workflow (`ADJUSTMENT_IN` / `ADJUSTMENT_OUT`) with mandatory audit reasons
- [x] Atomic inter-branch stock transfers (`TRANSFER_OUT` + `TRANSFER_IN` with shared reference ID in a single `$transaction`)
- [x] Physical stock reconciliation workflow with automatic variance calculation and adjustment generation
- [x] Inventory dashboard (`/inventory`) with 6 KPI cards, Stock Levels tab, Stock Ledger tab, search, branch filter, stock health filter
- [x] Inventory item detail page (`/inventory/[id]`) with metrics, threshold configuration, and chronological ledger timeline
- [x] Responsive dialogs for opening stock, receipt, wastage, adjustment, transfer, reconciliation, and threshold configuration
- [x] Full database seed across 3 branches with 17 ingredients and initial stock ledger transactions
- [x] Inventory feature documentation (`docs/features/inventory-management.md`)
- [x] Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseReceiving, and PurchaseReceivingItem models (Prisma schema with SupplierStatus, PurchaseOrderStatus enums, composite unique constraints, cascade deletion rules on items, and indexes)
- [x] Supplier and Purchase RBAC permissions (9 permissions: `supplier.read`, `supplier.create`, `supplier.update`, `supplier.deactivate`, `purchase.read`, `purchase.create`, `purchase.update`, `purchase.receive`, `purchase.cancel`)
- [x] Independent master vendor architecture: Suppliers are not tied to any branch, permitting single vendor deliveries to multiple locations
- [x] Strict server-side branch authorization for purchase orders (Managers restricted to `employee.branchId`, Owners and Admins operate across all branches)
- [x] Server-side sequential purchase order number generation (`PO-YYYY-000001`)
- [x] Server-side financial calculations: `Line Total = orderedQuantity × unitPrice` and `Subtotal = sum(Line Totals)` recalculated server-side
- [x] Purchase order lifecycle state machine (`DRAFT` → `ORDERED` → `PARTIALLY_RECEIVED` → `RECEIVED` | `CANCELLED`)
- [x] Cancellation integrity: Blocks cancellation if stock has already been received into inventory
- [x] Partial delivery support with strict rejection of over-receiving (`receivedQuantity + receivedNow <= orderedQuantity`)
- [x] Double-entry stock ledger integration: Receiving creates immutable `StockTransaction` of type `RECEIPT` with branch and purchase reference inside an atomic database transaction
- [x] Supplier directory dashboard (`/suppliers`) with KPI cards, search, status filter, and responsive table
- [x] Supplier detail page (`/suppliers/[id]`) with contact info, lifetime spend, order count, and recent purchases table
- [x] Purchase order list page (`/purchases`) with KPI cards, branch/supplier/status filters, search, and responsive cards
- [x] Purchase order creation page (`/purchases/new`) with searchable selectors, dynamic ingredient line items, and live subtotal calculation
- [x] Purchase order detail page (`/purchases/[id]`) with ordered/received/remaining breakdown, fulfillment %, delivery schedule, and receiving history log
- [x] Responsive receiving dialog with ingredient breakdown, autofill remaining, and confirmation alert before updating stock ledger
- [x] Supplier creation, edit, and status toggle dialogs with Zod validation
- [x] Database seed with 5 suppliers and 4 purchase orders across multiple lifecycle states and receiving logs
- [x] Supplier & Purchase Management feature documentation (`docs/features/supplier-purchase-management.md`)
- [x] Order Management models (Order, OrderItem, RestaurantTable with OrderType, OrderStatus, PaymentStatus, TableStatus enums, composite indexes, and sequential order numbering `ORD-YYYY-000001`)
- [x] Order RBAC permissions (`order.read`, `order.create`, `order.update`, `order.status`, `order.cancel`, `table.read`, `table.manage`)
- [x] Order management dashboard (`/orders`) with KPI summary, order types, status workflow, search, and date filters
- [x] Interactive POS order creation form (`/orders/new`) with visual menu selector, category tabs, cart, dine-in table picker, and live tax/discount calculations
- [x] Order details page (`/orders/[id]`) with live status timeline, customer details, table status, and receipt printing
- [x] Dedicated Kitchen Display System (`/kitchen`) with 3-column kanban board (New Orders, Preparing, Ready)
- [x] Operational kitchen lifecycle: `CONFIRMED` → `PREPARING` → `READY` → `COMPLETED`
- [x] Kitchen RBAC permissions (`kitchen.read`, `kitchen.start`, `kitchen.ready`, `kitchen.complete`)
- [x] Operational timestamps: `confirmedAt`, `preparingAt`, `readyAt`, `completedAt`, and operator user attribution
- [x] Append-only `OrderAuditLog` capturing status changes, users, timestamps, and notes
- [x] Automatic atomic inventory consumption triggered upon "Start Preparing" (`OrderItem.quantity × RecipeIngredient.quantity`)
- [x] Recipe unit converter (`KG` ↔ `GRAM`, `LITRE` ↔ `ML`, `DOZEN` ↔ `PIECE`) with ledger posting to base units
- [x] Strict insufficient-stock pre-check with atomic abort and shortage detail modal (`Required vs Available`)
- [x] Missing recipe detection ("No BOM") without guessing or phantom inventory deductions
- [x] Idempotency & double-consumption prevention (`order.inventoryConsumed` and reference ID check)
- [x] Auto-refresh countdown loop (15s), manual sync, fullscreen toggle, branch filter, and order type filter
- [x] KDS feature documentation (`docs/features/kitchen-management.md`)

- [x] Payment, PaymentRefund, PaymentReconciliation, and PaymentAuditLog models (Prisma schema: PaymentMethod, PaymentStatus, RefundStatus, ReconciliationStatus enums, composite unique constraints, indexes)
- [x] Payment RBAC permissions (6 permissions: `payment.read`, `payment.create`, `payment.update`, `payment.refund`, `payment.reconcile`, `payment.cancel`) with strict Owner & Admin refund restrictions
- [x] Centralized payment methods: CASH, UPI, CARD, ONLINE, OTHER with tender-specific reference metadata
- [x] Concurrency-safe sequential payment numbering (`PAY-YYYY-000001`) and refund numbering (`REF-YYYY-000001`) using PostgreSQL advisory transactions locks (`pg_advisory_xact_lock`)
- [x] Derived order payment summary logic (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`) supporting split tender and preserving kitchen/delivery order status
- [x] Strict overpayment rejection: Validates `totalPaid + newAmount <= orderTotal` inside atomic `$transaction`
- [x] Non-destructive failed payment handling: Preserved with status `FAILED`, 0 contribution to paid balance, full audit trail
- [x] Full and partial refund management: Caps refunds to remaining paid balance with mandatory operational reason capture
- [x] Payments management dashboard (`/payments`) with 7 KPI summary cards, branch/method/status/date filters, real-time search, responsive desktop table, and mobile cards
- [x] Order payment ledger integration (`/orders/[id]`): Live payment summary card, record payment dialog, refund dialog, and nested payment/refund ledger
- [x] Daily tender & cash drawer reconciliation (`/payments/reconciliation`): Aggregates system cash and multi-tender totals, captures physical drawer count, and computes objective variance (`Actual - System Cash`) with neutral status indicators
- [x] Database seed with multi-method payments, partial splits, failed attempts, refund records, and historical reconciliations
- [x] Payment management documentation (`docs/features/payment-management.md`)
- [x] Expenses Management: ExpenseCategory, Expense, ExpenseAuditLog, and ExpenseTemplate models with Prisma enums and relations
- [x] Expense RBAC permissions (`expense.read`, `expense.create`, `expense.update`, `expense.approve`, `expense.reject`, `expense.cancel`, `expense.category.manage`, `expense.template.manage`)
- [x] Sequential expense number generation (`EXP-YYYY-000001`) with PostgreSQL advisory locks
- [x] Expense approval lifecycle (`DRAFT` → `PENDING_APPROVAL` → `APPROVED` / `REJECTED` | `CANCELLED`)
- [x] Recurring expense templates with auto-fill and manual/automated run support
- [x] Expenses dashboard (`/expenses`), Category Manager (`/expenses/categories`), Recurring Templates (`/expenses/templates`), and Detail View (`/expenses/[id]`)
- [x] Salary, Bonus & Increment Management: SalaryStructure, SalaryIncrement, Bonus, Incentive, SalaryRecord, and SalaryAuditLog models
- [x] Compensation RBAC permissions (13 permissions: `salary.read`, `salary.create`, `salary.update`, `salary.approve`, `salary.cancel`, `bonus.read`, `bonus.create`, `bonus.update`, `bonus.approve`, `bonus.cancel`, `increment.read`, `increment.create`, `increment.update`)
- [x] Decoupled compensation history: Active & superseded `SalaryStructure` spans preserving employee pay history
- [x] Sequential salary record numbering (`SAL-YYYY-000001`) with transaction advisory locks
- [x] Salary period live calculation preview with base salary lookup, approved bonus aggregation, and informational attendance summaries
- [x] Salary revision & increment tracking with real-time percentage and delta analytics
- [x] Maker-checker bonus approval workflow with mandatory rejection reason capture
- [x] Compensation dashboard (`/salary`), increments ledger (`/salary/increments`), bonus queue (`/salary/bonuses`), period detail (`/salary/[id]`), and employee compensation ledger (`/employees/[id]`)
- [x] Salary & Bonus management documentation (`docs/features/salary-bonus-management.md`)
- [x] Sales & Financial Reporting RBAC permissions (6 permissions: `report.sales.read`, `report.sales.export`, `report.finance.read`, `report.finance.export`, `report.branch.read`, `report.product.read`)
- [x] Primary source-of-truth reporting engine: Aggregates directly from Orders, Payments, Refunds, Expenses, and SalaryRecords without duplicate sales tables
- [x] Operational revenue & sales metrics with safe division (AOV, gross sales, promotional discounts, customer refunds, net revenue)
- [x] Multi-branch database-level scoping: Cross-branch access for OWNER/ADMIN and strict single-branch scoping for MANAGER/STAFF
- [x] Sales Overview dashboard (`/sales`): 8 KPI cards, tabular daily sales ledger, revenue area chart, hourly velocity bar chart, order channels and payment methods donut charts, and multi-branch comparison
- [x] Product Sales reporting (`/sales/products`): Historical pricing via `OrderItem.unitPrice`, search, sorting, category filtering, and category revenue share distribution
- [x] Operational Profit & Loss statement (`/reports/profit-loss`): Clear operational management report (`Net Revenue − Approved Operating Expenses − Approved Salary = Operating Result`), category expense shares, salary record audit, and separate inventory procurement ledger
- [x] Executive Owner Dashboard (`/` route): Operational command center for today's sales, orders, expenses, result, top sellers, low stock alerts, and pending approval counters
- [x] Recharts visual component library integration with CSS variable theming and SSR hydration safety (`useSyncExternalStore`)
- [x] Streaming RFC-4180 CSV report exports for daily sales, product velocity, branch comparisons, and P&L statements
- [x] Sales, Revenue & Financial Reporting documentation (`docs/features/sales-financial-reporting.md`)
- [x] Customer Management, Reviews & Feedback: Customer, Review, CustomerIssue, and CustomerIssueAuditLog Prisma models with enums and branch relations
- [x] Customer & Feedback RBAC permissions (11 permissions: `customer.read`, `customer.create`, `customer.update`, `customer.deactivate`, `review.read`, `review.moderate`, `issue.read`, `issue.create`, `issue.update`, `issue.assign`, `issue.resolve`)
- [x] Persistent customer identity supporting both registered and guest patrons without mandatory accounts
- [x] Non-destructive customer deactivation: Toggling `ACTIVE` / `INACTIVE` preserves all past orders, payments, reviews, and issues
- [x] Customer Directory (`/customers`): Lifetime spend, order count, last order date, branch & status filtering, search by name/phone/email, and server-side pagination
- [x] Customer Detail & History (`/customers/[id]`): Profile information, order summary KPIs, historical orders from primary orders, reviews tab, and complaints tab
- [x] Review Moderation (`/reviews`): 1–5 star rating validation, customer & order association, moderation status transitions (`PENDING`, `PUBLISHED`, `HIDDEN`, `RESOLVED`), and prevention of staff rewriting customer words
- [x] Customer Operational Issues (`CustomerIssue`): Sequential numbering (`ISS-YYYY-000001`) with transaction advisory locks, categorization across 9 operational areas, and priority levels
- [x] Audited Issue Lifecycle: `OPEN` → `IN_PROGRESS` → `RESOLVED` → `CLOSED` | `CANCELLED`, strict branch match on employee assignment (`assignedStaff.branchId === issue.branchId`), and mandatory audited resolution note upon resolution
- [x] Feedback & Quality Dashboard (`/feedback`): Overall review volume, 5.00-point average rating, 1★–5★ visual distribution bars, live reviews stream, active issues queue, and cross-branch quality comparison table
- [x] Customer privacy protection: Server-side masking of phone numbers, email addresses, and street delivery addresses for least-privilege access
- [x] Feature documentation (`docs/features/customer-feedback.md`)
- [x] In-App Notifications & Alerts: Prisma Notification model with NotificationType & NotificationSeverity enums, branch & user relations, and compound index deduplication
- [x] Notification RBAC permissions (`notification.read`, `notification.dismiss`) assigned across all system roles
- [x] Deterministic Deduplication Engine: Compound dedupeKey (`${recipientUserId}:${type}:${branchId}:${entityType}:${entityId}`) prevents spam on repeat dashboard visits and page reloads
- [x] Server-Side Recipient Resolution: Permission-aware and branch-scoped targeting (Owners/Admins receive global alerts; Managers/Staff receive alerts strictly for assigned active branch)
- [x] Automatic Entity State Clearing: When underlying operational records resolve (expense approved/rejected, order paid, or stock replenished), pending notifications are automatically cleared/dismissed
- [x] Centralized Operational Alert Evaluator (`evaluateAlerts`): Detects low-stock and out-of-stock items via batch calculations, pending expense approvals, pending salary reviews, pending bonus reviews, failed payments, unpaid completed orders, and stock reconciliation variances
- [x] Header Notification Bell (`NotificationBell`): Live unread counter badge, dropdown popover with recent 5 notifications, relative timestamps, severity badges, and quick mark-read controls
- [x] Dashboard Alert Widget (`DashboardAlertWidget`): Embedded on primary dashboard (`/`) displaying Critical, Warning, and Unread counts, actionable operational bottlenecks, and quick deep links
- [x] Notification Center (`/notifications`): Full-featured management hub with tabs (All, Unread, Read, Dismissed), severity filters, category filters, branch filtering, search, pagination, and manual alert scanner
- [x] Feature documentation (`docs/features/notifications-alerts.md`)
- [x] Executive Owner Dashboard & Business Overview (`/` and `/dashboard` parity): Centralized command center aggregating live metrics across sales, volume, branch performance, tenders, expenses, inventory, attendance, and approvals
- [x] Zero duplicate tables: Calculations derived strictly from primary source-of-truth models (`Order`, `OrderItem`, `Payment`, `PaymentRefund`, `Expense`, `SalaryRecord`, `InventoryItem`, `StockTransaction`, `Attendance`, `Customer`, `Review`, `CustomerIssue`)
- [x] Step 14 Operational Revenue & Financial Formulas: Derived Net Sales, Discounts, Refunds, AOV, Approved Expenses, and Operational Result (`Net Sales − Approved Expenses − Approved Salary`)
- [x] Server-side branch isolation & anti-tampering: Automatic scope resolution via `getAuthorizedBranchScope()`; cross-branch rollups for Owner/Admin; tamper-resistant branch lock for Manager and Staff
- [x] Role-based financial data masking: Operational KPIs rendered for Staff while financial metrics (sales, expenses, operating result) are concealed server-side
- [x] Global Filter Engine: Presets (`today`, `yesterday`, `7d`, `30d`, `month`, `custom` bounded to $\le 366$ days) with two-way URL query parameter synchronization
- [x] Trend Comparisons & Safe Division: Delta percentages compared to previous equivalent periods with zero-division protection (`null` delta on zero baseline)
- [x] Database-side high performance aggregations: Single `Promise.all` roundtrip, grouped queries (`groupBy`), dynamic hourly (8 AM - 11 PM) and daily grouping; zero N+1 queries
- [x] Operations & Health Summary Grid: Orders pipeline & channel split, payment method breakdown, top selling products ranking, inventory health (low/out of stock, wastage), attendance facts, pending approvals queue, customer ratings & issues
- [x] Live Operational Activity Stream: Real-time feed of recent orders, payments, purchases, wastage logs, and reviews with store tags and timestamps
- [x] Step 16 Operational Alert Integration: Embedded `DashboardAlertWidget` displaying critical and warning operational notifications
- [x] Streaming RFC-4180 CSV Export: On-demand export of executive KPIs, branch performance benchmarks, and top dishes
- [x] Step 17 Feature Documentation (`docs/features/dashboard.md`)
- [x] Centralized Reports Hub at `/reports` with factual categorization and permission-filtered report catalog
- [x] 14 dedicated operational and financial reports (`sales`, `orders`, `products`, `branches`, `payments`, `expenses`, `inventory`, `purchases`, `wastage`, `attendance`, `compensation`, `customers`, `reviews`, `profit-loss`)
- [x] Zero duplicate tables: Dynamic aggregations derived directly from primary source-of-truth Prisma models (`Order`, `OrderItem`, `Payment`, `PaymentRefund`, `Expense`, `InventoryItem`, `StockTransaction`, `PurchaseOrder`, `Attendance`, `SalaryRecord`, `Customer`, `Review`)
- [x] Strict server-side branch scoping & anti-tampering guards via `getAuthorizedBranchScope()`; branch tampering attempts blocked server-side
- [x] Confidential financial and payroll data protected with granular permissions (`report.*.read` / `report.*.export`)
- [x] Unified `ReportViewContainer` UX with date presets (`today`, `yesterday`, `week`, `month`, bounded `custom` $\le 366$ days), module-specific filters, and summary KPI cards
- [x] High-performance database aggregation using parallel queries (`Promise.all`), indexing, and server-side pagination
- [x] RFC-4180 compliant CSV export engine across all 14 reports respecting user branch scope and filters
- [x] Native print-friendly view styling (`@media print`) concealing interactive navigation and formatting print/PDF layouts
- [x] Step 18 Feature Documentation (`docs/features/reports.md`)
- [x] Append-only, tamper-resistant `AuditLog` database model with relations to User and Branch, `Json?` columns, and 8 composite and single-field performance indexes
- [x] Granular RBAC permissions: `audit.read` and `audit.export` granted strictly to Owner and Admin roles
- [x] Deep recursive sensitive-data sanitizer (`sanitizeAuditData`) with zero password, hash, token, API key, CVV, or connection string exposure
- [x] Scalar and enum field diff calculator (`calculateFieldDiff`) comparing before and after mutation states
- [x] Transactional consistency: atomic audit logging inside `prisma.$transaction` for orders, inventory adjustments/transfers, payments, expenses, purchases, and bonuses
- [x] Integrated server-side audit generation across Auth, Branches, Employees, Orders, Payments, Inventory, Expenses, Purchases, Attendance, and Salary
- [x] Strict server-side branch isolation: Branch Managers cannot view, query, or inspect other branches' audit records; unauthorized cross-branch requests rejected
- [x] Dedicated UI at `/audit-logs`: executive KPI summary cards, multi-dimensional search & filter toolbar (date presets, branch, action, entity), responsive data table, server-side pagination, and CSV export
- [x] Audit record detail inspector at `/audit-logs/[id]`: event header, actor & network context, structured before/after change diff, formatted JSON payload tabs, and re-authorized entity deep links
- [x] Step 19 Feature Documentation (`docs/features/audit-logs.md`)
- [x] Automated test suite (`scripts/verify-audit-logs.ts`) passing all 8 validation suites
- [x] System Configuration & Settings Engine (`SystemSetting` Prisma model, two-tier resolution with global fallback and branch overrides)
- [x] Settings validation schema registry with type checking (BOOLEAN, NUMBER, STRING, JSON) and bounds enforcement
- [x] Centralized Settings UI (`/settings`) with category navigation (General, Operations, Alerts, Taxation, System) and branch override controls
- [x] Settings RBAC (`settings.read`, `settings.update`, `settings.reset`) and automated audit logging on all setting modifications
- [x] Settings verification test suite (`scripts/verify-settings.ts`) passing 26/26 test cases
- [x] Production Hardening & Final System Verification (Step 21): Full 27-module security, isolation, and integrity audit
- [x] Concurrency and double-submit defense in purchase receiving, payment refunds, and inventory consumption
- [x] Production database index optimizations on `Order`, `Payment`, `StockTransaction`, `AuditLog`, and `Notification`
- [x] Complete ESLint 9 / React 19 rules-of-hooks remediation across all dialog components (0 errors, 0 warnings)
- [x] Complete TypeScript type check pass (0 errors)
- [x] 23-check production hardening verification suite (`scripts/verify-production-hardening.ts`) passing 100%
- [x] 29-stage end-to-end business scenario suite (`scripts/verify-e2e-scenario.ts`) passing 100%
- [x] Full test suite regression across all modules (Audit Logs, Reports, Dashboard, Notifications, Settings, E2E) passing 100%
- [x] Successful Next.js 16 production build across all 52 routes in 848ms
- [x] Production Readiness Guide (`docs/PRODUCTION-READINESS.md`) and Security Architecture (`docs/SECURITY.md`)
- [x] Step 22: Deployment, UAT & Production Launch completed
- [x] Sanitized environment configuration template (`.env.example`) with zero hardcoded credentials
- [x] GitHub Actions automated Continuous Integration pipeline (`.github/workflows/ci.yml`)
- [x] Verified PostgreSQL schema migration safety via `npx prisma validate`
- [x] 18-scenario real-world User Acceptance Testing suite (`scripts/verify-uat.ts`) passing 100% (18/18)
- [x] Production Deployment Guide (`docs/DEPLOYMENT.md`), UAT Sign-Off Checklist (`docs/UAT-CHECKLIST.md`), and Launch Checklist (`docs/PRODUCTION-CHECKLIST.md`)

## Current Task

Step 22: Deployment, UAT & Production Launch fully completed, verified, tested, and documented.

## System Status

PRODUCTION LAUNCH COMPLETE & FULLY OPERATIONAL. All 22 steps across the Oven Xpress platform are delivered, hardened, tested, and verified.

## Known Issues

None (Zero P0, P1, P2, or P3 issues remaining).

