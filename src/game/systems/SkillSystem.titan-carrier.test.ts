/**
 * Tests for Titan Bloodline and Carrier passive skills
 * Validates Requirements 5.2, 5.3, 5.5, 5.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SkillSystem } from './SkillSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { 
  SkillComponent, 
  SkillComponentType,
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
import { JobType, CharacterStatus, Skill } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

describe('Passive Skills - Titan Bloodline and Carrier', () => {
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
   * Helper function to create a test character
   */
  function createTestCharacter(): string {
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
      attack: 20,
      defense: 15,
      moveSpeed: 100,
      dodgeRate: 0.1,
      critRate: 0.05,
      critDamage: 1.5,
      resistance: 10,
      magicPower: 15,
      carryWeight: 50,
      hitRate: 0.9,
      expRate: 1.0,
      healthRegen: 1,
      manaRegen: 1,
      weight: 70,
      volume: 100
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

    const jobComponent: JobComponent = {
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
        gold: 10000,
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

  it('should apply Titan Bloodline skill effects (volume +30, weight +10)', () => {
    const characterId = createTestCharacter();
    
    // Get initial values
    const derivedStatsBefore = componentManager.getComponent(characterId, DerivedStatsComponentType);
    const initialVolume = derivedStatsBefore!.volume;
    const initialWeight = derivedStatsBefore!.weight;

    // Define Titan Bloodline skill
    const titanBloodlineSkill: Partial<Skill> = {
      id: 'titan_bloodline',
      name: '泰坦血脉',
      description: '拥有泰坦的血统，体积+30，体重+10。',
      type: 'passive',
      level: 1,
      maxLevel: 1,
      manaCost: 0,
      cooldown: 0,
      effects: [
        {
          type: 'attribute_bonus',
          target: 'self',
          attribute: 'volume',
          value: 30,
          duration: -1
        },
        {
          type: 'attribute_bonus',
          target: 'self',
          attribute: 'weight',
          value: 10,
          duration: -1
        }
      ]
    };

    // Learn the skill
    const result = skillSystem.learnSkill(characterId, 'titan_bloodline', titanBloodlineSkill);
    expect(result.success).toBe(true);

    // Verify the effects were applied
    const derivedStatsAfter = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(derivedStatsAfter!.volume).toBe(initialVolume + 30);
    expect(derivedStatsAfter!.weight).toBe(initialWeight + 10);
  });

  it('should apply Carrier skill effects (carryWeight +30, moveSpeed -30%)', () => {
    const characterId = createTestCharacter();
    
    // Get initial values
    const derivedStatsBefore = componentManager.getComponent(characterId, DerivedStatsComponentType);
    const initialCarryWeight = derivedStatsBefore!.carryWeight;
    const initialMoveSpeed = derivedStatsBefore!.moveSpeed;

    // Define Carrier skill
    const carrierSkill: Partial<Skill> = {
      id: 'carrier',
      name: '搬运者',
      description: '强大的负重能力，负重+30，移速-30%。',
      type: 'passive',
      level: 1,
      maxLevel: 1,
      manaCost: 0,
      cooldown: 0,
      effects: [
        {
          type: 'attribute_bonus',
          target: 'self',
          attribute: 'carryWeight',
          value: 30,
          duration: -1
        },
        {
          type: 'percentage_modifier',
          target: 'self',
          attribute: 'moveSpeed',
          value: -0.3,
          duration: -1
        }
      ]
    };

    // Learn the skill
    const result = skillSystem.learnSkill(characterId, 'carrier', carrierSkill);
    expect(result.success).toBe(true);

    // Verify the effects were applied
    const derivedStatsAfter = componentManager.getComponent(characterId, DerivedStatsComponentType);
    
    // Carry weight should increase by 30
    expect(derivedStatsAfter!.carryWeight).toBe(initialCarryWeight + 30);
    
    // Move speed should decrease by 30% (100 * -0.3 = -30, so 100 - 30 = 70)
    const expectedMoveSpeed = initialMoveSpeed + (initialMoveSpeed * -0.3);
    expect(derivedStatsAfter!.moveSpeed).toBeCloseTo(expectedMoveSpeed, 1);
  });

  it('should correctly calculate percentage modifier based on current attribute value', () => {
    const characterId = createTestCharacter();
    
    // Set a different initial move speed
    const derivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
    derivedStats!.moveSpeed = 200;
    const initialMoveSpeed = 200;

    // Define Carrier skill
    const carrierSkill: Partial<Skill> = {
      id: 'carrier',
      name: '搬运者',
      type: 'passive',
      level: 1,
      maxLevel: 1,
      manaCost: 0,
      cooldown: 0,
      effects: [
        {
          type: 'percentage_modifier',
          target: 'self',
          attribute: 'moveSpeed',
          value: -0.3,
          duration: -1
        }
      ]
    };

    // Learn the skill
    skillSystem.learnSkill(characterId, 'carrier', carrierSkill);

    // Verify the percentage is calculated correctly
    const derivedStatsAfter = componentManager.getComponent(characterId, DerivedStatsComponentType);
    
    // 200 * -0.3 = -60, so 200 - 60 = 140
    const expectedMoveSpeed = initialMoveSpeed + (initialMoveSpeed * -0.3);
    expect(derivedStatsAfter!.moveSpeed).toBeCloseTo(expectedMoveSpeed, 1);
  });
});
