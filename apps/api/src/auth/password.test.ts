import { describe, expect, test } from 'bun:test';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  test('hashPassword produces an argon2id hash that never contains the plain text', async () => {
    const plain = 'correct horse battery staple';
    const hash = await hashPassword(plain);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain(plain);
  });

  test('verifyPassword accepts the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('right-password');
    expect(await verifyPassword('right-password', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  test('verifyPassword returns false for a missing hash (unknown user path)', async () => {
    expect(await verifyPassword('anything', undefined)).toBe(false);
  });

  test('same password hashes differently (salted)', async () => {
    const [first, second] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(first).not.toBe(second);
  });
});
