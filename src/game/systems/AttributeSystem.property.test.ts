/**
 * Property-based tests for Attribute System
 * **Feature: codename-rice-game, Property 24: 属性计算一致性**
 * **Validates: Requirements 14.1, 14.2**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AttributeSystem } from './AttributeSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { 
  AttributeComponent, 
  AttributeComponentType,
  DerivedStatsComponent,
  DerivedStatsComponentType,
  HealthComponent,
  HealthComponentType,
  ManaComponent,
  ManaComponentType,
  LevelComponent,
  LevelComponentType,
  JobComponent,
  JobComponentType,
  CharacterInfoComponent,
  CharacterInfoComponentType
} from '../components/CharacterComponents';
import { JobType, CharacterStatus } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

describe('Attribute System Property Tests', () => {
  let attributeSystem: AttributeSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    
    attributeSystem = new AttributeSystem();
    attributeSystem.initialize(entityManager, componentManager, eventSystem);
  });

  /**
   * Helper function to create a test character with all required components
   */
  function createTestCharacter(attributes: { strength: number; agility: number; wisdom: number; technique: number }): string {
    const characterEntity = entityManager.createEntity();
    const character = characterEntity.id;

    const attributeComponent: AttributeComponent = {
      type: 'attribute',
      ...attributes
    };

    const derivedStats: DerivedStatsComponent = {
      type: 'derivedStats',
      attack: 0, defense: 0, moveSpeed: 0, dodgeRate: 0, critRate: 0,
      critDamage: 0, resistance: 0, magicPower: 0, carryWeight: 0,
      hitRate: 0, expRate: 0, healthRegen: 0, manaRegen: 0,
      weight: 70, volume: 1
    };

    const health: HealthComponent = {
      type: 'health',
      current: 100,
      maximum: 100
    };

    const mana: ManaComponent = {
      type: 'mana',
      current: 50,
      maximum: 50
    };

    const level: LevelComponent = {
      type: 'level',
      level: 1,
      experience: 0,
      experienceToNext: 100
    };

    const job: JobComponent = {
      type: 'job',
      currentJob: JobType.Warrior,
      availableJobs: [JobType.Warrior],
      jobExperience: new Map([[JobType.Warrior, 0]])
    };

    const characterInfo: CharacterInfoComponent = {
      type: 'characterInfo',
      title: 'Test',
      name: 'Character',
      isSpecial: false,
      rarity: RarityType.Common,
      status: CharacterStatus.Available
    };

    componentManager.addComponent(character, AttributeComponentType, attributeComponent);
    componentManager.addComponent(character, DerivedStatsComponentType, derivedStats);
    componentManager.addComponent(character, HealthComponentType, health);
    componentManager.addComponent(character, ManaComponentType, mana);
    componentManager.addComponent(character, LevelComponentType, level);
    componentManager.addComponent(character, JobComponentType, job);
    componentManager.addComponent(character, CharacterInfoComponentType, characterInfo);

    return character;
  }

  /**
   * Property 24: 属性计算一致性
   * For any character, when primary attributes change, the system should recalculate 
   * all related derived attributes, ensuring attribute relationships are correct
   */
  it('Property 24: 属性计算一致性', () => {
    // Generator for valid attribute values
    const attributeGenerator = fc.record({
      strength: fc.integer({ min: 1, max: 100 }),
      agility: fc.integer({ min: 1, max: 100 }),
      wisdom: fc.integer({ min: 1, max: 100 }),
      technique: fc.integer({ min: 1, max: 100 })
    });

    fc.assert(
      fc.property(attributeGenerator, (attributes) => {
        const characterId = createTestCharacter(attributes);

        // Update the system to trigger derived stats calculation
        attributeSystem.update(0);

        // Get components after update
        const attributeComp = componentManager.getComponent(characterId, AttributeComponentType);
        const derivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
        const health = componentManager.getComponent(characterId, HealthComponentType);
        const mana = componentManager.getComponent(characterId, ManaComponentType);

        expect(attributeComp).not.toBeNull();
        expect(derivedStats).not.toBeNull();
        expect(health).not.toBeNull();
        expect(mana).not.toBeNull();

        // Verify derived stats are calculated correctly from primary attributes
        // Requirement 14.2: Recalculate derived stats when primary attributes change

        // Attack = strength * 2 + technique
        const expectedAttack = attributes.strength * 2 + attributes.technique;
        expect(derivedStats!.attack).toBe(expectedAttack);

        // Defense = strength + agility
        const expectedDefense = attributes.strength + attributes.agility;
        expect(derivedStats!.defense).toBe(expectedDefense);

        // Move Speed = agility * 1.5
        const expectedMoveSpeed = attributes.agility * 1.5;
        expect(derivedStats!.moveSpeed).toBe(expectedMoveSpeed);

        // Dodge Rate = agility * 0.5
        const expectedDodgeRate = attributes.agility * 0.5;
        expect(derivedStats!.dodgeRate).toBe(expectedDodgeRate);

        // Crit Rate = technique * 0.3
        const expectedCritRate = attributes.technique * 0.3;
        expect(derivedStats!.critRate).toBe(expectedCritRate);

        // Crit Damage = 125 (fixed value, not affected by attributes)
        const expectedCritDamage = 125;
        expect(derivedStats!.critDamage).toBe(expectedCritDamage);

        // Resistance = wisdom * 0.8
        const expectedResistance = attributes.wisdom * 0.8;
        expect(derivedStats!.resistance).toBe(expectedResistance);

        // Magic Power = wisdom * 2 + technique * 0.5
        const expectedMagicPower = attributes.wisdom * 2 + attributes.technique * 0.5;
        expect(derivedStats!.magicPower).toBe(expectedMagicPower);

        // Carry Weight = strength * 5 + 50
        const expectedCarryWeight = attributes.strength * 5 + 50;
        expect(derivedStats!.carryWeight).toBe(expectedCarryWeight);

        // Hit Rate = 85 + technique * 0.5
        const expectedHitRate = 85 + attributes.technique * 0.5;
        expect(derivedStats!.hitRate).toBe(expectedHitRate);

        // Health Regen = strength * 0.2
        const expectedHealthRegen = attributes.strength * 0.2;
        expect(derivedStats!.healthRegen).toBe(expectedHealthRegen);

        // Mana Regen = wisdom * 0.3
        const expectedManaRegen = attributes.wisdom * 0.3;
        expect(derivedStats!.manaRegen).toBe(expectedManaRegen);

        // Verify all derived stats are non-negative
        expect(derivedStats!.attack).toBeGreaterThanOrEqual(0);
        expect(derivedStats!.defense).toBeGreaterThanOrEqual(0);
        expect(derivedStats!.moveSpeed).toBeGreaterThanOrEqual(0);
        expect(derivedStats!.dodgeRate).toBeGreaterThanOrEqual(0);
        expect(derivedStats!.critRate).toBeGreaterThanOrEqual(0);
        expect(derivedStats!.critDamage).toBeGreaterThan(0);
        expect(derivedStats!.resistance).toBeGreaterThanOrEqual(0);
        expect(derivedStats!.magicPower).toBeGreaterThanOrEqual(0);
        expect(derivedStats!.carryWeight).toBeGreaterThan(0);
        expect(derivedStats!.hitRate).toBeGreaterThan(0);
        expect(derivedStats!.healthRegen).toBeGreaterThanOrEqual(0);
        expect(derivedStats!.manaRegen).toBeGreaterThanOrEqual(0);

        // Verify health and mana maximums are updated based on attributes
        const level = componentManager.getComponent(characterId, LevelComponentType);
        expect(level).not.toBeNull();

        const expectedMaxHealth = 100 + (attributes.strength * 5) + (level!.level - 1) * 10;
        const expectedMaxMana = 50 + (attributes.wisdom * 3) + (level!.level - 1) * 5;

        expect(health!.maximum).toBe(expectedMaxHealth);
        expect(mana!.maximum).toBe(expectedMaxMana);

        // Verify health and mana current values are within bounds
        expect(health!.current).toBeGreaterThanOrEqual(0);
        expect(health!.current).toBeLessThanOrEqual(health!.maximum);
        expect(mana!.current).toBeGreaterThanOrEqual(0);
        expect(mana!.current).toBeLessThanOrEqual(mana!.maximum);
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain consistent attribute relationships across level ups', () => {
    // Property: Attribute relationships should remain consistent after level ups
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 5, max: 50 }),
          agility: fc.integer({ min: 5, max: 50 }),
          wisdom: fc.integer({ min: 5, max: 50 }),
          technique: fc.integer({ min: 5, max: 50 })
        }),
        fc.integer({ min: 100, max: 1000 }), // Experience to add
        (initialAttributes, experienceGain) => {
          const characterId = createTestCharacter(initialAttributes);

          // Get initial derived stats
          attributeSystem.update(0);
          const initialDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          const initialAttributes2 = componentManager.getComponent(characterId, AttributeComponentType);
          
          expect(initialDerivedStats).not.toBeNull();
          expect(initialAttributes2).not.toBeNull();

          const initialAttackRatio = initialDerivedStats!.attack / (initialAttributes2!.strength * 2 + initialAttributes2!.technique);
          const initialDefenseRatio = initialDerivedStats!.defense / (initialAttributes2!.strength + initialAttributes2!.agility);

          // Add experience to trigger level up
          attributeSystem.addExperience(characterId, experienceGain);

          // Update system to process level up
          attributeSystem.update(0);

          // Get updated stats
          const updatedDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          const updatedAttributes = componentManager.getComponent(characterId, AttributeComponentType);
          
          expect(updatedDerivedStats).not.toBeNull();
          expect(updatedAttributes).not.toBeNull();

          // Verify relationships are still consistent
          const updatedAttackRatio = updatedDerivedStats!.attack / (updatedAttributes!.strength * 2 + updatedAttributes!.technique);
          const updatedDefenseRatio = updatedDerivedStats!.defense / (updatedAttributes!.strength + updatedAttributes!.agility);

          expect(Math.abs(updatedAttackRatio - initialAttackRatio)).toBeLessThan(0.01); // Allow for small floating point differences
          expect(Math.abs(updatedDefenseRatio - initialDefenseRatio)).toBeLessThan(0.01);

          // Verify attributes increased (Requirement 14.1: Increase primary attributes based on job and growth rates)
          expect(updatedAttributes!.strength).toBeGreaterThanOrEqual(initialAttributes2!.strength);
          expect(updatedAttributes!.agility).toBeGreaterThanOrEqual(initialAttributes2!.agility);
          expect(updatedAttributes!.wisdom).toBeGreaterThanOrEqual(initialAttributes2!.wisdom);
          expect(updatedAttributes!.technique).toBeGreaterThanOrEqual(initialAttributes2!.technique);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should properly handle character injury and healing states', () => {
    // Property: Character activity state should be consistent with health status
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 10, max: 50 }),
          agility: fc.integer({ min: 10, max: 50 }),
          wisdom: fc.integer({ min: 10, max: 50 }),
          technique: fc.integer({ min: 10, max: 50 })
        }),
        fc.integer({ min: 1, max: 100 }), // Healing amount
        (attributes, healingAmount) => {
          const characterId = createTestCharacter(attributes);

          // Initially character should be active
          expect(attributeSystem.isCharacterActive(characterId)).toBe(true);

          // Injure the character
          attributeSystem.injureCharacter(characterId);

          // Character should now be inactive
          expect(attributeSystem.isCharacterActive(characterId)).toBe(false);

          const health = componentManager.getComponent(characterId, HealthComponentType);
          const characterInfo = componentManager.getComponent(characterId, CharacterInfoComponentType);
          
          expect(health).not.toBeNull();
          expect(characterInfo).not.toBeNull();
          expect(health!.current).toBe(0);
          expect(characterInfo!.status).toBe(CharacterStatus.Injured);

          // Heal the character
          attributeSystem.healCharacter(characterId, healingAmount);

          const healedHealth = componentManager.getComponent(characterId, HealthComponentType);
          const healedCharacterInfo = componentManager.getComponent(characterId, CharacterInfoComponentType);
          
          expect(healedHealth).not.toBeNull();
          expect(healedCharacterInfo).not.toBeNull();

          if (healingAmount > 0) {
            expect(healedHealth!.current).toBeGreaterThan(0);
            expect(healedHealth!.current).toBeLessThanOrEqual(healedHealth!.maximum);
            expect(healedCharacterInfo!.status).toBe(CharacterStatus.Available);
            expect(attributeSystem.isCharacterActive(characterId)).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain health and mana bounds during attribute changes', () => {
    // Property: Health and mana should always be within valid bounds
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 1, max: 100 }),
          agility: fc.integer({ min: 1, max: 100 }),
          wisdom: fc.integer({ min: 1, max: 100 }),
          technique: fc.integer({ min: 1, max: 100 })
        }),
        fc.record({
          strength: fc.integer({ min: 1, max: 100 }),
          agility: fc.integer({ min: 1, max: 100 }),
          wisdom: fc.integer({ min: 1, max: 100 }),
          technique: fc.integer({ min: 1, max: 100 })
        }),
        (initialAttributes, newAttributes) => {
          const characterId = createTestCharacter(initialAttributes);

          // Update system to set initial derived stats
          attributeSystem.update(0);

          // Change attributes
          const attributeComp = componentManager.getComponent(characterId, AttributeComponentType);
          expect(attributeComp).not.toBeNull();

          attributeComp!.strength = newAttributes.strength;
          attributeComp!.agility = newAttributes.agility;
          attributeComp!.wisdom = newAttributes.wisdom;
          attributeComp!.technique = newAttributes.technique;

          // Update system to recalculate derived stats
          attributeSystem.update(0);

          const health = componentManager.getComponent(characterId, HealthComponentType);
          const mana = componentManager.getComponent(characterId, ManaComponentType);
          
          expect(health).not.toBeNull();
          expect(mana).not.toBeNull();

          // Verify health bounds
          expect(health!.current).toBeGreaterThanOrEqual(0);
          expect(health!.current).toBeLessThanOrEqual(health!.maximum);
          expect(health!.maximum).toBeGreaterThan(0);

          // Verify mana bounds
          expect(mana!.current).toBeGreaterThanOrEqual(0);
          expect(mana!.current).toBeLessThanOrEqual(mana!.maximum);
          expect(mana!.maximum).toBeGreaterThan(0);

          // Verify health scales with strength
          const level = componentManager.getComponent(characterId, LevelComponentType);
          expect(level).not.toBeNull();
          
          const expectedMaxHealth = 100 + (newAttributes.strength * 5) + (level!.level - 1) * 10;
          expect(health!.maximum).toBe(expectedMaxHealth);

          // Verify mana scales with wisdom
          const expectedMaxMana = 50 + (newAttributes.wisdom * 3) + (level!.level - 1) * 5;
          expect(mana!.maximum).toBe(expectedMaxMana);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle level progression correctly', () => {
    // Property: Level progression should be consistent and bounded
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 5, max: 30 }),
          agility: fc.integer({ min: 5, max: 30 }),
          wisdom: fc.integer({ min: 5, max: 30 }),
          technique: fc.integer({ min: 5, max: 30 })
        }),
        fc.integer({ min: 50, max: 500 }), // Experience amount
        (attributes, experienceAmount) => {
          const characterId = createTestCharacter(attributes);

          const initialLevel = componentManager.getComponent(characterId, LevelComponentType);
          const initialAttributes = componentManager.getComponent(characterId, AttributeComponentType);
          
          expect(initialLevel).not.toBeNull();
          expect(initialAttributes).not.toBeNull();

          const startingLevel = initialLevel!.level;
          const startingAttributeSum = initialAttributes!.strength + initialAttributes!.agility + 
                                     initialAttributes!.wisdom + initialAttributes!.technique;

          // Add experience
          attributeSystem.addExperience(characterId, experienceAmount);
          attributeSystem.update(0);

          const finalLevel = componentManager.getComponent(characterId, LevelComponentType);
          const finalAttributes = componentManager.getComponent(characterId, AttributeComponentType);
          
          expect(finalLevel).not.toBeNull();
          expect(finalAttributes).not.toBeNull();

          // Level should increase or stay the same
          expect(finalLevel!.level).toBeGreaterThanOrEqual(startingLevel);

          // If level increased, attributes should have increased
          if (finalLevel!.level > startingLevel) {
            const finalAttributeSum = finalAttributes!.strength + finalAttributes!.agility + 
                                    finalAttributes!.wisdom + finalAttributes!.technique;
            expect(finalAttributeSum).toBeGreaterThan(startingAttributeSum);
          }

          // Experience should be less than experienceToNext
          expect(finalLevel!.experience).toBeLessThan(finalLevel!.experienceToNext);
          expect(finalLevel!.experience).toBeGreaterThanOrEqual(0);

          // ExperienceToNext should be positive and reasonable
          expect(finalLevel!.experienceToNext).toBeGreaterThan(0);
          expect(finalLevel!.experienceToNext).toBeLessThan(10000); // Reasonable upper bound

          // Level should be reasonable
          expect(finalLevel!.level).toBeGreaterThan(0);
          expect(finalLevel!.level).toBeLessThan(100); // Reasonable upper bound
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain stat calculation consistency across multiple updates', () => {
    // Property: Multiple system updates should not change derived stats if attributes haven't changed
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 10, max: 50 }),
          agility: fc.integer({ min: 10, max: 50 }),
          wisdom: fc.integer({ min: 10, max: 50 }),
          technique: fc.integer({ min: 10, max: 50 })
        }),
        fc.integer({ min: 2, max: 10 }), // Number of updates
        (attributes, updateCount) => {
          const characterId = createTestCharacter(attributes);

          // First update to establish baseline
          attributeSystem.update(0);

          const baselineDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(baselineDerivedStats).not.toBeNull();

          const baselineStats = { ...baselineDerivedStats! };

          // Multiple updates without changing attributes
          for (let i = 0; i < updateCount; i++) {
            attributeSystem.update(0);
          }

          const finalDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(finalDerivedStats).not.toBeNull();

          // All derived stats should remain the same
          expect(finalDerivedStats!.attack).toBe(baselineStats.attack);
          expect(finalDerivedStats!.defense).toBe(baselineStats.defense);
          expect(finalDerivedStats!.moveSpeed).toBe(baselineStats.moveSpeed);
          expect(finalDerivedStats!.dodgeRate).toBe(baselineStats.dodgeRate);
          expect(finalDerivedStats!.critRate).toBe(baselineStats.critRate);
          expect(finalDerivedStats!.critDamage).toBe(baselineStats.critDamage);
          expect(finalDerivedStats!.resistance).toBe(baselineStats.resistance);
          expect(finalDerivedStats!.magicPower).toBe(baselineStats.magicPower);
          expect(finalDerivedStats!.carryWeight).toBe(baselineStats.carryWeight);
          expect(finalDerivedStats!.hitRate).toBe(baselineStats.hitRate);
          expect(finalDerivedStats!.healthRegen).toBe(baselineStats.healthRegen);
          expect(finalDerivedStats!.manaRegen).toBe(baselineStats.manaRegen);
        }
      ),
      { numRuns: 50 }
    );
  });
});