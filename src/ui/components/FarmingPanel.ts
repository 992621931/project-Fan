/**
 * Farming Panel - Farming and collection interface
 * Handles crop planting, harvesting, and collection management
 */

import { BaseUIComponent } from '../BaseUIComponent';
import { UIManager } from '../UIManager';
import { EventSystem } from '../../ecs/EventSystem';
import { Entity } from '../../ecs/Entity';
import { World } from '../../ecs/World';

export interface FarmPlot {
  id: number;
  crop: Crop | null;
  plantTime: number;
  growthStage: number; // 0-4
  fertility: number; // 0-100
  waterLevel: number; // 0-100
  fertilized: boolean;
}

export interface Crop {
  id: string;
  name: string;
  icon: string;
  growthTime: number; // in seconds
  seasons: string[];
  yield: {
    itemId: string;
    quantity: number;
    chance: number;
  }[];
  requirements: {
    soilQuality: number;
    waterFrequency: number;
  };
}

export interface CollectionEntry {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  unlocked: boolean;
  discoveredAt?: number;
  rarity: number;
}

export class FarmingPanel extends BaseUIComponent {
  private world: World;
  private farmGrid!: HTMLDivElement;
  private seedInventory!: HTMLDivElement;
  private collectionBook!: HTMLDivElement;
  private selectedPlot: FarmPlot | null = null;
  private currentView: 'farming' | 'collection' = 'farming';
  private currentSeason: string = 'spring';

