# Customer Management, Reviews & Operational Feedback

## Purpose

The Customer Management, Reviews & Operational Feedback module delivers a comprehensive relationship, quality assurance, and guest feedback management architecture for the Oven Xpress multi-branch bakery platform. It provides persistent customer history without forcing guest accounts, derives lifetime order and spend analytics from existing transaction records, enables audited review moderation (1–5 stars) without staff altering customer words, tracks operational complaints across a strict lifecycle with mandatory resolution notes and branch isolation, and delivers real-time satisfaction dashboards with star distributions.

> [!NOTE]
> In accordance with system scope boundaries, loyalty tiers, membership points, customer wallets, marketing campaigns, SMS/email notifications, and automated AI sentiment parsing are explicitly excluded from this operational release.

---

## Architecture & Data Flow

```
                                  ┌───────────────────────────────┐
                                  │            Customer           │
                                  │  - name, phone, email, status │
                                  │  - notes, address             │
                                  └───────┬──────────────┬────────┘
                                          │ 1            │ 1
                                          │ *            │ *
                          ┌───────────────▼─┐    ┌───────▼───────────────┐
                          │      Order      │    │     CustomerIssue     │
                          │ - orderNumber   │    │ - ISS-YYYY-000001     │
                          │ - totalAmount   │    │ - type, priority      │
                          │ - payments      │    │ - assignedTo (branch) │
                          └───────┬─────────┘    │ - status & notes      │
                                  │ 1            └───────┬───────────────┘
                                  │ *                    │ 1
                          ┌───────▼────────────────┐     │ *
                          │         Review         │ ┌───▼────────────────────────┐
                          │ - rating (1–5)         │ │   CustomerIssueAuditLog    │
                          │ - title & comment      │ │ - action, status transition│
                          │ - status (moderation)  │ │ - performedBy, timestamp   │
                          └────────────────────────┘ └────────────────────────────┘
```

### Key Architectural Principles:

1. **Persistent Customer Identity without Mandatory Logins**:
   Customers do not require system authentication or passwords to be registered. Guest orders remain fully supported, and guest patrons can submit dining reviews and report issues.

2. **Derived Financial Metrics (Zero Duplication)**:
   Customer lifetime statistics (`totalOrders`, `totalSpend`, `averageOrderValue`, `lastOrderDate`) are derived directly from primary order and payment records (`Order`, `Payment`). Historical order totals are preserved as executed; they are never recalculated using current menu prices. Failed payments and cancelled orders are excluded from settled spend.

3. **Non-Destructive Deactivation**:
   Customers can be transitioned between `ACTIVE` and `INACTIVE` statuses. Deactivating a customer profile never deletes historical orders, payments, reviews, or logged issues. Historical accounting and quality data remain permanently preserved.

4. **Integrity-Preserving Review Moderation**:
   Reviews record ratings from 1 to 5 stars along with optional headlines and commentary (rating-only feedback is fully supported). Restaurant staff cannot silently edit or rewrite customer words. Moderation is conducted solely via status transitions:
   - `PENDING`: Awaiting staff verification.
   - `PUBLISHED`: Verified and visible on store dashboards.
   - `HIDDEN`: Suppressed from public dashboards for offensive or spam content.
   - `RESOLVED`: Handled and remediated with the patron.

5. **Separation of Feedback & Operational Incidents**:
   Customer reviews reflect dining perception, while operational complaints (`CustomerIssue`) track internal incidents across standard categories (`FOOD_QUALITY`, `WRONG_ORDER`, `MISSING_ITEM`, `LATE_ORDER`, `PAYMENT`, `STAFF_SERVICE`, `CLEANLINESS`, `DELIVERY`, `OTHER`). Complaints follow an audited lifecycle:
   $$\text{OPEN} \longrightarrow \text{IN\_PROGRESS} \longrightarrow \text{RESOLVED} \longrightarrow \text{CLOSED}$$
   A mandatory resolution note is legally audited and required before marking any issue `RESOLVED`.

6. **Strict Branch Security & Tenant Isolation**:
   Every database query and mutation enforces the pipeline:
   $$\text{Authentication} \longrightarrow \text{Permission} \longrightarrow \text{Branch Access} \longrightarrow \text{Validation} \longrightarrow \text{Database}$$
   - When assigning issues, the assigned employee's branch must strictly match the issue's branch (`assignedStaff.branchId === issue.branchId`). Cross-branch assignment is rejected server-side.
   - Staff assignment queries explicitly exclude all compensation and payroll fields.

7. **Customer Privacy Masking**:
   Customer phone numbers, emails, and physical delivery addresses are masked (`+91 987*** **** 3210`, `jo***@example.com`) in directory listings and feedback summaries to prevent data exposure to unauthorized users.

---

## User Roles & Permissions

This module introduces 11 granular permissions integrated into the existing Oven Xpress RBAC matrix:

| Permission | Code | OWNER | ADMIN | MANAGER | STAFF |
|------------|------|:-----:|:-----:|:-------:|:-----:|
| View customer profiles & history | `customer.read` | ✅ | ✅ | ✅ (Branch) | ✅ (Branch) |
| Register customer profile | `customer.create` | ✅ | ✅ | ✅ (Branch) | ✅ (Branch) |
| Update customer profile | `customer.update` | ✅ | ✅ | ✅ (Branch) | ❌ |
| Deactivate customer profile | `customer.deactivate` | ✅ | ✅ | ❌ | ❌ |
| View reviews & feedback dashboards | `review.read` | ✅ | ✅ | ✅ (Branch) | ✅ (Branch) |
| Moderate review status (publish/hide) | `review.moderate` | ✅ | ✅ | ✅ (Branch) | ❌ |
| View operational complaint tickets | `issue.read` | ✅ | ✅ | ✅ (Branch) | ✅ (Branch) |
| Log customer complaint/issue | `issue.create` | ✅ | ✅ | ✅ (Branch) | ✅ (Branch) |
| Update issue details/priority | `issue.update` | ✅ | ✅ | ✅ (Branch) | ❌ |
| Assign issue to branch staff | `issue.assign` | ✅ | ✅ | ✅ (Branch) | ❌ |
| Resolve issue (mandatory note) | `issue.resolve` | ✅ | ✅ | ✅ (Branch) | ❌ |

