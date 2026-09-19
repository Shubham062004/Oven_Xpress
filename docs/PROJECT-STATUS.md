# Project Status

## Current Feature

Branch Management

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

## Current Task

Verification (lint, build, manual testing)

## Next

Phase 4: Employee / Staff Management

## Known Issues

None
