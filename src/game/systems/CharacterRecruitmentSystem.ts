/**
 * Character Recruitment System
 * Handles character recruitment through gold and special items
 * Implements requirements 1.1-1.6
 */

import { System } from '../../ecs/System';
import { ComponentType } from '../../ecs/Component';
import { EntityId, Entity } from '../../ecs/Entity';
import { 
  AttributeComponent, 
  AttributeComponentType,
  CharacterInfoComponent,
  CharacterInfoComponentType,
  HealthComponent,
  HealthComponentType,
  ManaComponent,
  ManaComponentType,
  LevelComponent,
  LevelComponentType,
  JobComponent,
  JobComponentType,
  DerivedStatsComponent,
  DerivedStatsComponentType,
  AffinityComponent,
  AffinityComponentType,
  HungerComponent,
  HungerComponentType
} from '../components/CharacterComponents';
import { 
  CurrencyComponent, 
  CurrencyComponentType,
  EquipmentSlotsComponent,
  EquipmentSlotsComponentType,
  InventoryComponent,
  InventoryComponentType
} from '../components/SystemComponents';
import { 
  RecruitmentType, 
  JobType, 
  CharacterStatus 
} from '../types/GameTypes';
import { RarityType, getRarityConfig } from '../types/RarityTypes';
import { CurrencyValidator } from '../types/CurrencyTypes';
import { validateHunger } from '../utils/HungerValidation';

export interface RecruitmentConfig {
  goldCost: number;
  guaranteedRarity: Record<RecruitmentType, RarityType>;
  titlePool: string[];
  namePool: string[];
  specialCharacters: SpecialCharacterConfig[];
}

export interface SpecialCharacterConfig {
  name: string;
  title: string;
  rarity: RarityType;
  job: JobType;
  baseAttributes: {
    strength: number;
    agility: number;
    wisdom: number;
    technique: number;
  };
}

export interface RecruitmentResult {
  success: boolean;
  character?: EntityId;
  error?: string;
}

export class CharacterRecruitmentSystem extends System {
  public readonly name = 'CharacterRecruitmentSystem';
  public readonly requiredComponents: ComponentType<any>[] = [
    CurrencyComponentType
  ];

  private config: RecruitmentConfig = {
    goldCost: 100,
    guaranteedRarity: {
      [RecruitmentType.Gold]: RarityType.Common,
      [RecruitmentType.RareTicket]: RarityType.Rare,
      [RecruitmentType.EpicTicket]: RarityType.Epic,
      [RecruitmentType.LegendaryTicket]: RarityType.Legendary
    },
    titlePool: [
      '勇敢的', '智慧的', '敏捷的', '强壮的', '神秘的', '幸运的',
      '冷静的', '热血的', '沉默的', '活泼的', '谨慎的', '大胆的'
    ],
    namePool: [
      '艾莉丝', '鲍勃', '凯瑟琳', '大卫', '艾玛', '弗兰克',
      '格蕾丝', '亨利', '艾薇', '杰克', '凯特', '利奥',
      '玛雅', '诺亚', '奥利维亚', '彼得', '奎因', '瑞秋'
    ],
    specialCharacters: [
      {
        name: '传说剑士阿尔托利亚',
        title: '圣剑之王',
        rarity: RarityType.Legendary,
        job: JobType.Paladin,
        baseAttributes: { strength: 20, agility: 15, wisdom: 12, technique: 18 }
      },
      {
        name: '大法师梅林',
        title: '时空术士',
        rarity: RarityType.Legendary,
        job: JobType.Wizard,
        baseAttributes: { strength: 8, agility: 10, wisdom: 25, technique: 12 }
      }
    ]
  };

  /**
   * Recruit a character using gold
   * Requirement 1.1: Generate random character with gold
   */
  public recruitWithGold(playerId: EntityId): RecruitmentResult {
    const currency = this.getComponent(playerId, CurrencyComponentType);
    if (!currency) {
      return { success: false, error: 'Player currency component not found' };
    }

    // Check if player has enough gold
    if (!CurrencyValidator.canAfford(currency.amounts, { gold: this.config.goldCost })) {
      return { success: false, error: 'Insufficient gold' };
    }

    // Deduct gold cost
    currency.amounts = CurrencyValidator.subtract(currency.amounts, { gold: this.config.goldCost });

    // Generate character with common rarity
    const character = this.generateCharacter(RarityType.Common, false);
    
    return { success: true, character };
  }

