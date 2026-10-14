import { describe, expect, test } from 'bun:test';
import { loadEnv } from './env';

const VALID_SECRET = 's'.repeat(32);

describe('loadEnv', () => {
  test('applies defaults when only JWT_SECRET is set', () => {
    expect(loadEnv({ JWT_SECRET: VALID_SECRET })).toEqual({
      port: 4000,
      host: '127.0.0.1',
      mongoUrl: 'mongodb://127.0.0.1:27017/redhunter',
      jwtSecret: VALID_SECRET,
      eventsDispatch: 'on',
      corsOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      owner: undefined,
    });
  });

  test('parses CORS_ORIGINS as a trimmed comma list of exact origins', () => {
    const env = loadEnv({
      JWT_SECRET: VALID_SECRET,
      CORS_ORIGINS: ' https://office.example.test , http://100.64.0.1:3000 ',
    });
    expect(env.corsOrigins).toEqual(['https://office.example.test', 'http://100.64.0.1:3000']);
  });

  test('rejects wildcard, paths and non-http CORS_ORIGINS entries', () => {
    for (const value of ['*', 'https://ok.test/path', 'ftp://ok.test', 'not a url', ',']) {
      expect(() => loadEnv({ JWT_SECRET: VALID_SECRET, CORS_ORIGINS: value })).toThrow(
        /CORS_ORIGINS/,
      );
    }
  });

  test('fails fast when JWT_SECRET is missing', () => {
    expect(() => loadEnv({})).toThrow(/JWT_SECRET/);
  });

  test('fails fast when JWT_SECRET is shorter than 32 chars without leaking the value', () => {
    const shortSecret = 'too-short-secret-value';
    let message = '';
    try {
      loadEnv({ JWT_SECRET: shortSecret });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toMatch(/JWT_SECRET/);
    expect(message).not.toContain(shortSecret);
  });

  test('rejects the .env.example placeholder secret even though it is long enough', () => {
    expect(() => loadEnv({ JWT_SECRET: 'change-me-to-a-long-random-string' })).toThrow(
      /JWT_SECRET/,
    );
  });

  test('coerces PORT and rejects non-numeric PORT', () => {
    expect(loadEnv({ JWT_SECRET: VALID_SECRET, PORT: '4010' }).port).toBe(4010);
    expect(() => loadEnv({ JWT_SECRET: VALID_SECRET, PORT: 'abc' })).toThrow(/PORT/);
  });

  test('rejects a non-mongodb MONGO_URL', () => {
    expect(() => loadEnv({ JWT_SECRET: VALID_SECRET, MONGO_URL: 'http://evil.test' })).toThrow(
      /MONGO_URL/,
    );
  });

  test('rejects EVENTS_DISPATCH outside on|off', () => {
    expect(loadEnv({ JWT_SECRET: VALID_SECRET, EVENTS_DISPATCH: 'off' }).eventsDispatch).toBe(
      'off',
    );
    expect(() => loadEnv({ JWT_SECRET: VALID_SECRET, EVENTS_DISPATCH: 'maybe' })).toThrow(
      /EVENTS_DISPATCH/,
    );
  });

  test('builds owner credentials with a normalized email', () => {
    const env = loadEnv({
      JWT_SECRET: VALID_SECRET,
      OWNER_EMAIL: ' Owner@Example.TEST ',
      OWNER_PASSWORD: 'owner-password-1',
    });
    expect(env.owner).toEqual({ email: 'owner@example.test', password: 'owner-password-1' });
  });

  test('treats empty owner vars as unset', () => {
    const env = loadEnv({ JWT_SECRET: VALID_SECRET, OWNER_EMAIL: '', OWNER_PASSWORD: '' });
    expect(env.owner).toBeUndefined();
  });

  test('requires OWNER_PASSWORD when OWNER_EMAIL is set', () => {
    expect(() => loadEnv({ JWT_SECRET: VALID_SECRET, OWNER_EMAIL: 'owner@example.test' })).toThrow(
      /OWNER_PASSWORD/,
    );
  });

  test('rejects an OWNER_PASSWORD shorter than 12 chars (e.g. the change-me placeholder)', () => {
    expect(() =>
      loadEnv({
        JWT_SECRET: VALID_SECRET,
        OWNER_EMAIL: 'owner@example.test',
        OWNER_PASSWORD: 'change-me',
      }),
    ).toThrow(/OWNER_PASSWORD/);
  });

  test('rejects an invalid OWNER_EMAIL', () => {
    expect(() =>
      loadEnv({
        JWT_SECRET: VALID_SECRET,
        OWNER_EMAIL: 'not-an-email',
        OWNER_PASSWORD: 'x'.repeat(12),
      }),
    ).toThrow(/OWNER_EMAIL/);
  });
});
