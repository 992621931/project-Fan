# Design Document: Equipment Affix System

## Overview

The Equipment Affix System adds random secondary stat bonuses (affixes) to equipment when crafted. The system integrates with the existing EquipmentCraftingSystem and provides four rarity tiers of affixes (Common, Rare, Epic/Mythic, Legendary) with probability distributions based on equipment rarity. Each affix provides a stat bonus within a defined range, and affixes are displayed with colored text matching their rarity tier.

## Architecture

The system consists of three main components:

1. **AffixDefinitions**: Static data structure defining all available affixes organized by rarity tier
2. **AffixSelector**: Service responsible for selecting and generating affixes based on equipment rarity
3. **EquipmentCraftingSystem Integration**: Modification to assign affixes during equipment creation

The system follows a data-driven approach where affix definitions are loaded from configuration, and the selector uses weighted random selection to assign affixes based on equipment rarity.

## Components and Interfaces

### Affix Type Definition

```typescript
export enum AffixType {
  Strength = 'strength',
  Agility = 'agility',
  Wisdom = 'wisdom',
  Skill = 'skill',
  Attack = 'attack',
  Defense = 'defense',
  CritRate = 'critRate',
  CritDamage = 'critDamage',
  DodgeRate = 'dodgeRate',
  MoveSpeed = 'moveSpeed',
  MagicPower = 'magicPower',
  CarryWeight = 'carryWeight',
  Resistance = 'resistance',
  ExperienceRate = 'experienceRate',
  HPRegen = 'hpRegen',
  MPRegen = 'mpRegen',
  BodyWeight = 'bodyWeight',
  BodySize = 'bodySize'
}
```

### Affix Definition Interface

```typescript
export interface AffixDefinition {
  type: AffixType;
  rarity: RarityType;
  displayName: string;
  minValue: number;
  maxValue: number;
  isPercentage: boolean;
  decimalPlaces: number;
}
```

### Applied Affix Interface

```typescript
export interface AppliedAffix {
  type: AffixType;
  rarity: RarityType;
  displayName: string;
  value: number;
  isPercentage: boolean;
}
```

### Affix Pool Configuration

```typescript
export interface AffixPoolConfig {
  common: AffixDefinition[];
  rare: AffixDefinition[];
  epic: AffixDefinition[];
  legendary: AffixDefinition[];
}
```

### Probability Distribution Configuration

```typescript
export interface AffixProbabilityConfig {
  [RarityType.Common]: {
    [RarityType.Common]: number;    // 90%
    [RarityType.Rare]: number;      // 10%
  };
  [RarityType.Rare]: {
    [RarityType.Common]: number;    // 50%
    [RarityType.Rare]: number;      // 40%
    [RarityType.Epic]: number;      // 10%
  };
  [RarityType.Epic]: {
    [RarityType.Common]: number;    // 15%
    [RarityType.Rare]: number;      // 50%
    [RarityType.Epic]: number;      // 30%
    [RarityType.Legendary]: number; // 5%
  };
  [RarityType.Legendary]: {
    [RarityType.Common]: number;    // 5%
    [RarityType.Rare]: number;      // 15%
    [RarityType.Epic]: number;      // 50%
    [RarityType.Legendary]: number; // 30%
  };
}
```

### AffixSelector Service

```typescript
export class AffixSelector {
  private affixPool: AffixPoolConfig;
  private probabilityConfig: AffixProbabilityConfig;

  constructor(affixPool: AffixPoolConfig, probabilityConfig: AffixProbabilityConfig);
  
  /**
   * Select and generate an affix for equipment
   */
  selectAffix(equipmentRarity: RarityType): AppliedAffix;
  
  /**
   * Select affix rarity based on equipment rarity
   */
  private selectAffixRarity(equipmentRarity: RarityType): RarityType;
  
  /**
   * Select random affix from rarity tier
   */
  private selectAffixFromTier(affixRarity: RarityType): AffixDefinition;
  
  /**
   * Generate random value within affix range
   */
  private generateAffixValue(definition: AffixDefinition): number;
}
```

### Equipment Component Extension

The existing `EquipmentComponent` will be extended to include an optional affix field:

```typescript
export interface EquipmentComponent extends Component {
  readonly type: 'equipment';
  slot: EquipmentSlot;
  attributeModifiers: AttributeModifier[];
  requirements: EquipmentRequirement[];
  durability: number;
  maxDurability: number;
  affix?: AppliedAffix; // New field for affix
}
```

