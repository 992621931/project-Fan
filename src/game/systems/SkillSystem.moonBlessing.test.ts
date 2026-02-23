/**
 * Unit tests for Moon Blessing skill (月之祝福)
 * Tests the conditional_bonus system with time-of-day conditions
 * **Validates: Requirements 7.2, 7.3, 7.4**
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
  CharacterInfoComponentType
} from '../components/CharacterComponents';
import { SkillType, CharacterStatus } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

describe('Moon Blessing Skill Tests', () => {
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
  function createTestCharacter(baseAttack: number = 100, baseDefense: number = 50): string {
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
      attack: baseAttack,
      defense: baseDefense,
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

    const skillComponent: SkillComponent = {
      type: 'skill',
      skills: [],
      passiveSkills: [],
      activeSkills: [],
      jobSkills: [],
      badgeSkills: []
    };

    const characterInfo: CharacterInfoComponent = {
      type: 'characterInfo',
      title: 'Test',
      name: 'Test Character',
      isSpecial: false,
      rarity: RarityType.Common,
      status: CharacterStatus.Available
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
    componentManager.addComponent(character, SkillComponentType, skillComponent);
    componentManager.addComponent(character, CharacterInfoComponentType, characterInfo);
    componentManager.addComponent(character, CurrencyComponentType, currency);

    return character;
  }

  /**
   * Helper function to learn moon_blessing skill
   */
  function learnMoonBlessing(characterId: string): any {
    const moonBlessingSkill: Partial<Skill> = {
      id: 'moon_blessing',
      name: '月之祝福',
      description: '在夜晚获得月亮的祝福，攻击力+15%，防御力+10。',
      type: SkillType.Passive,
      level: 1,
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
            value: 'night'
          }
        },
        {
          type: 'conditional_bonus',
          target: 'self',
          attribute: 'defense',
          value: 10,
          duration: -1,
          condition: {
            type: 'time_of_day',
            value: 'night'
          }
        }
      ]
    };

    return skillSystem.learnSkill(characterId, 'moon_blessing', moonBlessingSkill);
  }

  it('should increase attack by 15% and defense by 10 during night', () => {
    // Arrange
    const baseAttack = 100;
    const baseDefense = 50;
    const character = createTestCharacter(baseAttack, baseDefense);
    
    // Verify initial state
    let derivedStats = componentManager.getComponent(character, DerivedStatsComponentType) as DerivedStatsComponent;
    expect(derivedStats).not.toBeNull();
    expect(derivedStats.attack).toBe(baseAttack);
    expect(derivedStats.defense).toBe(baseDefense);
    
    // Learn the skill
    learnMoonBlessing(character);
    
    // Set time to night
    skillSystem.setTimeOfDay('night');
    
    // Act - trigger update to apply conditional bonuses
    skillSystem.update(0);
    
    // Assert
    derivedStats = componentManager.getComponent(character, DerivedStatsComponentType) as DerivedStatsComponent;
    expect(derivedStats).not.toBeNull();
    
    // Attack should be increased by 15%
    const expectedAttack = baseAttack + (baseAttack * 0.15);
    expect(derivedStats.attack).toBe(expectedAttack);
    
    // Defense should be increased by 10
    const expectedDefense = baseDefense + 10;
    expect(derivedStats.defense).toBe(expectedDefense);
  });

  it('should remove bonuses during day', () => {
    // Arrange
    const baseAttack = 100;
    const baseDefense = 50;
    const character = createTestCharacter(baseAttack, baseDefense);
    
    // Learn the skill
    learnMoonBlessing(character);
    
    // Set time to night first to apply bonuses
    skillSystem.setTimeOfDay('night');
    skillSystem.update(0);
    
    // Verify bonuses are applied
    let derivedStats = componentManager.getComponent(character, DerivedStatsComponentType) as DerivedStatsComponent;
    expect(derivedStats.attack).toBe(baseAttack + (baseAttack * 0.15));
    expect(derivedStats.defense).toBe(baseDefense + 10);
    
    // Act - change time to day
    skillSystem.setTimeOfDay('day');
    skillSystem.update(0);
    
    // Assert - bonuses should be removed
    derivedStats = componentManager.getComponent(character, DerivedStatsComponentType) as DerivedStatsComponent;
    expect(derivedStats.attack).toBe(baseAttack);
    expect(derivedStats.defense).toBe(baseDefense);
  });

  it('should correctly toggle bonuses when time changes multiple times', () => {
    // Arrange
    const baseAttack = 100;
    const baseDefense = 50;
    const character = createTestCharacter(baseAttack, baseDefense);
    
    learnMoonBlessing(character);
    
    // Act & Assert - cycle through day/night multiple times
    
    // Night 1
    skillSystem.setTimeOfDay('night');
    skillSystem.update(0);
    let derivedStats = componentManager.getComponent(character, DerivedStatsComponentType) as DerivedStatsComponent;
    expect(derivedStats.attack).toBe(115);
    expect(derivedStats.defense).toBe(60);
    
    // Day 1
    skillSystem.setTimeOfDay('day');
    skillSystem.update(0);
    derivedStats = componentManager.getComponent(character, DerivedStatsComponentType) as DerivedStatsComponent;
    expect(derivedStats.attack).toBe(100);
    expect(derivedStats.defense).toBe(50);
    
    // Night 2
    skillSystem.setTimeOfDay('night');
    skillSystem.update(0);
    derivedStats = componentManager.getComponent(character, DerivedStatsComponentType) as DerivedStatsComponent;
    expect(derivedStats.attack).toBe(115);
    expect(derivedStats.defense).toBe(60);
    
    // Day 2
    skillSystem.setTimeOfDay('day');
    skillSystem.update(0);
    derivedStats = componentManager.getComponent(character, DerivedStatsComponentType) as DerivedStatsComponent;
    expect(derivedStats.attack).toBe(100);
    expect(derivedStats.defense).toBe(50);
  });

  it('should work with different base attack values', () => {
    // Test with various base attack values to ensure percentage calculation is correct
    const testCases = [
      { baseAttack: 50, baseDefense: 30 },
      { baseAttack: 200, baseDefense: 100 },
      { baseAttack: 75, baseDefense: 45 }
    ];

    testCases.forEach(({ baseAttack, baseDefense }) => {
      const character = createTestCharacter(baseAttack, baseDefense);
      learnMoonBlessing(character);
      
      // Night
      skillSystem.setTimeOfDay('night');
      skillSystem.update(0);
      
      const derivedStats = componentManager.getComponent(character, DerivedStatsComponentType) as DerivedStatsComponent;
      const expectedAttack = baseAttack + (baseAttack * 0.15);
      const expectedDefense = baseDefense + 10;
      
      expect(derivedStats.attack).toBe(expectedAttack);
      expect(derivedStats.defense).toBe(expectedDefense);
    });
  });

  it('should emit conditional_bonus_applied event when night starts', () => {
    // Arrange
    const character = createTestCharacter(100, 50);
    learnMoonBlessing(character);
    
    let appliedEvents: any[] = [];
    eventSystem.on('conditional_bonus_applied', (event) => {
      appliedEvents.push(event);
    });
    
    // Act
    skillSystem.setTimeOfDay('night');
    skillSystem.update(0);
    
    // Assert
    expect(appliedEvents.length).toBe(2); // One for attack, one for defense
    
    const attackEvent = appliedEvents.find(e => e.attribute === 'attack');
    const defenseEvent = appliedEvents.find(e => e.attribute === 'defense');
    
    expect(attackEvent).toBeDefined();
    expect(attackEvent.skillId).toBe('moon_blessing');
    expect(attackEvent.value).toBe(15); // 15% of 100
    
    expect(defenseEvent).toBeDefined();
    expect(defenseEvent.skillId).toBe('moon_blessing');
    expect(defenseEvent.value).toBe(10);
  });

  it('should emit conditional_bonus_removed event when day starts', () => {
    // Arrange
    const character = createTestCharacter(100, 50);
    learnMoonBlessing(character);
    
    // Apply bonuses first
    skillSystem.setTimeOfDay('night');
    skillSystem.update(0);
    
    let removedEvents: any[] = [];
    eventSystem.on('conditional_bonus_removed', (event) => {
      removedEvents.push(event);
    });
    
    // Act
    skillSystem.setTimeOfDay('day');
    skillSystem.update(0);
    
    // Assert
    expect(removedEvents.length).toBe(2); // One for attack, one for defense
    
    const attackEvent = removedEvents.find(e => e.attribute === 'attack');
    const defenseEvent = removedEvents.find(e => e.attribute === 'defense');
    
    expect(attackEvent).toBeDefined();
    expect(attackEvent.skillId).toBe('moon_blessing');
    
    expect(defenseEvent).toBeDefined();
    expect(defenseEvent.skillId).toBe('moon_blessing');
  });
});
