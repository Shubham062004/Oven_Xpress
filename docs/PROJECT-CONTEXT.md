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
- **Entity Relationships**:
  - `Branch` → `Employee` (`1:N`): Employees belong to a branch.
  - `Branch` → `Shift` (`1:N`): Shifts belong to a branch.
  - `Branch` → `Attendance` (`1:N`): Attendance is scoped to a branch.
  - `Employee` → `Shift` (`N:1 optional`): Employee references `currentShiftId` for their ongoing active schedule.
  - `Employee` → `Attendance` (`1:N`): One attendance record per employee per date.
  - `Shift` → `Attendance` (`1:N optional`): Attendance snapshots `shiftId` at time of work so changing current shift never rewrites past attendance history.

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
- `Permission`: Granular system actions (`dashboard.read`, `users.*`, `branch.*`, `employee.*`, `shift.*`, `attendance.*`, `settings.*`).
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

**Phase 5: Attendance & Shift Management**

Implemented Shift model and Attendance model (Prisma + PostgreSQL), daily attendance tracking (PRESENT, ABSENT, HALF_DAY, LEAVE), check-in and check-out with automated lateness and early departure calculation, manual attendance marking and corrections, daily multi-branch summary metrics, shift management with duration and overnight schedule support, branch-scoped authorization guards, and comprehensive documentation.
