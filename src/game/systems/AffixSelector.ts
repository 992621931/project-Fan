/**
 * AffixSelector service
 * Selects and generates affixes for equipment based on rarity
 */

import { RarityType } from '../types/RarityTypes';
import {
  AffixDefinition,
  AppliedAffix,
  AffixPoolConfig,
  AffixProbabilityConfig,
  RARITY_AFFIX_COUNT
} from '../types/AffixTypes';

export class AffixSelector {
  private affixPool: AffixPoolConfig;
  private probabilityConfig: AffixProbabilityConfig;

  constructor(affixPool: AffixPoolConfig, probabilityConfig: AffixProbabilityConfig) {
    this.affixPool = affixPool;
    this.probabilityConfig = probabilityConfig;
  }

  /**
   * Select and generate an affix for equipment
   */
  selectAffix(equipmentRarity: RarityType): AppliedAffix {
    try {
      // Select affix rarity based on equipment rarity
      const affixRarity = this.selectAffixRarity(equipmentRarity);
      
      // Select random affix from the selected rarity tier
      const affixDefinition = this.selectAffixFromTier(affixRarity);
      
      // Generate random value within affix range
      const value = this.generateAffixValue(affixDefinition);
      
      // Return applied affix
      return {
        type: affixDefinition.type,
        rarity: affixDefinition.rarity,
        displayName: affixDefinition.displayName,
        value,
        isPercentage: affixDefinition.isPercentage,
        minValue: affixDefinition.minValue,
        maxValue: affixDefinition.maxValue
      };
    } catch (error) {
      throw new Error(`Failed to select affix: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Select multiple affixes based on equipment rarity
   * 普通: 1, 稀有: 2, 神话: 3, 传说: 4
   * Each affix has a unique type (no duplicate attribute types)
   */
  selectAffixes(equipmentRarity: RarityType): AppliedAffix[] {
    const count = RARITY_AFFIX_COUNT[equipmentRarity] ?? 1;
    const affixes: AppliedAffix[] = [];
    const usedTypes = new Set<string>();
    const maxAttempts = count * 10; // Prevent infinite loop
    let attempts = 0;

    while (affixes.length < count && attempts < maxAttempts) {
      attempts++;
      try {
        const affix = this.selectAffix(equipmentRarity);
        // Ensure no duplicate affix types
        if (!usedTypes.has(affix.type)) {
          usedTypes.add(affix.type);
          affixes.push(affix);
        }
      } catch (error) {
        console.warn(`Failed to select affix (attempt ${attempts}):`, error);
      }
    }

    return affixes;
  }

  /**
   * Select affix rarity based on equipment rarity using weighted random selection
   */
  private selectAffixRarity(equipmentRarity: RarityType): RarityType {
    // Get probability distribution for equipment rarity
    const probabilities = this.probabilityConfig[equipmentRarity];
    
    if (!probabilities) {
      // Default to Common rarity if equipment rarity is invalid
      console.warn(`Invalid equipment rarity: ${equipmentRarity}, defaulting to Common`);
      return RarityType.Common;
    }
    
    // Generate random number between 0 and 1
    const random = Math.random();
    
    // Weighted random selection
    let cumulativeProbability = 0;
    for (const [rarityStr, probability] of Object.entries(probabilities)) {
      cumulativeProbability += probability;
      if (random < cumulativeProbability) {
        return parseInt(rarityStr) as RarityType;
      }
    }
    
    // Fallback to last rarity in distribution (should never reach here if probabilities sum to 1)
    const rarities = Object.keys(probabilities).map(r => parseInt(r) as RarityType);
    return rarities[rarities.length - 1];
  }

  /**
   * Select random affix from rarity tier with uniform distribution
   */
  private selectAffixFromTier(affixRarity: RarityType): AffixDefinition {
    let affixPool: AffixDefinition[];
    
    switch (affixRarity) {
      case RarityType.Common:
        affixPool = this.affixPool.common;
        break;
      case RarityType.Rare:
        affixPool = this.affixPool.rare;
        break;
      case RarityType.Epic:
        affixPool = this.affixPool.epic;
        break;
      case RarityType.Legendary:
        affixPool = this.affixPool.legendary;
        break;
      default:
        // Fallback to common if rarity is invalid
        affixPool = this.affixPool.common;
    }
    
    if (!affixPool || affixPool.length === 0) {
      throw new Error(`Empty affix pool for rarity: ${affixRarity}`);
    }
    
    // Uniform random selection
    const randomIndex = Math.floor(Math.random() * affixPool.length);
    return affixPool[randomIndex];
  }

  /**
   * Generate random value within affix range respecting decimal precision
   */
  private generateAffixValue(definition: AffixDefinition): number {
    const { minValue, maxValue, decimalPlaces } = definition;
    
    // Generate random value in range [minValue, maxValue]
    const rawValue = minValue + Math.random() * (maxValue - minValue);
    
    // Round to specified decimal places
    if (decimalPlaces === 0) {
      return Math.round(rawValue);
    } else {
      const multiplier = Math.pow(10, decimalPlaces);
      return Math.round(rawValue * multiplier) / multiplier;
    }
  }
}
