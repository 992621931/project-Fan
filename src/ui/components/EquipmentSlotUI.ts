/**
 * Equipment Slot UI - Equipment slot management interface
 * Displays 4 clickable equipment slots with visual feedback and tooltips
 */

import { BaseUIComponent } from '../BaseUIComponent';
import { UIManager } from '../UIManager';
import { EventSystem, createEvent } from '../../ecs/EventSystem';
import { EntityId } from '../../ecs/Entity';
import { World } from '../../ecs/World';
import { EquipmentSlotsComponent, EquipmentSlotsComponentType } from '../../game/components/SystemComponents';
import { EquipmentSlot } from '../../game/systems/EquipmentSystem';
import { ItemSystem } from '../../game/systems/ItemSystem';

/**
 * Equipment slot configuration
 */
interface SlotConfig {
  key: EquipmentSlot;
  label: string;
  icon: string;
  emptyIcon: string;
}

/**
 * Equipment Slot UI Component
 * Manages the visual representation and interaction of equipment slots
 */
export class EquipmentSlotUI extends BaseUIComponent {
  private world: World;
  private itemSystem: ItemSystem;
  private characterId: EntityId | null = null;
  private slotsContainer!: HTMLDivElement;
  private slotElements: Map<EquipmentSlot, HTMLDivElement> = new Map();
  private tooltipElement: HTMLDivElement | null = null;
  private loadingOverlay: HTMLDivElement | null = null;

  // Equipment slot configurations
  private readonly slotConfigs: SlotConfig[] = [
    { key: 'weapon', label: '武器', icon: '⚔️', emptyIcon: '⚔️' },
    { key: 'armor', label: '护甲', icon: '🛡️', emptyIcon: '🛡️' },
    { key: 'offhand', label: '副手', icon: '🗡️', emptyIcon: '🗡️' },
    { key: 'accessory', label: '饰品', icon: '💍', emptyIcon: '💍' }
  ];

  constructor(uiManager: UIManager, eventSystem: EventSystem, world: World, itemSystem: ItemSystem) {
    super('equipment-slot-ui', uiManager, eventSystem);
    this.world = world;
    this.itemSystem = itemSystem;
  }

  /**
   * Set the character whose equipment to display
   */
  public setCharacter(characterId: EntityId): void {
    this.characterId = characterId;
    this.render();
  }

