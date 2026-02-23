/**
 * Cooking Panel - Cooking interface for the warehouse panel
 * Handles recipe display, ingredient validation, and dish creation
 */

import { BaseUIComponent } from '../BaseUIComponent';
import { UIManager } from '../UIManager';
import { EventSystem } from '../../ecs/EventSystem';
import { World } from '../../ecs/World';
import { CookingSystem, CookingRecipe } from '../../game/systems/CookingSystem';
import { RarityType, getRarityColor, getRarityDisplayName } from '../../game/types/RarityTypes';
import { EntityId } from '../../ecs/Entity';

export class CookingPanel extends BaseUIComponent {
  private world: World;
  private cookingSystem: CookingSystem;
  private recipeGrid!: HTMLDivElement;
  private detailsPanel!: HTMLDivElement;
  private selectedRecipe: CookingRecipe | null = null;
  private playerId: EntityId | null = null;

  constructor(uiManager: UIManager, eventSystem: EventSystem, world: World, cookingSystem: CookingSystem) {
    super('cooking-panel', uiManager, eventSystem);
    this.world = world;
    this.cookingSystem = cookingSystem;
  }

  protected createElement(): HTMLElement {
    const panel = this.createPanel('cooking-panel');
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 900px;
      height: 600px;
      background: rgba(20, 20, 30, 0.95);
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      z-index: 1000;
    `;

    // Header
    const header = this.createElement_div('panel-header');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 2px solid rgba(255, 255, 255, 0.1);
    `;

    const title = this.createElement_h2('', '🍳 烹饪');
    title.style.cssText = `
      margin: 0;
      color: #ffffff;
      font-size: 24px;
    `;

    const closeBtn = this.createButton('×', () => this.hide(), 'close-btn');
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: #ffffff;
      font-size: 32px;
      cursor: pointer;
      padding: 0;
      width: 40px;
      height: 40px;
      line-height: 32px;
    `;

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Main content area
    const mainContent = this.createElement_div('main-content');
    mainContent.style.cssText = `
      display: flex;
      flex: 1;
      gap: 16px;
      min-height: 0;
    `;

    // Left side - Recipe grid
    const leftSide = this.createElement_div('left-side');
    leftSide.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    `;

    const recipeTitle = this.createElement_h3('', '配方列表');
    recipeTitle.style.cssText = `
      margin: 0 0 12px 0;
      color: #ffffff;
      font-size: 16px;
    `;

    this.recipeGrid = this.createElement_div('recipe-grid');
    this.recipeGrid.style.cssText = `
      flex: 1;
      overflow-y: auto;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 12px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 12px;
      align-content: start;
    `;

    leftSide.appendChild(recipeTitle);
    leftSide.appendChild(this.recipeGrid);

    // Right side - Details panel
    const rightSide = this.createElement_div('right-side');
    rightSide.style.cssText = `
      width: 350px;
      display: flex;
      flex-direction: column;
    `;

    const detailsTitle = this.createElement_h3('', '配方详情');
    detailsTitle.style.cssText = `
      margin: 0 0 12px 0;
      color: #ffffff;
      font-size: 16px;
    `;

    this.detailsPanel = this.createElement_div('details-panel');
    this.detailsPanel.style.cssText = `
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 16px;
      overflow-y: auto;
    `;

    rightSide.appendChild(detailsTitle);
    rightSide.appendChild(this.detailsPanel);

    // Assemble panel
    mainContent.appendChild(leftSide);
    mainContent.appendChild(rightSide);

    panel.appendChild(header);
    panel.appendChild(mainContent);

    return panel;
  }

  public render(): void {
    this.renderRecipeGrid();
    this.renderRecipeDetails();
  }

  public setPlayerId(playerId: EntityId): void {
    this.playerId = playerId;
  }

