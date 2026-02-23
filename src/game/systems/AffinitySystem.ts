/**
 * Affinity System
 * Handles character relationships, interactions, and gift-giving
 */

import { System } from '../../ecs/System';
import { ComponentType } from '../../ecs/Component';
import { EntityId } from '../../ecs/Entity';
import { 
  AffinityComponent,
  AffinityComponentType,
  CharacterInfoComponent,
  CharacterInfoComponentType
} from '../components/CharacterComponents';
import { 
  InventoryComponent,
  InventoryComponentType
} from '../components/SystemComponents';
import { 
  ItemComponent,
  ItemComponentType
} from '../components/ItemComponents';
import { ItemType, GameObjectId } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

/**
 * Interaction types that affect affinity
 */
export enum InteractionType {
  Conversation = 'conversation',
  Gift = 'gift',
  CombatTogether = 'combat_together',
  WorkTogether = 'work_together',
  Praise = 'praise',
  Criticism = 'criticism',
  Help = 'help',
  Ignore = 'ignore'
}

/**
 * Gift preferences for characters
 */
export interface GiftPreference {
  itemType: ItemType;
  rarity: RarityType;
  affinityBonus: number; // Additional bonus for preferred items
}

/**
 * Affinity stage configuration
 */
export interface AffinityStage {
  id: string;
  name: string;
  minAffinity: number;
  maxAffinity: number;
  unlocks: AffinityUnlock[];
}

/**
 * Things unlocked at different affinity stages
 */
export interface AffinityUnlock {
  type: 'dialogue' | 'skill' | 'item' | 'story';
  id: string;
  name: string;
  description: string;
}

/**
 * Interaction result
 */
export interface InteractionResult {
  success: boolean;
  affinityChange: number;
  newAffinityLevel: number;
  stageChanged: boolean;
  newStage?: AffinityStage;
  unlockedContent?: AffinityUnlock[];
  message: string;
}

/**
 * Gift result
 */
export interface GiftResult extends InteractionResult {
  itemConsumed: boolean;
  preferenceMatch: boolean;
}

/**
 * Affinity system events
 */
export interface AffinityEvents {
  'affinity:interaction': { 
    characterId: EntityId; 
    targetId: EntityId; 
    interactionType: InteractionType; 
    affinityChange: number 
  };
  'affinity:gift_given': { 
    giverId: EntityId; 
    receiverId: EntityId; 
    itemId: EntityId; 
    affinityChange: number 
  };
  'affinity:stage_changed': { 
    characterId: EntityId; 
    targetId: EntityId; 
    oldStage: AffinityStage; 
    newStage: AffinityStage 
  };
  'affinity:content_unlocked': { 
    characterId: EntityId; 
    targetId: EntityId; 
    unlockedContent: AffinityUnlock[] 
  };
}

/**
 * Affinity System
 * Manages character relationships and interactions
 */
export class AffinitySystem extends System {
  public readonly name = 'AffinitySystem';
  public readonly requiredComponents: ComponentType<any>[] = [AffinityComponentType];

  private affinityStages: AffinityStage[] = [];
  private giftPreferences: Map<string, GiftPreference[]> = new Map();
  private interactionCooldowns: Map<string, number> = new Map();

  protected onInitialize(): void {
    this.initializeAffinityStages();
    this.initializeGiftPreferences();
    this.setupEventListeners();
  }

  /**
   * Initialize affinity stages
   */
  private initializeAffinityStages(): void {
    this.affinityStages = [
      {
        id: 'stranger',
        name: '陌生人',
        minAffinity: -100,
        maxAffinity: 0,
        unlocks: []
      },
      {
        id: 'acquaintance',
        name: '熟人',
        minAffinity: 1,
        maxAffinity: 25,
        unlocks: [
          {
            type: 'dialogue',
            id: 'basic_chat',
            name: '基础对话',
            description: '可以进行简单的对话'
          }
        ]
      },
      {
        id: 'friend',
        name: '朋友',
        minAffinity: 26,
        maxAffinity: 50,
        unlocks: [
          {
            type: 'dialogue',
            id: 'personal_chat',
            name: '个人话题',
            description: '可以聊一些个人话题'
          },
          {
            type: 'skill',
            id: 'cooperation_bonus',
            name: '合作加成',
            description: '一起工作时效率提升'
          }
        ]
      },
      {
        id: 'close_friend',
        name: '密友',
        minAffinity: 51,
        maxAffinity: 75,
        unlocks: [
          {
            type: 'dialogue',
            id: 'deep_conversation',
            name: '深度对话',
            description: '可以进行深入的对话'
          },
          {
            type: 'skill',
            id: 'combat_synergy',
            name: '战斗协同',
            description: '一起战斗时有特殊配合'
          }
        ]
      },
      {
        id: 'best_friend',
        name: '挚友',
        minAffinity: 76,
        maxAffinity: 100,
        unlocks: [
          {
            type: 'dialogue',
            id: 'heart_to_heart',
            name: '推心置腹',
            description: '可以分享最深层的想法'
          },
          {
            type: 'story',
            id: 'personal_story',
            name: '个人故事',
            description: '解锁角色的个人背景故事'
          },
          {
            type: 'item',
            id: 'friendship_token',
            name: '友谊信物',
            description: '获得特殊的友谊纪念品'
          }
        ]
      }
    ];
  }

