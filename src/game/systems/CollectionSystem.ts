/**
 * Collection System
 * Handles collection tracking, achievements, and rewards
 */

import { System } from '../../ecs/System';
import { World } from '../../ecs/World';
import { EntityId } from '../../ecs/Entity';
import { EventSystem } from '../../ecs/EventSystem';
import { 
  CollectionComponent, 
  CollectionComponentType,
  Achievement,
  AchievementReward
} from '../components/SystemComponents';
import { 
  CharacterInfoComponent,
  CharacterInfoComponentType
} from '../components/CharacterComponents';
import { 
  ItemComponent,
  ItemComponentType
} from '../components/ItemComponents';
import { CurrencyComponent, CurrencyComponentType } from '../components/SystemComponents';
import { ItemType, GameObjectId } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

/**
 * Collection categories for organization
 */
export enum CollectionCategory {
  Characters = 'characters',
  Equipment = 'equipment',
  Materials = 'materials',
  Food = 'food',
  Achievements = 'achievements'
}

/**
 * Collection entry for tracking discovered items/characters
 */
export interface CollectionEntry {
  id: string;
  name: string;
  category: CollectionCategory;
  rarity: RarityType;
  discovered: boolean;
  firstDiscoveredAt?: number;
  timesEncountered: number;
}

/**
 * Collection system events
 */
export interface CollectionEvents {
  'collection:item_discovered': { itemId: string; category: CollectionCategory };
  'collection:character_discovered': { characterId: string };
  'collection:achievement_unlocked': { achievementId: string; rewards: AchievementReward[] };
  'collection:category_completed': { category: CollectionCategory; completionRate: number };
}

/**
 * Collection System
 * Manages collection tracking, progress, and achievements
 */
export class CollectionSystem extends System {
  public readonly name = 'CollectionSystem';
  public readonly requiredComponents: ComponentType<any>[] = [];
  
  private collectionEntries: Map<string, CollectionEntry> = new Map();
  private achievements: Map<string, Achievement> = new Map();
  private playerEntityId: EntityId | null = null;

  constructor() {
    super();
    this.initializeAchievements();
  }

  protected onInitialize(): void {
    this.setupEventListeners();
  }

  /**
   * Set the player entity ID for reward granting
   */
  public setPlayerEntity(playerId: EntityId): void {
    this.playerEntityId = playerId;
  }

  /**
   * Initialize default achievements
   */
  private initializeAchievements(): void {
    const defaultAchievements: Achievement[] = [
      {
        id: 'first_character',
        name: '初次相遇',
        description: '招募第一个角色',
        category: 'characters',
        unlocked: false,
        progress: 0,
        maxProgress: 1,
        rewards: [
          { type: 'currency', value: 'gold', amount: 100 }
        ]
      },
      {
        id: 'character_collector',
        name: '角色收集家',
        description: '收集10个不同的角色',
        category: 'characters',
        unlocked: false,
        progress: 0,
        maxProgress: 10,
        rewards: [
          { type: 'currency', value: 'crystal', amount: 50 }
        ]
      },
      {
        id: 'rare_finder',
        name: '稀有发现者',
        description: '发现第一个稀有物品',
        category: 'equipment',
        unlocked: false,
        progress: 0,
        maxProgress: 1,
        rewards: [
          { type: 'currency', value: 'reputation', amount: 10 }
        ]
      },
      {
        id: 'legendary_collector',
        name: '传说收藏家',
        description: '收集一个传说级物品',
        category: 'equipment',
        unlocked: false,
        progress: 0,
        maxProgress: 1,
        rewards: [
          { type: 'currency', value: 'crystal', amount: 100 }
        ]
      },
      {
        id: 'completionist',
        name: '完美主义者',
        description: '完成所有收集类别',
        category: 'achievements',
        unlocked: false,
        progress: 0,
        maxProgress: 4, // characters, equipment, materials, food
        rewards: [
          { type: 'currency', value: 'crystal', amount: 500 },
          { type: 'currency', value: 'reputation', amount: 100 }
        ]
      }
    ];

    defaultAchievements.forEach(achievement => {
      this.achievements.set(achievement.id, achievement);
    });
  }

  /**
   * Setup event listeners for automatic collection updates
   */
  private setupEventListeners(): void {
    // Listen for character recruitment
    this.eventSystem.subscribe('character:recruited', (event: any) => {
      this.discoverCharacter(event.characterId);
    });

    // Listen for item acquisition
    this.eventSystem.subscribe('inventory:item_added', (event: any) => {
      this.discoverItem(event.itemId);
    });

    // Listen for crafting completion
    this.eventSystem.subscribe('crafting:item_created', (event: any) => {
      this.discoverItem(event.itemId);
    });
  }

