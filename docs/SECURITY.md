# Oven Xpress — Security Architecture & Hardening Guide

## 1. Security Philosophy & Threat Model

Oven Xpress is engineered with **defense-in-depth** principles. The application operates in a multi-branch restaurant environment where multiple staff members, managers, and corporate administrators interact with sensitive financial, employee, inventory, and customer data.

The core security tenets are:
1. **Never Trust the Client**: Hiding a UI component is for user experience, not security. All authorization, permission evaluation, and input sanitization happen on the server.
2. **Zero Ambient Authority**: Every server action and API route independently resolves the caller's session, identity, role, and branch scope.
3. **Strict Tenancy Isolation**: Branch managers and store staff are strictly bounded to their assigned location. Cross-branch parameter tampering is completely neutralized.
4. **Append-Only Auditing**: Critical operational and financial state changes are logged immutably in the database with sanitized payloads.
5. **Fail-Closed by Default**: If credentials, sessions, or permissions cannot be affirmatively verified, access is denied immediately.

---

## 2. Authentication Architecture & Session Security

- **Session Handling**:
  - Sessions are managed via encrypted database session records (`Session` model) referenced by a cryptographically strong session token.
  - Session cookies are issued with `HttpOnly`, `SameSite=Lax`, and `Secure` (in production). JavaScript running in the browser cannot read or exfiltrate session tokens.
  - Route handlers reject expired sessions and immediately revoke them upon logout (`logoutAction`).
  - Active employment check: Any user marked with an inactive employment status (`TERMINATED`, `RESIGNED`, `SUSPENDED`) has their session invalidated on the next request.
- **Password Security**:
  - Passwords are encrypted using **Bcrypt** with **12 salt rounds**.
  - Passwords are never logged in cleartext, error messages, or audit payloads.
  - User projection sanitization: All database queries selecting user records exclude `passwordHash` (e.g., user management endpoints explicitly project safe fields).
- **Anti-Brute Force Rate Limiting**:
  - Login attempts are rate-limited via an in-memory sliding-window limiter (`src/lib/security/rate-limit.ts`) allowing a maximum of 5 failed attempts per 15-minute window per email address.
  - Successful authentication clears the rate limiter entry.
- **Open Redirect Protection**:
  - All login and auth callback redirect paths are validated using `sanitizeRedirectUrl` in `src/lib/security/url-validation.ts`.
  - Protocol-relative URLs (`//evil.com`), Windows backslash path bypasses (`/\evil.com`), and control characters are rejected and fall back safely to `/dashboard`.

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

Branch isolation is enforced centrally via `getAuthorizedBranchScope(user, requestedBranchId)` and `isBranchAuthorized(scope, targetBranchId)` in `src/lib/auth/guards.ts`:

- **For OWNER & ADMIN**: Allowed to access all branches or filter to a specific branch.
- **For MANAGER & STAFF**: Forcibly restricted to `user.branchId`. Any `branchId` passed in query parameters, form bodies, or headers is overridden or validated against the server-authoritative scope.
- **Inactive Employees**: If an employee is not `ACTIVE`, all branch access is rejected.

### Direct Object Reference (IDOR) Mitigation
When retrieving or modifying records by primary ID (e.g., Order, Employee, Shift, Expense, Inventory Item), the system executes a two-phase check:
1. Load the existing entity to verify its existence and discover its assigned `branchId`.
2. Verify that `isBranchAuthorized(scope, entity.branchId)` returns `true`.
3. If changing branch assignment (e.g., transferring employee or shifting inventory), verify that the destination branch `isBranchAuthorized(scope, targetBranchId)`.

---

## 5. Input Validation & Data Bounds

