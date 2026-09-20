import { z } from 'zod';
import {
  SalaryType,
  SalaryStructureStatus,
  BonusType,
  BonusStatus,
  IncrementStatus,
  SalaryRecordStatus,
} from '@prisma/client';

export const salaryTypeEnum = z.nativeEnum(SalaryType);
export const salaryStructureStatusEnum = z.nativeEnum(SalaryStructureStatus);
export const bonusTypeEnum = z.nativeEnum(BonusType);
export const bonusStatusEnum = z.nativeEnum(BonusStatus);
export const incrementStatusEnum = z.nativeEnum(IncrementStatus);
export const salaryRecordStatusEnum = z.nativeEnum(SalaryRecordStatus);

// ─── Salary Structure & Revision ─────────────────────────────────────────────

export const createSalaryStructureSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  salary: z
    .number({ message: 'Salary must be a valid number' })
    .positive('Salary must be greater than zero')
    .max(10000000, 'Salary exceeds allowable threshold'),
  salaryType: salaryTypeEnum.default(SalaryType.MONTHLY),
  effectiveFrom: z.coerce.date({ message: 'Invalid effective start date' }),
  effectiveTo: z.coerce.date().nullable().optional(),
  reason: z.string().max(255).optional(),
});

export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>;

export const reviseSalarySchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  newSalary: z
    .number({ message: 'New salary must be a valid number' })
    .positive('Salary must be greater than zero')
    .max(10000000, 'Salary exceeds allowable threshold'),
  salaryType: salaryTypeEnum.default(SalaryType.MONTHLY),
  effectiveDate: z.coerce.date({ message: 'Invalid effective date' }),
  reason: z.string().min(2, 'Reason must be at least 2 characters').max(255),
  notes: z.string().max(1000).optional(),
});

export type ReviseSalaryInput = z.infer<typeof reviseSalarySchema>;

// ─── Bonus & Incentive ───────────────────────────────────────────────────────

export const createBonusSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  amount: z
    .number({ message: 'Amount must be a valid number' })
    .positive('Bonus amount must be greater than zero')
    .max(5000000, 'Amount exceeds threshold'),
  type: bonusTypeEnum.default(BonusType.PERFORMANCE),
  reason: z.string().min(2, 'Reason must be at least 2 characters').max(255),
  bonusDate: z.coerce.date({ message: 'Invalid bonus date' }),
  status: z
    .enum([BonusStatus.DRAFT, BonusStatus.PENDING_APPROVAL, BonusStatus.APPROVED])
    .default(BonusStatus.PENDING_APPROVAL),
});

export type CreateBonusInput = z.infer<typeof createBonusSchema>;

export const approveBonusSchema = z.object({
  bonusId: z.string().min(1, 'Bonus ID is required'),
});

export type ApproveBonusInput = z.infer<typeof approveBonusSchema>;

export const rejectBonusSchema = z.object({
  bonusId: z.string().min(1, 'Bonus ID is required'),
  reason: z
    .string()
    .min(3, 'Rejection reason must be at least 3 characters')
    .max(500),
});

export type RejectBonusInput = z.infer<typeof rejectBonusSchema>;

export const cancelBonusSchema = z.object({
  bonusId: z.string().min(1, 'Bonus ID is required'),
  reason: z.string().max(500).optional(),
});

export type CancelBonusInput = z.infer<typeof cancelBonusSchema>;

export const createIncentiveSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  amount: z
    .number({ message: 'Amount must be a valid number' })
    .positive('Incentive amount must be greater than zero')
    .max(5000000, 'Amount exceeds threshold'),
  reason: z.string().min(2, 'Reason must be at least 2 characters').max(255),
  incentiveDate: z.coerce.date({ message: 'Invalid date' }),
  status: z
    .enum([BonusStatus.DRAFT, BonusStatus.PENDING_APPROVAL, BonusStatus.APPROVED])
    .default(BonusStatus.APPROVED),
});

export type CreateIncentiveInput = z.infer<typeof createIncentiveSchema>;

// ─── Salary Record / Period ──────────────────────────────────────────────────

export const createSalaryRecordSchema = z
  .object({
    employeeId: z.string().min(1, 'Employee is required'),
    periodStart: z.coerce.date({ message: 'Invalid start date' }),
    periodEnd: z.coerce.date({ message: 'Invalid end date' }),
    adjustmentAmount: z
      .number({ message: 'Adjustment must be a number' })
      .default(0),
    notes: z.string().max(1000).optional(),
    status: z
      .enum([SalaryRecordStatus.DRAFT, SalaryRecordStatus.PENDING_REVIEW])
      .default(SalaryRecordStatus.PENDING_REVIEW),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: 'Period end date must be on or after start date',
    path: ['periodEnd'],
  });

export type CreateSalaryRecordInput = z.infer<typeof createSalaryRecordSchema>;

export const approveSalaryRecordSchema = z.object({
  salaryRecordId: z.string().min(1, 'Salary record ID is required'),
});

export type ApproveSalaryRecordInput = z.infer<typeof approveSalaryRecordSchema>;

export const cancelSalaryRecordSchema = z.object({
  salaryRecordId: z.string().min(1, 'Salary record ID is required'),
  reason: z
    .string()
    .min(3, 'Cancellation reason must be at least 3 characters')
    .max(500),
});

export type CancelSalaryRecordInput = z.infer<typeof cancelSalaryRecordSchema>;
