import { z } from 'zod';

export const updateSettingSchema = z.object({
  key: z.string().min(1, 'Setting key is required'),
  value: z.unknown(),
  scope: z.enum(['GLOBAL', 'BRANCH']),
  branchId: z.string().optional().nullable(),
});

export const resetSettingSchema = z.object({
  key: z.string().min(1, 'Setting key is required'),
  scope: z.enum(['GLOBAL', 'BRANCH']),
  branchId: z.string().optional().nullable(),
});

export const userPreferenceSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  tableDensity: z.enum(['compact', 'comfortable']),
  defaultDateRange: z.enum(['today', 'yesterday', '7d', '30d', '90d']),
  preferredBranchId: z.string().optional().nullable(),
});

export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
export type ResetSettingInput = z.infer<typeof resetSettingSchema>;
export type UserPreferenceInput = z.infer<typeof userPreferenceSchema>;
