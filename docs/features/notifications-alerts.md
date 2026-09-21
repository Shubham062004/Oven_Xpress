# Feature Documentation: Notifications & Alerts (Step 16)

## 1. Overview & Architecture

The **Notifications & Alerts** feature provides a production-grade, in-app notification and operational alert system for the Oven Xpress multi-branch restaurant platform. It enables managers, administrators, and owners to maintain total visibility over time-sensitive operational conditions across permitted restaurant branches.

### Core Distinctions
- **Business Alert**: An operational condition detected by the system (e.g., ingredient stock falling at/below reorder thresholds, unapproved expenses, pending salary records, or failed payment transactions).
- **Notification**: A user-targeted, in-app record generated from an alert or operational event, scoped by user permissions and branch authorization.

### Architectural Principles
1. **In-App Only**: No external notification services (email, SMS, WhatsApp, or browser push) are used.
2. **No Heavy Infrastructure**: Operates directly on top of PostgreSQL and existing Prisma transaction models without requiring Redis, Kafka, or background cron daemons.
3. **Deterministic Deduplication**: Uses a compound unique deduplication key (`dedupeKey`) combining `${recipientUserId}:${type}:${branchId}:${entityType}:${entityId}` to guarantee that repeated page loads, dashboard visits, and alert evaluations never produce duplicate messages.
4. **State-Aware Auto-Resolution**: When underlying operational records resolve (e.g., an expense is approved/rejected, stock is replenished above reorder levels, or an order is paid in full), pending notifications are automatically cleared/dismissed.

---

## 2. Database Schema

### `Notification` Model
```prisma
model Notification {
  id              String               @id @default(cuid())
  recipientUserId String
  recipient       User                 @relation(fields: [recipientUserId], references: [id], onDelete: Cascade)
  branchId        String?
  branch          Branch?              @relation(fields: [branchId], references: [id], onDelete: Cascade)
  type            NotificationType
  severity        NotificationSeverity @default(INFO)
  title           String
  message         String
  entityType      String?              // 'InventoryItem', 'Expense', 'SalaryRecord', 'Bonus', 'Payment', 'Order', 'StockTransaction'
  entityId        String?
  actionUrl       String?
  isRead          Boolean              @default(false)
  readAt          DateTime?
  isDismissed     Boolean              @default(false)
  dismissedAt     DateTime?
  dedupeKey       String?
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  @@index([recipientUserId])
  @@index([branchId])
  @@index([isRead])
  @@index([createdAt])
  @@index([type])
  @@index([dedupeKey])
  @@index([recipientUserId, isRead, isDismissed])
}
```

### Supported Enums
- **`NotificationType`**:
  - `LOW_STOCK`
  - `OUT_OF_STOCK`
  - `STOCK_VARIANCE`
  - `HIGH_WASTAGE`
  - `PENDING_EXPENSE_APPROVAL`
  - `PENDING_BONUS_APPROVAL`
  - `PENDING_SALARY_REVIEW`
  - `FAILED_PAYMENT`
  - `UNPAID_ORDER`
  - `ATTENDANCE_ALERT`
  - `OPERATIONAL_EXCEPTION`
- **`NotificationSeverity`**:
  - `INFO` (Neutral operational information)
  - `WARNING` (Urgent attention recommended, e.g. low stock, pending expense approval)
  - `CRITICAL` (Immediate operational risk, e.g. out of stock, payment failure)

---

## 3. Recipient Resolution & Security Matrix

Notifications are strictly permission-aware and branch-scoped server-side:

