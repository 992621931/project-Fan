/**
 * Unit tests for CookingPanel
 * Tests specific examples and edge cases for the cooking UI component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CookingPanel } from './CookingPanel';
import { UIManager } from '../UIManager';
import { EventSystem } from '../../ecs/EventSystem';
import { World } from '../../ecs/World';
import { CookingSystem, CookingRecipe } from '../../game/systems/CookingSystem';
import { RarityType } from '../../game/types/RarityTypes';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';

describe('CookingPanel Unit Tests', () => {
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
    const entityManager = new EntityManager();
    const componentManager = new ComponentManager();
    eventSystem = new EventSystem();
    world = new World(entityManager, componentManager, eventSystem);

    // Create UI manager
    uiManager = new UIManager(eventSystem, container);

    // Create cooking system
    cookingSystem = new CookingSystem(world, eventSystem, entityManager, componentManager);

    // Create cooking panel
    cookingPanel = new CookingPanel(uiManager, eventSystem, world, cookingSystem);
  });

  it('should create cooking panel with correct structure', () => {
    expect(cookingPanel).toBeTruthy();
    expect(cookingPanel.element).toBeTruthy();
    expect(cookingPanel.element.classList.contains('cooking-panel')).toBe(true);
  });

  it('should render empty state when no recipes are loaded', () => {
    cookingPanel.show();

    const recipeGrid = cookingPanel.element.querySelector('.recipe-grid') as HTMLDivElement;
    expect(recipeGrid).toBeTruthy();

    const emptyState = recipeGrid.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState?.textContent).toBe('暂无可用配方');
  });

  it('should render recipe grid with mock recipes', () => {
    const mockRecipes: CookingRecipe[] = [
      {
        id: 'test_recipe_1',
        name: '测试菜肴1',
        rarity: RarityType.Common,
        icon: 'images/test1.png',
        description: '测试描述1',
        sellPrice: 100,
        ingredients: [{ itemId: 'item1', quantity: 2 }]
      },
      {
        id: 'test_recipe_2',
        name: '测试菜肴2',
        rarity: RarityType.Rare,
        icon: 'images/test2.png',
        description: '测试描述2',
        sellPrice: 200,
        ingredients: [{ itemId: 'item2', quantity: 3 }]
      }
    ];

    cookingSystem.loadRecipes({ recipes: mockRecipes });
    cookingPanel.show();

    const recipeGrid = cookingPanel.element.querySelector('.recipe-grid') as HTMLDivElement;
    const recipeCards = recipeGrid.querySelectorAll('.recipe-card');

    expect(recipeCards.length).toBe(2);
  });

  it('should show details panel placeholder when no recipe is selected', () => {
    cookingPanel.show();

    const detailsPanel = cookingPanel.element.querySelector('.details-panel') as HTMLDivElement;
    expect(detailsPanel).toBeTruthy();

    const emptyState = detailsPanel.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState?.textContent).toBe('请选择一个配方');
  });

  it('should display recipe details when a recipe is selected', () => {
    const mockRecipe: CookingRecipe = {
      id: 'test_recipe',
      name: '测试菜肴',
      rarity: RarityType.Epic,
      icon: 'images/test.png',
      description: '这是一个测试菜肴',
      sellPrice: 500,
      ingredients: [
        { itemId: 'item1', quantity: 2 },
        { itemId: 'item2', quantity: 1 }
      ]
    };

    cookingSystem.loadRecipes({ recipes: [mockRecipe] });
    cookingPanel.show();

    // Click on the recipe card
    const recipeGrid = cookingPanel.element.querySelector('.recipe-grid') as HTMLDivElement;
    const recipeCard = recipeGrid.querySelector('.recipe-card') as HTMLElement;
    recipeCard.click();

    // Check details panel
    const detailsPanel = cookingPanel.element.querySelector('.details-panel') as HTMLDivElement;
    const recipeHeader = detailsPanel.querySelector('.recipe-header');
    expect(recipeHeader).toBeTruthy();

    const description = detailsPanel.querySelector('.recipe-description');
    expect(description).toBeTruthy();
    expect(description?.textContent).toBe('这是一个测试菜肴');
  });

  it('should hide panel when close button is clicked', () => {
    cookingPanel.show();
    expect(cookingPanel.visible).toBe(true);

    const closeBtn = cookingPanel.element.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.click();

    expect(cookingPanel.visible).toBe(false);
  });
});
