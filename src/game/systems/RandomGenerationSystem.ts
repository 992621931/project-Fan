/**
 * Random generation system
 * Handles procedural generation of characters, items, and encounters
 */

import { System } from '../../ecs/System';
import { World } from '../../ecs/World';
import { Entity } from '../../ecs/Entity';
import { ComponentType } from '../../ecs/Component';
import { ConfigManager } from '../config/ConfigManager';
import { CharacterConfig, ItemConfig, DungeonConfig, EncounterConfig } from '../config/ConfigTypes';
import { RarityType, getRarityConfig } from '../types/RarityTypes';
import { JobType, ItemType, RecruitmentType, EncounterType, CharacterStatus } from '../types/GameTypes';
import { 
  CharacterInfoComponent, 
  CharacterInfoComponentType,
  AttributeComponent, 
  AttributeComponentType,
  LevelComponent, 
  LevelComponentType,
  JobComponent,
  JobComponentType,
  HealthComponent,
  HealthComponentType,
  ManaComponent,
  ManaComponentType
} from '../components/CharacterComponents';
import { ItemComponent, ItemComponentType } from '../components/ItemComponents';

/**
 * Random generation system for procedural content
 */
export class RandomGenerationSystem extends System {
  public readonly name = 'RandomGenerationSystem';
  public readonly requiredComponents: ComponentType<any>[] = [];

  private configManager: ConfigManager;
  private namePool: NamePool;
  private titlePool: TitlePool;

  constructor() {
    super();
    this.configManager = ConfigManager.getInstance();
    this.namePool = new NamePool();
    this.titlePool = new TitlePool();
  }

  protected onInitialize(): void {
    // System initialization
  }

  public update(deltaTime: number): void {
    // This system doesn't need regular updates
  }

  protected onShutdown(): void {
    // Cleanup if needed
  }

  /**
   * Generate a random character based on recruitment type
   */
  public generateCharacter(recruitmentType: RecruitmentType, world: World): Entity {
    const rarity = this.determineCharacterRarity(recruitmentType);
    const characterConfigs = this.configManager.getCharactersByRarity(rarity);
    
    if (characterConfigs.length === 0) {
      throw new Error(`No character configurations found for rarity ${rarity}`);
    }

    // Select a random character configuration
    const config = this.selectRandomConfig(characterConfigs);
    
    // Generate character entity
    const character = world.createEntity();
    
    // Add character info component
    const characterInfo: CharacterInfoComponent = {
      type: 'characterInfo',
      title: (config.isSpecial && config.title) ? config.title : this.titlePool.getRandomTitle(rarity),
      name: (config.isSpecial && config.name) ? config.name : this.namePool.getRandomName(),
      isSpecial: config.isSpecial || false,
      rarity: config.rarity,
      status: CharacterStatus.Available
    };
    world.addComponent(character.id, CharacterInfoComponentType, characterInfo);

    // Add attributes with some randomization
    const attributes = this.generateAttributes(config.baseAttributes, rarity);
    world.addComponent(character.id, AttributeComponentType, attributes);

    // Add level component
    const level: LevelComponent = {
      type: 'level',
      level: 1,
      experience: 0,
      experienceToNext: 100
    };
    world.addComponent(character.id, LevelComponentType, level);

    // Add job component
    const job: JobComponent = {
      type: 'job',
      currentJob: config.startingJob,
      availableJobs: [...config.availableJobs],
      jobExperience: new Map()
    };
    world.addComponent(character.id, JobComponentType, job);

    // Calculate and add health/mana
    const health = this.calculateHealth(attributes, level.level);
    const mana = this.calculateMana(attributes, level.level);
    
    world.addComponent(character.id, HealthComponentType, health);
    world.addComponent(character.id, ManaComponentType, mana);

    return character;
  }

