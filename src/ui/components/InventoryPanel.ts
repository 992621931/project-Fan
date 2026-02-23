/**
 * Inventory Panel - Inventory and equipment management interface
 * Displays items, equipment slots, and item management options
 */

import { BaseUIComponent } from '../BaseUIComponent';
import { UIManager } from '../UIManager';
import { EventSystem } from '../../ecs/EventSystem';
import { Entity, EntityId } from '../../ecs/Entity';
import { World } from '../../ecs/World';
import { 
  InventoryComponent, 
  EquipmentSlotsComponent,
  InventorySlot,
  InventoryComponentType,
  EquipmentSlotsComponentType
} from '../../game/components/SystemComponents';
import { 
  ItemComponent, 
  EquipmentComponent,
  ConsumableComponent,
  MaterialComponent,
  ItemComponentType,
  EquipmentComponentType,
  ConsumableComponentType,
  MaterialComponentType
} from '../../game/components/ItemComponents';
import { RarityType } from '../../game/types/RarityTypes';
import { ItemType, EquipmentSlot } from '../../game/types/GameTypes';

export class InventoryPanel extends BaseUIComponent {
  private world: World;
  private playerEntity: Entity | null = null;
  private selectedItem: EntityId | null = null;
  private inventoryGrid!: HTMLDivElement;
  private equipmentSlots!: HTMLDivElement;
  private itemDetails!: HTMLDivElement;
  private filterButtons!: HTMLDivElement;
  private currentFilter: ItemType | 'all' = 'all';

  constructor(uiManager: UIManager, eventSystem: EventSystem, world: World) {
    super('inventory-panel', uiManager, eventSystem);
    this.world = world;
  }

  protected createElement(): HTMLElement {
    const panel = this.createPanel('inventory-panel');
    panel.style.cssText = `
      top: 20px;
      right: 20px;
      width: 900px;
      height: 700px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    // Initialize the div elements here
    this.inventoryGrid = this.createElement_div();
    this.equipmentSlots = this.createElement_div();
    this.itemDetails = this.createElement_div();
    this.filterButtons = this.createElement_div();

    // Header
    const header = this.createElement_div('panel-header');
    const headerTitle = this.createElement_h2('', '背包与装备');
    const closeBtn = this.createButton('×', () => this.hide(), 'close-btn');
    header.appendChild(headerTitle);
    header.appendChild(closeBtn);
    
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    `;

    // Main content area
    const mainContent = this.createElement_div('main-content');
    mainContent.style.cssText = `
      display: flex;
      flex: 1;
      gap: 16px;
      min-height: 0;
    `;

    // Left side - Equipment slots
    const leftSide = this.createElement_div('left-side');
    leftSide.style.cssText = `
      width: 200px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    this.equipmentSlots.className = 'equipment-slots';
    this.equipmentSlots.style.cssText = `
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 16px;
    `;

    const equipmentTitle = this.createElement_h3('', '装备栏');
    leftSide.appendChild(equipmentTitle);
    leftSide.appendChild(this.equipmentSlots);

    // Center - Inventory grid
    const centerSide = this.createElement_div('center-side');
    centerSide.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    `;

    // Filter buttons
    this.filterButtons.className = 'filter-buttons';
    this.filterButtons.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    `;

    // Inventory grid
    this.inventoryGrid.className = 'inventory-grid';
    this.inventoryGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 4px;
      flex: 1;
      overflow-y: auto;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 16px;
      max-height: 400px;
    `;

    centerSide.appendChild(this.filterButtons);
    centerSide.appendChild(this.inventoryGrid);

    // Right side - Item details
    const rightSide = this.createElement_div('right-side');
    rightSide.style.cssText = `
      width: 250px;
      display: flex;
      flex-direction: column;
    `;

    this.itemDetails.className = 'item-details';
    this.itemDetails.style.cssText = `
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 16px;
      flex: 1;
      overflow-y: auto;
    `;

    const detailsTitle = this.createElement_h3('', '物品详情');
    rightSide.appendChild(detailsTitle);
    rightSide.appendChild(this.itemDetails);

    // Assemble the panel
    mainContent.appendChild(leftSide);
    mainContent.appendChild(centerSide);
    mainContent.appendChild(rightSide);

    panel.appendChild(header);
    panel.appendChild(mainContent);

    return panel;
  }

  public setPlayerEntity(player: Entity): void {
    this.playerEntity = player;
  }

