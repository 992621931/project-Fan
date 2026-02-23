/**
 * Attribute System
 * Handles attribute calculations, level progression, and derived stats
 * Implements requirements 14.1, 14.2
 */

import { System } from '../../ecs/System';
import { ComponentType } from '../../ecs/Component';
import { EntityId } from '../../ecs/Entity';
import { 
  AttributeComponent, 
  AttributeComponentType,
  DerivedStatsComponent,
  DerivedStatsComponentType,
  HealthComponent,
  HealthComponentType,
  ManaComponent,
  ManaComponentType,
  LevelComponent,
  LevelComponentType,
  JobComponent,
  JobComponentType,
  CharacterInfoComponent,
  CharacterInfoComponentType
} from '../components/CharacterComponents';
import { 
  EquipmentSlotsComponent,
  EquipmentSlotsComponentType
} from '../components/SystemComponents';
import { JobType, CharacterStatus } from '../types/GameTypes';

export interface JobGrowthRates {
  strength: number;
  agility: number;
  wisdom: number;
  technique: number;
}

export interface LevelUpResult {
  success: boolean;
  newLevel: number;
  attributeGains: Partial<AttributeComponent>;
  error?: string;
}

export class AttributeSystem extends System {
  public readonly name = 'AttributeSystem';
  public readonly requiredComponents: ComponentType<any>[] = [
    AttributeComponentType,
    DerivedStatsComponentType
  ];

  private itemSystem: any | null = null;

  private jobGrowthRates: Record<JobType, JobGrowthRates> = {
    [JobType.Warrior]: { strength: 3, agility: 2, wisdom: 1, technique: 2 },
    [JobType.Mage]: { strength: 1, agility: 1, wisdom: 4, technique: 2 },
    [JobType.Archer]: { strength: 2, agility: 3, wisdom: 1, technique: 3 },
    [JobType.Healer]: { strength: 1, agility: 2, wisdom: 3, technique: 2 },
    [JobType.Rogue]: { strength: 2, agility: 4, wisdom: 1, technique: 2 },
    [JobType.Paladin]: { strength: 3, agility: 1, wisdom: 2, technique: 2 },
    [JobType.Berserker]: { strength: 4, agility: 2, wisdom: 1, technique: 1 },
    [JobType.Wizard]: { strength: 1, agility: 1, wisdom: 4, technique: 3 }
  };

  protected onInitialize(): void {
    // Listen for level up events
    this.eventSystem.subscribe('character_gained_experience', this.handleExperienceGain.bind(this));
    this.eventSystem.subscribe('equipment_changed', this.handleEquipmentChange.bind(this));
  }

  /**
   * Set the ItemSystem reference for equipment bonus calculations
   * This should be called after both systems are initialized
   */
  public setItemSystem(itemSystem: any): void {
    this.itemSystem = itemSystem;
  }

  public update(deltaTime: number): void {
    // Update derived stats for all characters
    const entities = this.getEntities();
    
    for (const entityId of entities) {
      this.updateDerivedStats(entityId);
    }
  }

  /**
   * Calculate and update derived stats based on primary attributes
   * Requirement 14.2: Recalculate derived stats when primary attributes change
   */
  private updateDerivedStats(entityId: EntityId): void {
    const attributes = this.getComponent(entityId, AttributeComponentType);
    const derivedStats = this.getComponent(entityId, DerivedStatsComponentType);
    const equipment = this.getComponent(entityId, EquipmentSlotsComponentType);
    
    if (!attributes || !derivedStats) return;

    // Calculate base derived stats from primary attributes
    const baseStats = this.calculateBaseDerivedStats(attributes);
    
    // Apply equipment bonuses if available
    const equipmentBonuses = equipment ? this.calculateEquipmentBonuses(equipment) : {};
    
    // Update derived stats component
    derivedStats.attack = baseStats.attack + (equipmentBonuses.attack || 0);
    derivedStats.defense = baseStats.defense + (equipmentBonuses.defense || 0);
    derivedStats.moveSpeed = baseStats.moveSpeed + (equipmentBonuses.moveSpeed || 0);
    derivedStats.dodgeRate = baseStats.dodgeRate + (equipmentBonuses.dodgeRate || 0);
    derivedStats.critRate = baseStats.critRate + (equipmentBonuses.critRate || 0);
    derivedStats.critDamage = baseStats.critDamage + (equipmentBonuses.critDamage || 0);
    derivedStats.resistance = baseStats.resistance + (equipmentBonuses.resistance || 0);
    derivedStats.magicPower = baseStats.magicPower + (equipmentBonuses.magicPower || 0);
    derivedStats.carryWeight = baseStats.carryWeight + (equipmentBonuses.carryWeight || 0);
    derivedStats.hitRate = baseStats.hitRate + (equipmentBonuses.hitRate || 0);
    derivedStats.expRate = baseStats.expRate + (equipmentBonuses.expRate || 0);
    derivedStats.healthRegen = baseStats.healthRegen + (equipmentBonuses.healthRegen || 0);
    derivedStats.manaRegen = baseStats.manaRegen + (equipmentBonuses.manaRegen || 0);
    derivedStats.weight = baseStats.weight;
    derivedStats.volume = baseStats.volume;

    // Update health and mana maximums based on new stats
    this.updateHealthAndMana(entityId, attributes, derivedStats);
  }

