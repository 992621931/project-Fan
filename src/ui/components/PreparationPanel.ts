/**
 * PreparationPanel - Modal panel for pre-battle preparation
 * Allows players to feed characters and manage team bag inventory before combat starts
 */

import { World } from '../../ecs/World';
import { NPCSystem } from '../../game/systems/NPCSystem';
import { ItemSystem } from '../../game/systems/ItemSystem';
import { LootSystem } from '../../game/systems/LootSystem';
import { HungerComponentType } from '../../game/components/CharacterComponents';
import { formatNumber } from '../../utils/NumberFormatter';

export class PreparationPanel {
  private overlay: HTMLElement | null = null;
  private panelContainer: HTMLElement | null = null;
  private diningTabButton: HTMLElement | null = null;
  private inventoryTabButton: HTMLElement | null = null;
  private diningContent: HTMLElement | null = null;
  private inventoryContent: HTMLElement | null = null;
  private currentTab: 'dining' | 'inventory' = 'dining';
  
  private world: World;
  private npcSystem: NPCSystem;
  private itemSystem: ItemSystem;
  private lootSystem: LootSystem;
  private partySlots: (any | null)[];
  private onStartBattle: () => void;
  private onClose: (() => void) | null;
  private itemsData: Map<string, any>;
  private onHungerChanged: ((characterId: string, newHunger: number) => void) | null;

  constructor(
    world: World,
    npcSystem: NPCSystem,
    itemSystem: ItemSystem,
    lootSystem: LootSystem,
    partySlots: (any | null)[],
    itemsData: Map<string, any>,
    onStartBattle: () => void,
    onClose?: () => void,
    onHungerChanged?: (characterId: string, newHunger: number) => void
  ) {
    this.world = world;
    this.npcSystem = npcSystem;
    this.itemSystem = itemSystem;
    this.lootSystem = lootSystem;
    this.partySlots = partySlots;
    this.itemsData = itemsData;
    this.onStartBattle = onStartBattle;
    this.onClose = onClose || null;
    this.onHungerChanged = onHungerChanged || null;
  }

