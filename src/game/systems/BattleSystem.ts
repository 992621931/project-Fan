/**
 * BattleSystem - Manages character spawning, movement, and regeneration in battle scenes
 */

import { NPCData, NPCSystem } from './NPCSystem';
import { LootSystem, LootDrop } from './LootSystem';
import { ResourceNodeSystem, ResourceNodeData } from './ResourceNodeSystem';

export interface CharacterSprite {
  id: string;
  character: NPCData;
  element: HTMLDivElement;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lastRegenTime: number;
  isDead: boolean;
  isInjured: boolean;
  reviveTime: number;
  reviveCountdown: number;
  nextDirectionChangeTime: number; // Time when direction will change
  size: number; // Size multiplier (1.0 = 100%, 1.5 = 150%)
  lastCollisionTime: number; // Time of last collision (for boss knockback delay)
  lastAuraDamageTime: number; // Time of last aura damage tick (for death_aura)
  lastHuntTime: number; // Time of last hunt debuff application (for hunt master skill)
  canMove: boolean; // Movement switch - when false, character cannot move regardless of moveSpeed
  auraCircle?: HTMLElement; // Reference to the aura circle element (for divine_proclamation and death_aura)
  baseStats?: {
    moveSpeed: number;
    attack: number;
    defense: number;
    weight: number;
  }; // Base stats for enemies (used to recalculate stats when buffs are removed)
  chargeState?: {
    active: boolean;
    endTime: number;
    originalMoveSpeed: number;
    originalAttack: number;
    afterimageInterval: number | null;
    cleanupTimeout: number | null;
  };
}

export interface ResourceNodeSprite {
  id: string;
  nodeData: ResourceNodeData;
  element: HTMLDivElement;
  x: number;
  y: number;
  currentHP: number;
  maxHP: number;
  isInvincible: boolean;
  invincibleUntil: number;
}

export class BattleSystem {
  private sprites: Map<string, CharacterSprite> = new Map();
  private resourceNodes: Map<string, ResourceNodeSprite> = new Map();
  private container: HTMLElement | null = null;
  private animationFrameId: number | null = null;
  private lastUpdateTime: number = 0;
  private containerBounds = { width: 0, height: 0 };
  private enemySpawnInterval: number | null = null;
  private enemySpawnCallback: (() => void) | null = null;
  private maxEnemies: number = 10; // 默认敌人数量上限
  private onEnemyKilledCallback: ((killerId: string, enemyLevel: number) => void) | null = null;
  private partyMemberIds: string[] = []; // 编队成员ID列表
  private totalKills: number = 0; // 本次探险的击杀数
  private onStatsUpdateCallback: (() => void) | null = null; // 统计数据更新回调
  private crisisValue: number = 0; // 危机值 (0-100)
  private bossSpawned: boolean = false; // BOSS是否已生成
  private bossId: string | null = null; // 当前BOSS的ID
  private onBossSpawnCallback: (() => void) | null = null; // BOSS生成回调
  private onCharacterInjuredCallback: ((characterId: string, reviveTime: number) => void) | null = null; // 角色重伤回调
  private onEnemyDeathCallback: ((enemyId: string) => void) | null = null; // 敌人死亡回调（传递敌人ID）
  private onCharacterRevivedCallback: ((characterId: string) => void) | null = null; // 角色复活回调
  private onCharacterHealedCallback: ((characterId: string, healAmount: number) => void) | null = null; // 角色治愈回调
  private npcSystem: NPCSystem; // NPC系统引用
  private activeOrbitProjectiles: Map<string, HTMLElement[]> = new Map(); // 活跃的环绕投射物，按施法者ID分组
  private lootSystem: LootSystem | null = null; // 战利品系统引用
  private currencySystem: any | null = null; // 货币系统引用
  private onGoldGainCallback: ((amount: number) => void) | null = null; // 金币获得回调
  private onLootDroppedCallback: ((lootId: string, itemId: string, x: number, y: number) => void) | null = null; // 掉落物生成回调
  private resourceNodeSystem: ResourceNodeSystem | null = null; // 资源点系统引用
  private resourceNodeSpawnInterval: number | null = null; // 资源点生成定时器
  private maxResourceNodes: number = 5; // 资源点数量上限
  private currentStage: string = ''; // 当前关卡名称
  private buffSystem: any | null = null; // BUFF系统引用
  private buffEffectIntervals: Map<string, number> = new Map(); // BUFF视觉效果定时器
  private characterBuffStates: Map<string, Set<string>> = new Map(); // 追踪每个角色的BUFF状态

  constructor(npcSystem: NPCSystem) {
    this.lastUpdateTime = Date.now();
    this.npcSystem = npcSystem;
  }

  /**
   * Set buff system reference
   */
  public setBuffSystem(buffSystem: any): void {
    this.buffSystem = buffSystem;
    
    // Set up buff callbacks to handle movement control
    const originalOnBuffRemoved = buffSystem.onBuffRemoved;
    buffSystem.setOnBuffRemoved((characterId: string, effects: any[], stacks: number) => {
      // Call original callback if it exists
      if (originalOnBuffRemoved) {
        originalOnBuffRemoved(characterId, effects, stacks);
      }
      
      // Check if character should have movement re-enabled
      const sprite = this.sprites.get(characterId);
      if (sprite) {
        // Check if any remaining buffs disable movement
        const activeBuffs = buffSystem.getActiveBuffs(characterId);
        let hasMovementDisablingBuff = false;
        for (const buff of activeBuffs) {
          const buffDef = buffSystem.getBuffDefinition(buff.buffId);
          if (buffDef && buffDef.disableMovement) {
            hasMovementDisablingBuff = true;
            break;
          }
        }
        
        // If no remaining buffs disable movement, re-enable movement
        if (!hasMovementDisablingBuff && !sprite.canMove) {
          sprite.canMove = true;
          console.log(`[BattleSystem] Movement re-enabled for ${sprite.character.name} after buff removal`);
        }
        
        // Force visual effect update to clear buff visuals (e.g., paralysis shake)
        // Set a dummy previous state so change detection sees a difference
        this.characterBuffStates.set(characterId, new Set(['__force_update__']));
        this.applyBuffVisualEffects(characterId);
        
        // For enemies, recalculate stats from base values to prevent floating point errors
        if (sprite.character.type === 'Enemy') {
          // Store current base stats if not already stored
          if (!sprite.baseStats) {
            sprite.baseStats = {
              moveSpeed: sprite.character.moveSpeed,
              attack: sprite.character.attack,
              defense: sprite.character.defense,
              weight: sprite.character.weight
            };
          }
          
          // Reset to base stats
          sprite.character.moveSpeed = sprite.baseStats.moveSpeed;
          sprite.character.attack = sprite.baseStats.attack;
          sprite.character.defense = sprite.baseStats.defense;
          sprite.character.weight = sprite.baseStats.weight;
          
          // Re-apply all remaining active buff effects
          const remainingBuffs = buffSystem.getActiveBuffs(characterId);
          for (const buff of remainingBuffs) {
            const buffDef = buffSystem.getBuffDefinition(buff.buffId);
            if (buffDef && buffDef.effects) {
              for (const effect of buffDef.effects) {
                const attr = effect.attribute as string;
                if (typeof (sprite.character as any)[attr] === 'number') {
                  if (effect.type === 'flat') {
                    (sprite.character as any)[attr] += effect.value * buff.stacks;
                  } else if (effect.type === 'percentage') {
                    (sprite.character as any)[attr] *= (1 + (effect.value / 100) * buff.stacks);
                  }
                }
              }
            }
          }
          
          // Safety floor for moveSpeed
          if (sprite.character.moveSpeed < 0) {
            sprite.character.moveSpeed = 0;
          }
          
          console.log(`[BattleSystem] Buff removed from enemy ${sprite.character.name}, stats recalculated. moveSpeed: ${sprite.character.moveSpeed}`);
        }
      }
    });
  }

  /**
   * Set loot system reference
   */
  public setLootSystem(lootSystem: LootSystem): void {
    this.lootSystem = lootSystem;
  }

  /**
   * Set currency system reference
   */
  public setCurrencySystem(currencySystem: any): void {
    this.currencySystem = currencySystem;
  }

  /**
   * Set callback for when gold is gained from passive skills
   */
  public setOnGoldGain(callback: (amount: number) => void): void {
    this.onGoldGainCallback = callback;
  }

  /**
   * Set resource node system reference
   */
  public setResourceNodeSystem(resourceNodeSystem: ResourceNodeSystem): void {
    this.resourceNodeSystem = resourceNodeSystem;
  }

  /**
   * Set current stage name for resource node drops
   */
  public setCurrentStage(stageName: string): void {
    this.currentStage = stageName;
    console.log(`[BattleSystem] Current stage set to: ${stageName}`);
  }

  /**
   * Set maximum resource node count
   */
  public setMaxResourceNodes(max: number): void {
    this.maxResourceNodes = Math.max(1, max);
    console.log(`[BattleSystem] Max resource nodes set to ${this.maxResourceNodes}`);
  }

  /**
   * Get current resource node count
   */
  public getResourceNodeCount(): number {
    return this.resourceNodes.size;
  }

  /**
   * Set callback for when loot is dropped
   */
  public setOnLootDropped(callback: (lootId: string, itemId: string, x: number, y: number) => void): void {
    this.onLootDroppedCallback = callback;
  }

  /**
   * Set callback for when boss spawns
   */
  public setOnBossSpawn(callback: () => void): void {
    this.onBossSpawnCallback = callback;
  }

  /**
   * Set callback for when a character becomes injured
   */
  public setOnCharacterInjured(callback: (characterId: string, reviveTime: number) => void): void {
    this.onCharacterInjuredCallback = callback;
  }

  /**
   * Set callback for when a character is revived
   */
  public setOnCharacterRevived(callback: (characterId: string) => void): void {
    this.onCharacterRevivedCallback = callback;
  }

  /**
   * Set callback for when a character is healed
   */
  public setOnCharacterHealed(callback: (characterId: string, healAmount: number) => void): void {
    this.onCharacterHealedCallback = callback;
  }