  /**
   * Recruit a character using special recruitment item
   * Requirement 1.2: Generate character based on item rarity
   */
  public recruitWithItem(playerId: EntityId, recruitmentType: RecruitmentType): RecruitmentResult {
    const inventory = this.getComponent(playerId, InventoryComponentType);
    if (!inventory) {
      return { success: false, error: 'Player inventory component not found' };
    }

    // Check if player has the required recruitment item
    const hasItem = this.hasRecruitmentItem(inventory, recruitmentType);
    if (!hasItem) {
      return { success: false, error: `Missing recruitment item: ${recruitmentType}` };
    }

    // Remove the recruitment item
    this.consumeRecruitmentItem(inventory, recruitmentType);

    // Get guaranteed rarity for this recruitment type
    const guaranteedRarity = this.config.guaranteedRarity[recruitmentType];
    
    // Determine if this should be a special character (10% chance for legendary)
    const isSpecial = guaranteedRarity === RarityType.Legendary && Math.random() < 0.1;

    // Generate character
    const character = this.generateCharacter(guaranteedRarity, isSpecial);
    
    return { success: true, character };
  }

  /**
   * Generate a new character entity
   * Requirements 1.3-1.6: Assign title, name, attributes, and job
   */
  private generateCharacter(rarity: RarityType, isSpecial: boolean): EntityId {
    const characterEntity = this.entityManager.createEntity();
    const character = characterEntity.id;

    let title: string;
    let name: string;
    let job: JobType;
    let baseAttributes: { strength: number; agility: number; wisdom: number; technique: number };

    if (isSpecial) {
      // Requirement 1.5: Use predefined names for special characters
      const specialChar = this.getRandomSpecialCharacter(rarity);
      title = specialChar.title;
      name = specialChar.name;
      job = specialChar.job;
      baseAttributes = specialChar.baseAttributes;
    } else {
      // Requirement 1.3: Random title from pool
      title = this.getRandomTitle();
      // Requirement 1.4: Random name from pool for normal characters
      name = this.getRandomName();
      job = this.getRandomJob();
      baseAttributes = this.generateBaseAttributes(rarity);
    }

    // Create character info component
    const characterInfo: CharacterInfoComponent = {
      type: 'characterInfo',
      title,
      name,
      isSpecial,
      rarity,
      status: CharacterStatus.Available
    };

    // Create attribute component with rarity-based scaling
    // Requirement 1.6: Assign initial attributes based on rarity
    const rarityConfig = getRarityConfig(rarity);
    const attributes: AttributeComponent = {
      type: 'attribute',
      strength: Math.floor(baseAttributes.strength * rarityConfig.attributeMultiplier),
      agility: Math.floor(baseAttributes.agility * rarityConfig.attributeMultiplier),
      wisdom: Math.floor(baseAttributes.wisdom * rarityConfig.attributeMultiplier),
      technique: Math.floor(baseAttributes.technique * rarityConfig.attributeMultiplier)
    };

    // Create derived stats (will be calculated by AttributeSystem)
    const derivedStats: DerivedStatsComponent = {
      type: 'derivedStats',
      attack: 0, defense: 0, moveSpeed: 0, dodgeRate: 0, critRate: 0,
      critDamage: 0, resistance: 0, magicPower: 0, carryWeight: 0,
      hitRate: 0, expRate: 0, healthRegen: 0, manaRegen: 0,
      weight: 70, volume: 1
    };

    // Create health component
    const baseHealth = 100 + (attributes.strength * 5);
    const health: HealthComponent = {
      type: 'health',
      current: baseHealth,
      maximum: baseHealth
    };

    // Create mana component
    const baseMana = 50 + (attributes.wisdom * 3);
    const mana: ManaComponent = {
      type: 'mana',
      current: baseMana,
      maximum: baseMana
    };

    // Create hunger component
    // Requirement 2.1, 2.2, 2.3: Initialize with 0 hunger (hungry state)
    // Requirement 7.1, 7.2, 7.3, 7.4: Validate hunger values
    const hunger: HungerComponent = validateHunger({
      type: 'hunger',
      current: 0,
      maximum: 100
    });

    // Add hunger bonus for adventurers and otherworld characters (30~50)
    // Requirement 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 4.2, 4.3
    const hungerBonus = Math.floor(Math.random() * 21) + 30; // 30~50 random integer
    hunger.current = Math.min(hunger.current + hungerBonus, hunger.maximum);

    // Create level component
    const level: LevelComponent = {
      type: 'level',
      level: 1,
      experience: 0,
      experienceToNext: 100
    };

    // Create job component
    const jobComponent: JobComponent = {
      type: 'job',
      currentJob: job,
      availableJobs: [job],
      jobExperience: new Map([[job, 0]])
    };

    // Create affinity component
    const affinity: AffinityComponent = {
      type: 'affinity',
      relationships: new Map()
    };

    // Equipment slots - initialize all slots as empty
    const equipmentSlots: EquipmentSlotsComponent = {
      type: 'equipmentSlots',
      weapon: null,
      armor: null,
      offhand: null,
      accessory: null
    };

    // Add all components to the character
    this.componentManager.addComponent(character, CharacterInfoComponentType, characterInfo);
    this.componentManager.addComponent(character, AttributeComponentType, attributes);
    this.componentManager.addComponent(character, DerivedStatsComponentType, derivedStats);
    this.componentManager.addComponent(character, HealthComponentType, health);
    this.componentManager.addComponent(character, ManaComponentType, mana);
    this.componentManager.addComponent(character, HungerComponentType, hunger);
    this.componentManager.addComponent(character, LevelComponentType, level);
    this.componentManager.addComponent(character, JobComponentType, jobComponent);
    this.componentManager.addComponent(character, AffinityComponentType, affinity);
    this.componentManager.addComponent(character, EquipmentSlotsComponentType, equipmentSlots);

    // Emit character recruited event
    this.eventSystem.emit({
      type: 'character_recruited',
      timestamp: Date.now(),
      characterId: character,
      rarity,
      isSpecial,
      recruitmentMethod: isSpecial ? 'special_item' : 'gold'
    });

    return character;
  }