  /**
   * Initialize gift preferences for different character types
   */
  private initializeGiftPreferences(): void {
    // Default preferences - can be customized per character
    const defaultPreferences: GiftPreference[] = [
      { itemType: ItemType.Food, rarity: RarityType.Common, affinityBonus: 2 },
      { itemType: ItemType.Food, rarity: RarityType.Rare, affinityBonus: 5 },
      { itemType: ItemType.Equipment, rarity: RarityType.Rare, affinityBonus: 3 },
      { itemType: ItemType.Gem, rarity: RarityType.Epic, affinityBonus: 8 },
      { itemType: ItemType.Consumable, rarity: RarityType.Common, affinityBonus: 1 }
    ];

    // Set default preferences for all characters
    this.giftPreferences.set('default', defaultPreferences);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for combat events to increase affinity
    this.eventSystem.subscribe('combat:victory', (event: any) => {
      if (event.partyMembers && event.partyMembers.length > 1) {
        this.handleCombatTogether(event.partyMembers);
      }
    });

    // Listen for work events
    this.eventSystem.subscribe('work:completed_together', (event: any) => {
      if (event.workers && event.workers.length > 1) {
        this.handleWorkTogether(event.workers);
      }
    });
  }

  /**
   * Handle characters fighting together
   */
  private handleCombatTogether(partyMembers: EntityId[]): void {
    for (let i = 0; i < partyMembers.length; i++) {
      for (let j = i + 1; j < partyMembers.length; j++) {
        this.interact(partyMembers[i], partyMembers[j], InteractionType.CombatTogether);
      }
    }
  }

  /**
   * Handle characters working together
   */
  private handleWorkTogether(workers: EntityId[]): void {
    for (let i = 0; i < workers.length; i++) {
      for (let j = i + 1; j < workers.length; j++) {
        this.interact(workers[i], workers[j], InteractionType.WorkTogether);
      }
    }
  }

  /**
   * Perform an interaction between two characters
   */
  public interact(characterId: EntityId, targetId: EntityId, interactionType: InteractionType): InteractionResult {
    const characterAffinity = this.getComponent(characterId, AffinityComponentType);
    const targetAffinity = this.getComponent(targetId, AffinityComponentType);

    if (!characterAffinity || !targetAffinity) {
      return {
        success: false,
        affinityChange: 0,
        newAffinityLevel: 0,
        stageChanged: false,
        message: 'One or both characters do not have affinity components'
      };
    }

    // Check cooldown
    const cooldownKey = `${characterId}-${targetId}-${interactionType}`;
    const lastInteraction = this.interactionCooldowns.get(cooldownKey) || 0;
    const currentTime = Date.now();
    const cooldownTime = this.getInteractionCooldown(interactionType);

    if (currentTime - lastInteraction < cooldownTime) {
      return {
        success: false,
        affinityChange: 0,
        newAffinityLevel: this.getAffinityLevel(characterId, targetId),
        stageChanged: false,
        message: 'Interaction is on cooldown'
      };
    }

    // Calculate affinity change
    const affinityChange = this.calculateAffinityChange(interactionType);
    const currentAffinity = this.getAffinityLevel(characterId, targetId);
    const newAffinity = Math.max(-100, Math.min(100, currentAffinity + affinityChange));

    // Update affinity
    this.setAffinityLevel(characterId, targetId, newAffinity);

    // Check for stage change
    const oldStage = this.getAffinityStage(currentAffinity);
    const newStage = this.getAffinityStage(newAffinity);
    const stageChanged = oldStage.id !== newStage.id;

    let unlockedContent: AffinityUnlock[] = [];
    if (stageChanged && newAffinity > currentAffinity) {
      unlockedContent = newStage.unlocks;
      
      // Emit stage changed event
      this.eventSystem.emit({
        type: 'affinity:stage_changed',
        timestamp: Date.now(),
        characterId,
        targetId,
        oldStage,
        newStage
      });

      if (unlockedContent.length > 0) {
        this.eventSystem.emit({
          type: 'affinity:content_unlocked',
          timestamp: Date.now(),
          characterId,
          targetId,
          unlockedContent
        });
      }
    }

    // Set cooldown
    this.interactionCooldowns.set(cooldownKey, currentTime);

    // Emit interaction event
    this.eventSystem.emit({
      type: 'affinity:interaction',
      timestamp: Date.now(),
      characterId,
      targetId,
      interactionType,
      affinityChange
    });

    return {
      success: true,
      affinityChange,
      newAffinityLevel: newAffinity,
      stageChanged,
      newStage: stageChanged ? newStage : undefined,
      unlockedContent: stageChanged ? unlockedContent : undefined,
      message: `Affinity ${affinityChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(affinityChange)}`
    };
  }

