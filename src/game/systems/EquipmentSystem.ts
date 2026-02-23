/**
 * Equipment System - Manages character equipment slots and equipment operations
 * Handles equipping, unequipping, and validating equipment items
 */

import { System } from '../../ecs/System';
import { EntityId } from '../../ecs/Entity';
import { ComponentType } from '../../ecs/Component';
import { World } from '../../ecs/World';
import { EquipmentSlotsComponent, EquipmentSlotsComponentType } from '../components/SystemComponents';
import { ItemSystem } from './ItemSystem';

/**
 * Equipment slot types
 */
export type EquipmentSlot = 'weapon' | 'armor' | 'offhand' | 'accessory';

/**
 * Equipment change event data
 */
export interface EquipmentChangeEvent {
  characterId: EntityId;
  slot: EquipmentSlot;
  previousItem: EntityId | null;
  newItem: EntityId | null;
}

/**
 * Equipment System
 * Manages equipment slots and equipment operations for characters
 */
export class EquipmentSystem extends System {
  public readonly name = 'EquipmentSystem';
  public readonly requiredComponents: ComponentType<any>[] = [EquipmentSlotsComponentType];
  
  private itemSystem: ItemSystem;
  protected world: World;
  
  // Track which items are currently equipped by which character
  // Map<itemInstanceId, characterId>
  private equippedItems: Map<string, EntityId> = new Map();
  
  constructor(world: World, itemSystem: ItemSystem) {
    super();
    this.world = world;
    this.itemSystem = itemSystem;
  }
  
  /**
   * Initialize the equipment system
   */
  protected onInitialize(): void {
    console.log('[EquipmentSystem] Initialized');
  }
  
  /**
   * Update method (equipment system is mostly event-driven)
   */
  public update(_deltaTime: number): void {
    // Equipment system is primarily event-driven
    // No per-frame updates needed
  }
  
  /**
   * Equip an item to a character's equipment slot
   * @param characterId - The character entity ID
   * @param itemInstanceId - The item instance ID from ItemSystem
   * @param slot - The equipment slot to equip to
   * @returns true if equipment was successful, false otherwise
   */
  public equipItem(characterId: EntityId, itemInstanceId: string, slot: EquipmentSlot): boolean {
    // Validate character exists
    if (!this.world.entityManager.hasEntity(characterId)) {
      console.error(`[EquipmentSystem] Cannot equip item: Character entity ${characterId} does not exist`);
      return false;
    }
    
    // Validate character has equipment slots component
    const equipmentSlots = this.getComponent(characterId, EquipmentSlotsComponentType);
    if (!equipmentSlots) {
      console.error(`[EquipmentSystem] Cannot equip item: Character ${characterId} does not have EquipmentSlotsComponent`);
      return false;
    }
    
    // Check if item can be equipped (performs all validation)
    if (!this.canEquipItem(characterId, itemInstanceId, slot)) {
      console.error(`[EquipmentSystem] Cannot equip item ${itemInstanceId} to ${slot} slot on character ${characterId}: Validation failed`);
      return false;
    }
    
    // Store previous item for event
    const previousItem = equipmentSlots[slot];
    
    // If slot is occupied, unequip the current item first
    if (previousItem !== null) {
      this.unequipItem(characterId, slot);
    }
    
    // Equip the new item
    equipmentSlots[slot] = itemInstanceId as unknown as EntityId;
    
    // Mark item as equipped by this character
    this.equippedItems.set(itemInstanceId, characterId);
    
    // Emit equipment changed event
    this.emitEquipmentChangeEvent(characterId, slot, previousItem, itemInstanceId as unknown as EntityId);
    
    console.log(`[EquipmentSystem] Equipped item ${itemInstanceId} to ${slot} slot on character ${characterId}`);
    return true;
  }
  
