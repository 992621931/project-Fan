/**
 * Shop System
 * Handles shop operations, customer interactions, and reputation management
 * Implements requirements 10.1-10.5
 */

import { System } from '../../ecs/System';
import { ComponentType } from '../../ecs/Component';
import { EntityId } from '../../ecs/Entity';
import { 
  ShopComponent,
  ShopComponentType,
  ShopInventorySlot,
  InventoryComponent,
  InventoryComponentType,
  CurrencyComponent,
  CurrencyComponentType
} from '../components/SystemComponents';
import { ItemComponent, ItemComponentType } from '../components/ItemComponents';
import { ShopType, ItemType } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';
import { CurrencyValidator } from '../types/CurrencyTypes';

export interface Customer {
  id: string;
  preferences: ItemType[];
  budget: number;
  patience: number; // How long they'll wait
  reputationRequirement: number; // Minimum reputation to attract this customer
}

export interface ShopTransaction {
  customerId: string;
  itemId: EntityId;
  quantity: number;
  price: number;
  timestamp: number;
  reputationGain: number;
}

export interface ShopListingResult {
  success: boolean;
  itemId?: EntityId;
  price?: number;
  error?: string;
}

export interface ShopSaleResult {
  success: boolean;
  transaction?: ShopTransaction;
  error?: string;
}

export class ShopSystem extends System {
  public readonly name = 'ShopSystem';
  public readonly requiredComponents: ComponentType<any>[] = [
    ShopComponentType
  ];

  // Customer types with different preferences and budgets
  private customerTypes: Customer[] = [
    {
      id: 'casual_buyer',
      preferences: [ItemType.Food, ItemType.Consumable],
      budget: 50,
      patience: 300000, // 5 minutes
      reputationRequirement: 0
    },
    {
      id: 'adventurer',
      preferences: [ItemType.Equipment, ItemType.Potion],
      budget: 200,
      patience: 600000, // 10 minutes
      reputationRequirement: 10
    },
    {
      id: 'collector',
      preferences: [ItemType.Material, ItemType.Gem],
      budget: 150,
      patience: 900000, // 15 minutes
      reputationRequirement: 25
    },
    {
      id: 'wealthy_merchant',
      preferences: [ItemType.Equipment, ItemType.Gem],
      budget: 1000,
      patience: 1200000, // 20 minutes
      reputationRequirement: 50
    },
    {
      id: 'rare_collector',
      preferences: [ItemType.Equipment, ItemType.Material, ItemType.Gem],
      budget: 2000,
      patience: 1800000, // 30 minutes
      reputationRequirement: 100
    }
  ];

  // Base customer traffic rates by shop type
  private baseTrafficRates: Record<ShopType, number> = {
    [ShopType.General]: 1.0,
    [ShopType.Equipment]: 0.8,
    [ShopType.Food]: 1.2,
    [ShopType.Materials]: 0.6,
    [ShopType.Specialty]: 0.4
  };

  protected onInitialize(): void {
    // Listen for time updates to process customer visits
    this.eventSystem.subscribe('time_update', this.handleTimeUpdate.bind(this));
    // Listen for reputation changes
    this.eventSystem.subscribe('reputation_changed', this.handleReputationChange.bind(this));
  }

  public update(deltaTime: number): void {
    const entities = this.getEntities();
    
    for (const entityId of entities) {
      this.processCustomerVisits(entityId, deltaTime);
      this.updateShopMetrics(entityId, deltaTime);
    }
  }

  /**
   * List an item for sale in the shop
   * Requirement 10.1: Set item price and quantity for sale
   */
  public listItem(shopId: EntityId, itemId: EntityId, price: number, quantity: number): ShopListingResult {
    const shop = this.getComponent(shopId, ShopComponentType);
    const item = this.getComponent(itemId, ItemComponentType);
    
    if (!shop || !item) {
      return {
        success: false,
        error: 'Shop or item not found'
      };
    }

    if (price <= 0 || quantity <= 0) {
      return {
        success: false,
        error: 'Price and quantity must be positive'
      };
    }

    // Check if item is already listed
    const existingSlot = shop.inventory.find(slot => slot.item === itemId);
    if (existingSlot) {
      // Update existing listing
      existingSlot.price = price;
      existingSlot.stock += quantity;
    } else {
      // Create new listing
      const newSlot: ShopInventorySlot = {
        item: itemId,
        price,
        stock: quantity,
        popularity: this.calculateItemPopularity(item, shop.shopType),
        salesCount: 0
      };
      shop.inventory.push(newSlot);
    }

    // Emit item listed event
    this.eventSystem.emit({
      type: 'item_listed',
      timestamp: Date.now(),
      shopId,
      itemId,
      price,
      quantity
    });

    return {
      success: true,
      itemId,
      price
    };
  }

