# EquipmentSlotUI Component Usage Guide

## Overview

The `EquipmentSlotUI` component provides a visual interface for managing character equipment slots. It displays 4 equipment slots (weapon, armor, offhand, accessory) with interactive features including click handlers, hover tooltips, and real-time visual updates.

## Features

### 1. Four Equipment Slots
- **Weapon** (武器) - ⚔️
- **Armor** (护甲) - 🛡️
- **Offhand** (副手) - 🗡️
- **Accessory** (饰品) - 💍

### 2. Visual Feedback
- **Empty slots**: Displayed with low opacity icons and "空" (empty) status
- **Occupied slots**: Displayed with full opacity icons and "已装备" (equipped) status
- **Hover effects**: Slots highlight and shift slightly on hover
- **Color coding**: 
  - Empty slots: White border with low opacity
  - Occupied slots: Green border with higher opacity

### 3. Interactive Tooltips
- **Empty slots**: Shows slot name and instruction to click to open warehouse
- **Occupied slots**: Shows:
  - Item name with rarity color
  - Item description
  - Main stat (mainStat) with gold color
  - Sub stats (subStats) with light blue color
  - Instruction to click to change equipment

### 4. Click Handlers
- Clicking any slot emits an `equipment:slot_clicked` event with:
  - `characterId`: The character entity ID
  - `slot`: The slot type (weapon, armor, offhand, accessory)
  - `slotLabel`: The Chinese label for the slot

### 5. Real-time Updates
- Listens for `equipment_changed` events
- Automatically updates slot visuals when equipment changes
- Updates only the affected slot for performance

## Usage Example

```typescript
import { EquipmentSlotUI } from './ui/components/EquipmentSlotUI';
import { UIManager } from './ui/UIManager';
import { EventSystem } from './ecs/EventSystem';
import { World } from './ecs/World';
import { ItemSystem } from './game/systems/ItemSystem';

// Create instances
const world = new World();
const eventSystem = new EventSystem();
const uiManager = new UIManager(eventSystem);
const itemSystem = new ItemSystem(world);

// Create EquipmentSlotUI
const equipmentSlotUI = new EquipmentSlotUI(
  uiManager,
  eventSystem,
  world,
  itemSystem
);

// Set the character to display equipment for
const characterId = 123; // Your character entity ID
equipmentSlotUI.setCharacter(characterId);

// Show the component
equipmentSlotUI.show();

// Listen for slot clicks
eventSystem.on('equipment:slot_clicked', (data) => {
  console.log(`Slot clicked: ${data.slot} for character ${data.characterId}`);
  // Open warehouse panel filtered by slot type
  openWarehousePanel(data.characterId, data.slot);
});
```

## Integration with Warehouse Panel

When a slot is clicked, you should:

1. Listen for the `equipment:slot_clicked` event
2. Open the warehouse panel
3. Filter items by the slot type
4. Allow the user to select an item
5. Call `EquipmentSystem.equipItem()` with the selected item

Example:

```typescript
eventSystem.on('equipment:slot_clicked', (data) => {
  // Open warehouse panel
  const warehousePanel = uiManager.getComponent('warehouse-panel');
  
  // Filter by equipment type
  warehousePanel.filterBySlot(data.slot);
  
  // Show the panel
  warehousePanel.show();
  
  // Handle item selection
  warehousePanel.onItemSelected((itemInstanceId) => {
    equipmentSystem.equipItem(data.characterId, itemInstanceId, data.slot);
    warehousePanel.hide();
  });
});
```

## Styling

The component uses inline styles for maximum portability. Key style features:

- **Container**: Dark background with rounded corners
- **Slots**: Flex layout with icon and info sections
- **Hover**: Smooth transitions with transform and color changes
- **Tooltip**: Fixed position, dark background, positioned near cursor

## Requirements Satisfied

This component satisfies the following requirements from the design document:

- **Requirement 2.1**: Renders all four equipment slots as clickable UI elements
- **Requirement 2.5**: Displays item's visual representation in occupied slots
- **Requirement 8.1**: Shows placeholder/empty state for empty slots
- **Requirement 8.2**: Displays item icon/sprite for occupied slots
- **Requirement 8.3**: Visually distinguishes empty vs occupied slots
- **Requirement 8.4**: Shows tooltips with item details and affixes on hover
- **Requirement 8.5**: Updates slot visuals immediately on equipment change

## Testing

Unit tests are provided in `EquipmentSlotUI.test.ts` covering:

- Rendering all 4 slots
- Empty state display
- Error state display
- Visual distinction between empty and occupied slots
- Slot visual updates on equipment change
- Click event emission
- Tooltip show/hide behavior

Run tests with:
```bash
npm test -- src/ui/components/EquipmentSlotUI.test.ts --run
```