  /**
   * Unequip an item from a character's equipment slot
   * @param characterId - The character entity ID
   * @param slot - The equipment slot to unequip from
   * @returns true if unequip was successful, false otherwise
   */
  public unequipItem(characterId: EntityId, slot: EquipmentSlot): boolean {
    // Validate character exists
    if (!this.world.entityManager.hasEntity(characterId)) {
      console.error(`[EquipmentSystem] Cannot unequip item: Character entity ${characterId} does not exist`);
      return false;
    }
    
    // Validate character has equipment slots component
    const equipmentSlots = this.getComponent(characterId, EquipmentSlotsComponentType);
    if (!equipmentSlots) {
      console.error(`[EquipmentSystem] Cannot unequip item: Character ${characterId} does not have EquipmentSlotsComponent`);
      return false;
    }
    
    // Validate slot is valid
    const validSlots: EquipmentSlot[] = ['weapon', 'armor', 'offhand', 'accessory'];
    if (!validSlots.includes(slot)) {
      console.error(`[EquipmentSystem] Cannot unequip item: Invalid equipment slot: ${slot}. Valid slots: ${validSlots.join(', ')}`);
      return false;
    }
    
    // Get the currently equipped item
    const equippedItem = equipmentSlots[slot];
    
    // Check if slot is empty
    if (equippedItem === null) {
      console.warn(`[EquipmentSystem] Cannot unequip item: Slot ${slot} is already empty on character ${characterId}`);
      return false;
    }
    
    // Remove item from slot
    equipmentSlots[slot] = null;
    
    // Remove item from equipped items tracking
    const itemInstanceId = equippedItem as unknown as string;
    this.equippedItems.delete(itemInstanceId);
    
    // Emit equipment changed event
    this.emitEquipmentChangeEvent(characterId, slot, equippedItem, null);
    
    console.log(`[EquipmentSystem] Unequipped item from ${slot} slot on character ${characterId}`);
    return true;
  }
  
