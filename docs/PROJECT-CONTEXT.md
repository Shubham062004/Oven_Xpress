# Project Context

## Overview

Oven Xpress is a multi-branch restaurant management system designed for restaurant owners who manage multiple branches within a city. It centralizes operations across branches into a single, unified platform.

## Business Context

A restaurant owner manages several branches of the same restaurant brand. Each branch has its own staff, inventory, menu pricing, and daily operations. The system provides a centralized view of all branches while allowing per-branch management of:

- Staff and attendance
- Menu and recipes
- Inventory and purchases
- Orders (dine-in, takeaway, delivery)
- Kitchen operations
- Payments and expenses
- Customer management
- Analytics and reporting

## Core Business Entities

- **Branch**: A physical restaurant location. All operational data (employees, shifts, attendance, orders, inventory, expenses) is scoped to a branch. Referenced by stable `cuid` ID. Branch codes are unique and immutable after creation. Supports `ACTIVE` / `INACTIVE` status (soft deletion).
- **Employee**: A person physically working for the restaurant (kitchen, service, delivery, cashier, management). Scoped to an active Branch (`branchId` foreign key). Has an immutable `employeeCode` (e.g. `EMP-0001`), personal info, joining date, flexible designation, base compensation (`salary`, `salaryType`), and optional `currentShiftId` referencing their active work schedule. Soft-deletable via `employmentStatus` (`ACTIVE` / `INACTIVE`).
- **User vs. Employee Distinction**: `User` represents a system login account (email, password hash, sessions, RBAC role). `Employee` represents physical staff working in the restaurant. An `Employee` may optionally link to a single `User` account (`userId` foreign key). Staff like cooks and delivery drivers work on-site without software accounts. Authentication credentials are never stored or duplicated inside `Employee`.
- **Shift**: An operational working hours schedule for a branch (e.g. "Morning Shift" 09:00–17:00, "Night Shift" 21:00–05:00). Shifts are defined per-branch and have `ACTIVE` / `INACTIVE` status.
- **Attendance**: Daily attendance records per employee per working date (`@@unique([employeeId, date])`). Captures status (`PRESENT`, `ABSENT`, `HALF_DAY`, `LEAVE`), check-in time, check-out time, calculated late arrival minutes, early departure minutes, operational notes, and audit user information (`markedBy`).
- **MenuCategory**: Classification group for menu items (e.g. Pizzas, Beverages, Desserts). Has name, sort order, and soft `MenuStatus` (`ACTIVE` / `INACTIVE`).
- **Ingredient**: Raw material inventory item used in recipes (e.g. Flour, Cheese, Tomato Sauce). Defined with standardized `IngredientUnit` and soft `MenuStatus`.
- **MenuItem**: Sellable dish or beverage. Belongs to a `MenuCategory`, defines base price (> 0), preparation time in minutes (>= 0), optional photo URL, and soft `MenuStatus`.
- **BranchMenuItem**: Branch-specific menu availability and price override join table (`@@unique([branchId, menuItemId])`). Controls whether a dish is available at a particular branch, with an optional localized price override.
- **InventoryItem**: Configures tracking thresholds (`minimumStock`, `reorderLevel`) and operational status for an ingredient at a branch (`@@unique([branchId, ingredientId])`).
- **StockTransaction**: Append-only double-entry style stock ledger recording all stock inflows (`OPENING`, `RECEIPT`, `TRANSFER_IN`, `ADJUSTMENT_IN`) and outflows (`CONSUMPTION`, `TRANSFER_OUT`, `DAMAGE`, `WASTAGE`, `ADJUSTMENT_OUT`).
- **Supplier**: Independent master entity representing vendor partners. Unowned by branches, allowing single vendor supply to multiple branches. Supports active/inactive soft status and deletion protection when referenced by purchase orders.
- **PurchaseOrder**: Formal branch procurement contract with a supplier. Lifecycle: `DRAFT`, `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED`. Contains sequential `purchaseNumber` (`PO-YYYY-000001`).
- **PurchaseOrderItem**: Line items specifying ingredient, ordered quantity, unit, agreed unit price, and cumulative received quantity (`@@unique([purchaseOrderId, ingredientId])`).
- **PurchaseReceiving**: Immutable delivery batch audit log linking physical stock receipt events directly to `StockTransaction(RECEIPT)` entries.
- **Entity Relationships**:
  - `Branch` → `Employee` (`1:N`): Employees belong to a branch.
  - `Branch` → `Shift` (`1:N`): Shifts belong to a branch.
  - `Branch` → `Attendance` (`1:N`): Attendance is scoped to a branch.
  - `Branch` → `BranchMenuItem` (`1:N`): Branch availability & price overrides.
  - `Branch` → `InventoryItem` (`1:N`): Branch stock thresholds per ingredient.
  - `Branch` → `StockTransaction` (`1:N`): Immutable stock movements.
  - `Branch` → `PurchaseOrder` (`1:N`): Purchase orders are scoped to a branch.
  - `Supplier` → `PurchaseOrder` (`1:N`): One supplier can supply many purchase orders across branches.
  - `PurchaseOrder` → `PurchaseOrderItem` (`1:N`): Ordered line items.
  - `PurchaseOrder` → `PurchaseReceiving` (`1:N`): Batch goods delivery logs.
  - `PurchaseReceiving` → `StockTransaction` (`1:N`): Stock receipts post directly to the stock ledger.
  - `Employee` → `Shift` (`N:1 optional`): Employee references `currentShiftId` for their ongoing active schedule.
  - `Employee` → `Attendance` (`1:N`): One attendance record per employee per date.
  - `Shift` → `Attendance` (`1:N optional`): Attendance snapshots `shiftId` at time of work so changing current shift never rewrites past attendance history.
  - `MenuCategory` → `MenuItem` (`1:N`): Categories organize menu items.
  - `MenuItem` → `BranchMenuItem` (`1:N`): Menu items can have per-branch availability/pricing.
  - `MenuItem` → `RecipeIngredient` (`1:N`): Menu items define their BOM recipe ingredients.
  - `Ingredient` → `RecipeIngredient` (`1:N`): Ingredients are consumed across recipes.
  - `Ingredient` → `InventoryItem` (`1:N`): Ingredients are tracked per branch.
  - `Ingredient` → `PurchaseOrderItem` (`1:N`): Ingredients are ordered from vendors.
  - `Branch` → `RestaurantTable` (`1:N`): Branch dining floor tables.
  - `Branch` → `Order` (`1:N`): Orders belong strictly to a single branch.
  - `Order` → `OrderItem` (`1:N`): Items ordered in an order.
  - `Order` → `OrderAuditLog` (`1:N`): Audit trail of order status transitions.
  - `Order` → `StockTransaction` (`1:N`): Order preparation triggers stock consumption.
  - `Order` → `Payment` (`1:N`): Orders have zero, one, or multiple split payment transactions.
  - `Payment` → `PaymentRefund` (`1:N`): Payments can have partial or full refund records.
  - `Payment` → `PaymentAuditLog` (`1:N`): Audit trail of payment mutations and reversals.
  - `Branch` → `PaymentReconciliation` (`1:N`): Daily tender and cash drawer reconciliation records.
  - `Branch` → `Expense` (`1:N`): Branch operating expenses.
  - `ExpenseCategory` → `Expense` (`1:N`): Categorized expenses with deletion protection.
  - `Expense` → `ExpenseAuditLog` (`1:N`): Audit trail of expense status transitions and modifications.
  - `Branch` → `SalaryStructure` (`1:N`): Historical compensation rate spans.
  - `Branch` → `SalaryIncrement` (`1:N`): Salary raise events and percentage change logs.
  - `Branch` → `Bonus` / `Incentive` (`1:N`): Bonuses and incentives awarded to branch employees.
  - `Branch` → `SalaryRecord` (`1:N`): Branch salary period ledger records.
  - `Employee` → `SalaryStructure` (`1:N`): Employee historical and active salary structures.
  - `Employee` → `SalaryIncrement` (`1:N`): Employee compensation raises.
  - `Employee` → `Bonus` / `Incentive` (`1:N`): Employee performance and festival bonus records.
  - `Employee` → `SalaryRecord` (`1:N`): Employee salary periods.
  - `SalaryRecord` → `SalaryAuditLog` (`1:N`): Audit trail of salary review, approval, and cancellation.

