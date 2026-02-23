/**
 * Affix system types and configurations
 * Defines types for the equipment affix system
 */

import { RarityType } from './RarityTypes';

export enum AffixType {
  Strength = 'strength',
  Agility = 'agility',
  Wisdom = 'wisdom',
  Skill = 'skill',
  Attack = 'attack',
  Defense = 'defense',
  CritRate = 'critRate',
  CritDamage = 'critDamage',
  DodgeRate = 'dodgeRate',
  MoveSpeed = 'moveSpeed',
  MagicPower = 'magicPower',
  CarryWeight = 'carryWeight',
  Resistance = 'resistance',
  ExperienceRate = 'experienceRate',
  HPRegen = 'hpRegen',
  MPRegen = 'mpRegen',
  BodyWeight = 'bodyWeight',
  BodySize = 'bodySize'
}

export interface AffixDefinition {
  type: AffixType;
  rarity: RarityType;
  displayName: string;
  minValue: number;
  maxValue: number;
  isPercentage: boolean;
  decimalPlaces: number;
}

export interface AppliedAffix {
  type: AffixType;
  rarity: RarityType;
  displayName: string;
  value: number;
  isPercentage: boolean;
  minValue?: number;
  maxValue?: number;
}

export interface AffixPoolConfig {
  common: AffixDefinition[];
  rare: AffixDefinition[];
  epic: AffixDefinition[];
  legendary: AffixDefinition[];
}

export interface AffixProbabilityConfig {
  [RarityType.Common]: {
    [RarityType.Common]: number;
    [RarityType.Rare]: number;
  };
  [RarityType.Rare]: {
    [RarityType.Common]: number;
    [RarityType.Rare]: number;
    [RarityType.Epic]: number;
  };
  [RarityType.Epic]: {
    [RarityType.Common]: number;
    [RarityType.Rare]: number;
    [RarityType.Epic]: number;
    [RarityType.Legendary]: number;
  };
  [RarityType.Legendary]: {
    [RarityType.Common]: number;
    [RarityType.Rare]: number;
    [RarityType.Epic]: number;
    [RarityType.Legendary]: number;
  };
}

export const AFFIX_PROBABILITY_CONFIG: AffixProbabilityConfig = {
  [RarityType.Common]: {
    [RarityType.Common]: 0.90,
    [RarityType.Rare]: 0.10
  },
  [RarityType.Rare]: {
    [RarityType.Common]: 0.50,
    [RarityType.Rare]: 0.40,
    [RarityType.Epic]: 0.10
  },
  [RarityType.Epic]: {
    [RarityType.Common]: 0.15,
    [RarityType.Rare]: 0.50,
    [RarityType.Epic]: 0.30,
    [RarityType.Legendary]: 0.05
  },
  [RarityType.Legendary]: {
    [RarityType.Common]: 0.05,
    [RarityType.Rare]: 0.15,
    [RarityType.Epic]: 0.50,
    [RarityType.Legendary]: 0.30
  }
};

/**
 * Number of affixes (副词条) generated per equipment rarity
 * 普通: 1, 稀有: 2, 神话: 3, 传说: 4
 */
export const RARITY_AFFIX_COUNT: Record<RarityType, number> = {
  [RarityType.Common]: 1,
  [RarityType.Rare]: 2,
  [RarityType.Epic]: 3,
  [RarityType.Legendary]: 4
};
