/**
 * Equipment Crafting System
 * Handles equipment crafting mechanics
 */

import { System } from '../../ecs/System';
import { World } from '../../ecs/World';
import { ItemSystem } from './ItemSystem';
import { AffixSelector } from './AffixSelector';
import { AffixPoolConfig, AFFIX_PROBABILITY_CONFIG } from '../types/AffixTypes';
import { RarityType } from '../types/RarityTypes';

export interface EquipmentRecipe {
  id: string;
  name: string;
  rarity: string;
  type: string[];
  icon: string;
  mainAttribute: string;
  secondaryAttributes: string[];
  description: string;
  materials: { itemId: string; amount: number }[];
  buyPrice: number;
}

export class EquipmentCraftingSystem extends System {
  public readonly name = 'EquipmentCraftingSystem';
  public readonly requiredComponents: any[] = [];

  private recipes: Map<string, EquipmentRecipe> = new Map();
  private itemSystem: ItemSystem | null = null;
  private affixSelector: AffixSelector | null = null;
  private currentCrafting: {
    recipeId: string;
    startTime: number;
    duration: number;
  } | null = null;

  protected onInitialize(): void {
    // Load affix definitions
    this.loadAffixDefinitions();
    console.log('✅ Equipment Crafting System initialized');
  }

  /**
   * Load affix definitions and initialize AffixSelector
   */
  private async loadAffixDefinitions(): Promise<void> {
    try {
      const response = await fetch('src/game/data/affix-definitions.json');
      if (!response.ok) {
        throw new Error(`Failed to load affix definitions: ${response.statusText}`);
      }
      const affixPool: AffixPoolConfig = await response.json();
      this.affixSelector = new AffixSelector(affixPool, AFFIX_PROBABILITY_CONFIG);
      console.log('✅ Affix definitions loaded');
    } catch (error) {
      console.error('Failed to load affix definitions:', error);
      // Continue without affix system - equipment can still be crafted
    }
  }

  update(deltaTime: number): void {
    // Update crafting progress if crafting is in progress
    if (this.currentCrafting) {
      const elapsed = Date.now() - this.currentCrafting.startTime;
      if (elapsed >= this.currentCrafting.duration) {
        // Crafting complete
        this.completeCrafting();
      }
    }
  }

  /**
   * Set the ItemSystem reference
   */
  setItemSystem(itemSystem: ItemSystem): void {
    this.itemSystem = itemSystem;
  }

  /**
   * Load recipes from JSON data
   */
  loadRecipes(data: any): void {
    if (!data || !data.recipes) {
      console.error('Invalid recipe data');
      return;
    }

    this.recipes.clear();
    data.recipes.forEach((recipe: EquipmentRecipe) => {
      this.recipes.set(recipe.id, recipe);
      
      // Register equipment as an item in ItemSystem if not already registered
      if (this.itemSystem) {
        const existingItem = this.itemSystem.getItem(recipe.id);
        if (!existingItem) {
          // Convert recipe to ItemData format
          const itemData: any = {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            type: 'equipment' as const,
            subType: recipe.type,
            icon: recipe.icon,
            rarity: this.getRarityNumber(recipe.rarity),
            stackSize: 1, // Equipment typically doesn't stack
            canSell: true,
            canBuy: false,
            buyPrice: recipe.buyPrice,
            canCraft: true,
            craftRecipe: {
              materials: recipe.materials.map(m => ({
                itemId: m.itemId,
                quantity: m.amount
              }))
            },
            canUse: false,
            mainAttribute: recipe.mainAttribute,
            secondaryAttributes: recipe.secondaryAttributes
          };
          
          // Register the equipment as an item
          this.itemSystem.registerItem(itemData);
        }
      }
    });

    console.log(`✅ Loaded ${this.recipes.size} equipment recipes`);
  }

  /**
   * Convert rarity string to number
   */
  private getRarityNumber(rarity: string): number {
    const rarityMap: { [key: string]: number } = {
      'common': 0,      // 普通 - 灰色
      'uncommon': 0,    // 非常见 -> 映射为普通
      'rare': 1,        // 稀有 - 蓝色
      'epic': 2,        // 神话 - 紫色
      'legendary': 3    // 传说 - 橙色
    };
    return rarityMap[rarity] || 0;
  }

