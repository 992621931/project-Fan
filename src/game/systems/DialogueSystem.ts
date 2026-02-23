/**
 * Dialogue System
 * Manages conversation trees, dialogue history, and affinity effects from player responses
 */

import { System } from '../../ecs/System';
import { ComponentType } from '../../ecs/Component';
import { EntityId } from '../../ecs/Entity';
import { World } from '../../ecs/World';
import {
  AffinityComponent,
  AffinityComponentType,
  CharacterInfoComponent,
  CharacterInfoComponentType
} from '../components/CharacterComponents';
import { AffinitySystem } from './AffinitySystem';

/**
 * Response option in a dialogue
 */
export interface ResponseOption {
  text: string;
  affinityEffect: number; // -10 to +10
}

/**
 * Dialogue condition
 */
export interface DialogueCondition {
  type: 'quest_status' | 'affinity_level' | 'item_possession';
  questId?: string;
  status?: 'available' | 'inProgress' | 'completed';
  npcId?: string;
  minAffinity?: number;
  itemId?: string;
  minQuantity?: number;
}

/**
 * Dialogue topic with NPC text and player response options
 */
export interface DialogueTopic {
  id: string;
  characterId: string;
  topic: string;
  npcText: string;
  responses: ResponseOption[];
  condition?: DialogueCondition;
}

/**
 * Dialogue history entry
 */
export interface DialogueHistory {
  topicId: string;
  timestamp: number;
}

/**
 * Result of processing a dialogue response
 */
export interface DialogueResult {
  success: boolean;
  affinityChange: number;
  newAffinityLevel: number;
  message: string;
}

/**
 * Dialogue system events
 */
export interface DialogueEvents {
  'dialogue:completed': {
    playerId: EntityId;
    characterId: EntityId;
    topicId: string;
    responseIndex: number;
    affinityChange: number;
  };
  'dialogue:topic_selected': {
    characterId: EntityId;
    topicId: string;
  };
}

/**
 * Dialogue System
 * Manages conversation trees and dialogue history
 */
export class DialogueSystem extends System {
  public readonly name = 'DialogueSystem';
  public readonly requiredComponents: ComponentType<any>[] = [];

  // Map of character ID to their dialogue topics
  private dialogues: Map<string, DialogueTopic[]> = new Map();
  
  // Map of character ID to their dialogue history (topicId -> timestamp)
  private dialogueHistory: Map<EntityId, Map<string, number>> = new Map();

  // Reference to world for accessing other systems
  private world: World | null = null;

  constructor(world?: World) {
    super();
    this.world = world || null;
  }

  protected onInitialize(): void {
    // Dialogues will be loaded via loadDialogues method
  }

  /**
   * Load dialogues from data
   */
  public loadDialogues(dialoguesData: any): void {
    if (!dialoguesData || !dialoguesData.dialogues) {
      console.warn('Invalid dialogues data format');
      return;
    }

    this.dialogues.clear();

    for (const dialogue of dialoguesData.dialogues) {
      if (!this.validateDialogue(dialogue)) {
        console.warn('Invalid dialogue structure:', dialogue);
        continue;
      }

      const characterId = dialogue.characterId;
      if (!this.dialogues.has(characterId)) {
        this.dialogues.set(characterId, []);
      }

      this.dialogues.get(characterId)!.push({
        id: dialogue.id,
        characterId: dialogue.characterId,
        topic: dialogue.topic,
        npcText: dialogue.npcText,
        responses: dialogue.responses,
        condition: dialogue.condition
      });
    }
  }