| Notification Type | Required Permission | Recipient Eligibility & Branch Scope |
| :--- | :--- | :--- |
| `LOW_STOCK` | `inventory.read` | Owner/Admin (all branches), Managers & Staff (assigned branch only) |
| `OUT_OF_STOCK` | `inventory.read` | Owner/Admin (all branches), Managers & Staff (assigned branch only) |
| `STOCK_VARIANCE` | `inventory.reconcile` | Owner/Admin (all branches), Managers (assigned branch only) |
| `HIGH_WASTAGE` | `inventory.wastage` | Owner/Admin (all branches), Managers (assigned branch only) |
| `PENDING_EXPENSE_APPROVAL`| `expense.approve` | Owner/Admin (all branches), Managers (assigned branch only) |
| `PENDING_BONUS_APPROVAL` | `bonus.approve` | Owner/Admin only (all branches) |
| `PENDING_SALARY_REVIEW` | `salary.approve` | Owner/Admin only (all branches) |
| `FAILED_PAYMENT` | `payment.read` | Owner/Admin (all branches), Managers & Staff (assigned branch only) |
| `UNPAID_ORDER` | `order.read` | Owner/Admin (all branches), Managers & Staff (assigned branch only) |
| `ATTENDANCE_ALERT` | `attendance.read` | Owner/Admin (all branches), Managers (assigned branch only) |

### Authorization Guards
- **Server-Side Enforcement**: All queries and mutations in `actions.ts` authenticate the caller and verify RBAC permissions.
- **No Financial Leakage**: Sensitive compensation and expense approval alerts are never routed to unauthorized staff.
- **Branch Isolation**: Managers and staff never receive or view notifications from other branches.

---

## 4. Deduplication & State-Aware Resolution

### Deterministic Key Formula
```
dedupeKey = `${recipientUserId}:${type}:${branchId || 'global'}:${entityType || ''}:${entityId || ''}`
```
- When `createNotification` is invoked, the database is queried for an existing record with `dedupeKey` where `isDismissed: false`.
- If an active record exists, creation is aborted (`null` returned).
- Repeated alert evaluations on dashboard or `/notifications` page access are completely idempotent (0 duplicate notifications generated).

### Auto-Resolution
When an underlying entity transitions to a terminal state (e.g., an Expense is approved or rejected, an Order is paid, or an Inventory item is restocked above reorder level), `resolveNotificationsForEntity(entityType, entityId)` marks existing pending notifications as dismissed (`isDismissed: true`, `dismissedAt: now()`).

---

## 5. User Interface Components

### 1. Header Notification Bell (`src/components/notifications/notification-bell.tsx`)
- Placed in the authenticated header.
- Displays live unread count badge.
- Dropdown menu lists recent 5 notifications with severity icons, relative timestamps, and branch tags.
- Direct "Mark as read" and "Mark all read" controls.
- Direct link to full Notification Center (`/notifications`).

### 2. Dashboard Alert Widget (`src/components/notifications/dashboard-alert-widget.tsx`)
- Compact widget embedded directly into the primary dashboard (`/`).
- Shows Critical, Warning, and Unread KPI counts.
- Lists active operational bottlenecks (out-of-stock items, pending expense reviews, failed transactions).
- "Run Alert Check" button for instant on-demand scan.
- Direct "Open" deep links to source records.

### 3. Notification Center (`/notifications`)
- Complete management interface at `/notifications`.
- Status filter tabs: `All`, `Unread`, `Read`, `Dismissed History`.
- Severity filter (`All`, `Critical`, `Warning`, `Info`).
- Category filter across all notification types.
- Branch filter for multi-branch administrators.
- Search input across titles and message bodies.
- Pagination controls with responsive loading and empty states.

---

## 6. Verification & Testing

The system has been verified through automated database testing (`scripts/verify-notifications.ts`) and static analysis:
- **`npx tsc --noEmit`**: Type checking clean (0 errors).
- **`npx tsx scripts/verify-notifications.ts`**: All 10 automated test suites passed:
  1. Owner global branch scope resolution.
  2. Permission-aware recipient resolution (`INVENTORY_READ`).
  3. Single notification creation with compound deduplication key.
  4. Duplicate prevention (re-executing creation returns `null`).
  5. Unread count increments and decrements correctly.
  6. Marking as read updates `isRead` and decrements unread counter.
  7. Auto-resolution on entity state changes.
  8. Batch creation for multiple eligible users.
  9. Full alert evaluation across inventory, expenses, salaries, payments, and orders.
  10. **Idempotent alert evaluation**: Repeat scan creates exactly 0 duplicate notifications.
