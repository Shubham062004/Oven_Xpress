# Inventory & Stock Management

## Purpose

The Inventory & Stock Management module delivers multi-branch stock control for Oven Xpress. It provides branch-specific inventory item tracking, an immutable double-entry style stock ledger, atomic branch-to-branch stock transfers, structured damage and kitchen wastage logging, manual stock adjustments with mandatory audit trails, and physical stock reconciliation with automatic variance tracking.

---

## Architecture & Data Flow

```
Branch ──► InventoryItem (Branch + Ingredient Config) ──► Ingredient (Master Definition)
   │
   ▼
StockTransaction (Immutable Ledger: Inflow / Outflow)
   │
   ▼
Dynamic Current Stock Calculation:
  (OPENING + RECEIPT + TRANSFER_IN + ADJUSTMENT_IN)
- (CONSUMPTION + TRANSFER_OUT + DAMAGE + WASTAGE + ADJUSTMENT_OUT)
```

### Key Architectural Principles:
1. **Branch-Specific Stock**: The same ingredient maintains independent stock levels at each branch (e.g. Tomato Sauce: 18 L at Downtown, 7 L at Bandra, 24 L at Andheri). Stock is never stored as a single global quantity on `Ingredient`.
2. **Immutable Stock Ledger**: Stock balances are never directly updated via arbitrary write operations. Instead, all stock changes are recorded as append-only `StockTransaction` rows with positive quantities, where the transaction type determines whether stock is credited or debited.
3. **Non-Negative Stock Invariant**: Operations that debit stock validate available inventory inside a database transaction, preventing negative stock levels.
4. **Soft Deactivation**: Deactivating an `InventoryItem` preserves all historical stock transactions and ledger auditability.

---

## User Roles & Permissions

This module defines 8 granular permissions under the `inventory.*` namespace:

| Permission | Code | OWNER | ADMIN | MANAGER | STAFF |
|------------|------|:-----:|:-----:|:-------:|:-----:|
| View inventory & ledger | `inventory.read` | ✅ | ✅ | ✅ | ✅ |
| Configure item / opening stock | `inventory.create` | ✅ | ✅ | ❌ | ❌ |
| Update thresholds & settings | `inventory.update` | ✅ | ✅ | ✅* | ❌ |
| Manual count adjustment | `inventory.adjust` | ✅ | ✅ | ✅* | ❌ |
| Inter-branch transfer | `inventory.transfer` | ✅ | ✅ | ✅* | ❌ |
| Log damage & wastage | `inventory.wastage` | ✅ | ✅ | ✅* | ❌ |
| Physical count reconciliation | `inventory.reconcile` | ✅ | ✅ | ✅* | ❌ |
| Toggle active/inactive status | `inventory.deactivate` | ✅ | ✅ | ❌ | ❌ |

*\*Branch Scoping Rule*: `MANAGER` is strictly isolated to their assigned branch (`employee.branchId`). They cannot view or manipulate stock, transfers, adjustments, or wastage for other branches. `OWNER` and `ADMIN` can operate across all branches.

---

## Data Models

### InventoryItem
Configures stock thresholds and operational status for an ingredient at a specific branch.

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `String (cuid)` | Auto | Primary key |
| `branchId` | `String` | Yes | References `Branch(id)` |
| `ingredientId` | `String` | Yes | References `Ingredient(id)` |
| `minimumStock` | `Decimal(10,3)` | Auto | Alert threshold when stock drops below this value (default: 0) |
| `reorderLevel` | `Decimal(10,3)` | Auto | Warning threshold indicating reorder point (default: 0) |
| `status` | `InventoryStatus` | Auto | `ACTIVE` (default) or `INACTIVE` |
| `createdAt` | `DateTime` | Auto | |
| `updatedAt` | `DateTime` | Auto | |

**Constraints & Indexes**:
- `@@unique([branchId, ingredientId])`: One inventory item per branch + ingredient.
- `@@index([branchId])`, `@@index([ingredientId])`, `@@index([status])`

### StockTransaction
The immutable audit ledger capturing every inbound and outbound inventory movement.

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `String (cuid)` | Auto | Primary key |
| `branchId` | `String` | Yes | References `Branch(id)` |
| `ingredientId` | `String` | Yes | References `Ingredient(id)` |
| `type` | `StockTransactionType` | Yes | Transaction classification |
| `quantity` | `Decimal(10,3)` | Yes | Strictly positive amount (> 0) |
| `unit` | `IngredientUnit` | Yes | Canonical measurement unit |
| `referenceId` | `String?` | No | Purchase order number, delivery note, or transfer pairing ID |
| `reason` | `WastageReason?` | No | Structured loss classification for `DAMAGE` and `WASTAGE` |
| `note` | `String?` | No | Audit explanations, physical count observations |
| `performedBy` | `String` | Yes | User name or email who authorized the transaction |
| `createdAt` | `DateTime` | Auto | Timestamp of record |

