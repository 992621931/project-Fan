/**
 * Property-based tests for CookingPanel
 * Tests universal properties of the cooking UI component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CookingPanel } from './CookingPanel';
import { UIManager } from '../UIManager';
import { EventSystem } from '../../ecs/EventSystem';
import { World } from '../../ecs/World';
import { CookingSystem, CookingRecipe } from '../../game/systems/CookingSystem';
import { RarityType } from '../../game/types/RarityTypes';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';

describe('CookingPanel Property Tests', () => {
  let world: World;
  let eventSystem: EventSystem;
  let uiManager: UIManager;
  let cookingSystem: CookingSystem;
  let cookingPanel: CookingPanel;

  beforeEach(() => {
    // Set up DOM environment
    document.body.innerHTML = '';
    const container = document.createElement('div');
    container.id = 'game-container';
    document.body.appendChild(container);

    // Create world and systems
    eventSystem = new EventSystem();
    world = new World(eventSystem);
    
    // Get the managers from the world (World creates its own)
    const entityManager = world.entityManager;
    const componentManager = world.componentManager;

    // Create UI manager (note: UIManager constructor takes eventSystem first, then rootElement)
    uiManager = new UIManager(eventSystem, container);

    // Create cooking system and initialize it properly
    cookingSystem = new CookingSystem();
    cookingSystem.initialize(entityManager, componentManager, eventSystem);

    // Create cooking panel - create a new one for each test
    cookingPanel = new CookingPanel(uiManager, eventSystem, world, cookingSystem);
    
    // Hide any previous panels
    if (cookingPanel.visible) {
      cookingPanel.hide();
    }
  });

  // Arbitrary for generating cooking recipes with unique IDs
  // Use alphanumeric strings to avoid HTML injection issues in tests
  // Ensure strings are non-empty and not just whitespace
  const recipeArbitrary = fc.record({
    id: fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/),
    name: fc.stringMatching(/^[a-zA-Z0-9\u4e00-\u9fa5][a-zA-Z0-9\u4e00-\u9fa5 ]{0,29}$/), // Must start with non-space
    rarity: fc.integer({ min: 0, max: 2 }) as fc.Arbitrary<RarityType>,
    icon: fc.constant('images/test_icon.png'),
    description: fc.stringMatching(/^[a-zA-Z0-9\u4e00-\u9fa5][a-zA-Z0-9\u4e00-\u9fa5 .,!?]{0,99}$/), // Must start with non-space
    sellPrice: fc.integer({ min: 1, max: 10000 }),
    ingredients: fc.array(
      fc.record({
        itemId: fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/),
        quantity: fc.integer({ min: 1, max: 10 })
      }),
      { minLength: 1, maxLength: 5 }
    )
  });

  // Helper to generate arrays of recipes with unique IDs
  const uniqueRecipesArbitrary = (minLength: number, maxLength: number) =>
    fc.uniqueArray(recipeArbitrary, {
      minLength,
      maxLength,
      selector: (recipe) => recipe.id
    });

  // Feature: cooking-system, Property 1: Recipe Card Rendering Completeness
  it('should render all recipes as cards with name, rarity indicator, and icon', () => {
    fc.assert(
      fc.property(
        uniqueRecipesArbitrary(1, 10),
        (recipes) => {
          // Create a fresh cooking system for this test iteration to ensure isolation
          const testCookingSystem = new CookingSystem();
          testCookingSystem.initialize(world.entityManager, world.componentManager, eventSystem);

          // Load recipes into the fresh cooking system
          testCookingSystem.loadRecipes({ recipes });

          // Create a fresh panel for this test iteration
          const testPanel = new CookingPanel(uiManager, eventSystem, world, testCookingSystem);

          // Show panel and render
          testPanel.show();

          // Get recipe grid
          const recipeGrid = testPanel.element.querySelector('.recipe-grid') as HTMLDivElement;
          expect(recipeGrid).toBeTruthy();

          // Get all recipe cards
          const recipeCards = recipeGrid.querySelectorAll('.recipe-card');

          // Property: All recipes should be rendered
          expect(recipeCards.length).toBe(recipes.length);

          // Property: Each card should have name, rarity, and icon
          recipeCards.forEach((card, index) => {
            const recipe = recipes[index];

            // Check for icon
            const icon = card.querySelector('img');
            expect(icon).toBeTruthy();
            expect(icon?.alt).toBe(recipe.name);

            // Check for name
            const nameElement = card.querySelector('.recipe-name');
            expect(nameElement).toBeTruthy();
            expect(nameElement?.textContent).toBe(recipe.name);

            // Check for rarity badge
            const rarityBadge = card.querySelector('.rarity-badge');
            expect(rarityBadge).toBeTruthy();
          });

          // Clean up
          testPanel.hide();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: cooking-system, Property 2: Recipe Selection Updates Details Panel
  it('should update details panel when recipe card is clicked', () => {
    fc.assert(
      fc.property(
        uniqueRecipesArbitrary(2, 5),
        fc.integer({ min: 0, max: 4 }),
        (recipes, selectionIndex) => {
          // Ensure selection index is valid
          const validIndex = selectionIndex % recipes.length;

          // Create a fresh cooking system for this test iteration to ensure isolation
          const testCookingSystem = new CookingSystem();
          testCookingSystem.initialize(world.entityManager, world.componentManager, eventSystem);

          // Load recipes into the fresh cooking system
          testCookingSystem.loadRecipes({ recipes });

          // Create a fresh panel for this test iteration
          const testPanel = new CookingPanel(uiManager, eventSystem, world, testCookingSystem);

          // Create a player entity with inventory
          const player = world.entityManager.createEntity();
          const playerId = player.id;

          // Add inventory component
          const inventory = {
            type: 'inventory' as const,
            slots: Array.from({ length: 20 }, () => ({ item: null, quantity: 0 }))
          };
          world.componentManager.addComponent(playerId, { type: 'inventory' }, inventory);

          // Set player ID in cooking panel
          testPanel.setPlayerId(playerId);

          // Show panel and render
          testPanel.show();

          // Get recipe grid
          const recipeGrid = testPanel.element.querySelector('.recipe-grid') as HTMLDivElement;
          const recipeCards = recipeGrid.querySelectorAll('.recipe-card');

          // Click on a recipe card
          const selectedCard = recipeCards[validIndex] as HTMLElement;
          selectedCard.click();

          // Get details panel
          const detailsPanel = testPanel.element.querySelector('.details-panel') as HTMLDivElement;
          expect(detailsPanel).toBeTruthy();

          // Property: Details panel should show selected recipe information
          const selectedRecipe = recipes[validIndex];

          // Check recipe name in details
          const recipeName = detailsPanel.querySelector('.recipe-name');
          expect(recipeName).toBeTruthy();
          expect(recipeName?.textContent).toBe(selectedRecipe.name);

          // Check recipe description
          const recipeDescription = detailsPanel.querySelector('.recipe-description');
          expect(recipeDescription).toBeTruthy();
          expect(recipeDescription?.textContent).toBe(selectedRecipe.description);

          // Check sell price
          const sellPrice = detailsPanel.querySelector('.sell-price');
          expect(sellPrice).toBeTruthy();
          expect(sellPrice?.textContent).toContain(selectedRecipe.sellPrice.toString());

          // Check ingredients list
          const ingredientsList = detailsPanel.querySelector('.ingredients-list');
          expect(ingredientsList).toBeTruthy();

          const ingredientItems = ingredientsList?.querySelectorAll('.ingredient-item');
          expect(ingredientItems?.length).toBe(selectedRecipe.ingredients.length);

          // Property: Selected card should be highlighted
          expect(selectedCard.style.boxShadow).not.toBe('none');
          expect(selectedCard.style.boxShadow).not.toBe('');

          // Clean up
          world.entityManager.destroyEntity(playerId);
          testPanel.hide();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: cooking-system, Property 4: Cooking Button State Based on Ingredients
  it('should enable cooking button only when all ingredients are available', () => {
    fc.assert(
      fc.property(
        recipeArbitrary,
        (recipe) => {
          // Load recipe into cooking system
          cookingSystem.loadRecipes({ recipes: [recipe] });

          // Create a fresh panel for this test iteration
          const testPanel = new CookingPanel(uiManager, eventSystem, world, cookingSystem);

          // Create a player entity with inventory
          const player = world.entityManager.createEntity();
          const playerId = player.id;

          // Add inventory component
          const inventory = {
            type: 'inventory' as const,
            slots: Array.from({ length: 20 }, () => ({ item: null, quantity: 0 }))
          };
          world.componentManager.addComponent(playerId, { type: 'inventory' }, inventory);

          // Set player ID in cooking panel BEFORE showing
          testPanel.setPlayerId(playerId);

          // Show panel and render
          testPanel.show();

          // Select the recipe
          const recipeGrid = testPanel.element.querySelector('.recipe-grid') as HTMLDivElement;
          const recipeCard = recipeGrid.querySelector('.recipe-card') as HTMLElement;
          recipeCard.click();

          // Get cooking button
          const detailsPanel = testPanel.element.querySelector('.details-panel') as HTMLDivElement;
          const cookingButton = detailsPanel.querySelector('button') as HTMLButtonElement;

          // Property: Button should be disabled when ingredients are missing
          expect(cookingButton).toBeTruthy();
          expect(cookingButton.disabled).toBe(true);

          // Clean up
          world.entityManager.destroyEntity(playerId);
          testPanel.hide();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: cooking-system, Property 6: UI Reflects Inventory State
  it('should update UI when inventory changes', () => {
    fc.assert(
      fc.property(
        recipeArbitrary,
        (recipe) => {
          // Create a fresh cooking system for this test iteration to ensure isolation
          const testCookingSystem = new CookingSystem();
          testCookingSystem.initialize(world.entityManager, world.componentManager, eventSystem);

          // Load recipe into the fresh cooking system
          testCookingSystem.loadRecipes({ recipes: [recipe] });

          // Create a fresh panel for this test iteration
          const testPanel = new CookingPanel(uiManager, eventSystem, world, testCookingSystem);

          // Create a player entity with inventory
          const player = world.entityManager.createEntity();
          const playerId = player.id;

          // Add inventory component
          const inventory = {
            type: 'inventory' as const,
            slots: Array.from({ length: 20 }, () => ({ item: null, quantity: 0 }))
          };
          world.componentManager.addComponent(playerId, { type: 'inventory' }, inventory);

          // Set player ID in cooking panel BEFORE showing
          testPanel.setPlayerId(playerId);

          // Show panel and render
          testPanel.show();

          // Select the recipe
          const recipeGrid = testPanel.element.querySelector('.recipe-grid') as HTMLDivElement;
          const recipeCard = recipeGrid.querySelector('.recipe-card') as HTMLElement;
          recipeCard.click();

          // Get initial button state
          const detailsPanel = testPanel.element.querySelector('.details-panel') as HTMLDivElement;
          const cookingButton = detailsPanel.querySelector('button') as HTMLButtonElement;
          const initialDisabledState = cookingButton.disabled;

          // Property: Button should be disabled initially (no ingredients)
          expect(initialDisabledState).toBe(true);

          // Emit inventory updated event
          eventSystem.emit({
            type: 'inventory:updated',
            timestamp: Date.now(),
            playerId
          });

          // Property: UI should still reflect the same state after event
          // (since inventory didn't actually change)
          expect(cookingButton.disabled).toBe(initialDisabledState);

          // Clean up
          world.entityManager.destroyEntity(playerId);
          testPanel.hide();
        }
      ),
      { numRuns: 100 }
    );
  });
});
