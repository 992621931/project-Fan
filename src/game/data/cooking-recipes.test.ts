import { describe, it, expect } from 'vitest';
import cookingRecipesData from './cooking-recipes.json';
import itemPrefabsData from './item-prefabs.json';

describe('Cooking Recipes Data Validation', () => {
  const recipes = cookingRecipesData.recipes;
  const items = itemPrefabsData.items;
  const itemIds = new Set(items.map((item) => item.id));

  it('should load all seven recipes correctly', () => {
    expect(recipes).toBeDefined();
    expect(recipes.length).toBe(7);
  });

  it('should have all required fields for each recipe', () => {
    recipes.forEach((recipe) => {
      expect(recipe).toHaveProperty('id');
      expect(recipe).toHaveProperty('name');
      expect(recipe).toHaveProperty('rarity');
      expect(recipe).toHaveProperty('icon');
      expect(recipe).toHaveProperty('description');
      expect(recipe).toHaveProperty('sellPrice');
      expect(recipe).toHaveProperty('ingredients');

      expect(typeof recipe.id).toBe('string');
      expect(typeof recipe.name).toBe('string');
      expect(typeof recipe.rarity).toBe('number');
      expect(typeof recipe.icon).toBe('string');
      expect(typeof recipe.description).toBe('string');
      expect(typeof recipe.sellPrice).toBe('number');
      expect(Array.isArray(recipe.ingredients)).toBe(true);
      expect(recipe.ingredients.length).toBeGreaterThan(0);
    });
  });

  it('should have valid ingredient references', () => {
    recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ingredient) => {
        expect(ingredient).toHaveProperty('itemId');
        expect(ingredient).toHaveProperty('quantity');
        expect(typeof ingredient.itemId).toBe('string');
        expect(typeof ingredient.quantity).toBe('number');
        expect(ingredient.quantity).toBeGreaterThan(0);
        
        // Validate that the ingredient item exists in the item database
        expect(itemIds.has(ingredient.itemId)).toBe(true);
      });
    });
  });

  it('should have correct recipe IDs', () => {
    const expectedIds = [
      'slime_qq_candy',
      'sugar_pickled_snake_liver',
      'fried_mushroom_slices',
      'candied_mystic_mushroom',
      'two_headed_snake_skin_jelly',
      'crispy_wing_snake_skin_roll',
      'grassland_set_meal'
    ];

    const actualIds = recipes.map((r) => r.id);
    expect(actualIds).toEqual(expectedIds);
  });

  it('should have correct rarity values', () => {
    recipes.forEach((recipe) => {
      expect(recipe.rarity).toBeGreaterThanOrEqual(0);
      expect(recipe.rarity).toBeLessThanOrEqual(3);
    });
  });

  it('should have positive sell prices', () => {
    recipes.forEach((recipe) => {
      expect(recipe.sellPrice).toBeGreaterThan(0);
    });
  });

  it('should have valid icon paths', () => {
    recipes.forEach((recipe) => {
      expect(recipe.icon).toMatch(/^images\/wupin_caiyao_.*\.png$/);
    });
  });
});
