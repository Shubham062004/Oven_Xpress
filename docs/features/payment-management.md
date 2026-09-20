# Payments & Payment Reconciliation

## Purpose

The Payments & Payment Reconciliation module provides an immutable, audit-trailed payment ledger decoupled from order records in Oven Xpress. It enables multi-branch restaurant operators to process multi-tender transactions (CASH, UPI, CARD, ONLINE, OTHER), support split or partial payments without mutating core order states, execute controlled refunds with strict role-based authorization, preserve failed payment attempts without corrupting paid balances, and conduct daily physical cash drawer reconciliations against point-of-sale system totals.

---

## Architecture & Data Flow

```
                                  ┌───────────────────────────────┐
                                  │      Order (Kitchen/POS)      │
                                  │  - totalAmount, status, branch│
                                  └──────────────┬────────────────┘
                                                 │ 1
                                                 │
                                                 │ *
                                  ┌──────────────▼────────────────┐
                                  │            Payment            │
                                  │  - paymentNumber (PAY-YYYY-*) │
                                  │  - method (CASH, UPI, CARD...)│
                                  │  - status (SUCCESS, FAILED...)│
                                  │  - amount, referenceNumber    │
                                  └───────┬──────────────┬────────┘
                                          │ 1            │ 1
                                          │ *            │ *
                          ┌───────────────▼─┐    ┌───────▼───────────────┐
                          │  PaymentRefund  │    │   PaymentAuditLog     │
                          │  - refundNumber │    │   - action, diff      │
                          │  - amount, reason│   │   - actor, timestamp  │
                          └─────────────────┘    └───────────────────────┘

                ┌─────────────────────────────────────────────────────────┐
                │          PaymentReconciliation (Daily Ledger)           │
                │  - branchId, date, systemCash, actualCash, variance     │
                │  - tenderBreakdown (JSON), status, note, reconciledBy   │
                └─────────────────────────────────────────────────────────┘
```

### Key Architectural Principles:

1. **Decoupled Payment Ledger**: The `Payment` entity exists independently of the `Order` entity. An order does not simply hold a single payment method string; instead, multiple payments (e.g. split cash + UPI) can be attached to a single order.
2. **Order State Independence**: Recording a successful payment does not automatically transition an order to `COMPLETED`. An order's operational status (`PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `SERVED`) remains governed by the physical kitchen and dining workflow.
3. **Derived Order Payment State**: The order's financial condition is deterministically derived from all attached non-failed payments and non-failed refunds:
   - `UNPAID`: Zero successful payments recorded.
   - `PARTIALLY_PAID`: Net paid is greater than zero but less than order total.
   - `PAID`: Net paid equals order total (within a 1-cent threshold).
   - `PARTIALLY_REFUNDED`: Total refunds greater than zero but less than total paid.
   - `REFUNDED`: Total refunds equal or exceed total paid.
4. **Concurrency-Safe Sequence Generation**: Payment numbers (`PAY-YYYY-000001`) and Refund numbers (`REF-YYYY-000001`) are generated server-side using PostgreSQL transaction-level advisory locks (`pg_advisory_xact_lock`), eliminating race conditions under concurrent checkouts.
5. **Strict Overpayment Rejection**: Every payment transaction re-reads current successful payments inside an atomic `$transaction` to ensure `existingPaid + newAmount <= orderTotal`. Any attempt to overpay is rejected with an operational error.
6. **Failed Payment Preservation**: When a payment fails (e.g. UPI timeout or card decline), the transaction is preserved in the ledger with status `FAILED` and recorded in audit logs. It contributes ₹0 to the order's net paid total while maintaining full audit visibility.
7. **Strict Refund Governance**: Refunds can only be issued against `SUCCESS` payments and are capped at `payment.amount - existingRefunds`. Permissions to issue refunds (`payment.refund`) are strictly restricted to `OWNER` and `ADMIN` roles.
8. **Neutral Daily Reconciliation**: The daily cash reconciliation module computes `Variance = Actual Cash - System Cash`. Differences are presented objectively without automated presumption of theft or error, capturing manager explanations in permanent audit records.

---

## User Roles & Permissions

This module introduces 6 dedicated permissions under the `payment.*` namespace:

| Permission | Code | OWNER | ADMIN | MANAGER | STAFF |
|------------|------|:-----:|:-----:|:-------:|:-----:|
| View payments & ledgers | `payment.read` | ✅ | ✅ | ✅ | ✅ |
| Record new payment | `payment.create` | ✅ | ✅ | ✅ | ✅ |
| Update payment details/notes | `payment.update` | ✅ | ✅ | ✅ | ❌ |
| Process payment refund | `payment.refund` | ✅ | ✅ | ❌ | ❌ |
| Perform daily tender reconciliation | `payment.reconcile` | ✅ | ✅ | ✅* | ❌ |
| Cancel pending payment attempt | `payment.cancel` | ✅ | ✅ | ✅ | ❌ |