  /**
   * Calculate base derived stats from primary attributes
   * Each primary attribute provides specific bonuses:
   * - Strength: +1 max HP, +1 attack, +1 weight, +1 carry weight
   * - Agility: +1 max HP, +1 move speed, +0.5% dodge rate
   * - Wisdom: +1 max HP, +0.2 mana regen, +1 magic power, +0.5 resistance
   * - Technique: +1 max HP, +0.5% crit rate
   */
  private calculateBaseDerivedStats(attributes: AttributeComponent): Partial<DerivedStatsComponent> {
    return {
      attack: attributes.strength,
      defense: attributes.strength + attributes.agility,
      moveSpeed: attributes.agility,
      dodgeRate: attributes.agility * 0.5,
      critRate: attributes.technique * 0.5,
      critDamage: 125, // Base 125% (fixed value, not affected by attributes)
      resistance: attributes.wisdom * 0.5,
      magicPower: attributes.wisdom,
      carryWeight: 10 + attributes.strength,
      hitRate: 85 + attributes.technique * 0.5, // Base 85% + technique bonus
      expRate: 100, // Base 100%, can be modified by equipment
      healthRegen: attributes.strength * 0.2,
      manaRegen: attributes.wisdom * 0.2,
      weight: 70 + attributes.strength, // Base 70 + strength
      volume: 1   // Base volume
    };
  }

