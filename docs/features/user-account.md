# User Account, Profile & Authentication Experience

## 1. Overview & Architecture

The **User Account & Profile Experience** provides a secure, self-service account management hub for authenticated users across all organizational roles (Owner, Admin, Manager, Staff). It extends the existing multi-branch RBAC architecture without modifying core authentication primitives, providing a seamless user-facing account management layer.

### Core Architecture Principles:
1. **Zero Trust / Strict Server-Side Authority**:
   - The client never dictates `userId`, `role`, `branchId`, or permissions.
   - All server actions strictly read the authenticated user identity from the server-validated session cookie (`requireAuthentication()`).
2. **Entity Separation**:
   - `User` (identity, authentication credentials, preferences, sessions) and `Employee` (staff employment code, branch affiliation, designation, joining date) are separate entities.
   - The Profile view seamlessly aggregates both without duplicating employee management functions.
3. **Defense-in-Depth Session Revocation**:
   - Changing credentials or signing out invalidates sessions server-side in PostgreSQL.
   - Multi-session support allows users to inspect active devices and revoke other sessions while maintaining their current session.
4. **Private Storage Integration**:
   - Profile avatars are processed and validated on the server with magic byte inspection and stored using Azure Blob Storage (with local disk fallback for offline development).

---

## 2. User Menu & Navigation

### Header Account Menu (`src/components/layout/header.tsx`)
The application header features a contextual account menu:
- **Trigger**: Displays user avatar (with fallback to calculated 2-letter initials), full name, user role badge (`OWNER`, `ADMIN`, `MANAGER`, `STAFF`), and operational branch context.
- **Dropdown Options**:
  - **Profile** (`/profile`): Complete profile overview and personal identity details.
  - **Account Settings** (`/profile?tab=account`): Quick link to account metadata and profile settings.
  - **Change Password** (`/profile/password`): Dedicated credential update interface.
  - **Preferences** (`/profile?tab=preferences`): Workspace ergonomics, theme, density, and date range.
  - **Sign out**: Server-side session invalidation and redirect to login.

### Mobile Navigation Support (`src/components/layout/mobile-sidebar.tsx`)
- The mobile sheet menu includes a direct "My Profile" navigation item with proper viewport constraints.
- Header dropdown employs responsive positioning (`align="end"`, `max-w-[calc(100vw-2rem)]`) ensuring clean mobile and tablet rendering without horizontal overflow.

---

## 3. Profile Management (`/profile`)

The Profile page provides 4 dedicated tabs:

### A. Profile Overview
- **Personal Information**: First name, last name, email (read-only with security notice), contact phone number.
- **Employment Context**: If linked to an Employee record, displays Employee Code (`EMP-XXXXX`), Designation, Assigned Branch, and Joining Date. For Corporate Administrators (Owner/Admin without employee link), indicates Universal Multi-Branch Authority.
- **Account Identity & Status**: Account created date, last updated timestamp, password last changed date, and active session count.

### B. Edit Profile (`updateProfileAction`)
- **Allowed Self-Editable Fields**:
  - First Name (`firstName`: string, max 50 chars)
  - Last Name (`lastName`: string, max 50 chars)
  - Phone Number (`phone`: string, max 20 chars)
  - Avatar Image URL (`avatarUrl`: optional URL or upload reference)
- **Strictly Protected Administrative Fields**:
  - `role`, `permissions`, `branchId`, `salary`, `employeeCode`, `employmentStatus`, `isActive`.
  - Any attempted mass-assignment or injection of administrative fields is stripped and rejected by Zod validation schemas.
- **Persistence**: Updates the `User` record and synchronizes first name, last name, and phone with the linked `Employee` record in an atomic transaction.
- **Audit Logging**: Emits `PROFILE_UPDATED` with before and after snapshots of safe fields.

### C. Password & Security (`changePasswordAction`)
- **Dedicated Route**: `/profile/password` and embedded form within `/profile?tab=security`.
- **Requirements & Complexity**:
  - Minimum 8 characters, maximum 128 characters.
  - At least one uppercase letter (`A-Z`).
  - At least one lowercase letter (`a-z`).
  - At least one number (`0-9`).
  - At least one special symbol (`!@#$%^&*`).
  - Cannot be a commonly guessed weak dictionary password.
  - New password must differ from current password.
  - Confirmation password must match exactly.
