# Oven Xpress — Comprehensive Security Audit Report

**Audit Date**: September 24, 2026  
**Auditor**: Antigravity Security Agent (Automated & Static Analysis Hardening)  
**System**: Multi-Branch Restaurant Management & Operations System  
**Framework**: Next.js 16 (App Router), React 19, Prisma ORM 6, PostgreSQL  

---

## 1. Executive Summary

A comprehensive, defense-in-depth security audit was conducted on the Oven Xpress multi-branch restaurant management system. The audit inspected all API routes, Server Actions, authorization guards, multi-tenant branch boundaries, data queries, file upload pipelines, HTTP headers, authentication workflows, and dependencies.

All identified vulnerabilities across P0 (Critical), P1 (High), P2 (Medium), and P3 (Low) severities were resolved directly in the codebase. Parameterized queries replaced raw SQL strings, branch scoping was enforced across all employee and attendance operations, file uploads were fortified with binary magic byte validation, HTTP security headers (CSP, HSTS, X-Frame-Options) were configured, in-memory sliding-window rate limiting was implemented for authentication and file uploads, and a high-severity supply chain vulnerability was patched via workspace package overrides.

---

## 2. Audit Scope & Inspected Areas

| Domain | Files / Paths Inspected |
| :--- | :--- |
| **Authentication & Sessions** | `src/lib/auth/actions.ts`, `src/lib/auth/session.ts`, `src/lib/auth/guards.ts`, `src/middleware.ts` |
| **Server Actions & RBAC** | `src/lib/employees/actions.ts`, `src/lib/attendance/actions.ts`, `src/lib/orders/actions.ts`, `src/lib/payments/actions.ts`, `src/lib/inventory/actions.ts`, `src/lib/expenses/actions.ts`, `src/lib/salary/actions.ts`, `src/lib/customers/actions.ts` |
| **Database & Concurrency** | Prisma queries and advisory locks across `src/lib/*/actions.ts`, `prisma/schema.prisma` |
| **File Storage & Uploads** | `src/app/api/uploads/receipt/route.ts`, `src/lib/storage/receipts.ts` |
| **Network & Security Headers**| `next.config.ts`, `src/middleware.ts` |
| **Secrets & Environment** | `.env`, `.env.example`, `.gitignore`, configuration files, Git commit history |
| **Dependencies & Supply Chain**| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `pnpm audit` |

---

## 3. Vulnerability Register & Hardening Details

### [SEC-P0-01] SQL Injection in Advisory Lock Key Generation
- **Severity**: P0 (Critical)
- **Location**:
  - `src/lib/customers/actions.ts`
  - `src/lib/orders/actions.ts`
  - `src/lib/payments/actions.ts`
  - `src/lib/salary/actions.ts`
  - `src/lib/expenses/actions.ts`
- **Problem**: Transactional advisory locks were invoked using `$executeRawUnsafe` with dynamic string interpolation:
  `await prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext(\'' + lockKey + '\'))')`
- **Risk**: User-controlled or tainted identifier prefixes and sequence keys could escape string delimiters and execute arbitrary SQL commands against PostgreSQL.
- **Fix**: Replaced all instances of `$executeRawUnsafe` with Prisma's tagged template literal `$executeRaw`:
  `await prisma.$executeRaw\`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))\``
- **Verification**: Verified TypeScript compilation, parameter escaping, and automated linter passes.
- **Status**: FIXED

---