  private renderRecipeGrid(): void {
    this.recipeGrid.innerHTML = '';

    const recipes = this.cookingSystem.getAllRecipes();

    if (recipes.length === 0) {
      const emptyState = this.createElement_div('empty-state', '暂无可用配方');
      emptyState.style.cssText = `
        grid-column: 1 / -1;
        text-align: center;
        color: #888;
        padding: 40px 20px;
      `;
      this.recipeGrid.appendChild(emptyState);
      return;
    }

    recipes.forEach(recipe => {
      const recipeCard = this.createElement_div('recipe-card');
      recipeCard.style.cssText = `
        background: rgba(255, 255, 255, 0.08);
        border: 2px solid ${this.getRarityColor(recipe.rarity)};
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      `;

      // Recipe icon
      const icon = document.createElement('img');
      icon.src = recipe.icon;
      icon.alt = recipe.name;
      icon.style.cssText = `
        width: 64px;
        height: 64px;
        object-fit: contain;
      `;

      // Recipe name
      const name = this.createElement_div('recipe-name', recipe.name);
      name.style.cssText = `
        color: ${this.getRarityColor(recipe.rarity)};
        font-size: 12px;
        font-weight: bold;
        text-align: center;
        word-break: break-word;
      `;

      // Rarity indicator
      const rarityBadge = this.createElement_div('rarity-badge', this.getRarityName(recipe.rarity));
      rarityBadge.style.cssText = `
        background: ${this.getRarityColor(recipe.rarity)};
        color: #000;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: bold;
      `;

      recipeCard.appendChild(icon);
      recipeCard.appendChild(name);
      recipeCard.appendChild(rarityBadge);

      // Hover effects
      recipeCard.addEventListener('mouseenter', () => {
        recipeCard.style.background = 'rgba(255, 255, 255, 0.15)';
        recipeCard.style.transform = 'translateY(-2px)';
      });

      recipeCard.addEventListener('mouseleave', () => {
        recipeCard.style.background = 'rgba(255, 255, 255, 0.08)';
        recipeCard.style.transform = 'translateY(0)';
      });

      // Click handler for recipe selection
      recipeCard.addEventListener('click', () => {
        // Remove previous selection
        this.recipeGrid.querySelectorAll('.recipe-card').forEach(card => {
          (card as HTMLElement).style.boxShadow = 'none';
        });

        // Highlight selected card
        recipeCard.style.boxShadow = `0 0 12px ${this.getRarityColor(recipe.rarity)}`;

        this.selectedRecipe = recipe;
        this.renderRecipeDetails();
      });

      this.recipeGrid.appendChild(recipeCard);
    });
  }

  protected setupEventListeners(): void {
    // Listen for inventory updates to refresh UI
    this.eventSystem.on('inventory:updated', () => {
      if (this.visible) {
        this.render();
      }
    });

    // Listen for cooking completion to show notifications
    this.eventSystem.on('cooking:completed', (event: any) => {
      if (this.visible) {
        this.showNotification('烹饪成功！', 'success');
        this.render();
      }
    });
  }