  /**
   * Discover a new character and update collection
   */
  public discoverCharacter(characterId: EntityId): void {
    const characterInfo = this.getComponent(characterId, CharacterInfoComponentType);
    if (!characterInfo) return;

    const entryId = `character_${characterInfo.name}`;
    
    if (!this.collectionEntries.has(entryId)) {
      const entry: CollectionEntry = {
        id: entryId,
        name: characterInfo.name,
        category: CollectionCategory.Characters,
        rarity: characterInfo.rarity,
        discovered: true,
        firstDiscoveredAt: Date.now(),
        timesEncountered: 1
      };
      
      this.collectionEntries.set(entryId, entry);
      this.updateCollectionComponent(characterId);
      
      // Emit discovery event
      this.eventSystem.emit({
        type: 'collection:character_discovered',
        timestamp: Date.now(),
        characterId: entryId
      });
      
      // Update achievements
      this.updateAchievementProgress('first_character', 1);
      this.updateAchievementProgress('character_collector', 1);
    } else {
      // Increment encounter count
      const entry = this.collectionEntries.get(entryId)!;
      entry.timesEncountered++;
      this.updateCollectionComponent(characterId);
    }
  }

  /**
   * Discover a new item and update collection
   */
  public discoverItem(itemId: EntityId): void {
    const item = this.getComponent(itemId, ItemComponentType);
    if (!item) return;

    const category = this.getItemCategory(item.itemType);
    const entryId = `item_${item.id}`;
    
    if (!this.collectionEntries.has(entryId)) {
      const entry: CollectionEntry = {
        id: entryId,
        name: item.name,
        category,
        rarity: item.rarity,
        discovered: true,
        firstDiscoveredAt: Date.now(),
        timesEncountered: 1
      };
      
      this.collectionEntries.set(entryId, entry);
      this.updateCollectionComponent(itemId);
      
      // Emit discovery event
      this.eventSystem.emit({
        type: 'collection:item_discovered',
        timestamp: Date.now(),
        itemId: entryId,
        category
      });
      
      // Update rarity-based achievements
      if (item.rarity === RarityType.Rare) {
        this.updateAchievementProgress('rare_finder', 1);
      } else if (item.rarity === RarityType.Legendary) {
        this.updateAchievementProgress('legendary_collector', 1);
      }
    } else {
      // Increment encounter count
      const entry = this.collectionEntries.get(entryId)!;
      entry.timesEncountered++;
      this.updateCollectionComponent(itemId);
    }
  }

  /**
   * Get collection category for item type
   */
  private getItemCategory(itemType: ItemType): CollectionCategory {
    switch (itemType) {
      case ItemType.Equipment:
        return CollectionCategory.Equipment;
      case ItemType.Material:
        return CollectionCategory.Materials;
      case ItemType.Food:
      case ItemType.Consumable:
        return CollectionCategory.Food;
      default:
        return CollectionCategory.Materials;
    }
  }

  /**
   * Update achievement progress
   */
  private updateAchievementProgress(achievementId: string, increment: number): void {
    const achievement = this.achievements.get(achievementId);
    if (!achievement || achievement.unlocked) return;

    achievement.progress = Math.min(achievement.progress + increment, achievement.maxProgress);
    
    if (achievement.progress >= achievement.maxProgress) {
      this.unlockAchievement(achievementId);
    }
  }

  /**
   * Unlock an achievement and grant rewards
   */
  private unlockAchievement(achievementId: string): void {
    const achievement = this.achievements.get(achievementId);
    if (!achievement || achievement.unlocked) return;

    achievement.unlocked = true;
    
    // Grant rewards
    this.grantAchievementRewards(achievement.rewards);
    
    // Emit achievement unlocked event
    this.eventSystem.emit({
      type: 'collection:achievement_unlocked',
      timestamp: Date.now(),
      achievementId,
      rewards: achievement.rewards
    });

    // Check for completionist achievement
    if (achievementId !== 'completionist') {
      this.checkCompletionistProgress();
    }
  }

  /**
   * Grant achievement rewards to player
   */
  private grantAchievementRewards(rewards: AchievementReward[]): void {
    if (!this.playerEntityId) return;

    const currency = this.getComponent(this.playerEntityId, CurrencyComponentType);
    if (!currency) return;

    rewards.forEach(reward => {
      if (reward.type === 'currency') {
        const currencyType = reward.value as 'gold' | 'crystal' | 'reputation';
        currency.amounts[currencyType] += reward.amount;
        
        // Record transaction
        currency.transactionHistory.push({
          type: 'gain',
          currency: currencyType,
          amount: reward.amount,
          reason: 'Achievement reward',
          timestamp: Date.now()
        });
      }
    });
  }

