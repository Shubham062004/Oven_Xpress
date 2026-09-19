# Menu + Recipe/BOM Management

## Purpose

The Menu + Recipe/BOM Management module enables restaurant operators to curate food and beverage offerings, organize items into categories, define raw ingredients with standardized measurement units, engineer Bill of Materials (BOM) recipes with unit-family compatibility, and customize branch-level availability and pricing overrides across all Oven Xpress locations.

## User Roles & Permissions

This module defines 17 granular permissions under the `menu.*` namespace:

| Permission | Code | OWNER | ADMIN | MANAGER | STAFF |
|------------|------|:-----:|:-----:|:-------:|:-----:|
| View categories | `menu.category.read` | ✅ | ✅ | ✅ | ✅ |
| Create categories | `menu.category.create` | ✅ | ✅ | ❌ | ❌ |
| Edit categories | `menu.category.update` | ✅ | ✅ | ❌ | ❌ |
| Toggle category status | `menu.category.deactivate` | ✅ | ✅ | ❌ | ❌ |
| View ingredients | `menu.ingredient.read` | ✅ | ✅ | ✅ | ✅ |
| Create ingredients | `menu.ingredient.create` | ✅ | ✅ | ❌ | ❌ |
| Edit ingredients | `menu.ingredient.update` | ✅ | ✅ | ❌ | ❌ |
| Toggle ingredient status | `menu.ingredient.deactivate` | ✅ | ✅ | ❌ | ❌ |
| View menu items | `menu.item.read` | ✅ | ✅ | ✅ | ✅ |
| Create menu items | `menu.item.create` | ✅ | ✅ | ❌ | ❌ |
| Edit menu items | `menu.item.update` | ✅ | ✅ | ❌ | ❌ |
| Toggle menu item status | `menu.item.deactivate` | ✅ | ✅ | ❌ | ❌ |
| View branch availability/pricing | `menu.branch.read` | ✅ | ✅ | ✅ | ✅ |
| Update branch availability/pricing | `menu.branch.update` | ✅ | ✅ | ✅* | ❌ |
| View recipes/BOM | `menu.recipe.read` | ✅ | ✅ | ✅ | ✅ |
| Configure/update recipes | `menu.recipe.update` | ✅ | ✅ | ❌ | ❌ |
| Delete recipes/ingredients | `menu.recipe.delete` | ✅ | ✅ | ❌ | ❌ |

*\*Note on Branch Scoping*: `MANAGER` can only update branch availability and pricing for their assigned branch (`employee.branchId`). `OWNER` and `ADMIN` can update across all branches.

## Data Models

### MenuCategory

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `String (cuid)` | Auto | Primary key |
| `name` | `String` | Yes | 1–100 characters, unique |
| `description` | `String?` | No | Up to 500 characters |
| `sortOrder` | `Int` | Auto | Default 0, for custom display ordering |
| `status` | `MenuStatus` | Auto | `ACTIVE` (default) or `INACTIVE` |
| `createdAt` | `DateTime` | Auto | |
| `updatedAt` | `DateTime` | Auto | |

### Ingredient

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `String (cuid)` | Auto | Primary key |
| `name` | `String` | Yes | 1–100 characters, unique |
| `description` | `String?` | No | Up to 500 characters |
| `unit` | `IngredientUnit` | Yes | Default base inventory unit |
| `status` | `MenuStatus` | Auto | `ACTIVE` (default) or `INACTIVE` |
| `createdAt` | `DateTime` | Auto | |
| `updatedAt` | `DateTime` | Auto | |

### MenuItem

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `String (cuid)` | Auto | Primary key |
| `name` | `String` | Yes | 1–150 characters |
| `description` | `String?` | No | Up to 1000 characters |
| `categoryId` | `String` | Yes | Foreign key to `MenuCategory` |
| `price` | `Float` | Yes | Base selling price (must be > 0) |
| `preparationTimeMinutes` | `Int` | Yes | Estimated prep time (>= 0 minutes) |
| `imageUrl` | `String?` | No | Optional URL to dish photo |
| `status` | `MenuStatus` | Auto | `ACTIVE` (default) or `INACTIVE` |
| `createdAt` | `DateTime` | Auto | |
| `updatedAt` | `DateTime` | Auto | |

### BranchMenuItem (Branch Availability & Price Override)

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `String (cuid)` | Auto | Primary key |
| `branchId` | `String` | Yes | Foreign key to `Branch` |
| `menuItemId` | `String` | Yes | Foreign key to `MenuItem` |
| `isAvailable` | `Boolean` | Auto | Default `true` |
| `price` | `Float?` | No | Nullable custom price override; falls back to `menuItem.price` if null |
| `createdAt` | `DateTime` | Auto | |
| `updatedAt` | `DateTime` | Auto | |

- **Unique constraint**: `@@unique([branchId, menuItemId])`

### RecipeIngredient (Bill of Materials / BOM)

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | `String (cuid)` | Auto | Primary key |
| `menuItemId` | `String` | Yes | Foreign key to `MenuItem` |
| `ingredientId` | `String` | Yes | Foreign key to `Ingredient` |
| `quantity` | `Float` | Yes | Required quantity (must be > 0) |
| `unit` | `IngredientUnit` | Yes | Unit used in recipe (must belong to same unit family as ingredient's base unit) |
| `createdAt` | `DateTime` | Auto | |
| `updatedAt` | `DateTime` | Auto | |

- **Unique constraint**: `@@unique([menuItemId, ingredientId])`

## Supported Measurement Units & Families

Measurement units are strictly defined via the Prisma enum `IngredientUnit`:
- `KG` (Kilogram)
- `GRAM` (Gram)
- `LITRE` (Litre)
- `ML` (Millilitre)
- `PIECE` (Piece)
- `PACK` (Pack)
- `DOZEN` (Dozen)

### Unit Compatibility Matrix

Recipe units are validated against the ingredient's base unit using measurement families to prevent invalid conversions (e.g. attempting to measure flour in millilitres or oil in pieces):

| Family | Allowed Units |
|--------|---------------|
| **Mass** | `KG`, `GRAM` |
| **Volume** | `LITRE`, `ML` |
| **Count** | `PIECE`, `PACK`, `DOZEN` |

Cross-family conversions are rejected by server-side validation.

## Business Rules & Safeguards

1. **No Hard Deletion**:
   - Categories, ingredients, and menu items use `ACTIVE` / `INACTIVE` soft status toggles to maintain historical integrity.
   - Deactivating a category warns that linked menu items will be hidden if inactive.
   - Deactivating an ingredient prevents it from being added to new recipes.
2. **Price & Prep Time Invariants**:
   - Menu item base prices and branch overrides must strictly exceed 0.
   - Preparation time in minutes cannot be negative.
3. **Atomic BOM Recipe Saving**:
   - Saving a recipe replaces existing lines atomically inside a Prisma `$transaction` (`deleteMany` + `createMany`), ensuring no partial recipe states or dangling lines.
4. **Duplicate Prevention**:
   - Unique constraints prevent the same ingredient from appearing multiple times in the same dish's recipe.
   - Categories and ingredients have unique names (case-insensitive deduplication).
5. **Branch Overrides & Multi-Tenancy**:
   - If a branch has no `BranchMenuItem` row, the dish defaults to available at base price.
   - When configured, `price = null` denotes "use default menu price", while any numeric value represents a localized branch price.
