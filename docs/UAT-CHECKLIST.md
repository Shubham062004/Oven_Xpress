# Oven Xpress — User Acceptance Testing (UAT) Sign-Off Checklist

**Project:** Oven Xpress Multi-Branch Restaurant Management System  
**Test Scope:** Step 22 — Production Launch & Final Acceptance  
**Status Key:** `[x] PASS` • `[ ] FAIL` • `[ ] BLOCKED` • `[ ] NOT TESTED`

---

## 1. Authentication & Session Security
- [x] **PASS**: Unauthenticated users visiting protected routes (`/dashboard`, `/orders`, `/inventory`, etc.) are redirected to `/login`.
- [x] **PASS**: Valid credentials authenticates user and sets secure `HttpOnly`, `SameSite=Lax` session cookie.
- [x] **PASS**: Deactivated user credentials (`isActive: false`) are rejected at login with generic error.
- [x] **PASS**: User session logout invalidates cookie immediately and terminates access.
- [x] **PASS**: Password hashes use Bcrypt with 12 salt rounds; zero cleartext passwords returned in APIs.

## 2. Branches & Locations
- [x] **PASS**: Owner can create and configure branches with city, postal code, opening/closing hours, and tax rates.
- [x] **PASS**: Branch status toggling (`ACTIVE` / `INACTIVE`) reflects immediately across store navigation.
- [x] **PASS**: Branch selection dropdown dynamically populates based on authenticated user's role and permissions.

## 3. Employees & Staff Management
- [x] **PASS**: Employee onboarding enforces branch affiliation, designation, salary structure, and employee code.
- [x] **PASS**: Role assignment associates staff members with granular permissions.
- [x] **PASS**: Employee deactivation is non-destructive and preserves historical attendance and salary records.

## 4. Attendance & Shift Tracking
- [x] **PASS**: Employees can record daily clock-in linked to their assigned branch and shift.
- [x] **PASS**: Duplicate attendance submissions on the same calendar day for the same employee are blocked by database constraints.
- [x] **PASS**: Work duration and attendance statuses (`PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`) compute accurately.

## 5. Menu Management
- [x] **PASS**: Menu categories can be created, ordered, and toggled active/inactive.
- [x] **PASS**: Dishes can be created with price, category, preparation time, and dietary tags.
- [x] **PASS**: Branch availability controls allow menu items to be selectively enabled or disabled per location.

## 6. Recipes & Bill of Materials (BOM)
- [x] **PASS**: Dishes can be linked to multiple raw ingredients with explicit quantities and measurement units (`PIECE`, `KG`, `GRAM`, `LITER`, `ML`).
- [x] **PASS**: Recipe ingredient modifications update preparation requirements without altering past consumption records.

## 7. Inventory & Stock Management
- [x] **PASS**: Real-time stock levels compute from atomic transaction history (`OPENING + RECEIPT + TRANSFER_IN + ADJUSTMENT_IN - CONSUMPTION - DAMAGE - WASTAGE`).
- [x] **PASS**: Insufficient stock fails safely and blocks unfulfillable kitchen orders.
- [x] **PASS**: Stock transfers between branches execute atomically (deducts source, credits destination).

## 8. Purchasing & Procurement
- [x] **PASS**: Purchase orders progress through formal lifecycle (`DRAFT` $\rightarrow$ `ORDERED` $\rightarrow$ `PARTIALLY_RECEIVED` $\rightarrow$ `RECEIVED` $\rightarrow$ `CANCELLED`).
- [x] **PASS**: Purchase order receiving verifies status inside transaction to prevent concurrent double-receiving.
- [x] **PASS**: Receiving stock increments inventory ledger and records supplier price automatically.

## 9. Orders & Point of Sale (POS)
- [x] **PASS**: Dine-in orders require active table assignment within the branch.
- [x] **PASS**: Order subtotals, item discounts, service taxes, and grand totals calculate with decimal precision.
- [x] **PASS**: Takeaway and delivery order options execute with appropriate customer metadata.

## 10. Kitchen Display System (KDS)
- [x] **PASS**: Kitchen orders advance sequentially (`CONFIRMED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED`).
- [x] **PASS**: Transition to `PREPARING` triggers atomic Bill of Materials ingredient consumption exactly once.
- [x] **PASS**: Terminal statuses (`COMPLETED`, `CANCELLED`) reject state regression.