  /**
   * Remove an item from shop inventory
   */
  public removeItem(shopId: EntityId, itemId: EntityId): boolean {
    const shop = this.getComponent(shopId, ShopComponentType);
    
    if (!shop) {
      return false;
    }

    const slotIndex = shop.inventory.findIndex(slot => slot.item === itemId);
    if (slotIndex === -1) {
      return false;
    }

    shop.inventory.splice(slotIndex, 1);

    // Emit item removed event
    this.eventSystem.emit({
      type: 'item_removed',
      timestamp: Date.now(),
      shopId,
      itemId
    });

    return true;
  }

  /**
   * Process a customer purchase
   * Requirement 10.2: Deduct inventory and increase player gold when customers buy items
   */
  public processPurchase(shopId: EntityId, customerId: string, itemId: EntityId, quantity: number): ShopSaleResult {
    const shop = this.getComponent(shopId, ShopComponentType);
    const item = this.getComponent(itemId, ItemComponentType);
    
    if (!shop || !item) {
      return {
        success: false,
        error: 'Shop or item not found'
      };
    }

    // Find the item in shop inventory
    const slot = shop.inventory.find(s => s.item === itemId);
    if (!slot) {
      return {
        success: false,
        error: 'Item not available in shop'
      };
    }

    if (slot.stock < quantity) {
      return {
        success: false,
        error: 'Insufficient stock'
      };
    }

    const totalPrice = slot.price * quantity;
    
    // Calculate reputation gain based on item rarity and customer satisfaction
    const reputationGain = this.calculateReputationGain(item, quantity, slot.price);

    // Create transaction
    const transaction: ShopTransaction = {
      customerId,
      itemId,
      quantity,
      price: totalPrice,
      timestamp: Date.now(),
      reputationGain
    };

    // Update shop inventory
    slot.stock -= quantity;
    slot.salesCount += quantity;
    
    // Remove item if stock is depleted
    if (slot.stock === 0) {
      const slotIndex = shop.inventory.findIndex(s => s.item === itemId);
      shop.inventory.splice(slotIndex, 1);
    }

    // Update shop metrics
    shop.dailyRevenue += totalPrice;
    shop.reputation += reputationGain;

    // Add gold to player currency (find player entity with currency component)
    this.addGoldToPlayer(totalPrice);

    // Emit sale event
    this.eventSystem.emit({
      type: 'item_sold',
      timestamp: Date.now(),
      shopId,
      transaction
    });

    // Emit reputation change event
    if (reputationGain > 0) {
      this.eventSystem.emit({
        type: 'reputation_gained',
        timestamp: Date.now(),
        shopId,
        amount: reputationGain,
        reason: 'item_sale'
      });
    }

    return {
      success: true,
      transaction
    };
  }

  /**
   * Get available customers based on shop reputation
   * Requirement 10.4: Higher reputation attracts more and better customers
   */
  public getAvailableCustomers(shopId: EntityId): Customer[] {
    const shop = this.getComponent(shopId, ShopComponentType);
    
    if (!shop) {
      return [];
    }

    return this.customerTypes.filter(customer => 
      shop.reputation >= customer.reputationRequirement
    );
  }

  /**
   * Calculate customer visit frequency
   * Requirement 10.4: Reputation increases customer visit frequency
   */
  public calculateCustomerTraffic(shopId: EntityId): number {
    const shop = this.getComponent(shopId, ShopComponentType);
    
    if (!shop) {
      return 0;
    }

    const baseRate = this.baseTrafficRates[shop.shopType];
    const reputationMultiplier = 1 + (shop.reputation * 0.01); // 1% increase per reputation point
    
    return Math.max(0.1, baseRate * reputationMultiplier); // Ensure minimum traffic
  }

  /**
   * Get shop performance metrics
   */
  public getShopMetrics(shopId: EntityId): {
    totalItems: number;
    totalValue: number;
    dailyRevenue: number;
    reputation: number;
    customerTraffic: number;
    averageItemPrice: number;
  } | null {
    const shop = this.getComponent(shopId, ShopComponentType);
    
    if (!shop) {
      return null;
    }

    const totalItems = shop.inventory.reduce((sum, slot) => sum + slot.stock, 0);
    const totalValue = shop.inventory.reduce((sum, slot) => sum + (slot.price * slot.stock), 0);
    const averageItemPrice = totalItems > 0 ? totalValue / totalItems : 0;

    return {
      totalItems,
      totalValue,
      dailyRevenue: shop.dailyRevenue,
      reputation: shop.reputation,
      customerTraffic: this.calculateCustomerTraffic(shopId), // Calculate current traffic
      averageItemPrice
    };
  }

