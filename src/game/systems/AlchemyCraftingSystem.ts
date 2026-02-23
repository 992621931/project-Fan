/**
 * Alchemy Crafting System - Manages potion crafting recipes and crafting logic
 */

import { System } from '../../ecs/System';
import { ItemSystem } from './ItemSystem';

export interface AlchemyRecipe {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  type: string[];
  buyPrice: number;
  materials: Array<{
    itemId: string;
    amount: number;
  }>;
}

export class AlchemyCraftingSystem extends System {
  public readonly name = 'AlchemyCraftingSystem';
  public readonly requiredComponents: any[] = [];

  private recipes: Map<string, AlchemyRecipe> = new Map();
  private itemSystem: ItemSystem | null = null;

  // Progress tracking properties
  private currentRecipeId: string | null = null;
  private craftingStartTime: number = 0;
  private craftingDuration: number = 0;
  private isCrafting: boolean = false;

  /**
   * Load recipes from JSON data
   */
  public loadRecipes(recipesData: { recipes: AlchemyRecipe[] }): void {
    this.recipes.clear();
    recipesData.recipes.forEach(recipe => {
      this.recipes.set(recipe.id, recipe);
    });
    console.log(`[AlchemyCraftingSystem] Loaded ${this.recipes.size} alchemy recipes`);
  }

  /**
   * Set ItemSystem reference
   */
  public setItemSystem(itemSystem: ItemSystem): void {
    this.itemSystem = itemSystem;
  }

  /**
   * Get all recipes
   */
  public getAllRecipes(): AlchemyRecipe[] {
    return Array.from(this.recipes.values());
  }

  /**
   * Get recipe by ID
   */
  public getRecipe(recipeId: string): AlchemyRecipe | undefined {
    return this.recipes.get(recipeId);
  }

  /**
   * Check if player can craft a recipe
   */
  public canCraft(recipeId: string): boolean {
    if (!this.itemSystem) return false;

    const recipe = this.recipes.get(recipeId);
    if (!recipe) return false;

    // Check if player has all required materials
    return recipe.materials.every(material => {
      const playerAmount = this.itemSystem!.getItemQuantity(material.itemId);
      return playerAmount >= material.amount;
    });
  }

  /**
   * Craft a potion
   * Returns true if crafting was successful
   */
  public craft(recipeId: string): boolean {
    if (!this.itemSystem) {
      console.error('[AlchemyCraftingSystem] ItemSystem not set');
      return false;
    }

    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      console.error(`[AlchemyCraftingSystem] Recipe not found: ${recipeId}`);
      return false;
    }

    // Check if player can craft
    if (!this.canCraft(recipeId)) {
      console.warn(`[AlchemyCraftingSystem] Cannot craft ${recipe.name}: insufficient materials`);
      return false;
    }

    // Remove materials from inventory
    recipe.materials.forEach(material => {
      this.itemSystem!.removeItem(material.itemId, material.amount);
    });

    // Add crafted potion to inventory
    this.itemSystem.addItem(recipe.id, 1);

    console.log(`[AlchemyCraftingSystem] Crafted ${recipe.name}`);
    return true;
  }

  /**
   * Start crafting with progress tracking
   */
  public startCrafting(recipeId: string): boolean {
    if (this.isCrafting) {
      console.warn('[AlchemyCraftingSystem] Already crafting');
      return false;
    }

    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      console.error(`[AlchemyCraftingSystem] Recipe not found: ${recipeId}`);
      return false;
    }

    if (!this.canCraft(recipeId)) {
      console.warn(`[AlchemyCraftingSystem] Cannot craft ${recipe.name}: insufficient materials`);
      return false;
    }

    // Calculate duration based on rarity
    const rarityNumber = this.convertRarityStringToNumber(recipe.rarity);
    this.craftingDuration = this.getCraftingDuration(rarityNumber);
    
    this.currentRecipeId = recipeId;
    this.craftingStartTime = Date.now();
    this.isCrafting = true;

    console.log(`[AlchemyCraftingSystem] Started crafting ${recipe.name} (${this.craftingDuration}ms)`);
    return true;
  }

  /**
   * Get crafting progress (0-100)
   */
  public getCraftingProgress(): number {
    if (!this.isCrafting) return 0;

    const elapsed = Date.now() - this.craftingStartTime;
    const progress = Math.min((elapsed / this.craftingDuration) * 100, 100);
    return progress;
  }

  /**
   * Check if crafting is complete
   */
  public isCraftingComplete(): boolean {
    if (!this.isCrafting) return false;
    return this.getCraftingProgress() >= 100;
  }

  /**
   * Complete crafting and add item to inventory
   */
  public completeCrafting(): boolean {
    if (!this.isCrafting || !this.currentRecipeId) {
      return false;
    }

    const recipe = this.recipes.get(this.currentRecipeId);
    if (!recipe || !this.itemSystem) {
      this.cancelCrafting();
      return false;
    }

    // Remove materials from inventory
    recipe.materials.forEach(material => {
      this.itemSystem!.removeItem(material.itemId, material.amount);
    });

    // Add crafted potion to inventory
    this.itemSystem.addItem(recipe.id, 1);

    console.log(`[AlchemyCraftingSystem] Completed crafting ${recipe.name}`);
    
    // Reset crafting state
    this.currentRecipeId = null;
    this.craftingStartTime = 0;
    this.craftingDuration = 0;
    this.isCrafting = false;

    return true;
  }

  /**
   * Cancel current crafting
   */
  public cancelCrafting(): void {
    if (this.isCrafting) {
      console.log('[AlchemyCraftingSystem] Crafting cancelled');
    }
    
    this.currentRecipeId = null;
    this.craftingStartTime = 0;
    this.craftingDuration = 0;
    this.isCrafting = false;
  }

  /**
   * Get crafting duration based on rarity
   * 普通(0): 5s, 稀有(1): 10s, 神话(2): 15s, 传说(3): 25s
   */
  private getCraftingDuration(rarity: number): number {
    const durations = [5000, 10000, 15000, 25000]; // milliseconds
    return durations[rarity] || 5000;
  }

  /**
   * Convert rarity string to number
   */
  private convertRarityStringToNumber(rarity: string): number {
    const rarityMap: { [key: string]: number } = {
      '普通': 0,
      '稀有': 1,
      '神话': 2,
      '传说': 3
    };
    return rarityMap[rarity] || 0;
  }

  update(_deltaTime: number): void {
    // No update logic needed - progress is calculated on-demand
  }
}
