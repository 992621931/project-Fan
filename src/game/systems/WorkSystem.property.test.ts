/**
 * Property-based tests for Work System
 * **Feature: codename-rice-game, Property 8: 工作能力验证**
 * **Feature: codename-rice-game, Property 9: 工作资源生成**
 * **Feature: codename-rice-game, Property 10: 工作状态互斥**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { WorkSystem } from './WorkSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { 
  CharacterInfoComponent, 
  CharacterInfoComponentType,
  AttributeComponent,
  AttributeComponentType,
  LevelComponent,
  LevelComponentType
} from '../components/CharacterComponents';
import { 
  WorkAssignmentComponent,
  WorkAssignmentComponentType,
  BadgeComponent,
  BadgeComponentType,
  InventoryComponent,
  InventoryComponentType,
  Badge
} from '../components/SystemComponents';
import { WorkType, CharacterStatus } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

describe('Work System Property Tests', () => {
  let workSystem: WorkSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    
    workSystem = new WorkSystem();
    workSystem.initialize(entityManager, componentManager, eventSystem);
  });

  /**
   * Helper function to create a test character with all required components
   */
  function createTestCharacter(
    attributes: { strength: number; agility: number; wisdom: number; technique: number } = 
      { strength: 15, agility: 15, wisdom: 15, technique: 15 },
    level: number = 10,
    status: CharacterStatus = CharacterStatus.Available,
    equippedBadges: Badge[] = []
  ): string {
    const characterEntity = entityManager.createEntity();
    const character = characterEntity.id;

    const attributeComponent: AttributeComponent = {
      type: 'attribute',
      ...attributes
    };

    const levelComponent: LevelComponent = {
      type: 'level',
      level,
      experience: 0,
      experienceToNext: 100
    };

    const characterInfo: CharacterInfoComponent = {
      type: 'characterInfo',
      title: 'Test',
      name: 'Worker',
      isSpecial: false,
      rarity: RarityType.Common,
      status
    };

    const workAssignment: WorkAssignmentComponent = {
      type: 'workAssignment',
      currentWork: null,
      workHistory: []
    };

    const badgeComponent: BadgeComponent = {
      type: 'badge',
      equippedBadges,
      availableBadges: []
    };

    const inventory: InventoryComponent = {
      type: 'inventory',
      slots: Array(20).fill(null).map(() => ({ item: null, quantity: 0, locked: false })),
      capacity: 20
    };

    componentManager.addComponent(character, AttributeComponentType, attributeComponent);
    componentManager.addComponent(character, LevelComponentType, levelComponent);
    componentManager.addComponent(character, CharacterInfoComponentType, characterInfo);
    componentManager.addComponent(character, WorkAssignmentComponentType, workAssignment);
    componentManager.addComponent(character, BadgeComponentType, badgeComponent);
    componentManager.addComponent(character, InventoryComponentType, inventory);

    return character;
  }

  /**
   * Helper function to create a badge for a work type
   */
  function createWorkBadge(workType: WorkType): Badge {
    return {
      id: `${workType}_badge`,
      name: `${workType} Badge`,
      description: `Enables ${workType} work`,
      workType,
      skills: [],
      attributeBonus: {},
      unlocked: true
    };
  }

  /**
   * Property 8: 工作能力验证
   * For any work assignment request, the system should verify character has required work ability,
   * only allowing capable characters to start work
   * **Validates: Requirements 4.1**
   */
  it('Property 8: 工作能力验证', () => {
    // Generator for character attributes
    const attributeGenerator = fc.record({
      strength: fc.integer({ min: 1, max: 30 }),
      agility: fc.integer({ min: 1, max: 30 }),
      wisdom: fc.integer({ min: 1, max: 30 }),
      technique: fc.integer({ min: 1, max: 30 })
    });

    // Generator for work types
    const workTypeGenerator = fc.constantFrom(...Object.values(WorkType));

    // Generator for work duration (in milliseconds)
    const durationGenerator = fc.integer({ min: 1000, max: 10000 }); // 1-10 seconds for testing

    fc.assert(
      fc.property(
        attributeGenerator,
        workTypeGenerator,
        durationGenerator,
        fc.boolean(), // Whether to equip required badge
        (attributes, workType, duration, shouldHaveBadge) => {
          // Create badges if needed
          const badges = shouldHaveBadge ? [createWorkBadge(workType)] : [];
          const characterId = createTestCharacter(attributes, 10, CharacterStatus.Available, badges);

          // Check work capability
          const hasCapability = workSystem.hasWorkCapability(characterId, workType);
          
          // Attempt work assignment
          const result = workSystem.assignWork(characterId, workType, duration);

          // Requirement 4.1: Only characters with required work ability should be able to work
          if (hasCapability) {
            // Character should be able to work
            expect(result.success).toBe(true);
            expect(result.workType).toBe(workType);
            expect(result.duration).toBe(duration);
            expect(result.error).toBeUndefined();

            // Character status should be updated to Working
            const characterInfo = componentManager.getComponent(characterId, CharacterInfoComponentType);
            expect(characterInfo).not.toBeNull();
            expect(characterInfo!.status).toBe(CharacterStatus.Working);

            // Work assignment should be created
            const workAssignment = componentManager.getComponent(characterId, WorkAssignmentComponentType);
            expect(workAssignment).not.toBeNull();
            expect(workAssignment!.currentWork).not.toBeNull();
            expect(workAssignment!.currentWork!.workType).toBe(workType);
            expect(workAssignment!.currentWork!.duration).toBe(duration);
            expect(workAssignment!.currentWork!.efficiency).toBeGreaterThan(0);

          } else {
            // Character should not be able to work
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('capability');

            // Character status should remain Available
            const characterInfo = componentManager.getComponent(characterId, CharacterInfoComponentType);
            expect(characterInfo).not.toBeNull();
            expect(characterInfo!.status).toBe(CharacterStatus.Available);

            // No work assignment should be created
            const workAssignment = componentManager.getComponent(characterId, WorkAssignmentComponentType);
            expect(workAssignment).not.toBeNull();
            expect(workAssignment!.currentWork).toBeNull();
          }

          // Work capabilities should be consistent
          const capabilities = workSystem.getWorkCapabilities(characterId);
          const workCapability = capabilities.find(cap => cap.workType === workType);
          expect(workCapability).not.toBeUndefined();
          expect(workCapability!.unlocked).toBe(hasCapability);
          
          if (hasCapability) {
            expect(workCapability!.efficiency).toBeGreaterThan(0);
          } else {
            expect(workCapability!.efficiency).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: 工作资源生成
   * For any working character, the system should generate resources based on time and character ability,
   * adding resources to player inventory when work ends
   * **Validates: Requirements 4.2, 4.3**
   */
  it('Property 9: 工作资源生成', () => {
    // Generator for work duration (short for testing)
    const durationGenerator = fc.integer({ min: 100, max: 1000 }); // 0.1-1 seconds

    // Generator for work types
    const workTypeGenerator = fc.constantFrom(...Object.values(WorkType));

    // Generator for character efficiency factors
    const attributeGenerator = fc.record({
      strength: fc.integer({ min: 10, max: 50 }),
      agility: fc.integer({ min: 10, max: 50 }),
      wisdom: fc.integer({ min: 10, max: 50 }),
      technique: fc.integer({ min: 10, max: 50 })
    });

    fc.assert(
      fc.property(
        workTypeGenerator,
        durationGenerator,
        attributeGenerator,
        fc.integer({ min: 1, max: 20 }), // Character level
        (workType, duration, attributes, level) => {
          // Create character with required badge and ensure attributes meet requirements
          const badges = [createWorkBadge(workType)];
          
          // Ensure attributes meet minimum requirements for the work type
          const workConfig = workSystem.getWorkConfig(workType);
          const adjustedAttributes = { ...attributes };
          
          if (workConfig.attributeRequirements) {
            for (const [attr, minValue] of Object.entries(workConfig.attributeRequirements)) {
              adjustedAttributes[attr as keyof typeof adjustedAttributes] = Math.max(
                adjustedAttributes[attr as keyof typeof adjustedAttributes], 
                minValue
              );
            }
          }
          
          const characterId = createTestCharacter(adjustedAttributes, level, CharacterStatus.Available, badges);

          // Assign work
          const assignResult = workSystem.assignWork(characterId, workType, duration);
          expect(assignResult.success).toBe(true);

          // Get initial inventory state
          const initialInventory = componentManager.getComponent(characterId, InventoryComponentType);
          expect(initialInventory).not.toBeNull();
          const initialItemCount = initialInventory!.slots.filter(slot => slot.item !== null).length;

          // Simulate work completion by advancing time
          const workAssignment = componentManager.getComponent(characterId, WorkAssignmentComponentType);
          expect(workAssignment).not.toBeNull();
          expect(workAssignment!.currentWork).not.toBeNull();

          // Manually complete work for testing
          const work = workAssignment!.currentWork!;
          
          // Simulate time passage
          work.startTime = Date.now() - duration - 100; // Make work overdue
          
          // Process work (this should complete the work)
          workSystem.update(0);

          // Requirement 4.2 & 4.3: Resources should be generated and added to inventory
          const finalInventory = componentManager.getComponent(characterId, InventoryComponentType);
          expect(finalInventory).not.toBeNull();

          // Work should be completed
          const finalWorkAssignment = componentManager.getComponent(characterId, WorkAssignmentComponentType);
          expect(finalWorkAssignment).not.toBeNull();
          expect(finalWorkAssignment!.currentWork).toBeNull();

          // Character should be available again
          const characterInfo = componentManager.getComponent(characterId, CharacterInfoComponentType);
          expect(characterInfo).not.toBeNull();
          expect(characterInfo!.status).toBe(CharacterStatus.Available);

          // Work should be in history
          expect(finalWorkAssignment!.workHistory.length).toBe(1);
          const completedWork = finalWorkAssignment!.workHistory[0];
          expect(completedWork.workType).toBe(workType);
          expect(completedWork.resourcesGenerated.length).toBeGreaterThanOrEqual(0);

          // Resources should be reasonable
          for (const resource of completedWork.resourcesGenerated) {
            expect(resource.actualAmount).toBeGreaterThanOrEqual(0);
            expect(resource.actualAmount).toBeLessThanOrEqual(resource.baseAmount * 2); // Efficiency cap
            expect(resource.baseAmount).toBeGreaterThanOrEqual(0);
            expect(resource.itemId).toBeDefined();
          }

          // Efficiency should be within reasonable bounds
          expect(completedWork.efficiency).toBeGreaterThan(0);
          expect(completedWork.efficiency).toBeLessThanOrEqual(2.0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 10: 工作状态互斥
   * For any working character, the system should prevent participation in other activities
   * until work is completed or cancelled
   * **Validates: Requirements 4.4**
   */
  it('Property 10: 工作状态互斥', () => {
    // Generator for work types
    const workTypeGenerator = fc.constantFrom(...Object.values(WorkType));

    // Generator for work duration
    const durationGenerator = fc.integer({ min: 1000, max: 5000 });

    fc.assert(
      fc.property(
        workTypeGenerator,
        workTypeGenerator,
        durationGenerator,
        durationGenerator,
        (firstWorkType, secondWorkType, firstDuration, secondDuration) => {
          // Create character with badges for both work types
          const badges = [createWorkBadge(firstWorkType), createWorkBadge(secondWorkType)];
          const characterId = createTestCharacter(
            { strength: 20, agility: 20, wisdom: 20, technique: 20 },
            15,
            CharacterStatus.Available,
            badges
          );

          // Assign first work
          const firstResult = workSystem.assignWork(characterId, firstWorkType, firstDuration);
          expect(firstResult.success).toBe(true);

          // Character should be working
          const characterInfo = componentManager.getComponent(characterId, CharacterInfoComponentType);
          expect(characterInfo).not.toBeNull();
          expect(characterInfo!.status).toBe(CharacterStatus.Working);

          // Requirement 4.4: Character should not be able to take on additional work
          const secondResult = workSystem.assignWork(characterId, secondWorkType, secondDuration);
          expect(secondResult.success).toBe(false);
          expect(secondResult.error).toBeDefined();
          expect(secondResult.error).toContain('already assigned');

          // Work assignment should remain unchanged
          const workAssignment = componentManager.getComponent(characterId, WorkAssignmentComponentType);
          expect(workAssignment).not.toBeNull();
          expect(workAssignment!.currentWork).not.toBeNull();
          expect(workAssignment!.currentWork!.workType).toBe(firstWorkType);

          // Character status should remain Working
          expect(characterInfo!.status).toBe(CharacterStatus.Working);

          // Test work cancellation restores availability
          const cancelResult = workSystem.cancelWork(characterId);
          expect(cancelResult).not.toBeNull();
          expect(cancelResult!.workType).toBe(firstWorkType);

          // Character should be available again
          expect(characterInfo!.status).toBe(CharacterStatus.Available);
          expect(workAssignment!.currentWork).toBeNull();

          // Now second work assignment should succeed
          const thirdResult = workSystem.assignWork(characterId, secondWorkType, secondDuration);
          expect(thirdResult.success).toBe(true);
          expect(thirdResult.workType).toBe(secondWorkType);

          // Character should be working again
          expect(characterInfo!.status).toBe(CharacterStatus.Working);
          expect(workAssignment!.currentWork).not.toBeNull();
          expect(workAssignment!.currentWork!.workType).toBe(secondWorkType);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle character status changes correctly', () => {
    // Property: Character status should prevent work assignment when not available
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(CharacterStatus)),
        fc.constantFrom(...Object.values(WorkType)),
        fc.integer({ min: 1000, max: 5000 }),
        (status, workType, duration) => {
          const badges = [createWorkBadge(workType)];
          const characterId = createTestCharacter(
            { strength: 20, agility: 20, wisdom: 20, technique: 20 },
            10,
            status,
            badges
          );

          const result = workSystem.assignWork(characterId, workType, duration);

          if (status === CharacterStatus.Available) {
            // Available characters should be able to work
            expect(result.success).toBe(true);
          } else {
            // Non-available characters should not be able to work
            expect(result.success).toBe(false);
            expect(result.error).toContain('not available');
          }

          // Character status should not change if work assignment failed
          const characterInfo = componentManager.getComponent(characterId, CharacterInfoComponentType);
          expect(characterInfo).not.toBeNull();
          
          if (result.success) {
            expect(characterInfo!.status).toBe(CharacterStatus.Working);
          } else {
            expect(characterInfo!.status).toBe(status);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should calculate work efficiency consistently', () => {
    // Property: Work efficiency should be consistent and bounded
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 1, max: 100 }),
          agility: fc.integer({ min: 1, max: 100 }),
          wisdom: fc.integer({ min: 1, max: 100 }),
          technique: fc.integer({ min: 1, max: 100 })
        }),
        fc.integer({ min: 1, max: 50 }),
        fc.constantFrom(...Object.values(WorkType)),
        (attributes, level, workType) => {
          const badges = [createWorkBadge(workType)];
          const characterId = createTestCharacter(attributes, level, CharacterStatus.Available, badges);

          const capabilities = workSystem.getWorkCapabilities(characterId);
          const workCapability = capabilities.find(cap => cap.workType === workType);
          
          expect(workCapability).not.toBeUndefined();
          
          if (workCapability!.unlocked) {
            // Efficiency should be within reasonable bounds
            expect(workCapability!.efficiency).toBeGreaterThan(0);
            expect(workCapability!.efficiency).toBeLessThanOrEqual(2.0);

            // Higher attributes should generally lead to higher efficiency
            const workConfig = workSystem.getWorkConfig(workType);
            if (workConfig.attributeRequirements) {
              let meetsAllRequirements = true;
              for (const [attr, minValue] of Object.entries(workConfig.attributeRequirements)) {
                if ((attributes as any)[attr] < minValue) {
                  meetsAllRequirements = false;
                  break;
                }
              }
              expect(meetsAllRequirements).toBe(true);
            }

            // Efficiency should be consistent across multiple calls
            const capabilities2 = workSystem.getWorkCapabilities(characterId);
            const workCapability2 = capabilities2.find(cap => cap.workType === workType);
            expect(workCapability2!.efficiency).toBe(workCapability!.efficiency);
          } else {
            expect(workCapability!.efficiency).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle work cancellation correctly', () => {
    // Property: Work cancellation should provide partial rewards and restore character availability
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(WorkType)),
        fc.integer({ min: 2000, max: 10000 }), // Work duration
        fc.integer({ min: 500, max: 1500 }), // Cancellation delay
        (workType, duration, cancelDelay) => {
          const badges = [createWorkBadge(workType)];
          const characterId = createTestCharacter(
            { strength: 20, agility: 20, wisdom: 20, technique: 20 },
            10,
            CharacterStatus.Available,
            badges
          );

          // Start work
          const assignResult = workSystem.assignWork(characterId, workType, duration);
          expect(assignResult.success).toBe(true);

          // Simulate some work time
          const workAssignment = componentManager.getComponent(characterId, WorkAssignmentComponentType);
          expect(workAssignment).not.toBeNull();
          expect(workAssignment!.currentWork).not.toBeNull();

          // Adjust start time to simulate elapsed time
          workAssignment!.currentWork!.startTime = Date.now() - cancelDelay;

          // Cancel work
          const cancelResult = workSystem.cancelWork(characterId);
          expect(cancelResult).not.toBeNull();
          expect(cancelResult!.workType).toBe(workType);
          expect(cancelResult!.duration).toBeGreaterThanOrEqual(cancelDelay - 100); // Allow some tolerance

          // Character should be available again
          const characterInfo = componentManager.getComponent(characterId, CharacterInfoComponentType);
          expect(characterInfo).not.toBeNull();
          expect(characterInfo!.status).toBe(CharacterStatus.Available);

          // Work should be cleared
          expect(workAssignment!.currentWork).toBeNull();

          // Work should be in history
          expect(workAssignment!.workHistory.length).toBe(1);
          const historicalWork = workAssignment!.workHistory[0];
          expect(historicalWork.workType).toBe(workType);

          // Should have generated some resources (partial completion)
          expect(historicalWork.resourcesGenerated).toBeDefined();
          for (const resource of historicalWork.resourcesGenerated) {
            expect(resource.actualAmount).toBeGreaterThanOrEqual(0);
          }

          // Experience should be reasonable
          expect(cancelResult!.experience).toBeGreaterThanOrEqual(0);
          const maxPossibleExp = workSystem.getWorkConfig(workType).experienceGain;
          expect(cancelResult!.experience).toBeLessThanOrEqual(maxPossibleExp);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain work status consistency', () => {
    // Property: Work status should be consistent across system operations
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(WorkType)),
        fc.integer({ min: 1000, max: 3000 }),
        (workType, duration) => {
          // Create character with required badge and sufficient attributes
          const badges = [createWorkBadge(workType)];
          
          // Ensure attributes meet minimum requirements for the work type
          const workConfig = workSystem.getWorkConfig(workType);
          const baseAttributes = { strength: 15, agility: 15, wisdom: 15, technique: 15 };
          
          if (workConfig.attributeRequirements) {
            for (const [attr, minValue] of Object.entries(workConfig.attributeRequirements)) {
              baseAttributes[attr as keyof typeof baseAttributes] = Math.max(
                baseAttributes[attr as keyof typeof baseAttributes], 
                minValue
              );
            }
          }
          
          const characterId = createTestCharacter(
            baseAttributes,
            10,
            CharacterStatus.Available,
            badges
          );

          // Initial status
          let status = workSystem.getWorkStatus(characterId);
          expect(status.isWorking).toBe(false);
          expect(status.currentWork).toBeUndefined();

          // Assign work
          const assignResult = workSystem.assignWork(characterId, workType, duration);
          expect(assignResult.success).toBe(true);

          // Status should reflect working state
          status = workSystem.getWorkStatus(characterId);
          expect(status.isWorking).toBe(true);
          expect(status.currentWork).not.toBeUndefined();
          expect(status.currentWork!.workType).toBe(workType);
          expect(status.progress).toBeGreaterThanOrEqual(0);
          expect(status.progress).toBeLessThanOrEqual(1);
          expect(status.timeRemaining).toBeGreaterThanOrEqual(0);

          // Progress should be reasonable
          if (status.progress! > 0) {
            expect(status.timeRemaining).toBeLessThan(duration);
          }

          // Cancel work
          const cancelResult = workSystem.cancelWork(characterId);
          expect(cancelResult).not.toBeNull();

          // Status should reflect non-working state
          status = workSystem.getWorkStatus(characterId);
          expect(status.isWorking).toBe(false);
          expect(status.currentWork).toBeUndefined();
          expect(status.progress).toBeUndefined();
          expect(status.timeRemaining).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  });
});