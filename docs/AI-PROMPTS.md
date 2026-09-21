# AI Prompt Library

Reusable prompt templates for development tasks. Copy and adapt as needed.

---

## Categories

1. Project setup
2. Feature implementation
3. CRUD implementation
4. API implementation
5. Database changes
6. UI implementation
7. Bug fixing
8. Refactoring
9. Code review
10. Security review
11. Performance optimization
12. Manual testing
13. Regression testing
14. Documentation

---

## Templates

### Feature Implementation

```
# Feature: [Name]

## Context
- Module: [module name]
- Related files: [list key files]
- Dependencies: [list any dependencies]

## Requirements
- [Requirement 1]
- [Requirement 2]

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Constraints
- Follow existing design system tokens
- Use Server Components where possible
- Use shadcn/ui components
- Follow TypeScript strict mode
- Add proper accessible labels
- Handle loading, empty, and error states
```

### Bug Fixing

```
# Bug: [Title]

## Observed Behavior
[What happens]

## Expected Behavior
[What should happen]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]

## Environment
- Browser: [browser]
- Viewport: [size]
- Theme: [light/dark]

## Investigation Notes
- [Any findings]

## Constraints
- Do not introduce new dependencies
- Preserve existing tests
- Fix root cause, not symptoms
```

### Code Review

```
# Code Review: [PR/Change Title]

## Review Checklist
- [ ] TypeScript strict compliance (no `any`)
- [ ] Components use design tokens, not hardcoded values
- [ ] Semantic HTML and accessible labels
- [ ] Responsive at 390px, 768px, 1024px, 1440px
- [ ] Loading, empty, error states handled
- [ ] Server Components used where possible
- [ ] No unnecessary client-side state
- [ ] No inline styles
- [ ] Consistent naming conventions
- [ ] No duplicate UI logic
- [ ] Both themes render correctly
- [ ] No console errors or warnings
```

### Manual Testing

```
# Manual Test: [Feature/Page]

## Test Environment
- Browser: [browser]
- Viewport sizes: 390px, 768px, 1024px, 1440px

## Test Cases

### Functional
- [ ] [Core action works]
- [ ] [Edge case handled]

### Visual
- [ ] Light theme renders correctly
- [ ] Dark theme renders correctly
- [ ] No horizontal overflow at any breakpoint
- [ ] Spacing and alignment consistent

### Accessibility
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Screen reader labels present
- [ ] Contrast ratios sufficient

### States
- [ ] Loading state shows skeletons
- [ ] Empty state shows message and action
- [ ] Error state shows clear message

## Results
- Pass: [count]
- Fail: [count]
- Notes: [any observations]
```

### Authentication & Authorization (RBAC)

```
# Task: Enforce Authorization for [Module/Route/Action]

## Context
- Module: [e.g., Inventory / Branch Management]
- Target Route / Action: [e.g., /branches, createBranchAction]
- Required Permission(s): [e.g., branches.read, branches.create]
- Permitted Roles: [e.g., OWNER, ADMIN]

## Requirements
- Enforce server guard: `requirePermission('[permission.code]')` at Server Component / Server Action boundary
- Do NOT rely solely on client-side or UI navigation hiding
- Update navigation config with `requiredPermission`
- If unauthorized, redirect to `/unauthorized` (403) or return `{ success: false, error: 'Forbidden' }`
- Validate and sanitize input with Zod
- Ensure session validity and user.isActive status

## Verification
- Test access as permitted role -> succeeds
- Test direct access as unpermitted role -> rejected by server (403)
- Test unauthenticated access -> redirected to login
- Test UI visibility -> navigation item hidden for unpermitted role
```

### CRUD Feature Implementation

