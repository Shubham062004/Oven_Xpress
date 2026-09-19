# Feature Documentation: Attendance & Shift Management

## 1. Overview & Purpose

The **Attendance & Shift Management** module enables multi-branch restaurant administrators and branch managers to organize work schedules, define operational shifts per branch, record daily staff attendance (Present, Absent, Half-Day, Approved Leave), track late arrivals and early departures, perform authorized historical corrections, and monitor attendance metrics across branches.

In the restaurant industry, shift schedules vary significantly by branch (e.g., bakery morning preparation shifts, peak dining rush shifts, overnight kitchen cleaning shifts). This module models shifts on a per-branch basis, links employees to shifts without permanently rewriting historical records, and provides precise operational attendance logging.

---

## 2. Core Business Entity Relationships

```
Employee (Physical person)
   ↓
Branch (Physical restaurant location)
   ↓
Shift (Operational working hours schedule)
   ↓
Attendance Record (Daily logged attendance with check-in/out timestamps)
```

### Key Architectural Tenets:
1. **No Duplicate Employee or Branch Data**: Attendance records strictly reference existing `Employee` and `Branch` entities via foreign keys.
2. **Shift Independence Across Branches**: Shifts belong to specific branches. A "Morning Shift" in Branch A can have different hours (07:00–15:00) than a "Morning Shift" in Branch B (09:00–17:00).
3. **Historical Data Integrity**:
   - Each `Attendance` record stores its own snapshot reference to `shiftId` at the time attendance was logged.
   - An employee's `currentShiftId` on their `Employee` record indicates their *current* active schedule.
   - Changing an employee's current shift assignment never mutates past historical attendance logs.
4. **1 Record Per Employee Per Day**:
   - Enforced by a PostgreSQL database uniqueness constraint: `@@unique([employeeId, date])`.
   - Prevents accidental duplicates and double counting.

---

## 3. Data Models

### PostgreSQL + Prisma Schema

```prisma
enum ShiftStatus {
  ACTIVE
  INACTIVE
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  HALF_DAY
  LEAVE
}

model Shift {
  id          String      @id @default(cuid())
  name        String      // e.g. "Morning Shift", "Evening Rush"
  branchId    String
  branch      Branch      @relation(fields: [branchId], references: [id], onDelete: Restrict)
  startTime   String      // HH:mm format (e.g. "09:00")
  endTime     String      // HH:mm format (e.g. "17:00")
  status      ShiftStatus @default(ACTIVE)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  attendances Attendance[]
  employees   Employee[]

  @@index([branchId])
  @@index([status])
}

model Attendance {
  id                    String           @id @default(cuid())
  employeeId            String
  employee              Employee         @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  branchId              String
  branch                Branch           @relation(fields: [branchId], references: [id], onDelete: Restrict)
  shiftId               String?
  shift                 Shift?           @relation(fields: [shiftId], references: [id], onDelete: SetNull)
  date                  DateTime         @db.Date
  status                AttendanceStatus @default(PRESENT)
  checkIn               DateTime?
  checkOut              DateTime?
  lateMinutes           Int              @default(0)
  earlyDepartureMinutes Int              @default(0)
  note                  String?
  markedBy              String?          // Audit trail: user name who marked/updated
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  @@unique([employeeId, date])
  @@index([branchId, date])
  @@index([employeeId, date])
  @@index([status])
  @@index([shiftId])
}
```

---

## 4. Permissions & RBAC

The module extends the system's role-based access control matrix with seven granular permissions:

| Permission Code | Description | OWNER | ADMIN | MANAGER | STAFF |
|---|---|:---:|:---:|:---:|:---:|
| `attendance.read` | View attendance directory, logs, and summaries | ✅ | ✅ | ✅ | ❌ |
| `attendance.create` | Mark attendance, record check-in/out | ✅ | ✅ | ✅ | ❌ |
| `attendance.update` | Correct attendance entries, update remarks | ✅ | ✅ | ✅ | ❌ |
| `shift.read` | View branch shifts and schedules | ✅ | ✅ | ✅ | ❌ |
| `shift.create` | Create new branch work shifts | ✅ | ✅ | ✅ | ❌ |
| `shift.update` | Update shift timings and names | ✅ | ✅ | ✅ | ❌ |
| `shift.deactivate` | Activate or deactivate branch shifts | ✅ | ✅ | ❌ | ❌ |

