import { prisma } from '@/lib/db/prisma';
import {
  SETTING_DEFINITIONS,
  SettingCategory,
  SettingDataType,
  SettingOption,
  SettingScopeType,
} from './setting-definitions';
import { createAuditLog } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit/audit-types';
import { UserPreferenceInput } from '@/lib/validations/settings';

export interface ResolvedSettingItem {
  key: string;
  name: string;
  description: string;
  category: SettingCategory;
  dataType: SettingDataType;
  allowedScopes: SettingScopeType[];
  defaultValue: unknown;
  options?: SettingOption[];
  min?: number;
  max?: number;
  effectiveValue: unknown;
  scope: 'BRANCH' | 'GLOBAL' | 'DEFAULT';
  isOverridden: boolean;
  globalValue: unknown | null;
  branchValue: unknown | null;
  updatedAt?: Date | null;
  updatedBy?: string | null;
}

function deserializeValue(val: string, dataType: SettingDataType): unknown {
  switch (dataType) {
    case 'BOOLEAN':
      return val === 'true';
    case 'NUMBER': {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    }
    case 'JSON':
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    case 'STRING':
    case 'TIME':
    default:
      return val;
  }
}

function serializeValue(val: unknown, dataType: SettingDataType): string {
  switch (dataType) {
    case 'BOOLEAN':
      return String(Boolean(val));
    case 'NUMBER':
      return String(Number(val));
    case 'JSON':
      return typeof val === 'string' ? val : JSON.stringify(val);
    case 'STRING':
    case 'TIME':
    default:
      return String(val ?? '');
  }
}

/**
 * Resolve a setting using the 3-tier fallback engine:
 * 1. Branch-specific override (if branchId provided)
 * 2. Global setting
 * 3. Application default (SETTING_DEFINITIONS)
 */
export async function getSetting<T = unknown>(key: string, branchId?: string | null): Promise<T> {
  const def = SETTING_DEFINITIONS[key];
  if (!def) {
    console.warn(`[getSetting] Unknown setting key: ${key}`);
    return undefined as unknown as T;
  }

  // 1. Check branch override if branchId is provided
  if (branchId) {
    try {
      const branchSetting = await prisma.systemSetting.findFirst({
        where: { key, scope: 'BRANCH', branchId },
      });
      if (branchSetting) {
        const val = deserializeValue(branchSetting.value, def.dataType);
        const validated = def.validate(val);
        if (validated.success && validated.data !== undefined) {
          return validated.data as T;
        }
      }
    } catch (err) {
      console.error(`[getSetting] Error fetching branch setting for ${key}:`, err);
    }
  }

  // 2. Check global setting
  try {
    const globalSetting = await prisma.systemSetting.findFirst({
      where: { key, scope: 'GLOBAL' },
    });
    if (globalSetting) {
      const val = deserializeValue(globalSetting.value, def.dataType);
      const validated = def.validate(val);
      if (validated.success && validated.data !== undefined) {
        return validated.data as T;
      }
    }
  } catch (err) {
    console.error(`[getSetting] Error fetching global setting for ${key}:`, err);
  }

  // 3. Fallback to application default
  return def.defaultValue as T;
}

/**
 * Get all registered settings resolved for a given branch or global context.
 */