```
# CRUD Feature: [Entity Name] Management

## Context
- Entity: [Entity name] (e.g., Branch, Employee, MenuItem)
- Dependencies: [Entities this depends on, e.g., Branch → none, Employee → Branch]
- Module permission prefix: [e.g., branch, employee]

## Database Model (Prisma)
- Model name: [Entity]
- Key fields: [list fields with types]
- Unique constraints: [e.g., code @unique]
- Indexes: [justified by expected queries]
- Status enum if applicable: [e.g., ACTIVE/INACTIVE]
- Soft deletion: [yes/no, explain rationale]

## Permissions (extend existing RBAC)
- [entity].read — View list and details
- [entity].create — Create new records
- [entity].update — Edit existing records
- [entity].deactivate — Toggle status (if applicable)
- Assign to roles: OWNER (all), ADMIN (read/create/update), MANAGER (read), STAFF (read)
- Add to seed.ts, definitions.ts, navigation.ts

## Validation (Zod schemas in src/lib/validations/[entity].ts)
- createSchema — all fields with validation rules
- updateSchema — same but omit immutable fields
- Share between client and server

## Server Actions (src/lib/[entity]/actions.ts)
Pattern: Auth → Permission → Validation → DB → Response
- getAll(params?) — list with search/filter, requires [entity].read
- getById(id) — single record, requires [entity].read
- create(data) — create, requires [entity].create
- update(id, data) — update, requires [entity].update
- toggleStatus(id) — activate/deactivate, requires [entity].deactivate
- getStats() — aggregate counts, requires [entity].read
All actions return ActionResult<T>. Re-throw Next.js redirect errors.

## Pages
- /[entities] — Server Component, requirePermission guard, SSR data fetch
- /[entities]/[id] — Server Component, detail page with generateMetadata

## Components (src/components/[entities]/)
- [Entity]ListClient — search, filter, table, summary cards, action menus
- [Entity]FormDialog — reusable create/edit dialog with client+server validation
- [Entity]StatusDialog — confirmation dialog for activate/deactivate
- [Entity]DetailClient — organized detail view with info sections

## States
- Loading: TableSkeleton, CardSkeleton
- Empty: EmptyState with CTA
- Error: Toast + inline messages
- Pending: Button loading state, prevent double submit

## Verification
- pnpm lint && pnpm build
- Manual CRUD testing
- Authorization testing per role
- Responsive testing at 390px, 768px, 1024px, 1440px
```

### Employee / Staff Management Pattern

```
# Module: Employee Management

## Distinction: Employee vs. User
- User = system login account (email, password, sessions, RBAC role)
- Employee = physical restaurant staff (kitchen, service, delivery, management)
- Optional 1:1 link via nullable userId (explicit linking only, never automatic)
- Never store authentication credentials inside Employee

## Data Model (PostgreSQL + Prisma)
- Employee: id, employeeCode (unique, immutable), firstName, lastName, phone, email?, dateOfBirth?, joiningDate, designation, branchId, employmentStatus (ACTIVE/INACTIVE), salary, salaryType (MONTHLY/DAILY/HOURLY), address?, emergencyContactName?, emergencyContactPhone?, userId?
- Foreign Keys: Branch (1:N, onDelete: Restrict), User (1:1 optional, onDelete: SetNull)
- Controlled soft-delete: never hard-delete staff records; preserve historical records

## RBAC & Security
- Permissions: employee.read, employee.create, employee.update, employee.deactivate
- Server Actions enforce requirePermission + Branch scoping
- Never trust client-side branchId or hidden fields
```

### Attendance & Shift Management Pattern

