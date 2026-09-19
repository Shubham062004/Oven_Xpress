import { z } from 'zod';

/**
 * Phone validation: allows digits, spaces, dashes, parentheses, plus sign.
 * Intentionally permissive to support international formats.
 */
const phoneRegex = /^[+]?[\d\s\-()]{7,20}$/;

/**
 * Employee code: uppercase letters, digits, and hyphens only (e.g. EMP-0001).
 */
const employeeCodeRegex = /^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$|^[A-Z0-9]$/;

export const createEmployeeSchema = z.object({
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
    .min(1, { message: 'Designation is required' })
    .max(100, { message: 'Designation must be 100 characters or less' }),
  branchId: z
    .string()
    .trim()
    .min(1, { message: 'Branch selection is required' }),
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
});

/**
 * Update schema: employeeCode is immutable after creation.
 */
export const updateEmployeeSchema = createEmployeeSchema.omit({ employeeCode: true });

/**
 * Filter schema for searching and filtering employees
 */
export const employeeFilterSchema = z.object({
  search: z.string().optional(),
  branchId: z.string().optional(),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).optional(),
  designation: z.string().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeFilterInput = z.infer<typeof employeeFilterSchema>;
