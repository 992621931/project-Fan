/**
 * DialogueModal Tests - Test dialogue modal rendering and interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DialogueModal } from './DialogueModal';
import { UIManager } from '../UIManager';
import { EventSystem } from '../../ecs/EventSystem';
import { World } from '../../ecs/World';
import { Entity } from '../../ecs/Entity';
import { DialogueSystem, DialogueTopic, ResponseOption } from '../../game/systems/DialogueSystem';
import {
  CharacterInfoComponent,
  CharacterInfoComponentType,
  AffinityComponent,
  AffinityComponentType
} from '../../game/components/CharacterComponents';

describe('DialogueModal', () => {
  let dialogueModal: DialogueModal;
  let uiManager: UIManager;
  let eventSystem: EventSystem;
  let world: World;
  let rootElement: HTMLElement;
  let dialogueSystem: DialogueSystem;
  let playerEntity: Entity;
  let npcEntity: Entity;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="test-root"></div>';
    rootElement = document.getElementById('test-root')!;
    
    // Create instances
    eventSystem = new EventSystem();
    world = new World();
    uiManager = new UIManager(eventSystem, rootElement);
    
    // Create DialogueSystem and add it to world
    dialogueSystem = new DialogueSystem(world);
    world.addSystem(dialogueSystem);
    
    // Create DialogueModal
    dialogueModal = new DialogueModal('dialogue-modal', uiManager, eventSystem, world);
    uiManager.registerComponent(dialogueModal);
    
    // Create test entities
    playerEntity = world.createEntity();
    npcEntity = world.createEntity();
    
    // Add character info to NPC
    const characterInfo: CharacterInfoComponent = {
      type: 'characterInfo',
      title: '村长',
      name: '老李',
      isSpecial: true,
      rarity: 'common' as any,
      status: 'available' as any
    };
    world.addComponent(npcEntity.id, CharacterInfoComponentType, characterInfo);
    
    // Add affinity component
    const affinity: AffinityComponent = {
      type: 'affinity',
      affinityLevels: new Map([[playerEntity.id, 50]])
    };
    world.addComponent(npcEntity.id, AffinityComponentType, affinity);
  });

  afterEach(() => {
    uiManager.destroy();
    document.body.innerHTML = '';
  });

  describe('Modal Structure', () => {
    it('should create modal with correct structure when opened', () => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      const modal = dialogueModal.element;
      expect(modal).toBeTruthy();
      expect(modal.classList.contains('dialogue-modal')).toBe(true);
      
      // Check for overlay
      const overlay = modal.querySelector('.dialogue-overlay');
      expect(overlay).toBeTruthy();
      
      // Check for modal container
      const container = modal.querySelector('.dialogue-container');
      expect(container).toBeTruthy();
      
      // Check for close button
      const closeBtn = modal.querySelector('.dialogue-close-btn');
      expect(closeBtn).toBeTruthy();
      expect(closeBtn?.textContent).toBe('×');
    });

    it('should have character header, dialogue text, and response sections', () => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      const characterHeader = dialogueModal.element.querySelector('.dialogue-header');
      const dialogueText = dialogueModal.element.querySelector('.dialogue-text');
      const responseOptions = dialogueModal.element.querySelector('.dialogue-responses');
      
      expect(characterHeader).toBeTruthy();
      expect(dialogueText).toBeTruthy();
      expect(responseOptions).toBeTruthy();
    });
  });

  describe('Modal Opening with Correct Character and Dialogue', () => {
    it('should display correct character name in header', () => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      const characterName = dialogueModal.element.querySelector('.dialogue-character-name');
      expect(characterName).toBeTruthy();
      expect(characterName?.textContent).toBe('村长老李');
    });

    it('should display correct NPC dialogue text', () => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      const dialogueText = dialogueModal.element.querySelector('.dialogue-text');
      expect(dialogueText).toBeTruthy();
      expect(dialogueText?.textContent).toBe('你好，年轻人。村子最近很平静。');
    });

    it('should display character with title correctly', () => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      const characterName = dialogueModal.element.querySelector('.dialogue-character-name');
      expect(characterName?.textContent).toContain('村长');
      expect(characterName?.textContent).toContain('老李');
    });

    it('should display character without title correctly', () => {
      // Create NPC without title
      const npcWithoutTitle = world.createEntity();
      const characterInfo: CharacterInfoComponent = {
        type: 'characterInfo',
        title: '',
        name: '小明',
        isSpecial: false,
        rarity: 'common' as any,
        status: 'available' as any
      };
      world.addComponent(npcWithoutTitle.id, CharacterInfoComponentType, characterInfo);
      
      const topic = createTestDialogueTopic();
      dialogueModal.open(playerEntity.id, npcWithoutTitle.id, topic);
      
      const characterName = dialogueModal.element.querySelector('.dialogue-character-name');
      expect(characterName?.textContent).toBe('小明');
    });
  });

  describe('Response Options Rendering', () => {
    it('should render all response options as clickable buttons', () => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      const responseButtons = dialogueModal.element.querySelectorAll('.dialogue-response-option');
      expect(responseButtons.length).toBe(3);
      
      // Check button texts
      expect(responseButtons[0].textContent).toBe('村子很好，我很喜欢这里。');
      expect(responseButtons[1].textContent).toBe('还行吧，有点无聊。');
      expect(responseButtons[2].textContent).toBe('我不太关心这些。');
    });

    it('should render correct number of response options', () => {
      const topic: DialogueTopic = {
        id: 'test-topic-2',
        characterId: npcEntity.id,
        topic: 'weather',
        npcText: '今天天气不错。',
        responses: [
          { text: '是的，很好。', affinityEffect: 5 },
          { text: '还可以。', affinityEffect: 0 }
        ]
      };
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      const responseButtons = dialogueModal.element.querySelectorAll('.dialogue-response-option');
      expect(responseButtons.length).toBe(2);
    });

    it('should attach click handlers to each response option', () => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      const responseButtons = dialogueModal.element.querySelectorAll('.dialogue-response-option');
      
      // Each button should be clickable
      responseButtons.forEach(button => {
        expect(button.tagName).toBe('BUTTON');
        expect(button.className).toContain('dialogue-response-option');
      });
    });
  });

  describe('Modal Closing After Response Selection', () => {
    it('should close modal after response is selected', (done) => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      expect(dialogueModal.visible).toBe(true);
      
      // Click first response
      const responseButtons = dialogueModal.element.querySelectorAll('.dialogue-response-option');
      (responseButtons[0] as HTMLButtonElement).click();
      
      // Modal should close after delay (1500ms)
      setTimeout(() => {
        expect(dialogueModal.visible).toBe(false);
        done();
      }, 1600);
    });

    it('should close modal when close button is clicked', () => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      expect(dialogueModal.visible).toBe(true);
      
      const closeBtn = dialogueModal.element.querySelector('.dialogue-close-btn') as HTMLButtonElement;
      closeBtn.click();
      
      expect(dialogueModal.visible).toBe(false);
    });

    it('should close modal when clicking overlay background', () => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      expect(dialogueModal.visible).toBe(true);
      
      const overlay = dialogueModal.element.querySelector('.dialogue-overlay') as HTMLElement;
      
      // Create click event with target as overlay
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: overlay, enumerable: true });
      overlay.dispatchEvent(clickEvent);
      
      expect(dialogueModal.visible).toBe(false);
    });

    it('should not close modal when clicking inside modal container', () => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      expect(dialogueModal.visible).toBe(true);
      
      const modalContainer = dialogueModal.element.querySelector('.dialogue-container') as HTMLElement;
      const overlay = dialogueModal.element.querySelector('.dialogue-overlay') as HTMLElement;
      
      // Create click event with target as modal container (not overlay)
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: modalContainer, enumerable: true });
      overlay.dispatchEvent(clickEvent);
      
      // Modal should still be visible
      expect(dialogueModal.visible).toBe(true);
    });
  });

  describe('Affinity Feedback Display', () => {
    it('should display positive affinity feedback with correct styling', (done) => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      // Click first response (positive affinity)
      const responseButtons = dialogueModal.element.querySelectorAll('.dialogue-response-option');
      (responseButtons[0] as HTMLButtonElement).click();
      
      // Check for affinity feedback
      setTimeout(() => {
        const feedback = dialogueModal.element.querySelector('.affinity-feedback');
        expect(feedback).toBeTruthy();
        expect(feedback?.classList.contains('affinity-positive')).toBe(true);
        expect(feedback?.textContent).toBe('+10');
        done();
      }, 100);
    });

    it('should display negative affinity feedback with correct styling', (done) => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      // Click third response (negative affinity)
      const responseButtons = dialogueModal.element.querySelectorAll('.dialogue-response-option');
      (responseButtons[2] as HTMLButtonElement).click();
      
      // Check for affinity feedback
      setTimeout(() => {
        const feedback = dialogueModal.element.querySelector('.affinity-feedback');
        expect(feedback).toBeTruthy();
        expect(feedback?.classList.contains('affinity-negative')).toBe(true);
        expect(feedback?.textContent).toBe('-5');
        done();
      }, 100);
    });

    it('should display neutral affinity feedback with correct styling', (done) => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      // Click second response (neutral affinity)
      const responseButtons = dialogueModal.element.querySelectorAll('.dialogue-response-option');
      (responseButtons[1] as HTMLButtonElement).click();
      
      // Check for affinity feedback
      setTimeout(() => {
        const feedback = dialogueModal.element.querySelector('.affinity-feedback');
        expect(feedback).toBeTruthy();
        expect(feedback?.classList.contains('affinity-neutral')).toBe(true);
        expect(feedback?.textContent).toBe('0');
        done();
      }, 100);
    });

    it('should auto-dismiss affinity feedback after delay', (done) => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      // Click first response
      const responseButtons = dialogueModal.element.querySelectorAll('.dialogue-response-option');
      (responseButtons[0] as HTMLButtonElement).click();
      
      // Feedback should be visible initially
      setTimeout(() => {
        const feedback = dialogueModal.element.querySelector('.affinity-feedback');
        expect(feedback).toBeTruthy();
      }, 100);
      
      // Feedback should be removed after 2500ms
      setTimeout(() => {
        const feedback = dialogueModal.element.querySelector('.affinity-feedback');
        expect(feedback).toBeFalsy();
        done();
      }, 2600);
    });
  });

  describe('Event Integration', () => {
    it('should emit dialogue:completed event when response is selected', (done) => {
      const topic = createTestDialogueTopic();
      const eventSpy = vi.fn();
      
      eventSystem.on('dialogue:completed', eventSpy);
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      // Click first response
      const responseButtons = dialogueModal.element.querySelectorAll('.dialogue-response-option');
      (responseButtons[0] as HTMLButtonElement).click();
      
      // Event should be emitted
      setTimeout(() => {
        expect(eventSpy).toHaveBeenCalled();
        const eventData = eventSpy.mock.calls[0][0];
        expect(eventData.playerId).toBe(playerEntity.id);
        expect(eventData.characterId).toBe(npcEntity.id);
        expect(eventData.topicId).toBe('test-topic-1');
        expect(eventData.responseIndex).toBe(0);
        expect(eventData.affinityChange).toBe(10);
        done();
      }, 100);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing character info gracefully', () => {
      const npcWithoutInfo = world.createEntity();
      const topic = createTestDialogueTopic();
      
      // Should not throw error
      expect(() => {
        dialogueModal.open(playerEntity.id, npcWithoutInfo.id, topic);
      }).not.toThrow();
      
      // Character header should be empty or have default content
      const characterName = dialogueModal.element.querySelector('.dialogue-character-name');
      expect(characterName?.textContent).toBeFalsy();
    });

    it('should handle invalid response index gracefully', (done) => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      // Manually trigger invalid response
      (dialogueModal as any).handleResponseClick(999);
      
      // Modal should close without error
      setTimeout(() => {
        expect(dialogueModal.visible).toBe(false);
        done();
      }, 100);
    });
  });

  describe('Modal Cleanup', () => {
    it('should clear modal content when closed', () => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      // Verify content exists
      let overlay = dialogueModal.element.querySelector('.dialogue-overlay');
      expect(overlay).toBeTruthy();
      
      dialogueModal.close();
      
      // Verify content is cleared
      overlay = dialogueModal.element.querySelector('.dialogue-overlay');
      expect(overlay).toBeFalsy();
    });

    it('should reset internal state when closed', () => {
      const topic = createTestDialogueTopic();
      
      dialogueModal.open(playerEntity.id, npcEntity.id, topic);
      
      // Internal state should be set
      expect((dialogueModal as any).currentCharacterId).toBe(npcEntity.id);
      expect((dialogueModal as any).currentTopic).toBeTruthy();
      expect((dialogueModal as any).playerId).toBe(playerEntity.id);
      
      dialogueModal.close();
      
      // Internal state should be cleared
      expect((dialogueModal as any).currentCharacterId).toBeNull();
      expect((dialogueModal as any).currentTopic).toBeNull();
      expect((dialogueModal as any).playerId).toBeNull();
    });
  });
});

// Helper function to create test dialogue topic
function createTestDialogueTopic(): DialogueTopic {
  return {
    id: 'test-topic-1',
    characterId: 'village_chief',
    topic: 'village_peace',
    npcText: '你好，年轻人。村子最近很平静。',
    responses: [
      { text: '村子很好，我很喜欢这里。', affinityEffect: 10 },
      { text: '还行吧，有点无聊。', affinityEffect: 0 },
      { text: '我不太关心这些。', affinityEffect: -5 }
    ]
  };
}
