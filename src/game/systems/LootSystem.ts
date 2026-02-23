/**
 * Loot System - Manages item drops from enemies
 */

import { System } from '../../ecs/System';
import { World } from '../../ecs/World';

export interface LootDrop {
  itemId: string;
  quantity: number;
  chance: number;
}

export interface DroppedLoot {
  id: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  spawnTime: number;
  autoPickupTime: number; // Time when it will be auto-picked up (5 seconds after spawn)
}

export class LootSystem extends System {
  public readonly name = 'LootSystem';
  public readonly requiredComponents: any[] = [];

  private droppedLoots: Map<string, DroppedLoot> = new Map();
  private lootInventory: Map<string, number> = new Map(); // Loot panel inventory
  private teamBagInventory: Map<string, number> = new Map(); // Team bag inventory (separate from global inventory)
  private lootCounter: number = 0;
  private maxWeightCapacity: number = 0;

  constructor(world: World) {
    super(world);
  }

  /**
   * Generate loot drops from enemy
   */
  public generateLoot(enemyId: string, drops: LootDrop[], x: number, y: number): DroppedLoot | null {
    if (!drops || drops.length === 0) return null;

    // Roll for each drop
    for (const drop of drops) {
      const roll = Math.random();
      if (roll <= drop.chance) {
        // Drop this item
        const lootId = `loot_${this.lootCounter++}_${Date.now()}`;
        const now = Date.now();
        const droppedLoot: DroppedLoot = {
          id: lootId,
          itemId: drop.itemId,
          quantity: drop.quantity,
          x,
          y,
          spawnTime: now,
          autoPickupTime: now + 5000 // Auto-pickup after 5 seconds
        };

        this.droppedLoots.set(lootId, droppedLoot);
        console.log(`[LootSystem] Generated loot: ${drop.itemId} x${drop.quantity} at (${x}, ${y})`);
        return droppedLoot;
      }
    }

    return null;
  }

  /**
   * Pick up a dropped loot (manual pickup)
   */
  public pickupLoot(lootId: string): boolean {
    const loot = this.droppedLoots.get(lootId);
    if (!loot) return false;

    // Add to loot inventory
    const currentAmount = this.lootInventory.get(loot.itemId) || 0;
    this.lootInventory.set(loot.itemId, currentAmount + loot.quantity);

    // Remove from dropped loots
    this.droppedLoots.delete(lootId);

    console.log(`[LootSystem] Picked up: ${loot.itemId} x${loot.quantity}`);
    return true;
  }

  /**
   * Check for auto-pickup (called every frame)
   */
  public update(deltaTime: number): void {
    const now = Date.now();
    const lootsToPickup: string[] = [];

    // Check which loots should be auto-picked up
    this.droppedLoots.forEach((loot, lootId) => {
      if (now >= loot.autoPickupTime) {
        lootsToPickup.push(lootId);
      }
    });

    // Auto-pickup expired loots
    lootsToPickup.forEach(lootId => {
      this.pickupLoot(lootId);
    });
  }

  /**
   * Get all dropped loots in the scene
   */
  public getDroppedLoots(): DroppedLoot[] {
    return Array.from(this.droppedLoots.values());
  }

  /**
   * Get loot inventory (for loot panel)
   */
  public getLootInventory(): Map<string, number> {
    return this.lootInventory;
  }

  /**
   * Transfer item from loot inventory to team bag inventory
   */
  public transferToTeamInventory(itemId: string, quantity: number): boolean {
    const currentAmount = this.lootInventory.get(itemId) || 0;
    if (currentAmount < quantity) return false;

    // Remove from loot inventory
    const newAmount = currentAmount - quantity;
    if (newAmount === 0) {
      this.lootInventory.delete(itemId);
    } else {
      this.lootInventory.set(itemId, newAmount);
    }

    // Add to team bag inventory
    const teamBagAmount = this.teamBagInventory.get(itemId) || 0;
    this.teamBagInventory.set(itemId, teamBagAmount + quantity);

    return true;
  }

  /**
   * Get team bag inventory
   */
  public getTeamBagInventory(): Map<string, number> {
    return this.teamBagInventory;
  }

  /**
   * Get total weight of items in team bag
   */
  public getTeamBagWeight(): number {
    let totalWeight = 0;
    this.teamBagInventory.forEach((quantity) => {
      // Items don't currently have weight, default to 1 per item
      totalWeight += quantity;
    });
    return totalWeight;
  }

  /**
   * Get max weight capacity for team bag
   */
  public getTeamBagMaxWeight(): number {
    return this.maxWeightCapacity;
  }

  /**
   * Set max weight capacity for team bag (sum of party members' carryWeight)
   */
  public setTeamBagMaxWeight(weight: number): void {
    this.maxWeightCapacity = weight;
  }

  /**
   * Add item to team bag inventory
   */
  public addToTeamBag(itemId: string, quantity: number): void {
    const current = this.teamBagInventory.get(itemId) || 0;
    this.teamBagInventory.set(itemId, current + quantity);
  }

  /**
   * Remove item from team bag inventory
   */
  public removeFromTeamBag(itemId: string, quantity: number): boolean {
    const current = this.teamBagInventory.get(itemId) || 0;
    if (current < quantity) return false;
    const newAmount = current - quantity;
    if (newAmount === 0) {
      this.teamBagInventory.delete(itemId);
    } else {
      this.teamBagInventory.set(itemId, newAmount);
    }
    return true;
  }


  /**
   * Clear all loot (e.g., when leaving battle)
   */
  public clearAllLoot(): void {
    this.droppedLoots.clear();
    this.lootInventory.clear();
  }
}