```
# Module: Attendance & Shift Management

## Entity Architecture
- Employee → Branch → Shift → Attendance
- Shift: id, name, branchId, startTime (HH:mm), endTime (HH:mm), status (ACTIVE/INACTIVE)
- Attendance: id, employeeId, branchId, shiftId?, date (@db.Date), status (PRESENT/ABSENT/HALF_DAY/LEAVE), checkIn?, checkOut?, lateMinutes, earlyDepartureMinutes, note?, markedBy
- Historical Preservation: Attendance retains snapshot shiftId; changing employee currentShiftId never mutates past logs
- Database Uniqueness: @@unique([employeeId, date]) prevents duplicate records per employee per day

## Calculations & Facts
- Late minutes: checkIn > shiftStart ? (checkIn - shiftStart) : 0
- Early departure: checkOut < shiftEnd ? (shiftEnd - checkOut) : 0
- Overnight shifts: if endTime < startTime, shiftEnd = shiftEnd + 24 hours
- Lateness & departures are recorded as facts, not automatic financial deductions

## RBAC & Security
- Permissions: attendance.read, attendance.create, attendance.update, shift.read, shift.create, shift.update, shift.deactivate
- Strict exclusion: NO attendance.delete (attendance is historical business data)
- Server-side branch scoping: OWNER/ADMIN have global access; MANAGER is strictly scoped to assigned branch
- Cross-entity validation: employee.branchId === branchId && shift.branchId === branchId
- STAFF cannot view or modify other staff attendance
```
### Inventory & Stock Management Pattern

```
# Module: Inventory & Stock Management

## Entity Architecture
- Branch → InventoryItem → Ingredient
- StockTransaction (Immutable Ledger)
- InventoryItem: id, branchId, ingredientId, minimumStock, reorderLevel, status (ACTIVE/INACTIVE)
- StockTransaction: id, branchId, ingredientId, type, quantity (> 0), unit, referenceId?, reason?, note?, performedBy, createdAt
- Ledger Inflow Types: OPENING, RECEIPT, TRANSFER_IN, ADJUSTMENT_IN
- Ledger Outflow Types: CONSUMPTION, TRANSFER_OUT, DAMAGE, WASTAGE, ADJUSTMENT_OUT
- Constraints: @@unique([branchId, ingredientId]), strictly positive quantities

## Calculations & Integrity
- Current Stock = Inflows - Outflows (derived dynamically via single groupBy query)
- Non-negative stock: all debit transactions validate sufficient available stock inside db transaction
- Atomic Inter-Branch Transfers: Linked TRANSFER_OUT + TRANSFER_IN sharing a common referenceId in a single $transaction
- Structured Wastage: WastageReason enum (10 reasons) for DAMAGE and WASTAGE
- Auditability: adjustments require mandatory reason and user attribution; soft deactivation preserves historical transactions

## RBAC & Security
- Permissions: inventory.read, inventory.create, inventory.update, inventory.adjust, inventory.transfer, inventory.wastage, inventory.reconcile, inventory.deactivate
- Server-side branch scoping: MANAGER restricted to assigned branch (employee.branchId); OWNER/ADMIN global
- Flow: Authentication → Permission → Branch Scoping → Input Validation → Transaction → Database
```

### Supplier & Purchase Management Pattern

```
# Module: Supplier & Purchase Management

## Entity Architecture
- Supplier: id, name, contactPerson?, phone?, email?, address?, city?, state?, postalCode?, notes?, status (ACTIVE/INACTIVE)
- PurchaseOrder: id, purchaseNumber (PO-YYYY-NNNNNN), branchId, supplierId, orderDate, expectedDate?, status (DRAFT/ORDERED/PARTIALLY_RECEIVED/RECEIVED/CANCELLED), subtotal, taxAmount, totalAmount, notes?, cancellationReason?, createdBy
- PurchaseOrderItem: id, purchaseOrderId, ingredientId, orderedQuantity, receivedQuantity, unitPrice, lineTotal, unit
- PurchaseReceiving: id, purchaseOrderId, branchId, receivingNumber (REC-YYYY-NNNNNN), receivedDate, note?, receivedBy
- PurchaseReceivingItem: id, purchaseReceivingId, purchaseOrderItemId, ingredientId, receivedQuantity, unit
- StockTransaction Link: Immutable ledger record with type=RECEIPT, referenceId=purchaseNumber, created atomically upon receiving

## Business Rules & Integrity
- Unique PO Number: Server-generated sequential sequence per year (PO-YYYY-000001)
- State Machine:
  * DRAFT → ORDERED / CANCELLED
  * ORDERED → PARTIALLY_RECEIVED / RECEIVED / CANCELLED
  * PARTIALLY_RECEIVED → RECEIVED
  * RECEIVED / CANCELLED: Terminal states
- Immutable Financial Totals: Recalculated server-side from items (lineTotal = orderedQuantity * unitPrice)
- Strict Receiving Validation: Cumulative receivedQuantity cannot exceed orderedQuantity
- Automatic Inventory Sync: Each receiving atomically creates StockTransaction (type: RECEIPT) in the branch inventory ledger
- Soft Delete & Referential Integrity: Deleting suppliers referenced by purchase orders is blocked; soft-deactivation (status: INACTIVE) is used instead

## RBAC & Security
- Permissions: supplier.read, supplier.create, supplier.update, supplier.deactivate, purchase.read, purchase.create, purchase.update, purchase.receive, purchase.cancel
- Branch Scoping: OWNER/ADMIN have global view; MANAGER is strictly restricted to assigned branch (employee.branchId)
- Server-side validation: Never trust client-sent subtotals, unit prices, or branch IDs
```