  /**
   * Give a gift from one character to another
   */
  public giveGift(giverId: EntityId, receiverId: EntityId, itemId: EntityId): GiftResult {
    const item = this.getComponent(itemId, ItemComponentType);
    const giverInventory = this.getComponent(giverId, InventoryComponentType);

    if (!item || !giverInventory) {
      return {
        success: false,
        affinityChange: 0,
        newAffinityLevel: this.getAffinityLevel(giverId, receiverId),
        stageChanged: false,
        itemConsumed: false,
        preferenceMatch: false,
        message: 'Invalid item or giver inventory'
      };
    }

    // Check if giver has the item
    const itemSlot = giverInventory.slots.find(slot => slot.item === itemId && slot.quantity > 0);
    if (!itemSlot) {
      return {
        success: false,
        affinityChange: 0,
        newAffinityLevel: this.getAffinityLevel(giverId, receiverId),
        stageChanged: false,
        itemConsumed: false,
        preferenceMatch: false,
        message: 'Giver does not have this item'
      };
    }

    // Calculate affinity change based on gift
    let affinityChange = this.calculateGiftAffinityChange(receiverId, item);
    const preferenceMatch = this.isPreferredGift(receiverId, item);

    if (preferenceMatch) {
      const preferences = this.getCharacterGiftPreferences(receiverId);
      const matchingPreference = preferences.find(p => 
        p.itemType === item.itemType && p.rarity === item.rarity
      );
      if (matchingPreference) {
        affinityChange += matchingPreference.affinityBonus;
      }
    }

    // Perform the interaction
    const currentAffinity = this.getAffinityLevel(giverId, receiverId);
    const newAffinity = Math.max(-100, Math.min(100, currentAffinity + affinityChange));

    // Update affinity
    this.setAffinityLevel(giverId, receiverId, newAffinity);

    // Consume the item
    itemSlot.quantity -= 1;
    if (itemSlot.quantity <= 0) {
      itemSlot.item = null;
    }

    // Check for stage change
    const oldStage = this.getAffinityStage(currentAffinity);
    const newStage = this.getAffinityStage(newAffinity);
    const stageChanged = oldStage.id !== newStage.id;

    let unlockedContent: AffinityUnlock[] = [];
    if (stageChanged && newAffinity > currentAffinity) {
      unlockedContent = newStage.unlocks;
      
      // Emit stage changed event
      this.eventSystem.emit({
        type: 'affinity:stage_changed',
        timestamp: Date.now(),
        characterId: giverId,
        targetId: receiverId,
        oldStage,
        newStage
      });

      if (unlockedContent.length > 0) {
        this.eventSystem.emit({
          type: 'affinity:content_unlocked',
          timestamp: Date.now(),
          characterId: giverId,
          targetId: receiverId,
          unlockedContent
        });
      }
    }

    // Emit gift given event
    this.eventSystem.emit({
      type: 'affinity:gift_given',
      timestamp: Date.now(),
      giverId,
      receiverId,
      itemId,
      affinityChange
    });

    return {
      success: true,
      affinityChange,
      newAffinityLevel: newAffinity,
      stageChanged,
      newStage: stageChanged ? newStage : undefined,
      unlockedContent: stageChanged ? unlockedContent : undefined,
      itemConsumed: true,
      preferenceMatch,
      message: `Gift given! Affinity ${affinityChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(affinityChange)}`
    };
  }

  /**
   * Get affinity level between two characters
   */
  public getAffinityLevel(characterId: EntityId, targetId: EntityId): number {
    const affinity = this.getComponent(characterId, AffinityComponentType);
    if (!affinity) return 0;

    return affinity.relationships.get(targetId) || 0;
  }

  /**
   * Set affinity level between two characters (bidirectional)
   */
  public setAffinityLevel(characterId: EntityId, targetId: EntityId, level: number): void {
    const characterAffinity = this.getComponent(characterId, AffinityComponentType);
    const targetAffinity = this.getComponent(targetId, AffinityComponentType);

    if (characterAffinity) {
      characterAffinity.relationships.set(targetId, level);
    }

    if (targetAffinity) {
      targetAffinity.relationships.set(characterId, level);
    }
  }

