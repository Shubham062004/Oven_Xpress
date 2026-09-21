# Oven Xpress — Practical User Guide & Operating Manual

Welcome to **Oven Xpress**, your multi-branch restaurant operations platform. This guide provides practical, role-specific operating instructions designed for daily restaurant workflows without requiring technical or developer assistance.

---

## Table of Contents
1. [General Concepts & Navigation](#1-general-concepts--navigation)
2. [Owner Operations Guide](#2-owner-operations-guide)
   - [2.1 Executive Dashboard](#21-executive-dashboard)
   - [2.2 Business Reports & Financial Analytics](#22-business-reports--financial-analytics)
   - [2.3 Approvals (Expenses, Salaries, Bonuses)](#23-approvals-expenses-salaries-bonuses)
   - [2.4 Branch Management](#24-branch-management)
   - [2.5 Immutability & Audit Logs](#25-immutability--audit-logs)
   - [2.6 Global & Branch Settings](#26-global--branch-settings)
3. [Manager Operations Guide](#3-manager-operations-guide)
   - [3.1 Employee Management & Shifts](#31-employee-management--shifts)
   - [3.2 Attendance Tracking](#32-attendance-tracking)
   - [3.3 Menu Availability & Item Toggles](#33-menu-availability--item-toggles)
   - [3.4 Inventory Tracking & Stock Ledger](#34-inventory-tracking--stock-ledger)
   - [3.5 Purchase Orders & Receiving](#35-purchase-orders--receiving)
   - [3.6 Order Lifecycle (Dine-In, Takeaway, Delivery)](#36-order-lifecycle-dine-in-takeaway-delivery)
   - [3.7 Branch Expenses & Receipts](#37-branch-expenses--receipts)
4. [Staff Operations Guide](#4-staff-operations-guide)
   - [4.1 Daily Attendance Clock-In](#41-daily-attendance-clock-in)
   - [4.2 Kitchen Display System (KDS)](#42-kitchen-display-system-kds)
   - [4.3 Order Taking & Payment Tenders](#43-order-taking--payment-tenders)
   - [4.4 Access Boundaries & Security Rules](#44-access-boundaries--security-rules)
5. [Frequently Asked Questions (FAQ)](#5-frequently-asked-questions-faq)

---

## 1. General Concepts & Navigation

- **Role-Based Access Control (RBAC):** Your user role (`OWNER`, `ADMIN`, `MANAGER`, `STAFF`) determines the navigation menus, reports, and actions you can see and perform.
- **Branch Scope:** If you are assigned to a single branch (e.g. Branch A), the system automatically filters orders, stock, attendance, and revenue to your branch. Only Owners and Admins have global multi-branch rollup access.
- **Top Navigation Bar:**
  - **Branch Selector:** Allows switching branch context (available to Owner/Admin).
  - **Notifications Bell:** Displays real-time operational alerts (low stock, pending approvals, order delays).
  - **User Profile / Logout:** View assigned role and terminate session securely.

---

## 2. Owner Operations Guide

### 2.1 Executive Dashboard
- **Access:** Click **Dashboard** in the sidebar.
- **Overview:** Displays net daily sales, total order counts, average order value (AOV), and top-selling dishes across all active branches.
- **Branch Comparison:** Compare real-time revenue and margin performance between branches side-by-side.
- **Alert Highlights:** Red badges indicate low-stock warnings or pending purchase orders requiring approval.

### 2.2 Business Reports & Financial Analytics
- **Access:** Navigate to **Reports** in the sidebar.
- **Available Reports:**
  1. **Sales Summary:** Hourly, daily, and monthly revenue breakdowns with tax segregation.
  2. **Product Performance:** Sales volume, gross margin, and contribution per menu item.
  3. **Payment Methods:** Total collections split by Cash, Card, UPI, and Bank Transfer.
  4. **Expenses & P&L:** Net operating profit factoring food cost (COGS), labor, and overheads.
  5. **Wastage & Damage:** Monetary cost of kitchen spoilage and expired inventory.
  6. **Customer Retention:** Repeat order percentages and average lifetime customer value.
- **Exporting Data:** Click **Export CSV** on any report to download an RFC-4180 compliant spreadsheet for accounting and tax audits.

### 2.3 Approvals (Expenses, Salaries, Bonuses)
- **Operational Expenses:** Navigate to **Expenses** $\rightarrow$ **Pending Approval**.
  - Review invoice description, receipt image, and requested payment method.
  - Click **Approve** to commit the expense to the P&L ledger, or **Reject** with an explanatory note.
- **Salary Adjustments & Bonuses:**
  - Navigate to **Salary & Compensation** $\rightarrow$ **Bonuses**.
  - Approve or decline performance, festival, or attendance bonus recommendations submitted by branch managers.

### 2.4 Branch Management
- **Access:** Navigate to **Branches**.
- **Create Branch:** Click **Add Branch**, enter legal name, code (e.g. `BLR-KOR`), tax registration number, street address, and opening/closing hours.
- **Status Toggle:** Toggle branch status between `ACTIVE` and `INACTIVE` to instantly open or suspend operations.

### 2.5 Immutability & Audit Logs
- **Access:** Navigate to **Audit Logs**.
- **Tamper-Evident Trail:** Every sensitive operation (price change, refund, branch creation, setting modification) is logged with exact actor ID, user email, timestamp, IP address, and before/after values.
- **Security Guarantee:** Audit log records are append-only; no user, manager, or administrator can alter or delete historical audit entries.

### 2.6 Global & Branch Settings
- **Access:** Navigate to **Settings**.
- **3-Tier Hierarchy:**
  1. *Branch Override:* Specific setting applied exclusively to one branch (e.g. customized prep time).
  2. *Global Setting:* Applies across all branches unless overridden.
  3. *Application Default:* Built-in baseline defaults.
- **Reset to Default:** Click **Reset** next to any branch override to safely restore the global configuration.

---

## 3. Manager Operations Guide

### 3.1 Employee Management & Shifts
- **Access:** Navigate to **Employees**.
- **Onboarding:** Click **Add Employee**. Fill in employee code, legal name, contact phone, branch assignment, designation (Chef, Cashier, Waiter), and compensation type.
- **Deactivation:** When an employee resigns, toggle their status to `INACTIVE`. This revokes login access immediately while preserving historical payroll and attendance integrity.

### 3.2 Attendance Tracking
- **Access:** Navigate to **Attendance**.
- **Review Daily Log:** View present, late, half-day, and absent employees for the day's shift.
- **Correction:** If an employee missed biometric clock-in, managers can manually record an attendance status.
- *Note:* The system prevents duplicate attendance records for the same employee on the same date.

### 3.3 Menu Availability & Item Toggles
- **Access:** Navigate to **Menu Management** $\rightarrow$ **Item Availability**.
- **"86ing" Sold-Out Items:** If an ingredient runs out during a shift, toggle the item's availability switch to `OUT_OF_STOCK` for your branch.
- **Real-Time POS Sync:** Once toggled, POS cashiers are immediately prevented from placing orders for that item.

### 3.4 Inventory Tracking & Stock Ledger
- **Access:** Navigate to **Inventory**.
- **Current Balance:** Computed mathematically from the immutable transaction ledger:
  $$\text{Current Stock} = \text{Opening} + \text{Receipts} + \text{Transfers In} + \text{Adjustments In} - \text{Consumption} - \text{Wastage} - \text{Transfers Out}$$
- **Recording Wastage/Damage:**
  - Click **Record Wastage**. Select the ingredient, enter quantity, select reason (`EXPIRED`, `SPOILED`, `PREPARATION_SPILL`), and submit.
- **Stock Reconciliation:**
  - Perform physical inventory counts weekly or monthly.
  - Enter physically counted quantity in **Reconcile Stock**. The system automatically computes variance and posts compensating ledger entries.

### 3.5 Purchase Orders & Receiving
- **Access:** Navigate to **Procurement** $\rightarrow$ **Purchase Orders**.
- **Create PO:** Click **New Purchase Order**. Select registered supplier, delivery expected date, and add line items with agreed purchase rates.
- **Receiving Deliveries:**
  - When supplier delivers items, click **Receive Stock**.
  - Enter actual delivered quantities.
  - If delivery is partial (e.g. 60 of 100 units), the system marks the PO as `PARTIALLY_RECEIVED`.
  - Enter remaining units upon secondary delivery to transition the PO to `RECEIVED`.
  - *Safety Rule:* You cannot receive more items than ordered without creating a formal PO amendment.

### 3.6 Order Lifecycle (Dine-In, Takeaway, Delivery)
- **Access:** Navigate to **Orders**.
- **Dine-In Workflow:**
  1. Select occupied table number.
  2. Add customer-requested dishes and kitchen notes (e.g. "Less spicy").
  3. Click **Confirm Order** $\rightarrow$ Order routes instantly to kitchen display.
- **Takeaway Workflow:**
  1. Select **Takeaway** channel (table selection is automatically bypassed).
  2. Enter customer name and contact phone.
  3. Send to kitchen $\rightarrow$ Handover upon payment.
- **Delivery Workflow:**
  1. Select **Delivery** channel.
  2. Input required delivery address, customer phone, and delivery surcharge.
  3. Assign delivery runner once food is packaged and marked `READY`.

### 3.7 Branch Expenses & Receipts
- **Access:** Navigate to **Expenses**.
- **Submitting Expenses:** Click **New Expense**. Select expense category (Utilities, Cleaning, Repairs, Petty Cash), amount, payment tender, and attach receipt voucher.
- **Approval Flow:** Expenses enter `PENDING_APPROVAL` status. Branch operational expenses under the branch threshold are approved by the manager; higher expenditures route to the Owner.

---

## 4. Staff Operations Guide

### 4.1 Daily Attendance Clock-In
- Upon arriving at the restaurant, navigate to **My Attendance** or the store terminal.
- Click **Clock In**. The timestamp and branch location are recorded automatically.
- At the conclusion of your shift, click **Clock Out**.
- *Important:* Attempting to clock in twice on the same day will show an error message; notify your manager if a punch time correction is needed.

### 4.2 Kitchen Display System (KDS)
- **Access:** Open **Kitchen Display** on the kitchen wall-mounted tablet or touchscreen monitor.
- **Order Cards:**
  - **NEW / CONFIRMED (Yellow):** Incoming orders waiting for preparation.
  - **PREPARING (Blue):** Chef clicks **Start Preparing**. This step automatically consumes recipe ingredients from the branch inventory.
  - **READY (Green):** Chef clicks **Mark Ready** when cooking and plating are finished. Waitstaff receive a visual notification to pick up the tray.
  - **COMPLETED (Gray):** Food served to guest table or handed to delivery courier.

### 4.3 Order Taking & Payment Tenders
- **Access:** Open **POS / New Order**.
- **Selecting Items:** Tap category tabs (Pizzas, Beverages, Desserts, Starters) and click items to add to the active ticket.
- **Tender Options:**
  - **Cash:** Enter cash tendered; system calculates exact change due.
  - **UPI / QR Code:** Customer scans static/dynamic QR code; verify payment confirmation on merchant app before finalizing.
  - **Card:** Enter transaction auth code from card POS machine.
  - **Split Payment:** Customer can pay part in Cash and remainder by Card/UPI. Ensure the sum of all tenders matches the total before submitting.
- **Issuing Receipts:** Print paper tax invoice or click **Send Digital Receipt** via SMS/email.

### 4.4 Access Boundaries & Security Rules
- Staff accounts are strictly isolated to day-to-day operations:
  - You cannot view other employees' salaries, hourly rates, or bonuses.
  - You cannot access financial profit & loss reports or audit logs.
  - You cannot modify system configuration or create new branches.
  - Any attempt to access unauthorized pages will display an `Access Denied` security screen.

---

## 5. Frequently Asked Questions (FAQ)

### Q1: Why did an ingredient balance go negative?
*Answer:* The system prevents negative stock during order placement if strict stock enforcement is enabled in Settings. If an order was forced through or a stock discrepancy occurred before receiving a delivery, perform an immediate physical stock count in **Inventory** $\rightarrow$ **Reconcile Stock** to align the ledger.

### Q2: Can a kitchen order be cancelled after cooking has started?
*Answer:* If an order is already in `PREPARING` status, raw ingredients have already been consumed. If the order is cancelled, record the wasted food in **Inventory** $\rightarrow$ **Record Wastage** to maintain accurate food cost tracking.

### Q3: Why is an employee unable to log into the POS terminal?
*Answer:* Ensure that:
1. The employee's account status is set to `ACTIVE` in **Employees**.
2. The employee is assigned to the current branch.
3. The employee has been assigned an active operational role (`STAFF` or `MANAGER`).

### Q4: How do I handle a customer return or partial refund?
*Answer:* Open **Orders** $\rightarrow$ select the completed order $\rightarrow$ click **Refund Tender**. Enter the amount to refund (must not exceed the original tender amount) and select the reason. The refund is processed atomically and recorded in the daily cash reconciliation report.
