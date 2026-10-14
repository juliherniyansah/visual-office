import { type HumanRole, HumanRoleSchema } from '@redhunter/shared';
import { errors, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

export const JWT_ALGORITHM = 'HS256';
export const JWT_TTL_SECONDS = 12 * 60 * 60;
export const JWT_ISSUER = 'redhunter-api';
export const JWT_AUDIENCE = 'redhunter';

export interface AccessClaims {
  readonly sub: string;
  readonly role: HumanRole;
}

const AccessClaimsSchema = z.object({
  sub: z.string().min(1),
  role: HumanRoleSchema,
});

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(claims: AccessClaims, secret: string): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: JWT_ALGORITHM, typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + JWT_TTL_SECONDS)
    .sign(encodeSecret(secret));
}

// Returns null for any invalid token (bad signature, alg none/other, expired, wrong aud/iss, bad role).
export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(secret), {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      requiredClaims: ['sub', 'iat', 'exp'],
    });
    const parsed = AccessClaimsSchema.safeParse(payload);
    return parsed.success ? { sub: parsed.data.sub, role: parsed.data.role } : null;
  } catch (err) {
    if (err instanceof errors.JOSEError) {
      return null;
    }
    throw err;
  }
}
