/**
 * CurrencySystem - Manages all currency operations and reputation unlocks
 * Handles gold, crystal, and reputation transactions with validation
 */

import { System } from '../../ecs/System';
import { World } from '../../ecs/World';
import { EntityId } from '../../ecs/Entity';
import { CurrencyComponent, CurrencyComponentType, CurrencyTransaction } from '../components/SystemComponents';
import { CurrencyAmounts, CurrencyValidator } from '../types/CurrencyTypes';

export interface ReputationUnlock {
  threshold: number;
  unlockId: string;
  name: string;
  description: string;
}

export interface CurrencyOperationResult {
  success: boolean;
  newAmounts?: CurrencyAmounts;
  error?: string;
}

export class CurrencySystem extends System {
  public readonly name = 'CurrencySystem';
  public readonly requiredComponents = [CurrencyComponentType];

  private reputationUnlocks: ReputationUnlock[] = [
    { threshold: 100, unlockId: 'premium_shop', name: 'Premium Shop', description: 'Access to premium items' },
    { threshold: 250, unlockId: 'advanced_crafting', name: 'Advanced Crafting', description: 'Unlock advanced recipes' },
    { threshold: 500, unlockId: 'guild_features', name: 'Guild Features', description: 'Access to guild system' },
    { threshold: 1000, unlockId: 'legendary_content', name: 'Legendary Content', description: 'Access to legendary quests' },
  ];

  private unlockedFeatures: Set<string> = new Set();

  protected onInitialize(): void {
    // System initialization
  }

  public update(deltaTime: number): void {
    // Currency system doesn't need regular updates
    // All operations are event-driven
  }

  protected onShutdown(): void {
    this.unlockedFeatures.clear();
  }

  /**
   * Get currency component for an entity (usually player)
   */
  public getCurrency(world: World, entityId: EntityId): CurrencyComponent | null {
    return world.getComponent(entityId, CurrencyComponentType);
  }

  /**
   * Create initial currency component for new player
   */
  public createCurrencyComponent(initialAmounts?: Partial<CurrencyAmounts>): CurrencyComponent {
    const amounts: CurrencyAmounts = {
      gold: initialAmounts?.gold ?? 0,
      crystal: initialAmounts?.crystal ?? 0,
      reputation: initialAmounts?.reputation ?? 0,
    };

    return {
      type: 'currency',
      amounts,
      transactionHistory: [],
    };
  }

  /**
   * Check if entity can afford a cost
   */
  public canAfford(world: World, entityId: EntityId, cost: Partial<CurrencyAmounts>): boolean {
    const currency = this.getCurrency(world, entityId);
    if (!currency) return false;

    return CurrencyValidator.canAfford(currency.amounts, cost);
  }

  /**
   * Add currency to an entity
   */
  public addCurrency(
    world: World,
    entityId: EntityId,
    gain: Partial<CurrencyAmounts>,
    reason: string = 'Unknown'
  ): CurrencyOperationResult {
    const currency = this.getCurrency(world, entityId);
    if (!currency) {
      return { success: false, error: 'Entity has no currency component' };
    }

    const newAmounts = CurrencyValidator.add(currency.amounts, gain);
    
    if (!CurrencyValidator.isValid(newAmounts)) {
      return { success: false, error: 'Invalid currency amounts' };
    }

    // Update currency amounts
    currency.amounts = newAmounts;

    // Record transactions
    const timestamp = Date.now();
    if (gain.gold && gain.gold > 0) {
      currency.transactionHistory.push({
        type: 'gain',
        currency: 'gold',
        amount: gain.gold,
        reason,
        timestamp,
      });
    }
    if (gain.crystal && gain.crystal > 0) {
      currency.transactionHistory.push({
        type: 'gain',
        currency: 'crystal',
        amount: gain.crystal,
        reason,
        timestamp,
      });
    }
    if (gain.reputation && gain.reputation > 0) {
      currency.transactionHistory.push({
        type: 'gain',
        currency: 'reputation',
        amount: gain.reputation,
        reason,
        timestamp,
      });

      // Check for reputation unlocks
      this.checkReputationUnlocks(newAmounts.reputation);
    }

    return { success: true, newAmounts };
  }

