import { HermesProfileSchema } from '@redhunter/shared';
import aiDevelopment from '../seed/ai_development.json' with { type: 'json' };
import ceo from '../seed/ceo.json' with { type: 'json' };
import coo from '../seed/coo.json' with { type: 'json' };
import cto from '../seed/cto.json' with { type: 'json' };
import game from '../seed/game.json' with { type: 'json' };
import iot from '../seed/iot.json' with { type: 'json' };
import programming from '../seed/programming.json' with { type: 'json' };
import type { HermesStore, ProfileVersion } from './store';

const SeedProfileSchema = HermesProfileSchema.omit({ id: true });

function freezeProfile(profile: ProfileVersion): ProfileVersion {
  Object.freeze(profile.personalityTraits);
  return Object.freeze(profile);
}

// Order = AGENT_IDS (reporting hierarchy). JSON is parsed at import so a bad seed fails fast.
export const SEED_PROFILES: readonly ProfileVersion[] = Object.freeze(
  [ceo, coo, cto, programming, game, iot, aiDevelopment].map((raw) =>
    freezeProfile(SeedProfileSchema.parse(raw)),
  ),
);

// Idempotent: existing versions and pointers are left untouched.
export async function seedProfiles(store: HermesStore): Promise<number> {
  for (const profile of SEED_PROFILES) await store.ensureProfileVersion(profile);
  return SEED_PROFILES.length;
}
