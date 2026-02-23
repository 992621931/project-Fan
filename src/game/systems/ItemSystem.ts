/**
 * Item System - Manages game items and inventory
 */

import { System } from '../../ecs/System';
import { World } from '../../ecs/World';
import itemPrefabsData from '../data/item-prefabs.json';
import itemsData from '../data/items.json';

export interface ItemStat {
  attribute: string;
  value: number;
  type: 'flat' | 'percentage';
}

export interface ItemEffect {
  type: string;
  attribute?: string;
  value?: number;
  duration?: number;
}

export interface CraftRecipe {
  materials: Array<{
    itemId: string;
    quantity: number;
  }>;
  requiredLevel?: number;
  requiredSkill?: string;
}

export interface ItemData {
  id: string;
  name: string;
  description: string;
  type: 'equipment' | 'book' | 'material' | 'consumable' | 'food' | 'seed' | 'potion';
  subType?: string | string[];
  icon: string;
  rarity: number; // 0=common, 1=rare, 2=mythic, 3=legendary
  stackSize: number;
  weight?: number; // Item weight for inventory management
  
  // Equipment specific
  mainStat?: ItemStat;
  subStats?: ItemStat[];
  equipmentSlot?: string;
  
  // Skill book specific
  skillId?: string;
  
  // Food/Consumable specific
  hungerRestore?: number;

  // Buff reference (for potions that apply buffs)
  buffId?: string;
  
  // Effects
  effects?: ItemEffect[];
  
  // Economy
  canSell: boolean;
  canBuy: boolean;
  buyPrice: number;
  
  // Crafting
  canCraft: boolean;
  craftRecipe: CraftRecipe | null;
  
  // Usage
  canUse: boolean;
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
  instanceId?: string; // Optional unique instance ID for non-stackable items
  instanceData?: any; // Optional instance-specific data (e.g., equipment stats)
}

export class ItemSystem extends System {
  public readonly name = 'ItemSystem';
  public readonly requiredComponents: any[] = [];
  
  private itemDatabase: Map<string, ItemData> = new Map();
  private playerInventory: Map<string, number> = new Map(); // itemId -> quantity (for stackable items)
  private itemInstances: Map<string, InventorySlot> = new Map(); // instanceId -> item instance (for non-stackable items)
  
  constructor(world: World) {
    super();
    this.loadItems();
  }

  /**
   * Load items from JSON data
   */
  private loadItems(): void {
    try {
      // Load from item-prefabs.json
      const prefabItems = itemPrefabsData.items || [];
      prefabItems.forEach((item: any) => {
        // Extract hungerRestore from effects array if present
        if (item.type === 'food' && !item.hungerRestore && Array.isArray(item.effects)) {
          const hungerEffect = item.effects.find((e: any) => e.type === 'hunger');
          if (hungerEffect) {
            item.hungerRestore = hungerEffect.value;
            item.effects = `饱腹度+${hungerEffect.value}`;
          }
        }
        this.itemDatabase.set(item.id, item as ItemData);
      });
      
      console.log(`[ItemSystem] Loaded ${this.itemDatabase.size} items from item-prefabs.json`);
      
      // Also load from items.json for cooking materials and dishes
      this.loadAdditionalItems();
    } catch (error) {
      console.error('[ItemSystem] Failed to load items:', error);
    }
  }

  /**
   * Load additional items from items.json (cooking materials and dishes)
   */
  private loadAdditionalItems(): void {
    try {
      const additionalItems = itemsData.items || [];
      
      additionalItems.forEach((item: any) => {
        // Only add if not already in database (item-prefabs takes precedence)
        if (!this.itemDatabase.has(item.id)) {
          this.itemDatabase.set(item.id, item as ItemData);
        }
      });
      
      console.log(`[ItemSystem] Total items loaded: ${this.itemDatabase.size}`);
    } catch (error) {
      console.error('[ItemSystem] Failed to load additional items:', error);
    }
  }

  /**
   * Get item data by ID
   */
  public getItem(itemId: string): ItemData | undefined {
    return this.itemDatabase.get(itemId);
  }

  /**
   * Get all items
   */
  public getAllItems(): ItemData[] {
    return Array.from(this.itemDatabase.values());
  }

  /**
   * Get items by type
   */
  public getItemsByType(type: string): ItemData[] {
    return Array.from(this.itemDatabase.values()).filter(item => item.type === type);
  }

