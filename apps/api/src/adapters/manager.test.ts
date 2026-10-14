import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { AdapterId } from '@redhunter/shared';
import { createAdapterManager, type AdapterHandle, type AdapterSpawner } from './manager';

describe('createAdapterManager', () => {
  test('starts adapter and tracks it in running map', async () => {
    let killCalled = false;
    const exitedPromise = new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>(
      (resolve) => {
        setTimeout(() => resolve({ exitCode: 0, signal: null }), 100);
      },
    );

    const spawner: AdapterSpawner = async (adapterId: AdapterId): Promise<AdapterHandle> => ({
      adapterId,
      pid: 12345,
      startedAt: new Date(),
      kill: async () => {
        killCalled = true;
      },
      exited: exitedPromise,
    });

    const manager = createAdapterManager(spawner);
    await manager.start('opencode');

    expect(manager.running.size).toBe(1);
    expect(manager.running.has('opencode')).toBe(true);

    const handle = manager.running.get('opencode');
    expect(handle?.pid).toBe(12345);
    expect(handle?.adapterId).toBe('opencode');

    await manager.stop('opencode');
    expect(killCalled).toBe(true);
    expect(manager.running.size).toBe(0);
  });

  test('retries with exponential backoff on crash', async () => {
    let spawnCount = 0;
    const spawnDelays: number[] = [];
    let lastSpawnTime = Date.now();

    const spawner: AdapterSpawner = async (adapterId: AdapterId): Promise<AdapterHandle> => {
      spawnCount++;
      const now = Date.now();
      if (spawnCount > 1) {
        spawnDelays.push(now - lastSpawnTime);
      }
      lastSpawnTime = now;

      const exitedPromise = new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>(
        (resolve) => {
          setTimeout(() => resolve({ exitCode: 1, signal: null }), 50);
        },
      );

      return {
        adapterId,
        pid: 10000 + spawnCount,
        startedAt: new Date(),
        kill: async () => {},
        exited: exitedPromise,
      };
    };

    const manager = createAdapterManager(spawner, {
      baseDelayMs: 100,
      maxDelayMs: 1000,
      maxRetries: 3,
    });

    await manager.start('opencode');

    // Wait for retries
    await new Promise((resolve) => setTimeout(resolve, 800));

    expect(spawnCount).toBeGreaterThanOrEqual(2);
    expect(spawnCount).toBeLessThanOrEqual(7);

    await manager.stopAll();
  });

  test('stops all adapters on stopAll', async () => {
    const killedAdapters: AdapterId[] = [];

    const spawner: AdapterSpawner = async (adapterId: AdapterId): Promise<AdapterHandle> => ({
      adapterId,
      pid: Math.floor(Math.random() * 10000),
      startedAt: new Date(),
      kill: async () => {
        killedAdapters.push(adapterId);
      },
      exited: new Promise(() => {}),
    });

    const manager = createAdapterManager(spawner);
    await manager.start('opencode');
    await manager.start('claude');
    await manager.start('codex');

    expect(manager.running.size).toBe(3);

    await manager.stopAll();

    expect(manager.running.size).toBe(0);
    expect(killedAdapters).toContain('opencode');
    expect(killedAdapters).toContain('claude');
    expect(killedAdapters).toContain('codex');
  });

  test('does not restart adapter when stopped gracefully', async () => {
    let spawnCount = 0;

    const spawner: AdapterSpawner = async (adapterId: AdapterId): Promise<AdapterHandle> => {
      spawnCount++;

      const exitedPromise = new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>(
        (resolve) => {
          setTimeout(() => resolve({ exitCode: 0, signal: null }), 50);
        },
      );

      return {
        adapterId,
        pid: 10000 + spawnCount,
        startedAt: new Date(),
        kill: async () => {},
        exited: exitedPromise,
      };
    };

    const manager = createAdapterManager(spawner);
    await manager.start('opencode');

    await new Promise((resolve) => setTimeout(resolve, 100));

    await manager.stop('opencode');

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(spawnCount).toBe(1);
  });

  test('handles spawn failure with retry', async () => {
    let spawnCount = 0;

    const spawner: AdapterSpawner = async (adapterId: AdapterId): Promise<AdapterHandle> => {
      spawnCount++;
      if (spawnCount < 3) {
        throw new Error('Spawn failed');
      }

      return {
        adapterId,
        pid: 10000 + spawnCount,
        startedAt: new Date(),
        kill: async () => {},
        exited: new Promise(() => {}),
      };
    };

    const manager = createAdapterManager(spawner, {
      baseDelayMs: 50,
      maxDelayMs: 500,
    });

    await manager.start('opencode');

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(spawnCount).toBeGreaterThanOrEqual(2);
    expect(manager.running.has('opencode')).toBe(true);

    await manager.stopAll();
  });
});
