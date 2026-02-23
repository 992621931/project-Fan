/**
 * Property-based tests for Party System
 * **Feature: codename-rice-game, Property 3: 小队组建验证**
 * **Validates: Requirements 2.1**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
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
  AttributeComponent,
  AttributeComponentType
} from '../components/CharacterComponents';
import { 
  PartyComponent,
  PartyComponentType,
  PartyMemberComponent,
  PartyMemberComponentType
} from '../components/PartyComponents';
import { RecruitmentType, FormationType, CharacterStatus } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';
import { DEFAULT_CURRENCY } from '../types/CurrencyTypes';

describe('Party System Property Tests', () => {
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
    
    partySystem = new PartySystem();
    recruitmentSystem = new CharacterRecruitmentSystem();
    attributeSystem = new AttributeSystem();
    
    partySystem.initialize(entityManager, componentManager, eventSystem);
    recruitmentSystem.initialize(entityManager, componentManager, eventSystem);
    attributeSystem.initialize(entityManager, componentManager, eventSystem);

    // Create a test player with currency and inventory
    const playerEntity = entityManager.createEntity();
    playerId = playerEntity.id;
    
    const currency: CurrencyComponent = {
      type: 'currency',
      amounts: { gold: 100000, crystal: 1000, reputation: 1000 }, // Give plenty of resources for testing
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
   * Helper function to create test characters
   */
  function createTestCharacters(count: number): string[] {
    const characters: string[] = [];
    
    // Handle edge case where count is 0
    if (count <= 0) {
      return characters;
    }
    
    // Ensure player has enough currency for recruitment
    const currency = componentManager.getComponent(playerId, CurrencyComponentType);
    if (currency) {
      currency.amounts.gold = Math.max(currency.amounts.gold, count * 200); // Ensure enough gold
    }
    
    for (let i = 0; i < count; i++) {
      const result = recruitmentSystem.recruitWithGold(playerId);
      if (!result.success) {
        console.error(`Failed to recruit character ${i + 1}:`, result.error);
        console.error('Player currency:', currency);
        throw new Error(`Character recruitment failed: ${result.error}`);
      }
      expect(result.success).toBe(true);
      expect(result.character).toBeDefined();
      
      const characterId = result.character!;
      
      // Clean up any existing party member components to ensure test isolation
      const existingPartyMember = componentManager.getComponent(characterId, PartyMemberComponentType);
      if (existingPartyMember) {
        componentManager.removeComponent(characterId, PartyMemberComponentType);
      }
      
      characters.push(characterId);
    }
    
    return characters;
  }

  /**
   * Helper function to create a character with specific status
   */
  function createCharacterWithStatus(status: CharacterStatus, health: number = 100): string {
    const result = recruitmentSystem.recruitWithGold(playerId);
    expect(result.success).toBe(true);
    expect(result.character).toBeDefined();
    
    const characterId = result.character!;
    
    // Update character status
    const characterInfo = componentManager.getComponent(characterId, CharacterInfoComponentType);
    expect(characterInfo).not.toBeNull();
    characterInfo!.status = status;
    
    // Update health if needed
    if (health <= 0) {
      const healthComponent = componentManager.getComponent(characterId, HealthComponentType);
      expect(healthComponent).not.toBeNull();
      healthComponent!.current = health;
    }
    
    return characterId;
  }

  /**
   * Property 3: 小队组建验证
   * For any character combination, the system should correctly validate party validity 
   * (member count, combination rules), accept valid combinations, reject invalid combinations
   */
  it('Property 3: 小队组建验证', () => {
    // Generator for party sizes (including invalid sizes)
    const partySizeGenerator = fc.integer({ min: 0, max: 6 });
    
    // Generator for formation types
    const formationGenerator = fc.constantFrom(
      FormationType.Balanced,
      FormationType.Offensive,
      FormationType.Defensive,
      FormationType.Support
    );

    fc.assert(
      fc.property(partySizeGenerator, formationGenerator, (partySize, formation) => {
        // Create characters for testing
        const availableCharacters = createTestCharacters(Math.max(6, partySize + 2));
        
        // Test different party compositions
        if (partySize === 0) {
          // Empty party should be invalid
          const validation = partySystem.validatePartyComposition([]);
          expect(validation.isValid).toBe(false);
          expect(validation.errors).toContain('Party must have at least 1 member(s)');
          
          // Creating empty party should fail
          const partyId = partySystem.createParty({ members: [], formation });
          expect(partyId).toBeNull();
          
        } else if (partySize > 4) {
          // Oversized party should be invalid
          const members = availableCharacters.slice(0, partySize);
          const validation = partySystem.validatePartyComposition(members);
          expect(validation.isValid).toBe(false);
          expect(validation.errors).toContain('Party cannot have more than 4 members');
          
          // Creating oversized party should fail
          const partyId = partySystem.createParty({ members, formation });
          expect(partyId).toBeNull();
          
        } else {
          // Valid party size (1-4 members)
          const members = availableCharacters.slice(0, partySize);
          const validation = partySystem.validatePartyComposition(members);
          expect(validation.isValid).toBe(true);
          expect(validation.errors.length).toBe(0);
          
          // Creating valid party should succeed
          const partyId = partySystem.createParty({ members, formation });
          expect(partyId).not.toBeNull();
          
          if (partyId) {
            // Verify party was created correctly
            const party = componentManager.getComponent(partyId, PartyComponentType);
            expect(party).not.toBeNull();
            expect(party!.members).toEqual(members);
            expect(party!.formation).toBe(formation);
            expect(party!.maxSize).toBe(4);
            expect(party!.isActive).toBe(false);
            
            // Verify leader assignment
            expect(party!.leader).toBe(members[0]); // Default leader should be first member
            
            // Verify all members have party member components
            members.forEach((memberId, index) => {
              const memberComponent = componentManager.getComponent(memberId, PartyMemberComponentType);
              expect(memberComponent).not.toBeNull();
              expect(memberComponent!.partyId).toBe(partyId);
              expect(memberComponent!.position).toBe(index);
              expect(memberComponent!.isLeader).toBe(index === 0);
            });
            
            // Clean up - disband party for next iteration
            const disbanded = partySystem.disbandParty(partyId);
            expect(disbanded).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should reject parties with duplicate members', () => {
    // Property: Party cannot have duplicate members
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }),
        (partySize) => {
          const characters = createTestCharacters(partySize);
          
          // Create duplicate by repeating first character
          const membersWithDuplicate = [...characters];
          membersWithDuplicate[1] = characters[0]; // Duplicate first character
          
          const validation = partySystem.validatePartyComposition(membersWithDuplicate);
          expect(validation.isValid).toBe(false);
          expect(validation.errors).toContain('Party cannot have duplicate members');
          
          // Creating party with duplicates should fail
          const partyId = partySystem.createParty({ members: membersWithDuplicate });
          expect(partyId).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject parties with unavailable characters', () => {
    // Property: Party cannot include characters that are unavailable
    fc.assert(
      fc.property(
        fc.constantFrom(
          CharacterStatus.Injured,
          CharacterStatus.Working,
          CharacterStatus.Exploring
        ),
        fc.integer({ min: 1, max: 3 }),
        (unavailableStatus, availableCount) => {
          // Create some available characters
          const availableCharacters = createTestCharacters(availableCount);
          
          // Create an unavailable character
          const unavailableCharacter = createCharacterWithStatus(unavailableStatus);
          
          // Try to create party with unavailable character
          const members = [...availableCharacters, unavailableCharacter];
          const validation = partySystem.validatePartyComposition(members);
          
          expect(validation.isValid).toBe(false);
          expect(validation.errors.length).toBeGreaterThan(0);
          
          // Should contain appropriate error message
          const characterInfo = componentManager.getComponent(unavailableCharacter, CharacterInfoComponentType);
          expect(characterInfo).not.toBeNull();
          
          const expectedErrorSubstring = characterInfo!.name;
          const hasExpectedError = validation.errors.some(error => 
            error.includes(expectedErrorSubstring) && 
            (error.includes('injured') || error.includes('working') || error.includes('exploring'))
          );
          expect(hasExpectedError).toBe(true);
          
          // Creating party should fail
          const partyId = partySystem.createParty({ members });
          expect(partyId).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject parties with characters at zero health', () => {
    // Property: Party cannot include characters with zero health
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        (healthyCount) => {
          // Create healthy characters
          const healthyCharacters = createTestCharacters(healthyCount);
          
          // Create character with zero health
          const deadCharacter = createCharacterWithStatus(CharacterStatus.Available, 0);
          
          // Try to create party with dead character
          const members = [...healthyCharacters, deadCharacter];
          const validation = partySystem.validatePartyComposition(members);
          
          expect(validation.isValid).toBe(false);
          expect(validation.errors.length).toBeGreaterThan(0);
          
          // Should contain health-related error
          const characterInfo = componentManager.getComponent(deadCharacter, CharacterInfoComponentType);
          expect(characterInfo).not.toBeNull();
          
          const hasHealthError = validation.errors.some(error => 
            error.includes(characterInfo!.name) && error.includes('no health')
          );
          expect(hasHealthError).toBe(true);
          
          // Creating party should fail
          const partyId = partySystem.createParty({ members });
          expect(partyId).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject characters already in another party', () => {
    // Property: Characters already in a party cannot join another party
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }),
        fc.integer({ min: 1, max: 3 }),
        (firstPartySize, secondPartySize) => {
          const allCharacters = createTestCharacters(firstPartySize + secondPartySize);
          
          // Create first party
          const firstPartyMembers = allCharacters.slice(0, firstPartySize);
          const firstPartyId = partySystem.createParty({ members: firstPartyMembers });
          expect(firstPartyId).not.toBeNull();
          
          // Try to create second party with overlapping member
          const secondPartyMembers = [
            firstPartyMembers[0], // This character is already in first party
            ...allCharacters.slice(firstPartySize, firstPartySize + secondPartySize)
          ];
          
          const validation = partySystem.validatePartyComposition(secondPartyMembers);
          expect(validation.isValid).toBe(false);
          
          // Should contain error about character already in party
          const characterInfo = componentManager.getComponent(firstPartyMembers[0], CharacterInfoComponentType);
          expect(characterInfo).not.toBeNull();
          
          const hasPartyError = validation.errors.some(error => 
            error.includes(characterInfo!.name) && error.includes('already in another party')
          );
          expect(hasPartyError).toBe(true);
          
          // Creating second party should fail
          const secondPartyId = partySystem.createParty({ members: secondPartyMembers });
          expect(secondPartyId).toBeNull();
          
          // Clean up
          partySystem.disbandParty(firstPartyId!);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should provide warnings for suboptimal party compositions', () => {
    // Property: Single-member parties should generate warnings
    fc.assert(
      fc.property(
        fc.constantFrom(FormationType.Balanced, FormationType.Offensive, FormationType.Defensive, FormationType.Support),
        (formation) => {
          const characters = createTestCharacters(1);
          
          const validation = partySystem.validatePartyComposition(characters);
          expect(validation.isValid).toBe(true); // Should be valid but with warnings
          expect(validation.warnings.length).toBeGreaterThan(0);
          expect(validation.warnings).toContain('Single-member parties are more vulnerable in combat');
          
          // Should still be able to create the party
          const partyId = partySystem.createParty({ members: characters, formation });
          expect(partyId).not.toBeNull();
          
          if (partyId) {
            partySystem.disbandParty(partyId);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle party member addition and removal correctly', () => {
    // Property: Adding and removing members should maintain party validity
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 2 }),
        (initialSize, additionalMembers) => {
          const allCharacters = createTestCharacters(initialSize + additionalMembers + 1);
          
          // Create initial party
          const initialMembers = allCharacters.slice(0, initialSize);
          const partyId = partySystem.createParty({ members: initialMembers });
          expect(partyId).not.toBeNull();
          
          if (partyId) {
            // Add members one by one
            for (let i = 0; i < additionalMembers && initialSize + i < 4; i++) {
              const newMember = allCharacters[initialSize + i];
              
              // Debug: Check if character already has party member component
              const existingMemberComponent = componentManager.getComponent(newMember, PartyMemberComponentType);
              if (existingMemberComponent) {
                console.error(`Character ${newMember} already has party member component:`, existingMemberComponent);
              }
              
              // Debug: Check character status
              const characterInfo = componentManager.getComponent(newMember, CharacterInfoComponentType);
              console.log(`Adding character ${characterInfo?.name} (${newMember}) with status ${characterInfo?.status}`);
              
              const added = partySystem.addMember(partyId, newMember);
              if (!added) {
                // Debug: Check why addition failed
                const currentParty = componentManager.getComponent(partyId, PartyComponentType);
                const validation = partySystem.validatePartyComposition([...currentParty!.members, newMember]);
                console.error(`Failed to add member ${newMember}:`, validation.errors);
              }
              expect(added).toBe(true);
              
              // Verify member was added
              const party = componentManager.getComponent(partyId, PartyComponentType);
              expect(party).not.toBeNull();
              expect(party!.members).toContain(newMember);
              
              // Verify member component was created
              const memberComponent = componentManager.getComponent(newMember, PartyMemberComponentType);
              expect(memberComponent).not.toBeNull();
              expect(memberComponent!.partyId).toBe(partyId);
            }
            
            // Try to add member when party is full (should fail)
            if (initialSize + additionalMembers >= 4) {
              const extraMember = allCharacters[allCharacters.length - 1];
              const added = partySystem.addMember(partyId, extraMember);
              expect(added).toBe(false);
            }
            
            // Remove a member
            const party = componentManager.getComponent(partyId, PartyComponentType);
            expect(party).not.toBeNull();
            
            if (party!.members.length > 1) {
              const memberToRemove = party!.members[party!.members.length - 1];
              const removed = partySystem.removeMember(partyId, memberToRemove);
              expect(removed).toBe(true);
              
              // Verify member was removed
              const updatedParty = componentManager.getComponent(partyId, PartyComponentType);
              expect(updatedParty).not.toBeNull();
              expect(updatedParty!.members).not.toContain(memberToRemove);
              
              // Verify member component was removed
              const memberComponent = componentManager.getComponent(memberToRemove, PartyMemberComponentType);
              expect(memberComponent).toBeNull();
            }
            
            // Clean up
            partySystem.disbandParty(partyId);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain leader assignment correctly', () => {
    // Property: Party should always have a valid leader
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }),
        (partySize) => {
          const characters = createTestCharacters(partySize);
          
          // Create party
          const partyId = partySystem.createParty({ members: characters });
          expect(partyId).not.toBeNull();
          
          if (partyId) {
            // Verify initial leader
            const party = componentManager.getComponent(partyId, PartyComponentType);
            expect(party).not.toBeNull();
            expect(party!.leader).toBe(characters[0]);
            
            // Change leader to different member
            const newLeader = characters[characters.length - 1];
            const leaderChanged = partySystem.setLeader(partyId, newLeader);
            expect(leaderChanged).toBe(true);
            
            // Verify leader was changed
            expect(party!.leader).toBe(newLeader);
            
            // Verify leader component flags
            const oldLeaderComponent = componentManager.getComponent(characters[0], PartyMemberComponentType);
            const newLeaderComponent = componentManager.getComponent(newLeader, PartyMemberComponentType);
            
            expect(oldLeaderComponent).not.toBeNull();
            expect(newLeaderComponent).not.toBeNull();
            expect(oldLeaderComponent!.isLeader).toBe(false);
            expect(newLeaderComponent!.isLeader).toBe(true);
            
            // Try to set leader to non-member (should fail)
            const nonMember = createTestCharacters(1)[0];
            const invalidLeaderChange = partySystem.setLeader(partyId, nonMember);
            expect(invalidLeaderChange).toBe(false);
            expect(party!.leader).toBe(newLeader); // Should remain unchanged
            
            // Clean up
            partySystem.disbandParty(partyId);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});