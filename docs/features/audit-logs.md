# Step 19: Audit Logs & System Activity Tracking

## 1. Overview & Architectural Philosophy

The **Audit Logs & System Activity Tracking** module (`/audit-logs`) provides a centralized, append-only, tamper-resistant system activity ledger for the Oven Xpress multi-branch restaurant management system.

The module answers the fundamental operational and regulatory audit questions:
- **WHO:** Which authenticated user (or automated background process) performed the action?
- **WHAT:** What controlled business action occurred?
- **WHEN:** At what timestamp did the action execute?
- **WHERE:** In which branch scope or global system context did it take place?
- **ON WHAT:** Which business record/entity was affected?
- **WHAT CHANGED:** Where appropriate, what were the previous and updated values?

### Core Principles:
1. **Append-Only & Zero Edit/Delete Routes:** Audit records are immutable once persisted. There are strictly no `UPDATE`, `DELETE`, `PUT`, or soft-deactivate routes, server actions, or UI controls for audit logs.
2. **Zero Sensitive Data Exposure:** A recursive sanitization engine filters all payloads (`beforeData`, `afterData`, `metadata`) before database writes, permanently redacting passwords, hashes, bearer tokens, API keys, session secrets, OTPs, CVVs, and database connection strings.
3. **Strict Server-Side Branch Isolation:** Branch managers and branch-restricted auditors can only view audit events originating from their assigned branch. System-level cross-branch leakage is blocked on the server regardless of client input.
4. **Transactional Consistency:** Critical business mutations (orders, inventory receipts/adjustments/transfers, payment refunds, expense approvals, salary revisions) execute their audit log creation within the exact same `prisma.$transaction` block. If the business mutation rolls back, no spurious audit log is persisted.
5. **Strictly Factual Record Keeping:** Audit log descriptions and metadata contain objective facts only. The system never speculates or classifies events as "theft", "misconduct", or "fraud".
6. **Separation of Concerns:**
   - **Audit Logs:** "What happened, who did it, and what changed?"
   - **Notifications (Step 16):** "Who needs to be alerted right now?"
   - **Business Ledgers (Step 12, 13, 14):** Specialized domain state machines (e.g. Stock Ledger, Order Status History).

---

## 2. Database Schema & Indexing

The `AuditLog` table in Neon PostgreSQL is defined as follows in `prisma/schema.prisma`:

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  actorUserId String?
  actorUser   User?    @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  branchId    String?
  branch      Branch?  @relation(fields: [branchId], references: [id], onDelete: SetNull)
  action      String
  entityType  String
  entityId    String?
  description String
  beforeData  Json?
  afterData   Json?
  metadata    Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  @@index([actorUserId])
  @@index([branchId])
  @@index([action])
  @@index([entityType])
  @@index([entityId])
  @@index([createdAt])
  @@index([branchId, createdAt])
  @@index([entityType, entityId])
}
```

### Key Schema Characteristics:
- **Foreign Key Resilience (`SetNull`):** If an employee or user is deleted or deactivated, historical audit records remain intact with `actorUserId` set to `null` to ensure forensic auditability.
- **Optimized Composite Indexes:** `[branchId, createdAt]` supports instantaneous filtered queries by branch over date ranges. `[entityType, entityId]` accelerates entity-specific audit trail lookups.
- **Unbounded JSON Prevention:** JSON fields (`beforeData`, `afterData`, `metadata`) are deep-sanitized and string-length bounded to avoid database bloat.

---

## 3. Controlled Action Vocabulary & Entity Types

Action names and entity types are strictly governed via TypeScript constants in `src/lib/audit/audit-types.ts`:

### Audited Actions:
- **Authentication:** `AUTH_LOGIN`, `AUTH_LOGOUT`, `AUTH_LOGIN_FAILED`
- **Core CRUD:** `CREATE`, `UPDATE`, `DELETE`, `ACTIVATE`, `DEACTIVATE`
- **Decisions & Transitions:** `APPROVE`, `REJECT`, `CANCEL`, `REFUND`, `STATUS_CHANGE`
- **Inventory & Supply:** `INVENTORY_RECEIVE`, `INVENTORY_CONSUME`, `INVENTORY_ADJUST`, `INVENTORY_TRANSFER`, `INVENTORY_WASTAGE`, `INVENTORY_RECONCILE`
- **Purchases:** `PURCHASE_CREATE`, `PURCHASE_UPDATE`, `PURCHASE_RECEIVE`, `PURCHASE_CANCEL`
- **Orders & Payments:** `ORDER_CREATE`, `ORDER_UPDATE`, `ORDER_STATUS_CHANGE`, `PAYMENT_CREATE`, `PAYMENT_UPDATE`, `PAYMENT_REFUND`
- **Workforce & Salary:** `ATTENDANCE_MARK`, `ATTENDANCE_UPDATE`, `SALARY_CREATE`, `SALARY_UPDATE`, `BONUS_CREATE`, `BONUS_APPROVE`, `BONUS_REJECT`
- **Administration & RBAC:** `USER_CREATE`, `USER_UPDATE`, `USER_DEACTIVATE`, `ROLE_UPDATE`, `PERMISSION_UPDATE`, `BRANCH_CREATE`, `BRANCH_UPDATE`, `BRANCH_ACTIVATE`, `BRANCH_DEACTIVATE`

### Audited Entities:
`USER`, `SESSION`, `BRANCH`, `EMPLOYEE`, `ATTENDANCE`, `SHIFT`, `MENU_ITEM`, `MENU_CATEGORY`, `INGREDIENT`, `RECIPE`, `INVENTORY_ITEM`, `STOCK_TRANSACTION`, `PURCHASE_ORDER`, `PURCHASE_RECEIVING`, `ORDER`, `ORDER_ITEM`, `PAYMENT`, `PAYMENT_REFUND`, `EXPENSE`, `EXPENSE_CATEGORY`, `SALARY`, `SALARY_STRUCTURE`, `SALARY_RECORD`, `BONUS`, `CUSTOMER`, `REVIEW`, `CUSTOMER_ISSUE`, `SYSTEM`.

---

## 4. Deep Recursive Sanitization & Credential Protection

The sanitizer (`src/lib/audit/audit-sanitizer.ts`) intercepts all data dictionaries before persistence:

```typescript
// Example dirty input
{
  user: 'Chef John',
  password: 'SuperSecretPassword123!',
  card_cvv: '999',
  api_key: 'sk_live_938420942093402940239402',
  database_url: 'postgres://user:pass@host:5432/db',
  nested: {
    sessionToken: 'sess_99999999',
    safeValue: 42
  }
}

