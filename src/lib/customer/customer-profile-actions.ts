'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';
import { requireAuthentication } from '@/lib/auth/guards';
import { createAuditLog, getClientContext } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit/audit-types';
import type { ActionResult } from '@/lib/auth/types';

export interface CustomerProfileData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  emailVerified: boolean;
  role: string;
  defaultAddress: string | null;
  addresses: {
    id?: string;
    label?: string;
    street: string;
    city: string;
    pincode?: string;
  }[];
  ordersCount: number;
  wishlistCount: number;
}

/**
 * Normalizes telephone numbers into clean digits.
 */
function normalizePhoneNumber(rawPhone: string): string {
  // Strip spaces, dashes, parentheses
  const cleaned = rawPhone.replace(/[\s\-\(\)]/g, '');
  // If Indian 10-digit without country code, keep as 10 digits
  return cleaned;
}

/**
 * Validates phone numbers: accepts 10 digits or international E.164.
 */
function isValidPhone(phone: string): boolean {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

/**
 * Retrieves the full authenticated customer's profile.
 */
export async function getCustomerProfile(): Promise<CustomerProfileData | null> {
  const authUser = await requireAuthentication('/account/profile');

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: {
      role: { select: { name: true } },
      customer: {
        select: {
          id: true,
          phone: true,
          address: true,
          _count: { select: { orders: true } },
        },
      },
      _count: {
        select: {
          wishlist: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const rawAddresses = (user.addresses as unknown) || [];
  const addresses = Array.isArray(rawAddresses) ? (rawAddresses as CustomerProfileData['addresses']) : [];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || user.customer?.phone || null,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    emailVerified: Boolean(user.emailVerified),
    role: user.role?.name || 'CUSTOMER',
    defaultAddress: user.customer?.address || null,
    addresses,
    ordersCount: user.customer?._count?.orders || 0,
    wishlistCount: user._count?.wishlist || 0,
  };
}

export interface UpdateCustomerProfileInput {
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  defaultAddress?: string | null;
}

/**
 * Server Action: Update Customer Profile.
 * Strictly verifies ownership, normalizes phone numbers, prevents duplicate phone collisions,
 * and updates both User and Customer records.
 */
export async function updateCustomerProfileAction(
  input: UpdateCustomerProfileInput
): Promise<ActionResult<CustomerProfileData>> {
  const authUser = await requireAuthentication('/account/profile');
  const clientCtx = await getClientContext();

  const cleanName = input.name?.trim();
  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'Full name must be at least 2 characters.' };
  }
  if (cleanName.length > 70) {
    return { success: false, error: 'Full name cannot exceed 70 characters.' };
  }

  let normalizedPhone: string | null = null;
  if (input.phone && input.phone.trim().length > 0) {
    const raw = input.phone.trim();
    if (!isValidPhone(raw)) {
      return {
        success: false,
        error: 'Please enter a valid 10-digit mobile phone number.',
      };
    }
    normalizedPhone = normalizePhoneNumber(raw);

    // Check for duplicate phone on another user
    const phoneOwner = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        id: { not: authUser.id },
      },
      select: { id: true },
    });

    if (phoneOwner) {
      return {
        success: false,
        error: 'This phone number is already associated with another account.',
      };
    }

    const customerPhoneOwner = await prisma.customer.findFirst({
      where: {
        phone: normalizedPhone,
        userId: { not: authUser.id },
      },
      select: { id: true },
    });

    if (customerPhoneOwner) {
      return {
        success: false,
        error: 'This phone number is already associated with another customer account.',
      };
    }
  }

  const cleanAvatarUrl = input.avatarUrl?.trim() || null;
  const cleanAddress = input.defaultAddress?.trim() || null;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { customer: true },
    });

    if (!existingUser) {
      return { success: false, error: 'Account not found.' };
    }

    // Atomic update of User and Customer records
    await prisma.$transaction(async (tx) => {
      // 1. Update user details
      await tx.user.update({
        where: { id: authUser.id },
        data: {
          name: cleanName,
          phone: normalizedPhone,
          avatarUrl: cleanAvatarUrl,
        },
      });

      // 2. Update or create Customer profile
      if (existingUser.customer) {
        await tx.customer.update({
          where: { id: existingUser.customer.id },
          data: {
            name: cleanName,
            phone: normalizedPhone,
            address: cleanAddress ?? existingUser.customer.address,
          },
        });
      } else {
        await tx.customer.create({
          data: {
            userId: authUser.id,
            name: cleanName,
            email: existingUser.email,
            phone: normalizedPhone,
            address: cleanAddress,
          },
        });
      }

      // 3. Audit trail
      await createAuditLog(
        {
          actorUserId: authUser.id,
          action: AUDIT_ACTIONS.PROFILE_UPDATED,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: authUser.id,
          description: `Customer ${cleanName} updated their profile details`,
          beforeData: {
            name: existingUser.name,
            phone: existingUser.phone,
            avatarUrl: existingUser.avatarUrl,
            address: existingUser.customer?.address,
          },
          afterData: {
            name: cleanName,
            phone: normalizedPhone,
            avatarUrl: cleanAvatarUrl,
            address: cleanAddress,
          },
          ipAddress: clientCtx.ipAddress ?? undefined,
          userAgent: clientCtx.userAgent ?? undefined,
        },
        tx
      );
    });

    revalidatePath('/account');
    revalidatePath('/account/profile');
    revalidatePath('/', 'layout');

    const updated = await getCustomerProfile();
    if (!updated) {
      return { success: false, error: 'Profile updated, but failed to reload details.' };
    }

    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    console.error('Customer profile update error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred while saving your profile. Please try again.',
    };
  }
}