  public render(): void {
    this.renderFilterButtons();
    this.renderEquipmentSlots();
    this.renderInventoryGrid();
    this.renderItemDetails();
  }

  private renderFilterButtons(): void {
    this.filterButtons.innerHTML = '';

    const filters = [
      { key: 'all', label: '全部' },
      { key: ItemType.Equipment, label: '装备' },
      { key: ItemType.Consumable, label: '消耗品' },
      { key: ItemType.Material, label: '材料' },
      { key: ItemType.Food, label: '食物' },
      { key: ItemType.Seed, label: '种子' }
    ];

    filters.forEach(filter => {
      const button = this.createButton(filter.label, () => {
        this.currentFilter = filter.key as ItemType | 'all';
        this.renderFilterButtons();
        this.renderInventoryGrid();
      });

      if (this.currentFilter === filter.key) {
        button.style.backgroundColor = this.uiManager.getTheme().colors.primary;
      } else {
        button.style.backgroundColor = 'rgba(255,255,255,0.1)';
      }

      this.filterButtons.appendChild(button);
    });
  }

  private renderEquipmentSlots(): void {
    this.equipmentSlots.innerHTML = '';

    if (!this.playerEntity) {
      this.equipmentSlots.appendChild(
        this.createElement_div('empty-state', '未找到玩家数据')
      );
      return;
    }

    const equipment = this.world.getComponent<EquipmentSlotsComponent>(this.playerEntity.id, EquipmentSlotsComponentType);
    
    const slots = [
      { key: 'weapon', label: '武器', icon: '⚔️' },
      { key: 'offhand', label: '副手', icon: '🛡️' },
      { key: 'armor', label: '护甲', icon: '👕' },
      { key: 'accessory', label: '饰品', icon: '💍' }
    ];

    slots.forEach(slot => {
      const slotElement = this.createElement_div('equipment-slot');
      slotElement.style.cssText = `
        width: 60px;
        height: 60px;
        border: 2px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      `;

      const equippedItem = equipment?.[slot.key as keyof EquipmentSlotsComponent] as EntityId | null;
      
      if (equippedItem) {
        const itemComponent = this.world.getComponent<ItemComponent>(equippedItem, ItemComponentType);
        if (itemComponent) {
          const iconDiv = this.createElement_div('item-icon', slot.icon);
          const nameDiv = this.createElement_div('item-name', itemComponent.name);
          nameDiv.style.cssText = 'font-size: 10px; text-align: center;';
          
          slotElement.appendChild(iconDiv);
          slotElement.appendChild(nameDiv);
          slotElement.style.borderColor = this.getRarityColor(itemComponent.rarity);
        }
      } else {
        const iconDiv = this.createElement_div('slot-icon', slot.icon);
        iconDiv.style.cssText = 'font-size: 24px; opacity: 0.3;';
        const labelDiv = this.createElement_div('slot-label', slot.label);
        labelDiv.style.cssText = 'font-size: 10px; opacity: 0.5;';
        
        slotElement.appendChild(iconDiv);
        slotElement.appendChild(labelDiv);
      }

      // Add hover effect
      slotElement.addEventListener('mouseenter', () => {
        slotElement.style.backgroundColor = 'rgba(255,255,255,0.1)';
      });

      slotElement.addEventListener('mouseleave', () => {
        slotElement.style.backgroundColor = 'transparent';
      });

      // Handle click to unequip
      slotElement.addEventListener('click', () => {
        const equippedItemId = equipment?.[slot.key as keyof EquipmentSlotsComponent] as EntityId | null;
        if (equippedItemId) {
          this.handleUnequipItem(slot.key as EquipmentSlot, new Entity(equippedItemId));
        }
      });

      this.equipmentSlots.appendChild(slotElement);
    });
  }

  private renderInventoryGrid(): void {
    this.inventoryGrid.innerHTML = '';

    if (!this.playerEntity) {
      this.inventoryGrid.appendChild(
        this.createElement_div('empty-state', '未找到玩家数据')
      );
      return;
    }

    const inventory = this.world.getComponent<InventoryComponent>(this.playerEntity.id, InventoryComponentType);
    
    if (!inventory) {
      this.inventoryGrid.appendChild(
        this.createElement_div('empty-state', '未找到背包数据')
      );
      return;
    }

    // Create inventory slots
    for (let i = 0; i < inventory.capacity; i++) {
      const slot = inventory.slots[i];
      if (slot) {
        const slotElement = this.createInventorySlot(slot, i);
        this.inventoryGrid.appendChild(slotElement);
      }
    }
  }