  /**
   * Validate dialogue structure
   */
  private validateDialogue(dialogue: any): boolean {
    if (!dialogue.id || !dialogue.characterId || !dialogue.npcText) {
      return false;
    }

    if (!Array.isArray(dialogue.responses) || dialogue.responses.length < 1 || dialogue.responses.length > 4) {
      return false;
    }

    for (const response of dialogue.responses) {
      if (!response.text || typeof response.affinityEffect !== 'number') {
        return false;
      }
      if (response.affinityEffect < -10 || response.affinityEffect > 10) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a dialogue condition is met
   */
  private checkDialogueCondition(condition: DialogueCondition | undefined): boolean {
    if (!condition) {
      return true; // No condition means always available
    }

    // Get GameUI instance to access quest states
    const gameUI = (window as any).gameUI;
    if (!gameUI) {
      return true; // If no GameUI, allow dialogue
    }

    switch (condition.type) {
      case 'quest_status':
        if (condition.questId && condition.status) {
          const questState = gameUI.questStates?.get(condition.questId);
          if (!questState) {
            return false;
          }
          return questState.status === condition.status;
        }
        return false;

      case 'affinity_level':
        if (condition.npcId && condition.minAffinity !== undefined) {
          const npcSystem = this.getNPCSystem();
          if (!npcSystem) {
            return false;
          }
          const npc = npcSystem.getNPC(condition.npcId);
          if (!npc) {
            return false;
          }
          return (npc.affinity || 0) >= condition.minAffinity;
        }
        return false;

      case 'item_possession':
        if (condition.itemId && condition.minQuantity !== undefined) {
          const itemSystem = (window as any).gameUI?.itemSystem;
          if (!itemSystem) {
            return false;
          }
          const quantity = itemSystem.getItemQuantity(condition.itemId);
          return quantity >= condition.minQuantity;
        }
        return false;

      default:
        return true;
    }
  }

  /**
   * Select a dialogue topic for a character
   * Prioritizes topics not recently seen
   * Supports fallback to generic "adventurer" dialogues for randomly generated adventurers
   * Checks dialogue conditions before selecting
   */
  public selectDialogueTopic(characterId: EntityId): DialogueTopic | null {
    let topics = this.dialogues.get(characterId);
    
    // If no specific dialogues found, try fallback to "adventurer" for randomly generated adventurers (profession: "无")
    if ((!topics || topics.length === 0) && this.isRandomAdventurer(characterId)) {
      topics = this.dialogues.get('adventurer');
    }
    
    if (!topics || topics.length === 0) {
      return null;
    }

    // Filter topics by condition
    const availableTopics = topics.filter(topic => {
      return this.checkDialogueCondition(topic.condition);
    });
    
    if (availableTopics.length === 0) {
      return null;
    }

    const history = this.dialogueHistory.get(characterId) || new Map();
    const currentTime = Date.now();
    const recentThreshold = 30 * 60 * 1000; // 30 minutes

    // Find topics not seen recently (among available topics)
    const unseenTopics = availableTopics.filter(topic => {
      const lastSeen = history.get(topic.id);
      return !lastSeen || (currentTime - lastSeen) > recentThreshold;
    });

    // If all topics have been seen recently, allow any available topic
    const selectableTopics = unseenTopics.length > 0 ? unseenTopics : availableTopics;

    // Prioritize conditional dialogues (quest-related) over regular dialogues
    const conditionalTopics = selectableTopics.filter(topic => topic.condition);
    const finalTopics = conditionalTopics.length > 0 ? conditionalTopics : selectableTopics;

    // Select a random topic from final topics
    const randomIndex = Math.floor(Math.random() * finalTopics.length);
    const selected = finalTopics[randomIndex];
    return selected;
  }

  /**
   * Check if a character is a randomly generated adventurer (type: 'Adventurer')
   * Checks both recruited and non-recruited NPCs
   */
  private isRandomAdventurer(characterId: EntityId): boolean {
    const npcSystem = this.getNPCSystem();
    if (!npcSystem) {
      return false;
    }
    
    // Check recruited characters first
    const recruited = npcSystem.getRecruitedCharacter(characterId);
    if (recruited) {
      return recruited.type === 'Adventurer';
    }
    
    // Also check non-recruited NPCs
    const npc = npcSystem.getNPC(characterId);
    if (npc) {
      return npc.type === 'Adventurer';
    }
    
    return false;
  }

  /**
   * Process a player's response to a dialogue
   */
  public processResponse(
    playerId: EntityId,
    characterId: EntityId,
    topicId: string,
    responseIndex: number
  ): DialogueResult {
    // Find the dialogue topic - with adventurer fallback
    let topics = this.dialogues.get(characterId);
    if ((!topics || topics.length === 0) && this.isRandomAdventurer(characterId)) {
      topics = this.dialogues.get('adventurer');
    }
    if (!topics) {
      return {
        success: false,
        affinityChange: 0,
        newAffinityLevel: 0,
        message: 'Character has no dialogues'
      };
    }

    const topic = topics.find(t => t.id === topicId);
    if (!topic) {
      return {
        success: false,
        affinityChange: 0,
        newAffinityLevel: 0,
        message: 'Topic not found'
      };
    }

    // Validate response index
    if (!Number.isInteger(responseIndex) || responseIndex < 0 || responseIndex >= topic.responses.length) {
      return {
        success: false,
        affinityChange: 0,
        newAffinityLevel: 0,
        message: 'Invalid response index'
      };
    }

    const response = topic.responses[responseIndex];
    const affinityChange = response.affinityEffect;

    // Get AffinitySystem to apply affinity change
    const affinitySystem = this.getAffinitySystem();
    if (!affinitySystem) {
      return {
        success: false,
        affinityChange: 0,
        newAffinityLevel: 0,
        message: 'AffinitySystem not found'
      };
    }

    // Apply affinity change to ECS component
    const currentAffinity = affinitySystem.getAffinityLevel(playerId, characterId);
    const newAffinity = Math.max(-100, Math.min(100, currentAffinity + affinityChange));
    affinitySystem.setAffinityLevel(playerId, characterId, newAffinity);

    // Also update NPCSystem's npcData.affinity for UI display
    const npcSystem = this.getNPCSystem();
    if (npcSystem) {
      npcSystem.updateAffinity(characterId, affinityChange);
    }

    // Record dialogue in history
    this.recordDialogueHistory(characterId, topicId);

    // Emit dialogue completed event
    this.eventSystem.emit({
      type: 'dialogue:completed',
      timestamp: Date.now(),
      playerId,
      characterId,
      topicId,
      responseIndex,
      affinityChange
    });

    return {
      success: true,
      affinityChange,
      newAffinityLevel: newAffinity,
      message: `Affinity ${affinityChange > 0 ? 'increased' : affinityChange < 0 ? 'decreased' : 'unchanged'} by ${Math.abs(affinityChange)}`
    };
  }

  /**
   * Record a dialogue topic in history
   */
  private recordDialogueHistory(characterId: EntityId, topicId: string): void {
    if (!this.dialogueHistory.has(characterId)) {
      this.dialogueHistory.set(characterId, new Map());
    }

    const history = this.dialogueHistory.get(characterId)!;
    history.set(topicId, Date.now());
  }

  /**
   * Get all dialogue topics for a character
   */
  public getCharacterDialogues(characterId: EntityId): DialogueTopic[] {
    const topics = this.dialogues.get(characterId);
    if (topics && topics.length > 0) {
      return topics;
    }
    if (this.isRandomAdventurer(characterId)) {
      return this.dialogues.get('adventurer') || [];
    }
    return [];
  }

  /**
   * Check if a character has dialogues
   * Also checks for generic "adventurer" dialogues for randomly generated adventurers
   */
  public hasDialogues(characterId: EntityId): boolean {
    const topics = this.dialogues.get(characterId);
    if (topics !== undefined && topics.length > 0) {
      return true;
    }
    // Fallback: check if generic "adventurer" dialogues exist for non-NPC characters
    if (this.isRandomAdventurer(characterId)) {
      const adventurerTopics = this.dialogues.get('adventurer');
      return adventurerTopics !== undefined && adventurerTopics.length > 0;
    }
    return false;
  }

  /**
   * Get dialogue history for a character
   */
  public getDialogueHistory(characterId: EntityId): Map<string, number> {
    return this.dialogueHistory.get(characterId) || new Map();
  }

  /**
   * Get AffinitySystem from world
   */
  private getAffinitySystem(): AffinitySystem | null {
    if (!this.world) {
      return null;
    }
    return this.world.getSystem<AffinitySystem>('AffinitySystem');
  }

  /**
   * Get NPCSystem from world
   */
  private getNPCSystem(): any | null {
    if (!this.world) {
      return null;
    }
    return this.world.getSystem<any>('NPCSystem');
  }

  /**
   * System update - called each frame
   */
  public update(deltaTime: number): void {
    // Dialogue system is event-driven, no per-frame updates needed
  }
}