  /**
   * Set character movement enabled/disabled
   * @param characterId - The character ID
   * @param canMove - Whether the character can move
   */
  public setCharacterMovement(characterId: string, canMove: boolean): void {
    const sprite = this.sprites.get(characterId);
    if (sprite) {
      sprite.canMove = canMove;
      console.log(`[BattleSystem] Character ${characterId} movement ${canMove ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get crisis value (0-100)
   */
  public getCrisisValue(): number {
    // While boss is alive, crisis value is always 0
    if (this.bossSpawned) return 0;
    return this.crisisValue;
  }

  /**
   * Check if boss is spawned
   */
  public isBossSpawned(): boolean {
    return this.bossSpawned;
  }

  /**
   * Reset crisis meter (call when starting new expedition)
   */
  public resetCrisis(): void {
    this.crisisValue = 0;
    this.bossSpawned = false;
    this.bossId = null;
    if (this.onStatsUpdateCallback) {
      this.onStatsUpdateCallback();
    }
  }

  /**
   * Add to crisis value (for dev functions)
   */
  public addCrisisValue(amount: number): void {
    if (this.bossSpawned) {
      console.log('[BattleSystem] Boss alive, crisis value locked at 0%');
      return;
    }
    
    this.crisisValue = Math.min(100, this.crisisValue + amount);
    console.log(`[BattleSystem] Crisis value increased by ${amount}% to ${this.crisisValue}%`);
    
    // Check if crisis meter is full and spawn boss
    if (this.crisisValue >= 100 && !this.bossSpawned && this.onBossSpawnCallback) {
      this.bossSpawned = true;
      this.crisisValue = 0; // Reset to 0 while boss is alive
      console.log(`[BattleSystem] Crisis meter full! Spawning boss... Crisis reset to 0%`);
      this.onBossSpawnCallback();
    }
    
    if (this.onStatsUpdateCallback) {
      this.onStatsUpdateCallback();
    }
  }

  /**
   * Set callback for when stats are updated (enemy count or kills change)
   */
  public setOnStatsUpdate(callback: () => void): void {
    this.onStatsUpdateCallback = callback;
  }

  /**
   * Set callback for when an enemy dies (passes enemy character ID)
   */
  public setOnEnemyDeath(callback: (enemyId: string) => void): void {
    this.onEnemyDeathCallback = callback;
  }

  /**
   * Get total kills in current expedition
   */
  public getTotalKills(): number {
    return this.totalKills;
  }

  /**
   * Reset kill counter (call when starting new expedition)
   */
  public resetKills(): void {
    this.totalKills = 0;
    if (this.onStatsUpdateCallback) {
      this.onStatsUpdateCallback();
    }
  }

  /**
   * Set callback for when an enemy is killed
   */
  public setOnEnemyKilled(callback: (killerId: string, enemyLevel: number) => void): void {
    this.onEnemyKilledCallback = callback;
  }

  /**
   * Set party member IDs for shared EXP distribution
   */
  public setPartyMembers(memberIds: string[]): void {
    this.partyMemberIds = memberIds;
    console.log('[BattleSystem] Party members set:', memberIds);
  }

  /**
   * Initialize the battle system with a container element
   */
  public initialize(container: HTMLElement): void {
    this.container = container;
    this.updateContainerBounds();
    
    // Start the update loop
    this.startUpdateLoop();
  }

  /**
   * Spawn a character in the scene at a random position
   * Adventurers will spawn away from enemies
   */
  public spawnCharacter(character: NPCData): void {
    if (!this.container) {
      console.error('[BattleSystem] Cannot spawn character: container not initialized');
      return;
    }

    // Check if character is already spawned
    if (this.sprites.has(character.id)) {
      console.log(`[BattleSystem] Character ${character.id} already spawned`);
      return;
    }

    this.updateContainerBounds();

    const spriteWidth = 70;
    const spriteHeight = 100;
    let x = 0;
    let y = 0;

    // If this is an adventurer, try to spawn away from enemies
    if (character.type !== 'Enemy') {
      // Get all enemy positions
      const enemyPositions: { x: number; y: number }[] = [];
      this.sprites.forEach((sprite) => {
        if (sprite.character.type === 'Enemy') {
          enemyPositions.push({ x: sprite.x, y: sprite.y });
        }
      });

      // Try to find a position far from enemies
      if (enemyPositions.length > 0) {
        let bestX = 0;
        let bestY = 0;
        let maxMinDistance = 0;
        const attempts = 20; // Try 20 random positions

        for (let i = 0; i < attempts; i++) {
          const testX = Math.random() * (this.containerBounds.width - spriteWidth);
          const testY = Math.random() * (this.containerBounds.height - spriteHeight);

          // Calculate minimum distance to any enemy
          let minDistance = Infinity;
          enemyPositions.forEach((enemyPos) => {
            const dx = testX - enemyPos.x;
            const dy = testY - enemyPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            minDistance = Math.min(minDistance, distance);
          });

          // Keep the position with the maximum minimum distance
          if (minDistance > maxMinDistance) {
            maxMinDistance = minDistance;
            bestX = testX;
            bestY = testY;
          }
        }

        x = bestX;
        y = bestY;
        console.log(`[BattleSystem] Adventurer spawned ${maxMinDistance.toFixed(0)}px away from nearest enemy`);
      } else {
        // No enemies, spawn randomly
        x = Math.random() * (this.containerBounds.width - spriteWidth);
        y = Math.random() * (this.containerBounds.height - spriteHeight);
      }
    } else {
      // Enemy spawns randomly
      x = Math.random() * (this.containerBounds.width - spriteWidth);
      y = Math.random() * (this.containerBounds.height - spriteHeight);
    }

    // Generate random velocity direction
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + character.moveSpeed;
    const velocityX = Math.cos(angle) * speed;
    const velocityY = Math.sin(angle) * speed;

    // Get size multiplier (default to 1.0 if not specified)
    const size = character.size || 1.0;

    // Create sprite element with size scaling
    const element = this.createSpriteElement(character, size);
    element.style.transform = `translate(${x}px, ${y}px)`;

    // Add to container
    this.container.appendChild(element);

    // Calculate next direction change time (5-10 seconds from now)
    const directionChangeDelay = 5000 + Math.random() * 5000; // 5000-10000ms
    const nextDirectionChangeTime = Date.now() + directionChangeDelay;

    // Store sprite data
    const sprite: CharacterSprite = {
      id: character.id,
      character,
      element,
      x,
      y,
      velocityX,
      velocityY,
      lastRegenTime: Date.now(),
      isDead: false,
      isInjured: false,
      reviveTime: 0,
      reviveCountdown: 0,
      nextDirectionChangeTime,
      size,
      lastCollisionTime: 0,
      lastAuraDamageTime: 0,
      lastHuntTime: 0,
      canMove: true,
      // Initialize base stats for enemies to prevent floating point errors when buffs are removed
      baseStats: character.type === 'Enemy' ? {
        moveSpeed: character.moveSpeed,
        attack: character.attack,
        defense: character.defense,
        weight: character.weight
      } : undefined
    };

    this.sprites.set(character.id, sprite);

    console.log(`[BattleSystem] Spawned ${character.type} ${character.title}${character.name} at (${x.toFixed(0)}, ${y.toFixed(0)}) with size ${size}x`);
    
    // Apply initial buff visual effects if character has buffs
    if (this.buffSystem) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        this.applyBuffVisualEffects(character.id);
      }, 0);
    }
    
    // Trigger stats update callback if enemy spawned
    if (character.type === 'Enemy' && this.onStatsUpdateCallback) {
      this.onStatsUpdateCallback();
    }
  }

  /**
   * Mark a character as the boss
   */
  public markAsBoss(characterId: string): void {
    this.bossId = characterId;
    console.log(`[BattleSystem] Character ${characterId} marked as boss`);
  }

  /**
   * Get highest level adventurer
   */
  public getHighestAdventurerLevel(): number {
    let maxLevel = 1;
    this.sprites.forEach((sprite) => {
      if (sprite.character.type !== 'Enemy') {
        maxLevel = Math.max(maxLevel, sprite.character.level);
      }
    });
    return maxLevel;
  }

  /**
   * Remove a character from the scene
   */
  public despawnCharacter(characterId: string): void {
    const sprite = this.sprites.get(characterId);
    if (!sprite) return;

    // Clean up buff visual effects
    this.clearBuffVisualEffects(characterId);

    // Clean up any active orbit projectiles for this character
    this.cleanupOrbitProjectiles(characterId);
    
    // Clean up aura circle if exists (divine_proclamation or death_aura)
    if (sprite.auraCircle && sprite.auraCircle.parentNode) {
      sprite.auraCircle.parentNode.removeChild(sprite.auraCircle);
      sprite.auraCircle = undefined;
    }

    // Remove element from DOM
    if (sprite.element.parentNode) {
      sprite.element.parentNode.removeChild(sprite.element);
    }

    // Remove from sprites map
    this.sprites.delete(characterId);

    console.log(`[BattleSystem] Despawned character ${characterId}`);
    
    // Trigger stats update callback if enemy despawned
    if (sprite.character.type === 'Enemy' && this.onStatsUpdateCallback) {
      this.onStatsUpdateCallback();
    }
  }

  /**
   * Clean up all orbit projectiles for a specific character
   */
  private cleanupOrbitProjectiles(characterId: string): void {
    const projectiles = this.activeOrbitProjectiles.get(characterId);
    if (!projectiles) return;

    // Remove all projectiles from DOM
    projectiles.forEach(projectile => {
      if (projectile.parentNode) {
        projectile.parentNode.removeChild(projectile);
      }
    });

    // Clear the tracking
    this.activeOrbitProjectiles.delete(characterId);
    
    console.log(`[BattleSystem] Cleaned up ${projectiles.length} orbit projectiles for character ${characterId}`);
  }

  /**
   * Clear all spawned characters
   */
  public clearAll(): void {
    // Clean up all orbit projectiles
    this.activeOrbitProjectiles.forEach((projectiles, characterId) => {
      projectiles.forEach(projectile => {
        if (projectile.parentNode) {
          projectile.parentNode.removeChild(projectile);
        }
      });
    });
    this.activeOrbitProjectiles.clear();

    // Clear all sprites
    this.sprites.forEach((sprite) => {
      if (sprite.element.parentNode) {
        sprite.element.parentNode.removeChild(sprite.element);
      }
    });
    this.sprites.clear();

    // Clear all resource nodes
    this.resourceNodes.forEach((node) => {
      if (node.element.parentNode) {
        node.element.parentNode.removeChild(node.element);
      }
    });
    this.resourceNodes.clear();
    
    // Clear all damage numbers and visual effects from container
    if (this.container) {
      // Remove all child elements that are not sprites or resource nodes
      // This includes damage numbers, skill effects, projectiles, etc.
      const children = Array.from(this.container.children);
      children.forEach(child => {
        // Remove all elements (sprites and resource nodes are already removed above)
        if (child.parentNode) {
          child.parentNode.removeChild(child);
        }
      });
    }
    
    // Stop enemy spawning
    this.stopEnemySpawning();
    
    // Stop resource node spawning
    this.stopResourceNodeSpawning();
    
    // Reset crisis value
    this.crisisValue = 0;
    
    console.log('[BattleSystem] All battle scene content cleared');
  }

  /**
   * Get all spawned character IDs
   */
  public getSpawnedCharacterIds(): string[] {
    return Array.from(this.sprites.keys());
  }

  /**
   * Get current enemy count
   */
  public getEnemyCount(): number {
    let count = 0;
    this.sprites.forEach((sprite) => {
      if (sprite.character.type === 'Enemy') {
        count++;
      }
    });
    return count;
  }

  /**
   * Set maximum enemy count
   */
  public setMaxEnemies(max: number): void {
    this.maxEnemies = Math.max(1, max); // At least 1
    console.log(`[BattleSystem] Max enemies set to ${this.maxEnemies}`);
  }

  /**
   * Get maximum enemy count
   */
  public getMaxEnemies(): number {
    return this.maxEnemies;
  }

  /**
   * Check if enemy limit is reached
   */
  public isEnemyLimitReached(): boolean {
    return this.getEnemyCount() >= this.maxEnemies;
  }

  /**
   * Shutdown the battle system
   */
  public shutdown(): void {
    this.stopUpdateLoop();
    this.stopEnemySpawning();
    this.stopResourceNodeSpawning();
    this.clearAll();
    this.container = null;
  }

  /**
   * Start automatic enemy spawning
   * @param callback Function to call when spawning an enemy (should return enemy position)
   */
  public startEnemySpawning(callback: () => void): void {
    this.stopEnemySpawning();
    this.enemySpawnCallback = callback;
    this.scheduleNextEnemySpawn();
  }

  /**
   * Stop automatic enemy spawning
   */
  public stopEnemySpawning(): void {
    if (this.enemySpawnInterval !== null) {
      clearTimeout(this.enemySpawnInterval);
      this.enemySpawnInterval = null;
    }
    this.enemySpawnCallback = null;
  }

  /**
   * Schedule the next enemy spawn (3-8 seconds)
   */
  private scheduleNextEnemySpawn(): void {
    if (!this.enemySpawnCallback) return;

    // Random delay between 3000ms (3s) and 8000ms (8s)
    const delay = 3000 + Math.random() * 5000;

    this.enemySpawnInterval = window.setTimeout(() => {
      if (this.enemySpawnCallback) {
        // Check if enemy limit is reached
        if (!this.isEnemyLimitReached()) {
          this.enemySpawnCallback();
        } else {
          console.log(`[BattleSystem] Enemy limit reached (${this.maxEnemies}), skipping spawn`);
        }
        this.scheduleNextEnemySpawn(); // Schedule next spawn
      }
    }, delay);
  }

  /**
   * Start automatic resource node spawning
   * Only spawns in non-village stages
   */
  public startResourceNodeSpawning(): void {
    // Don't spawn resource nodes in village
    if (this.currentStage === 'village' || !this.resourceNodeSystem) {
      console.log('[BattleSystem] Resource node spawning disabled for village stage');
      return;
    }

    this.stopResourceNodeSpawning();
    this.scheduleNextResourceNodeSpawn();
    console.log('[BattleSystem] Resource node spawning started');
  }

  /**
   * Stop automatic resource node spawning
   */
  public stopResourceNodeSpawning(): void {
    if (this.resourceNodeSpawnInterval !== null) {
      clearTimeout(this.resourceNodeSpawnInterval);
      this.resourceNodeSpawnInterval = null;
    }
  }

  /**
   * Schedule the next resource node spawn (5-10 seconds)
   */
  private scheduleNextResourceNodeSpawn(): void {
    if (!this.resourceNodeSystem) return;

    // Random delay between 5000ms (5s) and 10000ms (10s)
    const delay = 5000 + Math.random() * 5000;

    this.resourceNodeSpawnInterval = window.setTimeout(() => {
      // Check if resource node limit is reached
      if (this.resourceNodes.size < this.maxResourceNodes) {
        this.spawnRandomResourceNode();
      } else {
        console.log(`[BattleSystem] Resource node limit reached (${this.maxResourceNodes}), skipping spawn`);
      }
      this.scheduleNextResourceNodeSpawn(); // Schedule next spawn
    }, delay);
  }

  /**
   * Spawn a random resource node away from adventurers
   */
  private spawnRandomResourceNode(): void {
    if (!this.resourceNodeSystem || !this.container) return;

    // Define resource node spawn probabilities for each stage
    const stageProbabilities: Record<string, { grass: number, tree: number, ore: number }> = {
      grassland: { grass: 0.5, tree: 0.3, ore: 0.2 },
      forest: { grass: 0.3, tree: 0.5, ore: 0.2 },
      cave: { grass: 0.2, tree: 0.3, ore: 0.5 }
    };

    // Get probabilities for current stage (default to grassland)
    const probabilities = stageProbabilities[this.currentStage] || stageProbabilities.grassland;

    // Determine resource type based on probabilities
    const random = Math.random();
    let resourceType: string;
    
    if (random < probabilities.grass) {
      resourceType = 'grass';
    } else if (random < probabilities.grass + probabilities.tree) {
      resourceType = 'tree';
    } else {
      resourceType = 'ore';
    }

    // Get all available resource node IDs of the selected type
    const allNodeIds = this.resourceNodeSystem.getAllResourceNodeIds();
    const nodeIds = allNodeIds.filter(id => {
      const nodeData = this.resourceNodeSystem.getResourceNode(id);
      return nodeData && nodeData.type === resourceType;
    });

    if (nodeIds.length === 0) {
      console.warn(`[BattleSystem] No resource nodes of type ${resourceType} available`);
      return;
    }

    // Pick a random resource node of the selected type
    const randomNodeId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    const nodeData = this.resourceNodeSystem.getResourceNode(randomNodeId);
    
    if (!nodeData) {
      console.error(`[BattleSystem] Resource node ${randomNodeId} not found`);
      return;
    }

    this.spawnResourceNode(nodeData);
  }

  /**
   * Spawn a resource node at a position far from adventurers
   */
  public spawnResourceNode(nodeData: ResourceNodeData): void {
    if (!this.container) {
      console.error('[BattleSystem] Cannot spawn resource node: container not initialized');
      return;
    }

    this.updateContainerBounds();

    // Get all adventurer positions
    const adventurerPositions: { x: number; y: number }[] = [];
    this.sprites.forEach((sprite) => {
      if (sprite.character.type !== 'Enemy') {
        adventurerPositions.push({ x: sprite.x, y: sprite.y });
      }
    });

    // Find a spawn position far from all adventurers (minimum 200px) and away from edges (30px)
    const nodeSize = nodeData.size;
    const minDistance = 200;
    const edgeMargin = 30;
    let x = 0;
    let y = 0;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      x = edgeMargin + Math.random() * (this.containerBounds.width - nodeSize - edgeMargin * 2);
      y = edgeMargin + Math.random() * (this.containerBounds.height - nodeSize - edgeMargin * 2);
      attempts++;

      // Check distance from all adventurers
      const isFarEnough = adventurerPositions.every((pos) => {
        const dx = x - pos.x;
        const dy = y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance >= minDistance;
      });

      if (isFarEnough || attempts >= maxAttempts) {
        break;
      }
    } while (true);

    // Create resource node element
    const element = this.createResourceNodeElement(nodeData);
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;

    // Add to container
    this.container.appendChild(element);

    // Generate unique ID
    const nodeId = `resource_node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store resource node data
    const resourceNode: ResourceNodeSprite = {
      id: nodeId,
      nodeData,
      element,
      x,
      y,
      currentHP: nodeData.maxHP,
      maxHP: nodeData.maxHP,
      isInvincible: false,
      invincibleUntil: 0
    };

    this.resourceNodes.set(nodeId, resourceNode);

    console.log(`[BattleSystem] Spawned resource node ${nodeData.name} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
  }

  /**
   * Create a resource node element
   */
  private createResourceNodeElement(nodeData: ResourceNodeData): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'battle-resource-node-container';
    container.style.cssText = `
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 5;
    `;

    // Resource node name (above icon)
    const nameLabel = document.createElement('div');
    nameLabel.textContent = nodeData.name;
    nameLabel.style.cssText = `
      font-size: 12px;
      font-weight: bold;
      color: white;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000,
        0 0 3px rgba(0, 0, 0, 0.8);
      white-space: nowrap;
      margin-bottom: 4px;
      pointer-events: none;
    `;

    // Icon container
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
      width: ${nodeData.size}px;
      height: ${nodeData.size}px;
      border-radius: 50%;
      background: linear-gradient(135deg, #8B7355 0%, #6B5345 100%);
      border: 3px solid #D4A574;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    `;

    // Icon image
    const icon = document.createElement('img');
    icon.src = nodeData.icon;
    icon.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
    `;
    iconContainer.appendChild(icon);

    // HP bar (below icon)
    const hpBarContainer = document.createElement('div');
    hpBarContainer.style.cssText = `
      width: ${nodeData.size}px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 4px;
      pointer-events: none;
    `;

    const hpBar = this.createBar(nodeData.maxHP, nodeData.maxHP, '#28a745');
    hpBar.setAttribute('data-bar-type', 'hp');
    hpBarContainer.appendChild(hpBar);

    // Assemble container
    container.appendChild(nameLabel);
    container.appendChild(iconContainer);
    container.appendChild(hpBarContainer);

    return container;
  }

  /**
   * Update resource node HP bar
   */
  private updateResourceNodeBar(node: ResourceNodeSprite): void {
    const hpBar = node.element.querySelector('[data-bar-type="hp"] > div') as HTMLDivElement;
    if (hpBar) {
      const hpPercentage = Math.max(0, Math.min(100, (node.currentHP / node.maxHP) * 100));
      hpBar.style.width = `${hpPercentage}%`;
    }
  }

  /**
   * Despawn a resource node
   */
  private despawnResourceNode(nodeId: string): void {
    const node = this.resourceNodes.get(nodeId);
    if (!node) return;

    // Remove element from DOM
    if (node.element.parentNode) {
      node.element.parentNode.removeChild(node.element);
    }

    // Remove from map
    this.resourceNodes.delete(nodeId);

    console.log(`[BattleSystem] Despawned resource node ${nodeId}`);
  }

  /**
   * Spawn a character at a position far from all adventurers
   * @param character Character to spawn
   * @param minDistance Minimum distance from adventurers (default: 200px)
   */
  public spawnCharacterAwayFromAdventurers(character: NPCData, minDistance: number = 200): void {
    if (!this.container) {
      console.error('[BattleSystem] Cannot spawn character: container not initialized');
      return;
    }

    // Check if character is already spawned
    if (this.sprites.has(character.id)) {
      console.log(`[BattleSystem] Character ${character.id} already spawned`);
      return;
    }

    this.updateContainerBounds();

    // Get all adventurer positions
    const adventurerPositions: { x: number; y: number }[] = [];
    this.sprites.forEach((sprite) => {
      if (sprite.character.type !== 'Enemy') {
        adventurerPositions.push({ x: sprite.x, y: sprite.y });
      }
    });

    // Find a spawn position far from all adventurers
    const spriteWidth = 70;
    const spriteHeight = 100;
    let x = 0;
    let y = 0;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      x = Math.random() * (this.containerBounds.width - spriteWidth);
      y = Math.random() * (this.containerBounds.height - spriteHeight);
      attempts++;

      // Check distance from all adventurers
      const isFarEnough = adventurerPositions.every((pos) => {
        const dx = x - pos.x;
        const dy = y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance >= minDistance;
      });

      if (isFarEnough || attempts >= maxAttempts) {
        break;
      }
    } while (true);

    // Generate random velocity direction
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + character.moveSpeed;
    const velocityX = Math.cos(angle) * speed;
    const velocityY = Math.sin(angle) * speed;

    // Get size multiplier (default to 1.0 if not specified)
    const size = character.size || 1.0;

    // Create sprite element with size scaling
    const element = this.createSpriteElement(character, size);
    element.style.transform = `translate(${x}px, ${y}px)`;

    // Add to container
    this.container.appendChild(element);

    // Calculate next direction change time (5-10 seconds from now)
    const directionChangeDelay = 5000 + Math.random() * 5000; // 5000-10000ms
    const nextDirectionChangeTime = Date.now() + directionChangeDelay;

    // Store sprite data
    const sprite: CharacterSprite = {
      id: character.id,
      character,
      element,
      x,
      y,
      velocityX,
      velocityY,
      lastRegenTime: Date.now(),
      isDead: false,
      isInjured: false,
      reviveTime: 0,
      reviveCountdown: 0,
      nextDirectionChangeTime,
      size,
      lastCollisionTime: 0,
      lastAuraDamageTime: 0,
      lastHuntTime: 0,
      canMove: true,
      // Initialize base stats for enemies to prevent floating point errors when buffs are removed
      baseStats: character.type === 'Enemy' ? {
        moveSpeed: character.moveSpeed,
        attack: character.attack,
        defense: character.defense,
        weight: character.weight
      } : undefined
    };

    this.sprites.set(character.id, sprite);

    console.log(`[BattleSystem] Spawned ${character.type} ${character.name} at (${x.toFixed(0)}, ${y.toFixed(0)}), ${attempts} attempts, size ${size}x`);
    
    // Apply initial buff visual effects if character has buffs
    if (this.buffSystem) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        this.applyBuffVisualEffects(character.id);
      }, 0);
    }
    
    // Trigger stats update callback if enemy spawned
    if (character.type === 'Enemy' && this.onStatsUpdateCallback) {
      this.onStatsUpdateCallback();
    }
  }

  /**
   * Create a sprite element for a character
   */
  private createSpriteElement(character: NPCData, size: number = 1.0): HTMLDivElement {
    // Calculate scaled dimensions
    const baseSize = 60;
    const scaledSize = Math.floor(baseSize * size);
    
    const container = document.createElement('div');
    container.className = 'battle-character-container';
    container.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 10;
      will-change: transform;
    `;

    // Character name (above avatar)
    const nameLabel = document.createElement('div');
    const displayName = character.title ? `${character.title}${character.name}` : character.name;
    nameLabel.textContent = displayName;
    nameLabel.style.cssText = `
      font-size: ${Math.floor(12 * size)}px;
      font-weight: bold;
      color: white;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000,
        0 0 3px rgba(0, 0, 0, 0.8);
      white-space: nowrap;
      margin-bottom: 4px;
      pointer-events: none;
    `;

    // Avatar wrapper (contains particle layer, sprite and level badge)
    const avatarWrapper = document.createElement('div');
    avatarWrapper.className = 'battle-avatar-wrapper';
    avatarWrapper.setAttribute('data-character-id', character.id);
    avatarWrapper.style.cssText = `
      position: relative;
      width: ${scaledSize}px;
      height: ${scaledSize}px;
    `;

    // Particle effects layer (behind avatar)
    const particleLayer = document.createElement('div');
    particleLayer.className = 'battle-particle-layer';
    particleLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    `;

    // Avatar sprite
    const sprite = document.createElement('div');
    sprite.className = 'battle-character-sprite';
    
    // Determine if this is an enemy (red border) or ally (blue border)
    const isEnemy = character.type === 'Enemy';
    const borderColor = isEnemy ? '#dc3545' : 'white';
    const bgGradient = isEnemy 
      ? 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'
      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    
    sprite.style.cssText = `
      position: relative;
      width: ${scaledSize}px;
      height: ${scaledSize}px;
      border-radius: 50%;
      background: ${bgGradient};
      border: ${Math.max(2, Math.floor(3 * size))}px solid ${borderColor};
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.2s;
      z-index: 2;
    `;

    // Add avatar image or emoji
    if (character.emoji.includes('.png') || character.emoji.includes('.jpg')) {
      const img = document.createElement('img');
      img.src = character.emoji;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;
      sprite.appendChild(img);
    } else {
      sprite.textContent = character.emoji;
      sprite.style.fontSize = `${Math.floor(30 * size)}px`;
    }

    // Level badge (overlaid on bottom of avatar, outside the sprite container)
    const levelBadge = document.createElement('div');
    levelBadge.textContent = `LV:${character.level}`;
    levelBadge.style.cssText = `
      position: absolute;
      bottom: -2px;
      left: 50%;
      transform: translateX(-50%);
      color: white;
      font-size: ${Math.floor(11 * size)}px;
      font-weight: bold;
      white-space: nowrap;
      pointer-events: none;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000,
        0 0 3px rgba(0, 0, 0, 0.8);
      z-index: 20;
    `;
    
    avatarWrapper.appendChild(particleLayer);
    avatarWrapper.appendChild(sprite);
    avatarWrapper.appendChild(levelBadge);

    // HP/MP bars (below avatar)
    const barWidth = Math.floor(70 * size);
    const barsContainer = document.createElement('div');
    barsContainer.style.cssText = `
      width: ${barWidth}px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 4px;
      pointer-events: none;
    `;

    // HP bar (color: green for adventurers, red for enemies)
    const hpBarColor = isEnemy ? '#dc3545' : '#28a745';
    const hpBar = this.createBar(character.currentHP, character.maxHP, hpBarColor);
    hpBar.setAttribute('data-bar-type', 'hp');
    barsContainer.appendChild(hpBar);
    
    // MP bar (only show for non-enemies)
    if (!isEnemy) {
      const mpBar = this.createBar(character.currentMP, character.maxMP, '#007bff');
      mpBar.setAttribute('data-bar-type', 'mp');
      barsContainer.appendChild(mpBar);
    }

    // Assemble container
    container.appendChild(nameLabel);
    container.appendChild(avatarWrapper);
    container.appendChild(barsContainer);

    // Hover effect
    sprite.addEventListener('mouseenter', () => {
      sprite.style.transform = 'scale(1.1)';
    });

    sprite.addEventListener('mouseleave', () => {
      sprite.style.transform = 'scale(1)';
    });

    return container;
  }

  /**
   * Create a progress bar element
   */
  private createBar(current: number, max: number, color: string): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `
      width: 100%;
      height: 4px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 2px;
      overflow: hidden;
    `;

    const fill = document.createElement('div');
    const percentage = Math.max(0, Math.min(100, (current / max) * 100));
    fill.style.cssText = `
      width: ${percentage}%;
      height: 100%;
      background: ${color};
      transition: width 0.3s ease;
    `;

    container.appendChild(fill);
    return container;
  }

  /**
   * Update a character's HP/MP bars
   */
  private updateBars(sprite: CharacterSprite): void {
    const hpBar = sprite.element.querySelector('[data-bar-type="hp"] > div') as HTMLDivElement;
    const mpBar = sprite.element.querySelector('[data-bar-type="mp"] > div') as HTMLDivElement;

    if (hpBar) {
      const hpPercentage = Math.max(0, Math.min(100, (sprite.character.currentHP / sprite.character.maxHP) * 100));
      hpBar.style.width = `${hpPercentage}%`;
    }

    if (mpBar) {
      const mpPercentage = Math.max(0, Math.min(100, (sprite.character.currentMP / sprite.character.maxMP) * 100));
      mpBar.style.width = `${mpPercentage}%`;
    }

    // Update level badge text if level has changed
    const avatarWrapper = sprite.element.querySelector('.battle-character-sprite')?.parentElement;
    if (avatarWrapper) {
      const levelBadge = Array.from(avatarWrapper.children).find(
        child => child.textContent?.startsWith('LV:')
      ) as HTMLDivElement;
      
      if (levelBadge) {
        const expectedText = `LV:${sprite.character.level}`;
        if (levelBadge.textContent !== expectedText) {
          levelBadge.textContent = expectedText;
        }
      }
    }
  }

  /**
   * Update container bounds - only update when valid and store initial bounds
   */
  private updateContainerBounds(): void {
    if (!this.container) return;
    
    const rect = this.container.getBoundingClientRect();
    const newWidth = rect.width;
    const newHeight = rect.height;
    
    // Only update if bounds are valid (not zero)
    if (newWidth > 0 && newHeight > 0) {
      // Store initial bounds on first valid update
      if (this.containerBounds.width === 0 || this.containerBounds.height === 0) {
        this.containerBounds.width = newWidth;
        this.containerBounds.height = newHeight;
        console.log(`[BattleSystem] Initial container bounds: ${newWidth}x${newHeight}`);
      } else {
        // Don't update bounds after initialization to prevent resize issues
        // Just clamp existing sprite positions to current bounds
        const spriteWidth = 70;
        const spriteHeight = 100;
        
        this.sprites.forEach((sprite) => {
          // Clamp positions to valid range
          sprite.x = Math.max(0, Math.min(sprite.x, newWidth - spriteWidth));
          sprite.y = Math.max(0, Math.min(sprite.y, newHeight - spriteHeight));
        });
      }
    }
  }

  /**
   * Start the update loop
   */
  private startUpdateLoop(): void {
    if (this.animationFrameId !== null) return;

    const update = () => {
      this.update();
      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  /**
   * Stop the update loop
   */
  private stopUpdateLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main update loop - handles movement, regeneration, and collision detection
   */
  private update(): void {
    const currentTime = Date.now();
    let deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
    
    // Cap deltaTime to prevent huge jumps when tab is inactive
    // Maximum 0.1 seconds (100ms) to prevent characters from teleporting
    deltaTime = Math.min(deltaTime, 0.1);
    
    this.lastUpdateTime = currentTime;

    // Don't update container bounds during normal operation to prevent resize issues
    // Bounds are set once during initialization

    this.sprites.forEach((sprite) => {
      // Skip dead or injured characters
      if (sprite.isDead || sprite.isInjured) {
        // Check for revive countdown
        if (sprite.isInjured && currentTime >= sprite.reviveTime) {
          this.reviveCharacter(sprite);
        }
        return;
      }

      // Check for random direction change (every 5-10 seconds)
      if (currentTime >= sprite.nextDirectionChangeTime && sprite.id !== this.bossId) {
        // Change direction randomly
        const angle = Math.random() * Math.PI * 2;
        const speed = 20 + sprite.character.moveSpeed;
        sprite.velocityX = Math.cos(angle) * speed;
        sprite.velocityY = Math.sin(angle) * speed;
        
        // Check if character has slip buff - use shorter interval
        let directionChangeDelay = 5000 + Math.random() * 5000; // 5000-10000ms default
        if (this.buffSystem && this.buffSystem.hasBuff(sprite.id, 'slip')) {
          const slipDef = this.buffSystem.getBuffDefinition('slip');
          if (slipDef && (slipDef as any).randomDirectionInterval) {
            directionChangeDelay = (slipDef as any).randomDirectionInterval * 1000;
          }
        }
        
        // Schedule next direction change
        sprite.nextDirectionChangeTime = currentTime + directionChangeDelay;
      }

      // Boss tracking behavior - track nearest adventurer (overrides random movement)
      // But wait 300ms after collision to allow knockback effect to show
      if (sprite.id === this.bossId && currentTime - sprite.lastCollisionTime > 300) {
        this.updateBossTracking(sprite);
      }

      // Dynamically adjust velocity magnitude based on current moveSpeed
      // This ensures BUFF changes to moveSpeed take effect immediately
      const currentVelocityMag = Math.sqrt(sprite.velocityX * sprite.velocityX + sprite.velocityY * sprite.velocityY);
      if (currentVelocityMag > 0) {
        const targetSpeed = 20 + sprite.character.moveSpeed;
        // For charging characters, use 2x speed
        const isCharging = sprite.chargeState && sprite.chargeState.active;
        const effectiveTarget = isCharging ? targetSpeed * 2 : targetSpeed;
        if (Math.abs(currentVelocityMag - effectiveTarget) > 0.5) {
          const scale = effectiveTarget / currentVelocityMag;
          sprite.velocityX *= scale;
          sprite.velocityY *= scale;
        }
      }

      // Update position
      this.updatePosition(sprite, deltaTime);

      // Update regeneration
      this.updateRegeneration(sprite, currentTime);

      // Update visual bars
      this.updateBars(sprite);

      // Update buff visual effects
      if (this.buffSystem) {
        this.applyBuffVisualEffects(sprite.id);
      }
      
      // Update divine proclamation protection circle
      this.updateDivineProtectionCircle(sprite);
      
      // Update death aura circle
      this.updateDeathAuraCircle(sprite);
      
      // Update death aura effects
      this.updateDeathAura(sprite, currentTime);
      
      // Update hunt master skill (periodic debuff)
      this.updateHunt(sprite, currentTime);
    });

    // Check for collisions between all sprites
    this.checkCollisions();
  }

  /**
   * Update character position and handle boundary collisions
   */
  private updatePosition(sprite: CharacterSprite, deltaTime: number): void {
    const spriteWidth = 70;
    const spriteHeight = 100;
    const margin = 5; // Add margin to prevent sticking to edges

    // Check if character can move
    if (!sprite.canMove) {
      // Character is immobilized, skip position update
      return;
    }

    // Update position based on velocity
    sprite.x += sprite.velocityX * deltaTime;
    sprite.y += sprite.velocityY * deltaTime;

    // Boundary collision detection and bounce with margin
    let bounced = false;
    
    if (sprite.x <= margin) {
      sprite.x = margin;
      sprite.velocityX = Math.abs(sprite.velocityX); // Bounce right
      bounced = true;
    } else if (sprite.x >= this.containerBounds.width - spriteWidth - margin) {
      sprite.x = this.containerBounds.width - spriteWidth - margin;
      sprite.velocityX = -Math.abs(sprite.velocityX); // Bounce left
      bounced = true;
    }

    if (sprite.y <= margin) {
      sprite.y = margin;
      sprite.velocityY = Math.abs(sprite.velocityY); // Bounce down
      bounced = true;
    } else if (sprite.y >= this.containerBounds.height - spriteHeight - margin) {
      sprite.y = this.containerBounds.height - spriteHeight - margin;
      sprite.velocityY = -Math.abs(sprite.velocityY); // Bounce up
      bounced = true;
    }

    // If bounced, add slight random variation to prevent getting stuck
    if (bounced) {
      const randomAngle = (Math.random() - 0.5) * 0.3; // Small random angle adjustment
      const speed = Math.sqrt(sprite.velocityX * sprite.velocityX + sprite.velocityY * sprite.velocityY);
      const currentAngle = Math.atan2(sprite.velocityY, sprite.velocityX);
      const newAngle = currentAngle + randomAngle;
      sprite.velocityX = Math.cos(newAngle) * speed;
      sprite.velocityY = Math.sin(newAngle) * speed;
    }

    // Apply position to element (GPU-composited transform for smooth movement)
    sprite.element.style.transform = `translate(${sprite.x}px, ${sprite.y}px)`;
  }

  /**
   * Update boss tracking - make boss move towards nearest adventurer
   */
  private updateBossTracking(bossSprite: CharacterSprite): void {
    // Find nearest adventurer
    let nearestAdventurer: CharacterSprite | null = null;
    let minDistance = Infinity;

    this.sprites.forEach((sprite) => {
      if (sprite.character.type !== 'Enemy' && !sprite.isDead && !sprite.isInjured) {
        const dx = sprite.x - bossSprite.x;
        const dy = sprite.y - bossSprite.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestAdventurer = sprite;
        }
      }
    });

    // If found an adventurer, move towards them
    if (nearestAdventurer) {
      const dx = nearestAdventurer.x - bossSprite.x;
      const dy = nearestAdventurer.y - bossSprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        // Normalize direction and apply speed
        const speed = 20 + bossSprite.character.moveSpeed;
        bossSprite.velocityX = (dx / distance) * speed;
        bossSprite.velocityY = (dy / distance) * speed;
      }
    }
  }

  /**
   * Update character HP/MP regeneration
   */
  private updateRegeneration(sprite: CharacterSprite, currentTime: number): void {
    const timeSinceLastRegen = (currentTime - sprite.lastRegenTime) / 1000; // Convert to seconds

    // Regenerate every second
    if (timeSinceLastRegen >= 1.0) {
      const character = sprite.character;

      // HP regeneration
      if (character.currentHP < character.maxHP) {
        character.currentHP = Math.min(
          character.maxHP,
          character.currentHP + character.hpRegen
        );
      }

      // MP regeneration
      const wasMPFull = character.currentMP >= character.maxMP;
      
      if (character.currentMP < character.maxMP) {
        character.currentMP = Math.min(
          character.maxMP,
          character.currentMP + character.mpRegen
        );
      }
      
      // Check if MP just became full and character has active skill (only for adventurers, not in village)
      const isMPFullNow = character.currentMP >= character.maxMP;
      if (!wasMPFull && isMPFullNow) {
        console.log(`[BattleSystem] ${character.name} MP is now full. Type: ${character.type}, ActiveSkill: ${character.activeSkill}, InBattle: ${this.isInBattleScene()}`);
        
        if (character.type === 'Adventurer' && 
            character.activeSkill &&
            this.isInBattleScene()) {
          // Trigger active skill
          this.castActiveSkill(sprite);
        } else {
          if (character.type !== 'Adventurer') {
            console.log(`[BattleSystem] ${character.name} is not an Adventurer (type: ${character.type})`);
          }
          if (!character.activeSkill) {
            console.log(`[BattleSystem] ${character.name} has no active skill equipped`);
          }
          if (!this.isInBattleScene()) {
            console.log(`[BattleSystem] Not in battle scene`);
          }
        }
      }

      sprite.lastRegenTime = currentTime;
    }
  }

  /**
   * Check if currently in a battle scene (not village)
   */
  private isInBattleScene(): boolean {
    // Check if current stage is a combat stage (not village)
    const combatStages = ['grassland', 'forest', 'cave'];
    return combatStages.includes(this.currentStage);
  }

  /**
   * Public method to trigger skill casting for a character by ID
   * Used by external systems (e.g., dev tools) to manually trigger skills
   */
  public triggerSkillForCharacter(characterId: string): void {
    // Find the character sprite
    let targetSprite: CharacterSprite | null = null;
    this.sprites.forEach((sprite) => {
      if (sprite.character.id === characterId) {
        targetSprite = sprite;
      }
    });

    if (!targetSprite) {
      console.warn(`[BattleSystem] Character ${characterId} not found in battle`);
      return;
    }

    // Only trigger if in battle scene and character has active skill
    if (this.isInBattleScene() && 
        targetSprite.character.type === 'Adventurer' && 
        targetSprite.character.activeSkill &&
        targetSprite.character.currentMP >= targetSprite.character.maxMP) {
      this.castActiveSkill(targetSprite);
    }
  }

  /**
   * Cast active skill for a character
   */
  private castActiveSkill(caster: CharacterSprite): void {
    console.log(`[BattleSystem] ${caster.character.name} casting active skill: ${caster.character.activeSkill}`);
    
    if (!caster.character.activeSkill) {
      console.warn(`[BattleSystem] Character ${caster.character.name} has no active skill`);
      return;
    }

    // Get skill data
    const skillData = this.npcSystem.getActiveSkill(caster.character.activeSkill);
    if (!skillData) {
      console.warn(`[BattleSystem] Skill ${caster.character.activeSkill} not found`);
      return;
    }

    // Reset MP to 0
    caster.character.currentMP = 0;
    
    // Show skill cast notification with skill name
    this.showSkillCastNotification(caster, skillData.name);
    
    console.log(`[BattleSystem] Executing skill: ${skillData.name}`, skillData);

    // Track first target for double_pupil (for single-target skills)
    let firstTargetId: string | undefined = undefined;
    
    // For tracking projectiles, find the first target
    if (skillData.effects && Array.isArray(skillData.effects)) {
      const trackingEffect = skillData.effects.find((e: any) => e.type === 'spawn_projectile' && e.tracking);
      if (trackingEffect) {
        // Find nearest enemy (same logic as applySpawnProjectileEffect)
        const enemies = Array.from(this.sprites.values()).filter(s => 
          !s.isDead && !s.isInjured &&
          ((caster.character.type === 'Enemy' && s.character.type !== 'Enemy') ||
           (caster.character.type !== 'Enemy' && s.character.type === 'Enemy'))
        );
        
        if (enemies.length > 0) {
          let minDist = Infinity;
          for (const enemy of enemies) {
            const dx = enemy.x - caster.x;
            const dy = enemy.y - caster.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
              minDist = dist;
              firstTargetId = enemy.id;
            }
          }
        }
      }
    }

    // Process each effect
    if (skillData.effects && Array.isArray(skillData.effects)) {
      skillData.effects.forEach((effect: any) => {
        this.applySkillEffect(caster, effect, skillData);
      });
    }
    
    // Handle mana_burst master skill (restore MP with probability)
    this.handleManaBurst(caster);
    
    // Handle double_pupil master skill (cast again on random target, excluding first target)
    this.handleDoublePupil(caster, skillData, firstTargetId);
  }

  /**
   * Apply a single skill effect
   */
  private applySkillEffect(caster: CharacterSprite, effect: any, skillData: any, forcedTargetId?: string): void {
    switch (effect.type) {
      case 'spawn_orbit':
        this.applySpawnOrbitEffect(caster, effect);
        break;
      case 'spawn_projectile':
        this.applySpawnProjectileEffect(caster, effect, forcedTargetId);
        break;
      case 'spawn_area':
        this.applySpawnAreaEffect(caster, effect);
        break;
      case 'charge_enemy':
        this.applyChargeEnemyEffect(caster, effect);
        break;
      case 'heal_lowest_hp':
        this.applyHealLowestHpEffect(caster, effect);
        break;
      case 'buff_ally':
        this.applyBuffAllyEffect(caster, effect);
        break;
      case 'buff_self':
        this.applyBuffSelfEffect(caster, effect);
        break;
      case 'shield_ally':
        this.applyShieldAllyEffect(caster, effect);
        break;
      case 'shield_all_allies':
        this.applyShieldAllAlliesEffect(caster, effect);
        break;
      case 'spawn_trap':
        this.applySpawnTrapEffect(caster, effect);
        break;
      case 'spawn_spike_trap':
        this.applySpawnSpikeTrapEffect(caster, effect);
        break;
      case 'soul_infusion':
        this.applySoulInfusionEffect(caster, effect);
        break;
      case 'buff_enemy':
        this.applyBuffEnemyEffect(caster, effect);
        break;
      case 'healing_area':
        this.applyHealingAreaEffect(caster, effect);
        break;
      case 'damage_area':
        this.applyDamageAreaEffect(caster, effect);
        break;
      default:
        console.warn(`[BattleSystem] Unknown skill effect type: ${effect.type}`);
    }
  }

  /**
   * Apply spawn_orbit effect (e.g., heavy_punch)
   */
  private applySpawnOrbitEffect(caster: CharacterSprite, effect: any): void {
    console.log(`[BattleSystem] Applying spawn_orbit effect for ${caster.character.name}`);
    
    // Calculate damage
    const baseDamage = effect.damage?.base || 0;
    const attackMultiplier = effect.damage?.attackMultiplier || 0;
    let totalDamage = baseDamage + (caster.character.attack * attackMultiplier);
    
    // Apply magic power bonus: each 1 point of magicPower increases final damage by 1%
    const magicPower = caster.character.magicPower || 0;
    if (magicPower > 0) {
      totalDamage = totalDamage * (1 + magicPower / 100);
    }
    totalDamage = Math.floor(totalDamage);
    
    // Calculate knockback
    const baseKnockback = effect.knockback?.base || 0;
    const strengthMultiplier = effect.knockback?.strengthMultiplier || 0;
    const totalKnockback = baseKnockback + (caster.character.strength * strengthMultiplier);
    
    // Create orbit projectile(s)
    const count = effect.count || 1;
    for (let i = 0; i < count; i++) {
      const angleOffset = (i * 2 * Math.PI) / count;
      this.createOrbitProjectile(caster, effect, totalDamage, totalKnockback, angleOffset);
    }
  }

  /**
   * Create an orbiting projectile around the caster
   */
  private createOrbitProjectile(caster: CharacterSprite, effect: any, damage: number, knockback: number, angleOffset: number = 0): void {
    if (!this.container) return;

    // --- Inject CSS keyframes once ---
    if (!document.getElementById('orbit-spin-keyframes')) {
      const style = document.createElement('style');
      style.id = 'orbit-spin-keyframes';
      style.textContent = `@keyframes orbit-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }

    const distance = effect.distance || Math.abs(effect.offsetY) || 100;
    const duration = effect.duration || effect.lifetime || 2000;
    const rotationSpeed = effect.rotationSpeed || 0.1;
    const rotationDir = effect.rotationDirection === 'counterclockwise' ? -1 : 1;

    // Calculate rotation period: rotationSpeed = seconds per full rotation
    const rotationPeriod = rotationSpeed;

    // --- Wrapper: positioned at caster center, CSS animation handles rotation ---
    const wrapper = document.createElement('div');
    const cx = caster.x + 35;
    const cy = caster.y + 35;
    wrapper.style.cssText = `
      position: absolute;
      left: ${cx}px;
      top: ${cy}px;
      width: 0;
      height: 0;
      pointer-events: none;
      z-index: 999;
      animation: orbit-spin ${rotationPeriod}s linear infinite${rotationDir < 0 ? ' reverse' : ''};
    `;

    // --- Orbital element: offset from wrapper center by distance ---
    const orbital = document.createElement('div');
    let scale = effect.scale || 1;
    // Apply skill-based scale bonus
    if (effect.skillScalePercent && caster.character.skill) {
      // Percentage mode: each point of skill increases size by skillScalePercent (e.g. 0.05 = 5%)
      scale *= (1 + effect.skillScalePercent * caster.character.skill);
    } else if (effect.scalePerSkill && caster.character.skill) {
      // Legacy flat mode: each point of skill adds scalePerSkill to scale
      scale += effect.scalePerSkill * caster.character.skill;
    }
    const imgSize = Math.round(40 * scale);

    if (effect.image) {
      const img = document.createElement('img');
      img.src = effect.image;
      img.style.width = `${imgSize}px`;
      img.style.height = `${imgSize}px`;
      img.style.objectFit = 'contain';
      orbital.appendChild(img);
    } else {
      orbital.textContent = effect.emoji || '👊';
    }

    const originalSize = effect.size || 50;
    const reducedSize = originalSize * 0.65;

    // Position orbital relative to wrapper center with angleOffset
    // Without offset: (0, -distance) = top of orbit
    // With offset: rotate that position by angleOffset
    const offsetX = Math.sin(angleOffset) * distance;
    const offsetY = -Math.cos(angleOffset) * distance;
    orbital.style.cssText = `
      position: absolute;
      left: ${offsetX - imgSize / 2}px;
      top: ${offsetY - imgSize / 2}px;
      ${effect.image ? '' : `font-size: ${reducedSize}px;`}
      pointer-events: none;
    `;

    if (effect.selfSpin) {
      // Inject self-spin keyframes once
      if (!document.getElementById('orbit-self-spin-keyframes')) {
        const style = document.createElement('style');
        style.id = 'orbit-self-spin-keyframes';
        style.textContent = `@keyframes orbit-self-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
      }

      const spinSpeed = effect.selfSpinSpeed || 1.0;
      orbital.style.animation = `orbit-self-spin ${1 / spinSpeed}s linear infinite`;
    }

    wrapper.appendChild(orbital);
    this.container.appendChild(wrapper);

    // Track this projectile for the caster (track wrapper as the element to remove)
    if (!this.activeOrbitProjectiles.has(caster.id)) {
      this.activeOrbitProjectiles.set(caster.id, []);
    }
    this.activeOrbitProjectiles.get(caster.id)!.push(wrapper);

    const hitCooldown = effect.hitCooldown || 0;
    const hitCooldownTracker = new Map<string, number>();
    const startTime = Date.now();
    const hitTargets = new Set<string>();
    let isRemoved = false;
    let lastTrailTime = 0;

    const removeProjectile = () => {
      if (isRemoved) return;
      isRemoved = true;

      wrapper.remove();

      const projectiles = this.activeOrbitProjectiles.get(caster.id);
      if (projectiles) {
        const index = projectiles.indexOf(wrapper);
        if (index > -1) {
          projectiles.splice(index, 1);
        }
        if (projectiles.length === 0) {
          this.activeOrbitProjectiles.delete(caster.id);
        }
      }
    };

    const animateOrbit = () => {
      if (!this.sprites.has(caster.id)) {
        removeProjectile();
        return;
      }

      const elapsed = Date.now() - startTime;

      if (elapsed >= duration) {
        removeProjectile();
        return;
      }

      // Check if completed one full rotation — only for non-lifetime based orbits
      if (!effect.lifetime) {
        const elapsedSec = elapsed / 1000;
        if (elapsedSec >= rotationPeriod) {
          removeProjectile();
          return;
        }
      }

      // Update wrapper position to follow caster (JS only moves the center point)
      const newCx = caster.x + 35;
      const newCy = caster.y + 35;
      wrapper.style.left = `${newCx}px`;
      wrapper.style.top = `${newCy}px`;

      // Calculate orbital world position for collision detection
      // Derive current angle from elapsed time and rotation period
      const elapsedSec = elapsed / 1000;
      const currentAngle = (elapsedSec / rotationPeriod) * Math.PI * 2 * rotationDir;
      // Orbital starts at top (0, -distance), which is angle = -π/2 in standard coords
      const worldAngle = -Math.PI / 2 + angleOffset + currentAngle;
      const orbX = newCx + Math.cos(worldAngle) * distance;
      const orbY = newCy + Math.sin(worldAngle) * distance;

      // Check collision with enemies
      const sprites = Array.from(this.sprites.values());
      for (const target of sprites) {
        if (target.isDead || target.isInjured) continue;
        if (target.id === caster.id) continue;

        const isValidTarget =
          (caster.character.type !== 'Enemy' && target.character.type === 'Enemy') ||
          (caster.character.type === 'Enemy' && target.character.type !== 'Enemy');

        if (!isValidTarget) continue;
        if (effect.hitOnce && hitTargets.has(target.id)) continue;

        if (hitCooldown > 0) {
          const lastHit = hitCooldownTracker.get(target.id) || 0;
          if (Date.now() - lastHit < hitCooldown) continue;
        }

        const dx = target.x + 35 - orbX;
        const dy = target.y + 35 - orbY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const collisionRadius = (imgSize / 2) * (effect.collisionScale || 1);
        const targetRadius = 35 * (target.size || 1);
        if (dist < collisionRadius + targetRadius) {
          let isCrit = false;
          if (caster.character.guaranteedCrit) {
            isCrit = true;
            caster.character.guaranteedCrit = false;
            console.log(`[BattleSystem] ${caster.character.name} triggered guaranteed crit on projectile!`);
          } else {
            const critChance = caster.character.critRate / 100;
            isCrit = Math.random() < critChance;
          }

          const baseDamage = Math.floor(damage);
          const damageReduction = baseDamage * (target.character.defense / 100);
          let finalDamage = Math.max(1, Math.floor(baseDamage - damageReduction));

          if (isCrit) {
            const critMultiplier = caster.character.critDamage / 100;
            finalDamage = Math.floor(finalDamage * critMultiplier);
            console.log(`[BattleSystem] Critical projectile hit! ${caster.character.name} dealt ${finalDamage} damage (${caster.character.critDamage}% crit damage)`);
          }

          const damageResult = this.applyDamageWithShield(target, finalDamage, caster.character);
          const actualDamage = damageResult.damage;
          const isActualCrit = isCrit || damageResult.isCritical;
          this.showDamageNumber(target, actualDamage, caster.character.type !== 'Enemy', isActualCrit);

          // Blood splash effect at target center instead of generic hit explosion
          this.showBloodSplash(target.x + 35, target.y + 35);

          if (effect.hitOnce) {
            hitTargets.add(target.id);
          }
          if (hitCooldown > 0) {
            hitCooldownTracker.set(target.id, Date.now());
          }

          if (target.character.currentHP <= 0 && !target.isDead) {
            const killerId = caster.character.type !== 'Enemy' ? caster.id : undefined;
            this.handleDeath(target, killerId);
          }

          // Destroy orbit projectile on hit if configured
          if (effect.destroyOnHit) {
            removeProjectile();
            return;
          }
        }
      }

      // Trail effect for orbit projectile
      if (effect.hasTrail) {
        const currentTime = Date.now();
        if (currentTime - lastTrailTime > 30) {
          lastTrailTime = currentTime;

          if (this.container) {
            const trail = document.createElement('div');
            const trailSize = imgSize * 0.5;

            // Determine trail color
            const isRed = effect.trailColor === 'red';
            const r1 = isRed ? 255 : 255;
            const g1 = isRed ? 50 : 180;
            const b1 = isRed ? 50 : 50;

            // Capture position at creation time
            const capturedX = orbX;
            const capturedY = orbY;

            trail.style.cssText = `
              position: absolute;
              width: ${trailSize}px;
              height: ${trailSize}px;
              left: ${capturedX - trailSize / 2}px;
              top: ${capturedY - trailSize / 2}px;
              background: radial-gradient(circle, rgba(${r1}, ${g1}, ${b1}, 0.8) 0%, rgba(${r1}, ${g1}, ${b1}, 0) 100%);
              border-radius: 50%;
              pointer-events: none;
              z-index: 997;
              opacity: 0.8;
            `;

            this.container.appendChild(trail);

            const trailStartTime = currentTime;
            const trailDuration = 500;
            const animateTrail = () => {
              const elapsed = Date.now() - trailStartTime;
              const progress = Math.min(elapsed / trailDuration, 1);
              if (progress >= 1) {
                trail.remove();
                return;
              }
              const scale = 1 - progress;
              const opacity = 0.8 * (1 - progress);
              trail.style.width = `${trailSize * scale}px`;
              trail.style.height = `${trailSize * scale}px`;
              trail.style.left = `${capturedX - (trailSize * scale) / 2}px`;
              trail.style.top = `${capturedY - (trailSize * scale) / 2}px`;
              trail.style.opacity = opacity.toString();
              requestAnimationFrame(animateTrail);
            };
            requestAnimationFrame(animateTrail);
          }
        }
      }

      requestAnimationFrame(animateOrbit);
    };

    animateOrbit();
  }

  /**
   * Apply spawn_area effect (e.g., dangji_lingyu - area control skills)
   */
  private applySpawnAreaEffect(caster: CharacterSprite, effect: any): void {
    console.log(`[BattleSystem] Applying spawn_area effect for ${caster.character.name}`);
    
    if (!this.container) return;

    // Calculate area diameter: 300 + skill * 4
    const diameterBase = effect.diameterBase || 300;
    const diameterTechniqueMultiplier = effect.diameterTechniqueMultiplier || 4.0;
    const diameter = diameterBase + (caster.character.skill * diameterTechniqueMultiplier);
    const radius = diameter / 2;
    
    // Calculate damage
    const baseDamage = effect.damage?.base || 0;
    const attackMultiplier = effect.damage?.attackMultiplier || 0;
    let totalDamage = baseDamage + (caster.character.attack * attackMultiplier);
    
    // Apply defense reduction
    const defense = caster.character.defense || 0;
    totalDamage = totalDamage - (totalDamage * defense / 100);
    totalDamage = Math.floor(totalDamage);
    
    // Get lifetime
    const lifetime = effect.lifetime || 4000;
    
    // Calculate area center based on caster's sprite center (not top-left corner)
    const spriteWidth = 70;
    const spriteHeight = 100;
    const areaCenterX = caster.x + spriteWidth / 2;
    const areaCenterY = caster.y + spriteHeight / 2;
    
    // Create area circle visual
    const areaCircle = document.createElement('div');
    areaCircle.style.cssText = `
      position: absolute;
      width: ${diameter}px;
      height: ${diameter}px;
      border-radius: 50%;
      border: 3px solid rgba(255, 100, 100, 0.8);
      background: radial-gradient(circle, rgba(255, 100, 100, 0.3) 0%, rgba(255, 100, 100, 0.1) 70%, transparent 100%);
      pointer-events: none;
      z-index: 100;
      left: ${areaCenterX - radius}px;
      top: ${areaCenterY - radius}px;
    `;
    
    // Add pulse animation if not already added
    if (!document.querySelector('style[data-area-pulse-animation]')) {
      const style = document.createElement('style');
      style.setAttribute('data-area-pulse-animation', 'true');
      style.textContent = `
        @keyframes pulseArea {
          0%, 100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    this.container.appendChild(areaCircle);
    
    // Track affected characters to apply damage only once
    const affectedCharacters = new Set<string>();
    
    // Track characters currently in the circle with the buff
    const charactersWithBuff = new Set<string>();
    
    // Check collision and apply effects periodically
    const checkInterval = setInterval(() => {
      if (!this.container || !areaCircle.parentNode) {
        clearInterval(checkInterval);
        return;
      }
      
      // Track which characters are currently in range this check
      const currentlyInRange = new Set<string>();
      
      for (const sprite of this.sprites.values()) {
        if (sprite.isDead || sprite.isInjured) continue;
        
        // Calculate distance from area center to sprite center
        const spriteCenterX = sprite.x + spriteWidth / 2;
        const spriteCenterY = sprite.y + spriteHeight / 2;
        const dx = spriteCenterX - areaCenterX;
        const dy = spriteCenterY - areaCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if sprite is within radius (considering sprite size)
        const spriteRadius = 35 * sprite.size; // baseSpriteRadius * size multiplier, consistent with checkCollisions
        if (distance <= radius + spriteRadius) {
          currentlyInRange.add(sprite.character.id);
          
          // Apply damage once per character
          if (!affectedCharacters.has(sprite.character.id)) {
            affectedCharacters.add(sprite.character.id);
            
            // Only damage enemies (not caster's allies)
            const isEnemy = (caster.character.type === 'Enemy' && sprite.character.type !== 'Enemy') ||
                           (caster.character.type !== 'Enemy' && sprite.character.type === 'Enemy');
            
            if (isEnemy && totalDamage > 0) {
              // Apply damage
              sprite.character.currentHP = Math.max(0, sprite.character.currentHP - totalDamage);
              
              // Show damage number
              this.showDamageNumber(sprite, totalDamage, false);
              
              console.log(`[BattleSystem] Area damage: ${caster.character.name} dealt ${totalDamage} to ${sprite.character.name}`);
              
              // Check if target died
              if (sprite.character.currentHP <= 0 && !sprite.isDead) {
                this.handleDeath(sprite);
              }
            }
          }
          
          // Apply buff to characters in range
          if (effect.applyBuff) {
            const isEnemy = (caster.character.type === 'Enemy' && sprite.character.type !== 'Enemy') ||
                           (caster.character.type !== 'Enemy' && sprite.character.type === 'Enemy');
            const shouldApplyBuff = 
              (effect.affectCaster && sprite === caster) ||
              (effect.affectEnemies && isEnemy);
            
            if (shouldApplyBuff && this.buffSystem) {
              // Apply buff if not already applied
              if (!charactersWithBuff.has(sprite.character.id)) {
                this.buffSystem.applyBuff(sprite.character.id, effect.applyBuff, 999); // Long duration, will be removed manually
                charactersWithBuff.add(sprite.character.id);
                
                // Check if this buff disables movement
                const buffDef = this.buffSystem.getBuffDefinition(effect.applyBuff);
                if (buffDef && buffDef.disableMovement) {
                  sprite.canMove = false;
                  console.log(`[BattleSystem] Movement disabled for ${sprite.character.name} by ${effect.applyBuff} buff`);
                  
                  // Show spinning loading icon above avatar
                  this.showDangjiLoadingIcon(sprite);
                }
              }
            }
          }
        }
      }
      
      // Remove buff from characters that left the circle
      if (effect.applyBuff && this.buffSystem) {
        for (const characterId of charactersWithBuff) {
          if (!currentlyInRange.has(characterId)) {
            // Character left the circle, remove buff
            this.buffSystem.removeBuff(characterId, effect.applyBuff);
            charactersWithBuff.delete(characterId);
            
            // Re-enable movement
            const sprite = this.sprites.get(characterId);
            if (sprite) {
              sprite.canMove = true;
              this.removeDangjiLoadingIcon(sprite);
              console.log(`[BattleSystem] Movement re-enabled for ${sprite.character.name} - left area`);
            }
          }
        }
      }
    }, 100); // Check every 100ms
    
    // Remove area after lifetime
    setTimeout(() => {
      clearInterval(checkInterval);
      
      // Remove buff from all characters still in the circle
      if (effect.applyBuff && this.buffSystem) {
        for (const characterId of charactersWithBuff) {
          this.buffSystem.removeBuff(characterId, effect.applyBuff);
          
          // Re-enable movement
          const sprite = this.sprites.get(characterId);
          if (sprite) {
            sprite.canMove = true;
            this.removeDangjiLoadingIcon(sprite);
            console.log(`[BattleSystem] Movement re-enabled for ${sprite.character.name} - area expired`);
          }
        }
        charactersWithBuff.clear();
      }
      
      if (areaCircle.parentNode) {
        areaCircle.remove();
      }
    }, lifetime);
  }

  /**
   * Show spinning loading icon above character avatar (for dangji buff)
   */
  private showDangjiLoadingIcon(sprite: CharacterSprite): void {
    // Add spin animation if not already added
    if (!document.querySelector('style[data-dangji-spin-animation]')) {
      const style = document.createElement('style');
      style.setAttribute('data-dangji-spin-animation', 'true');
      style.textContent = `
        @keyframes dangjiSpin {
          from { transform: translateX(-50%) rotate(0deg); }
          to { transform: translateX(-50%) rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    // Remove existing icon if any
    this.removeDangjiLoadingIcon(sprite);

    const avatarWrapper = sprite.element.querySelector('.battle-avatar-wrapper');
    if (!avatarWrapper) return;

    const icon = document.createElement('img');
    icon.src = 'images/loading.png';
    icon.className = 'dangji-loading-icon';
    icon.style.cssText = `
      position: absolute;
      top: -8px;
      left: 50%;
      width: 24px;
      height: 24px;
      pointer-events: none;
      z-index: 30;
      animation: dangjiSpin 1.5s linear infinite;
    `;
    avatarWrapper.appendChild(icon);
  }

  /**
   * Remove spinning loading icon from character avatar
   */
  private removeDangjiLoadingIcon(sprite: CharacterSprite): void {
    const icon = sprite.element.querySelector('.dangji-loading-icon');
    if (icon) {
      icon.remove();
    }
  }

  /**
   * Apply charge_enemy effect
   */
  private applyChargeEnemyEffect(caster: CharacterSprite, effect: any): void {
    // If caster already has an active charge, end it first to prevent stat desync
    if (caster.chargeState && caster.chargeState.active) {
      this.endChargeState(caster);
    }

    // Find nearest enemy
    const sprites = Array.from(this.sprites.values());
    let nearestEnemy: CharacterSprite | null = null;
    let minDistance = Infinity;

    for (const sprite of sprites) {
      if (sprite.isDead || sprite.isInjured) continue;
      if (sprite.id === caster.id) continue;
      
      const isValidTarget = 
        (caster.character.type !== 'Enemy' && sprite.character.type === 'Enemy') ||
        (caster.character.type === 'Enemy' && sprite.character.type !== 'Enemy');
      
      if (!isValidTarget) continue;

      const dx = sprite.x - caster.x;
      const dy = sprite.y - caster.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        nearestEnemy = sprite;
      }
    }

    if (!nearestEnemy) {
      return;
    }

    // Apply charge BUFF via BuffSystem if buffId is specified
    if (effect.buffId && this.buffSystem) {
      const durationSeconds = (effect.duration || 5000) / 1000;
      this.buffSystem.applyBuff(caster.id, effect.buffId, durationSeconds);
      
      // Trigger visual effect update
      setTimeout(() => {
        this.applyBuffVisualEffects(caster.id);
      }, 0);
    }

    // Set velocity towards enemy (use the now-buffed moveSpeed)
    const dx = nearestEnemy.x - caster.x;
    const dy = nearestEnemy.y - caster.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      caster.velocityX = (dx / distance) * caster.character.moveSpeed * 2;
      caster.velocityY = (dy / distance) * caster.character.moveSpeed * 2;
    }

    // Create afterimage generator
    const duration = effect.duration || 5000;
    const startTime = Date.now();
    let lastAfterimageTime = startTime;

    const createAfterimage = () => {
      // Check if charge buff is still active
      if (!this.buffSystem || !this.buffSystem.hasBuff(caster.id, 'charge')) return;
      if (!this.container || !caster.element) return;

      const avatarWrapper = caster.element.querySelector('.battle-character-sprite')?.parentElement;
      if (!avatarWrapper) return;

      const avatarCenterX = caster.x + (avatarWrapper.offsetLeft || 0);
      const avatarCenterY = caster.y + (avatarWrapper.offsetTop || 0);

      const afterimage = avatarWrapper.cloneNode(true) as HTMLElement;
      afterimage.style.position = 'absolute';
      afterimage.style.left = `${avatarCenterX}px`;
      afterimage.style.top = `${avatarCenterY}px`;
      afterimage.style.opacity = '0.5';
      afterimage.style.pointerEvents = 'none';
      afterimage.style.zIndex = '9';
      afterimage.style.mixBlendMode = 'multiply';
      afterimage.style.filter = 'hue-rotate(240deg) saturate(2)';

      this.container.appendChild(afterimage);

      // Fade out and remove afterimage
      setTimeout(() => {
        let opacity = 0.5;
        const fadeInterval = setInterval(() => {
          opacity -= 0.05;
          if (opacity <= 0) {
            clearInterval(fadeInterval);
            if (afterimage.parentNode) {
              afterimage.parentNode.removeChild(afterimage);
            }
          } else {
            afterimage.style.opacity = opacity.toString();
          }
        }, 30);
      }, 100);
    };

    // Initialize charge state (for collision detection reference)
    caster.chargeState = {
      active: true,
      endTime: startTime + duration,
      originalMoveSpeed: caster.character.moveSpeed,
      originalAttack: caster.character.attack,
      afterimageInterval: null,
      cleanupTimeout: null
    };

    // Generate afterimages while charge buff is active
    const afterimageGenerator = setInterval(() => {
      if (!this.buffSystem || !this.buffSystem.hasBuff(caster.id, 'charge')) {
        clearInterval(afterimageGenerator);
        if (caster.chargeState) {
          caster.chargeState.active = false;
          // Reset velocity when buff expires naturally
          const speed = Math.sqrt(caster.velocityX * caster.velocityX + caster.velocityY * caster.velocityY);
          if (speed > 0) {
            const newSpeed = 20 + caster.character.moveSpeed;
            caster.velocityX = (caster.velocityX / speed) * newSpeed;
            caster.velocityY = (caster.velocityY / speed) * newSpeed;
          }
        }
        return;
      }
      createAfterimage();
    }, 100);

    caster.chargeState.afterimageInterval = afterimageGenerator as any;

    // Backup cleanup timeout
    const cleanupTimeout = setTimeout(() => {
      clearInterval(afterimageGenerator);
      if (caster.chargeState) {
        caster.chargeState.active = false;
      }
    }, duration);

    caster.chargeState.cleanupTimeout = cleanupTimeout as any;
  }

  /**
   * End charge state for a character
   */
  private endChargeState(sprite: CharacterSprite): void {
    if (!sprite.chargeState || !sprite.chargeState.active) return;
    
    // Clear intervals and timeouts
    if (sprite.chargeState.afterimageInterval !== null) {
      clearInterval(sprite.chargeState.afterimageInterval);
    }
    if (sprite.chargeState.cleanupTimeout !== null) {
      clearTimeout(sprite.chargeState.cleanupTimeout);
    }
    
    // Remove charge buff via BuffSystem (this handles stat restoration)
    if (this.buffSystem && this.buffSystem.hasBuff(sprite.id, 'charge')) {
      this.buffSystem.removeBuff(sprite.id, 'charge');
      // Update visual effects
      setTimeout(() => {
        this.applyBuffVisualEffects(sprite.id);
      }, 0);
    }
    
    // Recalculate velocity with restored moveSpeed to prevent inertia
    const currentSpeed = Math.sqrt(sprite.velocityX * sprite.velocityX + sprite.velocityY * sprite.velocityY);
    if (currentSpeed > 0) {
      const normalizedX = sprite.velocityX / currentSpeed;
      const normalizedY = sprite.velocityY / currentSpeed;
      const newSpeed = 20 + sprite.character.moveSpeed;
      sprite.velocityX = normalizedX * newSpeed;
      sprite.velocityY = normalizedY * newSpeed;
    }
    
    // Mark charge as inactive
    sprite.chargeState.active = false;
  }

  /**
   * Apply heal_lowest_hp effect
   */
  private applyHealLowestHpEffect(caster: CharacterSprite, effect: any): void {
    console.log(`[BattleSystem] Applying heal_lowest_hp effect for ${caster.character.name}`);
    
    // Find ally with lowest HP percentage
    const sprites = Array.from(this.sprites.values());
    let lowestHpAlly: CharacterSprite | null = null;
    let lowestHpPercent = 1.0;

    for (const sprite of sprites) {
      if (sprite.isDead || sprite.isInjured) continue;
      
      // Only heal allies (same type)
      const isAlly = 
        (caster.character.type === 'Enemy' && sprite.character.type === 'Enemy') ||
        (caster.character.type !== 'Enemy' && sprite.character.type !== 'Enemy');
      
      if (!isAlly) continue;

      const hpPercent = sprite.character.currentHP / sprite.character.maxHP;
      if (hpPercent < lowestHpPercent) {
        lowestHpPercent = hpPercent;
        lowestHpAlly = sprite;
      }
    }

    if (!lowestHpAlly) {
      console.log(`[BattleSystem] No valid ally found to heal`);
      return;
    }

    // Calculate healing
    const baseHealing = effect.healing?.base || 10;
    const skillMultiplier = effect.healing?.skillMultiplier || 1.0;
    let totalHealing = baseHealing + (caster.character.skill * skillMultiplier);
    
    // Apply magic power bonus to healing: each 1 point of magicPower increases healing by 1%
    const magicPower = caster.character.magicPower || 0;
    if (magicPower > 0) {
      totalHealing = totalHealing * (1 + magicPower / 100);
    }
    totalHealing = Math.floor(totalHealing);

    // Apply healing
    const oldHP = lowestHpAlly.character.currentHP;
    lowestHpAlly.character.currentHP = Math.min(
      lowestHpAlly.character.maxHP,
      lowestHpAlly.character.currentHP + totalHealing
    );

    // Show healing number
    this.showHealingNumber(lowestHpAlly, totalHealing);
    
    console.log(`[BattleSystem] Healed ${lowestHpAlly.character.name} for ${totalHealing} HP (${oldHP} -> ${lowestHpAlly.character.currentHP})`);
  }

  /**
   * Show healing number above character
   */
  private showHealingNumber(sprite: CharacterSprite, amount: number): void {
    if (!this.container) return;

    // Check if floatUpHeal animation exists, if not, add it
    const styleSheets = document.styleSheets;
    let animationExists = false;
    
    for (let i = 0; i < styleSheets.length; i++) {
      try {
        const rules = styleSheets[i].cssRules || styleSheets[i].rules;
        for (let j = 0; j < rules.length; j++) {
          if (rules[j].cssText && rules[j].cssText.includes('floatUpHeal')) {
            animationExists = true;
            break;
          }
        }
      } catch (e) {
        // Skip stylesheets that can't be accessed due to CORS
      }
      if (animationExists) break;
    }

    if (!animationExists) {
      const style = document.createElement('style');
      style.textContent = `
        @keyframes floatUpHeal {
          0% {
            transform: translateY(0);
            opacity: 1;
          }
          100% {
            transform: translateY(-50px);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    const healText = document.createElement('div');
    healText.textContent = `+${Math.floor(amount)}`;
    healText.style.cssText = `
      position: absolute;
      left: ${sprite.x + 35}px;
      top: ${sprite.y - 20}px;
      color: #28a745;
      font-size: 20px;
      font-weight: bold;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000;
      pointer-events: none;
      z-index: 1000;
      animation: floatUpHeal 1s ease-out forwards;
    `;

    this.container.appendChild(healText);

    setTimeout(() => {
      if (healText.parentNode) {
        healText.parentNode.removeChild(healText);
      }
    }, 1000);
  }

  /**
   * Apply buff_ally effect
   */
  private applyBuffAllyEffect(caster: CharacterSprite, effect: any): void {
    // Find a random ally (including caster)
    const sprites = Array.from(this.sprites.values());
    const allies: CharacterSprite[] = [];

    for (const sprite of sprites) {
      if (sprite.isDead || sprite.isInjured) continue;
      
      // Only buff allies (same type) - now includes caster
      const isAlly = 
        (caster.character.type === 'Enemy' && sprite.character.type === 'Enemy') ||
        (caster.character.type !== 'Enemy' && sprite.character.type !== 'Enemy');
      
      if (isAlly) {
        allies.push(sprite);
      }
    }

    if (allies.length === 0) {
      return;
    }

    // Pick random ally (can be caster)
    const target = allies[Math.floor(Math.random() * allies.length)];

    // If the effect specifies a buffId, use the BuffSystem for proper BUFF management
    if (effect.buffId && this.buffSystem) {
      const durationSeconds = (effect.duration || 8000) / 1000;
      this.buffSystem.applyBuff(target.id, effect.buffId, durationSeconds);
      
      // Show angry emoji visual if specified
      if (effect.visualEffect === 'angry_emoji' && target.element) {
        const avatarWrapper = target.element.querySelector('.battle-character-sprite')?.parentElement;
        if (avatarWrapper) {
          const emoji = document.createElement('div');
          emoji.textContent = '😡';
          emoji.style.cssText = `
            position: absolute;
            top: -40px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 32px;
            z-index: 100;
            pointer-events: none;
            animation: shake 0.5s ease-in-out 3;
          `;
          avatarWrapper.appendChild(emoji);
          setTimeout(() => emoji.remove(), 1500);
        }
      }

      // Trigger visual effect update
      setTimeout(() => {
        this.applyBuffVisualEffects(target.id);
      }, 0);
      return;
    }

    // Fallback: manual stat manipulation for skills without buffId
    const originalAttack = target.character.attack;
    const originalMoveSpeed = target.character.moveSpeed;
    
    target.character.attack *= (1 + (effect.attackBonus || 0));
    target.character.moveSpeed *= (1 + (effect.speedBonus || 0));

    if (target.element) {
      target.element.style.filter = 'brightness(1.3) saturate(1.5) drop-shadow(0 0 10px red)';
    }

    const targetId = target.id;
    setTimeout(() => {
      const targetSprite = this.sprites.get(targetId);
      if (!targetSprite) return;
      targetSprite.character.attack = originalAttack;
      targetSprite.character.moveSpeed = originalMoveSpeed;
      if (targetSprite.element) {
        targetSprite.element.style.filter = '';
      }
    }, effect.duration || 5000);
  }

  /**
   * Apply buff_enemy effect (e.g., hamster transformation)
   */
  private applyBuffEnemyEffect(caster: CharacterSprite, effect: any): void {
    if (!effect.buffId || !this.buffSystem) {
      console.warn('[BattleSystem] buff_enemy effect requires buffId and BuffSystem');
      return;
    }

    const sprites = Array.from(this.sprites.values());
    const enemies: CharacterSprite[] = [];

    for (const sprite of sprites) {
      if (sprite.isDead || sprite.isInjured) continue;
      const isEnemy =
        (caster.character.type === 'Enemy' && sprite.character.type !== 'Enemy') ||
        (caster.character.type !== 'Enemy' && sprite.character.type === 'Enemy');
      if (isEnemy) enemies.push(sprite);
    }

    if (enemies.length === 0) return;

    // Prefer boss if configured
    let target: CharacterSprite | null = null;
    if (effect.preferBoss && this.bossId) {
      target = enemies.find(e => e.id === this.bossId) || null;
    }
    if (!target) {
      target = enemies[Math.floor(Math.random() * enemies.length)];
    }

    // Calculate duration: baseDuration + skill * durationPerSkill
    const baseDuration = effect.baseDuration || 8000;
    const durationPerSkill = effect.durationPerSkill || 0;
    const totalDurationMs = baseDuration + (caster.character.skill * durationPerSkill);
    const durationSeconds = totalDurationMs / 1000;

    this.buffSystem.applyBuff(target.id, effect.buffId, durationSeconds);

    // Directly apply buff stat effects for enemies
    const buffDef = this.buffSystem.getBuffDefinition(effect.buffId);
    if (buffDef && buffDef.effects && target.character.type === 'Enemy') {
      // Store base stats before modification if not already stored
      if (!target.baseStats) {
        target.baseStats = {
          moveSpeed: target.character.moveSpeed,
          attack: target.character.attack,
          defense: target.character.defense,
          weight: target.character.weight
        };
      }
      for (const eff of buffDef.effects) {
        const attr = eff.attribute as string;
        if (typeof (target.character as any)[attr] === 'number') {
          if (eff.type === 'flat') {
            (target.character as any)[attr] += eff.value;
          } else if (eff.type === 'percentage') {
            (target.character as any)[attr] *= (1 + eff.value / 100);
          }
        }
      }
    }

    console.log(`[BattleSystem] Applied ${effect.buffId} to enemy ${target.character.name} for ${durationSeconds}s`);

    // Trigger visual effect update
    this.characterBuffStates.set(target.id, new Set(['__force_update__']));
    this.applyBuffVisualEffects(target.id);
  }

  /**
   * Apply healing_area effect (e.g., zhiliao_lingyu - healing zone at lowest HP ally)
   */
  private applyHealingAreaEffect(caster: CharacterSprite, effect: any): void {
    console.log(`[BattleSystem] Applying healing_area effect for ${caster.character.name}`);
    
    if (!this.container) return;

    // Find the ally with the lowest HP (including caster)
    const sprites = Array.from(this.sprites.values());
    let lowestHPAlly: CharacterSprite | null = null;
    let lowestHPRatio = Infinity;

    for (const sprite of sprites) {
      if (sprite.isDead || sprite.isInjured) continue;
      const isAlly =
        (caster.character.type === 'Enemy' && sprite.character.type === 'Enemy') ||
        (caster.character.type !== 'Enemy' && sprite.character.type !== 'Enemy');
      if (isAlly) {
        const hpRatio = sprite.character.currentHP / sprite.character.maxHP;
        if (hpRatio < lowestHPRatio) {
          lowestHPRatio = hpRatio;
          lowestHPAlly = sprite;
        }
      }
    }

    if (!lowestHPAlly) return;

    // Calculate area diameter: base + technique * multiplier
    const diameterBase = effect.diameterBase || 300;
    const diameterTechniqueMultiplier = effect.diameterTechniqueMultiplier || 4.0;
    const diameter = diameterBase + (caster.character.skill * diameterTechniqueMultiplier);
    const radius = diameter / 2;

    // Calculate heal amount: base + wisdom * multiplier
    const healBase = effect.heal?.base || 1;
    const wisdomMultiplier = effect.heal?.wisdomMultiplier || 0.15;
    const healAmount = Math.floor(healBase + (caster.character.wisdom * wisdomMultiplier));

    const lifetime = effect.lifetime || 5000;
    const healInterval = effect.healInterval || 1000;

    // Area center at the lowest HP ally's sprite center
    const spriteWidth = 70;
    const spriteHeight = 100;
    const areaCenterX = lowestHPAlly.x + spriteWidth / 2;
    const areaCenterY = lowestHPAlly.y + spriteHeight / 2;

    // Create healing area circle visual
    const bgColor = effect.color || 'rgba(144, 238, 144, 0.3)';
    const borderColor = effect.borderColor || 'rgba(144, 238, 144, 0.8)';
    const areaCircle = document.createElement('div');
    areaCircle.style.cssText = `
      position: absolute;
      width: ${diameter}px;
      height: ${diameter}px;
      border-radius: 50%;
      border: 3px solid ${borderColor};
      background: radial-gradient(circle, ${bgColor} 0%, rgba(144, 238, 144, 0.1) 70%, transparent 100%);
      pointer-events: none;
      z-index: 100;
      left: ${areaCenterX - radius}px;
      top: ${areaCenterY - radius}px;
    `;

    this.container.appendChild(areaCircle);

    console.log(`[BattleSystem] Healing area spawned at (${areaCenterX.toFixed(0)}, ${areaCenterY.toFixed(0)}), diameter: ${diameter.toFixed(0)}, heal: ${healAmount}/tick`);

    // Periodic healing check
    const healCheck = setInterval(() => {
      if (!this.container || !areaCircle.parentNode) {
        clearInterval(healCheck);
        return;
      }

      for (const sprite of this.sprites.values()) {
        if (sprite.isDead || sprite.isInjured) continue;

        // Only heal allies
        const isAlly =
          (caster.character.type === 'Enemy' && sprite.character.type === 'Enemy') ||
          (caster.character.type !== 'Enemy' && sprite.character.type !== 'Enemy');
        if (!isAlly) continue;

        // Check collision with area
        const spriteCenterX = sprite.x + spriteWidth / 2;
        const spriteCenterY = sprite.y + spriteHeight / 2;
        const dx = spriteCenterX - areaCenterX;
        const dy = spriteCenterY - areaCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const spriteRadius = 35 * sprite.size;

        if (distance <= radius + spriteRadius) {
          // Only heal if not at full HP
          if (sprite.character.currentHP < sprite.character.maxHP) {
            const actualHeal = Math.min(healAmount, sprite.character.maxHP - sprite.character.currentHP);
            sprite.character.currentHP += actualHeal;
            this.showHealNumber(sprite, actualHeal);
            this.updateBars(sprite);

            if (this.onCharacterHealedCallback) {
              this.onCharacterHealedCallback(sprite.id, actualHeal);
            }

            console.log(`[BattleSystem] Healing area healed ${sprite.character.name} for ${actualHeal} HP`);
          }
        }
      }
    }, healInterval);

    // Remove area after lifetime
    setTimeout(() => {
      clearInterval(healCheck);
      if (areaCircle.parentNode) {
        areaCircle.remove();
      }
      console.log(`[BattleSystem] Healing area expired`);
    }, lifetime);
  }

  /**
   * Apply damage_area effect (e.g., shenmi_zhiyao - high frequency damage zone at random position)
   */
  private applyDamageAreaEffect(caster: CharacterSprite, effect: any): void {
    console.log(`[BattleSystem] Applying damage_area effect for ${caster.character.name}`);
    
    if (!this.container) return;

    const diameter = effect.diameter || 150;
    const radius = diameter / 2;

    // Calculate lifetime: base + technique * perSkill
    const baseLifetime = effect.lifetime || 3000;
    const lifetimePerSkill = effect.lifetimePerSkill || 200;
    const lifetime = baseLifetime + (caster.character.skill * lifetimePerSkill);

    const damageInterval = effect.damageInterval || 250;
    const particleInterval = effect.particleInterval || 100;

    // Calculate damage: base + wisdom * multiplier
    const damageBase = effect.damage?.base || 0;
    const wisdomMultiplier = effect.damage?.wisdomMultiplier || 0.1;
    const damageAmount = Math.max(1, Math.floor(damageBase + (caster.character.wisdom * wisdomMultiplier)));

    // Random position within container
    this.updateContainerBounds();
    const areaCenterX = radius + Math.random() * (this.containerBounds.width - diameter);
    const areaCenterY = radius + Math.random() * (this.containerBounds.height - diameter);

    // Create area circle visual
    const bgColor = effect.color || 'rgba(255, 255, 150, 0.3)';
    const borderColor = effect.borderColor || 'rgba(255, 255, 100, 0.8)';
    const areaCircle = document.createElement('div');
    areaCircle.style.cssText = `
      position: absolute;
      width: ${diameter}px;
      height: ${diameter}px;
      border-radius: 50%;
      border: 2px solid ${borderColor};
      background: radial-gradient(circle, ${bgColor} 0%, rgba(255, 255, 150, 0.1) 70%, transparent 100%);
      pointer-events: none;
      z-index: 100;
      left: ${areaCenterX - radius}px;
      top: ${areaCenterY - radius}px;
    `;

    this.container.appendChild(areaCircle);

    console.log(`[BattleSystem] Damage area spawned at (${areaCenterX.toFixed(0)}, ${areaCenterY.toFixed(0)}), diameter: ${diameter}, lifetime: ${lifetime}ms, damage: ${damageAmount}/tick`);

    const spriteWidth = 70;
    const spriteHeight = 100;

    // Periodic damage check
    const damageCheck = setInterval(() => {
      if (!this.container || !areaCircle.parentNode) {
        clearInterval(damageCheck);
        return;
      }

      for (const sprite of this.sprites.values()) {
        if (sprite.isDead || sprite.isInjured) continue;

        // Only damage enemies
        const isEnemy =
          (caster.character.type === 'Enemy' && sprite.character.type !== 'Enemy') ||
          (caster.character.type !== 'Enemy' && sprite.character.type === 'Enemy');
        if (!isEnemy) continue;

        // Check collision
        const spriteCenterX = sprite.x + spriteWidth / 2;
        const spriteCenterY = sprite.y + spriteHeight / 2;
        const dx = spriteCenterX - areaCenterX;
        const dy = spriteCenterY - areaCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const spriteRadius = 35 * sprite.size;

        if (distance <= radius + spriteRadius) {
          sprite.character.currentHP = Math.max(0, sprite.character.currentHP - damageAmount);
          this.showDamageNumber(sprite, damageAmount, false);
          this.updateBars(sprite);

          if (sprite.character.currentHP <= 0 && !sprite.isDead) {
            this.handleDeath(sprite);
          }
        }
      }
    }, damageInterval);

    // Periodic particle effects (screen blend yellow explosions)
    const particleCheck = setInterval(() => {
      if (!this.container || !areaCircle.parentNode) {
        clearInterval(particleCheck);
        return;
      }

      // Random position within the circle
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius * 0.8;
      const px = areaCenterX + Math.cos(angle) * dist;
      const py = areaCenterY + Math.sin(angle) * dist;

      // Create 4-6 small yellow particles
      const count = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        const pSize = (4 + Math.random() * 8) * 2;
        particle.style.cssText = `
          position: absolute;
          width: ${pSize}px;
          height: ${pSize}px;
          left: ${px - pSize / 2}px;
          top: ${py - pSize / 2}px;
          background: radial-gradient(circle, rgba(255, 255, 100, 1) 0%, rgba(255, 200, 50, 0.8) 100%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 999;
          opacity: 1;
          mix-blend-mode: screen;
          box-shadow: 0 0 6px rgba(255, 255, 100, 0.9), 0 0 12px rgba(255, 200, 50, 0.5);
        `;
        this.container.appendChild(particle);

        const pAngle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const pSpeed = 30 + Math.random() * 60;
        let velX = Math.cos(pAngle) * pSpeed;
        let velY = Math.sin(pAngle) * pSpeed;
        let opacity = 1;
        let posX = px - pSize / 2;
        let posY = py - pSize / 2;

        const animateParticle = () => {
          posX += velX * 0.016;
          posY += velY * 0.016;
          velY += 80 * 0.016;
          opacity -= 0.04;
          if (opacity <= 0) {
            particle.remove();
          } else {
            particle.style.left = `${posX}px`;
            particle.style.top = `${posY}px`;
            particle.style.opacity = opacity.toString();
            requestAnimationFrame(animateParticle);
          }
        };
        requestAnimationFrame(animateParticle);
      }
    }, particleInterval);

    // Remove area after lifetime
    setTimeout(() => {
      clearInterval(damageCheck);
      clearInterval(particleCheck);
      if (areaCircle.parentNode) {
        areaCircle.remove();
      }
      console.log(`[BattleSystem] Damage area expired`);
    }, lifetime);
  }

  /**
   * Apply buff_self effect (e.g., combat_stance)
   */
  private applyBuffSelfEffect(caster: CharacterSprite, effect: any): void {
    if (!effect.buffId || !this.buffSystem) {
      console.warn('[BattleSystem] buff_self effect requires buffId and BuffSystem');
      return;
    }

    const durationSeconds = (effect.duration || 10000) / 1000;
    this.buffSystem.applyBuff(caster.id, effect.buffId, durationSeconds);
    
    // Trigger visual effect update
    setTimeout(() => {
      this.applyBuffVisualEffects(caster.id);
    }, 0);
  }

  /**
   * Apply shield_ally effect (e.g., sanctuary)
   */
  private applyShieldAllyEffect(caster: CharacterSprite, effect: any): void {
    // Find a random ally (including caster)
    const sprites = Array.from(this.sprites.values());
    const allies: CharacterSprite[] = [];

    for (const sprite of sprites) {
      if (sprite.isDead || sprite.isInjured) continue;
      
      // Only shield allies (same type) - includes caster
      const isAlly = 
        (caster.character.type === 'Enemy' && sprite.character.type === 'Enemy') ||
        (caster.character.type !== 'Enemy' && sprite.character.type !== 'Enemy');
      
      if (isAlly) {
        allies.push(sprite);
      }
    }

    if (allies.length === 0) {
      return;
    }

    // Pick random ally (can be caster)
    const target = allies[Math.floor(Math.random() * allies.length)];

    // Calculate shield amount
    const baseShield = effect.shieldAmount?.base || 50;
    const skillMultiplier = effect.shieldAmount?.skillMultiplier || 0;
    const totalShield = Math.floor(baseShield + (caster.character.skill * skillMultiplier));

    // Apply shield
    target.character.currentShield = (target.character.currentShield || 0) + totalShield;

    // Show shield visual effect
    this.showShieldVisualEffect(target);

    // Show notification
    this.showBuffNotification(target, `+${totalShield} 护盾`);

    // Remove shield after duration
    const duration = effect.duration || 10000;
    const targetId = target.id;
    setTimeout(() => {
      const targetSprite = this.sprites.get(targetId);
      if (targetSprite) {
        targetSprite.character.currentShield = Math.max(0, (targetSprite.character.currentShield || 0) - totalShield);
        // Remove visual effect if shield is gone
        if ((targetSprite.character.currentShield || 0) <= 0) {
          this.removeShieldVisualEffect(targetSprite);
        }
      }
    }, duration);
  }

  /**
   * Apply shield_all_allies effect (守护之光)
   * Adds shield to all living allied characters including the caster
   */
  private applyShieldAllAlliesEffect(caster: CharacterSprite, effect: any): void {
    const sprites = Array.from(this.sprites.values());
    const allies: CharacterSprite[] = [];

    for (const sprite of sprites) {
      if (sprite.isDead || sprite.isInjured) continue;

      const isAlly =
        (caster.character.type === 'Enemy' && sprite.character.type === 'Enemy') ||
        (caster.character.type !== 'Enemy' && sprite.character.type !== 'Enemy');

      if (isAlly) {
        allies.push(sprite);
      }
    }

    if (allies.length === 0) {
      return;
    }

    // Calculate shield amount: base + caster.defense * defenseMultiplier
    const baseShield = effect.shieldAmount?.base || 15;
    const defenseMultiplier = effect.shieldAmount?.defenseMultiplier || 1.0;
    const totalShield = Math.floor(baseShield + (caster.character.defense * defenseMultiplier));

    const duration = effect.duration || 10000;

    for (const ally of allies) {
      // Apply shield (accumulate on existing shield)
      ally.character.currentShield = (ally.character.currentShield || 0) + totalShield;

      // Show shield visual effect
      this.showShieldVisualEffect(ally);

      // Show notification
      this.showBuffNotification(ally, `+${totalShield} 护盾`);

      // Remove shield after duration
      const allyId = ally.id;
      setTimeout(() => {
        const allySprite = this.sprites.get(allyId);
        if (allySprite) {
          allySprite.character.currentShield = Math.max(0, (allySprite.character.currentShield || 0) - totalShield);
          if ((allySprite.character.currentShield || 0) <= 0) {
            this.removeShieldVisualEffect(allySprite);
          }
        }
      }, duration);
    }
  }

  /**
   * Show shield visual effect on character
   */
  private showShieldVisualEffect(sprite: CharacterSprite): void {
    if (!sprite.element) return;

    // Check if shield effect already exists
    const existingShield = sprite.element.querySelector('.shield-effect');
    if (existingShield) return;

    // Create shield visual effect
    const shieldEffect = document.createElement('img');
    shieldEffect.src = 'images/texiao_paopao.png';
    shieldEffect.className = 'shield-effect';
    shieldEffect.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 100px;
      height: 100px;
      pointer-events: none;
      z-index: 10;
      opacity: 0.8;
    `;

    sprite.element.appendChild(shieldEffect);
  }

  /**
   * Remove shield visual effect from character
   */
  private removeShieldVisualEffect(sprite: CharacterSprite): void {
    if (!sprite.element) return;

    const shieldEffect = sprite.element.querySelector('.shield-effect');
    if (shieldEffect) {
      shieldEffect.remove();
    }
  }

  /**
   * Apply spawn_spike_trap effect - place a persistent spike trap at a random position
   */
  private applySpawnSpikeTrapEffect(caster: CharacterSprite, effect: any): void {
    if (!this.container) return;
    console.log(`[BattleSystem] Spawning spike trap for ${caster.character.name}`);

    const baseDiameter = effect.diameter || 300;
    const scalePerSkill = effect.scalePerSkill || 0.04;
    const technique = caster.character.skill || 0;
    const finalDiameter = Math.round(baseDiameter * (1 + scalePerSkill * technique));
    const radius = finalDiameter / 2;

    const baseDamage = effect.damage?.base || 5;
    const attackMultiplier = effect.damage?.attackMultiplier || 0.2;
    const totalDamage = Math.floor(baseDamage + caster.character.attack * attackMultiplier);

    const lifetime = effect.lifetime || 6000;
    const hitInterval = effect.hitInterval || 750;

    const sceneWidth = this.container.clientWidth || 800;
    const sceneHeight = this.container.clientHeight || 600;
    const centerX = radius + Math.random() * (sceneWidth - finalDiameter);
    const centerY = radius + Math.random() * (sceneHeight - finalDiameter);

    const circle = document.createElement('div');
    circle.style.cssText = `
      position: absolute;
      width: ${finalDiameter}px;
      height: ${finalDiameter}px;
      border-radius: 50%;
      background: ${effect.color || 'rgba(139, 90, 43, 0.3)'};
      mix-blend-mode: ${effect.blendMode || 'multiply'};
      pointer-events: none;
      z-index: 4;
      left: ${centerX - radius}px;
      top: ${centerY - radius}px;
    `;
    this.container.appendChild(circle);

    const lastHitTime = new Map<string, number>();
    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      if (!this.container || !circle.parentNode) {
        clearInterval(checkInterval);
        return;
      }
      const now = Date.now();
      if (now - startTime >= lifetime) {
        clearInterval(checkInterval);
        circle.remove();
        return;
      }
      for (const sprite of this.sprites.values()) {
        if (sprite.isDead || sprite.isInjured) continue;
        const isEnemy =
          (caster.character.type !== 'Enemy' && sprite.character.type === 'Enemy') ||
          (caster.character.type === 'Enemy' && sprite.character.type !== 'Enemy');
        if (!isEnemy) continue;
        const spriteCenterX = sprite.x + 35;
        const spriteCenterY = sprite.y + 50;
        const dx = spriteCenterX - centerX;
        const dy = spriteCenterY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const spriteRadius = 35 * sprite.size;
        if (distance <= radius + spriteRadius) {
          const lastHit = lastHitTime.get(sprite.id) || 0;
          if (now - lastHit >= hitInterval) {
            lastHitTime.set(sprite.id, now);
            const result = this.applyDamageWithShield(sprite, totalDamage, caster.character);
            if (result.damage > 0) {
              this.showDamageNumber(sprite, result.damage, sprite.character.type === 'Enemy', result.isCritical);
              this.showBloodSplash(sprite.x + 35, sprite.y + 35);
              if (sprite.character.currentHP <= 0 && !sprite.isDead) {
                const killerId = caster.character.type !== 'Enemy' ? caster.id : undefined;
                this.handleDeath(sprite, killerId);
              }
            }
          }
        }
      }
    }, 100);
  }

  /**
   * Apply soul_infusion effect - damage a random enemy, then restore MP to a random ally
   */
  private applySoulInfusionEffect(caster: CharacterSprite, effect: any): void {
    if (!this.container) return;
    console.log(`[BattleSystem] Applying soul infusion for ${caster.character.name}`);

    const enemies: CharacterSprite[] = [];
    const allies: CharacterSprite[] = [];
    for (const sprite of this.sprites.values()) {
      if (sprite.isDead || sprite.isInjured) continue;
      const isEnemy =
        (caster.character.type !== 'Enemy' && sprite.character.type === 'Enemy') ||
        (caster.character.type === 'Enemy' && sprite.character.type !== 'Enemy');
      if (isEnemy) enemies.push(sprite);
      else if (sprite.id !== caster.id) allies.push(sprite);
    }
    if (enemies.length === 0) return;

    const target = enemies[Math.floor(Math.random() * enemies.length)];
    const baseDamage = effect.damage?.base || 5;
    const attackMultiplier = effect.damage?.attackMultiplier || 0.5;
    const totalDamage = Math.floor(baseDamage + caster.character.attack * attackMultiplier);

    let isCrit = false;
    if (caster.character.guaranteedCrit) {
      isCrit = true;
      caster.character.guaranteedCrit = false;
    } else {
      isCrit = Math.random() < (caster.character.critRate / 100);
    }

    let finalDamage = totalDamage;
    const damageReduction = finalDamage * (target.character.defense / 100);
    finalDamage = Math.max(1, Math.floor(finalDamage - damageReduction));
    if (isCrit) finalDamage = Math.floor(finalDamage * (caster.character.critDamage / 100));

    const result = this.applyDamageWithShield(target, finalDamage, caster.character);
    this.showDamageNumber(target, result.damage, target.character.type === 'Enemy', isCrit || result.isCritical);
    this.showSoulExplosion(target.x + 35, target.y + 50);

    if (target.character.currentHP <= 0 && !target.isDead) {
      const killerId = caster.character.type !== 'Enemy' ? caster.id : undefined;
      this.handleDeath(target, killerId);
    }

    const mpRestore = effect.mpRestore || 15;
    if (allies.length > 0) {
      const ally = allies[Math.floor(Math.random() * allies.length)];
      ally.character.currentMP = Math.min(ally.character.maxMP, ally.character.currentMP + mpRestore);
      this.updateBars(ally);
      this.showSoulAbsorbEffect(ally, mpRestore);
      console.log(`[BattleSystem] Soul Infusion: Restored ${mpRestore} MP to ${ally.character.name}`);
      if (ally.character.currentMP >= ally.character.maxMP && ally.character.activeSkill) {
        this.castActiveSkill(ally);
      }
    }
  }

  private showSoulExplosion(x: number, y: number): void {
    if (!this.container) return;
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 60 + Math.random() * 90;
      const size = 6 + Math.random() * 9;
      particle.style.cssText = `
        position: absolute; width: ${size}px; height: ${size}px; border-radius: 50%;
        background: radial-gradient(circle, rgba(100,180,255,1) 0%, rgba(50,120,255,0.8) 50%, rgba(30,80,255,0) 100%);
        box-shadow: 0 0 8px rgba(80,160,255,0.9), 0 0 16px rgba(50,120,255,0.5);
        mix-blend-mode: screen; pointer-events: none; z-index: 1000;
        left: ${x - size / 2}px; top: ${y - size / 2}px;
      `;
      this.container.appendChild(particle);
      const startTime = Date.now();
      const duration = 400 + Math.random() * 200;
      const dx = Math.cos(angle) * speed;
      const dy = Math.sin(angle) * speed;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        if (progress >= 1) { particle.remove(); return; }
        particle.style.left = `${x + dx * progress - size / 2}px`;
        particle.style.top = `${y + dy * progress - size / 2}px`;
        particle.style.opacity = (1 - progress).toString();
        particle.style.transform = `scale(${1 - progress * 0.5})`;
        requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  }

  private showSoulAbsorbEffect(sprite: CharacterSprite, mpAmount: number): void {
    if (!this.container) return;
    const cx = sprite.x + 35;
    const cy = sprite.y + 35;
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      const angle = (i / particleCount) * Math.PI * 2;
      const startDist = 60 + Math.random() * 45;
      const size = 4.5 + Math.random() * 6;
      const startX = cx + Math.cos(angle) * startDist;
      const startY = cy + Math.sin(angle) * startDist;
      particle.style.cssText = `
        position: absolute; width: ${size}px; height: ${size}px; border-radius: 50%;
        background: radial-gradient(circle, rgba(100,180,255,1) 0%, rgba(50,120,255,0) 100%);
        box-shadow: 0 0 6px rgba(80,160,255,0.8), 0 0 12px rgba(50,120,255,0.4);
        mix-blend-mode: screen; pointer-events: none; z-index: 1000;
        left: ${startX - size / 2}px; top: ${startY - size / 2}px;
      `;
      this.container.appendChild(particle);
      const startTime = Date.now();
      const duration = 350 + Math.random() * 150;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        if (progress >= 1) { particle.remove(); return; }
        particle.style.left = `${startX + (cx - startX) * progress - size / 2}px`;
        particle.style.top = `${startY + (cy - startY) * progress - size / 2}px`;
        particle.style.opacity = (0.8 + 0.2 * progress).toString();
        particle.style.transform = `scale(${1 - progress * 0.3})`;
        requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
    // Floating blue MP number
    const mpText = document.createElement('div');
    mpText.textContent = `+${mpAmount}`;
    mpText.style.cssText = `
      position: absolute; left: ${cx}px; top: ${cy - 10}px;
      color: #66bbff; font-size: 16px; font-weight: bold;
      text-shadow: 0 0 6px rgba(80,160,255,0.8);
      pointer-events: none; z-index: 1001; transform: translateX(-50%);
    `;
    this.container.appendChild(mpText);
    const textStart = Date.now();
    const animateText = () => {
      const elapsed = Date.now() - textStart;
      const progress = Math.min(elapsed / 1000, 1);
      if (progress >= 1) { mpText.remove(); return; }
      mpText.style.top = `${cy - 10 - 30 * progress}px`;
      mpText.style.opacity = (1 - progress * 0.8).toString();
      requestAnimationFrame(animateText);
    };
    requestAnimationFrame(animateText);
  }

  /**
   * Apply spawn_trap effect - place a trap at caster's position
   */
  private applySpawnTrapEffect(caster: CharacterSprite, effect: any): void {
    if (!this.container) return;
    
    console.log(`[BattleSystem] Spawning trap for ${caster.character.name}`);
    
    // Calculate trap size with technique scaling
    const baseDiameter = effect.diameter || 50;
    const scalePerSkill = effect.scalePerSkill || 0;
    const technique = caster.character.skill || 0;
    const scaleFactor = 1 + (scalePerSkill * technique);
    const finalDiameter = Math.round(baseDiameter * scaleFactor);
    
    // Create trap element
    const trap = document.createElement('div');
    trap.style.cssText = `
      position: absolute;
      width: ${finalDiameter}px;
      height: ${finalDiameter}px;
      z-index: 4;
      pointer-events: none;
    `;
    
    const trapImg = document.createElement('img');
    trapImg.src = effect.image || 'images/texiao_dabian.png';
    trapImg.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
    `;
    trap.appendChild(trapImg);
    
    // Place at caster's current position (center of caster)
    const trapX = caster.x + 35 - finalDiameter / 2;
    const trapY = caster.y + 50 - finalDiameter / 2;
    trap.style.left = `${trapX}px`;
    trap.style.top = `${trapY}px`;
    
    this.container.appendChild(trap);
    
    // Store trap data for collision detection
    const trapData = {
      element: trap,
      x: caster.x + 35,
      y: caster.y + 50,
      radius: finalDiameter / 2,
      casterId: caster.id,
      casterAttack: caster.character.attack,
      casterHunger: caster.character.currentHunger || 0,
      casterMaxHunger: caster.character.maxHunger || 100,
      effect: effect,
      active: true
    };
    
    // Collision detection loop
    const checkInterval = setInterval(() => {
      if (!trapData.active) {
        clearInterval(checkInterval);
        return;
      }
      
      // Check collision with enemies
      this.sprites.forEach((sprite) => {
        if (!trapData.active) return;
        if (sprite.isDead || sprite.isInjured) return;
        
        // Only affect enemies if caster is adventurer, or adventurers if caster is enemy
        const casterSprite = this.sprites.get(trapData.casterId);
        if (!casterSprite) return;
        const isEnemy = (casterSprite.character.type !== 'Enemy' && sprite.character.type === 'Enemy') ||
                        (casterSprite.character.type === 'Enemy' && sprite.character.type !== 'Enemy');
        if (!isEnemy) return;
        
        // Check distance
        const targetCenterX = sprite.x + 35;
        const targetCenterY = sprite.y + 50;
        const dx = targetCenterX - trapData.x;
        const dy = targetCenterY - trapData.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < trapData.radius + 25) {
          // Hit! Calculate damage: base + attack*multiplier + (100-hunger)*hungerMultiplier
          const baseDmg = effect.damage?.base || 5;
          const atkMult = effect.damage?.attackMultiplier || 0.25;
          const hungerMult = effect.damage?.hungerMultiplier || 0.25;
          const hungerPenalty = (trapData.casterMaxHunger - trapData.casterHunger) * hungerMult;
          const totalDamage = Math.round(baseDmg + (trapData.casterAttack * atkMult) + hungerPenalty);
          
          // Apply damage
          const result = this.applyDamageWithShield(sprite, totalDamage, casterSprite?.character);
          if (result.damage > 0) {
            sprite.character.currentHP -= result.damage;
            this.showDamageNumber(sprite, result.damage, sprite.character.type === 'Enemy', result.isCritical);
            this.updateBars(sprite);
            this.showBloodSplash(sprite.x + 35, sprite.y + 35);
            
            // Check if enemy died
            if (sprite.character.currentHP <= 0 && !sprite.isDead) {
              sprite.character.currentHP = 0;
              const killerId = casterSprite?.character.type !== 'Enemy' ? casterSprite?.id : undefined;
              this.handleDeath(sprite, killerId);
            }
          }
          
          // Apply slip buff
          if (effect.applyBuff && this.buffSystem) {
            const buffDuration = (effect.buffDuration || 6000) / 1000;
            this.buffSystem.applyBuff(sprite.id, effect.applyBuff, buffDuration);
            
            // Directly modify enemy moveSpeed since GameUI's onBuffApplied only works for recruited characters
            const buffDef = this.buffSystem.getBuffDefinition(effect.applyBuff);
            if (buffDef && buffDef.effects) {
              for (const eff of buffDef.effects) {
                if (eff.attribute === 'moveSpeed' && eff.type === 'flat') {
                  sprite.character.moveSpeed += eff.value;
                  console.log(`[BattleSystem] Directly applied moveSpeed +${eff.value} to enemy ${sprite.character.name}, new moveSpeed: ${sprite.character.moveSpeed}`);
                }
              }
            }
            
            // Force immediate direction change for slip effect
            sprite.nextDirectionChangeTime = Date.now();
          }
          
          // Destroy trap
          trapData.active = false;
          clearInterval(checkInterval);
          if (trap.parentNode) {
            trap.parentNode.removeChild(trap);
          }
          console.log(`[BattleSystem] Trap hit ${sprite.character.name} for ${totalDamage} damage`);
        }
      });
    }, 100);
    
    // Remove trap after lifetime
    const lifetime = effect.lifetime || 15000;
    setTimeout(() => {
      if (trapData.active) {
        trapData.active = false;
        clearInterval(checkInterval);
        if (trap.parentNode) {
          trap.parentNode.removeChild(trap);
        }
        console.log(`[BattleSystem] Trap expired`);
      }
    }, lifetime);
  }

  /**
   * Apply spawn_spike_trap effect - place a persistent spike trap at a random position
   */
  private applySpawnSpikeTrapEffect(caster: CharacterSprite, effect: any): void {
    if (!this.container) return;
    console.log(`[BattleSystem] Spawning spike trap for ${caster.character.name}`);

    // Calculate diameter with technique scaling
    const baseDiameter = effect.diameter || 300;
    const scalePerSkill = effect.scalePerSkill || 0.04;
    const technique = caster.character.skill || 0;
    const finalDiameter = Math.round(baseDiameter * (1 + scalePerSkill * technique));
    const radius = finalDiameter / 2;

    // Calculate damage
    const baseDamage = effect.damage?.base || 5;
    const attackMultiplier = effect.damage?.attackMultiplier || 0.2;
    const totalDamage = Math.floor(baseDamage + caster.character.attack * attackMultiplier);

    const lifetime = effect.lifetime || 6000;
    const hitInterval = effect.hitInterval || 750;

    // Random position within the battle scene
    const sceneWidth = this.container.clientWidth || 800;
    const sceneHeight = this.container.clientHeight || 600;
    const centerX = radius + Math.random() * (sceneWidth - finalDiameter);
    const centerY = radius + Math.random() * (sceneHeight - finalDiameter);

    // Create visual circle
    const circle = document.createElement('div');
    circle.style.cssText = `
      position: absolute;
      width: ${finalDiameter}px;
      height: ${finalDiameter}px;
      border-radius: 50%;
      background: ${effect.color || 'rgba(139, 90, 43, 0.3)'};
      mix-blend-mode: ${effect.blendMode || 'multiply'};
      pointer-events: none;
      z-index: 4;
      left: ${centerX - radius}px;
      top: ${centerY - radius}px;
    `;
    this.container.appendChild(circle);

    // Track last hit time per enemy
    const lastHitTime = new Map<string, number>();
    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      if (!this.container || !circle.parentNode) {
        clearInterval(checkInterval);
        return;
      }

      const now = Date.now();
      if (now - startTime >= lifetime) {
        clearInterval(checkInterval);
        circle.remove();
        return;
      }

      for (const sprite of this.sprites.values()) {
        if (sprite.isDead || sprite.isInjured) continue;

        const isEnemy =
          (caster.character.type !== 'Enemy' && sprite.character.type === 'Enemy') ||
          (caster.character.type === 'Enemy' && sprite.character.type !== 'Enemy');
        if (!isEnemy) continue;

        // Check collision
        const spriteCenterX = sprite.x + 35;
        const spriteCenterY = sprite.y + 50;
        const dx = spriteCenterX - centerX;
        const dy = spriteCenterY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const spriteRadius = 35 * sprite.size;

        if (distance <= radius + spriteRadius) {
          const lastHit = lastHitTime.get(sprite.id) || 0;
          if (now - lastHit >= hitInterval) {
            lastHitTime.set(sprite.id, now);

            const result = this.applyDamageWithShield(sprite, totalDamage, caster.character);
            if (result.damage > 0) {
              this.showDamageNumber(sprite, result.damage, sprite.character.type === 'Enemy', result.isCritical);
              this.showBloodSplash(sprite.x + 35, sprite.y + 35);

              if (sprite.character.currentHP <= 0 && !sprite.isDead) {
                const killerId = caster.character.type !== 'Enemy' ? caster.id : undefined;
                this.handleDeath(sprite, killerId);
              }
            }
          }
        }
      }
    }, 100);
  }

  /**
   * Apply soul_infusion effect - damage a random enemy, then restore MP to a random ally
   */
  private applySoulInfusionEffect(caster: CharacterSprite, effect: any): void {
    if (!this.container) return;
    console.log(`[BattleSystem] Applying soul infusion for ${caster.character.name}`);

    // Find random enemy and allies
    const enemies: CharacterSprite[] = [];
    const allies: CharacterSprite[] = [];
    for (const sprite of this.sprites.values()) {
      if (sprite.isDead || sprite.isInjured) continue;
      const isEnemy =
        (caster.character.type !== 'Enemy' && sprite.character.type === 'Enemy') ||
        (caster.character.type === 'Enemy' && sprite.character.type !== 'Enemy');
      if (isEnemy) {
        enemies.push(sprite);
      } else if (sprite.id !== caster.id) {
        allies.push(sprite);
      }
    }

    if (enemies.length === 0) return;

    // Damage random enemy
    const target = enemies[Math.floor(Math.random() * enemies.length)];
    const baseDamage = effect.damage?.base || 5;
    const attackMultiplier = effect.damage?.attackMultiplier || 0.5;
    const totalDamage = Math.floor(baseDamage + caster.character.attack * attackMultiplier);

    let isCrit = false;
    if (caster.character.guaranteedCrit) {
      isCrit = true;
      caster.character.guaranteedCrit = false;
    } else {
      isCrit = Math.random() < (caster.character.critRate / 100);
    }

    let finalDamage = totalDamage;
    const damageReduction = finalDamage * (target.character.defense / 100);
    finalDamage = Math.max(1, Math.floor(finalDamage - damageReduction));
    if (isCrit) {
      finalDamage = Math.floor(finalDamage * (caster.character.critDamage / 100));
    }

    const result = this.applyDamageWithShield(target, finalDamage, caster.character);
    this.showDamageNumber(target, result.damage, target.character.type === 'Enemy', isCrit || result.isCritical);

    // Blue explosion particle effect at target with screen blend mode and glow
    this.showSoulExplosion(target.x + 35, target.y + 50);

    if (target.character.currentHP <= 0 && !target.isDead) {
      const killerId = caster.character.type !== 'Enemy' ? caster.id : undefined;
      this.handleDeath(target, killerId);
    }

    // Restore MP to a random ally (not self)
    const mpRestore = effect.mpRestore || 15;
    if (allies.length > 0) {
      const ally = allies[Math.floor(Math.random() * allies.length)];
      ally.character.currentMP = Math.min(ally.character.maxMP, ally.character.currentMP + mpRestore);
      this.updateBars(ally);

      // Show absorb particle effect at ally with floating MP number
      this.showSoulAbsorbEffect(ally, mpRestore);

      console.log(`[BattleSystem] Soul Infusion: Restored ${mpRestore} MP to ${ally.character.name}`);

      // Check if ally MP is now full and they have an active skill
      if (ally.character.currentMP >= ally.character.maxMP && ally.character.activeSkill) {
        this.castActiveSkill(ally);
      }
    }
  }

  /**
   * Apply damage to a character, accounting for shields and exposed_weakness BUFF
   * @param sprite Target character sprite
   * @param damage Base damage amount
   * @param attacker Optional attacker character (for crit calculation). Pass undefined to skip exposed_weakness check.
   * @returns Object with final damage and whether it was a critical hit
   */
  private applyDamageWithShield(sprite: CharacterSprite, damage: number, attacker?: NPCData): { damage: number; isCritical: boolean } {
    if (damage <= 0) return { damage: 0, isCritical: false };

    // Check for divine_proclamation master skill (damage nullification)
    if (this.checkDivineProclamation(sprite, damage)) {
      // Damage was nullified
      return { damage: 0, isCritical: false };
    }

    let finalDamage = damage;
    let isCritical = false;

    // Apply damage_modifier passive skill (challenger: +20% vs boss) for ALL damage sources
    if (attacker) {
      const targetType = this.bossId && sprite.id === this.bossId ? 'boss' : 'normal';
      const damageModifier = this.getDamageModifier(attacker, targetType);
      if (damageModifier > 0) {
        const beforeModifier = finalDamage;
        finalDamage = Math.floor(finalDamage * (1 + damageModifier));
        console.log(`[BattleSystem] ${attacker.name} damage_modifier (applyDamageWithShield): ${beforeModifier} → ${finalDamage} (+${damageModifier * 100}% vs ${targetType})`);
      }
    }

    // Check for exposed_weakness BUFF - force critical hit (only if attacker is provided)
    if (attacker && this.buffSystem && this.buffSystem.hasBuff(sprite.character.id, 'exposed_weakness')) {
      isCritical = true;
      // Apply crit multiplier using attacker's crit damage
      const critMultiplier = attacker.critDamage / 100;
      finalDamage = Math.floor(damage * critMultiplier);
      console.log(`[BattleSystem] ${sprite.character.name} has exposed_weakness BUFF - forced critical hit! Damage: ${damage} -> ${finalDamage}`);
      // Remove the BUFF after it triggers (one-time effect)
      this.buffSystem.removeBuff(sprite.character.id, 'exposed_weakness');
    }

    const currentShield = sprite.character.currentShield || 0;
    
    if (currentShield > 0) {
      // Shield absorbs damage
      if (currentShield >= finalDamage) {
        // Shield absorbs all damage
        sprite.character.currentShield = currentShield - finalDamage;
      } else {
        // Shield absorbs partial damage, rest goes to HP
        const remainingDamage = finalDamage - currentShield;
        sprite.character.currentShield = 0;
        sprite.character.currentHP = Math.max(0, sprite.character.currentHP - remainingDamage);
      }
      
      // Remove shield visual if shield is depleted
      if ((sprite.character.currentShield || 0) <= 0) {
        this.removeShieldVisualEffect(sprite);
      }
    } else {
      // No shield, damage goes directly to HP
      sprite.character.currentHP = Math.max(0, sprite.character.currentHP - finalDamage);
    }

    return { damage: finalDamage, isCritical };
  }

  /**
   * Apply spawn_projectile effect (e.g., piercing_arrow, fireball)
   */
  private applySpawnProjectileEffect(caster: CharacterSprite, effect: any, forcedTargetId?: string): void {
    console.log(`[BattleSystem] Applying spawn_projectile effect for ${caster.character.name}`);
    
    if (!this.container) return;

    // Calculate damage
    const baseDamage = effect.damage?.base || 0;
    const attackMultiplier = effect.damage?.attackMultiplier || 0;
    const wisdomMultiplier = effect.damage?.wisdomMultiplier || 0;
    let totalDamage = baseDamage + 
      (caster.character.attack * attackMultiplier) +
      (caster.character.wisdom * wisdomMultiplier);
    
    // Apply magic power bonus
    const magicPower = caster.character.magicPower || 0;
    if (magicPower > 0) {
      totalDamage = totalDamage * (1 + magicPower / 100);
    }
    totalDamage = Math.floor(totalDamage);
    
    // Calculate speed
    const baseSpeed = effect.speed?.base || 50;
    const agilityMultiplier = effect.speed?.agilityMultiplier || 0;
    const skillMultiplier = effect.speed?.skillMultiplier || 0;
    const totalSpeed = baseSpeed + 
      (caster.character.agility * agilityMultiplier) +
      (caster.character.skill * skillMultiplier);
    
    // Calculate max distance (for piercing arrows)
    const baseDistance = effect.maxDistance?.base || 500;
    const distanceSkillMultiplier = effect.maxDistance?.skillMultiplier || 0;
    const distanceSkillPercentageMultiplier = effect.maxDistance?.skillPercentageMultiplier || 0;
    let maxDistance = baseDistance + (caster.character.skill * distanceSkillMultiplier);
    // Apply percentage-based skill scaling: each point of technique adds X% to base distance
    if (distanceSkillPercentageMultiplier > 0) {
      maxDistance = baseDistance * (1 + caster.character.skill * distanceSkillPercentageMultiplier / 100);
    }
    
    // Determine target for tracking projectiles
    let target: CharacterSprite | null = null;
    if (effect.tracking) {
      // If forcedTargetId is provided, use that target
      if (forcedTargetId) {
        target = this.sprites.get(forcedTargetId) || null;
        if (target && (target.isDead || target.isInjured)) {
          target = null; // Target is dead/injured, find another
        }
      }
      
      // If no forced target or forced target is invalid, find nearest enemy
      if (!target) {
        const enemies = Array.from(this.sprites.values()).filter(s => 
          !s.isDead && !s.isInjured &&
          ((caster.character.type === 'Enemy' && s.character.type !== 'Enemy') ||
           (caster.character.type !== 'Enemy' && s.character.type === 'Enemy'))
        );
        
        if (enemies.length > 0) {
          // Find closest enemy
          let minDist = Infinity;
          for (const enemy of enemies) {
            const dx = enemy.x - caster.x;
            const dy = enemy.y - caster.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
              minDist = dist;
              target = enemy;
            }
          }
        }
      }
    }
    
    // Determine direction
    let dirX = 0;
    let dirY = 0;
    
    if (effect.tracking && target) {
      // Track target - aim at avatar sprite center
      const targetAW = target.element?.querySelector('.battle-avatar-wrapper') as HTMLElement;
      const targetCS = target.element?.querySelector('.battle-character-sprite') as HTMLElement;
      let tx: number, ty: number;
      if (targetAW && targetCS) {
        tx = target.x + targetAW.offsetLeft + targetCS.offsetLeft + targetCS.offsetWidth / 2;
        ty = target.y + targetAW.offsetTop + targetCS.offsetTop + targetCS.offsetHeight / 2;
      } else {
        tx = target.x + (target.element?.offsetWidth || 80) / 2;
        ty = target.y + (target.element?.offsetHeight || 80) / 2;
      }
      // Aim from projectile center, not top-left
      const dx = tx - (caster.x + (caster.element?.offsetWidth || 0) / 2);
      const dy = ty - (caster.y + (caster.element?.offsetHeight || 0) / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        dirX = dx / dist;
        dirY = dy / dist;
      }
    } else if (effect.targetRandom) {
      // Shoot toward a random enemy in a straight line (no tracking)
      const enemies = Array.from(this.sprites.values()).filter(s => 
        !s.isDead && !s.isInjured &&
        ((caster.character.type === 'Enemy' && s.character.type !== 'Enemy') ||
         (caster.character.type !== 'Enemy' && s.character.type === 'Enemy'))
      );
      
      if (enemies.length > 0) {
        const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
        const dx = randomEnemy.x - caster.x;
        const dy = randomEnemy.y - caster.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          dirX = dx / dist;
          dirY = dy / dist;
        }
        console.log(`[BattleSystem] Projectile targeting random enemy: ${randomEnemy.character.name}`);
      } else {
        const angle = Math.random() * Math.PI * 2;
        dirX = Math.cos(angle);
        dirY = Math.sin(angle);
      }
    } else if (effect.piercing) {
      // For piercing projectiles, shoot toward farthest enemy
      const enemies = Array.from(this.sprites.values()).filter(s => 
        !s.isDead && !s.isInjured &&
        ((caster.character.type === 'Enemy' && s.character.type !== 'Enemy') ||
         (caster.character.type !== 'Enemy' && s.character.type === 'Enemy'))
      );
      
      if (enemies.length > 0) {
        // Find farthest enemy
        let maxDist = 0;
        let farthestEnemy: CharacterSprite | null = null;
        
        for (const enemy of enemies) {
          const dx = enemy.x - caster.x;
          const dy = enemy.y - caster.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > maxDist) {
            maxDist = dist;
            farthestEnemy = enemy;
          }
        }
        
        if (farthestEnemy) {
          // Shoot toward farthest enemy
          const dx = farthestEnemy.x - caster.x;
          const dy = farthestEnemy.y - caster.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            dirX = dx / dist;
            dirY = dy / dist;
          }
          console.log(`[BattleSystem] Piercing arrow shooting toward farthest enemy at distance ${maxDist.toFixed(0)}px`);
        }
      } else {
        // No enemies, shoot in random direction
        const angle = Math.random() * Math.PI * 2;
        dirX = Math.cos(angle);
        dirY = Math.sin(angle);
        console.log(`[BattleSystem] No enemies found, piercing arrow shooting in random direction`);
      }
    } else if (effect.randomDirection) {
      // Random direction (not aimed at any target)
      const angle = Math.random() * Math.PI * 2;
      dirX = Math.cos(angle);
      dirY = Math.sin(angle);
    } else {
      // Random direction
      const angle = Math.random() * Math.PI * 2;
      dirX = Math.cos(angle);
      dirY = Math.sin(angle);
    }
    
    // Burst projectile support: fire projectiles at intervals in caster's facing direction
    if (effect.projectileType === 'burst') {
      const burstCount = effect.burstCount || 5;
      const burstInterval = effect.burstInterval || 300;
      const angleSpreadMin = effect.angleSpread?.min || 0;
      const angleSpreadMax = effect.angleSpread?.max || 0;
      // Calculate size scaling from technique
      const sizePerSkill = effect.sizePerSkill || 0;
      const sizeScale = 1 + (caster.character.skill * sizePerSkill);
      const scaledEffect = sizePerSkill > 0 ? { ...effect, size: Math.floor((effect.size || 30) * sizeScale) } : effect;
      
      let fired = 0;
      const burstTimer = setInterval(() => {
        if (fired >= burstCount || !this.container) {
          clearInterval(burstTimer);
          return;
        }
        // Use caster's current velocity as facing direction
        const sprite = this.sprites.get(caster.id);
        if (!sprite) { clearInterval(burstTimer); return; }
        
        let baseAngle: number;
        const velMag = Math.sqrt(sprite.velocityX * sprite.velocityX + sprite.velocityY * sprite.velocityY);
        if (velMag > 0) {
          baseAngle = Math.atan2(sprite.velocityY, sprite.velocityX);
        } else {
          baseAngle = Math.random() * Math.PI * 2;
        }
        
        // Add random angle spread
        const spreadDeg = angleSpreadMin + Math.random() * (angleSpreadMax - angleSpreadMin);
        const spreadRad = (spreadDeg * Math.PI) / 180 * (Math.random() < 0.5 ? 1 : -1);
        const finalAngle = baseAngle + spreadRad;
        
        const dX = Math.cos(finalAngle);
        const dY = Math.sin(finalAngle);
        this.createProjectile(caster, scaledEffect, totalDamage, totalSpeed, maxDistance, dX, dY, null);
        fired++;
      }, burstInterval);
      return;
    }
    
    // Multi-projectile support: fire multiple projectiles in random directions
    if (effect.multiProjectile) {
      const baseCount = effect.baseCount || 3;
      const countPerSkill = effect.countPerSkill || 5;
      const bonusCount = countPerSkill > 0 ? Math.floor(caster.character.skill / countPerSkill) : 0;
      const totalCount = baseCount + bonusCount;
      
      console.log(`[BattleSystem] Multi-projectile: base=${baseCount}, technique=${caster.character.skill}, bonus=${bonusCount}, total=${totalCount}`);
      
      for (let i = 0; i < totalCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dX = Math.cos(angle);
        const dY = Math.sin(angle);
        this.createProjectile(caster, effect, totalDamage, totalSpeed, maxDistance, dX, dY, null);
      }
      return;
    }
    
    // Check if directions array is specified (e.g., ["left", "right"])
    if (effect.directions && Array.isArray(effect.directions) && effect.directions.length > 0) {
      // Spawn one projectile per direction
      for (const dir of effect.directions) {
        let dX = 0;
        let dY = 0;
        if (dir === 'left') {
          dX = -1; dY = 0;
        } else if (dir === 'right') {
          dX = 1; dY = 0;
        } else if (dir === 'up') {
          dX = 0; dY = -1;
        } else if (dir === 'down') {
          dX = 0; dY = 1;
        }
        this.createProjectile(caster, effect, totalDamage, totalSpeed, maxDistance, dX, dY, null);
      }
      return; // Already created all projectiles
    }
    
    // Create projectile
    this.createProjectile(caster, effect, totalDamage, totalSpeed, maxDistance, dirX, dirY, target);
  }

