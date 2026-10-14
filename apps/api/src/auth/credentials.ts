import { z } from 'zod';

// RFC 5321 path limit; also bounds work done per request.
export const MAX_EMAIL_LENGTH = 254;
// Upper bound keeps argon2 work per login request bounded.
export const MAX_PASSWORD_LENGTH = 1024;
export const MIN_OWNER_PASSWORD_LENGTH = 12;

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

export interface OwnerCredentials {
  readonly email: string;
  readonly password: string;
}
