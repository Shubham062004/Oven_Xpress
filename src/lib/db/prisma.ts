import { PrismaClient } from '@prisma/client';
import { assertSecureEnvironment } from '@/lib/security/env-validation';

// Enforce environment security (SSL connection, secret entropy, zero client leakage)
if (process.env.NODE_ENV === 'production') {
  assertSecureEnvironment();
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
