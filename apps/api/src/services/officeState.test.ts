import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { AGENT_IDS, OFFICE_LAYOUT, OfficeStateSchema } from '@redhunter/shared';
import { startWorkContext, type WorkContext } from '../test-support/work';
import { getOfficeState, INITIAL_OFFICE_STATE, OFFICE_STATE_ID } from './officeState';

let ctx: WorkContext;

beforeAll(async () => {
  ctx = await startWorkContext();
});

afterAll(async () => {
  await ctx.db.drop();
});

beforeEach(async () => {
  await ctx.db.connection.collection('office_state').deleteMany({});
});

describe('INITIAL_OFFICE_STATE', () => {
  test('is the exact deterministic projection of OFFICE_LAYOUT with idle, sitting agents', () => {
    expect<unknown>(INITIAL_OFFICE_STATE).toEqual({
      version: 0,
      floors: [
        { id: 1, agents: [] },
        {
          id: 2,
          agents: [
            {
              agentId: 'programming',
              deskId: 'f2-programming',
              pose: 'sitting',
              status: 'idle',
              activityLabel: '',
            },
            {
              agentId: 'game',
              deskId: 'f2-game',
              pose: 'sitting',
              status: 'idle',
              activityLabel: '',
            },
            {
              agentId: 'iot',
              deskId: 'f2-iot',
              pose: 'sitting',
              status: 'idle',
              activityLabel: '',
            },
            {
              agentId: 'ai_development',
              deskId: 'f2-ai-development',
              pose: 'sitting',
              status: 'idle',
              activityLabel: '',
            },
          ],
        },
        {
          id: 3,
          agents: [
            {
              agentId: 'coo',
              deskId: 'f3-coo',
              pose: 'sitting',
              status: 'idle',
              activityLabel: '',
            },
            {
              agentId: 'cto',
              deskId: 'f3-cto',
              pose: 'sitting',
              status: 'idle',
              activityLabel: '',
            },
          ],
        },
        {
          id: 4,
          agents: [
            {
              agentId: 'ceo',
              deskId: 'f4-ceo',
              pose: 'sitting',
              status: 'idle',
              activityLabel: '',
            },
          ],
        },
      ],
      drones: [],
      updatedAt: '1970-01-01T00:00:00.000Z',
    });
    expect(() => OfficeStateSchema.strict().parse(INITIAL_OFFICE_STATE)).not.toThrow();
  });

  test('places all 7 agents exactly once, matching OFFICE_LAYOUT floor ids', () => {
    const placed = INITIAL_OFFICE_STATE.floors.flatMap((floor) =>
      floor.agents.map((a) => a.agentId),
    );
    expect([...placed].sort()).toEqual([...AGENT_IDS].sort());
    expect(INITIAL_OFFICE_STATE.floors.map((floor) => floor.id)).toEqual(
      OFFICE_LAYOUT.floors.map((floor) => floor.id),
    );
  });

  test('is frozen so callers cannot mutate the shared default', () => {
    expect(Object.isFrozen(INITIAL_OFFICE_STATE)).toBe(true);
    expect(Object.isFrozen(INITIAL_OFFICE_STATE.floors[1]?.agents[0])).toBe(true);
  });
});

describe('getOfficeState', () => {
  test('empty collection -> INITIAL_OFFICE_STATE, nothing written', async () => {
    expect(await getOfficeState(ctx.deps)).toEqual(INITIAL_OFFICE_STATE);
    expect(await ctx.db.connection.collection('office_state').countDocuments()).toBe(0);
  });

  test('reads only the singleton id, ignores other documents in the collection', async () => {
    const collection = ctx.db.connection.collection<{ _id: string }>('office_state');
    await collection.insertOne({
      _id: 'not-the-singleton',
      version: 42,
      floors: [],
      drones: [],
      updatedAt: new Date(),
    } as { _id: string });
    expect((await getOfficeState(ctx.deps)).version).toBe(0);
    await collection.insertOne({
      _id: OFFICE_STATE_ID,
      version: 3,
      floors: [],
      drones: [],
      updatedAt: new Date('2026-10-09T01:02:03.000Z'),
    } as { _id: string });
    expect(await getOfficeState(ctx.deps)).toEqual({
      version: 3,
      floors: [],
      drones: [],
      updatedAt: '2026-10-09T01:02:03.000Z',
    });
  });

  test('updatedAt must be a stored Date: string or missing value throws', async () => {
    const collection = ctx.db.connection.collection<{ _id: string }>('office_state');
    const base = { _id: OFFICE_STATE_ID, version: 1, floors: [], drones: [] };
    await collection.insertOne({ ...base, updatedAt: '2026-10-09T01:02:03.000Z' } as {
      _id: string;
    });
    await expect(getOfficeState(ctx.deps)).rejects.toThrow();
    await collection.deleteMany({});
    await collection.insertOne(base as { _id: string });
    await expect(getOfficeState(ctx.deps)).rejects.toThrow();
  });

  test('corrupt singleton throws (route maps it to a generic 500)', async () => {
    await ctx.db.connection.collection<{ _id: string }>('office_state').insertOne({
      _id: OFFICE_STATE_ID,
      version: 1,
      floors: [{ id: 9, agents: [] }],
      drones: [],
      updatedAt: new Date(),
    } as { _id: string });
    await expect(getOfficeState(ctx.deps)).rejects.toThrow();
  });
});
