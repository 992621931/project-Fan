/**
 * Buff System
 * Manages buff definitions, active buffs on characters, and buff effect application/removal.
 * Buffs can be applied by skills, items (potions), etc.
 */

import { System } from '../../ecs/System';
import { ComponentType } from '../../ecs/Component';

/**
 * A single effect within a buff definition
 */
export interface BuffEffect {
  attribute: string;   // e.g. 'defense', 'attack', 'moveSpeed'
  value: number;       // e.g. 10, 5, 15
  type: 'flat' | 'percentage';
}

/**
 * Buff definition loaded from buffs.json
 */
export interface BuffDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  effects: BuffEffect[];
  duration: number;      // default duration in seconds
  stackable: boolean;
  maxStacks: number;
  disableMovement?: boolean; // When true, character cannot move while buff is active
}

/**
 * An active buff instance on a character
 */
export interface ActiveBuff {
  buffId: string;
  characterId: string;
  remainingDuration: number; // seconds remaining
  stacks: number;
}

/**
 * BuffSystem manages buff definitions and active buff instances on characters.
 * It ticks down durations each update and applies/removes stat modifications.
 */
export class BuffSystem extends System {
  public readonly name = 'BuffSystem';
  public readonly requiredComponents: ComponentType<any>[] = [];

  private buffDefinitions: Map<string, BuffDefinition> = new Map();
  private activeBuffs: ActiveBuff[] = [];

  // Callback for when buff effects need to be applied/removed on a character
  private onBuffApplied: ((characterId: string, effects: BuffEffect[], stacks: number) => void) | null = null;
  private onBuffRemoved: ((characterId: string, effects: BuffEffect[], stacks: number) => void) | null = null;

  protected onInitialize(): void {
    // System initialization
  }

  /**
   * Load buff definitions from JSON data
   */
  public loadBuffs(data: any): void {
    if (!data || !Array.isArray(data.buffs)) {
      console.warn('[BuffSystem] Invalid buffs data format');
      return;
    }

    for (const buffData of data.buffs) {
      if (!buffData.id || !buffData.name || !Array.isArray(buffData.effects)) {
        console.warn(`[BuffSystem] Invalid buff definition: ${buffData.id || 'unknown'}`);
        continue;
      }

      const definition: BuffDefinition = {
        id: buffData.id,
        name: buffData.name,
        description: buffData.description || '',
        icon: buffData.icon || '',
        effects: buffData.effects.map((e: any) => ({
          attribute: e.attribute,
          value: e.value,
          type: e.type || 'flat'
        })),
        duration: buffData.duration || 30,
        stackable: buffData.stackable || false,
        maxStacks: buffData.maxStacks || 1,
        disableMovement: buffData.disableMovement || false
      };

      // Preserve extra fields (e.g., avatarOverride, randomDirectionInterval)
      for (const key of Object.keys(buffData)) {
        if (!(key in definition)) {
          (definition as any)[key] = buffData[key];
        }
      }

      this.buffDefinitions.set(definition.id, definition);
    }

    console.log(`✅ Loaded ${this.buffDefinitions.size} buff definitions`);
  }

  /**
   * Get a buff definition by ID
   */
  public getBuffDefinition(buffId: string): BuffDefinition | undefined {
    return this.buffDefinitions.get(buffId);
  }

  /**
   * Get all buff definitions
   */
  public getAllBuffDefinitions(): BuffDefinition[] {
    return Array.from(this.buffDefinitions.values());
  }

  /**
   * Set callback for when a buff is applied to a character
   */
  public setOnBuffApplied(callback: (characterId: string, effects: BuffEffect[], stacks: number) => void): void {
    this.onBuffApplied = callback;
  }

  /**
   * Set callback for when a buff is removed from a character
   */
  public setOnBuffRemoved(callback: (characterId: string, effects: BuffEffect[], stacks: number) => void): void {
    this.onBuffRemoved = callback;
  }

