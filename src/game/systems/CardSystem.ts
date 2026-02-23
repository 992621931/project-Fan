/**
 * Card System - Manages card collection
 */

import { System } from '../../ecs/System';
import { World } from '../../ecs/World';
import cardsData from '../data/cards.json';

export interface Card {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'mythic' | 'legendary';
  image: string;
  width: number;
  height: number;
  holographic: boolean;
  obtainMethod: string;
  description: string;
}

export class CardSystem extends System {
  public readonly name = 'CardSystem';
  public readonly requiredComponents: any[] = [];
  
  private cards: Map<string, Card> = new Map();
  private ownedCards: Set<string> = new Set(); // Cards the player owns
  
  constructor(world: World) {
    super();
    this.loadCards();
  }

  /**
   * Load cards from JSON data
   */
  private loadCards(): void {
    try {
      const cardList = cardsData.cards || [];
      cardList.forEach((cardData: any) => {
        this.cards.set(cardData.id, cardData as Card);
      });
      console.log(`[CardSystem] Loaded ${this.cards.size} cards`);
    } catch (error) {
      console.error('[CardSystem] Failed to load cards:', error);
    }
  }

  /**
   * Get all available cards
   */
  public getAllCards(): Card[] {
    return Array.from(this.cards.values());
  }

  /**
   * Get a specific card by ID
   */
  public getCard(cardId: string): Card | undefined {
    return this.cards.get(cardId);
  }

  /**
   * Add a card to player's collection
   */
  public addCard(cardId: string): boolean {
    if (!this.cards.has(cardId)) {
      console.warn(`[CardSystem] Card ${cardId} does not exist`);
      return false;
    }
    
    if (this.ownedCards.has(cardId)) {
      console.log(`[CardSystem] Player already owns card ${cardId}`);
      return false;
    }
    
    this.ownedCards.add(cardId);
    console.log(`[CardSystem] Added card ${cardId} to collection`);
    return true;
  }

  /**
   * Check if player owns a card
   */
  public ownsCard(cardId: string): boolean {
    return this.ownedCards.has(cardId);
  }

  /**
   * Get all owned cards
   */
  public getOwnedCards(): Card[] {
    return Array.from(this.ownedCards)
      .map(id => this.cards.get(id))
      .filter(card => card !== undefined) as Card[];
  }

  /**
   * Get collection progress
   */
  public getCollectionProgress(): { owned: number; total: number; percentage: number } {
    const owned = this.ownedCards.size;
    const total = this.cards.size;
    const percentage = total > 0 ? Math.round((owned / total) * 100) : 0;
    return { owned, total, percentage };
  }

  /**
   * Add all cards to collection (for developer function)
   */
  public addAllCards(): void {
    this.cards.forEach((card, id) => {
      this.ownedCards.add(id);
    });
    console.log(`[CardSystem] Added all ${this.cards.size} cards to collection`);
  }

  public update(deltaTime: number): void {
    // No update logic needed for card system
  }
}