### Kitchen Display System (KDS) & Order Preparation Workflow Pattern

```
# Module: Kitchen Display System (KDS) & Order Preparation Workflow

## Entity Architecture
- Order: id, orderNumber (ORD-YYYY-NNNNNN), branchId, orderType (DINE_IN/TAKEAWAY/DELIVERY), status (DRAFT/CONFIRMED/PREPARING/READY/COMPLETED/CANCELLED), confirmedAt, preparingAt, readyAt, completedAt, preparedBy, readyBy, completedBy, inventoryConsumed, inventoryConsumedAt
- OrderItem: id, orderId, menuItemId, quantity, unitPrice, lineTotal, notes?
- OrderAuditLog: id, orderId, fromStatus, toStatus, performedBy, userId?, notes?, metadata?, createdAt
- StockTransaction Link: Immutable ledger record with type=CONSUMPTION, referenceId=orderId, created atomically upon preparation start

## Business Rules & Integrity
- Dedicated KDS Interface: High-contrast, 3-column kanban board at /kitchen (New Orders, Preparing, Ready)
- Lifecycle: CONFIRMED → PREPARING → READY → COMPLETED
- Operational Urgency Sorting: Oldest active order first (createdAt: asc, orderNumber: asc)
- Late Inventory Deduction: Stock is deducted exclusively when moving an order to PREPARING ("Start Preparing")
- Atomic BOM Recipe Resolution: OrderItem.quantity × RecipeIngredient.quantity with unit conversion
- Atomic Stock Pre-check: If any required ingredient has insufficient stock at the branch, abort completely without partial deductions and display structured shortage modal
- Idempotency & Duplicate Prevention: order.inventoryConsumed flag + referenceId prevent double deductions on retries/refreshes
- Missing Recipe Handling: Displays "No BOM" warning tag and allows preparation without guessing phantom quantities
- Auditability: Append-only OrderAuditLog records every status transition, timestamp, and operator

## RBAC & Security
- Permissions: kitchen.read, kitchen.start, kitchen.ready, kitchen.complete
- Branch Scoping: STAFF and MANAGER restricted strictly to assigned branch (employee.branchId); OWNER/ADMIN multi-branch
- Defense-in-depth: Server actions validate branch access and status transitions server-side
```

### Salary, Bonus & Increment Management Pattern

