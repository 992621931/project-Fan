/**
 * Property-based tests for CurrencySystem
 * Tests currency operations integrity and reputation unlock mechanisms
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../../ecs/World';
import { CurrencySystem } from './CurrencySystem';
import { CurrencyComponentType } from '../components/SystemComponents';
import { CurrencyAmounts, CurrencyType } from '../types/CurrencyTypes';

describe('CurrencySystem Property Tests', () => {
  let world: World;
  let currencySystem: CurrencySystem;
  let playerId: number;

  beforeEach(() => {
    world = new World();
    currencySystem = new CurrencySystem();
    currencySystem.initialize();
    currencySystem.resetUnlockedFeatures(); // Reset for clean test state
    
    // Create player entity with currency component
    const player = world.createEntity();
    playerId = player.id;
    const currencyComponent = currencySystem.createCurrencyComponent();
    world.addComponent(playerId, CurrencyComponentType, currencyComponent);
  });

  /**
   * Property 25: Currency Operation Integrity
   * For any currency operation (gain/spend), the system should maintain balance integrity
   */
  describe('Property 25: Currency Operation Integrity', () => {
    const currencyAmountArb = fc.record({
      gold: fc.integer({ min: 0, max: 10000 }),
      crystal: fc.integer({ min: 0, max: 1000 }),
      reputation: fc.integer({ min: 0, max: 5000 })
    });

    const partialCurrencyArb = fc.record({
      gold: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
      crystal: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
      reputation: fc.option(fc.integer({ min: 1, max: 500 }), { nil: undefined })
    });

    it('**Validates: Requirements 15.1, 15.2, 15.3** - Adding currency should increase balance correctly', () => {
      fc.assert(fc.property(currencyAmountArb, partialCurrencyArb, (initialAmounts, gain) => {
        // Set initial currency
        currencySystem.setCurrency(world, playerId, initialAmounts, 'Test setup');
        
        const beforeCurrency = currencySystem.getCurrency(world, playerId);
        expect(beforeCurrency).not.toBeNull();
        
        const beforeAmounts = beforeCurrency!.amounts;
        
        // Add currency
        const result = currencySystem.addCurrency(world, playerId, gain, 'Property test');
        
        expect(result.success).toBe(true);
        expect(result.newAmounts).toBeDefined();
        
        const afterCurrency = currencySystem.getCurrency(world, playerId);
        expect(afterCurrency).not.toBeNull();
        
        const afterAmounts = afterCurrency!.amounts;
        
        // Verify amounts increased correctly
        expect(afterAmounts.gold).toBe(beforeAmounts.gold + (gain.gold || 0));
        expect(afterAmounts.crystal).toBe(beforeAmounts.crystal + (gain.crystal || 0));
        expect(afterAmounts.reputation).toBe(beforeAmounts.reputation + (gain.reputation || 0));
        
        // Verify all amounts are non-negative
        expect(afterAmounts.gold).toBeGreaterThanOrEqual(0);
        expect(afterAmounts.crystal).toBeGreaterThanOrEqual(0);
        expect(afterAmounts.reputation).toBeGreaterThanOrEqual(0);
      }));
    });

    it('**Validates: Requirements 15.1, 15.2, 15.3** - Spending currency should decrease balance correctly when sufficient funds', () => {
      fc.assert(fc.property(currencyAmountArb, (initialAmounts) => {
        // Set initial currency
        currencySystem.setCurrency(world, playerId, initialAmounts, 'Test setup');
        
        // Generate a cost that we can afford
        const maxGold = Math.min(initialAmounts.gold, 500);
        const maxCrystal = Math.min(initialAmounts.crystal, 50);
        const maxReputation = Math.min(initialAmounts.reputation, 250);
        
        if (maxGold === 0 && maxCrystal === 0 && maxReputation === 0) {
          return true; // Skip if no currency to spend
        }
        
        const cost = {
          gold: maxGold > 0 ? fc.sample(fc.integer({ min: 1, max: maxGold }), 1)[0] : undefined,
          crystal: maxCrystal > 0 ? fc.sample(fc.integer({ min: 1, max: maxCrystal }), 1)[0] : undefined,
          reputation: maxReputation > 0 ? fc.sample(fc.integer({ min: 1, max: maxReputation }), 1)[0] : undefined
        };
        
        const beforeCurrency = currencySystem.getCurrency(world, playerId);
        expect(beforeCurrency).not.toBeNull();
        
        const beforeAmounts = beforeCurrency!.amounts;
        
        // Spend currency
        const result = currencySystem.spendCurrency(world, playerId, cost, 'Property test');
        
        expect(result.success).toBe(true);
        expect(result.newAmounts).toBeDefined();
        
        const afterCurrency = currencySystem.getCurrency(world, playerId);
        expect(afterCurrency).not.toBeNull();
        
        const afterAmounts = afterCurrency!.amounts;
        
        // Verify amounts decreased correctly
        expect(afterAmounts.gold).toBe(beforeAmounts.gold - (cost.gold || 0));
        expect(afterAmounts.crystal).toBe(beforeAmounts.crystal - (cost.crystal || 0));
        expect(afterAmounts.reputation).toBe(beforeAmounts.reputation - (cost.reputation || 0));
        
        // Verify all amounts are non-negative
        expect(afterAmounts.gold).toBeGreaterThanOrEqual(0);
        expect(afterAmounts.crystal).toBeGreaterThanOrEqual(0);
        expect(afterAmounts.reputation).toBeGreaterThanOrEqual(0);
      }));
    });

    it('**Validates: Requirements 15.1, 15.2, 15.3** - Cannot spend more currency than available', () => {
      fc.assert(fc.property(currencyAmountArb, partialCurrencyArb, (initialAmounts, extraCost) => {
        // Set initial currency
        currencySystem.setCurrency(world, playerId, initialAmounts, 'Test setup');
        
        // Create a cost that exceeds available funds
        const cost = {
          gold: (extraCost.gold || 0) + initialAmounts.gold + 1,
          crystal: (extraCost.crystal || 0) + initialAmounts.crystal + 1,
          reputation: (extraCost.reputation || 0) + initialAmounts.reputation + 1
        };
        
        const beforeCurrency = currencySystem.getCurrency(world, playerId);
        expect(beforeCurrency).not.toBeNull();
        
        const beforeAmounts = beforeCurrency!.amounts;
        
        // Try to spend more than available
        const result = currencySystem.spendCurrency(world, playerId, cost, 'Property test');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Insufficient funds');
        
        // Verify amounts unchanged
        const afterCurrency = currencySystem.getCurrency(world, playerId);
        expect(afterCurrency).not.toBeNull();
        
        const afterAmounts = afterCurrency!.amounts;
        expect(afterAmounts.gold).toBe(beforeAmounts.gold);
        expect(afterAmounts.crystal).toBe(beforeAmounts.crystal);
        expect(afterAmounts.reputation).toBe(beforeAmounts.reputation);
      }));
    });
  });

  /**
   * Property 26: Reputation Unlock Mechanism
   * For any reputation value, reaching specific thresholds should unlock corresponding features
   */
  describe('Property 26: Reputation Unlock Mechanism', () => {
    it('**Validates: Requirements 15.4, 15.5** - Reputation thresholds unlock features correctly', () => {
      const reputationArb = fc.integer({ min: 0, max: 2000 });
      
      fc.assert(fc.property(reputationArb, (targetReputation) => {
        // Reset unlocked features for each test run
        currencySystem.resetUnlockedFeatures();
        
        // Set reputation to target value
        const initialAmounts: CurrencyAmounts = { gold: 100, crystal: 0, reputation: targetReputation };
        currencySystem.setCurrency(world, playerId, initialAmounts, 'Test setup');
        
        const unlocks = currencySystem.getReputationUnlocks();
        const unlockedFeatures = currencySystem.getUnlockedFeatures();
        
        // Check that all features with thresholds <= targetReputation are unlocked
        for (const unlock of unlocks) {
          if (targetReputation >= unlock.threshold) {
            expect(currencySystem.isFeatureUnlocked(unlock.unlockId)).toBe(true);
            expect(unlockedFeatures).toContain(unlock.unlockId);
          } else {
            expect(currencySystem.isFeatureUnlocked(unlock.unlockId)).toBe(false);
            expect(unlockedFeatures).not.toContain(unlock.unlockId);
          }
        }
      }));
    });

    it('**Validates: Requirements 15.4, 15.5** - Increasing reputation unlocks new features', () => {
      const reputationIncreaseArb = fc.record({
        initial: fc.integer({ min: 0, max: 500 }),
        increase: fc.integer({ min: 1, max: 1000 })
      });
      
      fc.assert(fc.property(reputationIncreaseArb, ({ initial, increase }) => {
        // Reset unlocked features for each test run
        currencySystem.resetUnlockedFeatures();
        
        // Set initial reputation
        const initialAmounts: CurrencyAmounts = { gold: 100, crystal: 0, reputation: initial };
        currencySystem.setCurrency(world, playerId, initialAmounts, 'Test setup');
        
        const beforeUnlocked = currencySystem.getUnlockedFeatures();
        
        // Add reputation
        currencySystem.addCurrency(world, playerId, { reputation: increase }, 'Property test');
        
        const afterUnlocked = currencySystem.getUnlockedFeatures();
        const finalReputation = initial + increase;
        
        // Verify that unlocked features only increased (never decreased)
        for (const feature of beforeUnlocked) {
          expect(afterUnlocked).toContain(feature);
        }
        
        // Verify that all features with thresholds <= finalReputation are unlocked
        const unlocks = currencySystem.getReputationUnlocks();
        for (const unlock of unlocks) {
          if (finalReputation >= unlock.threshold) {
            expect(afterUnlocked).toContain(unlock.unlockId);
          }
        }
        
        // Verify that features are only unlocked if threshold is met
        expect(afterUnlocked.length).toBeGreaterThanOrEqual(beforeUnlocked.length);
      }));
    });
  });

  /**
   * Additional integrity tests
   */
  describe('Currency System Integrity', () => {
    it('Transaction history records all operations correctly', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          type: fc.constantFrom('add', 'spend'),
          gold: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          crystal: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
          reputation: fc.option(fc.integer({ min: 1, max: 50 }), { nil: undefined })
        }), { minLength: 1, maxLength: 5 }),
        (operations) => {
          // Start with sufficient funds
          currencySystem.setCurrency(world, playerId, { gold: 10000, crystal: 1000, reputation: 5000 }, 'Test setup');
          
          // Clear history after setup
          const currency = currencySystem.getCurrency(world, playerId);
          if (currency) {
            currency.transactionHistory = [];
          }
          
          let expectedTransactions = 0;
          
          for (const op of operations) {
            // Skip operations with no currency amounts
            const hasAmount = op.gold || op.crystal || op.reputation;
            if (!hasAmount) continue;
            
            if (op.type === 'add') {
              currencySystem.addCurrency(world, playerId, op, 'Test add');
              // Count non-zero amounts
              if (op.gold) expectedTransactions++;
              if (op.crystal) expectedTransactions++;
              if (op.reputation) expectedTransactions++;
            } else {
              const canAfford = currencySystem.canAfford(world, playerId, op);
              if (canAfford) {
                currencySystem.spendCurrency(world, playerId, op, 'Test spend');
                // Count non-zero amounts
                if (op.gold) expectedTransactions++;
                if (op.crystal) expectedTransactions++;
                if (op.reputation) expectedTransactions++;
              }
            }
          }
          
          const history = currencySystem.getTransactionHistory(world, playerId);
          expect(history.length).toBe(expectedTransactions);
          
          // Verify all transactions have required fields
          for (const transaction of history) {
            expect(transaction.type).toMatch(/^(gain|spend)$/);
            expect(transaction.currency).toMatch(/^(gold|crystal|reputation)$/);
            expect(transaction.amount).toBeGreaterThan(0);
            expect(transaction.reason).toBeDefined();
            expect(transaction.timestamp).toBeGreaterThan(0);
          }
        }
      ));
    });
  });
});