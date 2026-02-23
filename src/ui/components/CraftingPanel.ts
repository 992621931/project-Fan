/**
 * Crafting Panel - Crafting and recipe management interface
 * Handles equipment crafting, cooking, and alchemy
 */

import { BaseUIComponent } from '../BaseUIComponent';
import { UIManager } from '../UIManager';
import { EventSystem } from '../../ecs/EventSystem';
import { Entity } from '../../ecs/Entity';
import { World } from '../../ecs/World';

export interface Recipe {
  id: string;
  name: string;
  type: 'equipment' | 'food' | 'alchemy';
  description: string;
  materials: MaterialRequirement[];
  result: {
    itemId: string;
    quantity: number;
    quality: number;
  };
  requirements: {
    skillLevel: number;
    tools: string[];
  };
  craftingTime: number;
  successRate: number;
}

export interface MaterialRequirement {
  itemId: string;
  name: string;
  quantity: number;
  quality?: number;
}

export class CraftingPanel extends BaseUIComponent {
  private world: World;
  private recipeList!: HTMLDivElement;
  private materialsList!: HTMLDivElement;
  private craftingArea!: HTMLDivElement;
  private selectedRecipe: Recipe | null = null;
  private craftingQueue: Recipe[] = [];
  private currentCraftingType: 'equipment' | 'food' | 'alchemy' | 'all' = 'all';

  // Mock recipe data
  private recipes: Recipe[] = [
    {
      id: 'iron_sword',
      name: '铁剑',
      type: 'equipment',
      description: '基础的铁制武器，适合新手使用',
      materials: [
        { itemId: 'iron_ore', name: '铁矿石', quantity: 3 },
        { itemId: 'wood', name: '木材', quantity: 1 },
        { itemId: 'leather', name: '皮革', quantity: 1 }
      ],
      result: { itemId: 'iron_sword', quantity: 1, quality: 50 },
      requirements: { skillLevel: 1, tools: ['forge'] },
      craftingTime: 300,
      successRate: 0.9
    },
    {
      id: 'health_potion',
      name: '治疗药水',
      type: 'alchemy',
      description: '恢复生命值的基础药水',
      materials: [
        { itemId: 'herb', name: '草药', quantity: 2 },
        { itemId: 'water', name: '纯净水', quantity: 1 }
      ],
      result: { itemId: 'health_potion', quantity: 1, quality: 60 },
      requirements: { skillLevel: 1, tools: ['alchemy_kit'] },
      craftingTime: 120,
      successRate: 0.95
    },
    {
      id: 'bread',
      name: '面包',
      type: 'food',
      description: '简单的烘焙食物，提供基础营养',
      materials: [
        { itemId: 'wheat', name: '小麦', quantity: 2 },
        { itemId: 'water', name: '水', quantity: 1 }
      ],
      result: { itemId: 'bread', quantity: 2, quality: 40 },
      requirements: { skillLevel: 1, tools: ['oven'] },
      craftingTime: 180,
      successRate: 0.98
    }
  ];

  constructor(uiManager: UIManager, eventSystem: EventSystem, world: World) {
    super('crafting-panel', uiManager, eventSystem);
    this.world = world;
  }

