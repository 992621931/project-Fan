/**
 * Configuration system types
 * Defines the structure of all game configuration data
 */

import { Recipe, EquipmentRecipe, FoodRecipe, AlchemyRecipe } from '../types/RecipeTypes';
import { RarityType } from '../types/RarityTypes';
import { JobType, ItemType, WorkType } from '../types/GameTypes';

/**
 * Main game configuration interface
 */
export interface GameConfig {
  version: string;
  characters: CharacterConfig[];
  items: ItemConfig[];
  recipes: Recipe[];
  dungeons: DungeonConfig[];
  jobs: JobConfig[];
  skills: SkillConfig[];
  achievements: AchievementConfig[];
  shops: ShopConfig[];
  crops: CropConfig[];
  exclusiveSkills: ExclusiveSkillConfig[];
  otherworldCharacters: OtherworldCharacterConfig[];
}

/**
 * Character configuration
 */
export interface CharacterConfig {
  id: string;
  name: string;
  title: string;
  rarity: RarityType;
  isSpecial: boolean;
  baseAttributes: {
    strength: number;
    agility: number;
    wisdom: number;
    technique: number;
  };
  startingJob: JobType;
  availableJobs: JobType[];
  description: string;
  portrait?: string;
}

/**
 * Item configuration
 */
export interface ItemConfig {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: RarityType;
  stackSize: number;
  baseValue: number;
  icon?: string;
  // Equipment specific
  equipmentSlot?: string;
  attributeModifiers?: Array<{
    attribute: string;
    value: number;
    type: 'flat' | 'percentage';
  }>;
  // Consumable specific
  effects?: Array<{
    type: string;
    attribute: string;
    value: number;
    duration: number;
  }>;
  // Material specific
  materialType?: string;
  quality?: number;
}

/**
 * Dungeon configuration
 */
export interface DungeonConfig {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  requiredLevel: number;
  encounters: EncounterConfig[];
  rewards: RewardConfig[];
  unlockConditions: UnlockConditionConfig[];
}

/**
 * Encounter configuration
 */
export interface EncounterConfig {
  id: string;
  type: 'combat' | 'event' | 'treasure' | 'boss';
  enemies?: EnemyConfig[];
  eventId?: string;
  rewards?: RewardConfig[];
  weight: number; // Probability weight
}

/**
 * Enemy configuration
 */
export interface EnemyConfig {
  id: string;
  name: string;
  level: number;
  attributes: {
    strength: number;
    agility: number;
    wisdom: number;
    technique: number;
  };
  health: number;
  skills: string[];
  dropTable: RewardConfig[];
}

/**
 * Reward configuration
 */
export interface RewardConfig {
  type: 'item' | 'currency' | 'experience';
  id?: string; // Item ID for item rewards
  currency?: 'gold' | 'crystal' | 'reputation';
  amount: number;
  chance: number; // 0-1 probability
}

/**
 * Job configuration
 */
export interface JobConfig {
  id: JobType;
  name: string;
  description: string;
  attributeGrowth: {
    strength: number;
    agility: number;
    wisdom: number;
    technique: number;
  };
  skills: string[]; // Skill IDs
  unlockConditions: UnlockConditionConfig[];
  workTypes: WorkType[];
}

/**
 * Skill configuration
 */
export interface SkillConfig {
  id: string;
  name: string;
  description: string;
  type: 'passive' | 'active' | 'job' | 'badge' | 'exclusive';
  maxLevel: number;
  manaCost: number;
  cooldown: number;
  effects: Array<{
    type: string;
    target: string;
    attribute: string;
    value: number;
    duration: number;
  }>;
  learnConditions: UnlockConditionConfig[];
}

/**
 * Projectile direction configuration
 */
export interface ProjectileDirection {
  type: 'horizontal' | 'vertical' | 'diagonal' | 'custom';
  angle?: number; // Custom angle in degrees
  side?: 'left' | 'right' | 'up' | 'down'; // Preset direction
}

/**
 * Projectile configuration
 */
export interface ProjectileConfig {
  image: string; // Projectile image path
  speed: number; // Movement speed (pixels/second)
  lifetime: number; // Lifetime in seconds
  directions: ProjectileDirection[]; // Launch directions
  rotateWithDirection: boolean; // Whether to rotate with movement direction
  collisionBehavior: 'destroy' | 'pierce' | 'bounce'; // Collision behavior
}