  /**
   * Generate a random item based on type and rarity
   */
  public generateItem(world: World, itemType?: ItemType, rarity?: RarityType): Entity {
    let itemConfigs: ItemConfig[];
    
    if (itemType && rarity !== undefined) {
      itemConfigs = this.configManager.getItemsByType(itemType)
        .filter(item => item.rarity === rarity);
    } else if (itemType) {
      itemConfigs = this.configManager.getItemsByType(itemType);
    } else if (rarity !== undefined) {
      itemConfigs = this.configManager.getItemsByRarity(rarity);
    } else {
      itemConfigs = this.configManager.getConfig().items;
    }

    if (itemConfigs.length === 0) {
      throw new Error(`No item configurations found for type ${itemType}, rarity ${rarity}`);
    }

    const config = this.selectRandomConfig(itemConfigs);
    const item = world.createEntity();

    // Create item component with potential quality variation
    const quality = this.generateItemQuality(config.rarity);
    const itemComponent: ItemComponent = {
      type: 'item',
      id: config.id || 'unknown',
      name: config.name || 'Unknown Item',
      description: config.description || 'No description',
      rarity: config.rarity,
      itemType: config.type,
      stackSize: config.stackSize || 1,
      value: Math.floor((config.baseValue || 0) * (0.8 + quality * 0.004)), // Quality affects value
      quality: quality
    };

    world.addComponent(item.id, ItemComponentType, itemComponent);

    return item;
  }

  /**
   * Generate a random encounter for a dungeon
   */
  public generateEncounter(dungeonId: string): EncounterConfig | null {
    const dungeon = this.configManager.getDungeon(dungeonId);
    if (!dungeon) {
      return null;
    }

    // Use weighted random selection
    const totalWeight = dungeon.encounters.reduce((sum: number, enc: any) => sum + enc.weight, 0);
    let random = Math.random() * totalWeight;

    for (const encounter of dungeon.encounters) {
      random -= encounter.weight;
      if (random <= 0) {
        return encounter;
      }
    }

    // Fallback to first encounter
    return dungeon.encounters[0] || null;
  }

  /**
   * Generate random loot based on drop table
   */
  public generateLoot(world: World, dropTable: any[]): Entity[] {
    const loot: Entity[] = [];

    for (const drop of dropTable) {
      if (Math.random() <= drop.chance) {
        if (drop.type === 'item') {
          const item = this.generateSpecificItem(world, drop.id, drop.amount || 1);
          if (item) {
            loot.push(item);
          }
        }
        // Currency drops would be handled by the currency system
      }
    }

    return loot;
  }

  /**
   * Generate a balanced party of characters
   */
  public generateBalancedParty(world: World, size: number = 4): Entity[] {
    const party: Entity[] = [];
    const roles = ['warrior', 'mage', 'archer', 'healer'];
    
    for (let i = 0; i < size; i++) {
      const role = roles[i % roles.length] || 'warrior';
      const recruitmentType = this.getRecruitmentTypeForRole(role);
      const character = this.generateCharacter(recruitmentType, world);
      party.push(character);
    }

    return party;
  }

  /**
   * Determine character rarity based on recruitment type
   */
  private determineCharacterRarity(recruitmentType: RecruitmentType): RarityType {
    switch (recruitmentType) {
      case RecruitmentType.Gold:
        return this.weightedRaritySelection([
          { rarity: RarityType.Common, weight: 0.7 },
          { rarity: RarityType.Rare, weight: 0.25 },
          { rarity: RarityType.Epic, weight: 0.04 },
          { rarity: RarityType.Legendary, weight: 0.01 }
        ]);
      case RecruitmentType.RareTicket:
        return this.weightedRaritySelection([
          { rarity: RarityType.Rare, weight: 0.7 },
          { rarity: RarityType.Epic, weight: 0.25 },
          { rarity: RarityType.Legendary, weight: 0.05 }
        ]);
      case RecruitmentType.EpicTicket:
        return this.weightedRaritySelection([
          { rarity: RarityType.Epic, weight: 0.8 },
          { rarity: RarityType.Legendary, weight: 0.2 }
        ]);
      case RecruitmentType.LegendaryTicket:
        return RarityType.Legendary;
      default:
        return RarityType.Common;
    }
  }

