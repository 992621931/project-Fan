/**
 * Combat System - Handles battle logic, damage calculation, and experience distribution
 * Manages combat encounters, turn order, and battle results
 */

import { System } from '../../ecs/System';
import { EntityId } from '../../ecs/Entity';
import { ComponentType } from '../../ecs/Component';
import {
  AttributeComponent,
  AttributeComponentType,
  DerivedStatsComponent,
  DerivedStatsComponentType,
  HealthComponent,
  HealthComponentType,
  ManaComponent,
  ManaComponentType,
  LevelComponent,
  LevelComponentType,
  CharacterInfoComponent,
  CharacterInfoComponentType
} from '../components/CharacterComponents';
import {
  PartyComponent,
  PartyComponentType,
  CombatStateComponent,
  CombatStateComponentType,
  EnemyDefinition,
  Encounter
} from '../components/PartyComponents';
import { CharacterStatus, GameObjectId } from '../types/GameTypes';

/**
 * Combat result information
 */
export interface CombatResult {
  victory: boolean;
  survivors: EntityId[];
  casualties: EntityId[];
  experienceGained: number;
  loot: GameObjectId[];
  combatLog: string[];
}

/**
 * Damage calculation result
 */
export interface DamageResult {
  damage: number;
  isCritical: boolean;
  isBlocked: boolean;
  actualDamage: number;
}

/**
 * Combat participant (character or enemy)
 */
export interface CombatParticipant {
  id: EntityId;
  name: string;
  isEnemy: boolean;
  health: { current: number; maximum: number };
  mana: { current: number; maximum: number };
  stats: DerivedStatsComponent;
  level: number;
  isAlive: boolean;
}

/**
 * Combat turn action
 */
export interface CombatAction {
  actorId: EntityId;
  targetId: EntityId;
  actionType: 'attack' | 'skill' | 'defend' | 'flee';
  skillId?: string;
  damage?: number;
  effects?: string[];
}

/**
 * Combat System implementation
 */
export class CombatSystem extends System {
  public readonly name = 'CombatSystem';
  public readonly requiredComponents: ComponentType<any>[] = [CombatStateComponentType];

  private activeCombats: Map<GameObjectId, CombatState> = new Map();
  private combatIdCounter = 0;

  protected onInitialize(): void {
    // Listen for combat-related events
    this.eventSystem.subscribe('combat_started', this.handleCombatStarted.bind(this));
    this.eventSystem.subscribe('combat_ended', this.handleCombatEnded.bind(this));
    this.eventSystem.subscribe('character_death', this.handleCharacterDeath.bind(this));
  }

  public update(deltaTime: number): void {
    // Update active combats
    for (const [combatId, combat] of this.activeCombats) {
      this.updateCombat(combatId, combat, deltaTime);
    }
  }

  /**
   * Start combat between a party and enemies
   */
  public startCombat(partyId: EntityId, encounter: Encounter): GameObjectId | null {
    const party = this.getComponent(partyId, PartyComponentType);
    if (!party || !party.isActive) {
      return null;
    }

    // Create combat ID
    const combatId = `combat_${++this.combatIdCounter}`;

    // Get party members
    const partyMembers = this.getPartyMembers(party);
    if (partyMembers.length === 0) {
      return null;
    }

    // Create enemy entities
    const enemies = this.createEnemies(encounter.enemies || []);

    // Initialize combat state
    const combatState: CombatState = {
      id: combatId,
      partyId,
      participants: [...partyMembers, ...enemies],
      turnOrder: this.calculateTurnOrder([...partyMembers, ...enemies]),
      currentTurn: 0,
      roundNumber: 1,
      isActive: true,
      combatLog: [`Combat started! ${partyMembers.length} heroes vs ${enemies.length} enemies.`]
    };

    // Add combat state component to party
    const combatComponent: CombatStateComponent = {
      type: 'combatState',
      isInCombat: true,
      combatId,
      turnOrder: combatState.turnOrder.map(p => p.id),
      currentTurn: 0,
      roundNumber: 1
    };

    this.componentManager.addComponent(partyId, CombatStateComponentType, combatComponent);

    // Store active combat
    this.activeCombats.set(combatId, combatState);

    // Update character statuses
    partyMembers.forEach(member => {
      this.updateCharacterStatus(member.id, CharacterStatus.Exploring);
    });

    this.eventSystem.emit('combat_started', { combatId, partyId, encounter });
    return combatId;
  }

