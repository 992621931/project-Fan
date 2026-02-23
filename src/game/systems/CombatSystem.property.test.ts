/**
 * Property-based tests for Combat System
 * **Feature: codename-rice-game, Property 4: 战斗结果一致性**
 * **Feature: codename-rice-game, Property 5: 角色状态管理**
 * **Validates: Requirements 2.2, 2.3, 2.5, 14.4**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CombatSystem } from './CombatSystem';
import { PartySystem } from './PartySystem';
import { CharacterRecruitmentSystem } from './CharacterRecruitmentSystem';
import { AttributeSystem } from './AttributeSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { 
  CurrencyComponent, 
  CurrencyComponentType,
  InventoryComponent,
  InventoryComponentType
} from '../components/SystemComponents';
import {
  CharacterInfoComponent,
  CharacterInfoComponentType,
  HealthComponent,
  HealthComponentType,
  ManaComponent,
  ManaComponentType,
  LevelComponent,
  LevelComponentType,
  DerivedStatsComponent,
  DerivedStatsComponentType
} from '../components/CharacterComponents';
import { 
  PartyComponent,
  PartyComponentType,
  EnemyDefinition,
  Encounter
} from '../components/PartyComponents';
import { RecruitmentType, FormationType, CharacterStatus, EncounterType } from '../types/GameTypes';
import { DEFAULT_CURRENCY } from '../types/CurrencyTypes';

describe('Combat System Property Tests', () => {
  let combatSystem: CombatSystem;
  let partySystem: PartySystem;
  let recruitmentSystem: CharacterRecruitmentSystem;
  let attributeSystem: AttributeSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;
  let playerId: string;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    
    combatSystem = new CombatSystem();
    partySystem = new PartySystem();
    recruitmentSystem = new CharacterRecruitmentSystem();
    attributeSystem = new AttributeSystem();
    
    combatSystem.initialize(entityManager, componentManager, eventSystem);
    partySystem.initialize(entityManager, componentManager, eventSystem);
    recruitmentSystem.initialize(entityManager, componentManager, eventSystem);
    attributeSystem.initialize(entityManager, componentManager, eventSystem);

    // Create a test player with currency and inventory
    const playerEntity = entityManager.createEntity();
    playerId = playerEntity.id;
    
    const currency: CurrencyComponent = {
      type: 'currency',
      amounts: { ...DEFAULT_CURRENCY, gold: 10000 },
      transactionHistory: []
    };
    
    const inventory: InventoryComponent = {
      type: 'inventory',
      slots: Array(50).fill(null).map(() => ({ item: null, quantity: 0, locked: false })),
      capacity: 50
    };
    
    componentManager.addComponent(playerId, CurrencyComponentType, currency);
    componentManager.addComponent(playerId, InventoryComponentType, inventory);
  });

  /**
   * Helper function to create a test party
   */
  function createTestParty(memberCount: number): string {
    const characters: string[] = [];
    
    // Create characters with sufficient gold
    const currency = componentManager.getComponent(playerId, CurrencyComponentType);
    if (currency) {
      currency.amounts.gold = memberCount * 200; // Ensure enough gold
    }
    
    for (let i = 0; i < memberCount; i++) {
      const result = recruitmentSystem.recruitWithGold(playerId);
      if (result.success && result.character) {
        characters.push(result.character);
      }
    }
    
    if (characters.length === 0) {
      throw new Error('Failed to create test characters');
    }
    
    const partyId = partySystem.createParty({ 
      members: characters, 
      formation: FormationType.Balanced 
    });
    
    if (!partyId) {
      throw new Error('Failed to create test party');
    }
    
    // Set party as active for combat
    const party = componentManager.getComponent(partyId, PartyComponentType);
    if (party) {
      party.isActive = true;
    }
    
    return partyId;
  }

  /**
   * Helper function to create test enemies
   */
  function createTestEnemies(count: number, level: number = 1): EnemyDefinition[] {
    const enemies: EnemyDefinition[] = [];
    
    for (let i = 0; i < count; i++) {
      enemies.push({
        id: `enemy_${i}`,
        name: `Test Enemy ${i + 1}`,
        level,
        health: 50 + level * 10,
        attack: 10 + level * 2,
        defense: 5 + level,
        skills: ['basic_attack'],
        dropTable: [
          {
            itemId: 'gold',
            dropRate: 0.5,
            quantity: { min: 1, max: 10 }
          }
        ]
      });
    }
    
    return enemies;
  }

  /**
   * Helper function to create test encounter
   */
  function createTestEncounter(enemyCount: number, enemyLevel: number = 1): Encounter {
    return {
      id: 'test_encounter',
      type: EncounterType.Combat,
      enemies: createTestEnemies(enemyCount, enemyLevel),
      difficulty: enemyLevel
    };
  }

  /**
   * Property 4: 战斗结果一致性
   * For any party and encounter combination, combat results should be based on 
   * reasonable calculation of party strength vs encounter difficulty, with 
   * experience distributed to all participating characters upon victory
   */
  it('Property 4: 战斗结果一致性', () => {
    // Generator for party sizes
    const partySizeGenerator = fc.integer({ min: 1, max: 4 });
    
    // Generator for enemy configurations
    const enemyConfigGenerator = fc.record({
      count: fc.integer({ min: 1, max: 3 }),
      level: fc.integer({ min: 1, max: 5 })
    });

    fc.assert(
      fc.property(partySizeGenerator, enemyConfigGenerator, (partySize, enemyConfig) => {
        try {
          // Create test party
          const partyId = createTestParty(partySize);
          const party = componentManager.getComponent(partyId, PartyComponentType);
          expect(party).not.toBeNull();

          // Get initial party member levels for experience comparison
          const initialLevels = new Map<string, number>();
          const initialExperience = new Map<string, number>();
          
          party!.members.forEach(memberId => {
            const level = componentManager.getComponent(memberId, LevelComponentType);
            if (level) {
              initialLevels.set(memberId, level.level);
              initialExperience.set(memberId, level.experience);
            }
          });

          // Create test encounter
          const encounter = createTestEncounter(enemyConfig.count, enemyConfig.level);

          // Start combat
          const combatId = combatSystem.startCombat(partyId, encounter);
          expect(combatId).not.toBeNull();

          if (combatId) {
            // Verify combat started correctly
            const combatInfo = combatSystem.getCombatInfo(combatId);
            expect(combatInfo).not.toBeNull();
            expect(combatInfo!.isActive).toBe(true);
            expect(combatInfo!.participants.length).toBe(partySize + enemyConfig.count);

            // Verify party members are in combat
            party!.members.forEach(memberId => {
              expect(combatSystem.isInCombat(memberId)).toBe(true);
            });

            // Simulate combat by dealing damage to all enemies (force victory)
            const enemies = combatInfo!.participants.filter(p => p.isEnemy);
            enemies.forEach(enemy => {
              combatSystem.applyDamage(enemy.id, enemy.health.maximum);
            });

            // Update combat to trigger end condition
            combatSystem.update(0);

            // Verify combat ended with victory
            const finalCombatInfo = combatSystem.getCombatInfo(combatId);
            expect(finalCombatInfo).toBeNull(); // Combat should be cleaned up

            // Verify experience was distributed (Requirements 2.2, 2.3)
            let experienceGained = false;
            party!.members.forEach(memberId => {
              const level = componentManager.getComponent(memberId, LevelComponentType);
              const health = componentManager.getComponent(memberId, HealthComponentType);
              
              if (level && health && health.current > 0) { // Only survivors get experience
                const initialLevel = initialLevels.get(memberId) || 1;
                const initialExp = initialExperience.get(memberId) || 0;
                
                if (level.level > initialLevel || level.experience > initialExp) {
                  experienceGained = true;
                }
              }
            });

            // Should have gained experience from victory
            expect(experienceGained).toBe(true);

            // Verify party members are no longer in combat
            party!.members.forEach(memberId => {
              expect(combatSystem.isInCombat(memberId)).toBe(false);
            });
          }

          // Clean up
          partySystem.disbandParty(partyId);
          
        } catch (error) {
          // If we can't create the test setup, skip this iteration
          // This handles cases where recruitment fails due to insufficient resources
          if (error instanceof Error && error.message.includes('Failed to create')) {
            return; // Skip this test case
          }
          throw error;
        }
      }),
      { numRuns: 20 } // Reduced runs due to complexity
    );
  });

  /**
   * Property 5: 角色状态管理
   * For any character, when health drops to 0 they should be marked as unable to act,
   * cannot participate in combat and work
   */
  it('Property 5: 角色状态管理', () => {
    // Generator for damage amounts
    const damageGenerator = fc.integer({ min: 50, max: 200 });

    fc.assert(
      fc.property(damageGenerator, (damageAmount) => {
        try {
          // Create a test character
          const currency = componentManager.getComponent(playerId, CurrencyComponentType);
          if (currency) {
            currency.amounts.gold = 500; // Ensure enough gold
          }
          
          const result = recruitmentSystem.recruitWithGold(playerId);
          if (!result.success || !result.character) {
            return; // Skip if recruitment fails
          }
          
          const characterId = result.character;

          // Get initial health and status
          const health = componentManager.getComponent(characterId, HealthComponentType);
          const characterInfo = componentManager.getComponent(characterId, CharacterInfoComponentType);
          
          expect(health).not.toBeNull();
          expect(characterInfo).not.toBeNull();
          expect(health!.current).toBeGreaterThan(0);
          expect(characterInfo!.status).toBe(CharacterStatus.Available);

          const initialHealth = health!.current;

          // Apply damage
          const targetDied = combatSystem.applyDamage(characterId, damageAmount);

          // Verify health was reduced
          expect(health!.current).toBeLessThanOrEqual(initialHealth);

          if (damageAmount >= initialHealth) {
            // Character should have died (Requirement 2.5, 14.4)
            expect(health!.current).toBe(0);
            expect(targetDied).toBe(true);
            
            // Character should be marked as injured
            expect(characterInfo!.status).toBe(CharacterStatus.Injured);

            // Try to create a party with the injured character
            const partyId = partySystem.createParty({ 
              members: [characterId], 
              formation: FormationType.Balanced 
            });
            
            // Should fail because character is injured
            expect(partyId).toBeNull();

            // Verify validation fails for injured character
            const validation = partySystem.validatePartyComposition([characterId]);
            expect(validation.isValid).toBe(false);
            expect(validation.errors.some(error => 
              error.includes(characterInfo!.name) && error.includes('injured')
            )).toBe(true);

          } else {
            // Character should still be alive
            expect(health!.current).toBeGreaterThan(0);
            expect(targetDied).toBe(false);
            expect(characterInfo!.status).toBe(CharacterStatus.Available);

            // Should still be able to create party with healthy character
            const partyId = partySystem.createParty({ 
              members: [characterId], 
              formation: FormationType.Balanced 
            });
            
            expect(partyId).not.toBeNull();
            
            if (partyId) {
              partySystem.disbandParty(partyId);
            }
          }
          
        } catch (error) {
          // Handle recruitment failures gracefully
          if (error instanceof Error && error.message.includes('recruitment')) {
            return; // Skip this test case
          }
          throw error;
        }
      }),
      { numRuns: 50 }
    );
  });

  it('should calculate damage correctly with various factors', () => {
    // Property: Damage calculation should consider attack, defense, critical hits, and blocking
    fc.assert(
      fc.property(
        fc.record({
          attackerAttack: fc.integer({ min: 10, max: 100 }),
          attackerCritRate: fc.integer({ min: 0, max: 50 }),
          attackerCritDamage: fc.integer({ min: 100, max: 300 }),
          targetDefense: fc.integer({ min: 0, max: 50 }),
          targetDodgeRate: fc.integer({ min: 0, max: 30 })
        }),
        (stats) => {
          try {
            // Create attacker and target
            const currency = componentManager.getComponent(playerId, CurrencyComponentType);
            if (currency) {
              currency.amounts.gold = 1000;
            }
            
            const attackerResult = recruitmentSystem.recruitWithGold(playerId);
            const targetResult = recruitmentSystem.recruitWithGold(playerId);
            
            if (!attackerResult.success || !targetResult.success || 
                !attackerResult.character || !targetResult.character) {
              return; // Skip if recruitment fails
            }

            const attackerId = attackerResult.character;
            const targetId = targetResult.character;

            // Set up attacker stats
            const attackerStats = componentManager.getComponent(attackerId, DerivedStatsComponentType);
            if (attackerStats) {
              attackerStats.attack = stats.attackerAttack;
              attackerStats.critRate = stats.attackerCritRate;
              attackerStats.critDamage = stats.attackerCritDamage;
            }

            // Set up target stats
            const targetStats = componentManager.getComponent(targetId, DerivedStatsComponentType);
            if (targetStats) {
              targetStats.defense = stats.targetDefense;
              targetStats.dodgeRate = stats.targetDodgeRate;
            }

            // Calculate damage multiple times to test consistency
            for (let i = 0; i < 5; i++) {
              const damageResult = combatSystem.calculateDamage(attackerId, targetId);
              
              // Verify damage result structure
              expect(damageResult).toHaveProperty('damage');
              expect(damageResult).toHaveProperty('isCritical');
              expect(damageResult).toHaveProperty('isBlocked');
              expect(damageResult).toHaveProperty('actualDamage');
              
              // Verify damage is positive
              expect(damageResult.actualDamage).toBeGreaterThan(0);
              
              // Verify critical hits increase damage when critDamage > 100
              if (damageResult.isCritical && stats.attackerCritDamage > 100) {
                expect(damageResult.damage).toBeGreaterThan(stats.attackerAttack * 0.8); // Account for variance
              }
              
              // Verify blocked attacks reduce damage
              if (damageResult.isBlocked) {
                expect(damageResult.actualDamage).toBeLessThanOrEqual(damageResult.damage);
              }
              
              // Verify actual damage doesn't exceed base damage by too much
              expect(damageResult.actualDamage).toBeLessThanOrEqual(damageResult.damage * 2);
            }
            
          } catch (error) {
            // Handle setup failures gracefully
            if (error instanceof Error && error.message.includes('recruitment')) {
              return;
            }
            throw error;
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should handle combat state transitions correctly', () => {
    // Property: Combat should properly transition between states and clean up resources
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 2 }),
        (partySize, enemyCount) => {
          try {
            // Create test party
            const partyId = createTestParty(partySize);
            const encounter = createTestEncounter(enemyCount, 1);

            // Verify initial state
            expect(combatSystem.isInCombat(partyId)).toBe(false);

            // Start combat
            const combatId = combatSystem.startCombat(partyId, encounter);
            expect(combatId).not.toBeNull();

            if (combatId) {
              // Verify combat state
              const combatInfo = combatSystem.getCombatInfo(combatId);
              expect(combatInfo).not.toBeNull();
              expect(combatInfo!.isActive).toBe(true);
              
              // Verify participants
              const heroes = combatInfo!.participants.filter(p => !p.isEnemy);
              const enemies = combatInfo!.participants.filter(p => p.isEnemy);
              
              expect(heroes.length).toBe(partySize);
              expect(enemies.length).toBe(enemyCount);
              
              // All participants should be alive initially
              expect(heroes.every(h => h.isAlive)).toBe(true);
              expect(enemies.every(e => e.isAlive)).toBe(true);

              // Force combat end by defeating all enemies
              enemies.forEach(enemy => {
                combatSystem.applyDamage(enemy.id, enemy.health.maximum);
              });

              // Update to trigger combat end
              combatSystem.update(0);

              // Verify combat cleanup
              expect(combatSystem.getCombatInfo(combatId)).toBeNull();
              expect(combatSystem.isInCombat(partyId)).toBe(false);
            }

            // Clean up
            partySystem.disbandParty(partyId);
            
          } catch (error) {
            if (error instanceof Error && error.message.includes('Failed to create')) {
              return;
            }
            throw error;
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain health bounds and prevent negative values', () => {
    // Property: Health should never go below 0 and damage should be properly applied
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        (damageAmount) => {
          try {
            // Create test character
            const currency = componentManager.getComponent(playerId, CurrencyComponentType);
            if (currency) {
              currency.amounts.gold = 200;
            }
            
            const result = recruitmentSystem.recruitWithGold(playerId);
            if (!result.success || !result.character) {
              return;
            }
            
            const characterId = result.character;
            const health = componentManager.getComponent(characterId, HealthComponentType);
            
            expect(health).not.toBeNull();
            const initialHealth = health!.current;
            const maxHealth = health!.maximum;
            
            // Verify initial health is valid
            expect(initialHealth).toBeGreaterThan(0);
            expect(initialHealth).toBeLessThanOrEqual(maxHealth);
            
            // Apply damage
            combatSystem.applyDamage(characterId, damageAmount);
            
            // Verify health bounds
            expect(health!.current).toBeGreaterThanOrEqual(0);
            expect(health!.current).toBeLessThanOrEqual(maxHealth);
            expect(health!.current).toBeLessThanOrEqual(initialHealth);
            
            // If damage was greater than health, character should be at 0 health
            if (damageAmount >= initialHealth) {
              expect(health!.current).toBe(0);
            } else {
              expect(health!.current).toBe(initialHealth - damageAmount);
            }
            
          } catch (error) {
            if (error instanceof Error && error.message.includes('recruitment')) {
              return;
            }
            throw error;
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});