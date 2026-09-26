# Session Management & Strict 10-Minute Expiration

## 1. Overview & Policy

Oven Xpress enforces a strict, absolute session expiration policy:

- **Session Lifetime:** Exactly **10 minutes (600 seconds)** from creation.
- **Expiration Type:** Absolute lifetime. Normal API requests or page navigations do **not** silently slide or extend the session lifetime indefinitely.
- **Source of Truth:** The server (`PostgreSQL` database and `validateSession()` guard) is the authoritative determinant of validity.
- **Client UX Layer:** A non-intrusive yet non-dismissible client-side timeout watcher alerts the user with an amber security modal when the 10-minute window has elapsed, synchronizing across all open browser tabs and preventing silent form submissions on stale sessions.

---

## 2. Server-Side Enforcement

### 2.1 Centralized Session Validation (`src/lib/auth/session.ts`)

Every protected server request evaluates session validity through `validateSession()`:

```typescript
export const SESSION_TTL_SECONDS = 10 * 60; // 600 seconds (10 minutes)

export async function validateSession(): Promise<SessionValidationResult> {
  // 1. Retrieve ox_session cookie
  // 2. Fetch session and user relations from database
  // 3. Verify session exists in DB
  // 4. Check if session.expiresAt <= now:
  //    - Purges expired session from database
  //    - Deletes ox_session cookie on client response
  //    - Records AUTH_SESSION_EXPIRED in audit log and security logger
  //    - Returns { status: 'EXPIRED', code: 'AUTH_SESSION_EXPIRED', error: '...' }
  // 5. Verify user isActive
  // 6. Return { status: 'VALID', session, user, expiresAt, remainingSeconds }
}
```

### 2.2 Route & Server Action Guards (`src/lib/auth/guards.ts`)

- `requireAuthentication(callbackUrl?: string)`:
  - If unauthenticated, redirects to `/login`.
  - If the session expired (`status === 'EXPIRED'`), automatically appends `?reason=session-expired` and the sanitized `returnTo` path.
  - Returns the authenticated user if valid.
- `requireAuthOrActionError()`:
  - Centralized guard for server actions returning structured `ActionResult` objects:
  - Returns `{ ok: false, errorResult: { success: false, code: 'AUTH_SESSION_EXPIRED', ... } }` if expired.

---

## 3. Cookie Configuration

The session token is stored in a hardened HTTP-only cookie:

| Attribute | Setting | Security Rationale |
| :--- | :--- | :--- |
| **Name** | `ox_session` | Standard application cookie identifier |
| **HttpOnly** | `true` | Prevents token theft via Cross-Site Scripting (XSS) |
| **SameSite** | `lax` | Defends against Cross-Site Request Forgery (CSRF) |
| **Secure** | `true` in production | Transmitted only over TLS/HTTPS |
| **Path** | `/` | Accessible across all application routes |
| **Max-Age** | `600` | Exactly 10 minutes (600 seconds) |

---

## 4. Protected Page & Cache Defense

### 4.1 Anti-Stale Caching Headers (`middleware.ts`)

To ensure browsers do not serve cached authenticated pages from memory or Back/Forward Cache (bfcache) after a session has expired, `middleware.ts` applies strict cache headers to all non-public, non-static responses:

```http
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
Pragma: no-cache
Expires: 0
```

### 4.2 Dynamic Dashboard Rendering (`src/app/(dashboard)/layout.tsx`)

```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

This prevents Next.js from caching dynamic server component trees for authenticated pages.

### 4.3 Redirect Loop Defense on `/login`

When an expired user is redirected to `/login?reason=session-expired`, `middleware.ts` detects the `reason` parameter and avoids redirecting the user back to `/` (even if a stale cookie was transmitted), clearing the stale cookie on the response:

```typescript
if (pathname === '/login') {
  const reason = request.nextUrl.searchParams.get('reason');
  if (reason) {
    const loginResponse = NextResponse.next();
    if (sessionCookie) loginResponse.cookies.delete(SESSION_COOKIE_NAME);
    return loginResponse;
  }
}
```

---

## 5. Client-Side UX & Tab Synchronization

### 5.1 `SessionTimeoutWatcher` (`src/components/auth/session-timeout-watcher.tsx`)

The client watcher provides UX feedback without acting as the authority:

1. **Active Expiration Timer:** Configured with `expiresAt - Date.now()`. When the timer expires, the non-dismissible amber modal displays.
2. **Tab Visibility & Focus (`visibilitychange`, `focus`):** When a user switches back to an inactive tab or minimizes the browser and returns after 10 minutes, the component verifies the elapsed time and executes `checkSessionStatusAction()` to validate with the server.
3. **Bfcache Restoration (`pageshow`):** Checks `event.persisted` on browser Back/Forward navigation.
4. **Cross-Tab Synchronization (`BroadcastChannel` & `localStorage`):** When any tab expires or logs out, a message (`SESSION_EXPIRED` or `LOGOUT`) is broadcast to all tabs on the origin, keeping all open tabs in sync.
5. **Global Fetch Interceptor:** Listens for HTTP 401 with code `AUTH_SESSION_EXPIRED` and shows the expiration modal immediately.

---

## 6. Audit Logging

Session events are explicitly audited:

- **`AUTH_LOGOUT`**: Recorded when the user explicitly clicks Sign Out.
- **`AUTH_SESSION_EXPIRED`**: Recorded when a session is invalidated after exceeding the 10-minute threshold.

Secrets (passwords, password hashes, session tokens, cookies) are strictly excluded from audit payloads.

---

## 7. Verification & Automated Test Suites

- **Session Expiration Suite (`scripts/verify-session-expiration.ts`):** 36/36 passed checks covering:
  - Exact 600-second session lifetime.
  - Acceptance at 9 minutes, rejection at 10+ minutes.
  - Server-side DB invalidation & cookie removal.
  - Standardized `AUTH_SESSION_EXPIRED` response.
  - Safe redirect URLs & open-redirect immunity.
  - Multi-tab and multi-device session isolation.
  - Cookie flags and cache-control headers.
- **User Account Suite (`scripts/verify-user-account.ts`):** 40/40 passed checks.
- **ESLint:** 0 errors, 0 warnings.
- **Production Build (`next build`):** 0 errors across 59 routes.
