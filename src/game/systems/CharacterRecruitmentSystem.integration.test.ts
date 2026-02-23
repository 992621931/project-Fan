/**
 * Integration tests for Character Recruitment System - Hunger Bonus Feature
 * **Feature: adventurer-hunger-bonus**
 * Tests the complete recruitment flow including save/load functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CharacterRecruitmentSystem } from './CharacterRecruitmentSystem';
import { AttributeSystem } from './AttributeSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { SaveSystem } from '../../ecs/SaveSystem';
import { World } from '../../ecs/World';
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

describe('Character Recruitment System Integration Tests - Hunger Bonus', () => {
  let world: World;
  let recruitmentSystem: CharacterRecruitmentSystem;
  let attributeSystem: AttributeSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;
  let playerId: number;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    world = new World();
    
    world.entityManager = entityManager;
    world.componentManager = componentManager;
    world.eventSystem = eventSystem;
    
    recruitmentSystem = new CharacterRecruitmentSystem();
    attributeSystem = new AttributeSystem();
    
    recruitmentSystem.initialize(entityManager, componentManager, eventSystem);
    attributeSystem.initialize(entityManager, componentManager, eventSystem);

    // Create a test player with currency and inventory
    const playerEntity = entityManager.createEntity();
    playerId = playerEntity.id;
    
    const currency: CurrencyComponent = {
      type: 'currency',
      amounts: { ...DEFAULT_CURRENCY, gold: 10000 },
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
   * Task 4.1: 测试金币招募冒险者
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
   */
  describe('4.1 测试金币招募冒险者', () => {
    it('should recruit adventurer with gold and apply hunger bonus in range [30, 50]', () => {
      // Recruit a character using gold
      const result = recruitmentSystem.recruitWithGold(playerId);
      
      // Verify recruitment was successful
      expect(result.success).toBe(true);
      expect(result.character).toBeDefined();
      expect(result.error).toBeUndefined();
      
      const characterId = result.character!;
      
      // Verify character has HungerComponent
      const hunger = componentManager.getComponent(characterId, HungerComponentType);
      expect(hunger).not.toBeNull();
      
      // Verify hunger bonus is in range [30, 50] (Requirement 1.1, 1.2)
      expect(hunger!.current).toBeGreaterThanOrEqual(30);
      expect(hunger!.current).toBeLessThanOrEqual(50);
      
      // Verify current hunger does not exceed maximum (Requirement 1.3)
      expect(hunger!.current).toBeLessThanOrEqual(hunger!.maximum);
      
      // Verify maximum hunger is unchanged at 100 (Requirement 1.4)
      expect(hunger!.maximum).toBe(100);
    });

    it('should apply different hunger bonuses to multiple recruited adventurers', () => {
      const hungerValues = new Set<number>();
      const recruitCount = 20;
      
      for (let i = 0; i < recruitCount; i++) {
        const result = recruitmentSystem.recruitWithGold(playerId);
        expect(result.success).toBe(true);
        
        const characterId = result.character!;
        const hunger = componentManager.getComponent(characterId, HungerComponentType);
        
        expect(hunger).not.toBeNull();
        expect(hunger!.current).toBeGreaterThanOrEqual(30);
        expect(hunger!.current).toBeLessThanOrEqual(50);
        
        hungerValues.add(hunger!.current);
      }
      
      // Verify randomness - should have at least 3 different values (Requirement 1.5)
      expect(hungerValues.size).toBeGreaterThanOrEqual(3);
    });
  });

  /**
   * Task 4.2: 测试特殊道具招募异界角色
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
   */
  describe('4.2 测试特殊道具招募异界角色', () => {
    it('should recruit otherworld character with RareTicket and apply hunger bonus', () => {
      // Recruit a character using RareTicket
      const result = recruitmentSystem.recruitWithItem(playerId, RecruitmentType.RareTicket);
      
      // Verify recruitment was successful
      expect(result.success).toBe(true);
      expect(result.character).toBeDefined();
      expect(result.error).toBeUndefined();
      
      const characterId = result.character!;
      
      // Verify character has HungerComponent
      const hunger = componentManager.getComponent(characterId, HungerComponentType);
      expect(hunger).not.toBeNull();
      
      // Verify hunger bonus is in range [30, 50] (Requirement 2.1, 2.2)
      expect(hunger!.current).toBeGreaterThanOrEqual(30);
      expect(hunger!.current).toBeLessThanOrEqual(50);
      
      // Verify current hunger does not exceed maximum (Requirement 2.3)
      expect(hunger!.current).toBeLessThanOrEqual(hunger!.maximum);
      
      // Verify maximum hunger is unchanged at 100 (Requirement 2.4)
      expect(hunger!.maximum).toBe(100);
    });

    it('should recruit otherworld character with EpicTicket and apply hunger bonus', () => {
      // Recruit a character using EpicTicket
      const result = recruitmentSystem.recruitWithItem(playerId, RecruitmentType.EpicTicket);
      
      // Verify recruitment was successful
      expect(result.success).toBe(true);
      expect(result.character).toBeDefined();
      
      const characterId = result.character!;
      const hunger = componentManager.getComponent(characterId, HungerComponentType);
      
      expect(hunger).not.toBeNull();
      expect(hunger!.current).toBeGreaterThanOrEqual(30);
      expect(hunger!.current).toBeLessThanOrEqual(50);
      expect(hunger!.current).toBeLessThanOrEqual(hunger!.maximum);
      expect(hunger!.maximum).toBe(100);
    });

    it('should recruit otherworld character with LegendaryTicket and apply hunger bonus', () => {
      // Recruit a character using LegendaryTicket
      const result = recruitmentSystem.recruitWithItem(playerId, RecruitmentType.LegendaryTicket);
      
      // Verify recruitment was successful
      expect(result.success).toBe(true);
      expect(result.character).toBeDefined();
      
      const characterId = result.character!;
      const hunger = componentManager.getComponent(characterId, HungerComponentType);
      
      expect(hunger).not.toBeNull();
      expect(hunger!.current).toBeGreaterThanOrEqual(30);
      expect(hunger!.current).toBeLessThanOrEqual(50);
      expect(hunger!.current).toBeLessThanOrEqual(hunger!.maximum);
      expect(hunger!.maximum).toBe(100);
    });

    it('should apply different hunger bonuses to multiple otherworld characters', () => {
      const hungerValues = new Set<number>();
      const recruitCount = 15;
      
      // Test with different recruitment types
      const recruitmentTypes = [
        RecruitmentType.RareTicket,
        RecruitmentType.EpicTicket,
        RecruitmentType.LegendaryTicket
      ];
      
      for (let i = 0; i < recruitCount; i++) {
        const recruitmentType = recruitmentTypes[i % recruitmentTypes.length];
        const result = recruitmentSystem.recruitWithItem(playerId, recruitmentType);
        expect(result.success).toBe(true);
        
        const characterId = result.character!;
        const hunger = componentManager.getComponent(characterId, HungerComponentType);
        
        expect(hunger).not.toBeNull();
        expect(hunger!.current).toBeGreaterThanOrEqual(30);
        expect(hunger!.current).toBeLessThanOrEqual(50);
        
        hungerValues.add(hunger!.current);
      }
      
      // Verify randomness - should have at least 3 different values (Requirement 2.5)
      expect(hungerValues.size).toBeGreaterThanOrEqual(3);
    });
  });

  /**
   * Task 4.3: 测试存档和读档
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4
   */
  describe('4.3 测试存档和读档', () => {
    it('should preserve hunger values after save and load', () => {
      // Recruit a character
      const result = recruitmentSystem.recruitWithGold(playerId);
      expect(result.success).toBe(true);
      
      const characterId = result.character!;
      const hungerBefore = componentManager.getComponent(characterId, HungerComponentType);
      expect(hungerBefore).not.toBeNull();
      
      // Record the hunger values before save
      const currentBefore = hungerBefore!.current;
      const maximumBefore = hungerBefore!.maximum;
      
      // Verify hunger bonus was applied
      expect(currentBefore).toBeGreaterThanOrEqual(30);
      expect(currentBefore).toBeLessThanOrEqual(50);
      expect(maximumBefore).toBe(100);
      
      // Save the game state (Requirement 6.1)
      const saveKey = 'test_hunger_bonus_save';
      const saveSuccess = SaveSystem.saveToLocalStorage(world, saveKey);
      expect(saveSuccess).toBe(true);
      
      // Load the game state (Requirement 6.2)
      const loadedWorld = SaveSystem.loadFromLocalStorage(saveKey);
      expect(loadedWorld).not.toBeNull();
      
      // Verify the character still exists in loaded world
      const loadedComponentManager = loadedWorld!.componentManager;
      const hungerAfter = loadedComponentManager.getComponent(characterId, HungerComponentType);
      expect(hungerAfter).not.toBeNull();
      
      // Verify hunger values are preserved (Requirement 6.3, 6.4)
      expect(hungerAfter!.current).toBe(currentBefore);
      expect(hungerAfter!.maximum).toBe(maximumBefore);
      
      // Clean up
      SaveSystem.deleteSave(saveKey);
    });

    it('should preserve hunger values for multiple characters after save and load', () => {
      // Recruit multiple characters
      const characterCount = 5;
      const characterData: Array<{ id: number; current: number; maximum: number }> = [];
      
      for (let i = 0; i < characterCount; i++) {
        const result = recruitmentSystem.recruitWithGold(playerId);
        expect(result.success).toBe(true);
        
        const characterId = result.character!;
        const hunger = componentManager.getComponent(characterId, HungerComponentType);
        expect(hunger).not.toBeNull();
        
        characterData.push({
          id: characterId,
          current: hunger!.current,
          maximum: hunger!.maximum
        });
      }
      
      // Save the game state
      const saveKey = 'test_hunger_bonus_multiple_save';
      const saveSuccess = SaveSystem.saveToLocalStorage(world, saveKey);
      expect(saveSuccess).toBe(true);
      
      // Load the game state
      const loadedWorld = SaveSystem.loadFromLocalStorage(saveKey);
      expect(loadedWorld).not.toBeNull();
      
      // Verify all characters have preserved hunger values
      const loadedComponentManager = loadedWorld!.componentManager;
      for (const data of characterData) {
        const hungerAfter = loadedComponentManager.getComponent(data.id, HungerComponentType);
        expect(hungerAfter).not.toBeNull();
        expect(hungerAfter!.current).toBe(data.current);
        expect(hungerAfter!.maximum).toBe(data.maximum);
      }
      
      // Clean up
      SaveSystem.deleteSave(saveKey);
    });

    it('should not affect existing characters in save files', () => {
      // This test verifies Requirement 6.1: Existing characters in save files 
      // SHALL NOT be affected by this change
      
      // Create a character and manually set hunger to a specific value
      // to simulate an "existing" character from before the feature
      const result = recruitmentSystem.recruitWithGold(playerId);
      expect(result.success).toBe(true);
      
      const characterId = result.character!;
      const hunger = componentManager.getComponent(characterId, HungerComponentType);
      expect(hunger).not.toBeNull();
      
      // Manually set hunger to simulate an old save (e.g., 0 hunger)
      hunger!.current = 0;
      
      // Save the game state
      const saveKey = 'test_hunger_bonus_existing_save';
      const saveSuccess = SaveSystem.saveToLocalStorage(world, saveKey);
      expect(saveSuccess).toBe(true);
      
      // Load the game state
      const loadedWorld = SaveSystem.loadFromLocalStorage(saveKey);
      expect(loadedWorld).not.toBeNull();
      
      // Verify the manually set hunger value is preserved (not modified)
      const loadedComponentManager = loadedWorld!.componentManager;
      const hungerAfter = loadedComponentManager.getComponent(characterId, HungerComponentType);
      expect(hungerAfter).not.toBeNull();
      expect(hungerAfter!.current).toBe(0); // Should remain 0, not get bonus
      
      // Clean up
      SaveSystem.deleteSave(saveKey);
    });
  });
});
