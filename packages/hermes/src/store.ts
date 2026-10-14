import { randomUUID } from 'node:crypto';
import {
  type AgentId,
  AgentIdSchema,
  type HermesExperience,
  HermesExperienceSchema,
  type HermesMemory,
  HermesMemorySchema,
  type HermesProfile,
  HermesProfileSchema,
  type HermesSkill,
  HermesSkillSchema,
} from '@redhunter/shared';
import { z } from 'zod';
import { HermesAccessError, HermesNotFoundError } from './errors';
import type { HermesModels } from './models';

export type ProfileInput = Omit<HermesProfile, 'id' | 'version'>;
export type ProfileVersion = Omit<HermesProfile, 'id'>;
export type MemoryInput = Omit<HermesMemory, 'id' | 'createdAt'>;
export type ExperienceInput = Omit<HermesExperience, 'id'>;
export type Clock = () => Date;

const ProfileInputSchema = HermesProfileSchema.omit({ id: true, version: true });
const ProfileVersionSchema = HermesProfileSchema.omit({ id: true });
const ProfilePointerSchema = z.object({
  agentId: AgentIdSchema,
  activeVersion: z.number().int().positive(),
});
const MS_PER_SECOND = 1000;
const DUPLICATE_KEY_CODE = 11000;

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    ? error.code === DUPLICATE_KEY_CODE
    : false;
}

// Pointer id doubles as agents.hermesProfileId (apps/api seed uses `hermes-<agentId>`).
export function profilePointerId(agentId: AgentId): string {
  return `hermes-${agentId}`;
}

function profileVersionId(agentId: AgentId, version: number): string {
  return `${profilePointerId(agentId)}-v${version}`;
}

function assertOwnData(agentId: AgentId, asAgent: AgentId): void {
  if (agentId !== asAgent) throw new HermesAccessError(agentId, asAgent);
}

// Mongo rows are untrusted: every read is re-validated with the shared zod schemas.
function toProfile(row: { _id: unknown } & Record<string, unknown>): HermesProfile {
  const { _id, ...fields } = row;
  return HermesProfileSchema.parse({ ...fields, id: _id });
}

function toMemory(
  row: { _id: unknown; createdAt: unknown } & Record<string, unknown>,
): HermesMemory {
  const { _id, createdAt, ...fields } = row;
  if (!(createdAt instanceof Date))
    throw new TypeError(`Memory ${String(_id)} has no Date createdAt`);
  return HermesMemorySchema.parse({ ...fields, id: _id, createdAt: createdAt.toISOString() });
}

function toSkill(row: { _id: unknown } & Record<string, unknown>): HermesSkill {
  const { _id, ...fields } = row;
  return HermesSkillSchema.parse({ ...fields, id: _id });
}

function toExperience(row: { _id: unknown } & Record<string, unknown>): HermesExperience {
  const { _id, ...fields } = row;
  return HermesExperienceSchema.parse({ ...fields, id: _id });
}

function isLive(memory: HermesMemory, now: Date): boolean {
  if (memory.ttl === undefined) return true;
  return now.getTime() < Date.parse(memory.createdAt) + memory.ttl * MS_PER_SECOND;
}

export class HermesStore {
  constructor(
    private readonly models: HermesModels,
    private readonly now: Clock = () => new Date(),
  ) {}

  // Append-only: inserts version N+1 and moves the pointer; older rows are never touched.
  async createProfileVersion(input: ProfileInput): Promise<HermesProfile> {
    const fields = ProfileInputSchema.parse(input);
    const latest = await this.models.Profile.findOne({ agentId: fields.agentId })
      .sort({ version: -1 })
      .lean();
    const version = (latest?.version ?? 0) + 1;
    const profile = HermesProfileSchema.parse({
      ...fields,
      version,
      id: profileVersionId(fields.agentId, version),
    });
    const { id, ...stored } = profile;
    await this.models.Profile.create({ ...stored, _id: id, createdAt: this.now() });
    await this.setActiveVersion(fields.agentId, version);
    return profile;
  }

  // Idempotent seeding: inserts the exact version only if missing, never moves an existing pointer.
  async ensureProfileVersion(input: ProfileVersion): Promise<HermesProfile> {
    const fields = ProfileVersionSchema.parse(input);
    const id = profileVersionId(fields.agentId, fields.version);
    const profile = await this.insertProfileIfMissing(id, fields);
    await this.models.ProfilePointer.updateOne(
      { _id: profilePointerId(fields.agentId) },
      { $setOnInsert: { agentId: fields.agentId, activeVersion: fields.version } },
      { upsert: true },
    );
    return profile;
  }

