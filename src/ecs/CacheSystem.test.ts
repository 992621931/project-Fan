/**
 * CacheSystem Performance Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Cache, CacheManager } from './CacheSystem';

describe('Cache Performance Tests', () => {
  let cache: Cache<string, any>;

  beforeEach(() => {
    cache = new Cache({
      maxSize: 1000,
      ttl: 60000, // 1 minute
      cleanupInterval: 10000, // 10 seconds
    });
  });

  afterEach(() => {
    cache.stopCleanup();
  });

  it('should handle rapid get/set operations efficiently', () => {
    const startTime = performance.now();
    const iterations = 10000;

    // Rapid set operations
    for (let i = 0; i < iterations; i++) {
      cache.set(`key${i}`, { value: i, data: `test${i}` });
    }

    const setTime = performance.now();

    // Rapid get operations
    let hitCount = 0;
    for (let i = 0; i < iterations; i++) {
      const result = cache.get(`key${i}`);
      if (result) hitCount++;
    }

    const getTime = performance.now();

    const setDuration = setTime - startTime;
    const getDuration = getTime - setTime;

    // Performance expectations
    expect(setDuration).toBeLessThan(100); // 100ms for 10k sets
    expect(getDuration).toBeLessThan(50);  // 50ms for 10k gets
    expect(hitCount).toBe(iterations);     // All should be hits

    const stats = cache.getStats();
    expect(stats.hitRate).toBe(100);
    expect(stats.size).toBe(Math.min(iterations, 1000)); // Limited by maxSize
  });

  it('should maintain performance under memory pressure', () => {
    const smallCache = new Cache<string, any>({
      maxSize: 100,
      ttl: 60000,
    });

    const startTime = performance.now();

    // Add more items than cache can hold
    for (let i = 0; i < 1000; i++) {
      smallCache.set(`key${i}`, { 
        value: i, 
        largeData: new Array(100).fill(`data${i}`) 
      });
    }

    const setTime = performance.now();

    // Try to get all items (many will be evicted)
    let hitCount = 0;
    for (let i = 0; i < 1000; i++) {
      const result = smallCache.get(`key${i}`);
      if (result) hitCount++;
    }

    const getTime = performance.now();

    const setDuration = setTime - startTime;
    const getDuration = getTime - setTime;

    // Should still be reasonably fast despite evictions
    expect(setDuration).toBeLessThan(200);
    expect(getDuration).toBeLessThan(100);

    const stats = smallCache.getStats();
    expect(stats.size).toBeLessThanOrEqual(100); // Should not exceed max size
    expect(stats.evictions).toBeGreaterThan(0);  // Should have evicted items

    smallCache.stopCleanup();
  });

  it('should handle TTL expiration efficiently', async () => {
    const shortTTLCache = new Cache<string, any>({
      maxSize: 1000,
      ttl: 50, // 50ms TTL
      cleanupInterval: 25, // 25ms cleanup
    });

    // Add items
    for (let i = 0; i < 100; i++) {
      shortTTLCache.set(`key${i}`, { value: i });
    }

    // Verify all items are accessible
    let initialHits = 0;
    for (let i = 0; i < 100; i++) {
      if (shortTTLCache.get(`key${i}`)) initialHits++;
    }
    expect(initialHits).toBe(100);

    // Wait for TTL expiration
    await new Promise(resolve => setTimeout(resolve, 100));

    const startTime = performance.now();

    // Try to access expired items
    let expiredHits = 0;
    for (let i = 0; i < 100; i++) {
      if (shortTTLCache.get(`key${i}`)) expiredHits++;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should be fast even when checking expired items
    expect(duration).toBeLessThan(50);
    expect(expiredHits).toBe(0); // All should be expired

    const stats = shortTTLCache.getStats();
    expect(stats.misses).toBeGreaterThan(0);

    shortTTLCache.stopCleanup();
  });

  it('should scale well with large datasets', () => {
    const largeCache = new Cache<string, any>({
      maxSize: 10000,
      ttl: 300000, // 5 minutes
    });

    const startTime = performance.now();

    // Add large dataset
    for (let i = 0; i < 5000; i++) {
      largeCache.set(`key${i}`, {
        id: i,
        name: `item${i}`,
        data: new Array(50).fill(i),
        metadata: { created: Date.now(), type: 'test' }
      });
    }

    const setTime = performance.now();

    // Random access pattern (more realistic)
    let hitCount = 0;
    for (let i = 0; i < 5000; i++) {
      const randomKey = `key${Math.floor(Math.random() * 5000)}`;
      if (largeCache.get(randomKey)) hitCount++;
    }

    const getTime = performance.now();

    const setDuration = setTime - startTime;
    const getDuration = getTime - setTime;

    // Should handle large datasets efficiently
    expect(setDuration).toBeLessThan(500);
    expect(getDuration).toBeLessThan(200);
    expect(hitCount).toBeGreaterThan(4000); // Most should be hits

    const stats = largeCache.getStats();
    expect(stats.hitRate).toBeGreaterThan(80);

    largeCache.stopCleanup();
  });
});

describe('CacheManager Performance Tests', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    cacheManager.clearAll();
  });

  it('should efficiently manage multiple caches', () => {
    const startTime = performance.now();

    // Create multiple caches
    const caches = [];
    for (let i = 0; i < 10; i++) {
      const cache = cacheManager.getCache(`cache${i}`, {
        maxSize: 500,
        ttl: 60000,
      });
      caches.push(cache);
    }

    const creationTime = performance.now();

    // Populate all caches
    for (let cacheIndex = 0; cacheIndex < 10; cacheIndex++) {
      const cache = caches[cacheIndex];
      for (let itemIndex = 0; itemIndex < 200; itemIndex++) {
        cache.set(`key${itemIndex}`, {
          cacheId: cacheIndex,
          itemId: itemIndex,
          data: `cache${cacheIndex}_item${itemIndex}`
        });
      }
    }

    const populationTime = performance.now();

    // Access items across all caches
    let totalHits = 0;
    for (let cacheIndex = 0; cacheIndex < 10; cacheIndex++) {
      const cache = caches[cacheIndex];
      for (let itemIndex = 0; itemIndex < 200; itemIndex++) {
        if (cache.get(`key${itemIndex}`)) totalHits++;
      }
    }

    const accessTime = performance.now();

    // Performance checks
    expect(creationTime - startTime).toBeLessThan(20);
    expect(populationTime - creationTime).toBeLessThan(200);
    expect(accessTime - populationTime).toBeLessThan(100);
    expect(totalHits).toBe(2000); // 10 caches * 200 items

    // Verify all caches have good performance
    const allStats = cacheManager.getAllStats();
    expect(Object.keys(allStats)).toHaveLength(10);

    for (const stats of Object.values(allStats)) {
      expect(stats.hitRate).toBe(100);
      expect(stats.size).toBe(200);
    }
  });

  it('should handle concurrent cache operations', async () => {
    const cache1 = cacheManager.getCache('concurrent1');
    const cache2 = cacheManager.getCache('concurrent2');

    const startTime = performance.now();

    // Simulate concurrent operations
    const promises = [];

    // Cache 1 operations
    promises.push(
      new Promise<void>(resolve => {
        for (let i = 0; i < 1000; i++) {
          cache1.set(`key${i}`, { value: i });
        }
        resolve();
      })
    );

    // Cache 2 operations
    promises.push(
      new Promise<void>(resolve => {
        for (let i = 0; i < 1000; i++) {
          cache2.set(`key${i}`, { value: i * 2 });
        }
        resolve();
      })
    );

    // Mixed read operations
    promises.push(
      new Promise<void>(resolve => {
        setTimeout(() => {
          for (let i = 0; i < 500; i++) {
            cache1.get(`key${i}`);
            cache2.get(`key${i}`);
          }
          resolve();
        }, 10);
      })
    );

    await Promise.all(promises);

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete concurrent operations efficiently
    expect(duration).toBeLessThan(300);

    const stats1 = cache1.getStats();
    const stats2 = cache2.getStats();

    expect(stats1.size).toBe(1000);
    expect(stats2.size).toBe(1000);
    expect(stats1.hits + stats2.hits).toBeGreaterThan(0);
  });
});