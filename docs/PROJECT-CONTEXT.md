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

- **Branch**: A physical restaurant location. All operational data (employees, orders, inventory, expenses) is scoped to a branch. Referenced by stable `cuid` ID. Branch codes are unique and immutable after creation. Supports `ACTIVE` / `INACTIVE` status (soft deletion).

## Target Users

- **Restaurant Owner** — Full system access, cross-branch analytics
- **Branch Manager** — Branch-level operations and reporting
- **Staff** — Role-specific access (kitchen, service, cashier)

## Future Modules

| Module | Purpose |
|--------|---------|
| Branch Management | Add/edit branches, branch-level settings |
| Staff Management | Employee records, roles, permissions |
| Attendance | Clock-in/out, attendance tracking |
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
- `Permission`: Granular system actions (`dashboard.read`, `users.*`, `branch.*`, `settings.*`).
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

**Phase 3: Branch Management**

Implemented Branch model (Prisma + PostgreSQL), branch CRUD server actions with auth/permission/validation guards, branch list page with search and filtering, branch detail page, create/edit dialogs, activate/deactivate with confirmation, and comprehensive documentation.
