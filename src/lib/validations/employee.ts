import { z } from 'zod';

/**
 * Approved system designation options.
 */
export const APPROVED_DESIGNATIONS = [
  'Kitchen',
  'Delivery',
  'Branch Manager',
  'Cleaner',
] as const;

export type ApprovedDesignation = (typeof APPROVED_DESIGNATIONS)[number];

/**
 * Phone validation: allows digits, spaces, dashes, parentheses, plus sign.
 * Intentionally permissive to support international formats.
 */
const phoneRegex = /^[+]?[\d\s\-()]{7,20}$/;

/**
 * Employee code: uppercase letters, digits, and hyphens only (e.g. EMP-0001).
 */
const employeeCodeRegex = /^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$|^[A-Z0-9]$/;

export const baseEmployeeSchema = z.object({
  // Personal
  firstName: z
    .string()
    .trim()
    .min(1, { message: 'First name is required' })
    .max(50, { message: 'First name must be 50 characters or less' }),
  lastName: z
    .string()
    .trim()
    .min(1, { message: 'Last name is required' })
    .max(50, { message: 'Last name must be 50 characters or less' }),
  phone: z
    .string()
    .trim()
    .min(1, { message: 'Phone number is required' })
    .refine((val) => phoneRegex.test(val), {
      message: 'Please enter a valid phone number (7-20 digits)',
    }),
  email: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || z.string().email().safeParse(val).success, {
      message: 'Please enter a valid email address',
    }),
  dateOfBirth: z
    .string()
    .trim()
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .trim()
    .max(250, { message: 'Address must be 250 characters or less' })
    .optional()
    .or(z.literal('')),

  // Employment
  employeeCode: z
    .string()
    .trim()
    .min(2, { message: 'Employee code is required (at least 2 characters)' })
    .max(20, { message: 'Employee code must be 20 characters or less' })
    .transform((val) => val.toUpperCase())
    .pipe(
      z.string().regex(employeeCodeRegex, {
        message: 'Employee code must contain only uppercase letters, digits, and hyphens',
      })
    ),
  designation: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .default('Unassigned'),
  branchId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .nullable(),
  joiningDate: z
    .string()
    .trim()
    .min(1, { message: 'Joining date is required' }),
  employmentStatus: z
    .enum(['ACTIVE', 'INACTIVE'], {
      message: 'Employment status must be ACTIVE or INACTIVE',
    })
    .default('ACTIVE'),

  // Compensation
  salary: z.coerce
    .number({ message: 'Salary must be a valid number' })
    .min(0, { message: 'Salary cannot be negative' }),
  salaryType: z.enum(['MONTHLY', 'DAILY', 'HOURLY'], {
    message: 'Salary type must be MONTHLY, DAILY, or HOURLY',
  }).default('MONTHLY'),

  // Emergency Contact
  emergencyContactName: z
    .string()
    .trim()
    .max(100, { message: 'Emergency contact name must be 100 characters or less' })
    .optional()
    .or(z.literal('')),
  emergencyContactPhone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || phoneRegex.test(val), {
      message: 'Please enter a valid emergency phone number',
    }),

  // Optional System User Account Linking
  userId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .nullable(),

  // Create System Login Account (Optional inline account creation)
  createLoginAccount: z.boolean().optional(),
  loginEmail: z
    .string()
    .trim()
    .optional()
    .or(z.literal('')),
  loginPassword: z
    .string()
    .optional()
    .or(z.literal('')),
  confirmPassword: z
    .string()
    .optional()
    .or(z.literal('')),
});

export const createEmployeeSchema = baseEmployeeSchema.superRefine((data, ctx) => {
  if (data.createLoginAccount) {
    if (!data.loginEmail || !z.string().email().safeParse(data.loginEmail).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['loginEmail'],
        message: 'A valid email address is required for system login credentials',
      });
    }

    if (!data.loginPassword || data.loginPassword.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['loginPassword'],
        message: 'Temporary password must be at least 8 characters long',
      });
    }

    if (data.confirmPassword !== undefined && data.confirmPassword !== data.loginPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Password confirmation does not match',
      });
    }
  }
});

/**
 * Update schema: employeeCode is immutable after creation.
 */
export const updateEmployeeSchema = baseEmployeeSchema
  .omit({ employeeCode: true })
  .superRefine((data, ctx) => {
    if (data.createLoginAccount) {
      if (!data.loginEmail || !z.string().email().safeParse(data.loginEmail).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['loginEmail'],
          message: 'A valid email address is required for system login credentials',
        });
      }

      if (!data.loginPassword || data.loginPassword.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['loginPassword'],
          message: 'Temporary password must be at least 8 characters long',
        });
      }

      if (data.confirmPassword !== undefined && data.confirmPassword !== data.loginPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confirmPassword'],
          message: 'Password confirmation does not match',
        });
      }
    }
  });

/**
 * Schema for resetting an employee's system password
 */
export const resetEmployeePasswordSchema = z
  .object({
    employeeId: z.string().min(1, 'Employee ID is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(8, 'Password confirmation is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Schema for creating a system login account for an existing employee
 */
export const createLoginAccountSchema = z
  .object({
    employeeId: z.string().min(1, 'Employee ID is required'),
    email: z.string().email('Please enter a valid login email address'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(8, 'Password confirmation is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Filter schema for searching and filtering employees
 */
export const employeeFilterSchema = z.object({
  search: z.string().optional(),
  branchId: z.string().optional(),
  designation: z.string().optional(),
});

export const assignBranchWorkSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  branchId: z.string().min(1, 'Please select a branch'),
  designation: z.string().min(1, 'Please select or enter a job designation/work'),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeFilterInput = z.infer<typeof employeeFilterSchema>;
export type AssignBranchWorkInput = z.infer<typeof assignBranchWorkSchema>;
export type ResetEmployeePasswordInput = z.infer<typeof resetEmployeePasswordSchema>;
export type CreateLoginAccountInput = z.infer<typeof createLoginAccountSchema>;