  protected createElement(): HTMLElement {
    const panel = this.createPanel('crafting-panel');
    panel.style.cssText = `
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 1000px;
      height: 700px;
      display: flex;
      flex-direction: row;
      gap: 16px;
    `;

    // Initialize the div elements here
    this.recipeList = this.createElement_div();
    this.materialsList = this.createElement_div();
    this.craftingArea = this.createElement_div();

    // Header
    const header = this.createElement_div('panel-header', `
      <h2>🔨 制作工坊</h2>
      <button class="ui-button close-btn">×</button>
    `);
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    `;

    const closeBtn = header.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => this.hide());

    // Filter tabs
    const filterTabs = this.createElement_div('filter-tabs');
    filterTabs.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    `;

    const tabs = [
      { key: 'all', label: '全部', icon: '🔧' },
      { key: 'equipment', label: '装备制作', icon: '⚔️' },
      { key: 'food', label: '烹饪', icon: '🍳' },
      { key: 'alchemy', label: '炼金', icon: '🧪' }
    ];

    tabs.forEach(tab => {
      const tabBtn = this.createButton(`${tab.icon} ${tab.label}`, () => {
        this.currentCraftingType = tab.key as any;
        this.renderFilterTabs();
        this.renderRecipeList();
      });

      if (this.currentCraftingType === tab.key) {
        tabBtn.style.backgroundColor = this.uiManager.getTheme().colors.primary;
      } else {
        tabBtn.style.backgroundColor = 'rgba(255,255,255,0.1)';
      }

      filterTabs.appendChild(tabBtn);
    });

    // Main content
    const mainContent = this.createElement_div('main-content');
    mainContent.style.cssText = `
      display: flex;
      flex: 1;
      gap: 16px;
      min-height: 0;
    `;

    // Left side - Recipe list
    const leftSide = this.createElement_div('left-side');
    leftSide.style.cssText = `
      width: 300px;
      display: flex;
      flex-direction: column;
    `;

    const recipeTitle = this.createElement_h3('', '配方列表');
    this.recipeList.className = 'recipe-list';
    this.recipeList.style.cssText = `
      flex: 1;
      overflow-y: auto;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 16px;
    `;

    leftSide.appendChild(recipeTitle);
    leftSide.appendChild(this.recipeList);

    // Center - Materials and requirements
    const centerSide = this.createElement_div('center-side');
    centerSide.style.cssText = `
      width: 300px;
      display: flex;
      flex-direction: column;
    `;

    const materialsTitle = this.createElement_h3('', '材料需求');
    this.materialsList.className = 'materials-list';
    this.materialsList.style.cssText = `
      flex: 1;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 16px;
    `;

    centerSide.appendChild(materialsTitle);
    centerSide.appendChild(this.materialsList);

    // Right side - Crafting area
    const rightSide = this.createElement_div('right-side');
    rightSide.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
    `;

    const craftingTitle = this.createElement_h3('', '制作区域');
    this.craftingArea.className = 'crafting-area';
    this.craftingArea.style.cssText = `
      flex: 1;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
    `;

    rightSide.appendChild(craftingTitle);
    rightSide.appendChild(this.craftingArea);

    // Assemble panel
    mainContent.appendChild(leftSide);
    mainContent.appendChild(centerSide);
    mainContent.appendChild(rightSide);

    panel.appendChild(header);
    panel.appendChild(filterTabs);
    panel.appendChild(mainContent);

    return panel;
  }

  public render(): void {
    this.renderFilterTabs();
    this.renderRecipeList();
    this.renderMaterialsList();
    this.renderCraftingArea();
  }

  private renderFilterTabs(): void {
    const filterTabs = this.element.querySelector('.filter-tabs') as HTMLDivElement;
    if (!filterTabs) return;

    const buttons = filterTabs.querySelectorAll('.ui-button');
    buttons.forEach((btn, index) => {
      const tabKeys = ['all', 'equipment', 'food', 'alchemy'];
      if (this.currentCraftingType === tabKeys[index]) {
        (btn as HTMLElement).style.backgroundColor = this.uiManager.getTheme().colors.primary;
      } else {
        (btn as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.1)';
      }
    });
  }

  private renderRecipeList(): void {
    this.recipeList.innerHTML = '';

    const filteredRecipes = this.currentCraftingType === 'all' 
      ? this.recipes 
      : this.recipes.filter(recipe => recipe.type === this.currentCraftingType);

    if (filteredRecipes.length === 0) {
      this.recipeList.appendChild(
        this.createElement_div('empty-state', '没有可用的配方')
      );
      return;
    }

    filteredRecipes.forEach(recipe => {
      const recipeItem = this.createElement_div('recipe-item');
      recipeItem.style.cssText = `
        padding: 12px;
        margin-bottom: 12px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      `;

      const typeColor = this.getTypeColor(recipe.type);
      const typeIcon = this.getTypeIcon(recipe.type);
      
      recipeItem.innerHTML = `
        <div class="recipe-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="margin: 0; color: ${typeColor};">${typeIcon} ${recipe.name}</h4>
          <span class="success-rate" style="background: ${this.getSuccessRateColor(recipe.successRate)}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
            ${(recipe.successRate * 100).toFixed(0)}%
          </span>
        </div>
        <p style="margin: 8px 0; font-size: 12px; color: #b0b0b0; line-height: 1.4;">
          ${recipe.description}
        </p>
        <div class="recipe-info" style="display: flex; justify-content: space-between; font-size: 11px; color: #b0b0b0;">
          <span>制作时间: ${this.formatTime(recipe.craftingTime)}</span>
          <span>需要等级: ${recipe.requirements.skillLevel}</span>
        </div>
      `;

      // Add hover effects
      recipeItem.addEventListener('mouseenter', () => {
        recipeItem.style.backgroundColor = 'rgba(255,255,255,0.05)';
        recipeItem.style.borderColor = 'rgba(255,255,255,0.3)';
      });

      recipeItem.addEventListener('mouseleave', () => {
        recipeItem.style.backgroundColor = 'transparent';
        recipeItem.style.borderColor = 'rgba(255,255,255,0.1)';
      });

      // Select recipe on click
      recipeItem.addEventListener('click', () => {
        // Remove previous selection
        this.recipeList.querySelectorAll('.recipe-item').forEach(el => {
          el.classList.remove('selected');
        });
        
        // Add selection to current item
        recipeItem.classList.add('selected');
        recipeItem.style.borderColor = this.uiManager.getTheme().colors.primary;
        
        this.selectedRecipe = recipe;
        this.renderMaterialsList();
        this.renderCraftingArea();
      });

      this.recipeList.appendChild(recipeItem);
    });
  }

  private renderMaterialsList(): void {
    this.materialsList.innerHTML = '';

    if (!this.selectedRecipe) {
      this.materialsList.appendChild(
        this.createElement_div('empty-state', '请选择一个配方查看材料需求')
      );
      return;
    }

    const recipe = this.selectedRecipe;

    // Recipe details
    const recipeDetails = this.createElement_div('recipe-details');
    recipeDetails.innerHTML = `
      <h4>${this.getTypeIcon(recipe.type)} ${recipe.name}</h4>
      <p style="font-size: 12px; color: #b0b0b0; margin: 8px 0;">${recipe.description}</p>
      <div class="recipe-stats" style="margin: 12px 0;">
        <div style="font-size: 11px; margin-bottom: 4px;">制作时间: ${this.formatTime(recipe.craftingTime)}</div>
        <div style="font-size: 11px; margin-bottom: 4px;">成功率: ${(recipe.successRate * 100).toFixed(0)}%</div>
        <div style="font-size: 11px; margin-bottom: 4px;">需要等级: ${recipe.requirements.skillLevel}</div>
      </div>
    `;

    this.materialsList.appendChild(recipeDetails);

    // Materials list
    const materialsTitle = this.createElement_h3('', '所需材料');
    this.materialsList.appendChild(materialsTitle);

    recipe.materials.forEach(material => {
      const materialItem = this.createElement_div('material-item');
      materialItem.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        margin-bottom: 4px;
        background: rgba(255,255,255,0.05);
        border-radius: 4px;
      `;

      // Check if player has enough materials (mock check)
      const hasEnough = Math.random() > 0.3; // Mock availability
      const availableAmount = hasEnough ? material.quantity + Math.floor(Math.random() * 5) : Math.floor(Math.random() * material.quantity);

      materialItem.innerHTML = `
        <div class="material-info">
          <div style="font-size: 12px; font-weight: bold;">${material.name}</div>
          <div style="font-size: 10px; color: #b0b0b0;">需要: ${material.quantity}</div>
        </div>
        <div class="material-status">
          <div style="font-size: 12px; color: ${hasEnough ? '#2ecc71' : '#e74c3c'};">
            ${availableAmount}/${material.quantity}
          </div>
          <div style="font-size: 10px; color: ${hasEnough ? '#2ecc71' : '#e74c3c'};">
            ${hasEnough ? '✓' : '✗'}
          </div>
        </div>
      `;

      this.materialsList.appendChild(materialItem);
    });

    // Required tools
    if (recipe.requirements.tools.length > 0) {
      const toolsTitle = this.createElement_h3('', '所需工具');
      this.materialsList.appendChild(toolsTitle);

      recipe.requirements.tools.forEach(tool => {
        const toolItem = this.createElement_div('tool-item');
        toolItem.style.cssText = `
          padding: 8px;
          margin-bottom: 4px;
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
          font-size: 12px;
        `;

        const hasTools = Math.random() > 0.2; // Mock tool availability
        toolItem.innerHTML = `
          <span>${this.getToolName(tool)}</span>
          <span style="color: ${hasTools ? '#2ecc71' : '#e74c3c'}; float: right;">
            ${hasTools ? '✓ 可用' : '✗ 缺失'}
          </span>
        `;

        this.materialsList.appendChild(toolItem);
      });
    }
  }

  private renderCraftingArea(): void {
    this.craftingArea.innerHTML = '';

    // Crafting queue
    const queueTitle = this.createElement_h3('', `制作队列 (${this.craftingQueue.length})`);
    this.craftingArea.appendChild(queueTitle);

    const queueList = this.createElement_div('queue-list');
    queueList.style.cssText = `
      max-height: 150px;
      overflow-y: auto;
      margin-bottom: 16px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 8px;
    `;

    if (this.craftingQueue.length === 0) {
      queueList.appendChild(
        this.createElement_div('empty-state', '制作队列为空')
      );
    } else {
      this.craftingQueue.forEach((recipe, index) => {
        const queueItem = this.createElement_div('queue-item');
        queueItem.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          margin-bottom: 4px;
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
        `;

        queueItem.innerHTML = `
          <div>
            <div style="font-size: 12px; font-weight: bold;">${recipe.name}</div>
            <div style="font-size: 10px; color: #b0b0b0;">剩余时间: ${this.formatTime(recipe.craftingTime)}</div>
          </div>
          <button class="ui-button cancel-btn" style="padding: 4px 8px; font-size: 10px;">取消</button>
        `;

        const cancelBtn = queueItem.querySelector('.cancel-btn') as HTMLButtonElement;
        cancelBtn.addEventListener('click', () => {
          this.cancelCrafting(index);
        });

        queueList.appendChild(queueItem);
      });
    }

    this.craftingArea.appendChild(queueList);

    // Craft button
    if (this.selectedRecipe) {
      const craftBtn = this.createButton(`制作 ${this.selectedRecipe.name}`, () => {
        this.startCrafting();
      });

      // Check if can craft (mock check)
      const canCraft = this.canCraftRecipe(this.selectedRecipe);
      craftBtn.disabled = !canCraft;
      if (!canCraft) {
        craftBtn.style.opacity = '0.5';
        craftBtn.title = '材料不足或条件不满足';
      }

      this.craftingArea.appendChild(craftBtn);

      // Craft multiple button
      const craftMultipleBtn = this.createButton('制作 x5', () => {
        this.startCrafting(5);
      });

      craftMultipleBtn.disabled = !canCraft;
      if (!canCraft) {
        craftMultipleBtn.style.opacity = '0.5';
      }

      this.craftingArea.appendChild(craftMultipleBtn);
    }

    // Crafting progress (if any active)
    if (this.craftingQueue.length > 0) {
      const progressArea = this.createElement_div('progress-area');
      progressArea.style.cssText = `
        margin-top: 16px;
        padding: 16px;
        background: rgba(255,255,255,0.05);
        border-radius: 8px;
      `;

      const currentRecipe = this.craftingQueue[0];
      if (currentRecipe) {
        const progress = Math.random() * 100; // Mock progress

        progressArea.innerHTML = `
          <h3>正在制作: ${currentRecipe.name}</h3>
          <div class="progress-bar" style="
            width: 100%;
            height: 20px;
            background: rgba(0,0,0,0.3);
            border-radius: 10px;
            overflow: hidden;
            margin: 8px 0;
          ">
            <div style="
              width: ${progress}%;
              height: 100%;
              background: linear-gradient(90deg, #3498db, #2ecc71);
              transition: width 0.3s ease;
            "></div>
          </div>
          <div style="font-size: 12px; color: #b0b0b0;">
            进度: ${progress.toFixed(1)}% | 预计完成时间: ${this.formatTime(currentRecipe.craftingTime * (1 - progress / 100))}
          </div>
        `;

        this.craftingArea.appendChild(progressArea);
      }
    }
  }

  private getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      'equipment': '#e67e22',
      'food': '#2ecc71',
      'alchemy': '#9b59b6'
    };
    return colors[type] || '#ffffff';
  }

  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'equipment': '⚔️',
      'food': '🍳',
      'alchemy': '🧪'
    };
    return icons[type] || '🔧';
  }

  private getSuccessRateColor(rate: number): string {
    if (rate >= 0.9) return '#2ecc71';
    if (rate >= 0.7) return '#f39c12';
    return '#e74c3c';
  }

  private getToolName(toolId: string): string {
    const toolNames: Record<string, string> = {
      'forge': '锻造台',
      'alchemy_kit': '炼金套装',
      'oven': '烤箱',
      'workbench': '工作台'
    };
    return toolNames[toolId] || toolId;
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  private canCraftRecipe(recipe: Recipe): boolean {
    // Mock check - in real implementation, check actual inventory and requirements
    return Math.random() > 0.3;
  }

  private startCrafting(quantity: number = 1): void {
    if (!this.selectedRecipe) return;

    for (let i = 0; i < quantity; i++) {
      this.craftingQueue.push({ ...this.selectedRecipe });
    }

    this.eventSystem.emit('crafting:started', {
      recipe: this.selectedRecipe,
      quantity
    });

    this.showNotification(`开始制作 ${this.selectedRecipe.name} x${quantity}`, 'success');
    this.renderCraftingArea();

    // Simulate crafting completion
    setTimeout(() => {
      this.completeCrafting();
    }, this.selectedRecipe.craftingTime * 1000);
  }

  private cancelCrafting(index: number): void {
    const recipe = this.craftingQueue[index];
    if (!recipe) return;
    
    this.craftingQueue.splice(index, 1);

    this.eventSystem.emit('crafting:cancelled', { recipe });
    this.showNotification(`取消制作 ${recipe.name}`, 'warning');
    this.renderCraftingArea();
  }

  private completeCrafting(): void {
    if (this.craftingQueue.length === 0) return;

    const completedRecipe = this.craftingQueue.shift();
    if (!completedRecipe) return;
    
    // Simulate success/failure
    const success = Math.random() < completedRecipe.successRate;

    if (success) {
      this.eventSystem.emit('crafting:completed', {
        recipe: completedRecipe,
        result: completedRecipe.result
      });
      this.showNotification(`成功制作 ${completedRecipe.name}！`, 'success');
    } else {
      this.eventSystem.emit('crafting:failed', { recipe: completedRecipe });
      this.showNotification(`制作 ${completedRecipe.name} 失败`, 'error');
    }

    this.renderCraftingArea();

    // Continue with next item in queue
    const nextRecipe = this.craftingQueue[0];
    if (nextRecipe) {
      setTimeout(() => {
        this.completeCrafting();
      }, nextRecipe.craftingTime * 1000);
    }
  }

  protected setupEventListeners(): void {
    this.eventSystem.on('inventory:updated', () => this.render());
    this.eventSystem.on('crafting:skill_updated', () => this.render());
  }
}