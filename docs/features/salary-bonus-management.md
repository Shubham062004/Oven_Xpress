# Salary, Bonus & Increment Management

## Purpose

The Salary, Bonus & Increment Management module provides an immutable, transparent compensation ledger and revision tracking architecture for the Oven Xpress multi-branch restaurant platform. It establishes branch-isolated compensation profiles for employees, tracks compensation raises with full percentage and delta analytics, records performance and festival bonuses/incentives with dedicated maker-checker approval lifecycles, computes deterministic salary periods, and produces non-destructive audit trails.

> [!NOTE]
> Attendance data is purely informational in this version; no automatic salary deductions or penalties are applied. Full payroll deductions (PF, ESI, TDS, professional tax, payslip distribution) are reserved for a dedicated future module.

---

## Architecture & Data Flow

```
                                  ┌───────────────────────────────┐
                                  │           Employee            │
                                  │  - base salary & salaryType   │
                                  │  - branch assignment          │
                                  └───────┬──────────────┬────────┘
                                          │ 1            │ 1
                                          │ *            │ *
                          ┌───────────────▼─┐    ┌───────▼───────────────┐
                          │ SalaryStructure │    │    SalaryIncrement    │
                          │ - effectiveFrom │    │ - previousSalary      │
                          │ - effectiveTo   │    │ - newSalary           │
                          │ - status        │    │ - difference, percent │
                          └───────┬─────────┘    └───────────────────────┘
                                  │ 1
                                  │ *
                          ┌───────▼───────────────────────────────┐
                          │             SalaryRecord              │
                          │ - salaryNumber (SAL-YYYY-000001)      │
                          │ - periodStart, periodEnd              │
                          │ - baseSalary, bonusAmount, gross      │
                          │ - attendanceSummary (JSON, info only) │
                          │ - status (DRAFT, PENDING, APPROVED)   │
                          └───────┬──────────────┬────────────────┘
                                  │ 1            │ 1
                                  │ *            │ *
                  ┌───────────────▼─┐    ┌───────▼───────────────┐
                  │ Bonus/Incentive │    │    SalaryAuditLog     │
                  │ - amount, type  │    │ - action, diff        │
                  │ - status        │    │ - performedBy, ts     │
                  └─────────────────┘    └───────────────────────┘
```

### Key Architectural Principles:

1. **Decoupled Historical Compensation**: Rather than relying solely on the mutable `Employee.salary` field as the source of truth, compensation is tracked through sequential `SalaryStructure` spans (`effectiveFrom` to `effectiveTo`). Modifying an employee's salary generates an active `SalaryStructure` and supersedes previous entries while recording an immutable `SalaryIncrement`.
2. **Deterministic Live Calculation & Previews**: When opening a period, the system dynamically queries the active base salary for that employee during the date span, pulls all `APPROVED` bonuses and incentives within the period, and aggregates them into `grossAmount = baseSalary + bonusAmount + incentiveAmount + adjustmentAmount`.
3. **Informational Attendance Integration**: The system queries `Attendance` logs across the selected period to present Present days, Half days, Leaves, and Absent days directly to the reviewer. This gives managers full operational context without automatically deducting compensation.
4. **Sequential Numbering with Concurrency Locks**: Salary record numbers (`SAL-YYYY-000001`) are generated server-side within atomic database transactions protected by PostgreSQL advisory locks (`pg_advisory_xact_lock`), preventing sequence collision or gaps.
5. **Maker-Checker Bonus Approval Workflow**: Bonuses can be initiated as `DRAFT` or `PENDING_APPROVAL`. Authorized managers or administrators can approve or reject bonuses (requiring a documented rejection reason). Rejected bonuses are never counted toward a salary record's gross calculation.
6. **Period Overlap & Duplicate Prevention**: An employee cannot have overlapping or duplicate active salary records for the exact same period, preventing double-compensation across overlapping runs.
7. **Strict Immutability on Approval**: Once approved, a salary record transitions to `APPROVED` and locks all linked bonus records. Approved records cannot be edited. If an approved record was generated in error, authorized users may cancel it by documenting an audit reason, releasing linked bonuses.
8. **Branch Tenancy & Privacy**: Compensation data is protected by dedicated permissions (`salary.*`, `bonus.*`, `increment.*`). Branch managers can only inspect and manage compensation for staff assigned to their branch.

---

## User Roles & Permissions

This module defines 13 granular permissions across salaries, bonuses, and increments:

| Permission | Code | OWNER | ADMIN | MANAGER | STAFF |
|------------|------|:-----:|:-----:|:-------:|:-----:|
| View salary records & history | `salary.read` | ✅ | ✅ | ✅ (Branch) | ❌ |
| Generate salary period/record | `salary.create` | ✅ | ✅ | ✅ (Branch) | ❌ |
| Update draft salary record | `salary.update` | ✅ | ✅ | ✅ (Branch) | ❌ |
| Approve salary record | `salary.approve` | ✅ | ✅ | ❌ | ❌ |
| Cancel salary record | `salary.cancel` | ✅ | ✅ | ❌ | ❌ |
| View bonuses & incentives | `bonus.read` | ✅ | ✅ | ✅ (Branch) | ❌ |
| Propose bonus/incentive | `bonus.create` | ✅ | ✅ | ✅ (Branch) | ❌ |
| Update draft bonus | `bonus.update` | ✅ | ✅ | ✅ (Branch) | ❌ |
| Approve / reject bonus | `bonus.approve` | ✅ | ✅ | ❌ | ❌ |
| Cancel pending bonus | `bonus.cancel` | ✅ | ✅ | ✅ (Branch) | ❌ |
| View salary increment ledger | `increment.read` | ✅ | ✅ | ✅ (Branch) | ❌ |
| Revise salary / record increment | `increment.create` | ✅ | ✅ | ❌ | ❌ |
| Update increment notes | `increment.update` | ✅ | ✅ | ❌ | ❌ |

---

## Data Models

### `SalaryStructure`
- `id`: CUID identifier
- `employeeId`: References `Employee.id`
- `branchId`: References `Branch.id`
- `salary`: Decimal(10, 2)
- `salaryType`: `MONTHLY`, `DAILY`, or `HOURLY`
- `effectiveFrom`: Date
- `effectiveTo`: Date (nullable, NULL signifies current active structure)
- `reason`: String (optional explanation for salary setting)
- `status`: `ACTIVE`, `SUPERSEDED`, or `CANCELLED`
- `createdBy`: User identifier

### `SalaryIncrement`
- `id`: CUID identifier
- `employeeId`: References `Employee.id`
- `branchId`: References `Branch.id`
- `previousSalary`: Decimal(10, 2)
- `newSalary`: Decimal(10, 2)
- `difference`: Decimal(10, 2)
- `percentage`: Decimal(5, 2)
- `effectiveDate`: Date
- `reason`: String
- `notes`: String (optional)
- `status`: `APPLIED` or `CANCELLED`

### `Bonus` & `Incentive`
- `id`: CUID identifier
- `employeeId`: References `Employee.id`
- `branchId`: References `Branch.id`
- `amount`: Decimal(10, 2)
- `type`: `PERFORMANCE`, `FESTIVAL`, `ATTENDANCE`, `SALES_INCENTIVE`, `SPECIAL`, `OTHER`
- `reason`: String
- `bonusDate`: Date
- `status`: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `CANCELLED`
- `rejectionReason`: String (mandatory upon rejection)
- `salaryRecordId`: References `SalaryRecord.id` (set upon period inclusion)

### `SalaryRecord`
- `id`: CUID identifier
- `salaryNumber`: Unique sequential key (e.g. `SAL-2026-000001`)
- `employeeId`: References `Employee.id`
- `branchId`: References `Branch.id`
- `periodStart`: Date
- `periodEnd`: Date
- `baseSalary`: Decimal(10, 2)
- `bonusAmount`: Decimal(10, 2)
- `incentiveAmount`: Decimal(10, 2)
- `adjustmentAmount`: Decimal(10, 2)
- `grossAmount`: Decimal(10, 2)
- `status`: `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `PAID`, `CANCELLED`
- `notes`: String (optional)
- `attendanceSummary`: JSON snapshot containing present, absent, halfDay, leave counts
- `approvedBy`, `approvedAt`: Metadata captured on sign-off

---

## User Flows

### 1. Generating a Salary Period
1. Navigate to `/salary`.
2. Click **Generate Period**.
3. Select an employee and define the period start and end dates.
4. The system evaluates the employee's active salary structure, aggregates approved bonuses/incentives falling in the range, and queries attendance.
5. Review the live breakdown preview and optionally attach notes or adjustments.
6. Click **Generate Record** to create `PENDING_REVIEW` record with sequential `SAL-YYYY-*` number.

### 2. Revising Salary & Logging an Increment
1. Navigate to an employee's profile or `/salary/increments`.
2. Click **Revise Salary**.
3. Enter new compensation, effective start date, and reason.
4. The dialog displays the current salary, computes the net delta (₹) and percentage increase in real time.
5. Submitting supersedes the previous active `SalaryStructure` and records an entry in the increment ledger.

### 3. Bonus Award & Approval Workflow
1. Navigate to `/salary/bonuses`.
2. Click **Award Bonus / Incentive**.
3. Select employee, category (Bonus or Incentive), amount, date, and reason.
4. If submitted as `PENDING_APPROVAL`, an Admin or Owner reviews it on the bonus queue.
5. Approving the bonus makes it eligible for inclusion in the next salary period. Rejecting it requires entering a reason and prevents inclusion.

---

## Verification & Testing Guide

1. **Verify Live Preview Calculation**:
   - Navigate to `/salary`.
   - Open **Generate Period** dialog for an employee with recorded attendance and an approved bonus.
   - Verify that base salary, bonus additions, and attendance tally correctly in the breakdown card.
2. **Verify Sequential Numbering**:
   - Generate two salary periods consecutively and verify sequential `SAL-YYYY-000001`, `SAL-YYYY-000002` generation.
3. **Verify Revision History in Employee Profile**:
   - Open `/employees/[id]`.
   - Verify the **Compensation History & Ledger** tab displays the current structure, past structures, and all increment events.