All server actions validate incoming payloads using strict **Zod** schemas:
- **Numerical Bounds**: Quantities, prices, and discounts reject negative values (`min(0.01)` or `min(0)` where appropriate).
- **String Sanitization**: String lengths are bounded to prevent denial-of-service via memory bloat.
- **Enum Safety**: Status transitions only accept recognized enum values.
- **Foreign Key Scoping**: When linking related entities (e.g., table to order, recipe ingredient to item), the server verifies that both entities exist and belong to the correct branch scope.
- **Safe State Transitions**: Order, payment, purchase, and expense transitions strictly follow defined state machine paths.

---

## 6. Database Security & Injection Prevention

- **Prisma Parameterized API**: All standard database operations use Prisma's safe parameterized query builder.
- **PostgreSQL Advisory Locks**: All critical concurrency operations (such as generating sequence identifiers for Orders, Customers, Invoices, Expenses, and Salary Slips) use tagged template literal `$executeRaw` (`prisma.$executeRaw`):
  ```typescript
  await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  ```
  `$executeRawUnsafe` has been eradicated across all modules, eliminating SQL injection vectors.
- **Transaction Boundaries**: All multi-step mutations (inventory consumption, purchase receiving, payment processing, salary generation) run within `prisma.$transaction` with appropriate isolation.

---

## 7. Financial Integrity & Concurrency Controls

- **Authoritative Server Calculations**:
  - The client is never trusted to calculate totals, discounts, taxes, or line-item subtotals.
  - The server computes subtotal = sum(item.price * item.quantity), calculates discount based on verified coupon rules, computes tax according to branch rate settings, and derives authoritative totals.
- **No Floating Point Drift**: Financial calculations follow integer-cents or rounded decimal arithmetic (`Math.round(cents * 100) / 100`).
- **Idempotency & Double-Processing Protection**:
  - Purchase receiving checks current PO status inside the transaction. If already received, redundant submissions abort immediately.
  - Payment refunds verify that cumulative refunds do not exceed the original payment amount.
  - Repeated order preparation does not deduct inventory twice.

---

## 8. File Upload Security

The receipt and document upload pipeline (`/api/uploads/receipt` and `src/lib/storage/receipts.ts`) enforces multiple layers of defense:
1. **Authentication & Authorization**: Handlers verify active user session and enforce `EXPENSE_CREATE/UPDATE` or `PURCHASE_CREATE/UPDATE` permissions.
2. **Magic Byte Verification**: Content is not trusted by client-provided MIME type. Binary file signatures are verified against real magic bytes:
   - PDF: `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`)
   - JPEG: `\xFF\xD8\xFF`
   - PNG: `\x89PNG\r\n\x1a\n` (`0x89 0x50 0x4E 0x47`)
   - WebP: `RIFF....WEBP`
3. **Size & Extension Limits**: Maximum file size is capped at 5 MB; only `.pdf`, `.jpg`, `.jpeg`, `.png`, and `.webp` are permitted.
4. **Filename Sanitization**: Uploaded files are stripped of directory traversal sequences and stored with randomized UUID keys.
5. **Rate Limiting**: Upload endpoints are protected by a sliding-window rate limiter (20 uploads/min per user).

---

## 9. Security Headers & Network Controls

Configured in `next.config.ts` and `middleware.ts`:
- **Content-Security-Policy (CSP)**:
  - `default-src 'self'`: Restricts resource fetching to origin.
  - `script-src 'self' 'unsafe-eval' 'unsafe-inline'`: Restricted to local Next.js bundles and hydration scripts.
  - `img-src 'self' data: blob: res.cloudinary.com https:`: Restricts image sources to trusted CDNs.
  - `frame-ancestors 'none'`: Prevents clickjacking and framing attacks.
- **X-Frame-Options**: `DENY`.
- **X-Content-Type-Options**: `nosniff`.
- **Referrer-Policy**: `strict-origin-when-cross-origin`.
- **Strict-Transport-Security (HSTS)**: `max-age=63072000; includeSubDomains; preload` (enforced in production).
- **Permissions-Policy**: `camera=(), microphone=(), geolocation=(), interest-cohort=()`.

