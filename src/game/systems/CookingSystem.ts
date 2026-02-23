/**
 * Cooking System
 * Handles cooking recipes, ingredient validation, and dish creation
 * Implements cooking-system requirements
 */

import { System } from '../../ecs/System';
import { ComponentType } from '../../ecs/Component';
import { EntityId } from '../../ecs/Entity';
import { RarityType } from '../types/RarityTypes';
import { ItemSystem } from './ItemSystem';

/**
 * Cooking recipe definition
 */
export interface CookingRecipe {
  id: string;
  name: string;
  rarity: RarityType;
  icon: string;
  description: string;
  buyPrice: number;
  ingredients: CookingIngredient[];
}

/**
 * Ingredient requirement for cooking
 */
export interface CookingIngredient {
  itemId: string;
  quantity: number;
}

/**
 * Result of ingredient validation
 */
export interface CookingValidation {
  canCook: boolean;
  missingIngredients: CookingIngredient[];
}

/**
 * Result of cooking operation
 */
export interface CookingResult {
  success: boolean;
  dishId?: string;
  message: string;
}

/**
 * CookingSystem manages cooking recipes and dish creation
 */
export class CookingSystem extends System {
  public readonly name = 'CookingSystem';
  public readonly requiredComponents: ComponentType<any>[] = [];

  private recipes: Map<string, CookingRecipe> = new Map();
  private itemSystem: ItemSystem | null = null;

  /**
   * Set the ItemSystem reference for inventory operations
   */
  public setItemSystem(itemSystem: ItemSystem): void {
    this.itemSystem = itemSystem;
  }

  protected onInitialize(): void {
    // System initialization
  }

  public update(deltaTime: number): void {
    // Cooking is instantaneous, no update needed
  }

  /**
   * Load recipes from JSON configuration
   */
  public loadRecipes(recipesData: any): void {
    if (!recipesData || !recipesData.recipes || !Array.isArray(recipesData.recipes)) {
      console.warn('Invalid recipes data format');
      return;
    }

    for (const recipeData of recipesData.recipes) {
      // Validate recipe structure
      if (!this.isValidRecipe(recipeData)) {
        console.warn(`Invalid recipe structure for recipe: ${recipeData.id || 'unknown'}`);
        continue;
      }

      const recipe: CookingRecipe = {
        id: recipeData.id,
        name: recipeData.name,
        rarity: recipeData.rarity,
        icon: recipeData.icon,
        description: recipeData.description,
        buyPrice: recipeData.buyPrice,
        ingredients: recipeData.ingredients.map((ing: any) => ({
          itemId: ing.itemId,
          quantity: ing.quantity
        }))
      };

      this.recipes.set(recipe.id, recipe);
    }
  }

  /**
   * Validate recipe structure
   */
  private isValidRecipe(recipeData: any): boolean {
    return (
      recipeData &&
      typeof recipeData.id === 'string' &&
      typeof recipeData.name === 'string' &&
      typeof recipeData.rarity === 'number' &&
      typeof recipeData.icon === 'string' &&
      typeof recipeData.description === 'string' &&
      typeof recipeData.buyPrice === 'number' &&
      Array.isArray(recipeData.ingredients) &&
      recipeData.ingredients.every((ing: any) =>
        ing &&
        typeof ing.itemId === 'string' &&
        typeof ing.quantity === 'number'
      )
    );
  }

  /**
   * Get all available cooking recipes
   */
  public getAllRecipes(): CookingRecipe[] {
    return Array.from(this.recipes.values());
  }

  /**
   * Get a specific recipe by ID
   */
  public getRecipe(recipeId: string): CookingRecipe | undefined {
    return this.recipes.get(recipeId);
  }

  /**
   * Validate if player can cook a recipe
   */
  public validateCooking(playerId: EntityId, recipeId: string): CookingValidation {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      return {
        canCook: false,
        missingIngredients: []
      };
    }

    if (!this.itemSystem) {
      console.error('[CookingSystem] ItemSystem not set');
      return {
        canCook: false,
        missingIngredients: recipe.ingredients
      };
    }

    const missingIngredients: CookingIngredient[] = [];

    for (const ingredient of recipe.ingredients) {
      if (!this.itemSystem.hasItem(ingredient.itemId, ingredient.quantity)) {
        missingIngredients.push(ingredient);
      }
    }

    return {
      canCook: missingIngredients.length === 0,
      missingIngredients
    };
  }

  /**
   * Execute cooking - consume ingredients and create dish
   */
  public cook(playerId: EntityId, recipeId: string): CookingResult {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      return {
        success: false,
        message: 'Recipe not found'
      };
    }

    if (!this.itemSystem) {
      return {
        success: false,
        message: 'ItemSystem not initialized'
      };
    }

    // Validate ingredients
    const validation = this.validateCooking(playerId, recipeId);
    if (!validation.canCook) {
      return {
        success: false,
        message: 'Insufficient ingredients'
      };
    }

    // Emit cooking started event
    this.eventSystem.emit({
      type: 'cooking:started',
      timestamp: Date.now(),
      playerId,
      recipeId
    });

    // Consume ingredients
    for (const ingredient of recipe.ingredients) {
      if (!this.itemSystem.removeItem(ingredient.itemId, ingredient.quantity)) {
        // This should not happen since we validated above
        return {
          success: false,
          message: 'Failed to consume ingredients'
        };
      }
    }

    // Create dish
    if (!this.itemSystem.addItem(recipe.id, 1)) {
      // Failed to add dish - this could happen if inventory is full
      // Try to restore consumed ingredients
      for (const ingredient of recipe.ingredients) {
        this.itemSystem.addItem(ingredient.itemId, ingredient.quantity);
      }
      return {
        success: false,
        message: 'Inventory full'
      };
    }

    // Emit cooking completed event
    this.eventSystem.emit({
      type: 'cooking:completed',
      timestamp: Date.now(),
      playerId,
      recipeId,
      dishId: recipe.id
    });

    return {
      success: true,
      dishId: recipe.id,
      message: 'Cooking successful'
    };
  }

}
