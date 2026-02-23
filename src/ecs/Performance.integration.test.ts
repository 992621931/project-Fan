/**
 * Performance Integration Tests
 * Tests the complete ECS system under various load conditions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from './World';
import { GameLoop } from './GameLoop';
import { Entity } from './Entity';
import { createComponentType } from './Component';
import { System } from './System';

// Test components
interface TestComponent {
  value: number;
  data: string;
}

interface PositionComponent {
  x: number;
  y: number;
}

interface VelocityComponent {
  dx: number;
  dy: number;
}

const TestComponentType = createComponentType<TestComponent>('TestComponent');
const PositionComponentType = createComponentType<PositionComponent>('PositionComponent');
const VelocityComponentType = createComponentType<VelocityComponent>('VelocityComponent');

// Test system
class MovementSystem extends System {
  public name = 'MovementSystem';

  update(deltaTime: number): void {
    const entities = this.entityManager.getEntitiesWithComponents([
      PositionComponentType,
      VelocityComponentType
    ]);

    for (const entityId of entities) {
      const position = this.componentManager.getComponent(entityId, PositionComponentType);
      const velocity = this.componentManager.getComponent(entityId, VelocityComponentType);

      if (position && velocity) {
        position.x += velocity.dx * deltaTime * 0.001;
        position.y += velocity.dy * deltaTime * 0.001;
      }
    }
  }
}

describe('ECS Performance Integration Tests', () => {
  let world: World;
  let gameLoop: GameLoop;

  beforeEach(() => {
    world = new World();
    gameLoop = new GameLoop(world, { targetFPS: 60 });
    world.addSystem(new MovementSystem());
  });

  afterEach(() => {
    gameLoop.stop();
    world.shutdown();
  });

  it('should handle large numbers of entities efficiently', () => {
    const startTime = performance.now();
    const entityCount = 10000;
    const entities: Entity[] = [];

    // Create many entities with components
    for (let i = 0; i < entityCount; i++) {
      const entity = world.createEntity();
      
      world.addComponent(entity.id, TestComponentType, {
        value: i,
        data: `entity${i}`
      });
      
      world.addComponent(entity.id, PositionComponentType, {
        x: Math.random() * 1000,
        y: Math.random() * 1000
      });
      
      world.addComponent(entity.id, VelocityComponentType, {
        dx: (Math.random() - 0.5) * 100,
        dy: (Math.random() - 0.5) * 100
      });
      
      entities.push(entity);
    }

    const creationTime = performance.now();
    const creationDuration = creationTime - startTime;

    // Should create entities reasonably quickly
    expect(creationDuration).toBeLessThan(1000); // 1 second for 10k entities

    // Initialize and run a few update cycles
    world.initialize();
    
    const updateStartTime = performance.now();
    for (let i = 0; i < 60; i++) { // Simulate 1 second at 60fps
      world.update(16.67);
    }
    const updateEndTime = performance.now();
    const updateDuration = updateEndTime - updateStartTime;

    // Should update efficiently
    expect(updateDuration).toBeLessThan(500); // 500ms for 60 updates of 10k entities

    // Verify entities were processed
    const stats = world.getStats();
    expect(stats.entityCount).toBe(entityCount);
    expect(stats.componentCount).toBe(entityCount * 3); // 3 components per entity

    console.log(`Performance test results:
      - Entity creation: ${creationDuration.toFixed(2)}ms for ${entityCount} entities
      - Update cycles: ${updateDuration.toFixed(2)}ms for 60 updates
      - Entities per second (creation): ${(entityCount / creationDuration * 1000).toFixed(0)}
      - Updates per second: ${(60 / updateDuration * 1000).toFixed(0)}
    `);
  });

  it('should maintain performance during entity lifecycle operations', () => {
    const initialEntityCount = 5000;
    const entities: Entity[] = [];

    // Create initial entities
    for (let i = 0; i < initialEntityCount; i++) {
      const entity = world.createEntity();
      world.addComponent(entity.id, TestComponentType, { value: i, data: `test${i}` });
      entities.push(entity);
    }

    world.initialize();

    const startTime = performance.now();
    const cycles = 100;

    for (let cycle = 0; cycle < cycles; cycle++) {
      // Add some entities
      for (let i = 0; i < 50; i++) {
        const entity = world.createEntity();
        world.addComponent(entity.id, TestComponentType, { 
          value: cycle * 50 + i, 
          data: `cycle${cycle}_${i}` 
        });
        entities.push(entity);
      }

      // Remove some entities
      for (let i = 0; i < 25; i++) {
        if (entities.length > initialEntityCount / 2) {
          const entity = entities.pop();
          if (entity) {
            world.destroyEntity(entity.id);
          }
        }
      }

      // Update world
      world.update(16.67);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should handle dynamic entity management efficiently
    expect(duration).toBeLessThan(1000); // 1 second for 100 cycles

    const finalStats = world.getStats();
    expect(finalStats.entityCount).toBeGreaterThan(0);

    console.log(`Dynamic entity management test:
      - Duration: ${duration.toFixed(2)}ms for ${cycles} cycles
      - Final entity count: ${finalStats.entityCount}
      - Final component count: ${finalStats.componentCount}
    `);
  });

  it('should demonstrate object pool efficiency', () => {
    // Register a pool for test objects
    const poolManager = world.getPoolManager();
    
    class PoolableTestObject {
      public value: number = 0;
      public name: string = '';
      
      reset(): void {
        this.value = 0;
        this.name = '';
      }
    }

    const pool = poolManager.registerPool(
      'testObjects',
      () => new PoolableTestObject(),
      100,
      1000
    );

    const startTime = performance.now();
    const iterations = 10000;

    // Test pool efficiency
    for (let i = 0; i < iterations; i++) {
      const obj = pool.acquire();
      obj.value = i;
      obj.name = `test${i}`;
      
      // Do some work with the object
      const result = obj.value * 2 + obj.name.length;
      
      pool.release(obj);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(200); // Should be very fast with pooling

    const poolStats = pool.getStats();
    expect(poolStats.efficiency).toBeGreaterThan(90); // High efficiency expected

    console.log(`Object pool efficiency test:
      - Duration: ${duration.toFixed(2)}ms for ${iterations} operations
      - Pool efficiency: ${poolStats.efficiency.toFixed(1)}%
      - Objects created: ${poolStats.created}
      - Objects borrowed: ${poolStats.borrowed}
      - Objects returned: ${poolStats.returned}
    `);
  });

  it('should demonstrate cache system performance', () => {
    const cacheManager = world.getCacheManager();
    const cache = cacheManager.getCache('testCache', {
      maxSize: 1000,
      ttl: 60000
    });

    const startTime = performance.now();
    const iterations = 10000;

    // Populate cache
    for (let i = 0; i < 1000; i++) {
      cache.set(`key${i}`, {
        id: i,
        data: `cached_data_${i}`,
        timestamp: Date.now(),
        metadata: { type: 'test', priority: i % 10 }
      });
    }

    const populateTime = performance.now();

    // Test cache access patterns
    let hitCount = 0;
    for (let i = 0; i < iterations; i++) {
      const key = `key${Math.floor(Math.random() * 1000)}`;
      const result = cache.get(key);
      if (result) hitCount++;
    }

    const endTime = performance.now();

    const populateDuration = populateTime - startTime;
    const accessDuration = endTime - populateTime;

    expect(populateDuration).toBeLessThan(100);
    expect(accessDuration).toBeLessThan(100);
    expect(hitCount).toBe(iterations); // All should be hits

    const cacheStats = cache.getStats();
    expect(cacheStats.hitRate).toBe(100);

    console.log(`Cache system performance test:
      - Populate duration: ${populateDuration.toFixed(2)}ms for 1000 items
      - Access duration: ${accessDuration.toFixed(2)}ms for ${iterations} accesses
      - Hit rate: ${cacheStats.hitRate.toFixed(1)}%
      - Cache size: ${cacheStats.size}
    `);

    cache.stopCleanup();
  });

  it('should monitor performance under sustained load', async () => {
    const performanceMonitor = world.getPerformanceMonitor();
    const entityCount = 5000;

    // Create entities
    for (let i = 0; i < entityCount; i++) {
      const entity = world.createEntity();
      world.addComponent(entity.id, PositionComponentType, {
        x: Math.random() * 1000,
        y: Math.random() * 1000
      });
      world.addComponent(entity.id, VelocityComponentType, {
        dx: (Math.random() - 0.5) * 100,
        dy: (Math.random() - 0.5) * 100
      });
    }

    world.initialize();

    const alerts: any[] = [];
    performanceMonitor.setAlertCallback((alert) => {
      alerts.push(alert);
    });

    // Run sustained load test
    const testDuration = 1000; // 1 second
    const startTime = performance.now();
    let frameCount = 0;

    while (performance.now() - startTime < testDuration) {
      performanceMonitor.startFrame();
      performanceMonitor.startUpdate();
      
      world.update(16.67);
      
      performanceMonitor.endUpdate();
      performanceMonitor.startRender();
      
      // Simulate render work
      const renderStart = performance.now();
      while (performance.now() - renderStart < 2) {
        // Busy wait for 2ms
      }
      
      performanceMonitor.endRender();
      
      const stats = world.getStats();
      performanceMonitor.endFrame(
        stats.entityCount,
        stats.componentCount,
        stats.systemCount,
        85, // Mock cache hit rate
        80  // Mock pool efficiency
      );
      
      frameCount++;
      
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    const averageMetrics = performanceMonitor.getAverageMetrics();
    expect(averageMetrics).toBeDefined();
    expect(averageMetrics!.entityCount).toBe(entityCount);

    const report = performanceMonitor.generateReport();
    expect(report.current).toBeDefined();
    expect(report.average).toBeDefined();

    console.log(`Sustained load test results:
      - Test duration: ${testDuration}ms
      - Frames processed: ${frameCount}
      - Average FPS: ${averageMetrics ? (1000 / averageMetrics.frameTime).toFixed(1) : 'N/A'}
      - Average frame time: ${averageMetrics ? averageMetrics.frameTime.toFixed(2) : 'N/A'}ms
      - Average update time: ${averageMetrics ? averageMetrics.updateTime.toFixed(2) : 'N/A'}ms
      - Average render time: ${averageMetrics ? averageMetrics.renderTime.toFixed(2) : 'N/A'}ms
      - Alerts generated: ${alerts.length}
    `);

    if (alerts.length > 0) {
      console.log('Performance alerts:', alerts.map(a => `${a.metric}: ${a.message}`));
    }
  });

  it('should handle memory pressure gracefully', () => {
    const startTime = performance.now();
    const largeEntityCount = 20000;
    const entities: Entity[] = [];

    // Create a large number of entities with substantial data
    for (let i = 0; i < largeEntityCount; i++) {
      const entity = world.createEntity();
      
      world.addComponent(entity.id, TestComponentType, {
        value: i,
        data: new Array(100).fill(`data${i}`).join('') // Large string
      });
      
      world.addComponent(entity.id, PositionComponentType, {
        x: Math.random() * 10000,
        y: Math.random() * 10000
      });
      
      entities.push(entity);
    }

    const creationTime = performance.now();
    world.initialize();

    // Run several update cycles
    for (let i = 0; i < 30; i++) {
      world.update(16.67);
    }

    const updateTime = performance.now();

    // Clean up half the entities
    for (let i = 0; i < largeEntityCount / 2; i++) {
      const entity = entities[i];
      world.destroyEntity(entity.id);
    }

    const cleanupTime = performance.now();

    const creationDuration = creationTime - startTime;
    const updateDuration = updateTime - creationTime;
    const cleanupDuration = cleanupTime - updateTime;

    // Should handle large memory usage without crashing
    expect(creationDuration).toBeLessThan(3000); // 3 seconds for 20k entities
    expect(updateDuration).toBeLessThan(1000);   // 1 second for 30 updates
    expect(cleanupDuration).toBeLessThan(1000);  // 1 second for cleanup

    const finalStats = world.getStats();
    expect(finalStats.entityCount).toBe(largeEntityCount / 2);

    console.log(`Memory pressure test results:
      - Creation: ${creationDuration.toFixed(2)}ms for ${largeEntityCount} entities
      - Updates: ${updateDuration.toFixed(2)}ms for 30 cycles
      - Cleanup: ${cleanupDuration.toFixed(2)}ms for ${largeEntityCount / 2} entities
      - Final entity count: ${finalStats.entityCount}
      - Final component count: ${finalStats.componentCount}
    `);
  });
});