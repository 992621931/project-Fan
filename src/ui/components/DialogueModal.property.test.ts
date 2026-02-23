/**
 * Property-based tests for DialogueModal
 * Feature: affinity-dialogue-system, Property 5: All Response Options Rendered
 * **Validates: Requirements 2.2, 9.3**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DialogueModal } from './DialogueModal';
import { UIManager } from '../UIManager';
import { EventSystem } from '../../ecs/EventSystem';
import { World } from '../../ecs/World';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { DialogueSystem, DialogueTopic, ResponseOption } from '../../game/systems/DialogueSystem';
import { 
  CharacterInfoComponent, 
  CharacterInfoComponentType,
  AffinityComponent,
  AffinityComponentType
} from '../../game/components/CharacterComponents';

describe('DialogueModal Property Tests', () => {
  let dialogueModal: DialogueModal;
  let uiManager: UIManager;
  let eventSystem: EventSystem;
  let world: World;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let dialogueSystem: DialogueSystem;
  let rootElement: HTMLElement;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="test-root"></div>';
    rootElement = document.getElementById('test-root')!;

    // Create ECS infrastructure
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    world = new World();

    // Create UIManager
    uiManager = new UIManager(eventSystem, rootElement);

    // Create and initialize DialogueSystem
    const affinitySystem = {
      name: 'AffinitySystem',
      getAffinityLevel: (playerId: any, characterId: any) => {
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
      if (name === 'DialogueSystem') return dialogueSystem;
      if (name === 'NPCSystem') return null;
      return null;
    }) as any;

    dialogueSystem = new DialogueSystem(world);
    dialogueSystem.initialize(entityManager, componentManager, eventSystem);

    // Create DialogueModal
    dialogueModal = new DialogueModal('test-dialogue-modal', uiManager, eventSystem, world);
    
    // Register the component with UIManager
    uiManager.registerComponent(dialogueModal);
  });

  /**
   * Property 5: All Response Options Rendered
   * For any dialogue topic with N response options, the modal should render exactly N clickable elements
   * **Validates: Requirements 2.2, 9.3**
   */
  it('Property 5: All Response Options Rendered', () => {
    // Generator for valid response options (2-4 responses per requirement)
    const responseOptionGenerator = fc.record({
      text: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      affinityEffect: fc.integer({ min: -10, max: 10 })
    });

    // Generator for valid dialogue topics
    const validDialogueTopicGenerator = fc.record({
      id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      characterId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      topic: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      npcText: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
      responses: fc.array(responseOptionGenerator, { minLength: 2, maxLength: 4 })
    });

    fc.assert(
      fc.property(
        validDialogueTopicGenerator,
        (dialogueTopic) => {
          // Create player and character entities
          const playerId = entityManager.createEntity();
          const characterId = entityManager.createEntity();

          // Add character info component
          const characterInfo: CharacterInfoComponent = {
            type: 'character_info',
            name: 'Test Character',
            title: '',
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            job: 'adventurer',
            rarity: 'common' as any
          };
          componentManager.addComponent(characterId, CharacterInfoComponentType, characterInfo);

          // Add affinity components
          const playerAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map([[dialogueTopic.characterId, 0]])
          };
          const characterAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map([[playerId, 0]])
          };
          componentManager.addComponent(playerId, AffinityComponentType, playerAffinity);
          componentManager.addComponent(characterId, AffinityComponentType, characterAffinity);

          // Load dialogue into system
          const dialoguesData = {
            dialogues: [dialogueTopic]
          };
          dialogueSystem.loadDialogues(dialoguesData);

          // Get the loaded topic
          const loadedTopic = dialogueSystem.selectDialogueTopic(dialogueTopic.characterId);
          expect(loadedTopic).toBeDefined();

          if (!loadedTopic) return;

          // Open the modal with the dialogue topic
          dialogueModal.open(playerId, dialogueTopic.characterId, loadedTopic);

          // Get the response options container
          const modalElement = dialogueModal.element;
          const responseOptionsContainer = modalElement.querySelector('.dialogue-responses');
          
          // Requirement 2.2: Modal should present 2-4 player response options
          expect(responseOptionsContainer).toBeDefined();
          expect(responseOptionsContainer).not.toBeNull();

          if (!responseOptionsContainer) return;

          // Requirement 9.3: Response options should be presented as clickable buttons or list items
          const responseButtons = responseOptionsContainer.querySelectorAll('.dialogue-response-option');
          
          // Property 5: For any dialogue topic with N response options, 
          // the modal should render exactly N clickable elements
          const expectedCount = loadedTopic.responses.length;
          expect(responseButtons.length).toBe(expectedCount);

          // Verify each response option is rendered as a clickable element
          responseButtons.forEach((button, index) => {
            // Should be a button element
            expect(button.tagName).toBe('BUTTON');
            
            // Should have the correct text content
            const expectedText = loadedTopic.responses[index].text;
            expect(button.textContent).toBe(expectedText);
            
            // Should be clickable (has click event listener - we can't directly test this,
            // but we can verify it's not disabled)
            expect((button as HTMLButtonElement).disabled).toBe(false);
          });

          // Verify the count matches the original dialogue topic
          expect(responseButtons.length).toBe(dialogueTopic.responses.length);
          expect(responseButtons.length).toBeGreaterThanOrEqual(2);
          expect(responseButtons.length).toBeLessThanOrEqual(4);

          // Clean up
          dialogueModal.close();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Response option rendering is consistent across multiple opens
   * Verifies that closing and reopening the modal renders the same number of options
   */
  it('should render consistent response options across multiple modal opens', () => {
    const responseOptionGenerator = fc.record({
      text: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      affinityEffect: fc.integer({ min: -10, max: 10 })
    });

    const validDialogueTopicGenerator = fc.record({
      id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      characterId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      topic: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      npcText: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
      responses: fc.array(responseOptionGenerator, { minLength: 2, maxLength: 4 })
    });

    fc.assert(
      fc.property(
        validDialogueTopicGenerator,
        fc.integer({ min: 2, max: 5 }), // number of times to open/close
        (dialogueTopic, numOpens) => {
          // Create player and character entities
          const playerId = entityManager.createEntity();
          const characterId = entityManager.createEntity();

          // Add character info component
          const characterInfo: CharacterInfoComponent = {
            type: 'character_info',
            name: 'Test Character',
            title: '',
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            job: 'adventurer',
            rarity: 'common' as any
          };
          componentManager.addComponent(characterId, CharacterInfoComponentType, characterInfo);

          // Add affinity components
          const playerAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map([[dialogueTopic.characterId, 0]])
          };
          const characterAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map([[playerId, 0]])
          };
          componentManager.addComponent(playerId, AffinityComponentType, playerAffinity);
          componentManager.addComponent(characterId, AffinityComponentType, characterAffinity);

          // Load dialogue into system
          const dialoguesData = {
            dialogues: [dialogueTopic]
          };
          dialogueSystem.loadDialogues(dialoguesData);

          const loadedTopic = dialogueSystem.selectDialogueTopic(dialogueTopic.characterId);
          expect(loadedTopic).toBeDefined();

          if (!loadedTopic) return;

          const expectedCount = loadedTopic.responses.length;

          // Open and close the modal multiple times
          for (let i = 0; i < numOpens; i++) {
            dialogueModal.open(playerId, dialogueTopic.characterId, loadedTopic);

            const modalElement = dialogueModal.element;
            const responseOptionsContainer = modalElement.querySelector('.dialogue-responses');
            expect(responseOptionsContainer).not.toBeNull();

            if (!responseOptionsContainer) continue;

            const responseButtons = responseOptionsContainer.querySelectorAll('.dialogue-response-option');
            
            // Should always render the same number of options
            expect(responseButtons.length).toBe(expectedCount);

            dialogueModal.close();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Each response option has unique text content
   * Verifies that all rendered response options display their correct text
   */
  it('should render each response option with its correct text content', () => {
    const responseOptionGenerator = fc.record({
      text: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      affinityEffect: fc.integer({ min: -10, max: 10 })
    });

    // Generate dialogue topics with unique response texts
    const uniqueResponsesGenerator = fc.array(responseOptionGenerator, { minLength: 2, maxLength: 4 })
      .filter(responses => {
        // Ensure all response texts are unique
        const texts = responses.map(r => r.text);
        return new Set(texts).size === texts.length;
      });

    const validDialogueTopicGenerator = fc.record({
      id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      characterId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      topic: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      npcText: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
      responses: uniqueResponsesGenerator
    });

    fc.assert(
      fc.property(
        validDialogueTopicGenerator,
        (dialogueTopic) => {
          // Create player and character entities
          const playerId = entityManager.createEntity();
          const characterId = entityManager.createEntity();

          // Add character info component
          const characterInfo: CharacterInfoComponent = {
            type: 'character_info',
            name: 'Test Character',
            title: '',
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            job: 'adventurer',
            rarity: 'common' as any
          };
          componentManager.addComponent(characterId, CharacterInfoComponentType, characterInfo);

          // Add affinity components
          const playerAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map([[dialogueTopic.characterId, 0]])
          };
          const characterAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map([[playerId, 0]])
          };
          componentManager.addComponent(playerId, AffinityComponentType, playerAffinity);
          componentManager.addComponent(characterId, AffinityComponentType, characterAffinity);

          // Load dialogue into system
          const dialoguesData = {
            dialogues: [dialogueTopic]
          };
          dialogueSystem.loadDialogues(dialoguesData);

          const loadedTopic = dialogueSystem.selectDialogueTopic(dialogueTopic.characterId);
          expect(loadedTopic).toBeDefined();

          if (!loadedTopic) return;

          // Open the modal
          dialogueModal.open(playerId, dialogueTopic.characterId, loadedTopic);

          const modalElement = dialogueModal.element;
          const responseOptionsContainer = modalElement.querySelector('.dialogue-responses');
          expect(responseOptionsContainer).not.toBeNull();

          if (!responseOptionsContainer) return;

          const responseButtons = responseOptionsContainer.querySelectorAll('.dialogue-response-option');

          // Verify each button has the correct text
          responseButtons.forEach((button, index) => {
            const expectedText = loadedTopic.responses[index].text;
            expect(button.textContent).toBe(expectedText);
          });

          // Verify all texts are present
          const renderedTexts = Array.from(responseButtons).map(btn => btn.textContent);
          const expectedTexts = loadedTopic.responses.map(r => r.text);
          
          expect(renderedTexts).toEqual(expectedTexts);

          // Clean up
          dialogueModal.close();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6: Affinity Feedback Matches Change Direction
   * For any affinity change, positive changes should display with positive styling, 
   * negative with negative styling, and zero with neutral styling
   * **Validates: Requirements 8.1, 8.2, 8.3**
   */
  it('Property 6: Affinity Feedback Matches Change Direction', () => {
    // Generator for affinity changes covering all ranges
    const affinityChangeGenerator = fc.oneof(
      fc.constant(-10),
      fc.constant(-5),
      fc.constant(0),
      fc.constant(5),
      fc.constant(10),
      fc.integer({ min: -10, max: -1 }), // negative range
      fc.integer({ min: 1, max: 10 })    // positive range
    );

    fc.assert(
      fc.property(
        affinityChangeGenerator,
        (affinityChange) => {
          // Create player and character entities
          const playerId = entityManager.createEntity();
          const characterId = entityManager.createEntity();

          // Add character info component
          const characterInfo: CharacterInfoComponent = {
            type: 'character_info',
            name: 'Test Character',
            title: '',
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            job: 'adventurer',
            rarity: 'common' as any
          };
          componentManager.addComponent(characterId, CharacterInfoComponentType, characterInfo);

          // Add affinity components with initial affinity
          const playerAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map([[characterId, 50]]) // Start at 50 to allow both positive and negative changes
          };
          const characterAffinity: AffinityComponent = {
            type: 'affinity',
            relationships: new Map([[playerId, 50]])
          };
          componentManager.addComponent(playerId, AffinityComponentType, playerAffinity);
          componentManager.addComponent(characterId, AffinityComponentType, characterAffinity);

          // Create a dialogue topic with a response that has the test affinity effect
          const dialogueTopic: DialogueTopic = {
            id: 'test-topic',
            characterId: characterId,
            topic: 'Test Topic',
            npcText: 'Test dialogue text',
            responses: [
              {
                text: 'Test response',
                affinityEffect: affinityChange
              }
            ]
          };

          // Load dialogue into system
          const dialoguesData = {
            dialogues: [dialogueTopic]
          };
          dialogueSystem.loadDialogues(dialoguesData);

          const loadedTopic = dialogueSystem.selectDialogueTopic(characterId);
          expect(loadedTopic).toBeDefined();

          if (!loadedTopic) return;

          // Open the modal
          dialogueModal.open(playerId, characterId, loadedTopic);

          // Simulate clicking the response option
          const modalElement = dialogueModal.element;
          const responseOptionsContainer = modalElement.querySelector('.dialogue-responses');
          expect(responseOptionsContainer).not.toBeNull();

          if (!responseOptionsContainer) return;

          const responseButton = responseOptionsContainer.querySelector('.dialogue-response-option') as HTMLButtonElement;
          expect(responseButton).not.toBeNull();

          if (!responseButton) return;

          // Click the response button
          responseButton.click();

          // Wait a tick for the feedback to be rendered
          // The feedback is shown immediately in showAffinityFeedback
          const feedbackElement = modalElement.querySelector('.affinity-feedback');
          
          // Requirement 8.1, 8.2, 8.3: Verify feedback element exists and has correct styling
          expect(feedbackElement).not.toBeNull();

          if (!feedbackElement) return;

          // Property 6: Verify styling matches the change direction
          if (affinityChange > 0) {
            // Requirement 8.1: Positive changes should display with positive styling
            expect(feedbackElement.classList.contains('affinity-positive')).toBe(true);
            expect(feedbackElement.classList.contains('affinity-negative')).toBe(false);
            expect(feedbackElement.classList.contains('affinity-neutral')).toBe(false);
            expect(feedbackElement.textContent).toBe(`+${affinityChange}`);
          } else if (affinityChange < 0) {
            // Requirement 8.2: Negative changes should display with negative styling
            expect(feedbackElement.classList.contains('affinity-negative')).toBe(true);
            expect(feedbackElement.classList.contains('affinity-positive')).toBe(false);
            expect(feedbackElement.classList.contains('affinity-neutral')).toBe(false);
            expect(feedbackElement.textContent).toBe(`${affinityChange}`);
          } else {
            // Requirement 8.3: Zero changes should display with neutral styling
            expect(feedbackElement.classList.contains('affinity-neutral')).toBe(true);
            expect(feedbackElement.classList.contains('affinity-positive')).toBe(false);
            expect(feedbackElement.classList.contains('affinity-negative')).toBe(false);
            expect(feedbackElement.textContent).toBe('0');
          }

          // Verify feedback is positioned in the character header
          const characterHeader = modalElement.querySelector('.dialogue-header');
          expect(characterHeader).not.toBeNull();
          
          if (characterHeader) {
            // Requirement 8.4: Feedback should appear near character portrait
            expect(characterHeader.contains(feedbackElement)).toBe(true);
          }

          // Clean up
          dialogueModal.close();
        }
      ),
      { numRuns: 100 }
    );
  });
});