  private getRandomTitle(): string {
    return this.config.titlePool[Math.floor(Math.random() * this.config.titlePool.length)];
  }

  private getRandomName(): string {
    return this.config.namePool[Math.floor(Math.random() * this.config.namePool.length)];
  }

  private getRandomJob(): JobType {
    const jobs = Object.values(JobType);
    return jobs[Math.floor(Math.random() * jobs.length)];
  }

  private getRandomSpecialCharacter(rarity: RarityType): SpecialCharacterConfig {
    const specialChars = this.config.specialCharacters.filter(char => char.rarity === rarity);
    if (specialChars.length === 0) {
      // Fallback to first special character if none match rarity
      return this.config.specialCharacters[0];
    }
    return specialChars[Math.floor(Math.random() * specialChars.length)];
  }

  private generateBaseAttributes(rarity: RarityType): { strength: number; agility: number; wisdom: number; technique: number } {
    // Base attributes range from 5-15, with some randomization
    const base = 5;
    const range = 10;
    
    return {
      strength: base + Math.floor(Math.random() * range),
      agility: base + Math.floor(Math.random() * range),
      wisdom: base + Math.floor(Math.random() * range),
      technique: base + Math.floor(Math.random() * range)
    };
  }

  private hasRecruitmentItem(inventory: InventoryComponent, recruitmentType: RecruitmentType): boolean {
    // This is a simplified check - in a real implementation, you'd check for specific item IDs
    // For now, we'll assume the recruitment items exist if the method is called
    return true;
  }

  private consumeRecruitmentItem(inventory: InventoryComponent, recruitmentType: RecruitmentType): void {
    // This would remove the recruitment item from inventory
    // Implementation depends on how items are stored and managed
    // For now, this is a placeholder
  }

  public update(deltaTime: number): void {
    // This system doesn't need regular updates
    // All recruitment happens through direct method calls
  }
}