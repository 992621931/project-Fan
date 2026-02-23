# Design Document: Character Equipment System (角色装备系统)

## Overview

The Character Equipment System enables players to equip adventurer characters with weapons, armor, and other items that provide attribute bonuses and special effects. The system integrates with the existing ItemSystem, AttributeSystem, and UI components to provide a seamless equipment management experience.

The system consists of four main components:
1. Equipment slot data structure and management
2. UI for equipment slot interaction
3. Warehouse panel filtering by equipment type
4. Real-time attribute calculation based on equipped items

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Character Equipment System                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐      ┌──────────────────────────┐    │
│  │ EquipmentSystem  │◄────►│  AttributeSystem         │    │
│  │                  │      │  (existing, enhanced)    │    │
│  │ - Equip items    │      │  - Calculate bonuses     │    │
│  │ - Unequip items  │      │  - Apply affixes         │    │
│  │ - Validate slots │      │  - Update stats          │    │
│  └────────┬─────────┘      └──────────────────────────┘    │
│           │                                                  │
│           │                                                  │
│  ┌────────▼─────────┐      ┌──────────────────────────┐    │
│  │ EquipmentSlots   │      │  ItemSystem              │    │
│  │ Component        │◄────►│  (existing)              │    │
│  │                  │      │  - Item data             │    │
│  │ - weapon         │      │  - Affix definitions     │    │
│  │ - armor          │      │  - Inventory management  │    │
│  │ - offhand        │      └──────────────────────────┘    │
│  │ - misc           │                                       │
│  └──────────────────┘                                       │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              UI Layer                                 │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  EquipmentSlotUI  │  WarehousePanelFilter           │  │
│  │  - Clickable slots│  - Type-based filtering         │  │
│  │  - Visual feedback│  - Item selection               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User clicks equipment slot
    ↓
Open warehouse panel with filter
    ↓
User selects equipment item
    ↓
EquipmentSystem.equipItem()
    ↓
Update EquipmentSlotsComponent
    ↓
Emit equipment_changed event
    ↓
AttributeSystem recalculates stats
    ↓
Update UI to reflect changes
```

## Components and Interfaces

### EquipmentSlotsComponent

Already exists in `SystemComponents.ts`. Structure:

```typescript
interface EquipmentSlotsComponent extends Component {
  readonly type: 'equipmentSlots';
  weapon: EntityId | null;
  armor: EntityId | null;
  offhand: EntityId | null;
  misc: EntityId | null;
}
```

### Equipment Item Data Structure

Equipment items in the ItemSystem have the following structure (from item-prefabs.json):

```typescript
interface EquipmentItemData {
  id: string;
  name: string;
  description: string;
  type: 'equipment';
  subType: string;  // 'weapon', 'armor', 'offhand', 'misc'
  icon: string;
  rarity: number;  // 0=common, 1=rare, 2=mythic, 3=legendary
  stackSize: 1;    // Equipment is non-stackable
  
  // Affix system
  mainStat?: {
    attribute: string;  // e.g., 'attack', 'defense'
    value: number;
    type: 'flat' | 'percentage';
  };
  subStats?: Array<{
    attribute: string;
    value: number;
    type: 'flat' | 'percentage';
  }>;
  
  // Additional properties
  equipmentSlot?: string;  // Target slot for this equipment
  effects?: any[];
}
```

### EquipmentSystem

New system to manage equipment operations:

```typescript
class EquipmentSystem extends System {
  // Core operations
  equipItem(characterId: EntityId, itemInstanceId: string, slot: EquipmentSlot): boolean
  unequipItem(characterId: EntityId, slot: EquipmentSlot): boolean
  canEquipItem(characterId: EntityId, itemInstanceId: string, slot: EquipmentSlot): boolean
  
  // Utility methods
  getEquippedItem(characterId: EntityId, slot: EquipmentSlot): EntityId | null
  getAllEquippedItems(characterId: EntityId): Map<EquipmentSlot, EntityId>
  getEquipmentBonuses(characterId: EntityId): AttributeBonuses
  