## Target Users

- **Restaurant Owner** — Full system access, cross-branch analytics
- **Branch Manager** — Branch-level operations and reporting
- **Staff** — Role-specific access (kitchen, service, cashier)

## Future Modules

| Module | Purpose |
|--------|---------|
| Branch Management | Add/edit branches, branch-level settings |
| Staff Management | Employee records, roles, permissions |
| Attendance & Shift Management | Shifts, clock-in/out, daily attendance tracking, lateness/early departure |
| Salary & Bonuses | Payroll, bonus calculations |
| Menu Management | Menu items, categories, pricing |
| Recipes | Recipe details, ingredient lists |
| Inventory | Stock tracking, low-stock alerts |
| Purchases | Purchase orders, receiving |
| Suppliers | Supplier directory, contacts |
| Orders | Order creation, status tracking |
| Dine-in | Table management, reservations |
| Takeaway | Takeaway order flow |
| Delivery | Delivery management, tracking |
| Kitchen Operations | Kitchen display, order queue |
| Payments | Payment processing, methods |
| Expenses | Expense tracking, categories |
| Profit/Loss | Financial summaries |
| Customers | Customer directory, loyalty |
| Reviews | Customer feedback |
| Analytics | Business intelligence, trends |
| Reports | Configurable report generation |
| Audit Logs | System activity tracking |
| Role-based Permissions | Access control |