```
# Module: Salary, Bonus & Increment Management

## Entity Architecture
- SalaryStructure: id, employeeId, branchId, salary, salaryType (MONTHLY/DAILY/HOURLY), effectiveFrom, effectiveTo?, reason?, status (ACTIVE/SUPERSEDED/CANCELLED), createdBy
- SalaryIncrement: id, employeeId, branchId, previousSalary, newSalary, difference, percentage, effectiveDate, reason?, notes?, status (APPLIED/CANCELLED), createdBy
- Bonus: id, employeeId, branchId, amount, type (PERFORMANCE/FESTIVAL/ATTENDANCE/SALES_INCENTIVE/SPECIAL/OTHER), reason, bonusDate, status (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED), rejectionReason?, salaryRecordId?, createdBy, approvedBy, approvedAt
- Incentive: id, employeeId, branchId, amount, reason, incentiveDate, status (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED), rejectionReason?, salaryRecordId?, createdBy, approvedBy, approvedAt
- SalaryRecord: id, salaryNumber (SAL-YYYY-NNNNNN), employeeId, branchId, periodStart, periodEnd, baseSalary, bonusAmount, incentiveAmount, adjustmentAmount, grossAmount, status (DRAFT/PENDING_REVIEW/APPROVED/PAID/CANCELLED), attendanceSummary (JSON), notes?, createdBy, approvedBy, approvedAt
- SalaryAuditLog: id, salaryRecordId, action, fromStatus?, toStatus?, grossAmount?, performedBy, notes?, metadata?

## Business Rules & Integrity
- Decoupled Compensation History: Employee base salary is tracked through versioned SalaryStructure records rather than mutating a single field
- Informational Attendance: Attendance logs (present, half-day, leave, absent) are aggregated for operational visibility without automatic deductions
- Sequential Numbering: Server-side sequential salary number generation (SAL-YYYY-000001) using PostgreSQL transaction-level advisory locks
- Period Overlap Prevention: Blocks generation of overlapping active periods for the same employee
- Maker-Checker Workflow: Bonuses require independent approval; rejection mandates capturing an audit reason
- Immutability on Approval: Approved records lock all attached bonuses and cannot be edited; errors require formal cancellation with audit documentation

## RBAC & Security
- Permissions: salary.read, salary.create, salary.update, salary.approve, salary.cancel, bonus.read, bonus.create, bonus.update, bonus.approve, bonus.cancel, increment.read, increment.create, increment.update
- Branch Tenancy: Managers operate strictly within employee.branchId; Owners & Admins retain cross-branch management
- Privacy: Compensation ledgers and revision history are restricted from operational staff
```

### Sales, Revenue & Profit/Loss Reporting Pattern

```
# Module: Sales, Revenue & Profit/Loss Reporting

## Entity Architecture
- Zero-Duplicate Tables: All reporting queries derive directly from Order, OrderItem, Payment, PaymentRefund, Expense, SalaryRecord, and PurchaseOrder.
- Revenue Sources:
  * Gross Sales = SUM(Order.totalAmount) for COMPLETED / REFUNDED orders
  * Discounts   = SUM(Order.discountAmount)
  * Refunds     = SUM(PaymentRefund.amount) with status SUCCESS
  * Net Revenue = Gross Sales − Discounts − Refunds
- Operational Costs:
  * Approved Expenses = SUM(Expense.amount) with status APPROVED
  * Approved Salary   = SUM(SalaryRecord.grossAmount) with status APPROVED / PAID (overlapping period)
  * Operating Result  = Net Revenue − Approved Expenses − Approved Salary
- Independent Procurement:
  * PurchaseOrder ordered vs received amounts tracked separately from operational expenses

## Business Rules & Integrity
- Single Source of Truth: Operational records remain the sole source of truth; no synthetic "Sales" fact tables
- Exclusions: Cancelled orders, in-flight orders, and failed payment attempts are excluded from revenue
- Historical Pricing: Product sales aggregate OrderItem.unitPrice, preserving pricing integrity across menu changes
- Safe Division: All ratios (AOV, percentages) return 0 when denominator is zero, eliminating NaN/Infinity errors
- Multi-Branch Tenancy: OWNER/ADMIN view cross-branch rollups or filter dynamically; MANAGER/STAFF are scoped at query level to their assigned branch

## RBAC & Security
- Permissions: report.sales.read, report.sales.export, report.finance.read, report.finance.export, report.branch.read, report.product.read
- Export Safeguards: CSV generation enforced via dedicated server-side export permissions
```