export async function getAllSettings(branchId?: string | null): Promise<ResolvedSettingItem[]> {
  const whereConditions: Array<{ scope: 'GLOBAL' } | { scope: 'BRANCH'; branchId: string }> = [
    { scope: 'GLOBAL' },
  ];

  if (branchId) {
    whereConditions.push({ scope: 'BRANCH', branchId });
  }

  const existingSettings = await prisma.systemSetting.findMany({
    where: {
      OR: whereConditions,
    },
  });

  const globalMap = new Map<string, (typeof existingSettings)[0]>();
  const branchMap = new Map<string, (typeof existingSettings)[0]>();

  for (const s of existingSettings) {
    if (s.scope === 'GLOBAL') {
      globalMap.set(s.key, s);
    } else if (s.scope === 'BRANCH' && s.branchId === branchId) {
      branchMap.set(s.key, s);
    }
  }

  const results: ResolvedSettingItem[] = [];

  for (const [key, def] of Object.entries(SETTING_DEFINITIONS)) {
    const branchRecord = branchId ? branchMap.get(key) : undefined;
    const globalRecord = globalMap.get(key);

    let effectiveValue = def.defaultValue;
    let scope: 'BRANCH' | 'GLOBAL' | 'DEFAULT' = 'DEFAULT';
    let isOverridden = false;
    let updatedAt: Date | null = null;
    let updatedBy: string | null = null;

    let globalVal: unknown | null = null;
    let branchVal: unknown | null = null;

    if (globalRecord) {
      const parsedGlobal = deserializeValue(globalRecord.value, def.dataType);
      const validGlobal = def.validate(parsedGlobal);
      if (validGlobal.success) {
        globalVal = validGlobal.data;
        effectiveValue = validGlobal.data;
        scope = 'GLOBAL';
        updatedAt = globalRecord.updatedAt;
        updatedBy = globalRecord.updatedBy;
      }
    }

    if (branchRecord) {
      const parsedBranch = deserializeValue(branchRecord.value, def.dataType);
      const validBranch = def.validate(parsedBranch);
      if (validBranch.success) {
        branchVal = validBranch.data;
        effectiveValue = validBranch.data;
        scope = 'BRANCH';
        isOverridden = true;
        updatedAt = branchRecord.updatedAt;
        updatedBy = branchRecord.updatedBy;
      }
    }

    results.push({
      key: def.key,
      name: def.name,
      description: def.description,
      category: def.category,
      dataType: def.dataType,
      allowedScopes: def.allowedScopes,
      defaultValue: def.defaultValue,
      options: def.options,
      min: def.min,
      max: def.max,
      effectiveValue,
      scope,
      isOverridden,
      globalValue: globalVal,
      branchValue: branchVal,
      updatedAt,
      updatedBy,
    });
  }

  return results;
}

/**
 * Update or create a system setting with validation and audit logging.
 */
export async function updateSetting(
  input: {
    key: string;
    value: unknown;
    scope: 'GLOBAL' | 'BRANCH';
    branchId?: string | null;
  },
  actorUserId: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const { key, value, scope, branchId } = input;
  const def = SETTING_DEFINITIONS[key];

  if (!def) {
    return { success: false, error: `Invalid setting key: ${key}` };
  }

  if (!def.allowedScopes.includes(scope)) {
    return { success: false, error: `Setting ${key} does not support ${scope} scope` };
  }

  if (scope === 'BRANCH') {
    if (!branchId) {
      return { success: false, error: 'Branch ID is required for branch-scoped settings' };
    }
    const branchExists = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true },
    });
    if (!branchExists) {
      return { success: false, error: 'Target branch does not exist' };
    }
  }

  // Validate value
  const validation = def.validate(value);
  if (!validation.success || validation.data === undefined) {
    return { success: false, error: validation.error || 'Invalid setting value' };
  }

  const validatedVal = validation.data;
  const serializedVal = serializeValue(validatedVal, def.dataType);
  const targetBranchId = scope === 'BRANCH' ? branchId : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find existing setting
      const existing = await tx.systemSetting.findFirst({
        where: {
          key,
          scope,
          branchId: targetBranchId,
        },
      });

      let updatedRecord;
      if (existing) {
        updatedRecord = await tx.systemSetting.update({
          where: { id: existing.id },
          data: {
            value: serializedVal,
            updatedBy: actorUserId,
          },
        });
      } else {
        updatedRecord = await tx.systemSetting.create({
          data: {
            key,
            value: serializedVal,
            scope,
            branchId: targetBranchId,
            dataType: def.dataType,
            description: def.description,
            updatedBy: actorUserId,
          },
        });
      }

      // Log in AuditLog
      await createAuditLog(
        {
          action: AUDIT_ACTIONS.SETTING_UPDATE,
          entityType: AUDIT_ENTITY_TYPES.SYSTEM_SETTING,
          entityId: updatedRecord.id,
          branchId: targetBranchId,
          actorUserId,
          description: `Updated ${scope.toLowerCase()} setting "${def.name}" (${key}) to ${serializedVal}`,
          beforeData: existing ? { key, value: existing.value, scope, branchId: targetBranchId } : null,
          afterData: { key, value: serializedVal, scope, branchId: targetBranchId },
          metadata: {
            settingKey: key,
            settingName: def.name,
            dataType: def.dataType,
            scope,
          },
        },
        tx
      );

      return updatedRecord;
    });

    return {
      success: true,
      data: {
        id: result.id,
        key: result.key,
        value: validatedVal,
        scope: result.scope,
        branchId: result.branchId,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update setting';
    console.error(`[updateSetting] Error updating ${key}:`, err);
    return { success: false, error: message };
  }
}

