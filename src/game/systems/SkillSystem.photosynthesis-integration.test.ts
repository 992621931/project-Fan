/**
 * Integration test for Photosynthesis skill (光合作用)
 * Tests that the skill can be loaded from game-config.json and works correctly with the conditional_bonus system
 * **Validates: Requirements 7.6, 7.7, 7.8**
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

describe('SkillSystem - Photosynthesis Integration Test', () => {
  let skillSystem: SkillSystem;
  let attributeSystem: AttributeSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;
  let entityId: string;

  beforeEach(async () => {
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

  it('should load photosynthesis skill from game-config.json', async () => {
    // Arrange - Load game config directly
    const fs = await import('fs/promises');
    const gameConfigData = await fs.readFile('src/game/data/game-config.json', 'utf8');
    const gameConfig = JSON.parse(gameConfigData);
    
    // Act - Find the skill
    const skillData = gameConfig.skills.find((s: any) => s.id === 'photosynthesis');

    // Assert
    expect(skillData).toBeDefined();
    expect(skillData).not.toBeNull();
    expect(skillData.id).toBe('photosynthesis');
    expect(skillData.name).toBe('光合作用');
    expect(skillData.type).toBe('passive');
    expect(skillData.effects).toHaveLength(2);
    
    // Verify healthRegen effect
    const healthRegenEffect = skillData.effects.find((e: any) => e.attribute === 'healthRegen');
    expect(healthRegenEffect).toBeDefined();
    expect(healthRegenEffect.type).toBe('conditional_bonus');
    expect(healthRegenEffect.value).toBe(1);
    expect(healthRegenEffect.condition.type).toBe('time_of_day');
    expect(healthRegenEffect.condition.value).toBe('day');
    
    // Verify manaRegen effect
    const manaRegenEffect = skillData.effects.find((e: any) => e.attribute === 'manaRegen');
    expect(manaRegenEffect).toBeDefined();
    expect(manaRegenEffect.type).toBe('conditional_bonus');
    expect(manaRegenEffect.value).toBe(1);
    expect(manaRegenEffect.condition.type).toBe('time_of_day');
    expect(manaRegenEffect.condition.value).toBe('day');
  });

  it('should apply photosynthesis bonuses during day time when loaded from config', async () => {
    // Arrange - Load skill from config file
    const fs = await import('fs/promises');
    const gameConfigData = await fs.readFile('src/game/data/game-config.json', 'utf8');
    const gameConfig = JSON.parse(gameConfigData);
    const skillData = gameConfig.skills.find((s: any) => s.id === 'photosynthesis');
    expect(skillData).toBeDefined();

    // Capture initial values
    const derivedStatsBefore = componentManager.getComponent(entityId, DerivedStatsComponentType);
    const initialHealthRegen = derivedStatsBefore!.healthRegen;
    const initialManaRegen = derivedStatsBefore!.manaRegen;

    // Act - Learn the skill
    const result = skillSystem.learnSkill(entityId, 'photosynthesis', skillData);

    // Assert
    expect(result.success).toBe(true);

    const derivedStats = componentManager.getComponent(entityId, DerivedStatsComponentType);

    // Initially it's day, so bonuses should be applied
    expect(skillSystem.getTimeOfDay()).toBe('day');
    expect(derivedStats!.healthRegen).toBe(initialHealthRegen + 1);
    expect(derivedStats!.manaRegen).toBe(initialManaRegen + 1);
  });

  it('should remove photosynthesis bonuses during night time', async () => {
    // Arrange - Load and learn skill
    const fs = await import('fs/promises');
    const gameConfigData = await fs.readFile('src/game/data/game-config.json', 'utf8');
    const gameConfig = JSON.parse(gameConfigData);
    const skillData = gameConfig.skills.find((s: any) => s.id === 'photosynthesis');
    const derivedStatsBefore = componentManager.getComponent(entityId, DerivedStatsComponentType);
    const initialHealthRegen = derivedStatsBefore!.healthRegen;
    const initialManaRegen = derivedStatsBefore!.manaRegen;

    skillSystem.learnSkill(entityId, 'photosynthesis', skillData);

    // Verify bonuses are applied during day
    let derivedStats = componentManager.getComponent(entityId, DerivedStatsComponentType);
    expect(derivedStats!.healthRegen).toBe(initialHealthRegen + 1);
    expect(derivedStats!.manaRegen).toBe(initialManaRegen + 1);

    // Act - Change to night
    skillSystem.setTimeOfDay('night');

    // Assert - Bonuses should be removed
    derivedStats = componentManager.getComponent(entityId, DerivedStatsComponentType);
    expect(derivedStats!.healthRegen).toBe(initialHealthRegen);
    expect(derivedStats!.manaRegen).toBe(initialManaRegen);
  });

  it('should reapply photosynthesis bonuses when day returns', async () => {
    // Arrange - Load and learn skill
    const fs = await import('fs/promises');
    const gameConfigData = await fs.readFile('src/game/data/game-config.json', 'utf8');
    const gameConfig = JSON.parse(gameConfigData);
    const skillData = gameConfig.skills.find((s: any) => s.id === 'photosynthesis');
    const derivedStatsBefore = componentManager.getComponent(entityId, DerivedStatsComponentType);
    const initialHealthRegen = derivedStatsBefore!.healthRegen;
    const initialManaRegen = derivedStatsBefore!.manaRegen;

    skillSystem.learnSkill(entityId, 'photosynthesis', skillData);

    // Change to night (bonuses removed)
    skillSystem.setTimeOfDay('night');
    let derivedStats = componentManager.getComponent(entityId, DerivedStatsComponentType);
    expect(derivedStats!.healthRegen).toBe(initialHealthRegen);
    expect(derivedStats!.manaRegen).toBe(initialManaRegen);

    // Act - Change back to day
    skillSystem.setTimeOfDay('day');

    // Assert - Bonuses should be reapplied
    derivedStats = componentManager.getComponent(entityId, DerivedStatsComponentType);
    expect(derivedStats!.healthRegen).toBe(initialHealthRegen + 1);
    expect(derivedStats!.manaRegen).toBe(initialManaRegen + 1);
  });

  it('should emit conditional_bonus events for photosynthesis', async () => {
    // Arrange
    const fs = await import('fs/promises');
    const gameConfigData = await fs.readFile('src/game/data/game-config.json', 'utf8');
    const gameConfig = JSON.parse(gameConfigData);
    const skillData = gameConfig.skills.find((s: any) => s.id === 'photosynthesis');
    skillSystem.learnSkill(entityId, 'photosynthesis', skillData);

    let appliedEvents: any[] = [];
    let removedEvents: any[] = [];

    eventSystem.on('conditional_bonus_applied', (event) => {
      appliedEvents.push(event);
    });

    eventSystem.on('conditional_bonus_removed', (event) => {
      removedEvents.push(event);
    });

    // Act - Change to night (should remove bonuses)
    skillSystem.setTimeOfDay('night');

    // Assert - Should have 2 removed events (healthRegen and manaRegen)
    expect(removedEvents.length).toBe(2);
    expect(removedEvents.some(e => e.attribute === 'healthRegen')).toBe(true);
    expect(removedEvents.some(e => e.attribute === 'manaRegen')).toBe(true);

    // Act - Change back to day (should reapply bonuses)
    skillSystem.setTimeOfDay('day');

    // Assert - Should have 2 applied events
    expect(appliedEvents.length).toBe(2);
    expect(appliedEvents.some(e => e.attribute === 'healthRegen')).toBe(true);
    expect(appliedEvents.some(e => e.attribute === 'manaRegen')).toBe(true);
  });
});