  /**
   * Get all recipes
   */
  getAllRecipes(): EquipmentRecipe[] {
    return Array.from(this.recipes.values());
  }

  /**
   * Get a specific recipe by ID
   */
  getRecipe(recipeId: string): EquipmentRecipe | undefined {
    return this.recipes.get(recipeId);
  }

  /**
   * Check if player has required materials for a recipe
   */
  canCraft(recipeId: string): boolean {
    const recipe = this.recipes.get(recipeId);
    if (!recipe || !this.itemSystem) {
      return false;
    }

    // Check if player has all required materials
    for (const material of recipe.materials) {
      const playerAmount = this.itemSystem.getItemQuantity(material.itemId);
      if (playerAmount < material.amount) {
        return false;
      }
    }

    return true;
  }

  /**
   * Start crafting an equipment
   */
  startCrafting(recipeId: string): boolean {
    const recipe = this.recipes.get(recipeId);
    if (!recipe || !this.itemSystem) {
      console.error('Recipe not found or ItemSystem not set');
      return false;
    }

    // Check if already crafting
    if (this.currentCrafting) {
      console.error('Already crafting');
      return false;
    }

    // Check if player has required materials
    if (!this.canCraft(recipeId)) {
      console.error('Not enough materials');
      return false;
    }

    // Consume materials
    for (const material of recipe.materials) {
      this.itemSystem.removeItem(material.itemId, material.amount);
    }

    // Calculate crafting duration based on rarity
    let duration = 2000; // Default 2 seconds for common
    switch (recipe.rarity) {
      case 'common':
        duration = 2000;
        break;
      case 'uncommon':
        duration = 3000;
        break;
      case 'rare':
        duration = 4000;
        break;
      case 'epic':
        duration = 5000;
        break;
      case 'legendary':
        duration = 6000;
        break;
    }

    // Start crafting
    this.currentCrafting = {
      recipeId,
      startTime: Date.now(),
      duration
    };

    console.log(`Started crafting ${recipe.name}`);
    return true;
  }

  /**
   * Cancel current crafting
   */
  cancelCrafting(): boolean {
    if (!this.currentCrafting) {
      return false;
    }

    // Return materials to player
    const recipe = this.recipes.get(this.currentCrafting.recipeId);
    if (recipe && this.itemSystem) {
      for (const material of recipe.materials) {
        this.itemSystem.addItem(material.itemId, material.amount);
      }
    }

    this.currentCrafting = null;
    console.log('Crafting cancelled');
    return true;
  }

  /**
   * Complete current crafting
   */
  private completeCrafting(): void {
    if (!this.currentCrafting || !this.itemSystem) {
      return;
    }

    const recipe = this.recipes.get(this.currentCrafting.recipeId);
    if (!recipe) {
      this.currentCrafting = null;
      return;
    }

    // Assign affix to equipment before adding to inventory
    let affix = undefined;
    if (this.affixSelector) {
      try {
        const equipmentRarity = this.getRarityNumber(recipe.rarity) as RarityType;
        affix = this.affixSelector.selectAffixes(equipmentRarity);
      } catch (error) {
        console.error('Failed to assign affix to equipment:', error);
        // Continue equipment creation without affix
      }
    }

    // Add crafted item to inventory with affix
    this.itemSystem.addItem(recipe.id, 1, affix);

    // Emit equipment crafted event
    this.eventSystem.emit({
      type: 'equipment:crafted',
      timestamp: Date.now(),
      recipeId: recipe.id,
      recipe: recipe,
      affix: affix
    });

    console.log(`✅ Crafting complete: ${recipe.name}${affix && affix.length > 0 ? ` with ${affix.length} affixes` : ''}`);
    this.currentCrafting = null;
  }

  /**
   * Get current crafting progress (0-1)
   */
  getCraftingProgress(): number {
    if (!this.currentCrafting) {
      return 0;
    }

    const elapsed = Date.now() - this.currentCrafting.startTime;
    return Math.min(1, elapsed / this.currentCrafting.duration);
  }

  /**
   * Check if currently crafting
   */
  isCrafting(): boolean {
    return this.currentCrafting !== null;
  }

  /**
   * Get current crafting recipe
   */
  getCurrentCraftingRecipe(): EquipmentRecipe | null {
    if (!this.currentCrafting) {
      return null;
    }
    return this.recipes.get(this.currentCrafting.recipeId) || null;
  }
}