  /**
   * Get items by subtype
   */
  public getItemsBySubType(subType: string): ItemData[] {
    return Array.from(this.itemDatabase.values()).filter(item => {
      if (Array.isArray(item.subType)) {
        return item.subType.includes(subType);
      }
      return item.subType === subType;
    });
  }

  /**
   * Add item to player inventory
   */
  public addItem(itemId: string, quantity: number = 1, affix?: any): boolean {
    const item = this.getItem(itemId);
    if (!item) {
      console.error(`[ItemSystem] Item not found: ${itemId}`);
      return false;
    }

    // Check if item is stackable (stackSize > 1)
    if (item.stackSize > 1) {
      // Stackable item - use the old logic
      const currentQuantity = this.playerInventory.get(itemId) || 0;
      const newQuantity = currentQuantity + quantity;

      // Check stack size limit
      if (newQuantity > item.stackSize) {
        console.warn(`[ItemSystem] Cannot add ${quantity} ${item.name}, exceeds stack size`);
        return false;
      }

      this.playerInventory.set(itemId, newQuantity);
      console.log(`[ItemSystem] Added ${quantity}x ${item.name} to inventory`);
      return true;
    } else {
      // Non-stackable item (equipment, etc.) - create individual instances
      for (let i = 0; i < quantity; i++) {
        const instanceId = `${itemId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const instance: InventorySlot = {
          itemId: itemId,
          quantity: 1,
          instanceId: instanceId,
          instanceData: affix ? { affix } : {} // Store affix in instance data
        };
        this.itemInstances.set(instanceId, instance);
        console.log(`[ItemSystem] Added ${item.name} instance ${instanceId} to inventory`);
      }
      return true;
    }
  }

  /**
   * Remove item from player inventory
   * @param itemId - The item ID or instance ID to remove
   * @param quantity - The quantity to remove (only for stackable items)
   */
  public removeItem(itemId: string, quantity: number = 1): boolean {
    // Check if it's an instance ID
    if (this.itemInstances.has(itemId)) {
      this.itemInstances.delete(itemId);
      console.log(`[ItemSystem] Removed item instance ${itemId} from inventory`);
      return true;
    }
    
    // Otherwise, treat as stackable item
    const currentQuantity = this.playerInventory.get(itemId) || 0;
    
    if (currentQuantity < quantity) {
      console.warn(`[ItemSystem] Not enough ${itemId} in inventory`);
      return false;
    }

    const newQuantity = currentQuantity - quantity;
    if (newQuantity === 0) {
      this.playerInventory.delete(itemId);
    } else {
      this.playerInventory.set(itemId, newQuantity);
    }

    console.log(`[ItemSystem] Removed ${quantity}x ${itemId} from inventory`);
    return true;
  }

  /**
   * Get item quantity in inventory
   */
  public getItemQuantity(itemId: string): number {
    // Check stackable items
    const stackableQuantity = this.playerInventory.get(itemId) || 0;
    
    // Count instances of non-stackable items
    let instanceCount = 0;
    this.itemInstances.forEach((instance) => {
      if (instance.itemId === itemId) {
        instanceCount++;
      }
    });
    
    return stackableQuantity + instanceCount;
  }

  /**
   * Check if player has item
   */
  public hasItem(itemId: string, quantity: number = 1): boolean {
    return this.getItemQuantity(itemId) >= quantity;
  }

  /**
   * Get player inventory
   */
  public getInventory(): InventorySlot[] {
    const inventory: InventorySlot[] = [];
    
    // Add stackable items
    this.playerInventory.forEach((quantity, itemId) => {
      inventory.push({ itemId, quantity });
    });
    
    // Add non-stackable item instances
    this.itemInstances.forEach((instance) => {
      inventory.push(instance);
    });
    
    return inventory;
  }
  /**
   * Get all item instances (non-stackable items like equipment)
   */
  public getAllItemInstances(): InventorySlot[] {
    return Array.from(this.itemInstances.values());
  }


  /**
   * Clear player inventory
   */
  public clearInventory(): void {
    this.playerInventory.clear();
    this.itemInstances.clear();
    console.log('[ItemSystem] Inventory cleared');
  }

  /**
   * Use an item
   */
  public useItem(itemId: string): boolean {
    const item = this.getItem(itemId);
    if (!item) {
      console.error(`[ItemSystem] Item not found: ${itemId}`);
      return false;
    }

    if (!item.canUse) {
      console.warn(`[ItemSystem] Item ${item.name} cannot be used`);
      return false;
    }

    if (!this.hasItem(itemId)) {
      console.warn(`[ItemSystem] Item ${item.name} not in inventory`);
      return false;
    }

    // Apply item effects
    if (item.effects && item.effects.length > 0) {
      item.effects.forEach(effect => {
        console.log(`[ItemSystem] Applying effect: ${effect.type}`);
        // Effect application logic would go here
      });
    }

    // Remove consumable items after use
    if (item.type === 'consumable' || item.type === 'food') {
      this.removeItem(itemId, 1);
    }

    return true;
  }

  /**
   * Buy an item
   */
  public buyItem(itemId: string, quantity: number = 1): boolean {
    const item = this.getItem(itemId);
    if (!item) {
      console.error(`[ItemSystem] Item not found: ${itemId}`);
      return false;
    }

    if (!item.canBuy) {
      console.warn(`[ItemSystem] Item ${item.name} cannot be bought`);
      return false;
    }

    const totalCost = item.buyPrice * quantity;
    console.log(`[ItemSystem] Buying ${quantity}x ${item.name} for ${totalCost} gold`);
    
    // Currency check would go here
    // For now, just add the item
    return this.addItem(itemId, quantity);
  }

  /**
   * Sell an item
   */
  public sellItem(itemId: string, quantity: number = 1): boolean {
    const item = this.getItem(itemId);
    if (!item) {
      console.error(`[ItemSystem] Item not found: ${itemId}`);
      return false;
    }

    if (!item.canSell) {
      console.warn(`[ItemSystem] Item ${item.name} cannot be sold`);
      return false;
    }

    if (!this.hasItem(itemId, quantity)) {
      console.warn(`[ItemSystem] Not enough ${item.name} to sell`);
      return false;
    }

    const totalValue = item.buyPrice * quantity;
    console.log(`[ItemSystem] Selling ${quantity}x ${item.name} for ${totalValue} gold`);
    
    // Remove item and add currency
    return this.removeItem(itemId, quantity);
  }

  /**
   * Craft an item
   */
  public craftItem(itemId: string): boolean {
    const item = this.getItem(itemId);
    if (!item) {
      console.error(`[ItemSystem] Item not found: ${itemId}`);
      return false;
    }

    if (!item.canCraft || !item.craftRecipe) {
      console.warn(`[ItemSystem] Item ${item.name} cannot be crafted`);
      return false;
    }

    // Check if player has all required materials
    for (const material of item.craftRecipe.materials) {
      if (!this.hasItem(material.itemId, material.quantity)) {
        console.warn(`[ItemSystem] Missing material: ${material.itemId}`);
        return false;
      }
    }

    // Remove materials
    for (const material of item.craftRecipe.materials) {
      this.removeItem(material.itemId, material.quantity);
    }

    // Add crafted item
    this.addItem(itemId, 1);
    console.log(`[ItemSystem] Crafted ${item.name}`);
    return true;
  }

  /**
   * Get rarity color
   */
  public getRarityColor(rarity: number): string {
    const colors = [
      '#9e9e9e', // Common - gray
      '#0080ff', // Rare - blue
      '#a020f0', // Epic - purple
      '#ffa500'  // Legendary - orange
    ];
    return colors[rarity] || colors[0];
  }

  /**
   * Get rarity name
   */
  public getRarityName(rarity: number): string {
    const names = ['普通', '稀有', '神话', '传说'];
    return names[rarity] || names[0];
  }

  /**
   * Register a new item dynamically
   */
  public registerItem(itemData: ItemData): void {
    if (this.itemDatabase.has(itemData.id)) {
      console.warn(`[ItemSystem] Item ${itemData.id} already registered, skipping`);
      return;
    }
    
    this.itemDatabase.set(itemData.id, itemData);
    console.log(`[ItemSystem] Registered new item: ${itemData.name}`);
  }

  /**
   * Update an existing item with new properties
   */
  public updateItem(itemId: string, updates: Partial<ItemData>): void {
    const existingItem = this.itemDatabase.get(itemId);
    if (!existingItem) {
      console.warn(`[ItemSystem] Cannot update item ${itemId} - not found`);
      return;
    }
    
    const updatedItem = { ...existingItem, ...updates };
    this.itemDatabase.set(itemId, updatedItem);
    console.log(`[ItemSystem] Updated item: ${existingItem.name} with hungerRestore: ${updates.hungerRestore}`);
  }

  update(_deltaTime: number): void {
    // Item system update logic (if needed)
  }
}
