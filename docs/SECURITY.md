# Oven Xpress — Security Architecture & Hardening Guide

## 1. Security Philosophy & Threat Model

Oven Xpress is engineered with **defense-in-depth** principles. The application operates in a multi-branch restaurant environment where multiple staff members, managers, and corporate administrators interact with sensitive financial, employee, inventory, and customer data.

The core security tenants are:
1. **Never Trust the Client**: Hiding a UI component is for user experience, not security. All authorization, permission evaluation, and input sanitization happen on the server.
2. **Zero Ambient Authority**: Every server action and API route independently resolves the caller's session, identity, role, and branch scope.
3. **Strict Tenancy Isolation**: Branch managers and store staff are strictly bounded to their assigned location. Cross-branch parameter tampering is completely neutralized.
4. **Append-Only Auditing**: Critical operational and financial state changes are logged immutably in the database with sanitized payloads.

---

## 2. Authentication Model

- **Cookie-Based Sessions**: Sessions are issued as secure, HTTP-only, `SameSite=Lax` cookies. JavaScript running in the browser cannot read or exfiltrate session tokens.
- **Password Security**:
  - Passwords are encrypted using **Bcrypt** with **12 salt rounds**.
  - Passwords are never logged in cleartext, error messages, or audit payloads.
  - All database queries selecting user records exclude `passwordHash` by default or strip it prior to returning data to the client.
- **Session Validation**:
  - Inactive or deactivated users have their sessions immediately terminated on their next request.
  - Expired sessions are rejected with HTTP 401 / redirect to `/login`.
  - Logging out invalidates the session cookie immediately.

---

## 3. Role-Based Access Control (RBAC)

The system defines four hierarchical roles:
1. **OWNER**: Complete system authority across all branches, financial rollups, user management, and system configuration.
2. **ADMIN**: Administrative authority equivalent to OWNER, excluding corporate ownership transfer.
3. **MANAGER**: Operational authority restricted strictly to their assigned branch. Cannot view or mutate other branches' records.
4. **STAFF**: Tactical POS and KDS operations. Financial metrics, compensation data, and administrative settings are completely masked.

### Server-Side Permission Verification
All mutations and queries invoke `hasPermission(user, PERMISSION)` or `hasAnyPermission(user, [PERMISSIONS])` defined in `src/lib/permissions/definitions.ts`.

Direct invocation of server actions without the requisite permission results in an immediate authorization rejection:
```typescript
if (!hasPermission(user, PERMISSIONS.EXPENSE_APPROVE)) {
  return { success: false, error: 'Unauthorized: Missing expense.approve permission' };
}
```

---

## 4. Multi-Branch Isolation & IDOR Protection

Branch isolation is enforced via `getAuthorizedBranchScope(user, requestedBranchId)` in `src/lib/permissions/branch-scope.ts`:

- **For OWNER & ADMIN**: Allowed to access all branches or filter to a specific branch.
- **For MANAGER & STAFF**: Forcibly restricted to `user.branchId`. Any `branchId` passed in query parameters, form bodies, or headers is overridden by the server.

### Direct Object Reference (IDOR) Mitigation
When retrieving or modifying records by primary ID (e.g., Order `ORD-1234`, Employee `EMP-5678`), the system always validates that the record's `branchId` matches the caller's authorized branch scope:
```typescript
const order = await prisma.order.findUnique({ where: { id } });
if (!order || (!user.isGlobal && order.branchId !== user.branchId)) {
  return { success: false, error: 'Order not found or access denied' };
}
```

---

## 5. Input Validation & Data Bounds

All server actions validate incoming payloads using strict **Zod** schemas:
- **Numerical Bounds**: Quantities, prices, and discounts reject negative values (`min(0.01)` or `min(0)` where appropriate).
- **String Sanitization**: String lengths are bounded to prevent denial-of-service via memory bloat.
- **Enum Safety**: Status transitions only accept recognized enum values.
- **Foreign Key Scoping**: When linking related entities (e.g., table to order, recipe ingredient to item), the server verifies that both entities exist and belong to the correct branch scope.

---

## 6. Financial Integrity & Concurrency Controls

- **No Floating Point Drift**: Financial calculations follow rounded decimal arithmetic (`Math.round((cents) * 100) / 100`).
- **Atomic Operations**: All financial operations (payments, refunds, receiving inventory, stock adjustments) execute inside `prisma.$transaction`.
- **Double-Spend & Duplicate Prevention**:
  - Purchase receiving checks current PO status inside the transaction. If already received, the second request is aborted.
  - Payment refunds verify that cumulative refunds do not exceed the original payment amount.
  - Repeated order preparation does not deduct inventory twice.

---

## 7. Sensitive Data Sanitization & Audit Trails

The audit subsystem in `src/lib/audit/audit-service.ts` features deep recursive data sanitization (`sanitizeAuditData`):
- Automatically strips keys matching: `password`, `hash`, `token`, `secret`, `creditCard`, `cvv`, `authSecret`, `databaseUrl`, `apiKey`.
- Scalar diff calculation (`calculateFieldDiff`) records only modified fields rather than persisting unneeded duplicate data.
- Audit records are strictly **append-only**. The `AuditLog` table exposes zero update or delete APIs.

---

## 8. Secrets Management & Environment Security

- **Zero Committed Secrets**: `.env` and `.env.local` files are excluded from Git via `.gitignore`.
- **Public Variable Audit**: Only variables prefixed with `NEXT_PUBLIC_` are bundled to the client. No database URLs, auth secrets, or payment credentials use `NEXT_PUBLIC_`.
- **Database Connection Security**: Production connections must mandate TLS encryption (`sslmode=require`).