### [SEC-P1-01] Multi-Branch Isolation & IDOR Bypass in Employee Management
- **Severity**: P1 (High)
- **Location**: `src/lib/employees/actions.ts`
- **Problem**: Several server actions (`getEmployees`, `getEmployeeById`, `getEmployeeStats`, `createEmployee`, `updateEmployee`, `toggleEmployeeStatus`, and `getActiveBranchesForSelect`) lacked server-side branch authorization checks. A branch manager could query employee records from another branch, modify salaries or designations of external staff, or view aggregated salary expenditures across all branches.
- **Risk**: Unauthorized cross-branch data exfiltration, horizontal privilege escalation, and compensation data exposure.
- **Fix**: 
  - Integrated `getAuthorizedBranchScope` and `isBranchAuthorized` across all queries and mutations.
  - Restricted `where.branchId` to authorized branch scope for non-global roles.
  - Validated that existing and updated `branchId` values belong to the manager's authorized branch before persisting changes.
- **Verification**: Verified employee queries and mutations enforce tenancy boundaries via unit/static flow analysis.
- **Status**: FIXED

---

### [SEC-P1-02] Sensitive Data Exposure: Password Hashes in User Listing
- **Severity**: P1 (High)
- **Location**: `src/app/(dashboard)/users/page.tsx`
- **Problem**: The users page queried user records using a blanket `prisma.user.findMany({ include: { role: true } })`, returning full database rows including `passwordHash` to the React Server Component and client tree.
- **Risk**: Exposure of Bcrypt password hashes in server response payloads or serialized flight data, enabling offline cracking.
- **Fix**: Replaced blanket include with explicit field projection (`select: { id: true, email: true, name: true, roleId: true, role: true, createdAt: true, updatedAt: true }`), completely excluding `passwordHash`.
- **Verification**: Checked React Server Component projection; verified `passwordHash` is absent from data graph.
- **Status**: FIXED

---

### [SEC-P1-03] File Upload MIME-Type Spoofing & Missing Route Authorization
- **Severity**: P1 (High)
- **Location**: `src/app/api/uploads/receipt/route.ts`, `src/lib/storage/receipts.ts`
- **Problem**: 
  - File upload route relied on client-supplied `file.type` header which can be spoofed by attackers to upload malicious HTML or executable payloads.
  - Route handler lacked an explicit RBAC permission check and was vulnerable to unauthenticated abuse.
- **Risk**: Arbitrary file upload, stored XSS, server storage exhaustion, or unauthenticated denial-of-service.
- **Fix**: 
  - Added binary magic byte inspection (`verifyBufferMagicBytes`) verifying file headers for PDF (`%PDF-`), JPEG (`\xFF\xD8\xFF`), PNG (`\x89PNG...`), and WebP (`RIFF...WEBP`).
  - Added session authentication check and RBAC validation (`EXPENSE_CREATE`, `EXPENSE_UPDATE`, `PURCHASE_CREATE`, `PURCHASE_UPDATE`).
  - Implemented in-memory sliding-window rate limiting (20 uploads/minute per user).
- **Verification**: Tested MIME validation against binary magic bytes; verified 401/403/429 status code handling.
- **Status**: FIXED

---

### [SEC-P1-04] Prototype Pollution Vulnerability in `deepmerge-ts`
- **Severity**: P1 (High)
- **Location**: Transitive dependency via `@standard-schema/spec`
- **Problem**: `deepmerge-ts` prior to version 8.0.0 had a known prototype pollution vulnerability (GHSA-r9hx-7cx8-4f8x).
- **Risk**: Object prototype pollution leading to remote code execution or application logic tampering.
- **Fix**: Configured package override `overrides: { deepmerge-ts: "^8.0.0" }` in `pnpm-workspace.yaml` and re-resolved lockfile.
- **Verification**: Executed `pnpm audit`; confirmed 0 known vulnerabilities.
- **Status**: FIXED

---