  /**
   * Weighted rarity selection
   */
  private weightedRaritySelection(weights: { rarity: RarityType; weight: number }[]): RarityType {
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (const weight of weights) {
      random -= weight.weight;
      if (random <= 0) {
        return weight.rarity;
      }
    }

    return weights[0]?.rarity || RarityType.Common;
  }

  /**
   * Generate attributes with randomization
   */
  private generateAttributes(baseAttributes: any, rarity: RarityType): AttributeComponent {
    const rarityConfig = getRarityConfig(rarity);
    const multiplier = rarityConfig.attributeMultiplier;
    const variance = 0.2; // 20% variance

    return {
      type: 'attribute',
      strength: Math.floor((baseAttributes.strength || 10) * multiplier * (1 + (Math.random() - 0.5) * variance)),
      agility: Math.floor((baseAttributes.agility || 10) * multiplier * (1 + (Math.random() - 0.5) * variance)),
      wisdom: Math.floor((baseAttributes.wisdom || 10) * multiplier * (1 + (Math.random() - 0.5) * variance)),
      technique: Math.floor((baseAttributes.technique || 10) * multiplier * (1 + (Math.random() - 0.5) * variance))
    };
  }

  /**
   * Calculate health based on attributes and level
   */
  private calculateHealth(attributes: AttributeComponent, level: number): HealthComponent {
    const baseHealth = 50;
    const healthPerLevel = 10;
    const strengthBonus = attributes.strength * 2;
    
    const maximum = baseHealth + (level * healthPerLevel) + strengthBonus;
    
    return {
      type: 'health',
      current: maximum,
      maximum: maximum
    };
  }

  /**
   * Calculate mana based on attributes and level
   */
  private calculateMana(attributes: AttributeComponent, level: number): ManaComponent {
    const baseMana = 30;
    const manaPerLevel = 5;
    const wisdomBonus = attributes.wisdom * 3;
    
    const maximum = baseMana + (level * manaPerLevel) + wisdomBonus;
    
    return {
      type: 'mana',
      current: maximum,
      maximum: maximum
    };
  }

  /**
   * Generate item quality (0-100)
   */
  private generateItemQuality(rarity: RarityType): number {
    const baseQuality = 50;
    const rarityBonus = rarity * 15;
    const variance = 20;
    
    const quality = baseQuality + rarityBonus + (Math.random() - 0.5) * variance;
    return Math.max(0, Math.min(100, Math.floor(quality)));
  }

  /**
   * Generate a specific item by ID
   */
  private generateSpecificItem(world: World, itemId: string, quantity: number = 1): Entity | null {
    const config = this.configManager.getItem(itemId);
    if (!config) {
      return null;
    }

    const item = world.createEntity();
    const quality = this.generateItemQuality(config.rarity);
    
    const itemComponent: ItemComponent = {
      type: 'item',
      id: config.id || 'unknown',
      name: config.name || 'Unknown Item',
      description: config.description || 'No description',
      rarity: config.rarity,
      itemType: config.type,
      stackSize: config.stackSize || 1,
      value: Math.floor((config.baseValue || 0) * (0.8 + quality * 0.004)),
      quality: quality
    };

    world.addComponent(item.id, ItemComponentType, itemComponent);
    return item;
  }

  /**
   * Select random configuration from array
   */
  private selectRandomConfig<T>(configs: T[]): T {
    if (configs.length === 0) {
      throw new Error('Cannot select from empty configuration array');
    }
    const selected = configs[Math.floor(Math.random() * configs.length)];
    if (!selected) {
      throw new Error('Failed to select configuration');
    }
    return selected;
  }

  /**
   * Get recruitment type for role
   */
  private getRecruitmentTypeForRole(role: string): RecruitmentType {
    // Simple mapping for balanced party generation
    const roleMap: { [key: string]: RecruitmentType } = {
      'warrior': RecruitmentType.Gold,
      'mage': RecruitmentType.Gold,
      'archer': RecruitmentType.Gold,
      'healer': RecruitmentType.RareTicket
    };
    
    return roleMap[role] || RecruitmentType.Gold;
  }
}

/**
 * Name pool for character generation
 */