*\*Branch Scoping Rule*: `MANAGER` and `STAFF` operate strictly within their assigned branch (`employee.branchId`). `OWNER` and `ADMIN` hold cross-branch authority.

---

## Centralized Tender Methods

Oven Xpress standardizes payment methods across all point-of-sale interfaces:

| Method | Enum Key | Description & Audit Requirements |
|--------|----------|-----------------------------------|
| **Cash** | `CASH` | Physical currency. Reconciled daily against physical cash drawer counts. |
| **UPI** | `UPI` | Unified Payments Interface / QR code payments. Requires optional transaction ID/UTR. |
| **Card** | `CARD` | POS terminal card payments (debit/credit). Requires optional terminal slip/batch ref. |
| **Online** | `ONLINE` | Web or external aggregator payments. Stores external checkout payment ref. |
| **Other** | `OTHER` | Vouchers, food coupons, custom payment instruments with explanatory notes. |

---

## Data Models

### Payment
- `id`: String (cuid)
- `paymentNumber`: String (e.g., `PAY-2026-000001`, unique)
- `orderId`: String (foreign key to `Order`)
- `branchId`: String (foreign key to `Branch`)
- `amount`: Float (monetary amount)
- `method`: PaymentMethod enum (`CASH`, `UPI`, `CARD`, `ONLINE`, `OTHER`)
- `status`: PaymentStatus enum (`PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`, `REFUNDED`, `PARTIALLY_REFUNDED`)
- `referenceNumber`: String? (UPI UTR, card batch, or gateway ID)
- `notes`: String?
- `processedBy`: String (user ID of cashier/operator)
- `processedAt`: DateTime
- `refunds`: Relation to `PaymentRefund[]`
- `auditLogs`: Relation to `PaymentAuditLog[]`

### PaymentRefund
- `id`: String (cuid)
- `refundNumber`: String (e.g., `REF-2026-000001`, unique)
- `paymentId`: String (foreign key to `Payment`)
- `amount`: Float
- `reason`: String (customer complaint, kitchen cancellation, double charge)
- `status`: RefundStatus enum (`PENDING`, `COMPLETED`, `FAILED`)
- `processedBy`: String (must hold `payment.refund` permission)
- `processedAt`: DateTime

### PaymentReconciliation
- `id`: String (cuid)
- `branchId`: String (foreign key to `Branch`)
- `date`: DateTime (start of business day)
- `systemCash`: Float (aggregated successful cash minus cash refunds)
- `actualCash`: Float (physically counted in cash drawer)
- `variance`: Float (`actualCash - systemCash`)
- `tenderBreakdown`: Json (snapshot of all tender method totals)
- `status`: ReconciliationStatus enum (`BALANCED`, `SURPLUS`, `SHORTFALL`)
- `note`: String? (drawer opening balance, petty cash explanations)
- `reconciledBy`: String
- `reconciledAt`: DateTime
- `@@unique([branchId, date])`: One formal reconciliation record per branch per day

---

## User Interfaces

### 1. Payments Ledger Dashboard (`/payments`)
- **KPI Summary Cards**: Total Payments Processed, Total Revenue Collected, Cash Tender, UPI Tender, Card Tender, Total Refunds Issued, Unresolved Reconciliation Variances.
- **Filters & Search**: Multi-branch selector (scoped by role), date range presets, payment method dropdown, payment status filter, instant search by Payment #, Order #, or Reference #.
- **Desktop Table & Mobile Cards**: Method icons, status badges, order link, cashier badge, and direct receipt/refund action buttons.

### 2. Order Payment Ledger Integration (`/orders/[id]`)
- **Real-Time Payment Summary Banner**: Shows derived state (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`), Total Bill, Total Paid, Remaining Due, and Total Refunded.
- **Record Payment Modal**: Quick tender buttons (Full amount, Remaining balance), tender selector, reference input, and live overpayment guard.
- **Refund Modal**: Displays eligible refundable balance (`Original Payment - Existing Refunds`), enforces `payment.refund` permission, and captures audit reason.
- **Nested Ledger View**: Chronological ledger of all payment attempts including failed payments and nested refund entries.

### 3. Daily Tender & Cash Reconciliation (`/payments/reconciliation`)
- **Tender Breakdown Grid**: Summarizes system records for Cash, UPI, Card, Online, and Other tenders alongside total transactions and refund deductions.
- **Cash Drawer Reconciler**: Physical cash drawer input with live variance preview.
- **Objective Variance Presentation**:
  - `₹0.00 Difference`: Emerald "Balanced" badge.
  - `+₹X.XX Surplus`: Blue "Surplus difference" badge.
  - `-₹X.XX Shortfall`: Amber "Shortfall difference" badge.
- **Permanent History**: Log of past branch reconciliations with auditor details, variance values, and operational explanations.
