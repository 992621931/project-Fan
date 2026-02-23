/**
 * Rarity system types and configurations
 * Defines the four-tier rarity system used throughout the game
 */

export enum RarityType {
  Common = 0,    // 普通 (白色)
  Rare = 1,      // 稀有 (蓝色)  
  Epic = 2,      // 神话 (紫色)
  Legendary = 3  // 传说 (橙色)
}

export interface RarityConfig {
  type: RarityType;
  color: string;
  displayName: string;
  dropRate: number;
  attributeMultiplier: number;
}

export const RARITY_CONFIGS: Record<RarityType, RarityConfig> = {
  [RarityType.Common]: {
    type: RarityType.Common,
    color: '#9e9e9e',
    displayName: '普通',
    dropRate: 0.7,
    attributeMultiplier: 1.0
  },
  [RarityType.Rare]: {
    type: RarityType.Rare,
    color: '#0080FF',
    displayName: '稀有',
    dropRate: 0.25,
    attributeMultiplier: 1.5
  },
  [RarityType.Epic]: {
    type: RarityType.Epic,
    color: '#8000FF',
    displayName: '神话',
    dropRate: 0.04,
    attributeMultiplier: 2.0
  },
  [RarityType.Legendary]: {
    type: RarityType.Legendary,
    color: '#FF8000',
    displayName: '传说',
    dropRate: 0.01,
    attributeMultiplier: 3.0
  }
};

/**
 * Get rarity configuration by type
 */
export function getRarityConfig(rarity: RarityType): RarityConfig {
  return RARITY_CONFIGS[rarity];
}

/**
 * Get rarity color by type
 */
export function getRarityColor(rarity: RarityType): string {
  return RARITY_CONFIGS[rarity].color;
}

/**
 * Get rarity display name by type
 */
export function getRarityDisplayName(rarity: RarityType): string {
  return RARITY_CONFIGS[rarity].displayName;
}