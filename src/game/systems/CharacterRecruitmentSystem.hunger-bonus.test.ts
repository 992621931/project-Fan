/**
 * Unit tests for Character Recruitment System - Hunger Bonus Feature
 * Tests the hunger bonus mechanism for newly recruited adventurers and otherworld characters
 * Validates Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.3, 4.2, 4.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CharacterRecruitmentSystem } from './CharacterRecruitmentSystem';
import { AttributeSystem } from './AttributeSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { 
  CurrencyComponent, 
  CurrencyComponentType,
  InventoryComponent,
  InventoryComponentType
} from '../components/SystemComponents';
import {
  HungerComponentType
} from '../components/CharacterComponents';
import { RecruitmentType } from '../types/GameTypes';
import { DEFAULT_CURRENCY } from '../types/CurrencyTypes';

describe('Character Recruitment System - Hunger Bonus Unit Tests', () => {
  let recruitmentSystem: CharacterRecruitmentSystem;
  let attributeSystem: AttributeSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;
  let playerId: string;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    
    recruitmentSystem = new CharacterRecruitmentSystem();
    attributeSystem = new AttributeSystem();
    
    recruitmentSystem.initialize(entityManager, componentManager, eventSystem);
    attributeSystem.initialize(entityManager, componentManager, eventSystem);

    // Create a test player with currency and inventory
    const playerEntity = entityManager.createEntity();
    playerId = playerEntity.id;
    
    const currency: CurrencyComponent = {
      type: 'currency',
      amounts: { ...DEFAULT_CURRENCY, gold: 100000 }, // Plenty of gold for testing
      transactionHistory: []
    };
    
    const inventory: InventoryComponent = {
      type: 'inventory',
      slots: Array(50).fill(null).map(() => ({ item: null, quantity: 0, locked: false })),
      capacity: 50
    };
    
    componentManager.addComponent(playerId, CurrencyComponentType, currency);
    componentManager.addComponent(playerId, InventoryComponentType, inventory);
  });

  /**
   * Test 2.1: 测试饱腹度奖励范围
   * Validates Requirements: 1.1, 2.1, 3.2
   * Generate 100 adventurer characters and verify each has hunger.current in [30, 50] range
   */
  it('should give hunger bonus in range [30, 50] for all recruited characters', () => {
    const characterCount = 100;
    const hungerValues: number[] = [];

    for (let i = 0; i < characterCount; i++) {
      const result = recruitmentSystem.recruitWithGold(playerId);
      
      expect(result.success).toBe(true);
      expect(result.character).toBeDefined();
      
      const characterId = result.character!;
      const hunger = componentManager.getComponent(characterId, HungerComponentType);
      
      expect(hunger).not.toBeNull();
      hungerValues.push(hunger!.current);
      
      // Verify hunger bonus is in [30, 50] range
      expect(hunger!.current).toBeGreaterThanOrEqual(30);
      expect(hunger!.current).toBeLessThanOrEqual(50);
    }

    // Additional verification: ensure we got 100 values
    expect(hungerValues.length).toBe(characterCount);
  });

  /**
   * Test 2.2: 测试饱腹度不超过最大值
   * Validates Requirements: 1.3, 2.3, 4.2
   * Generate multiple characters and verify hunger.current <= hunger.maximum
   */
  it('should ensure current hunger never exceeds maximum hunger', () => {
    const characterCount = 50;

    for (let i = 0; i < characterCount; i++) {
      const result = recruitmentSystem.recruitWithGold(playerId);
      
      expect(result.success).toBe(true);
      const characterId = result.character!;
      const hunger = componentManager.getComponent(characterId, HungerComponentType);
      
      expect(hunger).not.toBeNull();
      
      // Verify current <= maximum
      expect(hunger!.current).toBeLessThanOrEqual(hunger!.maximum);
    }
  });

  /**
   * Test 2.3: 测试最大饱腹度不变
   * Validates Requirements: 1.4, 2.4, 4.3
   * Generate multiple characters and verify hunger.maximum === 100
   */
  it('should maintain maximum hunger at 100 for all characters', () => {
    const characterCount = 50;

    for (let i = 0; i < characterCount; i++) {
      const result = recruitmentSystem.recruitWithGold(playerId);
      
      expect(result.success).toBe(true);
      const characterId = result.character!;
      const hunger = componentManager.getComponent(characterId, HungerComponentType);
      
      expect(hunger).not.toBeNull();
      
      // Verify maximum is always 100
      expect(hunger!.maximum).toBe(100);
    }
  });

  /**
   * Test 2.4: 测试饱腹度奖励的随机性
   * Validates Requirements: 3.1, 3.3
   * Generate 50 characters and verify at least 3 different hunger values (proves randomness)
   */
  it('should generate random hunger bonuses with variety', () => {
    const characterCount = 50;
    const hungerValues = new Set<number>();

    for (let i = 0; i < characterCount; i++) {
      const result = recruitmentSystem.recruitWithGold(playerId);
      
      expect(result.success).toBe(true);
      const characterId = result.character!;
      const hunger = componentManager.getComponent(characterId, HungerComponentType);
      
      expect(hunger).not.toBeNull();
      hungerValues.add(hunger!.current);
    }

    // Verify at least 3 different values (proves randomness)
    expect(hungerValues.size).toBeGreaterThanOrEqual(3);
  });

  /**
   * Additional test: Verify hunger bonus applies to otherworld characters
   * Validates Requirements: 2.1, 2.2, 2.3
   */
  it('should apply hunger bonus to otherworld characters recruited with special items', () => {
    const recruitmentTypes = [
      RecruitmentType.RareTicket,
      RecruitmentType.EpicTicket,
      RecruitmentType.LegendaryTicket
    ];

    for (const recruitmentType of recruitmentTypes) {
      const result = recruitmentSystem.recruitWithItem(playerId, recruitmentType);
      
      expect(result.success).toBe(true);
      const characterId = result.character!;
      const hunger = componentManager.getComponent(characterId, HungerComponentType);
      
      expect(hunger).not.toBeNull();
      
      // Verify hunger bonus is in [30, 50] range
      expect(hunger!.current).toBeGreaterThanOrEqual(30);
      expect(hunger!.current).toBeLessThanOrEqual(50);
      
      // Verify current <= maximum
      expect(hunger!.current).toBeLessThanOrEqual(hunger!.maximum);
      
      // Verify maximum is 100
      expect(hunger!.maximum).toBe(100);
    }
  });
});
