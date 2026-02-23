/**
 * Core game types and enums
 * Defines fundamental game concepts used across systems
 */

import { RarityType } from './RarityTypes';

// Job/Profession types
export enum JobType {
  None = 'none',
  Warrior = 'warrior',
  Mage = 'mage',
  Ranger = 'ranger',
  Priest = 'priest',
  Berserker = 'berserker',
  Guardian = 'guardian',
  Elementalist = 'elementalist',
  Warlock = 'warlock',
  Hunter = 'hunter',
  Dancer = 'dancer',
  DivineMessenger = 'divine_messenger',
  DarkMessenger = 'dark_messenger'
}


// Skill types
export enum SkillType {
  Passive = 'passive',
  Active = 'active',
  Job = 'job',
  Badge = 'badge'
}

// Equipment slot types
export enum EquipmentSlot {
  Weapon = 'weapon',
  Offhand = 'offhand',
  Armor = 'armor',
  Accessory = 'accessory'
}

// Item types
export enum ItemType {
  Equipment = 'equipment',
  Consumable = 'consumable',
  Material = 'material',
  Food = 'food',
  Potion = 'potion',
  Gem = 'gem',
  Seed = 'seed',
  Tool = 'tool'
}

// Material types for crafting
export enum MaterialType {
  Metal = 'metal',
  Wood = 'wood',
  Cloth = 'cloth',
  Leather = 'leather',
  Herb = 'herb',
  Gem = 'gem',
  Food = 'food',
  Liquid = 'liquid'
}

// Recipe types
export enum RecipeType {
  Equipment = 'equipment',
  Food = 'food',
  Alchemy = 'alchemy'
}

// Work types for character assignments
export enum WorkType {
  Mining = 'mining',
  Logging = 'logging',
  Farming = 'farming',
  Crafting = 'crafting',
  Cooking = 'cooking',
  Alchemy = 'alchemy',
  Trading = 'trading',
  Research = 'research'
}

// Recruitment types
export enum RecruitmentType {
  Gold = 'gold',
  RareTicket = 'rare_ticket',
  EpicTicket = 'epic_ticket',
  LegendaryTicket = 'legendary_ticket'
}

// Character status
export enum CharacterStatus {
  Available = 'available',
  Working = 'working',
  Exploring = 'exploring',
  Injured = 'injured',
  Resting = 'resting'
}

// Shop types
export enum ShopType {
  General = 'general',
  Equipment = 'equipment',
  Food = 'food',
  Materials = 'materials',
  Specialty = 'specialty'
}

// Crop growth stages
export enum GrowthStage {
  Seed = 0,
  Sprout = 1,
  Growing = 2,
  Mature = 3,
  Ready = 4
}

// Seasons affecting farming
export enum Season {
  Spring = 'spring',
  Summer = 'summer',
  Autumn = 'autumn',
  Winter = 'winter'
}

// Combat encounter types
export enum EncounterType {
  Combat = 'combat',
  Event = 'event',
  Treasure = 'treasure',
  Boss = 'boss'
}

// Formation types for parties
export enum FormationType {
  Balanced = 'balanced',
  Offensive = 'offensive',
  Defensive = 'defensive',
  Support = 'support'
}

/**
 * Generic identifier type for game objects
 */
export type GameObjectId = string;

/**
 * Base interface for all game objects
 */
export interface BaseGameObject {
  id: GameObjectId;
  name: string;
  description?: string;
}

/**
 * Interface for objects with rarity
 */
export interface RarityObject extends BaseGameObject {
  rarity: RarityType;
}

/**
 * Quality rating for items (0-100)
 */
export type Quality = number;

/**
 * Timestamp type for game events
 */
export type GameTimestamp = number;