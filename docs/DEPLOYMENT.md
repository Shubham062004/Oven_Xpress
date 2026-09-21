# Oven Xpress — Production Deployment & Operational Runbook

## 1. System Architecture

Oven Xpress is an enterprise multi-branch restaurant operating system built with:
- **Application Framework**: Next.js 16 (App Router, Turbopack, React 19, Server Components & Server Actions)
- **Database Layer**: PostgreSQL (Neon Serverless PostgreSQL with connection pooling & SSL required)
- **ORM & Schema Engine**: Prisma ORM 6 (Prisma Client with TypeScript typings)
- **Authentication**: Stateless, secure HTTP-only encrypted session cookies with Bcrypt password hashing (12 rounds)
- **Deployment Platform**: Vercel Serverless / Edge Network (or containerized Node.js runtime)
- **Continuous Integration**: GitHub Actions automated pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browsers                        │
│            (Desktop POS, Mobile, Tablets, KDS)              │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / TLS 1.3
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               Vercel Edge / CDN / Middleware                │
│             - Security Headers & CSRF Defense               │
│             - Route Authentication & Role Guards            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Next.js 16 App Router                       │
│    - 52 Server-Rendered & Static Optimized Routes          │
│    - Server Actions with Strict Zod Validation              │
│    - Branch Scoping (`getAuthorizedBranchScope()`)          │
└──────────────────────────────┬──────────────────────────────┘
                               │ Pooled Connection (SSL)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL (Managed Cloud / Neon)              │
│    - Relational Integrity & Compound Indexes                │
│    - `prisma.$transaction` for Atomic Operations            │
│    - Continuous WAL Archiving & Automated Snapshots         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Deployment Platform & Runtime Specifications

- **Hosting Platform**: Vercel (Native Next.js integration)
- **Framework Preset**: Next.js
- **Node.js Version**: 20.x or 22.x LTS
- **Package Manager**: `pnpm` (configured via `package.json` packageManager and `pnpm-lock.yaml`)
- **Vercel Configuration (`vercel.json`)**:
  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "framework": "nextjs",
    "buildCommand": "prisma generate && next build",
    "installCommand": "pnpm install"
  }
  ```

---

## 3. Build & Runtime Commands

| Operation | Command | Execution Context |
| :--- | :--- | :--- |
| **Dependency Installation** | `pnpm install --frozen-lockfile` | CI & Vercel Build Phase |
| **Prisma Generation** | `pnpm dlx prisma generate` | Pre-build Hook |
| **Production Build** | `pnpm run build` (`prisma generate && next build`) | Vercel Deployment Pipeline |
| **Container Start** | `pnpm run start` (`next start`) | Standalone / Docker Node daemon |
| **Code Quality Audit** | `pnpm run lint` (`eslint .`) | Pre-deployment Gate |
| **Static Type Check** | `pnpm exec tsc --noEmit` | Pre-deployment Gate |

---

## 4. Required Environment Variables

All production environment variables must be configured directly within the deployment provider dashboard (Vercel Project Settings $\rightarrow$ Environment Variables) or secrets manager. **Never commit `.env` into Git.**

| Variable | Environment | Type | Description | Production Requirement |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Server Only | Secret | PostgreSQL connection string with SSL | Managed cloud database instance (`sslmode=require`) |
| `AUTH_SECRET` | Server Only | Secret | 32+ character high-entropy key for sessions | Cryptographically generated string (`openssl rand -base64 32`) |
| `NODE_ENV` | Server Only | String | Runtime environment mode | Must be set to `production` |
| `NEXT_PUBLIC_APP_URL` | Public / Browser | String | Canonical URL of deployed application | Production domain (e.g., `https://app.ovenxpress.com`) |
| `NEXT_PUBLIC_APP_NAME` | Public / Browser | String | Branding name | Defaults to `"Oven Xpress"` |

> [!CAUTION]
> Under no circumstances should `DATABASE_URL` or `AUTH_SECRET` be given a `NEXT_PUBLIC_` prefix. Only variables intended for public browser consumption may use `NEXT_PUBLIC_`.

---

## 5. Production Database Migration Strategy

### Migration Principles
1. **Zero Downtime**: Database changes must be non-destructive and backward-compatible with running instances.
2. **Schema Additions First**: Always deploy additive changes (new nullable columns, new tables) before deploying code that reads them.
3. **No Drop In Production**: Never issue `DROP TABLE` or `DROP COLUMN` in automated deployment scripts.

### Execution Sequence
1. **Review DDL Plan**: Run `npx prisma migrate diff` or validate against staging before executing against production.
2. **Apply Migration**: Run `npx prisma db push` (or `npx prisma migrate deploy` for migration histories).
3. **Generate Client**: Run `npx prisma generate` to synchronize TypeScript bindings.
4. **Deploy Application**: Deploy Next.js build once database changes are verified active.

---

## 6. End-to-End Deployment Sequence

1. **Pre-Deployment Verification**:
   - Run automated test suite: `npx tsx scripts/verify-uat.ts` (18/18 must pass).
   - Run static checks: `npm run lint` and `npx tsc --noEmit`.
   - Verify local production build: `npm run build`.
2. **Git Release Tagging**:
   - Commit all audited code to `main`.
   - Tag release: `git tag -a v1.0.0-prod -m "Production Launch v1.0.0"`.
   - Push to GitHub: `git push origin main --tags`.
3. **CI/CD Execution**:
   - GitHub Actions workflow (`.github/workflows/ci.yml`) executes automated linting, type checks, and build test.
4. **Vercel Production Deployment**:
   - Vercel detects merge to `main`.
   - Executes install command: `pnpm install`.
   - Executes build command: `prisma generate && next build`.
   - Deploys optimized static and dynamic serverless lambdas.
5. **Post-Deployment Smoke Verification**:
   - Execute the 21-route operational smoke test checklist ([docs/PRODUCTION-CHECKLIST.md](file:///c:/Users/shubh/OneDrive/Desktop/Work/Oven_Xpress/docs/PRODUCTION-CHECKLIST.md)).

---

## 7. Rollback Procedures

### Application Rollback
In the event of an unexpected runtime failure after deployment:
1. Navigate to the **Vercel Dashboard $\rightarrow$ Deployments**.
2. Locate the previous stable production deployment.
3. Click the options menu (`...`) $\rightarrow$ **Instant Rollback**.
4. Traffic is immediately redirected to the previous build without rebuilding (effective within $< 30$ seconds).

### Database Rollback Strategy
> [!WARNING]
> Do NOT blindly attempt to reverse database schema changes. Data written during the failed release could be corrupted or lost if columns are abruptly removed.

- **Safe Rollback Protocol**:
  1. If the previous application code is backward-compatible with the schema additions, complete the application rollback first.
  2. If data corruption occurred, restore the database from the automated pre-deployment snapshot via the database provider management console (Neon Point-in-Time Recovery).
  3. Quarantine and audit affected transactional records via `/audit-logs`.

---

## 8. Post-Deployment Verification

Upon successful deployment to production:
1. Verify HTTPS and SSL certificate validity at the production domain.
2. Confirm session cookie attributes: `HttpOnly`, `Secure`, `SameSite=Lax`.
3. Test Owner login at `/login`.
4. Verify multi-branch metrics render correctly on `/dashboard`.
5. Confirm that changing an operational setting on `/settings` persists and produces a recorded event on `/audit-logs`.
