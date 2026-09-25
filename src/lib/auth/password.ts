import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * A precomputed valid bcrypt hash with 12 rounds used to mitigate timing-based
 * user enumeration attacks. When a login attempt specifies an unregistered email,
 * running verifyPassword against this dummy hash ensures constant-time response latency.
 */
export const DUMMY_BCRYPT_HASH = '$2a$12$e80yqV0dC9x0uV0rG6s9eeO7j1E5K0mXo1U.01y1qK1Z1x1y1x1y1';

/**
 * Hash a plain-text password using bcrypt with 12 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a plain-text password against a hashed password.
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  if (!password || !hashedPassword) {
    return false;
  }
  return bcrypt.compare(password, hashedPassword);
}