class NamePool {
  private maleNames = [
    '艾伦', '加雷斯', '西格弗里德', '亚瑟', '兰斯洛特', '高文', '珀西瓦尔',
    '罗兰', '奥利弗', '查理曼', '威廉', '理查德', '亨利', '爱德华',
    '约翰', '罗伯特', '托马斯', '詹姆斯', '迈克尔', '大卫'
  ];

  private femaleNames = [
    '莉娜', '希尔薇', '伊莎贝拉', '艾丽丝', '维多利亚', '伊丽莎白',
    '玛丽', '安妮', '凯瑟琳', '玛格丽特', '简', '艾玛', '索菲亚',
    '奥利维亚', '艾米莉', '夏洛特', '阿比盖尔', '米娅', '麦迪逊'
  ];

  public getRandomName(): string {
    const allNames = [...this.maleNames, ...this.femaleNames];
    const name = allNames[Math.floor(Math.random() * allNames.length)];
    return name || 'Unknown';
  }

  public getRandomMaleName(): string {
    const name = this.maleNames[Math.floor(Math.random() * this.maleNames.length)];
    return name || 'Unknown';
  }

  public getRandomFemaleName(): string {
    const name = this.femaleNames[Math.floor(Math.random() * this.femaleNames.length)];
    return name || 'Unknown';
  }
}

/**
 * Title pool for character generation
 */
class TitlePool {
  private titlesByRarity: { [key in RarityType]: string[] } = {
    [RarityType.Common]: [
      '见习', '新手', '学徒', '初心者', '菜鸟', '练习生'
    ],
    [RarityType.Rare]: [
      '老兵', '经验者', '熟练者', '专家', '能手', '行家'
    ],
    [RarityType.Epic]: [
      '大师', '专家', '神射手', '法师', '骑士', '勇者'
    ],
    [RarityType.Legendary]: [
      '传说', '英雄', '贤者', '屠龙者', '救世主', '不朽者'
    ]
  };

  public getRandomTitle(rarity: RarityType): string {
    const titles = this.titlesByRarity[rarity];
    const title = titles[Math.floor(Math.random() * titles.length)];
    return title || 'Unknown';
  }
}

/**
 * Balance verification utility
 */
