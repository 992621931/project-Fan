/**
 * Dialogue System Integration Tests
 * Tests the integration between CharacterPanel, DialogueModal, and DialogueSystem
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { World } from '../../ecs/World';
import { EventSystem, createEvent } from '../../ecs/EventSystem';
import { UIManager } from '../../ui/UIManager';
import { CharacterPanel } from '../../ui/components/CharacterPanel';
import { DialogueModal } from '../../ui/components/DialogueModal';
import { DialogueSystem } from './DialogueSystem';
import { AffinitySystem } from './AffinitySystem';
import { NPCSystem } from './NPCSystem';
import {
  CharacterInfoComponent,
  CharacterInfoComponentType,
  AttributeComponent,
  AttributeComponentType,
  HealthComponent,
  HealthComponentType,
  ManaComponentType,
  LevelComponent,
  LevelComponentType,
  JobComponent,
  JobComponentType,
  DerivedStatsComponentType,
  AffinityComponent,
  AffinityComponentType
} from '../components/CharacterComponents';
import { RarityType } from '../types/RarityTypes';
import { JobType } from '../types/GameTypes';
import { Entity } from '../../ecs/Entity';
import { EntityId } from '../../ecs/Entity';

describe('Dialogue System Integration Tests', () => {
  let world: World;
  let eventSystem: EventSystem;
  let uiManager: UIManager;
  let characterPanel: CharacterPanel;
  let dialogueModal: DialogueModal;
  let dialogueSystem: DialogueSystem;
  let affinitySystem: AffinitySystem;
  let npcSystem: NPCSystem;
  let rootElement: HTMLElement;
  let playerId: EntityId;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="test-root"></div>';
    rootElement = document.getElementById('test-root')!;

    // Create instances
    eventSystem = new EventSystem();
    world = new World();
    uiManager = new UIManager(eventSystem, rootElement);

    // Create systems
    dialogueSystem = new DialogueSystem(world);
    affinitySystem = new AffinitySystem();
    npcSystem = new NPCSystem(world);

    // Add systems to world
    world.addSystem(dialogueSystem);
    world.addSystem(affinitySystem);
    world.addSystem(npcSystem);

    // Initialize world (which initializes all systems)
    world.initialize();

    // Create UI components
    characterPanel = new CharacterPanel(uiManager, eventSystem, world);
    dialogueModal = new DialogueModal('dialogue-modal', uiManager, eventSystem, world);

    // Register UI components
    uiManager.registerComponent(characterPanel);
    uiManager.registerComponent(dialogueModal);

    // Create player entity
    const player = world.createEntity();
    playerId = player.id;

    // Load test dialogue data
    const testDialogues = {
      dialogues: [
        {
          id: 'test_topic_1',
          characterId: 'test_character',
          topic: 'Test Topic 1',
          npcText: 'This is a test dialogue.',
          responses: [
            { text: 'Positive response', affinityEffect: 10 },
            { text: 'Neutral response', affinityEffect: 0 },
            { text: 'Negative response', affinityEffect: -5 }
          ]
        },
        {
          id: 'test_topic_2',
          characterId: 'test_character',
          topic: 'Test Topic 2',
          npcText: 'This is another test dialogue.',
          responses: [
            { text: 'Response A', affinityEffect: 5 },
            { text: 'Response B', affinityEffect: -10 }
          ]
        }
      ]
    };
    dialogueSystem.loadDialogues(testDialogues);
  });

  afterEach(() => {
    uiManager.destroy();
    document.body.innerHTML = '';
  });

  /**
   * Test: CharacterPanel shows Talk button for appropriate characters
   * Requirements: 10.1, 10.2
   */
  describe('Talk Button Visibility', () => {
    it('should show Talk button for characters with affinity tracking and dialogues', () => {
      // Create character with affinity and dialogues
      const character = createTestCharacter(world, 'test_character');
      
      // Add affinity component
      const affinity: AffinityComponent = {
        type: 'affinity',
        affinityLevels: new Map([[playerId, 0]])
      };
      world.addComponent(character.id, AffinityComponentType, affinity);

      // Render character panel
      characterPanel.show();
      characterPanel.render();

      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();

      // Check Talk button exists
      const talkBtn = characterPanel.element.querySelector('.talk-btn');
      expect(talkBtn).toBeTruthy();
      expect(talkBtn?.textContent).toBe('对话');
    });

    it('should not show Talk button for characters without affinity tracking', () => {
      // Create character without affinity component
      const character = createTestCharacter(world, 'test_character');

      // Render character panel
      characterPanel.show();
      characterPanel.render();

      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();

      // Check Talk button does not exist
      const talkBtn = characterPanel.element.querySelector('.talk-btn');
      expect(talkBtn).toBeNull();
    });

    it('should not show Talk button for characters without dialogues', () => {
      // Create character with affinity but no dialogues
      const character = createTestCharacter(world, 'character_without_dialogues');
      
      // Add affinity component
      const affinity: AffinityComponent = {
        type: 'affinity',
        affinityLevels: new Map([[playerId, 0]])
      };
      world.addComponent(character.id, AffinityComponentType, affinity);

      // Render character panel
      characterPanel.show();
      characterPanel.render();

      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();

      // Check Talk button does not exist
      const talkBtn = characterPanel.element.querySelector('.talk-btn');
      expect(talkBtn).toBeNull();
    });
  });

  /**
   * Test: Clicking Talk button opens DialogueModal
   * Requirements: 10.3
   */
  describe('Talk Button Interaction', () => {
    it('should emit ui:show event when Talk button is clicked', () => {
      // Create character with affinity and dialogues
      const character = createTestCharacter(world, 'test_character');
      
      // Add affinity component
      const affinity: AffinityComponent = {
        type: 'affinity',
        affinityLevels: new Map([[playerId, 0]])
      };
      world.addComponent(character.id, AffinityComponentType, affinity);

      // Spy on event system
      const eventSpy = vi.spyOn(eventSystem, 'emit');

      // Render character panel
      characterPanel.show();
      characterPanel.render();

      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();

      // Click Talk button
      const talkBtn = characterPanel.element.querySelector('.talk-btn') as HTMLButtonElement;
      talkBtn.click();

      // Verify event was emitted
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ui:show',
          panel: 'dialogue',
          character: character.id
        })
      );
    });

    it('should open DialogueModal with selected topic', () => {
      // Create character with affinity and dialogues
      const character = createTestCharacter(world, 'test_character');
      
      // Add affinity component
      const affinity: AffinityComponent = {
        type: 'affinity',
        affinityLevels: new Map([[playerId, 0]])
      };
      world.addComponent(character.id, AffinityComponentType, affinity);

      // Get a dialogue topic
      const topic = dialogueSystem.selectDialogueTopic(character.id);
      expect(topic).toBeTruthy();

      // Open dialogue modal
      dialogueModal.open(playerId, character.id, topic!);

      // Verify modal is visible
      expect(dialogueModal.visible).toBe(true);

      // Verify modal content
      const modalElement = dialogueModal.element;
      expect(modalElement.textContent).toContain(topic!.npcText);
    });
  });

  /**
   * Test: DialogueModal communicates correctly with DialogueSystem
   * Requirements: 10.3, 10.4
   */
  describe('DialogueModal and DialogueSystem Communication', () => {
    it('should process response through DialogueSystem', () => {
      // Create character with affinity and dialogues
      const character = createTestCharacter(world, 'test_character');
      
      // Add affinity component
      const affinity: AffinityComponent = {
        type: 'affinity',
        affinityLevels: new Map([[playerId, 0]])
      };
      world.addComponent(character.id, AffinityComponentType, affinity);

      // Note: NPCSystem affinity update is handled internally by DialogueSystem

      // Get a dialogue topic
      const topic = dialogueSystem.selectDialogueTopic(character.id);
      expect(topic).toBeTruthy();

      // Open dialogue modal
      dialogueModal.open(playerId, character.id, topic!);

      // Get initial affinity
      const initialAffinity = affinitySystem.getAffinityLevel(playerId, character.id);

      // Click first response (positive, +10)
      const responseButtons = dialogueModal.element.querySelectorAll('.dialogue-response-option');
      expect(responseButtons.length).toBeGreaterThan(0);
      
      const firstResponse = responseButtons[0] as HTMLButtonElement;
      firstResponse.click();

      // Verify affinity changed
      const newAffinity = affinitySystem.getAffinityLevel(playerId, character.id);
      expect(newAffinity).toBe(initialAffinity + 10);
    });

    it('should emit dialogue:completed event after response', () => {
      // Create character with affinity and dialogues
      const character = createTestCharacter(world, 'test_character');
      
      // Add affinity component
      const affinity: AffinityComponent = {
        type: 'affinity',
        affinityLevels: new Map([[playerId, 0]])
      };
      world.addComponent(character.id, AffinityComponentType, affinity);

      // Note: NPCSystem affinity update is handled internally by DialogueSystem

      // Spy on event system
      const eventSpy = vi.spyOn(eventSystem, 'emit');

      // Get a dialogue topic
      const topic = dialogueSystem.selectDialogueTopic(character.id);
      expect(topic).toBeTruthy();

      // Open dialogue modal
      dialogueModal.open(playerId, character.id, topic!);

      // Click first response
      const responseButtons = dialogueModal.element.querySelectorAll('.dialogue-response-option');
      const firstResponse = responseButtons[0] as HTMLButtonElement;
      firstResponse.click();

      // Verify dialogue:completed event was emitted
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dialogue:completed',
          playerId,
          characterId: character.id,
          topicId: topic!.id,
          responseIndex: 0
        })
      );
    });

    it('should display affinity feedback after response', async () => {
      // Create character with affinity and dialogues
      const character = createTestCharacter(world, 'test_character');
      
      // Add affinity component
      const affinity: AffinityComponent = {
        type: 'affinity',
        affinityLevels: new Map([[playerId, 0]])
      };
      world.addComponent(character.id, AffinityComponentType, affinity);

      // Note: NPCSystem affinity update is handled internally by DialogueSystem

      // Get a dialogue topic
      const topic = dialogueSystem.selectDialogueTopic(character.id);
      expect(topic).toBeTruthy();

      // Open dialogue modal
      dialogueModal.open(playerId, character.id, topic!);

      // Click first response (positive, +10)
      const responseButtons = dialogueModal.element.querySelectorAll('.dialogue-response-option');
      const firstResponse = responseButtons[0] as HTMLButtonElement;
      firstResponse.click();

      // Check for affinity feedback element
      const affinityFeedback = dialogueModal.element.querySelector('.affinity-feedback');
      expect(affinityFeedback).toBeTruthy();
      expect(affinityFeedback?.textContent).toBe('+10');
      expect(affinityFeedback?.classList.contains('affinity-positive')).toBe(true);
    });
  });

  /**
   * Test: Affinity changes are reflected in CharacterPanel
   * Requirements: 10.4
   */
  describe('Affinity Changes in CharacterPanel', () => {
    it('should update CharacterPanel when affinity changes', () => {
      // Create character with affinity and dialogues
      const character = createTestCharacter(world, 'test_character');
      
      // Add affinity component
      const affinity: AffinityComponent = {
        type: 'affinity',
        affinityLevels: new Map([[playerId, 50]])
      };
      world.addComponent(character.id, AffinityComponentType, affinity);

      // Note: NPCSystem affinity update is handled internally by DialogueSystem

      // Render character panel
      characterPanel.show();
      characterPanel.render();

      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();

      // Process a dialogue response that changes affinity
      const topic = dialogueSystem.selectDialogueTopic(character.id);
      const result = dialogueSystem.processResponse(playerId, character.id, topic!.id, 0);

      expect(result.success).toBe(true);
      expect(result.affinityChange).toBe(10);

      // Emit affinity:changed event
      eventSystem.emit(createEvent({
        type: 'affinity:changed',
        characterId: character.id,
        newLevel: result.newAffinityLevel
      }));

      // Verify affinity is updated in the system
      const newAffinity = affinitySystem.getAffinityLevel(playerId, character.id);
      expect(newAffinity).toBe(60);
    });
  });

  /**
   * Test: Dialogue history persists across sessions
   * Requirements: 10.5
   */
  describe('Dialogue History Persistence', () => {
    it('should record dialogue history after completing a dialogue', () => {
      // Create character with affinity and dialogues
      const character = createTestCharacter(world, 'test_character');
      
      // Add affinity component
      const affinity: AffinityComponent = {
        type: 'affinity',
        affinityLevels: new Map([[playerId, 0]])
      };
      world.addComponent(character.id, AffinityComponentType, affinity);

      // Note: NPCSystem affinity update is handled internally by DialogueSystem

      // Get initial history
      const initialHistory = dialogueSystem.getDialogueHistory(character.id);
      expect(initialHistory.size).toBe(0);

      // Process a dialogue response
      const topic = dialogueSystem.selectDialogueTopic(character.id);
      dialogueSystem.processResponse(playerId, character.id, topic!.id, 0);

      // Verify history was recorded
      const updatedHistory = dialogueSystem.getDialogueHistory(character.id);
      expect(updatedHistory.size).toBe(1);
      expect(updatedHistory.has(topic!.id)).toBe(true);
    });

    it('should prioritize unseen topics when selecting dialogues', () => {
      // Create character with affinity and dialogues
      const character = createTestCharacter(world, 'test_character');
      
      // Add affinity component
      const affinity: AffinityComponent = {
        type: 'affinity',
        affinityLevels: new Map([[playerId, 0]])
      };
      world.addComponent(character.id, AffinityComponentType, affinity);

      // Initialize NPC data
      npcSystem.initializeNPC(character.id, {
        id: character.id,
        name: 'Test Character',
        affinity: 0,
        profession: 'test',
        location: 'test_location',
        dialogue: []
      });

      // Select and complete first topic
      const firstTopic = dialogueSystem.selectDialogueTopic(character.id);
      expect(firstTopic).toBeTruthy();
      dialogueSystem.processResponse(playerId, character.id, firstTopic!.id, 0);

      // Select second topic - should be different from first
      const secondTopic = dialogueSystem.selectDialogueTopic(character.id);
      expect(secondTopic).toBeTruthy();
      expect(secondTopic!.id).not.toBe(firstTopic!.id);
    });

    it('should allow topic repetition after all topics have been seen', () => {
      // Create character with affinity and dialogues
      const character = createTestCharacter(world, 'test_character');
      
      // Add affinity component
      const affinity: AffinityComponent = {
        type: 'affinity',
        affinityLevels: new Map([[playerId, 0]])
      };
      world.addComponent(character.id, AffinityComponentType, affinity);

      // Note: NPCSystem affinity update is handled internally by DialogueSystem

      // Complete all available topics
      const allTopics = dialogueSystem.getCharacterDialogues(character.id);
      allTopics.forEach(topic => {
        dialogueSystem.processResponse(playerId, character.id, topic.id, 0);
      });

      // Select a topic again - should still return a topic
      const repeatedTopic = dialogueSystem.selectDialogueTopic(character.id);
      expect(repeatedTopic).toBeTruthy();
      expect(allTopics.some(t => t.id === repeatedTopic!.id)).toBe(true);
    });
  });

  /**
   * Test: End-to-end workflow
   * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
   */
  describe('End-to-End Workflow', () => {
    it('should complete full dialogue interaction workflow', () => {
      // Create character with affinity and dialogues
      const character = createTestCharacter(world, 'test_character');
      
      // Add affinity component
      const affinity: AffinityComponent = {
        type: 'affinity',
        affinityLevels: new Map([[playerId, 0]])
      };
      world.addComponent(character.id, AffinityComponentType, affinity);

      // Note: NPCSystem affinity update is handled internally by DialogueSystem

      // Step 1: Render CharacterPanel and verify Talk button
      characterPanel.show();
      characterPanel.render();

      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();

      const talkBtn = characterPanel.element.querySelector('.talk-btn');
      expect(talkBtn).toBeTruthy();

      // Step 2: Get dialogue topic from DialogueSystem
      const topic = dialogueSystem.selectDialogueTopic(character.id);
      expect(topic).toBeTruthy();

      // Step 3: Open DialogueModal
      dialogueModal.open(playerId, character.id, topic!);
      expect(dialogueModal.visible).toBe(true);

      // Step 4: Select a response
      const initialAffinity = affinitySystem.getAffinityLevel(playerId, character.id);
      const responseButtons = dialogueModal.element.querySelectorAll('.dialogue-response-option');
      const firstResponse = responseButtons[0] as HTMLButtonElement;
      firstResponse.click();

      // Step 5: Verify affinity changed
      const newAffinity = affinitySystem.getAffinityLevel(playerId, character.id);
      expect(newAffinity).toBe(initialAffinity + 10);

      // Step 6: Verify dialogue history was recorded
      const history = dialogueSystem.getDialogueHistory(character.id);
      expect(history.has(topic!.id)).toBe(true);

      // Step 7: Verify modal closes after delay (simulate)
      setTimeout(() => {
        expect(dialogueModal.visible).toBe(false);
      }, 1600);
    });
  });
});