  /**
   * Process customer visits and potential purchases
   */
  private processCustomerVisits(shopId: EntityId, deltaTime: number): void {
    const shop = this.getComponent(shopId, ShopComponentType);
    
    if (!shop || shop.inventory.length === 0) {
      return;
    }

    const trafficRate = this.calculateCustomerTraffic(shopId);
    const visitChance = (trafficRate * deltaTime) / 60000; // Visits per minute converted to per millisecond

    // Random chance for customer visit
    if (Math.random() < visitChance) {
      this.simulateCustomerVisit(shopId);
    }
  }

  /**
   * Simulate a customer visit and potential purchase
   */
  private simulateCustomerVisit(shopId: EntityId): void {
    const shop = this.getComponent(shopId, ShopComponentType);
    
    if (!shop) {
      return;
    }

    const availableCustomers = this.getAvailableCustomers(shopId);
    if (availableCustomers.length === 0) {
      return;
    }

    // Select random customer
    const customer = availableCustomers[Math.floor(Math.random() * availableCustomers.length)];
    
    // Find items the customer might be interested in
    const interestedItems = shop.inventory.filter(slot => {
      const item = this.getComponent(slot.item, ItemComponentType);
      return item && customer.preferences.includes(item.itemType) && slot.price <= customer.budget;
    });

    if (interestedItems.length === 0) {
      return; // Customer leaves without buying
    }

    // Customer selects an item based on popularity and price
    const selectedSlot = this.selectItemForPurchase(interestedItems, customer);
    if (!selectedSlot) {
      return;
    }

    // Determine purchase quantity (usually 1, sometimes more for cheaper items)
    const maxQuantity = Math.min(
      selectedSlot.stock,
      Math.floor(customer.budget / selectedSlot.price),
      selectedSlot.price < 50 ? Math.floor(Math.random() * 3) + 1 : 1
    );

    if (maxQuantity > 0) {
      this.processPurchase(shopId, customer.id, selectedSlot.item, maxQuantity);
    }
  }

  /**
   * Select item for customer purchase based on preferences and budget
   */
  private selectItemForPurchase(availableItems: ShopInventorySlot[], customer: Customer): ShopInventorySlot | null {
    if (availableItems.length === 0) {
      return null;
    }

    // Weight items by popularity and inverse price (customers prefer popular, cheaper items)
    const weightedItems = availableItems.map(slot => ({
      slot,
      weight: slot.popularity * (customer.budget / slot.price)
    }));

    // Sort by weight and select from top choices
    weightedItems.sort((a, b) => b.weight - a.weight);
    
    // Select from top 3 choices with some randomness
    const topChoices = weightedItems.slice(0, Math.min(3, weightedItems.length));
    const randomIndex = Math.floor(Math.random() * topChoices.length);
    
    return topChoices[randomIndex].slot;
  }

  /**
   * Calculate item popularity based on type and shop specialization
   */
  private calculateItemPopularity(item: ItemComponent, shopType: ShopType): number {
    let basePopularity = 50; // Base popularity

    // Bonus for items matching shop specialization
    const typeBonus = this.getShopTypeBonus(item.itemType, shopType);
    basePopularity += typeBonus;

    // Rarity affects popularity differently
    const rarityMultiplier = this.getRarityPopularityMultiplier(item.rarity);
    basePopularity *= rarityMultiplier;

    return Math.max(1, Math.min(100, basePopularity));
  }

  /**
   * Get popularity bonus for items matching shop type
   */
  private getShopTypeBonus(itemType: ItemType, shopType: ShopType): number {
    const bonusMap: Record<ShopType, Partial<Record<ItemType, number>>> = {
      [ShopType.General]: {}, // No specific bonuses
      [ShopType.Equipment]: {
        [ItemType.Equipment]: 30,
        [ItemType.Tool]: 20
      },
      [ShopType.Food]: {
        [ItemType.Food]: 40,
        [ItemType.Consumable]: 20
      },
      [ShopType.Materials]: {
        [ItemType.Material]: 35,
        [ItemType.Gem]: 25
      },
      [ShopType.Specialty]: {
        [ItemType.Potion]: 30,
        [ItemType.Gem]: 30
      }
    };

    return bonusMap[shopType][itemType] || 0;
  }

