/**
 * System-related components
 * Components that support various game systems
 */

import { Component, createComponentType } from '../../ecs/Component';
import { EntityId } from '../../ecs/Entity';
import { CurrencyAmounts } from '../types/CurrencyTypes';
import { WorkType, ShopType, GameObjectId } from '../types/GameTypes';

/**
 * Inventory component - item storage
 */
export interface InventoryComponent extends Component {
  readonly type: 'inventory';
  slots: InventorySlot[];
  capacity: number;
}

export const InventoryComponentType = createComponentType<InventoryComponent>('inventory');

/**
 * Inventory slot definition
 */
export interface InventorySlot {
  item: EntityId | null;
  quantity: number;
  locked: boolean; // Prevents item from being moved/sold
}

/**
 * Equipment slots component - worn equipment
 */
export interface EquipmentSlotsComponent extends Component {
  readonly type: 'equipmentSlots';
  weapon: EntityId | null;
  offhand: EntityId | null;
  armor: EntityId | null;
  accessory: EntityId | null;
}

export const EquipmentSlotsComponentType = createComponentType<EquipmentSlotsComponent>('equipmentSlots');

/**
 * Currency component - player's money
 */
export interface CurrencyComponent extends Component {
  readonly type: 'currency';
  amounts: CurrencyAmounts;
  transactionHistory: CurrencyTransaction[];
}

export const CurrencyComponentType = createComponentType<CurrencyComponent>('currency');

/**
 * Currency transaction record
 */
export interface CurrencyTransaction {
  type: 'gain' | 'spend';
  currency: 'gold' | 'crystal' | 'reputation';
  amount: number;
  reason: string;
  timestamp: number;
}

/**
 * Skill component - character abilities
 */
export interface SkillComponent extends Component {
  readonly type: 'skill';
  passiveSkills: Skill[];
  activeSkills: Skill[];
  jobSkills: Skill[];
  badgeSkills: Skill[];
}

export const SkillComponentType = createComponentType<SkillComponent>('skill');

/**
 * Skill definition
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  type: 'passive' | 'active' | 'job' | 'badge';
  manaCost: number;
  cooldown: number;
  effects: import('./ItemComponents').Effect[];
  requirements: SkillRequirement[];
}

/**
 * Skill learning/usage requirements
 */
export interface SkillRequirement {
  type: 'level' | 'attribute' | 'job' | 'item';
  value: string | number;
  minimum: number;
}

/**
 * Badge component - unlockable work abilities
 */
export interface BadgeComponent extends Component {
  readonly type: 'badge';
  equippedBadges: Badge[];
  availableBadges: Badge[];
}

export const BadgeComponentType = createComponentType<BadgeComponent>('badge');

/**
 * Badge definition
 */
export interface Badge {
  id: string;
  name: string;
  description: string;
  workType: WorkType;
  skills: Skill[];
  attributeBonus: Record<string, number>;
  unlocked: boolean;
}

/**
 * Work assignment component - character job assignments
 */
export interface WorkAssignmentComponent extends Component {
  readonly type: 'workAssignment';
  currentWork: WorkAssignment | null;
  workHistory: WorkAssignment[];
}

export const WorkAssignmentComponentType = createComponentType<WorkAssignmentComponent>('workAssignment');

/**
 * Work assignment definition
 */
export interface WorkAssignment {
  workType: WorkType;
  startTime: number;
  duration: number;
  efficiency: number; // 0-1 based on character abilities
  resourcesGenerated: ResourceGeneration[];
}

/**
 * Resource generation from work
 */
export interface ResourceGeneration {
  itemId: string;
  baseAmount: number;
  actualAmount: number;
}

/**
 * Shop component - player's shop
 */
export interface ShopComponent extends Component {
  readonly type: 'shop';
  shopType: ShopType;
  inventory: ShopInventorySlot[];
  reputation: number;
  customerTraffic: number;
  dailyRevenue: number;
}

export const ShopComponentType = createComponentType<ShopComponent>('shop');

/**
 * Shop inventory slot
 */
export interface ShopInventorySlot {
  item: EntityId;
  price: number;
  stock: number;
  popularity: number; // How much customers like this item
  salesCount: number;
}

/**
 * Farm component - farming system
 */
export interface FarmComponent extends Component {
  readonly type: 'farm';
  plots: FarmPlot[];
  tools: EntityId[];
  storage: EntityId[];
  soilQuality: number; // 0-100
}

export const FarmComponentType = createComponentType<FarmComponent>('farm');

/**
 * Farm plot definition
 */
export interface FarmPlot {
  id: number;
  crop: EntityId | null;
  plantTime: number;
  growthStage: number; // 0-4
  fertility: number; // 0-100
  waterLevel: number; // 0-100
  fertilized: boolean;
}

/**
 * Collection component - achievement/collection tracking
 */
export interface CollectionComponent extends Component {
  readonly type: 'collection';
  unlockedItems: Set<string>;
  unlockedCharacters: Set<string>;
  achievements: Achievement[];
  completionPercentage: number;
}

export const CollectionComponentType = createComponentType<CollectionComponent>('collection');

/**
 * Achievement definition
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  rewards: AchievementReward[];
}

/**
 * Achievement reward
 */
export interface AchievementReward {
  type: 'currency' | 'item' | 'unlock';
  value: string | number;
  amount: number;
}