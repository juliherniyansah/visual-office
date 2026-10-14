import { z } from 'zod';
import {
  EmailInputSchema,
  MAX_PASSWORD_LENGTH,
  MIN_OWNER_PASSWORD_LENGTH,
  type OwnerCredentials,
} from '../auth/credentials';

export const DEFAULT_PORT = 4000;
// Loopback by default; Tailscale binding is opt-in via HOST (plan section 13).
export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_MONGO_URL = 'mongodb://127.0.0.1:27017/redhunter';
export const MIN_JWT_SECRET_LENGTH = 32;
const MAX_PORT = 65_535;
// Values shipped in .env.example must never pass as real secrets.
const PLACEHOLDER_SECRETS: readonly string[] = ['change-me-to-a-long-random-string'];

const ENV_KEYS = [
  'PORT',
  'HOST',
  'MONGO_URL',
  'JWT_SECRET',
  'OWNER_EMAIL',
  'OWNER_PASSWORD',
  'EVENTS_DISPATCH',
  'CORS_ORIGINS',
] as const;

// Next.js dev server (apps/web). Production sets CORS_ORIGINS to the real web origin(s).
export const DEFAULT_CORS_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000';

// Exact origins only: scheme://host[:port], no wildcard, no path (compared verbatim to Origin).
const OriginSchema = z
  .string()
  .regex(/^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/, 'each entry must be an http(s) origin');

const CorsOriginsSchema = z
  .string()
  .transform((value) => value.split(',').map((entry) => entry.trim()))
  .pipe(z.array(OriginSchema).min(1));

const EnvSchema = z
  .object({
    PORT: z.coerce.number().int().min(0).max(MAX_PORT).default(DEFAULT_PORT),
    HOST: z.string().min(1).default(DEFAULT_HOST),
    MONGO_URL: z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://')
      .default(DEFAULT_MONGO_URL),
    JWT_SECRET: z
      .string()
      .min(MIN_JWT_SECRET_LENGTH, `must be at least ${MIN_JWT_SECRET_LENGTH} characters`)
      .refine(
        (secret) => !PLACEHOLDER_SECRETS.includes(secret),
        'placeholder value is not allowed',
      ),
    OWNER_EMAIL: EmailInputSchema.optional(),
    OWNER_PASSWORD: z
      .string()
      .min(MIN_OWNER_PASSWORD_LENGTH, `must be at least ${MIN_OWNER_PASSWORD_LENGTH} characters`)
      .max(MAX_PASSWORD_LENGTH)
      .optional(),
    EVENTS_DISPATCH: z.enum(['on', 'off']).default('on'),
    CORS_ORIGINS: z.string().default(DEFAULT_CORS_ORIGINS).pipe(CorsOriginsSchema),
  })
  .refine((env) => env.OWNER_EMAIL === undefined || env.OWNER_PASSWORD !== undefined, {
    path: ['OWNER_PASSWORD'],
    message: 'is required when OWNER_EMAIL is set',
  });

export interface Env {
  readonly port: number;
  readonly host: string;
  readonly mongoUrl: string;
  readonly jwtSecret: string;
  readonly eventsDispatch: 'on' | 'off';
  readonly corsOrigins: readonly string[];
  readonly owner: OwnerCredentials | undefined;
}

// Empty strings count as unset so `KEY=` in .env behaves like a missing key.
function pickEnvValues(source: Record<string, string | undefined>): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const key of ENV_KEYS) {
    const value = source[key];
    if (value !== undefined && value !== '') {
      picked[key] = value;
    }
  }
  return picked;
}

// Issue messages carry key names only, never the rejected values (secrets stay out of logs).
function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
}

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = EnvSchema.safeParse(pickEnvValues(source));
  if (!result.success) {
    throw new Error(`Invalid environment: ${formatIssues(result.error)}`);
  }
  const env = result.data;
  const owner =
    env.OWNER_EMAIL !== undefined && env.OWNER_PASSWORD !== undefined
      ? { email: env.OWNER_EMAIL, password: env.OWNER_PASSWORD }
      : undefined;
  return {
    port: env.PORT,
    host: env.HOST,
    mongoUrl: env.MONGO_URL,
    jwtSecret: env.JWT_SECRET,
    eventsDispatch: env.EVENTS_DISPATCH,
    corsOrigins: env.CORS_ORIGINS,
    owner,
  };
}
