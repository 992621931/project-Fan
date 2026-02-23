/**
 * Currency system types
 * Defines the three-currency system used in the game
 */

export interface CurrencyAmounts {
  gold: number;      // 金币 - Primary currency for basic transactions
  crystal: number;   // 水晶 - Premium currency for special features
  reputation: number; // 声望 - Social currency for unlocking content
}

export enum CurrencyType {
  Gold = 'gold',
  Crystal = 'crystal',
  Reputation = 'reputation'
}

export interface CurrencyTransaction {
  type: CurrencyType;
  amount: number;
  reason: string;
  timestamp: number;
}

/**
 * Currency validation utilities
 */
export class CurrencyValidator {
  /**
   * Check if the given amounts are sufficient for a transaction
   */
  static canAfford(current: CurrencyAmounts, required: Partial<CurrencyAmounts>): boolean {
    if (required.gold && current.gold < required.gold) return false;
    if (required.crystal && current.crystal < required.crystal) return false;
    if (required.reputation && current.reputation < required.reputation) return false;
    return true;
  }

  /**
   * Subtract currency amounts (returns new object)
   */
  static subtract(current: CurrencyAmounts, cost: Partial<CurrencyAmounts>): CurrencyAmounts {
    return {
      gold: current.gold - (cost.gold || 0),
      crystal: current.crystal - (cost.crystal || 0),
      reputation: current.reputation - (cost.reputation || 0)
    };
  }

  /**
   * Add currency amounts (returns new object)
   */
  static add(current: CurrencyAmounts, gain: Partial<CurrencyAmounts>): CurrencyAmounts {
    return {
      gold: current.gold + (gain.gold || 0),
      crystal: current.crystal + (gain.crystal || 0),
      reputation: current.reputation + (gain.reputation || 0)
    };
  }

  /**
   * Validate currency amounts are non-negative
   */
  static isValid(amounts: CurrencyAmounts): boolean {
    return amounts.gold >= 0 && amounts.crystal >= 0 && amounts.reputation >= 0;
  }
}

/**
 * Default currency amounts for new players
 */
export const DEFAULT_CURRENCY: CurrencyAmounts = {
  gold: 100,
  crystal: 0,
  reputation: 0
};