  /**
   * Spend currency from an entity
   */
  public spendCurrency(
    world: World,
    entityId: EntityId,
    cost: Partial<CurrencyAmounts>,
    reason: string = 'Unknown'
  ): CurrencyOperationResult {
    const currency = this.getCurrency(world, entityId);
    if (!currency) {
      return { success: false, error: 'Entity has no currency component' };
    }

    // Check if can afford
    if (!CurrencyValidator.canAfford(currency.amounts, cost)) {
      return { success: false, error: 'Insufficient funds' };
    }

    const newAmounts = CurrencyValidator.subtract(currency.amounts, cost);
    
    if (!CurrencyValidator.isValid(newAmounts)) {
      return { success: false, error: 'Invalid currency amounts after spending' };
    }

    // Update currency amounts
    currency.amounts = newAmounts;

    // Record transactions
    const timestamp = Date.now();
    if (cost.gold && cost.gold > 0) {
      currency.transactionHistory.push({
        type: 'spend',
        currency: 'gold',
        amount: cost.gold,
        reason,
        timestamp,
      });
    }
    if (cost.crystal && cost.crystal > 0) {
      currency.transactionHistory.push({
        type: 'spend',
        currency: 'crystal',
        amount: cost.crystal,
        reason,
        timestamp,
      });
    }
    if (cost.reputation && cost.reputation > 0) {
      currency.transactionHistory.push({
        type: 'spend',
        currency: 'reputation',
        amount: cost.reputation,
        reason,
        timestamp,
      });
    }

    return { success: true, newAmounts };
  }

  /**
   * Transfer currency between entities
   */
  public transferCurrency(
    world: World,
    fromEntityId: EntityId,
    toEntityId: EntityId,
    amount: Partial<CurrencyAmounts>,
    reason: string = 'Transfer'
  ): CurrencyOperationResult {
    // Spend from source
    const spendResult = this.spendCurrency(world, fromEntityId, amount, `Transfer to ${toEntityId}: ${reason}`);
    if (!spendResult.success) {
      return spendResult;
    }

    // Add to target
    const addResult = this.addCurrency(world, toEntityId, amount, `Transfer from ${fromEntityId}: ${reason}`);
    if (!addResult.success) {
      // Rollback the spend operation
      this.addCurrency(world, fromEntityId, amount, `Rollback failed transfer: ${reason}`);
      return addResult;
    }

    return { success: true, newAmounts: spendResult.newAmounts };
  }

  /**
   * Get transaction history for an entity
   */
  public getTransactionHistory(world: World, entityId: EntityId, limit?: number): CurrencyTransaction[] {
    const currency = this.getCurrency(world, entityId);
    if (!currency) return [];

    const history = [...currency.transactionHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Check and unlock features based on reputation
   */
  private checkReputationUnlocks(currentReputation: number): void {
    for (const unlock of this.reputationUnlocks) {
      if (currentReputation >= unlock.threshold && !this.unlockedFeatures.has(unlock.unlockId)) {
        this.unlockedFeatures.add(unlock.unlockId);
        
        // Emit unlock event
        this.eventSystem?.emit({
          type: 'reputation_unlock',
          timestamp: Date.now(),
          unlockId: unlock.unlockId,
          name: unlock.name,
          description: unlock.description,
          threshold: unlock.threshold,
        });
      }
    }
  }

  /**
   * Check if a feature is unlocked by reputation
   */
  public isFeatureUnlocked(unlockId: string): boolean {
    return this.unlockedFeatures.has(unlockId);
  }

  /**
   * Get all available reputation unlocks
   */
  public getReputationUnlocks(): ReputationUnlock[] {
    return [...this.reputationUnlocks];
  }

  /**
   * Reset unlocked features (for testing)
   */
  public resetUnlockedFeatures(): void {
    this.unlockedFeatures.clear();
  }

  /**
   * Get unlocked features
   */
  public getUnlockedFeatures(): string[] {
    return Array.from(this.unlockedFeatures);
  }

  /**
   * Set currency amounts directly (for testing/admin purposes)
   */
  public setCurrency(
    world: World,
    entityId: EntityId,
    amounts: CurrencyAmounts,
    reason: string = 'Admin set'
  ): CurrencyOperationResult {
    const currency = this.getCurrency(world, entityId);
    if (!currency) {
      return { success: false, error: 'Entity has no currency component' };
    }

    if (!CurrencyValidator.isValid(amounts)) {
      return { success: false, error: 'Invalid currency amounts' };
    }

    const oldAmounts = currency.amounts;
    currency.amounts = amounts;

    // Record the change as a transaction
    const timestamp = Date.now();
    currency.transactionHistory.push({
      type: amounts.gold >= oldAmounts.gold ? 'gain' : 'spend',
      currency: 'gold',
      amount: Math.abs(amounts.gold - oldAmounts.gold),
      reason,
      timestamp,
    });

    // Check reputation unlocks if reputation changed
    if (amounts.reputation !== oldAmounts.reputation) {
      this.checkReputationUnlocks(amounts.reputation);
    }

    return { success: true, newAmounts: amounts };
  }
}