## Technology Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript (strict mode)
- **Database & ORM**: PostgreSQL with Prisma ORM
- **Authentication**: HTTP-only Cookie Sessions + bcryptjs password hashing
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui (base-nova)
- **Icons**: Lucide React
- **Theme**: next-themes
- **Package Manager**: pnpm

## Architecture Direction

- Server Components by default, Client Components only where interactivity is needed
- App Router with file-based routing and route groups (`(auth)` and `(dashboard)`)
- Centralized design tokens via CSS variables
- Shared layout shell (sidebar + header) protected at server execution boundary
- Component library via shadcn/ui (copy-paste ownership)
- Server Actions for mutations and authentication flows (`loginAction`, `logoutAction`)
- Centralized server-side guards: `requireAuthentication()`, `requireRole()`, `requirePermission()`

## Authentication & RBAC Architecture

### 1. Database Model
- `User`: Accounts with `email` (@unique), `name`, `passwordHash` (bcrypt salt 12), `roleId`, and `isActive` status.
- `Session`: Database-backed sessions with cryptographically random `sessionToken` and 7-day expiration.
- `Role`: Supported roles (`OWNER`, `ADMIN`, `MANAGER`, `STAFF`).
- `Permission`: Granular system actions (`dashboard.read`, `users.*`, `branch.*`, `employee.*`, `shift.*`, `attendance.*`, `menu.*`, `inventory.*`, `supplier.*`, `purchase.*`, `order.*`, `kitchen.*`, `table.*`, `payment.*`, `settings.*`).
- `RolePermission`: Many-to-many link between roles and permissions.

### 2. Session Approach
- Cookie name: `ox_session`
- Flagged with `httpOnly: true`, `secure: true` (in production), `sameSite: 'lax'`, and `path: '/'`.
- Instant server-side revocation on logout (`destroySession()`) or upon account deactivation (`isActive === false`).

### 3. Authorization Principles
- **Defense in Depth**: Perimeter edge check (`middleware.ts`) + Server Component layout guard (`requireAuthentication()`) + Granular action/route guards (`requirePermission()`).
- **UI Visibility ≠ Security**: Navigation visibility filters in the sidebar/drawer are convenience features. All sensitive routes and mutations verify authorization on the server.
- **Role Hierarchy**: `OWNER` has universal bypass; other roles enforce granular permissions.

## Design Principles

- Professional and clean, appropriate for daily business use
- Consistent spacing, typography, and color usage via design tokens
- Responsive from mobile (390px) to desktop (1440px+)
- Accessible (semantic HTML, keyboard navigation, ARIA attributes)
- Both light and dark themes

## Coding Principles

- TypeScript strict mode, avoid `any`
- Small, focused, reusable components
- Semantic HTML with proper labels
- No inline styles; use design tokens
- Business logic separate from UI
- Server Components where possible
- No unnecessary abstractions or files

## Current Phase

**Phase 10: Kitchen Display System (KDS) & Order Preparation Workflow**

Implemented dedicated high-contrast operational KDS (`/kitchen`) with 3-column kanban board (New Orders, In Preparation, Ready for Service), chronological order queueing, operational timestamps (`confirmedAt`, `preparingAt`, `readyAt`, `completedAt`), staff attribution (`preparedBy`, `readyBy`, `completedBy`), append-only `OrderAuditLog`, and automatic atomic inventory consumption upon preparation start (`OrderItem.quantity × RecipeIngredient.quantity`). Includes unit conversion (`KG` ↔ `GRAM`, `LITRE` ↔ `ML`, `DOZEN` ↔ `PIECE`), strict insufficient-stock pre-check with atomic rollback and shortage modal, missing recipe detection ("No BOM"), idempotency safeguards (`inventoryConsumed`), auto-refresh loop (15s), branch isolation, and comprehensive documentation.
