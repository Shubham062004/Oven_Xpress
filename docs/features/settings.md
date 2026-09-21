# Step 20: Settings & System Configuration

## 1. Overview & Architectural Philosophy

The **Settings & System Configuration** module (`/settings`) provides a centralized, typed, audit-backed configuration system for the Oven Xpress multi-branch restaurant management system.

The system allows authorized administrators and branch managers to configure business parameters, operational behavior, ordering policies, and alert thresholds **without changing source code**, while maintaining strict boundary integrity:

1. **Structured & Typed Configuration Model:** Generic, unstructured key-value dumps are strictly prohibited. Every supported setting is predefined in `SETTING_DEFINITIONS` with explicit data types, permitted scopes, validation constraints, and safe defaults. Clients cannot invent setting keys.
2. **Hierarchical 3-Tier Resolution Engine:**
   - **Tier 1:** Branch-Specific Override (`scope: BRANCH`, matching `branchId`)
   - **Tier 2:** Global Setting (`scope: GLOBAL`, `branchId: null`)
   - **Tier 3:** Documented Application Default (`SETTING_DEFINITIONS[key].defaultValue`)
   If a branch override is removed or reset, resolution seamlessly falls back to the global setting, and then to the application default.
3. **Zero Infrastructure Secrets in Business Settings:**
   - Environment and infrastructure secrets (`DATABASE_URL`, `AUTH_SECRET`, Stripe secret keys, Cloudinary secrets, Gemini API keys) remain exclusively in environment variables.
   - Settings that represent credentials or sensitive financial/personal data are explicitly forbidden.
4. **Audit Integration (Step 19):**
   - Every setting mutation (`SETTING_UPDATE`) or reset (`SETTING_RESET`) is atomically recorded in `AuditLog` under entity type `SYSTEM_SETTING`.
   - Previous values and updated values are captured in `beforeData` and `afterData`.
   - Sensitive values are sanitized via Step 19 recursive redaction.
5. **Server-Side Authorization & Branch Isolation:**
   - Viewing settings requires `settings.read`.
   - Updating settings requires `settings.update`.
   - Global settings can only be modified by universal administrators (`OWNER`, `ADMIN`).
   - Branch settings can be modified by branch managers only for their assigned branch. Non-permitted staff are blocked at the server boundary.

---

## 2. Database Schema & Prisma Models

The settings and user preferences models are defined in `prisma/schema.prisma`:

```prisma
enum SettingScope {
  GLOBAL
  BRANCH
}

enum SettingDataType {
  STRING
  NUMBER
  BOOLEAN
  JSON
  TIME
}

model SystemSetting {
  id          String          @id @default(cuid())
  key         String
  value       String          @db.Text
  scope       SettingScope    @default(GLOBAL)
  branchId    String?
  branch      Branch?         @relation(fields: [branchId], references: [id], onDelete: Cascade)
  description String?
  dataType    SettingDataType @default(STRING)
  updatedBy   String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([key])
  @@index([scope])
  @@index([branchId])
  @@index([key, branchId])
}

model UserPreference {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  theme             String   @default("system")
  tableDensity      String   @default("comfortable")
  defaultDateRange  String   @default("30d")
  preferredBranchId String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId])
}
```

---

## 3. Supported Setting Categories & Catalog

### 1. Business Information (`GLOBAL` only)
Central business identity and regional formatting parameters.

| Key | Type | Default | Allowed Values / Validation |
| :--- | :--- | :--- | :--- |
| `BUSINESS_NAME` | STRING | `"Oven Xpress"` | 1–100 chars |
| `BUSINESS_LEGAL_NAME` | STRING | `"Oven Xpress Bakery & Cafe Ltd"` | 1–150 chars |
| `BUSINESS_PHONE` | STRING | `"+91 98765 43210"` | 5–25 chars |
| `BUSINESS_EMAIL` | STRING | `"contact@ovenxpress.com"` | Valid email address |
| `BUSINESS_WEBSITE` | STRING | `"https://ovenxpress.com"` | 4–200 chars |
| `BUSINESS_ADDRESS` | STRING | `"123 Gourmet Avenue"` | 1–250 chars |
| `BUSINESS_CITY` | STRING | `"Mumbai"` | 1–50 chars |
| `BUSINESS_STATE` | STRING | `"Maharashtra"` | 1–50 chars |
| `BUSINESS_POSTAL_CODE` | STRING | `"400001"` | 1–20 chars |
| `BUSINESS_CURRENCY` | STRING | `"INR"` | Enum: `INR`, `USD`, `EUR`, `GBP`, `AED` |
| `BUSINESS_LOCALE` | STRING | `"en-IN"` | Enum: `en-IN`, `en-US`, `en-GB` |
| `BUSINESS_TIMEZONE` | STRING | `"Asia/Kolkata"` | Enum: `Asia/Kolkata`, `Asia/Dubai`, `Europe/London`, `America/New_York`, `UTC` |