export interface SavedCustomerAddress {
  id: string;
  label: string;
  street: string;
  city: string;
  pincode?: string;
  isDefault?: boolean;
}

export interface SaveAddressInput {
  id?: string;
  label?: string;
  street: string;
  city: string;
  pincode?: string;
  isDefault?: boolean;
}

/**
 * Server Action: Save or Update a Customer Delivery Address.
 * Modifies the user's saved addresses in User.addresses and synchronizes Customer.address.
 */
export async function saveCustomerAddressAction(
  input: SaveAddressInput
): Promise<ActionResult<SavedCustomerAddress[]>> {
  const authUser = await requireAuthentication('/account');

  const cleanStreet = input.street?.trim();
  const cleanCity = input.city?.trim();
  const cleanPincode = input.pincode?.trim() || '';
  const cleanLabel = input.label?.trim() || 'Home';

  if (!cleanStreet || cleanStreet.length < 3) {
    return { success: false, error: 'Street address must be at least 3 characters long.' };
  }
  if (!cleanCity || cleanCity.length < 2) {
    return { success: false, error: 'City name must be at least 2 characters long.' };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        addresses: true,
        customer: { select: { id: true, address: true } },
      },
    });

    if (!user) {
      return { success: false, error: 'Account not found.' };
    }

    const rawAddresses = (user.addresses as unknown) || [];
    const currentAddresses: SavedCustomerAddress[] = Array.isArray(rawAddresses)
      ? (rawAddresses as SavedCustomerAddress[])
      : [];

    const addressId = input.id || `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newOrUpdatedAddress: SavedCustomerAddress = {
      id: addressId,
      label: cleanLabel,
      street: cleanStreet,
      city: cleanCity,
      pincode: cleanPincode,
      isDefault: Boolean(input.isDefault ?? currentAddresses.length === 0),
    };

    let updatedAddresses: SavedCustomerAddress[];
    if (input.id) {
      const exists = currentAddresses.some((a) => a.id === input.id);
      if (exists) {
        updatedAddresses = currentAddresses.map((a) =>
          a.id === input.id ? newOrUpdatedAddress : a
        );
      } else {
        updatedAddresses = [...currentAddresses, newOrUpdatedAddress];
      }
    } else {
      updatedAddresses = [...currentAddresses, newOrUpdatedAddress];
    }

    const fullAddressString = `${cleanStreet}, ${cleanCity} ${cleanPincode}`.trim();

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: authUser.id },
        data: {
          addresses: updatedAddresses as unknown as Prisma.InputJsonValue,
        },
      });

      if (user.customer) {
        if (!user.customer.address || newOrUpdatedAddress.isDefault) {
          await tx.customer.update({
            where: { id: user.customer.id },
            data: { address: fullAddressString },
          });
        }
      }
    });

    revalidatePath('/account');
    revalidatePath('/account/profile');
    revalidatePath('/checkout');

    return {
      success: true,
      data: updatedAddresses,
    };
  } catch (err) {
    console.error('Error saving customer address:', err);
    return {
      success: false,
      error: 'Failed to save address. Please try again.',
    };
  }
}

/**
 * Server Action: Delete a Customer Delivery Address.
 */
export async function deleteCustomerAddressAction(
  addressId: string
): Promise<ActionResult<SavedCustomerAddress[]>> {
  const authUser = await requireAuthentication('/account');

  if (!addressId) {
    return { success: false, error: 'Address ID is required.' };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        addresses: true,
        customer: { select: { id: true, address: true } },
      },
    });

    if (!user) {
      return { success: false, error: 'Account not found.' };
    }

    const rawAddresses = (user.addresses as unknown) || [];
    const currentAddresses: SavedCustomerAddress[] = Array.isArray(rawAddresses)
      ? (rawAddresses as SavedCustomerAddress[])
      : [];

    const updatedAddresses = currentAddresses.filter((a) => a.id !== addressId);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: authUser.id },
        data: {
          addresses: updatedAddresses as unknown as Prisma.InputJsonValue,
        },
      });

      // If user deleted the address matching default customer address, update customer.address to next available
      if (user.customer && updatedAddresses.length > 0) {
        const nextDefault = updatedAddresses[0];
        const nextAddressString = `${nextDefault.street}, ${nextDefault.city} ${nextDefault.pincode || ''}`.trim();
        await tx.customer.update({
          where: { id: user.customer.id },
          data: { address: nextAddressString },
        });
      }
    });

    revalidatePath('/account');
    revalidatePath('/account/profile');
    revalidatePath('/checkout');

    return {
      success: true,
      data: updatedAddresses,
    };
  } catch (err) {
    console.error('Error deleting customer address:', err);
    return {
      success: false,
      error: 'Failed to remove address. Please try again.',
    };
  }
}

