# Oven Xpress — Client Change Requests (CR) Register

This document formally records all feature requests, operational enhancements, and third-party integrations requested by client stakeholders during the Client User Acceptance Testing (Step 23) cycle.

Per project governance guidelines:
1. Enhancements and new capabilities are **NOT** silently implemented during production hardening.
2. Each request is evaluated for business ROI, operational risks, security implications, and schema modifications.
3. Requests are scheduled for post-launch roadmap releases once requirements are unambiguous and formally signed off.

---

## Change Request Index

| CR ID | Title | Priority | Target Release | Status |
|---|---|---|---|---|
| **CR-01** | Third-Party Courier & Aggregator Dispatch API Integration | Medium | v2.1.0 | Under Evaluation |
| **CR-02** | Automated Customer Loyalty Milestones & SMS Incentives | Medium | v2.1.0 | Scope Approved |
| **CR-03** | Scheduled Nightly PDF Executive Summary via WhatsApp/Email | High | v2.0.1 | Architecture Planned |

---

## Detailed Specifications

### CR-01: Third-Party Delivery Aggregator & Courier Dispatch Integration

- **Business Problem:**
  Currently, delivery orders capture customer phone numbers, delivery addresses, instructions, and delivery fees. Store staff manually assign in-house runners or copy customer addresses into external delivery apps (Dunzo, Porter, Swiggy Genie, Zomato Delivery Partner), leading to manual re-entry errors and delayed dispatch during peak dinner hours.

- **Requested Behavior:**
  Allow the store cashier or dispatcher to click "Dispatch via Partner" directly on an order card in the POS/KDS, automatically requesting a courier pickup with prefilled address and contact details, and receiving a live rider tracking link embedded into the order summary.

- **Users Affected:**
  - Cashiers, Kitchen Dispatchers, Store Managers, Customers (via SMS tracking link).

- **Branch Scope:**
  - Branch-configurable (branches with own delivery fleets can keep manual dispatch; urban branches can enable aggregator API).

- **Permissions Required:**
  - `orders:dispatch` or `orders:update` (Manager, Cashier).

- **Data Requirements:**
  - Integration table `CourierDispatch`: `orderId`, `courierPartner` (DUNZO | PORTER | SWIGGY | MANUAL), `trackingNumber`, `riderName`, `riderPhone`, `dispatchStatus` (REQUESTED, ASSIGNED, PICKED_UP, DELIVERED), `trackingUrl`, `cost`.
  - System Setting: `COURIER_API_KEY`, `COURIER_WEBHOOK_SECRET` (branch override supported).

- **Expected Workflow:**
  1. Cashier creates order with channel = `DELIVERY`, customer phone, and verified address.
  2. Kitchen transitions order to `READY`.
  3. Cashier clicks "Request Courier" on the order detail modal.
  4. Backend invokes aggregator webhook/API with branch pickup address and customer dropoff location.
  5. Aggregator responds with tracking code and estimated rider arrival time.
  6. Order status moves to `OUT_FOR_DELIVERY` upon rider pickup confirmation.

- **Acceptance Criteria:**
  - [ ] Validates delivery radius before dispatching courier request.
  - [ ] Inbound webhooks update order status atomically with idempotent signature checks.
  - [ ] Fails gracefully to manual assignment if aggregator API is unavailable or returns 5xx.
  - [ ] All dispatch events logged in `AuditLog` with actor ID and courier reference.

---

### CR-02: Automated Customer Loyalty Milestones & SMS Incentives

- **Business Problem:**
  The restaurant wants to incentivize repeat business and customer retention by acknowledging repeat patrons. Currently, the customer directory tracks lifetime orders and spend, but rewards require manual cashier discretion or external gift voucher printing.

- **Requested Behavior:**
  When a customer completes their 5th, 10th, or 25th order, the system should automatically generate a unique, single-use coupon code (e.g., 15% off next dine-in) and dispatch an automated SMS greeting to the customer's verified telephone number.

- **Users Affected:**
  - Customers, Cashiers, Marketing / Store Owners.

- **Branch Scope:**
  - Global loyalty program with cross-branch coupon redemption validity.

- **Permissions Required:**
  - Configuration: `settings:manage` (Owner only).
  - Redemption: `orders:apply_coupon` (Cashier, Manager).

- **Data Requirements:**
  - Table `LoyaltyReward`: `id`, `customerId`, `orderId`, `couponCode`, `discountType`, `discountValue`, `expiresAt`, `isRedeemed`, `redeemedAt`, `redeemedBranchId`.
  - Settings: `LOYALTY_SMS_ENABLED` (Boolean), `LOYALTY_TIER_INTERVALS` (e.g. `[5, 10, 25]`).

- **Expected Workflow:**
  1. Order payment is completed and marked `PAID`.
  2. System increments `customer.lifetimeOrders`.
  3. Event triggers loyalty evaluator: if lifetime order count equals milestone threshold, generate cryptographic random coupon.
  4. Dispatch SMS via registered SMS gateway (Twilio / Gupshup / MSG91).
  5. Upon subsequent visit, cashier enters coupon code during checkout; system validates expiration and single-use constraint.

- **Acceptance Criteria:**
  - [ ] Enforces single-use constraint (coupon cannot be applied to multiple orders simultaneously).
  - [ ] Masks customer phone numbers in transit and adheres to DND/telecom opt-out guidelines.
  - [ ] Customer order discount is accurately segregated from food subtotal in sales and tax reports.
  - [ ] Zero SMS sent if notification service fails; order completion must not fail or roll back due to SMS failure.

---

### CR-03: Scheduled Nightly PDF Executive Summary via WhatsApp/Email

- **Business Problem:**
  The restaurant owner operates multiple branches and does not want to log into the web portal late at night after store closure to check each location's sales, cash collections, and food wastage.

- **Requested Behavior:**
  Automatically generate a compiled multi-branch daily closing report at 11:30 PM local time and deliver a consolidated PDF summary directly to the Owner's registered WhatsApp and email inbox.

- **Users Affected:**
  - Restaurant Owner, General Manager.

- **Branch Scope:**
  - Global executive rollup including all active branches with per-branch breakdowns.

- **Permissions Required:**
  - System background cron job / worker service with privileged reporting scope.

- **Data Requirements:**
  - System Setting: `NIGHTLY_REPORT_TIME` (Default: "23:30"), `EXECUTIVE_NOTIFICATION_PHONE`, `EXECUTIVE_NOTIFICATION_EMAIL`.
  - Pre-generated PDF binary using the existing Next.js headless report rendering pipeline.

- **Expected Workflow:**
  1. Cron scheduler triggers at 23:30 daily.
  2. Worker queries daily sales, cash/card/UPI tender totals, discounts, refunds, employee attendance, and top 5 wastage items for each active branch.
  3. Worker compiles HTML template and renders single-page vector PDF.
  4. Worker attaches PDF and dispatches message via WhatsApp Business Cloud API and SendGrid/Postmark.
  5. Audit log records successful report generation and delivery status.

- **Acceptance Criteria:**
  - [ ] Report numbers must match the web UI Reports tab down to the exact rupee and cent.
  - [ ] Secure attachment delivery (no public, unauthenticated S3 bucket URLs).
  - [ ] Handles offline branches or zero-sale days without throwing exceptions.
  - [ ] Execution latency must complete within 60 seconds across 10+ branches.
