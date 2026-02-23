/**
 * Character-related components
 * Components that define character properties and states
 */

import { Component, createComponentType } from '../../ecs/Component';
import { RarityType } from '../types/RarityTypes';
import { JobType, CharacterStatus, GameObjectId } from '../types/GameTypes';

/**
 * Basic attributes component - primary stats
 */
export interface AttributeComponent extends Component {
  readonly type: 'attribute';
  strength: number;      // 力量
  agility: number;       // 敏捷
  wisdom: number;        // 智慧
  technique: number;     // 技巧
}

export const AttributeComponentType = createComponentType<AttributeComponent>('attribute');

/**
 * Derived stats component - calculated from primary attributes
 */
export interface DerivedStatsComponent extends Component {
  readonly type: 'derivedStats';
  attack: number;        // 攻击力
  defense: number;       // 防御力
  moveSpeed: number;     // 移动速度
  dodgeRate: number;     // 闪避率
  critRate: number;      // 暴击率
  critDamage: number;    // 暴击伤害
  resistance: number;    // 抗性
  magicPower: number;    // 魔法强度
  carryWeight: number;   // 负重
  hitRate: number;       // 命中率
  expRate: number;       // 经验率
  healthRegen: number;   // 生命恢复
  manaRegen: number;     // 魔法恢复
  weight: number;        // 体重
  volume: number;        // 体积
}

export const DerivedStatsComponentType = createComponentType<DerivedStatsComponent>('derivedStats');

/**
 * Health component - current and maximum health
 */
export interface HealthComponent extends Component {
  readonly type: 'health';
  current: number;
  maximum: number;
}

export const HealthComponentType = createComponentType<HealthComponent>('health');

/**
 * Mana component - current and maximum mana
 */
export interface ManaComponent extends Component {
  readonly type: 'mana';
  current: number;
  maximum: number;
}

export const ManaComponentType = createComponentType<ManaComponent>('mana');

/**
 * Hunger component - current and maximum hunger/satiety
 * Represents a character's hunger/satiety level
 * 
 * @property {number} current - Current hunger value (0 to maximum)
 * @property {number} maximum - Maximum hunger value (typically 100)
 */
export interface HungerComponent extends Component {
  readonly type: 'hunger';
  current: number;
  maximum: number;
}

/**
 * Component type definition for HungerComponent
 * Used for ECS component registration and retrieval
 */
export const HungerComponentType = createComponentType<HungerComponent>('hunger');

/**
 * Level component - character progression
 */
export interface LevelComponent extends Component {
  readonly type: 'level';
  level: number;
  experience: number;
  experienceToNext: number;
}

export const LevelComponentType = createComponentType<LevelComponent>('level');

/**
 * Character info component - basic character information
 */
export interface CharacterInfoComponent extends Component {
  readonly type: 'characterInfo';
  title: string;         // 称号
  name: string;          // 名字
  isSpecial: boolean;    // 是否特殊角色
  rarity: RarityType;    // 稀有度
  status: CharacterStatus; // 当前状态
}

export const CharacterInfoComponentType = createComponentType<CharacterInfoComponent>('characterInfo');

/**
 * Job component - character profession and experience
 */
export interface JobComponent extends Component {
  readonly type: 'job';
  currentJob: JobType;
  availableJobs: JobType[];
  jobExperience: Map<JobType, number>;
}

export const JobComponentType = createComponentType<JobComponent>('job');

/**
 * Affinity component - relationships with other characters
 */
export interface AffinityComponent extends Component {
  readonly type: 'affinity';
  relationships: Map<GameObjectId, number>; // Character ID -> affinity level
}

export const AffinityComponentType = createComponentType<AffinityComponent>('affinity');