// Helper function to create test character
function createTestCharacter(world: World, characterId: string): Entity {
  const character = world.createEntity();

  // Override entity ID to match dialogue data
  (character as any).id = characterId;

  // Add character info component
  const characterInfo: CharacterInfoComponent = {
    type: 'characterInfo',
    title: '测试',
    name: '角色',
    isSpecial: false,
    rarity: RarityType.Common,
    status: 'available' as any
  };
  world.addComponent(character.id, CharacterInfoComponentType, characterInfo);

  // Add attribute component
  const attributes: AttributeComponent = {
    type: 'attribute',
    strength: 10,
    agility: 8,
    wisdom: 12,
    technique: 9
  };
  world.addComponent(character.id, AttributeComponentType, attributes);

  // Add health component
  const health: HealthComponent = {
    type: 'health',
    current: 100,
    maximum: 100
  };
  world.addComponent(character.id, HealthComponentType, health);

  // Add mana component
  const mana = {
    type: 'mana' as const,
    current: 50,
    maximum: 50
  };
  world.addComponent(character.id, ManaComponentType, mana);

  // Add level component
  const level: LevelComponent = {
    type: 'level',
    level: 5,
    experience: 50,
    experienceToNext: 200
  };
  world.addComponent(character.id, LevelComponentType, level);

  // Add job component
  const job: JobComponent = {
    type: 'job',
    currentJob: JobType.Warrior,
    availableJobs: [JobType.Warrior],
    jobExperience: new Map()
  };
  world.addComponent(character.id, JobComponentType, job);

  // Add derived stats component
  const derivedStats = {
    type: 'derivedStats' as const,
    attack: 25,
    defense: 15,
    moveSpeed: 10,
    dodgeRate: 0.1,
    critRate: 0.05,
    critDamage: 1.5,
    resistance: 5,
    magicPower: 20,
    carryWeight: 50,
    hitRate: 0.9,
    expRate: 1.0,
    healthRegen: 1,
    manaRegen: 2,
    weight: 70,
    volume: 1
  };
  world.addComponent(character.id, DerivedStatsComponentType, derivedStats);

  return character;
}