  /**
   * Create a projectile
   */
  private createProjectile(
    caster: CharacterSprite,
    effect: any,
    damage: number,
    speed: number,
    maxDistance: number,
    dirX: number,
    dirY: number,
    target: CharacterSprite | null
  ): void {
    if (!this.container) return;

    const projectile = document.createElement('div');
    
    // Use image if available, otherwise use emoji
    if (effect.image) {
      const img = document.createElement('img');
      img.src = effect.image;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: contain;
      `;
      projectile.appendChild(img);
    } else {
      projectile.textContent = effect.emoji || '⚫';
    }
    
    const size = effect.size || 20;
    
    // Calculate initial rotation angle based on direction
    const initialAngle = Math.atan2(dirY, dirX) * (180 / Math.PI);
    
    // Add glow effect - support different colors
    let glowFilter = '';
    if (effect.hasGlow) {
      if (effect.glowColor === 'yellow') {
        glowFilter = 'drop-shadow(0 0 8px rgba(255, 220, 50, 0.8)) drop-shadow(0 0 15px rgba(255, 200, 0, 0.6))';
      } else {
        glowFilter = 'drop-shadow(0 0 8px rgba(255, 140, 0, 0.8)) drop-shadow(0 0 15px rgba(255, 100, 0, 0.6))';
      }
    }
    
    projectile.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      pointer-events: none;
      z-index: 998;
      transition: none;
      transform: rotate(${initialAngle}deg);
      filter: ${glowFilter};
    `;

    // Start at caster position
    let x = caster.x + (caster.element?.offsetWidth || 0) / 2 - size / 2;
    let y = caster.y + (caster.element?.offsetHeight || 0) / 2 - size / 2;
    
    projectile.style.left = `${x}px`;
    projectile.style.top = `${y}px`;
    
    this.container.appendChild(projectile);

    const startTime = Date.now();
    const hitTargets = new Set<string>();
    const hitCooldowns = new Map<string, number>(); // For bounceOnHit: spriteId -> timestamp of last hit
    const grappleHitCooldowns = new Map<string, number>(); // For grapple drag: spriteId -> timestamp of last hit (1s cooldown)
    let traveledDistance = 0;
    let isRemoved = false;
    let lastTrailTime = 0; // 上次生成拖尾的时间
    let bounceImmunityUntil = 0; // After a bounce, skip all collision checks until this timestamp
    
    // Pulsing glow effect for fireball
    if (effect.hasGlow) {
      const pulseGlow = () => {
        if (isRemoved) return;
        
        const elapsed = Date.now() - startTime;
        const pulseSpeed = 3; // Pulse cycles per second
        const pulsePhase = (elapsed / 1000) * pulseSpeed * Math.PI * 2;
        const glowIntensity = 0.4 + Math.sin(pulsePhase) * 0.6; // 0.4 to 1.0 (更明显的闪烁)
        
        if (effect.glowColor === 'yellow') {
          projectile.style.filter = `drop-shadow(0 0 ${8 * glowIntensity}px rgba(255, 220, 50, ${0.8 * glowIntensity})) drop-shadow(0 0 ${15 * glowIntensity}px rgba(255, 200, 0, ${0.6 * glowIntensity}))`;
        } else {
          projectile.style.filter = `drop-shadow(0 0 ${8 * glowIntensity}px rgba(255, 140, 0, ${0.8 * glowIntensity})) drop-shadow(0 0 ${15 * glowIntensity}px rgba(255, 100, 0, ${0.6 * glowIntensity}))`;
        }
        
        requestAnimationFrame(pulseGlow);
      };
      requestAnimationFrame(pulseGlow);
    }
    
    // Breathing scale effect for fireball (visual only, doesn't affect collision)
    if (effect.hasTrail) {
      const breatheScale = () => {
        if (isRemoved) return;
        
        const elapsed = Date.now() - startTime;
        const breathSpeed = 2; // Breath cycles per second
        const breathPhase = (elapsed / 1000) * breathSpeed * Math.PI * 2;
        const scale = 0.9 + Math.sin(breathPhase) * 0.1; // 0.8 to 1.0 (呼吸效果)
        
        // Get current rotation angle from transform
        const currentTransform = projectile.style.transform;
        const rotateMatch = currentTransform.match(/rotate\(([^)]+)\)/);
        const currentRotation = rotateMatch ? rotateMatch[1] : '0deg';
        
        // Apply scale without affecting rotation
        projectile.style.transform = `rotate(${currentRotation}) scale(${scale})`;
        
        requestAnimationFrame(breatheScale);
      };
      requestAnimationFrame(breatheScale);
    }

    // Grapple tether line (brown line between caster and projectile)
    let tetherLine: HTMLElement | null = null;
    let isDragging = false;
    let grappleTargetX = 0;
    let grappleTargetY = 0;
    let grappleAfterimageFrame = 0;
    const originalCanBeKnockedBack = caster.canMove; // Save original state
    
    if (effect.grapple && this.container) {
      tetherLine = document.createElement('div');
      tetherLine.style.cssText = `
        position: absolute;
        height: 3px;
        background: ${effect.grappleTetherColor || 'rgba(139, 90, 43, 0.8)'};
        pointer-events: none;
        z-index: 996;
        transform-origin: 0 50%;
      `;
      this.container.appendChild(tetherLine);
    }
    
    const updateTether = () => {
      if (!tetherLine || !caster.element) return;
      const cx = caster.x + (caster.element.offsetWidth || 0) / 2;
      const cy = caster.y + (caster.element.offsetHeight || 0) / 2;
      const px = x + size / 2;
      const py = y + size / 2;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      tetherLine.style.left = `${cx}px`;
      tetherLine.style.top = `${cy}px`;
      tetherLine.style.width = `${dist}px`;
      tetherLine.style.transform = `rotate(${angle}deg)`;
    };

    const removeProjectile = () => {
      if (isRemoved) return;
      isRemoved = true;
      projectile.remove();
      if (tetherLine) {
        tetherLine.remove();
        tetherLine = null;
      }
    };
    
    // Create trail effect for piercing projectiles or fireball
    const createTrail = (trailX: number, trailY: number) => {
      if (!this.container) return;
      
      // Different trail colors for different projectile types
      const isPiercing = effect.piercing;
      const isFireball = effect.hasTrail;
      
      if (!isPiercing && !isFireball) return;
      
      const trail = document.createElement('div');
      const trailStartTime = Date.now();
      
      if (isFireball) {
        // Trail effect - support different colors
        const isYellowTrail = effect.trailColor === 'yellow';
        const isGreenTrail = effect.trailColor === 'green';
        const isDarkRedTrail = effect.trailColor === 'darkred';
        const isRedTrail = effect.trailColor === 'red';
        const isBlueTrail = effect.trailColor === 'blue';
        const isPurpleTrail = effect.trailColor === 'purple';
        const isLightBlueTrail = effect.trailColor === 'lightblue';
        const trailScaleFactor = effect.trailScale || 1.0;
        const trailLifetimeFactor = effect.trailLifetime || 1.0;
        const initialSize = size * 0.7 * trailScaleFactor;
        const trailDuration = 1000 * trailLifetimeFactor;
        
        const trailR1 = isLightBlueTrail ? 100 : isPurpleTrail ? 180 : isBlueTrail ? 50 : isRedTrail ? 255 : isDarkRedTrail ? 180 : isGreenTrail ? 80 : isYellowTrail ? 255 : 255;
        const trailG1 = isLightBlueTrail ? 200 : isPurpleTrail ? 50 : isBlueTrail ? 100 : isRedTrail ? 50 : isDarkRedTrail ? 30 : isGreenTrail ? 255 : isYellowTrail ? 230 : 180;
        const trailB1 = isLightBlueTrail ? 255 : isPurpleTrail ? 255 : isBlueTrail ? 255 : isRedTrail ? 50 : isDarkRedTrail ? 30 : isGreenTrail ? 80 : isYellowTrail ? 80 : 50;
        const trailR2 = isLightBlueTrail ? 70 : isPurpleTrail ? 140 : isBlueTrail ? 30 : isRedTrail ? 220 : isDarkRedTrail ? 139 : isGreenTrail ? 0 : isYellowTrail ? 255 : 255;
        const trailG2 = isLightBlueTrail ? 160 : isPurpleTrail ? 30 : isBlueTrail ? 80 : isRedTrail ? 20 : isDarkRedTrail ? 0 : isGreenTrail ? 200 : isYellowTrail ? 200 : 100;
        const trailB2 = isLightBlueTrail ? 220 : isPurpleTrail ? 220 : isBlueTrail ? 220 : isRedTrail ? 20 : isDarkRedTrail ? 0 : isGreenTrail ? 0 : isYellowTrail ? 0 : 0;
        const trailR3 = isLightBlueTrail ? 80 : isPurpleTrail ? 160 : isBlueTrail ? 40 : isRedTrail ? 240 : isDarkRedTrail ? 160 : isGreenTrail ? 30 : isYellowTrail ? 255 : 255;
        const trailG3 = isLightBlueTrail ? 180 : isPurpleTrail ? 40 : isBlueTrail ? 90 : isRedTrail ? 30 : isDarkRedTrail ? 10 : isGreenTrail ? 210 : isYellowTrail ? 210 : 140;
        const trailB3 = isLightBlueTrail ? 240 : isPurpleTrail ? 240 : isBlueTrail ? 240 : isRedTrail ? 30 : isDarkRedTrail ? 10 : isGreenTrail ? 30 : isYellowTrail ? 30 : 0;
        
        const baseOpacity = effect.trailOpacity || 0.9;
        
        trail.style.cssText = `
          position: absolute;
          width: ${initialSize}px;
          height: ${initialSize}px;
          left: ${trailX + (size - initialSize) / 2}px;
          top: ${trailY + (size - initialSize) / 2}px;
          background: radial-gradient(circle, rgba(${trailR1}, ${trailG1}, ${trailB1}, ${baseOpacity}) 0%, rgba(${trailR2}, ${trailG2}, ${trailB2}, ${baseOpacity * 0.55}) 50%, rgba(${trailR3}, ${trailG3}, ${trailB3}, 0) 100%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 997;
          opacity: ${baseOpacity};
          ${effect.trailBlendMode ? `mix-blend-mode: ${effect.trailBlendMode};` : ''}
        `;
        
        this.container.appendChild(trail);
        
        // Animate trail: shrink, fade, and change color
        // Support trailFadeColor for custom fade target (e.g., yellow -> darkred)
        const hasFadeColor = effect.trailFadeColor === 'darkred';
        const fadeR = hasFadeColor ? 139 : isLightBlueTrail ? 40 : isPurpleTrail ? 80 : isBlueTrail ? 20 : isRedTrail ? 139 : isDarkRedTrail ? 100 : isGreenTrail ? 20 : isYellowTrail ? 120 : 80;
        const fadeG = hasFadeColor ? 0 : isLightBlueTrail ? 100 : isPurpleTrail ? 10 : isBlueTrail ? 40 : isRedTrail ? 0 : isDarkRedTrail ? 0 : isGreenTrail ? 100 : isYellowTrail ? 100 : 50;
        const fadeB = hasFadeColor ? 0 : isLightBlueTrail ? 180 : isPurpleTrail ? 140 : isBlueTrail ? 120 : isRedTrail ? 0 : isDarkRedTrail ? 0 : isGreenTrail ? 20 : isYellowTrail ? 20 : 20;
        const animateFireballTrail = () => {
          const elapsed = Date.now() - trailStartTime;
          const progress = Math.min(elapsed / trailDuration, 1); // 0 to 1 over trailDuration
          
          if (progress >= 1) {
            trail.remove();
            return;
          }
          
          // Shrink from 100% to 0%
          const scale = 1 - progress;
          
          // Fade from baseOpacity to 0
          const opacity = baseOpacity * (1 - progress);
          
          // Color transition: start color -> fade color
          const r = Math.floor(trailR1 - (trailR1 - fadeR) * progress);
          const g = Math.floor(trailG1 - (trailG1 - fadeG) * progress);
          const b = Math.floor(trailB1 - (trailB1 - fadeB) * progress);
          
          trail.style.width = `${initialSize * scale}px`;
          trail.style.height = `${initialSize * scale}px`;
          trail.style.left = `${trailX + (size - initialSize * scale) / 2}px`;
          trail.style.top = `${trailY + (size - initialSize * scale) / 2}px`;
          trail.style.background = `radial-gradient(circle, rgba(${r}, ${g}, ${b}, ${opacity}) 0%, rgba(${r * 0.8}, ${g * 0.8}, ${b * 0.8}, ${opacity * 0.5}) 50%, rgba(${r}, ${g}, ${b}, 0) 100%)`;
          trail.style.opacity = opacity.toString();
          
          requestAnimationFrame(animateFireballTrail);
        };
        requestAnimationFrame(animateFireballTrail);
      } else {
        // White trail for piercing arrow
        trail.style.cssText = `
          position: absolute;
          width: ${size * 0.6}px;
          height: ${size * 0.6}px;
          left: ${trailX + size * 0.2}px;
          top: ${trailY + size * 0.2}px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 70%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 997;
          opacity: 0.8;
        `;
        
        this.container.appendChild(trail);
        
        // Fade out and remove trail
        let trailOpacity = 0.8;
        const fadeTrail = () => {
          trailOpacity -= 0.05;
          if (trailOpacity <= 0) {
            trail.remove();
          } else {
            trail.style.opacity = trailOpacity.toString();
            requestAnimationFrame(fadeTrail);
          }
        };
        requestAnimationFrame(fadeTrail);
      }
    };
    
    // Create blood splash effect when hitting enemy
    const createBloodSplash = (sprite: CharacterSprite, color?: string) => {
      if (!this.container) return;
      
      // Calculate center of sprite
      const centerX = sprite.x + (sprite.element?.offsetWidth || 80) / 2;
      const centerY = sprite.y + (sprite.element?.offsetHeight || 80) / 2;
      
      // Determine particle color
      const isDarkRed = color === 'darkred';
      const isBlue = color === 'blue';
      const isPurple = color === 'purple';
      const colorInner = isPurple ? 'rgba(180, 50, 255, 1)' : isBlue ? 'rgba(50, 100, 255, 1)' : isDarkRed ? 'rgba(139, 0, 0, 1)' : 'rgba(220, 20, 20, 1)';
      const colorOuter = isPurple ? 'rgba(140, 30, 220, 0.8)' : isBlue ? 'rgba(30, 80, 220, 0.8)' : isDarkRed ? 'rgba(100, 0, 0, 0.8)' : 'rgba(180, 0, 0, 0.8)';
      const blendMode = (isPurple || isBlue) ? 'mix-blend-mode: screen;' : '';
      
      // Large particles for special effects
      const isLarge = effect.particleLarge === true;
      
      // Create 8-12 blood particles (more for large)
      const particleCount = isLarge ? (12 + Math.floor(Math.random() * 6)) : (8 + Math.floor(Math.random() * 5));
      
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        const particleSize = isLarge ? (8 + Math.random() * 14) : (4 + Math.random() * 6); // 4-10px or 8-22px
        
        particle.style.cssText = `
          position: absolute;
          width: ${particleSize}px;
          height: ${particleSize}px;
          left: ${centerX - particleSize / 2}px;
          top: ${centerY - particleSize / 2}px;
          background: radial-gradient(circle, ${colorInner} 0%, ${colorOuter} 100%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 999;
          opacity: 1;
          ${blendMode}
        `;
        
        this.container.appendChild(particle);
        
        // Random direction and speed for each particle
        const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
        const pSpeed = isLarge ? (80 + Math.random() * 150) : (50 + Math.random() * 100);
        const velocityX = Math.cos(angle) * pSpeed;
        const velocityY = Math.sin(angle) * pSpeed;
        
        let particleX = centerX - particleSize / 2;
        let particleY = centerY - particleSize / 2;
        let particleOpacity = 1;
        let particleVelX = velocityX;
        let particleVelY = velocityY;
        const gravity = 200; // Gravity effect
        
        const animateParticle = () => {
          // Apply velocity
          particleX += particleVelX * 0.016;
          particleY += particleVelY * 0.016;
          
          // Apply gravity
          particleVelY += gravity * 0.016;
          
          // Fade out
          particleOpacity -= 0.02;
          
          if (particleOpacity <= 0) {
            particle.remove();
          } else {
            particle.style.left = `${particleX}px`;
            particle.style.top = `${particleY}px`;
            particle.style.opacity = particleOpacity.toString();
            requestAnimationFrame(animateParticle);
          }
        };
        
        requestAnimationFrame(animateParticle);
      }
    };