  private createInventorySlot(slot: InventorySlot, index: number): HTMLDivElement {
    const slotElement = this.createElement_div('inventory-slot');
    slotElement.style.cssText = `
      width: 60px;
      height: 60px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    `;

    if (slot && slot.item) {
      const itemComponent = this.world.getComponent<ItemComponent>(slot.item, ItemComponentType);
      if (itemComponent) {
        // Filter items based on current filter
        if (this.currentFilter !== 'all' && itemComponent.itemType !== this.currentFilter) {
          slotElement.style.display = 'none';
          return slotElement;
        }

        const iconDiv = this.createElement_div('item-icon', this.getItemIcon(itemComponent.itemType));
        const quantityDiv = this.createElement_div('item-quantity', slot.quantity.toString());
        quantityDiv.style.cssText = `
          position: absolute;
          bottom: 2px;
          right: 2px;
          font-size: 10px;
          background: rgba(0,0,0,0.7);
          padding: 1px 3px;
          border-radius: 2px;
        `;
        
        slotElement.appendChild(iconDiv);
        slotElement.appendChild(quantityDiv);
        slotElement.style.borderColor = this.getRarityColor(itemComponent.rarity);

        // Add hover effect
        slotElement.addEventListener('mouseenter', () => {
          slotElement.style.backgroundColor = 'rgba(255,255,255,0.1)';
          slotElement.style.transform = 'scale(1.05)';
        });

        slotElement.addEventListener('mouseleave', () => {
          slotElement.style.backgroundColor = 'transparent';
          slotElement.style.transform = 'scale(1)';
        });

        // Handle click to select item
        slotElement.addEventListener('click', () => {
          this.selectedItem = slot.item!;
          this.renderItemDetails();
          
          // Update visual selection
          this.inventoryGrid.querySelectorAll('.inventory-slot').forEach(el => {
            el.classList.remove('selected');
          });
          slotElement.classList.add('selected');
          slotElement.style.borderColor = this.uiManager.getTheme().colors.accent;
        });

        // Handle double-click to use/equip item
        slotElement.addEventListener('dblclick', () => {
          this.handleItemDoubleClick(new Entity(slot.item!), itemComponent);
        });
      }
    } else {
      const emptyDiv = this.createElement_div('', '空');
      emptyDiv.style.cssText = 'font-size: 12px; opacity: 0.3;';
      slotElement.appendChild(emptyDiv);
    }

    return slotElement;
  }