---

## Data Models

### `Customer`
- `id`: CUID identifier
- `name`: String (2–100 characters)
- `phone`: String nullable, indexed
- `email`: String nullable, indexed
- `address`: String nullable
- `notes`: String nullable
- `status`: `CustomerStatus` (`ACTIVE` | `INACTIVE`)
- `createdAt` & `updatedAt`: Timestamps

### `Review`
- `id`: CUID identifier
- `customerId`: References `Customer.id` (nullable for guest patrons)
- `orderId`: References `Order.id` (nullable for general walk-in reviews)
- `branchId`: References `Branch.id`
- `menuItemId`: References `MenuItem.id` (optional product-level association)
- `rating`: Integer (1 to 5, validated server-side)
- `title`: String nullable (max 100 characters)
- `comment`: String nullable (max 1000 characters)
- `status`: `ReviewStatus` (`PENDING` | `PUBLISHED` | `HIDDEN` | `RESOLVED`)
- `moderatedBy`: User identifier
- `moderatedAt`: Timestamp
- `notes`: Moderation audit remarks

### `CustomerIssue`
- `id`: CUID identifier
- `issueNumber`: Unique sequential ticket code (`ISS-YYYY-000001`)
- `customerId`: References `Customer.id` (nullable)
- `orderId`: References `Order.id` (nullable)
- `branchId`: References `Branch.id`
- `type`: `IssueType` (`FOOD_QUALITY`, `WRONG_ORDER`, `MISSING_ITEM`, `LATE_ORDER`, `PAYMENT`, `STAFF_SERVICE`, `CLEANLINESS`, `DELIVERY`, `OTHER`)
- `priority`: `IssuePriority` (`LOW`, `MEDIUM`, `HIGH`, `URGENT`)
- `description`: String (5–2000 characters)
- `status`: `IssueStatus` (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `CANCELLED`)
- `assignedTo`: References `Employee.id` (must match `issue.branchId`)
- `resolutionNote`: String nullable (mandatory upon status `RESOLVED`)
- `createdBy`: User identifier
- `resolvedBy`: User identifier
- `resolvedAt`: Timestamp

### `CustomerIssueAuditLog`
- `id`: CUID identifier
- `issueId`: References `CustomerIssue.id`
- `action`: String (e.g. `STATUS_CHANGE`, `ASSIGNED`, `RESOLVED`)
- `fromStatus` & `toStatus`: `IssueStatus` nullable
- `performedBy`: User identifier
- `notes`: String nullable

---

## User Interfaces

### 1. Customer Directory (`/customers`)
- **KPI Summary Cards**: Total customer profiles, active profiles on page, total historical orders, and aggregated settled spend in INR.
- **Search & Filters**: Search by name, phone, or email. Filter by branch and active/inactive status.
- **Paginated Table**: Customer profile, masked phone, email, total orders, total spend, last order date, status badges, and action buttons.
- **Customer Modal Dialog**: Add or edit customer profiles with name, contact info, delivery address, and food allergy/special preference notes.

### 2. Customer Detail & History (`/customers/[id]`)
- **Profile Card**: Full contact details, delivery address, account status, and preference notes.
- **Order KPIs**: Total orders, completed orders, cancelled orders, total spend, average order value (AOV), and last order timestamp.
- **Tabs**:
  1. *Historical Orders*: Complete order records with order numbers, branches, order types, historical totals, and statuses. Direct action buttons to submit reviews or log complaints for specific orders.
  2. *Reviews & Feedback*: List of customer star ratings, comments, linked order numbers, and moderation statuses.
  3. *Customer Issues*: Incident tickets logged for this patron with status progression, priority badges, assigned staff, and resolution audit notes.

### 3. Review Moderation (`/reviews`)
- **Summary Metrics**: Total reviews, average rating (1–5 stars), pending reviews queue, and published count.
- **Filters & Search**: Filter by rating (1★ to 5★), moderation status (`PENDING`, `PUBLISHED`, `HIDDEN`, `RESOLVED`), and branch. Search by customer name, order number, or comment text.
- **Moderation Actions**: One-click actions to `Publish`, `Hide`, or `Resolve` reviews.
- **Feedback Submission Modal**: Interactive 5-star rating selector with optional headlines and comments.

### 4. Feedback & Quality Dashboard (`/feedback`)
- **Executive Metrics**: Total reviews, average rating out of 5.00, pending review queue, open operational issues, and resolved tickets.
- **Star Rating Distribution**: Interactive visual breakdown of 1★, 2★, 3★, 4★, and 5★ reviews with percentage bars.
- **Recent Customer Reviews Stream**: Live feed of incoming guest and customer reviews with branch tags and star ratings.
- **Active Operational Issues Queue**: Live ticket board showing unresolved incidents with one-click dialogs to assign branch staff, update status, and record audited resolution notes.
- **Branch Quality & Sentiment Comparison**: Comparative table across branches showing review volume, average rating, star distributions, open issues, and resolved tickets.
