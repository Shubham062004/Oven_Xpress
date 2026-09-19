# Authentication & Role-Based Access Control (RBAC)

Oven Xpress implements a centralized authentication and role-based authorization system designed for multi-branch restaurant operations.

---

## 1. Authentication Architecture

Authentication is powered by:
- **Prisma ORM** with **PostgreSQL** for user and session persistence.
- **bcryptjs** (salt rounds = 12) for secure password hashing.
- **HTTP-only, Secure SameSite=Lax cookies** (`ox_session`) for session persistence with a 7-day TTL.
- **Next.js Server Actions** for form submission and session teardown.

> [!NOTE]
> Registration is intentionally omitted in this phase. Accounts are provisioned centrally by restaurant owners and administrators.

---

## 2. Session Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Browser
    participant Page as Login UI (/login)
    participant Action as loginAction (Server Action)
    participant DB as PostgreSQL (Prisma)
    participant Cookie as Cookie Store (ox_session)

    User->>Page: Submits email & password
    Page->>Action: POST credentials (FormData)
    Action->>Action: Zod validation (email format, required fields)
    Action->>DB: Query user by email
    alt User not found or password incorrect
        Action-->>Page: Return generic "Invalid email or password"
    else User is inactive (isActive == false)
        Action-->>Page: Return "Account is deactivated"
    else Authentication succeeds
        Action->>DB: Create Session record (token, userId, expiresAt)
        Action->>Cookie: Set HTTP-only, secure cookie (ox_session)
        Action-->>User: Redirect to callbackUrl or /
    end
```

### Logout Flow
1. User clicks **Sign Out** in the header profile menu or unauthorized page.
2. `logoutAction` calls `destroySession()`:
   - Deletes the active `Session` record from the database.
   - Clears the `ox_session` HTTP-only cookie.
3. Redirects the browser to `/login`.

---

## 3. Role Hierarchy & Permission Model

### Roles
| Role | Description | Scope |
|------|-------------|-------|
| **OWNER** | Restaurant Owner | Full system access across all modules, settings, and branches |
| **ADMIN** | System Administrator | User management, branch config, operational oversight (no owner deletion) |
| **MANAGER** | Branch Manager | Staff overview, operational reports, daily store management |
| **STAFF** | Branch Staff | Operational dashboard and shift tasks |

### Granular System Permissions
| Permission Code | Module | Description |
|-----------------|--------|-------------|
| `dashboard.read` | dashboard | View overview dashboard and metrics |
| `users.read` | users | View user list and staff profiles |
| `users.create` | users | Create new staff / application users |
| `users.update` | users | Edit existing user details and roles |
| `users.delete` | users | Deactivate or delete user accounts |
| `settings.read` | settings | View system and branch settings |
| `settings.update` | settings | Modify system and branch settings |

### Role-to-Permission Mapping
- **OWNER**: Universal access (bypasses permission checks).
- **ADMIN**: `dashboard.read`, `users.read`, `users.create`, `users.update`, `settings.read`.
- **MANAGER**: `dashboard.read`, `users.read`, `settings.read`.
- **STAFF**: `dashboard.read`.

---

## 4. Protected Route Strategy

Authorization is enforced at multiple execution boundaries:

### A. Edge Perimeter (`middleware.ts`)
- Inspects the request for the `ox_session` cookie.
- Unauthenticated requests to protected paths (`/`, `/settings`, `/users`, etc.) are redirected to `/login?callbackUrl=...`.
- Authenticated requests to `/login` are automatically redirected to `/`.

### B. Server Component Execution Boundary (`(dashboard)/layout.tsx`)
- Server-side guard `await requireAuthentication()` verifies the session against the database, checks `expiresAt`, and confirms `user.isActive === true`.
- If invalid or expired, deletes the cookie and redirects to `/login`.

### C. Granular Action / Route Guards (`src/lib/auth/guards.ts`)
- `requireRole(roles: string[])`: Enforces specific roles, redirecting unauthorized users to `/unauthorized` (403).
- `requirePermission(permission: string)`: Enforces granular permissions, redirecting unauthorized users to `/unauthorized` (403).

### D. Navigation Visibility (`src/components/layout/sidebar.tsx`)
- Navigation items in `mainNavItems` and `bottomNavItems` specify an optional `requiredPermission`.
- If a user lacks the permission, the item is omitted from the UI navigation.
- **Important**: Navigation visibility is only a UX convenience; server guards enforce actual security.

---

## 5. Environment Variables

| Variable | Description | Example / Default |
|----------|-------------|-------------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/oven_xpress?schema=public` |
| `AUTH_SECRET` | Secret key for session security | Min 32 random characters |
| `SEED_OWNER_EMAIL` | Development Owner email | `owner@ovenxpress.com` |
| `SEED_OWNER_PASSWORD` | Development Owner password | `Owner123!` |
| `SEED_ADMIN_EMAIL` | Development Admin email | `admin@ovenxpress.com` |
| `SEED_ADMIN_PASSWORD` | Development Admin password | `Admin123!` |
| `SEED_MANAGER_EMAIL` | Development Manager email | `manager@ovenxpress.com` |
| `SEED_MANAGER_PASSWORD` | Development Manager password | `Manager123!` |
| `SEED_STAFF_EMAIL` | Development Staff email | `staff@ovenxpress.com` |
| `SEED_STAFF_PASSWORD` | Development Staff password | `Staff123!` |
| `SEED_INACTIVE_EMAIL` | Development Inactive user | `inactive@ovenxpress.com` |
| `SEED_INACTIVE_PASSWORD` | Development Inactive password | `Inactive123!` |

---

## 6. Development Seed

To populate the database with permissions, roles, and test users:

```bash
# Push schema changes to the database
pnpm prisma db push

# Run the seed script
pnpm prisma db seed
```

---

## 7. Manual Testing Procedure

### Credentials Matrix
| Persona | Email | Password | Role | Allowed Routes |
|---------|-------|----------|------|----------------|
| **Owner** | `owner@ovenxpress.com` | `Owner123!` | OWNER | `/`, `/users`, `/settings`, all |
| **Admin** | `admin@ovenxpress.com` | `Admin123!` | ADMIN | `/`, `/users`, `/settings` |
| **Manager** | `manager@ovenxpress.com` | `Manager123!` | MANAGER | `/`, `/users`, `/settings` |
| **Staff** | `staff@ovenxpress.com` | `Staff123!` | STAFF | `/` (Blocked on `/settings`, `/users`) |
| **Inactive** | `inactive@ovenxpress.com` | `Inactive123!` | STAFF (Inactive) | None (Login blocked) |

### Test Cases
1. **Invalid Input**: Submit empty email/password -> verify field validation messages.
2. **Wrong Password**: Submit valid email with wrong password -> verify generic error.
3. **Inactive User**: Submit `inactive@ovenxpress.com` -> verify account deactivated message.
4. **Successful Login**: Login as Owner -> verify header shows "Sarah Jenkins", OWNER badge, and initials "SJ".
5. **Staff Access Boundary**:
   - Login as Staff (`staff@ovenxpress.com`).
   - Notice `/settings` and `/users` are hidden from sidebar.
   - Manually type `http://localhost:3000/settings` in browser -> verify immediate redirect to `/unauthorized` (403 Access Denied).
6. **Session Persistence**: Refresh page -> user remains logged in.
7. **Sign Out**: Click User menu in header -> click "Sign out" -> verify redirected to `/login`, cookie destroyed.