### 2. Branch Defaults (`GLOBAL` & `BRANCH`)
Operational defaults for kitchen and table management.

| Key | Type | Default | Allowed Values / Validation |
| :--- | :--- | :--- | :--- |
| `BRANCH_DEFAULT_PREPARATION_TIME` | NUMBER | `20` | Min 5, Max 180 (minutes) |
| `BRANCH_AUTO_ACCEPT_ORDERS` | BOOLEAN | `false` | Boolean |
| `BRANCH_TABLE_RESERVATION_ALLOWED` | BOOLEAN | `true` | Boolean |

### 3. Orders & POS (`GLOBAL` & `BRANCH`)
Configurable order generation and service availability.

| Key | Type | Default | Allowed Values / Validation |
| :--- | :--- | :--- | :--- |
| `ORDER_NUMBER_PREFIX` | STRING | `"ORD"` | Regex: `^[A-Z0-9_-]{2,8}$` |
| `ORDER_DEFAULT_TYPE` | STRING | `"DINE_IN"` | Enum: `DINE_IN`, `TAKEAWAY`, `DELIVERY` |
| `ORDER_ENABLE_DINE_IN` | BOOLEAN | `true` | Boolean |
| `ORDER_ENABLE_TAKEAWAY` | BOOLEAN | `true` | Boolean |
| `ORDER_ENABLE_DELIVERY` | BOOLEAN | `true` | Boolean |
| `ORDER_CANCELLATION_WINDOW_MINUTES` | NUMBER | `5` | Min 0, Max 60 (minutes) |

### 4. Inventory & Stock (`GLOBAL` & `BRANCH`)
Stock integrity policies and unit defaults.

| Key | Type | Default | Allowed Values / Validation |
| :--- | :--- | :--- | :--- |
| `INVENTORY_ALLOW_NEGATIVE_STOCK` | BOOLEAN | `false` | Boolean |
| `INVENTORY_AUTO_RECONCILE_ON_COUNT` | BOOLEAN | `false` | Boolean |
| `INVENTORY_DEFAULT_UNIT` | STRING | `"KG"` | Enum: `KG`, `G`, `L`, `ML`, `PIECE`, `PACK` |
| `INVENTORY_WASTAGE_REASON_MANDATORY` | BOOLEAN | `true` | Boolean |

### 5. Alerts & Notifications (`GLOBAL` & `BRANCH`)
Integration with Step 16 automated alerting engine.

| Key | Type | Default | Allowed Values / Validation |
| :--- | :--- | :--- | :--- |
| `ALERT_LOW_STOCK_ENABLED` | BOOLEAN | `true` | Boolean |
| `ALERT_OUT_OF_STOCK_ENABLED` | BOOLEAN | `true` | Boolean |
| `ALERT_STOCK_VARIANCE_ENABLED` | BOOLEAN | `true` | Boolean |
| `ALERT_HIGH_WASTAGE_ENABLED` | BOOLEAN | `true` | Boolean |
| `ALERT_HIGH_WASTAGE_THRESHOLD_AMOUNT` | NUMBER | `5000` | Min 0, Max 1,000,000 |
| `ALERT_PENDING_EXPENSE_ENABLED` | BOOLEAN | `true` | Boolean |
| `ALERT_PENDING_BONUS_ENABLED` | BOOLEAN | `true` | Boolean |
| `ALERT_FAILED_PAYMENT_ENABLED` | BOOLEAN | `true` | Boolean |
| `ALERT_UNPAID_ORDER_ENABLED` | BOOLEAN | `true` | Boolean |
| `ALERT_OPERATIONAL_EXCEPTION_ENABLED` | BOOLEAN | `true` | Boolean |

### 6. Payments & Settlement (`GLOBAL` & `BRANCH`)
Payment tender defaults and split payment policy.

| Key | Type | Default | Allowed Values / Validation |
| :--- | :--- | :--- | :--- |
| `PAYMENT_DEFAULT_METHOD` | STRING | `"CASH"` | Enum: `CASH`, `CARD`, `UPI`, `NET_BANKING`, `WALLET`, `OTHER` |
| `PAYMENT_ALLOW_PARTIAL` | BOOLEAN | `false` | Boolean |
| `PAYMENT_RECEIPT_REQUIRED` | BOOLEAN | `true` | Boolean |

### 7. Expenses & Approvals (`GLOBAL` & `BRANCH`)
Expense authorization thresholds.

