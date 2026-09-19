## Current Feature

Employee / Staff Management

## Status

In Progress

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
- [x] Branch management documentation
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

## Current Task

Verification (tsc, lint, build)

## Next

Phase 5: Attendance / Shift Management

## Known Issues

None

