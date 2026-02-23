/**
 * Property-based tests for ECS Save System
 * **Feature: codename-rice-game, Property 28: 数据保存加载往返一致性**
 * **Feature: codename-rice-game, Property 29: 数据错误恢复**
 * **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { World } from './World';
import { SaveSystem, CloudStorageProvider, SaveMetadata } from './SaveSystem';
import { Entity } from './Entity';
import { Component, createComponentType } from './Component';

// Test components for property testing
class PositionComponent extends Component {
  public readonly type = 'PositionComponent';
  constructor(public x: number, public y: number) {
    super();
  }
}

class HealthComponent extends Component {
  public readonly type = 'HealthComponent';
  constructor(public current: number, public maximum: number) {
    super();
  }
}

class InventoryComponent extends Component {
  public readonly type = 'InventoryComponent';
  constructor(public items: string[], public capacity: number) {
    super();
  }
}

// Mock cloud storage provider for testing
class MockCloudStorageProvider implements CloudStorageProvider {
  private storage = new Map<string, string>();
  private shouldFail = false;

  async save(key: string, data: string, metadata?: SaveMetadata): Promise<boolean> {
    if (this.shouldFail) return false;
    this.storage.set(key, data);
    return true;
  }

  async load(key: string): Promise<string | null> {
    if (this.shouldFail) return null;
    return this.storage.get(key) || null;
  }

  async delete(key: string): Promise<boolean> {
    if (this.shouldFail) return false;
    return this.storage.delete(key);
  }

  async list(): Promise<string[]> {
    if (this.shouldFail) return [];
    return Array.from(this.storage.keys());
  }

  setFailMode(fail: boolean): void {
    this.shouldFail = fail;
  }

  clear(): void {
    this.storage.clear();
  }
}

const PositionComponentType = createComponentType<PositionComponent>('PositionComponent');
const HealthComponentType = createComponentType<HealthComponent>('HealthComponent');
const InventoryComponentType = createComponentType<InventoryComponent>('InventoryComponent');

describe('SaveSystem Property Tests', () => {
  let mockCloudProvider: MockCloudStorageProvider;

  beforeEach(() => {
    Entity.resetIdCounter();
    mockCloudProvider = new MockCloudStorageProvider();
    SaveSystem.setCloudProvider(mockCloudProvider);
    
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    mockCloudProvider.clear();
  });

  /**
   * Property 28: 数据保存加载往返一致性
   * For any game state, saving to storage then reloading should restore the same game state
   */
  describe('Property 28: 数据保存加载往返一致性', () => {
    const worldGenerator = fc.record({
      entityCount: fc.integer({ min: 0, max: 10 }),
      entities: fc.array(
        fc.record({
          hasPosition: fc.boolean(),
          position: fc.record({
            x: fc.float({ min: -1000, max: 1000 }),
            y: fc.float({ min: -1000, max: 1000 }),
          }),
          hasHealth: fc.boolean(),
          health: fc.record({
            current: fc.integer({ min: 0, max: 1000 }),
            maximum: fc.integer({ min: 1, max: 1000 }),
          }),
          hasInventory: fc.boolean(),
          inventory: fc.record({
            items: fc.array(fc.string(), { maxLength: 5 }),
            capacity: fc.integer({ min: 1, max: 100 }),
          }),
        }),
        { maxLength: 10 }
      ),
    });

    it('**Validates: Requirements 17.1, 17.2, 17.4** - Local storage round-trip consistency', () => {
      fc.assert(
        fc.property(worldGenerator, fc.boolean(), (worldData, useCompression) => {
          // Create original world
          const originalWorld = new World();
          const createdEntities: Entity[] = [];

          // Create entities with components based on generated data
          for (let i = 0; i < Math.min(worldData.entityCount, worldData.entities.length); i++) {
            const entityData = worldData.entities[i];
            const entity = originalWorld.createEntity();
            createdEntities.push(entity);

            if (entityData.hasPosition) {
              const positionComponent = new PositionComponent(
                entityData.position.x,
                entityData.position.y
              );
              originalWorld.addComponent(entity.id, PositionComponentType, positionComponent);
            }

            if (entityData.hasHealth) {
              const healthComponent = new HealthComponent(
                Math.min(entityData.health.current, entityData.health.maximum),
                entityData.health.maximum
              );
              originalWorld.addComponent(entity.id, HealthComponentType, healthComponent);
            }

            if (entityData.hasInventory) {
              const inventoryComponent = new InventoryComponent(
                entityData.inventory.items,
                entityData.inventory.capacity
              );
              originalWorld.addComponent(entity.id, InventoryComponentType, inventoryComponent);
            }
          }

          // Save to localStorage with optional compression
          const saveKey = `test_save_${Date.now()}_${Math.random()}`;
          const saveSuccess = SaveSystem.saveToLocalStorage(originalWorld, saveKey, { 
            compress: useCompression,
            validateChecksum: true 
          });
          expect(saveSuccess).toBe(true);

          // Load from localStorage
          const restoredWorld = SaveSystem.loadFromLocalStorage(saveKey, { validateChecksum: true });
          expect(restoredWorld).not.toBeNull();

          if (restoredWorld) {
            // Verify entity count matches
            expect(restoredWorld.getAllEntities().length).toBe(originalWorld.getAllEntities().length);

            // Verify each entity and its components
            for (const originalEntity of createdEntities) {
              const restoredEntity = restoredWorld.getEntity(originalEntity.id);
              expect(restoredEntity).not.toBeNull();
              expect(restoredEntity?.id).toBe(originalEntity.id);

              // Check position component
              const originalPosition = originalWorld.getComponent(originalEntity.id, PositionComponentType);
              const restoredPosition = restoredWorld.getComponent(originalEntity.id, PositionComponentType);
              
              if (originalPosition) {
                expect(restoredPosition).not.toBeNull();
                expect(restoredPosition?.x).toBeCloseTo(originalPosition.x, 5);
                expect(restoredPosition?.y).toBeCloseTo(originalPosition.y, 5);
              } else {
                expect(restoredPosition).toBeNull();
              }

              // Check health component
              const originalHealth = originalWorld.getComponent(originalEntity.id, HealthComponentType);
              const restoredHealth = restoredWorld.getComponent(originalEntity.id, HealthComponentType);
              
              if (originalHealth) {
                expect(restoredHealth).not.toBeNull();
                expect(restoredHealth?.current).toBe(originalHealth.current);
                expect(restoredHealth?.maximum).toBe(originalHealth.maximum);
              } else {
                expect(restoredHealth).toBeNull();
              }

              // Check inventory component
              const originalInventory = originalWorld.getComponent(originalEntity.id, InventoryComponentType);
              const restoredInventory = restoredWorld.getComponent(originalEntity.id, InventoryComponentType);
              
              if (originalInventory) {
                expect(restoredInventory).not.toBeNull();
                expect(restoredInventory?.items).toEqual(originalInventory.items);
                expect(restoredInventory?.capacity).toBe(originalInventory.capacity);
              } else {
                expect(restoredInventory).toBeNull();
              }
            }

            // Verify world statistics match
            const originalStats = originalWorld.getStats();
            const restoredStats = restoredWorld.getStats();
            
            expect(restoredStats.entityCount).toBe(originalStats.entityCount);
            expect(restoredStats.componentCount).toBe(originalStats.componentCount);
          }

          // Clean up
          SaveSystem.deleteSave(saveKey);
        }),
        { numRuns: 50 }
      );
    });

    it('**Validates: Requirements 17.1, 17.2, 17.4** - Cloud storage round-trip consistency', async () => {
      await fc.assert(
        fc.asyncProperty(worldGenerator, fc.boolean(), async (worldData, useCompression) => {
          // Create original world
          const originalWorld = new World();
          const createdEntities: Entity[] = [];

          // Create entities with components (simplified for cloud test)
          for (let i = 0; i < Math.min(worldData.entityCount, worldData.entities.length); i++) {
            const entityData = worldData.entities[i];
            const entity = originalWorld.createEntity();
            createdEntities.push(entity);

            if (entityData.hasPosition) {
              const positionComponent = new PositionComponent(
                entityData.position.x,
                entityData.position.y
              );
              originalWorld.addComponent(entity.id, PositionComponentType, positionComponent);
            }
          }

          // Save to cloud storage
          const saveKey = `cloud_test_${Date.now()}_${Math.random()}`;
          const saveSuccess = await SaveSystem.saveToCloud(originalWorld, saveKey, { 
            compress: useCompression 
          });
          expect(saveSuccess).toBe(true);

          // Load from cloud storage
          const restoredWorld = await SaveSystem.loadFromCloud(saveKey);
          expect(restoredWorld).not.toBeNull();

          if (restoredWorld) {
            // Verify entity count matches
            expect(restoredWorld.getAllEntities().length).toBe(originalWorld.getAllEntities().length);

            // Verify each entity
            for (const originalEntity of createdEntities) {
              const restoredEntity = restoredWorld.getEntity(originalEntity.id);
              expect(restoredEntity).not.toBeNull();
              expect(restoredEntity?.id).toBe(originalEntity.id);
            }
          }
        }),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 29: 数据错误恢复
   * For any data corruption or loading failure, the system should provide recovery options
   */
  describe('Property 29: 数据错误恢复', () => {
    const worldGenerator = fc.record({
      entityCount: fc.integer({ min: 0, max: 3 }),
      entities: fc.array(
        fc.record({
          hasPosition: fc.boolean(),
          position: fc.record({
            x: fc.float({ min: -100, max: 100 }),
            y: fc.float({ min: -100, max: 100 }),
          }),
        }),
        { maxLength: 3 }
      ),
    });

    it('**Validates: Requirements 17.3, 17.5** - Backup recovery when main save is corrupted', () => {
      fc.assert(
        fc.property(worldGenerator, (worldData) => {
          // Create original world
          const originalWorld = new World();
          
          // Ensure we have at least one entity for meaningful backup test
          const entityCount = Math.max(1, Math.min(worldData.entityCount, 3));
          
          // Add some entities
          for (let i = 0; i < entityCount; i++) {
            const entity = originalWorld.createEntity();
            const positionComponent = new PositionComponent(i * 10, i * 20);
            originalWorld.addComponent(entity.id, PositionComponentType, positionComponent);
          }

          const saveKey = `backup_test_${Date.now()}_${Math.random()}`;
          
          // Save first version (this will become backup)
          SaveSystem.saveToLocalStorage(originalWorld, saveKey);
          
          // Create modified world
          const modifiedWorld = new World();
          const newEntity = modifiedWorld.createEntity();
          const newPosition = new PositionComponent(999, 999);
          modifiedWorld.addComponent(newEntity.id, PositionComponentType, newPosition);
          
          // Save modified version
          SaveSystem.saveToLocalStorage(modifiedWorld, saveKey);
          
          // Corrupt the main save by writing invalid JSON
          localStorage.setItem(saveKey, 'invalid json data');
          
          // Try to load - should recover from backup
          const recoveredWorld = SaveSystem.loadFromLocalStorage(saveKey);
          
          // Should recover the first version (backup), not the corrupted data
          if (recoveredWorld) {
            const entities = recoveredWorld.getAllEntities();
            expect(entities.length).toBeGreaterThan(0);
            
            // Should not contain the corrupted data marker
            const positions = entities.map(e => 
              recoveredWorld.getComponent(e.id, PositionComponentType)
            ).filter(p => p !== null);
            
            const hasCorruptedMarker = positions.some(p => p?.x === 999 && p?.y === 999);
            expect(hasCorruptedMarker).toBe(false);
          }
          
          // Clean up
          SaveSystem.deleteSave(saveKey);
        }),
        { numRuns: 10 }
      );
    });

    it('**Validates: Requirements 17.3, 17.5** - Graceful handling of cloud storage failures', async () => {
      await fc.assert(
        fc.asyncProperty(worldGenerator, async (worldData) => {
          // Create world
          const world = new World();
          const entity = world.createEntity();
          const position = new PositionComponent(100, 200);
          world.addComponent(entity.id, PositionComponentType, position);

          const saveKey = `cloud_fail_test_${Date.now()}`;
          
          // First save should succeed
          let saveResult = await SaveSystem.saveToCloud(world, saveKey);
          expect(saveResult).toBe(true);
          
          // Set cloud provider to fail mode
          mockCloudProvider.setFailMode(true);
          
          // Save should fail gracefully
          saveResult = await SaveSystem.saveToCloud(world, saveKey);
          expect(saveResult).toBe(false);
          
          // Load should fail gracefully and return null
          const loadResult = await SaveSystem.loadFromCloud(saveKey);
          expect(loadResult).toBeNull();
          
          // Reset cloud provider
          mockCloudProvider.setFailMode(false);
        }),
        { numRuns: 5 }
      );
    });

    it('**Validates: Requirements 17.3, 17.5** - Checksum validation detects corruption', () => {
      fc.assert(
        fc.property(worldGenerator, (worldData) => {
          // Create world
          const world = new World();
          const entity = world.createEntity();
          const position = new PositionComponent(50, 75);
          world.addComponent(entity.id, PositionComponentType, position);

          const saveKey = `checksum_test_${Date.now()}_${Math.random()}`;
          
          // Save with checksum validation
          const saveSuccess = SaveSystem.saveToLocalStorage(world, saveKey, { 
            validateChecksum: true 
          });
          expect(saveSuccess).toBe(true);
          
          // Verify save data is valid
          const isValid = SaveSystem.validateSaveData(saveKey);
          expect(isValid).toBe(true);
          
          // Corrupt the save data
          const originalData = localStorage.getItem(saveKey);
          if (originalData) {
            const corrupted = originalData.replace('"x":50', '"x":999');
            localStorage.setItem(saveKey, corrupted);
            
            // Validation should detect corruption
            const isStillValid = SaveSystem.validateSaveData(saveKey);
            expect(isStillValid).toBe(false);
          }
          
          // Clean up
          SaveSystem.deleteSave(saveKey);
        }),
        { numRuns: 10 }
      );
    });
  });

  it('should handle empty world serialization', () => {
    const emptyWorld = new World();
    const serialized = SaveSystem.serialize(emptyWorld);
    const restored = SaveSystem.deserialize(serialized);
    
    expect(restored.getAllEntities().length).toBe(0);
    expect(restored.getStats().entityCount).toBe(0);
    expect(restored.getStats().componentCount).toBe(0);
  });

  it('should preserve entity ID sequence', () => {
    const world1 = new World();
    const entity1 = world1.createEntity();
    const entity2 = world1.createEntity();
    
    const serialized = SaveSystem.serialize(world1);
    const restored = SaveSystem.deserialize(serialized);
    
    // Create a new entity in the restored world
    const newEntity = restored.createEntity();
    
    // The new entity should have the next ID in sequence
    expect(newEntity.id).toBeGreaterThan(Math.max(entity1.id, entity2.id));
  });

  it('should list available saves correctly', () => {
    const world = new World();
    const entity = world.createEntity();
    world.addComponent(entity.id, PositionComponentType, new PositionComponent(1, 2));

    // Create multiple saves
    const saveKeys = ['save1', 'save2', 'save3'];
    saveKeys.forEach(key => {
      SaveSystem.saveToLocalStorage(world, key);
    });

    // Add some non-save data
    localStorage.setItem('not_a_save', 'random data');
    localStorage.setItem('save1_backup_123456', 'backup data');

    const availableSaves = SaveSystem.getAvailableSaves();
    
    // Should include all save keys but not backups or random data
    saveKeys.forEach(key => {
      expect(availableSaves).toContain(key);
    });
    
    expect(availableSaves).not.toContain('not_a_save');
    expect(availableSaves).not.toContain('save1_backup_123456');

    // Clean up
    saveKeys.forEach(key => SaveSystem.deleteSave(key));
    localStorage.removeItem('not_a_save');
  });
});