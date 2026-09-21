# Oven Xpress — Production Readiness & Operational Verification Guide

## 1. Executive Summary

Oven Xpress is an enterprise multi-branch restaurant management system engineered with Next.js 16 (Turbopack, App Router, React 19), Prisma ORM 6, and PostgreSQL.

This document confirms the system's operational readiness following **Step 21 — Production Hardening & Final System Verification**. It details the audit results across all 27 core modules, the role-based permission matrix, branch isolation mechanisms, performance optimizations, deployment specifications, database requirements, disaster recovery assumptions, and operational limitations.

---

## 2. Complete Modules Audited (27/27)

Every module has been inspected and hardened across UI, server actions, database models, validation, authorization, error handling, loading/empty states, transaction handling, duplicate prevention, branch isolation, audit coverage, and responsive layouts:

1. **Authentication & Session Management**: Secure cookie-based HTTP-only session management, Bcrypt password hashing (12 salt rounds), automatic session expiration checks, constant-time validation, sensitive credential redaction from all client responses.
2. **Role-Based Access Control (RBAC)**: 140+ granular permissions, server-side `hasPermission` and `hasAnyPermission` guards protecting all API routes and server actions. UI controls conditionally rendered; backend actions strictly verified.
3. **Branch Authorization & Scoping**: Centralized `getAuthorizedBranchScope()` resolver ensuring automatic scoping for branch managers/staff, preventing cross-branch data access. Universal multi-branch rollup strictly restricted to OWNER and ADMIN.
4. **User & Identity Management**: Non-destructive deactivation, duplicate email prevention, role assignment validation, staff-to-branch allocation integrity.
5. **Branches & Store Infrastructure**: Multi-branch tenancy, postal code/tax rate/operating hours management, branch-specific status toggling.
6. **Employees & Staffing**: Role assignment, hourly/fixed salary structures, branch affiliation validation, employee profile management.
7. **Attendance Tracking**: Clock-in/clock-out tracking, work duration calculation, branch-scoped attendance verification, duplicate punch prevention.
8. **Shifts & Scheduling**: Shift definitions, shift assignment to employees, conflict detection, branch boundary enforcement.
9. **Menu Management**: Category hierarchy, menu item pricing, tax rate overrides, dietary tags, preparation station routing, non-destructive deactivation.
10. **Recipes & Bill of Materials (BOM)**: Explicit unit conversion, multi-ingredient consumption ratios, item-to-recipe relationship integrity, fractional ingredient quantities.
11. **Inventory & Stock Management**: Real-time batch-computed inventory, opening stock, adjustments, transfers, and wastage. Atomicity across stock movements. Negative stock prevention.
12. **Suppliers**: Vendor directory, contact details, payment terms, item associations, non-destructive status tracking.
13. **Purchasing & Procurement**: Purchase order lifecycle (`DRAFT` → `ORDERED` → `PARTIALLY_RECEIVED` → `RECEIVED` → `CANCELLED`), item pricing, transaction-level double-receiving lock.
14. **Orders & POS**: Real-time order creation, dining option selection (Dine-in, Takeaway, Delivery), table assignment validation, strict order lifecycle state machine.
15. **Kitchen Display System (KDS)**: Station routing, order progress tracking (`PENDING` → `CONFIRMED` → `PREPARING` → `READY` → `COMPLETED`), idempotency on prep status transitions.
16. **Payments & Cash Management**: Multi-tender support (Cash, Card, UPI, NetBanking, Split), partial payments, atomic refund processing with balance constraints, idempotent submission tokens.
17. **Expenses**: Categorization, receipt image attachments, sequential numbering, approval workflow (`DRAFT` → `PENDING_APPROVAL` → `APPROVED` / `REJECTED` → `CANCELLED`).
18. **Salary & Payroll**: Base salary structures, pay period generation, deductions, approval lifecycle, audit trails.
19. **Bonus & Incentives**: Performance bonus proposals, manager approval workflow, payout status tracking.
20. **Sales Operations**: Real-time sales transactions, channel splits, discount tracking, product sales velocity.
21. **Customers**: Customer profile registry, guest ordering support, lifetime spend aggregation, phone/email privacy masking.
22. **Reviews & Feedback**: 1–5 star ratings, order linkage, moderation workflow (`PENDING` → `PUBLISHED` → `HIDDEN` → `RESOLVED`).
23. **Notifications & Alerts**: Centralized alert evaluation engine, deterministic deduplication key, auto-clearing upon entity resolution, unread counter badge.
24. **Executive Dashboard**: Consolidated multi-branch rollup, operational KPI cards, safe division/trend deltas, hourly/daily revenue breakdowns, live operational activity feed.
25. **Reports & Data Export**: 14 dedicated reports, zero duplicate tables, server-side aggregations, streaming RFC-4180 CSV exports respecting branch isolation.
26. **Audit Logs & System Activity**: Append-only audit trail, deep recursive sensitive-data sanitizer, scalar/enum field diff calculation, transactional consistency.
27. **Settings & Configuration**: Two-tier configuration engine (System Fallback + Branch Override), strictly validated typed schemas, audit trail on all mutations.

