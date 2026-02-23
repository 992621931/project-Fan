/**
 * Unit tests for Configuration Manager
 * Tests basic configuration loading and validation functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigManager } from './ConfigManager';
import { GameConfig } from './ConfigTypes';
import { RarityType } from '../types/RarityTypes';
import { JobType, ItemType } from '../types/GameTypes';

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    // Get a fresh instance for each test
    configManager = ConfigManager.getInstance();
  });

  it('should initialize with default configuration', async () => {
    await configManager.initialize();
    
    expect(configManager.isInitialized()).toBe(true);
    
    const config = configManager.getConfig();
    expect(config.version).toBe('1.0.0');
    expect(config.characters).toBeDefined();
    expect(config.items).toBeDefined();
    expect(config.jobs).toBeDefined();
  });

  it('should initialize with custom configuration', async () => {
    const customConfig: GameConfig = {
      version: '2.0.0',
      characters: [
        {
          id: 'test_char',
          name: '测试角色',
          title: '测试',
          rarity: RarityType.Rare,
          isSpecial: true,
          baseAttributes: {
            strength: 15,
            agility: 12,
            wisdom: 10,
            technique: 8
          },
          startingJob: JobType.Mage,
          availableJobs: [JobType.Mage, JobType.Wizard],
          description: '用于测试的角色'
        }
      ],
      items: [
        {
          id: 'test_item',
          name: '测试物品',
          description: '用于测试的物品',
          type: ItemType.Equipment,
          rarity: RarityType.Epic,
          stackSize: 1,
          baseValue: 100
        }
      ],
      recipes: [],
      dungeons: [],
      jobs: [
        {
          id: JobType.Mage,
          name: '法师',
          description: '魔法职业',
          attributeGrowth: {
            strength: 1,
            agility: 2,
            wisdom: 4,
            technique: 1
          },
          skills: [],
          unlockConditions: [],
          workTypes: []
        }
      ],
      skills: [],
      achievements: [],
      shops: [],
      crops: [],
      exclusiveSkills: [],
      otherworldCharacters: []
    };

    await configManager.initialize(customConfig);
    
    expect(configManager.isInitialized()).toBe(true);
    
    const config = configManager.getConfig();
    expect(config.version).toBe('2.0.0');
    expect(config.characters).toHaveLength(1);
    expect(config.characters[0].name).toBe('测试角色');
  });

  it('should retrieve character by ID', async () => {
    await configManager.initialize();
    
    const character = configManager.getCharacter('starter_warrior');
    expect(character).not.toBeNull();
    expect(character?.name).toBe('新手战士');
    expect(character?.rarity).toBe(RarityType.Common);
  });

  it('should retrieve characters by rarity', async () => {
    await configManager.initialize();
    
    const commonCharacters = configManager.getCharactersByRarity(RarityType.Common);
    expect(commonCharacters).toHaveLength(1);
    expect(commonCharacters[0].name).toBe('新手战士');
    
    const rareCharacters = configManager.getCharactersByRarity(RarityType.Rare);
    expect(rareCharacters).toHaveLength(0);
  });

  it('should retrieve item by ID', async () => {
    await configManager.initialize();
    
    const item = configManager.getItem('basic_sword');
    expect(item).not.toBeNull();
    expect(item?.name).toBe('基础剑');
    expect(item?.type).toBe(ItemType.Equipment);
  });

  it('should retrieve items by type', async () => {
    await configManager.initialize();
    
    const equipmentItems = configManager.getItemsByType(ItemType.Equipment);
    expect(equipmentItems).toHaveLength(1);
    expect(equipmentItems[0].name).toBe('基础剑');
  });

  it('should retrieve job by ID', async () => {
    await configManager.initialize();
    
    const job = configManager.getJob(JobType.Warrior);
    expect(job).not.toBeNull();
    expect(job?.name).toBe('战士');
  });

  it('should provide configuration statistics', async () => {
    await configManager.initialize();
    
    const stats = configManager.getStats();
    expect(stats.version).toBe('1.0.0');
    expect(stats.characterCount).toBe(1);
    expect(stats.itemCount).toBe(1);
    expect(stats.jobCount).toBe(1);
    expect(stats.lastLoadTime).toBeGreaterThan(0);
  });

  it('should throw error when not initialized', () => {
    expect(() => configManager.getConfig()).toThrow('ConfigManager not initialized');
    expect(() => configManager.getCharacter('test')).toThrow('ConfigManager not initialized');
    expect(() => configManager.getItem('test')).toThrow('ConfigManager not initialized');
  });

  it('should validate configuration', async () => {
    await configManager.initialize();
    
    const isValid = configManager.validateConfig();
    expect(isValid).toBe(true);
  });

  it('should handle special characters', async () => {
    const configWithSpecial: GameConfig = {
      version: '1.0.0',
      characters: [
        {
          id: 'special_char',
          name: '特殊角色',
          title: '传说',
          rarity: RarityType.Legendary,
          isSpecial: true,
          baseAttributes: { strength: 20, agility: 20, wisdom: 20, technique: 20 },
          startingJob: JobType.Paladin,
          availableJobs: [JobType.Paladin],
          description: '特殊的传说角色'
        },
        {
          id: 'normal_char',
          name: '普通角色',
          title: '普通',
          rarity: RarityType.Common,
          isSpecial: false,
          baseAttributes: { strength: 10, agility: 10, wisdom: 10, technique: 10 },
          startingJob: JobType.Warrior,
          availableJobs: [JobType.Warrior],
          description: '普通角色'
        }
      ],
      items: [],
      recipes: [],
      dungeons: [],
      jobs: [
        {
          id: JobType.Paladin,
          name: '圣骑士',
          description: '圣骑士职业',
          attributeGrowth: { strength: 3, agility: 2, wisdom: 2, technique: 1 },
          skills: [],
          unlockConditions: [],
          workTypes: []
        },
        {
          id: JobType.Warrior,
          name: '战士',
          description: '战士职业',
          attributeGrowth: { strength: 3, agility: 2, wisdom: 1, technique: 2 },
          skills: [],
          unlockConditions: [],
          workTypes: []
        }
      ],
      skills: [],
      achievements: [],
      shops: [],
      crops: [],
      exclusiveSkills: [],
      otherworldCharacters: []
    };

    await configManager.initialize(configWithSpecial);
    
    const specialCharacters = configManager.getSpecialCharacters();
    expect(specialCharacters).toHaveLength(1);
    expect(specialCharacters[0].name).toBe('特殊角色');
    expect(specialCharacters[0].isSpecial).toBe(true);
  });
});