  /**
   * Display the preparation panel
   */
  public show(): void {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create panel container
    this.panelContainer = document.createElement('div');
    this.panelContainer.style.cssText = `
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      max-width: 1000px;
      width: 90%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      border-bottom: 2px solid #e0e0e0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      position: relative;
    `;
    
    // Title
    const title = document.createElement('h2');
    title.textContent = '⚔️ 战前准备';
    title.style.cssText = `
      margin: 0;
      color: white;
      font-size: 24px;
      text-align: center;
    `;
    
    // Close button in top-right corner
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 2px solid white;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      font-weight: bold;
    `;
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.3)';
      closeButton.style.transform = 'scale(1.1)';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
      closeButton.style.transform = 'scale(1)';
    });
    closeButton.addEventListener('click', () => {
      this.close();
    });
    
    header.appendChild(title);
    header.appendChild(closeButton);

    // Create tab navigation
    const tabNav = document.createElement('div');
    tabNav.style.cssText = `
      display: flex;
      border-bottom: 2px solid #e0e0e0;
      background: #f5f5f5;
    `;

    this.diningTabButton = this.createTabButton('🍚 用餐', 'dining', true);
    this.inventoryTabButton = this.createTabButton('🎒 整理携带物', 'inventory', false);

    tabNav.appendChild(this.diningTabButton);
    tabNav.appendChild(this.inventoryTabButton);

    // Create content area
    const contentArea = document.createElement('div');
    contentArea.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    `;

    // Create dining content
    this.diningContent = document.createElement('div');
    this.diningContent.style.display = 'block';

    // Create inventory content
    this.inventoryContent = document.createElement('div');
    this.inventoryContent.style.display = 'none';

    contentArea.appendChild(this.diningContent);
    contentArea.appendChild(this.inventoryContent);

    // Create hint area for feeding instructions
    const hintArea = document.createElement('div');
    hintArea.style.cssText = `
      padding: 12px 20px;
      background: #fff8e1;
      border-top: 2px solid #e0e0e0;
      border-bottom: 2px solid #e0e0e0;
      color: #555;
      font-size: 14px;
      line-height: 1.6;
      text-align: left;
    `;
    hintArea.innerHTML = `
      💡 <strong>用餐方法：</strong>在"用餐"标签页中，先点击菜肴，再点击左侧的角色卡片即可完成用餐。<br>
      🎒 <strong>携带物品：</strong>在"整理携带物"标签页中，点击仓库中的物品即可将物品添加到团队背包，探险时可使用。
    `;

    // Create footer with start battle button
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 20px;
      display: flex;
      justify-content: center;
      background: #f5f5f5;
    `;

    const startBattleButton = document.createElement('button');
    startBattleButton.textContent = '⚔️ 开始探险';
    startBattleButton.style.cssText = `
      padding: 12px 40px;
      font-size: 18px;
      font-weight: bold;
      background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
    `;
    startBattleButton.addEventListener('mouseenter', () => {
      startBattleButton.style.transform = 'translateY(-2px)';
      startBattleButton.style.boxShadow = '0 6px 16px rgba(76, 175, 80, 0.4)';
    });
    startBattleButton.addEventListener('mouseleave', () => {
      startBattleButton.style.transform = 'translateY(0)';
      startBattleButton.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3)';
    });
    startBattleButton.addEventListener('click', () => this.handleStartBattle());

    footer.appendChild(startBattleButton);

    // Assemble panel
    this.panelContainer.appendChild(header);
    this.panelContainer.appendChild(tabNav);
    this.panelContainer.appendChild(contentArea);
    this.panelContainer.appendChild(hintArea);
    this.panelContainer.appendChild(footer);

    this.overlay.appendChild(this.panelContainer);

    // Add to document
    document.body.appendChild(this.overlay);

    // Render initial content
    this.renderDiningPage();
  }

  /**
   * Close the preparation panel
   */
  public close(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.panelContainer = null;
    this.diningTabButton = null;
    this.inventoryTabButton = null;
    this.diningContent = null;
    this.inventoryContent = null;
    
    // Show the preparation button again when panel closes
    const buttonOverlay = document.getElementById('preparation-button-overlay');
    if (buttonOverlay) {
      buttonOverlay.style.display = 'block';
    }
    
    // Notify GameUI that panel was closed (not started battle)
    if (this.onClose) {
      this.onClose();
    }
  }

  /**
   * Create a tab button
   */
  private createTabButton(label: string, tab: 'dining' | 'inventory', active: boolean): HTMLElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.style.cssText = `
      flex: 1;
      padding: 16px;
      font-size: 16px;
      font-weight: bold;
      background: ${active ? 'white' : '#f5f5f5'};
      color: ${active ? '#667eea' : '#666'};
      border: none;
      border-bottom: ${active ? '3px solid #667eea' : '3px solid transparent'};
      cursor: pointer;
      transition: all 0.2s;
    `;
    button.addEventListener('mouseenter', () => {
      if (!active) {
        button.style.background = '#e8e8e8';
      }
    });
    button.addEventListener('mouseleave', () => {
      if (!active) {
        button.style.background = '#f5f5f5';
      }
    });
    button.addEventListener('click', () => this.switchTab(tab));
    return button;
  }

  /**
   * Switch between tabs
   */
  private switchTab(tab: 'dining' | 'inventory'): void {
    this.currentTab = tab;

    // Update tab button styles
    if (this.diningTabButton && this.inventoryTabButton) {
      if (tab === 'dining') {
        this.diningTabButton.style.background = 'white';
        this.diningTabButton.style.color = '#667eea';
        this.diningTabButton.style.borderBottom = '3px solid #667eea';
        this.inventoryTabButton.style.background = '#f5f5f5';
        this.inventoryTabButton.style.color = '#666';
        this.inventoryTabButton.style.borderBottom = '3px solid transparent';
      } else {
        this.inventoryTabButton.style.background = 'white';
        this.inventoryTabButton.style.color = '#667eea';
        this.inventoryTabButton.style.borderBottom = '3px solid #667eea';
        this.diningTabButton.style.background = '#f5f5f5';
        this.diningTabButton.style.color = '#666';
        this.diningTabButton.style.borderBottom = '3px solid transparent';
      }
    }

    // Update content visibility
    if (this.diningContent && this.inventoryContent) {
      if (tab === 'dining') {
        this.diningContent.style.display = 'block';
        this.inventoryContent.style.display = 'none';
        this.renderDiningPage();
      } else {
        this.diningContent.style.display = 'none';
        this.inventoryContent.style.display = 'block';
        this.renderInventoryPage();
      }
    }
  }

  /**
   * Get the Chinese display name for a job ID
   * @param jobId - The job ID (e.g., 'warrior', 'mage', 'none')
   * @returns The Chinese name (e.g., '战士', '魔法师', '无职业')
   */
  /**
   * Get the Chinese display name for a job ID
   * @param jobId The job ID (e.g., 'warrior', 'mage', 'berserker')
   * @returns The Chinese name (e.g., '战士', '魔法师', '无职业')
   */
  private getJobDisplayName(jobId: string | undefined | null): string {
    if (!jobId || jobId === '' || jobId === 'none' || jobId === '无') {
      return '无职业';
    }
    
    // Complete job name mapping - add new jobs here when adding to jobs.json
    const jobNames: { [key: string]: string } = {
      // Basic jobs
      'warrior': '战士',
      'mage': '魔法师',
      'ranger': '游侠',
      'priest': '牧师',
      // Advanced jobs
      'berserker': '狂战士',
      'guardian': '守卫',
      'elementalist': '元素师',
      'warlock': '咒术师',
      'hunter': '猎杀者',
      'dancer': '舞者',
      'divine_messenger': '神使',
      'dark_messenger': '邪使'
    };
    
    return jobNames[jobId] || jobId;
  }

  /**
   * Render dining page content
   */
  private renderDiningPage(): void {
    if (!this.diningContent) return;

    this.diningContent.innerHTML = '';

    // Create layout container with equal-width columns
    const layout = document.createElement('div');
    layout.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      height: 100%;
      align-items: start;
    `;

    // Left side: Party formation section
    const partySection = document.createElement('div');
    partySection.style.cssText = `
      display: flex;
      flex-direction: column;
      min-height: 500px;
      min-width: 0;
    `;
    
    // Header with title and auto-party button
    const headerContainer = document.createElement('div');
    headerContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    `;
    
    const partyTitle = document.createElement('h3');
    partyTitle.textContent = '👥 队伍成员';
    partyTitle.style.cssText = `
      margin: 0;
      color: #333;
      font-size: 16px;
    `;
    
    const autoPartyBtn = document.createElement('button');
    autoPartyBtn.textContent = '一键编队';
    autoPartyBtn.style.cssText = `
      padding: 6px 16px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    autoPartyBtn.addEventListener('mouseenter', () => {
      autoPartyBtn.style.background = '#5568d3';
    });
    autoPartyBtn.addEventListener('mouseleave', () => {
      autoPartyBtn.style.background = '#667eea';
    });
    autoPartyBtn.addEventListener('click', () => {
      this.autoFillParty();
    });
    
    headerContainer.appendChild(partyTitle);
    headerContainer.appendChild(autoPartyBtn);
    partySection.appendChild(headerContainer);

    // Create party slots container (2x2 grid)
    const partyGrid = document.createElement('div');
    partyGrid.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      width: 100%;
    `;

    // Create 4 party slots
    for (let i = 0; i < 4; i++) {
      const slot = this.createPartySlot(i);
      partyGrid.appendChild(slot);
    }

    partySection.appendChild(partyGrid);

    // Right side: Food items
    const foodSection = document.createElement('div');
    foodSection.style.cssText = `
      display: flex;
      flex-direction: column;
      min-height: 500px;
      min-width: 0;
    `;
    foodSection.innerHTML = '<h3 style="margin: 0 0 16px 0; color: #333;">🍚 可用菜肴</h3>';

    const foodGrid = document.createElement('div');
    foodGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 100px));
      gap: 12px;
      max-height: 400px;
      overflow-y: auto;
      flex: 1;
      justify-content: start;
      align-content: start;
    `;

    // Get all dish items from inventory (type === 'food' in ItemSystem database)
    const inventory = this.itemSystem.getInventory();
    const foodItems: Array<{ itemId: string; quantity: number; itemData: any }> = [];

    inventory.forEach((slot) => {
      // Use ItemSystem's database for type check (consistent with warehouse panel filtering)
      const itemDbData = this.itemSystem.getItem(slot.itemId);
      const uiData = this.itemsData.get(slot.itemId);
      if (itemDbData && itemDbData.type === 'food') {
        const displayData = { ...itemDbData, ...(uiData || {}) };
        foodItems.push({ itemId: slot.itemId, quantity: slot.quantity, itemData: displayData });
      }
    });

    if (foodItems.length === 0) {
      foodGrid.innerHTML = '<p style="color: #999; text-align: center; padding: 20px; grid-column: 1 / -1;">背包中没有菜肴</p>';
    } else {
      foodItems.forEach(({ itemId, quantity, itemData }) => {
        const foodCard = this.createFoodCard(itemId, quantity, itemData);
        foodGrid.appendChild(foodCard);
      });
    }

    foodSection.appendChild(foodGrid);

    layout.appendChild(partySection);
    layout.appendChild(foodSection);

    this.diningContent.appendChild(layout);
  }

