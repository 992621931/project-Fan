/**
 * Item-related components
 * Components that define item properties and behaviors
 */

import { Component, createComponentType } from '../../ecs/Component';
import { RarityType } from '../types/RarityTypes';
import { ItemType, MaterialType, EquipmentSlot, Quality, GameObjectId } from '../types/GameTypes';
import { AppliedAffix } from '../types/AffixTypes';

/**
 * Basic item component - fundamental item properties
 */
export interface ItemComponent extends Component {
  readonly type: 'item';
  id: string;
  name: string;
  description: string;
  rarity: RarityType;
  itemType: ItemType;
  stackSize: number;
  value: number; // Base gold value
  quality: Quality; // 0-100 quality rating
}

export const ItemComponentType = createComponentType<ItemComponent>('item');

/**
 * Equipment component - for wearable items
 */
export interface EquipmentComponent extends Component {
  readonly type: 'equipment';
  slot: EquipmentSlot;
  attributeModifiers: AttributeModifier[];
  requirements: EquipmentRequirement[];
  durability: number;
  maxDurability: number;
  affix?: AppliedAffix | AppliedAffix[];
}

export const EquipmentComponentType = createComponentType<EquipmentComponent>('equipment');

/**
 * Attribute modifier for equipment
 */
export interface AttributeModifier {
  attribute: string; // e.g., 'strength', 'attack', 'defense'
  value: number;
  type: 'flat' | 'percentage';
}

/**
 * Equipment requirements
 */
export interface EquipmentRequirement {
  type: 'level' | 'attribute' | 'job';
  value: number | string;
  minimum: number;
}

/**
 * Consumable component - for usable items
 */
export interface ConsumableComponent extends Component {
  readonly type: 'consumable';
  effects: Effect[];
  duration: number; // Duration in seconds, 0 for instant
  cooldown: number; // Cooldown in seconds
  charges: number; // Number of uses, -1 for unlimited
}

export const ConsumableComponentType = createComponentType<ConsumableComponent>('consumable');

/**
 * Time-based condition for conditional effects
 */
export interface TimeCondition {
  type: 'time_of_day';
  value: 'day' | 'night';
}

/**
 * Effect interface for consumables and skills
 */
export interface Effect {
  type: 'heal' | 'buff' | 'debuff' | 'damage' | 'restore' | 'attribute_bonus' | 'percentage_modifier' | 'conditional_bonus';
  target: 'self' | 'ally' | 'enemy' | 'all_allies' | 'all_enemies';
  attribute: string; // What attribute is affected
  value: number;
  duration: number; // Duration in seconds, 0 for instant
  condition?: TimeCondition; // Optional condition for conditional effects
}


/**
 * Material component - for crafting materials
 */
export interface MaterialComponent extends Component {
  readonly type: 'material';
  materialType: MaterialType;
  quality: Quality;
  purity: number; // 0-100, affects crafting results
}

export const MaterialComponentType = createComponentType<MaterialComponent>('material');

/**
 * Food component - for consumable food items
 */
export interface FoodComponent extends Component {
  readonly type: 'food';
  nutritionValue: number;
  freshness: number; // 0-100, decreases over time
  effects: Effect[];
  cookingLevel: number; // Required cooking skill level
}

export const FoodComponentType = createComponentType<FoodComponent>('food');

/**
 * Seed component - for plantable items
 */
export interface SeedComponent extends Component {
  readonly type: 'seed';
  cropType: string;
  growthTime: number; // Time in seconds to fully grow
  yield: ItemYield[];
  seasonPreference: string[]; // Preferred seasons for growth
  soilRequirement: number; // Required soil quality (0-100)
}

export const SeedComponentType = createComponentType<SeedComponent>('seed');

/**
 * Item yield for seeds and recipes
 */
export interface ItemYield {
  itemId: string;
  quantity: number;
  chance: number; // 0-1 probability
}

/**
 * Stack component - for stackable items
 */
export interface StackComponent extends Component {
  readonly type: 'stack';
  currentStack: number;
  maxStack: number;
}

export const StackComponentType = createComponentType<StackComponent>('stack');