---

## 3. RBAC Permission Matrix

| Role | User Management | Branch Config | POS & Orders | Inventory & Recipes | Expenses & Salary | Reports & Analytics | Audit Logs | Settings |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OWNER** | Full (Read, Create, Update, Deactivate) | Full (Universal across all branches) | Full | Full | Full (Approve, Pay, Cancel) | Full (Universal Rollups & Exports) | Full (Read & Export) | Full (Global & Branch Override) |
| **ADMIN** | Full (Read, Create, Update, Deactivate) | Full (Universal across all branches) | Full | Full | Full (Approve, Pay, Cancel) | Full (Universal Rollups & Exports) | Full (Read & Export) | Full (Global & Branch Override) |
| **MANAGER** | Read staff within assigned branch | Read assigned branch only | Full within assigned branch | Full within assigned branch | Submit & Review; cannot approve self | Read & Export assigned branch only | Denied | Branch Override only (Scoped) |
| **STAFF** | Denied | Denied | Create/Update Orders (POS/KDS) | Read assigned branch only | Denied | Denied (Operational counts only) | Denied | Denied |

---

## 4. Branch Isolation & IDOR Defense

Branch isolation is enforced server-side through `getAuthorizedBranchScope()` and verified across all mutations and queries:

- **Query Isolation**: Non-owner/non-admin users have their `branchId` automatically set to their active branch assignment. Incoming URL parameters or form payloads attempting to request another branch's data are ignored or rejected.
- **Entity Relationship Validation**: Any mutation linking entities (e.g., assigning an Order to a Table, assigning an Employee to an Attendance record, receiving a Purchase Order) verifies that all participating entities belong to the authorized branch before committing.
- **IDOR Protection**: Direct object access by ID (e.g., `/orders/[id]`, `/purchases/[id]`, `/employees/[id]`) evaluates the entity's owner branch against the authenticated user's authorized branch scope. If the entity belongs to another branch, access is denied with a safe error message.

---

## 5. Database & Concurrency Hardening

### Transactional Atomicity
All multi-step operational workflows are enclosed within `prisma.$transaction`:
- **Purchase Receiving**: Atomically updates Purchase Order status, line-item received quantities, records stock transactions, and logs an audit record. Concurrency locks prevent duplicate receiving.
- **Stock Transfers**: Atomically deducts inventory from the source branch and credits inventory to the destination branch.
- **Payment Refunds**: Atomically records a `PaymentRefund`, updates the `Payment` refund balance, and transitions payment status to `REFUNDED` or `PARTIALLY_REFUNDED`.
- **Order Preparation & Stock Consumption**: Atomically advances order status and executes recipe bill-of-materials ingredient deductions.

### Performance Indexes
Query performance has been optimized with focused compound and foreign-key indexes:
- `Order`: `[branchId, status]`, `[branchId, createdAt]`, `[status, createdAt]`
- `Payment`: `[branchId, status]`, `[branchId, processedAt]`
- `StockTransaction`: `[branchId, ingredientId]`, `[createdAt]`
- `AuditLog`: `[branchId, createdAt]`, `[userId, createdAt]`, `[action, createdAt]`
- `Notification`: `[recipientUserId, isRead]`, `[dedupeKey]`