### [SEC-P2-01] Open Redirect Vulnerability in Login Callback
- **Severity**: P2 (Medium)
- **Location**: `src/lib/auth/actions.ts`, `src/middleware.ts`
- **Problem**: The login workflow redirected to user-supplied `callbackUrl` search parameters with naive checks (`callbackUrl.startsWith('/')`). An attacker could provide protocol-relative URLs (`//evil.com`) or backslash URLs (`/\evil.com`) to redirect authenticated users to phishing sites.
- **Risk**: Credential theft and phishing attacks.
- **Fix**: Created `src/lib/security/url-validation.ts` (`sanitizeRedirectUrl`) that strips invalid leading slashes, rejects backslashes and control characters, and mandates that redirect paths resolve strictly within the application origin.
- **Verification**: Tested various bypass strings (`//evil.com`, `/\evil.com`, `/\\evil.com`); all safely fall back to default dashboard paths.
- **Status**: FIXED

---

### [SEC-P2-02] Cross-Branch Shift Assignment IDOR in Attendance Actions
- **Severity**: P2 (Medium)
- **Location**: `src/lib/attendance/actions.ts` (`updateShift`)
- **Problem**: While `updateShift` verified that the target shift existed and belonged to the authorized branch, it did not verify whether the destination `input.branchId` was authorized when reassigned.
- **Risk**: A branch manager could reassign local shifts to other branches without authorization.
- **Fix**: Added explicit validation `isBranchAuthorized(scope, input.branchId)` prior to performing the update.
- **Verification**: Verified branch scope assertion blocks unauthorized destination branch IDs.
- **Status**: FIXED

---

### [SEC-P2-03] Missing Rate Limiting on Authentication Endpoint
- **Severity**: P2 (Medium)
- **Location**: `src/lib/auth/actions.ts` (`loginAction`)
- **Problem**: `loginAction` lacked brute-force protection, allowing automated credential stuffing and dictionary attacks.
- **Risk**: Account takeover via automated password guessing.
- **Fix**: Implemented in-memory sliding-window rate limiting in `src/lib/security/rate-limit.ts` enforcing a maximum of 5 failed attempts per 15 minutes per email, with automatic reset upon valid authentication.
- **Verification**: Verified rate limiter triggers lockout and rejects excessive requests with remaining lockout duration.
- **Status**: FIXED

---

### [SEC-P2-04] Missing HTTP Security Headers
- **Severity**: P2 (Medium)
- **Location**: `next.config.ts`, `src/middleware.ts`
- **Problem**: Application lacked modern HTTP security headers including Content-Security-Policy (CSP), Strict-Transport-Security (HSTS), X-Frame-Options, and Permissions-Policy.
- **Risk**: Susceptibility to clickjacking, MIME-sniffing, XSS framing, and insecure protocol downgrades.
- **Fix**: Configured comprehensive security headers in `next.config.ts` and layered defense headers in `src/middleware.ts`.
- **Verification**: Validated headers configuration against Next.js build compilation.
- **Status**: FIXED

---

### [SEC-P3-01] Tracking of `.env.example` in Git Configuration
- **Severity**: P3 (Low)
- **Location**: `.gitignore`
- **Problem**: `.gitignore` ignored `.env*`, which unintentionally excluded `.env.example` from git tracking.
- **Risk**: Inconsistent environment configuration and risk of developers creating ad-hoc `.env` files with insecure defaults.
- **Fix**: Added `!.env.example` to `.gitignore`.
- **Verification**: Verified `git status` allows `.env.example` while continuing to ignore real `.env` files.
- **Status**: FIXED

---

### [SEC-P3-02] Inactive Employee Branch Authorization Leak
- **Severity**: P3 (Low)
- **Location**: `src/lib/auth/guards.ts`
- **Problem**: The branch scope helper did not check the employee's `employmentStatus`. If an employee was terminated or suspended, their branch scope might still return their old branch ID if session invalidation lagged.
- **Fix**: Hardened `getAuthorizedBranchScope` to ensure that only employees with `employmentStatus === 'ACTIVE'` receive branch access. Inactive employees have their scope restricted to empty list.
- **Verification**: Verified inactive employees return empty authorized branch arrays.
- **Status**: FIXED

---