    const animateProjectile = () => {
      if (isRemoved) return;
      
      const elapsed = Date.now() - startTime;
      const deltaTime = 0.016; // ~60fps
      
      // Check lifetime (for fireball)
      const effectiveLifetime = (effect.lifetime || 0) + ((effect.lifetimePerSkill || 0) * (caster.character.skill || 0));
      if (effectiveLifetime > 0 && elapsed >= effectiveLifetime) {
        removeProjectile();
        return;
      }
      
      // Update direction if tracking
      if (effect.tracking && target && !target.isDead && !target.isInjured) {
        // Calculate target center position (avatar sprite center, the circular portrait)
        const targetAW = target.element?.querySelector('.battle-avatar-wrapper') as HTMLElement;
        const targetCS = target.element?.querySelector('.battle-character-sprite') as HTMLElement;
        let targetCenterX: number, targetCenterY: number;
        if (targetAW && targetCS) {
          targetCenterX = target.x + targetAW.offsetLeft + targetCS.offsetLeft + targetCS.offsetWidth / 2;
          targetCenterY = target.y + targetAW.offsetTop + targetCS.offsetTop + targetCS.offsetHeight / 2;
        } else {
          targetCenterX = target.x + (target.element?.offsetWidth || 80) / 2;
          targetCenterY = target.y + (target.element?.offsetHeight || 80) / 2;
        }
        
        // Use projectile center for direction calculation
        const projCenterX = x + size / 2;
        const projCenterY = y + size / 2;
        const dx = targetCenterX - projCenterX;
        const dy = targetCenterY - projCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          dirX = dx / dist;
          dirY = dy / dist;
        }
      }
      