  /**
   * Calculate equipment bonuses from equipped items
   * Requirements: 5.1, 5.2, 5.3
   * Reads equipped items from EquipmentSlotsComponent
   * Retrieves item data from ItemSystem
   * Parses mainStat and subStats affixes
   * Calculates total bonuses for each attribute
   */
  private calculateEquipmentBonuses(equipment: EquipmentSlotsComponent): Partial<DerivedStatsComponent> {
      const bonuses: Partial<Omit<DerivedStatsComponent, 'type'>> = {};

      // Get ItemSystem to retrieve item data
      if (!this.itemSystem) {
        console.warn('[AttributeSystem] ItemSystem not available, cannot calculate equipment bonuses');
        return bonuses;
      }

      // Helper function to apply a single affix to bonuses
      const applyAffix = (affix: { attribute: string; value: number; type: 'flat' | 'percentage' }, itemName: string = 'Unknown') => {
        // Validate affix structure
        if (!affix) {
          console.warn(`[AttributeSystem] Skipping null or undefined affix on item "${itemName}"`);
          return;
        }
        
        // Validate affix has required properties
        if (!affix.attribute || typeof affix.attribute !== 'string') {
          console.warn(`[AttributeSystem] Skipping affix with missing or invalid attribute on item "${itemName}"`);
          return;
        }
        
        // Validate affix value is a number
        if (typeof affix.value !== 'number') {
          console.warn(`[AttributeSystem] Skipping affix "${affix.attribute}" with non-numeric value on item "${itemName}": ${affix.value}`);
          return;
        }
        
        // Validate affix value is not negative
        if (affix.value < 0) {
          console.warn(`[AttributeSystem] Skipping affix "${affix.attribute}" with negative value on item "${itemName}": ${affix.value}`);
          return;
        }
        
        // Validate affix value is finite
        if (!isFinite(affix.value)) {
          console.warn(`[AttributeSystem] Skipping affix "${affix.attribute}" with non-finite value on item "${itemName}": ${affix.value}`);
          return;
        }
        
        // Validate affix type
        if (affix.type !== 'flat' && affix.type !== 'percentage') {
          console.warn(`[AttributeSystem] Skipping affix "${affix.attribute}" with invalid type on item "${itemName}": ${affix.type}. Expected "flat" or "percentage".`);
          return;
        }

        // Map attribute names to DerivedStatsComponent properties
        const attributeMap: Record<string, keyof Omit<DerivedStatsComponent, 'type'>> = {
          'attack': 'attack',
          'defense': 'defense',
          'moveSpeed': 'moveSpeed',
          'dodgeRate': 'dodgeRate',
          'critRate': 'critRate',
          'critDamage': 'critDamage',
          'resistance': 'resistance',
          'magicPower': 'magicPower',
          'carryWeight': 'carryWeight',
          'hitRate': 'hitRate',
          'expRate': 'expRate',
          'healthRegen': 'healthRegen',
          'manaRegen': 'manaRegen',
          'hp': 'healthRegen', // Map HP to healthRegen for now
          'mp': 'manaRegen', // Map MP to manaRegen for now
        };

        const statKey = attributeMap[affix.attribute];
        if (!statKey) {
          console.warn(`[AttributeSystem] Unknown attribute type "${affix.attribute}" on item "${itemName}". Skipping this affix.`);
          return;
        }

        // Initialize bonus if not exists
        if (bonuses[statKey] === undefined) {
          bonuses[statKey] = 0;
        }

        // Apply flat or percentage bonus
        if (affix.type === 'flat') {
          bonuses[statKey] = (bonuses[statKey] || 0) + affix.value;
        } else if (affix.type === 'percentage') {
          // For percentage bonuses, we'll apply them as flat values for now
          // A more sophisticated system would apply percentages to base stats
          bonuses[statKey] = (bonuses[statKey] || 0) + affix.value;
        }
      };

      // Process each equipment slot
      const slots: Array<keyof EquipmentSlotsComponent> = ['weapon', 'armor', 'offhand', 'accessory'];

      for (const slot of slots) {
        const itemInstanceId = equipment[slot];

        // Skip empty slots
        if (!itemInstanceId) {
          continue;
        }

        // Get item instance from ItemSystem
        const instances = this.itemSystem.getAllItemInstances();
        const instance = instances.find((inst: any) => inst.instanceId === itemInstanceId);

        if (!instance) {
          console.warn(`[AttributeSystem] Item instance ${itemInstanceId} not found in slot ${slot}. The item may have been removed from inventory.`);
          continue;
        }

        // Get item data
        const itemData = this.itemSystem.getItem(instance.itemId);

        if (!itemData) {
          console.warn(`[AttributeSystem] Item data not found for item ${instance.itemId} in slot ${slot}. The item definition may be missing.`);
          continue;
        }
        
        const itemName = itemData.name || itemData.id || 'Unknown';

        // Handle missing affix data gracefully
        if (!itemData.mainStat && (!itemData.subStats || itemData.subStats.length === 0)) {
          console.warn(`[AttributeSystem] Item "${itemName}" in slot ${slot} has no affixes (no mainStat or subStats). Item provides no bonuses.`);
          continue;
        }

        // Apply mainStat if exists
        if (itemData.mainStat) {
          applyAffix(itemData.mainStat, itemName);
        }

        // Apply subStats if exists
        if (itemData.subStats) {
          // Validate subStats is an array
          if (!Array.isArray(itemData.subStats)) {
            console.warn(`[AttributeSystem] Item "${itemName}" has invalid subStats (not an array). Skipping subStats.`);
          } else {
            for (const subStat of itemData.subStats) {
              applyAffix(subStat, itemName);
            }
          }
        }
      }

      return bonuses;
    }


  /**
   * Update health and mana based on new attribute calculations
   * Each primary attribute adds +1 max HP
   */
  private updateHealthAndMana(entityId: EntityId, attributes: AttributeComponent, derivedStats: DerivedStatsComponent): void {
    const health = this.getComponent(entityId, HealthComponentType);
    const mana = this.getComponent(entityId, ManaComponentType);
    const level = this.getComponent(entityId, LevelComponentType);
    
    if (health && level) {
      // Base HP + (all attributes) + level bonus
      const attributeHPBonus = attributes.strength + attributes.agility + attributes.wisdom + attributes.technique;
      const newMaxHealth = 100 + attributeHPBonus + (level.level - 1) * 10;
      const healthRatio = health.current / health.maximum;
      health.maximum = newMaxHealth;
      health.current = Math.floor(newMaxHealth * healthRatio); // Maintain health percentage
    }
    
    if (mana && level) {
      const newMaxMana = 50 + (attributes.wisdom * 3) + (level.level - 1) * 5;
      const manaRatio = mana.current / mana.maximum;
      mana.maximum = newMaxMana;
      mana.current = Math.floor(newMaxMana * manaRatio); // Maintain mana percentage
    }
  }

  /**
   * Handle character gaining experience
   */
  private handleExperienceGain(event: { type: string; characterId: EntityId; experience: number }): void {
    const level = this.getComponent(event.characterId, LevelComponentType);
    if (!level) return;

    level.experience += event.experience;
    
    // Check for level up
    while (level.experience >= level.experienceToNext) {
      this.levelUpCharacter(event.characterId);
    }
  }

