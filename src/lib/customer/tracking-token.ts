import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import type { AuthUser } from '@/lib/auth/types';

/**
 * Generates a cryptographically strong, unpredictable 256-bit tracking token
 * and its SHA-256 hash.
 *
 * The raw token is returned to the user for use in their private tracking link:
 * /track/[orderNumber]?token=[rawToken]
 *
 * Only the SHA-256 hash is persisted in the database.
 */
export function generateTrackingToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashTrackingToken(token);
  return { token, tokenHash };
}

/**
 * Hashes a raw tracking token using SHA-256.
 */
export function hashTrackingToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Validates a user-supplied tracking token against the stored SHA-256 hash
 * using constant-time comparison to prevent timing side-channel attacks.
 */
export function verifyTrackingToken(
  token: string | null | undefined,
  storedHash: string | null | undefined
): boolean {
  if (!token || !storedHash) {
    return false;
  }

  const trimmedToken = token.trim();
  if (trimmedToken.length === 0) {
    return false;
  }

  try {
    const computedHash = hashTrackingToken(trimmedToken);
    const computedBuf = Buffer.from(computedHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');

    if (computedBuf.length !== storedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuf, storedBuf);
  } catch {
    return false;
  }
}

export interface OrderAuthorizationSubject {
  id: string;
  orderNumber: string;
  branchId: string;
  customerId: string | null;
  createdBy: string;
  trackingTokenHash: string | null;
}

/**
 * Authorizes access to an order.
 *
 * Access is granted if and only if:
 * 1. User has Executive role (OWNER, ADMIN, SUPER_ADMIN).
 * 2. User is branch staff/manager assigned to the order's branch.
 * 3. User is an authenticated customer who owns this order (via Customer profile or createdBy).
 * 4. A valid guest tracking token matching the stored token hash is provided.
 *
 * Access is DENIED in all other cases.
 */
export async function authorizeOrderAccess(
  order: OrderAuthorizationSubject,
  user: AuthUser | null,
  token?: string | null
): Promise<{ authorized: boolean; reason?: string }> {
  // 1. Executive Roles have global access
  if (user) {
    const roleUpper = user.role.toUpperCase();
    if (roleUpper === 'OWNER' || roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN') {
      return { authorized: true, reason: 'EXECUTIVE_ROLE' };
    }

    // 2. Branch-scoped staff / manager access
    if (user.branchId && user.branchId === order.branchId) {
      return { authorized: true, reason: 'BRANCH_STAFF' };
    }

    // 3. Authenticated customer ownership check
    if (order.createdBy === user.id) {
      return { authorized: true, reason: 'ORDER_CREATOR' };
    }

    if (order.customerId) {
      const customerRecord = await prisma.customer.findFirst({
        where: {
          OR: [
            { userId: user.id },
            ...(user.email ? [{ email: user.email }] : []),
          ],
        },
        select: { id: true },
      });

      if (customerRecord && customerRecord.id === order.customerId) {
        return { authorized: true, reason: 'CUSTOMER_OWNER' };
      }
    }
  }

  // 4. Guest / Token-based Authorization
  if (token && order.trackingTokenHash) {
    if (verifyTrackingToken(token, order.trackingTokenHash)) {
      return { authorized: true, reason: 'VALID_GUEST_TOKEN' };
    }
  }

  return { authorized: false, reason: 'UNAUTHORIZED' };
}

/**
 * Rotates an order's tracking token.
 * Generates a new random token, updates the database hash, and returns the new raw token.
 */
export async function rotateOrderTrackingToken(orderId: string): Promise<string> {
  const { token, tokenHash } = generateTrackingToken();
  await prisma.order.update({
    where: { id: orderId },
    data: { trackingTokenHash: tokenHash },
  });
  return token;
}

/**
 * Revokes an order's tracking token.
 */
export async function revokeOrderTrackingToken(orderId: string): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { trackingTokenHash: null },
  });
}
