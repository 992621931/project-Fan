/**
 * ObjectPool Performance Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ObjectPool, PoolManager, IPoolable } from './ObjectPool';

class TestPoolableObject implements IPoolable {
  public value: number = 0;
  public name: string = '';

  reset(): void {
    this.value = 0;
    this.name = '';
  }
}

describe('ObjectPool Performance Tests', () => {
  let pool: ObjectPool<TestPoolableObject>;

  beforeEach(() => {
    pool = new ObjectPool(
      () => new TestPoolableObject(),
      10,
      100
    );
  });

  it('should handle rapid acquire/release cycles efficiently', () => {
    const startTime = performance.now();
    const iterations = 10000;

    // Rapid acquire/release cycles
    for (let i = 0; i < iterations; i++) {
      const obj = pool.acquire();
      obj.value = i;
      obj.name = `test${i}`;
      pool.release(obj);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete within reasonable time (adjust threshold as needed)
    expect(duration).toBeLessThan(100); // 100ms for 10k operations

    const stats = pool.getStats();
    expect(stats.borrowed).toBe(iterations);
    expect(stats.returned).toBe(iterations);
    expect(stats.efficiency).toBeGreaterThan(90); // High efficiency expected
  });

  it('should maintain performance with large numbers of objects', () => {
    const startTime = performance.now();
    const objects: TestPoolableObject[] = [];

    // Acquire many objects
    for (let i = 0; i < 1000; i++) {
      const obj = pool.acquire();
      obj.value = i;
      objects.push(obj);
    }

    const acquireTime = performance.now();

    // Release all objects
    for (const obj of objects) {
      pool.release(obj);
    }

    const releaseTime = performance.now();

    const totalTime = releaseTime - startTime;
    const acquirePhase = acquireTime - startTime;
    const releasePhase = releaseTime - acquireTime;

    // Both phases should be reasonably fast
    expect(acquirePhase).toBeLessThan(50);
    expect(releasePhase).toBeLessThan(50);
    expect(totalTime).toBeLessThan(100);

    const stats = pool.getStats();
    expect(stats.poolSize).toBeGreaterThan(0); // Some objects should be pooled
  });

  it('should handle memory pressure gracefully', () => {
    const largePool = new ObjectPool(
      () => new TestPoolableObject(),
      100,
      500
    );

    // Create memory pressure by acquiring many objects
    const objects: TestPoolableObject[] = [];
    for (let i = 0; i < 2000; i++) {
      objects.push(largePool.acquire());
    }

    const stats = largePool.getStats();
    expect(stats.created).toBeGreaterThan(500); // Should create more than max pool size

    // Release objects - pool should handle overflow gracefully
    for (const obj of objects) {
      largePool.release(obj);
    }

    const finalStats = largePool.getStats();
    expect(finalStats.poolSize).toBeLessThanOrEqual(500); // Should not exceed max size
  });
});

describe('PoolManager Performance Tests', () => {
  let poolManager: PoolManager;

  beforeEach(() => {
    poolManager = new PoolManager();
  });

  it('should efficiently manage multiple pools', () => {
    const startTime = performance.now();

    // Register multiple pools
    for (let i = 0; i < 10; i++) {
      poolManager.registerPool(
        `pool${i}`,
        () => new TestPoolableObject(),
        10,
        100
      );
    }

    const registrationTime = performance.now();

    // Use all pools simultaneously
    const allObjects: TestPoolableObject[] = [];
    for (let poolIndex = 0; poolIndex < 10; poolIndex++) {
      const pool = poolManager.getPool<TestPoolableObject>(`pool${poolIndex}`);
      if (pool) {
        for (let objIndex = 0; objIndex < 100; objIndex++) {
          allObjects.push(pool.acquire());
        }
      }
    }

    const acquisitionTime = performance.now();

    // Release all objects
    let poolIndex = 0;
    for (let i = 0; i < allObjects.length; i++) {
      const pool = poolManager.getPool<TestPoolableObject>(`pool${poolIndex}`);
      if (pool) {
        pool.release(allObjects[i]);
      }
      poolIndex = (poolIndex + 1) % 10;
    }

    const releaseTime = performance.now();

    // Performance checks
    expect(registrationTime - startTime).toBeLessThan(10);
    expect(acquisitionTime - registrationTime).toBeLessThan(50);
    expect(releaseTime - acquisitionTime).toBeLessThan(50);

    // Verify all pools have good statistics
    const allStats = poolManager.getAllStats();
    expect(Object.keys(allStats)).toHaveLength(10);
    
    for (const stats of Object.values(allStats)) {
      expect(stats.efficiency).toBeGreaterThan(90);
    }
  });
});