/**
 * Damage formula configuration
 */
export interface DamageFormulaConfig {
  baseDamage: number; // Base damage
  attackScaling: number; // Attack power scaling percentage (1.25 = 125%)
  attributeType: 'attack' | 'magicPower' | 'technique'; // Attribute type to use
}

/**
 * Particle effect configuration
 */
export interface ParticleEffectConfig {
  type: 'explosion' | 'trail' | 'aura' | 'impact';
  color: string; // Color (CSS color value or preset)
  trigger: 'onHit' | 'onCast' | 'continuous'; // Trigger timing
  position: 'caster' | 'target' | 'projectile'; // Effect position
  intensity: number; // Intensity (0-1)
  duration: number; // Duration in seconds
}

/**
 * Exclusive skill configuration
 */
export interface ExclusiveSkillConfig extends SkillConfig {
  type: 'exclusive'; // Fixed as 'exclusive'
  icon: string; // Skill icon path
  tags: string[]; // Skill tags
  projectile?: ProjectileConfig; // Projectile configuration (optional)
  damageFormula?: DamageFormulaConfig; // Damage calculation (optional)
  particleEffects?: ParticleEffectConfig[]; // Particle effects list (optional)
}

/**
 * Initial state configuration
 */
export interface InitialStateConfig {
  level: number; // Initial level
  maxHealth: number; // Maximum health
  maxMana: number; // Maximum mana
  maxHunger: number; // Maximum hunger
}

/**
 * Initial skills configuration
 */
export interface InitialSkillsConfig {
  passive: string[]; // Passive skill ID list
  active: string[]; // Active skill ID list
}

/**
 * Combat stats override for otherworld characters
 * Allows overriding calculated secondary attributes with custom values
 */
export interface CombatStatsOverride {
  attack?: number;
  defense?: number;
  moveSpeed?: number;
  dodgeRate?: number;
  critRate?: number;
  critDamage?: number;
  resistance?: number;
  magicPower?: number;
  carryWeight?: number;
  volume?: number;
  expRate?: number;
  healthRegen?: number;
  manaRegen?: number;
  weight?: number;
}

/**
 * Otherworld character configuration
 */
export interface OtherworldCharacterConfig extends CharacterConfig {
  characterTypes: string[]; // Character type tags (e.g., ["异界", "冒险者"])
  portrait: string; // Portrait image path
  initialState: InitialStateConfig; // Initial state
  initialSkills: InitialSkillsConfig; // Initial skills
  combatStats?: CombatStatsOverride; // Optional combat stats override
}

/**
 * Achievement configuration
 */
export interface AchievementConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  conditions: AchievementConditionConfig[];
  rewards: RewardConfig[];
  hidden: boolean;
}

/**
 * Achievement condition
 */
export interface AchievementConditionConfig {
  type: 'collect' | 'craft' | 'level' | 'complete' | 'earn';
  target: string;
  amount: number;
}

/**
 * Shop configuration
 */
export interface ShopConfig {
  id: string;
  name: string;
  type: 'general' | 'equipment' | 'food' | 'materials' | 'specialty';
  items: ShopItemConfig[];
  unlockConditions: UnlockConditionConfig[];
}

/**
 * Shop item configuration
 */
export interface ShopItemConfig {
  itemId: string;
  basePrice: number;
  stock: number; // -1 for unlimited
  restockTime: number; // Hours
  popularity: number; // 0-1
}

/**
 * Crop configuration
 */
export interface CropConfig {
  id: string;
  name: string;
  description: string;
  seedItemId: string;
  growthTime: number; // Hours
  seasons: string[];
  yield: Array<{
    itemId: string;
    minAmount: number;
    maxAmount: number;
    chance: number;
  }>;
  soilRequirement: number; // 0-100
}

/**
 * Generic unlock condition
 */
export interface UnlockConditionConfig {
  type: 'level' | 'skill' | 'item' | 'achievement' | 'reputation' | 'story';
  id?: string;
  value: number;
  description: string;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  type: 'missing_field' | 'invalid_type' | 'invalid_value' | 'missing_reference' | 'duplicate_id';
  path: string;
  message: string;
  value?: any;
}

/**
 * Configuration validation warning
 */
export interface ConfigValidationWarning {
  type: 'unused_reference' | 'balance_concern' | 'missing_optional';
  path: string;
  message: string;
  value?: any;
}