  private renderRecipeDetails(): void {
    this.detailsPanel.innerHTML = '';

    if (!this.selectedRecipe) {
      const emptyState = this.createElement_div('empty-state', '请选择一个配方');
      emptyState.style.cssText = `
        text-align: center;
        color: #888;
        padding: 40px 20px;
      `;
      this.detailsPanel.appendChild(emptyState);
      return;
    }

    const recipe = this.selectedRecipe;

    // Recipe header with icon and name
    const header = this.createElement_div('recipe-header');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;

    const icon = document.createElement('img');
    icon.src = recipe.icon;
    icon.alt = recipe.name;
    icon.style.cssText = `
      width: 80px;
      height: 80px;
      object-fit: contain;
      border: 2px solid ${this.getRarityColor(recipe.rarity)};
      border-radius: 8px;
      padding: 4px;
      background: rgba(0, 0, 0, 0.3);
    `;

    const headerInfo = this.createElement_div('header-info');
    headerInfo.style.cssText = `
      flex: 1;
    `;

    const name = this.createElement_div('recipe-name', recipe.name);
    name.style.cssText = `
      color: ${this.getRarityColor(recipe.rarity)};
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 6px;
    `;

    const rarityBadge = this.createElement_div('rarity-badge', this.getRarityName(recipe.rarity));
    rarityBadge.style.cssText = `
      display: inline-block;
      background: ${this.getRarityColor(recipe.rarity)};
      color: #000;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      margin-bottom: 6px;
    `;

    const valuePrice = this.createElement_div('sell-price', `价值: ${recipe.buyPrice} 金币`);
    valuePrice.style.cssText = `
      color: #ffd700;
      font-size: 14px;
    `;

    headerInfo.appendChild(name);
    headerInfo.appendChild(rarityBadge);
    headerInfo.appendChild(valuePrice);

    header.appendChild(icon);
    header.appendChild(headerInfo);

    // Description
    const description = this.createElement_div('recipe-description', recipe.description);
    description.style.cssText = `
      color: #ccc;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 16px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
    `;

    // Ingredients section
    const ingredientsTitle = this.createElement_h3('', '所需材料');
    ingredientsTitle.style.cssText = `
      margin: 0 0 12px 0;
      color: #ffffff;
      font-size: 14px;
    `;

    const ingredientsList = this.createElement_div('ingredients-list');
    ingredientsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    `;

    this.renderIngredients(recipe, ingredientsList);

    // Cooking button
    const cookingButton = this.createButton('开始烹饪', () => this.handleCookingClick());
    cookingButton.style.cssText = `
      width: 100%;
      padding: 12px;
      font-size: 16px;
      font-weight: bold;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 8px;
      color: #ffffff;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // Check if player can cook
    if (this.playerId) {
      const validation = this.cookingSystem.validateCooking(this.playerId, recipe.id);
      if (!validation.canCook) {
        cookingButton.disabled = true;
        cookingButton.style.cssText += `
          opacity: 0.5;
          cursor: not-allowed;
          background: #555;
        `;
      } else {
        cookingButton.addEventListener('mouseenter', () => {
          cookingButton.style.transform = 'translateY(-2px)';
          cookingButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        });

        cookingButton.addEventListener('mouseleave', () => {
          cookingButton.style.transform = 'translateY(0)';
          cookingButton.style.boxShadow = 'none';
        });
      }
    }

    // Assemble details panel
    this.detailsPanel.appendChild(header);
    this.detailsPanel.appendChild(description);
    this.detailsPanel.appendChild(ingredientsTitle);
    this.detailsPanel.appendChild(ingredientsList);
    this.detailsPanel.appendChild(cookingButton);
  }

