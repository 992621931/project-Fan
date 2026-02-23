/**
 * SaveSystem HungerComponent Backward Compatibility Tests
 * Tests for Requirement 5.4: Old save compatibility
 * **Feature: hunger-system, Property 4: 数据持久化往返一致性**
 * **Validates: Requirements 5.1, 5.2**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { SaveSystem } from './SaveSystem';
import { World } from './World';
import { 
  CharacterInfoComponentType, 
  HealthComponentType,
  HungerComponentType 
} from '../game/components/CharacterComponents';

describe('SaveSystem HungerComponent Backward Compatibility', () => {
  let testWorld: World;

  beforeEach(() => {
    testWorld = new World();
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up
    localStorage.clear();
  });

  it('should automatically serialize HungerComponent when present', () => {
    // Create a character with HungerComponent
    const character = testWorld.createEntity();
    
    testWorld.addComponent(character.id, CharacterInfoComponentType, {
      type: 'characterInfo',
      title: 'Test',
      name: 'Character',
      isSpecial: false,
      rarity: 'common',
      status: 'available'
    });

    testWorld.addComponent(character.id, HealthComponentType, {
      type: 'health',
      current: 100,
      maximum: 100
    });

    testWorld.addComponent(character.id, HungerComponentType, {
      type: 'hunger',
      current: 75,
      maximum: 100
    });

    // Serialize
    const serialized = SaveSystem.serialize(testWorld);

    // Verify HungerComponent is in the serialized data
    const characterEntity = serialized.entities.find(e => e.id === character.id);
    expect(characterEntity).toBeDefined();
    
    const hungerComponent = characterEntity!.components.find(c => c.type === 'hunger');
    expect(hungerComponent).toBeDefined();
    expect(hungerComponent!.data.current).toBe(75);
    expect(hungerComponent!.data.maximum).toBe(100);
  });

  it('should add default HungerComponent to character entities without it (old save compatibility)', () => {
    // Create a serialized world that simulates an old save (no HungerComponent)
    const oldSaveData = {
      entities: [
        {
          id: 1,
          components: [
            {
              type: 'characterInfo',
              data: {
                title: 'Old',
                name: 'Character',
                isSpecial: false,
                rarity: 'common',
                status: 'available'
              }
            },
            {
              type: 'health',
              data: {
                current: 100,
                maximum: 100
              }
            }
            // Note: No HungerComponent in old save
          ]
        }
      ],
      nextEntityId: 2,
      version: '1.0.0',
      timestamp: Date.now()
    };

    // Deserialize the old save
    const loadedWorld = SaveSystem.deserialize(oldSaveData);

    // Verify the character entity exists
    const entities = loadedWorld.getAllEntities();
    expect(entities.length).toBe(1);

    // Verify HungerComponent was automatically added
    const hungerComponent = loadedWorld.getComponent(1, HungerComponentType);
    expect(hungerComponent).toBeDefined();
    expect(hungerComponent!.current).toBe(100);
    expect(hungerComponent!.maximum).toBe(100);
  });

  it('should not add HungerComponent to non-character entities', () => {
    // Create a serialized world with a non-character entity (e.g., item)
    const saveData = {
      entities: [
        {
          id: 1,
          components: [
            {
              type: 'item',
              data: {
                itemId: 'test-item',
                quantity: 1
              }
            }
          ]
        }
      ],
      nextEntityId: 2,
      version: '1.0.0',
      timestamp: Date.now()
    };

    // Deserialize
    const loadedWorld = SaveSystem.deserialize(saveData);

    // Verify the entity exists
    const entities = loadedWorld.getAllEntities();
    expect(entities.length).toBe(1);

    // Verify HungerComponent was NOT added (not a character)
    const hungerComponent = loadedWorld.getComponent(1, HungerComponentType);
    expect(hungerComponent).toBeNull();
  });

  it('should preserve existing HungerComponent values when loading', () => {
    // Create a save with HungerComponent
    const saveData = {
      entities: [
        {
          id: 1,
          components: [
            {
              type: 'characterInfo',
              data: {
                title: 'Test',
                name: 'Character',
                isSpecial: false,
                rarity: 'rare',
                status: 'available'
              }
            },
            {
              type: 'hunger',
              data: {
                current: 50,
                maximum: 100
              }
            }
          ]
        }
      ],
      nextEntityId: 2,
      version: '1.0.0',
      timestamp: Date.now()
    };

    // Deserialize
    const loadedWorld = SaveSystem.deserialize(saveData);

    // Verify HungerComponent values are preserved
    const hungerComponent = loadedWorld.getComponent(1, HungerComponentType);
    expect(hungerComponent).toBeDefined();
    expect(hungerComponent!.current).toBe(50);
    expect(hungerComponent!.maximum).toBe(100);
  });

  it('should handle round-trip save/load with HungerComponent', () => {
    // Create a character with HungerComponent
    const character = testWorld.createEntity();
    
    testWorld.addComponent(character.id, CharacterInfoComponentType, {
      type: 'characterInfo',
      title: 'Round',
      name: 'Trip',
      isSpecial: true,
      rarity: 'legendary',
      status: 'available'
    });

    testWorld.addComponent(character.id, HungerComponentType, {
      type: 'hunger',
      current: 33,
      maximum: 100
    });

    // Save to localStorage
    const saveKey = 'test_hunger_roundtrip';
    const saved = SaveSystem.saveToLocalStorage(testWorld, saveKey);
    expect(saved).toBe(true);

    // Load from localStorage
    const loadedWorld = SaveSystem.loadFromLocalStorage(saveKey);
    expect(loadedWorld).not.toBeNull();

    // Verify HungerComponent is preserved
    const hungerComponent = loadedWorld!.getComponent(character.id, HungerComponentType);
    expect(hungerComponent).toBeDefined();
    expect(hungerComponent!.current).toBe(33);
    expect(hungerComponent!.maximum).toBe(100);
  });

  /**
   * Property 4: 数据持久化往返一致性
   * For any HungerComponent data, saving then loading should preserve the values
   * **Validates: Requirements 5.1, 5.2**
   */
  describe('Property 4: 数据持久化往返一致性', () => {
    const hungerGenerator = fc.record({
      current: fc.integer({ min: 0, max: 200 }),
      maximum: fc.integer({ min: 1, max: 200 })
    }).map(data => ({
      current: Math.min(data.current, data.maximum), // Ensure current <= maximum
      maximum: data.maximum
    }));

    it('**Validates: Requirements 5.1, 5.2** - HungerComponent round-trip consistency', () => {
      fc.assert(
        fc.property(hungerGenerator, fc.boolean(), (hungerData, useCompression) => {
          // Create a world with a character entity
          const world = new World();
          const character = world.createEntity();
          
          // Add character info component
          world.addComponent(character.id, CharacterInfoComponentType, {
            type: 'characterInfo',
            title: 'Test',
            name: 'Character',
            isSpecial: false,
            rarity: 'common',
            status: 'available'
          });

          // Add HungerComponent with generated data
          world.addComponent(character.id, HungerComponentType, {
            type: 'hunger',
            current: hungerData.current,
            maximum: hungerData.maximum
          });

          // Save to localStorage with optional compression
          const saveKey = `test_hunger_pbt_${Date.now()}_${Math.random()}`;
          const saveSuccess = SaveSystem.saveToLocalStorage(world, saveKey, {
            compress: useCompression,
            validateChecksum: true
          });
          expect(saveSuccess).toBe(true);

          // Load from localStorage
          const loadedWorld = SaveSystem.loadFromLocalStorage(saveKey, { validateChecksum: true });
          expect(loadedWorld).not.toBeNull();

          if (loadedWorld) {
            // Verify HungerComponent was preserved
            const loadedHunger = loadedWorld.getComponent(character.id, HungerComponentType);
            expect(loadedHunger).not.toBeNull();
            
            // Verify values match exactly (round-trip property)
            expect(loadedHunger!.current).toBe(hungerData.current);
            expect(loadedHunger!.maximum).toBe(hungerData.maximum);
            expect(loadedHunger!.type).toBe('hunger');
          }

          // Clean up
          SaveSystem.deleteSave(saveKey);
        }),
        { numRuns: 100 }
      );
    });

    it('**Validates: Requirements 5.1, 5.2** - Multiple characters with different hunger values', () => {
      fc.assert(
        fc.property(
          fc.array(hungerGenerator, { minLength: 1, maxLength: 5 }),
          (hungerDataArray) => {
            // Create a world with multiple characters
            const world = new World();
            const characterIds: number[] = [];

            for (let i = 0; i < hungerDataArray.length; i++) {
              const character = world.createEntity();
              characterIds.push(character.id);

              // Add character info
              world.addComponent(character.id, CharacterInfoComponentType, {
                type: 'characterInfo',
                title: `Character${i}`,
                name: `Test${i}`,
                isSpecial: false,
                rarity: 'common',
                status: 'available'
              });

              // Add HungerComponent with unique data
              world.addComponent(character.id, HungerComponentType, {
                type: 'hunger',
                current: hungerDataArray[i].current,
                maximum: hungerDataArray[i].maximum
              });
            }

            // Save and load
            const saveKey = `test_multi_hunger_${Date.now()}_${Math.random()}`;
            SaveSystem.saveToLocalStorage(world, saveKey);
            const loadedWorld = SaveSystem.loadFromLocalStorage(saveKey);

            expect(loadedWorld).not.toBeNull();

            if (loadedWorld) {
              // Verify each character's hunger data
              for (let i = 0; i < characterIds.length; i++) {
                const loadedHunger = loadedWorld.getComponent(characterIds[i], HungerComponentType);
                expect(loadedHunger).not.toBeNull();
                expect(loadedHunger!.current).toBe(hungerDataArray[i].current);
                expect(loadedHunger!.maximum).toBe(hungerDataArray[i].maximum);
              }
            }

            // Clean up
            SaveSystem.deleteSave(saveKey);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('**Validates: Requirements 5.1, 5.2** - Serialization preserves hunger data structure', () => {
      fc.assert(
        fc.property(hungerGenerator, (hungerData) => {
          // Create world with character
          const world = new World();
          const character = world.createEntity();
          
          world.addComponent(character.id, CharacterInfoComponentType, {
            type: 'characterInfo',
            title: 'Test',
            name: 'Character',
            isSpecial: false,
            rarity: 'common',
            status: 'available'
          });

          world.addComponent(character.id, HungerComponentType, {
            type: 'hunger',
            current: hungerData.current,
            maximum: hungerData.maximum
          });

          // Serialize
          const serialized = SaveSystem.serialize(world);

          // Verify serialized structure
          const characterEntity = serialized.entities.find(e => e.id === character.id);
          expect(characterEntity).toBeDefined();

          const hungerComponent = characterEntity!.components.find(c => c.type === 'hunger');
          expect(hungerComponent).toBeDefined();
          expect(hungerComponent!.data.current).toBe(hungerData.current);
          expect(hungerComponent!.data.maximum).toBe(hungerData.maximum);

          // Deserialize
          const deserialized = SaveSystem.deserialize(serialized);

          // Verify deserialized data
          const deserializedHunger = deserialized.getComponent(character.id, HungerComponentType);
          expect(deserializedHunger).not.toBeNull();
          expect(deserializedHunger!.current).toBe(hungerData.current);
          expect(deserializedHunger!.maximum).toBe(hungerData.maximum);
        }),
        { numRuns: 100 }
      );
    });
  });
});