export class BalanceVerifier {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = ConfigManager.getInstance();
  }

  /**
   * Verify character balance across rarities
   */
  public verifyCharacterBalance(): BalanceReport {
    const report: BalanceReport = {
      characters: this.analyzeCharacterBalance(),
      items: this.analyzeItemBalance(),
      economy: this.analyzeEconomyBalance(),
      warnings: [],
      recommendations: []
    };

    this.generateRecommendations(report);
    return report;
  }

  /**
   * Analyze character balance
   */
  private analyzeCharacterBalance(): CharacterBalanceAnalysis {
    const characters = this.configManager.getConfig().characters;
    const analysis: CharacterBalanceAnalysis = {
      totalByRarity: { [RarityType.Common]: 0, [RarityType.Rare]: 0, [RarityType.Epic]: 0, [RarityType.Legendary]: 0 },
      averageAttributesByRarity: { [RarityType.Common]: 0, [RarityType.Rare]: 0, [RarityType.Epic]: 0, [RarityType.Legendary]: 0 },
      powerCurve: []
    };

    // Count characters by rarity and calculate average attributes
    for (const character of characters) {
      analysis.totalByRarity[character.rarity]++;
      
      const totalAttributes = (character.baseAttributes?.strength || 0) + 
                             (character.baseAttributes?.agility || 0) + 
                             (character.baseAttributes?.wisdom || 0) + 
                             (character.baseAttributes?.technique || 0);
      
      analysis.averageAttributesByRarity[character.rarity] += totalAttributes;
    }

    // Calculate averages
    for (const rarity of Object.values(RarityType)) {
      if (typeof rarity === 'number') {
        const count = analysis.totalByRarity[rarity];
        if (count > 0) {
          analysis.averageAttributesByRarity[rarity] /= count;
        }
      }
    }

    return analysis;
  }

  /**
   * Analyze item balance
   */
  private analyzeItemBalance(): ItemBalanceAnalysis {
    const items = this.configManager.getConfig().items;
    const analysis: ItemBalanceAnalysis = {
      totalByType: {},
      totalByRarity: { [RarityType.Common]: 0, [RarityType.Rare]: 0, [RarityType.Epic]: 0, [RarityType.Legendary]: 0 },
      averageValueByRarity: { [RarityType.Common]: 0, [RarityType.Rare]: 0, [RarityType.Epic]: 0, [RarityType.Legendary]: 0 }
    };

    // Analyze items
    for (const item of items || []) {
      const itemType = item.type || 'unknown';
      // Count by type
      if (!analysis.totalByType[itemType]) {
        analysis.totalByType[itemType] = 0;
      }
      analysis.totalByType[itemType]++;

      // Count by rarity and sum values
      analysis.totalByRarity[item.rarity]++;
      analysis.averageValueByRarity[item.rarity] += (item.baseValue || 0);
    }

    // Calculate average values
    for (const rarity of Object.values(RarityType)) {
      if (typeof rarity === 'number') {
        const count = analysis.totalByRarity[rarity];
        if (count > 0) {
          analysis.averageValueByRarity[rarity] /= count;
        }
      }
    }

    return analysis;
  }

  /**
   * Analyze economy balance
   */
  private analyzeEconomyBalance(): EconomyBalanceAnalysis {
    const recipes = this.configManager.getConfig().recipes;
    const dungeons = this.configManager.getConfig().dungeons;

    return {
      recipeComplexity: recipes.length,
      dungeonRewardBalance: dungeons.length,
      craftingCostEfficiency: this.calculateCraftingEfficiency(recipes)
    };
  }

  /**
   * Calculate crafting efficiency
   */
  private calculateCraftingEfficiency(recipes: any[]): number {
    if (recipes.length === 0) return 0;

    let totalEfficiency = 0;
    for (const recipe of recipes) {
      // Simple efficiency calculation based on material cost vs result value
      const materialCost = recipe.materials?.reduce((sum: number, mat: any) => sum + (mat.quantity * 5), 0) || 0;
      const resultValue = 50; // Simplified result value
      const efficiency = resultValue / Math.max(materialCost, 1);
      totalEfficiency += efficiency;
    }

    return totalEfficiency / recipes.length;
  }

  /**
   * Generate balance recommendations
   */
  private generateRecommendations(report: BalanceReport): void {
    // Check character distribution
    const charAnalysis = report.characters;
    const totalChars = Object.values(charAnalysis.totalByRarity).reduce((sum, count) => sum + count, 0);
    
    if (totalChars > 0) {
      const legendaryRatio = charAnalysis.totalByRarity[RarityType.Legendary] / totalChars;
      if (legendaryRatio > 0.2) {
        report.warnings.push('Too many legendary characters may reduce their perceived value');
        report.recommendations.push('Consider reducing legendary character count or adding more common characters');
      }
    }

    // Check item balance
    const itemAnalysis = report.items;
    const equipmentCount = itemAnalysis.totalByType['equipment'] || 0;
    const consumableCount = itemAnalysis.totalByType['consumable'] || 0;
    
    if (equipmentCount < consumableCount * 0.5) {
      report.warnings.push('Low equipment to consumable ratio may limit character progression');
      report.recommendations.push('Add more equipment items to provide better progression options');
    }
  }
}

/**
 * Balance analysis interfaces
 */
export interface BalanceReport {
  characters: CharacterBalanceAnalysis;
  items: ItemBalanceAnalysis;
  economy: EconomyBalanceAnalysis;
  warnings: string[];
  recommendations: string[];
}

export interface CharacterBalanceAnalysis {
  totalByRarity: { [key in RarityType]: number };
  averageAttributesByRarity: { [key in RarityType]: number };
  powerCurve: number[];
}

export interface ItemBalanceAnalysis {
  totalByType: { [key: string]: number };
  totalByRarity: { [key in RarityType]: number };
  averageValueByRarity: { [key in RarityType]: number };
}

export interface EconomyBalanceAnalysis {
  recipeComplexity: number;
  dungeonRewardBalance: number;
  craftingCostEfficiency: number;
}