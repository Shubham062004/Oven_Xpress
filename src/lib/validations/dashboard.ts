import { z } from 'zod';

export const dashboardDatePresetEnum = z.enum([
  'today',
  'yesterday',
  '7d',
  '30d',
  'month',
  'custom',
]);

export const dashboardFilterSchema = z
  .object({
    branchId: z.string().optional().default('all'),
    preset: dashboardDatePresetEnum.optional().default('today'),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.preset === 'custom') {
        if (!data.from || !data.to) return false;
        const start = new Date(data.from);
        const end = new Date(data.to);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
        if (start > end) return false;
        // Bounded range check: Maximum 366 days
        const diffDays = Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diffDays <= 366;
      }
      return true;
    },
    {
      message:
        'For custom preset, valid "from" and "to" dates within 366 days are required (from <= to)',
      path: ['from'],
    }
  );

export type DashboardFilterInput = z.infer<typeof dashboardFilterSchema>;