/**
 * Reset a setting (removes branch override or global override to fall back).
 */
export async function resetSetting(
  input: {
    key: string;
    scope: 'GLOBAL' | 'BRANCH';
    branchId?: string | null;
  },
  actorUserId: string
): Promise<{ success: boolean; error?: string }> {
  const { key, scope, branchId } = input;
  const def = SETTING_DEFINITIONS[key];

  if (!def) {
    return { success: false, error: `Invalid setting key: ${key}` };
  }

  const targetBranchId = scope === 'BRANCH' ? branchId : null;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.systemSetting.findFirst({
        where: {
          key,
          scope,
          branchId: targetBranchId,
        },
      });

      if (!existing) {
        return; // Already default / nonexistent
      }

      await tx.systemSetting.delete({
        where: { id: existing.id },
      });

      // Audit log
      await createAuditLog(
        {
          action: AUDIT_ACTIONS.SETTING_RESET,
          entityType: AUDIT_ENTITY_TYPES.SYSTEM_SETTING,
          entityId: existing.id,
          branchId: targetBranchId,
          actorUserId,
          description: `Reset ${scope.toLowerCase()} setting "${def.name}" (${key}) back to default`,
          beforeData: { key, value: existing.value, scope, branchId: targetBranchId },
          afterData: { key, defaultValue: def.defaultValue },
          metadata: {
            settingKey: key,
            settingName: def.name,
            scope,
          },
        },
        tx
      );
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reset setting';
    console.error(`[resetSetting] Error resetting ${key}:`, err);
    return { success: false, error: message };
  }
}

/**
 * Get preferences for a user, returning safe defaults if none exist.
 */
export async function getUserPreferences(userId: string) {
  const defaults = {
    theme: 'system',
    tableDensity: 'comfortable',
    defaultDateRange: '30d',
    preferredBranchId: null,
  };

  try {
    const pref = await prisma.userPreference.findUnique({
      where: { userId },
    });
    if (!pref) return defaults;
    return {
      theme: pref.theme || defaults.theme,
      tableDensity: pref.tableDensity || defaults.tableDensity,
      defaultDateRange: pref.defaultDateRange || defaults.defaultDateRange,
      preferredBranchId: pref.preferredBranchId || null,
    };
  } catch (err) {
    console.error(`[getUserPreferences] Error fetching preferences for ${userId}:`, err);
    return defaults;
  }
}

/**
 * Update user preferences and audit.
 */
export async function updateUserPreferences(userId: string, input: UserPreferenceInput) {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.userPreference.findUnique({
        where: { userId },
      });

      const pref = await tx.userPreference.upsert({
        where: { userId },
        create: {
          userId,
          theme: input.theme,
          tableDensity: input.tableDensity,
          defaultDateRange: input.defaultDateRange,
          preferredBranchId: input.preferredBranchId || null,
        },
        update: {
          theme: input.theme,
          tableDensity: input.tableDensity,
          defaultDateRange: input.defaultDateRange,
          preferredBranchId: input.preferredBranchId || null,
        },
      });

      await createAuditLog(
        {
          action: AUDIT_ACTIONS.USER_PREFERENCE_UPDATE,
          entityType: AUDIT_ENTITY_TYPES.USER_PREFERENCE,
          entityId: pref.id,
          actorUserId: userId,
          description: `Updated personal UI preferences (theme: ${input.theme}, density: ${input.tableDensity}, range: ${input.defaultDateRange})`,
          beforeData: existing ? { ...existing } : null,
          afterData: { ...input },
        },
        tx
      );

      return pref;
    });

    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update preferences';
    console.error(`[updateUserPreferences] Error updating preferences for ${userId}:`, err);
    return { success: false, error: message };
  }
}