## 11. Payments & Cash Management
- [x] **PASS**: Multi-tender payments supported (Cash, Card, UPI, NetBanking).
- [x] **PASS**: Payment completion updates order status and reflects in real-time sales reporting.
- [x] **PASS**: Partial refunds execute atomically inside transaction and cannot exceed the original tender amount.

## 12. Expenses & Cost Tracking
- [x] **PASS**: Operational expenses record category, receipt image reference, and payment method.
- [x] **PASS**: Approval workflow (`DRAFT` $\rightarrow$ `PENDING_APPROVAL` $\rightarrow$ `APPROVED`) enforces permission checks.
- [x] **PASS**: Rejected expenses are excluded from operating expenditure calculations.

## 13. Salary & Staff Bonuses
- [x] **PASS**: Base compensation structures support hourly, monthly, and daily salary types.
- [x] **PASS**: Performance bonuses require manager/owner approval before payout.
- [x] **PASS**: Non-authorized staff members are barred from viewing compensation and payroll records.

## 14. Customer Profiles & History
- [x] **PASS**: Customer directory tracks lifetime order counts, total spend, and order history.
- [x] **PASS**: Guest patrons can place orders without mandatory account registration.
- [x] **PASS**: Customer telephone numbers and email addresses are masked server-side for privacy.

## 15. Reviews & Feedback Moderation
- [x] **PASS**: 1–5 star customer reviews link to verified orders and store locations.
- [x] **PASS**: Moderation workflow supports `PENDING`, `PUBLISHED`, `HIDDEN`, and `RESOLVED` states.
- [x] **PASS**: Customer comments cannot be altered by staff members during moderation.

## 16. In-App Notifications & Alerts
- [x] **PASS**: Low-stock alerts evaluate dynamically and target authorized store managers.
- [x] **PASS**: Deterministic deduplication key prevents notification spam on page reload.
- [x] **PASS**: Resolving operational issues (restocking inventory, approving expenses) automatically dismisses pending notifications.

## 17. Executive Dashboard & Overview
- [x] **PASS**: Cross-branch revenue, order volume, and operating result rollup for Owner and Admin roles.
- [x] **PASS**: Manager views are strictly scoped to their assigned branch.
- [x] **PASS**: Safe division safeguards prevent `NaN` and `Infinity` errors on baseline deltas.

## 18. Reports & Analytics
- [x] **PASS**: All 14 reports (`sales`, `orders`, `products`, `branches`, `payments`, `expenses`, `inventory`, `purchases`, `wastage`, `attendance`, `compensation`, `customers`, `reviews`, `profit-loss`) calculate from source-of-truth tables.
- [x] **PASS**: Manager tamper resistance blocks unauthorized cross-branch report generation.
- [x] **PASS**: Print styles format cleanly for PDF generation.

## 19. CSV Export Engine
- [x] **PASS**: Exports conform strictly to RFC-4180 standards.
- [x] **PASS**: Active UI filters and branch boundaries are maintained in exported spreadsheets.
- [x] **PASS**: Password hashes, tokens, and unauthorized financial columns are omitted.

## 20. Append-Only Audit Logging
- [x] **PASS**: System activity logs record actor ID, email, role, action, timestamp, and branch.
- [x] **PASS**: Sensitive data sanitizer strips credentials and tokens before persistence.
- [x] **PASS**: Audit tables are immutable with zero update or delete APIs exposed.

## 21. System Settings & Configuration
- [x] **PASS**: Two-tier resolution functions with global fallback and branch overrides.
- [x] **PASS**: Out-of-bounds numbers and unknown keys are rejected by validation schemas.
- [x] **PASS**: Setting updates and resets record formal audit records.

## 22. Multi-Branch Isolation & IDOR Defense
- [x] **PASS**: Branch A staff cannot view, edit, or delete Branch B records.
- [x] **PASS**: URL parameter tampering (substituting another branch's ID) is neutralized by server-side scoping.
- [x] **PASS**: Direct entity ID lookups verify branch affiliation before granting access.

## 23. Deployment & Production Verification
- [x] **PASS**: TypeScript static type checks pass with 0 errors (`npx tsc --noEmit`).
- [x] **PASS**: ESLint code quality checks pass with 0 errors and 0 warnings (`npm run lint`).
- [x] **PASS**: Next.js production build succeeds across all 52 static and dynamic routes in 764ms (`npm run build`).

---

**Sign-off Status:** ALL 23 SECTIONS PASSED. Accepted for production launch.