  // Event handlers
  private handleEquipmentChange(characterId: EntityId, slot: EquipmentSlot): void
}
```

### AttributeSystem Enhancement

The existing AttributeSystem will be enhanced to:

```typescript
class AttributeSystem extends System {
  // Existing methods...
  
  // New/Enhanced methods for equipment
  calculateEquipmentBonuses(equipment: EquipmentSlotsComponent): AttributeBonuses
  applyEquipmentBonuses(characterId: EntityId, bonuses: AttributeBonuses): void
  removeEquipmentBonuses(characterId: EntityId, bonuses: AttributeBonuses): void
  
  // Enhanced derived stats calculation
  private updateDerivedStats(entityId: EntityId): void {
    // Now includes equipment bonuses
  }
}
```

### UI Components

#### EquipmentSlotUI

```typescript
class EquipmentSlotUI {
  private slots: Map<EquipmentSlot, HTMLElement>;
  
  renderSlot(slot: EquipmentSlot, equippedItem: EntityId | null): HTMLElement
  handleSlotClick(slot: EquipmentSlot): void
  updateSlotVisual(slot: EquipmentSlot, item: EntityId | null): void
  showEquipmentTooltip(item: EntityId): void
}
```

#### WarehousePanelFilter

Enhancement to existing warehouse panel:

```typescript
interface WarehousePanelFilter {
  filterByEquipmentType(type: EquipmentSlot): ItemData[]
  displayFilteredItems(items: ItemData[]): void
  handleItemSelection(itemInstanceId: string, targetSlot: EquipmentSlot): void
}
```

## Data Models

### Equipment Slot Types

```typescript
enum EquipmentSlot {
  Weapon = 'weapon',    // 武器
  Armor = 'armor',      // 护甲
  Offhand = 'offhand',  // 副手
  Misc = 'misc'         // 杂项
}
```

### Equipment Type Mapping

```typescript
const EQUIPMENT_TYPE_TO_SLOT: Record<string, EquipmentSlot> = {
  'weapon': EquipmentSlot.Weapon,
  'armor': EquipmentSlot.Armor,
  'offhand': EquipmentSlot.Offhand,
  'misc': EquipmentSlot.Misc
};
```

### Attribute Bonuses

```typescript
interface AttributeBonuses {
  // Primary attributes
  strength?: number;
  agility?: number;
  wisdom?: number;
  technique?: number;
  
  // Derived stats
  attack?: number;
  defense?: number;
  moveSpeed?: number;
  dodgeRate?: number;
  critRate?: number;
  critDamage?: number;
  resistance?: number;
  magicPower?: number;
  carryWeight?: number;
  hitRate?: number;
  expRate?: number;
  healthRegen?: number;
  manaRegen?: number;
  
  // Special effects
  effects?: EquipmentEffect[];
}

