## Current Feature

Menu + Recipe/BOM Management

## Status

Completed

## Completed

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

## Current Task

Inventory & Stock Management fully implemented, verified, tested, and documented.

## Next

Phase 7: Order Management & Kitchen Display (with automated BOM recipe stock consumption) or Supplier & Purchase Orders

## Known Issues

None
