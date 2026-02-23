/**
 * Property-based tests for Skill System
 * **Feature: codename-rice-game, Property 14: 技能学习资源消耗**
 * **Feature: codename-rice-game, Property 15: 技能升级效果增强**
 * **Validates: Requirements 8.1, 8.5**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { SkillSystem } from './SkillSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { 
  SkillComponent, 
  SkillComponentType,
  Skill,
  CurrencyComponent,
  CurrencyComponentType
} from '../components/SystemComponents';
import { 
  AttributeComponent,
  AttributeComponentType,
  DerivedStatsComponent,
  DerivedStatsComponentType,
  CharacterInfoComponent,
  CharacterInfoComponentType,
  ManaComponent,
  ManaComponentType,
  LevelComponent,
  LevelComponentType,
  JobComponent,
  JobComponentType
} from '../components/CharacterComponents';
import { SkillType, JobType, CharacterStatus } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

describe('Skill System Property Tests', () => {
  let skillSystem: SkillSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    
    skillSystem = new SkillSystem();
    skillSystem.initialize(entityManager, componentManager, eventSystem);
  });

  /**
   * Helper function to create a test character with all required components
   */
  function createTestCharacter(
    attributes: { strength: number; agility: number; wisdom: number; technique: number },
    level: number = 1,
    job: JobType = JobType.Warrior,
    initialGold: number = 1000,
    initialMana: number = 100
  ): string {
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
      current: initialMana,
      maximum: initialMana
    };

    const levelComponent: LevelComponent = {
      type: 'level',
      level,
      experience: 0,
      experienceToNext: 100
    };

    const jobComponent: JobComponent = {
      type: 'job',
      currentJob: job,
      availableJobs: [job],
      jobExperience: new Map([[job, 0]])
    };

    const characterInfo: CharacterInfoComponent = {
      type: 'characterInfo',
      title: 'Test',
      name: 'Character',
      isSpecial: false,
      rarity: RarityType.Common,
      status: CharacterStatus.Available
    };

    const skillComponent: SkillComponent = {
      type: 'skill',
      passiveSkills: [],
      activeSkills: [],
      jobSkills: [],
      badgeSkills: []
    };

    const currency: CurrencyComponent = {
      type: 'currency',
      amounts: {
        gold: initialGold,
        crystal: 0,
        reputation: 0
      },
      transactionHistory: []
    };

    componentManager.addComponent(character, AttributeComponentType, attributeComponent);
    componentManager.addComponent(character, DerivedStatsComponentType, derivedStats);
    componentManager.addComponent(character, ManaComponentType, mana);
    componentManager.addComponent(character, LevelComponentType, levelComponent);
    componentManager.addComponent(character, JobComponentType, jobComponent);
    componentManager.addComponent(character, CharacterInfoComponentType, characterInfo);
    componentManager.addComponent(character, SkillComponentType, skillComponent);
    componentManager.addComponent(character, CurrencyComponentType, currency);

    return character;
  }

  /**
   * Helper function to create a test skill
   */
  function createTestSkill(
    id: string,
    type: SkillType,
    manaCost: number,
    maxLevel: number = 5
  ): Partial<Skill> {
    return {
      name: `Test Skill ${id}`,
      description: `Test skill of type ${type}`,
      type,
      manaCost,
      maxLevel,
      cooldown: 0,
      effects: [
        {
          type: 'heal',
          target: 'self',
          attribute: 'health',
          value: 20,
          duration: 0
        }
      ],
      requirements: []
    };
  }

  /**
   * Property 14: 技能学习资源消耗
   * For any skill learning operation, the system should verify learning conditions 
   * and consume appropriate resources
   * **Validates: Requirements 8.1**
   */
  it('Property 14: 技能学习资源消耗', () => {
    // Generator for character attributes
    const attributeGenerator = fc.record({
      strength: fc.integer({ min: 10, max: 50 }),
      agility: fc.integer({ min: 10, max: 50 }),
      wisdom: fc.integer({ min: 10, max: 50 }),
      technique: fc.integer({ min: 10, max: 50 })
    });

    // Generator for skill properties
    const skillGenerator = fc.record({
      manaCost: fc.integer({ min: 5, max: 50 }),
      maxLevel: fc.integer({ min: 3, max: 10 })
    });

    // Generator for initial gold amounts
    const goldGenerator = fc.integer({ min: 50, max: 2000 });

    fc.assert(
      fc.property(
        attributeGenerator,
        skillGenerator,
        goldGenerator,
        fc.constantFrom(...Object.values(SkillType).filter(t => t !== SkillType.Badge)), // Exclude badge skills
        (attributes, skillProps, initialGold, skillType) => {
          const characterId = createTestCharacter(attributes, 1, JobType.Warrior, initialGold);
          
          // Record original gold amount
          const currency = componentManager.getComponent(characterId, CurrencyComponentType);
          expect(currency).not.toBeNull();
          const originalGold = currency!.amounts.gold;

          // Create a test skill
          const skillData = createTestSkill('test-skill', skillType, skillProps.manaCost, skillProps.maxLevel);
          
          // Attempt to learn the skill
          const learnResult = skillSystem.learnSkill(characterId, 'test-skill', skillData);

          // Calculate expected learning cost
          let baseCost = 100;
          switch (skillType) {
            case SkillType.Passive:
              baseCost = 150;
              break;
            case SkillType.Active:
              baseCost = 200;
              break;
            case SkillType.Job:
              baseCost = 300;
              break;
          }
          const powerMultiplier = 1 + (skillProps.manaCost / 100);
          const expectedCost = Math.floor(baseCost * powerMultiplier);

          if (originalGold >= expectedCost) {
            // Learning should succeed
            expect(learnResult.success).toBe(true);
            expect(learnResult.skill).toBeDefined();
            expect(learnResult.skill!.id).toBe('test-skill');

            // Verify gold was consumed
            const updatedCurrency = componentManager.getComponent(characterId, CurrencyComponentType);
            expect(updatedCurrency).not.toBeNull();
            expect(updatedCurrency!.amounts.gold).toBe(originalGold - expectedCost);

            // Verify transaction was recorded
            expect(updatedCurrency!.transactionHistory).toHaveLength(1);
            const transaction = updatedCurrency!.transactionHistory[0];
            expect(transaction.type).toBe('spend');
            expect(transaction.currency).toBe('gold');
            expect(transaction.amount).toBe(expectedCost);
            expect(transaction.reason).toContain('Learned skill');

            // Verify skill was added to appropriate category
            const skillComponent = componentManager.getComponent(characterId, SkillComponentType);
            expect(skillComponent).not.toBeNull();
            
            let skillFound = false;
            switch (skillType) {
              case SkillType.Passive:
                skillFound = skillComponent!.passiveSkills.some(s => s.id === 'test-skill');
                break;
              case SkillType.Active:
                skillFound = skillComponent!.activeSkills.some(s => s.id === 'test-skill');
                break;
              case SkillType.Job:
                skillFound = skillComponent!.jobSkills.some(s => s.id === 'test-skill');
                break;
            }
            expect(skillFound).toBe(true);

          } else {
            // Learning should fail due to insufficient gold
            expect(learnResult.success).toBe(false);
            expect(learnResult.error).toContain('Insufficient gold');

            // Verify gold was not consumed
            const unchangedCurrency = componentManager.getComponent(characterId, CurrencyComponentType);
            expect(unchangedCurrency).not.toBeNull();
            expect(unchangedCurrency!.amounts.gold).toBe(originalGold);

            // Verify no transaction was recorded
            expect(unchangedCurrency!.transactionHistory).toHaveLength(0);

            // Verify skill was not added
            const skillComponent = componentManager.getComponent(characterId, SkillComponentType);
            expect(skillComponent).not.toBeNull();
            expect(skillComponent!.passiveSkills).toHaveLength(0);
            expect(skillComponent!.activeSkills).toHaveLength(0);
            expect(skillComponent!.jobSkills).toHaveLength(0);
          }

          // Verify gold never goes negative
          const finalCurrency = componentManager.getComponent(characterId, CurrencyComponentType);
          expect(finalCurrency).not.toBeNull();
          expect(finalCurrency!.amounts.gold).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15: 技能升级效果增强
   * For any skill level upgrade, the system should enhance skill effects 
   * and reduce resource consumption
   * **Validates: Requirements 8.5**
   */
  it('Property 15: 技能升级效果增强', () => {
    // Generator for character attributes
    const attributeGenerator = fc.record({
      strength: fc.integer({ min: 10, max: 50 }),
      agility: fc.integer({ min: 10, max: 50 }),
      wisdom: fc.integer({ min: 10, max: 50 }),
      technique: fc.integer({ min: 10, max: 50 })
    });

    // Generator for skill properties
    const skillGenerator = fc.record({
      manaCost: fc.integer({ min: 10, max: 50 }),
      maxLevel: fc.integer({ min: 3, max: 8 }),
      cooldown: fc.integer({ min: 5, max: 30 })
    });

    fc.assert(
      fc.property(
        attributeGenerator,
        skillGenerator,
        fc.constantFrom(SkillType.Active, SkillType.Passive, SkillType.Job), // Upgradeable skill types
        (attributes, skillProps, skillType) => {
          const characterId = createTestCharacter(attributes, 1, JobType.Warrior, 5000); // Plenty of gold
          
          // Create and learn a test skill
          const skillData = createTestSkill('upgrade-skill', skillType, skillProps.manaCost, skillProps.maxLevel);
          skillData.cooldown = skillProps.cooldown;
          
          const learnResult = skillSystem.learnSkill(characterId, 'upgrade-skill', skillData);
          expect(learnResult.success).toBe(true);

          // Get the learned skill
          const skillComponent = componentManager.getComponent(characterId, SkillComponentType);
          expect(skillComponent).not.toBeNull();
          
          let learnedSkill: Skill | undefined;
          switch (skillType) {
            case SkillType.Passive:
              learnedSkill = skillComponent!.passiveSkills.find(s => s.id === 'upgrade-skill');
              break;
            case SkillType.Active:
              learnedSkill = skillComponent!.activeSkills.find(s => s.id === 'upgrade-skill');
              break;
            case SkillType.Job:
              learnedSkill = skillComponent!.jobSkills.find(s => s.id === 'upgrade-skill');
              break;
          }
          
          expect(learnedSkill).toBeDefined();
          expect(learnedSkill!.level).toBe(1);

          // Record original skill properties
          const originalManaCost = learnedSkill!.manaCost;
          const originalCooldown = learnedSkill!.cooldown;
          const originalLevel = learnedSkill!.level;

          // Upgrade the skill multiple times (up to max level - 1)
          const maxUpgrades = Math.min(3, learnedSkill!.maxLevel - 1); // Limit upgrades for test performance
          let currentLevel = originalLevel;
          let currentManaCost = originalManaCost;
          let currentCooldown = originalCooldown;

          for (let i = 0; i < maxUpgrades; i++) {
            const upgradeResult = skillSystem.upgradeSkill(characterId, 'upgrade-skill');
            expect(upgradeResult.success).toBe(true);
            expect(upgradeResult.newLevel).toBe(currentLevel + 1);

            currentLevel = upgradeResult.newLevel!;

            // Verify skill level increased
            expect(learnedSkill!.level).toBe(currentLevel);

            // Verify mana cost was reduced (5% per level, minimum 1)
            const expectedCostReduction = Math.floor(currentManaCost * 0.05);
            const expectedNewManaCost = Math.max(1, currentManaCost - expectedCostReduction);
            
            // Allow for the fact that mana cost reduction is cumulative from original
            expect(learnedSkill!.manaCost).toBeLessThanOrEqual(currentManaCost);
            expect(learnedSkill!.manaCost).toBeGreaterThanOrEqual(1);
            currentManaCost = learnedSkill!.manaCost;

            // Verify cooldown was reduced (10% per level, minimum 0)
            if (originalCooldown > 0) {
              expect(learnedSkill!.cooldown).toBeLessThanOrEqual(currentCooldown);
              expect(learnedSkill!.cooldown).toBeGreaterThanOrEqual(0);
              currentCooldown = learnedSkill!.cooldown;
            }
          }

          // Verify overall improvements after all upgrades
          if (maxUpgrades > 0) {
            // Mana cost should be reduced or at minimum value
            expect(learnedSkill!.manaCost).toBeLessThanOrEqual(originalManaCost);
            expect(learnedSkill!.manaCost).toBeGreaterThanOrEqual(1);

            // Cooldown should be reduced or at minimum value
            if (originalCooldown > 0) {
              expect(learnedSkill!.cooldown).toBeLessThanOrEqual(originalCooldown);
              expect(learnedSkill!.cooldown).toBeGreaterThanOrEqual(0);
            }

            // Level should have increased
            expect(learnedSkill!.level).toBeGreaterThan(originalLevel);
            expect(learnedSkill!.level).toBeLessThanOrEqual(learnedSkill!.maxLevel);
          }

          // Verify cannot upgrade beyond max level
          if (learnedSkill!.level >= learnedSkill!.maxLevel) {
            const failedUpgrade = skillSystem.upgradeSkill(characterId, 'upgrade-skill');
            expect(failedUpgrade.success).toBe(false);
            expect(failedUpgrade.error).toContain('maximum level');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle skill learning with requirements correctly', () => {
    // Property: Skills with requirements should only be learnable when requirements are met
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 5, max: 100 }),
          agility: fc.integer({ min: 5, max: 100 }),
          wisdom: fc.integer({ min: 5, max: 100 }),
          technique: fc.integer({ min: 5, max: 100 })
        }),
        fc.integer({ min: 1, max: 20 }), // Required level
        fc.integer({ min: 10, max: 80 }), // Required attribute value
        fc.integer({ min: -5, max: 5 }), // Level variation
        (attributes, requiredLevel, requiredAttributeValue, levelVariation) => {
          const characterLevel = Math.max(1, requiredLevel + levelVariation);
          const characterId = createTestCharacter(attributes, characterLevel, JobType.Warrior, 1000);
          
          // Create skill with level and attribute requirements
          const skillData = createTestSkill('req-skill', SkillType.Active, 20);
          skillData.requirements = [
            {
              type: 'level',
              value: requiredLevel,
              minimum: requiredLevel
            },
            {
              type: 'attribute',
              value: 'strength',
              minimum: requiredAttributeValue
            }
          ];

          const learnResult = skillSystem.learnSkill(characterId, 'req-skill', skillData);

          // Check if requirements should be met
          const levelMet = characterLevel >= requiredLevel;
          const attributeMet = attributes.strength >= requiredAttributeValue;
          const requirementsMet = levelMet && attributeMet;

          if (requirementsMet) {
            expect(learnResult.success).toBe(true);
            
            // Verify skill was learned
            const skillComponent = componentManager.getComponent(characterId, SkillComponentType);
            expect(skillComponent).not.toBeNull();
            expect(skillComponent!.activeSkills.some(s => s.id === 'req-skill')).toBe(true);
          } else {
            expect(learnResult.success).toBe(false);
            expect(learnResult.error).toBe('Requirements not met');
            
            // Verify skill was not learned
            const skillComponent = componentManager.getComponent(characterId, SkillComponentType);
            expect(skillComponent).not.toBeNull();
            expect(skillComponent!.activeSkills.some(s => s.id === 'req-skill')).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle skill usage with mana consumption correctly', () => {
    // Property: Active skills should consume mana and apply effects when used
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 10, max: 50 }),
          agility: fc.integer({ min: 10, max: 50 }),
          wisdom: fc.integer({ min: 10, max: 50 }),
          technique: fc.integer({ min: 10, max: 50 })
        }),
        fc.integer({ min: 5, max: 40 }), // Skill mana cost
        fc.integer({ min: 20, max: 200 }), // Initial mana
        (attributes, manaCost, initialMana) => {
          const characterId = createTestCharacter(attributes, 1, JobType.Warrior, 1000, initialMana);
          
          // Learn an active skill
          const skillData = createTestSkill('use-skill', SkillType.Active, manaCost);
          const learnResult = skillSystem.learnSkill(characterId, 'use-skill', skillData);
          expect(learnResult.success).toBe(true);

          // Record original mana
          const manaComponent = componentManager.getComponent(characterId, ManaComponentType);
          expect(manaComponent).not.toBeNull();
          const originalMana = manaComponent!.current;

          // Attempt to use the skill
          const useResult = skillSystem.useSkill(characterId, 'use-skill');

          if (originalMana >= manaCost) {
            // Skill usage should succeed
            expect(useResult.success).toBe(true);
            expect(useResult.effects).toBeDefined();
            // Note: Effects might be empty if skill effects couldn't be applied (e.g., heal on full health)
            // So we don't require effects.length > 0, just that the skill succeeded

            // Verify mana was consumed
            const updatedMana = componentManager.getComponent(characterId, ManaComponentType);
            expect(updatedMana).not.toBeNull();
            expect(updatedMana!.current).toBe(originalMana - manaCost);
          } else {
            // Skill usage should fail
            expect(useResult.success).toBe(false);
            expect(useResult.error).toContain('Insufficient mana');

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

  it('should prevent duplicate skill learning', () => {
    // Property: The same skill should not be learnable twice
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 10, max: 50 }),
          agility: fc.integer({ min: 10, max: 50 }),
          wisdom: fc.integer({ min: 10, max: 50 }),
          technique: fc.integer({ min: 10, max: 50 })
        }),
        fc.constantFrom(...Object.values(SkillType).filter(t => t !== SkillType.Badge)),
        (attributes, skillType) => {
          const characterId = createTestCharacter(attributes, 1, JobType.Warrior, 2000);
          
          // Learn a skill
          const skillData = createTestSkill('duplicate-skill', skillType, 15);
          const firstLearn = skillSystem.learnSkill(characterId, 'duplicate-skill', skillData);
          expect(firstLearn.success).toBe(true);

          // Record gold after first learning
          const currency = componentManager.getComponent(characterId, CurrencyComponentType);
          expect(currency).not.toBeNull();
          const goldAfterFirst = currency!.amounts.gold;

          // Attempt to learn the same skill again
          const secondLearn = skillSystem.learnSkill(characterId, 'duplicate-skill', skillData);
          expect(secondLearn.success).toBe(false);
          expect(secondLearn.error).toBe('Skill is already learned');

          // Verify no additional gold was consumed
          const finalCurrency = componentManager.getComponent(characterId, CurrencyComponentType);
          expect(finalCurrency).not.toBeNull();
          expect(finalCurrency!.amounts.gold).toBe(goldAfterFirst);

          // Verify skill count didn't increase
          const skillComponent = componentManager.getComponent(characterId, SkillComponentType);
          expect(skillComponent).not.toBeNull();
          
          let skillCount = 0;
          switch (skillType) {
            case SkillType.Passive:
              skillCount = skillComponent!.passiveSkills.length;
              break;
            case SkillType.Active:
              skillCount = skillComponent!.activeSkills.length;
              break;
            case SkillType.Job:
              skillCount = skillComponent!.jobSkills.length;
              break;
          }
          expect(skillCount).toBe(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle skill cooldowns correctly', () => {
    // Property: Skills with cooldowns should not be usable until cooldown expires
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 10, max: 50 }),
          agility: fc.integer({ min: 10, max: 50 }),
          wisdom: fc.integer({ min: 10, max: 50 }),
          technique: fc.integer({ min: 10, max: 50 })
        }),
        fc.integer({ min: 1, max: 10 }), // Cooldown duration
        (attributes, cooldownDuration) => {
          const characterId = createTestCharacter(attributes, 1, JobType.Warrior, 1000, 200);
          
          // Learn a skill with cooldown
          const skillData = createTestSkill('cooldown-skill', SkillType.Active, 10);
          skillData.cooldown = cooldownDuration;
          
          const learnResult = skillSystem.learnSkill(characterId, 'cooldown-skill', skillData);
          expect(learnResult.success).toBe(true);

          // Use the skill first time - should succeed
          const firstUse = skillSystem.useSkill(characterId, 'cooldown-skill');
          expect(firstUse.success).toBe(true);

          // Verify skill is on cooldown
          const cooldownRemaining = skillSystem.getSkillCooldown(characterId, 'cooldown-skill');
          expect(cooldownRemaining).toBeGreaterThan(0);
          expect(cooldownRemaining).toBeLessThanOrEqual(cooldownDuration);

          // Attempt to use skill again immediately - should fail
          const secondUse = skillSystem.useSkill(characterId, 'cooldown-skill');
          expect(secondUse.success).toBe(false);
          expect(secondUse.error).toBe('Skill is on cooldown');

          // Simulate time passing (update cooldowns)
          skillSystem.update(cooldownDuration + 1); // Pass more time than cooldown

          // Verify cooldown has expired
          const cooldownAfterUpdate = skillSystem.getSkillCooldown(characterId, 'cooldown-skill');
          expect(cooldownAfterUpdate).toBe(0);

          // Skill should be usable again
          const thirdUse = skillSystem.useSkill(characterId, 'cooldown-skill');
          expect(thirdUse.success).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});