## Data Models

### Affix Definitions Data Structure

The affix pool will be defined in a JSON configuration file (`affix-definitions.json`):

```json
{
  "common": [
    {
      "type": "strength",
      "rarity": 0,
      "displayName": "普通大力",
      "minValue": 1,
      "maxValue": 5,
      "isPercentage": false,
      "decimalPlaces": 0
    },
    {
      "type": "critRate",
      "rarity": 0,
      "displayName": "普通致命",
      "minValue": 1,
      "maxValue": 4,
      "isPercentage": true,
      "decimalPlaces": 0
    }
    // ... all 18 common affixes
  ],
  "rare": [
    // ... 17 rare affixes (no carryWeight)
  ],
  "epic": [
    // ... 17 epic affixes (no carryWeight)
  ],
  "legendary": [
    // ... 17 legendary affixes (no carryWeight)
  ]
}
```

### Probability Distribution Data

The probability configuration will be defined in code as a constant:

```typescript
export const AFFIX_PROBABILITY_CONFIG: AffixProbabilityConfig = {
  [RarityType.Common]: {
    [RarityType.Common]: 0.90,
    [RarityType.Rare]: 0.10
  },
  [RarityType.Rare]: {
    [RarityType.Common]: 0.50,
    [RarityType.Rare]: 0.40,
    [RarityType.Epic]: 0.10
  },
  [RarityType.Epic]: {
    [RarityType.Common]: 0.15,
    [RarityType.Rare]: 0.50,
    [RarityType.Epic]: 0.30,
    [RarityType.Legendary]: 0.05
  },
  [RarityType.Legendary]: {
    [RarityType.Common]: 0.05,
    [RarityType.Rare]: 0.15,
    [RarityType.Epic]: 0.50,
    [RarityType.Legendary]: 0.30
  }
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, the following redundancies were identified:

- **3.5 is redundant with 3.1**: If a value is within [min, max], it inherently doesn't exceed max or fall below min
- **4.2 is covered by 2.1-2.4**: Testing correct probability distribution usage is already validated by the probability distribution properties
- **6.4 is redundant with 6.2**: Round-trip testing (save then load) inherently ensures data integrity
- **7.2-7.5 are redundant with 7.1**: These are specific instances of the general uniform distribution property

Additionally, **5.2-5.5 can be combined into 5.1**: Testing that each rarity uses its correct color is covered by the general property that affixes render with colors corresponding to their rarity.

### Correctness Properties

Property 1: Affix rarity probability distribution for Common equipment
*For any* large sample of affixes generated for Common equipment, approximately 90% should be Common rarity and 10% should be Rare rarity (within statistical bounds)
**Validates: Requirements 2.1**

Property 2: Affix rarity probability distribution for Rare equipment
*For any* large sample of affixes generated for Rare equipment, approximately 50% should be Common rarity, 40% should be Rare rarity, and 10% should be Epic rarity (within statistical bounds)
**Validates: Requirements 2.2**

Property 3: Affix rarity probability distribution for Epic equipment
*For any* large sample of affixes generated for Epic equipment, approximately 15% should be Common rarity, 50% should be Rare rarity, 30% should be Epic rarity, and 5% should be Legendary rarity (within statistical bounds)
**Validates: Requirements 2.3**

Property 4: Affix rarity probability distribution for Legendary equipment
*For any* large sample of affixes generated for Legendary equipment, approximately 5% should be Common rarity, 15% should be Rare rarity, 50% should be Epic rarity, and 30% should be Legendary rarity (within statistical bounds)
**Validates: Requirements 2.4**

Property 5: Affix value within range
*For any* affix definition and generated affix value, the value must be greater than or equal to the minimum and less than or equal to the maximum defined in the affix definition
**Validates: Requirements 3.1, 3.5**

Property 6: Integer affixes produce whole numbers
*For any* affix with decimalPlaces set to 0, the generated value must be a whole number (no fractional component)
**Validates: Requirements 3.2**

Property 7: Percentage and decimal affixes respect precision
*For any* affix with decimalPlaces set to 1, the generated value must have at most one decimal place
**Validates: Requirements 3.3, 3.4**

Property 8: Equipment receives exactly one affix
*For any* equipment successfully crafted, the equipment must have exactly one affix assigned
**Validates: Requirements 4.1**

Property 9: Affix assignment completes before equipment return
*For any* equipment crafted, when the crafting system returns the equipment, the affix must already be present
**Validates: Requirements 4.4**

Property 10: Affix display includes rarity color
*For any* affix rendered in the UI, the rendered HTML must include color styling that matches the affix's rarity tier color
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

Property 11: Affix display includes name and value
*For any* affix rendered in the UI, the rendered text must contain both the affix display name and the affix value
**Validates: Requirements 5.6**

Property 12: Affix serialization round-trip
*For any* equipment with an affix, serializing then deserializing the equipment must produce an equivalent affix (same type, rarity, and value)
**Validates: Requirements 6.1, 6.2, 6.4**

Property 13: Uniform affix type distribution within tier
*For any* rarity tier and large sample of affixes selected from that tier, each affix type within the tier should appear with approximately equal frequency (within statistical bounds)
**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

## Error Handling

### Affix Selection Errors

1. **Invalid Equipment Rarity**: If equipment rarity is not recognized, default to Common rarity probability distribution
2. **Empty Affix Pool**: If no affixes are available for a selected rarity tier, fall back to Common tier
3. **Configuration Loading Failure**: If affix definitions fail to load, log error and allow equipment crafting to continue without affixes

### Affix Assignment Errors

1. **Assignment Failure**: If affix assignment throws an exception, catch it, log the error, and return equipment without an affix
2. **Invalid Affix Data**: If generated affix has invalid values, discard and retry selection once; if retry fails, continue without affix

### Serialization Errors

1. **Invalid Save Data**: If affix data in save file is corrupted or invalid, load equipment without affix and log warning
2. **Missing Affix Definition**: If saved affix type no longer exists in definitions, load equipment without affix

### Display Errors

1. **Missing Rarity Color**: If rarity color is not found, use default gray color (#9e9e9e)
2. **Formatting Errors**: If value formatting fails, display raw numeric value

## Testing Strategy

The Equipment Affix System will be tested using a dual approach combining property-based testing and unit testing.

### Property-Based Testing

Property-based tests will validate universal correctness properties across randomized inputs using the fast-check library. Each property test will run a minimum of 100 iterations to ensure comprehensive coverage.

**Property Tests**:
- Probability distribution properties (Properties 1-4): Generate large samples (1000+ affixes) and verify distributions match expected probabilities within ±5% tolerance
- Value range property (Property 5): Generate random affix definitions and verify all generated values fall within defined ranges
- Integer precision property (Property 6): Generate random integer affixes and verify no fractional components
- Decimal precision property (Property 7): Generate random decimal affixes and verify at most 1 decimal place
- Equipment affix assignment property (Property 8): Generate random equipment and verify exactly one affix is assigned
- Affix timing property (Property 9): Verify affix is present when equipment is returned from crafting
- Display properties (Properties 10-11): Generate random affixes and verify rendered output contains correct color and text
- Serialization round-trip property (Property 12): Generate random equipment with affixes, serialize and deserialize, verify equivalence
- Uniform distribution property (Property 13): Generate large samples from each tier and verify uniform type distribution

**Test Configuration**:
- Minimum 100 iterations per property test
- Statistical tests use 1000+ samples with ±5% tolerance for probability validation
- Each test tagged with: **Feature: equipment-affix-system, Property {number}: {property_text}**

### Unit Testing

Unit tests will validate specific examples, edge cases, and integration points.

**Unit Test Coverage**:
- Affix pool loading and validation
- Specific affix definition values (Requirements 1.2-1.5)
- Carry Weight exclusion from higher tiers (Requirement 1.6)
- Probability configuration sum validation (Requirement 2.5)
- Error handling scenarios (Requirements 4.3, 6.3)
- Integration with EquipmentCraftingSystem
- UI rendering with specific affix examples
- Edge cases: minimum values, maximum values, boundary conditions

### Integration Testing

Integration tests will verify the system works correctly with existing game systems:
- Equipment crafting flow with affix assignment
- Save/load system with equipment affixes
- UI display in equipment tooltips and inventory
- Attribute system applying affix bonuses

### Test Data

Test data will include:
- Complete affix definition set matching requirements
- Sample equipment recipes of each rarity
- Mock save data with valid and invalid affix data
- Edge case values (min, max, boundary conditions)