---

## 10. CORS Architecture

- Oven Xpress serves both frontend and API routes from the same origin under Next.js App Router.
- Wildcard CORS (`Access-Control-Allow-Origin: *`) is **not** enabled. Cross-origin credentialed requests from untrusted origins are blocked by standard same-origin policy.

---

## 11. Rate Limiting Architecture

- **Login Endpoint**: 5 attempts per 15 minutes per email address (`src/lib/security/rate-limit.ts`).
- **File Uploads**: 20 uploads per minute per authenticated user ID.
- **Design**: In-memory sliding-window log with automatic cleanup of expired timestamps. Suitable for single-instance or containerized deployments without adding external infrastructure dependencies like Redis.

---

## 12. Secrets Management & Environment Security

- **Zero Hardcoded Secrets**: All API keys, database connection strings, JWT secrets, and storage credentials reside in environment variables.
- **Git Protection**: `.gitignore` strictly excludes `.env`, `.env.local`, `.env.*.local`, `.env.development`, and `.env.production`. Only `.env.example` (containing empty/placeholder keys) is tracked.
- **Public Variable Audit**: Only variables prefixed with `NEXT_PUBLIC_` are bundled to the client. No database URLs, auth secrets, or payment credentials use `NEXT_PUBLIC_`.
- **Database Connection Security**: Production connections must mandate TLS encryption (`sslmode=require`).

---

## 13. Logging, Sensitive Data Masking & Audit Trails

- **Sensitive Data Masking**:
  - The audit subsystem in `src/lib/audit/audit-service.ts` features deep recursive data sanitization (`sanitizeAuditData`).
  - Automatically masks keys matching: `password`, `hash`, `token`, `secret`, `creditCard`, `cvv`, `authSecret`, `databaseUrl`, `apiKey`.
- **Safe Production Error Responses**:
  - Error messages returned to client components avoid exposing database schemas, raw SQL errors, stack traces, or file system paths.
- **Append-Only Auditing**:
  - Critical operational and financial state changes are logged immutably in the database with scalar field diffing.
  - The `AuditLog` table exposes zero update or delete APIs.

---

## 14. Backup & Disaster Recovery Considerations

1. **Automated WAL & Snapshot Backups**: Ensure PostgreSQL continuous archiving / WAL archiving is enabled on the hosting provider (e.g., Supabase, Neon, AWS RDS).
2. **Read Replica Separation**: In multi-branch peak volume environments, offload analytical reports and audit log queries to read-replicas.
3. **Encrypted at Rest**: Mandate AES-256 volume encryption on all database volumes and object storage buckets.

---

## 15. Known Architectural Limitations

1. **In-Memory Rate Limiting**: The built-in rate limiter is memory-backed within the Node.js process. In a multi-replica serverless or horizontal cluster environment (e.g., AWS ECS or multiple Vercel Lambdas), rate limits are enforced per-instance. For massive distributed horizontal scale, an external Redis or Upstash rate limiter can be plugged in via the existing interface.
2. **Long-Lived In-Progress Orders**: If a POS terminal remains offline during network drops, local orders must be reconciled via idempotent server actions once reconnected.

---

## 16. Production Security Checklist

- [ ] Ensure `NODE_ENV=production` is set in the runtime environment.
- [ ] Ensure `DATABASE_URL` uses SSL (`?sslmode=require`).
- [ ] Ensure `AUTH_SECRET` is generated using a secure 256-bit random hex key (`openssl rand -hex 32`).
- [ ] Ensure Cloudinary / S3 credentials have restricted bucket permissions.
- [ ] Verify that `.env` is never committed to source control.
- [ ] Verify database user has least-privilege permissions (no `SUPERUSER` in production).
- [ ] Enable automated daily backups with 30-day retention.
- [ ] Configure DDoS and WAF protection (e.g., Cloudflare) in front of the application domain.