  /**
   * Apply a buff to a character
   * @param characterId - The character to apply the buff to
   * @param buffId - The buff definition ID
   * @param duration - Optional override duration (uses definition default if not provided)
   * @returns true if buff was applied successfully
   */
  public applyBuff(characterId: string, buffId: string, duration?: number): boolean {
    const definition = this.buffDefinitions.get(buffId);
    if (!definition) {
      console.warn(`[BuffSystem] Unknown buff: ${buffId}`);
      return false;
    }

    const buffDuration = duration ?? definition.duration;

    // Check if character already has this buff
    const existing = this.activeBuffs.find(
      b => b.characterId === characterId && b.buffId === buffId
    );

    if (existing) {
      if (definition.stackable && existing.stacks < definition.maxStacks) {
        // Add a stack and refresh duration for stackable buffs
        existing.stacks++;
        existing.remainingDuration = buffDuration; // Refresh duration when stacking
        if (this.onBuffApplied) {
          this.onBuffApplied(characterId, definition.effects, 1);
        }
        console.log(`[BuffSystem] ${definition.name} stacked on ${characterId} (${existing.stacks}/${definition.maxStacks}), duration refreshed`);
      } else if (!definition.stackable) {
        // Refresh duration only for non-stackable buffs
        existing.remainingDuration = buffDuration;
        console.log(`[BuffSystem] ${definition.name} refreshed on ${characterId}`);
      } else {
        // Already at max stacks, just refresh duration
        existing.remainingDuration = buffDuration;
        console.log(`[BuffSystem] ${definition.name} at max stacks, duration refreshed on ${characterId}`);
      }
    } else {
      // Apply new buff
      this.activeBuffs.push({
        buffId,
        characterId,
        remainingDuration: buffDuration,
        stacks: 1
      });
      if (this.onBuffApplied) {
        this.onBuffApplied(characterId, definition.effects, 1);
      }
      console.log(`[BuffSystem] ${definition.name} applied to ${characterId}`);
    }

    // Emit event
    this.eventSystem.emit({
      type: 'buff:applied',
      timestamp: Date.now(),
      characterId,
      buffId,
      duration: buffDuration
    });

    return true;
  }

  /**
   * Remove a specific buff from a character
   */
  public removeBuff(characterId: string, buffId: string): boolean {
    const index = this.activeBuffs.findIndex(
      b => b.characterId === characterId && b.buffId === buffId
    );

    if (index === -1) return false;

    const activeBuff = this.activeBuffs[index];
    const definition = this.buffDefinitions.get(buffId);

    // Remove from active list BEFORE calling callback
    // so getActiveBuffs() returns correct state in the callback
    this.activeBuffs.splice(index, 1);

    // Remove all stacks' effects
    if (definition && this.onBuffRemoved) {
      this.onBuffRemoved(characterId, definition.effects, activeBuff.stacks);
    }

    // Emit event
    this.eventSystem.emit({
      type: 'buff:removed',
      timestamp: Date.now(),
      characterId,
      buffId
    });

    if (definition) {
      console.log(`[BuffSystem] ${definition.name} removed from ${characterId}`);
    }

    return true;
  }

  /**
   * Remove all buffs from a character
   */
  public removeAllBuffs(characterId: string): void {
    const toRemove = this.activeBuffs.filter(b => b.characterId === characterId);
    for (const buff of toRemove) {
      this.removeBuff(characterId, buff.buffId);
    }
  }

  /**
   * Get all active buffs for a character
   */
  public getActiveBuffs(characterId: string): ActiveBuff[] {
    return this.activeBuffs.filter(b => b.characterId === characterId);
  }

  /**
   * Check if a character has a specific buff
   */
  public hasBuff(characterId: string, buffId: string): boolean {
    return this.activeBuffs.some(
      b => b.characterId === characterId && b.buffId === buffId
    );
  }

  /**
   * Update - tick down buff durations and remove expired buffs
   */
  public update(deltaTime: number): void {
    const expired: ActiveBuff[] = [];

    for (const buff of this.activeBuffs) {
      buff.remainingDuration -= deltaTime;
      if (buff.remainingDuration <= 0) {
        expired.push(buff);
      }
    }

    // Remove expired buffs
    for (const buff of expired) {
      this.removeBuff(buff.characterId, buff.buffId);
    }
  }
}
