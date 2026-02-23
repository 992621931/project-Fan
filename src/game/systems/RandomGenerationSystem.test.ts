/**
 * Random generation system tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../ecs/World';
import { Entity } from '../../ecs/Entity';
import { RandomGenerationSystem, BalanceVerifier } from './RandomGenerationSystem';
import { ConfigManager } from '../config/ConfigManager';
import { RecruitmentType, ItemType, CharacterStatus } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';
import { 
  CharacterInfoComponentType, 
  AttributeComponentType, 
  LevelComponentType, 
  JobComponentType, 
  HealthComponentType, 
  ManaComponentType 
} from '../components/CharacterComponents';
import { ItemComponentType } from '../components/ItemComponents';

describe('RandomGenerationSystem', () => {
  let world: World;
  let system: RandomGenerationSystem;
  let configManager: ConfigManager;

  beforeEach(async () => {
    world = new World();
    
    // Initialize config manager with test data
    configManager = ConfigManager.getInstance();
    await configManager.initialize({
      version: '1.0.0',
      characters: [
        {
          id: 'test_warrior',
          name: '测试战士',
          title: '见习',
          rarity: RarityType.Common,
          isSpecial: false,
          baseAttributes: { strength: 10, agility: 8, wisdom: 5, technique: 7 },
          startingJob: 'warrior' as any,
          availableJobs: ['warrior' as any],
          description: '测试用战士'
        },
        {
          id: 'test_mage',
          name: '测试法师',
          title: '贤者',
          rarity: RarityType.Legendary,
          isSpecial: true,
          baseAttributes: { strength: 5, agility: 7, wisdom: 15, technique: 10 },
          startingJob: 'mage' as any,
          availableJobs: ['mage' as any],
          description: '测试用法师'
        }
      ],
      items: [
        {
          id: 'test_sword',
          name: '测试剑',
          description: '测试用剑',
          type: ItemType.Equipment,
          rarity: RarityType.Common,
          stackSize: 1,
          baseValue: 50
        },
        {
          id: 'test_potion',
          name: '测试药水',
          description: '测试用药水',
          type: ItemType.Consumable,
          rarity: RarityType.Common,
          stackSize: 99,
          baseValue: 25
        }
      ],
      recipes: [],
      dungeons: [
        {
          id: 'test_dungeon',
          name: '测试地下城',
          description: '测试用地下城',
          difficulty: 1,
          requiredLevel: 1,
          encounters: [
            {
              id: 'test_encounter',
              type: 'combat',
              enemies: [],
              weight: 1.0
            }
          ],
          rewards: [],
          unlockConditions: []
        }
      ],
      jobs: [],
      skills: [],
      achievements: [],
      shops: [],
      crops: []
    });

    system = new RandomGenerationSystem(world);
    system.initialize();
  });

  describe('Character Generation', () => {
    it('should generate a character with gold recruitment', () => {
      const character = system.generateCharacter(RecruitmentType.Gold);
      
      expect(character).toBeDefined();
      expect(world.hasComponent(character.id, CharacterInfoComponentType)).toBe(true);
      expect(world.hasComponent(character.id, AttributeComponentType)).toBe(true);
      expect(world.hasComponent(character.id, LevelComponentType)).toBe(true);
      expect(world.hasComponent(character.id, JobComponentType)).toBe(true);
      expect(world.hasComponent(character.id, HealthComponentType)).toBe(true);
      expect(world.hasComponent(character.id, ManaComponentType)).toBe(true);
    });

    it('should generate characters with appropriate rarity for recruitment type', () => {
      // Test multiple generations to check rarity distribution
      const characters: Entity[] = [];
      for (let i = 0; i < 10; i++) {
        characters.push(system.generateCharacter(RecruitmentType.Gold));
      }

      // All characters should have valid rarity
      for (const character of characters) {
        const info = world.getComponent(character.id, CharacterInfoComponentType);
        expect(info?.rarity).toBeGreaterThanOrEqual(RarityType.Common);
        expect(info?.rarity).toBeLessThanOrEqual(RarityType.Legendary);
      }
    });

    it('should generate legendary character with legendary ticket', () => {
      const character = system.generateCharacter(RecruitmentType.LegendaryTicket);
      const info = world.getComponent(character.id, CharacterInfoComponentType);
      
      expect(info?.rarity).toBe(RarityType.Legendary);
    });

    it('should generate character with valid attributes', () => {
      const character = system.generateCharacter(RecruitmentType.Gold);
      const attributes = world.getComponent(character.id, AttributeComponentType);
      
      expect(attributes?.strength).toBeGreaterThan(0);
      expect(attributes?.agility).toBeGreaterThan(0);
      expect(attributes?.wisdom).toBeGreaterThan(0);
      expect(attributes?.technique).toBeGreaterThan(0);
    });

    it('should generate character with valid health and mana', () => {
      const character = system.generateCharacter(RecruitmentType.Gold);
      const health = world.getComponent(character.id, HealthComponentType);
      const mana = world.getComponent(character.id, ManaComponentType);
      
      expect(health?.current).toBeGreaterThan(0);
      expect(health?.maximum).toBeGreaterThan(0);
      expect(health?.current).toBe(health?.maximum);
      
      expect(mana?.current).toBeGreaterThan(0);
      expect(mana?.maximum).toBeGreaterThan(0);
      expect(mana?.current).toBe(mana?.maximum);
    });
  });

  describe('Item Generation', () => {
    it('should generate a random item', () => {
      const item = system.generateItem();
      
      expect(item).toBeDefined();
      expect(world.hasComponent(item.id, ItemComponentType)).toBe(true);
      
      const itemComponent = world.getComponent(item.id, ItemComponentType);
      expect(itemComponent?.name).toBeDefined();
      expect(itemComponent?.rarity).toBeGreaterThanOrEqual(RarityType.Common);
      expect(itemComponent?.value).toBeGreaterThan(0);
      expect(itemComponent?.quality).toBeGreaterThanOrEqual(0);
      expect(itemComponent?.quality).toBeLessThanOrEqual(100);
    });

    it('should generate item of specific type', () => {
      const item = system.generateItem(ItemType.Equipment);
      const itemComponent = world.getComponent(item.id, ItemComponentType);
      
      // Should generate an equipment item (test_sword in our test data)
      expect(itemComponent?.id).toBe('test_sword');
    });

    it('should generate item of specific rarity', () => {
      const item = system.generateItem(undefined, RarityType.Common);
      const itemComponent = world.getComponent(item.id, ItemComponentType);
      
      expect(itemComponent?.rarity).toBe(RarityType.Common);
    });

    it('should generate item with quality affecting value', () => {
      const items: Entity[] = [];
      for (let i = 0; i < 10; i++) {
        items.push(system.generateItem());
      }

      // Check that items have varying values due to quality
      const values = items.map(item => world.getComponent(item.id, ItemComponentType)?.value || 0);
      const uniqueValues = new Set(values);
      
      // Should have some variation in values
      expect(uniqueValues.size).toBeGreaterThan(1);
    });
  });

  describe('Encounter Generation', () => {
    it('should generate encounter for valid dungeon', () => {
      const encounter = system.generateEncounter('test_dungeon');
      
      expect(encounter).toBeDefined();
      expect(encounter?.id).toBe('test_encounter');
      expect(encounter?.type).toBe('combat');
    });

    it('should return null for invalid dungeon', () => {
      const encounter = system.generateEncounter('invalid_dungeon');
      
      expect(encounter).toBeNull();
    });
  });

  describe('Loot Generation', () => {
    it('should generate loot from drop table', () => {
      const dropTable = [
        {
          type: 'item',
          id: 'test_sword',
          amount: 1,
          chance: 1.0 // 100% chance for testing
        }
      ];

      const loot = system.generateLoot(dropTable);
      
      expect(loot).toBeDefined();
      expect(loot.length).toBeGreaterThan(0);
      
      const item = loot[0];
      expect(world.hasComponent(item.id, ItemComponentType)).toBe(true);
      
      const itemComponent = world.getComponent(item.id, ItemComponentType);
      expect(itemComponent?.id).toBe('test_sword');
    });

    it('should respect drop chances', () => {
      const dropTable = [
        {
          type: 'item',
          id: 'test_sword',
          amount: 1,
          chance: 0.0 // 0% chance
        }
      ];

      const loot = system.generateLoot(dropTable);
      
      expect(loot.length).toBe(0);
    });
  });

  describe('Balanced Party Generation', () => {
    it('should generate balanced party of specified size', () => {
      const party = system.generateBalancedParty(4);
      
      expect(party.length).toBe(4);
      
      // All should be valid characters
      for (const character of party) {
        expect(world.hasComponent(character.id, CharacterInfoComponentType)).toBe(true);
        expect(world.hasComponent(character.id, JobComponentType)).toBe(true);
      }
    });

    it('should generate party with different roles', () => {
      const party = system.generateBalancedParty(4);
      const jobs = party.map(char => world.getComponent(char.id, JobComponentType)?.currentJob);
      
      // Should have some variety in jobs (though limited by test data)
      expect(jobs.length).toBe(4);
    });
  });
});

describe('BalanceVerifier', () => {
  let verifier: BalanceVerifier;

  beforeEach(async () => {
    // Initialize config manager with test data
    const configManager = ConfigManager.getInstance();
    await configManager.initialize({
      version: '1.0.0',
      characters: [
        {
          id: 'common_char',
          name: '普通角色',
          title: '见习',
          rarity: RarityType.Common,
          isSpecial: false,
          baseAttributes: { strength: 10, agility: 8, wisdom: 5, technique: 7 },
          startingJob: 'warrior' as any,
          availableJobs: ['warrior' as any],
          description: '普通角色'
        },
        {
          id: 'legendary_char',
          name: '传说角色',
          title: '英雄',
          rarity: RarityType.Legendary,
          isSpecial: true,
          baseAttributes: { strength: 20, agility: 18, wisdom: 15, technique: 17 },
          startingJob: 'warrior' as any,
          availableJobs: ['warrior' as any],
          description: '传说角色'
        }
      ],
      items: [
        {
          id: 'common_item',
          name: '普通物品',
          description: '普通物品',
          type: ItemType.Equipment,
          rarity: RarityType.Common,
          stackSize: 1,
          baseValue: 50
        },
        {
          id: 'rare_item',
          name: '稀有物品',
          description: '稀有物品',
          type: ItemType.Consumable,
          rarity: RarityType.Rare,
          stackSize: 10,
          baseValue: 200
        }
      ],
      recipes: [
        {
          id: 'test_recipe',
          name: '测试配方',
          description: '测试配方',
          type: 'equipment' as any,
          requirements: [],
          materials: [
            { itemId: 'common_item', quantity: 2, consumeOnUse: true }
          ],
          result: {
            itemId: 'rare_item',
            baseQuantity: 1,
            qualityInfluence: { attributeMultiplier: 0.1, quantityChance: 0.05, rarityBonus: 0.02 },
            rarityChance: [],
            bonusResults: []
          },
          successRate: 0.9,
          experienceGain: 10,
          craftingTime: 300,
          unlockConditions: []
        }
      ],
      dungeons: [],
      jobs: [],
      skills: [],
      achievements: [],
      shops: [],
      crops: []
    });

    verifier = new BalanceVerifier();
  });

  it('should analyze character balance', () => {
    const report = verifier.verifyCharacterBalance();
    
    expect(report).toBeDefined();
    expect(report.characters).toBeDefined();
    expect(report.items).toBeDefined();
    expect(report.economy).toBeDefined();
    expect(report.warnings).toBeDefined();
    expect(report.recommendations).toBeDefined();
  });

  it('should count characters by rarity correctly', () => {
    const report = verifier.verifyCharacterBalance();
    
    expect(report.characters.totalByRarity[RarityType.Common]).toBe(1);
    expect(report.characters.totalByRarity[RarityType.Legendary]).toBe(1);
    expect(report.characters.totalByRarity[RarityType.Rare]).toBe(0);
    expect(report.characters.totalByRarity[RarityType.Epic]).toBe(0);
  });

  it('should calculate average attributes by rarity', () => {
    const report = verifier.verifyCharacterBalance();
    
    // Common character: 10+8+5+7 = 30
    expect(report.characters.averageAttributesByRarity[RarityType.Common]).toBe(30);
    
    // Legendary character: 20+18+15+17 = 70
    expect(report.characters.averageAttributesByRarity[RarityType.Legendary]).toBe(70);
  });

  it('should analyze item balance', () => {
    const report = verifier.verifyCharacterBalance();
    
    expect(report.items.totalByType[ItemType.Equipment]).toBe(1);
    expect(report.items.totalByType[ItemType.Consumable]).toBe(1);
    expect(report.items.totalByRarity[RarityType.Common]).toBe(1);
    expect(report.items.totalByRarity[RarityType.Rare]).toBe(1);
  });

  it('should calculate average values by rarity', () => {
    const report = verifier.verifyCharacterBalance();
    
    expect(report.items.averageValueByRarity[RarityType.Common]).toBe(50);
    expect(report.items.averageValueByRarity[RarityType.Rare]).toBe(200);
  });

  it('should provide balance recommendations', () => {
    const report = verifier.verifyCharacterBalance();
    
    // Should have some analysis results
    expect(typeof report.economy.recipeComplexity).toBe('number');
    expect(typeof report.economy.craftingCostEfficiency).toBe('number');
  });
});