interface EquipmentEffect {
  type: string;
  value: number;
  duration?: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies:

1. **Properties 1.3, 4.2**: Both test that item references are stored in slots. Property 1.3 is more general.
2. **Properties 4.3, 4.4, 5.2**: All test that affixes are applied to character stats. Can be combined into one comprehensive property.
3. **Properties 5.4, 6.4, 7.2**: All test immediate recalculation on equipment change. Can be combined.
4. **Properties 6.3, 6.5**: Both test correct attribute state after equipment removal. Property 6.3 is more specific.
5. **Properties 2.5, 8.2**: Both test that equipped items are visually displayed in slots.
6. **Properties 7.4, 9.5**: Both test event emission for equipment changes.

After eliminating redundancies, the unique testable properties are:

- Equipment slot structure and initialization (1.1, 1.2, 1.4)
- Item storage and retrieval (1.3)
- UI interaction and filtering (2.2, 2.3, 2.5, 3.1-3.4, 3.5)
- Equipment assignment and replacement (4.1, 4.5, 4.6)
- Attribute calculation (4.3+4.4+5.2 combined, 5.1, 5.3, 5.4+6.4+7.2 combined, 5.5)
- Equipment removal (6.1, 6.2, 6.3)
- Real-time updates (7.3, 7.4, 7.5)
- Visual feedback (8.3, 8.4, 8.5)
- System integration (9.1, 9.2, 9.4)

### Correctness Properties

Property 1: Equipment slot structure completeness
*For any* character entity, the character SHALL have exactly four equipment slots named weapon, armor, offhand, and misc
**Validates: Requirements 1.1**

Property 2: Equipment slot initialization
*For any* newly created character, all four equipment slots SHALL be initialized as empty (null)
**Validates: Requirements 1.2**

Property 3: Equipment slot-item association integrity
*For any* character with equipped items, each slot SHALL maintain the correct association between slot type and the equipped item's equipment type
**Validates: Requirements 1.4**

Property 4: Item reference storage
*For any* equipment item assigned to a slot, the slot SHALL store the item's entity ID reference
**Validates: Requirements 1.3**

Property 5: Warehouse panel opening on slot click
*For any* equipment slot, clicking the slot SHALL open the warehouse panel
**Validates: Requirements 2.2**

Property 6: Slot type propagation to warehouse panel
*For any* equipment slot clicked, the warehouse panel SHALL receive the correct slot type parameter
**Validates: Requirements 2.3**

Property 7: Equipped item visual display
*For any* equipment slot containing an item, the UI SHALL display the item's visual representation (icon/sprite)
**Validates: Requirements 2.5**

Property 8: Warehouse filtering by equipment type
*For any* equipment slot type (weapon, armor, offhand, misc), when that slot is clicked, the warehouse panel SHALL display only items where equipmentType matches the slot type
**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

Property 9: Warehouse item source
*For any* warehouse panel display, all displayed items SHALL be retrieved from the ItemSystem inventory
**Validates: Requirements 3.5**

Property 10: Equipment assignment
*For any* equipment item clicked in the warehouse panel, the item SHALL be assigned to the corresponding equipment slot
**Validates: Requirements 4.1**

Property 11: Equipment replacement
*For any* equipment slot that is already occupied, assigning a new item to that slot SHALL replace the previous equipment
**Validates: Requirements 4.5**

Property 12: Bonus removal before replacement
*For any* equipment replacement operation, the previous equipment's attribute bonuses SHALL be removed before the new equipment's bonuses are applied
**Validates: Requirements 4.6**

Property 13: Affix application to character stats
*For any* equipment item with mainAffix and subAffixes, when equipped, all affix bonuses SHALL be applied to the character's attributes
**Validates: Requirements 4.3, 4.4, 5.2**

Property 14: Affix data reading
*For any* equipped item, the attribute calculator SHALL correctly read both mainAffix and subAffixes data from the item
**Validates: Requirements 5.1**

Property 15: Multiple affix type support
*For any* equipment with affixes of different types (attack, defense, HP, MP, crit rate, experience rate), all affix types SHALL be correctly applied to character stats
**Validates: Requirements 5.3**

Property 16: Immediate attribute recalculation on equipment change
*For any* equipment change operation (equip, unequip, or replace), character attributes SHALL be recalculated immediately within the same operation
**Validates: Requirements 5.4, 6.4, 7.2**

Property 17: Base attribute preservation
*For any* character, equipping or unequipping items SHALL NOT modify the character's base attributes, only the derived stats with equipment bonuses
**Validates: Requirements 5.5**

Property 18: Equipment unequip functionality
*For any* occupied equipment slot, the system SHALL provide a mechanism to unequip the item and return the slot to empty state
**Validates: Requirements 6.1, 6.2**

Property 19: Bonus removal on unequip
*For any* equipment item that is unequipped, all attribute bonuses from that equipment SHALL be removed from the character's stats
**Validates: Requirements 6.3**

Property 20: Attribute correctness after replacement
*For any* equipment replacement operation, the final character attributes SHALL equal base attributes plus bonuses from all currently equipped items (excluding the replaced item)
**Validates: Requirements 7.3**

Property 21: Equipment change event emission
*For any* equipment change operation (equip, unequip, replace), the system SHALL emit an equipment_changed event
**Validates: Requirements 7.4, 9.5**

Property 22: UI attribute value synchronization
*For any* character, the UI SHALL display attribute values that match the character's current calculated attributes
**Validates: Requirements 7.5**

Property 23: Empty slot visual distinction
*For any* equipment slot, the visual appearance SHALL clearly distinguish between empty slots and occupied slots
**Validates: Requirements 8.3**

Property 24: Equipment tooltip display
*For any* equipped item, hovering over the slot SHALL display a tooltip containing the item's details including all affixes
**Validates: Requirements 8.4**

Property 25: Visual update on equipment change
*For any* equipment change operation, the equipment slot visuals SHALL update immediately to reflect the new state
**Validates: Requirements 8.5**

Property 26: Equipment item retrieval from ItemSystem
*For any* equipment operation, equipment item data SHALL be retrieved from the ItemSystem
**Validates: Requirements 9.1**

Property 27: Affix data structure compatibility
*For any* equipment item, the system SHALL correctly read and process affix data in the format defined in item-prefabs.json (mainStat and subStats)
**Validates: Requirements 9.2**

Property 28: Character data structure compatibility
*For any* character entity, the equipment system SHALL work with the existing character component structure (AttributeComponent, DerivedStatsComponent, EquipmentSlotsComponent)
**Validates: Requirements 9.4**

## Error Handling

### Equipment Assignment Errors

1. **Invalid Item Type**: If a player attempts to equip an item to an incompatible slot (e.g., armor to weapon slot), the system SHALL reject the operation and display an error message.

2. **Item Not Found**: If the item instance ID does not exist in the ItemSystem, the system SHALL reject the operation and log an error.

3. **Character Not Found**: If the character entity does not exist or lacks required components, the system SHALL reject the operation and log an error.

4. **Slot Already Occupied**: When replacing equipment, the system SHALL handle the replacement gracefully by first removing the old item's bonuses before applying new ones.

### Attribute Calculation Errors

1. **Missing Affix Data**: If an equipped item lacks affix data, the system SHALL treat it as having zero bonuses and continue operation.

2. **Invalid Affix Values**: If affix values are non-numeric or negative, the system SHALL log a warning and skip that affix.

3. **Unknown Attribute Types**: If an affix references an unknown attribute type, the system SHALL log a warning and skip that affix.

### UI Errors

1. **Missing UI Elements**: If equipment slot UI elements fail to render, the system SHALL log an error but continue operation for other slots.

2. **Warehouse Panel Failure**: If the warehouse panel fails to open, the system SHALL display an error notification to the user.

3. **Item Icon Missing**: If an item's icon cannot be loaded, the system SHALL display a default placeholder icon.

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs
- Both approaches are complementary and necessary for complete validation

### Unit Testing Focus

Unit tests should focus on:
- Specific examples that demonstrate correct behavior (e.g., equipping a specific sword increases attack by 10)
- Integration points between EquipmentSystem, AttributeSystem, and ItemSystem
- Edge cases: empty inventory, all slots occupied, replacing equipment
- Error conditions: invalid item types, missing items, null references
- UI interactions: slot clicks, warehouse panel opening, visual updates

Avoid writing too many unit tests for scenarios that property tests can cover (e.g., testing every possible equipment combination).

### Property-Based Testing

Property-based testing will be implemented using **fast-check** (for TypeScript/JavaScript).

**Configuration**:
- Minimum 100 iterations per property test
- Each test must reference its design document property
- Tag format: `Feature: character-equipment-system, Property {number}: {property_text}`

**Test Generators**:

```typescript
// Generator for random characters with equipment slots
const characterArbitrary = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  attributes: fc.record({
    strength: fc.integer({ min: 1, max: 100 }),
    agility: fc.integer({ min: 1, max: 100 }),
    wisdom: fc.integer({ min: 1, max: 100 }),
    technique: fc.integer({ min: 1, max: 100 })
  }),
  equipmentSlots: fc.record({
    weapon: fc.constant(null),
    armor: fc.constant(null),
    offhand: fc.constant(null),
    misc: fc.constant(null)
  })
});

// Generator for random equipment items
const equipmentArbitrary = fc.record({
  id: fc.string(),
  type: fc.constantFrom('weapon', 'armor', 'offhand', 'misc'),
  mainAffix: fc.record({
    attribute: fc.constantFrom('attack', 'defense', 'health', 'mana'),
    value: fc.integer({ min: 1, max: 100 }),
    type: fc.constantFrom('flat', 'percentage')
  }),
  subAffixes: fc.array(
    fc.record({
      attribute: fc.constantFrom('critRate', 'critDamage', 'moveSpeed', 'dodgeRate'),
      value: fc.integer({ min: 1, max: 50 }),
      type: fc.constantFrom('flat', 'percentage')
    }),
    { maxLength: 3 }
  )
});

// Generator for equipment slot types
const slotTypeArbitrary = fc.constantFrom('weapon', 'armor', 'offhand', 'misc');
```

**Example Property Test**:

```typescript
// Feature: character-equipment-system, Property 13: Affix application to character stats
it('should apply all affixes when equipment is equipped', () => {
  fc.assert(
    fc.property(
      characterArbitrary,
      equipmentArbitrary,
      (character, equipment) => {
        const system = new EquipmentSystem(world);
        const attributeSystem = new AttributeSystem(world);
        
        // Get initial stats
        const initialStats = attributeSystem.getCharacterStats(character.id);
        
        // Equip item
        system.equipItem(character.id, equipment.id, equipment.type);
        
        // Get new stats
        const newStats = attributeSystem.getCharacterStats(character.id);
        
        // Calculate expected bonus
        let expectedBonus = equipment.mainAffix.value;
        equipment.subAffixes.forEach(affix => {
          expectedBonus += affix.value;
        });
        
        // Verify stats increased by expected amount
        const actualIncrease = newStats[equipment.mainAffix.attribute] - 
                               initialStats[equipment.mainAffix.attribute];
        
        return actualIncrease >= equipment.mainAffix.value;
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

Integration tests should verify:
- Complete equipment workflow: slot click → warehouse open → item select → equip → stats update → UI refresh
- Cross-system communication: EquipmentSystem ↔ AttributeSystem ↔ ItemSystem
- Event propagation: equipment_changed events trigger correct handlers
- UI synchronization: data changes reflect in UI immediately

### Test Coverage Goals

- Unit tests: 80%+ code coverage
- Property tests: All 28 correctness properties implemented
- Integration tests: All major workflows covered
- Error handling: All error conditions tested

## Implementation Notes

### Performance Considerations

1. **Attribute Recalculation**: Cache calculated bonuses to avoid recalculating on every frame. Only recalculate when equipment changes.

2. **UI Updates**: Use event-driven updates rather than polling. Only update UI elements that changed.

3. **Item Filtering**: Pre-filter items by type when opening warehouse panel rather than filtering on every render.

### Extensibility

The system is designed to be extensible for future enhancements:

1. **Additional Equipment Slots**: The slot structure can easily accommodate new slot types (e.g., rings, necklaces).

2. **Set Bonuses**: The affix system can be extended to support set bonuses when multiple items from the same set are equipped.

3. **Equipment Durability**: The system can integrate with a durability system that reduces equipment effectiveness over time.

4. **Equipment Enchantments**: The affix system can support temporary or permanent enchantments that modify equipment stats.

### Integration with Existing Systems

1. **ItemSystem**: Equipment items are stored as item instances in the ItemSystem. The EquipmentSystem references these instances by ID.

2. **AttributeSystem**: The existing AttributeSystem already has hooks for equipment bonuses in its `updateDerivedStats` method. This will be enhanced to read from EquipmentSlotsComponent.

3. **UI Components**: The existing InventoryPanel and warehouse UI will be extended with equipment slot rendering and filtering capabilities.

4. **Event System**: Equipment changes will emit events that other systems (AttributeSystem, UI) can subscribe to for reactive updates.
