# AI Prompt Library

Reusable prompt templates for development tasks. Copy and adapt as needed.

---

## Categories

1. Project setup
2. Feature implementation
3. CRUD implementation
4. API implementation
5. Database changes
6. UI implementation
7. Bug fixing
8. Refactoring
9. Code review
10. Security review
11. Performance optimization
12. Manual testing
13. Regression testing
14. Documentation

---

## Templates

### Feature Implementation

```
# Feature: [Name]

## Context
- Module: [module name]
- Related files: [list key files]
- Dependencies: [list any dependencies]

## Requirements
- [Requirement 1]
- [Requirement 2]

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Constraints
- Follow existing design system tokens
- Use Server Components where possible
- Use shadcn/ui components
- Follow TypeScript strict mode
- Add proper accessible labels
- Handle loading, empty, and error states
```

### Bug Fixing

```
# Bug: [Title]

## Observed Behavior
[What happens]

## Expected Behavior
[What should happen]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]

## Environment
- Browser: [browser]
- Viewport: [size]
- Theme: [light/dark]

## Investigation Notes
- [Any findings]

## Constraints
- Do not introduce new dependencies
- Preserve existing tests
- Fix root cause, not symptoms
```

### Code Review

```
# Code Review: [PR/Change Title]

## Review Checklist
- [ ] TypeScript strict compliance (no `any`)
- [ ] Components use design tokens, not hardcoded values
- [ ] Semantic HTML and accessible labels
- [ ] Responsive at 390px, 768px, 1024px, 1440px
- [ ] Loading, empty, error states handled
- [ ] Server Components used where possible
- [ ] No unnecessary client-side state
- [ ] No inline styles
- [ ] Consistent naming conventions
- [ ] No duplicate UI logic
- [ ] Both themes render correctly
- [ ] No console errors or warnings
```

### Manual Testing

```
# Manual Test: [Feature/Page]

## Test Environment
- Browser: [browser]
- Viewport sizes: 390px, 768px, 1024px, 1440px

## Test Cases

### Functional
- [ ] [Core action works]
- [ ] [Edge case handled]

### Visual
- [ ] Light theme renders correctly
- [ ] Dark theme renders correctly
- [ ] No horizontal overflow at any breakpoint
- [ ] Spacing and alignment consistent

### Accessibility
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Screen reader labels present
- [ ] Contrast ratios sufficient

### States
- [ ] Loading state shows skeletons
- [ ] Empty state shows message and action
- [ ] Error state shows clear message

## Results
- Pass: [count]
- Fail: [count]
- Notes: [any observations]
```

### Authentication & Authorization (RBAC)

```
# Task: Enforce Authorization for [Module/Route/Action]

## Context
- Module: [e.g., Inventory / Branch Management]
- Target Route / Action: [e.g., /branches, createBranchAction]
- Required Permission(s): [e.g., branches.read, branches.create]
- Permitted Roles: [e.g., OWNER, ADMIN]

## Requirements
- Enforce server guard: `requirePermission('[permission.code]')` at Server Component / Server Action boundary
- Do NOT rely solely on client-side or UI navigation hiding
- Update navigation config with `requiredPermission`
- If unauthorized, redirect to `/unauthorized` (403) or return `{ success: false, error: 'Forbidden' }`
- Validate and sanitize input with Zod
- Ensure session validity and user.isActive status

## Verification
- Test access as permitted role -> succeeds
- Test direct access as unpermitted role -> rejected by server (403)
- Test unauthenticated access -> redirected to login
- Test UI visibility -> navigation item hidden for unpermitted role
```

### CRUD Feature Implementation

