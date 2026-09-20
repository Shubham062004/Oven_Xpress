# Suppliers & Purchase Management

## Purpose

The Suppliers & Purchase Management module provides centralized vendor relationship tracking and a robust procurement lifecycle for Oven Xpress. It enables multi-branch restaurant owners and managers to maintain an independent master supplier catalog, create detailed purchase orders with server-calculated financial values, manage partial deliveries, and atomically record incoming stock directly into the double-entry style immutable inventory ledger (`StockTransaction`).

---

## Architecture & Data Flow

```
Supplier (Master Vendor Catalog) ──► PurchaseOrder (Scoped to Branch)
                                            │
                                            ├──► PurchaseOrderItem (Ordered Qty, Price, Unit)
                                            │
                                            └──► PurchaseReceiving (Batch Receiving Log)
                                                       │
                                                       ├──► PurchaseReceivingItem (Received Qty)
                                                       │
                                                       └──► StockTransaction (RECEIPT)
                                                                 │
                                                                 ▼
                                                    Inventory Ledger Update
                                                    (Dynamic Current Stock Increments)
```

### Key Architectural Principles:

1. **Supplier Independence (Master Entity)**: Suppliers are not owned by any single branch. A single vendor (e.g. *Metro Dairy & Cheese*) can supply multiple restaurant locations (Downtown, Bandra West, Andheri Hub) without duplicate records.
2. **Branch-Scoped Purchase Orders**: Every purchase order is strictly bound to a single receiving `Branch`. Managers are isolated to their assigned branch (`employee.branchId`), while Owners and Admins operate across all branches.
3. **Double-Entry Stock Ledger Integration**: The receiving workflow never directly alters arbitrary stock numbers on inventory records. Instead, receiving creates immutable `StockTransaction` entries of type `RECEIPT` with positive quantities, referencing the purchase order and receiving batch ID.
4. **Strict Non-Overdelivery Invariant**: Received quantities cannot exceed ordered quantities (`receivedQuantity + receivedNow <= orderedQuantity`). If an over-delivery occurs, it is rejected rather than silently creating unbudgeted inventory.
5. **Idempotent Atomic Transactions**: Receiving stock updates item received counts, records a `PurchaseReceiving` audit batch, upserts branch `InventoryItem` tracking, writes the `StockTransaction` receipt, and updates the purchase order status all within a single database transaction (`prisma.$transaction`).
6. **Server-Side Financial Authority**: Client-supplied line totals and order subtotals are never trusted. The server recalculates `lineTotal = orderedQuantity × unitPrice` and `purchaseSubtotal = sum(lineTotals)` on every write.

---

## User Roles & Permissions

This module extends the RBAC permission matrix with 9 granular permissions under `supplier.*` and `purchase.*`:

| Permission | Code | OWNER | ADMIN | MANAGER | STAFF |
|------------|------|:-----:|:-----:|:-------:|:-----:|
| View suppliers & details | `supplier.read` | ✅ | ✅ | ✅ | ✅ |
| Create new vendor | `supplier.create` | ✅ | ✅ | ✅ | ❌ |
| Update vendor details | `supplier.update` | ✅ | ✅ | ✅ | ❌ |
| Activate / deactivate vendor | `supplier.deactivate` | ✅ | ✅ | ❌ | ❌ |
| View purchase orders | `purchase.read` | ✅ | ✅ | ✅* | ✅* |
| Create purchase order | `purchase.create` | ✅ | ✅ | ✅* | ❌ |
| Update draft purchase order | `purchase.update` | ✅ | ✅ | ✅* | ❌ |
| Receive stock into inventory | `purchase.receive` | ✅ | ✅ | ✅* | ❌ |
| Cancel purchase order | `purchase.cancel` | ✅ | ✅ | ✅* | ❌ |

*\*Branch Scoping Rule*: `MANAGER` is strictly isolated to their assigned branch (`employee.branchId`). They cannot view, create, receive, or cancel purchase orders for other branches. `OWNER` and `ADMIN` can operate across all branches.

---

## Data Models

### Supplier
Represents an independent master vendor or distributor.

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `String (cuid)` | Auto | Primary key |
| `name` | `String` | Yes | Company or trade name |
| `contactPerson` | `String?` | No | Primary representative name |
| `phone` | `String?` | No | Validated phone number format |
| `email` | `String?` | No | Validated email address |
| `address` | `String?` | No | Street address |
| `city` | `String?` | No | Operational city |
| `state` | `String?` | No | State or province |
| `postalCode` | `String?` | No | Postal code / PIN |
| `notes` | `String?` | No | Internal notes, delivery schedules |
| `status` | `SupplierStatus` | Auto | `ACTIVE` (default) or `INACTIVE` |
| `createdAt` | `DateTime` | Auto | Creation timestamp |
| `updatedAt` | `DateTime` | Auto | Last modification timestamp |

**Constraints & Deletion Rule**:
- Suppliers referenced by purchase orders cannot be hard-deleted. Soft deactivation toggles `status: INACTIVE` to prevent future procurement while preserving complete financial and ledger history.

### PurchaseOrder
Represents a formal procurement contract with a supplier for a specific restaurant branch.

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `String (cuid)` | Auto | Primary key |
| `purchaseNumber` | `String` | Auto | Sequential identifier: `PO-YYYY-000001` (unique) |
| `supplierId` | `String` | Yes | References `Supplier(id)` |
| `branchId` | `String` | Yes | References `Branch(id)` |
| `status` | `PurchaseOrderStatus` | Auto | `DRAFT`, `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED` |
| `orderDate` | `DateTime` | Auto | Date order was issued |
| `expectedDate` | `DateTime?` | No | Expected arrival date |
| `notes` | `String?` | No | Delivery notes or special instructions |
| `createdBy` | `String` | Yes | User who authorized the order |
| `createdAt` | `DateTime` | Auto | Timestamp |
| `updatedAt` | `DateTime` | Auto | Timestamp |

