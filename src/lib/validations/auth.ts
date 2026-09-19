import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email address is required' })
    .email({ message: 'Please enter a valid email address' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' }),
  callbackUrl: z
    .string()
    .optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
