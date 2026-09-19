# Branch Management

## Purpose

The Branch Management module allows authorized users to manage restaurant branch locations in the Oven Xpress multi-branch restaurant management system. Branches are **core business entities** — all future operational modules (Employees, Attendance, Orders, Inventory, Expenses, Sales) will reference branches by stable ID.

## User Roles & Permissions

| Permission | Code | OWNER | ADMIN | MANAGER | STAFF |
|------------|------|-------|-------|---------|-------|
| View branches | `branch.read` | ✅ | ✅ | ✅ | ✅ |
| Create branches | `branch.create` | ✅ | ✅ | ❌ | ❌ |
| Edit branches | `branch.update` | ✅ | ✅ | ❌ | ❌ |
| Activate/deactivate | `branch.deactivate` | ✅ | ❌ | ❌ | ❌ |

- **OWNER** has universal bypass and all branch permissions.
- **ADMIN** can manage branches but cannot deactivate them.
- **MANAGER / STAFF** have read-only access.

## Data Model

### Branch

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | `String (cuid)` | Auto | Primary key |
| `name` | `String` | Yes | 1–100 characters |
| `code` | `String` | Yes | Unique, 1–20 chars, alphanumeric + hyphens. **Immutable after creation.** |
| `description` | `String?` | No | Up to 500 characters |
| `address` | `String` | Yes | Up to 250 characters |
| `city` | `String` | Yes | Up to 100 characters |
| `state` | `String?` | No | Up to 100 characters |
| `postalCode` | `String?` | No | Up to 20 characters |
| `phone` | `String?` | No | International format accepted |
| `email` | `String?` | No | Valid email format |
| `openingTime` | `String?` | No | `HH:mm` (24-hour) format |
| `closingTime` | `String?` | No | `HH:mm` (24-hour) format |
| `status` | `BranchStatus` | Auto | `ACTIVE` (default) or `INACTIVE` |
| `createdAt` | `DateTime` | Auto | |
| `updatedAt` | `DateTime` | Auto | |

### Indexes

- `code` — unique constraint (Prisma `@unique`)
- `status` — for filtering
- `city` — for filtering and search

### Status Enum

```prisma
enum BranchStatus {
  ACTIVE
  INACTIVE
}
```

## Business Rules

1. **Branch code uniqueness**: No two branches may share the same code.
2. **Branch code immutability**: Once set at creation, a branch code cannot be changed. This prevents breaking references in external systems, reports, and future entity relations.
3. **Required fields**: `name`, `code`, `address`, and `city` are mandatory.
4. **Soft deletion only**: Branches are never physically deleted. Deactivation sets `status = INACTIVE`. Historical records (orders, attendance, etc.) remain associated.
5. **Reactivation**: Deactivated branches can be reactivated at any time by authorized users.
6. **Branch IDs**: Auto-generated cuid values. Never based on name or code.
7. **Server-side enforcement**: All mutations verify authentication, permission, and input validation server-side. Client-side validation is for UX only.

## User Flow

### View Branches

1. Navigate to `/branches`
2. See summary cards (Total / Active / Inactive)
3. Browse branch table with name, code, location, contact, hours, status, created date
4. Use search to filter by name, code, or city (300ms debounce)
5. Use status filter dropdown (All / Active / Inactive)

### Create Branch

1. Click "Add Branch" button (requires `branch.create`)
2. Fill in form fields with client-side validation
3. Submit → server validates → checks code uniqueness → creates branch
4. Success: toast notification, dialog closes, list refreshes
5. Error: inline field errors or form-level error message

### Edit Branch

1. Click "Edit" from branch row dropdown (requires `branch.update`)
2. Form pre-fills with existing data; code field is disabled
3. Submit → server validates → updates branch
4. Success: toast notification, dialog closes, list refreshes

### View Branch Details

1. Click "View Details" from branch row dropdown
2. Navigate to `/branches/[id]`
3. See organized sections: Basic Information, Location, Contact, Operating Hours, Metadata
4. Future module placeholders shown with "Coming in a future module" message

### Activate/Deactivate

1. Click "Deactivate" or "Activate" from branch dropdown or detail page (requires `branch.deactivate`)
2. Confirmation dialog explains consequences
3. Confirm → status toggles → toast notification → data refreshes

