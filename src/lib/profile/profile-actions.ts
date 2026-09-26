'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireAuthentication } from '@/lib/auth/guards';
import { getSession, destroyOtherUserSessions, getUserActiveSessions } from '@/lib/auth/session';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from '@/lib/validations/auth';
import { createAuditLog, getClientContext } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit/audit-types';
import type { ActionResult } from '@/lib/auth/types';
import { getUserPreferences } from '@/lib/settings/settings-service';

export interface ProfileDetails {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    role: string;
    roleDescription: string | null;
    isActive: boolean;
    emailVerified: Date | null;
    createdAt: Date;
    updatedAt: Date;
    passwordChangedAt: Date | null;
  };
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    phone: string;
    designation: string;
    joiningDate: Date;
    employmentStatus: string;
    branch: {
      id: string;
      name: string;
      code: string;
      city: string;
      address: string;
    };
  } | null;
  activeSessions: {
    id: string;
    isCurrent: boolean;
    createdAt: Date;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }[];
  preferences: {
    theme: string;
    tableDensity: string;
    defaultDateRange: string;
    preferredBranchId: string | null;
  };
}

/**
 * Retrieves authoritative profile data for the currently authenticated user.
 */
export async function getProfileData(): Promise<ProfileDetails> {
  const authUser = await requireAuthentication();
  const session = await getSession();

  const userRecord = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: {
      role: true,
      employee: {
        include: {
          branch: true,
        },
      },
    },
  });

  if (!userRecord) {
    throw new Error('User not found.');
  }

  const [activeSessions, preferences] = await Promise.all([
    getUserActiveSessions(authUser.id, session?.sessionToken),
    getUserPreferences(authUser.id),
  ]);

  return {
    user: {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      phone: userRecord.phone ?? userRecord.employee?.phone ?? null,
      avatarUrl: userRecord.avatarUrl ?? null,
      role: userRecord.role.name,
      roleDescription: userRecord.role.description,
      isActive: userRecord.isActive,
      emailVerified: userRecord.emailVerified,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
      passwordChangedAt: userRecord.passwordChangedAt,
    },
    employee: userRecord.employee
      ? {
          id: userRecord.employee.id,
          employeeCode: userRecord.employee.employeeCode,
          firstName: userRecord.employee.firstName,
          lastName: userRecord.employee.lastName,
          phone: userRecord.employee.phone,
          designation: userRecord.employee.designation,
          joiningDate: userRecord.employee.joiningDate,
          employmentStatus: userRecord.employee.employmentStatus,
          branch: {
            id: userRecord.employee.branch.id,
            name: userRecord.employee.branch.name,
            code: userRecord.employee.branch.code,
            city: userRecord.employee.branch.city,
            address: userRecord.employee.branch.address,
          },
        }
      : null,
    activeSessions,
    preferences,
  };
}

/**
 * Server Action: Update self profile fields.
 * Restricted strictly to non-administrative fields: firstName, lastName, phone, avatarUrl.
 * Never allows changing role, permissions, branch, salary, employeeCode, or status.
 */
