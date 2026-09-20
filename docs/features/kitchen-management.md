# Kitchen Display System (KDS) & Order Preparation Workflow

## Purpose

The Kitchen Display System (KDS) & Order Preparation Workflow module delivers a dedicated, high-contrast, real-time operational interface (`/kitchen`) for food preparation in Oven Xpress branches. It bridges customer orders to operational food assembly and the inventory BOM (Bill of Materials) engine, executing atomic stock consumption, tracking operational timestamps, and enforcing strict multi-branch authorization.

---

## Operational Workflow

```
             ┌─────────────────────────────────────────────────────────┐
             │                ORDER CREATION (POS / Online)            │
             │           Status: CONFIRMED  (Inventory NOT deducted)    │
             └───────────────────────────┬─────────────────────────────┘
                                         │
                                         ▼
             ┌─────────────────────────────────────────────────────────┐
             │                     /kitchen KDS                        │
             │                   Column 1: NEW ORDERS                  │
             │       Staff clicks "Start Preparing" (kitchen.start)    │
             └───────────────────────────┬─────────────────────────────┘
                                         │
                                         ▼
            [ Pre-check: Recipe validation & Branch Stock Availability ]
                    │                                     │
           (Stock Shortage)                              (Sufficient Stock)
                    │                                     │
                    ▼                                     ▼
        Abort transaction with structured      [ Atomic Prisma Transaction ]
        shortage details:                      ├─ Update status to PREPARING
        - Required vs Available qty            ├─ Set preparingAt = now()
        - Does NOT deduct partial stock        ├─ Set preparedBy = userId
        - Does NOT cancel order                ├─ Deduct: OrderItem.qty × RecipeIngredient.qty
                                               ├─ Create StockTransaction (type: CONSUMPTION)
                                               ├─ Set inventoryConsumed = true
                                               ├─ Set inventoryConsumedAt = now()
                                               └─ Record OrderAuditLog entry
                                                         │
                                                         ▼
             ┌─────────────────────────────────────────────────────────┐
             │                  Column 2: IN PREPARATION               │
             │         Live elapsed prep timer vs target prep time     │
             │           Staff clicks "Mark Ready" (kitchen.ready)     │
             └───────────────────────────┬─────────────────────────────┘
                                         │
                                         ▼
             ┌─────────────────────────────────────────────────────────┐
             │                Column 3: READY FOR SERVICE              │
             │          Status: READY, readyAt & readyBy recorded      │
             │    Authorized staff clicks "Complete" (kitchen.complete)│
             └───────────────────────────┬─────────────────────────────┘
                                         │
                                         ▼
                               Status: COMPLETED
                 (Table freed to CLEANING state for Dine-In)
```

---

## Key Principles & System Rules

1. **Separation of Concerns**:
   The kitchen workflow is focused purely on order assembly and food preparation. It is **not** responsible for payment processing, reconciliation, customer loyalty, driver GPS tracking, or supplier procurement.

2. **Late Inventory Deduction**:
   Inventory is **never** deducted when an order is created or confirmed. Deductions happen exclusively upon moving an order to `PREPARING` ("Start Preparing").

3. **Atomic Stock Consumption**:
   When preparation begins, every ordered item's active recipe is resolved.
   All ingredients are multiplied by `OrderItem.quantity` and converted to the ingredient's registered base unit (`KG`, `GRAM`, `LITRE`, `ML`, `PIECE`, `DOZEN`).
   Stock availability across all required ingredients at the order's branch is checked inside an atomic Prisma transaction. If **any** single ingredient has insufficient balance, the entire operation is aborted without partial deductions.

4. **Idempotency & Double-Consumption Prevention**:
   Network retries, page refreshes, and concurrent clicks will never deduct inventory twice. An explicit idempotency flag (`order.inventoryConsumed`) and unique consumption reference tags (`referenceId: orderId`) safeguard the stock ledger.

5. **Missing Recipe Handling**:
   If an ordered menu item lacks an active recipe/BOM, the KDS displays a visual "No BOM" indicator and allows preparation without guessing or inventing phantom stock deductions.

6. **Chronological Urgency Ordering**:
   Active kitchen queues are sorted by `createdAt: asc` (oldest active order first) with secondary deterministic sorting on `orderNumber: asc`.

---

## User Roles & Permissions

Granular permissions under the `kitchen.*` namespace:

| Permission | Code | OWNER | ADMIN | MANAGER | STAFF |
|------------|------|:-----:|:-----:|:-------:|:-----:|
| View KDS queue | `kitchen.read` | ✅ | ✅ | ✅ | ✅ |
| Start order preparation & deduct stock | `kitchen.start` | ✅ | ✅ | ✅ | ✅ |
| Mark order ready for pickup/service | `kitchen.ready` | ✅ | ✅ | ✅ | ✅ |
| Mark ready order completed | `kitchen.complete` | ✅ | ✅ | ✅ | ❌ |

### Branch Scoping Rule
- `MANAGER` and `STAFF` are strictly isolated to their assigned branch (`employee.branchId`). They cannot retrieve, view, or mutate orders for any other branch.
- Every Server Action validates branch ownership server-side before executing queries or mutations:
  `Authentication → Permission → Branch Access Check → Validation → Database Transaction`.

---

## Schema Extensions

### `Order`
Extended with operational timestamps and kitchen audit tracking:
- `confirmedAt DateTime?`
- `preparingAt DateTime?`
- `readyAt DateTime?`
- `completedAt DateTime?`
- `preparedBy String?`
- `readyBy String?`
- `completedBy String?`
- `inventoryConsumed Boolean @default(false)`
- `inventoryConsumedAt DateTime?`
- Composite Indexes:
  - `[branchId, status]`
  - `[status, createdAt]`
  - `[branchId, createdAt]`

### `OrderAuditLog`
Dedicated append-only log capturing all status transitions:
- `id String @id @default(cuid())`
- `orderId String`
- `fromStatus OrderStatus`
- `toStatus OrderStatus`
- `performedBy String`
- `userId String?`
- `notes String?`
- `metadata Json?`
- `createdAt DateTime @default(now())`

---

## UI Components & Design System

- **Dedicated KDS Interface**: Hosted at `/kitchen` with a focused, dark-mode/high-contrast display optimized for kitchen tablet and desktop displays.
- **Top Bar**: Branch selector (for multi-branch admins), order type filter (Dine-In, Takeaway, Delivery), real-time 15s auto-refresh countdown with pause toggle, manual sync button, fullscreen toggle, operator info, and quick exit/logout.
- **Order Cards**:
  - Prominent order number and type badge.
  - Contextual details (Table number for Dine-In, pickup context for Takeaway, delivery marker for Delivery).
  - Bold, prominent item quantities (`[ 2× ]`).
  - Item preparation notes and order-level instructions.
  - Live elapsed time ticker and prep-duration indicators.
  - Action buttons with loading spinners and disabled state while mutations run.
- **Insufficient Stock Modal**: High-contrast dialog displaying the required quantity vs available branch stock when shortages prevent preparation from starting.