## Validation

### Client-side (Zod)

Runs before submission for immediate feedback. Same schemas used server-side.

### Server-side

All server actions run Zod validation independently. Never trust client validation alone.

### Validation Rules

- **name**: Required, 1–100 chars, trimmed
- **code**: Required, 1–20 chars, uppercase alphanumeric + hyphens, auto-uppercased
- **description**: Optional, max 500 chars
- **address**: Required, max 250 chars
- **city**: Required, max 100 chars
- **state**: Optional, max 100 chars
- **postalCode**: Optional, max 20 chars
- **phone**: Optional, 7–20 chars, digits/spaces/dashes/parens/plus
- **email**: Optional, valid email format
- **openingTime/closingTime**: Optional, `HH:mm` 24-hour format

## API / Server Architecture

```
UI (Client Component)
  ↓
Server Action (src/lib/branches/actions.ts)
  ↓
Authentication (requirePermission → getSession)
  ↓
Zod Validation (createBranchSchema / updateBranchSchema)
  ↓
Business Logic (uniqueness check, etc.)
  ↓
Prisma Database Operation
  ↓
ActionResult<T> Response
```

### Server Actions

| Action | Permission | Input | Returns |
|--------|-----------|-------|---------|
| `getBranches(params?)` | `branch.read` | `{ search?, status? }` | `ActionResult<Branch[]>` |
| `getBranchById(id)` | `branch.read` | `string` | `ActionResult<Branch>` |
| `getBranchStats()` | `branch.read` | — | `ActionResult<BranchStats>` |
| `createBranch(data)` | `branch.create` | Form data | `BranchFormState` |
| `updateBranch(id, data)` | `branch.update` | `id + Form data` | `BranchFormState` |
| `toggleBranchStatus(id)` | `branch.deactivate` | `string` | `ActionResult<Branch>` |

## Edge Cases

- **Duplicate code on create**: Server returns field error on `code` field
- **Branch not found**: Returns 404 (detail page) or error message (actions)
- **Unauthorized access**: Redirects to `/unauthorized` (403)
- **Empty search results**: Shows "No branches found" with filter hint
- **No branches**: Shows "No branches yet" with CTA button
- **Network/DB failure**: Generic error message, no raw errors exposed
- **Double submission**: Button disabled during pending state

## Manual Testing Checklist

### Create
- [ ] Create valid branch with all fields
- [ ] Create branch with only required fields
- [ ] Submit with missing required fields → field errors
- [ ] Submit with invalid email → validation error
- [ ] Submit with duplicate branch code → server error
- [ ] Verify branch appears in list after creation

### Read
- [ ] Branch list displays all branches
- [ ] Branch detail page shows all information
- [ ] Search by name returns correct results
- [ ] Search by code returns correct results
- [ ] Search by city returns correct results
- [ ] Status filter: Active shows only active
- [ ] Status filter: Inactive shows only inactive
- [ ] Status filter: All shows everything

### Update
- [ ] Edit branch with valid data
- [ ] Branch code field is disabled in edit mode
- [ ] Submit invalid values → validation errors

### Status
- [ ] Deactivate active branch → confirmation → success
- [ ] Cancel deactivation → no change
- [ ] Reactivate inactive branch → success
- [ ] Status badge updates correctly

### Authorization
- [ ] Owner can create, edit, deactivate
- [ ] Admin can create, edit, cannot deactivate
- [ ] Manager can only view
- [ ] Staff can only view
- [ ] Direct unauthorized server action → rejected

### Responsive
- [ ] 1440px — full table, all columns visible
- [ ] 1280px — table readable
- [ ] 1024px — contact column hidden
- [ ] 768px — tablet layout, fewer columns
- [ ] 390px — mobile, minimal columns, horizontal scroll

### UX
- [ ] Loading skeletons shown during fetch
- [ ] Empty state when no branches
- [ ] Toast notifications on success/error
- [ ] Confirmation dialog before deactivation
- [ ] No console errors
- [ ] Keyboard navigation works
- [ ] Focus management in dialogs
- [ ] Both light and dark themes render correctly