> [!NOTE]
> - `attendance.delete` is deliberately excluded. Attendance records are permanent historical audit business records.
> - `STAFF` members cannot view or tamper with other employees' attendance.

---

## 5. Server-Side Authorization & Branch Scoping

Every server action executes the strict 5-stage pipeline:
```
1. Authentication (valid session cookie)
   ↓
2. Permission Check (requirePermission guard)
   ↓
3. Branch Scope Resolution (Owner/Admin = universal; Manager = strictly scoped to assigned branch)
   ↓
4. Cross-Entity Validation (Employee.branchId === branchId && Shift.branchId === branchId)
   ↓
5. Database Operation
```

### Cross-Entity Branch Validation
The server verifies:
1. `Employee` exists, is active, and their `branchId` matches the operation's `branchId`.
2. If `shiftId` is provided, `Shift` exists and its `branchId` matches the operation's `branchId`.
3. A manager cannot record or correct attendance for any branch other than their assigned branch, even if they attempt direct RPC calls.

---

## 6. Business Calculations & Rules

### 1. Date Normalization
- Attendance calendar dates are stored using PostgreSQL `@db.Date`, normalized to UTC midnight (`YYYY-MM-DDT00:00:00.000Z`).
- This guarantees that date comparisons and the unique constraint `@@unique([employeeId, date])` remain completely immune to client/server timezone offsets.

### 2. Late Arrival Calculation
- If an attendance record has a recorded `checkIn` and an associated `shift`:
  ```
  shiftStart = combine(date, shift.startTime)
  if (checkIn > shiftStart) {
    lateMinutes = floor((checkIn - shiftStart) / 60000)
  } else {
    lateMinutes = 0
  }
  ```
- Fact-recording: Lateness is logged purely as an operational fact and does not automatically penalize or deduct pay at this layer.

### 3. Early Departure Calculation & Overnight Shifts
- If an attendance record has a recorded `checkOut` and an associated `shift`:
  ```
  shiftEnd = combine(date, shift.endTime)
  if (shift.endTime < shift.startTime) {
    // Overnight shift: shift ends on next calendar day (+24 hours)
    shiftEnd = shiftEnd + 24 hours
  }
  if (checkOut < shiftEnd) {
    earlyDepartureMinutes = floor((shiftEnd - checkOut) / 60000)
  } else {
    earlyDepartureMinutes = 0
  }
  ```

### 4. Status Rules
- `PRESENT`: Full-day attendance. Can have check-in and check-out times.
- `HALF_DAY`: Partial working day entered manually by authorized managers.
- `ABSENT`: Unplanned absence / no-show. Times are cleared/null.
- `LEAVE`: Approved leave with optional remarks/reason. Times are cleared/null.

---

## 7. User Interface Features

1. **Daily Attendance Tab**:
   - Date navigation bar with quick shortcuts ("Yesterday", "Today", "Next Day") and custom date picker.
   - Summary Metric KPI Cards: Total Active Staff, Present, Absent, Half-Day, On Leave, Late Arrivals, Early Departures.
   - Multi-Filter Bar: Search (Name, Code, Designation), Branch dropdown, Employee dropdown, Shift dropdown, Status dropdown.
   - Desktop Table with Status badges, check-in/out timestamps with late/early pills, and quick check-out action button.
   - Responsive Mobile Cards layout tailored for on-the-floor restaurant managers.
2. **Shift Schedules Tab**:
   - Multi-branch shift filter.
   - Create shift and edit shift dialogs with live duration calculations and overnight shift hints.
   - Shift activation / deactivation dialog.
3. **Attendance Details Page (`/attendance/[id]`)**:
   - Employee profile details.
   - Detailed timing breakdown: Scheduled shift hours vs. actual check-in/check-out.
   - Calculated late minutes and early departure badges.
   - Full audit trail (Marked by, Created at, Last updated at).
   - In-place correction dialog for authorized managers.

---

## 8. Verification & Edge Cases Handled

- **Duplicate attendance on the same date**: Prevented by database unique constraint `@@unique([employeeId, date])` and server-side pre-validation.
- **Cross-branch entity mismatch**: Server rejects attempts to assign a Shift from Branch B to an Employee in Branch A.
- **Overnight shifts**: Shifts spanning midnight (e.g. 21:00 to 05:00) correctly compute shift duration and early departures.
- **Manager branch tampering**: Manager accounts cannot access or mutate records from other branches.
- **Check-out earlier than check-in**: Handled gracefully; if overnight check-out is before check-in time, 24 hours are added to check-out.
