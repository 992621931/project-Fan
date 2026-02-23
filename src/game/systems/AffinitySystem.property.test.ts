/**
 * Property-based tests for Affinity System
 * **Feature: codename-rice-game, Property 22: 好感度互动影响**
 * **Feature: codename-rice-game, Property 23: 好感度阶段解锁**
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.4**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AffinitySystem, InteractionType } from './AffinitySystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { 
  AffinityComponent,
  AffinityComponentType,
  CharacterInfoComponent,
  CharacterInfoComponentType
} from '../components/CharacterComponents';
import { 
  InventoryComponent,
  InventoryComponentType
} from '../components/SystemComponents';
import { 
  ItemComponent,
  ItemComponentType
} from '../components/ItemComponents';
import { ItemType, CharacterStatus } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

describe('Affinity System Property Tests', () => {
  let affinitySystem: AffinitySystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    
    affinitySystem = new AffinitySystem();
    affinitySystem.initialize(entityManager, componentManager, eventSystem);
  });

  /**
   * Property 22: 好感度互动影响
   * For any player interaction with a character, the system should adjust affinity 
   * based on interaction type, gift type, and character preferences
   */
  it('Property 22: 好感度互动影响', () => {
    // Generator for interaction types
    const interactionTypeGenerator = fc.constantFrom(
      InteractionType.Conversation,
      InteractionType.CombatTogether,
      InteractionType.WorkTogether,
      InteractionType.Praise,
      InteractionType.Help,
      InteractionType.Criticism,
      InteractionType.Ignore
    );

    fc.assert(
      fc.property(
        interactionTypeGenerator,
        fc.integer({ min: -50, max: 50 }), // Initial affinity
        (interactionType, initialAffinity) => {
          // Create two characters
          const character1 = entityManager.createEntity();
          const character2 = entityManager.createEntity();

          // Add affinity components
          const affinity1: AffinityComponent = {
            type: 'affinity',
            relationships: new Map()
          };
          const affinity2: AffinityComponent = {
            type: 'affinity',
            relationships: new Map()
          };

          componentManager.addComponent(character1.id, AffinityComponentType, affinity1);
          componentManager.addComponent(character2.id, AffinityComponentType, affinity2);

          // Set initial affinity
          affinitySystem.setAffinityLevel(character1.id, character2.id, initialAffinity);

          // Perform interaction
          const result = affinitySystem.interact(character1.id, character2.id, interactionType);

          // Verify interaction was successful (Requirement 13.1)
          expect(result.success).toBe(true);
          expect(result.affinityChange).toBeTypeOf('number');
          expect(result.newAffinityLevel).toBeTypeOf('number');

          // Verify affinity change is appropriate for interaction type (Requirement 13.1)
          const expectedPositiveInteractions = [
            InteractionType.Conversation,
            InteractionType.CombatTogether,
            InteractionType.WorkTogether,
            InteractionType.Praise,
            InteractionType.Help
          ];

          const expectedNegativeInteractions = [
            InteractionType.Criticism,
            InteractionType.Ignore
          ];

          if (expectedPositiveInteractions.includes(interactionType)) {
            expect(result.affinityChange).toBeGreaterThan(0);
          } else if (expectedNegativeInteractions.includes(interactionType)) {
            expect(result.affinityChange).toBeLessThan(0);
          }

          // Verify new affinity level is within bounds (-100 to 100)
          expect(result.newAffinityLevel).toBeGreaterThanOrEqual(-100);
          expect(result.newAffinityLevel).toBeLessThanOrEqual(100);

          // Verify affinity is updated bidirectionally
          const finalAffinity1to2 = affinitySystem.getAffinityLevel(character1.id, character2.id);
          const finalAffinity2to1 = affinitySystem.getAffinityLevel(character2.id, character1.id);
          
          expect(finalAffinity1to2).toBe(result.newAffinityLevel);
          expect(finalAffinity2to1).toBe(result.newAffinityLevel);

          // Verify affinity change calculation
          const expectedNewAffinity = Math.max(-100, Math.min(100, initialAffinity + result.affinityChange));
          expect(result.newAffinityLevel).toBe(expectedNewAffinity);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23: 好感度阶段解锁
   * When affinity reaches specific thresholds, the system should unlock new dialogue 
   * options and functionality
   */
  it('Property 23: 好感度阶段解锁', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }), // Target affinity level
        (targetAffinity) => {
          // Create two characters
          const character1 = entityManager.createEntity();
          const character2 = entityManager.createEntity();

          // Add affinity components
          const affinity1: AffinityComponent = {
            type: 'affinity',
            relationships: new Map()
          };
          const affinity2: AffinityComponent = {
            type: 'affinity',
            relationships: new Map()
          };

          componentManager.addComponent(character1.id, AffinityComponentType, affinity1);
          componentManager.addComponent(character2.id, AffinityComponentType, affinity2);

          // Start with low affinity
          const initialAffinity = -50;
          affinitySystem.setAffinityLevel(character1.id, character2.id, initialAffinity);

          // Get initial stage
          const initialStage = affinitySystem.getAffinityStage(initialAffinity);

          // Set target affinity directly to test stage transitions
          affinitySystem.setAffinityLevel(character1.id, character2.id, targetAffinity);

          // Get new stage
          const newStage = affinitySystem.getAffinityStage(targetAffinity);

          // Verify stage is appropriate for affinity level (Requirement 13.2)
          expect(targetAffinity).toBeGreaterThanOrEqual(newStage.minAffinity);
          expect(targetAffinity).toBeLessThanOrEqual(newStage.maxAffinity);

          // Verify stage properties
          expect(newStage.id).toBeTypeOf('string');
          expect(newStage.name).toBeTypeOf('string');
          expect(newStage.unlocks).toBeInstanceOf(Array);

          // Verify stage progression logic (Requirement 13.2, 13.4)
          const allStages = affinitySystem.getAffinityStages();
          expect(allStages.length).toBeGreaterThan(0);

          // Verify stages are ordered by affinity thresholds
          for (let i = 1; i < allStages.length; i++) {
            expect(allStages[i].minAffinity).toBeGreaterThan(allStages[i-1].maxAffinity);
          }

          // Verify unlocks are available for higher stages
          if (newStage.minAffinity > 0) {
            expect(newStage.unlocks.length).toBeGreaterThan(0);
            
            newStage.unlocks.forEach(unlock => {
              expect(unlock.type).toMatch(/^(dialogue|skill|item|story)$/);
              expect(unlock.id).toBeTypeOf('string');
              expect(unlock.name).toBeTypeOf('string');
              expect(unlock.description).toBeTypeOf('string');
            });
          }

          // Test stage transition detection
          if (targetAffinity > initialAffinity && initialStage.id !== newStage.id) {
            // Simulate an interaction that would cause this transition
            const affinityDifference = targetAffinity - initialAffinity;
            
            // Reset to initial state
            affinitySystem.setAffinityLevel(character1.id, character2.id, initialAffinity);
            
            // Perform multiple positive interactions to reach target
            let currentAffinity = initialAffinity;
            let stageChanged = false;
            
            while (currentAffinity < targetAffinity && currentAffinity < 100) {
              const result = affinitySystem.interact(character1.id, character2.id, InteractionType.Praise);
              currentAffinity = result.newAffinityLevel;
              
              if (result.stageChanged) {
                stageChanged = true;
                expect(result.newStage).toBeDefined();
                expect(result.unlockedContent).toBeDefined();
                
                if (result.unlockedContent && result.unlockedContent.length > 0) {
                  result.unlockedContent.forEach(unlock => {
                    expect(unlock.type).toMatch(/^(dialogue|skill|item|story)$/);
                    expect(unlock.id).toBeTypeOf('string');
                    expect(unlock.name).toBeTypeOf('string');
                  });
                }
              }
              
              // Prevent infinite loop
              if (result.affinityChange <= 0) break;
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle gift giving correctly', () => {
    // Property: Gift giving should affect affinity based on item type and rarity
    fc.assert(
      fc.property(
        fc.record({
          itemType: fc.constantFrom(ItemType.Food, ItemType.Equipment, ItemType.Gem, ItemType.Consumable),
          rarity: fc.constantFrom(RarityType.Common, RarityType.Rare, RarityType.Epic, RarityType.Legendary),
          itemName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0)
        }),
        (giftData) => {
          // Create giver and receiver
          const giver = entityManager.createEntity();
          const receiver = entityManager.createEntity();

          // Add affinity components
          const giverAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map()
          };
          const receiverAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map()
          };

          componentManager.addComponent(giver.id, AffinityComponentType, giverAffinity);
          componentManager.addComponent(receiver.id, AffinityComponentType, receiverAffinity);

          // Create inventory for giver
          const inventory: InventoryComponent = {
            type: 'inventory',
            slots: Array(10).fill(null).map(() => ({ item: null, quantity: 0, locked: false })),
            capacity: 10
          };
          componentManager.addComponent(giver.id, InventoryComponentType, inventory);

          // Create gift item
          const giftItem = entityManager.createEntity();
          const item: ItemComponent = {
            type: 'item',
            id: `gift_${Date.now()}`,
            name: giftData.itemName,
            description: 'A gift item',
            itemType: giftData.itemType,
            rarity: giftData.rarity,
            stackSize: 1,
            value: 100
          };
          componentManager.addComponent(giftItem.id, ItemComponentType, item);

          // Add item to giver's inventory
          inventory.slots[0].item = giftItem.id;
          inventory.slots[0].quantity = 1;

          // Record initial affinity
          const initialAffinity = affinitySystem.getAffinityLevel(giver.id, receiver.id);

          // Give gift
          const result = affinitySystem.giveGift(giver.id, receiver.id, giftItem.id);

          // Verify gift was successful (Requirement 13.3)
          expect(result.success).toBe(true);
          expect(result.itemConsumed).toBe(true);
          expect(result.affinityChange).toBeGreaterThan(0); // Gifts should always increase affinity

          // Verify affinity increased
          expect(result.newAffinityLevel).toBeGreaterThan(initialAffinity);

          // Verify item was consumed from inventory
          expect(inventory.slots[0].quantity).toBe(0);

          // Verify rarity affects affinity gain (higher rarity = more affinity)
          const expectedMinimumGain = giftData.rarity === RarityType.Common ? 1 :
                                     giftData.rarity === RarityType.Rare ? 3 :
                                     giftData.rarity === RarityType.Epic ? 5 : 8;
          
          expect(result.affinityChange).toBeGreaterThanOrEqual(expectedMinimumGain);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain relationship consistency', () => {
    // Property: Relationships should be bidirectional and consistent
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            interactionType: fc.constantFrom(
              InteractionType.Conversation,
              InteractionType.Praise,
              InteractionType.Help
            ),
            count: fc.integer({ min: 1, max: 5 })
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (interactions) => {
          // Create multiple characters
          const characters = Array.from({ length: 3 }, () => {
            const char = entityManager.createEntity();
            const affinity: AffinityComponent = {
              type: 'affinity',
              relationships: new Map()
            };
            componentManager.addComponent(char.id, AffinityComponentType, affinity);
            return char;
          });

          // Perform interactions between characters
          interactions.forEach(interaction => {
            for (let i = 0; i < interaction.count; i++) {
              const char1 = characters[0];
              const char2 = characters[1];
              
              affinitySystem.interact(char1.id, char2.id, interaction.interactionType);
            }
          });

          // Verify bidirectional consistency
          const affinity1to2 = affinitySystem.getAffinityLevel(characters[0].id, characters[1].id);
          const affinity2to1 = affinitySystem.getAffinityLevel(characters[1].id, characters[0].id);
          
          expect(affinity1to2).toBe(affinity2to1);

          // Verify relationship maps are consistent
          const relationships1 = affinitySystem.getCharacterRelationships(characters[0].id);
          const relationships2 = affinitySystem.getCharacterRelationships(characters[1].id);
          
          if (relationships1.has(characters[1].id)) {
            expect(relationships2.has(characters[0].id)).toBe(true);
            expect(relationships1.get(characters[1].id)).toBe(relationships2.get(characters[0].id));
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should handle affinity bounds correctly', () => {
    // Property: Affinity should always stay within -100 to 100 bounds
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }), // Initial affinity
        fc.array(
          fc.constantFrom(
            InteractionType.Praise,
            InteractionType.Help,
            InteractionType.Criticism,
            InteractionType.Ignore
          ),
          { minLength: 5, maxLength: 20 }
        ),
        (initialAffinity, interactions) => {
          // Create two characters
          const character1 = entityManager.createEntity();
          const character2 = entityManager.createEntity();

          // Add affinity components
          const affinity1: AffinityComponent = {
            type: 'affinity',
            relationships: new Map()
          };
          const affinity2: AffinityComponent = {
            type: 'affinity',
            relationships: new Map()
          };

          componentManager.addComponent(character1.id, AffinityComponentType, affinity1);
          componentManager.addComponent(character2.id, AffinityComponentType, affinity2);

          // Set initial affinity
          affinitySystem.setAffinityLevel(character1.id, character2.id, initialAffinity);

          // Perform multiple interactions
          let currentAffinity = initialAffinity;
          
          interactions.forEach(interactionType => {
            const result = affinitySystem.interact(character1.id, character2.id, interactionType);
            currentAffinity = result.newAffinityLevel;
            
            // Verify bounds are maintained
            expect(currentAffinity).toBeGreaterThanOrEqual(-100);
            expect(currentAffinity).toBeLessThanOrEqual(100);
            expect(result.newAffinityLevel).toBeGreaterThanOrEqual(-100);
            expect(result.newAffinityLevel).toBeLessThanOrEqual(100);
          });

          // Final verification
          const finalAffinity = affinitySystem.getAffinityLevel(character1.id, character2.id);
          expect(finalAffinity).toBeGreaterThanOrEqual(-100);
          expect(finalAffinity).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle stage-based character filtering', () => {
    // Property: Characters should be correctly filtered by affinity stage
    fc.assert(
      fc.property(
        fc.array(
          fc.integer({ min: -100, max: 100 }),
          { minLength: 2, maxLength: 5 }
        ),
        (affinityLevels) => {
          // Create main character
          const mainCharacter = entityManager.createEntity();
          const mainAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map()
          };
          componentManager.addComponent(mainCharacter.id, AffinityComponentType, mainAffinity);

          // Create other characters with different affinity levels
          const otherCharacters: EntityId[] = [];
          const expectedStages: Map<string, EntityId[]> = new Map();

          affinityLevels.forEach((affinityLevel, index) => {
            const character = entityManager.createEntity();
            const affinity: AffinityComponent = {
              type: 'affinity',
              relationships: new Map()
            };
            componentManager.addComponent(character.id, AffinityComponentType, affinity);
            
            otherCharacters.push(character.id);
            
            // Set affinity level
            affinitySystem.setAffinityLevel(mainCharacter.id, character.id, affinityLevel);
            
            // Track expected stage
            const stage = affinitySystem.getAffinityStage(affinityLevel);
            if (!expectedStages.has(stage.id)) {
              expectedStages.set(stage.id, []);
            }
            expectedStages.get(stage.id)!.push(character.id);
          });

          // Test stage filtering
          expectedStages.forEach((expectedCharacters, stageId) => {
            const charactersAtStage = affinitySystem.getCharactersAtStage(mainCharacter.id, stageId);
            
            expect(charactersAtStage.length).toBe(expectedCharacters.length);
            
            expectedCharacters.forEach(expectedCharId => {
              expect(charactersAtStage).toContain(expectedCharId);
            });
          });

          // Verify all stages are valid
          const allStages = affinitySystem.getAffinityStages();
          expectedStages.forEach((_, stageId) => {
            const stageExists = allStages.some(stage => stage.id === stageId);
            expect(stageExists).toBe(true);
          });
        }
      ),
      { numRuns: 30 }
    );
  });
});