**Indexes**:
- `@@index([branchId, ingredientId])`
- `@@index([branchId, createdAt])`
- `@@index([ingredientId, createdAt])`
- `@@index([type])`
- `@@index([referenceId])`

---

## Transaction Types & Stock Calculation

### Inflow Types (Increase Stock)
- `OPENING`: Initial stock recorded during branch onboarding or new ingredient setup. Duplicate openings for the same item are blocked.
- `RECEIPT`: Inward delivery from suppliers or central commissary.
- `TRANSFER_IN`: Inter-branch inward transfer destination ledger entry.
- `ADJUSTMENT_IN`: Surplus inventory discovered during physical audit.

### Outflow Types (Decrease Stock)
- `CONSUMPTION`: Production depletion from menu item recipes (BOM integration).
- `TRANSFER_OUT`: Inter-branch outward transfer source ledger entry.
- `DAMAGE`: Operational losses due to physical handling or delivery accidents.
- `WASTAGE`: Kitchen preparation waste, expired items, or spoiled food.
- `ADJUSTMENT_OUT`: Deficit discrepancy discovered during physical audit.

### Derived Current Stock Formula
$$\text{Current Stock} = \sum \text{Inflow Transactions} - \sum \text{Outflow Transactions}$$

Calculated dynamically in database queries using high-performance `groupBy` aggregates to eliminate N+1 latency.

### Stock Health Status
- `OUT_OF_STOCK`: $\text{Current Stock} \le 0$
- `LOW_STOCK`: $\text{Current Stock} \le \text{minimumStock}$ OR $\text{Current Stock} \le \text{reorderLevel}$
- `HEALTHY`: $\text{Current Stock} > \max(\text{minimumStock}, \text{reorderLevel})$

---

## Core Workflows

### 1. Opening Stock Setup
- Sets starting quantities for a newly opened branch or newly introduced ingredient.
- Prevents accidental duplicates by checking if an `OPENING` transaction already exists for the branch + ingredient.
- Automatically initializes the `InventoryItem` record with configured minimum and reorder thresholds.

### 2. Manual Stock Receiving
- Records supplier or commissary deliveries.
- Captures delivery reference number (e.g. invoice or delivery challan ID) in `referenceId` for cross-system traceability.
- Immediately increments branch stock.

### 3. Damage & Wastage Logging
- Enforces structured categorization via the `WastageReason` enum:
  - `BURNED`, `SPILLED`, `SPOILED`, `EXPIRED`, `DROPPED`
  - `OVER_PREPARED`, `PREPARATION_ERROR`, `DELIVERY_DAMAGE`
  - `PACKAGING_DAMAGE`, `OTHER`
- Supports optional explanatory notes (e.g. "Discovered during morning fridge check").
- Non-punitive: classified neutrally for operational visibility.

### 4. Manual Stock Adjustment
- Authorized correction when physical counts disagree with system balances.
- Requires user, timestamp, quantity, direction (`IN` or `OUT`), and mandatory audit reason.
- Prevents negative stock on `OUT` adjustments.

### 5. Inter-Branch Stock Transfers
- Atomic transfer between two branches executed in a single `prisma.$transaction`.
- Validates:
  - Source and destination branches must differ.
  - Source branch must have sufficient available stock.
  - User must be authorized for the source branch.
- Simultaneously creates:
  1. `TRANSFER_OUT` on source branch with positive quantity.
  2. `TRANSFER_IN` on destination branch with positive quantity.
  3. Shared `referenceId` (e.g. `TRF-1789842...`) linking both transactions.

### 6. Physical Stock Reconciliation
- Staff enter physically counted stock.
- The system computes variance:
  $$\text{Variance} = \text{Physical Count} - \text{System Stock}$$
- If $\text{Variance} > 0$: creates `ADJUSTMENT_IN` for $|\text{Variance}|$.
- If $\text{Variance} < 0$: creates `ADJUSTMENT_OUT` for $|\text{Variance}|$.
- If $\text{Variance} = 0$: confirms stock accuracy with no transaction required.
- Mandatory audit reason captures operational context without assuming employee negligence.

---

## Recipe / BOM Integration & Future Automatic Consumption

The inventory layer directly connects to the Menu & Recipe Bill of Materials (BOM) module:
- `MenuItem` $\rightarrow$ `RecipeIngredient` $\rightarrow$ `Ingredient` $\rightarrow$ `InventoryItem` $\rightarrow$ `StockTransaction(CONSUMPTION)`.
- **Source of Truth**: `RecipeIngredient` maintains canonical quantity and unit requirements per dish. Inventory does not duplicate recipe formulas.
- **Future Order Deduction**: When the Order Management module is introduced, completing or kitchen-firing an order will automatically emit `CONSUMPTION` stock transactions based on the menu item's recipe BOM, decrementing stock atomically without architectural changes.

---

## Future Scope (Explicitly Excluded in this Phase)
- Supplier management & vendor profiles
- Purchase Orders (PO) and Purchase Invoices
- Kitchen Display System (KDS) live order-based automatic deductions
- AI-driven demand forecasting and automated reordering