  /**
   * Check progress towards completionist achievement
   */
  private checkCompletionistProgress(): void {
    const categories = [
      CollectionCategory.Characters,
      CollectionCategory.Equipment,
      CollectionCategory.Materials,
      CollectionCategory.Food
    ];

    let completedCategories = 0;
    
    categories.forEach(category => {
      const categoryEntries = Array.from(this.collectionEntries.values())
        .filter(entry => entry.category === category);
      
      if (categoryEntries.length > 0) {
        const completionRate = this.getCategoryCompletionRate(category);
        if (completionRate >= 0.8) { // 80% completion threshold
          completedCategories++;
        }
      }
    });

    const completionistAchievement = this.achievements.get('completionist');
    if (completionistAchievement && !completionistAchievement.unlocked) {
      completionistAchievement.progress = completedCategories;
      if (completedCategories >= completionistAchievement.maxProgress) {
        this.unlockAchievement('completionist');
      }
    }
  }

  /**
   * Get completion rate for a category
   */
  public getCategoryCompletionRate(category: CollectionCategory): number {
    const categoryEntries = Array.from(this.collectionEntries.values())
      .filter(entry => entry.category === category);
    
    if (categoryEntries.length === 0) return 0;
    
    const discoveredCount = categoryEntries.filter(entry => entry.discovered).length;
    return discoveredCount / categoryEntries.length;
  }

  /**
   * Update collection component for an entity
   */
  private updateCollectionComponent(entityId: EntityId): void {
    // Always update the player's collection component, not the individual entity
    if (!this.playerEntityId) return;
    
    let collection = this.getComponent(this.playerEntityId, CollectionComponentType);
    
    if (!collection) {
      // Create collection component if it doesn't exist
      collection = {
        type: 'collection',
        unlockedItems: new Set(),
        unlockedCharacters: new Set(),
        achievements: [],
        completionPercentage: 0
      };
      this.componentManager.addComponent(this.playerEntityId, CollectionComponentType, collection);
    }

    // Clear and rebuild unlocked sets
    collection.unlockedItems.clear();
    collection.unlockedCharacters.clear();

    // Update unlocked items and characters
    this.collectionEntries.forEach((entry, id) => {
      if (entry.discovered) {
        if (entry.category === CollectionCategory.Characters) {
          collection!.unlockedCharacters.add(id);
        } else {
          collection!.unlockedItems.add(id);
        }
      }
    });

    // Update achievements
    collection.achievements = Array.from(this.achievements.values());
    
    // Calculate overall completion percentage
    const totalEntries = this.collectionEntries.size;
    const discoveredEntries = Array.from(this.collectionEntries.values())
      .filter(entry => entry.discovered).length;
    
    collection.completionPercentage = totalEntries > 0 ? (discoveredEntries / totalEntries) * 100 : 0;
  }

  /**
   * Get all collection entries
   */
  public getCollectionEntries(): CollectionEntry[] {
    return Array.from(this.collectionEntries.values());
  }

  /**
   * Get collection entries by category
   */
  public getCollectionEntriesByCategory(category: CollectionCategory): CollectionEntry[] {
    return Array.from(this.collectionEntries.values())
      .filter(entry => entry.category === category);
  }

  /**
   * Get all achievements
   */
  public getAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  /**
   * Get unlocked achievements
   */
  public getUnlockedAchievements(): Achievement[] {
    return Array.from(this.achievements.values())
      .filter(achievement => achievement.unlocked);
  }

  /**
   * Get achievement by ID
   */
  public getAchievement(id: string): Achievement | undefined {
    return this.achievements.get(id);
  }

  /**
   * Reset achievements (useful for testing)
   */
  public resetAchievements(): void {
    this.achievements.forEach(achievement => {
      achievement.progress = 0;
      achievement.unlocked = false;
    });
  }

  /**
   * Clear all collection data (useful for testing)
   */
  public clearCollectionData(): void {
    this.collectionEntries.clear();
    this.achievements.clear();
    this.initializeAchievements(); // Re-initialize fresh achievements
  }

  /**
   * System update - called each frame
   */
  public update(deltaTime: number): void {
    // Collection system is mostly event-driven, minimal update logic needed
    // Could add periodic checks or time-based achievements here
  }
}