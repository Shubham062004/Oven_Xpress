# Feature Documentation: Employee / Staff Management

## 1. Overview & Purpose

The **Employee Management** module provides multi-branch restaurant administrators with the tools to onboard, organize, track, and maintain physical restaurant personnel across different branches.

Staff members in a restaurant include kitchen staff, head chefs, servers, cleaners, cashiers, delivery drivers, and branch managers. 

---

## 2. Key Architectural Distinction: Employee vs. User

> [!IMPORTANT]
> **Employee and User are strictly separate entities.**
> - **`User`** represents a **software application account** with authentication credentials (email, password hash), user sessions, and RBAC roles for logging into the dashboard.
> - **`Employee`** represents a **person working physically at the restaurant**.

Key implications:
1. **Employees without Accounts**: The vast majority of physical staff (e.g., line cooks, dishwashers, delivery staff) work on-site and do not require software accounts.
2. **Employees with Accounts**: Branch managers, head chefs, or senior staff who need access to the management software can have their `Employee` record explicitly linked to a `User` account via the optional `userId` foreign key.
3. **No Credential Duplication**: Authentication credentials (passwords, tokens) are never stored inside the `Employee` model.
4. **Explicit Linking**: Account linking is purely voluntary and explicit. Creating an employee never automatically provisions a user account or auto-generates credentials.

---

## 3. Data Model

### PostgreSQL + Prisma Schema

```prisma
enum EmploymentStatus {
  ACTIVE
  INACTIVE
}

enum SalaryType {
  MONTHLY
  DAILY
  HOURLY
}

model Employee {
  id                    String           @id @default(cuid())
  employeeCode          String           @unique
  firstName             String
  lastName              String
  phone                 String
  email                 String?
  dateOfBirth           DateTime?
  joiningDate           DateTime
  designation           String
  branchId              String
  branch                Branch           @relation(fields: [branchId], references: [id], onDelete: Restrict)
  employmentStatus      EmploymentStatus @default(ACTIVE)
  salary                Decimal          @db.Decimal(10, 2)
  salaryType            SalaryType       @default(MONTHLY)
  address               String?
  emergencyContactName  String?
  emergencyContactPhone String?
  userId                String?          @unique
  user                  User?            @relation(fields: [userId], references: [id], onDelete: SetNull)
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  @@index([branchId])
  @@index([employmentStatus])
  @@index([phone])
  @@index([joiningDate])
  @@index([designation])
}
```

### Relationships
- **Branch → Employee (`1:N`)**: Each employee must belong to a branch (`branchId` references `Branch.id`). When a branch is queried, its employees can be resolved via `Branch.employees`. Deleting a branch with active employees is restricted (`onDelete: Restrict`).
- **User → Employee (`1:1 optional`)**: An employee can optionally link to a single `User` account (`userId` references `User.id`). If a user account is deleted, the employee record remains intact with `userId` set to null (`onDelete: SetNull`).

---

## 4. Permissions & RBAC

The module extends the system's role-based access control matrix with four granular permissions:

| Permission Code | Description | OWNER | ADMIN | MANAGER | STAFF |
|---|---|:---:|:---:|:---:|:---:|
| `employee.read` | View employee directory and staff profiles | ✅ | ✅ | ✅ | ❌ |
| `employee.create` | Onboard new staff members | ✅ | ✅ | ✅ | ❌ |
| `employee.update` | Edit staff personal, job, and compensation details | ✅ | ✅ | ✅ | ❌ |
| `employee.deactivate` | Activate or deactivate employees | ✅ | ✅ | ❌ | ❌ |

---

## 5. Business Rules

1. **Unique Employee Code**: Every staff member has a human-readable identifier (e.g. `EMP-0001`). Duplicate employee codes are rejected server-side.
2. **Code Immutability**: Once created, `employeeCode` is immutable to preserve historical continuity across payroll, orders, and attendance.
3. **Active Branch Requirement**: Active employees can only be assigned to active branches. If a branch is inactive, active staff cannot be assigned to it.
4. **No Hard Deletion**: Staff are never permanently deleted through the normal UI. Deactivation toggles status between `ACTIVE` and `INACTIVE` while preserving historical records.
5. **Non-Negative Compensation**: Salary must be non-negative (`salary >= 0`) with a valid salary schedule (`MONTHLY`, `DAILY`, `HOURLY`).
6. **Explicit User Linking**: User accounts can only be linked if the account exists, is active, and is not already linked to another employee.
7. **Server-Side Authorization**: Every mutation re-verifies session authenticity, role permissions, and branch scoping on the server.

---

## 6. Input Validation (Zod)

Validation is performed both client-side before submission and server-side in server actions (`src/lib/validations/employee.ts`):

- **`firstName` & `lastName`**: Required, trimmed, 1-50 characters.
- **`employeeCode`**: Required, 2-20 characters, uppercase alphanumeric and hyphens (`^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$|^[A-Z0-9]$`).
- **`phone`**: Required, permissive international regex (7-20 digits).
- **`email`**: Optional; if provided, must be a valid email.
- **`designation`**: Required, trimmed, 1-100 characters.
- **`branchId`**: Required valid branch ID.
- **`joiningDate`**: Required ISO date.
- **`salary`**: Coerced number >= 0.
- **`salaryType`**: Enum (`MONTHLY`, `DAILY`, `HOURLY`).
- **`emergencyContactName` & `emergencyContactPhone`**: Optional emergency contact info.
- **`userId`**: Optional string or null for user linking.

---

## 7. User Flows

### Onboarding a New Employee
1. Navigate to `/employees`.
2. Click **Add Employee**.
3. Fill out Personal Details (First/Last name, phone, optional email, date of birth, address).
4. Fill out Employment Details (Employee Code, Designation, Assigned Branch, Joining Date).
5. Enter Base Compensation (Salary amount, frequency).
6. Optionally provide Emergency Contact details and link an existing User account.
7. Submit the form; upon success, the table refreshes and a confirmation toast appears.

### Deactivating an Employee
1. In `/employees` table or on the `/employees/[id]` detail page, click **Deactivate**.
2. A confirmation modal appears explicitly stating that historical attendance, order, and compensation records are preserved.
3. Confirming deactivates the employee immediately.

### Searching and Filtering Staff
1. Search across name, code, phone, or email with automated 300ms debouncing.
2. Filter by Branch to view staff in a specific restaurant location.
3. Filter by Status (`Active` / `Inactive`).
4. Filter by Designation (e.g. `Head Chef`, `Server`).
5. Click **Reset** to clear all active filters simultaneously.

---

## 8. Manual Testing Checklist

- [ ] **Create Valid Employee**: Onboard a staff member without a login account. Verify table displays code, name, designation, branch, and salary.
- [ ] **Duplicate Code Check**: Try creating an employee with existing code `EMP-0001`. Verify server action returns clear field-level error.
- [ ] **Account Linking**: Create or edit an employee and select an unlinked User account. Verify detail page displays linked user badge and role.
- [ ] **Deactivate Employee**: Deactivate an active employee. Verify badge changes to "Inactive" and summary stats decrement.
- [ ] **Reactivate Employee**: Reactivate an inactive employee. Verify status restores to "Active".
- [ ] **Search & Debounce**: Search by partial name, code, or phone. Verify list updates after 300ms without flickering.
- [ ] **Responsive Test**: Inspect at 390px (mobile cards), 768px (condensed tablet table), and 1440px (full desktop table).
- [ ] **Unauthorized Access**: Log in as `STAFF` user and verify access to `/employees` is blocked with unauthorized redirect.
