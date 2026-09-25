'use server';

import { getCurrentUser, getAuthorizedBranchScope } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { revalidatePath } from 'next/cache';
import {
  getAllSettings,
  updateSetting,
  resetSetting,
  getUserPreferences,
  updateUserPreferences,
  ResolvedSettingItem,
} from './settings-service';
import {
  updateSettingSchema,
  resetSettingSchema,
  userPreferenceSchema,
  UpdateSettingInput,
  ResetSettingInput,
  UserPreferenceInput,
} from '@/lib/validations/settings';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch all settings for the current user and selected branch context.
 */
export async function getSettingsAction(
  branchId?: string | null
): Promise<ActionResult<{ settings: ResolvedSettingItem[]; authorizedBranches: { id: string; name: string }[]; isAllBranches: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized. Please sign in.' };
    }

    if (!hasPermission(user, PERMISSIONS.SETTINGS_READ)) {
      return { success: false, error: 'Access denied: Requires settings.read permission.' };
    }

    const branchScope = await getAuthorizedBranchScope(user);

    // If a branch is requested, verify the user has access to it
    let targetBranchId = branchId || null;
    if (targetBranchId && !branchScope.isAllBranches && !branchScope.branchIds.includes(targetBranchId)) {
      return { success: false, error: 'Access denied: Unauthorized to view settings for this branch.' };
    }

    // For managers with a single branch, default to their branch if none requested
    if (!targetBranchId && !branchScope.isAllBranches && branchScope.branchIds.length > 0) {
      targetBranchId = branchScope.branchIds[0];
    }

    const settings = await getAllSettings(targetBranchId);

    // Fetch branches the user can manage
    const branchWhere: { status: 'ACTIVE'; id?: { in: string[] } } = {
      status: 'ACTIVE',
    };
    if (!branchScope.isAllBranches) {
      branchWhere.id = { in: branchScope.branchIds };
    }

    const authorizedBranches = await prisma.branch.findMany({
      where: branchWhere,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      data: {
        settings,
        authorizedBranches,
        isAllBranches: branchScope.isAllBranches,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve settings';
    console.error('[getSettingsAction] Error:', error);
    return { success: false, error: message };
  }
}

/**
 * Update a setting (global or branch-scoped).
 */
export async function updateSettingAction(
  rawInput: UpdateSettingInput
): Promise<ActionResult<unknown>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized. Please sign in.' };
    }

    if (!hasPermission(user, PERMISSIONS.SETTINGS_UPDATE)) {
      return { success: false, error: 'Access denied: Requires settings.update permission.' };
    }

    const parseResult = updateSettingSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0]?.message || 'Invalid input' };
    }

    const { key, value, scope, branchId } = parseResult.data;
    const branchScope = await getAuthorizedBranchScope(user);

    // Global settings require elevated authorization (OWNER or ADMIN)
    if (scope === 'GLOBAL') {
      if (!branchScope.isAllBranches) {
        return { success: false, error: 'Access denied: Branch managers cannot modify global settings.' };
      }
    } else if (scope === 'BRANCH') {
      if (!branchId) {
        return { success: false, error: 'Branch ID is required for branch settings.' };
      }
      if (!branchScope.isAllBranches && !branchScope.branchIds.includes(branchId)) {
        return { success: false, error: 'Access denied: Unauthorized to modify settings for this branch.' };
      }
    }

    const result = await updateSetting(
      {
        key,
        value,
        scope,
        branchId,
      },
      user.id
    );

    if (result.success) {
      revalidatePath('/settings');
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update setting';
    console.error('[updateSettingAction] Error:', error);
    return { success: false, error: message };
  }
}

/**
 * Reset a setting to its inherited or default value.
 */
export async function resetSettingAction(
  rawInput: ResetSettingInput
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized. Please sign in.' };
    }

    if (!hasPermission(user, PERMISSIONS.SETTINGS_UPDATE)) {
      return { success: false, error: 'Access denied: Requires settings.update permission.' };
    }

    const parseResult = resetSettingSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0]?.message || 'Invalid input' };
    }

    const { key, scope, branchId } = parseResult.data;
    const branchScope = await getAuthorizedBranchScope(user);

    if (scope === 'GLOBAL') {
      if (!branchScope.isAllBranches) {
        return { success: false, error: 'Access denied: Branch managers cannot reset global settings.' };
      }
    } else if (scope === 'BRANCH') {
      if (!branchId) {
        return { success: false, error: 'Branch ID is required for branch settings.' };
      }
      if (!branchScope.isAllBranches && !branchScope.branchIds.includes(branchId)) {
        return { success: false, error: 'Access denied: Unauthorized to reset settings for this branch.' };
      }
    }

    const result = await resetSetting(
      {
        key,
        scope,
        branchId,
      },
      user.id
    );

    if (result.success) {
      revalidatePath('/settings');
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset setting';
    console.error('[resetSettingAction] Error:', error);
    return { success: false, error: message };
  }
}

/**
 * Retrieve personal UI preferences for the logged in user.
 */
export async function getUserPreferencesAction(): Promise<
  ActionResult<{
    theme: string;
    tableDensity: string;
    defaultDateRange: string;
    preferredBranchId: string | null;
  }>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized. Please sign in.' };
    }

    const preferences = await getUserPreferences(user.id);
    return { success: true, data: preferences };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve preferences';
    console.error('[getUserPreferencesAction] Error:', error);
    return { success: false, error: message };
  }
}

/**
 * Update personal UI preferences for the logged in user.
 */
export async function updateUserPreferencesAction(
  rawInput: UserPreferenceInput
): Promise<ActionResult<unknown>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized. Please sign in.' };
    }

    const parseResult = userPreferenceSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0]?.message || 'Invalid preferences input' };
    }

    const result = await updateUserPreferences(user.id, parseResult.data);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update preferences';
    console.error('[updateUserPreferencesAction] Error:', error);
    return { success: false, error: message };
  }
}