  /**
   * Get affinity stage for a given affinity level
   */
  public getAffinityStage(affinityLevel: number): AffinityStage {
    for (const stage of this.affinityStages) {
      if (affinityLevel >= stage.minAffinity && affinityLevel <= stage.maxAffinity) {
        return stage;
      }
    }
    return this.affinityStages[0]; // Default to first stage
  }

  /**
   * Get all relationships for a character
   */
  public getCharacterRelationships(characterId: EntityId): Map<GameObjectId, number> {
    const affinity = this.getComponent(characterId, AffinityComponentType);
    return affinity ? affinity.relationships : new Map();
  }

  /**
   * Get characters at a specific affinity stage with the given character
   */
  public getCharactersAtStage(characterId: EntityId, stageId: string): EntityId[] {
    const relationships = this.getCharacterRelationships(characterId);
    const result: EntityId[] = [];

    for (const [targetId, affinityLevel] of relationships.entries()) {
      const stage = this.getAffinityStage(affinityLevel);
      if (stage.id === stageId) {
        result.push(targetId);
      }
    }

    return result;
  }

  /**
   * Calculate affinity change for different interaction types
   */
  private calculateAffinityChange(interactionType: InteractionType): number {
    switch (interactionType) {
      case InteractionType.Conversation:
        return Math.floor(Math.random() * 3) + 1; // 1-3
      case InteractionType.CombatTogether:
        return Math.floor(Math.random() * 2) + 2; // 2-3
      case InteractionType.WorkTogether:
        return Math.floor(Math.random() * 2) + 1; // 1-2
      case InteractionType.Praise:
        return Math.floor(Math.random() * 3) + 2; // 2-4
      case InteractionType.Help:
        return Math.floor(Math.random() * 4) + 3; // 3-6
      case InteractionType.Criticism:
        return -(Math.floor(Math.random() * 2) + 1); // -1 to -2
      case InteractionType.Ignore:
        return -(Math.floor(Math.random() * 2) + 1); // -1 to -2
      default:
        return 1;
    }
  }

  /**
   * Calculate affinity change for gifts
   */
  private calculateGiftAffinityChange(receiverId: EntityId, item: ItemComponent): number {
    let baseChange = 3; // Base gift affinity

    // Rarity bonus
    switch (item.rarity) {
      case RarityType.Common:
        baseChange += 1;
        break;
      case RarityType.Rare:
        baseChange += 3;
        break;
      case RarityType.Epic:
        baseChange += 5;
        break;
      case RarityType.Legendary:
        baseChange += 8;
        break;
    }

    // Item type bonus
    switch (item.itemType) {
      case ItemType.Food:
        baseChange += 2;
        break;
      case ItemType.Gem:
        baseChange += 3;
        break;
      case ItemType.Equipment:
        baseChange += 1;
        break;
    }

    return baseChange;
  }

  /**
   * Check if an item is a preferred gift for a character
   */
  private isPreferredGift(characterId: EntityId, item: ItemComponent): boolean {
    const preferences = this.getCharacterGiftPreferences(characterId);
    return preferences.some(p => p.itemType === item.itemType && p.rarity === item.rarity);
  }

  /**
   * Get gift preferences for a character
   */
  private getCharacterGiftPreferences(characterId: EntityId): GiftPreference[] {
    // For now, use default preferences
    // In the future, this could be customized per character
    return this.giftPreferences.get('default') || [];
  }

  /**
   * Get interaction cooldown time in milliseconds
   */
  private getInteractionCooldown(interactionType: InteractionType): number {
    switch (interactionType) {
      case InteractionType.Conversation:
        return 5 * 60 * 1000; // 5 minutes
      case InteractionType.Gift:
        return 24 * 60 * 60 * 1000; // 24 hours
      case InteractionType.CombatTogether:
        return 0; // No cooldown for combat
      case InteractionType.WorkTogether:
        return 0; // No cooldown for work
      case InteractionType.Praise:
        return 10 * 60 * 1000; // 10 minutes
      case InteractionType.Help:
        return 30 * 60 * 1000; // 30 minutes
      default:
        return 5 * 60 * 1000; // Default 5 minutes
    }
  }

  /**
   * System update - called each frame
   */
  public update(deltaTime: number): void {
    // Affinity system is mostly event-driven
    // Could add periodic relationship decay or other time-based effects here
  }

  /**
   * Get all affinity stages
   */
  public getAffinityStages(): AffinityStage[] {
    return [...this.affinityStages];
  }

  /**
   * Add custom gift preferences for a character
   */
  public setCharacterGiftPreferences(characterId: EntityId, preferences: GiftPreference[]): void {
    this.giftPreferences.set(characterId, preferences);
  }
}