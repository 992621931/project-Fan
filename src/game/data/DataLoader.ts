/**
 * Game data loader utility
 * Loads and manages game configuration data from JSON files
 */

import { GameConfig } from '../config/ConfigTypes';
import { ConfigManager } from '../config/ConfigManager';

/**
 * Data loader class for game content
 */
export class DataLoader {
  private static instance: DataLoader;
  private configManager: ConfigManager;
  private loaded: boolean = false;

  private constructor() {
    this.configManager = ConfigManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DataLoader {
    if (!DataLoader.instance) {
      DataLoader.instance = new DataLoader();
    }
    return DataLoader.instance;
  }

  /**
   * Load all game data
   */
  public async loadGameData(): Promise<void> {
    try {
      // Load the main game configuration
      const gameConfig = await this.loadConfigFromFile('src/game/data/game-config.json');
      
      // Load exclusive skills data
      const exclusiveSkillsData = await this.loadOptionalDataFile(
        'src/game/data/exclusive-skills.json',
        'exclusiveSkills'
      );
      
      // Load otherworld characters data
      const otherworldCharactersData = await this.loadOptionalDataFile(
        'src/game/data/otherworld-characters.json',
        'otherworldCharacters'
      );
      
      // Merge the loaded data into the game config
      const mergedConfig = {
        ...gameConfig,
        exclusiveSkills: exclusiveSkillsData || [],
        otherworldCharacters: otherworldCharactersData || []
      };
      
      console.log('[DataLoader] Merged config keys:', Object.keys(mergedConfig));
      console.log('[DataLoader] Exclusive skills count:', mergedConfig.exclusiveSkills.length);
      console.log('[DataLoader] Otherworld characters count:', mergedConfig.otherworldCharacters.length);
      
      // Initialize the config manager with the loaded data
      await this.configManager.initialize(mergedConfig);
      
      this.loaded = true;
      console.log('Game data loaded successfully');
      console.log('Configuration stats:', this.configManager.getStats());
    } catch (error) {
      console.error('Failed to load game data:', error);
      // Log more details about the error
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw new Error(`Game data loading failed: ${error}`);
    }
  }

  /**
   * Check if data is loaded
   */
  public isLoaded(): boolean {
    return this.loaded && this.configManager.isInitialized();
  }

  /**
   * Get the config manager instance
   */
  public getConfigManager(): ConfigManager {
    if (!this.isLoaded()) {
      throw new Error('Game data not loaded. Call loadGameData() first.');
    }
    return this.configManager;
  }

  /**
   * Load configuration from file
   */
  private async loadConfigFromFile(filePath: string): Promise<GameConfig> {
    try {
      // Try different path variations for development and production
      const pathsToTry = [
        filePath,
        filePath.replace('/src/', '/'),  // Remove /src/ prefix for production builds
        '.' + filePath  // Try relative path
      ];
      
      let lastError: Error | null = null;
      
      for (const path of pathsToTry) {
        try {
          console.log(`[DataLoader] Attempting to load config from: ${path}`);
          const response = await fetch(path);
          if (response.ok) {
            console.log(`[DataLoader] Successfully loaded config from: ${path}`);
            return await response.json();
          }
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        } catch (error) {
          lastError = error as Error;
          console.warn(`[DataLoader] Failed to load from ${path}:`, error);
        }
      }
      
      throw lastError || new Error('All path attempts failed');
    } catch (error) {
      // Fallback to embedded configuration if file loading fails
      console.warn(`Failed to load config from ${filePath}, using embedded config:`, error);
      return this.getEmbeddedConfig();
    }
  }

  /**
   * Load optional data file with error handling
   * Returns null if file is missing, throws on JSON parse errors
   */
  private async loadOptionalDataFile(filePath: string, dataKey: string): Promise<any[] | null> {
    try {
      // Try different path variations for development and production
      const pathsToTry = [
        filePath,
        filePath.replace('/src/', '/'),  // Remove /src/ prefix for production builds
        '.' + filePath  // Try relative path
      ];
      
      for (const path of pathsToTry) {
        try {
          console.log(`[DataLoader] Attempting to load ${dataKey} from: ${path}`);
          const response = await fetch(path);
          
          if (!response.ok) {
            if (response.status === 404) {
              console.warn(`[DataLoader] File not found: ${path}`);
              continue;  // Try next path
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Validate that the data has the expected structure
          if (!data || typeof data !== 'object') {
            throw new Error(`Invalid JSON structure in ${path}: expected object, got ${typeof data}`);
          }
          
          if (!Array.isArray(data[dataKey])) {
            throw new Error(`Invalid JSON structure in ${path}: expected array for key "${dataKey}", got ${typeof data[dataKey]}`);
          }
          
          console.log(`[DataLoader] Successfully loaded ${data[dataKey].length} ${dataKey} from: ${path}`);
          return data[dataKey];
        } catch (error) {
          console.warn(`[DataLoader] Failed to load from ${path}:`, error);
          // Continue to next path
        }
      }
      
      // All paths failed - use empty array as default
      console.warn(`Optional data file not found in any location for ${dataKey}. Using empty array.`);
      return [];
    } catch (error) {
      console.error(`Error loading optional data file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Get embedded configuration as fallback
   */
  private getEmbeddedConfig(): GameConfig {
    // This is a fallback configuration embedded in the code
    return {
      version: '1.0.0',
      characters: [
        {
          id: 'starter_warrior',
          name: '艾伦',
          title: '见习',
          rarity: 0,
          isSpecial: false,
          baseAttributes: {
            strength: 12,
            agility: 8,
            wisdom: 5,
            technique: 7
          },
          startingJob: 'warrior' as any,
          availableJobs: ['warrior' as any],
          description: '一个刚开始冒险的新手战士，拥有基础的剑术技能。'
        },
        {
          id: 'starter_mage',
          name: '莉娜',
          title: '见习',
          rarity: 0,
          isSpecial: false,
          baseAttributes: {
            strength: 5,
            agility: 7,
            wisdom: 12,
            technique: 8
          },
          startingJob: 'mage' as any,
          availableJobs: ['mage' as any],
          description: '一个初学魔法的年轻法师，对元素魔法有天赋。'
        }
      ],
      items: [
        {
          id: 'basic_sword',
          name: '铁剑',
          description: '一把普通的铁制长剑，适合新手使用。',
          type: 'equipment' as any,
          rarity: 0,
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
        },
        {
          id: 'health_potion',
          name: '生命药水',
          description: '恢复生命值的红色药水。',
          type: 'consumable' as any,
          rarity: 0,
          stackSize: 99,
          baseValue: 25,
          effects: [
            {
              type: 'heal',
              attribute: 'health',
              value: 50,
              duration: 0
            }
          ]
        },
        {
          id: 'iron_ore',
          name: '铁矿石',
          description: '用于锻造的基础金属矿石。',
          type: 'material' as any,
          rarity: 0,
          stackSize: 999,
          baseValue: 5,
          materialType: 'metal',
          quality: 50
        }
      ],
      recipes: [
        {
          id: 'craft_iron_sword',
          name: '锻造铁剑',
          description: '使用铁矿石锻造基础的铁剑。',
          type: 'equipment' as any,
          requirements: [
            {
              type: 'skill',
              id: 'blacksmithing',
              level: 1,
              required: true
            }
          ],
          materials: [
            {
              itemId: 'iron_ore',
              quantity: 3,
              qualityMin: 30,
              consumeOnUse: true
            }
          ],
          result: {
            itemId: 'basic_sword',
            baseQuantity: 1,
            qualityInfluence: {
              attributeMultiplier: 0.1,
              quantityChance: 0.05,
              rarityBonus: 0.02
            },
            rarityChance: [
              {
                rarity: 0,
                baseChance: 0.9,
                qualityBonus: 0.001,
                skillBonus: 0.01
              }
            ],
            bonusResults: []
          },
          successRate: 0.95,
          experienceGain: 10,
          craftingTime: 300,
          unlockConditions: []
        }
      ],
      dungeons: [
        {
          id: 'goblin_cave',
          name: '哥布林洞穴',
          description: '一个被哥布林占据的小洞穴，适合新手冒险者。',
          difficulty: 1,
          requiredLevel: 1,
          encounters: [
            {
              id: 'goblin_patrol',
              type: 'combat',
              enemies: [
                {
                  id: 'goblin_warrior',
                  name: '哥布林战士',
                  level: 2,
                  attributes: {
                    strength: 6,
                    agility: 8,
                    wisdom: 3,
                    technique: 5
                  },
                  health: 40,
                  skills: ['basic_attack'],
                  dropTable: [
                    {
                      type: 'currency',
                      currency: 'gold',
                      amount: 15,
                      chance: 1.0
                    }
                  ]
                }
              ],
              weight: 1.0
            }
          ],
          rewards: [
            {
              type: 'experience',
              amount: 50,
              chance: 1.0
            }
          ],
          unlockConditions: []
        }
      ],
      jobs: [
        {
          id: 'warrior' as any,
          name: '战士',
          description: '近战物理职业，擅长使用剑盾进行战斗。',
          attributeGrowth: {
            strength: 3,
            agility: 2,
            wisdom: 1,
            technique: 2
          },
          skills: ['sword_mastery'],
          unlockConditions: [],
          workTypes: ['mining' as any, 'crafting' as any]
        },
        {
          id: 'mage' as any,
          name: '法师',
          description: '远程魔法职业，使用元素魔法攻击敌人。',
          attributeGrowth: {
            strength: 1,
            agility: 2,
            wisdom: 4,
            technique: 1
          },
          skills: ['fireball'],
          unlockConditions: [],
          workTypes: ['research' as any, 'alchemy' as any]
        }
      ],
      skills: [
        {
          id: 'sword_mastery',
          name: '剑术精通',
          description: '提高使用剑类武器的熟练度。',
          type: 'passive',
          maxLevel: 10,
          manaCost: 0,
          cooldown: 0,
          effects: [
            {
              type: 'attribute_bonus',
              target: 'self',
              attribute: 'attack',
              value: 2,
              duration: -1
            }
          ],
          learnConditions: []
        },
        {
          id: 'fireball',
          name: '火球术',
          description: '发射一个火球攻击敌人。',
          type: 'active',
          maxLevel: 8,
          manaCost: 15,
          cooldown: 3,
          effects: [
            {
              type: 'magic_damage',
              target: 'enemy',
              attribute: 'magicPower',
              value: 120,
              duration: 0
            }
          ],
          learnConditions: []
        }
      ],
      achievements: [],
      shops: [],
      crops: [],
      exclusiveSkills: [],
      otherworldCharacters: []
    };
  }

  /**
   * Reload game data
   */
  public async reloadGameData(): Promise<void> {
    this.loaded = false;
    await this.loadGameData();
  }

  /**
   * Get game statistics
   */
  public getGameStats(): GameStats {
    if (!this.isLoaded()) {
      throw new Error('Game data not loaded');
    }

    const stats = this.configManager.getStats();
    return {
      ...stats,
      totalContent: stats.characterCount + stats.itemCount + stats.recipeCount + 
                   stats.dungeonCount + stats.jobCount + stats.skillCount,
      dataLoadTime: Date.now() - stats.lastLoadTime
    };
  }
}

/**
 * Extended game statistics
 */
export interface GameStats {
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
  totalContent: number;
  dataLoadTime: number;
}

/**
 * Initialize game data on module load
 */
export async function initializeGameData(): Promise<DataLoader> {
  const dataLoader = DataLoader.getInstance();
  await dataLoader.loadGameData();
  return dataLoader;
}