  async activateProfileVersion(agentId: AgentId, version: number): Promise<void> {
    const exists = await this.models.Profile.exists({ agentId, version });
    if (exists === null) {
      throw new HermesNotFoundError(`Profile ${agentId} v${version} does not exist`);
    }
    await this.setActiveVersion(agentId, version);
  }

  async getProfile(agentId: AgentId, asAgent: AgentId): Promise<HermesProfile> {
    assertOwnData(agentId, asAgent);
    const pointerRow = await this.models.ProfilePointer.findById(profilePointerId(agentId)).lean();
    if (pointerRow === null) throw new HermesNotFoundError(`No Hermes profile for ${agentId}`);
    const pointer = ProfilePointerSchema.parse(pointerRow);
    // Misrouted pointer (agentId != its _id owner) must never serve another agent's profile.
    if (pointer.agentId !== agentId) {
      throw new HermesNotFoundError(`Pointer for ${agentId} belongs to ${pointer.agentId}`);
    }
    const row = await this.models.Profile.findOne({
      agentId,
      version: pointer.activeVersion,
    }).lean();
    if (row === null) {
      throw new HermesNotFoundError(`Profile ${agentId} v${pointer.activeVersion} missing`);
    }
    return toProfile(row);
  }

  async addMemory(input: MemoryInput): Promise<HermesMemory> {
    const createdAt = this.now();
    const memory = HermesMemorySchema.parse({
      ...input,
      id: randomUUID(),
      createdAt: createdAt.toISOString(),
    });
    const { id, ...stored } = memory;
    await this.models.Memory.create({ ...stored, _id: id, createdAt });
    return memory;
  }

  // Newest first (ties by id); ttl-expired rows are excluded.
  async getMemories(agentId: AgentId, asAgent: AgentId): Promise<HermesMemory[]> {
    assertOwnData(agentId, asAgent);
    const rows = await this.models.Memory.find({ agentId }).sort({ createdAt: -1, _id: 1 }).lean();
    const now = this.now();
    return rows.map(toMemory).filter((memory) => isLive(memory, now));
  }

  async upsertSkill(input: HermesSkill): Promise<HermesSkill> {
    const skill = HermesSkillSchema.parse(input);
    const { id, ...stored } = skill;
    await this.models.Skill.replaceOne({ _id: id }, stored, { upsert: true });
    return skill;
  }

  // Skills for a role that share at least one tag; sorted by name, then id.
  async findSkills(role: string, tags: readonly string[]): Promise<HermesSkill[]> {
    if (tags.length === 0) return [];
    const rows = await this.models.Skill.find({ appliesToRoles: role, tags: { $in: [...tags] } })
      .sort({ name: 1, _id: 1 })
      .lean();
    return rows.map(toSkill);
  }

  async addExperience(input: ExperienceInput): Promise<HermesExperience> {
    const experience = HermesExperienceSchema.parse({ ...input, id: randomUUID() });
    const { id, ...stored } = experience;
    await this.models.Experience.create({ ...stored, _id: id, createdAt: this.now() });
    return experience;
  }

  async getExperience(agentId: AgentId, asAgent: AgentId): Promise<HermesExperience[]> {
    assertOwnData(agentId, asAgent);
    const rows = await this.models.Experience.find({ agentId })
      .sort({ createdAt: -1, _id: 1 })
      .lean();
    return rows.map(toExperience);
  }

  // Concurrent boots race on the same seed id: the loser's E11000 means "already ensured",
  // so it returns the stored row (winner's data) instead of failing.
  private async insertProfileIfMissing(id: string, fields: ProfileVersion): Promise<HermesProfile> {
    const existing = await this.models.Profile.findById(id).lean();
    if (existing !== null) return toProfile(existing);
    try {
      await this.models.Profile.create({ ...fields, _id: id, createdAt: this.now() });
      return HermesProfileSchema.parse({ ...fields, id });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const stored = await this.models.Profile.findById(id).lean();
      if (stored === null) throw error;
      return toProfile(stored);
    }
  }

  private async setActiveVersion(agentId: AgentId, version: number): Promise<void> {
    await this.models.ProfilePointer.updateOne(
      { _id: profilePointerId(agentId) },
      { $set: { agentId, activeVersion: version } },
      { upsert: true },
    );
  }
}
