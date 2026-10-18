import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '@redhunter/shared';

// RFC 5321 path limit; also bounds work done per request.
export const MAX_EMAIL_LENGTH = 254;
// Upper bound keeps argon2 work per login request bounded.
export const MAX_PASSWORD_LENGTH = 1024;
export const MIN_OWNER_PASSWORD_LENGTH = PASSWORD_MIN_LENGTH;

// Emails are stored and looked up trimmed + lowercased so case variants map to one account.
export const EmailInputSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(MAX_EMAIL_LENGTH));

export const PasswordInputSchema = z.string().min(1).max(MAX_PASSWORD_LENGTH);

export const LoginBodySchema = z.object({
  email: EmailInputSchema,
  password: PasswordInputSchema,
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const SetupBodySchema = z
  .object({
    email: EmailInputSchema,
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password harus minimal ${PASSWORD_MIN_LENGTH} karakter`)
      .max(MAX_PASSWORD_LENGTH)
      .regex(/[A-Z]/, 'Password harus mengandung minimal 1 huruf kapital')
      .regex(/[0-9]/, 'Password harus mengandung minimal 1 angka')
      .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password harus mengandung minimal 1 simbol'),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type SetupBody = z.infer<typeof SetupBodySchema>;

export interface OwnerCredentials {
  readonly email: string;
  readonly password: string;
}