- **Cryptographic Security**: Hashed using `bcryptjs` with 12 salt rounds.
- **Session Revocation**: Automatically terminates all other active sessions across devices while preserving the current session.
- **Audit Logging**: Emits `PASSWORD_CHANGED` with `revokedOtherSessions` count. Plaintext passwords or hashes are never logged.

### D. Active Sessions & Device Management (`revokeOtherSessionsAction`)
- Lists all active database sessions for the authenticated user.
- Highlights current session with "This device" badge.
- Displays device/browser info, IP address, creation time, and expiration time.
- **Sign Out Other Sessions**: Button invalidates all active sessions for the user except the current token.
- **Audit Logging**: Emits `OTHER_SESSIONS_REVOKED` with count.

### E. Workspace Preferences (`updateUserPreferencesAction`)
- **Theme**: Light, Dark, System default with instant toggle via `next-themes`.
- **Table Density**: Comfortable (standard) vs. Compact (dense) for tables and financial ledgers.
- **Default Date Range**: Today, Yesterday, 7d, 30d, 90d.
- **Default Active Branch**: Allows multi-branch users to select their preferred initial branch context.
- **Audit Logging**: Emits `USER_PREFERENCE_UPDATE`.

---

## 4. Logout Implementation (`logoutAction`)

Logout is enforced strictly server-side:
1. Validates current session token from the secure HTTP-only `ox_session` cookie.
2. Inactivates/deletes the session record in PostgreSQL (`prisma.session.deleteMany`).
3. Deletes the `ox_session` cookie in the client response.
4. Records structured audit event `AUTH_LOGOUT`.
5. Redirects to `/login`.
6. Subsequent navigation or page refresh will fail middleware session checks and force redirect to `/login`.

---

## 5. Avatar Storage Architecture

- **Storage Service**: Uses Azure Blob Storage (`restaurant-files` container under `avatars/` path) with fallback to local persistent disk storage.
- **Validation**:
  - MIME types allowed: `image/jpeg`, `image/png`, `image/webp`.
  - Max file size: 2MB.
  - Magic byte verification: Validates binary file headers to prevent MIME spoofing.
  - Non-deterministic filenames: `avatar-${userId}-${Date.now()}.${ext}` preventing file collisions or path traversal.
- **Serving Endpoint**: `GET /api/uploads/avatar/[filename]` with content security headers and client caching.

---

## 6. Audit Events Contract

| Event Action | Entity Type | Description |
| :--- | :--- | :--- |
| `AUTH_LOGOUT` | `SESSION` | User logged out; session terminated in database. |
| `PROFILE_UPDATED` | `USER` | User modified personal profile details (before/after safe diff). |
| `PASSWORD_CHANGED` | `USER` | User changed login password; other sessions revoked. |
| `OTHER_SESSIONS_REVOKED` | `SESSION` | User terminated all other concurrent active sessions. |
| `USER_PREFERENCE_UPDATE` | `USER_PREFERENCE` | User updated personal theme, table density, or date range. |

---

## 7. Verification & Test Coverage

Run the automated test suite:
```bash
npx tsx scripts/verify-user-account.ts
```
The test suite verifies:
- `AUTH-01` to `AUTH-04`: Login resolution, profile retrieval, organizational employee context.
- `AUTH-05` to `AUTH-07`: Profile editing, propagation to employee, rejection of restricted fields.
- `AUTH-08` to `AUTH-10`: Password change validation, bcrypt verification, mismatch rejection, weak password rejection.
- `AUTH-11` to `AUTH-14`: Logout invalidation, multi-session revocation, token purging.
- `AUTH-15` to `AUTH-17`: IDOR protection, branch immutability, role tampering prevention.
- `AUTH-18` to `AUTH-19`: Responsive account menu, avatar MIME/magic bytes validation.
- `AUTH-20` to `AUTH-22`: Clean ESLint, production build, regression checks on existing auth and settings.