  /**
   * Check if an item can be equipped to a specific slot
   * @param characterId - The character entity ID
   * @param itemInstanceId - The item instance ID from ItemSystem
   * @param slot - The equipment slot to check
   * @returns true if item can be equipped, false otherwise
   */
  public canEquipItem(characterId: EntityId, itemInstanceId: string, slot: EquipmentSlot): boolean {
    // Validate character exists
    if (!this.world.entityManager.hasEntity(characterId)) {
      console.error(`[EquipmentSystem] Character entity ${characterId} does not exist`);
      return false;
    }
    
    // Validate character has equipment slots component
    const equipmentSlots = this.getComponent(characterId, EquipmentSlotsComponentType);
    if (!equipmentSlots) {
      console.error(`[EquipmentSystem] Character ${characterId} does not have EquipmentSlotsComponent. Required components: EquipmentSlotsComponent`);
      return false;
    }
    
    // Validate item instance ID is provided
    if (!itemInstanceId || typeof itemInstanceId !== 'string' || itemInstanceId.trim() === '') {
      console.error(`[EquipmentSystem] Invalid item instance ID: ${itemInstanceId}`);
      return false;
    }
    
    // Validate slot is valid
    const validSlots: EquipmentSlot[] = ['weapon', 'armor', 'offhand', 'accessory'];
    if (!validSlots.includes(slot)) {
      console.error(`[EquipmentSystem] Invalid equipment slot: ${slot}. Valid slots: ${validSlots.join(', ')}`);
      return false;
    }
    
    // Check if item is already equipped by another character
    const equippedByCharacter = this.equippedItems.get(itemInstanceId);
    if (equippedByCharacter !== undefined && equippedByCharacter !== characterId) {
      console.error(`[EquipmentSystem] Item ${itemInstanceId} is already equipped by another character (${equippedByCharacter})`);
      return false;
    }
    
    // Get item data from ItemSystem
    const itemData = this.getItemDataFromInstance(itemInstanceId);
    if (!itemData) {
      console.error(`[EquipmentSystem] Item instance ${itemInstanceId} not found in ItemSystem. The item may not exist or has been removed from inventory.`);
      return false;
    }
    
    // Validate item is equipment type
    if (itemData.type !== 'equipment') {
      console.error(`[EquipmentSystem] Item "${itemData.name}" (type: ${itemData.type}) is not equipment type. Only items with type "equipment" can be equipped.`);
      return false;
    }
    
    // Validate item's equipment slot matches the target slot
    // Use equipmentSlot if available, otherwise fall back to subType
    const itemSlot = itemData.equipmentSlot || itemData.subType;
    if (!this.validateSlotMatch(itemSlot, slot)) {
      console.error(`[EquipmentSystem] Item "${itemData.name}" cannot be equipped to ${slot} slot. This item requires ${itemSlot} slot.`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get the currently equipped item in a slot
   * @param characterId - The character entity ID
   * @param slot - The equipment slot to check
   * @returns The equipped item entity ID, or null if slot is empty
   */
  public getEquippedItem(characterId: EntityId, slot: EquipmentSlot): EntityId | null {
    // Validate character exists
    if (!this.world.entityManager.hasEntity(characterId)) {
      console.error(`[EquipmentSystem] Cannot get equipped item: Character entity ${characterId} does not exist`);
      return null;
    }
    
    const equipmentSlots = this.getComponent(characterId, EquipmentSlotsComponentType);
    if (!equipmentSlots) {
      console.error(`[EquipmentSystem] Cannot get equipped item: Character ${characterId} does not have EquipmentSlotsComponent`);
      return null;
    }
    
    // Validate slot is valid
    const validSlots: EquipmentSlot[] = ['weapon', 'armor', 'offhand', 'accessory'];
    if (!validSlots.includes(slot)) {
      console.error(`[EquipmentSystem] Cannot get equipped item: Invalid equipment slot: ${slot}. Valid slots: ${validSlots.join(', ')}`);
      return null;
    }
    
    return equipmentSlots[slot];
  }
  
  /**
   * Get all equipped items for a character
   * @param characterId - The character entity ID
   * @returns Map of slot to equipped item entity ID
   */
  public getAllEquippedItems(characterId: EntityId): Map<EquipmentSlot, EntityId | null> {
    // Validate character exists
    if (!this.world.entityManager.hasEntity(characterId)) {
      console.error(`[EquipmentSystem] Cannot get equipped items: Character entity ${characterId} does not exist`);
      return new Map();
    }
    
    const equipmentSlots = this.getComponent(characterId, EquipmentSlotsComponentType);
    if (!equipmentSlots) {
      console.error(`[EquipmentSystem] Cannot get equipped items: Character ${characterId} does not have EquipmentSlotsComponent`);
      return new Map();
    }
    
    const equippedItems = new Map<EquipmentSlot, EntityId | null>();
    equippedItems.set('weapon', equipmentSlots.weapon);
    equippedItems.set('armor', equipmentSlots.armor);
    equippedItems.set('offhand', equipmentSlots.offhand);
    equippedItems.set('accessory', equipmentSlots.accessory);
    
    return equippedItems;
  }
  
  /**
   * Validate that an item's equipment slot matches the target slot
   * @param itemSlot - The equipment slot from item data
   * @param targetSlot - The target slot to equip to
   * @returns true if slots match, false otherwise
   */
  private validateSlotMatch(itemSlot: string | undefined, targetSlot: EquipmentSlot): boolean {
    if (!itemSlot) {
      return false;
    }
    
    // Direct match
    if (itemSlot === targetSlot) {
      return true;
    }
    
    // Handle alternative naming (misc vs accessory)
    if ((itemSlot === 'misc' && targetSlot === 'accessory') ||
        (itemSlot === 'accessory' && targetSlot === 'accessory')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Get item data from an item instance ID
   * @param itemInstanceId - The item instance ID
   * @returns Item data or undefined
   */
  private getItemDataFromInstance(itemInstanceId: string): any {
    // Get all item instances from ItemSystem
    const instances = this.itemSystem.getAllItemInstances();
    
    // Find the instance
    const instance = instances.find(inst => inst.instanceId === itemInstanceId);
    if (!instance) {
      return undefined;
    }
    
    // Get the item data
    return this.itemSystem.getItem(instance.itemId);
  }
  
  /**
   * Emit equipment change event
   * @param characterId - The character entity ID
   * @param slot - The equipment slot that changed
   * @param previousItem - The previously equipped item (or null)
   * @param newItem - The newly equipped item (or null)
   */
  private emitEquipmentChangeEvent(
    characterId: EntityId,
    slot: EquipmentSlot,
    previousItem: EntityId | null,
    newItem: EntityId | null
  ): void {
    const event = {
      type: 'equipment_changed',
      timestamp: Date.now(),
      characterId,
      slot,
      previousItem,
      newItem
    };
    
    this.eventSystem.emit(event);
  }
  
  /**
   * Check if an item is currently equipped by any character
   * @param itemInstanceId - The item instance ID to check
   * @returns true if item is equipped, false otherwise
   */
  public isItemEquipped(itemInstanceId: string): boolean {
    return this.equippedItems.has(itemInstanceId);
  }
  
  /**
   * Get the character ID that has equipped a specific item
   * @param itemInstanceId - The item instance ID to check
   * @returns The character ID that has the item equipped, or undefined if not equipped
   */
  public getEquippedByCharacter(itemInstanceId: string): EntityId | undefined {
    return this.equippedItems.get(itemInstanceId);
  }
}