  /**
   * Get popularity multiplier based on rarity
   */
  private getRarityPopularityMultiplier(rarity: RarityType): number {
    const multipliers: Record<RarityType, number> = {
      [RarityType.Common]: 1.0,
      [RarityType.Rare]: 1.2,
      [RarityType.Epic]: 1.5,
      [RarityType.Legendary]: 2.0
    };

    return multipliers[rarity] || 1.0;
  }

  /**
   * Calculate reputation gain from item sale
   * Requirement 10.5: Special items provide extra reputation rewards
   */
  private calculateReputationGain(item: ItemComponent, quantity: number, price: number): number {
    let baseGain = 1; // Base reputation per sale

    // Rarity bonus
    const rarityBonus: Record<RarityType, number> = {
      [RarityType.Common]: 0,
      [RarityType.Rare]: 1,
      [RarityType.Epic]: 3,
      [RarityType.Legendary]: 5
    };

    baseGain += rarityBonus[item.rarity] || 0;

    // High-value item bonus
    if (price > 100) {
      baseGain += Math.floor(price / 100);
    }

    return baseGain * quantity;
  }

  /**
   * Add gold to player's currency
   */
  private addGoldToPlayer(amount: number): void {
    // Find player entity (simplified - in real implementation would have proper player management)
    const entities = this.entityManager.getAllEntities();
    
    for (const entityId of entities) {
      const currency = this.getComponent(entityId, CurrencyComponentType);
      if (currency) {
        currency.amounts = CurrencyValidator.add(currency.amounts, { gold: amount });
        
        // Emit currency gained event
        this.eventSystem.emit({
          type: 'currency_gained',
          timestamp: Date.now(),
          entityId,
          currency: 'gold',
          amount,
          reason: 'shop_sale'
        });
        break;
      }
    }
  }

  /**
   * Update shop metrics over time
   */
  private updateShopMetrics(shopId: EntityId, deltaTime: number): void {
    const shop = this.getComponent(shopId, ShopComponentType);
    
    if (!shop) {
      return;
    }

    // Update customer traffic based on current reputation
    shop.customerTraffic = this.calculateCustomerTraffic(shopId);

    // Reset daily revenue at midnight (simplified)
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      shop.dailyRevenue = 0;
    }
  }

  /**
   * Handle time updates
   */
  private handleTimeUpdate(event: { type: string; deltaTime: number }): void {
    // Customer visits are processed in the main update loop
  }

  /**
   * Handle reputation changes
   */
  private handleReputationChange(event: { type: string; shopId: EntityId; newReputation: number }): void {
    const shop = this.getComponent(event.shopId, ShopComponentType);
    if (shop) {
      shop.reputation = event.newReputation;
      // Recalculate customer traffic
      shop.customerTraffic = this.calculateCustomerTraffic(event.shopId);
    }
  }

  /**
   * Get shop inventory summary
   */
  public getInventorySummary(shopId: EntityId): {
    totalItems: number;
    itemsByType: Record<ItemType, number>;
    itemsByRarity: Record<RarityType, number>;
    totalValue: number;
  } | null {
    const shop = this.getComponent(shopId, ShopComponentType);
    
    if (!shop) {
      return null;
    }

    const summary = {
      totalItems: 0,
      itemsByType: {} as Record<ItemType, number>,
      itemsByRarity: {} as Record<RarityType, number>,
      totalValue: 0
    };

    for (const slot of shop.inventory) {
      const item = this.getComponent(slot.item, ItemComponentType);
      if (item) {
        summary.totalItems += slot.stock;
        summary.totalValue += slot.price * slot.stock;
        
        summary.itemsByType[item.itemType] = (summary.itemsByType[item.itemType] || 0) + slot.stock;
        summary.itemsByRarity[item.rarity] = (summary.itemsByRarity[item.rarity] || 0) + slot.stock;
      }
    }

    return summary;
  }

  /**
   * Set shop type and update base traffic
   */
  public setShopType(shopId: EntityId, shopType: ShopType): boolean {
    const shop = this.getComponent(shopId, ShopComponentType);
    
    if (!shop) {
      return false;
    }

    shop.shopType = shopType;
    shop.customerTraffic = this.calculateCustomerTraffic(shopId);

    // Emit shop type changed event
    this.eventSystem.emit({
      type: 'shop_type_changed',
      timestamp: Date.now(),
      shopId,
      newType: shopType
    });

    return true;
  }
}