/**
 * Dialogue Modal Component
 * Displays NPC dialogue with player response options
 */

import { BaseUIComponent } from '../BaseUIComponent';
import { UIManager } from '../UIManager';
import { EventSystem } from '../../ecs/EventSystem';
import { EntityId } from '../../ecs/Entity';
import { World } from '../../ecs/World';
import { DialogueSystem, DialogueTopic, ResponseOption } from '../../game/systems/DialogueSystem';
import { CharacterInfoComponentType } from '../../game/components/CharacterComponents';

export class DialogueModal extends BaseUIComponent {
  private world: World;
  private overlay: HTMLElement | null = null;
  private modalContainer: HTMLElement | null = null;
  private characterHeader: HTMLElement | null = null;
  private dialogueText: HTMLElement | null = null;
  private responseOptions: HTMLElement | null = null;
  private closeButton: HTMLElement | null = null;
  
  private currentCharacterId: EntityId | null = null;
  private currentTopic: DialogueTopic | null = null;
  private playerId: EntityId | null = null;

  constructor(id: string, uiManager: UIManager, eventSystem: EventSystem, world: World) {
    super(id, uiManager, eventSystem);
    this.world = world;
  }

  protected createElement(): HTMLElement {
    const container = document.createElement('div');
    container.id = this.id;
    container.className = 'dialogue-modal hidden';
    return container;
  }

  public render(): void {
    // Modal is rendered when opened
  }

  /**
   * Open the dialogue modal with a character and topic
   */
  public open(playerId: EntityId, characterId: EntityId, topic: DialogueTopic): void {
    this.playerId = playerId;
    this.currentCharacterId = characterId;
    this.currentTopic = topic;

    this.createModalStructure();
    this.renderCharacterHeader(characterId);
    this.renderNPCDialogue(topic.npcText);
    this.renderResponseOptions(topic.responses);

    this.show();
  }

  /**
   * Close the dialogue modal
   */
  public close(): void {
    this.hide();
    this.clearModal();
    this.currentCharacterId = null;
    this.currentTopic = null;
    this.playerId = null;
  }


  /**
   * Create the modal structure
   */
  private createModalStructure(): void {
    this.element.innerHTML = '';

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'dialogue-overlay';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Create modal container
    this.modalContainer = document.createElement('div');
    this.modalContainer.className = 'dialogue-container';

    // Create close button
    this.closeButton = document.createElement('button');
    this.closeButton.className = 'dialogue-close-btn';
    this.closeButton.textContent = '×';
    this.closeButton.addEventListener('click', () => this.close());

    // Create character header section
    this.characterHeader = document.createElement('div');
    this.characterHeader.className = 'dialogue-header';

    // Create dialogue text section
    this.dialogueText = document.createElement('div');
    this.dialogueText.className = 'dialogue-text';

    // Create response options section
    this.responseOptions = document.createElement('div');
    this.responseOptions.className = 'dialogue-responses';

    // Assemble modal
    this.modalContainer.appendChild(this.closeButton);
    this.modalContainer.appendChild(this.characterHeader);
    this.modalContainer.appendChild(this.dialogueText);
    this.modalContainer.appendChild(this.responseOptions);
    this.overlay.appendChild(this.modalContainer);
    this.element.appendChild(this.overlay);
  }

  /**
   * Render character header with name and portrait
   */
  private renderCharacterHeader(characterId: EntityId): void {
    if (!this.characterHeader) return;

    this.characterHeader.innerHTML = '';

    const characterInfo = this.world.getComponent(characterId, CharacterInfoComponentType);
    if (!characterInfo) return;

    const nameDisplay = characterInfo.title 
      ? `${characterInfo.title}${characterInfo.name}` 
      : characterInfo.name;

    const nameElement = document.createElement('div');
    nameElement.className = 'dialogue-character-name';
    nameElement.textContent = nameDisplay;

    this.characterHeader.appendChild(nameElement);
  }

  /**
   * Render NPC dialogue text
   */
  private renderNPCDialogue(dialogueText: string): void {
    if (!this.dialogueText) return;

    this.dialogueText.innerHTML = '';
    this.dialogueText.textContent = dialogueText;
  }

  /**
   * Render response options as clickable buttons
   */
  private renderResponseOptions(options: ResponseOption[]): void {
    if (!this.responseOptions) return;

    this.responseOptions.innerHTML = '';

    options.forEach((option, index) => {
      const optionButton = document.createElement('button');
      optionButton.className = 'dialogue-response-option';
      optionButton.textContent = option.text;

      optionButton.addEventListener('click', () => {
        this.handleResponseClick(index);
      });

      this.responseOptions!.appendChild(optionButton);
    });
  }


  /**
   * Handle response selection
   */
  private handleResponseClick(responseIndex: number): void {
    if (!this.playerId || !this.currentCharacterId || !this.currentTopic) {
      return;
    }

    // Disable all response buttons to prevent multiple clicks
    if (this.responseOptions) {
      const buttons = this.responseOptions.querySelectorAll('button');
      buttons.forEach(button => {
        (button as HTMLButtonElement).disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
      });
    }

    const dialogueSystem = this.world.getSystem<DialogueSystem>('DialogueSystem');
    if (!dialogueSystem) {
      console.error('DialogueSystem not found');
      return;
    }

    // Process the response
    const result = dialogueSystem.processResponse(
      this.playerId,
      this.currentCharacterId,
      this.currentTopic.id,
      responseIndex
    );

    if (result.success) {
      // Emit event with affinity change info for UI to display feedback
      this.eventSystem.emit({
        type: 'dialogue:affinity_feedback',
        timestamp: Date.now(),
        characterId: this.currentCharacterId,
        affinityChange: result.affinityChange
      });

      // Close modal immediately
      setTimeout(() => {
        this.close();
      }, 300);

    } else {
      this.showNotification(result.message, 'error');
      this.close();
    }
  }

  /**
   * Show affinity change visual feedback
   */
  private showAffinityFeedback(affinityChange: number): void {
    if (!this.characterHeader) return;

    const feedback = document.createElement('div');
    feedback.className = 'affinity-feedback';

    if (affinityChange > 0) {
      feedback.classList.add('affinity-positive');
      feedback.textContent = `+${affinityChange}`;
    } else if (affinityChange < 0) {
      feedback.classList.add('affinity-negative');
      feedback.textContent = `${affinityChange}`;
    } else {
      feedback.classList.add('affinity-neutral');
      feedback.textContent = '0';
    }

    this.characterHeader.appendChild(feedback);

    // Auto-dismiss after animation
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 2500);
  }

  /**
   * Clear modal content
   */
  private clearModal(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.modalContainer = null;
    this.characterHeader = null;
    this.dialogueText = null;
    this.responseOptions = null;
    this.closeButton = null;
  }

  protected onShow(): void {
    // Add animation class
    if (this.modalContainer) {
      this.modalContainer.classList.add('dialogue-fade-in');
    }
  }

  protected onHide(): void {
    // Add fade out animation
    if (this.modalContainer) {
      this.modalContainer.classList.add('dialogue-fade-out');
    }
  }
}
