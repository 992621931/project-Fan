# Equipment Affix System - Manual Validation Guide

## Overview

This guide provides step-by-step instructions for manually validating the Equipment Affix System implementation. The validation covers three critical aspects:

1. **Affix Display Colors** - Verify affixes display with correct rarity colors
2. **Affix Value Ranges** - Verify affix values are reasonable and within expected ranges
3. **Save/Load Persistence** - Verify save/load preserves affixes correctly

## Prerequisites

Before starting validation, ensure:
- The game is built and running (`npm run build`)
- All affix system code is implemented
- The test validation page is accessible

## Validation Method 1: Automated Test Page

### Setup

1. Build the project:
   ```bash
   npm run build
   ```

2. Open the validation test page:
   ```bash
   test-affix-validation.html
   ```

### Test 1: Affix Display Colors

**Objective:** Verify that affixes display with the correct color outline matching their rarity tier.

**Steps:**
1. Click "Run Color Test" button
2. Observe the generated equipment items
3. Verify each affix displays with the correct color:
   - **Common affixes**: Gray (#9e9e9e)
   - **Rare affixes**: Blue (#2196F3)
   - **Epic affixes**: Purple (#9c27b0)
   - **Legendary affixes**: Orange (#ff9800)

**Expected Results:**
- ✓ All affixes display with colored text matching their rarity
- ✓ Color values match the expected hex codes
- ✓ Text shadow/outline is visible and enhances readability

**Pass Criteria:**
- All 4 rarity tiers display with correct colors
- No color mismatches reported
- Visual inspection confirms colors are distinct and appropriate

### Test 2: Affix Value Ranges

**Objective:** Verify that all generated affix values fall within their defined min/max ranges.

**Steps:**
1. Click "Run Range Test (100 samples)" button
2. Wait for test to complete (generates 100 affixes per rarity tier)
3. Review the results for range violations

**Expected Results:**
- ✓ 0 range violations across all rarity tiers
- ✓ Multiple unique affix types generated per tier
- ✓ Values respect decimal precision rules:
  - Integer stats (Strength, Agility, etc.) have no decimal places
  - Percentage stats (Crit Rate, etc.) have 0-1 decimal places
  - Regeneration stats have 1 decimal place

**Pass Criteria:**
- Zero range violations reported
- At least 10+ unique affix types per rarity tier
- All values are within documented ranges (see Requirements 1.2-1.5)

### Test 3: Save/Load Persistence

**Objective:** Verify that affixes are correctly saved and restored across game sessions.

**Steps:**
1. Click "Run Save/Load Test" button
2. Review the comparison between original and loaded affixes
3. Verify all fields match perfectly

**Expected Results:**
- ✓ All affix types match after load
- ✓ All affix rarities match after load
- ✓ All affix values match after load (within 0.001 tolerance)
- ✓ Percentage flags match after load

**Pass Criteria:**
- Perfect match for all test affixes
- No data corruption or loss
- All 4 rarity tiers preserve correctly

## Validation Method 2: In-Game Manual Testing

### Test 1: Visual Display Validation

**Steps:**
1. Start the game
2. Craft equipment of each rarity tier:
   - Common equipment (e.g., basic weapons)
   - Rare equipment
   - Epic equipment
   - Legendary equipment
3. Hover over each crafted item to view tooltip
4. Verify affix display in tooltip

**Verification Points:**
- [ ] Affix appears in equipment tooltip
- [ ] Affix text includes name and value
- [ ] Affix has colored outline matching rarity
- [ ] Colors are visually distinct:
  - [ ] Common = Gray
  - [ ] Rare = Blue
  - [ ] Epic = Purple
  - [ ] Legendary = Orange
- [ ] Percentage affixes show "%" symbol
- [ ] Decimal values show correct precision

### Test 2: Value Range Validation

**Steps:**
1. Craft 20+ pieces of equipment of each rarity
2. Record the affix values for each piece
3. Compare against expected ranges from requirements

**Common Affix Ranges (Requirements 1.2):**
- Strength: +1~5
- Agility: +1~5
- Wisdom: +1~5
- Skill: +1~5
- Attack: +1~5
- Defense: +1~3
- Crit Rate: +1~4%
- Crit Damage: +1~4%
- Dodge Rate: +1~4%
- Move Speed: +1~10
- Magic Power: +1~5
- Carry Weight: +5~10
- Resistance: +1~5
- Experience Rate: +1~5%
- HP Regen: +0.1~0.5
- MP Regen: +0.1~1.0
- Body Weight: +1~5
- Body Size: +1~5

**Rare Affix Ranges (Requirements 1.3):**
- All stats doubled from Common (except Carry Weight excluded)
- Example: Strength +1~10, Defense +1~6, etc.

**Epic Affix Ranges (Requirements 1.4):**
- All stats tripled from Common (except Carry Weight excluded)
- Example: Strength +1~15, Defense +1~9, etc.

**Legendary Affix Ranges (Requirements 1.5):**
- Higher minimums and maximums
- Example: Strength +5~20, Defense +3~12, etc.

**Verification Points:**
- [ ] All values fall within documented ranges
- [ ] No values exceed maximum
- [ ] No values below minimum
- [ ] Carry Weight only appears on Common equipment
- [ ] Integer stats have no decimals
- [ ] Percentage stats have 0-1 decimal places
- [ ] Regeneration stats have 1 decimal place

### Test 3: Save/Load Persistence Validation

**Steps:**
1. Start a new game
2. Craft several pieces of equipment with affixes
3. Record the affix details for each piece:
   - Equipment name
   - Affix type
   - Affix rarity
   - Affix value
4. Save the game
5. Close and restart the game
6. Load the saved game
7. Check each equipment piece and verify affixes match

**Verification Points:**
- [ ] All equipment pieces still have affixes
- [ ] Affix types match original
- [ ] Affix rarities match original
- [ ] Affix values match original (exact match)
- [ ] Affix colors still display correctly
- [ ] No affixes lost or corrupted
- [ ] Multiple save/load cycles preserve data

## Common Issues and Troubleshooting

### Issue: Affixes not displaying colors

**Possible Causes:**
- CSS styles not loaded
- Color mapping function missing rarity
- Rarity value incorrect

**Verification:**
- Check browser console for errors
- Verify `getAffixColorStyle()` function exists
- Confirm rarity enum values match

### Issue: Values out of range

**Possible Causes:**
- Incorrect affix definitions in JSON
- Random number generation bug
- Rounding errors

**Verification:**
- Check `affix-definitions.json` for correct min/max values
- Verify `generateAffixValue()` respects bounds
- Test decimal precision logic

### Issue: Affixes not persisting

**Possible Causes:**
- Serialization not implemented
- Save system not including affix field
- Deserialization failing silently

**Verification:**
- Check SaveSystem includes affix in equipment serialization
- Verify localStorage contains affix data
- Test error handling for corrupted data

## Validation Checklist

Use this checklist to track validation progress:

### Affix Display Colors
- [ ] Common affixes display in gray
- [ ] Rare affixes display in blue
- [ ] Epic affixes display in purple
- [ ] Legendary affixes display in orange
- [ ] Colors are visually distinct
- [ ] Text is readable with color outline

### Affix Value Ranges
- [ ] Common equipment affixes within range
- [ ] Rare equipment affixes within range
- [ ] Epic equipment affixes within range
- [ ] Legendary equipment affixes within range
- [ ] Carry Weight only on Common tier
- [ ] Integer stats have no decimals
- [ ] Percentage stats formatted correctly
- [ ] Regeneration stats have 1 decimal

### Save/Load Persistence
- [ ] Affixes save correctly
- [ ] Affixes load correctly
- [ ] Type preserved
- [ ] Rarity preserved
- [ ] Value preserved
- [ ] Multiple save/load cycles work
- [ ] Corrupted data handled gracefully

## Sign-Off

Once all validation points pass, the Equipment Affix System is ready for production.

**Validated By:** _________________

**Date:** _________________

**Notes:**
