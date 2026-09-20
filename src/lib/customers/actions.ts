'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import type { ActionResult } from '@/lib/auth/types';
import { z } from 'zod';

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as Record<string, unknown>).digest === 'string' &&
    ((error as Record<string, string>).digest.startsWith('NEXT_REDIRECT') ||
      (error as Record<string, string>).digest === 'DYNAMIC_SERVER_USAGE')
  );
}

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  totalOrders: number;
}

const customerSchema = z.object({
  name: z.string().trim().min(1, { message: 'Customer name is required' }),
  phone: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email({ message: 'Invalid email address' }).optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
  notes: z.string().trim().optional().or(z.literal('')),
});

/**
 * Fast lookup of a customer by exact or partial phone number.
 */
export async function lookupCustomerByPhone(
  phone: string
): Promise<ActionResult<CustomerSummary | null>> {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_READ);

    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 4) {
      return { success: true, data: null };
    }

    const customer = await prisma.customer.findFirst({
      where: {
        phone: {
          contains: cleanPhone,
        },
      },
      include: {
        _count: { select: { orders: true } },
      },
    });

    if (!customer) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        notes: customer.notes,
        totalOrders: customer._count.orders,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to lookup customer by phone:', error);
    return { success: false, error: 'Customer lookup failed' };
  }
}

/**
 * Searches customer directory.
 */
export async function getCustomers(
  search?: string
): Promise<ActionResult<CustomerSummary[]>> {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_READ);

    const customers = await prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
      take: 50,
      include: {
        _count: { select: { orders: true } },
      },
    });

    return {
      success: true,
      data: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        notes: c.notes,
        totalOrders: c._count.orders,
      })),
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to get customers:', error);
    return { success: false, error: 'Failed to retrieve customers' };
  }
}

/**
 * Creates or links a customer.
 */
export async function createCustomer(
  input: z.infer<typeof customerSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_CREATE);

    const parsed = customerSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid customer data' };
    }

    if (parsed.data.phone) {
      const existing = await prisma.customer.findUnique({
        where: { phone: parsed.data.phone },
      });
      if (existing) {
        return { success: true, data: { id: existing.id } };
      }
    }

    const customer = await prisma.customer.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
      },
    });

    return { success: true, data: { id: customer.id } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to create customer:', error);
    return { success: false, error: 'Failed to create customer' };
  }
}