// Sanitized output stored in database
{
  user: 'Chef John',
  password: '[REDACTED]',
  card_cvv: '[REDACTED]',
  api_key: '[REDACTED]',
  database_url: '[REDACTED]',
  nested: {
    sessionToken: '[REDACTED]',
    safeValue: 42
  }
}
```

### Sanitizer Safeguards:
- **Exact & Substring Pattern Matching:** Detects variants of `password`, `hash`, `token`, `secret`, `cvv`, `cvc`, `card`, `otp`, `pin`, `database_url`, and `bearer`.
- **Prefix Header Detection:** Detects `Bearer `, `Basic `, `postgres://`, `sk_test_`, `sk_live_` strings anywhere in data values.
- **Recursion Depth Limit:** Recursion terminates at depth 6 to safeguard against circular references.
- **String Length Capping:** Long unstructured strings are truncated to 1,000 characters with `... [TRUNCATED]` to prevent payload inflation.

---

## 5. Field Diff Calculation

When updating existing business records, `calculateFieldDiff(before, after)` compares matching keys and extracts an atomic delta:

```json
{
  "price": {
    "from": 250,
    "to": 275
  },
  "status": {
    "from": "ACTIVE",
    "to": "INACTIVE"
  }
}
```
Unchanged fields are excluded to maintain clean, focused diffs in the inspector UI.

---

## 6. Server-Side Branch Isolation & Permissions

### Permissions:
- `PERMISSIONS.AUDIT_READ = 'audit.read'`: Required to view `/audit-logs`, retrieve records, and inspect single audit entries. Granted to `OWNER` and `ADMIN`.
- `PERMISSIONS.AUDIT_EXPORT = 'audit.export'`: Required to download RFC-4180 audit logs CSV files. Granted to `OWNER` and `ADMIN`.

### Server-Side Branch Isolation Algorithm:
1. `getAuthorizedBranchScope(user)` resolves whether the user has universal access (`isAllBranches: true`) or is locked to specific branches (`branchIds: [...]`).
2. If a branch-scoped user explicitly requests a foreign branch (e.g. `?branchId=BranchB`), the server throws an `Unauthorized: You cannot access audit logs from another branch` error.
3. If no branch parameter is passed, queries are automatically scoped: `where.branchId = { in: scope.branchIds }`.
4. Direct record lookups (`getAuditLogById(id, user)`) verify the event's branch matches the user's scope; foreign records trigger `Unauthorized: You cannot view audit logs from another branch`.

---

## 7. Integrated Server Mutations

Audit logging is integrated across all primary business mutations:

| Domain | File | Action(s) | Transactional Integration |
| :--- | :--- | :--- | :--- |
| **Authentication** | `src/lib/auth/actions.ts` | `AUTH_LOGIN`, `AUTH_LOGIN_FAILED`, `AUTH_LOGOUT` | Safe header IP/UA extraction |
| **Branches** | `src/lib/branches/actions.ts` | `BRANCH_CREATE`, `BRANCH_UPDATE`, `BRANCH_ACTIVATE`, `BRANCH_DEACTIVATE` | Direct server actions |
| **Employees** | `src/lib/employees/actions.ts` | `CREATE`, `UPDATE`, `ACTIVATE`, `DEACTIVATE` | Diff calculation on salary/role |
| **Orders** | `src/lib/orders/actions.ts` | `ORDER_CREATE`, `ORDER_UPDATE`, `ORDER_STATUS_CHANGE`, `CANCEL` | Atomic `tx` inside `$transaction` |
| **Payments** | `src/lib/payments/actions.ts` | `PAYMENT_CREATE`, `PAYMENT_REFUND`, `STATUS_CHANGE` | Atomic `tx` inside `$transaction` |
| **Inventory** | `src/lib/inventory/actions.ts` | `CREATE`, `INVENTORY_RECEIVE`, `INVENTORY_WASTAGE`, `INVENTORY_ADJUST`, `INVENTORY_TRANSFER`, `INVENTORY_RECONCILE` | Atomic `tx` across stock ledger |
| **Purchases** | `src/lib/purchases/actions.ts` | `PURCHASE_CREATE`, `PURCHASE_RECEIVE`, `PURCHASE_CANCEL` | Atomic `tx` inside receipt ledger |
| **Expenses** | `src/lib/expenses/actions.ts` | `EXPENSE_CREATE`, `EXPENSE_APPROVE`, `EXPENSE_REJECT`, `EXPENSE_CANCEL` | Atomic `tx` inside status transition |
| **Attendance** | `src/lib/attendance/actions.ts` | `ATTENDANCE_MARK`, `ATTENDANCE_UPDATE` | Captured during shift checkout |
| **Salary & Bonus** | `src/lib/salary/actions.ts` | `SALARY_UPDATE`, `BONUS_CREATE`, `BONUS_APPROVE`, `BONUS_REJECT` | Atomic `tx` inside increment structure |

---

## 8. User Interface & Pages

### 1. `/audit-logs` — Audit Trail Ledger
- **Executive KPI Cards:** Total Audited Events, Active Actors, Tracked Branches, Top Action Type.
- **Filter Toolbar:** Live debounced search (description, entity ID, actor), Date range presets (`today`, `yesterday`, `7d`, `30d`, `custom`), Branch dropdown (with auto-lock for single-branch roles), Action selector, and Entity type selector.
- **Data Table:** Timestamp with time/date separation, Actor badge (with role tag), Color-coded Action badge, Entity type and truncated `#ID`, Branch tag or `Global System`, and human-readable Description.
- **Pagination & Export:** Server-side pagination controls, print view stylesheet (`@media print`), and CSV export button.

### 2. `/audit-logs/[id]` — Audit Record Detail Inspector
- **Event Header:** Factual description banner with security badge and formatted date.
- **Actor & Client Context:** Operator name/email/role, Branch code/city, IP address, and User-Agent string.
- **Visual Before / After Diff:** Side-by-side comparison of modified fields highlighting former values in rose/red and updated values in emerald/green.
- **Raw Payloads:** Formatted JSON viewers for Before State, After State, and Operational Metadata with one-click clipboard copy.
- **Entity Deep Link:** Secured link to parent entity (`/orders/[id]`, `/purchases/[id]`, `/employees/[id]`, etc.) with security warning noting that destination permissions are re-evaluated upon arrival.

---

## 9. Verification & Validation Summary

The test suite in `scripts/verify-audit-logs.ts` validates all system invariants:

```bash
npx tsx scripts/verify-audit-logs.ts
```

### Verified Test Cases:
1. **Sensitive Data Sanitization:** Passwords, password hashes, bearer tokens, session tokens, API keys, card CVVs, and database connection strings are 100% redacted. String bounds are preserved.
2. **Field Diff Calculation:** Scalar and enum changes (`price`, `status`) accurately compute before/after values with unchanged fields omitted.
3. **Audit Creation & Persistence:** Records insert with relations, timestamps, and sanitized payloads in Neon PostgreSQL.
4. **Branch Isolation & Permission Security:**
   - Staff/Manager without `audit.read` is rejected immediately (`4A: PASS`).
   - Auditor scoped to Branch A requesting foreign branch is blocked (`4B: PASS`).
   - Direct record lookup across branch boundaries is blocked (`4B: PASS`).
5. **Transactional Atomicity & Rollback:** When a business transaction rolls back, the audit log inside the transaction is cancelled and never persisted.
6. **Append-Only & Immutability:** Audit service and server actions export zero update or delete methods.
7. **Search, Filter, Pagination, and KPI Stats:** Accurate search by entity ID, date presets, and KPI counts.
8. **CSV Export Integrity:** Generates RFC-4180 CSV without leaking credentials or raw undefined values.

### Regression Verification:
- `scripts/verify-reports.ts`: **57/57 Passed**
- `scripts/verify-dashboard.ts`: **8/8 Passed**
- `scripts/verify-notifications.ts`: **10/10 Passed**
- `scripts/verify-audit-logs.ts`: **8/8 Passed**
- `npx tsc --noEmit`: **0 Errors**
- `npx eslint`: **0 Errors**
