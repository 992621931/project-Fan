/**
 * Configuration manager
 * High-level interface for managing game configuration
 */

import { ConfigLoader, ConfigLoadError } from './ConfigLoader';
import { GameConfig, CharacterConfig, ItemConfig, ExclusiveSkillConfig, OtherworldCharacterConfig } from './ConfigTypes';
import { Recipe } from '../types/RecipeTypes';
import { RarityType } from '../types/RarityTypes';
import { JobType, ItemType } from '../types/GameTypes';

/**
 * Configuration manager class - provides high-level access to game configuration
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private loader: ConfigLoader;
  private initialized: boolean = false;

  private constructor() {
    this.loader = ConfigLoader.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Initialize configuration manager
   */
  public async initialize(configSource?: string | object): Promise<void> {
    try {
      if (configSource) {
        await this.loader.loadConfig(configSource);
      } else {
        // Load default configuration or from default path
        await this.loadDefaultConfig();
      }
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize ConfigManager: ${error}`);
    }
  }

  /**
   * Check if manager is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && this.loader.isLoaded();
  }

  /**
   * Get full configuration
   */
  public getConfig(): GameConfig {
    this.ensureInitialized();
    return this.loader.getConfig();
  }

  /**
   * Get character configuration by ID
   */
  public getCharacter(id: string): CharacterConfig | null {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.characters.find(char => char.id === id) || null;
  }

  /**
   * Get all characters by rarity
   */
  public getCharactersByRarity(rarity: RarityType): CharacterConfig[] {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.characters.filter(char => char.rarity === rarity);
  }

  /**
   * Get all special characters
   */
  public getSpecialCharacters(): CharacterConfig[] {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.characters.filter(char => char.isSpecial);
  }

  /**
   * Get item configuration by ID
   */
  public getItem(id: string): ItemConfig | null {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.items.find(item => item.id === id) || null;
  }

  /**
   * Get all items by type
   */
  public getItemsByType(type: ItemType): ItemConfig[] {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.items.filter(item => item.type === type);
  }

  /**
   * Get all items by rarity
   */
  public getItemsByRarity(rarity: RarityType): ItemConfig[] {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.items.filter(item => item.rarity === rarity);
  }

  /**
   * Get recipe configuration by ID
   */
  public getRecipe(id: string): Recipe | null {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.recipes.find(recipe => recipe.id === id) || null;
  }

  /**
   * Get all recipes by type
   */
  public getRecipesByType(type: string): Recipe[] {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.recipes.filter(recipe => recipe.type === type);
  }

  /**
   * Get job configuration by ID
   */
  public getJob(id: JobType): any {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.jobs.find(job => job.id === id) || null;
  }

  /**
   * Get skill configuration by ID
   */
  public getSkill(id: string): any {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.skills.find(skill => skill.id === id) || null;
  }

  /**
   * Get dungeon configuration by ID
   */
  public getDungeon(id: string): any {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.dungeons.find(dungeon => dungeon.id === id) || null;
  }

  /**
   * Get achievement configuration by ID
   */
  public getAchievement(id: string): any {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.achievements?.find(achievement => achievement.id === id) || null;
  }

  /**
   * Get shop configuration by ID
   */
  public getShop(id: string): any {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.shops?.find(shop => shop.id === id) || null;
  }

  /**
   * Get crop configuration by ID
   */
  public getCrop(id: string): any {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.crops?.find(crop => crop.id === id) || null;
  }

  /**
   * Get all exclusive skills
   */
  public getExclusiveSkills(): ExclusiveSkillConfig[] {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.exclusiveSkills || [];
  }

  /**
   * Get exclusive skill by ID
   */
  public getExclusiveSkillById(id: string): ExclusiveSkillConfig | null {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.exclusiveSkills?.find(skill => skill.id === id) || null;
  }

  /**
   * Get all otherworld characters
   */
  public getOtherworldCharacters(): OtherworldCharacterConfig[] {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.otherworldCharacters || [];
  }

  /**
   * Get otherworld character by ID
   */
  public getOtherworldCharacterById(id: string): OtherworldCharacterConfig | null {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    return config.otherworldCharacters?.find(character => character.id === id) || null;
  }

  /**
   * Reload configuration
   */
  public async reload(): Promise<void> {
    try {
      await this.loader.reloadConfig();
    } catch (error) {
      throw new Error(`Failed to reload configuration: ${error}`);
    }
  }

  /**
   * Add configuration change watcher
   */
  public addWatcher(id: string, callback: () => void): void {
    this.loader.addWatcher(id, callback);
  }

  /**
   * Remove configuration change watcher
   */
  public removeWatcher(id: string): void {
    this.loader.removeWatcher(id);
  }

  /**
   * Get configuration statistics
   */
  public getStats(): ConfigStats {
    this.ensureInitialized();
    const config = this.loader.getConfig();
    
    return {
      version: config.version,
      lastLoadTime: this.loader.getLastLoadTime(),
      characterCount: config.characters.length,
      itemCount: config.items.length,
      recipeCount: config.recipes.length,
      dungeonCount: config.dungeons.length,
      jobCount: config.jobs.length,
      skillCount: config.skills.length,
      achievementCount: config.achievements?.length || 0,
      shopCount: config.shops?.length || 0,
      cropCount: config.crops?.length || 0,
      exclusiveSkillCount: config.exclusiveSkills?.length || 0,
      otherworldCharacterCount: config.otherworldCharacters?.length || 0,
    };
  }

  /**
   * Validate current configuration
   */
  public validateConfig(): boolean {
    this.ensureInitialized();
    // Configuration is already validated during loading
    return true;
  }

  /**
   * Load default configuration
   */
  private async loadDefaultConfig(): Promise<void> {
    // In a real implementation, this would load from a default config file
    // For now, we'll create a minimal default configuration
    const defaultConfig: GameConfig = {
      version: '1.0.0',
      characters: [
        {
          id: 'starter_warrior',
          name: '新手战士',
          title: '见习',
          rarity: RarityType.Common,
          isSpecial: false,
          baseAttributes: {
            strength: 10,
            agility: 8,
            wisdom: 5,
            technique: 7
          },
          startingJob: JobType.Warrior,
          availableJobs: [JobType.Warrior],
          description: '一个刚开始冒险的新手战士'
        }
      ],
      items: [
        {
          id: 'basic_sword',
          name: '基础剑',
          description: '一把普通的铁剑',
          type: ItemType.Equipment,
          rarity: RarityType.Common,
          stackSize: 1,
          baseValue: 50,
          equipmentSlot: 'weapon',
          attributeModifiers: [
            {
              attribute: 'attack',
              value: 10,
              type: 'flat'
            }
          ]
        }
      ],
      recipes: [],
      dungeons: [],
      jobs: [
        {
          id: JobType.Warrior,
          name: '战士',
          description: '近战物理职业',
          attributeGrowth: {
            strength: 3,
            agility: 2,
            wisdom: 1,
            technique: 2
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

    await this.loader.loadConfig(defaultConfig);
  }

  /**
   * Ensure manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.loader.isLoaded()) {
      throw new Error('ConfigManager not initialized. Call initialize() first.');
    }
  }
}

/**
 * Configuration statistics
 */
export interface ConfigStats {
  version: string;
  lastLoadTime: number;
  characterCount: number;
  itemCount: number;
  recipeCount: number;
  dungeonCount: number;
  jobCount: number;
  skillCount: number;
  achievementCount: number;
  shopCount: number;
  cropCount: number;
  exclusiveSkillCount: number;
  otherworldCharacterCount: number;
}

// Type alias for recipe config (using Recipe from RecipeTypes)
// Recipe type is imported from RecipeTypes