| Key | Type | Default | Allowed Values / Validation |
| :--- | :--- | :--- | :--- |
| `EXPENSE_APPROVAL_REQUIRED` | BOOLEAN | `true` | Boolean |
| `EXPENSE_APPROVAL_THRESHOLD` | NUMBER | `10000` | Min 0, Max 10,000,000 |

### 8. Attendance & Shifts (`GLOBAL` & `BRANCH`)
Shift grace periods and half-day working rules.

| Key | Type | Default | Allowed Values / Validation |
| :--- | :--- | :--- | :--- |
| `ATTENDANCE_GRACE_PERIOD_MINUTES` | NUMBER | `15` | Min 0, Max 120 (minutes) |
| `ATTENDANCE_HALF_DAY_MINUTES` | NUMBER | `240` | Min 60, Max 480 (minutes) |

---

## 4. User Interface (`/settings`)

The settings screen features a responsive, high-density layout:

- **Top Context Bar:**
  - **Branch Scope Selector:** Allows universal administrators to switch between Global configuration and specific branch scopes. Branch managers are automatically locked to their assigned branch.
  - **Audit Trail Shortcut:** Direct link to `/audit-logs?entityType=SYSTEM_SETTING`.
  - **Scope Indicator Banner:** Clarifies whether changes affect the entire organization or override values for the selected branch.
- **Left Navigation Pane:**
  - Fast category switching across all 8 operational areas plus the user personalization tab.
  - Category counter badges display the total settings count and active branch override indicators.
- **Right Configuration Cards:**
  - Setting Name, key code badge (`ORDER_NUMBER_PREFIX`), and descriptive summary.
  - Effective Scope Badge (`Global Config`, `Branch Override`, `Application Default`).
  - Native Form Inputs (dynamic toggles for boolean, dropdowns for enums, validated numeric inputs with min/max bounds).
  - Unsaved change indicator and explicit `Save Changes` button.
  - `Remove Override` / `Reset to Default` button with confirmation dialog.
- **Personal UI Preferences Tab:**
  - Allows individual users to save non-business UI preferences (`theme`: light/dark/system, `tableDensity`: comfortable/compact, `defaultDateRange`: 7d/30d/90d, `preferredBranchId`).

---

## 5. Security & Access Control

- **Authentication & RBAC:**
  - `SETTINGS_READ`: Required to view the `/settings` page and execute `getSettingsAction`. Granted to `OWNER`, `ADMIN`, and `MANAGER`.
  - `SETTINGS_UPDATE`: Required to mutate or reset settings. Granted to `OWNER`, `ADMIN`, and `MANAGER` (manager mutations are scoped to their assigned branch).
  - Staff members have neither permission and are blocked at the server boundary with a 403 Access Denied redirect.
- **Scope Authorization:**
  - Global settings mutations (`scope: 'GLOBAL'`) strictly require universal administrative privileges (`isAllBranches: true`). Branch managers cannot modify or reset global settings.
  - Branch settings mutations (`scope: 'BRANCH'`) verify that the target `branchId` is within the actor's authorized branch scope.
- **Tamper Resistance:**
  - Setting keys must exist in `SETTING_DEFINITIONS`.
  - Setting values must pass server-side Zod and data type validators.
  - Arbitrary JSON or client-invented keys are rejected immediately.

---

## 6. Audit Logging Integration

All mutations and resets are logged via Step 19 `createAuditLog`:

- **Action:** `SETTING_UPDATE` or `SETTING_RESET`
- **Entity Type:** `SYSTEM_SETTING`
- **Entity ID:** ID of the `SystemSetting` record
- **Branch ID:** Populated for branch-scoped settings; `null` for global settings
- **Actor:** Logged in user ID
- **Before / After Data:** Captures the previous value and the updated/default value
- **Metadata:** Records `settingKey`, `settingName`, `dataType`, and `scope`

---

## 7. Verification & Test Suite

The module is verified via `scripts/verify-settings.ts` (26 automated test assertions):

1. **Default Fallback Resolution:** Missing database records resolve safely to documented application defaults without crashing.
2. **Global Setting Mutations:** Global settings update correctly, update the resolver, and generate `SETTING_UPDATE` audit logs.
3. **Branch Isolation & Precedence:** Branch A override takes precedence for Branch A; Branch B remains unaffected and inherits global settings.
4. **Reset Fallback:** Resetting Branch A override restores global resolution; resetting global setting restores application default.
5. **Input & Type Validation:** Rejection of unknown keys, out-of-bounds numbers, invalid enum choices, and malformed regex strings.
6. **Scope Integrity:** Rejection of branch overrides on global-only settings.
7. **User Preferences:** Personal preference persistence and retrieval verified.
8. **Catalog Completeness:** 100% of defined settings resolve valid effective values.