---

## 6. Environment & Deployment Specifications

### Required Environment Variables
| Variable | Description | Production Requirement |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | Deployed managed database URL with SSL enabled (`sslmode=require`) |
| `AUTH_SECRET` | Secret key for session encryption & JWT signing | Minimum 32-character high-entropy cryptographic string |
| `NODE_ENV` | Runtime environment | Set to `production` |
| `NEXT_PUBLIC_APP_URL` | Public application URL | FQDN of the production application (e.g., `https://pos.ovenxpress.com`) |

> [!CAUTION]
> Never commit `.env` or `.env.local` files into source control. All production values must be provisioned through secure platform environment secret managers (e.g., AWS Secrets Manager, Vercel Environment Variables, Doppler).

### Deployment Sequence
1. Run database migration in non-destructive mode: `prisma migrate deploy` (or review generated DDL before execution).
2. Generate Prisma Client: `prisma generate`.
3. Build Next.js application: `npm run build`.
4. Launch production server: `npm run start` or container entrypoint.

---

## 7. Disaster Recovery & Backup Assumptions

> [!IMPORTANT]
> The Oven Xpress application does not manage physical infrastructure backups internally. Database durability, point-in-time recovery, and backups are the explicit operational responsibility of the hosting database provider.

### Operational Recovery Expectations
1. **Automated Continuous Backups**: The production PostgreSQL provider (e.g., AWS RDS, Neon, Supabase) must have continuous Write-Ahead Log (WAL) archiving and daily automated snapshots enabled.
2. **Target Recovery Time Objective (RTO)**: $< 1$ hour.
3. **Target Recovery Point Objective (RPO)**: $< 5$ minutes (utilizing continuous WAL archiving).
4. **Migration Rollback Policy**:
   - Backward-compatible schema evolution: Schema additions must be non-breaking (nullable columns or sensible defaults).
   - Never run destructive operations (e.g., column drops, table drops) in automated deployment pipelines.
   - Retain database snapshots immediately prior to applying schema migrations.

---

## 8. Known Limitations & Operational Constraints

1. **High Concurrency Stock Contention**: While transaction locks prevent stock corruption, simultaneous high-volume checkout of the exact same low-inventory item across multiple terminals may cause the second transaction to fail with an "Insufficient stock" error. This is intentional to ensure inventory integrity.
2. **CSV Export Memory Bounds**: Streaming RFC-4180 CSV exports are bounded to 10,000 records per export to protect server memory limits under Node.js runtime environments.
3. **Receipt Image Storage**: Local receipt upload directory (`public/uploads/receipts`) is suitable for single-instance deployments. For horizontally auto-scaled multi-container deployments, an S3-compatible object storage provider should be configured.
4. **Offline POS Operation**: Current architecture requires active database connectivity. Terminal offline sync is not supported in the web application model.

---

## 9. Final Pre-Flight Verification Checklist

Before opening the system to live production traffic, perform these verification checks:
- [x] All 23 hardening test assertions pass (`scripts/verify-production-hardening.ts`).
- [x] All 29 end-to-end operational lifecycle steps pass (`scripts/verify-e2e-scenario.ts`).
- [x] All 26 settings configuration tests pass (`scripts/verify-settings.ts`).
- [x] All 8 audit log verification tests pass (`scripts/verify-audit-logs.ts`).
- [x] All 57 report and export tests pass (`scripts/verify-reports.ts`).
- [x] All 8 dashboard rollup tests pass (`scripts/verify-dashboard.ts`).
- [x] All 10 notification evaluation tests pass (`scripts/verify-notifications.ts`).
- [x] 0 ESLint errors or warnings (`npm run lint`).
- [x] 0 TypeScript compiler errors (`npx tsc --noEmit`).
- [x] Production build succeeds across all 52 routes (`npm run build`).