### [SEC-P2-05] Inconsistent & Duplicated Local Branch Authorization Resolvers
- **Severity**: P2 (Medium)
- **Location**: `src/lib/reports/report-service.ts`, `src/lib/settings/actions.ts`, `src/lib/attendance/actions.ts`, `src/lib/salary/actions.ts`
- **Problem**: Several modules defined duplicate local implementations of `getAuthorizedBranchScope` and `isBranchAuthorized`. These divergent functions omitted checks on `employee.employmentStatus === 'ACTIVE'`, leaving suspended or terminated staff with residual branch access if database sessions outlived employee deactivation.
- **Fix**: Centralized all branch authorization logic into `@/lib/auth/guards`. Standardized all actions (`settings`, `reports`, `attendance`, `salary`, `tables`, `purchases`, `payments`, `orders`, `kitchen`, `inventory`, `expenses`, `customers`, `employees`) to import the single authoritative guard.
- **Verification**: Verified zero duplicate definitions across codebase, verified active employment status assertion, and confirmed clean linter/compilation passes.
- **Status**: FIXED

---

### [SEC-P1-05] Missing Password Recovery & Expiring Token Infrastructure
- **Severity**: P1 (High)
- **Location**: `prisma/schema.prisma`, `src/lib/auth/tokens.ts`, `src/lib/auth/actions.ts`, `src/app/(auth)/forgot-password/`, `src/app/(auth)/reset-password/`
- **Problem**: The system lacked an automated password recovery workflow, which could tempt administrators to share credentials over insecure channels or hardcode resets.
- **Fix**: Implemented an OWASP-compliant, secure password reset system:
  - Generates 32-byte cryptographically secure random tokens that expire in 15 minutes.
  - Computes and stores only the SHA-256 hash (`tokenHash`) in PostgreSQL, ensuring database dumps cannot be leveraged to hijack accounts.
  - Invalidates all previous reset tokens for the user upon requesting a new one.
  - Enforces enterprise password complexity (`strongPasswordSchema`) and prevents reusing current passwords.
  - **Session Invalidation**: On successful password reset, atomically terminates all active user sessions across all devices (`destroyAllUserSessions`).
- **Verification**: Verified token lifecycle, single-use enforcement, hash storage, and session termination via `scripts/test-auth-hardening.ts`.
- **Status**: FIXED

---

### [SEC-P2-06] Missing Email Verification Architecture & Token Protection
- **Severity**: P2 (Medium)
- **Location**: `prisma/schema.prisma`, `src/lib/auth/tokens.ts`, `src/lib/auth/actions.ts`, `src/app/(auth)/verify-email/`
- **Problem**: System lacked email ownership validation, enabling unauthorized account registration with unverified email identities.
- **Fix**: 
  - Added `emailVerified DateTime?` to `User` and provisioned `EmailVerificationToken` table with 24-hour expiration.
  - Stored tokens exclusively as SHA-256 hashes.
  - Created automated verification endpoint (`verifyEmailAction`) and resend endpoint (`requestEmailVerificationAction`) with rate limiting (3 requests / 15 minutes).
  - Integrated email verification status check into login workflow and user directory.
- **Verification**: Verified single-use consumption, replay protection, and verification state updates via automated test suite.
- **Status**: FIXED

---

### [SEC-P2-07] User Enumeration Timing Attack on Login Endpoint
- **Severity**: P2 (Medium)
- **Location**: `src/lib/auth/actions.ts`, `src/lib/auth/password.ts`
- **Problem**: The login action returned immediately when an email was not found, whereas existent accounts executed computationally intensive bcrypt hashing (~150-250ms). An attacker could measure response latencies to enumerate valid registered emails.
- **Fix**: Added `DUMMY_BCRYPT_HASH`. When an email is not found or is deactivated, the server executes a dummy bcrypt comparison against this precomputed 12-round hash, ensuring constant-time latency regardless of whether the email exists.
- **Verification**: Validated timing invariance and audit logging in test suite.
- **Status**: FIXED