  private renderItemDetails(): void {
    this.itemDetails.innerHTML = '';

    if (!this.selectedItem) {
      this.itemDetails.appendChild(
        this.createElement_div('empty-state', '请选择一个物品查看详情')
      );
      return;
    }

    const itemComponent = this.world.getComponent<ItemComponent>(this.selectedItem, ItemComponentType);
    if (!itemComponent) return;

    // Item header
    const header = this.createElement_div('item-header');
    const iconDiv = this.createElement_div('item-icon', this.getItemIcon(itemComponent.itemType));
    iconDiv.style.cssText = 'font-size: 32px; margin-bottom: 8px;';
    
    const nameDiv = this.createElement_div(this.formatRarity(itemComponent.rarity), itemComponent.name);
    const typeDiv = this.createElement_div('item-type', this.getItemTypeName(itemComponent.itemType));
    const rarityDiv = this.createElement_div(`item-rarity ${this.formatRarity(itemComponent.rarity)}`, this.getRarityName(itemComponent.rarity));
    
    header.appendChild(iconDiv);
    header.appendChild(nameDiv);
    header.appendChild(typeDiv);
    header.appendChild(rarityDiv);

    // Item description
    const description = this.createElement_div('item-description');
    const descP = document.createElement('p');
    descP.style.cssText = 'margin: 12px 0; font-size: 12px; color: #b0b0b0; line-height: 1.4;';
    descP.textContent = itemComponent.description;
    description.appendChild(descP);

    // Item stats based on type
    const stats = this.createElement_div('item-stats');
    this.renderItemStats(stats, new Entity(this.selectedItem), itemComponent);

    // Action buttons
    const actions = this.createElement_div('item-actions');
    actions.style.cssText = `
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    this.renderItemActions(actions, new Entity(this.selectedItem), itemComponent);

    // Assemble details
    this.itemDetails.appendChild(header);
    this.itemDetails.appendChild(description);
    this.itemDetails.appendChild(stats);
    this.itemDetails.appendChild(actions);
  }

  private renderItemStats(container: HTMLDivElement, item: Entity, itemComponent: ItemComponent): void {
    // Equipment stats
    const equipment = this.world.getComponent<EquipmentComponent>(item.id, EquipmentComponentType);
    if (equipment) {
      const statsDiv = this.createElement_div('equipment-stats');
      const title = this.createElement_h3('', '装备属性');
      const statsList = this.createElement_div('stats-list');
      
      equipment.attributeModifiers.forEach(mod => {
        const statItem = this.createElement_div('stat-item');
        const nameSpan = this.createElement_span('', this.getAttributeName(mod.attribute));
        const valueSpan = this.createElement_span('text-success', `+${mod.value}${mod.type === 'percentage' ? '%' : ''}`);
        statItem.appendChild(nameSpan);
        statItem.appendChild(valueSpan);
        statsList.appendChild(statItem);
      });
      
      const durability = this.createElement_div('durability');
      durability.textContent = `耐久度: ${equipment.durability}/${equipment.maxDurability}`;
      
      statsDiv.appendChild(title);
      statsDiv.appendChild(statsList);
      statsDiv.appendChild(durability);
      container.appendChild(statsDiv);
    }

    // Consumable stats
    const consumable = this.world.getComponent<ConsumableComponent>(item.id, ConsumableComponentType);
    if (consumable) {
      const consumableDiv = this.createElement_div('consumable-stats');
      const title = this.createElement_h3('', '使用效果');
      const effectsList = this.createElement_div('effects-list');
      
      consumable.effects.forEach(effect => {
        const effectItem = this.createElement_div('effect-item');
        const nameSpan = this.createElement_span('', this.getEffectName(effect.type));
        const valueSpan = this.createElement_span('text-success', effect.value.toString());
        effectItem.appendChild(nameSpan);
        effectItem.appendChild(valueSpan);
        effectsList.appendChild(effectItem);
      });
      
      consumableDiv.appendChild(title);
      consumableDiv.appendChild(effectsList);
      
      if (consumable.charges > 0) {
        const charges = this.createElement_div('', `使用次数: ${consumable.charges}`);
        consumableDiv.appendChild(charges);
      }
      
      container.appendChild(consumableDiv);
    }

    // Material stats
    const material = this.world.getComponent<MaterialComponent>(item.id, MaterialComponentType);
    if (material) {
      const materialDiv = this.createElement_div('material-stats');
      const title = this.createElement_h3('', '材料属性');
      const materialInfo = this.createElement_div('material-info');
      
      const quality = this.createElement_div('', `品质: ${material.quality}/100`);
      const purity = this.createElement_div('', `纯度: ${material.purity}/100`);
      
      materialInfo.appendChild(quality);
      materialInfo.appendChild(purity);
      materialDiv.appendChild(title);
      materialDiv.appendChild(materialInfo);
      container.appendChild(materialDiv);
    }

    // Basic item info
    const basicInfo = this.createElement_div('basic-info');
    const value = this.createElement_div('item-value', `价值: ${this.formatCurrency(itemComponent.value)} 金币`);
    const quality = this.createElement_div('item-quality', `品质: ${itemComponent.quality}/100`);
    
    basicInfo.appendChild(value);
    basicInfo.appendChild(quality);
    container.appendChild(basicInfo);
  }

  private renderItemActions(container: HTMLDivElement, item: Entity, itemComponent: ItemComponent): void {
    // Equipment actions
    const equipment = this.world.getComponent<EquipmentComponent>(item.id, EquipmentComponentType);
    if (equipment) {
      const equipBtn = this.createButton('装备', () => {
        this.handleEquipItem(item, equipment);
      });
      container.appendChild(equipBtn);
    }

    // Consumable actions
    const consumable = this.world.getComponent<ConsumableComponent>(item.id, ConsumableComponentType);
    if (consumable) {
      const useBtn = this.createButton('使用', () => {
        this.handleUseItem(item, consumable);
      });
      container.appendChild(useBtn);
    }

    // Common actions
    const sellBtn = this.createButton('出售', () => {
      this.handleSellItem(item, itemComponent);
    });
    
    const dropBtn = this.createButton('丢弃', () => {
      this.handleDropItem(item, itemComponent);
    }, 'text-error');

    container.appendChild(sellBtn);
    container.appendChild(dropBtn);
  }

  private getItemIcon(itemType: ItemType): string {
    const icons: Record<ItemType, string> = {
      [ItemType.Equipment]: '⚔️',
      [ItemType.Consumable]: '🧪',
      [ItemType.Material]: '🔧',
      [ItemType.Food]: '🍖',
      [ItemType.Potion]: '🧪',
      [ItemType.Gem]: '💎',
      [ItemType.Seed]: '🌱',
      [ItemType.Tool]: '📦'
    };
    return icons[itemType] || '❓';
  }

  private getItemTypeName(itemType: ItemType): string {
    const names: Record<ItemType, string> = {
      [ItemType.Equipment]: '装备',
      [ItemType.Consumable]: '消耗品',
      [ItemType.Material]: '材料',
      [ItemType.Food]: '食物',
      [ItemType.Potion]: '药水',
      [ItemType.Gem]: '宝石',
      [ItemType.Seed]: '种子',
      [ItemType.Tool]: '工具'
    };
    return names[itemType] || '未知';
  }

  private getRarityName(rarity: RarityType): string {
    const names = ['普通', '稀有', '神话', '传说'];
    return names[rarity] || '未知';
  }

  private getRarityColor(rarity: RarityType): string {
    const colors = ['#ffffff', '#3498db', '#9b59b6', '#e67e22'];
    return colors[rarity] || '#ffffff';
  }

  private getAttributeName(attribute: string): string {
    const names: Record<string, string> = {
      'strength': '力量',
      'agility': '敏捷',
      'wisdom': '智慧',
      'technique': '技巧',
      'attack': '攻击力',
      'defense': '防御力',
      'health': '生命值',
      'mana': '魔法值'
    };
    return names[attribute] || attribute;
  }

  private getEffectName(effectType: string): string {
    const names: Record<string, string> = {
      'heal': '治疗',
      'buff': '增益',
      'debuff': '减益',
      'damage': '伤害',
      'restore': '恢复'
    };
    return names[effectType] || effectType;
  }

  private handleItemDoubleClick(item: Entity, itemComponent: ItemComponent): void {
    const equipment = this.world.getComponent<EquipmentComponent>(item.id, EquipmentComponentType);
    const consumable = this.world.getComponent<ConsumableComponent>(item.id, ConsumableComponentType);

    if (equipment) {
      this.handleEquipItem(item, equipment);
    } else if (consumable) {
      this.handleUseItem(item, consumable);
    }
  }

  private handleEquipItem(item: Entity, equipment: EquipmentComponent): void {
    this.eventSystem.emit({
      type: 'inventory:equip',
      timestamp: Date.now(),
      item: item.id,
      slot: equipment.slot
    });
    this.showNotification('装备已穿戴', 'success');
  }

  private handleUnequipItem(slot: EquipmentSlot, item: Entity): void {
    this.eventSystem.emit({
      type: 'inventory:unequip',
      timestamp: Date.now(),
      item: item.id,
      slot
    });
    this.showNotification('装备已卸下', 'success');
  }

  private handleUseItem(item: Entity, consumable: ConsumableComponent): void {
    this.eventSystem.emit({
      type: 'inventory:use',
      timestamp: Date.now(),
      item: item.id
    });
    this.showNotification('物品已使用', 'success');
  }

  private handleSellItem(item: Entity, itemComponent: ItemComponent): void {
    this.eventSystem.emit({
      type: 'inventory:sell',
      timestamp: Date.now(),
      item: item.id,
      value: itemComponent.value
    });
    this.showNotification(`出售 ${itemComponent.name}，获得 ${itemComponent.value} 金币`, 'success');
  }

  private handleDropItem(item: Entity, itemComponent: ItemComponent): void {
    if (confirm(`确定要丢弃 ${itemComponent.name} 吗？`)) {
      this.eventSystem.emit({
        type: 'inventory:drop',
        timestamp: Date.now(),
        item: item.id
      });
      this.showNotification(`已丢弃 ${itemComponent.name}`, 'warning');
    }
  }

  protected setupEventListeners(): void {
    this.eventSystem.on('inventory:updated', () => this.render());
    this.eventSystem.on('equipment:changed', () => this.render());
    this.eventSystem.on('item:added', () => this.render());
    this.eventSystem.on('item:removed', () => this.render());
  }
}