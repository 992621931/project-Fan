/**
 * Property-based tests for Badge System
 * **Feature: codename-rice-game, Property 6: 徽章效果往返一致性**
 * **Feature: codename-rice-game, Property 7: 徽章技能资源消耗**
 * **Validates: Requirements 3.2, 3.3, 3.4, 8.3, 14.5**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { BadgeSystem } from './BadgeSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { 
  BadgeComponent, 
  BadgeComponentType,
  Badge,
  SkillComponent,
  SkillComponentType,
  Skill
} from '../components/SystemComponents';
import { 
  AttributeComponent,
  AttributeComponentType,
  DerivedStatsComponent,
  DerivedStatsComponentType,
  CharacterInfoComponent,
  CharacterInfoComponentType,
  ManaComponent,
  ManaComponentType
} from '../components/CharacterComponents';
import { WorkType, CharacterStatus } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

describe('Badge System Property Tests', () => {
  let badgeSystem: BadgeSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    
    badgeSystem = new BadgeSystem();
    badgeSystem.initialize(entityManager, componentManager, eventSystem);
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
      attack: attributes.strength * 2 + attributes.technique,
      defense: attributes.strength + attributes.agility,
      moveSpeed: attributes.agility * 1.5,
      dodgeRate: attributes.agility * 0.5,
      critRate: attributes.technique * 0.3,
      critDamage: 125, // Fixed base value
      resistance: attributes.wisdom * 0.8,
      magicPower: attributes.wisdom * 2 + attributes.technique * 0.5,
      carryWeight: attributes.strength * 5 + 50,
      hitRate: 85 + attributes.technique * 0.5,
      expRate: 100,
      healthRegen: attributes.strength * 0.2,
      manaRegen: attributes.wisdom * 0.3,
      weight: 70,
      volume: 1
    };

    const mana: ManaComponent = {
      type: 'mana',
      current: 100,
      maximum: 100
    };

    const characterInfo: CharacterInfoComponent = {
      type: 'characterInfo',
      title: 'Test',
      name: 'Character',
      isSpecial: false,
      rarity: RarityType.Common,
      status: CharacterStatus.Available
    };

    const badgeComponent: BadgeComponent = {
      type: 'badge',
      equippedBadges: [],
      availableBadges: []
    };

    const skillComponent: SkillComponent = {
      type: 'skill',
      passiveSkills: [],
      activeSkills: [],
      jobSkills: [],
      badgeSkills: []
    };

    componentManager.addComponent(character, AttributeComponentType, attributeComponent);
    componentManager.addComponent(character, DerivedStatsComponentType, derivedStats);
    componentManager.addComponent(character, ManaComponentType, mana);
    componentManager.addComponent(character, CharacterInfoComponentType, characterInfo);
    componentManager.addComponent(character, BadgeComponentType, badgeComponent);
    componentManager.addComponent(character, SkillComponentType, skillComponent);

    return character;
  }

  /**
   * Helper function to create a test badge
   */
  function createTestBadge(
    id: string, 
    workType: WorkType, 
    attributeBonus: Record<string, number>,
    skills: Skill[] = []
  ): Badge {
    return {
      id,
      name: `Test Badge ${id}`,
      description: `Test badge for ${workType}`,
      workType,
      skills,
      attributeBonus,
      unlocked: true
    };
  }

  /**
   * Helper function to create a test skill
   */
  function createTestSkill(id: string, manaCost: number): Skill {
    return {
      id,
      name: `Test Skill ${id}`,
      description: `Test skill with ${manaCost} mana cost`,
      level: 1,
      maxLevel: 5,
      type: 'badge',
      manaCost,
      cooldown: 0,
      effects: [
        {
          type: 'heal',
          target: 'self',
          attribute: 'health',
          value: 10,
          duration: 0
        }
      ],
      requirements: []
    };
  }

  /**
   * Property 6: 徽章效果往返一致性
   * For any character and badge, equipping a badge then unequipping it should 
   * return the character's attributes to their original state
   * **Validates: Requirements 3.2, 3.3**
   */
  it('Property 6: 徽章效果往返一致性', () => {
    // Generator for valid attribute values
    const attributeGenerator = fc.record({
      strength: fc.integer({ min: 10, max: 100 }),
      agility: fc.integer({ min: 10, max: 100 }),
      wisdom: fc.integer({ min: 10, max: 100 }),
      technique: fc.integer({ min: 10, max: 100 })
    });

    // Generator for badge attribute bonuses
    const attributeBonusGenerator = fc.record({
      strength: fc.integer({ min: -10, max: 20 }),
      agility: fc.integer({ min: -10, max: 20 }),
      wisdom: fc.integer({ min: -10, max: 20 }),
      technique: fc.integer({ min: -10, max: 20 }),
      attack: fc.integer({ min: -20, max: 50 }),
      defense: fc.integer({ min: -20, max: 50 }),
      magicPower: fc.integer({ min: -20, max: 50 })
    });

    fc.assert(
      fc.property(
        attributeGenerator,
        attributeBonusGenerator,
        fc.constantFrom(...Object.values(WorkType)),
        (attributes, attributeBonus, workType) => {
          const characterId = createTestCharacter(attributes);
          
          // Record original attribute values
          const originalAttributes = componentManager.getComponent(characterId, AttributeComponentType);
          const originalDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          
          expect(originalAttributes).not.toBeNull();
          expect(originalDerivedStats).not.toBeNull();

          const originalAttributeValues = { ...originalAttributes! };
          const originalDerivedValues = { ...originalDerivedStats! };

          // Create and add a test badge to available badges
          const testBadge = createTestBadge('test-badge', workType, attributeBonus);
          const badgeComponent = componentManager.getComponent(characterId, BadgeComponentType);
          expect(badgeComponent).not.toBeNull();
          badgeComponent!.availableBadges.push(testBadge);

          // Equip the badge
          const equipResult = badgeSystem.equipBadge(characterId, 'test-badge');
          expect(equipResult.success).toBe(true);

          // Verify badge is equipped
          const equippedBadges = badgeSystem.getEquippedBadges(characterId);
          expect(equippedBadges).toHaveLength(1);
          expect(equippedBadges[0].id).toBe('test-badge');

          // Get attributes after equipping
          const attributesAfterEquip = componentManager.getComponent(characterId, AttributeComponentType);
          const derivedStatsAfterEquip = componentManager.getComponent(characterId, DerivedStatsComponentType);
          
          expect(attributesAfterEquip).not.toBeNull();
          expect(derivedStatsAfterEquip).not.toBeNull();

          // Verify attributes changed according to badge bonuses
          if (attributeBonus.strength !== 0) {
            expect(attributesAfterEquip!.strength).toBe(originalAttributeValues.strength + attributeBonus.strength);
          }
          if (attributeBonus.agility !== 0) {
            expect(attributesAfterEquip!.agility).toBe(originalAttributeValues.agility + attributeBonus.agility);
          }
          if (attributeBonus.wisdom !== 0) {
            expect(attributesAfterEquip!.wisdom).toBe(originalAttributeValues.wisdom + attributeBonus.wisdom);
          }
          if (attributeBonus.technique !== 0) {
            expect(attributesAfterEquip!.technique).toBe(originalAttributeValues.technique + attributeBonus.technique);
          }

          // Unequip the badge
          const unequipResult = badgeSystem.unequipBadge(characterId, 'test-badge');
          expect(unequipResult.success).toBe(true);

          // Verify badge is no longer equipped
          const equippedBadgesAfterUnequip = badgeSystem.getEquippedBadges(characterId);
          expect(equippedBadgesAfterUnequip).toHaveLength(0);

          // Get attributes after unequipping
          const attributesAfterUnequip = componentManager.getComponent(characterId, AttributeComponentType);
          const derivedStatsAfterUnequip = componentManager.getComponent(characterId, DerivedStatsComponentType);
          
          expect(attributesAfterUnequip).not.toBeNull();
          expect(derivedStatsAfterUnequip).not.toBeNull();

          // Verify attributes returned to original values (round-trip consistency)
          expect(attributesAfterUnequip!.strength).toBe(originalAttributeValues.strength);
          expect(attributesAfterUnequip!.agility).toBe(originalAttributeValues.agility);
          expect(attributesAfterUnequip!.wisdom).toBe(originalAttributeValues.wisdom);
          expect(attributesAfterUnequip!.technique).toBe(originalAttributeValues.technique);

          // Verify derived stats also returned to original values
          // (allowing for small floating point differences due to recalculation)
          expect(Math.abs(derivedStatsAfterUnequip!.attack - originalDerivedValues.attack)).toBeLessThan(0.01);
          expect(Math.abs(derivedStatsAfterUnequip!.defense - originalDerivedValues.defense)).toBeLessThan(0.01);
          expect(Math.abs(derivedStatsAfterUnequip!.magicPower - originalDerivedValues.magicPower)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: 徽章技能资源消耗
   * For any badge skill trigger, the system should execute the skill effect 
   * and consume the appropriate resources (mana, etc.)
   * **Validates: Requirements 3.4, 8.3, 14.5**
   */
  it('Property 7: 徽章技能资源消耗', () => {
    // Generator for character attributes
    const attributeGenerator = fc.record({
      strength: fc.integer({ min: 10, max: 50 }),
      agility: fc.integer({ min: 10, max: 50 }),
      wisdom: fc.integer({ min: 10, max: 50 }),
      technique: fc.integer({ min: 10, max: 50 })
    });

    // Generator for skill mana costs
    const manaCostGenerator = fc.integer({ min: 5, max: 50 });

    // Generator for initial mana amounts
    const initialManaGenerator = fc.integer({ min: 20, max: 200 });

    fc.assert(
      fc.property(
        attributeGenerator,
        manaCostGenerator,
        initialManaGenerator,
        fc.constantFrom(...Object.values(WorkType)),
        (attributes, manaCost, initialMana, workType) => {
          const characterId = createTestCharacter(attributes);
          
          // Set initial mana
          const manaComponent = componentManager.getComponent(characterId, ManaComponentType);
          expect(manaComponent).not.toBeNull();
          manaComponent!.current = initialMana;
          manaComponent!.maximum = Math.max(initialMana, 100);

          const originalMana = manaComponent!.current;

          // Create a test skill with specific mana cost
          const testSkill = createTestSkill('test-skill', manaCost);
          
          // Create a badge with the test skill
          const testBadge = createTestBadge('skill-badge', workType, {}, [testSkill]);
          
          // Add badge to available badges and equip it
          const badgeComponent = componentManager.getComponent(characterId, BadgeComponentType);
          expect(badgeComponent).not.toBeNull();
          badgeComponent!.availableBadges.push(testBadge);

          const equipResult = badgeSystem.equipBadge(characterId, 'skill-badge');
          expect(equipResult.success).toBe(true);

          // Verify skill was added to character
          const skillComponent = componentManager.getComponent(characterId, SkillComponentType);
          expect(skillComponent).not.toBeNull();
          expect(skillComponent!.badgeSkills).toHaveLength(1);
          expect(skillComponent!.badgeSkills[0].id).toBe('test-skill');

          // Attempt to trigger the badge skill
          const skillTriggerResult = badgeSystem.triggerBadgeSkill(characterId, 'test-skill');

          // Check if skill should have been triggered based on mana availability
          if (originalMana >= manaCost) {
            // Skill should have been triggered successfully
            expect(skillTriggerResult).toBe(true);

            // Verify mana was consumed
            const updatedMana = componentManager.getComponent(characterId, ManaComponentType);
            expect(updatedMana).not.toBeNull();
            expect(updatedMana!.current).toBe(originalMana - manaCost);

            // Verify mana is still within valid bounds
            expect(updatedMana!.current).toBeGreaterThanOrEqual(0);
            expect(updatedMana!.current).toBeLessThanOrEqual(updatedMana!.maximum);
          } else {
            // Skill should have failed due to insufficient mana
            expect(skillTriggerResult).toBe(false);

            // Verify mana was not consumed
            const unchangedMana = componentManager.getComponent(characterId, ManaComponentType);
            expect(unchangedMana).not.toBeNull();
            expect(unchangedMana!.current).toBe(originalMana);
          }

          // Verify mana never goes negative
          const finalMana = componentManager.getComponent(characterId, ManaComponentType);
          expect(finalMana).not.toBeNull();
          expect(finalMana!.current).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain badge skill consistency when equipping/unequipping multiple badges', () => {
    // Property: Badge skills should be properly managed when multiple badges are equipped/unequipped
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 10, max: 50 }),
          agility: fc.integer({ min: 10, max: 50 }),
          wisdom: fc.integer({ min: 10, max: 50 }),
          technique: fc.integer({ min: 10, max: 50 })
        }),
        fc.array(fc.constantFrom(...Object.values(WorkType)), { minLength: 2, maxLength: 5 }),
        (attributes, workTypes) => {
          const characterId = createTestCharacter(attributes);
          
          // Create unique badges for different work types
          const uniqueWorkTypes = [...new Set(workTypes)];
          const badges: Badge[] = [];
          
          for (let i = 0; i < uniqueWorkTypes.length; i++) {
            const skill = createTestSkill(`skill-${i}`, 10);
            const badge = createTestBadge(`badge-${i}`, uniqueWorkTypes[i], { strength: i + 1 }, [skill]);
            badges.push(badge);
          }

          // Add badges to available badges
          const badgeComponent = componentManager.getComponent(characterId, BadgeComponentType);
          expect(badgeComponent).not.toBeNull();
          badgeComponent!.availableBadges.push(...badges);

          // Equip all badges
          const equippedBadgeIds: string[] = [];
          for (const badge of badges) {
            const equipResult = badgeSystem.equipBadge(characterId, badge.id);
            expect(equipResult.success).toBe(true);
            equippedBadgeIds.push(badge.id);
          }

          // Verify all skills are available
          const skillComponent = componentManager.getComponent(characterId, SkillComponentType);
          expect(skillComponent).not.toBeNull();
          expect(skillComponent!.badgeSkills).toHaveLength(badges.length);

          // Verify each badge skill is present
          for (let i = 0; i < badges.length; i++) {
            const skill = skillComponent!.badgeSkills.find(s => s.id === `skill-${i}`);
            expect(skill).toBeDefined();
          }

          // Unequip badges one by one and verify skills are removed
          for (let i = 0; i < badges.length; i++) {
            const unequipResult = badgeSystem.unequipBadge(characterId, badges[i].id);
            expect(unequipResult.success).toBe(true);

            // Verify corresponding skill is removed
            const updatedSkillComponent = componentManager.getComponent(characterId, SkillComponentType);
            expect(updatedSkillComponent).not.toBeNull();
            
            const remainingSkill = updatedSkillComponent!.badgeSkills.find(s => s.id === `skill-${i}`);
            expect(remainingSkill).toBeUndefined();

            // Verify remaining skills are still present
            expect(updatedSkillComponent!.badgeSkills).toHaveLength(badges.length - i - 1);
          }

          // Verify no badge skills remain
          const finalSkillComponent = componentManager.getComponent(characterId, SkillComponentType);
          expect(finalSkillComponent).not.toBeNull();
          expect(finalSkillComponent!.badgeSkills).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should prevent badge conflicts and maintain work type exclusivity', () => {
    // Property: Only one badge per work type should be equippable
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 10, max: 50 }),
          agility: fc.integer({ min: 10, max: 50 }),
          wisdom: fc.integer({ min: 10, max: 50 }),
          technique: fc.integer({ min: 10, max: 50 })
        }),
        fc.constantFrom(...Object.values(WorkType)),
        (attributes, workType) => {
          const characterId = createTestCharacter(attributes);
          
          // Create two badges with the same work type
          const badge1 = createTestBadge('badge-1', workType, { strength: 5 });
          const badge2 = createTestBadge('badge-2', workType, { agility: 5 });

          // Add badges to available badges
          const badgeComponent = componentManager.getComponent(characterId, BadgeComponentType);
          expect(badgeComponent).not.toBeNull();
          badgeComponent!.availableBadges.push(badge1, badge2);

          // Equip first badge
          const equipResult1 = badgeSystem.equipBadge(characterId, 'badge-1');
          expect(equipResult1.success).toBe(true);

          // Verify first badge is equipped
          const equippedBadges1 = badgeSystem.getEquippedBadges(characterId);
          expect(equippedBadges1).toHaveLength(1);
          expect(equippedBadges1[0].id).toBe('badge-1');

          // Attempt to equip second badge with same work type
          const equipResult2 = badgeSystem.equipBadge(characterId, 'badge-2');
          expect(equipResult2.success).toBe(false);
          expect(equipResult2.error).toContain('conflicts');

          // Verify only first badge remains equipped
          const equippedBadges2 = badgeSystem.getEquippedBadges(characterId);
          expect(equippedBadges2).toHaveLength(1);
          expect(equippedBadges2[0].id).toBe('badge-1');

          // Verify work ability is available for the work type
          expect(badgeSystem.canPerformWork(characterId, workType)).toBe(true);

          // Unequip first badge
          const unequipResult = badgeSystem.unequipBadge(characterId, 'badge-1');
          expect(unequipResult.success).toBe(true);

          // Verify work ability is no longer available
          expect(badgeSystem.canPerformWork(characterId, workType)).toBe(false);

          // Now second badge should be equippable
          const equipResult3 = badgeSystem.equipBadge(characterId, 'badge-2');
          expect(equipResult3.success).toBe(true);

          // Verify second badge is equipped and work ability is restored
          const equippedBadges3 = badgeSystem.getEquippedBadges(characterId);
          expect(equippedBadges3).toHaveLength(1);
          expect(equippedBadges3[0].id).toBe('badge-2');
          expect(badgeSystem.canPerformWork(characterId, workType)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should calculate work efficiency based on character attributes and badges', () => {
    // Property: Work efficiency should be consistent and bounded
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 1, max: 100 }),
          agility: fc.integer({ min: 1, max: 100 }),
          wisdom: fc.integer({ min: 1, max: 100 }),
          technique: fc.integer({ min: 1, max: 100 })
        }),
        fc.constantFrom(...Object.values(WorkType)),
        (attributes, workType) => {
          const characterId = createTestCharacter(attributes);
          
          // Create and equip a badge for the work type
          const testBadge = createTestBadge('work-badge', workType, {});
          const badgeComponent = componentManager.getComponent(characterId, BadgeComponentType);
          expect(badgeComponent).not.toBeNull();
          badgeComponent!.availableBadges.push(testBadge);

          const equipResult = badgeSystem.equipBadge(characterId, 'work-badge');
          expect(equipResult.success).toBe(true);

          // Calculate work efficiency
          const efficiency = badgeSystem.getWorkEfficiency(characterId, workType);

          // Verify efficiency is within valid bounds
          expect(efficiency).toBeGreaterThanOrEqual(0);
          expect(efficiency).toBeLessThanOrEqual(1.0);

          // Verify efficiency is greater than 0 when badge is equipped
          expect(efficiency).toBeGreaterThan(0);

          // Verify efficiency calculation is consistent with attribute bonuses
          let expectedMinEfficiency = 0.5; // Base efficiency
          
          switch (workType) {
            case WorkType.Mining:
            case WorkType.Logging:
              expectedMinEfficiency += attributes.strength * 0.01;
              break;
            case WorkType.Crafting:
            case WorkType.Alchemy:
              expectedMinEfficiency += attributes.technique * 0.01;
              break;
            case WorkType.Farming:
              expectedMinEfficiency += (attributes.strength + attributes.technique) * 0.005;
              break;
            case WorkType.Trading:
            case WorkType.Research:
              expectedMinEfficiency += attributes.wisdom * 0.01;
              break;
            default:
              expectedMinEfficiency += (attributes.strength + attributes.agility + attributes.wisdom + attributes.technique) * 0.0025;
          }

          const cappedExpectedEfficiency = Math.min(1.0, expectedMinEfficiency);
          expect(Math.abs(efficiency - cappedExpectedEfficiency)).toBeLessThan(0.01);

          // Unequip badge and verify efficiency becomes 0
          const unequipResult = badgeSystem.unequipBadge(characterId, 'work-badge');
          expect(unequipResult.success).toBe(true);

          const efficiencyWithoutBadge = badgeSystem.getWorkEfficiency(characterId, workType);
          expect(efficiencyWithoutBadge).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple skill triggers with proper resource management', () => {
    // Property: Multiple skill triggers should properly manage mana consumption
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 10, max: 50 }),
          agility: fc.integer({ min: 10, max: 50 }),
          wisdom: fc.integer({ min: 10, max: 50 }),
          technique: fc.integer({ min: 10, max: 50 })
        }),
        fc.integer({ min: 100, max: 300 }), // Initial mana
        fc.array(fc.integer({ min: 5, max: 30 }), { minLength: 2, maxLength: 5 }), // Skill mana costs
        (attributes, initialMana, manaCosts) => {
          const characterId = createTestCharacter(attributes);
          
          // Set initial mana
          const manaComponent = componentManager.getComponent(characterId, ManaComponentType);
          expect(manaComponent).not.toBeNull();
          manaComponent!.current = initialMana;
          manaComponent!.maximum = Math.max(initialMana, 200);

          // Create skills with different mana costs
          const skills: Skill[] = [];
          for (let i = 0; i < manaCosts.length; i++) {
            skills.push(createTestSkill(`multi-skill-${i}`, manaCosts[i]));
          }

          // Create badge with multiple skills
          const testBadge = createTestBadge('multi-skill-badge', WorkType.Crafting, {}, skills);
          
          // Add and equip badge
          const badgeComponent = componentManager.getComponent(characterId, BadgeComponentType);
          expect(badgeComponent).not.toBeNull();
          badgeComponent!.availableBadges.push(testBadge);

          const equipResult = badgeSystem.equipBadge(characterId, 'multi-skill-badge');
          expect(equipResult.success).toBe(true);

          let currentMana = initialMana;
          let successfulTriggers = 0;

          // Trigger each skill in sequence
          for (let i = 0; i < skills.length; i++) {
            const skillId = `multi-skill-${i}`;
            const manaCost = manaCosts[i];

            const triggerResult = badgeSystem.triggerBadgeSkill(characterId, skillId);

            if (currentMana >= manaCost) {
              // Skill should succeed
              expect(triggerResult).toBe(true);
              currentMana -= manaCost;
              successfulTriggers++;

              // Verify mana was consumed
              const updatedMana = componentManager.getComponent(characterId, ManaComponentType);
              expect(updatedMana).not.toBeNull();
              expect(updatedMana!.current).toBe(currentMana);
            } else {
              // Skill should fail due to insufficient mana
              expect(triggerResult).toBe(false);

              // Verify mana was not consumed
              const unchangedMana = componentManager.getComponent(characterId, ManaComponentType);
              expect(unchangedMana).not.toBeNull();
              expect(unchangedMana!.current).toBe(currentMana);
            }
          }

          // Verify final mana state
          const finalMana = componentManager.getComponent(characterId, ManaComponentType);
          expect(finalMana).not.toBeNull();
          expect(finalMana!.current).toBe(currentMana);
          expect(finalMana!.current).toBeGreaterThanOrEqual(0);
          expect(finalMana!.current).toBeLessThanOrEqual(finalMana!.maximum);

          // Verify at least some skills were triggered if initial mana was sufficient
          const totalManaCost = manaCosts.reduce((sum, cost) => sum + cost, 0);
          if (initialMana >= Math.min(...manaCosts)) {
            expect(successfulTriggers).toBeGreaterThan(0);
          }
          if (initialMana >= totalManaCost) {
            expect(successfulTriggers).toBe(skills.length);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});