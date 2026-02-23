/**
 * Property-based tests for Dialogue System
 * **Feature: affinity-dialogue-system, Property 1: Dialogue Structure Validation**
 * **Validates: Requirements 7.2, 7.3, 7.4**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DialogueSystem, DialogueTopic, ResponseOption } from './DialogueSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { World } from '../../ecs/World';
import { AffinityComponent, AffinityComponentType } from '../components/CharacterComponents';

describe('Dialogue System Property Tests', () => {
  let dialogueSystem: DialogueSystem;
  let affinitySystem: any;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;
  let world: World;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    world = new World();
    
    // Initialize AffinitySystem and add to world
    affinitySystem = {
      name: 'AffinitySystem',
      getAffinityLevel: (playerId: any, characterId: any) => {
        // Try to get the affinity component using the proper component type
        const affinity = componentManager.getComponent(playerId, AffinityComponentType);
        if (!affinity) return 0;
        return affinity.relationships.get(characterId) || 0;
      },
      setAffinityLevel: (playerId: any, characterId: any, level: number) => {
        const playerAffinity = componentManager.getComponent(playerId, AffinityComponentType);
        const characterAffinity = componentManager.getComponent(characterId, AffinityComponentType);
        
        if (playerAffinity) {
          playerAffinity.relationships.set(characterId, level);
        }
        if (characterAffinity) {
          characterAffinity.relationships.set(playerId, level);
        }
      }
    };
    
    // Mock world.getSystem to return our systems
    world.getSystem = ((name: string) => {
      if (name === 'AffinitySystem') return affinitySystem;
      if (name === 'NPCSystem') return null;
      return null;
    }) as any;
    
    dialogueSystem = new DialogueSystem(world);
    dialogueSystem.initialize(entityManager, componentManager, eventSystem);
  });

  /**
   * Property 1: Dialogue Structure Validation
   * For any loaded dialogue topic, it must contain valid character ID, topic ID, 
   * NPC text, and 2-4 response options
   * **Validates: Requirements 7.2, 7.3, 7.4**
   */
  it('Property 1: Dialogue Structure Validation', () => {
    // Generator for valid response options (2-4 responses)
    const responseOptionGenerator = fc.record({
      text: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      affinityEffect: fc.integer({ min: -10, max: 10 })
    });

    // Generator for valid dialogue topics
    const validDialogueGenerator = fc.record({
      id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      characterId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      topic: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      npcText: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
      responses: fc.array(responseOptionGenerator, { minLength: 2, maxLength: 4 })
    });

    fc.assert(
      fc.property(
        fc.array(validDialogueGenerator, { minLength: 1, maxLength: 10 }),
        (dialogues) => {
          // Create dialogue data structure
          const dialoguesData = {
            dialogues: dialogues
          };

          // Load dialogues into the system
          dialogueSystem.loadDialogues(dialoguesData);

          // Verify each dialogue was loaded correctly
          dialogues.forEach(dialogue => {
            // Requirement 7.2: Dialogue must include dialogue ID, character ID, NPC text
            expect(dialogue.id).toBeDefined();
            expect(dialogue.id.length).toBeGreaterThan(0);
            expect(dialogue.characterId).toBeDefined();
            expect(dialogue.characterId.length).toBeGreaterThan(0);
            expect(dialogue.npcText).toBeDefined();
            expect(dialogue.npcText.length).toBeGreaterThan(0);

            // Requirement 7.3: Dialogue must include response options array
            expect(dialogue.responses).toBeDefined();
            expect(Array.isArray(dialogue.responses)).toBe(true);

            // Requirement 7.4: Response options must be 2-4 in count
            expect(dialogue.responses.length).toBeGreaterThanOrEqual(2);
            expect(dialogue.responses.length).toBeLessThanOrEqual(4);

            // Verify each response option has required fields
            dialogue.responses.forEach((response: ResponseOption) => {
              expect(response.text).toBeDefined();
              expect(response.text.length).toBeGreaterThan(0);
              expect(typeof response.affinityEffect).toBe('number');
              expect(response.affinityEffect).toBeGreaterThanOrEqual(-10);
              expect(response.affinityEffect).toBeLessThanOrEqual(10);
            });

            // Verify the dialogue is accessible through the system
            const characterDialogues = dialogueSystem.getCharacterDialogues(dialogue.characterId);
            expect(characterDialogues.length).toBeGreaterThan(0);

            // Find the loaded dialogue
            const loadedDialogue = characterDialogues.find(d => d.id === dialogue.id);
            expect(loadedDialogue).toBeDefined();

            if (loadedDialogue) {
              // Verify structure matches requirements
              expect(loadedDialogue.id).toBe(dialogue.id);
              expect(loadedDialogue.characterId).toBe(dialogue.characterId);
              expect(loadedDialogue.npcText).toBe(dialogue.npcText);
              expect(loadedDialogue.responses.length).toBe(dialogue.responses.length);
              expect(loadedDialogue.responses.length).toBeGreaterThanOrEqual(2);
              expect(loadedDialogue.responses.length).toBeLessThanOrEqual(4);
            }

            // Verify hasDialogues returns true for this character
            expect(dialogueSystem.hasDialogues(dialogue.characterId)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid dialogue structures should be rejected
   * Validates that the system properly rejects malformed dialogue data
   */
  it('should reject invalid dialogue structures', () => {
    // Generator for invalid dialogues (missing required fields or invalid response counts)
    const invalidDialogueGenerator = fc.oneof(
      // Missing id
      fc.record({
        characterId: fc.string({ minLength: 1 }),
        npcText: fc.string({ minLength: 1 }),
        responses: fc.array(
          fc.record({
            text: fc.string({ minLength: 1 }),
            affinityEffect: fc.integer({ min: -10, max: 10 })
          }),
          { minLength: 2, maxLength: 4 }
        )
      }),
      // Missing characterId
      fc.record({
        id: fc.string({ minLength: 1 }),
        npcText: fc.string({ minLength: 1 }),
        responses: fc.array(
          fc.record({
            text: fc.string({ minLength: 1 }),
            affinityEffect: fc.integer({ min: -10, max: 10 })
          }),
          { minLength: 2, maxLength: 4 }
        )
      }),
      // Missing npcText
      fc.record({
        id: fc.string({ minLength: 1 }),
        characterId: fc.string({ minLength: 1 }),
        responses: fc.array(
          fc.record({
            text: fc.string({ minLength: 1 }),
            affinityEffect: fc.integer({ min: -10, max: 10 })
          }),
          { minLength: 2, maxLength: 4 }
        )
      }),
      // Too few responses (0-1)
      fc.record({
        id: fc.string({ minLength: 1 }),
        characterId: fc.string({ minLength: 1 }),
        npcText: fc.string({ minLength: 1 }),
        responses: fc.array(
          fc.record({
            text: fc.string({ minLength: 1 }),
            affinityEffect: fc.integer({ min: -10, max: 10 })
          }),
          { minLength: 0, maxLength: 1 }
        )
      }),
      // Too many responses (5+)
      fc.record({
        id: fc.string({ minLength: 1 }),
        characterId: fc.string({ minLength: 1 }),
        npcText: fc.string({ minLength: 1 }),
        responses: fc.array(
          fc.record({
            text: fc.string({ minLength: 1 }),
            affinityEffect: fc.integer({ min: -10, max: 10 })
          }),
          { minLength: 5, maxLength: 10 }
        )
      }),
      // Invalid affinity effect (out of range)
      fc.record({
        id: fc.string({ minLength: 1 }),
        characterId: fc.string({ minLength: 1 }),
        npcText: fc.string({ minLength: 1 }),
        responses: fc.array(
          fc.record({
            text: fc.string({ minLength: 1 }),
            affinityEffect: fc.integer({ min: -100, max: 100 }).filter(n => n < -10 || n > 10)
          }),
          { minLength: 2, maxLength: 4 }
        )
      })
    );

    fc.assert(
      fc.property(
        invalidDialogueGenerator,
        (invalidDialogue) => {
          const dialoguesData = {
            dialogues: [invalidDialogue]
          };

          // Load dialogues - invalid ones should be skipped
          dialogueSystem.loadDialogues(dialoguesData);

          // If characterId exists, check that invalid dialogue was not loaded
          if (invalidDialogue.characterId) {
            const characterDialogues = dialogueSystem.getCharacterDialogues(invalidDialogue.characterId);
            
            // If dialogue has invalid structure, it should not be loaded
            const hasInvalidResponseCount = !invalidDialogue.responses || 
                                           invalidDialogue.responses.length < 2 || 
                                           invalidDialogue.responses.length > 4;
            const hasInvalidAffinityEffect = invalidDialogue.responses && 
                                            invalidDialogue.responses.some((r: any) => 
                                              r.affinityEffect < -10 || r.affinityEffect > 10
                                            );
            const missingRequiredFields = !invalidDialogue.id || !invalidDialogue.npcText;

            if (hasInvalidResponseCount || hasInvalidAffinityEffect || missingRequiredFields) {
              // Invalid dialogue should not be loaded
              const loadedDialogue = characterDialogues.find((d: DialogueTopic) => d.id === invalidDialogue.id);
              expect(loadedDialogue).toBeUndefined();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Topic Selection Prioritizes Unseen Topics
   * For any character with multiple topics, if some topics have not been seen,
   * selectDialogueTopic should never return a recently seen topic
   * **Validates: Requirements 6.2**
   */
  it('Property 2: Topic Selection Prioritizes Unseen Topics', () => {
    const responseOptionGenerator = fc.record({
      text: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      affinityEffect: fc.integer({ min: -10, max: 10 })
    });

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // characterId
        fc.integer({ min: 3, max: 8 }), // number of topics (at least 3 to test variety)
        fc.integer({ min: 1, max: 5 }), // number of topics to mark as recently seen
        (characterId, totalTopics, recentlySeenCount) => {
          // Ensure we have at least one unseen topic
          const actualRecentlySeenCount = Math.min(recentlySeenCount, totalTopics - 1);

          // Generate dialogue topics for this character
          const dialogues = Array.from({ length: totalTopics }, (_, i) => ({
            id: `${characterId}_topic_${i}`,
            characterId: characterId,
            topic: `Topic ${i}`,
            npcText: `This is topic ${i} for ${characterId}`,
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: -5 }
            ]
          }));

          const dialoguesData = {
            dialogues: dialogues
          };

          // Load dialogues into the system
          dialogueSystem.loadDialogues(dialoguesData);

          // Mark some topics as recently seen (within the 30-minute threshold)
          const currentTime = Date.now();
          const recentThreshold = 30 * 60 * 1000; // 30 minutes
          const recentTime = currentTime - (recentThreshold / 2); // 15 minutes ago (within threshold)

          // Manually set dialogue history for recently seen topics
          const history = new Map<string, number>();
          const recentlySeenTopicIds = new Set<string>();
          
          for (let i = 0; i < actualRecentlySeenCount; i++) {
            const topicId = dialogues[i].id;
            history.set(topicId, recentTime);
            recentlySeenTopicIds.add(topicId);
          }

          // Set the history directly (accessing private field for testing)
          (dialogueSystem as any).dialogueHistory.set(characterId, history);

          // Test multiple selections to ensure consistency
          const numSelections = 20;
          for (let i = 0; i < numSelections; i++) {
            const selectedTopic = dialogueSystem.selectDialogueTopic(characterId);

            // Requirement 6.2: System should prioritize unseen topics
            // If there are unseen topics, the selected topic should NOT be recently seen
            if (!selectedTopic) {
              return false; // Should always return a topic
            }
            
            if (actualRecentlySeenCount < totalTopics) {
              // There are unseen topics available, so selected topic should not be recently seen
              if (recentlySeenTopicIds.has(selectedTopic.id)) {
                return false; // Failed: returned a recently seen topic when unseen topics exist
              }
            }
          }
          
          return true; // All selections passed
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 3: Response Affinity Effect Applied Correctly
   * For any valid response selection, the character's affinity should change by 
   * exactly the response's affinity effect value
   * **Validates: Requirements 3.1, 3.2**
   */
  it('Property 3: Response Affinity Effect Applied Correctly', () => {
    const responseOptionGenerator = fc.record({
      text: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      affinityEffect: fc.integer({ min: -10, max: 10 })
    });

    const validDialogueGenerator = fc.record({
      id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      characterId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      topic: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      npcText: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
      responses: fc.array(responseOptionGenerator, { minLength: 2, maxLength: 4 })
    });

    fc.assert(
      fc.property(
        validDialogueGenerator,
        fc.integer({ min: -100, max: 100 }), // initial affinity level
        fc.integer({ min: 0, max: 3 }), // response index (will be validated against actual response count)
        (dialogue, initialAffinity, responseIndexRaw) => {
          // Ensure response index is valid for this dialogue
          const responseIndex = responseIndexRaw % dialogue.responses.length;

          const dialoguesData = {
            dialogues: [dialogue]
          };

          // Load dialogues into the system
          dialogueSystem.loadDialogues(dialoguesData);

          // Create player and character entities with affinity tracking
          const playerId = entityManager.createEntity();
          const characterId = entityManager.createEntity();

          // Add affinity components to both entities using proper component type
          const playerAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map([[dialogue.characterId, initialAffinity]])
          };

          const characterAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map([[playerId, initialAffinity]])
          };

          componentManager.addComponent(playerId, AffinityComponentType, playerAffinity);
          componentManager.addComponent(characterId, AffinityComponentType, characterAffinity);

          // Get the affinity system
          const affinitySystem = world.getSystem('AffinitySystem');
          expect(affinitySystem).toBeDefined();

          // Get initial affinity level - should match what we set in the component
          const affinityBefore = affinitySystem.getAffinityLevel(playerId, dialogue.characterId);
          // The affinity system should return the initial affinity we set
          expect(affinityBefore).toBe(initialAffinity);

          // Get the expected affinity effect from the selected response
          const expectedAffinityEffect = dialogue.responses[responseIndex].affinityEffect;

          // Process the response
          const result = dialogueSystem.processResponse(
            playerId,
            dialogue.characterId,
            dialogue.id,
            responseIndex
          );

          // Requirement 3.1: Affinity should change by the specified effect value
          expect(result.success).toBe(true);
          expect(result.affinityChange).toBe(expectedAffinityEffect);

          // Get the new affinity level
          const affinityAfter = affinitySystem.getAffinityLevel(playerId, dialogue.characterId);

          // Calculate expected new affinity (clamped to -100 to 100)
          const expectedNewAffinity = Math.max(-100, Math.min(100, initialAffinity + expectedAffinityEffect));

          // Requirement 3.2: The character's affinity should change by exactly the response's affinity effect value
          expect(affinityAfter).toBe(expectedNewAffinity);
          expect(result.newAffinityLevel).toBe(expectedNewAffinity);

          // Verify the actual change matches the expected effect (accounting for clamping)
          const actualChange = affinityAfter - affinityBefore;
          const expectedChange = expectedNewAffinity - initialAffinity;
          expect(actualChange).toBe(expectedChange);

          // If no clamping occurred, the change should exactly match the effect
          if (initialAffinity + expectedAffinityEffect >= -100 && 
              initialAffinity + expectedAffinityEffect <= 100) {
            expect(actualChange).toBe(expectedAffinityEffect);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Dialogue History Persistence
   * For any completed dialogue, querying the history should reflect that the topic was used
   * **Validates: Requirements 6.1, 6.4**
   */
  it('Property 4: Dialogue History Persistence', () => {
    const responseOptionGenerator = fc.record({
      text: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      affinityEffect: fc.integer({ min: -10, max: 10 })
    });

    const validDialogueGenerator = fc.record({
      id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      characterId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      topic: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      npcText: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
      responses: fc.array(responseOptionGenerator, { minLength: 2, maxLength: 4 })
    });

    fc.assert(
      fc.property(
        validDialogueGenerator,
        fc.integer({ min: -100, max: 100 }), // initial affinity level
        fc.integer({ min: 0, max: 3 }), // response index
        (dialogue, initialAffinity, responseIndexRaw) => {
          // Ensure response index is valid for this dialogue
          const responseIndex = responseIndexRaw % dialogue.responses.length;

          const dialoguesData = {
            dialogues: [dialogue]
          };

          // Load dialogues into the system
          dialogueSystem.loadDialogues(dialoguesData);

          // Create player and character entities with affinity tracking
          const playerId = entityManager.createEntity();
          const characterId = entityManager.createEntity();

          // Add affinity components to both entities
          const playerAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map([[dialogue.characterId, initialAffinity]])
          };

          const characterAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map([[playerId, initialAffinity]])
          };

          componentManager.addComponent(playerId, AffinityComponentType, playerAffinity);
          componentManager.addComponent(characterId, AffinityComponentType, characterAffinity);

          // Requirement 6.1: Before processing, history should be empty or not contain this topic
          const historyBefore = dialogueSystem.getDialogueHistory(dialogue.characterId);
          const timestampBefore = historyBefore.get(dialogue.id);

          // Process the response
          const beforeProcessTime = Date.now();
          const result = dialogueSystem.processResponse(
            playerId,
            dialogue.characterId,
            dialogue.id,
            responseIndex
          );
          const afterProcessTime = Date.now();

          expect(result.success).toBe(true);

          // Requirement 6.1: After processing, history should record the dialogue topic
          const historyAfter = dialogueSystem.getDialogueHistory(dialogue.characterId);
          
          // The topic should now be in the history
          expect(historyAfter.has(dialogue.id)).toBe(true);

          // The timestamp should be set to approximately the current time
          const timestampAfter = historyAfter.get(dialogue.id);
          expect(timestampAfter).toBeDefined();
          
          if (timestampAfter) {
            // Timestamp should be within the time window of processing
            expect(timestampAfter).toBeGreaterThanOrEqual(beforeProcessTime);
            expect(timestampAfter).toBeLessThanOrEqual(afterProcessTime);

            // If there was a previous timestamp, the new one should be different (later)
            if (timestampBefore !== undefined) {
              expect(timestampAfter).toBeGreaterThanOrEqual(timestampBefore);
            }
          }

          // Requirement 6.4: History should persist - verify it's still there on subsequent queries
          const historyVerify = dialogueSystem.getDialogueHistory(dialogue.characterId);
          expect(historyVerify.has(dialogue.id)).toBe(true);
          expect(historyVerify.get(dialogue.id)).toBe(timestampAfter);

          // Process the same dialogue again to verify history updates
          const secondProcessTime = Date.now();
          const result2 = dialogueSystem.processResponse(
            playerId,
            dialogue.characterId,
            dialogue.id,
            responseIndex
          );

          expect(result2.success).toBe(true);

          // History should still contain the topic with an updated timestamp
          const historyAfterSecond = dialogueSystem.getDialogueHistory(dialogue.characterId);
          expect(historyAfterSecond.has(dialogue.id)).toBe(true);
          
          const timestampAfterSecond = historyAfterSecond.get(dialogue.id);
          expect(timestampAfterSecond).toBeDefined();
          
          if (timestampAfterSecond && timestampAfter) {
            // Second timestamp should be later than or equal to the first
            expect(timestampAfterSecond).toBeGreaterThanOrEqual(timestampAfter);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All loaded dialogues should be retrievable
   * Validates that dialogues can be accessed after loading
   */
  it('should make all valid dialogues retrievable after loading', () => {
    const responseOptionGenerator = fc.record({
      text: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      affinityEffect: fc.integer({ min: -10, max: 10 })
    });

    const validDialogueGenerator = fc.record({
      id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      characterId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      topic: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      npcText: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
      responses: fc.array(responseOptionGenerator, { minLength: 2, maxLength: 4 })
    });

    fc.assert(
      fc.property(
        fc.array(validDialogueGenerator, { minLength: 1, maxLength: 5 }),
        (dialogues) => {
          const dialoguesData = {
            dialogues: dialogues
          };

          dialogueSystem.loadDialogues(dialoguesData);

          // Group dialogues by character
          const dialoguesByCharacter = new Map<string, typeof dialogues>();
          dialogues.forEach(dialogue => {
            if (!dialoguesByCharacter.has(dialogue.characterId)) {
              dialoguesByCharacter.set(dialogue.characterId, []);
            }
            dialoguesByCharacter.get(dialogue.characterId)!.push(dialogue);
          });

          // Verify each character's dialogues are retrievable
          dialoguesByCharacter.forEach((expectedDialogues, characterId) => {
            const retrievedDialogues = dialogueSystem.getCharacterDialogues(characterId);
            
            expect(retrievedDialogues.length).toBe(expectedDialogues.length);
            expect(dialogueSystem.hasDialogues(characterId)).toBe(true);

            // Verify each dialogue is present
            expectedDialogues.forEach(expectedDialogue => {
              const found = retrievedDialogues.find(d => d.id === expectedDialogue.id);
              expect(found).toBeDefined();
              
              if (found) {
                expect(found.characterId).toBe(expectedDialogue.characterId);
                expect(found.npcText).toBe(expectedDialogue.npcText);
                expect(found.responses.length).toBe(expectedDialogue.responses.length);
              }
            });
          });
        }
      ),
      { numRuns: 50 }
    );
  });
});