---

### [SEC-P1-06] Insecure Direct Object Reference (IDOR) & Tenancy Gaps in Branch Operations
- **Severity**: P1 (High)
- **Location**: `src/lib/branches/actions.ts` (`getBranchById`, `updateBranch`, `toggleBranchStatus`, `createBranch`, `getBranches`, `getBranchStats`)
- **Problem**: 
  - `getBranchById`, `updateBranch`, and `toggleBranchStatus` validated RBAC permission codes (`BRANCH_READ`, `BRANCH_UPDATE`, `BRANCH_DEACTIVATE`), but omitted verifying that the target branch matched the caller's authorized branch scope. A manager assigned to Branch A could modify or deactivate Branch B.
  - `createBranch` allowed any user holding `BRANCH_CREATE` to provision branches without asserting global tenancy (`isAllBranches`).
  - `getBranches` and `getBranchStats` listed all branches across the organization without scoping to the manager's assigned branch.
- **Fix**: 
  - Integrated `getAuthorizedBranchScope` and `isBranchAuthorized` across all operations in `src/lib/branches/actions.ts`.
  - Enforced `isBranchAuthorized(scope, id)` checks on `getBranchById`, `updateBranch`, and `toggleBranchStatus`.
  - Restricted `createBranch` strictly to global administrators (`scope.isAllBranches`).
  - Scoped `getBranches` and `getBranchStats` to `{ id: { in: scope.branchIds } }` for branch-restricted roles.
- **Verification**: Verified via `scripts/verify-idor-hardening.ts` that cross-branch modifications and lookups are strictly rejected.
- **Status**: FIXED

---

### [SEC-P1-07] Cross-Branch Data Leakage & IDOR in Customer, Staff, and Supplier Management
- **Severity**: P1 (High)
- **Location**: `src/lib/customers/actions.ts`, `src/lib/suppliers/actions.ts`, `src/app/(dashboard)/users/page.tsx`
- **Problem**: 
  - `getCustomerById` included full lifetime orders, reviews, and issues across all branches unconditionally. A branch manager inspecting a customer profile could see orders, spend analytics, and private complaints from other branches.
  - `getAssignableStaff` and `lookupCustomerByPhone` lacked authentication or branch authorization guards, allowing unauthenticated callers to harvest customer records or enumerate staff.
  - `getSupplierById`, `getSuppliers`, and `getSupplierStats` computed purchase order history and spend across all branches without tenant isolation.
  - `UsersPage` displayed all user accounts globally, exposing external branch staff accounts to branch managers.
- **Fix**: 
  - Filtered customer `orders`, `reviews`, and `issues` to `{ branchId: { in: scope.branchIds } }` when `!scope.isAllBranches`.
  - Added strict authentication and `isBranchAuthorized(scope, branchId)` assertions to `getAssignableStaff` and `lookupCustomerByPhone`.
  - Scoped supplier `purchaseOrders` and aggregate counts to `{ branchId: { in: scope.branchIds } }`.
  - Scoped `UsersPage` to `{ employee: { branchId: { in: scope.branchIds } } }` for branch-restricted users.
- **Verification**: Verified via `scripts/verify-idor-hardening.ts` (7/7 tests passed) and full TypeScript/ESLint suites.
- **Status**: FIXED

---

### [SEC-P1-10] Strict Input Validation, Sanitization & Multi-Vector Injection Defense
- **Severity**: P1 (High)
- **Location**:
  - `src/lib/security/input-sanitizer.ts` (Centralized Sanitization Library)
  - `src/lib/reports/constants.ts` (CSV Formula & Command Injection Defense)
  - `src/lib/storage/receipts.ts` (File Upload & Path Traversal Sanitization)
  - `src/lib/validations/customers.ts`, `src/lib/validations/orders.ts`, `src/lib/validations/expenses.ts`, `src/lib/validations/auth.ts` (Domain Schemas)
  - `src/app/api/ai/generate/route.ts` (AI Generation Payload Deep Sanitization)
  - `src/lib/reports/report-service.ts` (Report Query & Search Sanitization)