  private renderIngredients(recipe: CookingRecipe, container: HTMLDivElement): void {
    if (!this.playerId) {
      console.warn('[CookingPanel] No playerId set');
      return;
    }

    const validation = this.cookingSystem.validateCooking(this.playerId, recipe.id);
    const itemSystem = this.world.getSystem('ItemSystem');
    
    console.log('[CookingPanel] Rendering ingredients for recipe:', recipe.name);
    console.log('[CookingPanel] ItemSystem found:', !!itemSystem);

    // Create a grid container for ingredient icons
    const ingredientsGrid = this.createElement_div('ingredients-grid');
    ingredientsGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 12px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      border: 2px solid rgba(255, 255, 255, 0.1);
    `;

    recipe.ingredients.forEach(ingredient => {
      const itemData = itemSystem?.getItem(ingredient.itemId);
      const isMissing = validation.missingIngredients.some(mi => mi.itemId === ingredient.itemId);
      const currentQuantity = itemSystem?.getItemQuantity(ingredient.itemId) || 0;

      console.log('[CookingPanel] Ingredient:', ingredient.itemId, 'ItemData:', itemData?.name, 'Icon:', itemData?.icon);

      // Ingredient card
      const ingredientCard = this.createElement_div('ingredient-card');
      ingredientCard.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        border: 2px solid ${isMissing ? 'rgba(231, 76, 60, 0.5)' : 'rgba(46, 204, 113, 0.5)'};
        transition: all 0.2s ease;
        cursor: pointer;
        position: relative;
      `;

      // Hover effect
      ingredientCard.addEventListener('mouseenter', () => {
        ingredientCard.style.transform = 'translateY(-2px)';
        ingredientCard.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
      });

      ingredientCard.addEventListener('mouseleave', () => {
        ingredientCard.style.transform = 'translateY(0)';
        ingredientCard.style.boxShadow = 'none';
      });

      // Icon container
      const iconContainer = this.createElement_div('ingredient-icon');
      iconContainer.style.cssText = `
        width: 64px;
        height: 64px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        margin-bottom: 6px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        position: relative;
      `;

      // Load icon image
      if (itemData && itemData.icon) {
        console.log('[CookingPanel] Loading icon for:', itemData.name, 'from:', itemData.icon);
        const icon = document.createElement('img');
        icon.src = itemData.icon;
        icon.alt = itemData.name || ingredient.itemId;
        icon.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: contain;
        `;
        icon.onerror = () => {
          console.error('[CookingPanel] Failed to load icon:', itemData.icon);
          iconContainer.textContent = '📦';
          iconContainer.style.fontSize = '32px';
        };
        icon.onload = () => {
          console.log('[CookingPanel] Icon loaded successfully:', itemData.icon);
        };
        iconContainer.appendChild(icon);
      } else {
        console.warn('[CookingPanel] No icon data for:', ingredient.itemId);
        iconContainer.textContent = '📦';
        iconContainer.style.fontSize = '32px';
      }

      // Quantity badge on icon
      const quantityBadge = this.createElement_div('quantity-badge', `${currentQuantity}/${ingredient.quantity}`);
      quantityBadge.style.cssText = `
        position: absolute;
        bottom: 2px;
        right: 2px;
        background: ${isMissing ? 'rgba(231, 76, 60, 0.9)' : 'rgba(46, 204, 113, 0.9)'};
        color: #ffffff;
        font-size: 10px;
        font-weight: bold;
        padding: 2px 4px;
        border-radius: 4px;
        line-height: 1;
      `;
      iconContainer.appendChild(quantityBadge);

      // Item name
      const itemName = this.createElement_div('item-name', itemData?.name || ingredient.itemId);
      itemName.style.cssText = `
        color: #ffffff;
        font-size: 11px;
        text-align: center;
        line-height: 1.2;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      `;

      // Status indicator
      const statusIndicator = this.createElement_div('status-indicator', isMissing ? '✗' : '✓');
      statusIndicator.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: ${isMissing ? '#e74c3c' : '#2ecc71'};
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      `;

      ingredientCard.appendChild(statusIndicator);
      ingredientCard.appendChild(iconContainer);
      ingredientCard.appendChild(itemName);

      ingredientsGrid.appendChild(ingredientCard);
    });

    container.appendChild(ingredientsGrid);
    console.log('[CookingPanel] Ingredients grid rendered with', recipe.ingredients.length, 'items');
  }

  private handleCookingClick(): void {
    if (!this.selectedRecipe || !this.playerId) {
      return;
    }

    const result = this.cookingSystem.cook(this.playerId, this.selectedRecipe.id);

    if (result.success) {
      this.showNotification(`成功烹饪 ${this.selectedRecipe.name}！`, 'success');
      this.render(); // Refresh UI
    } else {
      this.showNotification(result.message, 'error');
    }
  }

  private getRarityColor(rarity: RarityType): string {
    return getRarityColor(rarity);
  }

  private getRarityName(rarity: RarityType): string {
    return getRarityDisplayName(rarity);
  }
}
