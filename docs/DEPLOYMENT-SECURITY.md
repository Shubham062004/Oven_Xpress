# Oven Xpress — Production Deployment & Infrastructure Security Guide

This document specifies the operational configuration and security requirements for deploying the **Oven Xpress Multi-Branch Restaurant Management System** into production.

---

## 1. Network & Protocol Security (HTTPS Enforcement)

### 1.1 Reverse Proxy & TLS Termination
- In production, Next.js runs behind an edge proxy or application load balancer (e.g. Vercel Edge, AWS ALB, Cloudflare, NGINX).
- The edge reverse proxy MUST terminate TLS (TLS 1.2 or TLS 1.3 only; legacy SSLv3, TLS 1.0, and TLS 1.1 must be disabled).
- Reverse proxies forward the original protocol via the `X-Forwarded-Proto` header.

### 1.2 Application Middleware Enforcement
- [`middleware.ts`](file:///c:/Users/shubh/OneDrive/Desktop/Work/Oven_Xpress/middleware.ts) inspects incoming requests in production:
  - If `x-forwarded-proto === 'http'`, the application logs an `HTTP_DOWNGRADE_ATTEMPT` security event and immediately redirects with HTTP `308 Permanent Redirect` to the canonical `https://` origin.
  - Cross-site tracing methods (`TRACE`, `TRACK`) are rejected with HTTP `405 Method Not Allowed`.

### 1.3 HTTP Security Headers
The following defense-in-depth headers are delivered on every response via [`next.config.ts`](file:///c:/Users/shubh/OneDrive/Desktop/Work/Oven_Xpress/next.config.ts) and [`middleware.ts`](file:///c:/Users/shubh/OneDrive/Desktop/Work/Oven_Xpress/middleware.ts):
- **Strict-Transport-Security (HSTS)**: `max-age=63072000; includeSubDomains; preload` (enforces 2-year HTTPS pin).
- **Content-Security-Policy (CSP)**: Includes `upgrade-insecure-requests` to instruct modern browsers to automatically upgrade any remaining HTTP links to HTTPS.
- **X-Content-Type-Options**: `nosniff`
- **X-Frame-Options**: `DENY` (prevents clickjacking)
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: `camera=(), microphone=(), geolocation=(), browsing-topics=()`

---

## 2. Secrets Management & Client Leakage Prevention

### 2.1 Secret Storage Hierarchy
Production secrets must never be committed to Git or embedded in container images.
- Store secrets in an enterprise secret manager:
  - **AWS**: AWS Secrets Manager or SSM Parameter Store
  - **Azure**: Azure Key Vault
  - **GCP**: Google Cloud Secret Manager
  - **Vercel / Cloudflare**: Encrypted Environment Variables

### 2.2 Entropy Invariants & Pre-Flight Validation
[`src/lib/security/env-validation.ts`](file:///c:/Users/shubh/OneDrive/Desktop/Work/Oven_Xpress/src/lib/security/env-validation.ts) validates runtime configuration on server boot:
- **`AUTH_SECRET`**:
  - Minimum 32 characters (256 bits of cryptographic entropy).
  - Explicitly rejects known placeholders (`secret`, `password`, `changeme`, `12345678901234567890123456789012`).
  - Production crashes immediately with fatal configuration error if entropy check fails.
- **Frontend Leak Prevention**:
  - Scans all `NEXT_PUBLIC_*` environment variables.
  - Rejects variables containing sensitive tokens (`DATABASE`, `SECRET`, `PASSWORD`, `PRIVATE_KEY`, `CREDENTIAL`, `TOKEN`).
  - Prevents accidental bundling of server secrets into browser JavaScript bundles.

---

## 3. Database Network Isolation (Restricting Direct Public Access)

### 3.1 Network Architecture & Firewall Rules
Direct access to the PostgreSQL database from the public internet MUST be blocked:
```
                      Internet
                         │
                         ▼
             [ Edge Proxy / Load Balancer ]
                         │
                         ▼ (Private Subnet)
             [ Next.js Application Servers ]
                         │
                         ▼ (VPC Peering / Private Link)
             [ PostgreSQL / Neon / RDS Cluster ]
                 Port 5432 - INGRESS RESTRICTED
```

1. **Private Subnet Deployment**:
   - The PostgreSQL database instance (AWS RDS, Neon, Supabase, Azure Database for PostgreSQL) must reside inside a private VPC subnet with no public IPv4/IPv6 address assigned.
2. **Security Group Ingress Allowlist**:
   - Inbound traffic on port `5432` must be strictly restricted to the security group or CIDR block of the application container/server instances.
3. **Transit Encryption Enforcement**:
   - Database connection strings in production MUST specify `?sslmode=require` (or `verify-full`). Unencrypted plain PostgreSQL connections are rejected at startup by `validateEnvironment()`.
4. **Connection Pooling**:
   - Utilize a connection pooler (Prisma Accelerate, PgBouncer, Neon Connection Pooler) configured with connection limits and query timeouts (`connect_timeout=15&pool_timeout=15`) to prevent resource exhaustion attacks.

---

## 4. Security Event Logging & Threat Detection

### 4.1 Architecture
The application uses structured JSON logging via [`src/lib/security/security-logger.ts`](file:///c:/Users/shubh/OneDrive/Desktop/Work/Oven_Xpress/src/lib/security/security-logger.ts):
- Every log entry is a single JSON line on `stdout`/`stderr` with standard fields:
  - `timestamp`: ISO-8601 UTC timestamp
  - `level`: `INFO`, `WARN`, `ERROR`, `SECURITY`
  - `eventType`: Canonical security event identifier
  - `environment`: `production`, `development`, `test`
  - `clientIp`: Anonymized/extracted IP address from trusted proxy headers
  - `userAgent`: Client user-agent string
  - `path`: Request URL pathname
  - `details`: Context-specific sanitized key-value pairs

### 4.2 Automated Data Sanitization
Before any payload is logged:
- Sensitive fields (`password`, `passwordHash`, `token`, `secret`, `cookie`, `session`, `authorization`) are automatically replaced with `[REDACTED]`.
- User emails are masked for privacy compliance (e.g. `j***e@restaurant.com`).
- Stack traces are omitted in production to prevent internal implementation leaks.

### 4.3 Logged Event Types
| Event Type | Trigger | Severity | Action |
| :--- | :--- | :--- | :--- |
| `AUTH_LOGIN_SUCCESS` | Successful authentication | `INFO` | Audit session established |
| `AUTH_LOGIN_FAILURE` | Invalid password or user not found | `WARN` | Increment failed attempt counter |
| `AUTH_LOGIN_THROTTLED` | Rate limit breached on login endpoint | `SECURITY` | Account/IP temporary lock |
| `AUTH_PASSWORD_RESET_REQUESTED` | Password reset link requested | `INFO` | Dispatch token |
| `AUTH_PASSWORD_RESET_SUCCESS` | Password successfully changed | `INFO` | Invalidate all user sessions |
| `API_ERROR` | Server-side exception or unhandled fault | `ERROR` | Diagnostic ingestion |
| `SUSPICIOUS_PROBE` | Request to `/.env`, `/.git`, `/wp-admin`, etc. | `SECURITY` | Blocked with 404 |
| `PATH_TRAVERSAL_ATTEMPT` | URI contains `../`, `%2e%2e`, backslashes | `SECURITY` | Blocked with 400 |
| `MALICIOUS_USER_AGENT` | Request from `sqlmap`, `nikto`, `masscan` | `SECURITY` | Blocked with 403 |
| `RATE_LIMIT_EXCEEDED` | Request rate exceeded per-IP/user limit | `SECURITY` | Blocked with 429 |
| `HTTP_DOWNGRADE_ATTEMPT` | Insecure HTTP request in production | `SECURITY` | Redirected with 308 to HTTPS |

---

## 5. Verification Commands

To verify deployment hardening and security configuration at any time:

```bash
# 1. Verify Deployment Hardening & Security Logging
npx tsx scripts/verify-deployment-hardening.ts

# 2. Verify Tenancy & IDOR Protections
npx tsx scripts/verify-idor-hardening.ts

# 3. Verify Authentication Security
npx tsx scripts/test-auth-hardening.ts

# 4. Verify TypeScript & Lint Compliance
pnpm exec tsc --noEmit
pnpm run lint
```
