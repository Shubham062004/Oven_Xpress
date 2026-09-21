export type SettingCategory =
  | 'BUSINESS'
  | 'BRANCH'
  | 'ORDERS'
  | 'INVENTORY'
  | 'NOTIFICATIONS'
  | 'PAYMENTS'
  | 'EXPENSES'
  | 'ATTENDANCE';

export type SettingDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'TIME';
export type SettingScopeType = 'GLOBAL' | 'BRANCH';

export interface SettingOption {
  label: string;
  value: string;
}

export interface SettingDefinition<T = unknown> {
  key: string;
  name: string;
  description: string;
  category: SettingCategory;
  dataType: SettingDataType;
  allowedScopes: SettingScopeType[];
  defaultValue: T;
  options?: SettingOption[];
  min?: number;
  max?: number;
  validate: (val: unknown) => { success: boolean; data?: T; error?: string };
  formatDisplay?: (val: T) => string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const orderPrefixRegex = /^[A-Z0-9_-]{2,8}$/;

function createStringValidator(opts: { min?: number; max?: number; regex?: RegExp; errorMsg?: string }) {
  return (val: unknown) => {
    if (typeof val !== 'string') {
      return { success: false, error: 'Value must be a string' };
    }
    const trimmed = val.trim();
    if (opts.min !== undefined && trimmed.length < opts.min) {
      return { success: false, error: opts.errorMsg || `Must be at least ${opts.min} character(s)` };
    }
    if (opts.max !== undefined && trimmed.length > opts.max) {
      return { success: false, error: opts.errorMsg || `Must be at most ${opts.max} characters` };
    }
    if (opts.regex && !opts.regex.test(trimmed)) {
      return { success: false, error: opts.errorMsg || 'Invalid format' };
    }
    return { success: true, data: trimmed };
  };
}

function createEnumValidator(allowed: string[]) {
  return (val: unknown) => {
    if (typeof val !== 'string' || !allowed.includes(val)) {
      return { success: false, error: `Must be one of: ${allowed.join(', ')}` };
    }
    return { success: true, data: val };
  };
}

function createNumberValidator(opts: { min?: number; max?: number }) {
  return (val: unknown) => {
    const num = typeof val === 'number' ? val : Number(val);
    if (isNaN(num) || !isFinite(num)) {
      return { success: false, error: 'Value must be a valid number' };
    }
    if (opts.min !== undefined && num < opts.min) {
      return { success: false, error: `Must be at least ${opts.min}` };
    }
    if (opts.max !== undefined && num > opts.max) {
      return { success: false, error: `Must be at most ${opts.max}` };
    }
    return { success: true, data: num };
  };
}

function createBooleanValidator() {
  return (val: unknown) => {
    if (typeof val === 'boolean') {
      return { success: true, data: val };
    }
    if (val === 'true' || val === '1' || val === 1) {
      return { success: true, data: true };
    }
    if (val === 'false' || val === '0' || val === 0) {
      return { success: true, data: false };
    }
    return { success: false, error: 'Value must be a boolean (true or false)' };
  };
}

export const SETTING_DEFINITIONS: Record<string, SettingDefinition> = {
  // ==========================================
  // 1. BUSINESS (GLOBAL ONLY)
  // ==========================================
  BUSINESS_NAME: {
    key: 'BUSINESS_NAME',
    name: 'Business Name',
    description: 'The public facing trading name of the restaurant brand.',
    category: 'BUSINESS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL'],
    defaultValue: 'Oven Xpress',
    validate: createStringValidator({ min: 1, max: 100 }),
  },
  BUSINESS_LEGAL_NAME: {
    key: 'BUSINESS_LEGAL_NAME',
    name: 'Legal Entity Name',
    description: 'Registered legal company name for invoices and receipts.',
    category: 'BUSINESS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL'],
    defaultValue: 'Oven Xpress Bakery & Cafe Ltd',
    validate: createStringValidator({ min: 1, max: 150 }),
  },
  BUSINESS_PHONE: {
    key: 'BUSINESS_PHONE',
    name: 'Headquarters Phone',
    description: 'Primary corporate telephone number.',
    category: 'BUSINESS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL'],
    defaultValue: '+91 98765 43210',
    validate: createStringValidator({ min: 5, max: 25 }),
  },
  BUSINESS_EMAIL: {
    key: 'BUSINESS_EMAIL',
    name: 'Official Email',
    description: 'General inquiry and support email address.',
    category: 'BUSINESS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL'],
    defaultValue: 'contact@ovenxpress.com',
    validate: createStringValidator({ min: 5, max: 100, regex: emailRegex, errorMsg: 'Must be a valid email address' }),
  },
  BUSINESS_WEBSITE: {
    key: 'BUSINESS_WEBSITE',
    name: 'Website URL',
    description: 'Main public website URL.',
    category: 'BUSINESS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL'],
    defaultValue: 'https://ovenxpress.com',
    validate: createStringValidator({ min: 4, max: 200 }),
  },
  BUSINESS_ADDRESS: {
    key: 'BUSINESS_ADDRESS',
    name: 'Headquarters Address',
    description: 'Street address of the central headquarters.',
    category: 'BUSINESS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL'],
    defaultValue: '123 Gourmet Avenue',
    validate: createStringValidator({ min: 1, max: 250 }),
  },
  BUSINESS_CITY: {
    key: 'BUSINESS_CITY',
    name: 'City',
    description: 'City of central headquarters.',
    category: 'BUSINESS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL'],
    defaultValue: 'Mumbai',
    validate: createStringValidator({ min: 1, max: 50 }),
  },
  BUSINESS_STATE: {
    key: 'BUSINESS_STATE',
    name: 'State / Province',
    description: 'State of central headquarters.',
    category: 'BUSINESS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL'],
    defaultValue: 'Maharashtra',
    validate: createStringValidator({ min: 1, max: 50 }),
  },
  BUSINESS_POSTAL_CODE: {
    key: 'BUSINESS_POSTAL_CODE',
    name: 'Postal Code / PIN',
    description: 'Postal/ZIP code of central headquarters.',
    category: 'BUSINESS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL'],
    defaultValue: '400001',
    validate: createStringValidator({ min: 1, max: 20 }),
  },
  BUSINESS_CURRENCY: {
    key: 'BUSINESS_CURRENCY',
    name: 'System Currency',
    description: 'Primary operating currency code used across pricing and accounting.',
    category: 'BUSINESS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL'],
    defaultValue: 'INR',
    options: [
      { label: 'Indian Rupee (INR ₹)', value: 'INR' },
      { label: 'US Dollar (USD $)', value: 'USD' },
      { label: 'Euro (EUR €)', value: 'EUR' },
      { label: 'British Pound (GBP £)', value: 'GBP' },
      { label: 'UAE Dirham (AED)', value: 'AED' },
    ],
    validate: createEnumValidator(['INR', 'USD', 'EUR', 'GBP', 'AED']),
  },
  BUSINESS_LOCALE: {
    key: 'BUSINESS_LOCALE',
    name: 'Default Locale',
    description: 'Locale used for formatting dates, times, and numbers.',
    category: 'BUSINESS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL'],
    defaultValue: 'en-IN',
    options: [
      { label: 'English (India) - en-IN', value: 'en-IN' },
      { label: 'English (United States) - en-US', value: 'en-US' },
      { label: 'English (United Kingdom) - en-GB', value: 'en-GB' },
    ],
    validate: createEnumValidator(['en-IN', 'en-US', 'en-GB']),
  },
  BUSINESS_TIMEZONE: {
    key: 'BUSINESS_TIMEZONE',
    name: 'Default Timezone',
    description: 'Operating timezone for reporting dates and operational shifts.',
    category: 'BUSINESS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL'],
    defaultValue: 'Asia/Kolkata',
    options: [
      { label: 'Asia/Kolkata (IST +05:30)', value: 'Asia/Kolkata' },
      { label: 'Asia/Dubai (GST +04:00)', value: 'Asia/Dubai' },
      { label: 'Europe/London (GMT/BST)', value: 'Europe/London' },
      { label: 'America/New_York (EST/EDT)', value: 'America/New_York' },
      { label: 'UTC', value: 'UTC' },
    ],
    validate: createEnumValidator(['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'UTC']),
  },

  // ==========================================
  // 2. BRANCH
  // ==========================================
  BRANCH_DEFAULT_PREPARATION_TIME: {
    key: 'BRANCH_DEFAULT_PREPARATION_TIME',
    name: 'Default Prep Time (Minutes)',
    description: 'Default kitchen order turnaround time estimate shown to staff.',
    category: 'BRANCH',
    dataType: 'NUMBER',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: 20,
    min: 5,
    max: 180,
    validate: createNumberValidator({ min: 5, max: 180 }),
  },
  BRANCH_AUTO_ACCEPT_ORDERS: {
    key: 'BRANCH_AUTO_ACCEPT_ORDERS',
    name: 'Auto-Accept Orders',
    description: 'Automatically confirm incoming orders into kitchen queue upon placement.',
    category: 'BRANCH',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: false,
    validate: createBooleanValidator(),
  },
  BRANCH_TABLE_RESERVATION_ALLOWED: {
    key: 'BRANCH_TABLE_RESERVATION_ALLOWED',
    name: 'Allow Dine-in Table Reservations',
    description: 'Permits advance table reservations at this branch.',
    category: 'BRANCH',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },

  // ==========================================
  // 3. ORDERS
  // ==========================================
  ORDER_NUMBER_PREFIX: {
    key: 'ORDER_NUMBER_PREFIX',
    name: 'Order Number Prefix',
    description: 'Prefix used when generating unique sequential order codes (2-8 uppercase letters/numbers).',
    category: 'ORDERS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: 'ORD',
    validate: createStringValidator({
      min: 2,
      max: 8,
      regex: orderPrefixRegex,
      errorMsg: 'Prefix must be 2 to 8 uppercase letters, numbers, hyphens or underscores',
    }),
  },
  ORDER_DEFAULT_TYPE: {
    key: 'ORDER_DEFAULT_TYPE',
    name: 'Default Order Type',
    description: 'Selected order type by default when starting a new order in POS.',
    category: 'ORDERS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: 'DINE_IN',
    options: [
      { label: 'Dine-In', value: 'DINE_IN' },
      { label: 'Takeaway', value: 'TAKEAWAY' },
      { label: 'Delivery', value: 'DELIVERY' },
    ],
    validate: createEnumValidator(['DINE_IN', 'TAKEAWAY', 'DELIVERY']),
  },
  ORDER_ENABLE_DINE_IN: {
    key: 'ORDER_ENABLE_DINE_IN',
    name: 'Enable Dine-In Service',
    description: 'Allow dine-in orders to be created at this branch.',
    category: 'ORDERS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },
  ORDER_ENABLE_TAKEAWAY: {
    key: 'ORDER_ENABLE_TAKEAWAY',
    name: 'Enable Takeaway Service',
    description: 'Allow takeaway counter pickup orders to be placed.',
    category: 'ORDERS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },
  ORDER_ENABLE_DELIVERY: {
    key: 'ORDER_ENABLE_DELIVERY',
    name: 'Enable Delivery Service',
    description: 'Allow delivery orders with customer address details to be placed.',
    category: 'ORDERS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },
  ORDER_CANCELLATION_WINDOW_MINUTES: {
    key: 'ORDER_CANCELLATION_WINDOW_MINUTES',
    name: 'Order Cancellation Grace Window (Minutes)',
    description: 'Number of minutes after placement where an unpaid order can be freely cancelled.',
    category: 'ORDERS',
    dataType: 'NUMBER',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: 5,
    min: 0,
    max: 60,
    validate: createNumberValidator({ min: 0, max: 60 }),
  },

  // ==========================================
  // 4. INVENTORY
  // ==========================================
  INVENTORY_ALLOW_NEGATIVE_STOCK: {
    key: 'INVENTORY_ALLOW_NEGATIVE_STOCK',
    name: 'Allow Negative Inventory',
    description: 'Whether inventory consumption can drive stock count below zero (strictly discouraged).',
    category: 'INVENTORY',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: false,
    validate: createBooleanValidator(),
  },
  INVENTORY_AUTO_RECONCILE_ON_COUNT: {
    key: 'INVENTORY_AUTO_RECONCILE_ON_COUNT',
    name: 'Auto-Reconcile Stock on Count',
    description: 'Automatically create stock adjustment transactions when physical count differs from system count.',
    category: 'INVENTORY',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: false,
    validate: createBooleanValidator(),
  },
  INVENTORY_DEFAULT_UNIT: {
    key: 'INVENTORY_DEFAULT_UNIT',
    name: 'Default Stock Measurement Unit',
    description: 'Pre-selected measurement unit when creating new raw ingredients or supplies.',
    category: 'INVENTORY',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: 'KG',
    options: [
      { label: 'Kilograms (KG)', value: 'KG' },
      { label: 'Grams (G)', value: 'G' },
      { label: 'Liters (L)', value: 'L' },
      { label: 'Milliliters (ML)', value: 'ML' },
      { label: 'Piece (PIECE)', value: 'PIECE' },
      { label: 'Pack (PACK)', value: 'PACK' },
    ],
    validate: createEnumValidator(['KG', 'G', 'L', 'ML', 'PIECE', 'PACK']),
  },
  INVENTORY_WASTAGE_REASON_MANDATORY: {
    key: 'INVENTORY_WASTAGE_REASON_MANDATORY',
    name: 'Mandatory Wastage Reason',
    description: 'Require kitchen staff to provide a detailed reason whenever discarding damaged or expired stock.',
    category: 'INVENTORY',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },

  // ==========================================
  // 5. NOTIFICATIONS
  // ==========================================
  ALERT_LOW_STOCK_ENABLED: {
    key: 'ALERT_LOW_STOCK_ENABLED',
    name: 'Low Stock Alerts',
    description: 'Trigger notification when inventory quantity falls below the minimum reorder level.',
    category: 'NOTIFICATIONS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },
  ALERT_OUT_OF_STOCK_ENABLED: {
    key: 'ALERT_OUT_OF_STOCK_ENABLED',
    name: 'Out of Stock Alerts',
    description: 'Trigger critical notification when inventory quantity reaches zero.',
    category: 'NOTIFICATIONS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },
  ALERT_STOCK_VARIANCE_ENABLED: {
    key: 'ALERT_STOCK_VARIANCE_ENABLED',
    name: 'Stock Variance Alerts',
    description: 'Trigger notification when physical stock count deviates from system records.',
    category: 'NOTIFICATIONS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },
  ALERT_HIGH_WASTAGE_ENABLED: {
    key: 'ALERT_HIGH_WASTAGE_ENABLED',
    name: 'High Wastage Alerts',
    description: 'Trigger alert when recorded wastage value exceeds the configured threshold.',
    category: 'NOTIFICATIONS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },
  ALERT_HIGH_WASTAGE_THRESHOLD_AMOUNT: {
    key: 'ALERT_HIGH_WASTAGE_THRESHOLD_AMOUNT',
    name: 'High Wastage Alert Threshold',
    description: 'Monetary value above which recorded wastage triggers a high-priority management alert.',
    category: 'NOTIFICATIONS',
    dataType: 'NUMBER',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: 5000,
    min: 0,
    max: 1000000,
    validate: createNumberValidator({ min: 0, max: 1000000 }),
  },
  ALERT_PENDING_EXPENSE_ENABLED: {
    key: 'ALERT_PENDING_EXPENSE_ENABLED',
    name: 'Pending Expense Approval Alerts',
    description: 'Notify managers when an operational expense is submitted and awaits review.',
    category: 'NOTIFICATIONS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },
  ALERT_PENDING_BONUS_ENABLED: {
    key: 'ALERT_PENDING_BONUS_ENABLED',
    name: 'Pending Bonus Approval Alerts',
    description: 'Notify owners/admins when employee bonuses are recommended for authorization.',
    category: 'NOTIFICATIONS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },
  ALERT_FAILED_PAYMENT_ENABLED: {
    key: 'ALERT_FAILED_PAYMENT_ENABLED',
    name: 'Failed Payment Alerts',
    description: 'Notify cashiers and managers when a digital transaction fails.',
    category: 'NOTIFICATIONS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },
  ALERT_UNPAID_ORDER_ENABLED: {
    key: 'ALERT_UNPAID_ORDER_ENABLED',
    name: 'Unpaid Order Aging Alerts',
    description: 'Alert staff when completed dine-in orders remain unpaid beyond acceptable table turnover time.',
    category: 'NOTIFICATIONS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },
  ALERT_OPERATIONAL_EXCEPTION_ENABLED: {
    key: 'ALERT_OPERATIONAL_EXCEPTION_ENABLED',
    name: 'Operational Exception Alerts',
    description: 'Trigger alerts for operational anomalies such as extreme order delays or missing shifts.',
    category: 'NOTIFICATIONS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },

  // ==========================================
  // 6. PAYMENTS
  // ==========================================
  PAYMENT_DEFAULT_METHOD: {
    key: 'PAYMENT_DEFAULT_METHOD',
    name: 'Default Payment Method',
    description: 'Default payment tender selected when opening settlement checkout modal.',
    category: 'PAYMENTS',
    dataType: 'STRING',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: 'CASH',
    options: [
      { label: 'Cash', value: 'CASH' },
      { label: 'Credit / Debit Card', value: 'CARD' },
      { label: 'UPI / QR Code', value: 'UPI' },
      { label: 'Net Banking', value: 'NET_BANKING' },
      { label: 'Digital Wallet', value: 'WALLET' },
      { label: 'Other', value: 'OTHER' },
    ],
    validate: createEnumValidator(['CASH', 'CARD', 'UPI', 'NET_BANKING', 'WALLET', 'OTHER']),
  },
  PAYMENT_ALLOW_PARTIAL: {
    key: 'PAYMENT_ALLOW_PARTIAL',
    name: 'Allow Partial / Split Payments',
    description: 'Allow settling an order via multiple partial transactions (e.g. cash + UPI split).',
    category: 'PAYMENTS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: false,
    validate: createBooleanValidator(),
  },
  PAYMENT_RECEIPT_REQUIRED: {
    key: 'PAYMENT_RECEIPT_REQUIRED',
    name: 'Receipt Reference Required',
    description: 'Require transaction reference or bill number when logging non-cash payments.',
    category: 'PAYMENTS',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },

  // ==========================================
  // 7. EXPENSES
  // ==========================================
  EXPENSE_APPROVAL_REQUIRED: {
    key: 'EXPENSE_APPROVAL_REQUIRED',
    name: 'Expense Approval Required',
    description: 'Whether branch expenses require explicit manager or admin approval before payout.',
    category: 'EXPENSES',
    dataType: 'BOOLEAN',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: true,
    validate: createBooleanValidator(),
  },
  EXPENSE_APPROVAL_THRESHOLD: {
    key: 'EXPENSE_APPROVAL_THRESHOLD',
    name: 'Expense Auto-Approval Ceiling',
    description: 'Expense amounts at or below this threshold may bypass secondary admin approval if configured.',
    category: 'EXPENSES',
    dataType: 'NUMBER',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: 10000,
    min: 0,
    max: 10000000,
    validate: createNumberValidator({ min: 0, max: 10000000 }),
  },

  // ==========================================
  // 8. ATTENDANCE
  // ==========================================
  ATTENDANCE_GRACE_PERIOD_MINUTES: {
    key: 'ATTENDANCE_GRACE_PERIOD_MINUTES',
    name: 'Clock-in Grace Period (Minutes)',
    description: 'Allowed minutes past shift start time before clock-in is flagged as late.',
    category: 'ATTENDANCE',
    dataType: 'NUMBER',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: 15,
    min: 0,
    max: 120,
    validate: createNumberValidator({ min: 0, max: 120 }),
  },
  ATTENDANCE_HALF_DAY_MINUTES: {
    key: 'ATTENDANCE_HALF_DAY_MINUTES',
    name: 'Half-Day Working Threshold (Minutes)',
    description: 'Minimum duration worked (in minutes) required to qualify for half-day attendance credit.',
    category: 'ATTENDANCE',
    dataType: 'NUMBER',
    allowedScopes: ['GLOBAL', 'BRANCH'],
    defaultValue: 240,
    min: 60,
    max: 480,
    validate: createNumberValidator({ min: 60, max: 480 }),
  },
};

export const SETTING_CATEGORIES: { id: SettingCategory; label: string; description: string }[] = [
  { id: 'BUSINESS', label: 'Business Information', description: 'Central company profile, headquarters address, currency and locale.' },
  { id: 'BRANCH', label: 'Branch Defaults', description: 'Default preparation time, reservation flags, and branch operational behaviors.' },
  { id: 'ORDERS', label: 'Orders & POS', description: 'Order numbering prefix, enabled dining types, and cancellation windows.' },
  { id: 'INVENTORY', label: 'Inventory & Stock', description: 'Stock integrity policies, default units, and reconciliation controls.' },
  { id: 'NOTIFICATIONS', label: 'Alerts & Notifications', description: 'Automated alert triggers, thresholds, and notification rules.' },
  { id: 'PAYMENTS', label: 'Payments & Settlement', description: 'Payment tender defaults, split payments, and receipt rules.' },
  { id: 'EXPENSES', label: 'Expenses & Approvals', description: 'Expense authorization limits and approval workflows.' },
  { id: 'ATTENDANCE', label: 'Workforce & Shifts', description: 'Shift grace periods and attendance duration thresholds.' },
];
