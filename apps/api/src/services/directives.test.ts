import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { DirectiveSchema } from '@redhunter/shared';
import { InvalidEventError } from '../events/outbox';
import { SYSTEM_ACTOR, startWorkContext, type WorkContext } from '../test-support/work';
import { createDirective, listDirectives } from './directives';

let ctx: WorkContext;
const HUMAN = { kind: 'human', id: 'user-1' } as const;

beforeAll(async () => {
  ctx = await startWorkContext();
});

afterAll(async () => {
  await ctx.db.drop();
});

beforeEach(async () => {
  await Promise.all([ctx.db.models.Directive.deleteMany({}), ctx.db.models.Event.deleteMany({})]);
});

describe('createDirective', () => {
  test('persists an issued directive with a uuid id and emits directive.created', async () => {
    const directive = await createDirective(ctx.deps, {
      text: 'Ship the lobby',
      priority: 'high',
      capabilityTags: ['code'],
      issuedBy: HUMAN,
    });

    expect(directive).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      issuedBy: HUMAN,
      text: 'Ship the lobby',
      status: 'issued',
      priority: 'high',
      capabilityTags: ['code'],
    });
    const rows = await ctx.db.models.Event.find({}).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'directive.created',
      aggregate: { kind: 'directive', id: directive.id },
      actor: HUMAN,
      payload: { directive },
    });
  });

  test('persists the document before emitting; an emit failure leaves the directive without event', async () => {
    const emit = spyOn(ctx.outbox, 'emit').mockImplementationOnce(() =>
      Promise.reject(new InvalidEventError('forced')),
    );
    try {
      await expect(
        createDirective(ctx.deps, {
          text: 'Orphan',
          priority: 'normal',
          capabilityTags: [],
          issuedBy: SYSTEM_ACTOR,
        }),
      ).rejects.toBeInstanceOf(InvalidEventError);
    } finally {
      emit.mockRestore();
    }
    expect(await ctx.db.models.Directive.countDocuments({ text: 'Orphan' })).toBe(1);
    expect(await ctx.db.models.Event.countDocuments()).toBe(0);
  });
});

describe('listDirectives', () => {
  test('returns re-validated directives in creation order without Mongo fields', async () => {
    const first = await createDirective(ctx.deps, {
      text: 'first',
      priority: 'low',
      capabilityTags: [],
      issuedBy: HUMAN,
    });
    await Bun.sleep(5);
    const second = await createDirective(ctx.deps, {
      text: 'second',
      priority: 'normal',
      capabilityTags: ['ai'],
      issuedBy: HUMAN,
    });

    const directives = await listDirectives(ctx.deps);
    expect(directives).toEqual([first, second]);
    for (const directive of directives) {
      expect(() => DirectiveSchema.strict().parse(directive)).not.toThrow();
    }
  });
});