export async function updateProfileAction(
  input: UpdateProfileInput
): Promise<ActionResult<{ name: string; phone: string | null; avatarUrl: string | null }>> {
  const authUser = await requireAuthentication();
  const clientCtx = await getClientContext();

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid profile information.',
    };
  }

  const { firstName, lastName, phone, avatarUrl } = parsed.data;
  const newFullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { employee: true },
    });

    if (!existingUser) {
      return { success: false, error: 'User record not found.' };
    }

    const cleanPhone = phone?.trim() || null;
    const cleanAvatar = avatarUrl?.trim() || null;

    // Execute atomic transaction for User and linked Employee
    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: authUser.id },
        data: {
          name: newFullName,
          phone: cleanPhone,
          avatarUrl: cleanAvatar,
        },
      });

      if (existingUser.employee) {
        await tx.employee.update({
          where: { id: existingUser.employee.id },
          data: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            ...(cleanPhone ? { phone: cleanPhone } : {}),
          },
        });
      }

      await createAuditLog(
        {
          actorUserId: authUser.id,
          branchId: existingUser.employee?.branchId ?? null,
          action: AUDIT_ACTIONS.PROFILE_UPDATED,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: authUser.id,
          description: `User ${authUser.name} updated their personal profile details`,
          beforeData: {
            name: existingUser.name,
            phone: existingUser.phone,
            avatarUrl: existingUser.avatarUrl,
          },
          afterData: {
            name: newFullName,
            phone: cleanPhone,
            avatarUrl: cleanAvatar,
          },
          ipAddress: clientCtx.ipAddress ?? undefined,
          userAgent: clientCtx.userAgent ?? undefined,
        },
        tx
      );

      return u;
    });

    revalidatePath('/profile');
    revalidatePath('/', 'layout');

    return {
      success: true,
      data: {
        name: updatedUser.name,
        phone: updatedUser.phone,
        avatarUrl: updatedUser.avatarUrl,
      },
    };
  } catch (error) {
    console.error('Failed to update profile:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating your profile. Please try again.',
    };
  }
}

/**
 * Server Action: Change Password.
 * Verifies current password, checks complexity, hashes with bcrypt 12 rounds,
 * revokes all OTHER active sessions, and writes an audit log.
 */
export async function changePasswordAction(
  input: ChangePasswordInput
): Promise<ActionResult> {
  const authUser = await requireAuthentication();
  const clientCtx = await getClientContext();
  const session = await getSession();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid password parameters.',
    };
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const userRecord = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { employee: true },
    });

    if (!userRecord) {
      return { success: false, error: 'User record not found.' };
    }

    // 1. Verify current password
    const isCurrentValid = await verifyPassword(currentPassword, userRecord.passwordHash);
    if (!isCurrentValid) {
      return {
        success: false,
        error: 'Current password is incorrect.',
      };
    }

    // 2. Hash new password
    const newHash = await hashPassword(newPassword);

    // 3. Update password in database
    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
      },
    });

    // 4. Revoke other active sessions for defense-in-depth, keeping current session alive
    let revokedCount = 0;
    if (session?.sessionToken) {
      revokedCount = await destroyOtherUserSessions(authUser.id, session.sessionToken);
    }

    // 5. Audit Log (Never log passwords or hashes)
    await createAuditLog({
      actorUserId: authUser.id,
      branchId: userRecord.employee?.branchId ?? null,
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: authUser.id,
      description: `User ${authUser.name} changed their password. ${revokedCount} other active session(s) revoked.`,
      metadata: {
        revokedOtherSessions: revokedCount,
      },
      ipAddress: clientCtx.ipAddress ?? undefined,
      userAgent: clientCtx.userAgent ?? undefined,
    });

    revalidatePath('/profile');
    revalidatePath('/profile/password');

    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to change password:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while changing your password. Please try again.',
    };
  }
}

/**
 * Server Action: Invalidate all other active sessions for current user.
 */
export async function revokeOtherSessionsAction(): Promise<ActionResult<{ revokedCount: number }>> {
  const authUser = await requireAuthentication();
  const clientCtx = await getClientContext();
  const session = await getSession();

  if (!session?.sessionToken) {
    return { success: false, error: 'Active session not found.' };
  }

  try {
    const revokedCount = await destroyOtherUserSessions(authUser.id, session.sessionToken);

    await createAuditLog({
      actorUserId: authUser.id,
      action: AUDIT_ACTIONS.OTHER_SESSIONS_REVOKED,
      entityType: AUDIT_ENTITY_TYPES.SESSION,
      entityId: authUser.id,
      description: `User ${authUser.name} revoked ${revokedCount} other active session(s).`,
      metadata: { revokedCount },
      ipAddress: clientCtx.ipAddress ?? undefined,
      userAgent: clientCtx.userAgent ?? undefined,
    });

    revalidatePath('/profile');

    return {
      success: true,
      data: { revokedCount },
    };
  } catch (error) {
    console.error('Failed to revoke sessions:', error);
    return {
      success: false,
      error: 'Failed to revoke other sessions. Please try again.',
    };
  }
}