      // Move projectile
      // === GRAPPLE DRAG PHASE ===
      if (effect.grapple && isDragging) {
        // During drag: move caster toward projectile at grappleDragSpeed
        const dragSpeed = effect.grappleDragSpeed || 800;
        const cx = caster.x;
        const cy = caster.y;
        const tx = grappleTargetX + size / 2 - (caster.element?.offsetWidth || 0) / 2;
        const ty = grappleTargetY + size / 2 - (caster.element?.offsetHeight || 0) / 2;
        const ddx = tx - cx;
        const ddy = ty - cy;
        const ddist = Math.sqrt(ddx * ddx + ddy * ddy);
        
        if (ddist < 10) {
          // Caster reached projectile - end grapple
          caster.x = tx;
          caster.y = ty;
          if (caster.element) {
            caster.element.style.transform = `translate(${caster.x}px, ${caster.y}px)`;
          }
          console.log(`[BattleSystem] Grapple complete, ${caster.character.name} reached target`);
          removeProjectile();
          return;
        }
        
        // Move caster toward projectile
        const dragDirX = ddx / ddist;
        const dragDirY = ddy / ddist;
        const dragMoveX = dragDirX * dragSpeed * deltaTime;
        const dragMoveY = dragDirY * dragSpeed * deltaTime;
        caster.x += dragMoveX;
        caster.y += dragMoveY;
        
        // Check if caster hit scene edge during drag
        const cW = caster.element?.offsetWidth || 80;
        const cH = caster.element?.offsetHeight || 80;
        if (caster.x <= 0 || caster.x + cW >= this.containerBounds.width ||
            caster.y <= 0 || caster.y + cH >= this.containerBounds.height) {
          // Clamp within bounds
          caster.x = Math.max(0, Math.min(caster.x, this.containerBounds.width - cW));
          caster.y = Math.max(0, Math.min(caster.y, this.containerBounds.height - cH));
          if (caster.element) {
            caster.element.style.transform = `translate(${caster.x}px, ${caster.y}px)`;
          }
          // Set random movement direction
          const randAngle = Math.random() * Math.PI * 2;
          const moveSpd = 20 + caster.character.moveSpeed;
          caster.velocityX = Math.cos(randAngle) * moveSpd;
          caster.velocityY = Math.sin(randAngle) * moveSpd;
          console.log(`[BattleSystem] Grapple drag: ${caster.character.name} hit scene edge, stopping drag`);
          removeProjectile();
          return;
        }
        
        if (caster.element) {
          caster.element.style.transform = `translate(${caster.x}px, ${caster.y}px)`;
        }
        
        // Spawn afterimage during drag - only every other frame, below character layer
        grappleAfterimageFrame++;
        if (caster.element && this.container && grappleAfterimageFrame % 2 === 0) {
          const avatarSprite = caster.element.querySelector('.battle-character-sprite') as HTMLElement;
          if (avatarSprite) {
            const afterimage = avatarSprite.cloneNode(true) as HTMLElement;
            afterimage.style.position = 'absolute';
            // Position at the avatar's actual location within the container
            const wrapper = avatarSprite.parentElement;
            const offsetX = wrapper ? wrapper.offsetLeft : 0;
            const offsetY = wrapper ? wrapper.offsetTop : 0;
            afterimage.style.left = `${caster.x + offsetX}px`;
            afterimage.style.top = `${caster.y + offsetY}px`;
            afterimage.style.opacity = '0.3';
            afterimage.style.pointerEvents = 'none';
            afterimage.style.zIndex = '1';
            afterimage.style.transition = 'opacity 0.3s ease-out';
            afterimage.style.cursor = 'default';
            // Deep blue multiply overlay
            const blueOverlay = document.createElement('div');
            blueOverlay.style.cssText = `
              position: absolute; top: 0; left: 0; width: 100%; height: 100%;
              border-radius: 50%; background: rgba(20, 40, 120, 0.55);
              mix-blend-mode: multiply; pointer-events: none; z-index: 10;
            `;
            afterimage.appendChild(blueOverlay);
            this.container.appendChild(afterimage);
            // Fade out and remove
            requestAnimationFrame(() => {
              afterimage.style.opacity = '0';
            });
            setTimeout(() => {
              if (afterimage.parentNode) afterimage.parentNode.removeChild(afterimage);
            }, 320);
          }
        }
        
        // During drag: check collision with enemies, knock them to sides and deal damage
        const grappleKnockback = effect.grappleKnockback || 100;
        const grappleCollisionDamage = caster.character.attack;
        const baseSpriteRadius = 35;
        const casterRadius = baseSpriteRadius * caster.size;
        
        // Perpendicular directions to drag direction (left and right sides)
        const perpX = -dragDirY;
        const perpY = dragDirX;
        
        const allSprites = Array.from(this.sprites.values());
        for (const sprite of allSprites) {
          if (sprite.isDead || sprite.isInjured || sprite.id === caster.id) continue;
          const isEnemy = 
            (caster.character.type === 'Enemy' && sprite.character.type !== 'Enemy') ||
            (caster.character.type !== 'Enemy' && sprite.character.type === 'Enemy');
          if (!isEnemy) continue;
          
          // Check collision using circle-based detection (same as normal checkCollisions)
          const spriteRadius = baseSpriteRadius * sprite.size;
          const cdx = sprite.x - caster.x;
          const cdy = sprite.y - caster.y;
          const dist = Math.sqrt(cdx * cdx + cdy * cdy);
          if (dist < casterRadius + spriteRadius) {
            // 1 second cooldown per enemy
            const lastHit = grappleHitCooldowns.get(sprite.id);
            if (lastHit && (Date.now() - lastHit) < 1000) continue;
            grappleHitCooldowns.set(sprite.id, Date.now());
            
            // Deal collision damage
            const damageResult = this.applyDamageWithShield(sprite, grappleCollisionDamage, caster.character);
            this.showDamageNumber(sprite, damageResult.damage, caster.character.type !== 'Enemy', damageResult.isCritical);
            
            // Knockback enemy perpendicular to drag direction (to the side)
            // Determine which side the enemy is on relative to the drag line
            const enemyCX = sprite.x + spriteRadius;
            const enemyCY = sprite.y + spriteRadius;
            const casterCX = caster.x + casterRadius;
            const casterCY = caster.y + casterRadius;
            const toEnemyX = enemyCX - casterCX;
            const toEnemyY = enemyCY - casterCY;
            // Dot product with perpendicular to determine side
            const side = toEnemyX * perpX + toEnemyY * perpY >= 0 ? 1 : -1;
            const spriteDiameter = spriteRadius * 2;
            const knockTargetX = Math.max(0, Math.min(sprite.x + perpX * side * grappleKnockback, this.containerBounds.width - spriteDiameter));
            const knockTargetY = Math.max(0, Math.min(sprite.y + perpY * side * grappleKnockback, this.containerBounds.height - spriteDiameter));
            
            // Smooth animated knockback using CSS transition
            if (sprite.element) {
              sprite.element.style.transition = 'transform 0.25s ease-out';
              sprite.element.style.transform = `translate(${knockTargetX}px, ${knockTargetY}px)`;
              // Update logical position immediately so collision checks use new pos
              sprite.x = knockTargetX;
              sprite.y = knockTargetY;
              // Remove transition after animation completes
              setTimeout(() => {
                if (sprite.element) {
                  sprite.element.style.transition = '';
                }
              }, 260);
            } else {
              sprite.x = knockTargetX;
              sprite.y = knockTargetY;
            }
            
            // Check if target died
            if (sprite.character.currentHP <= 0 && !sprite.isDead) {
              this.handleDeath(sprite, caster.id);
            }
            
            console.log(`[BattleSystem] Grapple collision: ${sprite.character.name} knocked sideways ${grappleKnockback}px, dealt ${damageResult.damage} damage`);
          }
        }
        
        // Update tether during drag
        updateTether();
        requestAnimationFrame(animateProjectile);
        return;
      }
      
