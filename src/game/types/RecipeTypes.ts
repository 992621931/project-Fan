/**
 * Recipe and crafting system types
 * Defines structures for all crafting activities
 */

import { RecipeType, JobType, Quality, GameObjectId } from './GameTypes';
import { RarityType } from './RarityTypes';

/**
 * Base recipe interface
 */
export interface Recipe {
  id: string;
  name: string;
  description: string;
  type: RecipeType;
  requirements: CraftingRequirement[];
  materials: MaterialRequirement[];
  result: ItemResult;
  successRate: number; // Base success rate (0-1)
  experienceGain: number;
  craftingTime: number; // Time in seconds
  unlockConditions: UnlockCondition[];
}

/**
 * Crafting requirements (skills, tools, etc.)
 */
export interface CraftingRequirement {
  type: 'skill' | 'tool' | 'facility' | 'job';
  id: string;
  level: number;
  required: boolean;
}

/**
 * Material requirements for recipes
 */
export interface MaterialRequirement {
  itemId: string;
  quantity: number;
  qualityMin?: Quality;
  alternatives?: string[]; // Alternative item IDs
  consumeOnUse: boolean;
}

/**
 * Recipe result definition
 */
export interface ItemResult {
  itemId: string;
  baseQuantity: number;
  qualityInfluence: QualityInfluence;
  rarityChance: RarityChance[];
  bonusResults: BonusResult[];
}

/**
 * How material quality affects the result
 */
export interface QualityInfluence {
  attributeMultiplier: number; // How much quality affects item attributes
  quantityChance: number; // Chance for bonus quantity based on quality
  rarityBonus: number; // Quality bonus to rarity roll
}

/**
 * Rarity chances for crafted items
 */
export interface RarityChance {
  rarity: RarityType;
  baseChance: number; // Base chance (0-1)
  qualityBonus: number; // Bonus per quality point
  skillBonus: number; // Bonus per skill level
}

/**
 * Bonus results from crafting
 */
export interface BonusResult {
  itemId: string;
  chance: number; // 0-1
  quantity: number;
  conditions: BonusCondition[];
}

/**
 * Conditions for bonus results
 */
export interface BonusCondition {
  type: 'quality' | 'skill' | 'rarity' | 'material';
  threshold: number;
  comparison: 'greater' | 'less' | 'equal';
}

/**
 * Recipe unlock conditions
 */
export interface UnlockCondition {
  type: 'level' | 'skill' | 'item' | 'achievement' | 'reputation';
  id?: string;
  value: number;
  description: string;
}

/**
 * Equipment recipe specific data
 */
export interface EquipmentRecipe extends Recipe {
  type: RecipeType.Equipment;
  equipmentType: string;
  baseAttributes: Record<string, number>;
  enchantmentSlots: number;
}

/**
 * Food recipe specific data
 */
export interface FoodRecipe extends Recipe {
  type: RecipeType.Food;
  nutritionValue: number;
  effects: FoodEffect[];
  freshnessDuration: number; // How long food stays fresh
}

/**
 * Food effect from cooking
 */
export interface FoodEffect {
  attribute: string;
  value: number;
  duration: number; // Duration in seconds
  type: 'buff' | 'heal' | 'restore';
}

/**
 * Alchemy recipe specific data
 */
export interface AlchemyRecipe extends Recipe {
  type: RecipeType.Alchemy;
  potionType: 'healing' | 'buff' | 'utility' | 'enhancement';
  effects: AlchemyEffect[];
  volatility: number; // Chance of failure/explosion
}

/**
 * Alchemy effect
 */
export interface AlchemyEffect {
  type: 'heal' | 'buff' | 'transform' | 'enhance';
  target: string;
  value: number;
  duration: number;
  potency: number; // Strength multiplier
}

/**
 * Crafting session data
 */
export interface CraftingSession {
  recipeId: string;
  crafterId: GameObjectId;
  materials: UsedMaterial[];
  startTime: number;
  duration: number;
  qualityBonus: number;
  skillBonus: number;
  status: 'preparing' | 'crafting' | 'completed' | 'failed';
}

/**
 * Material used in crafting
 */
export interface UsedMaterial {
  itemId: string;
  quantity: number;
  quality: Quality;
  entityId: GameObjectId;
}

/**
 * Crafting result
 */
export interface CraftingResult {
  success: boolean;
  items: CraftedItem[];
  experienceGained: number;
  skillLevelUps: SkillLevelUp[];
  failureReason?: string;
}

/**
 * Crafted item result
 */
export interface CraftedItem {
  itemId: string;
  quantity: number;
  quality: Quality;
  rarity: RarityType;
  attributes: Record<string, number>;
  entityId: GameObjectId;
}

/**
 * Skill level up from crafting
 */
export interface SkillLevelUp {
  skillId: string;
  oldLevel: number;
  newLevel: number;
  bonusUnlocked: string[];
}