  // Mock farm data
  private farmPlots: FarmPlot[] = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    crop: null,
    plantTime: 0,
    growthStage: 0,
    fertility: 50 + Math.random() * 50,
    waterLevel: 30 + Math.random() * 40,
    fertilized: false
  }));

  // Mock crop data
  private availableCrops: Crop[] = [
    {
      id: 'wheat',
      name: '小麦',
      icon: '🌾',
      growthTime: 300,
      seasons: ['spring', 'summer'],
      yield: [
        { itemId: 'wheat', quantity: 2, chance: 1.0 },
        { itemId: 'wheat_seed', quantity: 1, chance: 0.3 }
      ],
      requirements: { soilQuality: 30, waterFrequency: 2 }
    },
    {
      id: 'carrot',
      name: '胡萝卜',
      icon: '🥕',
      growthTime: 240,
      seasons: ['spring', 'fall'],
      yield: [
        { itemId: 'carrot', quantity: 1, chance: 1.0 }
      ],
      requirements: { soilQuality: 40, waterFrequency: 3 }
    },
    {
      id: 'tomato',
      name: '番茄',
      icon: '🍅',
      growthTime: 420,
      seasons: ['summer'],
      yield: [
        { itemId: 'tomato', quantity: 3, chance: 1.0 },
        { itemId: 'tomato_seed', quantity: 2, chance: 0.5 }
      ],
      requirements: { soilQuality: 60, waterFrequency: 4 }
    }
  ];

  // Mock collection data
  private collectionEntries: CollectionEntry[] = [
    {
      id: 'wheat',
      name: '小麦',
      category: '作物',
      icon: '🌾',
      description: '基础的谷物作物，用于制作面包和其他食物',
      unlocked: true,
      discoveredAt: Date.now() - 86400000,
      rarity: 0
    },
    {
      id: 'rare_flower',
      name: '稀有花朵',
      category: '植物',
      icon: '🌺',
      description: '极其罕见的花朵，具有神秘的魔法属性',
      unlocked: false,
      rarity: 2
    }
  ];

  constructor(uiManager: UIManager, eventSystem: EventSystem, world: World) {
    super('farming-panel', uiManager, eventSystem);
    this.world = world;
  }

  protected createElement(): HTMLElement {
    const panel = this.createPanel('farming-panel');
    panel.style.cssText = `
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 1000px;
      height: 700px;
      display: flex;
      flex-direction: column;
    `;

    // Initialize the div elements here
    this.farmGrid = this.createElement_div();
    this.seedInventory = this.createElement_div();
    this.collectionBook = this.createElement_div();

    // Header
    const header = this.createElement_div('panel-header', `
      <h2>🌾 农场与图鉴</h2>
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

    // View tabs
    const viewTabs = this.createElement_div('view-tabs');
    viewTabs.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    `;

    const farmingTab = this.createButton('🌱 农场', () => {
      this.currentView = 'farming';
      this.renderViewTabs();
      this.renderMainContent();
    });

    const collectionTab = this.createButton('📚 图鉴', () => {
      this.currentView = 'collection';
      this.renderViewTabs();
      this.renderMainContent();
    });

    viewTabs.appendChild(farmingTab);
    viewTabs.appendChild(collectionTab);

    // Main content container
    const mainContent = this.createElement_div('main-content');
    mainContent.style.cssText = `
      flex: 1;
      display: flex;
      gap: 16px;
      min-height: 0;
    `;

    // Assemble panel
    panel.appendChild(header);
    panel.appendChild(viewTabs);
    panel.appendChild(mainContent);

    return panel;
  }

  public render(): void {
    this.renderViewTabs();
    this.renderMainContent();
  }

  private renderViewTabs(): void {
    const viewTabs = this.element.querySelector('.view-tabs') as HTMLDivElement;
    if (!viewTabs) return;

    const buttons = viewTabs.querySelectorAll('.ui-button');
    buttons.forEach((btn, index) => {
      const views = ['farming', 'collection'];
      if (this.currentView === views[index]) {
        (btn as HTMLElement).style.backgroundColor = this.uiManager.getTheme().colors.primary;
      } else {
        (btn as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.1)';
      }
    });
  }

  private renderMainContent(): void {
    const mainContent = this.element.querySelector('.main-content') as HTMLDivElement;
    if (!mainContent) return;

    mainContent.innerHTML = '';

    if (this.currentView === 'farming') {
      this.renderFarmingView(mainContent);
    } else {
      this.renderCollectionView(mainContent);
    }
  }

  private renderFarmingView(container: HTMLDivElement): void {
    // Left side - Farm grid
    const leftSide = this.createElement_div('left-side');
    leftSide.style.cssText = `
      flex: 2;
      display: flex;
      flex-direction: column;
    `;

    // Season and weather info
    const seasonInfo = this.createElement_div('season-info');
    seasonInfo.style.cssText = `
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    seasonInfo.innerHTML = `
      <div>
        <span style="font-size: 16px;">${this.getSeasonIcon(this.currentSeason)} ${this.getSeasonName(this.currentSeason)}</span>
        <span style="font-size: 12px; color: #b0b0b0; margin-left: 16px;">天气: ☀️ 晴朗</span>
      </div>
      <div style="font-size: 12px; color: #b0b0b0;">
        农场等级: 3 | 经验: 1,250/2,000
      </div>
    `;

    leftSide.appendChild(seasonInfo);

    // Farm grid
    const farmTitle = this.createElement_h3('', '农田 (12/12)');
    this.farmGrid.className = 'farm-grid';
    this.farmGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      flex: 1;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 16px;
    `;

    this.renderFarmGrid();

    leftSide.appendChild(farmTitle);
    leftSide.appendChild(this.farmGrid);

    // Right side - Seed inventory and plot details
    const rightSide = this.createElement_div('right-side');
    rightSide.style.cssText = `
      width: 300px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    // Seed inventory
    const seedTitle = this.createElement_h3('', '种子背包');
    this.seedInventory.className = 'seed-inventory';
    this.seedInventory.style.cssText = `
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 16px;
      max-height: 200px;
      overflow-y: auto;
    `;

    this.renderSeedInventory();

    rightSide.appendChild(seedTitle);
    rightSide.appendChild(this.seedInventory);

    // Plot details
    const plotDetails = this.createElement_div('plot-details');
    plotDetails.style.cssText = `
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 16px;
      flex: 1;
    `;

    this.renderPlotDetails(plotDetails);
    rightSide.appendChild(plotDetails);

    container.appendChild(leftSide);
    container.appendChild(rightSide);
  }

  private renderFarmGrid(): void {
    this.farmGrid.innerHTML = '';

    this.farmPlots.forEach(plot => {
      const plotElement = this.createElement_div('farm-plot');
      plotElement.style.cssText = `
        width: 80px;
        height: 80px;
        border: 2px solid rgba(139, 69, 19, 0.5);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%);
        position: relative;
      `;

      if (plot.crop) {
        const growthPercent = (plot.growthStage / 4) * 100;
        plotElement.innerHTML = `
          <div class="crop-icon" style="font-size: 24px; margin-bottom: 4px;">
            ${plot.crop.icon}
          </div>
          <div class="growth-bar" style="
            width: 60px;
            height: 4px;
            background: rgba(0,0,0,0.3);
            border-radius: 2px;
            overflow: hidden;
          ">
            <div style="
              width: ${growthPercent}%;
              height: 100%;
              background: linear-gradient(90deg, #e74c3c, #f39c12, #2ecc71);
              transition: width 0.3s ease;
            "></div>
          </div>
          <div style="font-size: 8px; color: rgba(255,255,255,0.8);">
            ${plot.growthStage}/4
          </div>
        `;

        if (plot.growthStage >= 4) {
          plotElement.style.borderColor = '#2ecc71';
          plotElement.style.boxShadow = '0 0 10px rgba(46, 204, 113, 0.5)';
        }
      } else {
        plotElement.innerHTML = `
          <div style="font-size: 12px; opacity: 0.5;">空地</div>
          <div style="font-size: 8px; opacity: 0.3;">点击种植</div>
        `;
      }

      // Fertility indicator
      const fertilityColor = plot.fertility > 70 ? '#2ecc71' : plot.fertility > 40 ? '#f39c12' : '#e74c3c';
      const fertilityIndicator = document.createElement('div');
      fertilityIndicator.style.cssText = `
        position: absolute;
        top: 2px;
        left: 2px;
        width: 8px;
        height: 8px;
        background: ${fertilityColor};
        border-radius: 50%;
        opacity: 0.7;
      `;
      plotElement.appendChild(fertilityIndicator);

      // Water level indicator
      const waterColor = plot.waterLevel > 70 ? '#3498db' : plot.waterLevel > 40 ? '#f39c12' : '#e74c3c';
      const waterIndicator = document.createElement('div');
      waterIndicator.style.cssText = `
        position: absolute;
        top: 2px;
        right: 2px;
        width: 8px;
        height: 8px;
        background: ${waterColor};
        border-radius: 50%;
        opacity: 0.7;
      `;
      plotElement.appendChild(waterIndicator);

      // Add hover effects
      plotElement.addEventListener('mouseenter', () => {
        plotElement.style.transform = 'scale(1.05)';
        plotElement.style.borderColor = this.uiManager.getTheme().colors.primary;
      });

      plotElement.addEventListener('mouseleave', () => {
        plotElement.style.transform = 'scale(1)';
        plotElement.style.borderColor = 'rgba(139, 69, 19, 0.5)';
      });

      // Select plot on click
      plotElement.addEventListener('click', () => {
        this.selectedPlot = plot;
        this.renderPlotDetails(this.element.querySelector('.plot-details') as HTMLDivElement);
        
        // Update visual selection
        this.farmGrid.querySelectorAll('.farm-plot').forEach(el => {
          el.classList.remove('selected');
        });
        plotElement.classList.add('selected');
        plotElement.style.borderColor = this.uiManager.getTheme().colors.accent;
      });

      this.farmGrid.appendChild(plotElement);
    });
  }

  private renderSeedInventory(): void {
    this.seedInventory.innerHTML = '';

    this.availableCrops.forEach(crop => {
      const seedItem = this.createElement_div('seed-item');
      seedItem.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        margin-bottom: 8px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
      `;

      const canPlantInSeason = crop.seasons.includes(this.currentSeason);
      const seedCount = Math.floor(Math.random() * 10) + 1; // Mock seed count

      seedItem.innerHTML = `
        <div class="seed-info">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">${crop.icon}</span>
            <div>
              <div style="font-size: 12px; font-weight: bold;">${crop.name}</div>
              <div style="font-size: 10px; color: ${canPlantInSeason ? '#2ecc71' : '#e74c3c'};">
                ${canPlantInSeason ? '适合当前季节' : '不适合当前季节'}
              </div>
            </div>
          </div>
        </div>
        <div class="seed-count" style="font-size: 12px; font-weight: bold;">
          ${seedCount}
        </div>
      `;

      if (!canPlantInSeason) {
        seedItem.style.opacity = '0.5';
      }

      // Add hover effects
      seedItem.addEventListener('mouseenter', () => {
        if (canPlantInSeason) {
          seedItem.style.backgroundColor = 'rgba(255,255,255,0.05)';
        }
      });

      seedItem.addEventListener('mouseleave', () => {
        seedItem.style.backgroundColor = 'transparent';
      });

      // Plant seed on click
      seedItem.addEventListener('click', () => {
        if (canPlantInSeason && this.selectedPlot && !this.selectedPlot.crop) {
          this.plantSeed(crop, this.selectedPlot);
        } else if (!canPlantInSeason) {
          this.showNotification('该作物不适合当前季节', 'warning');
        } else if (!this.selectedPlot) {
          this.showNotification('请先选择一块农田', 'warning');
        } else if (this.selectedPlot.crop) {
          this.showNotification('该农田已有作物', 'warning');
        }
      });

      this.seedInventory.appendChild(seedItem);
    });
  }

  private renderPlotDetails(container: HTMLDivElement): void {
    container.innerHTML = '';

    if (!this.selectedPlot) {
      container.appendChild(
        this.createElement_div('empty-state', '请选择一块农田查看详情')
      );
      return;
    }

    const plot = this.selectedPlot;

    // Plot info
    const plotInfo = this.createElement_div('plot-info');
    plotInfo.innerHTML = `
      <h4>农田 #${plot.id + 1}</h4>
      <div class="plot-stats" style="margin: 12px 0;">
        <div class="stat-item" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>肥沃度:</span>
          <span style="color: ${plot.fertility > 70 ? '#2ecc71' : plot.fertility > 40 ? '#f39c12' : '#e74c3c'};">
            ${plot.fertility.toFixed(0)}/100
          </span>
        </div>
        <div class="stat-item" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>水分:</span>
          <span style="color: ${plot.waterLevel > 70 ? '#3498db' : plot.waterLevel > 40 ? '#f39c12' : '#e74c3c'};">
            ${plot.waterLevel.toFixed(0)}/100
          </span>
        </div>
        <div class="stat-item" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>施肥状态:</span>
          <span style="color: ${plot.fertilized ? '#2ecc71' : '#e74c3c'};">
            ${plot.fertilized ? '已施肥' : '未施肥'}
          </span>
        </div>
      </div>
    `;

    container.appendChild(plotInfo);

    if (plot.crop) {
      // Crop details
      const cropDetails = this.createElement_div('crop-details');
      cropDetails.innerHTML = `
        <h4>${plot.crop.icon} ${plot.crop.name}</h4>
        <div class="growth-info" style="margin: 12px 0;">
          <div style="margin-bottom: 8px;">
            <span>生长阶段: ${plot.growthStage}/4</span>
          </div>
          <div class="growth-progress" style="
            width: 100%;
            height: 20px;
            background: rgba(0,0,0,0.3);
            border-radius: 10px;
            overflow: hidden;
            margin: 8px 0;
          ">
            <div style="
              width: ${(plot.growthStage / 4) * 100}%;
              height: 100%;
              background: linear-gradient(90deg, #e74c3c, #f39c12, #2ecc71);
              transition: width 0.3s ease;
            "></div>
          </div>
          <div style="font-size: 12px; color: #b0b0b0;">
            ${plot.growthStage >= 4 ? '可以收获！' : `预计 ${this.formatTime((4 - plot.growthStage) * 60)} 后成熟`}
          </div>
        </div>
      `;

      container.appendChild(cropDetails);

      // Action buttons
      const actions = this.createElement_div('crop-actions');
      actions.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 16px;
      `;

      if (plot.growthStage >= 4) {
        const harvestBtn = this.createButton('🌾 收获', () => {
          this.harvestCrop(plot);
        });
        actions.appendChild(harvestBtn);
      }

      const waterBtn = this.createButton('💧 浇水', () => {
        this.waterPlot(plot);
      });

      const fertilizeBtn = this.createButton('🌱 施肥', () => {
        this.fertilizePlot(plot);
      });

      actions.appendChild(waterBtn);
      actions.appendChild(fertilizeBtn);

      container.appendChild(actions);
    } else {
      // Empty plot actions
      const actions = this.createElement_div('plot-actions');
      actions.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 16px;
      `;

      const tillBtn = this.createButton('🚜 翻土', () => {
        this.tillPlot(plot);
      });

      const waterBtn = this.createButton('💧 浇水', () => {
        this.waterPlot(plot);
      });

      const fertilizeBtn = this.createButton('🌱 施肥', () => {
        this.fertilizePlot(plot);
      });

      actions.appendChild(tillBtn);
      actions.appendChild(waterBtn);
      actions.appendChild(fertilizeBtn);

      container.appendChild(actions);
    }
  }

  private renderCollectionView(container: HTMLDivElement): void {
    // Collection book
    const collectionContainer = this.createElement_div('collection-container');
    collectionContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
    `;

    // Collection stats
    const stats = this.createElement_div('collection-stats');
    const unlockedCount = this.collectionEntries.filter(entry => entry.unlocked).length;
    const totalCount = this.collectionEntries.length;
    const completionRate = (unlockedCount / totalCount * 100).toFixed(1);

    stats.style.cssText = `
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    stats.innerHTML = `
      <div>
        <h3>📚 收集图鉴</h3>
        <div style="font-size: 12px; color: #b0b0b0;">
          发现进度: ${unlockedCount}/${totalCount} (${completionRate}%)
        </div>
      </div>
      <div class="completion-circle" style="
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: conic-gradient(#2ecc71 0deg ${(unlockedCount / totalCount) * 360}deg, rgba(255,255,255,0.1) ${(unlockedCount / totalCount) * 360}deg 360deg);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
      ">
        ${completionRate}%
      </div>
    `;

    collectionContainer.appendChild(stats);

    // Collection grid
    const collectionGrid = this.createElement_div('collection-grid');
    collectionGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
    `;

    this.collectionEntries.forEach(entry => {
      const entryElement = this.createElement_div('collection-entry');
      entryElement.style.cssText = `
        padding: 16px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        transition: all 0.2s ease;
        cursor: pointer;
        ${entry.unlocked ? '' : 'opacity: 0.5; filter: grayscale(100%);'}
      `;

      const rarityClass = this.formatRarity(entry.rarity);

      entryElement.innerHTML = `
        <div class="entry-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <div class="entry-icon" style="font-size: 32px;">
            ${entry.unlocked ? entry.icon : '❓'}
          </div>
          <div>
            <h4 class="${rarityClass}" style="margin: 0;">
              ${entry.unlocked ? entry.name : '???'}
            </h4>
            <div style="font-size: 10px; color: #b0b0b0;">
              ${entry.category}
            </div>
          </div>
        </div>
        <div class="entry-description" style="font-size: 12px; color: #b0b0b0; line-height: 1.4;">
          ${entry.unlocked ? entry.description : '尚未发现此物品'}
        </div>
        ${entry.unlocked && entry.discoveredAt ? `
          <div style="font-size: 10px; color: #f39c12; margin-top: 8px;">
            发现于: ${new Date(entry.discoveredAt).toLocaleDateString()}
          </div>
        ` : ''}
      `;

      // Add hover effects
      entryElement.addEventListener('mouseenter', () => {
        if (entry.unlocked) {
          entryElement.style.backgroundColor = 'rgba(255,255,255,0.05)';
          entryElement.style.borderColor = 'rgba(255,255,255,0.3)';
        }
      });

      entryElement.addEventListener('mouseleave', () => {
        entryElement.style.backgroundColor = 'transparent';
        entryElement.style.borderColor = 'rgba(255,255,255,0.1)';
      });

      collectionGrid.appendChild(entryElement);
    });

    collectionContainer.appendChild(collectionGrid);
    container.appendChild(collectionContainer);
  }

  private getSeasonIcon(season: string): string {
    const icons: Record<string, string> = {
      'spring': '🌸',
      'summer': '☀️',
      'fall': '🍂',
      'winter': '❄️'
    };
    return icons[season] || '🌱';
  }

  private getSeasonName(season: string): string {
    const names: Record<string, string> = {
      'spring': '春季',
      'summer': '夏季',
      'fall': '秋季',
      'winter': '冬季'
    };
    return names[season] || season;
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  private plantSeed(crop: Crop, plot: FarmPlot): void {
    plot.crop = crop;
    plot.plantTime = Date.now();
    plot.growthStage = 0;

    this.eventSystem.emit('farming:planted', { crop, plot });
    this.showNotification(`种植了 ${crop.name}`, 'success');
    this.renderFarmGrid();
    this.renderPlotDetails(this.element.querySelector('.plot-details') as HTMLDivElement);

    // Simulate growth
    this.simulateGrowth(plot);
  }

  private simulateGrowth(plot: FarmPlot): void {
    if (!plot.crop) return;

    const growthInterval = setInterval(() => {
      if (plot.growthStage < 4 && plot.crop) {
        plot.growthStage++;
        this.renderFarmGrid();
        
        if (this.selectedPlot === plot) {
          this.renderPlotDetails(this.element.querySelector('.plot-details') as HTMLDivElement);
        }

        if (plot.growthStage >= 4) {
          this.showNotification(`${plot.crop.name} 已成熟，可以收获了！`, 'success');
          clearInterval(growthInterval);
        }
      } else {
        clearInterval(growthInterval);
      }
    }, plot.crop.growthTime * 1000 / 4); // Divide growth time by 4 stages
  }

  private harvestCrop(plot: FarmPlot): void {
    if (!plot.crop || plot.growthStage < 4) return;

    const crop = plot.crop;
    let harvestedItems: string[] = [];

    // Calculate harvest yield
    crop.yield.forEach(yieldItem => {
      if (Math.random() < yieldItem.chance) {
        for (let i = 0; i < yieldItem.quantity; i++) {
          harvestedItems.push(yieldItem.itemId);
        }
      }
    });

    // Clear the plot
    plot.crop = null;
    plot.growthStage = 0;
    plot.plantTime = 0;

    // Reduce fertility slightly
    plot.fertility = Math.max(0, plot.fertility - 10);

    this.eventSystem.emit('farming:harvested', { crop, plot, items: harvestedItems });
    this.showNotification(`收获了 ${crop.name}，获得 ${harvestedItems.length} 个物品`, 'success');
    
    // Update collection
    this.unlockCollectionEntry(crop.id);
    
    this.renderFarmGrid();
    this.renderPlotDetails(this.element.querySelector('.plot-details') as HTMLDivElement);
  }

  private waterPlot(plot: FarmPlot): void {
    plot.waterLevel = Math.min(100, plot.waterLevel + 30);
    
    this.eventSystem.emit('farming:watered', { plot });
    this.showNotification('浇水完成', 'success');
    this.renderFarmGrid();
    this.renderPlotDetails(this.element.querySelector('.plot-details') as HTMLDivElement);
  }

  private fertilizePlot(plot: FarmPlot): void {
    plot.fertilized = true;
    plot.fertility = Math.min(100, plot.fertility + 20);
    
    this.eventSystem.emit('farming:fertilized', { plot });
    this.showNotification('施肥完成', 'success');
    this.renderFarmGrid();
    this.renderPlotDetails(this.element.querySelector('.plot-details') as HTMLDivElement);
  }

  private tillPlot(plot: FarmPlot): void {
    plot.fertility = Math.min(100, plot.fertility + 10);
    
    this.eventSystem.emit('farming:tilled', { plot });
    this.showNotification('翻土完成', 'success');
    this.renderFarmGrid();
    this.renderPlotDetails(this.element.querySelector('.plot-details') as HTMLDivElement);
  }

  private unlockCollectionEntry(itemId: string): void {
    const entry = this.collectionEntries.find(e => e.id === itemId);
    if (entry && !entry.unlocked) {
      entry.unlocked = true;
      entry.discoveredAt = Date.now();
      
      this.eventSystem.emit('collection:unlocked', { entry });
      this.showNotification(`图鉴解锁: ${entry.name}`, 'success');
    }
  }

  protected setupEventListeners(): void {
    this.eventSystem.on('farming:season_changed', (event: any) => {
      const data = event as { season: string };
      this.currentSeason = data.season;
      this.render();
    });

    this.eventSystem.on('inventory:updated', () => {
      this.renderSeedInventory();
    });
  }
}