  /**
   * Create a party slot for the preparation panel
   */
  private createPartySlot(slotIndex: number): HTMLDivElement {
    const slot = document.createElement('div');
    slot.className = 'prep-party-slot';
    slot.setAttribute('data-slot-index', slotIndex.toString());
    slot.style.cssText = `
      background: #f8f9fa;
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 8px;
      height: 140px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-sizing: border-box;
    `;
    
    const character = this.partySlots[slotIndex];
    
    if (character) {
      // Show character info
      this.renderCharacterInSlot(slot, character, slotIndex);
    } else {
      // Show empty slot
      slot.innerHTML = `
        <div style="text-align: center; color: #999;">
          <div style="font-size: 32px; margin-bottom: 8px;">➕</div>
          <div style="font-size: 12px;">点击添加角色</div>
        </div>
      `;
      
      slot.addEventListener('click', () => {
        this.showCharacterSelectionModal(slotIndex);
      });
    }
    
    slot.addEventListener('mouseenter', () => {
      if (!character) {
        slot.style.borderColor = '#667eea';
        slot.style.background = '#f0f4ff';
      }
    });
    
    slot.addEventListener('mouseleave', () => {
      if (!character) {
        slot.style.borderColor = '#ccc';
        slot.style.background = '#f8f9fa';
      }
    });
    
    return slot;
  }