      // === NORMAL PROJECTILE MOVEMENT ===
      const moveX = dirX * speed * deltaTime;
      const moveY = dirY * speed * deltaTime;
      x += moveX;
      y += moveY;
      traveledDistance += Math.sqrt(moveX * moveX + moveY * moveY);
      
      // Create trail effect every 30ms for piercing projectiles or fireball
      const currentTime = Date.now();
      if ((effect.piercing || effect.hasTrail) && currentTime - lastTrailTime > 30) {
        createTrail(x, y);
        lastTrailTime = currentTime;
      }
      
      // Update rotation to match movement direction
      const angle = Math.atan2(dirY, dirX) * (180 / Math.PI);
      
      projectile.style.left = `${x}px`;
      projectile.style.top = `${y}px`;
      
      // Update grapple tether line
      if (effect.grapple) {
        updateTether();
      }
      
      // Preserve scale if breathing effect is active
      if (effect.hasTrail) {
        const currentTransform = projectile.style.transform;
        const scaleMatch = currentTransform.match(/scale\(([^)]+)\)/);
        const currentScale = scaleMatch ? scaleMatch[1] : '1';
        projectile.style.transform = `rotate(${angle}deg) scale(${currentScale})`;
      } else {
        projectile.style.transform = `rotate(${angle}deg)`;
      }
      
      // Check if exceeded max distance
      if (effect.destroyOnMaxDistance && traveledDistance >= maxDistance) {
        removeProjectile();
        return;
      }
      
      // Check if out of bounds
      if (x < -size || x > this.containerBounds.width || 
          y < -size || y > this.containerBounds.height) {
        if (effect.grapple && !isDragging) {
          // Grapple: clamp projectile at edge and start drag phase
          x = Math.max(0, Math.min(x, this.containerBounds.width - size));
          y = Math.max(0, Math.min(y, this.containerBounds.height - size));
          projectile.style.left = `${x}px`;
          projectile.style.top = `${y}px`;
          grappleTargetX = x;
          grappleTargetY = y;
          isDragging = true;
          console.log(`[BattleSystem] Grapple hit edge at (${x.toFixed(0)}, ${y.toFixed(0)}), starting drag phase for ${caster.character.name}`);
        } else if (effect.bounce) {
          // Clamp position within bounds
          x = Math.max(0, Math.min(x, this.containerBounds.width - size));
          y = Math.max(0, Math.min(y, this.containerBounds.height - size));
          
          // Generate new random direction
          const newAngle = Math.random() * Math.PI * 2;
          dirX = Math.cos(newAngle);
          dirY = Math.sin(newAngle);
          
          // Increase damage on bounce
          damage += effect.bounceDamageIncrease || 0;
          
          // Reset hit targets so projectile can hit previously hit enemies again
          hitTargets.clear();
        } else {
          removeProjectile();
          return;
        }
      }
      
      // Check collision with targets (skip during bounce immunity period)
      if (Date.now() < bounceImmunityUntil) {
        // During bounce immunity, just update position and skip collision
        projectile.style.left = `${x}px`;
        projectile.style.top = `${y}px`;
        const angle = Math.atan2(dirY, dirX) * (180 / Math.PI);
        const currentTransform = projectile.style.transform;
        const scaleMatch = currentTransform.match(/scale\(([^)]+)\)/);
        const currentScale = scaleMatch ? ` scale(${scaleMatch[1]})` : '';
        projectile.style.transform = `rotate(${angle}deg)${currentScale}`;
        requestAnimationFrame(animateProjectile);
        return;
      }
      const sprites = Array.from(this.sprites.values());
      for (const sprite of sprites) {
        if (sprite.isDead || sprite.isInjured) continue;
        
        // Skip targets that have already been hit (even for piercing projectiles)
        if (effect.bounceOnHit) {
          // For bounceOnHit: use timed cooldown (0.5s) instead of permanent exclusion
          const lastHitTime = hitCooldowns.get(sprite.id);
          if (lastHitTime && (Date.now() - lastHitTime) < 500) continue;
        } else {
          if (hitTargets.has(sprite.id)) continue;
        }
        
        // Check if enemy
        const isEnemy = 
          (caster.character.type === 'Enemy' && sprite.character.type !== 'Enemy') ||
          (caster.character.type !== 'Enemy' && sprite.character.type === 'Enemy');
        
        // Check if ally (same team, not self)
        const isAlly = !isEnemy && sprite.id !== caster.id;
        
        // Skip if not a valid target
        if (!isEnemy && !(effect.healAlly && isAlly)) continue;
        
        // Check collision (使用缩小30%的碰撞盒)
        const collisionSize = size * 0.7; // 碰撞体积缩小30%
        const collisionOffset = (size - collisionSize) / 2; // 居中偏移
        const collisionX = x + collisionOffset;
        const collisionY = y + collisionOffset;
        
        const spriteX = sprite.x;
        const spriteY = sprite.y;
        const spriteWidth = sprite.element?.offsetWidth || 80;
        const spriteHeight = sprite.element?.offsetHeight || 80;
        
        if (collisionX + collisionSize > spriteX && collisionX < spriteX + spriteWidth &&
            collisionY + collisionSize > spriteY && collisionY < spriteY + spriteHeight) {
          
          // Hit!
          hitTargets.add(sprite.id);
          
          if (effect.healAlly && isAlly) {
            // Heal ally
            const healBase = effect.heal?.base || effect.damage?.base || 5;
            const healAttackMult = effect.heal?.attackMultiplier || 0.25;
            let healAmount = healBase + (caster.character.attack * healAttackMult);
            healAmount = Math.floor(healAmount);
            
            // Apply healing (cap at max HP)
            const oldHP = sprite.character.currentHP;
            sprite.character.currentHP = Math.min(sprite.character.maxHP, sprite.character.currentHP + healAmount);
            const actualHeal = sprite.character.currentHP - oldHP;
            
            if (actualHeal > 0) {
              // Show green healing number
              this.showHealNumber(sprite, actualHeal);
              this.updateBars(sprite);
              // Notify UI for party slot healing display
              if (this.onCharacterHealedCallback) {
                this.onCharacterHealedCallback(sprite.id, actualHeal);
              }
              console.log(`[BattleSystem] Healed ally ${sprite.character.name} for ${actualHeal} HP`);
            }
            
            // Destroy on hit
            if (effect.destroyOnHit && !effect.piercing) {
              removeProjectile();
              return;
            }
          } else if (isEnemy) {
          // Create blood splash effect on hit
          if (effect.piercing || effect.hasTrail || effect.destroyOnHit) {
            // Use particle color from skill config if available
            const particleColor = (effect as any).particleColor || undefined;
            createBloodSplash(sprite, particleColor);
          }
          
          // Apply defense reduction first
          const baseDamage = Math.floor(damage);
          const damageReduction = baseDamage * (sprite.character.defense / 100);
          let finalDamage = Math.max(1, Math.floor(baseDamage - damageReduction));
          
          // Check critOnFullHP: force crit if target is at full HP
          let forceCrit = false;
          if ((effect as any).critOnFullHP && sprite.character.currentHP >= sprite.character.maxHP) {
            forceCrit = true;
          }
          
          let damageResult: { damage: number; isCritical: boolean };
          if (forceCrit) {
            // Apply crit multiplier manually and bypass normal crit logic
            const critMultiplier = caster.character.critDamage / 100;
            const critDamage = Math.floor(finalDamage * critMultiplier);
            damageResult = this.applyDamageWithShield(sprite, critDamage, caster.character); // pass attacker for damage_modifier
            damageResult.isCritical = true;
            console.log(`[BattleSystem] critOnFullHP triggered! Target ${sprite.character.name} at full HP. Base: ${baseDamage} -> After defense: ${finalDamage} -> Crit: ${critDamage}`);
          } else {
            damageResult = this.applyDamageWithShield(sprite, finalDamage, caster.character);
          }
          this.showDamageNumber(sprite, damageResult.damage, caster.character.type !== 'Enemy', damageResult.isCritical);
          
          // Check if target died from this hit
          if (sprite.character.currentHP <= 0 && !sprite.isDead) {
            this.handleDeath(sprite, caster.id);
          }
          
          // Apply buff on hit (e.g., paralysis)
          if (effect.applyBuff && this.buffSystem && !sprite.isDead) {
            const buffDuration = (effect.buffDuration || 3000) / 1000;
            this.buffSystem.applyBuff(sprite.id, effect.applyBuff, buffDuration);
            
            // Check if buff disables movement
            const buffDef = this.buffSystem.getBuffDefinition(effect.applyBuff);
            if (buffDef && (buffDef as any).disableMovement) {
              sprite.canMove = false;
              console.log(`[BattleSystem] Movement disabled for ${sprite.character.name} by ${buffDef.name}`);
            }
            
            // Directly apply buff stat effects for enemies (GameUI only handles recruited characters)
            if (sprite.character.type === 'Enemy' && buffDef && buffDef.effects) {
              for (const eff of buffDef.effects) {
                const attr = eff.attribute as string;
                if (typeof (sprite.character as any)[attr] === 'number') {
                  if (eff.type === 'flat') {
                    (sprite.character as any)[attr] += eff.value;
                  } else if (eff.type === 'percentage') {
                    (sprite.character as any)[attr] *= (1 + eff.value / 100);
                  }
                }
              }
            }
            
            console.log(`[BattleSystem] Applied ${effect.applyBuff} buff to ${sprite.character.name}`);
            
            // Trigger immediate visual effect update
            this.characterBuffStates.set(sprite.id, new Set(['__force_update__']));
            this.applyBuffVisualEffects(sprite.id);
          }
          
          // Bounce on hit: redirect toward another random enemy
          if (effect.bounceOnHit) {
            // Record hit time for cooldown-based re-hit prevention
            hitCooldowns.set(sprite.id, Date.now());
            // Find another enemy to bounce toward (exclude the one just hit)
            const otherEnemies = Array.from(this.sprites.values()).filter(s =>
              !s.isDead && !s.isInjured && s.id !== sprite.id &&
              ((caster.character.type === 'Enemy' && s.character.type !== 'Enemy') ||
               (caster.character.type !== 'Enemy' && s.character.type === 'Enemy'))
            );
            if (otherEnemies.length > 0) {
              const nextTarget = otherEnemies[Math.floor(Math.random() * otherEnemies.length)];
              target = nextTarget;
              const nAW = nextTarget.element?.querySelector('.battle-avatar-wrapper') as HTMLElement;
              const nCS = nextTarget.element?.querySelector('.battle-character-sprite') as HTMLElement;
              let ntx: number, nty: number;
              if (nAW && nCS) {
                ntx = nextTarget.x + nAW.offsetLeft + nCS.offsetLeft + nCS.offsetWidth / 2;
                nty = nextTarget.y + nAW.offsetTop + nCS.offsetTop + nCS.offsetHeight / 2;
              } else {
                ntx = nextTarget.x + (nextTarget.element?.offsetWidth || 80) / 2;
                nty = nextTarget.y + (nextTarget.element?.offsetHeight || 80) / 2;
              }
              const ndx = ntx - (x + size / 2);
              const ndy = nty - (y + size / 2);
              const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
              if (ndist > 0) {
                dirX = ndx / ndist;
                dirY = ndy / ndist;
              }
              // Set bounce immunity to skip collision checks for 150ms
              bounceImmunityUntil = Date.now() + 150;
            } else {
              // Only one enemy in scene, destroy projectile
              removeProjectile();
              return;
            }
            // Continue animating (don't destroy)
          } else
          // Destroy on hit if not piercing
          if (effect.destroyOnHit && !effect.piercing) {
            removeProjectile();
            return;
          }
          } // end else if (isEnemy)
        }
      }
      
      requestAnimationFrame(animateProjectile);
    };
    
    requestAnimationFrame(animateProjectile);
  }

  /**
   * Show buff notification above character
   */
  private showBuffNotification(sprite: CharacterSprite, text: string): void {
    if (!this.container) return;

    const buffText = document.createElement('div');
    buffText.textContent = text;
    buffText.style.cssText = `
      position: absolute;
      left: ${sprite.x + 35}px;
      top: ${sprite.y - 40}px;
      color: #ffaa00;
      font-size: 18px;
      font-weight: bold;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000;
      pointer-events: none;
      z-index: 1000;
      animation: skillFloat 1.5s ease-out forwards;
    `;

    this.container.appendChild(buffText);

    setTimeout(() => {
      if (buffText.parentNode) {
        buffText.parentNode.removeChild(buffText);
      }
    }, 1500);
  }

  /**
   * Show white explosion particle effect at hit position
   */
  private showHitExplosion(x: number, y: number): void {
    if (!this.container) return;

    // Create multiple particles for explosion effect
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: 8px;
        height: 8px;
        background: white;
        border-radius: 50%;
        pointer-events: none;
        z-index: 998;
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
      `;

      this.container.appendChild(particle);

      // Calculate random direction for each particle
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const speed = 30 + Math.random() * 20;
      const velocityX = Math.cos(angle) * speed;
      const velocityY = Math.sin(angle) * speed;

      // Animate particle
      const startTime = Date.now();
      const duration = 400; // 400ms lifetime

      const animateParticle = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration) {
          particle.remove();
          return;
        }

        const progress = elapsed / duration;
        
        // Move particle
        const currentX = x + velocityX * progress;
        const currentY = y + velocityY * progress;
        
        // Fade out
        const opacity = 1 - progress;
        
        // Scale down
        const scale = 1 - progress * 0.5;

        particle.style.left = `${currentX}px`;
        particle.style.top = `${currentY}px`;
        particle.style.opacity = `${opacity}`;
        particle.style.transform = `scale(${scale})`;

        requestAnimationFrame(animateParticle);
      };

      animateParticle();
    }
  }

  /**
   * Show dark red blood splash particle effect at position (simulates blood splatter)
   */
  private showBloodSplash(x: number, y: number): void {
    if (!this.container) return;

    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      const size = (3 + Math.random() * 6) * 1.5;
      // Dark red color variations
      const r = 120 + Math.floor(Math.random() * 40);
      const g = Math.floor(Math.random() * 20);
      const b = Math.floor(Math.random() * 20);
      particle.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: ${size}px;
        height: ${size}px;
        background: rgb(${r}, ${g}, ${b});
        border-radius: 50%;
        pointer-events: none;
        z-index: 998;
        box-shadow: 0 0 4px rgba(${r}, 0, 0, 0.6);
      `;

      this.container.appendChild(particle);

      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.8;
      const speed = (20 + Math.random() * 40) * 1.5;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const gravity = 60; // pixels/s^2 downward pull for dripping effect
      const startTime = Date.now();
      const duration = 300 + Math.random() * 200;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration) {
          particle.remove();
          return;
        }
        const t = elapsed / 1000;
        const progress = elapsed / duration;
        const cx = x + vx * t;
        const cy = y + vy * t + 0.5 * gravity * t * t;
        const opacity = 1 - progress * progress;
        const s = 1 - progress * 0.3;
        particle.style.left = `${cx}px`;
        particle.style.top = `${cy}px`;
        particle.style.opacity = `${opacity}`;
        particle.style.transform = `scale(${s})`;
        requestAnimationFrame(animate);
      };
      animate();
    }
  }

  /**
   * Show skill cast notification above character
   */
  private showSkillCastNotification(sprite: CharacterSprite, skillName: string): void {
    if (!this.container) return;    const skillElement = document.createElement('div');
    skillElement.textContent = skillName;
    skillElement.style.cssText = `
      position: absolute;
      left: ${sprite.x + 35}px;
      top: ${sprite.y - 40}px;
      color: #ffff00;
      font-size: 18px;
      font-weight: bold;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000,
        0 0 5px rgba(255, 255, 0, 0.8);
      pointer-events: none;
      z-index: 1000;
      animation: skillFloat 1.5s ease-out forwards;
    `;

    // Add CSS animation if not already added
    if (!document.getElementById('skill-float-animation')) {
      const style = document.createElement('style');
      style.id = 'skill-float-animation';
      style.textContent = `
        @keyframes skillFloat {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-20px) scale(1.3);
          }
          100% {
            opacity: 0;
            transform: translateY(-40px) scale(1);
          }
        }
      `;
      document.head.appendChild(style);
    }

    this.container.appendChild(skillElement);

    // Remove after animation
    setTimeout(() => {
      if (skillElement.parentNode) {
        skillElement.parentNode.removeChild(skillElement);
      }
    }, 1500);
  }

  /**
   * Check for collisions between all sprites
   */
  private checkCollisions(): void {
    const sprites = Array.from(this.sprites.values());
    const baseSpriteRadius = 35; // Half of base sprite width (70px / 2)

    for (let i = 0; i < sprites.length; i++) {
      const sprite1 = sprites[i];
      if (sprite1.isDead || sprite1.isInjured) continue;

      // Calculate scaled radius for sprite1
      const sprite1Radius = baseSpriteRadius * sprite1.size;

      for (let j = i + 1; j < sprites.length; j++) {
        const sprite2 = sprites[j];
        if (sprite2.isDead || sprite2.isInjured) continue;

        // Calculate scaled radius for sprite2
        const sprite2Radius = baseSpriteRadius * sprite2.size;

        // Only check collision between enemies and adventurers
        const isEnemyVsAdventurer = 
          (sprite1.character.type === 'Enemy' && sprite2.character.type !== 'Enemy') ||
          (sprite1.character.type !== 'Enemy' && sprite2.character.type === 'Enemy');

        if (!isEnemyVsAdventurer) continue;

        // Calculate distance between sprites
        const dx = sprite2.x - sprite1.x;
        const dy = sprite2.y - sprite1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if collision occurred (sum of both radii)
        const collisionDistance = sprite1Radius + sprite2Radius;
        if (distance < collisionDistance) {
          this.handleCollision(sprite1, sprite2, dx, dy, distance);
        }
      }
    }

    // Check collisions between adventurers and resource nodes
    this.checkResourceNodeCollisions();
  }

  /**
   * Handle collision between two sprites
   */
  private handleCollision(sprite1: CharacterSprite, sprite2: CharacterSprite, dx: number, dy: number, distance: number): void {
    // Calculate collision point (midpoint between two sprites)
    const collisionX = (sprite1.x + sprite2.x) / 2;
    const collisionY = (sprite1.y + sprite2.y) / 2;
    
    // Create hit effect at collision point
    this.createHitEffect(collisionX, collisionY);
    
    // Record collision time for both sprites (for boss knockback delay)
    const currentTime = Date.now();
    sprite1.lastCollisionTime = currentTime;
    sprite2.lastCollisionTime = currentTime;
    
    // End charge state if either sprite is charging (with 0.2s delay)
    // Use pendingRemoval flag to prevent multiple setTimeout from repeated collisions
    if (sprite1.chargeState && sprite1.chargeState.active && !(sprite1.chargeState as any).pendingRemoval) {
      (sprite1.chargeState as any).pendingRemoval = true;
      const s1 = sprite1;
      setTimeout(() => {
        if (this.buffSystem && this.buffSystem.hasBuff(s1.id, 'charge')) {
          this.endChargeState(s1);
        }
      }, 200);
    }
    if (sprite2.chargeState && sprite2.chargeState.active && !(sprite2.chargeState as any).pendingRemoval) {
      (sprite2.chargeState as any).pendingRemoval = true;
      const s2 = sprite2;
      setTimeout(() => {
        if (this.buffSystem && this.buffSystem.hasBuff(s2.id, 'charge')) {
          this.endChargeState(s2);
        }
      }, 200);
    }
    
    // Handle heavy_strike skill collision counting
    // Only count collisions between adventurers and enemies
    if (sprite1.character.type !== 'Enemy' && sprite2.character.type === 'Enemy') {
      this.handleHeavyStrikeCollision(sprite1.character);
      // Check for hot_blood_soul master skill
      this.handleHotBloodSoulCollision(sprite1.character);
    }
    if (sprite2.character.type !== 'Enemy' && sprite1.character.type === 'Enemy') {
      this.handleHeavyStrikeCollision(sprite2.character);
      // Check for hot_blood_soul master skill
      this.handleHotBloodSoulCollision(sprite2.character);
    }
    
    // Calculate damage
    const damageResult1 = this.calculateDamage(sprite1.character, sprite2.character);
    const damageResult2 = this.calculateDamage(sprite2.character, sprite1.character);

    // Apply damage (accounting for shields)
    // Pass attacker for damage_modifier (challenger skill), but remove exposed_weakness first
    // if calculateDamage already triggered it, to prevent double-crit
    if (damageResult2.isCritical && this.buffSystem && this.buffSystem.hasBuff(sprite1.character.id, 'exposed_weakness')) {
      this.buffSystem.removeBuff(sprite1.character.id, 'exposed_weakness');
    }
    if (damageResult1.isCritical && this.buffSystem && this.buffSystem.hasBuff(sprite2.character.id, 'exposed_weakness')) {
      this.buffSystem.removeBuff(sprite2.character.id, 'exposed_weakness');
    }
    this.applyDamageWithShield(sprite1, damageResult2.damage, sprite2.character);
    this.applyDamageWithShield(sprite2, damageResult1.damage, sprite1.character);

    // Apply passive skill collision effects (lifesteal, midas_touch)
    // sprite1 dealt damage to sprite2
    if (damageResult1.damage > 0) {
      this.applyCollisionPassiveEffects(sprite1, sprite2, damageResult1.damage);
    }
    // sprite2 dealt damage to sprite1
    if (damageResult2.damage > 0) {
      this.applyCollisionPassiveEffects(sprite2, sprite1, damageResult2.damage);
    }

    // Show damage numbers (or MISS if dodged)
    if (damageResult2.damage === 0) {
      this.showMissText(sprite1);
    } else {
      this.showDamageNumber(sprite1, damageResult2.damage, sprite2.character.type === 'Enemy', damageResult2.isCritical);
    }
    
    if (damageResult1.damage === 0) {
      this.showMissText(sprite2);
    } else {
      this.showDamageNumber(sprite2, damageResult1.damage, sprite1.character.type === 'Enemy', damageResult1.isCritical);
    }

    // Calculate knockback (multiply by 10 to make it visible as velocity is in pixels/second)
    const weightDiff = Math.abs(sprite1.character.weight - sprite2.character.weight);
    const baseKnockback = (10 + weightDiff * 0.5) * 10;

    // Normalize direction
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;

    // Generate random angles for new movement direction after knockback
    const randomAngle1 = Math.random() * Math.PI * 2;
    const randomAngle2 = Math.random() * Math.PI * 2;
    const speed1 = 20 + sprite1.character.moveSpeed;
    const speed2 = 20 + sprite2.character.moveSpeed;

    // Apply knockback with random direction (heavier character gets half knockback)
    if (sprite1.character.weight > sprite2.character.weight) {
      // sprite1 is heavier - gets half knockback, then random direction
      sprite1.velocityX = -normalizedDx * (baseKnockback * 0.5);
      sprite1.velocityY = -normalizedDy * (baseKnockback * 0.5);
      sprite2.velocityX = normalizedDx * baseKnockback;
      sprite2.velocityY = normalizedDy * baseKnockback;
      
      // After a short delay, set random direction
      setTimeout(() => {
        if (!sprite1.isDead && !sprite1.isInjured) {
          sprite1.velocityX = Math.cos(randomAngle1) * speed1;
          sprite1.velocityY = Math.sin(randomAngle1) * speed1;
        }
        if (!sprite2.isDead && !sprite2.isInjured) {
          sprite2.velocityX = Math.cos(randomAngle2) * speed2;
          sprite2.velocityY = Math.sin(randomAngle2) * speed2;
        }
      }, 200); // 200ms delay for knockback effect
    } else if (sprite2.character.weight > sprite1.character.weight) {
      // sprite2 is heavier - gets half knockback, then random direction
      sprite1.velocityX = -normalizedDx * baseKnockback;
      sprite1.velocityY = -normalizedDy * baseKnockback;
      sprite2.velocityX = normalizedDx * (baseKnockback * 0.5);
      sprite2.velocityY = normalizedDy * (baseKnockback * 0.5);
      
      // After a short delay, set random direction
      setTimeout(() => {
        if (!sprite1.isDead && !sprite1.isInjured) {
          sprite1.velocityX = Math.cos(randomAngle1) * speed1;
          sprite1.velocityY = Math.sin(randomAngle1) * speed1;
        }
        if (!sprite2.isDead && !sprite2.isInjured) {
          sprite2.velocityX = Math.cos(randomAngle2) * speed2;
          sprite2.velocityY = Math.sin(randomAngle2) * speed2;
        }
      }, 200); // 200ms delay for knockback effect
    } else {
      // Equal weight - both get same knockback, then random direction
      sprite1.velocityX = -normalizedDx * baseKnockback;
      sprite1.velocityY = -normalizedDy * baseKnockback;
      sprite2.velocityX = normalizedDx * baseKnockback;
      sprite2.velocityY = normalizedDy * baseKnockback;
      
      // After a short delay, set random direction
      setTimeout(() => {
        if (!sprite1.isDead && !sprite1.isInjured) {
          sprite1.velocityX = Math.cos(randomAngle1) * speed1;
          sprite1.velocityY = Math.sin(randomAngle1) * speed1;
        }
        if (!sprite2.isDead && !sprite2.isInjured) {
          sprite2.velocityX = Math.cos(randomAngle2) * speed2;
          sprite2.velocityY = Math.sin(randomAngle2) * speed2;
        }
      }, 200); // 200ms delay for knockback effect
    }

    // Check for death and award EXP
    if (sprite1.character.currentHP <= 0 && !sprite1.isDead) {
      // sprite1 died, sprite2 killed it
      if (sprite1.character.type === 'Enemy' && sprite2.character.type !== 'Enemy') {
        this.handleDeath(sprite1, sprite2.character.id);
      } else {
        this.handleDeath(sprite1);
      }
    }
    if (sprite2.character.currentHP <= 0 && !sprite2.isDead) {
      // sprite2 died, sprite1 killed it
      if (sprite2.character.type === 'Enemy' && sprite1.character.type !== 'Enemy') {
        this.handleDeath(sprite2, sprite1.character.id);
      } else {
        this.handleDeath(sprite2);
      }
    }
    
    // Handle phantom_step master skill (teleport after collision with enemy)
    if (sprite1.character.masterSkill === 'phantom_step') {
      const isEnemyCollision = sprite1.character.type !== sprite2.character.type;
      if (isEnemyCollision) {
        this.handlePhantomStep(sprite1);
      }
    }
    if (sprite2.character.masterSkill === 'phantom_step') {
      const isEnemyCollision = sprite2.character.type !== sprite1.character.type;
      if (isEnemyCollision) {
        this.handlePhantomStep(sprite2);
      }
    }
  }

  /**
   * Check for collisions between adventurers and resource nodes
   */
  private checkResourceNodeCollisions(): void {
    const currentTime = Date.now();
    const sprites = Array.from(this.sprites.values());
    const resourceNodes = Array.from(this.resourceNodes.values());
    const baseSpriteRadius = 35;

    sprites.forEach(sprite => {
      // Only adventurers can hit resource nodes
      if (sprite.character.type === 'Enemy' || sprite.isDead || sprite.isInjured) return;

      const spriteRadius = baseSpriteRadius * sprite.size;

      resourceNodes.forEach(node => {
        // Skip if node is invincible
        if (node.isInvincible && currentTime < node.invincibleUntil) return;

        // Calculate distance
        const dx = node.x + node.nodeData.size / 2 - (sprite.x + 35);
        const dy = node.y + node.nodeData.size / 2 - (sprite.y + 35);
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check collision (sprite radius + node radius)
        const nodeRadius = node.nodeData.size / 2;
        if (distance < spriteRadius + nodeRadius) {
          this.handleResourceNodeCollision(sprite, node);
        }
      });
    });
  }

  /**
   * Handle collision between adventurer and resource node
   */
  private handleResourceNodeCollision(sprite: CharacterSprite, node: ResourceNodeSprite): void {
    const currentTime = Date.now();

    // Apply damage to resource node (base = attack)
    let damage = sprite.character.attack;

    // Apply damage_modifier passive skill for resource targets (natural_science: +100%)
    const resourceModifier = this.getDamageModifier(sprite.character, 'resource');
    if (resourceModifier > 0) {
      const baseDamage = damage;
      damage = Math.floor(damage * (1 + resourceModifier));
      console.log(`[BattleSystem] ${sprite.character.name} resource damage_modifier: ${baseDamage} → ${damage} (+${resourceModifier * 100}%)`);
    }

    node.currentHP = Math.max(0, node.currentHP - damage);

    // Show damage number
    this.showResourceNodeDamage(node, damage);

    // White explosion particle effect
    this.showResourceNodeHitEffect(node);

    // Shake the resource node element
    this.shakeResourceNode(node);

    // Update HP bar
    this.updateResourceNodeBar(node);

    // Apply 0.5 second invincibility
    node.isInvincible = true;
    node.invincibleUntil = currentTime + 500;

    // Check if resource node is destroyed
    if (node.currentHP <= 0) {
      this.handleResourceNodeDeath(node);
    }

    // Knockback the adventurer (resource nodes don't move)
    const dx = sprite.x - node.x;
    const dy = sprite.y - node.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      const normalizedDx = dx / distance;
      const normalizedDy = dy / distance;
      const knockback = 100; // Fixed knockback value
      
      sprite.velocityX = normalizedDx * knockback;
      sprite.velocityY = normalizedDy * knockback;

      // After a short delay, set random direction
      const randomAngle = Math.random() * Math.PI * 2;
      const speed = 20 + sprite.character.moveSpeed;
      setTimeout(() => {
        if (!sprite.isDead && !sprite.isInjured) {
          sprite.velocityX = Math.cos(randomAngle) * speed;
          sprite.velocityY = Math.sin(randomAngle) * speed;
        }
      }, 200);
    }
  }

  /**
   * Show damage number on resource node
   */
  private showResourceNodeDamage(node: ResourceNodeSprite, damage: number): void {
    if (!this.container) return;

    // Ensure damage is displayed as an integer
    const displayDamage = Math.floor(damage);
    
    const damageElement = document.createElement('div');
    damageElement.textContent = `-${displayDamage}`;
    damageElement.style.cssText = `
      position: absolute;
      left: ${node.x + node.nodeData.size / 2}px;
      top: ${node.y - 20}px;
      color: #ffaa00;
      font-size: 18px;
      font-weight: bold;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000;
      pointer-events: none;
      z-index: 1000;
      animation: damageFloat 2s ease-out forwards;
    `;

    this.container.appendChild(damageElement);

    setTimeout(() => {
      if (damageElement.parentNode) {
        damageElement.parentNode.removeChild(damageElement);
      }
    }, 2000);
  }

  /**
   * Show white explosion particle effect on resource node hit
   */
  private showResourceNodeHitEffect(node: ResourceNodeSprite): void {
    if (!this.container) return;

    const centerX = node.x + node.nodeData.size / 2;
    const centerY = node.y + node.nodeData.size / 2;
    const particleCount = 10 + Math.floor(Math.random() * 6);

    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement('div');
      const size = 6 + Math.random() * 10;

      p.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${centerX - size / 2}px;
        top: ${centerY - size / 2}px;
        background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(220,220,220,0.8) 100%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 999;
        box-shadow: 0 0 6px rgba(255,255,255,0.8);
      `;

      this.container.appendChild(p);

      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const speed = 80 + Math.random() * 120;
      let px = centerX - size / 2;
      let py = centerY - size / 2;
      let vx = Math.cos(angle) * speed;
      let vy = Math.sin(angle) * speed;
      let opacity = 1;

      const animate = () => {
        px += vx * 0.016;
        py += vy * 0.016;
        vy += 150 * 0.016; // gravity
        opacity -= 0.03;
        if (opacity <= 0) {
          p.remove();
        } else {
          p.style.left = `${px}px`;
          p.style.top = `${py}px`;
          p.style.opacity = opacity.toString();
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }

  /**
   * Shake a resource node element briefly
   */
  private shakeResourceNode(node: ResourceNodeSprite): void {
    const el = node.element;
    if (!el) return;

    const origTransform = el.style.transform || '';
    let frame = 0;
    const offsets = [
      { x: -4, y: 0 }, { x: 4, y: -2 }, { x: -3, y: 2 },
      { x: 3, y: -1 }, { x: -2, y: 1 }, { x: 0, y: 0 }
    ];

    const shake = () => {
      if (frame >= offsets.length) {
        el.style.transform = origTransform;
        return;
      }
      el.style.transform = `${origTransform} translate(${offsets[frame].x}px, ${offsets[frame].y}px)`;
      frame++;
      requestAnimationFrame(shake);
    };
    requestAnimationFrame(shake);
  }

  /**
   * Handle resource node death and drop loot
   */
  private handleResourceNodeDeath(node: ResourceNodeSprite): void {
    if (!this.resourceNodeSystem || !this.lootSystem) {
      this.despawnResourceNode(node.id);
      return;
    }

    console.log(`[BattleSystem] Resource node ${node.nodeData.name} destroyed`);

    // Roll for drops
    const drops = this.resourceNodeSystem.rollDrops(node.nodeData.id, this.currentStage);

    // Spawn loot at node position
    drops.forEach(drop => {
      if (this.lootSystem && this.onLootDroppedCallback) {
        // Convert to LootDrop format for generateLoot
        const lootDrops = [{
          itemId: drop.itemId,
          quantity: drop.quantity,
          chance: 1.0 // Already rolled in rollDrops
        }];
        
        const droppedLoot = this.lootSystem.generateLoot(node.id, lootDrops, node.x, node.y);
        if (droppedLoot) {
          this.onLootDroppedCallback(droppedLoot.id, drop.itemId, node.x, node.y);
          console.log(`[BattleSystem] Dropped ${drop.quantity}x ${drop.itemId} at (${node.x.toFixed(0)}, ${node.y.toFixed(0)})`);
        }
      }
    });

    // Despawn the resource node
    this.despawnResourceNode(node.id);
  }

  /**
   * Calculate damage dealt by attacker to defender
   * Returns an object with damage amount and whether it was a critical hit
   */
  private calculateDamage(attacker: NPCData, defender: NPCData): { damage: number; isCritical: boolean } {
    // Check for dodge first (defender's dodge rate)
    const dodgeChance = defender.dodgeRate / 100;
    const isDodged = Math.random() < dodgeChance;
    
    if (isDodged) {
      console.log(`[BattleSystem] ${defender.name} dodged the attack! (${defender.dodgeRate}% dodge rate)`);
      return { damage: 0, isCritical: false }; // Damage is completely negated
    }
    
    // Calculate base damage with defense reduction
    const baseDamage = attacker.attack;
    const damageReduction = baseDamage * (defender.defense / 100);
    let finalDamage = Math.max(1, Math.floor(baseDamage - damageReduction));
    
    // Check for guaranteed crit (heavy_strike skill or exposed_weakness BUFF)
    let isCrit = false;
    if (attacker.guaranteedCrit) {
      isCrit = true;
      attacker.guaranteedCrit = false; // Reset after use
      console.log(`[BattleSystem] ${attacker.name} triggered guaranteed crit!`);
    } else if (this.buffSystem && this.buffSystem.hasBuff(defender.id, 'exposed_weakness')) {
      // Defender has exposed_weakness BUFF - force critical hit (does not consume BUFF)
      isCrit = true;
      console.log(`[BattleSystem] ${defender.name} has exposed_weakness BUFF - forced critical hit!`);
    } else {
      // Normal crit chance (attacker's crit rate)
      const critChance = attacker.critRate / 100;
      isCrit = Math.random() < critChance;
    }
    
    // Apply crit damage multiplier
    if (isCrit) {
      const critMultiplier = attacker.critDamage / 100;
      finalDamage = Math.floor(finalDamage * critMultiplier);
      console.log(`[BattleSystem] Critical hit! ${attacker.name} dealt ${finalDamage} damage (${attacker.critDamage}% crit damage)`);
    }
    
    // Apply iron_fortress damage reduction (if defender has it)
    if (defender.masterSkill === 'iron_fortress') {
      const skillData = this.npcSystem.getJobExclusiveSkill('iron_fortress');
      if (skillData && skillData.effects && skillData.effects.length > 0) {
        const effect = skillData.effects[0];
        const hasShield = (defender.currentShield || 0) > 0;
        const reductionRate = hasShield ? effect.shieldReduction : effect.baseReduction;
        const damageBeforeReduction = finalDamage;
        finalDamage = Math.floor(finalDamage * (1 - reductionRate));
        console.log(`[BattleSystem] ${defender.name} iron_fortress reduced damage from ${damageBeforeReduction} to ${finalDamage} (${reductionRate * 100}% reduction, hasShield: ${hasShield})`);
      }
    }

    // Ensure damage is always an integer and at least 1
    finalDamage = Math.max(1, Math.floor(finalDamage));
    
    return { damage: finalDamage, isCritical: isCrit };
  }

  /**
   * Handle heavy_strike skill collision counting
   */
  /**
   * Get damage modifier from passive skill for a given target type.
   * Returns the modifier value (e.g. 0.20 for +20%) or 0 if no modifier applies.
   */
  private getDamageModifier(attacker: NPCData, targetType: string): number {
    if (!attacker.passiveSkill) return 0;

    const passiveSkill = this.npcSystem.getPassiveSkill(attacker.passiveSkill);
    if (!passiveSkill) return 0;

    let modifier = 0;
    for (const effect of passiveSkill.effects) {
      if (effect.type === 'damage_modifier' && effect.targetType === targetType) {
        modifier += effect.value;
      }
    }
    return modifier;
  }

  private handleHeavyStrikeCollision(character: NPCData): void {
    // Check if character has heavy_strike skill
    if (character.passiveSkill !== 'heavy_strike') return;
    
    // Initialize collision count if not exists
    if (character.collisionCount === undefined) {
      character.collisionCount = 0;
    }
    
    // Increment collision count
    character.collisionCount++;
    
    // Check if reached 3 collisions
    if (character.collisionCount >= 3) {
      character.guaranteedCrit = true;
      character.collisionCount = 0; // Reset counter
      console.log(`[BattleSystem] ${character.name} heavy_strike ready! Next hit will crit!`);
    }
  }

  /**
   * Handle hot_blood_soul master skill collision - apply hot_blood buff on collision
   */
  private handleHotBloodSoulCollision(character: NPCData): void {
    // Check if character has hot_blood_soul master skill equipped
    if (character.masterSkill !== 'hot_blood_soul') return;
    
    // Apply hot_blood buff (stackable, 5 second duration, max 5 stacks)
    if (this.buffSystem) {
      this.buffSystem.applyBuff(character.id, 'hot_blood', 5); // 5 seconds duration (not milliseconds!)
      console.log(`[BattleSystem] ${character.name} gained hot_blood buff from collision!`);
    }
  }

  /**
   * Apply passive skill collision effects (lifesteal, midas_touch)
   */
  private applyCollisionPassiveEffects(attacker: CharacterSprite, target: CharacterSprite, damage: number): void {
    const attackerChar = attacker.character;
    if (!attackerChar.passiveSkill) return;

    // Get passive skill data from NPCSystem
    const passiveSkill = this.npcSystem.getPassiveSkill(attackerChar.passiveSkill);
    if (!passiveSkill) return;

    // Check if skill has collision-triggered effects
    if (passiveSkill.triggerCondition !== 'on_collision') return;

    // Apply each effect
    passiveSkill.effects.forEach((effect: any) => {
      switch (effect.type) {
        case 'lifesteal':
          // Heal attacker for percentage of damage dealt
          const healAmount = Math.floor(damage * effect.value);
          if (healAmount > 0) {
            attackerChar.currentHP = Math.min(attackerChar.maxHP, attackerChar.currentHP + healAmount);
            console.log(`[BattleSystem] ${attackerChar.name} lifesteal: healed ${healAmount} HP (${effect.value * 100}% of ${damage} damage)`);
            
            // Show heal number
            this.showHealNumber(attacker, healAmount);
          }
          break;

        case 'gold_on_hit':
          // Grant random gold amount
          const goldAmount = Math.floor(Math.random() * (effect.maxValue - effect.minValue + 1)) + effect.minValue;
          if (this.onGoldGainCallback) {
            this.onGoldGainCallback(goldAmount);
            console.log(`[BattleSystem] ${attackerChar.name} midas_touch: gained ${goldAmount} gold`);
            
            // Show gold gain text
            this.showGoldGainText(attacker, goldAmount);
          }
          break;
      }
    });
  }

  /**
   * Show heal number above character
   */
  private showHealNumber(sprite: CharacterSprite, amount: number): void {
    if (!this.container) return;
    
    const healText = document.createElement('div');
    healText.textContent = `+${amount}`;
    healText.style.position = 'absolute';
    healText.style.left = `${sprite.x}px`;
    healText.style.top = `${sprite.y - 40}px`;
    healText.style.color = '#00ff00';
    healText.style.fontSize = '20px';
    healText.style.fontWeight = 'bold';
    healText.style.pointerEvents = 'none';
    healText.style.zIndex = '1000';
    healText.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    
    this.container.appendChild(healText);
    
    // Animate upward and fade out
    let opacity = 1;
    let yOffset = 0;
    const animateHeal = () => {
      yOffset += 2;
      opacity -= 0.05;
      healText.style.top = `${sprite.y - 40 - yOffset}px`;
      healText.style.opacity = opacity.toString();
      
      if (opacity > 0) {
        requestAnimationFrame(animateHeal);
      } else {
        healText.remove();
      }
    };
    requestAnimationFrame(animateHeal);
  }

  /**
   * Show gold gain text above character
   */
  private showGoldGainText(sprite: CharacterSprite, amount: number): void {
    if (!this.container) return;
    
    const goldText = document.createElement('div');
    goldText.textContent = `+${amount}💰`;
    goldText.style.position = 'absolute';
    goldText.style.left = `${sprite.x}px`;
    goldText.style.top = `${sprite.y - 40}px`;
    goldText.style.color = '#ffd700';
    goldText.style.fontSize = '18px';
    goldText.style.fontWeight = 'bold';
    goldText.style.pointerEvents = 'none';
    goldText.style.zIndex = '1000';
    goldText.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    
    this.container.appendChild(goldText);
    
    // Animate upward and fade out
    let opacity = 1;
    let yOffset = 0;
    const animateGold = () => {
      yOffset += 2;
      opacity -= 0.05;
      goldText.style.top = `${sprite.y - 40 - yOffset}px`;
      goldText.style.opacity = opacity.toString();
      
      if (opacity > 0) {
        requestAnimationFrame(animateGold);
      } else {
        goldText.remove();
      }
    };
    requestAnimationFrame(animateGold);
  }

  /**
   * Apply a brief shake/twitch effect to a sprite when hit
   */
  private applyHitShake(sprite: CharacterSprite): void {
    const el = sprite.element;
    if (!el) return;

    // Inject keyframes once
    if (!document.getElementById('hit-shake-animation')) {
      const style = document.createElement('style');
      style.id = 'hit-shake-animation';
      style.textContent = `
        @keyframes hitShake {
          0% { filter: brightness(2); transform: translate(0, 0); }
          15% { filter: brightness(1); transform: translate(4px, -3px); }
          30% { filter: none; transform: translate(-3px, 2px); }
          45% { transform: translate(2px, -1px); }
          60% { transform: translate(-1px, 2px); }
          75% { transform: translate(1px, -1px); }
          100% { transform: translate(0, 0); filter: none; }
        }
      `;
      document.head.appendChild(style);
    }

    // Apply shake to the avatar wrapper inside the element, not the element itself
    // This way the element's transform (position) is not affected and movement continues
    const avatarWrapper = el.querySelector('.battle-avatar-wrapper') as HTMLElement;
    const target = avatarWrapper || el;

    target.style.animation = 'none';
    void target.offsetWidth;
    target.style.animation = 'hitShake 0.2s ease-out';

    setTimeout(() => {
      target.style.animation = '';
    }, 200);
  }

  /**
   * Show damage number above character
   */
  private showDamageNumber(sprite: CharacterSprite, damage: number, isEnemyDamage: boolean, isCritical: boolean = false): void {
    if (!this.container) return;

    // Apply hit shake effect to enemy sprites
    if (sprite.character.type === 'Enemy' && sprite.element) {
      this.applyHitShake(sprite);
    }

    // Ensure damage is displayed as an integer
    const displayDamage = Math.floor(damage);
    
    const damageElement = document.createElement('div');
    // Add "暴击！" prefix if it's a critical hit
    const damageText = isCritical ? `暴击！-${displayDamage}` : `-${displayDamage}`;
    damageElement.textContent = damageText;
    
    // Increase font size by 30% for critical hits
    const fontSize = isCritical ? 26 : 20;
    
    damageElement.style.cssText = `
      position: absolute;
      left: ${sprite.x + 35}px;
      top: ${sprite.y - 20}px;
      color: ${isEnemyDamage ? '#ff4444' : '#ff9933'};
      font-size: ${fontSize}px;
      font-weight: bold;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000;
      pointer-events: none;
      z-index: 1000;
      animation: damageFloat 2s ease-out forwards;
    `;

    // Add CSS animation if not already added
    if (!document.getElementById('damage-float-animation')) {
      const style = document.createElement('style');
      style.id = 'damage-float-animation';
      style.textContent = `
        @keyframes damageFloat {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-50px);
          }
        }
      `;
      document.head.appendChild(style);
    }

    this.container.appendChild(damageElement);

    // Remove after animation
    setTimeout(() => {
      if (damageElement.parentNode) {
        damageElement.parentNode.removeChild(damageElement);
      }
    }, 2000);
  }

  /**
   * Show green healing number above character
   */
  private showHealNumber(sprite: CharacterSprite, healAmount: number): void {
    if (!this.container) return;

    const displayHeal = Math.floor(healAmount);
    const healElement = document.createElement('div');
    healElement.textContent = `+${displayHeal}`;
    healElement.style.cssText = `
      position: absolute;
      left: ${sprite.x + 35}px;
      top: ${sprite.y - 20}px;
      color: #44ff44;
      font-size: 20px;
      font-weight: bold;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000;
      pointer-events: none;
      z-index: 1000;
      animation: damageFloat 2s ease-out forwards;
    `;

    this.container.appendChild(healElement);

    setTimeout(() => {
      if (healElement.parentNode) {
        healElement.parentNode.removeChild(healElement);
      }
    }, 2000);
  }

  /**
   * Show MISS text above character when attack is dodged
   */
  private showMissText(sprite: CharacterSprite): void {
    if (!this.container) return;

    const missElement = document.createElement('div');
    missElement.textContent = 'MISS';
    missElement.style.cssText = `
      position: absolute;
      left: ${sprite.x + 35}px;
      top: ${sprite.y - 20}px;
      color: #ffffff;
      font-size: 20px;
      font-weight: bold;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000;
      pointer-events: none;
      z-index: 1000;
      animation: missFloat 2s ease-out forwards;
    `;

    // Add CSS animation if not already added
    if (!document.getElementById('miss-float-animation')) {
      const style = document.createElement('style');
      style.id = 'miss-float-animation';
      style.textContent = `
        @keyframes missFloat {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-25px) scale(1.2);
          }
          100% {
            opacity: 0;
            transform: translateY(-50px) scale(1);
          }
        }
      `;
      document.head.appendChild(style);
    }

    this.container.appendChild(missElement);

    // Remove after animation
    setTimeout(() => {
      if (missElement.parentNode) {
        missElement.parentNode.removeChild(missElement);
      }
    }, 2000);
  }

  /**
   * Handle character death
   * @param sprite The character that died
   * @param killerId Optional ID of the character that killed this one (for EXP distribution)
   */
  private handleDeath(sprite: CharacterSprite, killerId?: string): void {
    // Guard against double-death processing (e.g., multiple collisions in same frame)
    if (sprite.isDead || sprite.isInjured) return;
    
    if (sprite.character.type === 'Enemy') {
      // Enemy dies immediately and disappears
      sprite.isDead = true;
      
      // Generate loot drops
      if (this.lootSystem && (sprite.character as any).drops) {
        const drops = (sprite.character as any).drops as LootDrop[];
        const loot = this.lootSystem.generateLoot(sprite.character.id, drops, sprite.x, sprite.y);
        if (loot && this.onLootDroppedCallback) {
          this.onLootDroppedCallback(loot.id, loot.itemId, loot.x, loot.y);
        }
      }
      
      // Check if this is the boss
      const isBoss = sprite.id === this.bossId;
      
      // Increment kill counter
      this.totalKills++;
      
      // Increase crisis value by 5% for regular enemies (not boss)
      if (!isBoss && !this.bossSpawned) {
        this.crisisValue = Math.min(100, this.crisisValue + 5);
        console.log(`[BattleSystem] Crisis value increased to ${this.crisisValue}%`);
        
        // Check if crisis meter is full and spawn boss
        if (this.crisisValue >= 100 && !this.bossSpawned && this.onBossSpawnCallback) {
          this.bossSpawned = true;
          this.crisisValue = 0; // Reset to 0 while boss is alive
          console.log(`[BattleSystem] Crisis meter full! Spawning boss... Crisis reset to 0%`);
          this.onBossSpawnCallback();
        }
      }
      
      // If boss died, reset crisis meter
      if (isBoss) {
        console.log(`[BattleSystem] Boss defeated! Resetting crisis meter.`);
        this.crisisValue = 0;
        this.bossSpawned = false;
        this.bossId = null;
        
        // Award bonus EXP to all party members
        const bossLevel = sprite.character.level;
        const bossExp = 50 + bossLevel * 2;
        console.log(`[BattleSystem] Boss killed! Awarding ${bossExp} EXP to all party members`);
        
        if (this.partyMemberIds && this.partyMemberIds.length > 0 && this.onEnemyKilledCallback) {
          this.partyMemberIds.forEach(memberId => {
            try {
              this.onEnemyKilledCallback!(memberId, bossExp);
              console.log(`[BattleSystem] ✓ ${memberId} gained ${bossExp} boss EXP`);
            } catch (error) {
              console.error(`[BattleSystem] Error giving boss EXP to ${memberId}:`, error);
            }
          });
        }
      }
      
      // Show death firework effect at enemy position
      this.showDeathFirework(sprite.x + 35, sprite.y + 30);
      
      // Award EXP if killed by an adventurer (regular EXP system)
      if (killerId && this.onEnemyKilledCallback && !isBoss) {
        const enemyLevel = sprite.character.level;
        const baseExp = 10 + enemyLevel; // Base EXP = 10 + enemy level
        const bonusExp = Math.floor(baseExp * 0.5); // Killer gets 50% bonus
        
        console.log(`[BattleSystem] Enemy killed by ${killerId}, level ${enemyLevel}`);
        console.log(`[BattleSystem] Base EXP: ${baseExp}, Killer bonus: ${bonusExp}`);
        console.log(`[BattleSystem] Party members:`, this.partyMemberIds);
        
        // Give base EXP to all party members
        if (this.partyMemberIds && this.partyMemberIds.length > 0) {
          console.log(`[BattleSystem] Distributing EXP to ${this.partyMemberIds.length} party members`);
          this.partyMemberIds.forEach(memberId => {
            try {
              this.onEnemyKilledCallback!(memberId, baseExp);
              console.log(`[BattleSystem] ✓ ${memberId} gained ${baseExp} base EXP`);
            } catch (error) {
              console.error(`[BattleSystem] Error giving base EXP to ${memberId}:`, error);
            }
          });
          
          // Give bonus EXP to killer (50% extra)
          try {
            this.onEnemyKilledCallback(killerId, bonusExp);
            console.log(`[BattleSystem] ✓ ${killerId} gained ${bonusExp} bonus EXP (killer bonus)`);
          } catch (error) {
            console.error(`[BattleSystem] Error giving bonus EXP to killer:`, error);
          }
        } else {
          console.warn(`[BattleSystem] No party members found for EXP distribution`);
        }
        
        // Show EXP gain notification
        this.showExpGain(sprite, baseExp);
      }
      
      this.despawnCharacter(sprite.id);
      
      // Trigger enemy death callback with enemy character ID
      if (this.onEnemyDeathCallback) {
        const templateId = (sprite.character as any).templateId || sprite.character.id;
        this.onEnemyDeathCallback(templateId);
      }
      
      // Trigger stats update callback
      if (this.onStatsUpdateCallback) {
        this.onStatsUpdateCallback();
      }
      
      console.log(`[BattleSystem] Enemy ${sprite.character.name} died, total kills: ${this.totalKills}`);
    } else {
      // Adventurer gets injured status
      sprite.isInjured = true;
      sprite.reviveTime = Date.now() + 60000; // 60 seconds
      sprite.reviveCountdown = 60;

      // Hide sprite
      sprite.element.style.display = 'none';

      // Apply grayscale filter to avatar in party slots
      this.applyInjuredEffect(sprite);

      // Start countdown timer
      this.startReviveCountdown(sprite);

      // Trigger injured callback
      if (this.onCharacterInjuredCallback) {
        this.onCharacterInjuredCallback(sprite.character.id, sprite.reviveTime);
      }

      console.log(`[BattleSystem] Adventurer ${sprite.character.name} is injured, will revive in 60s`);
    }
  }

  /**
   * Show EXP gain notification above enemy
   */
  private showExpGain(sprite: CharacterSprite, exp: number): void {
    if (!this.container) return;

    const expElement = document.createElement('div');
    expElement.textContent = `+${exp} EXP`;
    expElement.style.cssText = `
      position: absolute;
      left: ${sprite.x + 35}px;
      top: ${sprite.y + 20}px;
      color: #ffd700;
      font-size: 16px;
      font-weight: bold;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000;
      pointer-events: none;
      z-index: 1000;
      animation: expFloat 2s ease-out forwards;
    `;

    // Add CSS animation if not already added
    if (!document.getElementById('exp-float-animation')) {
      const style = document.createElement('style');
      style.id = 'exp-float-animation';
      style.textContent = `
        @keyframes expFloat {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-30px);
          }
        }
      `;
      document.head.appendChild(style);
    }

    this.container.appendChild(expElement);

    // Remove after animation
    setTimeout(() => {
      if (expElement.parentNode) {
        expElement.parentNode.removeChild(expElement);
      }
    }, 2000);
  }

  /**
   * Apply injured visual effect to character
   */
  private applyInjuredEffect(sprite: CharacterSprite): void {
    // This will be handled by the UI system
    // Emit an event or update the character state
    console.log(`[BattleSystem] Applying injured effect to ${sprite.character.name}`);
  }

  /**
   * Start revive countdown for injured character
   */
  private startReviveCountdown(sprite: CharacterSprite): void {
    const countdownInterval = setInterval(() => {
      sprite.reviveCountdown--;
      
      if (sprite.reviveCountdown <= 0) {
        clearInterval(countdownInterval);
      }

      // Update UI countdown display
      console.log(`[BattleSystem] ${sprite.character.name} revives in ${sprite.reviveCountdown}s`);
    }, 1000);
  }

  /**
   * Revive an injured character
   */
  private reviveCharacter(sprite: CharacterSprite): void {
    // Restore full HP
    sprite.character.currentHP = sprite.character.maxHP;
    sprite.isInjured = false;
    sprite.isDead = false;

    // Respawn at random position away from enemies
    this.updateContainerBounds();
    const spriteWidth = 70;
    const spriteHeight = 100;

    // Get all enemy positions
    const enemyPositions: { x: number; y: number }[] = [];
    this.sprites.forEach((s) => {
      if (s.character.type === 'Enemy' && !s.isDead) {
        enemyPositions.push({ x: s.x, y: s.y });
      }
    });

    // Find position far from enemies
    let bestX = 0;
    let bestY = 0;
    let maxMinDistance = 0;
    const attempts = 20;

    for (let i = 0; i < attempts; i++) {
      const testX = Math.random() * (this.containerBounds.width - spriteWidth);
      const testY = Math.random() * (this.containerBounds.height - spriteHeight);

      let minDistance = Infinity;
      enemyPositions.forEach((enemyPos) => {
        const dx = testX - enemyPos.x;
        const dy = testY - enemyPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        minDistance = Math.min(minDistance, distance);
      });

      if (minDistance > maxMinDistance) {
        maxMinDistance = minDistance;
        bestX = testX;
        bestY = testY;
      }
    }

    sprite.x = bestX;
    sprite.y = bestY;

    // Generate new random velocity
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + sprite.character.moveSpeed;
    sprite.velocityX = Math.cos(angle) * speed;
    sprite.velocityY = Math.sin(angle) * speed;

    // Show sprite again
    sprite.element.style.display = '';
    sprite.element.style.transform = `translate(${sprite.x}px, ${sprite.y}px)`;

    // Remove injured effect
    this.removeInjuredEffect(sprite);

    // Trigger revived callback
    if (this.onCharacterRevivedCallback) {
      this.onCharacterRevivedCallback(sprite.character.id);
    }

    console.log(`[BattleSystem] ${sprite.character.name} revived at (${bestX.toFixed(0)}, ${bestY.toFixed(0)})`);
  }

  /**
   * Remove injured visual effect from character
   */
  private removeInjuredEffect(sprite: CharacterSprite): void {
    // This will be handled by the UI system
    console.log(`[BattleSystem] Removing injured effect from ${sprite.character.name}`);
  }

  /**
   * Create white hit effect at collision point
   */
  private createHitEffect(x: number, y: number): void {
    if (!this.container) return;

    // Create firework container
    const hitEffectContainer = document.createElement('div');
    hitEffectContainer.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 0;
      height: 0;
      pointer-events: none;
      z-index: 999;
    `;

    // Create multiple particles for hit effect (white firework) - larger and more visible
    const particleCount = 18;
    const colors = ['#ffffff', '#fff8e0', '#f0f0f0', '#ffe0a0'];
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.3;
      const distance = 35 + Math.random() * 30;
      const size = 5 + Math.random() * 6;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50%;
        box-shadow: 0 0 ${size * 3}px ${color}, 0 0 ${size * 6}px rgba(255,255,255,0.3);
        animation: hitEffectParticle 0.5s ease-out forwards;
        --angle: ${angle}rad;
        --distance: ${distance}px;
      `;
      
      hitEffectContainer.appendChild(particle);
    }

    // Add CSS animation if not already added
    if (!document.getElementById('hit-effect-particle-animation')) {
      const style = document.createElement('style');
      style.id = 'hit-effect-particle-animation';
      style.textContent = `
        @keyframes hitEffectParticle {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(
              calc(cos(var(--angle)) * var(--distance)),
              calc(sin(var(--angle)) * var(--distance))
            ) scale(0);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    this.container.appendChild(hitEffectContainer);

    // Remove after animation
    setTimeout(() => {
      if (hitEffectContainer.parentNode) {
        hitEffectContainer.parentNode.removeChild(hitEffectContainer);
      }
    }, 500);
  }

  /**
   * Show red firework explosion effect at death position
   */
  private showDeathFirework(x: number, y: number): void {
    if (!this.container) return;

    // Create firework container
    const fireworkContainer = document.createElement('div');
    fireworkContainer.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 0;
      height: 0;
      pointer-events: none;
      z-index: 1000;
    `;

    // Create multiple particles for firework effect
    const particleCount = 20;
    const colors = ['#ff0000', '#ff3333', '#ff6666', '#ff9999', '#cc0000'];
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      const angle = (Math.PI * 2 * i) / particleCount;
      const distance = (50 + Math.random() * 30) * 1.35; // Random distance 67.5-108px (35% larger)
      const size = (4 + Math.random() * 4) * 1.35; // Random size 5.4-10.8px (35% larger)
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50%;
        box-shadow: 0 0 ${size * 2}px ${color};
        animation: fireworkParticle 0.8s ease-out forwards;
        --angle: ${angle}rad;
        --distance: ${distance}px;
      `;
      
      fireworkContainer.appendChild(particle);
    }

    // Add CSS animation if not already added
    if (!document.getElementById('firework-particle-animation')) {
      const style = document.createElement('style');
      style.id = 'firework-particle-animation';
      style.textContent = `
        @keyframes fireworkParticle {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(
              calc(cos(var(--angle)) * var(--distance)),
              calc(sin(var(--angle)) * var(--distance))
            ) scale(0);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    this.container.appendChild(fireworkContainer);

    // Remove after animation
    setTimeout(() => {
      if (fireworkContainer.parentNode) {
        fireworkContainer.parentNode.removeChild(fireworkContainer);
      }
    }, 800);
  }

  /**
   * Apply visual effects for active buffs on a character in battle scene
   * Only updates when buff state changes to prevent performance issues
   */
  public applyBuffVisualEffects(characterId: string): void {
    if (!this.buffSystem) {
      return;
    }

    const sprite = this.sprites.get(characterId);
    if (!sprite) {
      return;
    }

    // Get current active buffs
    const activeBuffs = this.buffSystem.getActiveBuffs(characterId);
    const currentBuffIds = new Set(activeBuffs.map((b: any) => b.buffId));
    
    // Check if buff state has changed
    const previousBuffIds = this.characterBuffStates.get(characterId) || new Set();
    const buffsChanged = 
      currentBuffIds.size !== previousBuffIds.size ||
      Array.from(currentBuffIds).some(id => !previousBuffIds.has(id)) ||
      Array.from(previousBuffIds).some(id => !currentBuffIds.has(id));
    
    // Only update if buffs changed
    if (!buffsChanged) {
      return;
    }
    
    console.log(`[BattleSystem] Buffs changed for ${characterId}:`, Array.from(currentBuffIds));
    
    // Update stored state
    this.characterBuffStates.set(characterId, currentBuffIds);

    const avatarWrapper = sprite.element.querySelector('.battle-avatar-wrapper') as HTMLElement;
    const avatar = sprite.element.querySelector('.battle-character-sprite') as HTMLElement;
    const particleLayer = sprite.element.querySelector('.battle-particle-layer') as HTMLElement;
    
    if (!avatarWrapper || !avatar) {
      return;
    }

    // Clear ALL existing intervals for this character (but keep state tracking)
    // Clear strength particle interval
    const strengthInterval = this.buffEffectIntervals.get(`${characterId}-strength`);
    if (strengthInterval) {
      clearInterval(strengthInterval);
      this.buffEffectIntervals.delete(`${characterId}-strength`);
    }
    // Clear speed afterimage interval
    const speedInterval = this.buffEffectIntervals.get(`${characterId}-speed`);
    if (speedInterval) {
      clearInterval(speedInterval);
      this.buffEffectIntervals.delete(`${characterId}-speed`);
    }

    // Reset visual effects to default state
    avatar.style.filter = '';
    const baseBoxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
    avatar.style.boxShadow = baseBoxShadow;
    if (particleLayer) {
      particleLayer.innerHTML = '';
    }

    // Remove any existing speed buff overlays
    const existingOverlays = avatarWrapper.querySelectorAll('.speed-buff-overlay');
    existingOverlays.forEach(el => el.remove());

    // Remove any existing afterimage containers (legacy)
    const existingAfterimages = avatarWrapper.querySelectorAll('.battle-afterimage-container');
    existingAfterimages.forEach(el => el.remove());
    
    // Remove paralysis shake animation
    avatarWrapper.style.animation = '';
    avatarWrapper.classList.remove('paralysis-shake');

    // Remove any existing buff avatar overlays (e.g., hamster buff)
    avatarWrapper.querySelectorAll('.buff-avatar-overlay').forEach(el => el.remove());

    // If no buffs, we're done - everything is reset
    if (currentBuffIds.size === 0) {
      return;
    }

    const hasStrength = currentBuffIds.has('strength');
    const hasSpeed = currentBuffIds.has('speed');
    const hasHardening = currentBuffIds.has('hardening');
    const hasEnrage = currentBuffIds.has('enrage');
    const hasCharge = currentBuffIds.has('charge');
    const hasHunger = currentBuffIds.has('hunger');
    const hasExposedWeakness = currentBuffIds.has('exposed_weakness');

    // Hunger buff: Desaturated gray with reduced opacity (character looks weakened)
    // This should be applied first and combined with other effects
    let filterEffects: string[] = [];
    
    if (hasHunger) {
      filterEffects.push('grayscale(100%)');
      filterEffects.push('brightness(0.6)');
    }

    // Strength buff: Orange outer glow with screen blend mode
    if (hasStrength && !hasHunger) {
      filterEffects.push('drop-shadow(0 0 8px rgba(220, 50, 0, 0.9))');
      filterEffects.push('drop-shadow(0 0 16px rgba(180, 30, 0, 0.7))');
    }

    // Enrage buff: Red pulsing glow (overrides strength if both active)
    if (hasEnrage && !hasHunger) {
      filterEffects = []; // Clear previous effects
      filterEffects.push('drop-shadow(0 0 10px rgba(255, 0, 0, 0.9))');
      filterEffects.push('drop-shadow(0 0 20px rgba(200, 0, 0, 0.7))');
      filterEffects.push('brightness(1.15)');
    }
    
    // Apply combined filter effects
    if (filterEffects.length > 0) {
      avatar.style.filter = filterEffects.join(' ');
    }

    // Charge buff: Blue-white speed glow (but not if hunger is active)
    if (hasCharge && !hasHunger) {
      filterEffects = []; // Clear previous effects
      filterEffects.push('drop-shadow(0 0 8px rgba(100, 180, 255, 0.9))');
      filterEffects.push('drop-shadow(0 0 16px rgba(50, 120, 255, 0.7))');
      filterEffects.push('brightness(1.2)');
      avatar.style.filter = filterEffects.join(' ');
    }
    
    // Exposed Weakness buff: Pulsing hunt mark overlay
    if (hasExposedWeakness) {
      this.createExposedWeaknessEffect(avatarWrapper, sprite.size);
    }

    // Speed buff: Purple overlay with overlay blend mode
    if (hasSpeed) {
      const overlay = document.createElement('div');
      overlay.className = 'speed-buff-overlay';
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(75, 0, 130, 0.5);
        border-radius: 50%;
        mix-blend-mode: multiply;
        pointer-events: none;
        z-index: 3;
      `;
      avatarWrapper.appendChild(overlay);
    }

    // Hardening buff: Blue-gray thick outline
    if (hasHardening) {
      const outlineSize = Math.max(3, Math.floor(4 * sprite.size));
      avatar.style.boxShadow = `0 0 0 ${outlineSize}px #6b7c9e, ${baseBoxShadow}`;
    }
    
    // Paralysis buff: Rapid twitch/shake effect on avatar
    const hasParalysis = currentBuffIds.has('paralysis');
    if (hasParalysis) {
      // Inject keyframes if not already present
      if (!document.getElementById('paralysis-shake-keyframes')) {
        const style = document.createElement('style');
        style.id = 'paralysis-shake-keyframes';
        style.textContent = `
          @keyframes paralysis-shake {
            0% { transform: translate(0, 0); }
            10% { transform: translate(-2px, 1px); }
            20% { transform: translate(2px, -1px); }
            30% { transform: translate(-1px, -2px); }
            40% { transform: translate(1px, 2px); }
            50% { transform: translate(-2px, -1px); }
            60% { transform: translate(2px, 1px); }
            70% { transform: translate(1px, -2px); }
            80% { transform: translate(-1px, 2px); }
            90% { transform: translate(2px, -1px); }
            100% { transform: translate(0, 0); }
          }
        `;
        document.head.appendChild(style);
      }
      avatarWrapper.style.animation = 'paralysis-shake 0.15s infinite linear';
      avatarWrapper.classList.add('paralysis-shake');
      
      // Add yellow-electric tint
      if (!hasHunger) {
        filterEffects.push('drop-shadow(0 0 6px rgba(255, 220, 50, 0.7))');
        avatar.style.filter = filterEffects.join(' ');
      }
    }

    // Avatar override for buffs with avatarOverride (e.g., hamster)
    // Uses overlay approach: adds a cover image on top of the original avatar
    // When buff expires, the overlay is simply removed - no need to track original src
    
    // First, remove any existing avatar override overlays
    const existingOverlayImgs = avatarWrapper.querySelectorAll('.buff-avatar-overlay');
    existingOverlayImgs.forEach(el => el.remove());

    // Then add overlay for any active buff with avatarOverride
    for (const buffId of currentBuffIds) {
      const buffDef = this.buffSystem.getBuffDefinition(buffId);
      if (buffDef && (buffDef as any).avatarOverride) {
        const overrideImg = (buffDef as any).avatarOverride;
        const overlay = document.createElement('img');
        overlay.className = 'buff-avatar-overlay';
        overlay.src = overrideImg;
        overlay.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
          pointer-events: none;
          z-index: 4;
        `;
        avatarWrapper.appendChild(overlay);
        break; // Only one avatar override at a time
      }
    }
  }

  /**
   * Create orange particle burst effect for battle scene
   */
  private createBattleParticleBurst(container: HTMLElement, size: number): void {
    // Limit particles if container already has too many
    const existingParticles = container.children.length;
    if (existingParticles > 20) {
      return; // Skip this burst to prevent lag
    }

    const particleCount = 8;
    const baseSize = 60;
    const scaledSize = baseSize * size;
    const centerX = scaledSize / 2;
    const centerY = scaledSize / 2;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      const angle = (Math.PI * 2 * i) / particleCount;
      const distance = 40 * size;
      
      particle.style.cssText = `
        position: absolute;
        width: ${Math.floor(6 * size)}px;
        height: ${Math.floor(6 * size)}px;
        border-radius: 50%;
        background: radial-gradient(circle, #ff9500 0%, #ff6b00 100%);
        left: ${centerX}px;
        top: ${centerY}px;
        transform: translate(-50%, -50%);
        pointer-events: none;
        mix-blend-mode: screen;
        opacity: 0.8;
      `;

      container.appendChild(particle);

      const endX = centerX + Math.cos(angle) * distance;
      const endY = centerY + Math.sin(angle) * distance;

      particle.animate([
        { 
          left: `${centerX}px`, 
          top: `${centerY}px`,
          opacity: 0.8,
          transform: 'translate(-50%, -50%) scale(1)'
        },
        { 
          left: `${endX}px`, 
          top: `${endY}px`,
          opacity: 0,
          transform: 'translate(-50%, -50%) scale(0.3)'
        }
      ], {
        duration: 600,
        easing: 'ease-out'
      });

      setTimeout(() => {
        if (particle.parentNode) {
          particle.remove();
        }
      }, 600);
    }
  }

  /**
   * Apply purple-red afterimage effect for battle scene
   */
  private applyBattleAfterimageEffect(avatar: HTMLElement, characterId: string, size: number): void {
    const afterimageContainer = document.createElement('div');
    afterimageContainer.className = 'battle-afterimage-container';
    afterimageContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    `;

    if (avatar.parentElement) {
      avatar.parentElement.insertBefore(afterimageContainer, avatar);
    }

    const createAfterimage = () => {
      // Limit afterimages to prevent lag
      if (afterimageContainer.children.length > 3) {
        return; // Skip if too many afterimages
      }

      const afterimage = avatar.cloneNode(true) as HTMLElement;
      afterimage.style.cssText = avatar.style.cssText;
      afterimage.style.position = 'absolute';
      afterimage.style.top = '0';
      afterimage.style.left = '0';
      afterimage.style.zIndex = '1';
      afterimage.style.opacity = '0.4';
      afterimage.style.filter = 'none';
      afterimage.style.boxShadow = 'none';
      
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #c71585;
        border-radius: 50%;
        mix-blend-mode: multiply;
        pointer-events: none;
      `;
      afterimage.appendChild(overlay);

      afterimageContainer.appendChild(afterimage);

      afterimage.animate([
        { opacity: 0.4 },
        { opacity: 0 }
      ], {
        duration: 300,
        easing: 'ease-out'
      });

      setTimeout(() => {
        if (afterimage.parentNode) {
          afterimage.remove();
        }
      }, 300);
    };

    const afterimageInterval = window.setInterval(createAfterimage, 100);
    this.buffEffectIntervals.set(`${characterId}-speed`, afterimageInterval);
  }

  /**
   * Clear all buff visual effects for a character
   */
  public clearBuffVisualEffects(characterId: string): void {
    // Clear strength particle interval (no longer used but keep for compatibility)
    const strengthInterval = this.buffEffectIntervals.get(`${characterId}-strength`);
    if (strengthInterval) {
      clearInterval(strengthInterval);
      this.buffEffectIntervals.delete(`${characterId}-strength`);
    }

    // Clear speed afterimage interval (no longer used but keep for compatibility)
    const speedInterval = this.buffEffectIntervals.get(`${characterId}-speed`);
    if (speedInterval) {
      clearInterval(speedInterval);
      this.buffEffectIntervals.delete(`${characterId}-speed`);
    }

    // Remove buff state tracking
    this.characterBuffStates.delete(characterId);

    // Clean up DOM elements
    const sprite = this.sprites.get(characterId);
    if (sprite) {
      const avatarWrapper = sprite.element.querySelector('.battle-avatar-wrapper');
      if (avatarWrapper) {
        // Remove speed buff overlay
        const speedOverlay = avatarWrapper.querySelector('.speed-buff-overlay');
        if (speedOverlay) {
          speedOverlay.remove();
        }

        // Remove afterimage containers (legacy)
        const afterimageContainers = avatarWrapper.querySelectorAll('.battle-afterimage-container');
        afterimageContainers.forEach(el => el.remove());
        
        // Clear particle layer (legacy)
        const particleLayer = avatarWrapper.querySelector('.battle-particle-layer');
        if (particleLayer) {
          particleLayer.innerHTML = '';
        }
      }
    }
  }

  /**
   * Check if a circular aura overlaps with a character's collision box
   * @param auraCenterX X position of aura center
   * @param auraCenterY Y position of aura center
   * @param auraRadius Radius of the aura circle
   * @param targetSprite Target character sprite
   * @returns true if aura overlaps with character's collision box
   */
  private isAuraOverlappingCharacter(
    auraCenterX: number,
    auraCenterY: number,
    auraRadius: number,
    targetSprite: CharacterSprite
  ): boolean {
    // Character collision box dimensions
    const charWidth = 70;
    const charHeight = 100;
    
    // Character collision box center (sprite position + offset to center)
    const charCenterX = targetSprite.x + charWidth / 2;
    const charCenterY = targetSprite.y + charHeight / 2;
    
    // Find the closest point on the character's collision box to the aura center
    const closestX = Math.max(targetSprite.x, Math.min(auraCenterX, targetSprite.x + charWidth));
    const closestY = Math.max(targetSprite.y, Math.min(auraCenterY, targetSprite.y + charHeight));
    
    // Calculate distance from aura center to closest point
    const dx = auraCenterX - closestX;
    const dy = auraCenterY - closestY;
    const distanceSquared = dx * dx + dy * dy;
    
    // Check if distance is less than radius (overlap detected)
    return distanceSquared <= (auraRadius * auraRadius);
  }

  /**
   * Update death aura effects - apply periodic damage to nearby characters
   */
  private updateDeathAura(sprite: CharacterSprite, currentTime: number): void {
    // Check if character has death_aura master skill
    if (sprite.character.masterSkill !== 'death_aura') return;

    // Get skill data
    const skillData = this.npcSystem.getJobExclusiveSkill('death_aura');
    if (!skillData || !skillData.effects || skillData.effects.length === 0) return;

    const effect = skillData.effects[0];
    const interval = effect.interval || 500; // Default 500ms
    const timeSinceLastDamage = currentTime - sprite.lastAuraDamageTime;

    // Check if enough time has passed since last damage tick
    if (timeSinceLastDamage < interval) return;

    // Update last damage time
    sprite.lastAuraDamageTime = currentTime;

    const radius = effect.radius || 150;
    const damagePercent = effect.damagePercent || 0.01;
    const excludeSelf = effect.excludeSelf !== false;
    const affectAllies = effect.affectAllies !== false;
    const affectEnemies = effect.affectEnemies !== false;

    // Aura center position (sprite center)
    const auraCenterX = sprite.x + 35; // 70/2
    const auraCenterY = sprite.y + 50; // 100/2

    // Find all characters whose collision box overlaps with aura
    this.sprites.forEach((targetSprite) => {
      // Skip self if excludeSelf is true
      if (excludeSelf && targetSprite.id === sprite.id) return;

      // Skip dead or injured characters
      if (targetSprite.isDead || targetSprite.isInjured) return;

      // Check if target is ally or enemy
      const isAlly = 
        (sprite.character.type === 'Enemy' && targetSprite.character.type === 'Enemy') ||
        (sprite.character.type !== 'Enemy' && targetSprite.character.type !== 'Enemy');

      // Skip if we shouldn't affect this type
      if (isAlly && !affectAllies) return;
      if (!isAlly && !affectEnemies) return;

      // Check if aura overlaps with target's collision box
      if (this.isAuraOverlappingCharacter(auraCenterX, auraCenterY, radius, targetSprite)) {
        const damage = Math.ceil(targetSprite.character.maxHP * damagePercent);
        const damageResult = this.applyDamageWithShield(targetSprite, damage, sprite.character);
        this.showDamageNumber(targetSprite, damageResult.damage, sprite.character.type !== 'Enemy', damageResult.isCritical);
        
        // Show blood splash effect on target
        this.showBloodSplashEffect(targetSprite);
      }
    });
  }

  /**
   * Update death aura circle visual - creates persistent aura that follows the character
   */
  private updateDeathAuraCircle(sprite: CharacterSprite): void {
    if (!this.container) return;
    if (sprite.character.masterSkill !== 'death_aura') return;
    
    // Get skill data for radius
    const skillData = this.npcSystem.getJobExclusiveSkill('death_aura');
    if (!skillData || !skillData.effects || skillData.effects.length === 0) return;
    
    const effect = skillData.effects[0];
    const radius = effect.radius || 150;
    
    // Check if circle already exists for this sprite
    if (sprite.auraCircle) {
      // Update position to follow the sprite
      sprite.auraCircle.style.left = `${sprite.x + 35 - radius}px`;
      sprite.auraCircle.style.top = `${sprite.y + 50 - radius}px`;
    } else {
      // Create new circle only once
      const circle = document.createElement('div');
      circle.className = 'death-aura-circle';
      circle.style.cssText = `
        position: absolute;
        left: ${sprite.x + 35 - radius}px;
        top: ${sprite.y + 50 - radius}px;
        width: ${radius * 2}px;
        height: ${radius * 2}px;
        border: 2px solid rgba(139, 0, 0, 0.2);
        border-radius: 50%;
        background: radial-gradient(circle, rgba(139, 0, 0, 0.025) 0%, transparent 70%);
        pointer-events: none;
        z-index: 1;
        animation: death-aura-pulse 2s ease-in-out infinite;
      `;
      
      this.container.appendChild(circle);
      
      // Store reference to circle in sprite
      sprite.auraCircle = circle;
    }
  }

  /**
   * Show death aura visual effect (red circle) - creates persistent aura that follows the character
   */
  private showDeathAuraVisual(sprite: CharacterSprite, radius: number): void {
    if (!this.container) return;

    // Check if aura circle already exists for this sprite
    if (sprite.auraCircle) {
      // Update position to follow the sprite
      sprite.auraCircle.style.left = `${sprite.x - radius + 35}px`;
      sprite.auraCircle.style.top = `${sprite.y - radius + 50}px`;
    } else {
      // Create persistent aura circle element only once
      const auraCircle = document.createElement('div');
      auraCircle.className = 'death-aura-circle';
      auraCircle.style.cssText = `
        position: absolute;
        left: ${sprite.x - radius + 35}px;
        top: ${sprite.y - radius + 50}px;
        width: ${radius * 2}px;
        height: ${radius * 2}px;
        border: 2px solid rgba(139, 0, 0, 0.4);
        border-radius: 50%;
        background: radial-gradient(circle, rgba(139, 0, 0, 0.05) 0%, transparent 70%);
        pointer-events: none;
        z-index: 1;
        animation: death-aura-pulse 2s ease-in-out infinite;
      `;

      this.container.appendChild(auraCircle);
      
      // Store reference to circle in sprite
      sprite.auraCircle = auraCircle;
    }
  }

  /**
   * Show blood splash effect on character's avatar
   */
  private showBloodSplashEffect(sprite: CharacterSprite): void {
    // Find the sprite container within the element
    const spriteElement = sprite.element.querySelector('.battle-character-sprite') as HTMLElement;
    if (!spriteElement) {
      console.warn('[BattleSystem] Could not find sprite element for blood splash effect');
      return;
    }

    // Create blood splash element
    const bloodSplash = document.createElement('div');
    bloodSplash.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(139, 0, 0, 0.9) 0%, rgba(139, 0, 0, 0.7) 30%, rgba(139, 0, 0, 0.4) 60%, transparent 100%);
      pointer-events: none;
      z-index: 100;
      animation: blood-splash 0.6s ease-out;
    `;

    spriteElement.appendChild(bloodSplash);

    // Remove after animation
    setTimeout(() => {
      if (bloodSplash.parentNode) {
        bloodSplash.parentNode.removeChild(bloodSplash);
      }
    }, 600);
  }

  /**
   * Update hunt master skill - apply exposed_weakness debuff to random enemy every 10 seconds
   */
  private updateHunt(sprite: CharacterSprite, currentTime: number): void {
    // Check if character has hunt master skill
    if (sprite.character.masterSkill !== 'hunt') return;

    // Get skill data
    const skillData = this.npcSystem.getJobExclusiveSkill('hunt');
    if (!skillData || !skillData.effects || skillData.effects.length === 0) return;

    const effect = skillData.effects[0];
    const interval = effect.interval || 10000; // Default 10 seconds
    const timeSinceLastHunt = currentTime - sprite.lastHuntTime;

    // Check if enough time has passed since last hunt
    if (timeSinceLastHunt < interval) return;

    // Update last hunt time
    sprite.lastHuntTime = currentTime;

    // Find all enemy sprites
    const enemies: CharacterSprite[] = [];
    this.sprites.forEach((targetSprite) => {
      if (targetSprite.isDead || targetSprite.isInjured) return;
      
      // Check if target is enemy (opposite faction)
      const isEnemy = 
        (sprite.character.type === 'Enemy' && targetSprite.character.type !== 'Enemy') ||
        (sprite.character.type !== 'Enemy' && targetSprite.character.type === 'Enemy');
      
      if (isEnemy) {
        enemies.push(targetSprite);
      }
    });

    // If no enemies, return
    if (enemies.length === 0) return;

    // Pick a random enemy
    const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];

    // Apply exposed_weakness buff
    if (this.buffSystem) {
      const buffId = effect.buffId || 'exposed_weakness';
      const duration = effect.duration || 10000;
      this.buffSystem.applyBuff(randomEnemy.character.id, buffId, duration);
      console.log(`[BattleSystem] Hunt: Applied ${buffId} to ${randomEnemy.character.name}`);
    }
  }

  /**
   * Handle phantom_step master skill - teleport to safe position after collision
   */
  private handlePhantomStep(sprite: CharacterSprite): void {
    if (!this.container) return;

    // Get skill data
    const skillData = this.npcSystem.getJobExclusiveSkill('phantom_step');
    if (!skillData || !skillData.effects || skillData.effects.length === 0) return;

    const effect = skillData.effects[0];
    const minDistance = effect.minDistance || 200;

    // Get all enemy positions
    const enemyPositions: { x: number; y: number }[] = [];
    this.sprites.forEach((targetSprite) => {
      if (targetSprite.isDead || targetSprite.isInjured) return;
      
      // Check if target is enemy (opposite faction)
      const isEnemy = 
        (sprite.character.type === 'Enemy' && targetSprite.character.type !== 'Enemy') ||
        (sprite.character.type !== 'Enemy' && targetSprite.character.type === 'Enemy');
      
      if (isEnemy) {
        enemyPositions.push({ x: targetSprite.x, y: targetSprite.y });
      }
    });

    // Find a safe position far from all enemies
    this.updateContainerBounds();
    const spriteWidth = 70;
    const spriteHeight = 100;
    let bestX = sprite.x;
    let bestY = sprite.y;
    let maxMinDistance = 0;
    const attempts = 20;

    for (let i = 0; i < attempts; i++) {
      const testX = Math.random() * (this.containerBounds.width - spriteWidth);
      const testY = Math.random() * (this.containerBounds.height - spriteHeight);

      // Calculate minimum distance to any enemy
      let minDist = Infinity;
      enemyPositions.forEach((enemyPos) => {
        const dx = testX - enemyPos.x;
        const dy = testY - enemyPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        minDist = Math.min(minDist, distance);
      });

      // Keep the position with the maximum minimum distance
      if (minDist > maxMinDistance) {
        maxMinDistance = minDist;
        bestX = testX;
        bestY = testY;
      }
    }

    // Only teleport if we found a position at least minDistance away
    if (maxMinDistance >= minDistance) {
      // Create teleport visual effect at old position
      this.createTeleportEffect(sprite.x, sprite.y);
      
      // Teleport sprite
      sprite.x = bestX;
      sprite.y = bestY;
      sprite.element.style.transform = `translate(${bestX}px, ${bestY}px)`;
      
      // Create teleport visual effect at new position
      this.createTeleportEffect(bestX, bestY);
      
      console.log(`[BattleSystem] Phantom Step: Teleported ${sprite.character.name} ${maxMinDistance.toFixed(0)}px away from enemies`);
    }
  }

  /**
   * Create teleport visual effect
   */
  private createTeleportEffect(x: number, y: number): void {
    if (!this.container) return;

    const effect = document.createElement('div');
    effect.style.cssText = `
      position: absolute;
      left: ${x + 35}px;
      top: ${y + 50}px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(138, 43, 226, 0.8) 0%, rgba(138, 43, 226, 0.4) 50%, transparent 100%);
      border: 2px solid rgba(138, 43, 226, 0.6);
      pointer-events: none;
      z-index: 50;
      animation: teleport-flash 0.5s ease-out;
      transform: translate(-50%, -50%);
    `;

    this.container.appendChild(effect);

    setTimeout(() => {
      if (effect.parentNode) {
        effect.parentNode.removeChild(effect);
      }
    }, 500);
  }

  /**
   * Check divine_proclamation master skill - nullify damage with probability
   * Returns true if damage was nullified
   */
  private checkDivineProclamation(sprite: CharacterSprite, damage: number): boolean {
    // Find all allies with divine_proclamation within radius
    const allies: CharacterSprite[] = [];
    this.sprites.forEach((allySprite) => {
      if (allySprite.isDead || allySprite.isInjured) return;
      if (allySprite.character.masterSkill !== 'divine_proclamation') return;
      
      // Check if sprite is ally of the damaged character
      const isAlly = 
        (sprite.character.type === 'Enemy' && allySprite.character.type === 'Enemy') ||
        (sprite.character.type !== 'Enemy' && allySprite.character.type !== 'Enemy');
      
      if (!isAlly) return;
      
      // Get skill data
      const skillData = this.npcSystem.getJobExclusiveSkill('divine_proclamation');
      if (!skillData || !skillData.effects || skillData.effects.length === 0) return;
      
      const effect = skillData.effects[0];
      const radius = effect.radius || 150;
      const excludeSelf = effect.excludeSelf !== false;
      
      // Skip self if excludeSelf is true
      if (excludeSelf && allySprite.id === sprite.id) return;
      
      // Aura center position (ally sprite center)
      const auraCenterX = allySprite.x + 35; // 70/2
      const auraCenterY = allySprite.y + 50; // 100/2
      
      // Check if aura overlaps with damaged character's collision box
      if (this.isAuraOverlappingCharacter(auraCenterX, auraCenterY, radius, sprite)) {
        allies.push(allySprite);
      }
    });
    
    // If no allies with divine_proclamation nearby, return false
    if (allies.length === 0) return false;
    
    // Check each ally's divine_proclamation for damage nullification
    for (const ally of allies) {
      const skillData = this.npcSystem.getJobExclusiveSkill('divine_proclamation');
      if (!skillData || !skillData.effects || skillData.effects.length === 0) continue;
      
      const effect = skillData.effects[0];
      const probability = effect.probability || 0.1;
      
      // Roll for nullification
      if (Math.random() < probability) {
        // Damage nullified!
        this.showDivineProtectionEffect(sprite);
        console.log(`[BattleSystem] Divine Proclamation: ${ally.character.name} nullified ${damage} damage to ${sprite.character.name}`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Update divine proclamation protection circle visual
   */
  private updateDivineProtectionCircle(sprite: CharacterSprite): void {
    if (!this.container) return;
    if (sprite.character.masterSkill !== 'divine_proclamation') return;
    
    // Get skill data for radius
    const skillData = this.npcSystem.getJobExclusiveSkill('divine_proclamation');
    if (!skillData || !skillData.effects || skillData.effects.length === 0) return;
    
    const effect = skillData.effects[0];
    const radius = effect.radius || 150;
    
    // Check if circle already exists for this sprite
    if (sprite.auraCircle) {
      // Update position to follow the sprite
      sprite.auraCircle.style.left = `${sprite.x + 35 - radius}px`;
      sprite.auraCircle.style.top = `${sprite.y + 50 - radius}px`;
    } else {
      // Create new circle only once
      const circle = document.createElement('div');
      circle.className = 'divine-protection-circle';
      circle.style.cssText = `
        position: absolute;
        left: ${sprite.x + 35 - radius}px;
        top: ${sprite.y + 50 - radius}px;
        width: ${radius * 2}px;
        height: ${radius * 2}px;
        border: 2px solid rgba(255, 215, 0, 0.4);
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 215, 0, 0.05) 0%, transparent 70%);
        pointer-events: none;
        z-index: 1;
        animation: divine-circle-pulse 2s ease-in-out infinite;
      `;
      
      this.container.appendChild(circle);
      
      // Store reference to circle in sprite
      sprite.auraCircle = circle;
    }
  }

  /**
   * Show divine protection visual effect
   */
  private showDivineProtectionEffect(sprite: CharacterSprite): void {
    if (!this.container) return;

    // Show "神佑" text
    const effect = document.createElement('div');
    effect.textContent = '神佑';
    effect.style.cssText = `
      position: absolute;
      left: ${sprite.x + 35}px;
      top: ${sprite.y + 20}px;
      font-size: 24px;
      font-weight: bold;
      color: #FFD700;
      text-shadow: 
        -1px -1px 0 #FFF,
        1px -1px 0 #FFF,
        -1px 1px 0 #FFF,
        1px 1px 0 #FFF,
        0 0 10px rgba(255, 215, 0, 0.8);
      pointer-events: none;
      z-index: 100;
      animation: divine-protection 1s ease-out;
      transform: translateX(-50%);
    `;

    this.container.appendChild(effect);

    setTimeout(() => {
      if (effect.parentNode) {
        effect.parentNode.removeChild(effect);
      }
    }, 1000);
    
    // Show golden flash effect on the protected character
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: absolute;
      left: ${sprite.x}px;
      top: ${sprite.y}px;
      width: 70px;
      height: 100px;
      background: radial-gradient(circle, rgba(255, 215, 0, 0.6) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 99;
      animation: divine-flash 0.6s ease-out;
    `;
    
    this.container.appendChild(flash);
    
    setTimeout(() => {
      if (flash.parentNode) {
        flash.parentNode.removeChild(flash);
      }
    }, 600);
  }

  /**
   * Handle mana_burst master skill - restore MP with probability after casting
   */
  private handleManaBurst(caster: CharacterSprite): void {
    if (caster.character.masterSkill !== 'mana_burst') return;

    // Get skill data
    const skillData = this.npcSystem.getJobExclusiveSkill('mana_burst');
    if (!skillData || !skillData.effects || skillData.effects.length === 0) return;

    const effect = skillData.effects[0];
    const probability = effect.probability || 0.5;
    const manaRestore = effect.manaRestore || 20;

    // Roll for mana restoration
    if (Math.random() < probability) {
      caster.character.currentMP = Math.min(
        caster.character.maxMP,
        caster.character.currentMP + manaRestore
      );
      
      // Show visual effect
      this.showManaBurstEffect(caster);
      console.log(`[BattleSystem] Mana Burst: Restored ${manaRestore} MP to ${caster.character.name}`);
    }
  }

  /**
   * Show mana burst visual effect
   */
  private showManaBurstEffect(sprite: CharacterSprite): void {
    if (!this.container) return;

    const effect = document.createElement('div');
    effect.textContent = '+MP';
    effect.style.cssText = `
      position: absolute;
      left: ${sprite.x + 35}px;
      top: ${sprite.y + 20}px;
      font-size: 20px;
      font-weight: bold;
      color: #2196F3;
      text-shadow: 
        -1px -1px 0 #FFF,
        1px -1px 0 #FFF,
        -1px 1px 0 #FFF,
        1px 1px 0 #FFF,
        0 0 8px rgba(33, 150, 243, 0.8);
      pointer-events: none;
      z-index: 100;
      animation: mana-burst 1s ease-out;
      transform: translateX(-50%);
    `;

    this.container.appendChild(effect);

    setTimeout(() => {
      if (effect.parentNode) {
        effect.parentNode.removeChild(effect);
      }
    }, 1000);
  }

  /**
   * Check if a skill has a specific tag (supports both "tag" string and "tags" array formats)
   * This is the canonical way to check skill tags across all skill types.
   */
  private skillHasTag(skillData: any, tagName: string): boolean {
    if (!skillData) return false;
    // Check "tag" field (string, used by regular active skills)
    if (skillData.tag === tagName) return true;
    // Check "tags" field (array, used by exclusive skills)
    if (Array.isArray(skillData.tags) && skillData.tags.includes(tagName)) return true;
    return false;
  }

  /**
   * Handle double_pupil master skill - cast skill again on random target (excluding first target)
   */
  private handleDoublePupil(caster: CharacterSprite, skillData: any, firstTargetId?: string): void {
    if (caster.character.masterSkill !== 'double_pupil') return;

    // Get master skill data
    const masterSkillData = this.npcSystem.getJobExclusiveSkill('double_pupil');
    if (!masterSkillData || !masterSkillData.effects || masterSkillData.effects.length === 0) return;

    const effect = masterSkillData.effects[0];
    const delay = effect.delay || 300;

    // Check if the skill has "单体目标" tag (works for all skill formats)
    if (!this.skillHasTag(skillData, '单体目标') && !this.skillHasTag(skillData, 'single_target')) {
      return;
    }

    // Find potential targets (enemy for offensive skills, ally for support skills)
    const potentialTargets: CharacterSprite[] = [];
    // Determine if skill is offensive by checking if it targets enemies
    const isOffensive = skillData.effects?.some((e: any) => 
      e.type === 'spawn_projectile' || e.type === 'spawn_orbit' || 
      e.type === 'charge_enemy' || e.type === 'buff_enemy' || e.damage
    );
    
    this.sprites.forEach((targetSprite) => {
      if (targetSprite.isDead || targetSprite.isInjured) return;
      if (targetSprite.id === caster.id) return; // Exclude self
      if (firstTargetId && targetSprite.id === firstTargetId) return; // Exclude first target
      
      const isEnemy = 
        (caster.character.type === 'Enemy' && targetSprite.character.type !== 'Enemy') ||
        (caster.character.type !== 'Enemy' && targetSprite.character.type === 'Enemy');
      
      const isAlly = !isEnemy;
      
      if (isOffensive && isEnemy) {
        potentialTargets.push(targetSprite);
      } else if (!isOffensive && isAlly) {
        potentialTargets.push(targetSprite);
      }
    });

    // If only 1 or fewer targets available (excluding first target), don't trigger
    if (potentialTargets.length === 0) {
      console.log(`[BattleSystem] Double Pupil: No alternative targets available, skill not repeated`);
      return;
    }

    // Delay the second cast
    setTimeout(() => {
      // Pick random target from remaining targets
      const randomTarget = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
      
      // Show double pupil visual effect
      this.showDoublePupilEffect(caster);
      
      // Cast skill effects again (without consuming MP)
      console.log(`[BattleSystem] Double Pupil: ${caster.character.name} casting ${skillData.name} again on ${randomTarget.character.name}`);
      
      if (skillData.effects && Array.isArray(skillData.effects)) {
        skillData.effects.forEach((skillEffect: any) => {
          this.applySkillEffect(caster, skillEffect, skillData, randomTarget.id);
        });
      }
    }, delay);
  }

  /**
   * Show double pupil visual effect
   */
  private showDoublePupilEffect(sprite: CharacterSprite): void {
    if (!this.container) return;

    const effect = document.createElement('div');
    effect.textContent = '双瞳';
    effect.style.cssText = `
      position: absolute;
      left: ${sprite.x + 35}px;
      top: ${sprite.y + 20}px;
      font-size: 20px;
      font-weight: bold;
      color: #9C27B0;
      text-shadow: 
        -1px -1px 0 #FFF,
        1px -1px 0 #FFF,
        -1px 1px 0 #FFF,
        1px 1px 0 #FFF,
        0 0 8px rgba(156, 39, 176, 0.8);
      pointer-events: none;
      z-index: 100;
      animation: double-pupil 0.8s ease-out;
      transform: translateX(-50%);
    `;

    this.container.appendChild(effect);

    setTimeout(() => {
      if (effect.parentNode) {
        effect.parentNode.removeChild(effect);
      }
    }, 800);
  }

  /**
   * Create exposed weakness visual effect (pulsing hunt mark)
   */
  private createExposedWeaknessEffect(avatarWrapper: HTMLElement, size: number): void {
    // Remove any existing exposed weakness effect
    const existing = avatarWrapper.querySelector('.exposed-weakness-mark');
    if (existing) {
      existing.remove();
    }

    // Create hunt mark overlay
    const markOverlay = document.createElement('div');
    markOverlay.className = 'exposed-weakness-mark';
    
    const baseSize = 60;
    const scaledSize = baseSize * size;
    const markSize = Math.floor(scaledSize * 1.73); // 173% of avatar size (116% larger than original)
    
    markOverlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: ${markSize}px;
      height: ${markSize}px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 10;
      animation: hunt-mark-pulse 2s ease-in-out infinite;
    `;

    // Create image element
    const markImage = document.createElement('img');
    markImage.src = 'images/texiao_liesha.png';
    markImage.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
    `;

    markOverlay.appendChild(markImage);
    avatarWrapper.appendChild(markOverlay);
  }
}


