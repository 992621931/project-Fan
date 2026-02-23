/**
 * Unit tests for Gastritis Skill Effect
 * Tests for task 2.4: 实现胃炎技能效果
 * **Validates: Requirements 8.2, 8.3**
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
  HealthComponent,
  HealthComponentType,
  LevelComponent,
  LevelComponentType,
  JobComponent,
  JobComponentType
} from '../components/CharacterComponents';
import { SkillType, JobType, CharacterStatus } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

describe('Gastritis Skill Effect Tests', () => {
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
  function createTestCharacter(initialHealth: number = 100): string {
    const characterEntity = entityManager.createEntity();
    const character = characterEntity.id;

    const attributeComponent: AttributeComponent = {
      type: 'attribute',
      strength: 10,
      agility: 10,
      wisdom: 10,
      technique: 10
    };

    const derivedStats: DerivedStatsComponent = {
      type: 'derivedStats',
      attack: 30,
      defense: 20,
      moveSpeed: 15,
      dodgeRate: 5,
      critRate: 3,
      critDamage: 125,
      resistance: 8,
      magicPower: 25,
      carryWeight: 100,
      hitRate: 90,
      expRate: 100,
      healthRegen: 2,
      manaRegen: 3,
      weight: 70,
      volume: 1
    };

    const health: HealthComponent = {
      type: 'health',
      current: initialHealth,
      maximum: initialHealth
    };

    const mana: ManaComponent = {
      type: 'mana',
      current: 100,
      maximum: 100
    };

    const levelComponent: LevelComponent = {
      type: 'level',
      level: 1,
      experience: 0,
      experienceToNext: 100
    };

    const characterInfo: CharacterInfoComponent = {
      type: 'characterInfo',
      title: '测试',
      name: '角色',
      isSpecial: false,
      rarity: RarityType.Common,
      status: CharacterStatus.Available
    };

    const job: JobComponent = {
      type: 'job',
      currentJob: JobType.Warrior,
      availableJobs: [JobType.Warrior],
      jobExperience: new Map()
    };

    const skillComponent: SkillComponent = {
      type: 'skill',
      activeSkills: [],
      passiveSkills: [],
      jobSkills: [],
      badgeSkills: []
    };

    const currency: CurrencyComponent = {
      type: 'currency',
      amounts: {
        gold: 1000,
        rice: 0,
        wood: 0,
        stone: 0,
        iron: 0
      },
      transactionHistory: []
    };

    componentManager.addComponent(character, AttributeComponentType, attributeComponent);
    componentManager.addComponent(character, DerivedStatsComponentType, derivedStats);
    componentManager.addComponent(character, HealthComponentType, health);
    componentManager.addComponent(character, ManaComponentType, mana);
    componentManager.addComponent(character, LevelComponentType, levelComponent);
    componentManager.addComponent(character, CharacterInfoComponentType, characterInfo);
    componentManager.addComponent(character, JobComponentType, job);
    componentManager.addComponent(character, SkillComponentType, skillComponent);
    componentManager.addComponent(character, CurrencyComponentType, currency);

    return character;
  }

  it('should reduce maxHealth by 10 when gastritis skill is learned', () => {
    // Requirement 8.2: WHEN "胃炎" is learned, THE Attribute_System SHALL decrease the character's maximum health by 10
    const characterId = createTestCharacter(100);
    
    // Get initial health
    const initialHealth = componentManager.getComponent(characterId, HealthComponentType);
    expect(initialHealth).not.toBeNull();
    expect(initialHealth!.maximum).toBe(100);
    expect(initialHealth!.current).toBe(100);

    // Create gastritis skill
    const gastritisSkill: Partial<Skill> = {
      id: 'gastritis',
      name: '胃炎',
      description: '患有胃炎，最大生命-10，饱腹度消耗-50%。',
      type: SkillType.Passive,
      level: 1,
      maxLevel: 1,
      manaCost: 0,
      cooldown: 0,
      effects: [
        {
          type: 'attribute_bonus',
          target: 'self',
          attribute: 'maxHealth',
          value: -10,
          duration: -1
        },
        {
          type: 'percentage_modifier',
          target: 'self',
          attribute: 'satietyConsumptionRate',
          value: -0.5,
          duration: -1
        }
      ],
      requirements: []
    };

    // Learn the skill
    const result = skillSystem.learnSkill(characterId, 'gastritis', gastritisSkill);
    expect(result.success).toBe(true);

    // Verify maxHealth was reduced by 10
    const updatedHealth = componentManager.getComponent(characterId, HealthComponentType);
    expect(updatedHealth).not.toBeNull();
    expect(updatedHealth!.maximum).toBe(90); // 100 - 10 = 90
    
    // Verify current health was adjusted proportionally
    expect(updatedHealth!.current).toBe(90); // Should maintain 100% health ratio
  });

  it('should reduce satietyConsumptionRate by 50% when gastritis skill is learned', () => {
    // Requirement 8.3: WHEN "胃炎" is learned, THE Passive_Skill_System SHALL decrease the character's Satiety consumption rate by 50%
    const characterId = createTestCharacter(100);
    
    // Get initial derived stats
    const initialDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(initialDerivedStats).not.toBeNull();

    // Create gastritis skill
    const gastritisSkill: Partial<Skill> = {
      id: 'gastritis',
      name: '胃炎',
      description: '患有胃炎，最大生命-10，饱腹度消耗-50%。',
      type: SkillType.Passive,
      level: 1,
      maxLevel: 1,
      manaCost: 0,
      cooldown: 0,
      effects: [
        {
          type: 'attribute_bonus',
          target: 'self',
          attribute: 'maxHealth',
          value: -10,
          duration: -1
        },
        {
          type: 'percentage_modifier',
          target: 'self',
          attribute: 'satietyConsumptionRate',
          value: -0.5,
          duration: -1
        }
      ],
      requirements: []
    };

    // Learn the skill
    const result = skillSystem.learnSkill(characterId, 'gastritis', gastritisSkill);
    expect(result.success).toBe(true);

    // Verify satietyConsumptionRate was reduced by 0.5
    const updatedDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(updatedDerivedStats).not.toBeNull();
    expect((updatedDerivedStats as any).satietyConsumptionRate).toBe(0.5); // 1.0 - 0.5 = 0.5
  });

  it('should handle negative maxHealth values by enforcing minimum of 1', () => {
    // Boundary case: Ensure maxHealth doesn't go below 1
    const characterId = createTestCharacter(5); // Start with low health
    
    // Create gastritis skill
    const gastritisSkill: Partial<Skill> = {
      id: 'gastritis',
      name: '胃炎',
      description: '患有胃炎，最大生命-10，饱腹度消耗-50%。',
      type: SkillType.Passive,
      level: 1,
      maxLevel: 1,
      manaCost: 0,
      cooldown: 0,
      effects: [
        {
          type: 'attribute_bonus',
          target: 'self',
          attribute: 'maxHealth',
          value: -10,
          duration: -1
        }
      ],
      requirements: []
    };

    // Learn the skill
    const result = skillSystem.learnSkill(characterId, 'gastritis', gastritisSkill);
    expect(result.success).toBe(true);

    // Verify maxHealth is at least 1 (not negative)
    const updatedHealth = componentManager.getComponent(characterId, HealthComponentType);
    expect(updatedHealth).not.toBeNull();
    expect(updatedHealth!.maximum).toBeGreaterThanOrEqual(1);
    expect(updatedHealth!.current).toBeGreaterThanOrEqual(0);
    expect(updatedHealth!.current).toBeLessThanOrEqual(updatedHealth!.maximum);
  });

  it('should handle satietyConsumptionRate not going below 0', () => {
    // Boundary case: Ensure satietyConsumptionRate doesn't go negative
    const characterId = createTestCharacter(100);
    
    // Create a skill that reduces satietyConsumptionRate by more than 100%
    const extremeSkill: Partial<Skill> = {
      id: 'extreme_gastritis',
      name: '极端胃炎',
      description: '极端胃炎测试',
      type: SkillType.Passive,
      level: 1,
      maxLevel: 1,
      manaCost: 0,
      cooldown: 0,
      effects: [
        {
          type: 'percentage_modifier',
          target: 'self',
          attribute: 'satietyConsumptionRate',
          value: -2.0, // Reduce by 200%
          duration: -1
        }
      ],
      requirements: []
    };

    // Learn the skill
    const result = skillSystem.learnSkill(characterId, 'extreme_gastritis', extremeSkill);
    expect(result.success).toBe(true);

    // Verify satietyConsumptionRate is at least 0 (not negative)
    const updatedDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(updatedDerivedStats).not.toBeNull();
    expect((updatedDerivedStats as any).satietyConsumptionRate).toBeGreaterThanOrEqual(0);
  });

  it('should maintain health percentage when maxHealth is reduced', () => {
    // Test that current health is adjusted proportionally when maxHealth changes
    const characterId = createTestCharacter(100);
    
    // Reduce current health to 50%
    const health = componentManager.getComponent(characterId, HealthComponentType);
    expect(health).not.toBeNull();
    health!.current = 50;

    // Create gastritis skill
    const gastritisSkill: Partial<Skill> = {
      id: 'gastritis',
      name: '胃炎',
      description: '患有胃炎，最大生命-10，饱腹度消耗-50%。',
      type: SkillType.Passive,
      level: 1,
      maxLevel: 1,
      manaCost: 0,
      cooldown: 0,
      effects: [
        {
          type: 'attribute_bonus',
          target: 'self',
          attribute: 'maxHealth',
          value: -10,
          duration: -1
        }
      ],
      requirements: []
    };

    // Learn the skill
    const result = skillSystem.learnSkill(characterId, 'gastritis', gastritisSkill);
    expect(result.success).toBe(true);

    // Verify health percentage is maintained
    const updatedHealth = componentManager.getComponent(characterId, HealthComponentType);
    expect(updatedHealth).not.toBeNull();
    expect(updatedHealth!.maximum).toBe(90); // 100 - 10 = 90
    expect(updatedHealth!.current).toBe(45); // 50% of 90 = 45
  });
});
