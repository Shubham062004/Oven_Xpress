import { z } from 'zod';

/**
 * 24-hour time format: HH:mm (e.g. 09:00, 23:30)
 */
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * ISO Calendar Date: YYYY-MM-DD (e.g. 2026-09-19)
 */
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// ─── Shift Schemas ──────────────────────────────────────────────────────────

export const shiftSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Shift name is required' })
    .max(50, { message: 'Shift name must be 50 characters or less' }),
  branchId: z
    .string()
    .trim()
    .min(1, { message: 'Branch selection is required' }),
  startTime: z
    .string()
    .trim()
    .regex(timeRegex, { message: 'Start time must be in HH:mm format (e.g. 09:00)' }),
  endTime: z
    .string()
    .trim()
    .regex(timeRegex, { message: 'End time must be in HH:mm format (e.g. 17:00)' }),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateShiftSchema = shiftSchema;

export type ShiftInput = z.infer<typeof shiftSchema>;

// ─── Attendance Schemas ────────────────────────────────────────────────────

export const attendanceRecordSchema = z.object({
  employeeId: z
    .string()
    .trim()
    .min(1, { message: 'Employee selection is required' }),
  branchId: z
    .string()
    .trim()
    .min(1, { message: 'Branch selection is required' }),
  shiftId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .nullable(),
  date: z
    .string()
    .trim()
    .regex(dateRegex, { message: 'Date must be in YYYY-MM-DD format' }),
  status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'], {
    message: 'Status must be PRESENT, ABSENT, HALF_DAY, or LEAVE',
  }),
  checkInTime: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .nullable()
    .refine((val) => !val || timeRegex.test(val), {
      message: 'Check-in time must be in HH:mm format (e.g. 09:15)',
    }),
  checkOutTime: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .nullable()
    .refine((val) => !val || timeRegex.test(val), {
      message: 'Check-out time must be in HH:mm format (e.g. 17:00)',
    }),
  note: z
    .string()
    .trim()
    .max(500, { message: 'Note must be 500 characters or less' })
    .optional()
    .or(z.literal(''))
    .nullable(),
});

export const attendanceUpdateSchema = z.object({
  shiftId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .nullable(),
  status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'], {
    message: 'Status must be PRESENT, ABSENT, HALF_DAY, or LEAVE',
  }),
  checkInTime: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .nullable()
    .refine((val) => !val || timeRegex.test(val), {
      message: 'Check-in time must be in HH:mm format (e.g. 09:15)',
    }),
  checkOutTime: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .nullable()
    .refine((val) => !val || timeRegex.test(val), {
      message: 'Check-out time must be in HH:mm format (e.g. 17:00)',
    }),
  note: z
    .string()
    .trim()
    .max(500, { message: 'Note must be 500 characters or less' })
    .optional()
    .or(z.literal(''))
    .nullable(),
});

export const attendanceFilterSchema = z.object({
  date: z.string().optional(),
  branchId: z.string().optional(),
  employeeId: z.string().optional(),
  shiftId: z.string().optional(),
  status: z.enum(['ALL', 'PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE']).optional(),
});

export type AttendanceRecordInput = z.infer<typeof attendanceRecordSchema>;
export type AttendanceUpdateInput = z.infer<typeof attendanceUpdateSchema>;
export type AttendanceFilterInput = z.infer<typeof attendanceFilterSchema>;