### PurchaseOrderItem
Individual ingredient line item on a purchase order.

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `String (cuid)` | Auto | Primary key |
| `purchaseOrderId` | `String` | Yes | References `PurchaseOrder(id)` (Cascade delete on draft) |
| `ingredientId` | `String` | Yes | References `Ingredient(id)` |
| `orderedQuantity` | `Decimal(10,3)` | Yes | Strictly positive (> 0) |
| `unit` | `IngredientUnit` | Yes | Canonical unit matched to ingredient definition |
| `unitPrice` | `Decimal(10,2)` | Yes | Agreed purchase price per unit (>= 0) |
| `receivedQuantity` | `Decimal(10,3)` | Auto | Cumulative stock received to date (default: 0) |
| `createdAt` | `DateTime` | Auto | Timestamp |
| `updatedAt` | `DateTime` | Auto | Timestamp |

**Constraints**:
- `@@unique([purchaseOrderId, ingredientId])`: Prevents duplicate ingredient line items within the same order.

### PurchaseReceiving & PurchaseReceivingItem
Immutable audit log capturing physical goods arrival events.

| Model | Key Fields | Purpose |
|-------|------------|---------|
| `PurchaseReceiving` | `receivingNumber` (`RCV-PO-YYYY-000001-01`), `receivedBy`, `receivedAt`, `notes` | Records batch delivery timestamp, recipient, and notes |
| `PurchaseReceivingItem` | `purchaseOrderItemId`, `ingredientId`, `quantity`, `unit` | Specific ingredient amounts received in this batch |

---

## Purchase Lifecycle States

```
                 ┌──────────┐
                 │  DRAFT   │
                 └────┬─────┘
                      │ (mark as ordered)
                      ▼
                 ┌──────────┐
      ┌─────────►│ ORDERED  ├──────────┐
      │          └────┬─────┘          │
      │ (cancel)      │ (partial rcv)  │ (full rcv)
      ▼               ▼                ▼
┌───────────┐  ┌──────────────┐  ┌──────────┐
│ CANCELLED │  │  PARTIALLY   │─►│ RECEIVED │
└───────────┘  │   RECEIVED   │  └──────────┘
               └──────────────┘
```

1. **DRAFT**:
   - Preliminary estimate or requisition.
   - Fully editable (items, quantities, prices).
   - Can be marked as `ORDERED` or `CANCELLED`.
   - Cannot receive stock.
2. **ORDERED**:
   - Vendor has been issued the order.
   - Line items are locked to preserve audit trail.
   - Can receive stock (transitions to `PARTIALLY_RECEIVED` or `RECEIVED`).
   - Can be cancelled if no stock has been received yet.
3. **PARTIALLY_RECEIVED**:
   - At least one delivery has arrived with positive quantity, but remaining items exist (`receivedQuantity < orderedQuantity`).
   - Cannot be silently cancelled (protects physical stock ledger).
   - Can receive additional deliveries until all remaining quantities reach zero.
4. **RECEIVED**:
   - All items on the order have arrived (`receivedQuantity >= orderedQuantity`).
   - Order is finalized; no further stock receiving allowed.
   - Cannot be cancelled.
5. **CANCELLED**:
   - Order is voided without stock received.
   - Immutable historical record.

---

## Stock Receiving & Inventory Integration

When goods physically arrive at a restaurant branch:
1. Authorized personnel enter `Receive Now` quantities per line item.
2. The system checks:
   - User has `purchase.receive` permission.
   - User is authorized for the purchase order's branch.
   - Order is in `ORDERED` or `PARTIALLY_RECEIVED` state.
   - Each `Receive Now` quantity $> 0$ and $\le \text{Remaining Quantity}$.
3. Confirmation alert displays the exact incoming quantities and branch destination.
4. A single atomic database transaction:
   - Increments `PurchaseOrderItem.receivedQuantity`.
   - Creates a `PurchaseReceiving` batch and `PurchaseReceivingItem` rows.
   - Ensures the branch has an active `InventoryItem` record for each received ingredient.
   - Creates `StockTransaction` of type `RECEIPT` for each received item, referencing the purchase order number.
   - Evaluates whether all items are fulfilled to transition status to `RECEIVED` or `PARTIALLY_RECEIVED`.
5. The Inventory module dynamically calculates new stock levels:
   $$\text{Current Stock} = \sum \text{Inflows} - \sum \text{Outflows}$$

---

## Financial Calculation Rules

- **Line Total**:
  $$\text{Line Total} = \text{orderedQuantity} \times \text{unitPrice}$$
- **Purchase Subtotal**:
  $$\text{Purchase Subtotal} = \sum_{i=1}^{n} \text{Line Total}_i$$
- **Fulfillment Percentage**:
  $$\text{Fulfillment} = \min\left(100, \text{round}\left(\frac{\sum \text{receivedQuantity}}{\sum \text{orderedQuantity}} \times 100\right)\right)$$

Operational totals only are computed at this stage. Vendor payables, profit/loss accounting, and tax filing systems are intentionally excluded.

---

## Verification & Audit Trails

- **Traceability**: Every inventory ledger receipt contains `referenceId: "PO-YYYY-000001"`, linking physical stock back to purchase contracts and receiving batch timestamps.
- **Auditability**: Records preserve `createdBy`, `receivedBy`, timestamps, operational notes, and vendor contact info.
