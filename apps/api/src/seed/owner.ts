import { UserSchema } from '@redhunter/shared';
import { EmailInputSchema, type OwnerCredentials } from '../auth/credentials';
import { hashPassword } from '../auth/password';
import type { Models } from '../db/models';

export interface OwnerSeedResult {
  readonly created: boolean;
  readonly passwordUpdated: boolean;
}

export interface OwnerSeedOptions {
  // Explicit opt-in to reset the owner password from env (CLI flag --force-owner-password).
  readonly forcePassword?: boolean;
}

const NewUserSchema = UserSchema.omit({ id: true });

// Idempotent upsert keyed by normalized email. An existing owner's password is kept unless
// forcePassword is set, so a password changed after first boot survives restarts.
export async function seedOwner(
  models: Models,
  credentials: OwnerCredentials,
  options: OwnerSeedOptions = {},
): Promise<OwnerSeedResult> {
  const owner = NewUserSchema.parse({
    email: EmailInputSchema.parse(credentials.email),
    passwordHash: await hashPassword(credentials.password),
    role: 'owner',
  });
  const upsert = await models.User.updateOne(
    { email: owner.email },
    // OWNER_EMAIL is authoritative for who the owner is, so the role is re-asserted.
    { $set: { role: owner.role }, $setOnInsert: { passwordHash: owner.passwordHash } },
    { upsert: true },
  );
  if (upsert.upsertedCount > 0) {
    return { created: true, passwordUpdated: true };
  }
  if (options.forcePassword !== true) {
    return { created: false, passwordUpdated: false };
  }
  await models.User.updateOne(
    { email: owner.email },
    { $set: { passwordHash: owner.passwordHash } },
  );
  return { created: false, passwordUpdated: true };
}