```
# CRUD Feature: [Entity Name] Management

## Context
- Entity: [Entity name] (e.g., Branch, Employee, MenuItem)
- Dependencies: [Entities this depends on, e.g., Branch → none, Employee → Branch]
- Module permission prefix: [e.g., branch, employee]

## Database Model (Prisma)
- Model name: [Entity]
- Key fields: [list fields with types]
- Unique constraints: [e.g., code @unique]
- Indexes: [justified by expected queries]
- Status enum if applicable: [e.g., ACTIVE/INACTIVE]
- Soft deletion: [yes/no, explain rationale]

## Permissions (extend existing RBAC)
- [entity].read — View list and details
- [entity].create — Create new records
- [entity].update — Edit existing records
- [entity].deactivate — Toggle status (if applicable)
- Assign to roles: OWNER (all), ADMIN (read/create/update), MANAGER (read), STAFF (read)
- Add to seed.ts, definitions.ts, navigation.ts

## Validation (Zod schemas in src/lib/validations/[entity].ts)
- createSchema — all fields with validation rules
- updateSchema — same but omit immutable fields
- Share between client and server

## Server Actions (src/lib/[entity]/actions.ts)
Pattern: Auth → Permission → Validation → DB → Response
- getAll(params?) — list with search/filter, requires [entity].read
- getById(id) — single record, requires [entity].read
- create(data) — create, requires [entity].create
- update(id, data) — update, requires [entity].update
- toggleStatus(id) — activate/deactivate, requires [entity].deactivate
- getStats() — aggregate counts, requires [entity].read
All actions return ActionResult<T>. Re-throw Next.js redirect errors.

## Pages
- /[entities] — Server Component, requirePermission guard, SSR data fetch
- /[entities]/[id] — Server Component, detail page with generateMetadata

## Components (src/components/[entities]/)
- [Entity]ListClient — search, filter, table, summary cards, action menus
- [Entity]FormDialog — reusable create/edit dialog with client+server validation
- [Entity]StatusDialog — confirmation dialog for activate/deactivate
- [Entity]DetailClient — organized detail view with info sections

## States
- Loading: TableSkeleton, CardSkeleton
- Empty: EmptyState with CTA
- Error: Toast + inline messages
- Pending: Button loading state, prevent double submit

## Verification
- pnpm lint && pnpm build
- Manual CRUD testing
- Authorization testing per role
- Responsive testing at 390px, 768px, 1024px, 1440px
```

### Employee / Staff Management Pattern

```
# Module: Employee Management

## Distinction: Employee vs. User
- User = system login account (email, password, sessions, RBAC role)
- Employee = physical restaurant staff (kitchen, service, delivery, management)
- Optional 1:1 link via nullable userId (explicit linking only, never automatic)
- Never store authentication credentials inside Employee

## Data Model (PostgreSQL + Prisma)
- Employee: id, employeeCode (unique, immutable), firstName, lastName, phone, email?, dateOfBirth?, joiningDate, designation, branchId, employmentStatus (ACTIVE/INACTIVE), salary, salaryType (MONTHLY/DAILY/HOURLY), address?, emergencyContactName?, emergencyContactPhone?, userId?
- Foreign Keys: Branch (1:N, onDelete: Restrict), User (1:1 optional, onDelete: SetNull)
- Controlled soft-delete: never hard-delete staff records; preserve historical records

## RBAC & Security
- Permissions: employee.read, employee.create, employee.update, employee.deactivate
- Server Actions enforce requirePermission + Branch scoping
- Never trust client-side branchId or hidden fields
```

### Attendance & Shift Management Pattern

```
# Module: Attendance & Shift Management

## Entity Architecture
- Employee → Branch → Shift → Attendance
- Shift: id, name, branchId, startTime (HH:mm), endTime (HH:mm), status (ACTIVE/INACTIVE)
- Attendance: id, employeeId, branchId, shiftId?, date (@db.Date), status (PRESENT/ABSENT/HALF_DAY/LEAVE), checkIn?, checkOut?, lateMinutes, earlyDepartureMinutes, note?, markedBy
- Historical Preservation: Attendance retains snapshot shiftId; changing employee currentShiftId never mutates past logs
- Database Uniqueness: @@unique([employeeId, date]) prevents duplicate records per employee per day

## Calculations & Facts
- Late minutes: checkIn > shiftStart ? (checkIn - shiftStart) : 0
- Early departure: checkOut < shiftEnd ? (shiftEnd - checkOut) : 0
- Overnight shifts: if endTime < startTime, shiftEnd = shiftEnd + 24 hours
- Lateness & departures are recorded as facts, not automatic financial deductions

## RBAC & Security
- Permissions: attendance.read, attendance.create, attendance.update, shift.read, shift.create, shift.update, shift.deactivate
- Strict exclusion: NO attendance.delete (attendance is historical business data)
- Server-side branch scoping: OWNER/ADMIN have global access; MANAGER is strictly scoped to assigned branch
- Cross-entity validation: employee.branchId === branchId && shift.branchId === branchId
- STAFF cannot view or modify other staff attendance
```