  /**
   * End combat and return results
   */
  public endCombat(combatId: GameObjectId, victory: boolean): CombatResult {
    const combat = this.activeCombats.get(combatId);
    if (!combat) {
      throw new Error(`Combat ${combatId} not found`);
    }

    const partyMembers = combat.participants.filter(p => !p.isEnemy);
    const enemies = combat.participants.filter(p => p.isEnemy);

    // Calculate results
    const survivors = partyMembers.filter(p => p.isAlive).map(p => p.id);
    const casualties = partyMembers.filter(p => !p.isAlive).map(p => p.id);

    // Calculate experience gain
    const experienceGained = victory ? this.calculateExperienceGain(enemies, partyMembers) : 0;

    // Distribute experience to survivors
    if (victory && experienceGained > 0) {
      this.distributeExperience(survivors, experienceGained);
    }

    // Generate loot (simplified)
    const loot: GameObjectId[] = victory ? this.generateLoot(enemies) : [];

    // Update character statuses
    survivors.forEach(survivorId => {
      this.updateCharacterStatus(survivorId, CharacterStatus.Available);
    });

    casualties.forEach(casualtyId => {
      this.updateCharacterStatus(casualtyId, CharacterStatus.Injured);
      // Set health to 0 for casualties
      const health = this.getComponent(casualtyId, HealthComponentType);
      if (health) {
        health.current = 0;
        this.eventSystem.emit('character_health_changed', { 
          characterId: casualtyId, 
          newHealth: 0 
        });
      }
    });

    // Remove combat state
    this.componentManager.removeComponent(combat.partyId, CombatStateComponentType);
    this.activeCombats.delete(combatId);

    // Clean up enemy entities
    enemies.forEach(enemy => {
      this.entityManager.destroyEntity(enemy.id);
    });

    const result: CombatResult = {
      victory,
      survivors,
      casualties,
      experienceGained,
      loot,
      combatLog: combat.combatLog
    };

    this.eventSystem.emit('combat_ended', { combatId, result });
    return result;
  }

  /**
   * Calculate damage between attacker and target
   */
  public calculateDamage(attackerId: EntityId, targetId: EntityId, skillId?: string): DamageResult {
    let attacker = this.getCombatParticipant(attackerId);
    let target = this.getCombatParticipant(targetId);

    // If not in combat, create temporary participants for calculation
    if (!attacker) {
      attacker = this.createTemporaryCombatParticipant(attackerId);
    }
    if (!target) {
      target = this.createTemporaryCombatParticipant(targetId);
    }

    if (!attacker || !target) {
      return { damage: 0, isCritical: false, isBlocked: false, actualDamage: 0 };
    }

    // Base damage calculation
    let baseDamage = attacker.stats.attack;

    // Apply skill modifiers if using a skill
    if (skillId) {
      baseDamage = this.applySkillDamageModifier(baseDamage, skillId);
    }

    // Random variance (±10%)
    const variance = 0.9 + Math.random() * 0.2;
    baseDamage = Math.floor(baseDamage * variance);

    // Check for critical hit
    const isCritical = Math.random() < (attacker.stats.critRate / 100);
    if (isCritical) {
      baseDamage = Math.floor(baseDamage * (attacker.stats.critDamage / 100));
    }

    // Apply defense
    const defense = target.stats.defense;
    const damageReduction = defense / (defense + 100); // Diminishing returns formula
    let finalDamage = Math.floor(baseDamage * (1 - damageReduction));

    // Check for dodge/block
    const isBlocked = Math.random() < (target.stats.dodgeRate / 100);
    if (isBlocked) {
      finalDamage = Math.floor(finalDamage * 0.5); // Blocked attacks do half damage
    }

    // Minimum damage
    finalDamage = Math.max(1, finalDamage);

    return {
      damage: baseDamage,
      isCritical,
      isBlocked,
      actualDamage: finalDamage
    };
  }

  /**
   * Apply damage to a target
   */
  public applyDamage(targetId: EntityId, damage: number): boolean {
    const health = this.getComponent(targetId, HealthComponentType);
    if (!health) {
      return false;
    }

    const oldHealth = health.current;
    health.current = Math.max(0, health.current - damage);

    this.eventSystem.emit('character_health_changed', {
      characterId: targetId,
      oldHealth,
      newHealth: health.current
    });

    // Check if character died
    if (health.current === 0 && oldHealth > 0) {
      // Directly update character status to injured
      this.updateCharacterStatus(targetId, CharacterStatus.Injured);
      
      this.eventSystem.emit('character_death', { characterId: targetId });
      return true; // Target died
    }

    return false;
  }

  /**
   * Get combat information
   */
  public getCombatInfo(combatId: GameObjectId): CombatState | null {
    return this.activeCombats.get(combatId) || null;
  }

