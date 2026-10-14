import { randomUUID } from 'node:crypto';

// Bun built-in argon2id (memory-hard KDF); no homemade crypto.
const PASSWORD_ALGORITHM = 'argon2id';

let dummyHashPromise: Promise<string> | undefined;

export async function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain, { algorithm: PASSWORD_ALGORITHM });
}

// Unknown users still pay one argon2 verify so response timing does not reveal account existence.
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomUUID());
  return dummyHashPromise;
}

export async function verifyPassword(plain: string, hash: string | undefined): Promise<boolean> {
  if (hash === undefined) {
    await Bun.password.verify(plain, await getDummyHash());
    return false;
  }
  return Bun.password.verify(plain, hash);
}