### Customer Management, Reviews & Operational Feedback Pattern

```
# Module: Customer Management, Reviews & Operational Feedback

## Entity Architecture
- Customer: Persistent identity without mandatory accounts (guest orders supported). Fields: name, phone?, email?, address?, notes?, status (ACTIVE | INACTIVE).
- Review: Dining feedback rating 1–5 stars. Fields: customerId?, orderId?, branchId, menuItemId?, rating, title?, comment?, status (PENDING, PUBLISHED, HIDDEN, RESOLVED), moderatedBy?, moderatedAt?.
- CustomerIssue: Operational incident ticket. Sequential ID (ISS-YYYY-000001) with transaction advisory lock. Fields: customerId?, orderId?, branchId, type (9 categories), priority (LOW, MEDIUM, HIGH, URGENT), description, status (OPEN, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED), assignedTo (branch-isolated staff), resolutionNote (mandatory upon RESOLVED).
- CustomerIssueAuditLog: Audited chronological history of status transitions and assignments.

## Business Rules & Integrity
- Derived Financial Facts: Customer lifetime spend and order count are derived on-the-fly from Order and Payment; never duplicated into history tables.
- Historical Order Pricing: Uses historic order amounts; never recalculates with current menu prices.
- Non-Destructive Deactivation: Toggling status to INACTIVE preserves all historical orders, payments, reviews, and issues.
- Staff Cannot Rewrite Reviews: Staff moderation is limited strictly to status changes (publish, hide, resolve); customer words are never modified.
- Strict Branch Security: assignedStaff.branchId === issue.branchId. Cross-branch assignment is rejected server-side.
- Privacy Masking: Least-privilege phone and email masking in directory and feedback listings.

## RBAC & Security
- Permissions: customer.read, customer.create, customer.update, customer.deactivate, review.read, review.moderate, issue.read, issue.create, issue.update, issue.assign, issue.resolve
```

### In-App Notifications & Operational Alerts Pattern

```
# Module: In-App Notifications & Operational Alerts

## Entity Architecture
- Notification: Recipient-targeted, permission-aware operational message.
  Fields: id, recipientUserId, branchId?, type (NotificationType enum), severity (NotificationSeverity enum), title, message, entityType?, entityId?, actionUrl?, isRead, readAt?, isDismissed, dismissedAt?, dedupeKey?, createdAt, updatedAt.
  Compound index on: [recipientUserId, isRead, isDismissed], [dedupeKey].
- NotificationType: LOW_STOCK, OUT_OF_STOCK, STOCK_VARIANCE, HIGH_WASTAGE, PENDING_EXPENSE_APPROVAL, PENDING_BONUS_APPROVAL, PENDING_SALARY_REVIEW, FAILED_PAYMENT, UNPAID_ORDER, ATTENDANCE_ALERT, OPERATIONAL_EXCEPTION.
- NotificationSeverity: INFO, WARNING, CRITICAL.

## Business Rules & Integrity
- Deterministic Deduplication: Compound key `${recipientUserId}:${type}:${branchId}:${entityType}:${entityId}` prevents duplicate records across repeated evaluations or page visits.
- Automated Lifecycle Resolution: When source entity state resolves (expense approved/rejected, order paid, stock replenished), pending notifications are automatically cleared/dismissed.
- Lightweight Infrastructure: Zero external message brokers, push services, SMS/email dependencies, or background cron daemons; operates directly over PostgreSQL and Next.js Server Actions.
- Real-time Alert Evaluator: Scans inventory thresholds, approval queues, payment failures, and reconciliation records idempotently.

## RBAC & Security
- Permissions: notification.read, notification.dismiss (assigned to OWNER, ADMIN, MANAGER, STAFF).
- Scoping: OWNER/ADMIN receive cross-branch operational alerts; MANAGER/STAFF are strictly isolated to their active assigned branch.
- Sensitive Data Isolation: Salary, bonus, and expense approval alerts are never routed to users lacking the required approval permission.
```





