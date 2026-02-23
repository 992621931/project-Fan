// Script to update item types in items.json
const fs = require('fs');
const path = require('path');

// Read items.json
const itemsPath = path.join(__dirname, 'src/game/data/items.json');
const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));

// Define item type mappings
const materialItems = [
  'slime_sweet_pearl', 'sweet_syrup_gland', 'smooth_snake_skin', 'two_headed_snake_liver',
  'mystic_mushroom', 'grass_mushroom_worm_thin_wing', 'red_mane_fang', 'red_mane_fur',
  'oak_wood', 'copper_ore', 'lavender', 'bitter_root', 'bitter_juice', 'blue_spider_front_leg',
  'blue_cheese_ball', 'coarse_salt_block', 'salt_stone_crystal', 'iron_ore', 'burst_fruit',
  'corpse_potato', 'three_color_eyeball', 'fire_tongue_frog_leg', 'spicy_tongue',
  'twitching_vine_core', 'beating_gallbladder', 'night_vision_grass'
];

const foodItems = [
  'slime_qq_candy', 'sugar_pickled_snake_liver', 'fried_mushroom_slices', 'candied_mystic_mushroom',
  'two_headed_snake_skin_jelly', 'crispy_wing_snake_skin_roll', 'grassland_set_meal', 'bitter_ball',
  'suffocating_special_drink', 'steamed_spider_leg', 'braised_spider_leg', 'salty_concubine_candy',
  'dehydrated_compressed_biscuit', 'forest_set_meal', 'finger_fries', 'bile_noodles',
  'frog_leg_sashimi', 'dry_pot_eye_frog', 'charcoal_grilled_crispy_vine', 'explosive_double_crispy',
  'cave_set_meal'
];

// Update item types
let updatedCount = 0;
itemsData.items.forEach(item => {
  if (materialItems.includes(item.id)) {
    item.type = 'material';
    updatedCount++;
    console.log(`Updated ${item.name} (${item.id}) to type: material`);
  } else if (foodItems.includes(item.id)) {
    item.type = 'food';
    updatedCount++;
    console.log(`Updated ${item.name} (${item.id}) to type: food`);
  }
});

// Write back to file
fs.writeFileSync(itemsPath, JSON.stringify(itemsData, null, 2), 'utf8');
console.log(`\nTotal items updated: ${updatedCount}`);
console.log('items.json has been updated successfully!');