  /**
   * Check if entity is in combat
   */
  public isInCombat(entityId: EntityId): boolean {
    // Check if entity has combat state component (for parties)
    const combatState = this.getComponent(entityId, CombatStateComponentType);
    if (combatState?.isInCombat) {
      return true;
    }

    // Check if entity is a participant in any active combat
    for (const combat of this.activeCombats.values()) {
      const participant = combat.participants.find(p => p.id === entityId);
      if (participant) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get party members as combat participants
   */
  private getPartyMembers(party: PartyComponent): CombatParticipant[] {
    const participants: CombatParticipant[] = [];

    for (const memberId of party.members) {
      const characterInfo = this.getComponent(memberId, CharacterInfoComponentType);
      const health = this.getComponent(memberId, HealthComponentType);
      const mana = this.getComponent(memberId, ManaComponentType);
      const level = this.getComponent(memberId, LevelComponentType);
      const stats = this.getComponent(memberId, DerivedStatsComponentType);

      if (characterInfo && health && mana && level && stats && health.current > 0) {
        participants.push({
          id: memberId,
          name: characterInfo.name,
          isEnemy: false,
          health: { current: health.current, maximum: health.maximum },
          mana: { current: mana.current, maximum: mana.maximum },
          stats,
          level: level.level,
          isAlive: health.current > 0
        });
      }
    }

    return participants;
  }

  /**
   * Create enemy entities from definitions
   */
  private createEnemies(enemyDefs: EnemyDefinition[]): CombatParticipant[] {
    const enemies: CombatParticipant[] = [];

    for (const enemyDef of enemyDefs) {
      const enemyId = this.entityManager.createEntity().id;

      // Create basic stats for enemy
      const stats: DerivedStatsComponent = {
        type: 'derivedStats',
        attack: enemyDef.attack,
        defense: enemyDef.defense,
        moveSpeed: 100,
        dodgeRate: 5,
        critRate: 5,
        critDamage: 125,
        resistance: 0,
        magicPower: 0,
        carryWeight: 0,
        hitRate: 95,
        expRate: 100,
        healthRegen: 0,
        manaRegen: 0,
        weight: 50,
        volume: 1
      };

      // Create health component for enemy
      const health: HealthComponent = {
        type: 'health',
        current: enemyDef.health,
        maximum: enemyDef.health
      };

      // Create mana component for enemy
      const mana: ManaComponent = {
        type: 'mana',
        current: 100,
        maximum: 100
      };

      // Add components to enemy entity
      this.componentManager.addComponent(enemyId, DerivedStatsComponentType, stats);
      this.componentManager.addComponent(enemyId, HealthComponentType, health);
      this.componentManager.addComponent(enemyId, ManaComponentType, mana);

      enemies.push({
        id: enemyId,
        name: enemyDef.name,
        isEnemy: true,
        health: { current: enemyDef.health, maximum: enemyDef.health },
        mana: { current: 100, maximum: 100 },
        stats,
        level: enemyDef.level,
        isAlive: true
      });
    }

    return enemies;
  }

  /**
   * Calculate turn order based on agility/speed
   */
  private calculateTurnOrder(participants: CombatParticipant[]): CombatParticipant[] {
    return [...participants].sort((a, b) => {
      // Sort by move speed (higher goes first)
      const speedDiff = b.stats.moveSpeed - a.stats.moveSpeed;
      if (speedDiff !== 0) return speedDiff;

      // Tie-breaker: random
      return Math.random() - 0.5;
    });
  }

  /**
   * Update combat state
   */
  private updateCombat(combatId: GameObjectId, combat: CombatState, deltaTime: number): void {
    if (!combat.isActive) return;

    // Update participant alive status based on current health
    combat.participants.forEach(participant => {
      const health = this.getComponent(participant.id, HealthComponentType);
      if (health) {
        participant.isAlive = health.current > 0;
        participant.health.current = health.current;
      }
    });

    // Check win/lose conditions
    const aliveHeroes = combat.participants.filter(p => !p.isEnemy && p.isAlive);
    const aliveEnemies = combat.participants.filter(p => p.isEnemy && p.isAlive);

    if (aliveHeroes.length === 0) {
      // Party defeated
      this.endCombat(combatId, false);
    } else if (aliveEnemies.length === 0) {
      // Victory
      this.endCombat(combatId, true);
    }
  }

  /**
   * Calculate experience gain from defeated enemies
   */
  private calculateExperienceGain(enemies: CombatParticipant[], partyMembers: CombatParticipant[]): number {
    const baseExp = enemies.reduce((total, enemy) => total + (enemy.level * 10), 0);
    const partySize = partyMembers.length;
    
    // Adjust for party size (larger parties get less exp per member)
    const partySizeModifier = Math.max(0.5, 1 - (partySize - 1) * 0.1);
    
    return Math.floor(baseExp * partySizeModifier);
  }

  /**
   * Distribute experience to surviving party members
   */
  private distributeExperience(survivors: EntityId[], totalExp: number): void {
    const expPerMember = Math.floor(totalExp / survivors.length);

    survivors.forEach(survivorId => {
      const level = this.getComponent(survivorId, LevelComponentType);
      if (level) {
        level.experience += expPerMember;
        
        // Check for level up
        while (level.experience >= level.experienceToNext) {
          level.experience -= level.experienceToNext;
          level.level++;
          level.experienceToNext = this.calculateExpToNext(level.level);
          
          this.eventSystem.emit('character_level_up', { 
            characterId: survivorId, 
            newLevel: level.level 
          });
        }
      }
    });
  }

  /**
   * Generate loot from defeated enemies
   */
  private generateLoot(enemies: CombatParticipant[]): GameObjectId[] {
    const loot: GameObjectId[] = [];
    
    // Simplified loot generation
    enemies.forEach(enemy => {
      if (Math.random() < 0.3) { // 30% chance for loot
        loot.push(`loot_${enemy.level}_${Math.floor(Math.random() * 100)}`);
      }
    });

    return loot;
  }

  /**
   * Apply skill damage modifier
   */
  private applySkillDamageModifier(baseDamage: number, skillId: string): number {
    // Simplified skill system - different skills have different damage multipliers
    const skillMultipliers: Record<string, number> = {
      'basic_attack': 1.0,
      'power_strike': 1.5,
      'magic_missile': 1.2,
      'heal': 0, // Healing skill
      'fireball': 1.8
    };

    const multiplier = skillMultipliers[skillId] || 1.0;
    return Math.floor(baseDamage * multiplier);
  }

  /**
   * Get combat participant by ID
   */
  private getCombatParticipant(entityId: EntityId): CombatParticipant | null {
    for (const combat of this.activeCombats.values()) {
      const participant = combat.participants.find(p => p.id === entityId);
      if (participant) return participant;
    }
    return null;
  }

  /**
   * Create a temporary combat participant for damage calculations outside of combat
   */
  private createTemporaryCombatParticipant(entityId: EntityId): CombatParticipant | null {
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    const health = this.getComponent(entityId, HealthComponentType);
    const mana = this.getComponent(entityId, ManaComponentType);
    const level = this.getComponent(entityId, LevelComponentType);
    const stats = this.getComponent(entityId, DerivedStatsComponentType);

    if (!characterInfo || !health || !mana || !level || !stats) {
      return null;
    }

    return {
      id: entityId,
      name: characterInfo.name,
      isEnemy: false,
      health: { current: health.current, maximum: health.maximum },
      mana: { current: mana.current, maximum: mana.maximum },
      stats,
      level: level.level,
      isAlive: health.current > 0
    };
  }

  /**
   * Calculate experience needed for next level
   */
  private calculateExpToNext(level: number): number {
    return Math.floor(100 * Math.pow(1.2, level - 1));
  }

  /**
   * Update character status
   */
  private updateCharacterStatus(characterId: EntityId, status: CharacterStatus): void {
    const characterInfo = this.getComponent(characterId, CharacterInfoComponentType);
    if (characterInfo) {
      const oldStatus = characterInfo.status;
      characterInfo.status = status;
      this.eventSystem.emit('character_status_changed', {
        characterId,
        oldStatus,
        newStatus: status
      });
    }
  }

  /**
   * Handle combat started event
   */
  private handleCombatStarted(event: any): void {
    const { combatId, partyId } = event;
    console.log(`Combat ${combatId} started for party ${partyId}`);
  }

  /**
   * Handle combat ended event
   */
  private handleCombatEnded(event: any): void {
    const { combatId, result } = event;
    console.log(`Combat ${combatId} ended. Victory: ${result.victory}`);
  }

  /**
   * Handle character death event
   */
  private handleCharacterDeath(event: any): void {
    const { characterId } = event;
    
    // Update character status to injured
    this.updateCharacterStatus(characterId, CharacterStatus.Injured);
    
    // Update participant status in active combats
    for (const combat of this.activeCombats.values()) {
      const participant = combat.participants.find(p => p.id === characterId);
      if (participant) {
        participant.isAlive = false;
        combat.combatLog.push(`${participant.name} has fallen!`);
      }
    }
  }
}

/**
 * Internal combat state
 */
interface CombatState {
  id: GameObjectId;
  partyId: EntityId;
  participants: CombatParticipant[];
  turnOrder: CombatParticipant[];
  currentTurn: number;
  roundNumber: number;
  isActive: boolean;
  combatLog: string[];
}