  /**
   * Render character in party slot
   */
  private renderCharacterInSlot(slot: HTMLDivElement, character: any, slotIndex: number): void {
    slot.style.border = '2px solid #667eea';
    slot.style.background = 'white';
    slot.style.cursor = 'default';
    slot.style.overflow = 'auto';
    slot.style.padding = '6px';
    slot.innerHTML = '';
    
    // Get hunger component
    const hungerComponent = this.world.getComponent(character.id, HungerComponentType);
    const currentHunger = hungerComponent ? hungerComponent.current : 0;
    const maxHunger = hungerComponent ? hungerComponent.maximum : 100;
    const hungerPercent = maxHunger > 0 ? (currentHunger / maxHunger) * 100 : 0;

    // Calculate HP and MP percentages
    const hpPercent = character.maxHP > 0 ? (character.currentHP / character.maxHP) * 100 : 0;
    const mpPercent = character.maxMP > 0 ? (character.currentMP / character.maxMP) * 100 : 0;
    const expPercent = character.maxEXP > 0 ? ((character.currentEXP || 0) / character.maxEXP) * 100 : 0;

    // Create horizontal layout container
    const container = document.createElement('div');
    container.style.cssText = `
      width: 100%;
      display: flex;
      gap: 4px;
      align-items: flex-start;
      flex: 1;
      min-height: 0;
    `;

    // Left: Avatar (larger - doubled size)
    const avatar = document.createElement('div');
    avatar.style.cssText = `
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      flex-shrink: 0;
    `;
    
    if (character.emoji.includes('.png') || character.emoji.includes('.jpg')) {
      const avatarImg = document.createElement('img');
      avatarImg.src = character.emoji;
      avatarImg.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;
      avatar.appendChild(avatarImg);
    } else {
      avatar.textContent = character.emoji;
      avatar.style.fontSize = '36px';
    }

    // Right: Character info (more compact)
    const infoContainer = document.createElement('div');
    infoContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
      overflow: hidden;
    `;

    // Character name and level
    const nameDiv = document.createElement('div');
    nameDiv.textContent = character.title ? `${character.title}${character.name}` : character.name;
    nameDiv.style.cssText = `
      font-size: 10px;
      font-weight: bold;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

    const levelDiv = document.createElement('div');
    levelDiv.textContent = `Lv.${character.level} ${this.getJobDisplayName(character.job)}`;
    levelDiv.style.cssText = `
      font-size: 8px;
      color: #666;
      margin-bottom: 1px;
    `;

    // HP bar
    const hpBar = document.createElement('div');
    hpBar.style.cssText = 'display: flex; align-items: center; gap: 2px;';
    hpBar.innerHTML = `
      <span style="font-size: 8px; color: #666; min-width: 16px;">HP</span>
      <div style="flex: 1; background: #e0e0e0; height: 4px; border-radius: 2px; overflow: hidden;">
        <div style="width: ${hpPercent}%; height: 100%; background: linear-gradient(90deg, #4caf50 0%, #45a049 100%); transition: width 0.3s;"></div>
      </div>
      <span style="font-size: 7px; color: #666; min-width: 32px; text-align: right;">${formatNumber(character.currentHP)}/${formatNumber(character.maxHP)}</span>
    `;

    // MP bar
    const mpBar = document.createElement('div');
    mpBar.style.cssText = 'display: flex; align-items: center; gap: 2px;';
    mpBar.innerHTML = `
      <span style="font-size: 8px; color: #666; min-width: 16px;">MP</span>
      <div style="flex: 1; background: #e0e0e0; height: 4px; border-radius: 2px; overflow: hidden;">
        <div style="width: ${mpPercent}%; height: 100%; background: linear-gradient(90deg, #2196f3 0%, #1976d2 100%); transition: width 0.3s;"></div>
      </div>
      <span style="font-size: 7px; color: #666; min-width: 32px; text-align: right;">${formatNumber(character.currentMP)}/${formatNumber(character.maxMP)}</span>
    `;

    // EXP bar
    const expBar = document.createElement('div');
    expBar.style.cssText = 'display: flex; align-items: center; gap: 2px;';
    expBar.innerHTML = `
      <span style="font-size: 8px; color: #666; min-width: 16px;">EXP</span>
      <div style="flex: 1; background: #e0e0e0; height: 4px; border-radius: 2px; overflow: hidden;">
        <div style="width: ${expPercent}%; height: 100%; background: linear-gradient(90deg, #9c27b0 0%, #7b1fa2 100%); transition: width 0.3s;"></div>
      </div>
      <span style="font-size: 7px; color: #666; min-width: 32px; text-align: right;">${formatNumber(character.currentEXP || 0)}/${formatNumber(character.maxEXP)}</span>
    `;

    // Hunger bar
    const hungerBar = document.createElement('div');
    hungerBar.style.cssText = 'display: flex; align-items: center; gap: 2px;';
    hungerBar.innerHTML = `
      <span style="font-size: 8px; min-width: 16px;">🍚</span>
      <div style="flex: 1; background: #e0e0e0; height: 4px; border-radius: 2px; overflow: hidden;">
        <div style="width: ${hungerPercent}%; height: 100%; background: linear-gradient(90deg, #ff9800 0%, #ff5722 100%); transition: width 0.3s;"></div>
      </div>
      <span style="font-size: 7px; color: #666; min-width: 32px; text-align: right;">${formatNumber(currentHunger)}/${formatNumber(maxHunger)}</span>
    `;

    // Assemble info container
    infoContainer.appendChild(nameDiv);
    infoContainer.appendChild(levelDiv);
    infoContainer.appendChild(hpBar);
    infoContainer.appendChild(mpBar);
    infoContainer.appendChild(expBar);
    infoContainer.appendChild(hungerBar);

    // Assemble main container
    container.appendChild(avatar);
    container.appendChild(infoContainer);

    // Remove button (more compact)
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '移除';
    removeBtn.style.cssText = `
      margin-top: 3px;
      padding: 2px 8px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 3px;
      font-size: 9px;
      cursor: pointer;
      transition: all 0.2s;
      width: 100%;
      flex-shrink: 0;
    `;
    removeBtn.addEventListener('mouseenter', () => {
      removeBtn.style.background = '#c82333';
    });
    removeBtn.addEventListener('mouseleave', () => {
      removeBtn.style.background = '#dc3545';
    });
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeCharacterFromSlot(slotIndex);
    });

    slot.appendChild(container);
    slot.appendChild(removeBtn);
    
    // Add drag and drop support for feeding
    slot.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      slot.style.borderColor = '#4caf50';
      slot.style.background = '#f0fff4';
    });
    
    slot.addEventListener('dragleave', () => {
      slot.style.borderColor = '#667eea';
      slot.style.background = 'white';
    });
    
    slot.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      slot.style.borderColor = '#667eea';
      slot.style.background = 'white';
      
      if (e.dataTransfer) {
        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (data.itemId && data.itemData) {
            this.feedCharacter(character.id, data.itemId);
          }
        } catch (error) {
          console.error('Failed to parse drag data:', error);
        }
      }
    });
  }

  /**
   * Show character selection modal
   */
  private showCharacterSelectionModal(slotIndex: number): void {
    // Get all recruited characters
    const allCharacters = this.npcSystem.getRecruitedCharacters();
    
    // Filter out characters already in party
    const availableCharacters = allCharacters.filter(char => 
      !this.partySlots.some(slot => slot && slot.id === char.id)
    );

    if (availableCharacters.length === 0) {
      this.showNotification('没有可用的角色', 'warning');
      return;
    }

    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 600px;
      width: 90%;
      max-height: 70vh;
      overflow-y: auto;
      position: relative;
    `;

    // Title and close button container
    const headerContainer = document.createElement('div');
    headerContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    `;

    const title = document.createElement('h3');
    title.textContent = '选择角色';
    title.style.cssText = 'margin: 0; color: #333; font-size: 20px;';

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #ff5252;
      color: white;
      border: none;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    `;
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#ff1744';
      closeButton.style.transform = 'scale(1.1)';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#ff5252';
      closeButton.style.transform = 'scale(1)';
    });
    closeButton.addEventListener('click', () => {
      document.body.removeChild(modalOverlay);
    });

    headerContainer.appendChild(title);
    headerContainer.appendChild(closeButton);
    modalContent.appendChild(headerContainer);

    // Character grid
    const charGrid = document.createElement('div');
    charGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 16px;
    `;

    availableCharacters.forEach(char => {
      const charCard = document.createElement('div');
      charCard.style.cssText = `
        padding: 16px;
        background: #f9f9f9;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      `;
      charCard.addEventListener('mouseenter', () => {
        charCard.style.borderColor = '#667eea';
        charCard.style.background = '#f0f4ff';
        charCard.style.transform = 'translateY(-4px)';
        charCard.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
      });
      charCard.addEventListener('mouseleave', () => {
        charCard.style.borderColor = '#e0e0e0';
        charCard.style.background = '#f9f9f9';
        charCard.style.transform = 'translateY(0)';
        charCard.style.boxShadow = 'none';
      });
      charCard.addEventListener('click', () => {
        this.addCharacterToSlot(slotIndex, char);
        document.body.removeChild(modalOverlay);
      });

      // Avatar
      const avatar = document.createElement('div');
      avatar.style.cssText = `
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        margin-bottom: 12px;
      `;

      if (char.emoji.includes('.png') || char.emoji.includes('.jpg')) {
        const avatarImg = document.createElement('img');
        avatarImg.src = char.emoji;
        avatarImg.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
        `;
        avatar.appendChild(avatarImg);
      } else {
        avatar.textContent = char.emoji;
        avatar.style.fontSize = '40px';
      }

      // Character name
      const nameDiv = document.createElement('div');
      nameDiv.textContent = char.title ? `${char.title}${char.name}` : char.name;
      nameDiv.style.cssText = `
        font-size: 14px;
        font-weight: bold;
        color: #333;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
      `;

      // Level and job
      const levelDiv = document.createElement('div');
      levelDiv.textContent = `Lv.${char.level} ${this.getJobDisplayName(char.job)}`;
      levelDiv.style.cssText = `
        font-size: 12px;
        color: #666;
      `;

      charCard.appendChild(avatar);
      charCard.appendChild(nameDiv);
      charCard.appendChild(levelDiv);

      charGrid.appendChild(charCard);
    });

    modalContent.appendChild(charGrid);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        document.body.removeChild(modalOverlay);
      }
    });
  }

  /**
   * Add character to party slot
   */
  private addCharacterToSlot(slotIndex: number, character: any): void {
    this.partySlots[slotIndex] = character;
    this.showNotification(`${character.name} 已加入队伍`, 'success');
    this.renderDiningPage();
  }

  /**
   * Remove character from party slot
   */
  private removeCharacterFromSlot(slotIndex: number): void {
    const character = this.partySlots[slotIndex];
    if (character) {
      this.partySlots[slotIndex] = null;
      this.showNotification(`${character.name} 已离开队伍`, 'success');
      this.renderDiningPage();
    }
  }

  /**
   * Auto-fill party with available characters
   */
  private autoFillParty(): void {
    const allCharacters = this.npcSystem.getRecruitedCharacters();
    
    // Filter out characters already in party
    const availableCharacters = allCharacters.filter(char => 
      !this.partySlots.some(slot => slot && slot.id === char.id)
    );

    if (availableCharacters.length === 0) {
      this.showNotification('没有可用的角色', 'warning');
      return;
    }

    let addedCount = 0;
    for (let i = 0; i < this.partySlots.length; i++) {
      if (!this.partySlots[i] && availableCharacters.length > 0) {
        this.partySlots[i] = availableCharacters.shift()!;
        addedCount++;
      }
    }

    if (addedCount > 0) {
      this.showNotification(`已自动添加 ${addedCount} 个角色到队伍`, 'success');
      this.renderDiningPage();
    }
  }

  /**
   * Create a character card for dining page (now used for food selection)
   */
  private createCharacterCard(character: any): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = `
      padding: 12px;
      background: #f9f9f9;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    card.addEventListener('mouseenter', () => {
      card.style.borderColor = '#667eea';
      card.style.background = '#f0f0ff';
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = '#e0e0e0';
      card.style.background = '#f9f9f9';
    });

    // Get hunger component
    const hungerComponent = this.world.getComponent(character.id, HungerComponentType);
    const currentHunger = hungerComponent ? hungerComponent.current : 0;
    const maxHunger = hungerComponent ? hungerComponent.maximum : 100;
    const hungerPercent = maxHunger > 0 ? (currentHunger / maxHunger) * 100 : 0;

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
        <div style="font-weight: bold; color: #333;">${character.name}</div>
      </div>
      <div style="margin-bottom: 4px;">
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">🍚 饱腹度: ${formatNumber(currentHunger)}/${formatNumber(maxHunger)}</div>
        <div style="background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden;">
          <div style="
            width: ${hungerPercent}%;
            height: 100%;
            background: linear-gradient(90deg, #ff9800 0%, #ff5722 100%);
            transition: width 0.3s;
          "></div>
        </div>
      </div>
    `;

    // Store character ID for feeding
    card.setAttribute('data-character-id', character.id);

    return card;
  }

  /**
   * Create a food item card
   */
  private createFoodCard(itemId: string, quantity: number, itemData: any): HTMLElement {
    const card = document.createElement('div');
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-item-id', itemId);
    card.style.cssText = `
      width: 100px;
      height: 100px;
      padding: 8px;
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: grab;
      transition: all 0.2s;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    `;
    
    // Drag start event
    card.addEventListener('dragstart', (e: DragEvent) => {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', JSON.stringify({ itemId, itemData }));
        card.style.opacity = '0.5';
        card.style.cursor = 'grabbing';
      }
    });
    
    // Drag end event
    card.addEventListener('dragend', () => {
      card.style.opacity = '1';
      card.style.cursor = 'grab';
    });
    
    card.addEventListener('mouseenter', () => {
      card.style.borderColor = '#4caf50';
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = '#e0e0e0';
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
    });

    const effectsText = itemData.effects || `饱腹度+${itemData.hungerRestore || 0}`;
    const iconHtml = itemData.icon
      ? `<img src="${itemData.icon}" alt="${itemData.name}" style="width: 40px; height: 40px; object-fit: contain; margin-bottom: 4px;" onerror="this.outerHTML='<div style=\\'font-size:28px;margin-bottom:4px;\\'>🍲</div>'">`
      : `<div style="font-size: 28px; margin-bottom: 4px;">🍲</div>`;
    card.innerHTML = `
      ${iconHtml}
      <div style="font-size: 11px; font-weight: bold; color: #333; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">${itemData.name}</div>
      <div style="font-size: 9px; color: #4caf50; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">${effectsText}</div>
      <div style="font-size: 9px; color: #999;">x${quantity}</div>
    `;

    // Add click handler to feed character
    card.addEventListener('click', () => {
      this.selectFoodForFeeding(itemId, itemData);
    });

    return card;
  }

  /**
   * Select food item for feeding (prompts character selection)
   */
  private selectFoodForFeeding(itemId: string, itemData: any): void {
    // Highlight party slots for selection
    const partySlots = this.diningContent?.querySelectorAll('.prep-party-slot');
    if (!partySlots) return;

    // Show instruction
    this.showNotification(`请选择要喂食 ${itemData.name} 的角色`, 'success');

    // Add temporary click handlers to party slots with characters
    const clickHandlers: Array<{ element: Element; handler: () => void }> = [];

    partySlots.forEach(slotElement => {
      const slotIndex = parseInt((slotElement as HTMLElement).getAttribute('data-slot-index') || '0');
      const character = this.partySlots[slotIndex];
      
      if (!character) return; // Skip empty slots

      // Highlight slot
      (slotElement as HTMLElement).style.borderColor = '#4caf50';
      (slotElement as HTMLElement).style.background = '#f0fff0';
      (slotElement as HTMLElement).style.cursor = 'pointer';

      const handler = () => {
        this.feedCharacter(character.id, itemId);
        
        // Remove all temporary handlers and highlights
        clickHandlers.forEach(({ element, handler }) => {
          element.removeEventListener('click', handler);
          (element as HTMLElement).style.borderColor = '#667eea';
          (element as HTMLElement).style.background = 'white';
          (element as HTMLElement).style.cursor = 'default';
        });
      };

      slotElement.addEventListener('click', handler);
      clickHandlers.push({ element: slotElement, handler });
    });
  }

  /**
   * Feed a character with a food item
   */
  private feedCharacter(characterId: string, foodItemId: string): void {
    // Find character in party
    const character = this.partySlots.find(slot => slot && slot.id === characterId);
    if (!character) {
      this.showNotification('角色不在队伍中', 'error');
      return;
    }

    // Get hunger component
    const hungerComponent = this.world.getComponent(character.id, HungerComponentType);
    if (!hungerComponent) {
      this.showNotification('该角色没有饱腹度系统', 'error');
      return;
    }

    // Check if hunger is already at maximum
    if (hungerComponent.current >= hungerComponent.maximum) {
      this.showNotification('该角色饱腹度已满', 'warning');
      return;
    }

    // Get food item data (check both UI data and ItemSystem database)
    const foodData = this.itemsData.get(foodItemId) || this.itemSystem.getItem(foodItemId);
    if (!foodData || !foodData.hungerRestore) {
      this.showNotification('无效的食物', 'error');
      return;
    }

    // Check if player has the food item
    const foodQuantity = this.itemSystem.getItemQuantity(foodItemId);
    if (foodQuantity <= 0) {
      this.showNotification('背包中没有该食物', 'error');
      return;
    }

    // Calculate new hunger value (capped at maximum)
    const oldHunger = hungerComponent.current;
    const newHunger = Math.min(
      hungerComponent.current + foodData.hungerRestore,
      hungerComponent.maximum
    );

    // Update hunger component
    hungerComponent.current = newHunger;
    
    // Sync hunger value back to NPCData
    character.currentHunger = newHunger;

    // Remove food item from inventory
    this.itemSystem.removeItem(foodItemId, 1);

    // Show success notification
    const hungerGained = newHunger - oldHunger;
    this.showNotification(
      `${character.name} 食用了 ${foodData.name}，恢复了 ${formatNumber(hungerGained)} 点饱腹度`,
      'success'
    );

    // Notify hunger change for BUFF management
    if (this.onHungerChanged) {
      this.onHungerChanged(character.id, newHunger);
    }

    // Refresh dining page display
    this.renderDiningPage();
  }

  /**
   * Render inventory management page content
   */
  private renderInventoryPage(): void {
    if (!this.inventoryContent) return;

    this.inventoryContent.innerHTML = '';

    // Create layout container
    const layout = document.createElement('div');
    layout.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    `;

    // Left side: Team bag
    const teamBagSection = document.createElement('div');
    teamBagSection.innerHTML = '<h3 style="margin: 0 0 16px 0; color: #333;">🎒 团队背包</h3>';

    // Weight display
    const currentWeight = this.lootSystem.getTeamBagWeight();
    let maxWeight = 0;
    for (let i = 0; i < this.partySlots.length; i++) {
      const character = this.partySlots[i];
      if (character && character.carryWeight) {
        maxWeight += character.carryWeight;
      }
    }
    const weightPercent = maxWeight > 0 ? (currentWeight / maxWeight) * 100 : 0;

    const weightDisplay = document.createElement('div');
    weightDisplay.style.cssText = 'margin-bottom: 16px;';
    weightDisplay.innerHTML = `
      <div style="font-size: 14px; color: #666; margin-bottom: 4px;">负重: ${currentWeight}/${maxWeight}</div>
      <div style="background: #e0e0e0; height: 12px; border-radius: 6px; overflow: hidden;">
        <div style="
          width: ${weightPercent}%;
          height: 100%;
          background: linear-gradient(90deg, #4caf50 0%, ${weightPercent > 80 ? '#ff9800' : '#4caf50'} 50%, ${weightPercent > 90 ? '#f44336' : weightPercent > 80 ? '#ff9800' : '#4caf50'} 100%);
          transition: width 0.3s;
        "></div>
      </div>
    `;
    teamBagSection.appendChild(weightDisplay);

    // Team bag items grid
    const teamBagGrid = document.createElement('div');
    teamBagGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 12px;
      max-height: 350px;
      overflow-y: auto;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 8px;
    `;

    const teamBagInventory = this.lootSystem.getTeamBagInventory();
    if (teamBagInventory.size === 0) {
      teamBagGrid.innerHTML = '<p style="color: #999; text-align: center; padding: 20px; grid-column: 1 / -1;">团队背包为空</p>';
    } else {
      let hasItems = false;
      teamBagInventory.forEach((quantity, itemId) => {
        const itemData = this.itemsData.get(itemId);
        // Get item type from ItemSystem database for accurate filtering
        const itemDbData = this.itemSystem.getItem(itemId);
        // Only show food, consumable, and potion items
        if (itemData && itemDbData && (itemDbData.type === 'food' || itemDbData.type === 'consumable' || itemDbData.type === 'potion')) {
          const itemCard = this.createInventoryItemCard(itemId, quantity, itemData, 'teamBag');
          teamBagGrid.appendChild(itemCard);
          hasItems = true;
        }
      });
      if (!hasItems) {
        teamBagGrid.innerHTML = '<p style="color: #999; text-align: center; padding: 20px; grid-column: 1 / -1;">团队背包中没有可用物品</p>';
      }
    }

    teamBagSection.appendChild(teamBagGrid);

    // Right side: Main inventory
    const inventorySection = document.createElement('div');
    inventorySection.innerHTML = '<h3 style="margin: 0 0 16px 0; color: #333;">📦 仓库</h3>';

    const inventoryGrid = document.createElement('div');
    inventoryGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 12px;
      max-height: 400px;
      overflow-y: auto;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 8px;
    `;

    const mainInventory = this.itemSystem.getInventory();
    const inventoryItems: Array<{ itemId: string; quantity: number; itemData: any }> = [];

    mainInventory.forEach((slot) => {
      const itemData = this.itemsData.get(slot.itemId);
      // Get item type from ItemSystem database for accurate filtering
      const itemDbData = this.itemSystem.getItem(slot.itemId);
      // Only show food, consumable, and potion items
      if (itemData && itemDbData && (itemDbData.type === 'food' || itemDbData.type === 'consumable' || itemDbData.type === 'potion')) {
        inventoryItems.push({ itemId: slot.itemId, quantity: slot.quantity, itemData });
      }
    });

    if (inventoryItems.length === 0) {
      inventoryGrid.innerHTML = '<p style="color: #999; text-align: center; padding: 20px; grid-column: 1 / -1;">仓库中没有可用物品</p>';
    } else {
      inventoryItems.forEach(({ itemId, quantity, itemData }) => {
        const itemCard = this.createInventoryItemCard(itemId, quantity, itemData, 'inventory');
        inventoryGrid.appendChild(itemCard);
      });
    }

    inventorySection.appendChild(inventoryGrid);

    layout.appendChild(teamBagSection);
    layout.appendChild(inventorySection);

    this.inventoryContent.appendChild(layout);
  }

  /**
   * Create an inventory item card
   */
  private createInventoryItemCard(
    itemId: string,
    quantity: number,
    itemData: any,
    source: 'teamBag' | 'inventory'
  ): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = `
      padding: 8px;
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    `;
    card.addEventListener('mouseenter', () => {
      card.style.borderColor = source === 'teamBag' ? '#ff9800' : '#4caf50';
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = '#e0e0e0';
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
    });

    const itemWeight = itemData.weight || 0;
    
    // Display icon: use image if available, otherwise use emoji, fallback to 📦
    const iconHtml = itemData.icon
      ? `<img src="${itemData.icon}" alt="${itemData.name}" style="width: 32px; height: 32px; object-fit: contain; margin-bottom: 4px;" onerror="this.outerHTML='<div style=\\'font-size:24px;margin-bottom:4px;\\'>${itemData.emoji || '📦'}</div>'">`
      : `<div style="font-size: 24px; margin-bottom: 4px;">${itemData.emoji || '📦'}</div>`;

    card.innerHTML = `
      ${iconHtml}
      <div style="font-size: 10px; font-weight: bold; color: #333; margin-bottom: 2px; line-height: 1.2; word-wrap: break-word;">${itemData.name}</div>
      <div style="font-size: 11px; color: #999; margin-bottom: 2px;">x${quantity}</div>
      <div style="font-size: 10px; color: #666;">⚖️ ${itemWeight}</div>
    `;

    // Add click handler for transfer
    card.addEventListener('click', () => {
      if (source === 'teamBag') {
        this.transferFromTeamBag(itemId, 1);
      } else {
        this.transferToTeamBag(itemId, 1);
      }
    });

    return card;
  }

  /**
   * Transfer item to team bag
   */
  private transferToTeamBag(itemId: string, quantity: number): void {
    // Get item data
    const itemData = this.itemsData.get(itemId);
    if (!itemData) {
      this.showNotification('无效的物品', 'error');
      return;
    }

    // Check if player has the item
    const availableQuantity = this.itemSystem.getItemQuantity(itemId);
    if (availableQuantity < quantity) {
      this.showNotification('仓库中没有足够的物品', 'error');
      return;
    }

    // Check weight limit
    const itemWeight = itemData.weight || 0;
    const currentWeight = this.lootSystem.getTeamBagWeight();
    let maxWeight = 0;
    for (let i = 0; i < this.partySlots.length; i++) {
      const character = this.partySlots[i];
      if (character && character.carryWeight) {
        maxWeight += character.carryWeight;
      }
    }
    const totalWeight = itemWeight * quantity;

    if (currentWeight + totalWeight > maxWeight) {
      this.showNotification('团队背包负重已满，无法添加更多物品', 'warning');
      return;
    }

    // Transfer item
    this.lootSystem.addToTeamBag(itemId, quantity);
    this.itemSystem.removeItem(itemId, quantity);

    this.showNotification(`已将 ${itemData.name} x${quantity} 放入团队背包`, 'success');

    // Refresh inventory page
    this.renderInventoryPage();
  }

  /**
   * Transfer item from team bag
   */
  private transferFromTeamBag(itemId: string, quantity: number): void {
    // Get item data
    const itemData = this.itemsData.get(itemId);
    if (!itemData) {
      this.showNotification('无效的物品', 'error');
      return;
    }

    // Check if team bag has the item
    const teamBagInventory = this.lootSystem.getTeamBagInventory();
    const availableQuantity = teamBagInventory.get(itemId) || 0;
    if (availableQuantity < quantity) {
      this.showNotification('团队背包中没有足够的物品', 'error');
      return;
    }

    // Transfer item
    this.lootSystem.removeFromTeamBag(itemId, quantity);
    this.itemSystem.addItem(itemId, quantity);

    this.showNotification(`已将 ${itemData.name} x${quantity} 放回仓库`, 'success');

    // Refresh inventory page
    this.renderInventoryPage();
  }

  /**
   * Validate party before starting battle
   */
  private validateParty(): boolean {
    // Check if party has at least one character
    return this.partySlots.some(slot => slot !== null);
  }

  /**
   * Handle start battle button click
   */
  private handleStartBattle(): void {
    if (!this.validateParty()) {
      this.showNotification('编队中没有角色，无法开始探险', 'error');
      return;
    }

    // Close panel and start battle
    this.close();
    this.onStartBattle();
  }

  /**
   * Show notification message
   */
  private showNotification(message: string, type: 'success' | 'warning' | 'error'): void {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#4caf50'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      font-size: 16px;
      font-weight: bold;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}
