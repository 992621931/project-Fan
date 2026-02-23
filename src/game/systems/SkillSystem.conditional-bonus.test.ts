/**
 * Tests for conditional_bonus effect type in SkillSystem
 * Validates Requirements 12.2 (conditional_bonus support)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { SkillSystem } from './SkillSystem';
import { AttributeSystem } from './AttributeSystem';
import {
  SkillComponent,
  SkillComponentType,
  CurrencyComponent,
  CurrencyComponentType,
} from '../components/SystemComponents';
import {
  AttributeComponent,
  AttributeComponentType,
  CharacterInfoComponent,
  CharacterInfoComponentType,
  LevelComponent,
  LevelComponentType,
  HealthComponent,
  HealthComponentType,
  ManaComponent,
  ManaComponentType,
  DerivedStatsComponent,
  DerivedStatsComponentType,
} from '../components/CharacterComponents';
import { CharacterStatus } from '../types/GameTypes';

describe('SkillSystem - Conditional Bonus Effects', () => {
  let skillSystem: SkillSystem;
  let attributeSystem: AttributeSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;
  let entityId: string;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();

    skillSystem = new SkillSystem();
    skillSystem.initialize(entityManager, componentManager, eventSystem);

    attributeSystem = new AttributeSystem();
    attributeSystem.initialize(entityManager, componentManager, eventSystem);

    // Create a test character
    const entity = entityManager.createEntity();
    entityId = entity.id;

    // Add required components
    componentManager.addComponent(entityId, SkillComponentType, {
      type: 'skill',
      passiveSkills: [],
      activeSkills: [],
      jobSkills: [],
      badgeSkills: [],
    } as SkillComponent);

    componentManager.addComponent(entityId, AttributeComponentType, {
      type: 'attributes',
      strength: 10,
      agility: 10,
      intelligence: 10,
      vitality: 10,
      luck: 5,
      attack: 20,
      defense: 15,
      magicPower: 10,
      critRate: 0.05,
      critDamage: 0.5,
    } as AttributeComponent);

    componentManager.addComponent(entityId, DerivedStatsComponentType, {
      type: 'derived_stats',
      maxHealth: 100,
      maxMana: 50,
      healthRegen: 1,
      manaRegen: 1,
      moveSpeed: 100,
      attackSpeed: 1.0,
    } as DerivedStatsComponent);

    componentManager.addComponent(entityId, HealthComponentType, {
      type: 'health',
      current: 100,
      maximum: 100,
    } as HealthComponent);

    componentManager.addComponent(entityId, ManaComponentType, {
      type: 'mana',
      current: 50,
      maximum: 50,
    } as ManaComponent);

    componentManager.addComponent(entityId, CharacterInfoComponentType, {
      type: 'character_info',
      name: 'Test Character',
      characterId: 'test_char',
      status: CharacterStatus.Available,
      isRecruited: true,
      recruitmentCost: 0,
    } as CharacterInfoComponent);

    componentManager.addComponent(entityId, LevelComponentType, {
      type: 'level',
      level: 5,
      experience: 0,
      experienceToNextLevel: 100,
    } as LevelComponent);

    componentManager.addComponent(entityId, CurrencyComponentType, {
      type: 'currency',
      amounts: { gold: 1000, silver: 0, copper: 0 },
      transactionHistory: [],
    } as CurrencyComponent);
  });

  it('should apply moon_blessing bonuses during night time', () => {
    // Learn moon_blessing skill
    const result = skillSystem.learnSkill(entityId, 'moon_blessing', {
      name: '月之祝福',
      description: '在夜晚获得月亮的祝福，攻击力+15%，防御力+10。',
      type: 'passive',
      maxLevel: 1,
      manaCost: 0,
      cooldown: 0,
      effects: [
        {
          type: 'conditional_bonus',
          target: 'self',
          attribute: 'attack',
          value: 0.15,
          duration: -1,
          condition: {
            type: 'time_of_day',
            value: 'night',
          },
        },
        {
          type: 'conditional_bonus',
          target: 'self',
          attribute: 'defense',
          value: 10,
          duration: -1,
          condition: {
            type: 'time_of_day',
            value: 'night',
          },
        },
      ],
      requirements: [],
    });

    expect(result.success).toBe(true);

    const attributes = componentManager.getComponent(entityId, AttributeComponentType);
    const initialAttack = attributes!.attack;
    const initialDefense = attributes!.defense;

    // Initially it's day, so bonuses should not be applied
    expect(skillSystem.getTimeOfDay()).toBe('day');
    expect(attributes!.attack).toBe(initialAttack);
    expect(attributes!.defense).toBe(initialDefense);

    // Change to night
    skillSystem.setTimeOfDay('night');

    // Bonuses should now be applied
    const expectedAttackBonus = initialAttack * 0.15;
    expect(attributes!.attack).toBeCloseTo(initialAttack + expectedAttackBonus, 1);
    expect(attributes!.defense).toBe(initialDefense + 10);

    // Change back to day
    skillSystem.setTimeOfDay('day');

    // Bonuses should be removed
    expect(attributes!.attack).toBeCloseTo(initialAttack, 1);
    expect(attributes!.defense).toBe(initialDefense);
  });

  it('should apply photosynthesis bonuses during day time', () => {
    // Capture initial values BEFORE learning the skill
    const derivedStatsBefore = componentManager.getComponent(entityId, DerivedStatsComponentType);
    const initialHealthRegen = derivedStatsBefore!.healthRegen;
    const initialManaRegen = derivedStatsBefore!.manaRegen;

    // Learn photosynthesis skill
    const result = skillSystem.learnSkill(entityId, 'photosynthesis', {
      name: '光合作用',
      description: '在白天进行光合作用，回血+1，回魔+1。',
      type: 'passive',
      maxLevel: 1,
      manaCost: 0,
      cooldown: 0,
      effects: [
        {
          type: 'conditional_bonus',
          target: 'self',
          attribute: 'healthRegen',
          value: 1,
          duration: -1,
          condition: {
            type: 'time_of_day',
            value: 'day',
          },
        },
        {
          type: 'conditional_bonus',
          target: 'self',
          attribute: 'manaRegen',
          value: 1,
          duration: -1,
          condition: {
            type: 'time_of_day',
            value: 'day',
          },
        },
      ],
      requirements: [],
    });

    expect(result.success).toBe(true);

    const derivedStats = componentManager.getComponent(entityId, DerivedStatsComponentType);

    // Initially it's day, so bonuses should be applied
    expect(skillSystem.getTimeOfDay()).toBe('day');
    expect(derivedStats!.healthRegen).toBe(initialHealthRegen + 1);
    expect(derivedStats!.manaRegen).toBe(initialManaRegen + 1);

    // Change to night
    skillSystem.setTimeOfDay('night');

    // Bonuses should be removed
    expect(derivedStats!.healthRegen).toBe(initialHealthRegen);
    expect(derivedStats!.manaRegen).toBe(initialManaRegen);

    // Change back to day
    skillSystem.setTimeOfDay('day');

    // Bonuses should be reapplied
    expect(derivedStats!.healthRegen).toBe(initialHealthRegen + 1);
    expect(derivedStats!.manaRegen).toBe(initialManaRegen + 1);
  });

  it('should handle multiple conditional bonuses correctly', () => {
    // Capture initial values BEFORE learning skills
    const attributesBefore = componentManager.getComponent(entityId, AttributeComponentType);
    const derivedStatsBefore = componentManager.getComponent(entityId, DerivedStatsComponentType);
    const initialAttack = attributesBefore!.attack;
    const initialHealthRegen = derivedStatsBefore!.healthRegen;

    // Learn both moon_blessing and photosynthesis
    skillSystem.learnSkill(entityId, 'moon_blessing', {
      name: '月之祝福',
      type: 'passive',
      maxLevel: 1,
      manaCost: 0,
      cooldown: 0,
      effects: [
        {
          type: 'conditional_bonus',
          target: 'self',
          attribute: 'attack',
          value: 0.15,
          duration: -1,
          condition: { type: 'time_of_day', value: 'night' },
        },
      ],
      requirements: [],
    });

    skillSystem.learnSkill(entityId, 'photosynthesis', {
      name: '光合作用',
      type: 'passive',
      maxLevel: 1,
      manaCost: 0,
      cooldown: 0,
      effects: [
        {
          type: 'conditional_bonus',
          target: 'self',
          attribute: 'healthRegen',
          value: 1,
          duration: -1,
          condition: { type: 'time_of_day', value: 'day' },
        },
      ],
      requirements: [],
    });

    const attributes = componentManager.getComponent(entityId, AttributeComponentType);
    const derivedStats = componentManager.getComponent(entityId, DerivedStatsComponentType);

    // Day: only photosynthesis should be active
    expect(skillSystem.getTimeOfDay()).toBe('day');
    expect(attributes!.attack).toBe(initialAttack);
    expect(derivedStats!.healthRegen).toBe(initialHealthRegen + 1);

    // Night: only moon_blessing should be active
    skillSystem.setTimeOfDay('night');
    expect(attributes!.attack).toBeCloseTo(initialAttack + initialAttack * 0.15, 1);
    expect(derivedStats!.healthRegen).toBe(initialHealthRegen);
  });
});
