/**
 * Party-related components
 * Components that define party composition and exploration states
 */

import { Component, createComponentType } from '../../ecs/Component';
import { EntityId } from '../../ecs/Entity';
import { FormationType, EncounterType, GameObjectId } from '../types/GameTypes';

/**
 * Party component - defines a party of characters
 */
export interface PartyComponent extends Component {
  readonly type: 'party';
  members: EntityId[];
  leader: EntityId | null;
  formation: FormationType;
  maxSize: number;
  isActive: boolean; // Whether the party is currently exploring
}

export const PartyComponentType = createComponentType<PartyComponent>('party');

/**
 * Party member component - marks a character as part of a party
 */
export interface PartyMemberComponent extends Component {
  readonly type: 'partyMember';
  partyId: EntityId;
  position: number; // Position in party (0-based)
  isLeader: boolean;
}

export const PartyMemberComponentType = createComponentType<PartyMemberComponent>('partyMember');

/**
 * Exploration component - tracks exploration state
 */
export interface ExplorationComponent extends Component {
  readonly type: 'exploration';
  currentDungeon: GameObjectId | null;
  currentFloor: number;
  startTime: number;
  estimatedDuration: number;
  status: ExplorationStatus;
}

export const ExplorationComponentType = createComponentType<ExplorationComponent>('exploration');

/**
 * Exploration status
 */
export enum ExplorationStatus {
  Preparing = 'preparing',
  Exploring = 'exploring',
  InCombat = 'in_combat',
  Completed = 'completed',
  Failed = 'failed',
  Retreated = 'retreated'
}

/**
 * Combat state component - tracks combat information
 */
export interface CombatStateComponent extends Component {
  readonly type: 'combatState';
  isInCombat: boolean;
  combatId: GameObjectId | null;
  turnOrder: EntityId[];
  currentTurn: number;
  roundNumber: number;
}

export const CombatStateComponentType = createComponentType<CombatStateComponent>('combatState');

/**
 * Dungeon component - defines dungeon properties
 */
export interface DungeonComponent extends Component {
  readonly type: 'dungeon';
  name: string;
  difficulty: number; // 1-10 scale
  floors: DungeonFloor[];
  requirements: DungeonRequirement[];
  rewards: DungeonReward[];
}

export const DungeonComponentType = createComponentType<DungeonComponent>('dungeon');

/**
 * Dungeon floor definition
 */
export interface DungeonFloor {
  floor: number;
  encounters: Encounter[];
  bossEncounter?: Encounter;
}

/**
 * Encounter definition
 */
export interface Encounter {
  id: string;
  type: EncounterType;
  enemies?: EnemyDefinition[];
  eventId?: string;
  treasureId?: string;
  difficulty: number;
}

/**
 * Enemy definition
 */
export interface EnemyDefinition {
  id: string;
  name: string;
  level: number;
  health: number;
  attack: number;
  defense: number;
  skills: string[];
  dropTable: DropEntry[];
}

/**
 * Drop table entry
 */
export interface DropEntry {
  itemId: string;
  dropRate: number; // 0-1
  quantity: { min: number; max: number };
}

/**
 * Dungeon requirement
 */
export interface DungeonRequirement {
  type: 'level' | 'party_size' | 'job' | 'item';
  value: string | number;
  minimum: number;
}

/**
 * Dungeon reward
 */
export interface DungeonReward {
  type: 'experience' | 'currency' | 'item';
  value: string | number;
  amount: number;
  condition?: string; // Optional condition for reward
}