  protected createElement(): HTMLElement {
    const container = this.createElement_div('equipment-slot-ui-container');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      min-width: 200px;
    `;

    // Title
    const title = this.createElement_h3('equipment-title', '装备栏');
    title.style.cssText = `
      margin: 0 0 12px 0;
      font-size: 16px;
      color: #ffffff;
      text-align: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      padding-bottom: 8px;
    `;

    // Slots container
    this.slotsContainer = this.createElement_div('equipment-slots-container');
    this.slotsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    container.appendChild(title);
    container.appendChild(this.slotsContainer);

    // Create tooltip element
    this.createTooltip();

    return container;
  }

  public render(): void {
    this.slotsContainer.innerHTML = '';
    this.slotElements.clear();

    if (!this.characterId) {
      const emptyState = this.createElement_div('empty-state', '请选择角色');
      emptyState.style.cssText = `
        text-align: center;
        padding: 20px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 14px;
      `;
      this.slotsContainer.appendChild(emptyState);
      return;
    }

    // Get equipment slots component
    const equipmentSlots = this.world.getComponent<EquipmentSlotsComponent>(
      this.characterId,
      EquipmentSlotsComponentType
    );

    if (!equipmentSlots) {
      const errorState = this.createElement_div('error-state', '角色无装备栏');
      errorState.style.cssText = `
        text-align: center;
        padding: 20px;
        color: rgba(255, 100, 100, 0.8);
        font-size: 14px;
      `;
      this.slotsContainer.appendChild(errorState);
      return;
    }

    // Render each equipment slot
    this.slotConfigs.forEach(config => {
      const slotElement = this.createSlotElement(config, equipmentSlots);
      this.slotElements.set(config.key, slotElement);
      this.slotsContainer.appendChild(slotElement);
    });
  }

  /**
   * Create a single equipment slot element
   */
  private createSlotElement(config: SlotConfig, equipmentSlots: EquipmentSlotsComponent): HTMLDivElement {
    const slotElement = this.createElement_div('equipment-slot');
    slotElement.dataset.slot = config.key;

    // Get equipped item
    const equippedItemId = equipmentSlots[config.key];
    const isOccupied = equippedItemId !== null;

    // Base slot styling
    slotElement.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: ${isOccupied ? 'rgba(100, 200, 100, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
      border: 2px solid ${isOccupied ? 'rgba(100, 200, 100, 0.4)' : 'rgba(255, 255, 255, 0.2)'};
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    `;

    // Icon container
    const iconContainer = this.createElement_div('slot-icon-container');
    iconContainer.style.cssText = `
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 6px;
      flex-shrink: 0;
    `;

    // Set icon based on equipped state
    if (isOccupied) {
      iconContainer.textContent = config.icon;
      iconContainer.style.opacity = '1';
    } else {
      iconContainer.textContent = config.emptyIcon;
      iconContainer.style.opacity = '0.3';
    }

    // Info container
    const infoContainer = this.createElement_div('slot-info-container');
    infoContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    // Slot label
    const labelElement = this.createElement_div('slot-label', config.label);
    labelElement.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      color: #ffffff;
    `;

    // Slot status
    const statusElement = this.createElement_div('slot-status');
    statusElement.style.cssText = `
      font-size: 12px;
      color: ${isOccupied ? 'rgba(100, 255, 100, 0.8)' : 'rgba(255, 255, 255, 0.5)'};
    `;
    statusElement.textContent = isOccupied ? '已装备' : '空';

    infoContainer.appendChild(labelElement);
    infoContainer.appendChild(statusElement);

    slotElement.appendChild(iconContainer);
    slotElement.appendChild(infoContainer);

    // Add hover effects
    this.addSlotHoverEffects(slotElement, config, equippedItemId);

    // Add click handler
    this.addSlotClickHandler(slotElement, config);

    return slotElement;
  }

  /**
   * Add hover effects to a slot element
   */
  private addSlotHoverEffects(
    slotElement: HTMLDivElement,
    config: SlotConfig,
    equippedItemId: EntityId | null
  ): void {
    slotElement.addEventListener('mouseenter', (event) => {
      // Enhanced visual feedback with animation
      slotElement.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
      slotElement.style.borderColor = 'rgba(255, 255, 255, 0.5)';
      slotElement.style.transform = 'translateX(4px) scale(1.02)';
      slotElement.style.boxShadow = '0 4px 12px rgba(100, 200, 255, 0.3)';

      // Show tooltip
      this.showTooltip(event, config, equippedItemId);
    });

    slotElement.addEventListener('mouseleave', () => {
      // Reset visual feedback with smooth transition
      const isOccupied = equippedItemId !== null;
      slotElement.style.backgroundColor = isOccupied 
        ? 'rgba(100, 200, 100, 0.1)' 
        : 'rgba(255, 255, 255, 0.05)';
      slotElement.style.borderColor = isOccupied 
        ? 'rgba(100, 200, 100, 0.4)' 
        : 'rgba(255, 255, 255, 0.2)';
      slotElement.style.transform = 'translateX(0) scale(1)';
      slotElement.style.boxShadow = 'none';

      // Hide tooltip
      this.hideTooltip();
    });
  }

  /**
   * Add click handler to a slot element
   */
  private addSlotClickHandler(slotElement: HTMLDivElement, config: SlotConfig): void {
    slotElement.addEventListener('click', () => {
      if (!this.characterId) return;

      // Add click animation
      slotElement.style.transform = 'translateX(4px) scale(0.95)';
      setTimeout(() => {
        slotElement.style.transform = 'translateX(4px) scale(1.02)';
      }, 100);

      // Emit event to open warehouse panel with slot filter
      this.eventSystem.emit(createEvent({
        type: 'equipment:slot_clicked',
        characterId: this.characterId,
        slot: config.key,
        slotLabel: config.label
      }));

      console.log(`[EquipmentSlotUI] Clicked ${config.label} slot`);
    });
  }

  /**
   * Create tooltip element
   */
  private createTooltip(): void {
    this.tooltipElement = this.createElement_div('equipment-tooltip');
    this.tooltipElement.style.cssText = `
      position: fixed;
      background: linear-gradient(135deg, rgba(20, 20, 40, 0.98) 0%, rgba(40, 40, 60, 0.98) 100%);
      border: 2px solid rgba(100, 200, 255, 0.5);
      border-radius: 8px;
      padding: 16px;
      color: #ffffff;
      font-size: 12px;
      pointer-events: none;
      z-index: 10000;
      display: none;
      max-width: 320px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7), 0 0 40px rgba(100, 200, 255, 0.2);
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    `;
    document.body.appendChild(this.tooltipElement);
  }

  /**
   * Show tooltip with equipment information
   */
  private showTooltip(event: MouseEvent, config: SlotConfig, equippedItemId: EntityId | null): void {
    if (!this.tooltipElement) return;

    // Build tooltip content
    let tooltipContent = `<div style="font-weight: bold; margin-bottom: 8px; color: #ffd700; font-size: 14px;">${config.label}</div>`;

    if (equippedItemId) {
      // Get item details from ItemSystem
      const itemInstanceId = equippedItemId as unknown as string;
      const itemInstances = this.itemSystem.getAllItemInstances();
      const itemInstance = itemInstances.find(inst => inst.instanceId === itemInstanceId);
      
      if (itemInstance) {
        const itemData = this.itemSystem.getItem(itemInstance.itemId);
        
        if (itemData) {
          // Item name with rarity color
          const rarityColor = this.getRarityColor(itemData.rarity);
          tooltipContent += `<div style="color: ${rarityColor}; font-weight: bold; margin-bottom: 4px;">${itemData.name}</div>`;
          
          // Item description
          if (itemData.description) {
            tooltipContent += `<div style="color: rgba(255,255,255,0.7); font-size: 11px; margin-bottom: 8px; line-height: 1.4;">${itemData.description}</div>`;
          }
          
          // Affixes section
          if (itemData.mainStat || (itemData.subStats && itemData.subStats.length > 0)) {
            tooltipContent += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">`;
            tooltipContent += `<div style="color: #90EE90; font-weight: bold; margin-bottom: 4px;">属性加成:</div>`;
            