- **Problem**:
  1. User text inputs (customer notes, reviews, order notes, delivery instructions, expense descriptions, AI prompts) were accepted without systematic script neutralization, posing stored XSS risks in downstream exports, notifications, and webhooks.
  2. CSV report generation did not neutralize spreadsheet formula execution triggers (`=`, `+`, `-`, `@`, `\t`, `|`), permitting CSV Command / Formula Injection (CWE-1236) when customer names or notes were opened in spreadsheet applications.
  3. Original filenames in file uploads could carry path traversal (`../`, `..\`) or null byte sequences.
  4. Search query parameters and pagination limits lacked uniform bounds, allowing ReDoS or unbounded database take parameters.
- **Fix**:
  1. Developed centralized `input-sanitizer.ts`:
     - `sanitizeText`: Disarms dangerous tags (`<script>`, `<iframe>`, `<object>`, `<svg>`), inline event handlers (`onerror=`, `onload=`), `javascript:` pseudoprotocols, control characters, and encodes `<` / `>` to HTML entities.
     - `sanitizeCsvCell`: Neutralizes spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`, `|`) by prepending `'` single quote.
     - `sanitizeFilename`: Strips directory traversal (`../`, `..\`), null bytes (`\0`), and restricts characters to alphanumeric, hyphens, underscores, dots, and spaces capped at 100 characters.
     - `sanitizeSearchQuery`: Bounds search query strings to 100 characters, disarms script tags, and strips control characters.
     - `parseBoundedInt`: Guards pagination parameters (`page`, `pageSize`, `limit`) against negative integers, NaN, or unbounded integers.
     - `sanitizePayload`: Deeply traverses object graphs and arrays to sanitize strings while preserving passwords.
  2. Fortified CSV generation pipeline (`escapeCSV` / `toCSV`) with `sanitizeCsvCell`.
  3. Fortified file upload pipeline with `sanitizeFilename`, binary magic bytes validation (`%PDF-`, `\xFF\xD8\xFF`, `\x89PNG`, `RIFF...WEBP`), strict 5MB limit, and server-generated unique filenames (`receipt-${uniqueId}${ext}`).
  4. Integrated sanitizers into Zod schemas across Customer management, Orders, Expenses, Authentication, and Reporting services.
- **Verification**: Verified via `scripts/verify-input-hardening.ts` (63/63 checks passed) covering XSS, CSV formula injection, path traversal, magic bytes, pagination bounds, safe redirects, and deep payload sanitization.
- **Status**: FIXED

---

## 4. Remediation Status Categorization

### A. FIXED
- [x] SEC-P0-01: Parameterized all PostgreSQL sequence advisory locks with `$executeRaw` tagged templates.
- [x] SEC-P1-01: Enforced multi-branch tenancy isolation and IDOR guards across all employee management operations.
- [x] SEC-P1-02: Excluded Bcrypt `passwordHash` from user management queries via explicit projections.
- [x] SEC-P1-03: Fortified file uploads with binary magic byte validation, authentication, RBAC, and rate limiting.
- [x] SEC-P1-04: Patched `deepmerge-ts` prototype pollution vulnerability via workspace package override (`^8.0.0`).
- [x] SEC-P1-05: Implemented SHA-256 hashed, 15-minute expiring password reset tokens with multi-device session invalidation.
- [x] SEC-P1-06: Patched IDOR in branch lookups, updates, status toggles, and creation via `isBranchAuthorized`.
- [x] SEC-P1-07: Eliminated cross-branch IDOR data leakage in customer profiles, phone lookups, staff assignments, suppliers, and user listings.
- [x] SEC-P1-08: Configured secure production deployment with HTTPS 308 redirects, CSP `upgrade-insecure-requests`, secret entropy validation, DB SSL enforcement, probe/traversal detection, and structured JSON security logging.
- [x] SEC-P1-09: Implemented comprehensive abuse protection: dual-layer login rate limiting (per-email + per-IP spray defense), account creation throttling, AI generation burst/hourly quotas, tiered API rate limiting, anti-bot/scraper detection, honeypot traps, and `robots.txt`.
- [x] SEC-P1-10: Implemented strict validation, multi-layer sanitization (XSS, CSV formula injection, path traversal), and bounded parameter guards across all forms, APIs, uploads, and query parameters.
- [x] SEC-P2-01: Implemented RFC-compliant open redirect sanitizer for authentication callbacks.
- [x] SEC-P2-02: Patched cross-branch shift assignment IDOR in attendance management.
- [x] SEC-P2-03: Implemented 5 attempts / 15-minute sliding-window rate limiting on login actions.
- [x] SEC-P2-04: Configured enterprise HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy).
- [x] SEC-P2-05: Centralized and synchronized multi-branch tenant boundary enforcement across all services.
- [x] SEC-P2-06: Built secure 24-hour expiring email verification lifecycle with SHA-256 token hashing.
- [x] SEC-P2-07: Neutralized user enumeration timing attacks on login with constant-time dummy bcrypt hashing.
- [x] SEC-P3-01: Updated `.gitignore` to safely track `.env.example` while ignoring all secret environment files, and provisioned a comprehensive `.env.example` template.
- [x] SEC-P3-02: Hardened centralized branch scope resolver to reject inactive/suspended staff.

### B. VERIFIED
- [x] **Lint & Static Analysis**: `pnpm run lint` passed with 0 errors and 0 warnings.
- [x] **Package Supply Chain**: `pnpm audit` returned "No known vulnerabilities found".
- [x] **TypeScript Strict Typing**: `pnpm exec tsc --noEmit` compiled with 0 errors and strict types preserved.
- [x] **Input Hardening & Sanitization Test Suite**: `npx tsx scripts/verify-input-hardening.ts` passed (63/63 checks).
- [x] **Abuse Protection & Anti-Bot Test Suite**: `npx tsx scripts/test-abuse-protection.ts` passed (125/125 checks).
- [x] **Deployment Hardening Test Suite**: `npx tsx scripts/verify-deployment-hardening.ts` passed (18/18 checks).
- [x] **IDOR & Tenancy Hardening Test Suite**: `pnpm exec tsx scripts/verify-idor-hardening.ts` passed (7/7 checks).
- [x] **Production Hardening Test Suite**: `pnpm exec tsx scripts/verify-production-hardening.ts` passed (23/23 tests).
- [x] **Authentication Security Test Suite**: `pnpm exec tsx scripts/test-auth-hardening.ts` passed (27/27 checks).

### C. REQUIRES MANUAL TESTING
- [ ] Multi-device concurrent login verification (testing session invalidation on password change or termination).
- [ ] End-to-end receipt image uploads via browser UI with real image files (JPEG, PNG, WebP, PDF).
- [ ] Cross-branch POS order creation testing with actual staff credentials.

### D. REQUIRES DEPLOYMENT CONFIGURATION
- [ ] Set `NODE_ENV=production` on the production server.
- [ ] Configure `DATABASE_URL` with SSL enforcement (`?sslmode=require`).
- [ ] Generate a production-grade 256-bit random string for `AUTH_SECRET` (`openssl rand -hex 32`).
- [ ] Configure Cloudinary / object storage API keys with restricted permissions in production environment variables.

### E. REMAINING RISKS
- [ ] **Distributed Rate Limiting**: The current rate limiter is process-memory backed. For horizontal multi-instance deployments (e.g., behind a load balancer with multiple pods), consider adding a Redis or Upstash adapter for shared rate limit counters.
