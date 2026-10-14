import { describe, expect, test } from 'bun:test';
import { SignJWT, UnsecuredJWT } from 'jose';
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  JWT_TTL_SECONDS,
  signAccessToken,
  verifyAccessToken,
} from './token';

const SECRET = 'token-test-secret-0123456789abcdef';
const OTHER_SECRET = 'another-secret-0123456789abcdef!!';
const USER_ID = '65f0c0ffee0000000000abcd';

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function tamperSignature(token: string): string {
  const parts = token.split('.');
  const signature = parts[2] ?? '';
  const flipped = signature.startsWith('A') ? `B${signature.slice(1)}` : `A${signature.slice(1)}`;
  return [parts[0], parts[1], flipped].join('.');
}

describe('access token', () => {
  test('round-trips sub and role with a 12h expiry', async () => {
    const token = await signAccessToken({ sub: USER_ID, role: 'operator' }, SECRET);
    const claims = await verifyAccessToken(token, SECRET);
    expect(claims).toEqual({ sub: USER_ID, role: 'operator' });
    expect(JWT_TTL_SECONDS).toBe(12 * 60 * 60);
  });

  test('header pins HS256 and payload carries exp = iat + 12h', async () => {
    const token = await signAccessToken({ sub: USER_ID, role: 'viewer' }, SECRET);
    const [headerPart, payloadPart] = token.split('.');
    const header: unknown = JSON.parse(Buffer.from(headerPart ?? '', 'base64url').toString());
    const payload: unknown = JSON.parse(Buffer.from(payloadPart ?? '', 'base64url').toString());
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(payload).toMatchObject({
      sub: USER_ID,
      role: 'viewer',
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    });
    const { iat, exp } = payload as { iat: number; exp: number };
    expect(exp - iat).toBe(JWT_TTL_SECONDS);
  });

  test('rejects a tampered signature', async () => {
    const token = await signAccessToken({ sub: USER_ID, role: 'owner' }, SECRET);
    expect(await verifyAccessToken(tamperSignature(token), SECRET)).toBeNull();
  });

  test('rejects a token signed with another secret', async () => {
    const token = await signAccessToken({ sub: USER_ID, role: 'owner' }, OTHER_SECRET);
    expect(await verifyAccessToken(token, SECRET)).toBeNull();
  });

  test('rejects an expired token', async () => {
    const issuedAt = nowSeconds() - 2 * JWT_TTL_SECONDS;
    const token = await new SignJWT({ role: 'owner' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(USER_ID)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 60)
      .sign(encodeSecret(SECRET));
    expect(await verifyAccessToken(token, SECRET)).toBeNull();
  });

  test('rejects alg=none (unsecured) tokens', async () => {
    const token = new UnsecuredJWT({ role: 'owner' })
      .setSubject(USER_ID)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .encode();
    expect(await verifyAccessToken(token, SECRET)).toBeNull();
  });

  test('rejects a validly signed token whose role is not a human role', async () => {
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(USER_ID)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(encodeSecret(SECRET));
    expect(await verifyAccessToken(token, SECRET)).toBeNull();
  });

  test('rejects a validly signed token without sub', async () => {
    const token = await new SignJWT({ role: 'owner' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(encodeSecret(SECRET));
    expect(await verifyAccessToken(token, SECRET)).toBeNull();
  });

  test('rejects a token for another audience', async () => {
    const token = await new SignJWT({ role: 'owner' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(USER_ID)
      .setIssuer(JWT_ISSUER)
      .setAudience('someone-else')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(encodeSecret(SECRET));
    expect(await verifyAccessToken(token, SECRET)).toBeNull();
  });

  test('rejects garbage strings', async () => {
    for (const garbage of ['', 'abc', 'a.b.c', 'Bearer x']) {
      expect(await verifyAccessToken(garbage, SECRET)).toBeNull();
    }
  });
});