            // Main stat
            if (itemData.mainStat) {
              const statValue = itemData.mainStat.type === 'percentage' 
                ? `+${itemData.mainStat.value}%` 
                : `+${itemData.mainStat.value}`;
              tooltipContent += `<div style="color: #FFD700; margin-left: 8px;">• ${this.getAttributeName(itemData.mainStat.attribute)}: ${statValue}</div>`;
            }
            
            // Sub stats
            if (itemData.subStats && itemData.subStats.length > 0) {
              itemData.subStats.forEach((stat: any) => {
                const statValue = stat.type === 'percentage' 
                  ? `+${stat.value}%` 
                  : `+${stat.value}`;
                tooltipContent += `<div style="color: #87CEEB; margin-left: 8px;">• ${this.getAttributeName(stat.attribute)}: ${statValue}</div>`;
              });
            }
            
            tooltipContent += `</div>`;
          }
        }
      }
      
      tooltipContent += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); color: rgba(100,200,255,0.8); font-size: 11px; font-style: italic;">💡 点击打开仓库更换装备</div>`;
    } else {
      tooltipContent += `<div style="color: rgba(255,255,255,0.6);">当前未装备</div>`;
      tooltipContent += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); color: rgba(100,200,255,0.8); font-size: 11px; font-style: italic;">💡 点击打开仓库选择装备</div>`;
    }

    this.tooltipElement.innerHTML = tooltipContent;
    this.tooltipElement.style.display = 'block';

    // Position tooltip near cursor
    const x = event.clientX + 15;
    const y = event.clientY + 15;
    
    this.tooltipElement.style.left = `${x}px`;
    this.tooltipElement.style.top = `${y}px`;

    // Animate tooltip in
    setTimeout(() => {
      if (this.tooltipElement) {
        this.tooltipElement.style.opacity = '1';
        this.tooltipElement.style.transform = 'translateY(0)';
      }
    }, 10);
  }

  /**
   * Hide tooltip
   */
  private hideTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.style.opacity = '0';
      this.tooltipElement.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (this.tooltipElement) {
          this.tooltipElement.style.display = 'none';
        }
      }, 200);
    }
  }

  /**
   * Get attribute display name in Chinese
   */
  private getAttributeName(attribute: string): string {
    const attributeNames: Record<string, string> = {
      'attack': '攻击力',
      'defense': '防御力',
      'health': '生命值',
      'mana': '魔法值',
      'strength': '力量',
      'agility': '敏捷',
      'wisdom': '智慧',
      'technique': '技巧',
      'critRate': '暴击率',
      'critDamage': '暴击伤害',
      'dodgeRate': '闪避率',
      'moveSpeed': '移动速度',
      'expRate': '经验加成',
      'hitRate': '命中率',
      'resistance': '抗性',
      'magicPower': '魔法强度'
    };
    return attributeNames[attribute] || attribute;
  }

  /**
   * Get rarity color
   */
  private getRarityColor(rarity: number): string {
    const rarityColors = [
      '#ffffff',  // Common - white
      '#3498db',  // Rare - blue
      '#9b59b6',  // Mythic - purple
      '#e67e22'   // Legendary - orange
    ];
    return rarityColors[rarity] || '#ffffff';
  }

  /**
   * Update a specific slot's visual state
   */
  public updateSlotVisual(slot: EquipmentSlot): void {
    if (!this.characterId) return;

    const equipmentSlots = this.world.getComponent<EquipmentSlotsComponent>(
      this.characterId,
      EquipmentSlotsComponentType
    );

    if (!equipmentSlots) return;

    const config = this.slotConfigs.find(c => c.key === slot);
    if (!config) return;

    const slotElement = this.slotElements.get(slot);
    if (!slotElement) return;

    // Add equipment change animation
    slotElement.style.transition = 'all 0.3s ease';
    slotElement.style.opacity = '0';
    slotElement.style.transform = 'scale(0.9)';

    setTimeout(() => {
      // Remove old element and create new one
      const newSlotElement = this.createSlotElement(config, equipmentSlots);
      newSlotElement.style.opacity = '0';
      newSlotElement.style.transform = 'scale(0.9)';
      newSlotElement.style.transition = 'all 0.3s ease';
      
      slotElement.replaceWith(newSlotElement);
      this.slotElements.set(slot, newSlotElement);

      // Animate in
      setTimeout(() => {
        newSlotElement.style.opacity = '1';
        newSlotElement.style.transform = 'scale(1)';
      }, 50);
    }, 150);
  }

  protected setupEventListeners(): void {
    // Listen for equipment changes to update visuals
    this.eventSystem.on('equipment_changed', (data: any) => {
      if (data.characterId === this.characterId) {
        this.updateSlotVisual(data.slot);
      }
    });
  }

  /**
   * Show loading overlay
   */
  private showLoadingOverlay(): void {
    if (!this.loadingOverlay) {
      this.loadingOverlay = this.createElement_div('equipment-loading-overlay');
      this.loadingOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        z-index: 100;
        opacity: 0;
        transition: opacity 0.2s ease;
      `;
      
      const spinner = this.createElement_div('loading-spinner', '⚙️');
      spinner.style.cssText = `
        font-size: 32px;
        animation: spin 1s linear infinite;
      `;
      
      this.loadingOverlay.appendChild(spinner);
      
      // Add CSS animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    if (this.element && !this.loadingOverlay.parentElement) {
      this.element.style.position = 'relative';
      this.element.appendChild(this.loadingOverlay);
    }
    
    setTimeout(() => {
      if (this.loadingOverlay) {
        this.loadingOverlay.style.opacity = '1';
      }
    }, 10);
  }

  /**
   * Hide loading overlay
   */
  private hideLoadingOverlay(): void {
    if (this.loadingOverlay) {
      this.loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        if (this.loadingOverlay && this.loadingOverlay.parentElement) {
          this.loadingOverlay.parentElement.removeChild(this.loadingOverlay);
        }
      }, 200);
    }
  }

  protected onDestroy(): void {
    // Clean up tooltip
    if (this.tooltipElement && this.tooltipElement.parentNode) {
      this.tooltipElement.parentNode.removeChild(this.tooltipElement);
    }
    
    // Clean up loading overlay
    if (this.loadingOverlay && this.loadingOverlay.parentNode) {
      this.loadingOverlay.parentNode.removeChild(this.loadingOverlay);
    }
  }
}