  /**
   * Level up a character
   * Requirement 14.1: Increase primary attributes based on job and growth rates
   */
  public levelUpCharacter(entityId: EntityId): LevelUpResult {
    const level = this.getComponent(entityId, LevelComponentType);
    const attributes = this.getComponent(entityId, AttributeComponentType);
    const job = this.getComponent(entityId, JobComponentType);
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    
    if (!level || !attributes || !job || !characterInfo) {
      return { success: false, newLevel: 0, attributeGains: {}, error: 'Missing required components' };
    }

    // Check if character is available for level up
    if (characterInfo.status !== CharacterStatus.Available) {
      return { success: false, newLevel: level.level, attributeGains: {}, error: 'Character is not available' };
    }

    // Calculate experience overflow
    const experienceOverflow = level.experience - level.experienceToNext;
    
    // Increase level
    level.level += 1;
    level.experience = experienceOverflow;
    level.experienceToNext = this.calculateExperienceToNext(level.level);

    // Calculate attribute gains based on job growth rates
    const growthRates = this.jobGrowthRates[job.currentJob];
    const attributeGains: Partial<AttributeComponent> = {
      strength: this.calculateAttributeGain(growthRates.strength),
      agility: this.calculateAttributeGain(growthRates.agility),
      wisdom: this.calculateAttributeGain(growthRates.wisdom),
      technique: this.calculateAttributeGain(growthRates.technique)
    };

    // Apply attribute gains
    attributes.strength += attributeGains.strength || 0;
    attributes.agility += attributeGains.agility || 0;
    attributes.wisdom += attributeGains.wisdom || 0;
    attributes.technique += attributeGains.technique || 0;

    // Emit level up event
    this.eventSystem.emit({
      type: 'character_level_up',
      timestamp: Date.now(),
      characterId: entityId,
      newLevel: level.level,
      attributeGains,
      job: job.currentJob
    });

    return {
      success: true,
      newLevel: level.level,
      attributeGains
    };
  }

  /**
   * Calculate experience required for next level
   */
  private calculateExperienceToNext(level: number): number {
    // Exponential growth: 100 * 1.2^(level-1)
    return Math.floor(100 * Math.pow(1.2, level - 1));
  }

  /**
   * Calculate attribute gain with some randomization
   */
  private calculateAttributeGain(baseGain: number): number {
    // Base gain with ±1 randomization
    const randomization = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    return Math.max(0, baseGain + randomization);
  }

  /**
   * Handle equipment changes
   */
  private handleEquipmentChange(event: { type: string; characterId: EntityId }): void {
    // Recalculate derived stats when equipment changes
    this.updateDerivedStats(event.characterId);
  }

  /**
   * Add experience to a character
   */
  public addExperience(entityId: EntityId, experience: number): void {
    this.eventSystem.emit({
      type: 'character_gained_experience',
      timestamp: Date.now(),
      characterId: entityId,
      experience
    });
  }

  /**
   * Get character's current stats summary
   */
  public getCharacterStats(entityId: EntityId): {
    attributes: AttributeComponent | null;
    derivedStats: DerivedStatsComponent | null;
    level: LevelComponent | null;
    health: HealthComponent | null;
    mana: ManaComponent | null;
  } {
    return {
      attributes: this.getComponent(entityId, AttributeComponentType),
      derivedStats: this.getComponent(entityId, DerivedStatsComponentType),
      level: this.getComponent(entityId, LevelComponentType),
      health: this.getComponent(entityId, HealthComponentType),
      mana: this.getComponent(entityId, ManaComponentType)
    };
  }

  /**
   * Check if character can perform actions (not injured/dead)
   * Requirement 14.4: Disable actions when health is 0
   */
  public isCharacterActive(entityId: EntityId): boolean {
    const health = this.getComponent(entityId, HealthComponentType);
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    
    if (!health || !characterInfo) return false;
    
    return health.current > 0 && characterInfo.status !== CharacterStatus.Injured;
  }

  /**
   * Set character health to 0 and mark as injured
   */
  public injureCharacter(entityId: EntityId): void {
    const health = this.getComponent(entityId, HealthComponentType);
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    
    if (health && characterInfo) {
      health.current = 0;
      characterInfo.status = CharacterStatus.Injured;
      
      this.eventSystem.emit({
        type: 'character_injured',
        timestamp: Date.now(),
        characterId: entityId
      });
    }
  }

  /**
   * Heal character and restore to available status
   */
  public healCharacter(entityId: EntityId, amount?: number): void {
    const health = this.getComponent(entityId, HealthComponentType);
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    
    if (health && characterInfo) {
      if (amount) {
        health.current = Math.min(health.maximum, health.current + amount);
      } else {
        health.current = health.maximum; // Full heal
      }
      
      if (health.current > 0 && characterInfo.status === CharacterStatus.Injured) {
        characterInfo.status = CharacterStatus.Available;
        this.eventSystem.emit({
          type: 'character_healed',
          timestamp: Date.now(),
          characterId: entityId
        });
      }
    }
  }
}