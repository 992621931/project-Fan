/**
 * Game UI - Main UI controller that manages all UI components
 * Coordinates between different UI panels and handles UI state
 */

import { UIManager } from './UIManager';
import { EventSystem } from '../ecs/EventSystem';
import { World } from '../ecs/World';
import { CharacterPanel } from './components/CharacterPanel';
import { InventoryPanel } from './components/InventoryPanel';
import { ExplorationPanel } from './components/ExplorationPanel';
import { CraftingPanel } from './components/CraftingPanel';
import { FarmingPanel } from './components/FarmingPanel';
import { Entity } from '../ecs/Entity';
import { NPCSystem, NPCData } from '../game/systems/NPCSystem';
import { CurrencySystem } from '../game/systems/CurrencySystem';
import { ItemSystem } from '../game/systems/ItemSystem';
import { NPCCard } from './components/NPCCard';
import { QuestTracker } from './components/QuestTracker';
import { PreparationPanel } from './components/PreparationPanel';
import { BattleSystem } from '../game/systems/BattleSystem';
import { EnemySystem } from '../game/systems/EnemySystem';
import { LootSystem } from '../game/systems/LootSystem';
import { CardSystem } from '../game/systems/CardSystem';
import { ResourceNodeSystem } from '../game/systems/ResourceNodeSystem';
import { CookingSystem } from '../game/systems/CookingSystem';
import { EquipmentCraftingSystem } from '../game/systems/EquipmentCraftingSystem';
import { AlchemyCraftingSystem } from '../game/systems/AlchemyCraftingSystem';
import { EquipmentSystem } from '../game/systems/EquipmentSystem';
import { AffixSelector } from '../game/systems/AffixSelector';
import { formatNumber, formatPercentage } from '../utils/NumberFormatter';
import { BuffSystem } from '../game/systems/BuffSystem';
import { AffinitySystem } from '../game/systems/AffinitySystem';
import { DialogueSystem } from '../game/systems/DialogueSystem';
import { DialogueModal } from './components/DialogueModal';
import { AffixPoolConfig, AFFIX_PROBABILITY_CONFIG } from '../game/types/AffixTypes';
import { getRarityColor, getRarityDisplayName } from '../game/types/RarityTypes';
import { formatAffixDisplay, formatAffixDisplayWithRange, getAffixColorStyle, normalizeAffixes } from '../game/utils/AffixFormatter';
import { HungerComponentType } from '../game/components/CharacterComponents';
import { ATTRIBUTE_ICONS } from '../game/types/AttributeIcons';
import { ConfigManager } from '../game/config/ConfigManager';
import { OtherworldCharacterConfig } from '../game/config/ConfigTypes';
import { CharacterStatus } from '../game/types/GameTypes';
import {
  CharacterInfoComponentType,
  AttributeComponentType,
  DerivedStatsComponentType,
  HealthComponentType,
  ManaComponentType,
  LevelComponentType,
  JobComponentType,
  AffinityComponentType
} from '../game/components/CharacterComponents';
import { EquipmentSlotsComponentType } from '../game/components/SystemComponents';
import { QuestDefinition, QuestState, QuestSaveData, QuestObjectiveType } from '../game/data/quest-types';
import { SaveSystem } from '../ecs/SaveSystem';

/**
 * Debounce utility function to limit the rate at which a function can fire
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns A debounced version of the function
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = window.setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

export class GameUI {
  private uiManager: UIManager;
  private eventSystem: EventSystem;
  private world: World;
  private playerEntity: Entity | null = null;

  // UI Components
  private characterPanel: CharacterPanel;
  private inventoryPanel: InventoryPanel;
  private explorationPanel: ExplorationPanel;
  private craftingPanel: CraftingPanel;
  private farmingPanel: FarmingPanel;
  private mainHUD: HTMLDivElement;
  private currentScene: string = 'square'; // 当前场景
  private sceneContainer: HTMLDivElement | null = null; // 场景容器
  private npcSystem: NPCSystem;
  private currencySystem: CurrencySystem;
  private itemSystem: ItemSystem;
  private unlockedStages: Set<string> = new Set(['village']); // 已解锁的关卡
  private currentStage: string = 'village'; // 当前关卡
  
  // Stage type definitions
  private readonly COMBAT_STAGES = new Set(['grassland', 'forest', 'cave']); // 战斗关卡：草原、森林、洞穴
  private readonly NON_COMBAT_STAGES = new Set(['village']); // 非战斗关卡：村庄
  
  /**
   * Check if a stage is a combat stage
   * @param stage - Stage ID to check
   * @returns true if the stage is a combat stage (grassland, forest, cave)
   */
  private isCombatStage(stage: string): boolean {
    return this.COMBAT_STAGES.has(stage);
  }
  
  /**
   * Check if a stage is a non-combat stage
   * @param stage - Stage ID to check
   * @returns true if the stage is a non-combat stage (village)
   */
  private isNonCombatStage(stage: string): boolean {
    return this.NON_COMBAT_STAGES.has(stage);
  }
  
  /**
   * Check if the current stage is a combat stage
   * @returns true if currently in a combat stage
   */
  private isCurrentStageCombat(): boolean {
    return this.isCombatStage(this.currentStage);
  }
  
  private partySlots: (any | null)[] = [null, null, null, null]; // 编队槽位（4个）
  private workSlots: (any | null)[] = [null, null, null, null]; // 工作槽位（4个）
  private workSlotTasks: Map<number, { recipe: any; type: string; startTime: number; duration: number; intervalId: number }> = new Map(); // 工作槽位制作任务
  private injuredCharacters: Map<string, { reviveTime: number; intervalId: number }> = new Map(); // 重伤角色的复活时间和倒计时定时器
  private villageChiefCard: NPCCard | null = null; // 村长NPC卡片引用
  private npcCardInstances: Map<string, NPCCard> = new Map(); // 存储所有NPC卡片实例，用于更新显示
  private questTracker: QuestTracker | null = null; // 主线任务追踪器
  private battleSystem: BattleSystem; // 战斗系统
  private battleSceneContainer: HTMLElement | null = null; // 战斗场景容器
  private partyUpdateInterval: number | null = null; // 编队槽位更新定时器
  private hungerDecayInterval: number | null = null; // 饱腹度衰减定时器
  private dayNightInterval: number | null = null; // 昼夜循环定时器
  private dayNightProgress: number = 0; // 昼夜进度 (0-100)
  private isDaytime: boolean = true; // 当前是否为白天
  private timeDependentBonusesApplied: Map<string, { attribute: string; value: number; type: string }[]> = new Map(); // 时间依赖被动技能已应用的加成
  private currentDayOfWeek: number = 0; // 当前星期几 (0=周一, 1=周二, ..., 6=周日)
  private enemySystem: EnemySystem; // 敌人系统
  private lootSystem: LootSystem; // 战利品系统
  private cardSystem: CardSystem; // 卡牌系统
  private resourceNodeSystem: ResourceNodeSystem; // 资源点系统
  private cookingSystem: CookingSystem; // 烹饪系统
  private equipmentCraftingSystem: EquipmentCraftingSystem; // 装备制作系统
  private alchemyCraftingSystem: AlchemyCraftingSystem; // 炼金制作系统
  private equipmentSystem: EquipmentSystem; // 装备系统
  private buffSystem: BuffSystem; // BUFF系统
  private affinitySystem: AffinitySystem; // 好感度系统
  private dialogueSystem: DialogueSystem; // 对话系统
  private dialogueModal: DialogueModal | null = null; // 对话模态框
  private affixSelector: AffixSelector | null = null; // 副词条选择器
  private itemsData: Map<string, any> = new Map(); // 物品数据映射
  private equippedItemsTracker: Map<string, string> = new Map(); // 跟踪装备状态：itemInstanceId -> characterId
  private savedActionPanelContent: string = ''; // 保存操作面板的原始内容
  private preparationPanel: PreparationPanel | null = null; // 战斗准备面板
  private battlePaused: boolean = false; // 战斗暂停状态
  private merchantInventories: Map<string, { item: any; price: number; stock: number; affix?: any }[]> = new Map(); // 商人库存缓存
  private merchantRefreshCounts: Map<string, number> = new Map(); // 商人刷新次数 (merchantId -> remaining refreshes)
  private playerStallItems: Map<number, { itemId: string; quantity: number }>= new Map(); // 玩家摊位商品 (slotIndex -> item data)
  private isStallOpen: boolean = false; // 摊位开关状态
  private stallStatusIndicator: HTMLElement | null = null; // 摊位状态指示器元素
  
  // Wandering adventurer system
  private adventurerSpawnTimer: number | null = null; // Timer for spawning adventurers
  private wanderingAdventurers: HTMLElement[] = []; // Track active adventurer elements
  
  // First-time tutorial hint flags
  private hasShownLootDropHint: boolean = false;
  private hasShownLootPanelHint: boolean = false;
  private hasShownTeamBagHint: boolean = false;
  
  // Warehouse item filter and pagination state
  private currentFilter: string = 'all'; // Current filter type
  private currentPage: number = 0; // Current page index (0-based)
  private currentColumns: number = 4; // Current grid columns, default 4
  private currentItemsPerPage: number = 16; // Current items per page, dynamically calculated (4 columns × 4 rows)
  private resizeObserver: ResizeObserver | null = null; // Responsive observer
  
  // Currently displayed character in action panel
  private currentDisplayedCharacterId: string | null = null; // Track currently displayed character for dev functions

  // Locked NPCs - initially hidden and not interactable until unlocked
  private lockedNPCs: Set<string> = new Set([
    'scholar_xiaomei',
    'alchemist_tuanzi',
    'chef_curry',
    'trainer_alin',
    'blacksmith_zz',
    'summoner_kaoezi',
    'merchant_youliang',
    'merchant_xiaoheiyang',
    'bookseller_xiaochao',
    'player_stall'
  ]);

  // Locked recipes - initially all recipes are locked and hidden until unlocked
  private lockedRecipes: Set<string> = new Set();

  // Locked buttons - NPC-specific buttons that are locked until unlocked via affinity
  private lockedButtons: Set<string> = new Set([
    'craft',        // blacksmith_zz 制作
    'alchemy',      // alchemist_tuanzi 制作
    'summon',       // summoner_kaoezi 异界召唤
    'jobchange',    // trainer_alin 转职
    'card-collection' // scholar_xiaomei 卡牌图鉴
  ]);

  // Track claimed affinity rewards per NPC: npcId -> Set of milestone thresholds already claimed
  private claimedAffinityRewards: Map<string, Set<number>> = new Map();

  // Track daily membership card food claims: Set of npcIds that have been claimed today
  private dailyMembershipFoodClaimed: Set<string> = new Set();

  // Track exchanged cards: Set of cardIds that have been exchanged (each card can only be exchanged once)
  private exchangedCards: Set<string> = new Set();

  // Affinity reward configuration: npcId -> array of {threshold, rewards}
  private affinityRewardConfig: Map<string, Array<{threshold: number, rewards: Array<{type: string, params: any}>}>> = new Map([
    ['village_chief', [
      { threshold: 10, rewards: [{ type: 'gold', params: { amount: 500 } }, { type: 'unlock_npc', params: { npcId: 'player_stall' } }] },
      { threshold: 30, rewards: [{ type: 'unlock_npc', params: { npcId: 'blacksmith_zz' } }, { type: 'unlock_npc', params: { npcId: 'scholar_xiaomei' } }] },
      { threshold: 50, rewards: [{ type: 'card', params: { cardId: 'card_cunzhang' } }, { type: 'gold', params: { amount: 2000 } }] },
      { threshold: 70, rewards: [{ type: 'unlock_npc', params: { npcId: 'merchant_youliang' } }, { type: 'unlock_npc', params: { npcId: 'merchant_xiaoheiyang' } }] },
      { threshold: 100, rewards: [{ type: 'card_holographic', params: { cardId: 'card_cunzhang' } }, { type: 'gold', params: { amount: 5000 } }] }
    ]],
    ['blacksmith_zz', [
      { threshold: 10, rewards: [{ type: 'unlock_button', params: { buttonId: 'craft' } }] },
      { threshold: 15, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['small_round_shield'] } }] },
      { threshold: 16, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['copper_necklace'] } }] },
      { threshold: 17, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['copper_tower_shield'] } }] },
      { threshold: 18, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['copper_ring'] } }] },
      { threshold: 19, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['copper_chestplate'] } }] },
      { threshold: 20, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['oak_plate_armor'] } }] },
      { threshold: 21, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['red_moon', 'sirius'] } }] },
      { threshold: 22, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['bleeder', 'red_shadow'] } }] },
      { threshold: 23, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['red_tide'] } }] },
      { threshold: 30, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['copper_longsword', 'oak_wand'] } }] },
      { threshold: 50, rewards: [{ type: 'card', params: { cardId: 'card_blacksmith_zz' } }] },
      { threshold: 70, rewards: [{ type: 'gold', params: { amount: 3000 } }] },
      { threshold: 100, rewards: [{ type: 'card_holographic', params: { cardId: 'card_blacksmith_zz' } }, { type: 'gold', params: { amount: 5000 } }] }
    ]],
    ['scholar_xiaomei', [
      { threshold: 10, rewards: [{ type: 'unlock_button', params: { buttonId: 'card-collection' } }] },
      { threshold: 30, rewards: [{ type: 'card', params: { cardId: 'card_liangzi' } }, { type: 'card', params: { cardId: 'card_jiubao' } }] },
      { threshold: 50, rewards: [{ type: 'card', params: { cardId: 'card_xiaome' } }, { type: 'gold', params: { amount: 2000 } }] },
      { threshold: 70, rewards: [{ type: 'crystal', params: { amount: 50 } }] },
      { threshold: 100, rewards: [{ type: 'card_holographic', params: { cardId: 'card_xiaome' } }, { type: 'crystal', params: { amount: 100 } }] }
    ]],
    ['trainer_alin', [
      { threshold: 10, rewards: [{ type: 'unlock_button', params: { buttonId: 'jobchange' } }] },
      { threshold: 30, rewards: [{ type: 'gold', params: { amount: 1500 } }] },
      { threshold: 50, rewards: [{ type: 'card', params: { cardId: 'card_alin' } }, { type: 'gold', params: { amount: 2000 } }] },
      { threshold: 70, rewards: [{ type: 'crystal', params: { amount: 50 } }] },
      { threshold: 100, rewards: [{ type: 'card_holographic', params: { cardId: 'card_alin' } }, { type: 'crystal', params: { amount: 100 } }] }
    ]],
    ['alchemist_tuanzi', [
      { threshold: 10, rewards: [{ type: 'unlock_button', params: { buttonId: 'alchemy' } }] },
      { threshold: 15, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['apprentice_mana_potion'] } }] },
      { threshold: 16, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['apprentice_speed_potion'] } }] },
      { threshold: 17, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['apprentice_hardening_potion'] } }] },
      { threshold: 18, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['apprentice_strength_potion'] } }] },
      { threshold: 30, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['apprentice_healing_potion'] } }] },
      { threshold: 50, rewards: [{ type: 'card', params: { cardId: 'card_tuanzi' } }, { type: 'gold', params: { amount: 2000 } }] },
      { threshold: 70, rewards: [{ type: 'crystal', params: { amount: 50 } }] },
      { threshold: 100, rewards: [{ type: 'card_holographic', params: { cardId: 'card_tuanzi' } }, { type: 'crystal', params: { amount: 100 } }] }
    ]],
    ['chef_curry', [
      { threshold: 10, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['slime_qq_candy', 'fried_mushroom_slices', 'two_headed_snake_skin_jelly'] } }] },
      { threshold: 15, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['sugar_pickled_snake_liver'] } }] },
      { threshold: 16, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['candied_mystic_mushroom'] } }] },
      { threshold: 17, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['crispy_wing_snake_skin_roll'] } }] },
      { threshold: 18, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['bitter_ball'] } }] },
      { threshold: 19, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['salty_concubine_candy'] } }] },
      { threshold: 20, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['steamed_spider_leg'] } }] },
      { threshold: 21, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['suffocating_special_drink'] } }] },
      { threshold: 22, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['braised_spider_leg'] } }] },
      { threshold: 23, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['dehydrated_compressed_biscuit'] } }] },
      { threshold: 24, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['finger_fries'] } }] },
      { threshold: 25, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['frog_leg_sashimi'] } }] },
      { threshold: 26, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['charcoal_grilled_crispy_vine'] } }] },
      { threshold: 27, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['bile_noodles'] } }] },
      { threshold: 28, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['dry_pot_eye_frog'] } }] },
      { threshold: 29, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['explosive_double_crispy'] } }] },
      { threshold: 30, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['grassland_set_meal'] } }, { type: 'give_item', params: { itemId: 'curry_membership', quantity: 1 } }] },
      { threshold: 50, rewards: [{ type: 'card', params: { cardId: 'card_gali' } }, { type: 'unlock_recipe', params: { recipeIds: ['forest_set_meal'] } }] },
      { threshold: 70, rewards: [{ type: 'unlock_recipe', params: { recipeIds: ['cave_set_meal'] } }, { type: 'remove_item', params: { itemId: 'curry_membership', quantity: 1 } }, { type: 'give_item', params: { itemId: 'curry_gold_membership', quantity: 1 } }] },
      { threshold: 100, rewards: [{ type: 'card_holographic', params: { cardId: 'card_gali' } }] }
    ]],
    ['summoner_kaoezi', [
      { threshold: 10, rewards: [{ type: 'unlock_button', params: { buttonId: 'summon' } }] },
      { threshold: 30, rewards: [{ type: 'gold', params: { amount: 1500 } }] },
      { threshold: 50, rewards: [{ type: 'card', params: { cardId: 'card_kaoezi' } }, { type: 'gold', params: { amount: 2000 } }] },
      { threshold: 70, rewards: [{ type: 'crystal', params: { amount: 50 } }] },
      { threshold: 100, rewards: [{ type: 'card_holographic', params: { cardId: 'card_kaoezi' } }, { type: 'crystal', params: { amount: 100 } }] }
    ]],
    ['bartender', [
      { threshold: 10, rewards: [{ type: 'gold', params: { amount: 500 } }, { type: 'give_item', params: { itemId: 'tavern_membership_card', quantity: 1 } }] },
      { threshold: 30, rewards: [{ type: 'unlock_npc', params: { npcId: 'chef_curry' } }, { type: 'unlock_npc', params: { npcId: 'trainer_alin' } }] },
      { threshold: 50, rewards: [{ type: 'card', params: { cardId: 'card_jiubao' } }, { type: 'gold', params: { amount: 2000 } }] },
      { threshold: 70, rewards: [{ type: 'unlock_npc', params: { npcId: 'alchemist_tuanzi' } }, { type: 'unlock_npc', params: { npcId: 'summoner_kaoezi' } }] },
      { threshold: 100, rewards: [{ type: 'card_holographic', params: { cardId: 'card_jiubao' } }, { type: 'gold', params: { amount: 5000 } }] }
    ]],
    ['maid', [
      { threshold: 10, rewards: [{ type: 'gold', params: { amount: 500 } }] },
      { threshold: 30, rewards: [{ type: 'gold', params: { amount: 1000 } }] },
      { threshold: 50, rewards: [{ type: 'card', params: { cardId: 'card_liangzi' } }, { type: 'gold', params: { amount: 2000 } }] },
      { threshold: 70, rewards: [{ type: 'crystal', params: { amount: 30 } }] },
      { threshold: 100, rewards: [{ type: 'card_holographic', params: { cardId: 'card_liangzi' } }, { type: 'crystal', params: { amount: 100 } }] }
    ]],
    ['merchant_youliang', [
      { threshold: 10, rewards: [{ type: 'gold', params: { amount: 500 } }] },
      { threshold: 30, rewards: [{ type: 'give_item', params: { itemId: 'youliang_membership', quantity: 1 } }] },
      { threshold: 50, rewards: [{ type: 'gold', params: { amount: 3000 } }] },
      { threshold: 70, rewards: [{ type: 'remove_item', params: { itemId: 'youliang_membership', quantity: 1 } }, { type: 'give_item', params: { itemId: 'youliang_gold_membership', quantity: 1 } }] },
      { threshold: 100, rewards: [{ type: 'gold', params: { amount: 10000 } }] }
    ]],
    ['merchant_xiaoheiyang', [
      { threshold: 10, rewards: [{ type: 'gold', params: { amount: 500 } }] },
      { threshold: 30, rewards: [{ type: 'give_item', params: { itemId: 'xiaoheiyang_membership', quantity: 1 } }] },
      { threshold: 50, rewards: [{ type: 'gold', params: { amount: 3000 } }] },
      { threshold: 70, rewards: [{ type: 'remove_item', params: { itemId: 'xiaoheiyang_membership', quantity: 1 } }, { type: 'give_item', params: { itemId: 'xiaoheiyang_gold_membership', quantity: 1 } }] },
      { threshold: 100, rewards: [{ type: 'crystal', params: { amount: 200 } }] }
    ]]
  ]);

  // Quest system properties
  private questDefinitions: QuestDefinition[] = [];
  private questStates: Map<string, QuestState> = new Map();
  private lastDailyReset: number = 0;

  constructor(eventSystem: EventSystem, world: World, rootElement: HTMLElement) {
    this.eventSystem = eventSystem;
    this.world = world;
    this.uiManager = new UIManager(eventSystem, rootElement);

    // Initialize NPC System
    this.npcSystem = new NPCSystem(world);
    
    // Initialize Currency System
    this.currencySystem = new CurrencySystem();
    
    // Initialize Item System
    this.itemSystem = new ItemSystem(world);
    
    // Initialize Equipment System
    this.equipmentSystem = new EquipmentSystem(world, this.itemSystem);
    
    // Initialize Battle System
    this.battleSystem = new BattleSystem(this.npcSystem);
    
    // Initialize Enemy System
    this.enemySystem = new EnemySystem(this.world);
    
    // Initialize Loot System
    this.lootSystem = new LootSystem(this.world);
    
    // Initialize Card System
    this.cardSystem = new CardSystem(this.world);

    // Initialize Resource Node System
    this.resourceNodeSystem = new ResourceNodeSystem();

    // Initialize Cooking System
    this.cookingSystem = new CookingSystem();

    // Initialize Equipment Crafting System
    this.equipmentCraftingSystem = new EquipmentCraftingSystem();

    // Initialize Alchemy Crafting System
    this.alchemyCraftingSystem = new AlchemyCraftingSystem();

    // Initialize Buff System
    this.buffSystem = new BuffSystem();

    // Initialize Affinity System
    this.affinitySystem = new AffinitySystem();

    // Initialize Dialogue System
    this.dialogueSystem = new DialogueSystem(world);

    // Load affix definitions for merchant equipment generation
    this.loadAffixDefinitions();

    // Initialize UI components
    this.characterPanel = new CharacterPanel(this.uiManager, this.eventSystem, this.world);
    this.inventoryPanel = new InventoryPanel(this.uiManager, this.eventSystem, this.world);
    this.explorationPanel = new ExplorationPanel(this.uiManager, this.eventSystem, this.world);
    this.craftingPanel = new CraftingPanel(this.uiManager, this.eventSystem, this.world);
    this.farmingPanel = new FarmingPanel(this.uiManager, this.eventSystem, this.world);
    
    this.mainHUD = document.createElement('div');

    // Expose GameUI to window for DialogueSystem condition checking
    (window as any).gameUI = this;

    this.initialize();
  }

  /**
   * Calculate the number of grid columns based on container width
   * @param containerWidth - The available width of the container in pixels
   * @returns The number of columns (between 1 and 8)
   */
  private calculateGridColumns(containerWidth: number): number {
    const itemMinWidth = 120; // Minimum item card width in pixels
    const gap = 12; // Grid gap in pixels
    
    // Handle edge cases: invalid or zero width
    if (containerWidth <= 0) {
      console.warn('Container width is invalid or zero, using default 4 columns');
      return 4;
    }
    
    // Calculate the number of columns that can fit
    // Formula: (containerWidth + gap) / (itemMinWidth + gap)
    // The +gap in numerator accounts for the fact that there's no gap after the last column
    const columns = Math.floor((containerWidth + gap) / (itemMinWidth + gap));
    
    // Ensure columns is between 1 and 8
    return Math.max(1, Math.min(columns, 8));
  }

  /**
   * Calculate the number of items per page based on grid columns
   * @param columns - The number of columns in the grid
   * @returns The number of items that should be displayed per page
   */
  private calculateItemsPerPage(columns: number): number {
    const targetRows = 4; // Target number of rows per page
    return columns * targetRows;
  }

  /**
   * Setup ResizeObserver to monitor container size changes and trigger re-render when columns change
   * @param container - The container element to observe
   * @param contentArea - The content area to re-render
   */
  private setupResizeObserver(container: HTMLElement, contentArea: HTMLElement): void {
    // Clean up old observer if it exists
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Check if ResizeObserver is supported
    if (typeof ResizeObserver === 'undefined') {
      console.warn('ResizeObserver is not supported, falling back to window resize event');

      // Fallback to window resize event with debounce
      const handleResize = debounce(() => {
        const newWidth = container.getBoundingClientRect().width;
        const newColumns = this.calculateGridColumns(newWidth);

        // Only re-render if columns actually changed
        if (newColumns !== this.currentColumns) {
          this.currentColumns = newColumns;

          // Re-render item grid
          while (contentArea.children.length > 1) {
            contentArea.removeChild(contentArea.lastChild!);
          }
          this.renderItemGrid(contentArea);
        }
      }, 150);

      window.addEventListener('resize', handleResize);
      return;
    }

    // Create ResizeObserver with debounced callback
    const debouncedCallback = debounce((entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newColumns = this.calculateGridColumns(newWidth);

        // Only re-render if columns actually changed
        if (newColumns !== this.currentColumns) {
          this.currentColumns = newColumns;

          // Re-render item grid
          while (contentArea.children.length > 1) {
            contentArea.removeChild(contentArea.lastChild!);
          }
          this.renderItemGrid(contentArea);
        }
      }
    }, 150);

    this.resizeObserver = new ResizeObserver(debouncedCallback);
    this.resizeObserver.observe(container);
  }

  /**
   * Load affix definitions and initialize AffixSelector
   */
  private async loadAffixDefinitions(): Promise<void> {
    try {
      const response = await fetch('src/game/data/affix-definitions.json');
      if (!response.ok) {
        throw new Error(`Failed to load affix definitions: ${response.statusText}`);
      }
      const affixPool: AffixPoolConfig = await response.json();
      this.affixSelector = new AffixSelector(affixPool, AFFIX_PROBABILITY_CONFIG);
      console.log('✅ Affix definitions loaded for merchant equipment');
    } catch (error) {
      console.error('Failed to load affix definitions:', error);
      // Continue without affix system - merchants can still sell equipment without affixes
    }
  }


  private async initialize(): Promise<void> {
    // Register UI components - Temporarily disabled to prevent overlay issues
    // this.uiManager.registerComponent(this.characterPanel);
    // this.uiManager.registerComponent(this.inventoryPanel);
    // this.uiManager.registerComponent(this.explorationPanel);
    // this.uiManager.registerComponent(this.craftingPanel);
    // this.uiManager.registerComponent(this.farmingPanel);

    // Hide all panels initially
    this.uiManager.hideAllComponents();

    // Register NPCSystem with World
    this.world.addSystem(this.npcSystem);

    // Register CookingSystem with World
    this.world.addSystem(this.cookingSystem);

    // Register EquipmentCraftingSystem with World
    this.world.addSystem(this.equipmentCraftingSystem);

    // Register AlchemyCraftingSystem with World
    this.world.addSystem(this.alchemyCraftingSystem);

    // Register EquipmentSystem with World
    this.world.addSystem(this.equipmentSystem);

    // Register BuffSystem with World
    this.world.addSystem(this.buffSystem);

    // Register AffinitySystem with World
    this.world.addSystem(this.affinitySystem);

    // Register DialogueSystem with World
    this.world.addSystem(this.dialogueSystem);

    // Set ItemSystem reference for CookingSystem
    this.cookingSystem.setItemSystem(this.itemSystem);

    // Set ItemSystem reference for EquipmentCraftingSystem
    this.equipmentCraftingSystem.setItemSystem(this.itemSystem);

    // Set ItemSystem reference for AlchemyCraftingSystem
    this.alchemyCraftingSystem.setItemSystem(this.itemSystem);

    // Initialize World (this will initialize all systems)
    this.world.initialize();

    // Load cooking recipes
    await this.loadCookingRecipes();

    // Load equipment recipes
    await this.loadEquipmentRecipes();

    // Load alchemy recipes
    await this.loadAlchemyRecipes();

    // Initialize locked recipes - lock ALL recipes AFTER they are loaded
    this.initLockedRecipes();
    this.checkBlueprintUnlocks();

    // Load buff definitions
    await this.loadBuffDefinitions();

    // Set BuffSystem reference in BattleSystem (AFTER loadBuffDefinitions so callback chain works)
    this.battleSystem.setBuffSystem(this.buffSystem);

    // Load dialogue trees
    await this.loadDialogueTrees();

    // Load items data (wait for it to complete)
    await this.loadItemsData();

    // Load quest data and initialize quest system
    await this.loadQuestData();
    this.initQuestSystem();
    this.setupQuestDetection();

    // Add initial items to inventory
    this.addInitialItems();

    // Create main HUD
    this.createMainHUD();

    // Create quest tracker and add to scene container
    this.questTracker = new QuestTracker();
    const trackerElement = this.questTracker.getElement();
    if (trackerElement && this.sceneContainer) {
      this.sceneContainer.appendChild(trackerElement);
    }

    // Setup event listeners
    this.setupEventListeners();

    // Start hunger decay timer (0.2 per second for all recruited characters)
    this.startHungerDecay();

    // Start day/night cycle timer
    this.startDayNightCycle();

    // Apply time-dependent passive skills for initial state (daytime)
    this.applyTimeDependentPassiveSkills();

    // Update quest tracker to show initial main quest
    this.updateQuestTracker();

    // Pre-generate tavern adventurers at game start
    const tavernSpawnCount = 6;
    for (let i = 0; i < tavernSpawnCount; i++) {
      const adventurer = this.npcSystem.createAdventurer();
      (adventurer as any).spawnPointIndex = i;
    }

    console.log('🎮 Game UI initialized');
  }

  private async loadCookingRecipes(): Promise<void> {
    try {
      const response = await fetch('src/game/data/cooking-recipes.json');
      const recipesData = await response.json();
      this.cookingSystem.loadRecipes(recipesData);

      // Register or update each dish as an item in ItemSystem
      recipesData.recipes.forEach((recipe: any) => {
        const existingItem = this.itemSystem.getItem(recipe.id);
        
        if (existingItem) {
          // Item already exists - update it with hungerRestore property
          this.itemSystem.updateItem(recipe.id, {
            hungerRestore: recipe.hungerRestore || 50,
            effects: recipe.effects || '饱腹度+50'
          });
        } else {
          // Item doesn't exist - register it
          this.itemSystem.registerItem({
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            type: 'food',
            icon: recipe.icon || '',
            rarity: recipe.rarity || 0,
            stackSize: 99,
            hungerRestore: recipe.hungerRestore || 50,
            effects: recipe.effects || '饱腹度+50',
            canSell: true,
            buyPrice: recipe.buyPrice || 0,
            canBuy: false,
            canCraft: false,
            craftRecipe: null,
            canUse: true
          } as any);
        }
      });

      console.log('✅ Cooking recipes loaded');
    } catch (error) {
      console.error('❌ Failed to load cooking recipes:', error);
    }
  }

  private async loadEquipmentRecipes(): Promise<void> {
    try {
      const response = await fetch('src/game/data/equipment-recipes.json');
      const recipesData = await response.json();
      this.equipmentCraftingSystem.loadRecipes(recipesData);
      console.log('✅ Equipment recipes loaded');
    } catch (error) {
      console.error('❌ Failed to load equipment recipes:', error);
    }
  }

  private async loadAlchemyRecipes(): Promise<void> {
    try {
      const response = await fetch('src/game/data/alchemy-recipes.json');
      const recipesData = await response.json();
      this.alchemyCraftingSystem.loadRecipes(recipesData);
      console.log('✅ Alchemy recipes loaded');
    } catch (error) {
      console.error('❌ Failed to load alchemy recipes:', error);
    }
  }

  private async loadBuffDefinitions(): Promise<void> {
    try {
      const response = await fetch('src/game/data/buffs.json', { cache: 'no-store' });
      const buffsData = await response.json();
      this.buffSystem.loadBuffs(buffsData);

      // Set up buff apply/remove callbacks to modify character stats
      this.buffSystem.setOnBuffApplied((characterId, effects, stacks) => {
        const character = this.npcSystem.getRecruitedCharacter(characterId);
        if (!character) return;
        
        // Get the buff that was just applied to check for special flags
        const activeBuffs = this.buffSystem.getActiveBuffs(characterId);
        const latestBuff = activeBuffs[activeBuffs.length - 1];
        if (latestBuff) {
          const buffDef = this.buffSystem.getBuffDefinition(latestBuff.buffId);
          
          // Check if this buff disables movement
          if (buffDef && (buffDef as any).disableMovement) {
            // Disable movement in BattleSystem
            this.battleSystem.setCharacterMovement(characterId, false);
            console.log(`[GameUI] Movement disabled for ${character.name} due to ${buffDef.name} BUFF`);
          }
        }
        
        // Special handling for hunger BUFF (identified by empty effects array)
        // Check if this is hunger BUFF by looking at active buffs
        const hungerBuff = this.buffSystem.getActiveBuffs(characterId).find(b => b.buffId === 'hunger');
        if (hungerBuff && effects.length === 0 && !this.hungerPreBuffStats.has(characterId)) {
          // This is the hunger BUFF being applied for the first time
          this.hungerPreBuffStats.set(characterId, {
            moveSpeed: character.moveSpeed,
            attack: character.attack,
            hpRegen: character.hpRegen,
            mpRegen: character.mpRegen
          });
          character.moveSpeed = 0;
          character.attack = Math.round(character.attack * 0.25);
          character.hpRegen = 0;
          character.mpRegen = 0;
          console.log(`[GameUI] Hunger BUFF applied to ${character.name}: moveSpeed=0, attack*0.25, hpRegen=0, mpRegen=0`);
          return;
        }
        
        // Check if character has hunger BUFF - if so, skip moveSpeed modifications
        const hasHunger = this.buffSystem.hasBuff(characterId, 'hunger');
        
        for (const effect of effects) {
          // Skip moveSpeed modifications if character has hunger BUFF
          if (hasHunger && effect.attribute === 'moveSpeed') {
            console.log(`[GameUI] Skipping moveSpeed modification for ${character.name} due to hunger BUFF`);
            continue;
          }
          
          const attr = effect.attribute as keyof NPCData;
          if (typeof character[attr] === 'number') {
            if (effect.type === 'flat') {
              (character as any)[attr] += effect.value * stacks;
            } else if (effect.type === 'percentage') {
              (character as any)[attr] *= (1 + (effect.value / 100) * stacks);
            }
          }
        }
      });

      this.buffSystem.setOnBuffRemoved((characterId, effects, stacks) => {
        const character = this.npcSystem.getRecruitedCharacter(characterId);
        if (!character) return;
        
        // Check if any remaining buffs disable movement
        const activeBuffs = this.buffSystem.getActiveBuffs(characterId);
        let hasMovementDisablingBuff = false;
        for (const buff of activeBuffs) {
          const buffDef = this.buffSystem.getBuffDefinition(buff.buffId);
          if (buffDef && (buffDef as any).disableMovement) {
            hasMovementDisablingBuff = true;
            break;
          }
        }
        
        // If no remaining buffs disable movement, re-enable movement
        if (!hasMovementDisablingBuff) {
          this.battleSystem.setCharacterMovement(characterId, true);
          console.log(`[GameUI] Movement re-enabled for ${character.name}`);
        }
        
        // Special handling for hunger BUFF - recalculate stats from base values
        const savedStats = this.hungerPreBuffStats.get(characterId);
        if (savedStats) {
          // Recalculate from base to avoid stat desync with other active BUFFs
          this.recalculateSecondaryAttributes(character);
          // Re-apply any remaining active BUFF effects (excluding hunger which is being removed)
          const remainingBuffs = this.buffSystem.getActiveBuffs(characterId)
            .filter(b => b.buffId !== 'hunger');
          for (const buff of remainingBuffs) {
            const buffDef = this.buffSystem.getBuffDefinition(buff.buffId);
            if (buffDef && buffDef.effects.length > 0) {
              for (const effect of buffDef.effects) {
                const attr = effect.attribute as keyof NPCData;
                if (typeof character[attr] === 'number') {
                  if (effect.type === 'flat') {
                    (character as any)[attr] += effect.value * buff.stacks;
                  } else if (effect.type === 'percentage') {
                    (character as any)[attr] *= (1 + (effect.value / 100) * buff.stacks);
                  }
                }
              }
            }
          }
          this.hungerPreBuffStats.delete(characterId);
          console.log(`[GameUI] Hunger BUFF removed from ${character.name}: stats recalculated`);
          return;
        }
        
        // Check if character still has hunger BUFF - if so, skip moveSpeed modifications
        const hasHunger = this.buffSystem.hasBuff(characterId, 'hunger');
        
        // Use AttributeSystem to recalculate all attributes from base values
        // This prevents floating point errors from accumulating
        this.recalculateSecondaryAttributes(character);
        
        // Re-apply all remaining active buff effects
        const remainingBuffs = this.buffSystem.getActiveBuffs(characterId);
        for (const buff of remainingBuffs) {
          const buffDef = this.buffSystem.getBuffDefinition(buff.buffId);
          if (buffDef && buffDef.effects.length > 0) {
            for (const effect of buffDef.effects) {
              // Skip moveSpeed modifications if character still has hunger BUFF
              if (hasHunger && effect.attribute === 'moveSpeed') {
                console.log(`[GameUI] Skipping moveSpeed restoration for ${character.name} due to hunger BUFF`);
                continue;
              }
              
              const attr = effect.attribute as keyof NPCData;
              if (typeof character[attr] === 'number') {
                if (effect.type === 'flat') {
                  (character as any)[attr] += effect.value * buff.stacks;
                } else if (effect.type === 'percentage') {
                  (character as any)[attr] *= (1 + (effect.value / 100) * buff.stacks);
                }
              }
            }
          }
        }
        
        console.log(`[GameUI] Buff removed from ${character.name}, stats recalculated. moveSpeed: ${character.moveSpeed}`);
      });

      console.log('✅ Buff definitions loaded');
    } catch (error) {
      console.error('❌ Failed to load buff definitions:', error);
    }
  }

  private async loadDialogueTrees(): Promise<void> {
    try {
      const response = await fetch('src/game/data/dialogue-trees.json');
      const dialoguesData = await response.json();
      this.dialogueSystem.loadDialogues(dialoguesData);
      console.log('✅ Dialogue trees loaded');
    } catch (error) {
      console.error('❌ Failed to load dialogue trees:', error);
    }
  }

  private async loadItemsData(): Promise<void> {
    try {
      // Load items from items.json
      const response = await fetch('src/game/data/items.json');
      const data = await response.json();
      data.items.forEach((item: any) => {
        this.itemsData.set(item.id, item);
      });

      // Load items from item-prefabs.json
      const prefabsResponse = await fetch('src/game/data/item-prefabs.json');
      const prefabsData = await prefabsResponse.json();
      prefabsData.items.forEach((item: any) => {
        // Extract hungerRestore from effects array if present
        if (item.type === 'food' && !item.hungerRestore && Array.isArray(item.effects)) {
          const hungerEffect = item.effects.find((e: any) => e.type === 'hunger');
          if (hungerEffect) {
            item.hungerRestore = hungerEffect.value;
            item.effects = `饱腹度+${hungerEffect.value}`;
          }
        }
        this.itemsData.set(item.id, item);
      });

      // Load cooking recipes as dish items (so they appear in food lists)
      const cookingResponse = await fetch('src/game/data/cooking-recipes.json');
      const cookingData = await cookingResponse.json();
      cookingData.recipes.forEach((recipe: any) => {
        const existing = this.itemsData.get(recipe.id);
        // Merge cooking recipe fields (effects, hungerRestore) into existing entry, or create new
        this.itemsData.set(recipe.id, {
          ...(existing || {}),
          id: recipe.id,
          name: recipe.name,
          description: recipe.description,
          type: 'food',
          icon: recipe.icon,
          rarity: recipe.rarity,
          buyPrice: recipe.buyPrice,
          hungerRestore: recipe.hungerRestore || 50,
          effects: recipe.effects || '饱腹度+50'
        });
      });

      console.log('✅ Items data loaded');
    } catch (error) {
      console.error('❌ Failed to load items data:', error);
    }
  }

  private async loadQuestData(): Promise<void> {
    try {
      const response = await fetch('src/game/data/quests.json');
      const data = await response.json();
      const allQuests: QuestDefinition[] = [
        ...(data.mainQuests || []),
        ...(data.sideQuests || []),
        ...(data.dailyQuests || [])
      ];
      this.questDefinitions = allQuests;
      console.log(`✅ Quest data loaded: ${allQuests.length} quests`);
    } catch (error) {
      console.error('❌ Failed to load quest data:', error);
      this.questDefinitions = [];
    }
  }

  private initQuestSystem(): void {
    // Initialize quest states for all definitions
    for (const quest of this.questDefinitions) {
      // Skip if already has a state (from save data)
      if (this.questStates.has(quest.id)) continue;

      let status: 'locked' | 'available' | 'inProgress' | 'completed' = 'locked';

      if (quest.type === 'main') {
        // First main quest is auto-accepted (inProgress), rest are locked
        if (quest.prerequisites.length === 0) {
          status = 'inProgress';
        }
      } else {
        // Side and daily quests: available if no prerequisites
        if (quest.prerequisites.length === 0) {
          status = 'available';
        }
      }

      this.questStates.set(quest.id, {
        id: quest.id,
        status,
        objectives: quest.objectives.map(() => ({ currentAmount: 0 }))
      });
    }

    // Check prerequisites for quests that have them
    for (const quest of this.questDefinitions) {
      if (this.questStates.get(quest.id)?.status !== 'locked') continue;
      if (this.isQuestAvailable(quest)) {
        const state = this.questStates.get(quest.id);
        if (state) {
          // Main quests auto-accept, others become available
          state.status = quest.type === 'main' ? 'inProgress' : 'available';
        }
      }
    }

    this.lastDailyReset = this.lastDailyReset || Date.now();
    console.log('✅ Quest system initialized');
  }

  private isQuestAvailable(quest: QuestDefinition): boolean {
    if (quest.prerequisites.length === 0) return true;
    return quest.prerequisites.every(preId => {
      const preState = this.questStates.get(preId);
      return preState && preState.status === 'completed';
    });
  }

  private getQuestsForNpc(npcId: string): QuestDefinition[] {
    return this.questDefinitions
      .filter(q => q.npcId === npcId)
      .sort((a, b) => {
        // Sort by type: main > side > daily
        const typeOrder: Record<string, number> = { main: 0, side: 1, daily: 2 };
        const typeDiff = (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
        if (typeDiff !== 0) return typeDiff;
        return a.sortOrder - b.sortOrder;
      });
  }

  private acceptQuest(questId: string): void {
    const state = this.questStates.get(questId);
    if (!state || state.status !== 'available') return;
    state.status = 'inProgress';
    const def = this.questDefinitions.find(q => q.id === questId);
    if (def) {
      this.showNotification(`已接受任务: ${def.name}`, 'success');
    }
    this.updateQuestRedDots();
  }

  private setupQuestDetection(): void {
      this.eventSystem.subscribe('quest:scene_visited', (event: any) => {
        this.checkQuestProgress('scene_visit', event.sceneId, 1);
      });
      this.eventSystem.subscribe('quest:craft_completed', (event: any) => {
        this.checkQuestProgress('craft_item', event.recipeId, 1);
        // Also check "any" category crafts
        if (event.craftType === 'equipment') {
          this.checkQuestProgress('craft_item', 'any_equipment', 1);
        } else if (event.craftType === 'cooking') {
          this.checkQuestProgress('craft_item', 'any_cooking', 1);
        } else if (event.craftType === 'alchemy') {
          this.checkQuestProgress('craft_item', 'any_alchemy', 1);
        }
      });
      this.eventSystem.subscribe('quest:recruited', () => {
        this.checkQuestProgress('recruit', 'any', 1);
      });
      this.eventSystem.subscribe('quest:gift_given', (event: any) => {
        this.checkQuestProgress('gift_give', event.npcId, 1);
        this.checkQuestProgress('gift_give', 'any', 1);
      });
      this.eventSystem.subscribe('quest:affinity_changed', (event: any) => {
        this.checkQuestProgress('affinity_level', event.npcId, event.newAffinity);
      });
      this.eventSystem.subscribe('dialogue:completed', (event: any) => {
        if (event.characterId) {
          this.checkQuestProgress('dialogue', event.characterId, 1);
          this.checkQuestProgress('dialogue', 'any', 1);
        }
      });
      this.eventSystem.subscribe('quest:combat_completed', (event: any) => {
        this.checkQuestProgress('combat_complete', event.stageId || 'any', 1);
        this.checkQuestProgress('combat_complete', 'any', 1);
      });
      this.eventSystem.subscribe('quest:combat_kill', (event: any) => {
        this.checkQuestProgress('combat_kill', event.stageId || 'any', 1);
        this.checkQuestProgress('combat_kill', 'any', 1);
      });
      this.eventSystem.subscribe('quest:kill_enemy', (event: any) => {
        this.checkQuestProgress('kill_enemy', event.enemyId, 1);
      });
      this.eventSystem.subscribe('quest:item_gained', (event: any) => {
        this.checkQuestProgress('item_possession', event.itemId, event.quantity || 1);
      });
      this.eventSystem.subscribe('quest:shop_purchase', (event: any) => {
        this.checkQuestProgress('shop_purchase', event.merchantId, 1);
      });
      this.eventSystem.subscribe('quest:job_change', () => {
        this.checkQuestProgress('job_change', 'any', 1);
      });
      this.eventSystem.subscribe('quest:summon', () => {
        this.checkQuestProgress('summon', 'any', 1);
      });
      this.eventSystem.subscribe('quest:skill_change', () => {
        console.log('[Quest Debug] Received quest:skill_change event');
        this.checkQuestProgress('skill_change', 'any', 1);
      });
      this.eventSystem.subscribe('quest:stall_add_item', () => {
        this.checkQuestProgress('stall_add_item', 'any', 1);
      });
      this.eventSystem.subscribe('quest:equipment_equip', () => {
        this.checkQuestProgress('equipment_equip', 'any', 1);
      });
    }


  private checkQuestProgress(type: QuestObjectiveType, target: string, amount: number = 1): void {
    console.log('[Quest Debug] checkQuestProgress called', { type, target, amount });
    let changed = false;
    for (const [questId, state] of this.questStates) {
      if (state.status !== 'inProgress') continue;
      const def = this.questDefinitions.find(q => q.id === questId);
      if (!def) continue;

      for (let i = 0; i < def.objectives.length; i++) {
        const obj = def.objectives[i];
        if (obj.type !== type) continue;
        if (obj.target !== target && obj.target !== 'any') continue;

        console.log('[Quest Debug] Found matching objective', { questId, objectiveIndex: i, obj, currentAmount: state.objectives[i].currentAmount });

        const objState = state.objectives[i];
        if (type === 'affinity_level') {
          // For affinity, set to the current level directly
          if (amount > objState.currentAmount) {
            objState.currentAmount = Math.min(amount, obj.requiredAmount);
            changed = true;
          }
        } else {
          if (objState.currentAmount < obj.requiredAmount) {
            objState.currentAmount = Math.min(objState.currentAmount + amount, obj.requiredAmount);
            changed = true;
            console.log('[Quest Debug] Updated objective progress', { questId, newAmount: objState.currentAmount });
          }
        }
      }
    }
    if (changed) {
      console.log('[Quest Debug] Quest progress changed, updating UI');
      this.checkMainQuestAutoComplete();
      this.updateQuestRedDots();
      this.updateQuestTracker();
    }
  }

  private checkMainQuestAutoComplete(): void {
    for (const [questId, state] of this.questStates) {
      if (state.status !== 'inProgress') continue;
      const def = this.questDefinitions.find(q => q.id === questId);
      if (!def) continue;
      // Auto-complete main quests and side quests with kill_enemy objectives
      if (def.type !== 'main' && def.type !== 'side') continue;

      const allComplete = def.objectives.every((obj, i) =>
        state.objectives[i].currentAmount >= obj.requiredAmount
      );
      if (allComplete) {
        this.completeQuest(questId);
      }
    }
  }

  private resetDailyQuests(): void {
    for (const quest of this.questDefinitions) {
      if (quest.type !== 'daily') continue;
      const state = this.questStates.get(quest.id);
      if (!state) continue;
      if (state.status === 'completed' || state.status === 'inProgress') {
        state.status = 'available';
        state.objectives = quest.objectives.map(() => ({ currentAmount: 0 }));
        state.completedAt = undefined;
      }
    }
    this.lastDailyReset = Date.now();
    console.log('✅ Daily quests reset');
  }

  private serializeQuestState(): QuestSaveData {
    const questStates: Record<string, QuestState> = {};
    for (const [id, state] of this.questStates) {
      questStates[id] = { ...state, objectives: state.objectives.map(o => ({ ...o })) };
    }
    return { 
      questStates, 
      lastDailyReset: this.lastDailyReset,
      unlockedStages: Array.from(this.unlockedStages)
    };
  }

  private deserializeQuestState(data: QuestSaveData): void {
    if (!data || !data.questStates) return;
    this.questStates.clear();
    for (const [id, state] of Object.entries(data.questStates)) {
      this.questStates.set(id, { ...state, objectives: state.objectives.map(o => ({ ...o })) });
    }
    this.lastDailyReset = data.lastDailyReset || 0;

    // Restore unlocked stages with backward compatibility
    if (data.unlockedStages) {
      // New save data: directly restore unlocked stages
      this.unlockedStages = new Set(data.unlockedStages);
    } else {
      // Old save data: derive unlocked stages from completed quest rewards
      this.unlockedStages = new Set(['village']); // Always include village
      for (const [questId, state] of this.questStates) {
        if (state.status === 'completed') {
          const def = this.questDefinitions.find(q => q.id === questId);
          if (def?.rewards.unlockStage) {
            this.unlockedStages.add(def.rewards.unlockStage);
          }
        }
      }
    }

    // Fix legacy save data: main quests should never be 'available', auto-accept them
    for (const quest of this.questDefinitions) {
      if (quest.type !== 'main') continue;
      const state = this.questStates.get(quest.id);
      if (state && state.status === 'available') {
        state.status = 'inProgress';
      }
    }

    // Check if daily quests need reset (different day)
    const now = Date.now();
    const lastResetDate = new Date(this.lastDailyReset);
    const currentDate = new Date(now);
    if (lastResetDate.toDateString() !== currentDate.toDateString()) {
      this.resetDailyQuests();
    }
  }

  private getItemName(itemId: string): string {
    const item = this.itemsData.get(itemId);
    return item ? item.name : itemId;
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

  private addInitialItems(): void {
    // No initial items - start with empty inventory
    console.log('✅ Initial items check complete (no starting items)');
  }

  private createMainHUD(): void {
    // Create top navigation bar
    const navbar = document.createElement('div');
    navbar.id = 'main-hud';
    navbar.className = 'main-navbar';
    navbar.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 1920px;
      height: 60px;
      background: rgba(26, 26, 26, 0.8);
      backdrop-filter: blur(10px);
      z-index: 1001;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      pointer-events: auto;
    `;

    // Left side - Currency display
    const currencyDisplay = document.createElement('div');
    currencyDisplay.id = 'currency-display';
    currencyDisplay.style.cssText = `
      display: flex;
      gap: 24px;
    `;
    currencyDisplay.innerHTML = `
      <div class="currency-item" style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">💰</span>
        <span id="gold-amount" style="font-size: 16px; font-weight: bold; color: #fff;">0</span>
      </div>
      <div class="currency-item" style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">💎</span>
        <span id="crystal-amount" style="font-size: 16px; font-weight: bold; color: #fff;">0</span>
      </div>
      <div class="currency-item" style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">🏆</span>
        <span id="reputation-amount" style="font-size: 16px; font-weight: bold; color: #fff;">0</span>
      </div>
    `;

    // Day/Night cycle display
    const dayNightDisplay = document.createElement('div');
    dayNightDisplay.id = 'day-night-display';
    dayNightDisplay.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: 32px;
      padding-left: 32px;
      border-left: 1px solid rgba(255, 255, 255, 0.2);
    `;
    
    const dayOfWeekLabel = document.createElement('span');
    dayOfWeekLabel.id = 'day-of-week-label';
    dayOfWeekLabel.textContent = '周一';
    dayOfWeekLabel.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      color: #fff;
      min-width: 50px;
    `;
    
    const timeLabel = document.createElement('span');
    timeLabel.id = 'time-label';
    timeLabel.textContent = '☀️ 白天';
    timeLabel.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      color: #fff;
      min-width: 80px;
    `;
    
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      width: 200px;
      height: 12px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      overflow: hidden;
      position: relative;
    `;
    
    const progressFill = document.createElement('div');
    progressFill.id = 'day-night-progress-fill';
    progressFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #ffd700 0%, #ff8c00 100%);
      transition: width 0.3s ease;
      border-radius: 6px;
    `;
    
    progressContainer.appendChild(progressFill);
    dayNightDisplay.appendChild(dayOfWeekLabel);
    dayNightDisplay.appendChild(timeLabel);
    dayNightDisplay.appendChild(progressContainer);
    currencyDisplay.appendChild(dayNightDisplay);

    // Right side - Menu buttons
    const menuButtons = document.createElement('div');
    menuButtons.id = 'menu-bar';
    menuButtons.style.cssText = `
      display: flex;
      gap: 8px;
    `;
    
    const buttons = [
      { id: 'quest-overview-btn', label: '任务', icon: '📋' },
      { id: 'card-collection-btn', label: '卡牌图鉴', icon: '🎴' },
      { id: 'save-load-btn', label: '存档', icon: '💾' },
      { id: 'dev-btn', label: '开发者', icon: '🛠️' },
      { id: 'settings-btn', label: '设置', icon: '⚙️' }
    ];

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.id = btn.id;
      button.className = 'menu-button';
      
      button.innerHTML = `${btn.icon} ${btn.label}`;
      button.style.cssText = `
        padding: 8px 16px;
        background: rgba(45, 45, 45, 0.9);
        border: 1px solid rgba(102, 126, 234, 0.4);
        border-radius: 6px;
        color: white;
        cursor: pointer;
        transition: all 0.2s;
        transform: translateY(0);
        ${btn.id === 'dev-btn' ? 'display: none;' : ''}
        ${btn.id === 'card-collection-btn' && this.lockedButtons.has('card-collection') ? 'display: none;' : ''}
      `;
      
      button.addEventListener('mouseenter', () => {
        button.style.background = 'rgba(102, 126, 234, 0.8)';
        button.style.transform = 'translateY(-2px)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.background = 'rgba(45, 45, 45, 0.9)';
        button.style.transform = 'translateY(0)';
      });
      
      button.addEventListener('click', () => {
        this.handleMenuButtonClick(btn.id.replace('-btn', ''));
      });
      
      menuButtons.appendChild(button);
    });

    navbar.appendChild(currencyDisplay);
    navbar.appendChild(menuButtons);

    // Create main game layout
    const gameLayout = document.createElement('div');
    gameLayout.id = 'game-layout';
    gameLayout.style.cssText = `
      position: absolute;
      top: 60px;
      left: 0;
      width: 1920px;
      height: 870px;
      display: flex;
      gap: 16px;
      padding: 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      pointer-events: auto;
    `;

    // Left panel - Stage selection
    const stagePanel = document.createElement('div');
    stagePanel.id = 'stage-selection-panel';
    stagePanel.className = 'game-panel';
    stagePanel.style.cssText = `
      width: 200px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 16px;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    stagePanel.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">关卡选择</h3>
      <div id="stage-list" style="display: flex; flex-direction: column; gap: 8px;">
        <div class="stage-item" data-stage="village" style="padding: 12px; background: #f0f0f0; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
          <div style="font-weight: bold; color: #333;">🏘️ 村庄</div>
          <div style="font-size: 12px; color: #333;">起始地点</div>
        </div>
        <div class="stage-item" data-stage="grassland" style="padding: 12px; background: #f0f0f0; border-radius: 8px; cursor: pointer; transition: all 0.2s; opacity: 0.5;">
          <div style="font-weight: bold; color: #333;">🌾 草原</div>
          <div style="font-size: 12px; color: #333;">未解锁</div>
        </div>
        <div class="stage-item" data-stage="forest" style="padding: 12px; background: #f0f0f0; border-radius: 8px; cursor: pointer; transition: all 0.2s; opacity: 0.5;">
          <div style="font-weight: bold; color: #333;">🌲 森林</div>
          <div style="font-size: 12px; color: #333;">未解锁</div>
        </div>
        <div class="stage-item" data-stage="cave" style="padding: 12px; background: #f0f0f0; border-radius: 8px; cursor: pointer; transition: all 0.2s; opacity: 0.5;">
          <div style="font-weight: bold; color: #333;">🕳️ 洞穴</div>
          <div style="font-size: 12px; color: #333;">未解锁</div>
        </div>
      </div>
    `;

    // Center panel - Stage area
    const stageArea = document.createElement('div');
    stageArea.id = 'stage-area';
    stageArea.className = 'game-panel';
    stageArea.style.cssText = `
      flex: 1;
      min-width: 0;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 0;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      position: relative;
    `;
    
    // Create scene container (full size with background)
    const sceneContainer = document.createElement('div');
    sceneContainer.id = 'scene-container';
    sceneContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow-x: hidden;
      overflow-y: auto;
    `;
    this.sceneContainer = sceneContainer;
    
    // Create button container (floating on top)
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      display: flex;
      gap: 16px;
      z-index: 100;
      pointer-events: none;
    `;
    
    // Create buttons (with click functionality)
    const locations = [
      { id: 'square', label: '广场' },
      { id: 'tavern', label: '酒馆' },
      { id: 'market', label: '市场' },
      { id: 'farm', label: '农场' },
      { id: 'camp', label: '营地' }
    ];
    
    locations.forEach(loc => {
      const button = document.createElement('button');
      button.className = 'location-button';
      button.setAttribute('data-location', loc.id);
      button.textContent = loc.label;
      button.style.cssText = `
        padding: 15px 20px;
        max-width: 120px;
        background: ${loc.id === 'square' ? 'rgba(102, 126, 234, 0.5)' : 'rgba(255, 255, 255, 0.5)'};
        border: 2px solid #667eea;
        border-radius: 12px;
        cursor: pointer;
        font-size: 18px;
        font-weight: bold;
        color: ${loc.id === 'square' ? '#fff' : '#333'};
        transition: all 0.2s;
        backdrop-filter: blur(10px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        pointer-events: auto;
      `;
      
      // Add click event to switch scene
      button.onclick = () => {
        console.log(`[DEBUG] Button clicked: ${loc.id}`);
        this.switchScene(loc.id);
        // Update button styles
        buttonContainer.querySelectorAll('.location-button').forEach(btn => {
          const btnLocation = (btn as HTMLElement).getAttribute('data-location');
          if (btnLocation === loc.id) {
            (btn as HTMLElement).style.background = 'rgba(102, 126, 234, 0.5)';
            (btn as HTMLElement).style.color = '#fff';
          } else {
            (btn as HTMLElement).style.background = 'rgba(255, 255, 255, 0.5)';
            (btn as HTMLElement).style.color = '#333';
          }
        });
      };
      
      // Add hover effect
      button.onmouseenter = () => {
        console.log(`[DEBUG] Mouse enter: ${loc.id}`);
        if (loc.id !== this.currentScene) {
          button.style.background = 'rgba(240, 240, 255, 0.5)';
        }
      };
      
      button.onmouseleave = () => {
        if (loc.id !== this.currentScene) {
          button.style.background = 'rgba(255, 255, 255, 0.5)';
        }
      };
      
      buttonContainer.appendChild(button);
      console.log(`[DEBUG] Button created and added: ${loc.id}`);
    });
    
    stageArea.appendChild(sceneContainer);
    stageArea.appendChild(buttonContainer);
    
    // Load initial scene
    this.switchScene('square');

    // Right panel - Action panel
    const actionPanel = document.createElement('div');
    actionPanel.id = 'action-panel';
    actionPanel.className = 'game-panel';
    actionPanel.style.cssText = `
      width: 490px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 16px;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    actionPanel.innerHTML = '';

    gameLayout.appendChild(stagePanel);
    gameLayout.appendChild(stageArea);
    gameLayout.appendChild(actionPanel);

    // Add to UI container
    const uiContainer = document.getElementById('ui-container');
    if (uiContainer) {
      uiContainer.appendChild(navbar);
      uiContainer.appendChild(gameLayout);
      
      // Initialize DialogueModal
      this.dialogueModal = new DialogueModal('dialogue-modal', this.uiManager, this.eventSystem, this.world);
      uiContainer.appendChild(this.dialogueModal.element);
    }

    // Add hover effects to stage items
    const stageItems = stagePanel.querySelectorAll('.stage-item');
    stageItems.forEach((item, index) => {
      const stageId = (item as HTMLElement).getAttribute('data-stage');
      if (stageId && this.unlockedStages.has(stageId)) {
        // Add click handler for unlocked stages
        item.addEventListener('click', () => {
          this.switchStage(stageId);
        });
        
        item.addEventListener('mouseenter', () => {
          // Only apply hover effect if not the current stage
          if (stageId !== this.currentStage) {
            (item as HTMLElement).style.background = '#e0e0e0';
          }
        });
        item.addEventListener('mouseleave', () => {
          // Restore background based on whether it's the current stage
          if (stageId === this.currentStage) {
            (item as HTMLElement).style.background = 'rgba(40, 167, 69, 0.8)';
          } else {
            (item as HTMLElement).style.background = '#f0f0f0';
          }
        });
      }
    });
    
    // Set initial active stage button style
    this.updateStageButtonStyles();

    // Store references
    this.mainHUD = navbar;
    
    // Ensure all UI panels are hidden (fix for panels covering buttons)
    setTimeout(() => {
      this.uiManager.hideAllComponents();
      console.log('[DEBUG] All UI panels hidden after HUD creation');
    }, 100);
  }

  private handleMenuButtonClick(panelType: string): void {
    // Hide all panels first
    this.uiManager.hideAllComponents();

    // Show the requested panel
    switch (panelType) {
      case 'quest-overview':
        this.showQuestOverviewModal();
        break;
      case 'card-collection':
        if (this.lockedButtons.has('card-collection')) {
          this.showNotification('卡牌图鉴尚未解锁，请提升智者小么的好感度', 'warning');
          return;
        }
        this.showCardCollection();
        break;
      case 'dev':
        this.showDeveloperPanel();
        break;
      case 'save-load':
        this.showSaveLoadPanel();
        break;
      case 'character':
        this.showCharacterRoster();
        break;
      case 'inventory':
        this.uiManager.showComponent('inventory-panel');
        break;
      case 'craft':
      case 'crafting':
        this.uiManager.showComponent('crafting-panel');
        break;
      case 'shop':
        this.showNotImplemented('商店系统');
        break;
      case 'farm':
      case 'farming':
        this.uiManager.showComponent('farming-panel');
        break;
      case 'explore':
      case 'exploration':
        this.uiManager.showComponent('exploration-panel');
        break;
      case 'collection':
        // Collection is part of farming panel
        this.uiManager.showComponent('farming-panel');
        break;
      case 'settings':
        this.showNotImplemented('设置面板');
        break;
      default:
        console.warn(`Unknown panel type: ${panelType}`);
        break;
    }
  }
  
  private showDeveloperPanel(): void {
    // Create overlay (no blur, transparent background)
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    // Create panel (larger size to accommodate more buttons)
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;
    
    // Title
    const title = document.createElement('h2');
    title.textContent = '🛠️ 开发者功能';
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #333;
      font-size: 20px;
      text-align: center;
      font-weight: bold;
    `;
    
    // Developer functions
    const devFunctions = [
      { label: '💰 金币 +10000', action: () => this.devAddGold() },
      { label: '💎 水晶 +100', action: () => this.devAddCrystal() },
      { label: '⏰ 增加时间', action: () => this.devAdvanceTime() },
      { label: '🗺️ 解锁所有关卡', action: () => this.devUnlockAllStages() },
      { label: '👥 获取4个随机冒险者', action: () => this.devAddRandomAdventurers() },
      { label: '🌟 获得异界角色', action: () => this.devAddOtherworldCharacter() },
      { label: '⚔️ 获取4个随机武器装备', action: () => this.devAddRandomWeapons() },
      { label: '🛡️ 获取4个随机护甲装备', action: () => this.devAddRandomArmor() },
      { label: '🔰 获取4个随机副手装备', action: () => this.devAddRandomOffhand() },
      { label: '💍 获取4个随机杂项装备', action: () => this.devAddRandomAccessory() },
      { label: '🧪 获得每种药剂各1个', action: () => this.devAddAllPotions() },
      { label: '📦 添加一个物品', action: () => this.devShowItemSelector() },
      { label: '💖 增加好感度', action: () => this.devIncreaseAffinity() },
      { label: '✨ 所有角色恢复100魔法值', action: () => this.devRestoreMana() },
      { label: '⬆️ 所有角色提升1级', action: () => this.devLevelUpAll() },
      { label: '👹 生成一个敌人', action: () => this.devSpawnEnemy() },
      { label: '⚠️ 危机值 +100%', action: () => this.devIncreaseCrisis() },
      { label: '🎴 获取卡牌', action: () => this.devGetAllCards() },
      { label: '✨ 开启卡牌闪膜', action: () => this.devEnableCardHolographic() },
      { label: '🔓 解锁所有NPC', action: () => this.devUnlockAllNPCs() }
    ];
    
    // Create button grid (2 columns)
    const buttonGrid = document.createElement('div');
    buttonGrid.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 16px;
    `;
    
    // Create buttons
    devFunctions.forEach(func => {
      const button = document.createElement('button');
      button.textContent = func.label;
      button.style.cssText = `
        padding: 12px 16px;
        background: #667eea;
        border: none;
        border-radius: 6px;
        color: white;
        font-size: 13px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      button.addEventListener('mouseenter', () => {
        button.style.background = '#5568d3';
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.3)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = '#667eea';
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = 'none';
      });
      button.addEventListener('click', () => {
        func.action();
      });
      buttonGrid.appendChild(button);
    });
    
    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    closeButton.style.cssText = `
      width: 100%;
      padding: 12px;
      margin-top: 8px;
      background: #e0e0e0;
      border: none;
      border-radius: 6px;
      color: #333;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#d0d0d0';
      closeButton.style.transform = 'translateY(-2px)';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#e0e0e0';
      closeButton.style.transform = 'translateY(0)';
    });
    closeButton.addEventListener('click', () => {
      overlay.remove();
    });
    
    // Assemble panel
    panel.appendChild(title);
    panel.appendChild(buttonGrid);
    panel.appendChild(closeButton);
    overlay.appendChild(panel);
    
    // Add to document
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }
  
  // Developer functions
  private devAddGold(): void {
    if (!this.playerEntity) {
      this.showNotification('玩家实体未初始化', 'error');
      return;
    }
    this.currencySystem.addCurrency(this.world, this.playerEntity.id, { gold: 10000 }, '开发者功能');
    this.updateCurrencyDisplay();
    this.showNotification('已添加 10000 金币', 'success');
  }
  
  private devAddCrystal(): void {
    if (!this.playerEntity) {
      this.showNotification('玩家实体未初始化', 'error');
      return;
    }
    this.currencySystem.addCurrency(this.world, this.playerEntity.id, { crystal: 100 }, '开发者功能');
    this.updateCurrencyDisplay();
    this.showNotification('已添加 100 水晶', 'success');
  }
  
  private devAdvanceTime(): void {
    // Set day/night progress to 99%
    this.dayNightProgress = 99;
    
    // Update progress bar immediately
    const progressFill = document.getElementById('day-night-progress-fill');
    if (progressFill) {
      progressFill.style.width = '99%';
    }
    
    const timePhase = this.isDaytime ? '白天' : '夜晚';
    this.showNotification(`⏰ 时间已加速到 ${timePhase} 99%`, 'success');
  }
  
  private devUnlockAllStages(): void {
    this.unlockedStages.add('village');
    this.unlockedStages.add('grassland');
    this.unlockedStages.add('forest');
    this.unlockedStages.add('cave');
    this.updateStagePanel();
    this.updateStageButtonStyles();
    this.showNotification('已解锁所有关卡', 'success');
  }
  
  private devAddRandomAdventurers(): void {
    for (let i = 0; i < 4; i++) {
      const adventurer = this.npcSystem.createAdventurer();
      this.npcSystem.recruitCharacter(adventurer);
      // Note: Do NOT apply hunger BUFF here - it should only be applied when entering battle
    }
    this.showNotification('已添加 4 个随机冒险者', 'success');
  }
  
  private devAddAllPotions(): void {
    const potionIds = [
      'apprentice_healing_potion',
      'apprentice_mana_potion',
      'apprentice_hardening_potion',
      'apprentice_strength_potion',
      'apprentice_speed_potion'
    ];
    
    let count = 0;
    potionIds.forEach(potionId => {
      this.itemSystem.addItem(potionId, 1);
      count++;
    });
    
    this.showNotification(`已添加 ${count} 种药剂各1个`, 'success');
  }
  
  private devIncreaseAffinity(): void {
    // Check if a character is currently displayed in the action panel
    if (!this.currentDisplayedCharacterId) {
      this.showNotification('请先在右侧操作面板中选择一个角色', 'error');
      return;
    }
    
    // Get the character data
    const character = this.npcSystem.getRecruitedCharacter(this.currentDisplayedCharacterId) || 
                      this.npcSystem.getNPC(this.currentDisplayedCharacterId);
    
    if (!character) {
      this.showNotification('未找到该角色', 'error');
      return;
    }
    
    // Increase affinity by 10
    const oldAffinity = character.affinity || 0;
    const newAffinity = Math.min(100, oldAffinity + 10);
    character.affinity = newAffinity;
    
    // Check affinity milestone rewards
    this.checkAffinityRewards(this.currentDisplayedCharacterId, newAffinity);
    
    // Update the display
    this.showNPCDetails(character);
    
    // Show notification
    this.showNotification(`${character.name}的好感度 +10 (${oldAffinity} → ${newAffinity})`, 'success');
  }
  
  private devRestoreMana(): void {
    const characters = this.npcSystem.getRecruitedCharacters();
    let count = 0;
    characters.forEach(char => {
      const wasMPFull = char.currentMP >= char.maxMP;
      
      // Restore 100 MP to each character
      char.currentMP = Math.min(char.maxMP, char.currentMP + 100);
      count++;
      
      // If MP just became full and character has active skill, trigger skill casting
      const isMPFullNow = char.currentMP >= char.maxMP;
      if (!wasMPFull && isMPFullNow && char.activeSkill && this.battleSystem) {
        // Find the character sprite in battle system and trigger skill
        this.battleSystem.triggerSkillForCharacter(char.id);
      }
    });
    
    // Update party slot UI to reflect changes
    this.updatePartySlotsBars();
    
    this.showNotification(`已为 ${count} 个角色恢复 100 魔法值`, 'success');
  }
  
  private devLevelUpAll(): void {
    const characters = this.npcSystem.getRecruitedCharacters();
    characters.forEach(char => {
      this.npcSystem.addExperience(char.id, 999999); // Add enough EXP to level up
    });
    this.showNotification('所有角色已提升 1 级', 'success');
  }

  private devSpawnEnemy(): void {
    if (!this.isCurrentStageCombat() || !this.enemySystem) {
      this.showNotification('只能在战斗场景中生成敌人', 'error');
      return;
    }

    // Define the enemy types that can spawn in each stage
    // Separate normal enemies and boss enemies
    const stageEnemies: Record<string, { normal: string[], boss: string }> = {
      grassland: {
        normal: [
          'enemy_wetland_two_headed_snake',
          'enemy_sweet_syrup_slime',
          'enemy_giant_grass_mushroom_worm'
        ],
        boss: 'enemy_red_mane'
      },
      forest: {
        normal: [
          'enemy_bitter_root_sunflower',
          'enemy_blue_mushroom_spider',
          'enemy_salt_stone_behemoth'
        ],
        boss: 'enemy_huke'
      },
      cave: {
        normal: [
          'enemy_corpse_potato_plant',
          'enemy_fire_tongue_frog',
          'enemy_giant_tooth_vine'
        ],
        boss: 'enemy_ghost_lizard'
      }
    };

    // Get enemy list for current stage
    const stageConfig = stageEnemies[this.currentStage] || stageEnemies.grassland;

    // Check if crisis value is at 100% to spawn boss
    const crisisValue = this.battleSystem.getCrisisValue();
    let enemyType: string;
    
    if (crisisValue >= 100) {
      // Spawn boss when crisis is full
      enemyType = stageConfig.boss;
    } else {
      // Spawn normal enemy
      const normalEnemies = stageConfig.normal;
      enemyType = normalEnemies[Math.floor(Math.random() * normalEnemies.length)];
    }
    
    // Create enemy
    const enemy = this.enemySystem.createEnemy(enemyType);
    if (enemy) {
      // Spawn enemy far from adventurers
      this.battleSystem.spawnCharacterAwayFromAdventurers(enemy, 200);
      this.showNotification(`已生成敌人: ${enemy.name}`, 'success');
    } else {
      this.showNotification('生成敌人失败', 'error');
    }
  }

  private devIncreaseCrisis(): void {
    if (!this.isCurrentStageCombat()) {
      this.showNotification('只能在战斗场景中增加危机值', 'error');
      return;
    }

    this.battleSystem.addCrisisValue(100);
    this.showNotification('危机值 +100%', 'success');
  }
  
  private devAddRandomWeapons(): void {
    // Weapon equipment IDs from equipment-recipes.json with their rarities
    const weaponIds = [
      { id: 'copper_longsword', rarity: 0 },  // common
      { id: 'oak_wand', rarity: 0 },          // common
      { id: 'iron_spear', rarity: 0 },        // common
      { id: 'birch_wand', rarity: 0 },        // common
      { id: 'red_moon', rarity: 1 },          // rare
      { id: 'sirius', rarity: 1 },            // rare
      { id: 'crusher', rarity: 1 },           // rare
      { id: 'gravedigger', rarity: 1 },       // rare
      { id: 'legion_axe', rarity: 1 },        // rare
      { id: 'blue_dawn_wand', rarity: 1 },    // rare
      { id: 'former_emperor', rarity: 2 },    // epic
      { id: 'pope', rarity: 2 }               // epic
    ];
    let count = 0;
    for (let i = 0; i < 4; i++) {
      const randomWeapon = weaponIds[Math.floor(Math.random() * weaponIds.length)];
      
      // Generate affix for equipment
      let affix = undefined;
      if (this.affixSelector) {
        try {
          affix = this.affixSelector.selectAffixes(randomWeapon.rarity as any);
        } catch (error) {
          console.error('Failed to assign affix to equipment:', error);
        }
      }
      
      this.itemSystem.addItem(randomWeapon.id, 1, affix);
      count++;
    }
    this.showNotification(`已添加 ${count} 个随机武器装备`, 'success');
  }
  
  private devAddRandomArmor(): void {
    // Armor equipment IDs from equipment-recipes.json with their rarities
    const armorIds = [
      { id: 'copper_chestplate', rarity: 0 }, // common
      { id: 'oak_plate_armor', rarity: 0 },   // common
      { id: 'chain_mail', rarity: 0 },        // common
      { id: 'birch_plate_armor', rarity: 0 }, // common
      { id: 'red_tide', rarity: 1 },          // rare
      { id: 'death_god', rarity: 1 },         // rare
      { id: 'legion_armor', rarity: 1 },      // rare
      { id: 'blue_dawn_robe', rarity: 1 },    // rare
      { id: 'glory', rarity: 2 }              // epic
    ];
    let count = 0;
    for (let i = 0; i < 4; i++) {
      const randomArmor = armorIds[Math.floor(Math.random() * armorIds.length)];
      
      // Generate affix for equipment
      let affix = undefined;
      if (this.affixSelector) {
        try {
          affix = this.affixSelector.selectAffixes(randomArmor.rarity as any);
        } catch (error) {
          console.error('Failed to assign affix to equipment:', error);
        }
      }
      
      this.itemSystem.addItem(randomArmor.id, 1, affix);
      count++;
    }
    this.showNotification(`已添加 ${count} 个随机护甲装备`, 'success');
  }
  
  private devAddRandomOffhand(): void {
    // Offhand equipment IDs from equipment-recipes.json with their rarities
    const offhandIds = [
      { id: 'small_round_shield', rarity: 0 },    // common
      { id: 'copper_tower_shield', rarity: 0 },   // common
      { id: 'iron_round_shield', rarity: 0 },     // common
      { id: 'kitchen_knife', rarity: 0 },          // common
      { id: 'bleeder', rarity: 1 },               // rare
      { id: 'skull_crusher', rarity: 1 },          // rare
      { id: 'legion_round_shield', rarity: 1 },   // rare
      { id: 'legion_mirror_shield', rarity: 1 },  // rare
      { id: 'unity', rarity: 2 }                  // epic
    ];
    let count = 0;
    for (let i = 0; i < 4; i++) {
      const randomOffhand = offhandIds[Math.floor(Math.random() * offhandIds.length)];
      
      // Generate affix for equipment
      let affix = undefined;
      if (this.affixSelector) {
        try {
          affix = this.affixSelector.selectAffixes(randomOffhand.rarity as any);
        } catch (error) {
          console.error('Failed to assign affix to equipment:', error);
        }
      }
      
      this.itemSystem.addItem(randomOffhand.id, 1, affix);
      count++;
    }
    this.showNotification(`已添加 ${count} 个随机副手装备`, 'success');
  }
  
  private devAddRandomAccessory(): void {
    // Accessory equipment IDs from equipment-recipes.json with their rarities
    const accessoryIds = [
      { id: 'copper_ring', rarity: 0 },       // common
      { id: 'copper_necklace', rarity: 0 },   // common
      { id: 'iron_ring', rarity: 0 },         // common
      { id: 'iron_necklace', rarity: 0 },     // common
      { id: 'red_shadow', rarity: 1 },        // rare
      { id: 'ancestral_teaching', rarity: 1 },// rare
      { id: 'legion_ring', rarity: 1 },       // rare
      { id: 'legion_necklace', rarity: 1 },   // rare
      { id: 'devotion', rarity: 2 }           // epic
    ];
    let count = 0;
    for (let i = 0; i < 4; i++) {
      const randomAccessory = accessoryIds[Math.floor(Math.random() * accessoryIds.length)];
      
      // Generate affix for equipment
      let affix = undefined;
      if (this.affixSelector) {
        try {
          affix = this.affixSelector.selectAffixes(randomAccessory.rarity as any);
        } catch (error) {
          console.error('Failed to assign affix to equipment:', error);
        }
      }
      
      this.itemSystem.addItem(randomAccessory.id, 1, affix);
      count++;
    }
    this.showNotification(`已添加 ${count} 个随机杂项装备`, 'success');
  }

  private devGetAllCards(): void {
    this.cardSystem.addAllCards();
    const progress = this.cardSystem.getCollectionProgress();
    this.showNotification(`已获取所有卡牌 (${progress.owned}/${progress.total})`, 'success');
  }

  private devEnableCardHolographic(): void {
    // Enable holographic effect for all cards directly via cardSystem
    const allCards = this.cardSystem.getAllCards();
    let count = 0;
    allCards.forEach((c: any) => {
      if (c.holographicTexture && c.holographicName) {
        c.holographic = true;
        count++;
      }
    });

    // Also update the live detail panel if it's open
    if (typeof (window as any).toggleCardHolographic === 'function') {
      (window as any).toggleCardHolographic(true);
    }

    // Refresh card collection panel if it's open
    const collectionPanel = document.getElementById('card-collection-panel');
    if (collectionPanel) {
      collectionPanel.remove();
      this.showCardCollection();
    }

    this.showNotification(`✨ 已为 ${count} 张卡牌开启闪膜效果`, 'success');
  }

  private devUnlockAllNPCs(): void {
    this.lockedNPCs.clear();
    this.lockedButtons.clear();
    this.lockedRecipes.clear();
    this.reloadCurrentScene();
    this.showNotification('🔓 已解锁所有NPC、功能按钮和配方', 'success');
  }

  // ==================== Save/Load System ====================

  private readonly SAVE_SLOT_COUNT = 5;
  private readonly AUTO_SAVE_KEY = 'save_auto';

  private getSaveSlotKey(slot: number): string { return `save_slot_${slot}`; }

  private getSlotMetadata(slotKey: string): { timestamp: number } | null {
    try {
      const raw = localStorage.getItem(`${slotKey}_ui`);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return { timestamp: data.saveTimestamp || 0 };
    } catch { return null; }
  }

  private showSaveLoadPanel(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    const panel = document.createElement('div');
    panel.style.cssText = `background: white; border-radius: 12px; padding: 24px; max-width: 520px; width: 90%; max-height: 80vh; overflow-y: auto;`;

    const renderSlots = () => {
      let html = '';
      // Auto-save slot
      const autoMeta = this.getSlotMetadata(this.AUTO_SAVE_KEY);
      const autoTime = autoMeta ? new Date(autoMeta.timestamp).toLocaleString('zh-CN') : '';
      html += `<div style="background:#f0f7ff;border:2px solid #90caf9;border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between;">
        <div><div style="font-weight:bold;color:#1565c0;">🔄 自动存档</div><div style="font-size:12px;color:#666;margin-top:4px;">${autoMeta ? autoTime : '暂无自动存档'}</div></div>
        <button class="sl-load" data-slot="${this.AUTO_SAVE_KEY}" style="padding:8px 16px;background:${autoMeta ? '#4caf50' : '#ccc'};border:none;border-radius:6px;color:white;font-weight:bold;cursor:${autoMeta ? 'pointer' : 'not-allowed'};font-size:13px;" ${autoMeta ? '' : 'disabled'}>加载</button>
      </div>`;
      // Manual slots
      for (let i = 1; i <= this.SAVE_SLOT_COUNT; i++) {
        const key = this.getSaveSlotKey(i);
        const meta = this.getSlotMetadata(key);
        const t = meta ? new Date(meta.timestamp).toLocaleString('zh-CN') : '';
        const empty = !meta;
        html += `<div style="background:${empty ? '#fafafa' : '#f5f5f5'};border:2px solid ${empty ? '#e0e0e0' : '#bdbdbd'};border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between;">
          <div style="flex:1;min-width:0;"><div style="font-weight:bold;color:#333;">📁 存档 ${i}</div><div style="font-size:12px;color:#666;margin-top:4px;">${empty ? '空槽位' : t}</div></div>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <button class="sl-save" data-slot="${key}" style="padding:8px 14px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border:none;border-radius:6px;color:white;font-weight:bold;cursor:pointer;font-size:13px;">保存</button>
            <button class="sl-load" data-slot="${key}" style="padding:8px 14px;background:${empty ? '#ccc' : '#4caf50'};border:none;border-radius:6px;color:white;font-weight:bold;cursor:${empty ? 'not-allowed' : 'pointer'};font-size:13px;" ${empty ? 'disabled' : ''}>加载</button>
            ${!empty ? `<button class="sl-del" data-slot="${key}" data-idx="${i}" style="padding:8px 10px;background:#ef5350;border:none;border-radius:6px;color:white;font-weight:bold;cursor:pointer;font-size:13px;">🗑</button>` : ''}
          </div>
        </div>`;
      }
      panel.innerHTML = `<h2 style="margin:0 0 16px 0;text-align:center;font-size:22px;">💾 存档管理</h2>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">${html}</div>
        <button id="sl-close" style="width:100%;padding:10px;background:rgba(0,0,0,0.1);border:none;border-radius:8px;color:#666;font-size:14px;cursor:pointer;">关闭</button>`;
      // Bind
      panel.querySelectorAll('.sl-save').forEach(b => b.addEventListener('click', () => {
        const k = (b as HTMLElement).getAttribute('data-slot')!;
        if (this.getSlotMetadata(k)) { this.showConfirmDialog('该槽位已有存档，确认覆盖？', () => { this.saveToSlot(k); renderSlots(); }); }
        else { this.saveToSlot(k); renderSlots(); }
      }));
      panel.querySelectorAll('.sl-load').forEach(b => { if ((b as HTMLButtonElement).disabled) return; b.addEventListener('click', () => { const k = (b as HTMLElement).getAttribute('data-slot')!; overlay.remove(); this.showConfirmDialog('当前未保存的进度将会丢失，确认加载？', () => this.loadFromSlot(k)); }); });
      panel.querySelectorAll('.sl-del').forEach(b => b.addEventListener('click', () => {
        const k = (b as HTMLElement).getAttribute('data-slot')!;
        const idx = (b as HTMLElement).getAttribute('data-idx')!;
        this.showConfirmDialog(`确认删除存档 ${idx}？此操作不可撤销。`, () => {
          localStorage.removeItem(k); localStorage.removeItem(`${k}_metadata`); localStorage.removeItem(`${k}_ui`);
          this.showNotification(`🗑️ 存档 ${idx} 已删除`, 'success'); renderSlots();
        });
      }));
      panel.querySelector('#sl-close')!.addEventListener('click', () => overlay.remove());
    };
    renderSlots();
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  private saveToSlot(slotKey: string, isAuto: boolean = false): void {
    // Only allow manual saving in village stage; auto-save works in all stages
    if (!this.isNonCombatStage(this.currentStage)) {
      if (!isAuto) {
        this.showNotification('⚠️ 只能在村庄中保存游戏', 'warning');
        return;
      }
      // isAuto=true: continue to save even in combat stages
    }
    try {
      const worldSaved = SaveSystem.saveToLocalStorage(this.world, slotKey);
      if (!worldSaved) { if (!isAuto) this.showNotification('保存失败', 'error'); return; }

      const uiState: any = {
        questData: this.serializeQuestState(),
        lockedNPCs: Array.from(this.lockedNPCs),
        lockedButtons: Array.from(this.lockedButtons),
        lockedRecipes: Array.from(this.lockedRecipes),
        exchangedCards: Array.from(this.exchangedCards),
        claimedAffinityRewards: Array.from(this.claimedAffinityRewards.entries()).map(([n, t]) => [n, Array.from(t)]),
        dailyMembershipFoodClaimed: Array.from(this.dailyMembershipFoodClaimed),
        currentScene: this.currentScene, currentStage: this.currentStage,
        unlockedStages: Array.from(this.unlockedStages),
        dayNightProgress: this.dayNightProgress, isDaytime: this.isDaytime, currentDayOfWeek: this.currentDayOfWeek,
        merchantRefreshCounts: Array.from(this.merchantRefreshCounts.entries()),
        playerStallItems: Array.from(this.playerStallItems.entries()), isStallOpen: this.isStallOpen,
        hasShownLootDropHint: this.hasShownLootDropHint, hasShownLootPanelHint: this.hasShownLootPanelHint, hasShownTeamBagHint: this.hasShownTeamBagHint,
        saveTimestamp: Date.now(),
        inventory: this.itemSystem.getInventory(),
        itemInstances: this.itemSystem.getAllItemInstances(),
        ownedCards: this.cardSystem.getOwnedCards().map((c: any) => ({ id: c.id, holographic: c.holographic || false })),
      };
      localStorage.setItem(`${slotKey}_ui`, JSON.stringify(uiState));
      if (!isAuto) this.showNotification('💾 游戏进度已保存', 'success');
      else console.log('[SaveSystem] Auto-save completed');
    } catch (error) {
      console.error('Save failed:', error);
      if (!isAuto) this.showNotification('保存失败：' + (error as Error).message, 'error');
    }
  }

  private loadFromSlot(slotKey: string): void {
    // Only allow loading in village stage
    if (!this.isNonCombatStage(this.currentStage)) {
      this.showNotification('⚠️ 只能在村庄中加载存档', 'warning');
      return;
    }
    try {
      const loadedWorld = SaveSystem.loadFromLocalStorage(slotKey);
      if (!loadedWorld) { this.showNotification('加载失败：找不到存档数据', 'error'); return; }
      const uiStateStr = localStorage.getItem(`${slotKey}_ui`);
      if (!uiStateStr) { this.showNotification('加载失败：找不到UI状态数据', 'error'); return; }
      const uiState = JSON.parse(uiStateStr);

      // Restore World
      const allCurrentEntities = this.world.getAllEntities();
      for (const entity of allCurrentEntities) { try { this.world.removeEntity(entity.id); } catch {} }
      for (const entity of loadedWorld.getAllEntities()) {
        try {
          const ne = this.world.createEntity(entity.id);
          const comps = (loadedWorld as any).componentManager?.getEntityComponents(entity.id) || [];
          for (const c of comps) (this.world as any).componentManager.addComponent(ne.id, { name: c.type }, c);
        } catch (e) { console.warn(`Failed to restore entity ${entity.id}:`, e); }
      }

      // Restore UI state
      if (uiState.questData) this.deserializeQuestState(uiState.questData);
      if (uiState.lockedNPCs) this.lockedNPCs = new Set(uiState.lockedNPCs);
      if (uiState.lockedButtons) this.lockedButtons = new Set(uiState.lockedButtons);
      if (uiState.lockedRecipes) this.lockedRecipes = new Set(uiState.lockedRecipes);
      if (uiState.exchangedCards) this.exchangedCards = new Set(uiState.exchangedCards);
      if (uiState.claimedAffinityRewards) {
        this.claimedAffinityRewards = new Map(uiState.claimedAffinityRewards.map(([n, t]: [string, number[]]) => [n, new Set(t)]));
      }
      if (uiState.dailyMembershipFoodClaimed) this.dailyMembershipFoodClaimed = new Set(uiState.dailyMembershipFoodClaimed);
      if (uiState.currentScene) this.currentScene = uiState.currentScene;
      if (uiState.currentStage) this.currentStage = uiState.currentStage;
      if (uiState.unlockedStages) this.unlockedStages = new Set(uiState.unlockedStages);
      if (uiState.dayNightProgress !== undefined) this.dayNightProgress = uiState.dayNightProgress;
      if (uiState.isDaytime !== undefined) this.isDaytime = uiState.isDaytime;
      if (uiState.currentDayOfWeek !== undefined) this.currentDayOfWeek = uiState.currentDayOfWeek;
      if (uiState.merchantRefreshCounts) this.merchantRefreshCounts = new Map(uiState.merchantRefreshCounts);
      if (uiState.playerStallItems) this.playerStallItems = new Map(uiState.playerStallItems);
      if (uiState.isStallOpen !== undefined) this.isStallOpen = uiState.isStallOpen;
      if (uiState.hasShownLootDropHint !== undefined) this.hasShownLootDropHint = uiState.hasShownLootDropHint;
      if (uiState.hasShownLootPanelHint !== undefined) this.hasShownLootPanelHint = uiState.hasShownLootPanelHint;
      if (uiState.hasShownTeamBagHint !== undefined) this.hasShownTeamBagHint = uiState.hasShownTeamBagHint;

      // Restore inventory
      if (uiState.inventory || uiState.itemInstances) {
        this.itemSystem.clearInventory();
        if (uiState.inventory) { for (const s of uiState.inventory) { if (s.quantity > 0) this.itemSystem.addItem(s.itemId, s.quantity, s.affix); } }
        if (uiState.itemInstances) {
          for (const inst of uiState.itemInstances) {
            if (!uiState.inventory?.some((s: any) => s.itemId === inst.itemId && inst.quantity === s.quantity))
              this.itemSystem.addItem(inst.itemId, 1, inst.affix);
          }
        }
      }

      // Restore cards
      if (uiState.ownedCards) {
        for (const cd of uiState.ownedCards) {
          this.cardSystem.addCard(cd.id);
          if (cd.holographic) { const c = this.cardSystem.getCard(cd.id); if (c) (c as any).holographic = true; }
        }
      }

      // Validate restored stage/scene, fallback to village/square if invalid
      const validStages = new Set(['village', 'grassland', 'forest', 'cave']);
      if (!this.currentStage || !validStages.has(this.currentStage)) {
        this.currentStage = 'village';
        this.currentScene = 'square';
      }

      // Load the appropriate scene based on restored stage
      this.updateCurrencyDisplay();
      if (this.isNonCombatStage(this.currentStage)) {
        this.switchScene(this.currentScene);
      } else {
        this.loadStageDefaultScene();
      }
      this.updateStageButtonStyles();
      this.updateSceneButtons();
      this.showNotification('📂 存档已加载', 'success');
    } catch (error) {
      console.error('Load failed:', error);
      this.showNotification('加载失败：' + (error as Error).message, 'error');
    }
  }

  /**
   * Initialize all recipes as locked (except default unlocked ones)
   */
  private initLockedRecipes(): void {
    // These recipes are unlocked by default
    const defaultUnlocked = new Set([
      'apprentice_healing_potion',  // 炼金师团子 - 学徒级治疗药剂
      'copper_longsword',           // 铁匠ZZ - 铜质长剑
      'small_round_shield',         // 铁匠ZZ - 小圆盾
    ]);

    const cookingRecipes = this.cookingSystem.getAllRecipes();
    const equipmentRecipes = this.equipmentCraftingSystem.getAllRecipes();
    const alchemyRecipes = this.alchemyCraftingSystem.getAllRecipes();
    cookingRecipes.forEach((r: any) => { if (!defaultUnlocked.has(r.id)) this.lockedRecipes.add(r.id); });
    equipmentRecipes.forEach((r: any) => { if (!defaultUnlocked.has(r.id)) this.lockedRecipes.add(r.id); });
    alchemyRecipes.forEach((r: any) => { if (!defaultUnlocked.has(r.id)) this.lockedRecipes.add(r.id); });
    console.log(`[GameUI] Locked ${this.lockedRecipes.size} recipes at game start (${defaultUnlocked.size} default unlocked)`);
  }

  /**
   * Check inventory for blueprint items and unlock corresponding recipes
   */
  private checkBlueprintUnlocks(): void {
    const inventory = this.itemSystem.getInventory();
    for (const slot of inventory) {
      const itemData = this.itemSystem.getItem(slot.itemId);
      if (itemData && itemData.unlockRecipe && this.lockedRecipes.has(itemData.unlockRecipe)) {
        this.lockedRecipes.delete(itemData.unlockRecipe);
        console.log(`[GameUI] Blueprint "${itemData.name}" unlocked recipe: ${itemData.unlockRecipe}`);
      }
    }
  }

  /**
   * Check and grant affinity milestone rewards when affinity changes
   */
  private checkAffinityRewards(npcId: string, newAffinity: number): void {
    const config = this.affinityRewardConfig.get(npcId);
    if (!config) {
      // For adventurer characters without explicit config, grant crystal at 100%
      const npc = this.npcSystem.getNPC(npcId) || this.npcSystem.getRecruitedCharacter(npcId);
      if (npc && npc.type === 'Adventurer' && newAffinity >= 100) {
        if (!this.claimedAffinityRewards.has(npcId)) {
          this.claimedAffinityRewards.set(npcId, new Set());
        }
        const claimed = this.claimedAffinityRewards.get(npcId)!;
        if (!claimed.has(100)) {
          claimed.add(100);
          this.grantAffinityReward('crystal', { amount: 1 }, npc.name, 100);
        }
      }
      return;
    }

    if (!this.claimedAffinityRewards.has(npcId)) {
      this.claimedAffinityRewards.set(npcId, new Set());
    }
    const claimed = this.claimedAffinityRewards.get(npcId)!;

    for (const milestone of config) {
      if (newAffinity >= milestone.threshold && !claimed.has(milestone.threshold)) {
        claimed.add(milestone.threshold);
        const npc = this.npcSystem.getNPC(npcId) || this.npcSystem.getRecruitedCharacter(npcId);
        const npcName = npc ? npc.name : npcId;

        for (const reward of milestone.rewards) {
          this.grantAffinityReward(reward.type, reward.params, npcName, milestone.threshold);
        }
      }
    }
  }

  /**
   * Grant a single affinity reward
   */
  private grantAffinityReward(type: string, params: any, npcName: string, threshold: number): void {
    switch (type) {
      case 'gold':
        if (this.playerEntity) {
          this.currencySystem.addCurrency(this.world, this.playerEntity.id, { gold: params.amount }, `${npcName}好感度${threshold}%奖励`);
          this.updateCurrencyDisplay();
          this.showNotification(`🎁 ${npcName}好感度${threshold}%奖励：${params.amount}金币`, 'success');
        }
        break;
      case 'crystal':
        if (this.playerEntity) {
          this.currencySystem.addCurrency(this.world, this.playerEntity.id, { crystal: params.amount }, `${npcName}好感度${threshold}%奖励`);
          this.updateCurrencyDisplay();
          this.showNotification(`🎁 ${npcName}好感度${threshold}%奖励：${params.amount}水晶`, 'success');
        }
        break;
      case 'unlock_npc':
        this.lockedNPCs.delete(params.npcId);
        const unlockedNpc = this.npcSystem.getNPC(params.npcId);
        const unlockedName = unlockedNpc ? unlockedNpc.name : params.npcId;
        this.showNotification(`🔓 ${npcName}好感度${threshold}%奖励：解锁${unlockedName}`, 'success');
        // Reload current scene to show newly unlocked NPC
        this.reloadCurrentScene();
        break;
      case 'card':
        this.cardSystem.addCard(params.cardId);
        const card = this.cardSystem.getCard(params.cardId);
        const cardName = card ? card.name : params.cardId;
        this.showNotification(`🎁 ${npcName}好感度${threshold}%奖励：获得卡牌「${cardName}」`, 'success');
        break;
      case 'card_holographic':
        const holoCard = this.cardSystem.getCard(params.cardId);
        if (holoCard) {
          (holoCard as any).holographic = true;
          const holoName = holoCard.name;
          this.showNotification(`✨ ${npcName}好感度${threshold}%奖励：卡牌「${holoName}」获得闪膜效果`, 'success');
        }
        break;
      case 'unlock_recipe':
        if (params.recipeIds && Array.isArray(params.recipeIds)) {
          params.recipeIds.forEach((recipeId: string) => this.lockedRecipes.delete(recipeId));
          this.showNotification(`🔓 ${npcName}好感度${threshold}%奖励：解锁${params.recipeIds.length}个配方`, 'success');
        }
        break;
      case 'unlock_button':
        this.lockedButtons.delete(params.buttonId);
        const buttonNames: Record<string, string> = {
          'craft': '铁匠制作',
          'alchemy': '炼金制作',
          'summon': '异界召唤',
          'jobchange': '转职',
          'card-collection': '卡牌图鉴'
        };
        this.showNotification(`🔓 ${npcName}好感度${threshold}%奖励：解锁「${buttonNames[params.buttonId] || params.buttonId}」功能`, 'success');
        break;
      case 'give_item':
        this.itemSystem.addItem(params.itemId, params.quantity || 1);
        const givenItem = this.itemSystem.getItem(params.itemId);
        const givenItemName = givenItem ? givenItem.name : params.itemId;
        this.showNotification(`🎁 ${npcName}好感度${threshold}%奖励：获得「${givenItemName}」`, 'success');
        break;
      case 'remove_item':
        this.itemSystem.removeItem(params.itemId, params.quantity || 1);
        break;
    }
  }

  /**
   * Reload the current scene to reflect NPC unlock changes
   */
  private reloadCurrentScene(): void {
    this.clearSceneContainer();
    if (this.currentScene === 'square') {
      this.loadSquareScene();
    } else if (this.currentScene === 'market') {
      this.loadMarketScene();
    } else if (this.currentScene === 'tavern') {
      this.loadTavernScene();
    }
  }

  private devAddOtherworldCharacter(): void {
    try {
      // Get all otherworld characters from config
      const configManager = ConfigManager.getInstance();
      
      // Check if ConfigManager is initialized
      if (!configManager.isInitialized()) {
        this.showNotification('配置管理器未初始化，请稍后再试', 'error');
        console.error('[GameUI] ConfigManager not initialized');
        return;
      }
      
      const otherworldCharacters = configManager.getOtherworldCharacters();
      console.log('[GameUI] Total otherworld characters:', otherworldCharacters.length);
      
      if (otherworldCharacters.length === 0) {
        this.showNotification('没有可用的异界角色', 'error');
        console.error('[GameUI] No otherworld characters in config');
        return;
      }
      
      // Filter characters with "异界" type
      const otherworldTypeCharacters = otherworldCharacters.filter(char => 
        char.characterTypes && char.characterTypes.includes('异界')
      );
      
      console.log('[GameUI] Filtered otherworld type characters:', otherworldTypeCharacters.length);
      console.log('[GameUI] Characters:', otherworldTypeCharacters.map(c => c.name));
      
      if (otherworldTypeCharacters.length === 0) {
        this.showNotification('没有包含"异界"类型的角色', 'error');
        console.error('[GameUI] No characters with "异界" type found');
        return;
      }
      
      // Create selection UI
      this.showOtherworldCharacterSelection(otherworldTypeCharacters);
    } catch (error) {
      this.showNotification('获取异界角色配置失败', 'error');
      console.error('[GameUI] Failed to get otherworld characters:', error);
    }
  }
  
  private showOtherworldCharacterSelection(otherworldTypeCharacters: OtherworldCharacterConfig[]): void {
    
    // Create selection overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;
    
    // Create panel
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 600px;
      width: 90%;
      max-height: 70vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;
    
    // Title
    const title = document.createElement('h2');
    title.textContent = '🌟 选择异界角色';
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #333;
      font-size: 20px;
      text-align: center;
      font-weight: bold;
    `;
    
    // Character grid (using NPCCard components)
    const characterGrid = document.createElement('div');
    characterGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 20px;
      margin-bottom: 16px;
      justify-items: center;
    `;
    
    otherworldTypeCharacters.forEach(charConfig => {
      // Create temporary NPCData object for NPCCard
      const tempNPCData: NPCData = {
        id: charConfig.id,
        name: charConfig.name,
        title: '', // Empty title so only name is displayed in selector
        emoji: charConfig.portrait + '.png', // Add .png extension for image display
        type: 'Adventurer',
        job: '',
        level: 1,
        maxEXP: 100,
        strength: charConfig.baseAttributes.strength,
        agility: charConfig.baseAttributes.agility,
        wisdom: charConfig.baseAttributes.wisdom,
        skill: charConfig.baseAttributes.technique,
        attack: 0,
        defense: 0,
        moveSpeed: 0,
        dodgeRate: 0,
        critRate: 0,
        critDamage: 0,
        resistance: 0,
        magicPower: 0,
        carryWeight: 0,
        accuracy: 0,
        expRate: 0,
        hpRegen: 0,
        mpRegen: 0,
        weight: 0,
        volume: 0,
        maxHP: 100,
        maxMP: 50,
        currentHP: 100,
        currentMP: 50,
        skills: [],
        equipment: [],
        affinity: 0
      };
      
      // Create NPCCard with click callback
      const npcCard = new NPCCard(tempNPCData, (npcData) => {
        this.createOtherworldCharacter(charConfig);
        overlay.remove();
      });
      
      characterGrid.appendChild(npcCard.getElement());
    });
    
    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '取消';
    closeButton.style.cssText = `
      width: 100%;
      padding: 12px;
      background: #e0e0e0;
      border: none;
      border-radius: 6px;
      color: #333;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#d0d0d0';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#e0e0e0';
    });
    closeButton.addEventListener('click', () => {
      overlay.remove();
    });
    
    // Assemble panel
    panel.appendChild(title);
    panel.appendChild(characterGrid);
    panel.appendChild(closeButton);
    overlay.appendChild(panel);
    
    // Add to document
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  private createOtherworldCharacter(charConfig: OtherworldCharacterConfig): void {
    // Generate unique ID for the character
    const characterId = `otherworld_${charConfig.id}_${Date.now()}`;
    
    // Get random title from NPCSystem's title pool
    const titlePool = ['勇敢的', '胆小的', '好色的', '冷酷的', '目光呆滞的', '口齿不清的', '莽撞的', '谨慎的', '乐观的', '结巴的', '凶猛的', '暴脾气的', '温柔的', '迟钝的', '敏感的', '沉默的', '嘴臭的', '脚臭的', '喋喋不休的', '乐于助人的', '好为人师的', '自信满满的', '魅力四射的', '受欢迎的', '人见人爱的', '社恐的', '眼神躲闪的', '色眯眯的', '勤快的', '懒惰的', '贪吃的', '瘸腿的', '近视的', '爱笑的', '爱哭的', '无口的', '傲娇的', '冷漠的', '纯洁的', '低情商的', '高情商的', '热情洋溢的', '自私的', '慷慨的', '色盲的', '流口水的', '双下巴的', '秃头的', '恐高的', '贤惠的', '大大方方的', '抠抠搜搜的', '大大咧咧的', '娘娘闷闷儿的', '大嗓门的', '自来熟的', '没礼貌的', '客气的', '高效的', '没眼力见的', '欲求不满的'];
    const randomTitle = titlePool[Math.floor(Math.random() * titlePool.length)];
    
    // Get random passive skill from NPCSystem
    const passiveSkills = this.npcSystem.getPassiveSkills();
    const randomPassiveSkill = passiveSkills.length > 0 
      ? passiveSkills[Math.floor(Math.random() * passiveSkills.length)].id 
      : undefined;
    
    // Get job display name
    const jobDisplayName = this.getJobDisplayName(charConfig.startingJob);
    
    // Calculate secondary attributes using NPCSystem's method (same as adventurers)
    const secondaryAttrs = (this.npcSystem as any).calculateSecondaryAttributes(
      charConfig.baseAttributes.strength,
      charConfig.baseAttributes.agility,
      charConfig.baseAttributes.wisdom,
      charConfig.baseAttributes.technique
    );
    
    // Calculate max HP and MP using NPCSystem's method
    const { maxHP, maxMP } = (this.npcSystem as any).calculateMaxHPMP(
      charConfig.baseAttributes.strength,
      charConfig.baseAttributes.agility,
      charConfig.baseAttributes.wisdom,
      charConfig.baseAttributes.technique,
      charConfig.initialState.level
    );
    
    // Create NPC data with calculated attributes
    const npcData: NPCData = {
      id: characterId,
      name: charConfig.name,
      title: randomTitle, // Random title from title pool
      emoji: charConfig.portrait + '.png', // Use portrait from config (e.g., images/touxiang_yijie_Allenes.png)
      type: 'Adventurer',
      level: charConfig.initialState.level,
      maxLevel: 50,
      currentEXP: 0,
      maxEXP: 100,
      currentHP: maxHP, // Use calculated maxHP
      maxHP: maxHP,
      currentMP: 0, // Initial current MP = 0
      maxMP: maxMP, // Use calculated maxMP
      currentHunger: Math.floor(Math.random() * 21) + 30, // Start with 30-50 hunger (hunger bonus)
      maxHunger: charConfig.initialState.maxHunger,
      job: jobDisplayName,
      skills: charConfig.initialSkills?.active || [],
      equipment: [],
      equippedItems: {
        weapon: null,
        armor: null,
        offhand: null,
        accessory: null
      },
      passiveSkill: randomPassiveSkill, // Random passive skill from pool
      activeSkill: charConfig.initialSkills?.active?.[0] || undefined, // 伏魔斩
      learnedActiveSkills: charConfig.initialSkills?.active || [],
      size: 1,
      // Primary attributes (from config)
      strength: charConfig.baseAttributes.strength,
      agility: charConfig.baseAttributes.agility,
      wisdom: charConfig.baseAttributes.wisdom,
      skill: charConfig.baseAttributes.technique,
      // Secondary attributes (calculated from primary attributes, same as adventurers)
      attack: secondaryAttrs.attack,
      defense: secondaryAttrs.defense,
      moveSpeed: secondaryAttrs.moveSpeed,
      dodgeRate: secondaryAttrs.dodgeRate,
      critRate: secondaryAttrs.critRate,
      critDamage: secondaryAttrs.critDamage,
      resistance: secondaryAttrs.resistance,
      magicPower: secondaryAttrs.magicPower,
      carryWeight: 10,
      accuracy: secondaryAttrs.accuracy,
      expRate: secondaryAttrs.expRate,
      hpRegen: secondaryAttrs.hpRegen,
      mpRegen: secondaryAttrs.mpRegen,
      weight: secondaryAttrs.weight,
      volume: secondaryAttrs.volume,
      // Social
      affinity: 0
    };
    
    // Apply combatStats override if configured
    if (charConfig.combatStats) {
      const cs = charConfig.combatStats;
      if (cs.attack !== undefined) npcData.attack = cs.attack;
      if (cs.defense !== undefined) npcData.defense = cs.defense;
      if (cs.moveSpeed !== undefined) npcData.moveSpeed = cs.moveSpeed;
      if (cs.dodgeRate !== undefined) npcData.dodgeRate = cs.dodgeRate;
      if (cs.critRate !== undefined) npcData.critRate = cs.critRate;
      if (cs.critDamage !== undefined) npcData.critDamage = cs.critDamage;
      if (cs.resistance !== undefined) npcData.resistance = cs.resistance;
      if (cs.magicPower !== undefined) npcData.magicPower = cs.magicPower;
      if (cs.carryWeight !== undefined) npcData.carryWeight = cs.carryWeight;
      if (cs.volume !== undefined) npcData.volume = cs.volume;
      if (cs.expRate !== undefined) npcData.expRate = cs.expRate;
      if (cs.healthRegen !== undefined) npcData.hpRegen = cs.healthRegen;
      if (cs.manaRegen !== undefined) npcData.mpRegen = cs.manaRegen;
      if (cs.weight !== undefined) npcData.weight = cs.weight;
    }
    
    // Apply maxHealth override if configured value differs from calculated
    if (charConfig.initialState.maxHealth && charConfig.initialState.maxHealth !== maxHP) {
      npcData.maxHP = charConfig.initialState.maxHealth;
      npcData.currentHP = charConfig.initialState.maxHealth;
    }
    
    // Apply passive skill effects (same as adventurers)
    this.npcSystem.applyPassiveSkillEffects(npcData);
    
    // Register character with NPCSystem
    this.npcSystem.recruitCharacter(npcData);
    
    // Note: Do NOT apply hunger BUFF here - it should only be applied when entering battle
    // The character panel should show base stats without hunger debuff
    
    // Emit event
    this.eventSystem.emit({
      type: 'character_recruited',
      timestamp: Date.now(),
      characterId: characterId,
      rarity: charConfig.rarity,
      isSpecial: true,
      recruitmentMethod: 'developer'
    });
    
    this.showNotification(`✨ 已获得异界角色: ${charConfig.name} (${randomTitle})`, 'success');
    console.log(`[GameUI] Created otherworld character: ${charConfig.name} (${randomTitle})`);
    console.log(`[GameUI] - Avatar: ${charConfig.portrait}.png`);
    console.log(`[GameUI] - Passive skill: ${randomPassiveSkill || 'none'}`);
    console.log(`[GameUI] - Active skill: ${charConfig.initialSkills?.active?.[0] || 'none'}`);
    console.log(`[GameUI] - Initial skills config:`, charConfig.initialSkills);
  }

  private devShowItemSelector(): void {
    // Get all items from item system
    const allItems = this.itemSystem.getAllItems();
    
    if (allItems.length === 0) {
      this.showNotification('没有可用的物品', 'error');
      return;
    }

    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;

    // Create panel
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 800px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;

    // Title
    const title = document.createElement('h2');
    title.textContent = '📦 选择要添加的物品';
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #333;
      font-size: 20px;
      text-align: center;
      font-weight: bold;
    `;

    // Search box
    const searchBox = document.createElement('input');
    searchBox.type = 'text';
    searchBox.placeholder = '搜索物品名称...';
    searchBox.style.cssText = `
      width: 100%;
      padding: 10px;
      margin-bottom: 16px;
      border: 2px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      box-sizing: border-box;
    `;

    // Items container
    const itemsContainer = document.createElement('div');
    itemsContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
      max-height: 400px;
      overflow-y: auto;
    `;

    // Function to render items
    const renderItems = (filter: string = '') => {
      itemsContainer.innerHTML = '';
      
      const filteredItems = allItems.filter(item => 
        filter === '' || item.name.toLowerCase().includes(filter.toLowerCase())
      );

      if (filteredItems.length === 0) {
        const noResults = document.createElement('div');
        noResults.textContent = '没有找到匹配的物品';
        noResults.style.cssText = `
          grid-column: 1 / -1;
          text-align: center;
          padding: 20px;
          color: #999;
        `;
        itemsContainer.appendChild(noResults);
        return;
      }

      filteredItems.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.style.cssText = `
          background: #f5f5f5;
          border: 2px solid #ddd;
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        `;

        // Item icon
        const icon = document.createElement('div');
        icon.style.cssText = `
          width: 60px;
          height: 60px;
          margin: 0 auto 8px;
          background: white;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        `;
        
        if (item.icon && item.icon.includes('images/')) {
          const img = document.createElement('img');
          img.src = item.icon;
          img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
          `;
          img.onerror = () => {
            icon.textContent = '📦';
            icon.style.fontSize = '32px';
          };
          icon.appendChild(img);
        } else {
          icon.textContent = '📦';
          icon.style.fontSize = '32px';
        }

        // Item name
        const name = document.createElement('div');
        name.textContent = item.name;
        name.style.cssText = `
          font-size: 12px;
          font-weight: bold;
          color: #333;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        `;

        // Item rarity
        const rarityColor = this.itemSystem.getRarityColor(item.rarity);
        const rarityName = this.itemSystem.getRarityName(item.rarity);
        const rarity = document.createElement('div');
        rarity.textContent = rarityName;
        rarity.style.cssText = `
          font-size: 10px;
          color: ${rarityColor};
          font-weight: bold;
        `;

        itemCard.appendChild(icon);
        itemCard.appendChild(name);
        itemCard.appendChild(rarity);

        // Hover effect
        itemCard.addEventListener('mouseenter', () => {
          itemCard.style.background = '#e8e8e8';
          itemCard.style.borderColor = '#667eea';
          itemCard.style.transform = 'translateY(-2px)';
          itemCard.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
        });
        itemCard.addEventListener('mouseleave', () => {
          itemCard.style.background = '#f5f5f5';
          itemCard.style.borderColor = '#ddd';
          itemCard.style.transform = 'translateY(0)';
          itemCard.style.boxShadow = 'none';
        });

        // Click to add item
        itemCard.addEventListener('click', () => {
          const quantity = item.stackSize > 1 ? 10 : 1; // Add 10 for stackable items, 1 for non-stackable
          
          // Generate affixes for equipment items based on rarity
          if (item.type === 'equipment' && this.affixSelector) {
            for (let i = 0; i < quantity; i++) {
              let affix = undefined;
              try {
                affix = this.affixSelector.selectAffixes(item.rarity as any);
              } catch (error) {
                console.error('Failed to assign affix to equipment:', error);
              }
              this.itemSystem.addItem(item.id, 1, affix);
            }
          } else {
            this.itemSystem.addItem(item.id, quantity);
          }
          
          this.showNotification(`已添加 ${quantity}x ${item.name}`, 'success');
          overlay.remove();
        });

        itemsContainer.appendChild(itemCard);
      });
    };

    // Initial render
    renderItems();

    // Search functionality
    searchBox.addEventListener('input', (e) => {
      const filter = (e.target as HTMLInputElement).value;
      renderItems(filter);
    });

    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    closeButton.style.cssText = `
      width: 100%;
      padding: 12px;
      background: #e0e0e0;
      border: none;
      border-radius: 6px;
      color: #333;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#d0d0d0';
      closeButton.style.transform = 'translateY(-2px)';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#e0e0e0';
      closeButton.style.transform = 'translateY(0)';
    });
    closeButton.addEventListener('click', () => {
      overlay.remove();
    });

    // Assemble panel
    panel.appendChild(title);
    panel.appendChild(searchBox);
    panel.appendChild(itemsContainer);
    panel.appendChild(closeButton);
    overlay.appendChild(panel);

    // Add to document
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  /**
   * Show card collection panel
   */
  private showCardCollection(): void {
    if (!this.sceneContainer) {
      console.error('Scene container not found');
      return;
    }

    // Remove any existing card collection panel
    const existingPanel = this.sceneContainer.querySelector('#card-collection-panel');
    if (existingPanel) {
      existingPanel.remove();
      
      // Also remove card details overlay if it exists
      const cardDetailsOverlay = document.getElementById('card-details-overlay');
      if (cardDetailsOverlay) {
        cardDetailsOverlay.remove();
      }
      
      return; // Toggle off if already showing
    }

    // Create panel container with background image and white border
    const panel = document.createElement('div');
    panel.id = 'card-collection-panel';
    panel.style.cssText = `
      position: absolute;
      top: 100px;
      left: 50px;
      right: 50px;
      bottom: 50px;
      background-image: url('images/beijing_tujian.png');
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      display: flex;
      flex-direction: column;
      z-index: 100;
      padding: 20px;
      overflow: hidden;
      border-radius: 12px;
      border: 4px solid white;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e0e0e0;
      flex-shrink: 0;
    `;
    
    const title = document.createElement('h2');
    title.textContent = '卡牌图鉴';
    title.style.cssText = `
      margin: 0;
      color: white;
      font-size: 22px;
    `;
    header.appendChild(title);
    
    // Progress info
    const progress = this.cardSystem.getCollectionProgress();
    const progressInfo = document.createElement('div');
    progressInfo.style.cssText = `
      font-size: 14px;
      color: white;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000;
    `;
    progressInfo.textContent = `收集进度: ${progress.owned}/${progress.total} (${progress.percentage}%)`;
    header.appendChild(progressInfo);
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 28px;
      color: #999;
      cursor: pointer;
      padding: 0;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.color = '#333';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.color = '#999';
    });
    closeBtn.addEventListener('click', () => {
      panel.remove();
      
      // Also remove card details overlay if it exists
      const cardDetailsOverlay = document.getElementById('card-details-overlay');
      if (cardDetailsOverlay) {
        cardDetailsOverlay.remove();
      }
    });
    header.appendChild(closeBtn);
    
    panel.appendChild(header);
    
    // Content container with two areas
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      display: flex;
      gap: 20px;
      padding: 8px;
    `;
    
    // Get all cards and filter to only show owned cards
    const allCards = this.cardSystem.getAllCards();
    const ownedCards = allCards.filter(card => this.cardSystem.ownsCard(card.id));
    
    // Create left area (semi-transparent white)
    const leftArea = document.createElement('div');
    leftArea.style.cssText = `
      flex: 1;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 20px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      align-content: start;
    `;
    
    // Create right area (semi-transparent white)
    const rightArea = document.createElement('div');
    rightArea.style.cssText = `
      flex: 1;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 20px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      align-content: start;
    `;
    
    // Create card slot (either with card or empty)
    const createCardSlot = (card: any | null) => {
      const slot = document.createElement('div');
      slot.style.cssText = `
        width: 100%;
        aspect-ratio: 3 / 5;
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(0, 0, 0, 0.1);
        border: 2px dashed rgba(255, 255, 255, 0.3);
      `;
      
      if (!card) {
        // Empty slot placeholder
        const placeholder = document.createElement('div');
        placeholder.textContent = '空槽位';
        placeholder.style.cssText = `
          color: rgba(255, 255, 255, 0.5);
          font-size: 16px;
        `;
        slot.appendChild(placeholder);
      } else {
        slot.style.background = 'transparent';
        slot.style.border = 'none';
        slot.style.transition = 'transform 0.2s, filter 0.2s';
        slot.style.cursor = 'pointer';
        
        // Add hover effect to slot
        slot.addEventListener('mouseenter', () => {
          slot.style.transform = 'scale(1.05)';
          slot.style.filter = 'drop-shadow(6px 6px 2px rgba(0, 0, 0, 0.6))';
        });
        
        slot.addEventListener('mouseleave', () => {
          slot.style.transform = 'scale(1)';
          slot.style.filter = 'none';
        });
        
        // Add click event to show card details in action panel
        slot.addEventListener('click', () => {
          this.showCardDetails(card);
        });
        
        const cardElement = document.createElement('div');
        cardElement.style.cssText = `
          width: 100%;
          height: 100%;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          position: relative;
        `;
        
        // Card image
        const cardImage = document.createElement('img');
        cardImage.src = card.image;
        cardImage.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
        `;
        cardImage.onerror = () => {
          // Fallback if image doesn't exist
          cardImage.style.display = 'none';
          const placeholder = document.createElement('div');
          placeholder.style.cssText = `
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
          `;
          placeholder.textContent = card.name;
          cardElement.appendChild(placeholder);
        };
        cardElement.appendChild(cardImage);
        
        // Card info overlay
        const infoOverlay = document.createElement('div');
        infoOverlay.style.cssText = `
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
          padding: 16px;
          color: white;
        `;
        
        const cardName = document.createElement('div');
        cardName.textContent = card.name;
        cardName.style.cssText = `
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 4px;
        `;
        infoOverlay.appendChild(cardName);
        
        const cardRarity = document.createElement('div');
        const rarityNames: Record<string, string> = {
          common: '普通',
          rare: '稀有',
          epic: '神话',
          legendary: '传说'
        };
        cardRarity.textContent = rarityNames[card.rarity] || card.rarity;
        cardRarity.style.cssText = `
          font-size: 14px;
          opacity: 0.9;
        `;
        infoOverlay.appendChild(cardRarity);
        
        cardElement.appendChild(infoOverlay);
        
        // Add holographic indicator if enabled
        if (card.holographic) {
          const holoIndicator = document.createElement('div');
          holoIndicator.textContent = '✨';
          holoIndicator.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            font-size: 24px;
            z-index: 10;
            filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.8));
          `;
          cardElement.appendChild(holoIndicator);
        }
        
        slot.appendChild(cardElement);
      }
      
      return slot;
    };
    
    // Create 6 slots for left area (slots 0-5)
    for (let i = 0; i < 6; i++) {
      const card = ownedCards[i] || null;
      leftArea.appendChild(createCardSlot(card));
    }
    
    // Create 6 slots for right area (slots 6-11)
    for (let i = 6; i < 12; i++) {
      const card = ownedCards[i] || null;
      rightArea.appendChild(createCardSlot(card));
    }
    
    contentContainer.appendChild(leftArea);
    contentContainer.appendChild(rightArea);
    panel.appendChild(contentContainer);
    
    // Add to scene container
    this.sceneContainer.appendChild(panel);
  }

  private showNotImplemented(feature: string): void {
    this.uiManager.showNotification(`${feature}正在开发中...`, 'warning');
  }

  public setPlayerEntity(player: Entity): void {
    this.playerEntity = player;
    this.inventoryPanel.setPlayerEntity(player);
    this.updateCurrencyDisplay();
  }

  public updateCurrencyDisplay(): void {
    const goldElement = document.getElementById('gold-amount');
    const crystalElement = document.getElementById('crystal-amount');
    const reputationElement = document.getElementById('reputation-amount');

    if (!this.playerEntity) {
      // Show placeholder values when no player entity
      if (goldElement) goldElement.textContent = '1,234';
      if (crystalElement) crystalElement.textContent = '56';
      if (reputationElement) reputationElement.textContent = '789';
      return;
    }

    // Get currency from player entity
    const currency = this.currencySystem.getCurrency(this.world, this.playerEntity.id);
    
    if (currency) {
      if (goldElement) goldElement.textContent = currency.amounts.gold.toLocaleString();
      if (crystalElement) crystalElement.textContent = currency.amounts.crystal.toLocaleString();
      if (reputationElement) reputationElement.textContent = currency.amounts.reputation.toLocaleString();
    } else {
      // Fallback to default values if no currency component
      if (goldElement) goldElement.textContent = '0';
      if (crystalElement) crystalElement.textContent = '0';
      if (reputationElement) reputationElement.textContent = '0';
    }
  }

  public showPanel(panelId: string, data?: any): void {
    this.uiManager.hideAllComponents();
    
    switch (panelId) {
      case 'character':
        this.uiManager.showComponent('character-panel');
        break;
      case 'inventory':
        this.uiManager.showComponent('inventory-panel');
        break;
      case 'crafting':
        this.uiManager.showComponent('crafting-panel');
        break;
      case 'exploration':
        this.uiManager.showComponent('exploration-panel');
        break;
      case 'farming':
        this.uiManager.showComponent('farming-panel');
        break;
      default:
        console.warn(`Unknown panel: ${panelId}`);
    }
  }

  public hidePanel(panelId: string): void {
    this.uiManager.hideComponent(panelId);
  }

  public hideAllPanels(): void {
    this.uiManager.hideAllComponents();
  }

  public showNotification(message: string, type: 'success' | 'warning' | 'error' = 'success', duration?: number): void {
    this.uiManager.showNotification(message, type, duration);
  }

  /**
   * Show a shaking hint tooltip above a target element
   */
  private showShakingHint(target: HTMLElement, text: string, autoRemoveMs?: number): void {
    const hint = document.createElement('div');
    hint.className = 'shaking-hint';
    hint.textContent = text;
    hint.style.cssText = `
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      background: transparent;
      color: #ffd700;
      font-size: 12px;
      font-weight: bold;
      padding: 4px 10px;
      border-radius: 6px;
      white-space: nowrap;
      z-index: 1000;
      pointer-events: none;
      -webkit-text-stroke: 0.5px #000;
      text-shadow: 1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000;
      animation: hintShake 0.5s ease-in-out infinite;
    `;

    // Ensure parent has relative positioning
    const parentPos = target.style.position;
    if (!parentPos || parentPos === 'static') {
      target.style.position = 'relative';
    }
    target.appendChild(hint);

    // Inject keyframes if not already present
    if (!document.getElementById('shaking-hint-style')) {
      const style = document.createElement('style');
      style.id = 'shaking-hint-style';
      style.textContent = `
        @keyframes hintShake {
          0%, 100% { transform: translateX(-50%) rotate(0deg); }
          25% { transform: translateX(-50%) rotate(-2deg); }
          75% { transform: translateX(-50%) rotate(2deg); }
        }
      `;
      document.head.appendChild(style);
    }

    if (autoRemoveMs) {
      setTimeout(() => { hint.remove(); }, autoRemoveMs);
    }
  }

  /**
   * Show item action modal for team bag items (use, discard 1, discard all)
   */
  private showTeamBagItemActionModal(itemId: string, item: any, quantity: number): void {
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
      min-width: 300px;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;

    // Item info section
    const itemInfo = document.createElement('div');
    itemInfo.style.cssText = `
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
    `;

    const itemIcon = document.createElement('img');
    itemIcon.src = item.icon;
    itemIcon.style.cssText = `
      width: 64px;
      height: 64px;
      object-fit: contain;
      margin-bottom: 12px;
    `;
    itemIcon.onerror = () => {
      itemIcon.style.display = 'none';
    };

    const itemName = document.createElement('div');
    itemName.textContent = item.name;
    itemName.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      color: #333;
      margin-bottom: 8px;
    `;

    const itemDesc = document.createElement('div');
    itemDesc.textContent = item.description || '';
    itemDesc.style.cssText = `
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
    `;

    const itemQuantity = document.createElement('div');
    itemQuantity.textContent = `数量: ${quantity}`;
    itemQuantity.style.cssText = `
      font-size: 14px;
      color: #999;
    `;

    itemInfo.appendChild(itemIcon);
    itemInfo.appendChild(itemName);
    itemInfo.appendChild(itemDesc);
    itemInfo.appendChild(itemQuantity);

    // Buttons section
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // Use button
    const useButton = document.createElement('button');
    useButton.textContent = '使用';
    useButton.style.cssText = `
      padding: 12px 24px;
      font-size: 16px;
      font-weight: bold;
      background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    useButton.addEventListener('mouseenter', () => {
      useButton.style.transform = 'translateY(-2px)';
      useButton.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3)';
    });
    useButton.addEventListener('mouseleave', () => {
      useButton.style.transform = 'translateY(0)';
      useButton.style.boxShadow = 'none';
    });
    useButton.addEventListener('click', () => {
      document.body.removeChild(modalOverlay);
      this.showCharacterSelectionForItemUse(itemId, item);
    });

    // Discard 1 button
    const discardOneButton = document.createElement('button');
    discardOneButton.textContent = '丢弃1个';
    discardOneButton.style.cssText = `
      padding: 12px 24px;
      font-size: 16px;
      font-weight: bold;
      background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    discardOneButton.addEventListener('mouseenter', () => {
      discardOneButton.style.transform = 'translateY(-2px)';
      discardOneButton.style.boxShadow = '0 4px 12px rgba(255, 152, 0, 0.3)';
    });
    discardOneButton.addEventListener('mouseleave', () => {
      discardOneButton.style.transform = 'translateY(0)';
      discardOneButton.style.boxShadow = 'none';
    });
    discardOneButton.addEventListener('click', () => {
      this.lootSystem.removeFromTeamBag(itemId, 1);
      this.updateTeamInventoryDisplay();
      this.showNotification(`丢弃了1个${item.name}`, 'success');
      document.body.removeChild(modalOverlay);
    });

    // Discard all button
    const discardAllButton = document.createElement('button');
    discardAllButton.textContent = '丢弃全部';
    discardAllButton.style.cssText = `
      padding: 12px 24px;
      font-size: 16px;
      font-weight: bold;
      background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    discardAllButton.addEventListener('mouseenter', () => {
      discardAllButton.style.transform = 'translateY(-2px)';
      discardAllButton.style.boxShadow = '0 4px 12px rgba(244, 67, 54, 0.3)';
    });
    discardAllButton.addEventListener('mouseleave', () => {
      discardAllButton.style.transform = 'translateY(0)';
      discardAllButton.style.boxShadow = 'none';
    });
    discardAllButton.addEventListener('click', () => {
      this.lootSystem.removeFromTeamBag(itemId, quantity);
      this.updateTeamInventoryDisplay();
      this.showNotification(`丢弃了全部${item.name}`, 'success');
      document.body.removeChild(modalOverlay);
    });

    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.style.cssText = `
      padding: 12px 24px;
      font-size: 16px;
      font-weight: bold;
      background: #e0e0e0;
      color: #666;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = '#d0d0d0';
    });
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = '#e0e0e0';
    });
    cancelButton.addEventListener('click', () => {
      document.body.removeChild(modalOverlay);
    });

    // Only show "使用" button for usable item types (not materials)
    const isUsable = item.type === 'food' || item.type === 'consumable' || item.type === 'potion';
    if (isUsable) {
      buttonsContainer.appendChild(useButton);
    }
    buttonsContainer.appendChild(discardOneButton);
    buttonsContainer.appendChild(discardAllButton);
    buttonsContainer.appendChild(cancelButton);

    modalContent.appendChild(itemInfo);
    modalContent.appendChild(buttonsContainer);
    modalOverlay.appendChild(modalContent);

    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        document.body.removeChild(modalOverlay);
      }
    });

    document.body.appendChild(modalOverlay);
  }

  /**
   * Show character selection modal for using an item
   */
  private showCharacterSelectionForItemUse(itemId: string, item: any): void {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10002;
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
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = '选择使用对象';
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #333;
      font-size: 20px;
      text-align: center;
    `;

    // Character grid (2x2 for 4 party slots)
    const charGrid = document.createElement('div');
    charGrid.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    `;

    // Add party slot cards
    this.partySlots.forEach((character, index) => {
      const slotCard = document.createElement('div');
      slotCard.style.cssText = `
        padding: 16px;
        background: ${character ? '#f9f9f9' : '#f0f0f0'};
        border: 2px solid ${character ? '#667eea' : '#ccc'};
        border-radius: 12px;
        cursor: ${character ? 'pointer' : 'not-allowed'};
        transition: all 0.2s;
        min-height: 120px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        opacity: ${character ? '1' : '0.5'};
      `;

      if (character) {
        // Show character info
        const avatar = document.createElement('div');
        avatar.style.cssText = `
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          margin-bottom: 8px;
        `;

        if (character.emoji.includes('.png') || character.emoji.includes('.jpg')) {
          const avatarImg = document.createElement('img');
          avatarImg.src = character.emoji;
          avatarImg.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
          avatar.appendChild(avatarImg);
        } else {
          avatar.textContent = character.emoji;
          avatar.style.fontSize = '30px';
        }

        const nameDiv = document.createElement('div');
        nameDiv.textContent = character.title ? `${character.title}${character.name}` : character.name;
        nameDiv.style.cssText = `
          font-size: 14px;
          font-weight: bold;
          color: #333;
          text-align: center;
        `;

        const levelDiv = document.createElement('div');
        levelDiv.textContent = `Lv.${character.level} ${this.getJobDisplayName(character.job)}`;
        levelDiv.style.cssText = `
          font-size: 12px;
          color: #666;
          text-align: center;
        `;

        slotCard.appendChild(avatar);
        slotCard.appendChild(nameDiv);
        slotCard.appendChild(levelDiv);

        // Add hover effect
        slotCard.addEventListener('mouseenter', () => {
          slotCard.style.borderColor = '#4caf50';
          slotCard.style.background = '#f0fff0';
          slotCard.style.transform = 'translateY(-4px)';
          slotCard.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3)';
        });
        slotCard.addEventListener('mouseleave', () => {
          slotCard.style.borderColor = '#667eea';
          slotCard.style.background = '#f9f9f9';
          slotCard.style.transform = 'translateY(0)';
          slotCard.style.boxShadow = 'none';
        });

        // Add click handler to use item on this character
        slotCard.addEventListener('click', () => {
          this.useItemOnCharacter(itemId, item, character);
          document.body.removeChild(modalOverlay);
        });
      } else {
        // Empty slot
        slotCard.innerHTML = `
          <div style="text-align: center; color: #999;">
            <div style="font-size: 32px; margin-bottom: 8px;">➕</div>
            <div style="font-size: 12px;">空槽位</div>
          </div>
        `;
      }

      charGrid.appendChild(slotCard);
    });

    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.style.cssText = `
      width: 100%;
      padding: 12px 24px;
      font-size: 16px;
      font-weight: bold;
      background: #e0e0e0;
      color: #666;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = '#d0d0d0';
    });
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = '#e0e0e0';
    });
    cancelButton.addEventListener('click', () => {
      document.body.removeChild(modalOverlay);
    });

    modalContent.appendChild(title);
    modalContent.appendChild(charGrid);
    modalContent.appendChild(cancelButton);
    modalOverlay.appendChild(modalContent);

    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        document.body.removeChild(modalOverlay);
      }
    });

    document.body.appendChild(modalOverlay);
  }

  /**
   * Use an item on a character
   */
  private useItemOnCharacter(itemId: string, item: any, character: any): void {
    // Check if item exists in team bag
    const teamBagInventory = this.lootSystem.getTeamBagInventory();
    const quantity = teamBagInventory.get(itemId) || 0;
    if (quantity <= 0) {
      this.showNotification('物品不足', 'error');
      return;
    }

    // Get fresh item data from ItemSystem to ensure we have all properties
    const itemData = this.itemSystem.getItem(itemId);
    if (!itemData) {
      this.showNotification('无效的物品', 'error');
      return;
    }

    // Apply item effects based on type
    if (itemData.type === 'food' && itemData.hungerRestore) {
      // Restore hunger - use character.id for component lookup
      const hungerComponent = this.world.getComponent(character.id, HungerComponentType);
      if (hungerComponent) {
        const oldHunger = hungerComponent.current;
        const newHunger = Math.min(
          hungerComponent.current + itemData.hungerRestore,
          hungerComponent.maximum
        );
        hungerComponent.current = newHunger;
        
        // Sync hunger value back to NPCData so detail panel shows correct value
        character.currentHunger = newHunger;
        // Also update the recruited character data in NPCSystem
        const recruitedChar = this.npcSystem.getRecruitedCharacter(character.id);
        if (recruitedChar) {
          recruitedChar.currentHunger = newHunger;
        }
        
        const hungerGained = newHunger - oldHunger;
        this.showNotification(
          `${character.name} 食用了 ${itemData.name}，恢复了 ${hungerGained} 点饱腹度`,
          'success'
        );
        
        // Check hunger BUFF status after hunger change
        this.checkHungerBuff(character.id, newHunger);
      } else {
        this.showNotification('该角色没有饱腹度系统', 'error');
        return;
      }
    } else if (itemData.type === 'potion' || itemData.type === 'consumable') {
      // Handle buff potions
      if (itemData.buffId) {
        const applied = this.buffSystem.applyBuff(character.id, itemData.buffId);
        if (applied) {
          const buffDef = this.buffSystem.getBuffDefinition(itemData.buffId);
          const buffName = buffDef ? buffDef.name : itemData.buffId;
          const buffDuration = buffDef ? buffDef.duration : 30;
          this.showNotification(
            `${character.name} 使用了 ${itemData.name}，获得 ${buffName} 效果（${buffDuration}秒）`,
            'success'
          );
        } else {
          this.showNotification(`${character.name} 使用了 ${itemData.name}`, 'success');
        }
      } else if (itemData.healAmount) {
        // Healing potion - restore HP
        const recruitedChar = this.npcSystem.getRecruitedCharacter(character.id);
        if (recruitedChar) {
          const oldHP = recruitedChar.currentHP;
          recruitedChar.currentHP = Math.min(recruitedChar.currentHP + itemData.healAmount, recruitedChar.maxHP);
          character.currentHP = recruitedChar.currentHP;
          const healed = Math.floor(recruitedChar.currentHP - oldHP);
          this.showNotification(
            `${character.name} 使用了 ${itemData.name}，恢复了 ${healed} 点生命值`,
            'success'
          );
        } else {
          this.showNotification(`${character.name} 使用了 ${itemData.name}`, 'success');
        }
      } else if (itemData.manaAmount) {
        // Mana potion - restore MP
        const recruitedChar = this.npcSystem.getRecruitedCharacter(character.id);
        if (recruitedChar) {
          const oldMP = recruitedChar.currentMP;
          recruitedChar.currentMP = Math.min(recruitedChar.currentMP + itemData.manaAmount, recruitedChar.maxMP);
          character.currentMP = recruitedChar.currentMP;
          const restored = Math.floor(recruitedChar.currentMP - oldMP);
          this.showNotification(
            `${character.name} 使用了 ${itemData.name}，恢复了 ${restored} 点魔法值`,
            'success'
          );
        } else {
          this.showNotification(`${character.name} 使用了 ${itemData.name}`, 'success');
        }
      } else {
        // Generic potion/consumable without specific effect
        this.showNotification(
          `${character.name} 使用了 ${itemData.name}`,
          'success'
        );
      }
    } else {
      // Item doesn't have hunger restore or is not consumable
      this.showNotification(
        `${itemData.name} 无法使用（类型: ${itemData.type}, 饱腹度恢复: ${itemData.hungerRestore || '无'}）`,
        'warning'
      );
      return;
    }

    // Remove item from team bag
    this.lootSystem.removeFromTeamBag(itemId, 1);

    // Update displays - refresh party slots to show updated hunger
    this.updateTeamInventoryDisplay();
    this.refreshPartySlots();
  }

  public isVisible(panelId: string): boolean {
    const component = this.uiManager.getComponent(panelId);
    return component ? component.visible : false;
  }

  private setupEventListeners(): void {
    // UI events
    this.eventSystem.subscribe('ui:show', (event: any) => {
      this.showPanel(event.panel, event.data);
    });

    this.eventSystem.subscribe('ui:hide', (event: any) => {
      this.hidePanel(event.panel);
    });

    this.eventSystem.subscribe('ui:notification', (event: any) => {
      this.showNotification(event.message, event.type as any, event.duration);
    });

    // Currency updates
    this.eventSystem.subscribe('currency:changed', () => {
      this.updateCurrencyDisplay();
    });

    // Inventory updates - refresh cooking panel if visible
    this.eventSystem.subscribe('inventory:updated', () => {
      // Check if we're in the camp scene with cooking tab active
      const cookingTab = document.querySelector('[data-tab="cooking"]') as HTMLButtonElement;
      if (cookingTab && cookingTab.style.background.includes('102, 126, 234')) {
        // Cooking tab is active, refresh the cooking panel
        const contentArea = document.querySelector('[data-content-area="warehouse"]');
        if (contentArea) {
          // Remove existing content (except tabs)
          while (contentArea.children.length > 1) {
            contentArea.removeChild(contentArea.lastChild!);
          }
          // Re-render cooking panel
          this.renderCookingPanel(contentArea as HTMLElement);
        }
      }
    });

    // Cooking completed - show notification
    this.eventSystem.subscribe('cooking:completed', (event: any) => {
      this.showNotification('烹饪成功！', 'success');
    });

    // Equipment crafted - show celebration modal
    this.eventSystem.subscribe('equipment:crafted', (event: any) => {
      this.showEquipmentCraftedModal(event.recipeId, event.affix);
    });

    // Equipment slot clicked - open warehouse panel with filter
    this.eventSystem.subscribe('equipment:slot_clicked', (event: any) => {
      this.openWarehousePanelForEquipment(event.slot, event.characterId);
    });

    // Equipment changed - update character displays
    this.eventSystem.subscribe('equipment_changed', (event: any) => {
      // Update any visible character displays
      // This ensures attribute displays are synchronized with equipment changes
      console.log('[GameUI] Equipment changed for character', event.characterId);
      
      // If party slots are visible, update them
      const partySlots = document.querySelectorAll('.party-slot');
      if (partySlots.length > 0) {
        this.refreshPartySlots();
      }
    });

    // Dialogue completed - refresh NPC card display to show updated affinity
    this.eventSystem.subscribe('dialogue:completed', (event: any) => {
      console.log('[GameUI] Dialogue completed, refreshing NPC display for', event.characterId);
      
      // Get the updated NPC data
      const updatedNPC = this.npcSystem.getNPC(event.characterId) || this.npcSystem.getRecruitedCharacter(event.characterId);
      if (!updatedNPC) {
        console.warn('[GameUI] Could not find NPC data for', event.characterId);
        return;
      }
      
      // Find and update the NPC card instance
      const npcCard = this.npcCardInstances.get(event.characterId);
      if (npcCard) {
        console.log('[GameUI] Updating NPC card for', event.characterId, 'with new affinity:', updatedNPC.affinity);
        npcCard.updateData(updatedNPC);
      } else {
        console.warn('[GameUI] NPC card instance not found for', event.characterId);
      }
      
      // Check affinity milestone rewards
      this.checkAffinityRewards(event.characterId, updatedNPC.affinity || 0);
      
      // Refresh the NPC details panel if it's currently showing this character
      // This ensures the affinity progress bar updates immediately
      this.showNPCDetails(updatedNPC);
    });

    // Dialogue affinity feedback - show visual effect on affinity progress bar
    this.eventSystem.subscribe('dialogue:affinity_feedback', (event: any) => {
      console.log('[GameUI] Showing affinity feedback for', event.characterId, 'change:', event.affinityChange);
      
      // Show emoji feedback on NPC avatar
      const npcCard = this.npcCardInstances.get(event.characterId);
      if (npcCard) {
        npcCard.showEmojiFeedback(event.affinityChange);
        console.log('[GameUI] Showing emoji feedback on NPC card for', event.characterId);
      }
      
      // Wait a bit for the dialogue modal to close and details panel to update
      setTimeout(() => {
        this.showAffinityFeedbackOnProgressBar(event.characterId, event.affinityChange);
      }, 350);
    });


    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      this.handleKeyboardShortcuts(event);
    });

    // ESC key to close panels
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.hideAllPanels();
      }
    });
  }

  private handleKeyboardShortcuts(event: KeyboardEvent): void {
    // Prevent shortcuts when typing in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'c':
        this.showPanel('character');
        break;
      case 'i':
        this.showPanel('inventory');
        break;
      case 'k':
        this.showPanel('crafting');
        break;
      case 'e':
        this.showPanel('exploration');
        break;
      case 'f':
        this.showPanel('farming');
        break;
      case 'escape':
        this.hideAllPanels();
        break;
    }
  }

  private switchScene(sceneId: string): void {
    console.log(`[DEBUG] switchScene called with: ${sceneId}`);
    if (!this.sceneContainer) {
      console.log('[DEBUG] sceneContainer is null!');
      return;
    }
    
    // Only allow scene switching in village stage
    if (!this.isNonCombatStage(this.currentStage)) {
      console.log('[DEBUG] Scene switching only available in village stage');
      return;
    }
    
    // Stop adventurer spawning when leaving market
    if (this.currentScene === 'market' && sceneId !== 'market') {
      this.stopAdventurerSpawning();
    }
    
    this.currentScene = sceneId;
    
    // Disconnect ResizeObserver to prevent stale callbacks from overwriting the action panel
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clear scene container while preserving quest tracker
    this.clearSceneContainer();
    console.log(`[DEBUG] Scene container cleared (except quest tracker), loading ${sceneId} scene`);

    // Emit scene visit event for quest detection
    this.eventSystem.emit({ type: 'quest:scene_visited', sceneId, timestamp: Date.now() });
    
    // Clear action panel when switching scenes
    this.clearActionPanel();
    
    // Set background image based on scene
    const sceneImages: Record<string, string> = {
      square: 'images/changjing_guangchang.png',
      tavern: 'images/changjing_jiuguan.png',
      market: 'images/changjing_shichang.png',
      farm: 'images/changjing_nongchang.png',
      camp: 'images/changjing_yingdi.png'
    };
    
    const imagePath = sceneImages[sceneId];
    if (imagePath) {
      // Set background image without mask
      this.sceneContainer.style.backgroundImage = `url('${imagePath}')`;
      this.sceneContainer.style.backgroundSize = 'cover';
      this.sceneContainer.style.backgroundPosition = 'center';
      this.sceneContainer.style.backgroundRepeat = 'no-repeat';
    }
    
    // Load scene-specific content
    if (sceneId === 'square') {
      this.loadSquareScene();
    } else if (sceneId === 'tavern') {
      this.loadTavernScene();
    } else if (sceneId === 'camp') {
      this.loadCampScene();
    } else if (sceneId === 'market') {
      this.loadMarketScene();
      // Start spawning wandering adventurers in market
      this.startAdventurerSpawning();
    }
    // Other scenes remain empty for now
  }

  /**
   * Clear scene container while preserving the quest tracker element
   */
  private clearSceneContainer(): void {
    if (!this.sceneContainer) return;
    const questTrackerElement = this.questTracker?.getElement();
    const children = Array.from(this.sceneContainer.children);
    for (const child of children) {
      if (child !== questTrackerElement) {
        this.sceneContainer.removeChild(child);
      }
    }
  }

  /**
   * Show card details in an overlay panel above the action panel
   */
  private showCardDetails(card: any): void {
    // Remove any existing card details overlay
    const existingOverlay = document.getElementById('card-details-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const rarityNames: Record<string, string> = {
      common: '普通',
      rare: '稀有',
      epic: '神话',
      legendary: '传说'
    };

    const rarityColors: Record<string, string> = {
      common: '#FFFFFF',
      rare: '#2196f3',
      epic: '#9c27b0',
      legendary: '#ff9800'
    };

    // Holographic toggle state (read from card data)
    let holographicEnabled = card.holographic || false;

    // Add shader effect styles for cards with holographic texture
    const hasHolographic = card.holographicTexture && card.holographicName;
    const shaderStyles = hasHolographic ? `
      <style>
        @keyframes diagonalScroll {
          0% {
            background-position: 0px 0px;
          }
          100% {
            background-position: 200px 200px;
          }
        }
        
        .card-image-container {
          position: relative;
          display: inline-block;
          border-radius: 12px;
          overflow: visible;
          filter: drop-shadow(6px 6px 2px rgba(0, 0, 0, 0.4)) drop-shadow(3px 3px 1px rgba(0, 0, 0, 0.25));
        }
        
        .card-image-container img {
          display: block;
          border-radius: 12px;
          overflow: hidden;
        }
        
        .card-image-container::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: url('${card.holographicTexture}');
          background-size: 200px 200px;
          background-repeat: repeat;
          mix-blend-mode: color-dodge;
          animation: diagonalScroll 25s linear infinite;
          pointer-events: none;
          opacity: 1;
          transition: opacity 0.3s ease;
        }
        
        .card-image-container.holo-disabled::after {
          opacity: 0;
        }
        
        .card-image-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            115deg,
            transparent 20%,
            rgba(255, 255, 255, 0.3) 35%,
            rgba(255, 255, 255, 0.5) 40%,
            rgba(255, 255, 255, 0.8) 45%,
            rgba(255, 255, 255, 0.5) 50%,
            rgba(255, 255, 255, 0.3) 55%,
            transparent 70%
          );
          background-size: 400% 400%;
          background-position: 0% 0%;
          mix-blend-mode: overlay;
          pointer-events: none;
          z-index: 1;
          opacity: 0;
          transition: background-position 0.3s ease-out, opacity 0.3s ease-out;
        }
        
        .card-image-container.holo-disabled::before {
          display: none;
        }
      </style>
    ` : '';

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'card-details-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 76px;
      right: 16px;
      width: 490px;
      height: calc(100% - 92px);
      background: rgba(255, 255, 255, 0.98);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      overflow-y: auto;
      animation: slideInRight 0.3s ease-out;
    `;

    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    overlay.innerHTML = `
      ${shaderStyles}
      <div style="padding: 20px; color: #333; position: relative;">
        <!-- Close button -->
        <button id="close-card-details" style="
          position: absolute;
          top: 10px;
          right: 10px;
          background: none;
          border: none;
          font-size: 28px;
          color: #999;
          cursor: pointer;
          padding: 0;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
          z-index: 10;
        ">×</button>

        <h2 style="margin: 0 0 16px 0; padding-right: 40px; color: #333; font-size: 22px; text-align: center;">${card.name}</h2>
        
        <!-- Full Card Image -->
        <div style="display: flex; justify-content: center; margin-bottom: 20px;">
          <div class="${hasHolographic ? (holographicEnabled ? 'card-image-container' : 'card-image-container holo-disabled') : ''}" id="holographic-card">
            <img src="${card.image}" 
                 style="max-width: ${card.width}px; max-height: 400px; width: auto; height: auto; display: block; border-radius: 12px; filter: drop-shadow(6px 6px 2px rgba(0, 0, 0, 0.4)) drop-shadow(3px 3px 1px rgba(0, 0, 0, 0.25));"
                 onerror="this.style.display='none'; this.parentElement.nextElementSibling.style.display='flex';" />
          </div>
          <div style="display: none; width: 300px; height: 400px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">
            ${card.name}
          </div>
        </div>
        
        <!-- Card Details -->
        <div style="background: rgba(255, 255, 255, 0.8); border-radius: 8px; padding: 16px; margin-bottom: 12px;">
          <div style="margin-bottom: 12px;">
            <div style="font-size: 14px; color: #666; margin-bottom: 4px;">稀有度</div>
            <div style="display: inline-block; padding: 6px 12px; background: ${rarityColors[card.rarity] || '#FFFFFF'}; color: white; border-radius: 6px; font-weight: bold;">
              ${rarityNames[card.rarity] || card.rarity}
            </div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <div style="font-size: 14px; color: #666; margin-bottom: 4px;">闪膜效果</div>
            <div id="holographic-status" style="font-size: 16px; color: #333;">${holographicEnabled && hasHolographic ? `✨ ${card.holographicName}` : '无'}</div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <div style="font-size: 14px; color: #666; margin-bottom: 4px;">获取方式</div>
            <div style="font-size: 16px; color: #333;">${card.obtainMethod || '未知'}</div>
          </div>
          
          ${card.description ? `
          <div>
            <div style="font-size: 14px; color: #666; margin-bottom: 4px;">描述</div>
            <div style="font-size: 16px; color: #333; line-height: 1.6;">${card.description}</div>
          </div>
          ` : ''}
        </div>
      </div>
    `;
    
    // Add holographic toggle functionality (for cards with holographic texture)
    // This is controlled programmatically, not by user interaction
    if (hasHolographic) {
      const cardContainer = document.getElementById('holographic-card');
      const holographicStatus = document.getElementById('holographic-status');
      
      if (cardContainer) {
        // Expose a method to toggle holographic effect programmatically
        // Can be called via: (window as any).toggleCardHolographic(true/false)
        (window as any).toggleCardHolographic = (enabled: boolean) => {
          holographicEnabled = enabled;
          
          // Update the card data
          card.holographic = enabled;
          
          // Update all cards in the card system
          const allCards = this.cardSystem.getAllCards();
          allCards.forEach((c: any) => {
            if (c.holographicTexture && c.holographicName) {
              c.holographic = enabled;
            }
          });
          
          if (holographicEnabled) {
            cardContainer.classList.remove('holo-disabled');
            if (holographicStatus) {
              holographicStatus.textContent = `✨ ${card.holographicName}`;
            }
            console.log('✨ 卡牌闪膜效果已开启');
          } else {
            cardContainer.classList.add('holo-disabled');
            if (holographicStatus) {
              holographicStatus.textContent = '无';
            }
            console.log('卡牌闪膜效果已关闭');
          }
          
          // Refresh card collection panel if it's open
          const collectionPanel = document.getElementById('card-collection-panel');
          if (collectionPanel) {
            // Close and reopen to refresh
            collectionPanel.remove();
            this.showCardCollection();
          }
        };
      }
    }
    
    // Add mouse tracking for holographic effect (for cards with holographic texture)
    if (hasHolographic) {
      const cardContainer = document.getElementById('holographic-card');
      if (cardContainer) {
        // Show holographic effect on mouse enter (only if enabled)
        cardContainer.addEventListener('mouseenter', () => {
          if (!holographicEnabled) return;
          
          const style = document.createElement('style');
          style.id = 'holo-opacity-style';
          style.textContent = `
            #holographic-card::before {
              opacity: 1 !important;
            }
          `;
          document.head.appendChild(style);
        });
        
        cardContainer.addEventListener('mousemove', (e: MouseEvent) => {
          if (!holographicEnabled) return;
          
          const rect = cardContainer.getBoundingClientRect();
          const x = e.clientX - rect.left; // Mouse X relative to card
          const y = e.clientY - rect.top;  // Mouse Y relative to card
          
          // Calculate percentage position (0-100)
          const xPercent = (x / rect.width) * 100;
          const yPercent = (y / rect.height) * 100;
          
          // Move holographic gradient in opposite direction of mouse
          // When mouse moves right, gradient moves left (inverse)
          const bgX = 100 - xPercent; // Inverse X
          const bgY = 100 - yPercent; // Inverse Y
          
          // Apply to ::before pseudo-element via CSS custom property
          (cardContainer as HTMLElement).style.setProperty('--holo-x', `${bgX}%`);
          (cardContainer as HTMLElement).style.setProperty('--holo-y', `${bgY}%`);
          
          // Update the background position
          const beforeElement = cardContainer.querySelector('::before');
          const computedStyle = window.getComputedStyle(cardContainer, '::before');
          (cardContainer as any).style.cssText += `
            --holo-bg-pos: ${bgX}% ${bgY}%;
          `;
        });
        
        // Hide holographic effect and reset on mouse leave
        cardContainer.addEventListener('mouseleave', () => {
          (cardContainer as HTMLElement).style.setProperty('--holo-x', '50%');
          (cardContainer as HTMLElement).style.setProperty('--holo-y', '50%');
          
          // Remove opacity override to hide the effect
          const opacityStyle = document.getElementById('holo-opacity-style');
          if (opacityStyle) {
            opacityStyle.remove();
          }
        });
        
        // Apply dynamic background position using inline style update
        const style = document.createElement('style');
        style.textContent = `
          #holographic-card::before {
            background-position: var(--holo-x, 50%) var(--holo-y, 50%) !important;
          }
        `;
        document.head.appendChild(style);
      }
    }

    // Add overlay to document body
    document.body.appendChild(overlay);

    // Add close button event listener
    const closeButton = document.getElementById('close-card-details');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        overlay.remove();
      });
    }
  }

  private showCharacterRoster(): void {
    if (!this.sceneContainer) return;

    // Clear scene container
    this.clearSceneContainer();
    this.sceneContainer.style.backgroundImage = 'none';
    this.sceneContainer.style.background = 'rgba(255, 255, 255, 0.95)';

    // Create character roster container
    const rosterContainer = document.createElement('div');
    rosterContainer.style.cssText = `
      width: 100%;
      height: 100%;
      overflow-y: auto;
      padding: 24px;
    `;

    // Title
    const title = document.createElement('h2');
    title.textContent = '角色管理';
    title.style.cssText = `
      margin: 0 0 24px 0;
      color: #333;
      font-size: 24px;
      font-weight: bold;
    `;
    rosterContainer.appendChild(title);

    // Get recruited characters
    const recruitedCharacters = this.npcSystem.getRecruitedCharacters();

    if (recruitedCharacters.length === 0) {
      // Empty state
      const emptyState = document.createElement('div');
      emptyState.style.cssText = `
        text-align: center;
        padding: 60px 20px;
        color: #666;
      `;
      emptyState.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
        <div style="font-size: 18px; margin-bottom: 8px;">暂无角色</div>
        <div style="font-size: 14px;">前往酒馆招募冒险者吧！</div>
      `;
      rosterContainer.appendChild(emptyState);
    } else {
      // Character grid
      const characterGrid = document.createElement('div');
      characterGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 20px;
      `;

      recruitedCharacters.forEach(character => {
        const characterCard = this.createCharacterCard(character);
        characterGrid.appendChild(characterCard);
      });

      rosterContainer.appendChild(characterGrid);
    }

    this.sceneContainer.appendChild(rosterContainer);
    this.clearActionPanel();
  }

  private createCharacterCard(character: NPCData): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.3s ease;
      border: 2px solid transparent;
    `;

    // Avatar
    const avatar = document.createElement('div');
    avatar.style.cssText = `
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 12px auto;
      overflow: hidden;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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
      avatar.style.fontSize = '50px';
    }

    // Name
    const name = document.createElement('div');
    name.textContent = character.title ? `${character.title}${character.name}` : character.name;
    name.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      color: #333;
      text-align: center;
      margin-bottom: 8px;
    `;

    // Level and Job
    const info = document.createElement('div');
    info.textContent = `Lv.${character.level} ${this.getJobDisplayName(character.job)}`;
    info.style.cssText = `
      font-size: 14px;
      color: #666;
      text-align: center;
      margin-bottom: 12px;
    `;

    // Stats preview
    const stats = document.createElement('div');
    stats.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 12px;
      color: #666;
    `;
    
    // Calculate equipment bonuses for primary attributes
    const primaryBonuses = this.calculatePrimaryAttributeBonuses(character);
    
    // Helper function to format attribute display with bonus
    const formatAttribute = (icon: string, name: string, base: number, bonus: number) => {
      if (bonus > 0) {
        return `<div>${icon} ${name}: ${base} <span style="color: #4caf50; font-size: 11px;">(+${bonus})</span></div>`;
      } else {
        return `<div>${icon} ${name}: ${base}</div>`;
      }
    };
    
    stats.innerHTML = `
      ${formatAttribute(ATTRIBUTE_ICONS.STRENGTH, '力量', character.strength, primaryBonuses.strength)}
      ${formatAttribute(ATTRIBUTE_ICONS.AGILITY, '敏捷', character.agility, primaryBonuses.agility)}
      ${formatAttribute(ATTRIBUTE_ICONS.WISDOM, '智慧', character.wisdom, primaryBonuses.wisdom)}
      ${formatAttribute(ATTRIBUTE_ICONS.SKILL, '技巧', character.skill, primaryBonuses.skill)}
    `;

    // Assemble card
    card.appendChild(avatar);
    card.appendChild(name);
    card.appendChild(info);
    card.appendChild(stats);

    // Hover effect
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.15)';
      card.style.borderColor = '#667eea';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
      card.style.borderColor = 'transparent';
    });

    // Click to show details
    card.addEventListener('click', () => {
      this.showNPCDetails(character);
    });

    return card;
  }

  private loadSquareScene(): void {
    if (!this.sceneContainer) {
      console.log('[DEBUG] loadSquareScene: sceneContainer is null!');
      return;
    }

    console.log('[DEBUG] loadSquareScene: Creating NPC container');

    // Create NPC container with padding to avoid button overlap (moved down 100px more)
    const npcContainer = document.createElement('div');
    npcContainer.style.cssText = `
      display: flex;
      gap: 40px;
      padding: 200px 20px 20px 20px;
      flex-wrap: wrap;
      justify-content: center;
      min-height: 100%;
    `;

    // Get village chief NPC
    const villageChief = this.npcSystem.getNPC('village_chief');
    if (villageChief) {
      console.log('[DEBUG] loadSquareScene: Creating card for village chief');
      const npcCard = new NPCCard(villageChief, (clickedNpcData) => {
        this.showNPCDetails(clickedNpcData);
      });
      this.villageChiefCard = npcCard; // Save reference for red dot updates
      this.npcCardInstances.set('village_chief', npcCard); // Store in map for affinity updates
      npcContainer.appendChild(npcCard.getElement());
      
      // Update red dot based on completable quests
      if (this.hasCompletableQuests()) {
        npcCard.showRedDot();
      }
    }

    this.sceneContainer.appendChild(npcContainer);

    // Get blacksmith Z·Z NPC - positioned absolutely on the left side (red circle position)
    const blacksmith = this.npcSystem.getNPC('blacksmith_zz');
    if (blacksmith && !this.lockedNPCs.has('blacksmith_zz')) {
      console.log('[DEBUG] loadSquareScene: Creating card for blacksmith Z·Z');
      const blacksmithCard = new NPCCard(blacksmith, (clickedNpcData) => {
        this.showNPCDetails(clickedNpcData);
      });
      this.npcCardInstances.set('blacksmith_zz', blacksmithCard); // Store in map
      const blacksmithElement = blacksmithCard.getElement();
      // Position absolutely on the left side (red circle position in the image)
      blacksmithElement.style.position = 'absolute';
      blacksmithElement.style.left = '175px';
      blacksmithElement.style.top = '250px';
      this.sceneContainer.appendChild(blacksmithElement);
    }

    // Get trainer Alin NPC - positioned absolutely below scholar Xiaomei
    const trainerAlin = this.npcSystem.getNPC('trainer_alin');
    if (trainerAlin && !this.lockedNPCs.has('trainer_alin')) {
      console.log('[DEBUG] loadSquareScene: Creating card for trainer Alin');
      const alinCard = new NPCCard(trainerAlin, (clickedNpcData) => {
        this.showNPCDetails(clickedNpcData);
      });
      this.npcCardInstances.set('trainer_alin', alinCard); // Store in map
      const alinElement = alinCard.getElement();
      // Position absolutely below scholar Xiaomei (same horizontal position, lower vertical position)
      alinElement.style.position = 'absolute';
      alinElement.style.right = '150px';
      alinElement.style.top = '250px';
      this.sceneContainer.appendChild(alinElement);
    }

    // Get scholar Xiaomei NPC - positioned absolutely on the right side (above trainer Alin)
    const scholarXiaomei = this.npcSystem.getNPC('scholar_xiaomei');
    if (scholarXiaomei && !this.lockedNPCs.has('scholar_xiaomei')) {
      console.log('[DEBUG] loadSquareScene: Creating card for scholar Xiaomei');
      const xiaomeiCard = new NPCCard(scholarXiaomei, (clickedNpcData) => {
        this.showNPCDetails(clickedNpcData);
      });
      this.npcCardInstances.set('scholar_xiaomei', xiaomeiCard); // Store in map
      const xiaomeiElement = xiaomeiCard.getElement();
      // Position absolutely on the right side (above trainer Alin)
      xiaomeiElement.style.position = 'absolute';
      xiaomeiElement.style.right = '150px';
      xiaomeiElement.style.top = '100px';
      this.sceneContainer.appendChild(xiaomeiElement);
    }

    // Get chef Curry NPC - positioned absolutely on the right side
    const chefCurry = this.npcSystem.getNPC('chef_curry');
    if (chefCurry && !this.lockedNPCs.has('chef_curry')) {
      console.log('[DEBUG] loadSquareScene: Creating card for chef Curry');
      const chefCard = new NPCCard(chefCurry, (clickedNpcData) => {
        this.showNPCDetails(clickedNpcData);
      });
      this.npcCardInstances.set('chef_curry', chefCard); // Store in map
      const chefElement = chefCard.getElement();
      // Position absolutely on the right side, below scholar Xiaomei
      chefElement.style.position = 'absolute';
      chefElement.style.right = '230px';
      chefElement.style.top = '450px';
      this.sceneContainer.appendChild(chefElement);
    }

    // Get alchemist Tuanzi NPC - positioned absolutely, aligned with chef Curry
    const alchemistTuanzi = this.npcSystem.getNPC('alchemist_tuanzi');
    if (alchemistTuanzi && !this.lockedNPCs.has('alchemist_tuanzi')) {
      console.log('[DEBUG] loadSquareScene: Creating card for alchemist Tuanzi');
      const tuanziCard = new NPCCard(alchemistTuanzi, (clickedNpcData) => {
        this.showNPCDetails(clickedNpcData);
      });
      this.npcCardInstances.set('alchemist_tuanzi', tuanziCard); // Store in map
      const tuanziElement = tuanziCard.getElement();
      // Position absolutely, 125px to the left of chef Curry (right: 230px + 125px = 355px), same vertical position
      tuanziElement.style.position = 'absolute';
      tuanziElement.style.right = '355px';
      tuanziElement.style.top = '450px';
      this.sceneContainer.appendChild(tuanziElement);
    }

    // Get summoner Kaoezi NPC - positioned absolutely in the lower-left area
    const summonerKaoezi = this.npcSystem.getNPC('summoner_kaoezi');
    if (summonerKaoezi && !this.lockedNPCs.has('summoner_kaoezi')) {
      console.log('[DEBUG] loadSquareScene: Creating card for summoner Kaoezi');
      const kaoeziCard = new NPCCard(summonerKaoezi, (clickedNpcData) => {
        this.showNPCDetails(clickedNpcData);
      });
      this.npcCardInstances.set('summoner_kaoezi', kaoeziCard); // Store in map
      const kaoeziElement = kaoeziCard.getElement();
      // Position absolutely in the lower-left area (red circle position in the image)
      kaoeziElement.style.position = 'absolute';
      kaoeziElement.style.left = '325px';
      kaoeziElement.style.top = '350px';
      this.sceneContainer.appendChild(kaoeziElement);
    }

    console.log('[DEBUG] loadSquareScene: NPC container added to scene');
  }

  private loadMarketScene(): void {
    if (!this.sceneContainer) return;

    // Create semi-transparent red overlay area around player's stall
    const redOverlay = document.createElement('div');
    redOverlay.style.cssText = `
      position: absolute;
      left: 340px;
      top: 490px;
      width: 155px;
      height: 150px;
      background: rgba(255, 0, 0, 0);
      border: none;
      border-radius: 8px;
      pointer-events: none;
      z-index: 40;
    `;
    this.sceneContainer.appendChild(redOverlay);

    // Equipment Merchant Youliang - positioned on the left
    const youliang = this.npcSystem.getNPC('merchant_youliang');
    if (youliang && !this.lockedNPCs.has('merchant_youliang')) {
      const card = new NPCCard(youliang, (clickedNpcData) => {
        this.showNPCDetails(clickedNpcData);
      });
      this.npcCardInstances.set('merchant_youliang', card);
      const el = card.getElement();
      el.style.position = 'absolute';
      el.style.right = '365px';
      el.style.top = '250px';
      this.sceneContainer.appendChild(el);
    }

    // Merchant Xiaoheiyang - positioned 80px to the right of Youliang
    const xiaoheiyang = this.npcSystem.getNPC('merchant_xiaoheiyang');
    if (xiaoheiyang && !this.lockedNPCs.has('merchant_xiaoheiyang')) {
      const card = new NPCCard(xiaoheiyang, (clickedNpcData) => {
        this.showNPCDetails(clickedNpcData);
      });
      this.npcCardInstances.set('merchant_xiaoheiyang', card);
      const el = card.getElement();
      el.style.position = 'absolute';
      el.style.right = '210px';
      el.style.top = '250px';
      this.sceneContainer.appendChild(el);
    }

    // Bookseller Xiaochao - positioned 230px below Xiaoheiyang
    const xiaochao = this.npcSystem.getNPC('bookseller_xiaochao');
    if (xiaochao && !this.lockedNPCs.has('bookseller_xiaochao')) {
      const card = new NPCCard(xiaochao, (clickedNpcData) => {
        this.showNPCDetails(clickedNpcData);
      });
      this.npcCardInstances.set('bookseller_xiaochao', card);
      const el = card.getElement();
      el.style.position = 'absolute';
      el.style.right = '210px';
      el.style.top = '480px';
      this.sceneContainer.appendChild(el);
    }

    // Player's Stall - positioned in the lower-left area (red circle in image)
    const playerStall = this.npcSystem.getNPC('player_stall');
    if (playerStall && !this.lockedNPCs.has('player_stall')) {
      const card = new NPCCard(playerStall, (clickedNpcData) => {
        this.showPlayerStallDetails(clickedNpcData);
      });
      const el = card.getElement();
      el.style.position = 'absolute';
      el.style.left = '400px';
      el.style.top = '500px';
      this.sceneContainer.appendChild(el);
      
      // Create "Out of Stock" floating indicator
      this.stallStatusIndicator = document.createElement('div');
      this.stallStatusIndicator.style.cssText = `
        position: absolute;
        left: 420px;
        top: 480px;
        font-size: 16px;
        font-weight: bold;
        color: #ffffff;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        pointer-events: none;
        z-index: 60;
        animation: float 2s ease-in-out infinite;
      `;
      this.stallStatusIndicator.textContent = '缺货中';
      
      // Add CSS animation for floating effect
      const style = document.createElement('style');
      style.textContent = `
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `;
      document.head.appendChild(style);
      
      this.sceneContainer.appendChild(this.stallStatusIndicator);
      
      // Update stall status
      this.updateStallStatus();
    }

    console.log('[DEBUG] loadMarketScene: NPCs added to scene');
  }
  
  /**
   * Check if stall has any items in stock
   */
  private hasStallItems(): boolean {
    for (const [_, itemData] of this.playerStallItems) {
      if (itemData.quantity > 0) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Update stall open/closed status based on inventory
   */
  private updateStallStatus(): void {
    const hasItems = this.hasStallItems();
    this.isStallOpen = hasItems;
    
    // Update status indicator visibility
    if (this.stallStatusIndicator) {
      this.stallStatusIndicator.style.display = hasItems ? 'none' : 'block';
    }
    
    console.log(`[Stall] Status updated: ${hasItems ? 'OPEN' : 'CLOSED'}`);
  }

  private showPlayerStallDetails(npcData: any): void {
    const actionPanel = document.getElementById('action-panel');
    if (!actionPanel) return;

    // Check if emoji is an image path
    const isImage = npcData.emoji.includes('.png') || npcData.emoji.includes('.jpg');
    const avatarContent = isImage 
      ? `<img src="${npcData.emoji}" style="width: 100%; height: 100%; object-fit: cover;" />`
      : npcData.emoji;

    actionPanel.innerHTML = `
      <div style="padding: 20px;">
        <!-- Avatar and Name -->
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 60px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); overflow: hidden; margin: 0 auto 12px;">
            ${avatarContent}
          </div>
          <h2 style="margin: 0; color: #333; font-size: 20px; font-weight: bold;">${npcData.name}</h2>
        </div>

        <!-- Stall Management Button -->
        <button id="stall-management-btn" style="width: 100%; padding: 15px; background: #28a745; border: none; border-radius: 8px; color: white; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3); margin-bottom: 20px;">
          🏪 摊位管理
        </button>

        <!-- Work Slots Section -->
        <div style="background: #e8f5e9; border-radius: 12px; padding: 16px; border: 2px solid #4caf50;">
          <div style="font-size: 16px; font-weight: bold; color: #2e7d32; margin-bottom: 12px; text-align: center;">
            👷 工作槽位
          </div>
          <div id="work-slots-container" style="display: grid; grid-template-columns: 1fr; gap: 8px;">
          </div>
        </div>
      </div>
    `;

    // Add event listener for stall management button
    const stallManagementBtn = document.getElementById('stall-management-btn');
    if (stallManagementBtn) {
      stallManagementBtn.addEventListener('mouseenter', () => {
        stallManagementBtn.style.background = '#218838';
        stallManagementBtn.style.transform = 'translateY(-2px)';
        stallManagementBtn.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.4)';
      });
      stallManagementBtn.addEventListener('mouseleave', () => {
        stallManagementBtn.style.background = '#28a745';
        stallManagementBtn.style.transform = 'translateY(0)';
        stallManagementBtn.style.boxShadow = '0 2px 8px rgba(40, 167, 69, 0.3)';
      });
      stallManagementBtn.addEventListener('click', () => {
        this.showPlayerStallManagement();
      });
    }

    // Render work slots
    this.refreshWorkSlotsInActionPanel();
  }

  private showPlayerStallManagement(): void {
    // Remove existing panel
    const existing = document.getElementById('player-stall-overlay');
    if (existing) existing.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'player-stall-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); display: flex; align-items: center;
      justify-content: center; z-index: 10000;
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    // Stall panel (larger than merchant stalls)
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: linear-gradient(135deg, #fdf6e3 0%, #f5e6c8 100%);
      border: 3px solid #8b6914; border-radius: 16px; padding: 24px;
      width: 720px; max-height: 85vh; overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #d4a843;
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = `font-size:20px;font-weight:bold;color:#5a3e1b;`;
    title.innerHTML = `🏪 我的摊位管理`;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none; border: none; font-size: 20px; cursor: pointer;
      color: #8b6914; padding: 4px 8px; border-radius: 4px;
    `;
    closeBtn.addEventListener('click', () => overlay.remove());

    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Info text
    const infoText = document.createElement('div');
    infoText.style.cssText = `
      margin-bottom: 16px; padding: 12px; background: #fff3cd; border-radius: 8px;
      color: #856404; font-size: 13px; border: 1px solid #ffeaa7;
    `;
    infoText.innerHTML = `
      💡 点击空置槽位可以添加商品
    `;
    panel.appendChild(infoText);

    // Item grid (6 columns x 4 rows = 24 slots)
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;
    `;

    // Create 24 slots
    const slotCount = 24;
    for (let i = 0; i < slotCount; i++) {
      const slotData = this.playerStallItems.get(i);
      const slot = document.createElement('div');
      
      if (slotData) {
        // Slot has item
        const itemInfo = this.itemSystem.getItem(slotData.itemId);
        if (itemInfo) {
          const rarityColors = ['#888', '#3498db', '#9b59b6', '#e67e22'];
          const rarityNames = ['普通', '稀有', '史诗', '传说'];
          const rColor = rarityColors[itemInfo.rarity] || '#888';
          
          slot.style.cssText = `
            background: #fff; 
            border: 2px solid ${rColor}; 
            border-radius: 10px;
            padding: 10px; text-align: center; 
            cursor: pointer; 
            transition: all 0.2s;
            display: flex; flex-direction: column; align-items: center; gap: 4px;
            min-height: 100px;
            position: relative;
            overflow: visible;
          `;

          let iconHtml = '';
          if (itemInfo.icon && (itemInfo.icon.includes('.png') || itemInfo.icon.includes('.jpg'))) {
            iconHtml = `<img src="${itemInfo.icon}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">`;
          } else {
            iconHtml = `<div style="width:48px;height:48px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#f0f0f0;">${itemInfo.icon || '📦'}</div>`;
          }

          // Calculate purchase price (value * 0.5)
          const purchasePrice = Math.floor((itemInfo.buyPrice || 0) * 0.5);
          
          slot.innerHTML = `
            <div class="remove-btn" style="position:absolute;top:-6px;right:-6px;width:24px;height:24px;background:#dc3545;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:bold;cursor:pointer;z-index:10;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;">✕</div>
            ${iconHtml}
            <div style="font-size:11px;font-weight:bold;color:${rColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${itemInfo.name}</div>
            <div style="font-size:10px;color:#999;">库存: ${slotData.quantity}</div>
            <div style="font-size:10px;color:#28a745;font-weight:bold;">💰 卖出价格: ${purchasePrice}金币</div>
          `;

          // Add remove button event listener
          const removeBtn = slot.querySelector('.remove-btn');
          if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
              e.stopPropagation(); // Prevent slot click event
              this.removeItemFromStallSlot(i, overlay);
            });
            removeBtn.addEventListener('mouseenter', () => {
              (removeBtn as HTMLElement).style.background = '#c82333';
              (removeBtn as HTMLElement).style.transform = 'scale(1.1)';
            });
            removeBtn.addEventListener('mouseleave', () => {
              (removeBtn as HTMLElement).style.background = '#dc3545';
              (removeBtn as HTMLElement).style.transform = 'scale(1)';
            });
          }
        }
      } else {
        // Empty slot
        slot.style.cssText = `
          background: #fff; 
          border: 2px dashed #ccc; 
          border-radius: 10px;
          padding: 10px; text-align: center; 
          cursor: pointer; 
          transition: all 0.2s;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          min-height: 100px;
        `;

        slot.innerHTML = `
          <div style="width:48px;height:48px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#f0f0f0;">📦</div>
          <div style="font-size:11px;font-weight:bold;color:#999;">空置</div>
          <div style="font-size:10px;color:#ccc;">点击添加</div>
        `;
      }

      slot.addEventListener('mouseenter', () => {
        slot.style.transform = 'translateY(-2px)';
        slot.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        if (!slotData) {
          slot.style.borderColor = '#8b6914';
        }
      });
      slot.addEventListener('mouseleave', () => {
        slot.style.transform = 'translateY(0)';
        slot.style.boxShadow = 'none';
        if (!slotData) {
          slot.style.borderColor = '#ccc';
        }
      });

      slot.addEventListener('click', () => {
        this.showItemSelectionForStall(i, overlay);
      });

      grid.appendChild(slot);
    }

    panel.appendChild(grid);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  private showItemSelectionForStall(slotIndex: number, stallOverlay: HTMLElement): void {
    // Create item selection overlay
    const selectionOverlay = document.createElement('div');
    selectionOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.7); display: flex; align-items: center;
      justify-content: center; z-index: 10001;
    `;
    selectionOverlay.addEventListener('click', (e) => {
      if (e.target === selectionOverlay) {
        selectionOverlay.remove();
      }
    });

    // Selection panel
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      border: 3px solid #667eea; border-radius: 16px; padding: 24px;
      width: 800px; max-height: 80vh; overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #667eea;
    `;

    const title = document.createElement('div');
    title.style.cssText = `font-size:20px;font-weight:bold;color:#333;`;
    title.textContent = '📦 选择商品';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none; border: none; font-size: 20px; cursor: pointer;
      color: #667eea; padding: 4px 8px; border-radius: 4px;
    `;
    closeBtn.addEventListener('click', () => selectionOverlay.remove());

    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Get player inventory - filter to only allowed types for player stall
    const inventory = this.itemSystem.getInventory();
    const stallAllowedTypes = ['food', 'equipment', 'potion'];
    const filteredInventory = inventory.filter((invSlot: any) => {
      if (!invSlot || !invSlot.itemId) return false;
      const info = this.itemSystem.getItem(invSlot.itemId);
      return info && stallAllowedTypes.includes(info.type);
    });
    
    if (filteredInventory.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = `
        text-align: center; padding: 40px; color: #666; font-size: 16px;
      `;
      emptyMsg.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
        <div>背包中没有可上架的物品</div>
        <div style="font-size: 13px; color: #999; margin-top: 8px;">仅支持菜肴、装备、药剂</div>
      `;
      panel.appendChild(emptyMsg);
    } else {
      // Item grid
      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;
      `;

      const rarityColors = ['#888', '#3498db', '#9b59b6', '#e67e22'];
      const rarityNames = ['普通', '稀有', '史诗', '传说'];

      inventory.forEach((invSlot: any) => {
        if (!invSlot || !invSlot.itemId) return;
        
        const itemInfo = this.itemSystem.getItem(invSlot.itemId);
        if (!itemInfo) return;

        // Only allow dishes (food), equipment, and potions in player stall
        const allowedTypes = ['food', 'equipment', 'potion'];
        if (!allowedTypes.includes(itemInfo.type)) return;

        // For equipment (non-stackable), check instanceId against equippedItemsTracker
        const isEquipped = invSlot.instanceId ? this.equippedItemsTracker.has(invSlot.instanceId) : false;
        const rColor = rarityColors[itemInfo.rarity] || '#888';
        
        const itemCard = document.createElement('div');
        itemCard.style.cssText = `
          background: ${isEquipped ? '#f0f0f0' : '#fff'}; 
          border: 2px solid ${isEquipped ? '#ccc' : rColor}; 
          border-radius: 10px;
          padding: 12px; text-align: center; 
          cursor: ${isEquipped ? 'not-allowed' : 'pointer'}; 
          transition: all 0.2s;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          ${isEquipped ? 'opacity: 0.5;' : ''}
        `;

        let iconHtml = '';
        if (itemInfo.icon && (itemInfo.icon.includes('.png') || itemInfo.icon.includes('.jpg'))) {
          iconHtml = `<img src="${itemInfo.icon}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;">`;
        } else {
          iconHtml = `<div style="width:56px;height:56px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:28px;background:#f0f0f0;">${itemInfo.icon || '📦'}</div>`;
        }

        itemCard.innerHTML = `
          ${iconHtml}
          <div style="font-size:12px;font-weight:bold;color:${isEquipped ? '#999' : rColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${itemInfo.name}</div>
          <div style="font-size:11px;color:#999;">${rarityNames[itemInfo.rarity] || '普通'}</div>
          ${isEquipped ? '<div style="font-size:11px;color:#e67e22;font-weight:bold;">装备中</div>' : `<div style="font-size:11px;color:#666;">拥有: ${invSlot.quantity}</div>`}
        `;

        if (!isEquipped) {
          itemCard.addEventListener('mouseenter', () => {
            itemCard.style.transform = 'translateY(-4px)';
            itemCard.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
          });
          itemCard.addEventListener('mouseleave', () => {
            itemCard.style.transform = 'translateY(0)';
            itemCard.style.boxShadow = 'none';
          });

          itemCard.addEventListener('click', () => {
            this.addItemToStallSlot(slotIndex, invSlot.itemId);
            selectionOverlay.remove();
            stallOverlay.remove();
            // Reopen stall management to show updated slots
            this.showPlayerStallManagement();
          });
        }

        grid.appendChild(itemCard);
      });

      panel.appendChild(grid);
    }

    selectionOverlay.appendChild(panel);
    document.body.appendChild(selectionOverlay);
  }

  private addItemToStallSlot(slotIndex: number, itemId: string): void {
    const existingSlot = this.playerStallItems.get(slotIndex);
    
    // Check if item is currently equipped by a character (defensive check)
    // equippedItemsTracker keys are instanceIds, so we need to resolve them
    const instances = this.itemSystem.getAllItemInstances();
    const matchingInstance = instances.find(inst => inst.itemId === itemId && inst.instanceId && this.equippedItemsTracker.has(inst.instanceId));
    if (matchingInstance) {
      this.showNotification(`该装备正在被角色使用中，无法上架摊位`, 'warning');
      return;
    }
    
    // Check if warehouse has enough stock
    const currentQty = this.itemSystem.getItemQuantity(itemId);
    if (currentQty <= 0) {
      this.showNotification(`仓库中没有足够的${this.itemSystem.getItem(itemId)?.name || '物品'}`, 'warning');
      return;
    }
    
    if (existingSlot && existingSlot.itemId === itemId) {
      // Same item, increase quantity
      existingSlot.quantity += 1;
      this.itemSystem.removeItem(itemId, 1);
      this.showNotification(`已添加1个${this.itemSystem.getItem(itemId)?.name || '物品'}到摊位`, 'success');
      // Emit quest event for stall add item
      this.eventSystem.emit({ type: 'quest:stall_add_item', timestamp: Date.now(), itemId, quantity: 1 });
    } else if (existingSlot) {
      // Different item, replace — return old item to warehouse first
      this.itemSystem.addItem(existingSlot.itemId, existingSlot.quantity);
      this.playerStallItems.set(slotIndex, { itemId, quantity: 1 });
      this.itemSystem.removeItem(itemId, 1);
      this.showNotification(`已将${this.itemSystem.getItem(itemId)?.name || '物品'}添加到摊位`, 'success');
      // Emit quest event for stall add item
      this.eventSystem.emit({ type: 'quest:stall_add_item', timestamp: Date.now(), itemId, quantity: 1 });
    } else {
      // Empty slot, add new item
      this.playerStallItems.set(slotIndex, { itemId, quantity: 1 });
      this.itemSystem.removeItem(itemId, 1);
      this.showNotification(`已将${this.itemSystem.getItem(itemId)?.name || '物品'}添加到摊位`, 'success');
      // Emit quest event for stall add item
      this.eventSystem.emit({ type: 'quest:stall_add_item', timestamp: Date.now(), itemId, quantity: 1 });
    }
    
    // Update stall status
    this.updateStallStatus();
  }

  private removeItemFromStallSlot(slotIndex: number, stallOverlay: HTMLElement): void {
    const slotData = this.playerStallItems.get(slotIndex);
    if (slotData) {
      const itemName = this.itemSystem.getItem(slotData.itemId)?.name || '物品';
      // Return items to warehouse
      this.itemSystem.addItem(slotData.itemId, slotData.quantity);
      this.playerStallItems.delete(slotIndex);
      this.showNotification(`已将${itemName}从摊位下架，${slotData.quantity}个已归还仓库`, 'success');
      
      // Update stall status
      this.updateStallStatus();
      
      // Refresh the stall panel
      stallOverlay.remove();
      this.showPlayerStallManagement();
    }
  }

  // Work Slots Methods
  private createWorkSlot(slotIndex: number): HTMLDivElement {
    const slot = document.createElement('div');
    slot.className = 'work-slot';
    slot.setAttribute('data-slot-index', slotIndex.toString());
    slot.style.cssText = `
      background: #f8f9fa;
      border: 2px dashed #4caf50;
      border-radius: 8px;
      padding: 8px;
      min-height: 80px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `;
    
    const character = this.workSlots[slotIndex];
    
    if (character) {
      // Show character info
      this.renderCharacterInWorkSlot(slot, character, slotIndex);
    } else {
      // Show empty slot
      slot.innerHTML = `
        <div style="text-align: center; color: #4caf50;">
          <div style="font-size: 24px; margin-bottom: 4px;">👷</div>
          <div style="font-size: 10px;">点击添加</div>
        </div>
      `;
      
      slot.addEventListener('click', () => {
        this.showCharacterSelectionForWork(slotIndex);
      });
    }
    
    slot.addEventListener('mouseenter', () => {
      if (!character) {
        slot.style.borderColor = '#2e7d32';
        slot.style.background = '#f1f8e9';
      }
    });
    
    slot.addEventListener('mouseleave', () => {
      if (!character) {
        slot.style.borderColor = '#4caf50';
        slot.style.background = '#f8f9fa';
      }
    });
    
    return slot;
  }

  private renderCharacterInWorkSlot(slot: HTMLDivElement, character: any, slotIndex: number): void {
    slot.style.border = '2px solid #4caf50';
    slot.style.background = 'white';
    slot.style.cursor = 'default';
    slot.style.position = 'relative';
    slot.innerHTML = '';
    
    // Create horizontal layout container
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      gap: 6px;
      width: 100%;
      align-items: center;
    `;
    
    // Left side - Avatar
    const avatar = document.createElement('div');
    avatar.style.cssText = `
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
      avatar.style.fontSize = '20px';
    }
    
    // Right side - Info
    const infoContainer = document.createElement('div');
    infoContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    `;
    
    // Name and title
    const nameDiv = document.createElement('div');
    nameDiv.textContent = character.title ? `${character.title}${character.name}` : character.name;
    nameDiv.style.cssText = `
      font-size: 11px;
      font-weight: bold;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    
    // Level and job
    const infoDiv = document.createElement('div');
    infoDiv.textContent = `Lv.${character.level} ${this.getJobDisplayName(character.job)}`;
    infoDiv.style.cssText = `
      font-size: 9px;
      color: #666;
    `;
    
    infoContainer.appendChild(nameDiv);
    infoContainer.appendChild(infoDiv);
    
    container.appendChild(avatar);
    container.appendChild(infoContainer);
    
    // Add circular X button in top-right corner
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.style.cssText = `
      position: absolute;
      top: 2px;
      right: 2px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #dc3545;
      color: white;
      border: 2px solid white;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      line-height: 1;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      z-index: 10;
    `;
    removeBtn.addEventListener('mouseenter', () => {
      removeBtn.style.background = '#c82333';
      removeBtn.style.transform = 'scale(1.1)';
    });
    removeBtn.addEventListener('mouseleave', () => {
      removeBtn.style.background = '#dc3545';
      removeBtn.style.transform = 'scale(1)';
    });
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeCharacterFromWorkSlot(slotIndex);
    });
    
    // Check if this slot has an active crafting task
    const activeTask = this.workSlotTasks.get(slotIndex);
    
    if (activeTask) {
      // Show crafting progress
      const elapsed = Date.now() - activeTask.startTime;
      const progress = Math.min(elapsed / activeTask.duration, 1);
      const percent = Math.round(progress * 100);
      
      // Bottom row: crafting info (left) + recipe icon (right)
      const bottomRow = document.createElement('div');
      bottomRow.style.cssText = `
        width: 100%;
        margin-top: 6px;
        display: flex;
        gap: 8px;
        align-items: center;
      `;
      
      // Left: crafting info (label + progress bar + percent)
      const craftingInfo = document.createElement('div');
      craftingInfo.style.cssText = `
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      `;
      
      // Recipe name + type
      const typeLabels: Record<string, string> = { cooking: '烹饪', equipment: '装备', alchemy: '炼金' };
      const typeColors: Record<string, string> = { cooking: '#ff9800', equipment: '#2196f3', alchemy: '#9c27b0' };
      
      const recipeLabel = document.createElement('div');
      recipeLabel.style.cssText = `
        font-size: 10px;
        color: ${typeColors[activeTask.type] || '#666'};
        font-weight: bold;
        text-align: center;
      `;
      recipeLabel.textContent = `${typeLabels[activeTask.type] || ''} ${activeTask.recipe.name}`;
      
      // Progress bar
      const progressBar = document.createElement('div');
      progressBar.style.cssText = `
        width: 100%;
        height: 8px;
        background: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
      `;
      
      const progressFill = document.createElement('div');
      progressFill.className = 'progress-fill';
      progressFill.style.cssText = `
        width: ${percent}%;
        height: 100%;
        background: linear-gradient(90deg, #4caf50, #8bc34a);
        border-radius: 4px;
        transition: width 0.3s;
      `;
      progressBar.appendChild(progressFill);
      
      const percentLabel = document.createElement('div');
      percentLabel.className = 'percent-label';
      percentLabel.style.cssText = `font-size: 9px; color: #666; text-align: center;`;
      percentLabel.textContent = `${percent}%`;
      
      craftingInfo.appendChild(recipeLabel);
      craftingInfo.appendChild(progressBar);
      craftingInfo.appendChild(percentLabel);
      
      // Right: recipe item icon
      const recipeIconContainer = document.createElement('div');
      recipeIconContainer.style.cssText = `
        width: 48px;
        height: 48px;
        border-radius: 8px;
        background: #f5f5f5;
        border: 2px solid #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
      `;
      
      if (activeTask.recipe.icon) {
        const recipeIcon = document.createElement('img');
        recipeIcon.src = activeTask.recipe.icon;
        recipeIcon.alt = activeTask.recipe.name;
        recipeIcon.style.cssText = `width: 100%; height: 100%; object-fit: cover; border-radius: 6px;`;
        recipeIconContainer.appendChild(recipeIcon);
      }
      
      bottomRow.appendChild(craftingInfo);
      bottomRow.appendChild(recipeIconContainer);
      
      slot.appendChild(container);
      slot.appendChild(bottomRow);
      slot.appendChild(removeBtn);
    } else {
      // Show "Assign Work" button
      const assignWorkBtn = document.createElement('button');
      assignWorkBtn.textContent = '📋 指派工作';
      assignWorkBtn.style.cssText = `
        width: 100%;
        padding: 6px;
        margin-top: 6px;
        background: #ff9800;
        border: none;
        border-radius: 6px;
        color: white;
        font-size: 11px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 4px rgba(255, 152, 0, 0.3);
      `;
      assignWorkBtn.addEventListener('mouseenter', () => {
        assignWorkBtn.style.background = '#f57c00';
        assignWorkBtn.style.transform = 'translateY(-1px)';
        assignWorkBtn.style.boxShadow = '0 3px 6px rgba(255, 152, 0, 0.4)';
      });
      assignWorkBtn.addEventListener('mouseleave', () => {
        assignWorkBtn.style.background = '#ff9800';
        assignWorkBtn.style.transform = 'translateY(0)';
        assignWorkBtn.style.boxShadow = '0 2px 4px rgba(255, 152, 0, 0.3)';
      });
      assignWorkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showWorkAssignmentPanel(slotIndex);
      });
      
      slot.appendChild(container);
      slot.appendChild(assignWorkBtn);
      slot.appendChild(removeBtn);
    }
  }

  private showCharacterSelectionForWork(slotIndex: number): void {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.7); display: flex; align-items: center;
      justify-content: center; z-index: 10001;
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    // Selection panel
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
      border: 3px solid #4caf50; border-radius: 16px; padding: 24px;
      width: 800px; max-height: 80vh; overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #4caf50;
    `;

    const title = document.createElement('div');
    title.style.cssText = `font-size:20px;font-weight:bold;color:#2e7d32;`;
    title.textContent = '👷 选择工作角色';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none; border: none; font-size: 20px; cursor: pointer;
      color: #4caf50; padding: 4px 8px; border-radius: 4px;
    `;
    closeBtn.addEventListener('click', () => overlay.remove());

    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Get all recruited characters
    const allCharacters = this.npcSystem.getRecruitedCharacters();
    
    if (allCharacters.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = `
        text-align: center; padding: 40px; color: #666; font-size: 16px;
      `;
      emptyMsg.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
        <div>没有可用的角色</div>
      `;
      panel.appendChild(emptyMsg);
    } else {
      // Character grid
      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
      `;

      allCharacters.forEach((character: any) => {
        const card = this.createWorkCharacterCard(character, slotIndex, overlay);
        grid.appendChild(card);
      });

      panel.appendChild(grid);
    }

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  private createWorkCharacterCard(character: any, slotIndex: number, overlay: HTMLElement): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.3s ease;
      border: 2px solid transparent;
    `;
    
    // Check if character is already in work slots
    const isInWorkSlots = this.workSlots.some(slot => slot && slot.id === character.id);
    
    // Check if character is in party slots
    const isInParty = this.partySlots.some(slot => slot && slot.id === character.id);
    
    if (isInWorkSlots || isInParty) {
      card.style.opacity = '0.5';
      card.style.cursor = 'not-allowed';
      card.style.background = '#f0f0f0';
    }
    
    // Avatar
    const avatar = document.createElement('div');
    avatar.style.cssText = `
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 10px auto;
      overflow: hidden;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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
      avatar.style.fontSize = '40px';
    }
    
    // Name
    const name = document.createElement('div');
    name.textContent = character.title ? `${character.title}${character.name}` : character.name;
    name.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      color: #333;
      text-align: center;
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    
    // Level and Job
    const info = document.createElement('div');
    info.textContent = `Lv.${character.level} ${this.getJobDisplayName(character.job)}`;
    info.style.cssText = `
      font-size: 12px;
      color: #666;
      text-align: center;
    `;
    
    // Show status if character is already assigned
    if (isInWorkSlots) {
      const status = document.createElement('div');
      status.textContent = '工作中';
      status.style.cssText = `
        font-size: 11px;
        color: #ff9800;
        text-align: center;
        margin-top: 4px;
        font-weight: bold;
      `;
      card.appendChild(status);
    } else if (isInParty) {
      const status = document.createElement('div');
      status.textContent = '编队中';
      status.style.cssText = `
        font-size: 11px;
        color: #2196f3;
        text-align: center;
        margin-top: 4px;
        font-weight: bold;
      `;
      card.appendChild(status);
    }
    
    // Assemble card
    card.appendChild(avatar);
    card.appendChild(name);
    card.appendChild(info);
    
    if (!isInWorkSlots && !isInParty) {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px)';
        card.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.15)';
        card.style.borderColor = '#4caf50';
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        card.style.borderColor = 'transparent';
      });
      
      card.addEventListener('click', () => {
        this.addCharacterToWorkSlot(character, slotIndex);
        overlay.remove();
      });
    }
    
    return card;
  }

  private addCharacterToWorkSlot(character: any, slotIndex: number): void {
    // Check if character is already in party
    if (this.partySlots.some(slot => slot && slot.id === character.id)) {
      this.showNotification('该角色正在编队中，无法添加到工作槽位', 'warning');
      return;
    }
    
    this.workSlots[slotIndex] = character;
    this.refreshWorkSlots(true);
    this.showNotification(`${character.name} 已添加到工作槽位`, 'success');
  }

  private removeCharacterFromWorkSlot(slotIndex: number): void {
    const character = this.workSlots[slotIndex];
    if (character) {
      // Cancel active crafting task if any
      const activeTask = this.workSlotTasks.get(slotIndex);
      if (activeTask) {
        window.clearInterval(activeTask.intervalId);
        this.workSlotTasks.delete(slotIndex);
        this.showNotification(`${character.name} 的制作任务已取消`, 'warning');
      }
      this.workSlots[slotIndex] = null;
      this.refreshWorkSlots(true);
      this.showNotification(`${character.name} 已移出工作槽位`, 'success');
    }
  }

  private refreshWorkSlots(forceRerender: boolean = false): void {
    // Refresh work slots in action panel (for player stall details)
    this.refreshWorkSlotsInActionPanel(forceRerender);
  }

  /**
   * Show work assignment panel in scene (similar to alchemy crafting panel)
   */
  private showWorkAssignmentPanel(slotIndex: number): void {
    if (!this.sceneContainer) return;

    // Create work assignment panel container
    const panelContainer = document.createElement('div');
    panelContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 80px 20px 20px 20px;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3);
      z-index: 100;
      overflow: hidden;
    `;

    // Title
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    `;

    const title = document.createElement('h2');
    title.textContent = '📋 指派工作';
    title.style.cssText = `
      color: white;
      font-size: 24px;
      font-weight: bold;
      margin: 0;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.5);
      border-radius: 8px;
      color: white;
      font-size: 24px;
      font-weight: bold;
      width: 40px;
      height: 40px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(255, 100, 100, 0.8)';
      closeButton.style.transform = 'scale(1.1)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
      closeButton.style.transform = 'scale(1)';
    });

    closeButton.addEventListener('click', () => {
      // Remove the panel
      panelContainer.remove();
    });

    titleContainer.appendChild(title);
    titleContainer.appendChild(closeButton);

    // Recipe grid container
    const recipeGrid = document.createElement('div');
    recipeGrid.style.cssText = `
      flex: 1;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 12px;
      align-content: start;
      overflow-y: auto;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 20px;
    `;

    // Get all recipes from all systems
    const cookingRecipes = this.cookingSystem.getAllRecipes();
    const equipmentRecipes = this.equipmentCraftingSystem.getAllRecipes();
    const alchemyRecipes = this.alchemyCraftingSystem.getAllRecipes();

    // Combine all recipes with type labels (filter out locked recipes)
    const allRecipes: Array<{recipe: any, type: 'cooking' | 'equipment' | 'alchemy'}> = [
      ...cookingRecipes.map(r => ({recipe: r, type: 'cooking' as const})),
      ...equipmentRecipes.map(r => ({recipe: r, type: 'equipment' as const})),
      ...alchemyRecipes.map(r => ({recipe: r, type: 'alchemy' as const}))
    ].filter(({recipe}) => !this.lockedRecipes.has(recipe.id));

    // Render recipe cards
    allRecipes.forEach(({recipe, type}) => {
      const recipeCard = document.createElement('div');
      recipeCard.style.cssText = `
        background: rgba(255, 255, 255, 1);
        border: none;
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      `;

      // Icon container
      const iconContainer = document.createElement('div');
      iconContainer.style.cssText = `
        width: 64px;
        height: 64px;
        background: rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      `;

      // Recipe icon
      const icon = document.createElement('img');
      icon.src = recipe.icon;
      icon.alt = recipe.name;
      icon.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 8px;
      `;

      iconContainer.appendChild(icon);

      // Recipe name
      const name = document.createElement('div');
      name.textContent = recipe.name;
      name.style.cssText = `
        color: #333;
        font-size: 12px;
        font-weight: bold;
        text-align: center;
        word-break: break-word;
      `;

      // Type badge (cooking/equipment/alchemy)
      const typeBadge = document.createElement('div');
      const typeLabels = {
        cooking: '烹饪',
        equipment: '装备',
        alchemy: '炼金'
      };
      const typeColors = {
        cooking: '#ff9800',
        equipment: '#2196f3',
        alchemy: '#9c27b0'
      };
      typeBadge.textContent = typeLabels[type];
      typeBadge.style.cssText = `
        background: ${typeColors[type]};
        color: white;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: bold;
        text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
      `;

      recipeCard.appendChild(iconContainer);
      recipeCard.appendChild(name);
      recipeCard.appendChild(typeBadge);

      // Hover effects
      recipeCard.addEventListener('mouseenter', () => {
        recipeCard.style.background = 'rgba(255, 255, 255, 1)';
        recipeCard.style.transform = 'translateY(-2px)';
        recipeCard.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
      });

      recipeCard.addEventListener('mouseleave', () => {
        recipeCard.style.background = 'rgba(255, 255, 255, 1)';
        recipeCard.style.transform = 'translateY(0)';
        recipeCard.style.boxShadow = 'none';
      });

      // Click handler - start crafting
      recipeCard.addEventListener('click', () => {
        // Get ingredients based on recipe type
        const ingredients = type === 'cooking' 
          ? (recipe.ingredients || []).map((i: any) => ({ itemId: i.itemId, amount: i.quantity || i.amount }))
          : (recipe.materials || []).map((i: any) => ({ itemId: i.itemId, amount: i.amount || i.quantity }));
        
        // Check if materials are sufficient
        const missingItems: string[] = [];
        for (const ing of ingredients) {
          const have = this.itemSystem.getItemQuantity(ing.itemId);
          if (have < ing.amount) {
            const itemName = this.itemSystem.getItem(ing.itemId)?.name || ing.itemId;
            missingItems.push(`${itemName}(需要${ing.amount},拥有${have})`);
          }
        }
        
        if (missingItems.length > 0) {
          this.showNotification(`材料不足: ${missingItems.join(', ')}`, 'warning');
          return;
        }
        
        // Check if slot already has a task
        if (this.workSlotTasks.has(slotIndex)) {
          this.showNotification('该工作槽位正在制作中', 'warning');
          return;
        }
        
        // Start crafting
        this.startWorkCrafting(slotIndex, recipe, type);
        
        // Close panel
        panelContainer.remove();
      });

      recipeGrid.appendChild(recipeCard);
    });

    // Assemble panel
    panelContainer.appendChild(titleContainer);
    panelContainer.appendChild(recipeGrid);

    // Add to scene
    this.sceneContainer.appendChild(panelContainer);
  }

  /**
   * Start a crafting task in a work slot. Auto-repeats on completion if materials are available.
   */
  private startWorkCrafting(slotIndex: number, recipe: any, type: string): void {
    // Get ingredients
    const ingredients = type === 'cooking'
      ? (recipe.ingredients || []).map((i: any) => ({ itemId: i.itemId, amount: i.quantity || i.amount }))
      : (recipe.materials || []).map((i: any) => ({ itemId: i.itemId, amount: i.amount || i.quantity }));

    // Check materials
    for (const ing of ingredients) {
      if (this.itemSystem.getItemQuantity(ing.itemId) < ing.amount) {
        this.showNotification(`材料不足，${recipe.name} 制作停止`, 'warning');
        this.refreshWorkSlots();
        return;
      }
    }

    // Consume materials
    for (const ing of ingredients) {
      this.itemSystem.removeItem(ing.itemId, ing.amount);
    }

    // Start crafting timer - duration based on rarity (3x multiplier)
    // Cooking uses numeric rarity (0, 1, 2), equipment/alchemy use string rarity ("common", "rare", "epic")
    let duration = 30000; // Default 30 seconds for common (10s * 3)
    const rarity = recipe.rarity;
    
    if (typeof rarity === 'number') {
      // Cooking recipes: 0=common, 1=rare, 2=epic
      if (rarity === 1) duration = 60000; // 60 seconds for rare (20s * 3)
      else if (rarity === 2) duration = 90000; // 90 seconds for epic (30s * 3)
    } else if (typeof rarity === 'string') {
      // Equipment/Alchemy recipes: "common", "rare", "epic"
      if (rarity === 'rare') duration = 60000;
      else if (rarity === 'epic') duration = 90000;
    }
    
    const startTime = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= duration) {
        // Crafting complete
        window.clearInterval(intervalId);
        this.workSlotTasks.delete(slotIndex);

        // Find empty stall slot
        let emptySlot = -1;
        for (let i = 0; i < 24; i++) {
          if (!this.playerStallItems.has(i)) {
            emptySlot = i;
            break;
          }
        }

        if (emptySlot >= 0) {
          this.playerStallItems.set(emptySlot, { itemId: recipe.id, quantity: 1 });
          this.updateStallStatus();
          this.showNotification(`${recipe.name} 制作完成，已上架到摊位`, 'success');
        } else {
          this.itemSystem.addItem(recipe.id, 1);
          this.showNotification(`${recipe.name} 制作完成，摊位已满，已放入仓库`, 'warning');
        }

        // Auto-repeat: try to start the same recipe again
        this.startWorkCrafting(slotIndex, recipe, type);
      } else {
        // Update progress display
        this.refreshWorkSlots();
      }
    }, 500);

    this.workSlotTasks.set(slotIndex, { recipe, type, startTime, duration, intervalId });
    this.showNotification(`开始制作 ${recipe.name}`, 'success');
    this.refreshWorkSlots();
  }

  private refreshWorkSlotsInActionPanel(forceRerender: boolean = false): void {
    const slotsContainer = document.getElementById('work-slots-container');
    if (!slotsContainer) return;
    
    // Check if slots already exist
    const existingSlots = slotsContainer.querySelectorAll('.work-slot');
    
    if (existingSlots.length === 4 && !forceRerender) {
      // Slots exist, only update crafting progress for active tasks
      for (let i = 0; i < 4; i++) {
        const slot = existingSlots[i] as HTMLDivElement;
        const activeTask = this.workSlotTasks.get(i);
        
        if (activeTask && this.workSlots[i]) {
          // Update progress bar only
          const elapsed = Date.now() - activeTask.startTime;
          const progress = Math.min(elapsed / activeTask.duration, 1);
          const percent = Math.round(progress * 100);
          
          const progressFill = slot.querySelector('.progress-fill') as HTMLElement;
          const percentLabel = slot.querySelector('.percent-label') as HTMLElement;
          
          if (progressFill) {
            progressFill.style.width = `${percent}%`;
          }
          if (percentLabel) {
            percentLabel.textContent = `${percent}%`;
          }
        }
      }
    } else {
      // Slots don't exist or count mismatch, recreate all
      slotsContainer.innerHTML = '';
      
      for (let i = 0; i < 4; i++) {
        const slot = this.createWorkSlot(i);
        slotsContainer.appendChild(slot);
      }
    }
  }

  private parseMembershipEffects(effects: any[]): { slotBonus: number; refreshBonus: number; priceMultiplier: number } {
    let slotBonus = 0;
    let refreshBonus = 0;
    let priceMultiplier = 1.0;
    
    for (const effect of effects) {
      // Handle string effects (membership items use string format)
      const effectStr = typeof effect === 'string' ? effect : '';
      
      if (!effectStr) continue;
      
      // Parse slot bonus: "装备商由良摊位商品数量+2" or "杂货商小黑羊摊位商品数量+4"
      const slotMatch = effectStr.match(/摊位商品数量\+(\d+)/);
      if (slotMatch) {
        slotBonus = parseInt(slotMatch[1], 10);
      }
      
      // Parse refresh bonus: "装备商由良摊位刷新次数+1" or "厨师咖喱摊位刷新次数+2"
      const refreshMatch = effectStr.match(/摊位刷新次数\+(\d+)/);
      if (refreshMatch) {
        refreshBonus = parseInt(refreshMatch[1], 10);
      }
      
      // Parse price discount: "装备商由良摊位商品价格-20%"
      const priceMatch = effectStr.match(/摊位商品价格-(\d+)%/);
      if (priceMatch) {
        const discount = parseInt(priceMatch[1], 10);
        priceMultiplier = 1.0 - (discount / 100);
      }
    }
    
    return { slotBonus, refreshBonus, priceMultiplier };
  }

  private showTradeStall(npcData: NPCData, itemType: 'material' | 'equipment' | 'dish' | 'book'): void {
    // Remove existing stall
    const existing = document.getElementById('trade-stall-overlay');
    if (existing) existing.remove();

    // Check for membership items and calculate bonuses
    let slotBonus = 0;
    let refreshBonus = 0;
    let priceMultiplier = 1.0;
    
    // Determine which membership items to check based on merchant
    let regularMembershipId = '';
    let goldMembershipId = '';
    
    if (npcData.id === 'merchant_youliang') {
      regularMembershipId = 'youliang_membership';
      goldMembershipId = 'youliang_gold_membership';
    } else if (npcData.id === 'merchant_xiaoheiyang') {
      regularMembershipId = 'xiaoheiyang_membership';
      goldMembershipId = 'xiaoheiyang_gold_membership';
    } else if (npcData.id === 'chef_curry') {
      regularMembershipId = 'curry_membership';
      goldMembershipId = 'curry_gold_membership';
    }
    
    // Check for gold membership first (higher tier)
    if (goldMembershipId && this.itemSystem.hasItem(goldMembershipId)) {
      const goldMembership = this.itemSystem.getItem(goldMembershipId);
      if (goldMembership && goldMembership.effects) {
        const bonuses = this.parseMembershipEffects(goldMembership.effects);
        slotBonus = bonuses.slotBonus;
        refreshBonus = bonuses.refreshBonus;
        priceMultiplier = bonuses.priceMultiplier;
      }
    } else if (regularMembershipId && this.itemSystem.hasItem(regularMembershipId)) {
      const regularMembership = this.itemSystem.getItem(regularMembershipId);
      if (regularMembership && regularMembership.effects) {
        const bonuses = this.parseMembershipEffects(regularMembership.effects);
        slotBonus = bonuses.slotBonus;
        refreshBonus = bonuses.refreshBonus;
        priceMultiplier = bonuses.priceMultiplier;
      }
    }

    // Check if this merchant already has inventory cached
    const expectedSlotCount = 4 + slotBonus;
    let stallItems: { item: any; price: number; stock: number; affix?: any }[] = [];
    const cachedInventory = this.merchantInventories.get(npcData.id);
    if (cachedInventory && cachedInventory.length >= expectedSlotCount) {
      // Use cached inventory (slot count matches or exceeds expected)
      stallItems = cachedInventory;
    } else {
      // Clear stale cache if slot count changed (e.g. player got membership card)
      if (cachedInventory) {
        this.merchantInventories.delete(npcData.id);
      }
      // Generate new inventory for first time
      let filteredItems: any[] = [];
      
      if (itemType === 'dish') {
        // For dishes, get from cooking recipes (filter out locked)
        const allRecipes = this.cookingSystem.getAllRecipes().filter((r: any) => !this.lockedRecipes.has(r.id));
        filteredItems = allRecipes.filter(recipe => {
          if (!recipe.icon) return false;
          return recipe.icon.includes('images/') && (recipe.icon.includes('.png') || recipe.icon.includes('.jpg'));
        }).map(recipe => ({
          id: recipe.id,
          name: recipe.name,
          rarity: recipe.rarity,
          icon: recipe.icon,
          type: 'dish',
          buyPrice: recipe.buyPrice
        }));
      } else {
        // For materials and equipment, get from item system
        const allItems = this.itemSystem.getAllItems();
        filteredItems = allItems.filter(item => {
          if (item.type !== itemType) return false;
          if (!item.icon) return false;
          // Only include items with actual image files (not emoji or placeholder)
          if (!item.icon.includes('images/') || (!item.icon.includes('.png') && !item.icon.includes('.jpg'))) {
            return false;
          }
          // Bookseller stage-based blueprint filtering
          if (npcData.id === 'bookseller_xiaochao' && item.unlockRecipe) {
            const forestBlueprints = ['iron_spear', 'birch_wand', 'chain_mail', 'birch_plate_armor', 'iron_round_shield', 'kitchen_knife', 'iron_ring', 'iron_necklace', 'crusher', 'gravedigger', 'death_god', 'skull_crusher', 'ancestral_teaching'];
            const caveBlueprints = ['legion_axe', 'blue_dawn_wand', 'legion_armor', 'blue_dawn_robe', 'legion_round_shield', 'legion_mirror_shield', 'legion_ring', 'legion_necklace', 'former_emperor', 'pope', 'glory', 'unity', 'devotion'];
            if (forestBlueprints.includes(item.unlockRecipe) && !this.unlockedStages.has('forest')) {
              return false;
            }
            if (caveBlueprints.includes(item.unlockRecipe) && !this.unlockedStages.has('cave')) {
              return false;
            }
          }
          return true;
        });
      }

      // Base slot count is 4, plus membership bonus
      const slotCount = 4 + slotBonus;
      
      // Group items by rarity for weighted selection
      const itemsByRarity = new Map<number, any[]>();
      filteredItems.forEach(item => {
        const rarity = item.rarity || 0;
        if (!itemsByRarity.has(rarity)) {
          itemsByRarity.set(rarity, []);
        }
        itemsByRarity.get(rarity)!.push(item);
      });
      
      // Helper function to select rarity based on probability
      // 70% common (0), 20% rare (1), 7% epic (2), 3% legendary (3)
      const selectRarityByProbability = (): number => {
        const rand = Math.random() * 100;
        if (rand < 70) return 0; // Common
        if (rand < 90) return 1; // Rare
        if (rand < 97) return 2; // Epic
        return 3; // Legendary
      };
      
      if (itemType === 'dish') {
        // For dishes, allow duplicates - randomly pick with replacement based on rarity probability
        for (let i = 0; i < slotCount && filteredItems.length > 0; i++) {
          let selectedRarity = selectRarityByProbability();
          
          // If legendary items don't exist, fallback to epic
          if (selectedRarity === 3 && !itemsByRarity.has(3)) {
            selectedRarity = 2;
          }
          
          // Find items of selected rarity, fallback to any available rarity if not found
          let availableItems = itemsByRarity.get(selectedRarity);
          if (!availableItems || availableItems.length === 0) {
            // Fallback: try to find any available rarity
            for (const [rarity, items] of itemsByRarity.entries()) {
              if (items.length > 0) {
                availableItems = items;
                break;
              }
            }
          }
          
          if (!availableItems || availableItems.length === 0) {
            // No items available at all, skip this slot
            continue;
          }
          
          const randomIndex = Math.floor(Math.random() * availableItems.length);
          const item = availableItems[randomIndex];
          
          // Calculate price based on item type
          let price = 0;
          if (itemType === 'dish') {
            // For dishes, buy price = value × 2, then apply membership discount
            price = Math.floor((item.buyPrice || 100) * 2 * priceMultiplier);
          } else {
            price = Math.floor((item.buyPrice || (item.rarity + 1) * 50) * 2 * priceMultiplier);
          }
          
          // Dishes always have stock of 1
          const stock = 1;
          
          // No affix for dishes
          const affix = undefined;
          
          stallItems.push({ item, price: Math.max(price, 10), stock, affix });
        }
      } else {
        // For materials and equipment, allow duplicates - randomly pick with replacement based on rarity probability
        for (let i = 0; i < slotCount && filteredItems.length > 0; i++) {
          let selectedRarity = selectRarityByProbability();
          
          // If legendary items don't exist, fallback to epic
          if (selectedRarity === 3 && !itemsByRarity.has(3)) {
            selectedRarity = 2;
          }
          
          // Find items of selected rarity, fallback to any available rarity if not found
          let availableItems = itemsByRarity.get(selectedRarity);
          if (!availableItems || availableItems.length === 0) {
            // Fallback: try to find any available rarity
            for (const [rarity, items] of itemsByRarity.entries()) {
              if (items.length > 0) {
                availableItems = items;
                break;
              }
            }
          }
          
          if (!availableItems || availableItems.length === 0) {
            // No items available at all, skip this slot
            continue;
          }
          
          const randomIndex = Math.floor(Math.random() * availableItems.length);
          const item = availableItems[randomIndex];
        
          // Calculate price for materials and equipment: value × 2 × membership discount
          
          let price = Math.floor((item.buyPrice || (item.rarity + 1) * 50) * 2 * priceMultiplier);
          
          // Generate stock based on rarity and item type
          let stock = 1;
          if (itemType === 'equipment') {
            // Equipment always has stock of 1
            stock = 1;
          } else {
            // Materials: all materials have stock of 1
            stock = 1;
          }
          
          // Generate affix for equipment items (each slot gets independent affix)
          let affix = undefined;
          if (itemType === 'equipment' && this.affixSelector) {
            try {
              affix = this.affixSelector.selectAffixes(item.rarity);
            } catch (error) {
              console.warn(`Failed to generate affix for ${item.name}:`, error);
            }
          }
          
          stallItems.push({ item, price: Math.max(price, 10), stock, affix });
        }
      }

      // Bookseller Xiaochao: ensure at least 2 skill books per refresh
      if (npcData.id === 'bookseller_xiaochao') {
        const skillBookCount = stallItems.filter(s => s.item.subType === 'skill_book').length;
        if (skillBookCount < 2) {
          const allSkillBooks = filteredItems.filter(i => i.subType === 'skill_book');
          if (allSkillBooks.length > 0) {
            const needed = 2 - skillBookCount;
            for (let sb = 0; sb < needed && allSkillBooks.length > 0; sb++) {
              const randomIdx = Math.floor(Math.random() * allSkillBooks.length);
              const skillBook = allSkillBooks[randomIdx];
              const price = Math.floor((skillBook.buyPrice || (skillBook.rarity + 1) * 50) * 2 * priceMultiplier);
              // Replace a non-skill-book slot if possible, otherwise append
              const nonSkillBookIdx = stallItems.findIndex(s => s.item.subType !== 'skill_book');
              if (nonSkillBookIdx >= 0) {
                stallItems[nonSkillBookIdx] = { item: skillBook, price: Math.max(price, 10), stock: 1 };
              } else {
                stallItems.push({ item: skillBook, price: Math.max(price, 10), stock: 1 });
              }
            }
          }
        }
      }

      // Cache the inventory
      this.merchantInventories.set(npcData.id, stallItems);
    }

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'trade-stall-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); display: flex; align-items: center;
      justify-content: center; z-index: 10000;
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.hideEquipmentTooltip();
        overlay.remove();
      }
    });

    // Stall panel
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: linear-gradient(135deg, #fdf6e3 0%, #f5e6c8 100%);
      border: 3px solid #8b6914; border-radius: 16px; padding: 24px;
      width: 560px; max-height: 80vh; overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #d4a843;
    `;

    // NPC avatar + title
    const npcInfo = document.createElement('div');
    npcInfo.style.cssText = `display: flex; align-items: center; gap: 12px;`;
    npcInfo.innerHTML = `
      <img src="${npcData.emoji}" style="width:48px;height:48px;border-radius:50%;border:2px solid #8b6914;object-fit:cover;" onerror="this.textContent='🏪'">
      <div>
        <div style="font-size:18px;font-weight:bold;color:#5a3e1b;">${npcData.title} ${npcData.name}的摊位</div>
        <div style="font-size:12px;color:#8b6914;">${itemType === 'material' ? '📦 材料商品' : itemType === 'equipment' ? '⚔️ 装备商品' : itemType === 'book' ? '📚 书籍商品' : '🍽️ 菜肴商品'}</div>
      </div>
    `;

    // Gold display
    const goldDisplay = document.createElement('div');
    goldDisplay.id = 'stall-gold-display';
    const currentGold = this.getPlayerGold();
    goldDisplay.style.cssText = `font-size:16px;font-weight:bold;color:#d4a017;`;
    goldDisplay.textContent = `💰 ${currentGold}`;
    
    // Refresh button - "换一批" with remaining count (base 2 + membership bonus, 0 for bookseller)
    const refreshBtn = document.createElement('button');
    const baseRefreshCount = (npcData.id === 'bookseller_xiaochao' ? 0 : 2) + refreshBonus;
    const remainingRefreshes = this.merchantRefreshCounts.get(npcData.id) ?? baseRefreshCount;
    refreshBtn.textContent = `🔄 换一批 (${remainingRefreshes})`;
    refreshBtn.style.cssText = `
      background: ${remainingRefreshes > 0 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#ccc'};
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      color: white;
      font-size: 14px;
      font-weight: bold;
      cursor: ${remainingRefreshes > 0 ? 'pointer' : 'not-allowed'};
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    
    if (remainingRefreshes > 0) {
      refreshBtn.addEventListener('mouseenter', () => {
        refreshBtn.style.transform = 'translateY(-2px)';
        refreshBtn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
      });
      refreshBtn.addEventListener('mouseleave', () => {
        refreshBtn.style.transform = 'translateY(0)';
        refreshBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      });
      refreshBtn.addEventListener('click', () => {
        // Decrease refresh count
        const newCount = remainingRefreshes - 1;
        this.merchantRefreshCounts.set(npcData.id, newCount);
        
        // Clear cached inventory to force regeneration
        this.merchantInventories.delete(npcData.id);
        
        // Close current panel
        overlay.remove();
        
        // Reopen with new inventory
        this.showTradeStall(npcData, itemType);
        
        this.showNotification(`已刷新商品！剩余刷新次数：${newCount}`, 'success');
      });
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none; border: none; font-size: 20px; cursor: pointer;
      color: #8b6914; padding: 4px 8px; border-radius: 4px;
    `;
    closeBtn.addEventListener('click', () => { this.hideEquipmentTooltip(); overlay.remove(); });

    const rightSide = document.createElement('div');
    rightSide.style.cssText = `display:flex;align-items:center;gap:12px;`;
    rightSide.appendChild(refreshBtn);
    rightSide.appendChild(goldDisplay);
    rightSide.appendChild(closeBtn);

    header.appendChild(npcInfo);
    header.appendChild(rightSide);
    panel.appendChild(header);

    // Item grid
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
    `;

    const rarityColors = ['#888', '#3498db', '#9b59b6', '#e67e22'];
    const rarityNames = ['普通', '稀有', '史诗', '传说'];

    if (stallItems.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `grid-column: 1/-1; text-align:center; padding:40px; color:#8b6914;`;
      empty.innerHTML = `<div style="font-size:36px;margin-bottom:8px;">📦</div><div>暂无商品</div>`;
      grid.appendChild(empty);
    } else {
      stallItems.forEach(({ item, price, stock, affix }, index) => {
        const slot = document.createElement('div');
        const rColor = rarityColors[item.rarity] || '#888';
        const isSoldOut = stock <= 0;
        
        slot.style.cssText = `
          background: ${isSoldOut ? '#f5f5f5' : '#fff'}; 
          border: 2px solid ${isSoldOut ? '#ccc' : rColor}; 
          border-radius: 10px;
          padding: 10px; text-align: center; 
          cursor: ${isSoldOut ? 'not-allowed' : 'pointer'}; 
          transition: all 0.2s;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          opacity: ${isSoldOut ? '0.6' : '1'};
          height: 140px; box-sizing: border-box;
          justify-content: center;
        `;

        if (isSoldOut) {
          // Sold out display
          slot.innerHTML = `
            <div style="width:48px;height:48px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#e0e0e0;">❌</div>
            <div style="font-size:13px;font-weight:bold;color:#999;">卖光啦</div>
            <div style="font-size:10px;color:#ccc;">${item.name}</div>
          `;
        } else {
          // Normal display with stock
          let iconHtml = '';
          if (item.icon && (item.icon.includes('.png') || item.icon.includes('.jpg'))) {
            iconHtml = `<img src="${item.icon}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">`;
          } else {
            iconHtml = `<div style="width:48px;height:48px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#f0f0f0;">${item.icon || '📦'}</div>`;
          }

          slot.innerHTML = `
            ${iconHtml}
            <div style="font-size:11px;font-weight:bold;color:${rColor};overflow:hidden;text-overflow:ellipsis;max-width:100%;line-height:1.2;max-height:2.4em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-all;">${item.name}</div>
            <div style="font-size:10px;color:#999;">${rarityNames[item.rarity] || '普通'} · 库存:${stock}</div>
            <div style="font-size:12px;font-weight:bold;color:#d4a017;">💰 ${price}</div>
          `;

          // Add tooltip on hover
          slot.addEventListener('mouseenter', () => {
            slot.style.transform = 'translateY(-2px)';
            slot.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            // Show tooltip with item details
            this.showStallItemTooltip(slot, item, affix, price);
          });
          slot.addEventListener('mouseleave', () => {
            slot.style.transform = 'translateY(0)';
            slot.style.boxShadow = 'none';
            this.hideEquipmentTooltip();
          });

          slot.addEventListener('click', () => {
            this.hideEquipmentTooltip();
            this.handleStallPurchase(npcData.id, index, overlay);
          });
        }

        grid.appendChild(slot);
      });
    }

    panel.appendChild(grid);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  private getPlayerGold(): number {
    if (!this.playerEntity) return 0;
    const currency = this.currencySystem.getCurrency(this.world, this.playerEntity.id);
    return currency?.amounts?.gold ?? 0;
  }

  private handleStallPurchase(merchantId: string, itemIndex: number, overlay: HTMLElement): void {
    if (!this.playerEntity) {
      this.showNotification('玩家实体未初始化', 'error');
      return;
    }

    const inventory = this.merchantInventories.get(merchantId);
    if (!inventory || !inventory[itemIndex]) {
      this.showNotification('商品不存在', 'error');
      return;
    }

    const { item, price, stock, affix } = inventory[itemIndex];

    if (stock <= 0) {
      this.showNotification('该商品已售罄', 'warning');
      return;
    }

    const currentGold = this.getPlayerGold();
    if (currentGold < price) {
      this.showNotification(`金币不足，需要 ${price} 金币，当前 ${currentGold} 金币`, 'error');
      return;
    }

    // Spend gold
    const result = this.currencySystem.spendCurrency(
      this.world, this.playerEntity.id, { gold: price }, `购买 ${item.name}`
    );

    if (!result.success) {
      this.showNotification(`购买失败: ${result.error}`, 'error');
      return;
    }

    // Add item to inventory (with affix if it's equipment)
    this.itemSystem.addItem(item.id, 1, affix);

    // Decrease stock
    inventory[itemIndex].stock -= 1;

    // Update displays
    this.updateCurrencyDisplay();
    const goldDisplay = document.getElementById('stall-gold-display');
    if (goldDisplay) goldDisplay.textContent = `💰 ${this.getPlayerGold()}`;

    this.showNotification(`成功购买 ${item.name}`, 'success');

    // Emit quest event for shop purchase
    this.eventSystem.emit({ type: 'quest:shop_purchase', merchantId, itemId: item.id, timestamp: Date.now() });

    // Re-render the stall to show updated stock
    const npc = this.npcSystem.getNPC(merchantId);
    if (npc) {
      let itemType: 'material' | 'equipment' | 'dish' | 'book' = 'material';
      if (merchantId === 'merchant_xiaoheiyang') {
        itemType = 'material';
      } else if (merchantId === 'merchant_youliang') {
        itemType = 'equipment';
      } else if (merchantId === 'chef_curry') {
        itemType = 'dish';
      } else if (merchantId === 'bookseller_xiaochao') {
        itemType = 'book';
      }
      this.showTradeStall(npc, itemType);
    }
  }

  private loadTavernScene(): void {
    if (!this.sceneContainer) {
      console.log('[DEBUG] loadTavernScene: sceneContainer is null!');
      return;
    }

    console.log('[DEBUG] loadTavernScene: Creating NPC container');

    // Clear existing scene content to prevent duplicate NPCs
    this.clearSceneContainer();
    
    // Restore background image (cleared by innerHTML reset)
    this.sceneContainer.style.backgroundImage = `url('images/changjing_jiuguan.png')`;
    this.sceneContainer.style.backgroundSize = 'cover';
    this.sceneContainer.style.backgroundPosition = 'center';
    this.sceneContainer.style.backgroundRepeat = 'no-repeat';

    // Create NPC container with absolute positioning for custom placement
    const npcContainer = document.createElement('div');
    npcContainer.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 100%;
    `;

    // Get tavern NPCs (bartender and maid)
    const bartender = this.npcSystem.getNPC('bartender');
    const maid = this.npcSystem.getNPC('maid');

    if (bartender) {
      console.log('[DEBUG] loadTavernScene: Creating card for bartender');
      const bartenderCard = new NPCCard(bartender, (clickedNpcData) => {
        this.showNPCDetails(clickedNpcData);
      });
      this.npcCardInstances.set('bartender', bartenderCard); // Store in map
      const bartenderWrapper = document.createElement('div');
      bartenderWrapper.style.cssText = `
        position: absolute;
        top: 200px;
        left: 50%;
        transform: translateX(-60px);
      `;
      bartenderWrapper.appendChild(bartenderCard.getElement());
      npcContainer.appendChild(bartenderWrapper);
    }

    if (maid) {
      console.log('[DEBUG] loadTavernScene: Creating card for maid');
      const maidCard = new NPCCard(maid, (clickedNpcData) => {
        this.showNPCDetails(clickedNpcData);
      });
      this.npcCardInstances.set('maid', maidCard); // Store in map
      const maidWrapper = document.createElement('div');
      maidWrapper.style.cssText = `
        position: absolute;
        top: 250px;
        left: 150px;
      `;
      maidWrapper.appendChild(maidCard.getElement());
      npcContainer.appendChild(maidWrapper);
    }

    // Define adventurer spawn points
    const spawnPoints = [
      { top: 480, left: 180 },   // Left bottom area
      { top: 640, left: 180 },   // Left bottom area (lower)
      { top: 510, left: 350 },   // Center left table
      { top: 400, right: 380 },  // Right upper area
      { top: 530, right: 280 },  // Right middle table
      { top: 680, right: 280 }   // Right bottom table
    ];

    // Get all adventurers from NPCSystem
    const adventurers = this.npcSystem.getNPCsByType('Adventurer');
    console.log('[DEBUG] loadTavernScene: Found', adventurers.length, 'adventurers in system');
    
    // Only create adventurers on first visit (when none exist at all)
    // After recruitment, empty spawn points stay empty until daily refresh
    if (adventurers.length === 0) {
      console.log('[DEBUG] loadTavernScene: First visit - creating initial adventurers');
      
      for (let i = 0; i < spawnPoints.length; i++) {
        const adventurer = this.npcSystem.createAdventurer();
        (adventurer as any).spawnPointIndex = i;
        console.log('[DEBUG] loadTavernScene: Created adventurer:', adventurer.title, adventurer.name, 'at spawn point', i);
      }
      
      // Reload to display the newly created adventurers
      this.loadTavernScene();
      return;
    }

    // Display existing adventurers at their assigned spawn points
    adventurers.forEach((adventurer) => {
      // Get the spawn point index for this adventurer
      const spawnIndex = (adventurer as any).spawnPointIndex;
      if (spawnIndex === undefined || spawnIndex >= spawnPoints.length) return; // Skip if no spawn point assigned
      
      const pos = spawnPoints[spawnIndex];
      if (!pos) return; // Safety check
      
      let positionStyle = `top: ${pos.top}px;`;
      if ('left' in pos) {
        positionStyle += ` left: ${pos.left}px;`;
      } else if ('right' in pos) {
        positionStyle += ` right: ${pos.right}px;`;
      }
      
      // Create transparent spawn point marker
      const spawnPoint = document.createElement('div');
      spawnPoint.className = 'adventurer-spawn-point';
      spawnPoint.title = '冒险者刷新点';
      spawnPoint.style.cssText = `
        position: absolute;
        ${positionStyle}
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: transparent;
        pointer-events: none;
      `;
      npcContainer.appendChild(spawnPoint);
      
      // Display the adventurer
      const adventurerCard = new NPCCard(adventurer, (clickedNpcData) => {
        this.showNPCDetails(clickedNpcData);
      });
      this.npcCardInstances.set(adventurer.id, adventurerCard); // Store in map for emoji feedback
      const adventurerWrapper = document.createElement('div');
      adventurerWrapper.style.cssText = `
        position: absolute;
        ${positionStyle}
        transform: translate(-7.5px, -7.5px);
      `;
      adventurerWrapper.appendChild(adventurerCard.getElement());
      npcContainer.appendChild(adventurerWrapper);
    });

    this.sceneContainer.appendChild(npcContainer);
    console.log('[DEBUG] loadTavernScene: NPC container and adventurers added to scene');
  }

  private showNPCDetails(npcData: any): void {
    const actionPanel = document.getElementById('action-panel');
    if (!actionPanel) return;

    // Track currently displayed character for dev functions
    this.currentDisplayedCharacterId = npcData.id;

    const displayName = npcData.title ? `${npcData.title}${npcData.name}` : npcData.name;
    
    // Check if emoji is an image path
    const isImage = npcData.emoji.includes('.png') || npcData.emoji.includes('.jpg');
    const avatarContent = isImage 
      ? `<img src="${npcData.emoji}" style="width: 100%; height: 100%; object-fit: cover;" />`
      : npcData.emoji;

    // Check if this character is already recruited
    const isRecruited = this.npcSystem.getRecruitedCharacter(npcData.id) !== undefined;

    // Check if this is an adventurer to show full details
    if (npcData.type === 'Adventurer') {
      // Calculate equipment bonuses for primary attributes
      const primaryBonuses = this.calculatePrimaryAttributeBonuses(npcData);
      const strBonus = primaryBonuses.strength > 0 ? `<div style="font-size: 12px; color: #90ff90; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">(+${primaryBonuses.strength})</div>` : '';
      const agiBonus = primaryBonuses.agility > 0 ? `<div style="font-size: 12px; color: #90ff90; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">(+${primaryBonuses.agility})</div>` : '';
      const wisBonus = primaryBonuses.wisdom > 0 ? `<div style="font-size: 12px; color: #90ff90; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">(+${primaryBonuses.wisdom})</div>` : '';
      const sklBonus = primaryBonuses.skill > 0 ? `<div style="font-size: 12px; color: #90ff90; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">(+${primaryBonuses.skill})</div>` : '';

      actionPanel.innerHTML = `
        <!-- Main Layout: Left (Name + Avatar + Bars) | Right (Attributes) -->
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <!-- Left Column: Name, Avatar and Progress Bars (50% width) -->
          <div style="flex: 1; width: 50%;">
            <!-- Character Name and Info -->
            <div style="margin-bottom: 8px; text-align: center;">
              <h2 style="margin: 0; color: #333; font-size: 18px; font-weight: bold;">${displayName}</h2>
              <div style="font-size: 11px; color: #666; margin-top: 2px;">等级: ${npcData.level} | 职业: ${this.getJobDisplayName(npcData.job)}</div>
            </div>
            
            <!-- Avatar -->
            <div style="width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 60px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); overflow: hidden; margin-bottom: 12px; margin-left: auto; margin-right: auto;">
              ${avatarContent}
            </div>
            
            <!-- Progress Bars -->
            <div>
              <div style="margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; color: #333;">
                  <span>❤️ 生命值</span>
                  <span>${Math.floor(npcData.currentHP || npcData.maxHP)}/${Math.floor(npcData.maxHP)}</span>
                </div>
                <div style="background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden;">
                  <div style="background: linear-gradient(90deg, #28a745, #5cb85c); height: 100%; width: ${((npcData.currentHP || npcData.maxHP) / npcData.maxHP * 100)}%;"></div>
                </div>
              </div>
              <div style="margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; color: #333;">
                  <span>💙 魔法值</span>
                  <span>${Math.floor(npcData.currentMP || 0)}/${Math.floor(npcData.maxMP)}</span>
                </div>
                <div style="background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden;">
                  <div style="background: linear-gradient(90deg, #4dabf7, #74c0fc); height: 100%; width: ${((npcData.currentMP || 0) / npcData.maxMP * 100)}%;"></div>
                </div>
              </div>
              <div style="margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; color: #333;">
                  <span>⭐ 经验值</span>
                  <span>${Math.floor(npcData.currentEXP || 0)}/${Math.floor(npcData.maxEXP)}</span>
                </div>
                <div style="background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden;">
                  <div style="background: linear-gradient(90deg, #ffd43b, #ffe066); height: 100%; width: ${((npcData.currentEXP || 0) / npcData.maxEXP * 100)}%;"></div>
                </div>
              </div>
              <div style="margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; color: #333;">
                  <span>🍚 饱腹度</span>
                  <span>${Math.floor(npcData.currentHunger || 0)}/${Math.floor(npcData.maxHunger || 100)}</span>
                </div>
                <div style="background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden;">
                  <div style="background: linear-gradient(90deg, #f39c12, #f5b041); height: 100%; width: ${((npcData.currentHunger || 0) / (npcData.maxHunger || 100) * 100)}%;"></div>
                </div>
              </div>
              <div style="margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; color: #333;">
                  <span>💖 好感度</span>
                  <span>${npcData.affinity}/100</span>
                </div>
                <div data-affinity-bar style="background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden; position: relative;">
                  <div style="background: linear-gradient(90deg, #ff6b9d, #ff8fb3); height: 100%; width: ${npcData.affinity}%;"></div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Right Column: Main and Secondary Attributes (50% width) -->
          <div style="flex: 1; width: 50%; margin-top: 45px;">
            <!-- Main Attributes -->
            <div style="margin-bottom: 12px;">
              <h4 style="margin: 0 0 8px 0; color: #333; font-size: 12px; font-weight: bold;">主属性</h4>
              <div style="display: flex; gap: 4px;">
                <div data-attribute="strength" style="background: #dc3545; border-radius: 6px; padding: 10px 8px; text-align: center; color: white; width: 20%; flex-shrink: 0; cursor: pointer; position: relative;">
                  <div style="font-size: 20px; margin-bottom: 2px;">${ATTRIBUTE_ICONS.STRENGTH}</div>
                  <div style="font-size: 15px; font-weight: bold; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">${npcData.strength}</div>
                  ${strBonus}
                </div>
                <div data-attribute="agility" style="background: #28a745; border-radius: 6px; padding: 10px 8px; text-align: center; color: white; width: 20%; flex-shrink: 0; cursor: pointer; position: relative;">
                  <div style="font-size: 20px; margin-bottom: 2px;">${ATTRIBUTE_ICONS.AGILITY}</div>
                  <div style="font-size: 15px; font-weight: bold; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">${npcData.agility}</div>
                  ${agiBonus}
                </div>
                <div data-attribute="wisdom" style="background: #007bff; border-radius: 6px; padding: 10px 8px; text-align: center; color: white; width: 20%; flex-shrink: 0; cursor: pointer; position: relative;">
                  <div style="font-size: 20px; margin-bottom: 2px;">${ATTRIBUTE_ICONS.WISDOM}</div>
                  <div style="font-size: 15px; font-weight: bold; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">${npcData.wisdom}</div>
                  ${wisBonus}
                </div>
                <div data-attribute="technique" style="background: #ffc107; border-radius: 6px; padding: 10px 8px; text-align: center; color: white; width: 20%; flex-shrink: 0; cursor: pointer; position: relative;">
                  <div style="font-size: 20px; margin-bottom: 2px;">${ATTRIBUTE_ICONS.SKILL}</div>
                  <div style="font-size: 15px; font-weight: bold; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">${npcData.skill}</div>
                  ${sklBonus}
                </div>
              </div>
            </div>
            
            <!-- Secondary Attributes -->
            <div>
              <h4 style="margin: 0 0 8px 0; color: #333; font-size: 12px; font-weight: bold;">副属性</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3px; font-size: 9px;">
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">⚔️ 攻击力: ${formatNumber(npcData.attack)}</div>
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">🛡️ 防御力: ${formatNumber(npcData.defense)}</div>
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">🏃 移动速度: ${formatNumber(npcData.moveSpeed)}</div>
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">💨 闪避率: ${formatNumber(npcData.dodgeRate)}%</div>
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">💥 暴击率: ${formatNumber(npcData.critRate)}%</div>
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">💢 暴伤: ${formatNumber(npcData.critDamage)}%</div>
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">🔮 抗性: ${formatNumber(npcData.resistance)}</div>
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">✨ 魔法强度: ${formatNumber(npcData.magicPower)}</div>
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">🎒 负重: ${formatNumber(npcData.carryWeight)}</div>
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">📦 体积: ${formatNumber(npcData.volume)}</div>
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">⭐ 经验率: ${formatNumber(npcData.expRate)}%</div>
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">🩹 回血: ${formatNumber(npcData.hpRegen)}</div>
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">💙 回魔: ${formatNumber(npcData.mpRegen)}</div>
                <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">⚖️ 体重: ${formatNumber(npcData.weight)}kg</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <button id="talk-btn-${npcData.id}" style="flex: 1; padding: 10px; background: #17a2b8; border: none; border-radius: 6px; color: white; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.2s; ${(npcData.dailyDialogueCount || 0) <= 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${(npcData.dailyDialogueCount || 0) <= 0 ? 'disabled' : ''}>
            💬 对话 (${npcData.dailyDialogueCount || 3}/${npcData.maxDailyDialogues || 3})
          </button>
          <button id="gift-btn-${npcData.id}" style="flex: 1; padding: 10px; background: #ff6b9d; border: none; border-radius: 6px; color: white; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.2s; ${(npcData.dailyGiftCount || 0) <= 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${(npcData.dailyGiftCount || 0) <= 0 ? 'disabled' : ''}>
            🎁 送礼 (${npcData.dailyGiftCount ?? 1}/${npcData.maxDailyGifts ?? 1})
          </button>
          <button id="recruit-btn-${npcData.id}" style="flex: 1; padding: 10px; background: #667eea; border: none; border-radius: 6px; color: white; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.2s; display: ${isRecruited ? 'none' : 'block'};">
            💰 招募 (100金币)
          </button>
        </div>

        <!-- Skill Slots -->
        <div style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 8px 0; color: #333; font-size: 12px; font-weight: bold;">技能槽位</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div id="passive-skill-slot-${npcData.id}" class="skill-slot" data-skill-id="${npcData.passiveSkill || ''}" style="padding: 12px; background: ${npcData.passiveSkill ? '#e3f2fd' : '#f0f0f0'}; border: 2px ${npcData.passiveSkill ? 'solid' : 'dashed'} ${npcData.passiveSkill ? '#2196f3' : '#ccc'}; border-radius: 8px; cursor: ${npcData.passiveSkill ? 'pointer' : 'default'}; transition: all 0.2s; position: relative; height: 74px; box-sizing: border-box; overflow: hidden;">
              <div style="display: flex; align-items: center; gap: 12px; height: 100%;">
                <div style="flex-shrink: 0;">
                  ${npcData.passiveSkill ? `<img src="${this.npcSystem.getPassiveSkill(npcData.passiveSkill)?.icon || ''}" style="width: 50px; height: 50px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onerror="this.style.display='none'">` : '<div style="width: 50px; height: 50px; background: #ddd; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🔵</div>'}
                </div>
                <div style="flex: 1; text-align: left; min-width: 0; overflow: hidden;">
                  <div style="font-size: 11px; color: #999; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">被动技能</div>
                  <div style="font-size: 13px; font-weight: bold; color: ${npcData.passiveSkill ? '#333' : '#999'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${npcData.passiveSkill ? this.npcSystem.getPassiveSkill(npcData.passiveSkill)?.name || '空' : '空'}</div>
                </div>
              </div>
            </div>
            <!-- Active Skill Slot -->
            <div id="active-skill-slot-${npcData.id}" class="skill-slot" data-skill-id="${npcData.activeSkill || ''}" style="padding: 12px; background: ${npcData.activeSkill ? '#ffebee' : '#f0f0f0'}; border: 2px ${npcData.activeSkill ? 'solid' : 'dashed'} ${npcData.activeSkill ? '#f44336' : '#ccc'}; border-radius: 8px; cursor: ${npcData.activeSkill ? 'pointer' : 'default'}; transition: all 0.2s; position: relative; height: 74px; box-sizing: border-box; overflow: hidden;">
              <div style="display: flex; align-items: center; gap: 12px; height: 100%;">
                <div style="flex-shrink: 0;">
                  ${npcData.activeSkill ? `<img src="${this.npcSystem.getActiveSkill(npcData.activeSkill)?.icon || ''}" style="width: 50px; height: 50px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onerror="this.style.display='none'">` : '<div style="width: 50px; height: 50px; background: #ddd; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🔴</div>'}
                </div>
                <div style="flex: 1; text-align: left; min-width: 0; overflow: hidden;">
                  <div style="font-size: 11px; color: #999; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">主动技能</div>
                  <div style="font-size: 13px; font-weight: bold; color: ${npcData.activeSkill ? '#333' : '#999'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${npcData.activeSkill ? this.npcSystem.getActiveSkill(npcData.activeSkill)?.name || '空' : '空'}</div>
                </div>
              </div>
            </div>
            <div id="master-skill-slot-${npcData.id}" class="skill-slot" data-skill-id="${npcData.masterSkill || ''}" style="padding: 12px; background: ${npcData.masterSkill ? '#fff3e0' : '#f0f0f0'}; border: 2px ${npcData.masterSkill ? 'solid' : 'dashed'} ${npcData.masterSkill ? '#ff9800' : '#ccc'}; border-radius: 8px; cursor: ${npcData.masterSkill ? 'pointer' : 'default'}; transition: all 0.2s; position: relative; height: 74px; box-sizing: border-box; overflow: hidden;">
              <div style="display: flex; align-items: center; gap: 12px; height: 100%;">
                <div style="flex-shrink: 0;">
                  ${npcData.masterSkill ? `<img src="${this.npcSystem.getJobExclusiveSkill(npcData.masterSkill)?.icon || ''}" style="width: 50px; height: 50px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onerror="this.style.display='none'">` : '<div style="width: 50px; height: 50px; background: #ddd; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🟡</div>'}
                </div>
                <div style="flex: 1; text-align: left; min-width: 0; overflow: hidden;">
                  <div style="font-size: 11px; color: #999; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">大师技能</div>
                  <div style="font-size: 13px; font-weight: bold; color: ${npcData.masterSkill ? '#333' : '#999'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${npcData.masterSkill ? this.npcSystem.getJobExclusiveSkill(npcData.masterSkill)?.name || '空' : '空'}</div>
                </div>
              </div>
            </div>
            <div class="skill-slot" style="padding: 12px; background: #f0f0f0; border: 2px dashed #ccc; border-radius: 8px; cursor: default; height: 74px; box-sizing: border-box; overflow: hidden;">
              <div style="display: flex; align-items: center; gap: 12px; height: 100%;">
                <div style="flex-shrink: 0;">
                  <div style="width: 50px; height: 50px; background: #ddd; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🟣</div>
                </div>
                <div style="flex: 1; text-align: left; min-width: 0; overflow: hidden;">
                  <div style="font-size: 11px; color: #999; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">徽章技能</div>
                  <div style="font-size: 13px; font-weight: bold; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">空</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Equipment Slots -->
        <div style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 8px 0; color: #333; font-size: 12px; font-weight: bold;">装备槽位</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            ${this.renderEquipSlotHtml(npcData, 'weapon', '⚔️ 武器')}
            ${this.renderEquipSlotHtml(npcData, 'offhand', '🛡️ 副手')}
            ${this.renderEquipSlotHtml(npcData, 'armor', '🦺 护甲')}
            ${this.renderEquipSlotHtml(npcData, 'accessory', '💍 杂项')}
          </div>
        </div>

        <!-- Dismiss Button -->
        <div style="margin-top: 8px; text-align: center;">
          <button id="dismiss-btn-${npcData.id}" style="padding: 8px 24px; background: #dc3545; border: none; border-radius: 6px; color: white; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.2s; opacity: 0.8;">
            🚪 解雇
          </button>
        </div>
      `;
    } else {
      // Simple view for NPCs
      actionPanel.innerHTML = `
        <h3 style="margin: 0 0 24px 0; color: #333; font-size: 18px;">角色详情</h3>
        
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: inline-flex; align-items: center; justify-content: center; font-size: 50px; border: 3px solid white; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.2); margin-bottom: 16px; overflow: hidden;">
            ${avatarContent}
          </div>
          <h2 style="margin: 0 0 16px 0; color: #333; font-size: 24px;">${displayName}</h2>
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; display: inline-block; margin-bottom: 16px; min-width: 200px;">
            <div style="font-size: 14px; color: #999; margin-bottom: 8px; display: flex; justify-content: space-between;">
              <span>好感度</span>
              <span style="font-weight: bold; color: #667eea;">💖 ${npcData.affinity}/100</span>
            </div>
            <div style="background: #e0e0e0; height: 12px; border-radius: 6px; overflow: hidden;">
              <div style="background: linear-gradient(90deg, #ff6b9d, #ff8fb3); height: 100%; width: ${Math.max(0, Math.min(100, npcData.affinity))}%; transition: width 0.3s ease;"></div>
            </div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div style="display: flex; gap: 8px;">
          <button id="talk-btn-${npcData.id}" style="flex: 1; padding: 12px; background: #17a2b8; border: none; border-radius: 6px; color: white; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; ${(npcData.dailyDialogueCount || 0) <= 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${(npcData.dailyDialogueCount || 0) <= 0 ? 'disabled' : ''}>
            💬 对话 (${npcData.dailyDialogueCount || 3}/${npcData.maxDailyDialogues || 3})
          </button>
          <button id="gift-btn-${npcData.id}" style="flex: 1; padding: 12px; background: #ff6b9d; border: none; border-radius: 6px; color: white; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; ${(npcData.dailyGiftCount || 0) <= 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${(npcData.dailyGiftCount || 0) <= 0 ? 'disabled' : ''}>
            🎁 送礼 (${npcData.dailyGiftCount ?? 1}/${npcData.maxDailyGifts ?? 1})
          </button>
          ${npcData.id === 'blacksmith_zz' && !this.lockedButtons.has('craft') ? `
          <button id="craft-btn-${npcData.id}" style="flex: 1; padding: 12px; background: #6c757d; border: none; border-radius: 6px; color: white; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
            🔨 制作
          </button>
          ` : ''}
          ${npcData.id === 'alchemist_tuanzi' && !this.lockedButtons.has('alchemy') ? `
          <button id="alchemy-btn-${npcData.id}" style="flex: 1; padding: 12px; background: #9b59b6; border: none; border-radius: 6px; color: white; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
            🧪 制作
          </button>
          ` : ''}
          ${npcData.id === 'summoner_kaoezi' && !this.lockedButtons.has('summon') ? `
          <button id="summon-btn-${npcData.id}" style="flex: 1; padding: 12px; background: #8e44ad; border: none; border-radius: 6px; color: white; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
            🔮 异界召唤
          </button>
          ` : ''}
          ${npcData.id === 'scholar_xiaomei' && !this.lockedButtons.has('card-collection') ? `
          <button id="card-exchange-btn-${npcData.id}" style="flex: 1; padding: 12px; background: #e91e63; border: none; border-radius: 6px; color: white; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
            🎴 兑换卡牌
          </button>
          ` : ''}
          ${npcData.id === 'trainer_alin' && !this.lockedButtons.has('jobchange') ? `
          <button id="jobchange-btn-${npcData.id}" style="flex: 1; padding: 12px; background: #e67e22; border: none; border-radius: 6px; color: white; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
            ⚔️ 转职
          </button>
          ` : ''}
          ${(npcData.id === 'village_chief' || npcData.id === 'bartender' || npcData.id === 'maid' || npcData.id === 'blacksmith_zz' || npcData.id === 'chef_curry' || npcData.id === 'alchemist_tuanzi' || npcData.id === 'scholar_xiaomei' || npcData.id === 'trainer_alin' || npcData.id === 'summoner_kaoezi' || npcData.id === 'merchant_xiaoheiyang' || npcData.id === 'merchant_youliang') ? `
          <button id="quest-btn-${npcData.id}" style="flex: 1; padding: 12px; background: #ffc107; border: none; border-radius: 6px; color: white; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; position: relative;">
            📜 任务
            <span id="quest-red-dot-${npcData.id}" style="position: absolute; top: 8px; right: 8px; width: 10px; height: 10px; background: #dc3545; border-radius: 50%; border: 2px solid white; animation: pulse 1.5s infinite; display: ${this.hasCompletableQuestsForNpc(npcData.id) ? 'block' : 'none'};"></span>
          </button>
          ` : ''}
          ${(npcData.id === 'merchant_xiaoheiyang' || npcData.id === 'merchant_youliang' || npcData.id === 'chef_curry' || npcData.id === 'bookseller_xiaochao') ? `
          <button id="trade-btn-${npcData.id}" style="flex: 1; padding: 12px; background: #28a745; border: none; border-radius: 6px; color: white; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
            💰 交易
          </button>
          ` : ''}
        </div>
      `;
    }
    
    // Add event listeners for buttons
    const talkBtn = document.getElementById(`talk-btn-${npcData.id}`);
    if (talkBtn) {
      talkBtn.addEventListener('click', () => {
        this.handleTalkClick(npcData);
      });
      talkBtn.addEventListener('mouseenter', () => {
        (talkBtn as HTMLElement).style.background = '#138496';
      });
      talkBtn.addEventListener('mouseleave', () => {
        (talkBtn as HTMLElement).style.background = '#17a2b8';
      });
    }

    // Gift button (for all NPCs)
    const giftBtn = document.getElementById(`gift-btn-${npcData.id}`);
    if (giftBtn) {
      giftBtn.addEventListener('click', () => {
        this.handleGiftClick(npcData);
      });
      giftBtn.addEventListener('mouseenter', () => {
        (giftBtn as HTMLElement).style.background = '#ff4d7d';
      });
      giftBtn.addEventListener('mouseleave', () => {
        (giftBtn as HTMLElement).style.background = '#ff6b9d';
      });
    }

    // Craft button for blacksmith ZZ
    if (npcData.id === 'blacksmith_zz') {
      const craftBtn = document.getElementById(`craft-btn-${npcData.id}`);
      if (craftBtn) {
        craftBtn.addEventListener('click', () => {
          this.showEquipmentCraftingPanel();
        });
        craftBtn.addEventListener('mouseenter', () => {
          (craftBtn as HTMLElement).style.background = '#5a6268';
        });
        craftBtn.addEventListener('mouseleave', () => {
          (craftBtn as HTMLElement).style.background = '#6c757d';
        });
      }
    }

    // Alchemy button for alchemist Tuanzi
    if (npcData.id === 'alchemist_tuanzi') {
      const alchemyBtn = document.getElementById(`alchemy-btn-${npcData.id}`);
      if (alchemyBtn) {
        alchemyBtn.addEventListener('click', () => {
          this.showAlchemyCraftingPanel();
        });
        alchemyBtn.addEventListener('mouseenter', () => {
          (alchemyBtn as HTMLElement).style.background = '#8e44ad';
        });
        alchemyBtn.addEventListener('mouseleave', () => {
          (alchemyBtn as HTMLElement).style.background = '#9b59b6';
        });
      }
    }

    // Summoning button for summoner Kaoezi
    if (npcData.id === 'summoner_kaoezi') {
      const summonBtn = document.getElementById(`summon-btn-${npcData.id}`);
      if (summonBtn) {
        summonBtn.addEventListener('click', () => {
          this.showSummoningPanel();
        });
        summonBtn.addEventListener('mouseenter', () => {
          (summonBtn as HTMLElement).style.background = '#7d3c98';
        });
        summonBtn.addEventListener('mouseleave', () => {
          (summonBtn as HTMLElement).style.background = '#8e44ad';
        });
      }
    }

    // Card exchange button for scholar Xiaomei
    if (npcData.id === 'scholar_xiaomei') {
      const cardExchangeBtn = document.getElementById(`card-exchange-btn-${npcData.id}`);
      if (cardExchangeBtn) {
        cardExchangeBtn.addEventListener('click', () => {
          this.showCardExchangePanel();
        });
        cardExchangeBtn.addEventListener('mouseenter', () => {
          (cardExchangeBtn as HTMLElement).style.background = '#c2185b';
        });
        cardExchangeBtn.addEventListener('mouseleave', () => {
          (cardExchangeBtn as HTMLElement).style.background = '#e91e63';
        });
      }
    }

    // Job change button for trainer Alin
    if (npcData.id === 'trainer_alin') {
      const jobchangeBtn = document.getElementById(`jobchange-btn-${npcData.id}`);
      if (jobchangeBtn) {
        jobchangeBtn.addEventListener('click', () => {
          this.showJobChangePanel();
        });
        jobchangeBtn.addEventListener('mouseenter', () => {
          (jobchangeBtn as HTMLElement).style.background = '#d35400';
        });
        jobchangeBtn.addEventListener('mouseleave', () => {
          (jobchangeBtn as HTMLElement).style.background = '#e67e22';
        });
      }
    }

    // Quest button for all NPCs - unified handler
    if (npcData.id === 'village_chief' || npcData.id === 'bartender' || npcData.id === 'maid' || npcData.id === 'blacksmith_zz' || npcData.id === 'chef_curry' || npcData.id === 'alchemist_tuanzi' || npcData.id === 'scholar_xiaomei' || npcData.id === 'trainer_alin' || npcData.id === 'summoner_kaoezi' || npcData.id === 'merchant_xiaoheiyang' || npcData.id === 'merchant_youliang') {
      const questBtn = document.getElementById(`quest-btn-${npcData.id}`);
      if (questBtn) {
        questBtn.addEventListener('click', () => {
          this.showQuestPanel(npcData.id);
        });
        questBtn.addEventListener('mouseenter', () => {
          (questBtn as HTMLElement).style.background = '#e0a800';
        });
        questBtn.addEventListener('mouseleave', () => {
          (questBtn as HTMLElement).style.background = '#ffc107';
        });
      }
    }

    // Trade button for market merchants and chef curry
    if (npcData.id === 'merchant_xiaoheiyang' || npcData.id === 'merchant_youliang' || npcData.id === 'chef_curry' || npcData.id === 'bookseller_xiaochao') {
      const tradeBtn = document.getElementById(`trade-btn-${npcData.id}`);
      if (tradeBtn) {
        tradeBtn.addEventListener('click', () => {
          let itemType: 'material' | 'equipment' | 'dish' | 'book' = 'material';
          if (npcData.id === 'merchant_xiaoheiyang') {
            itemType = 'material';
          } else if (npcData.id === 'merchant_youliang') {
            itemType = 'equipment';
          } else if (npcData.id === 'chef_curry') {
            itemType = 'dish';
          } else if (npcData.id === 'bookseller_xiaochao') {
            itemType = 'book';
          }
          this.showTradeStall(npcData, itemType);
        });
        tradeBtn.addEventListener('mouseenter', () => {
          (tradeBtn as HTMLElement).style.background = '#218838';
        });
        tradeBtn.addEventListener('mouseleave', () => {
          (tradeBtn as HTMLElement).style.background = '#28a745';
        });
      }
    }
    
    // Add event listeners for adventurer buttons
    if (npcData.type === 'Adventurer') {
      // Check if character is recruited
      const isRecruited = this.npcSystem.getRecruitedCharacter(npcData.id) !== undefined;
      
      // Add skill slot hover tooltip
      const passiveSkillSlot = document.getElementById(`passive-skill-slot-${npcData.id}`);
      if (passiveSkillSlot) {
        if (npcData.passiveSkill) {
          passiveSkillSlot.addEventListener('mouseenter', (e) => {
            this.showSkillTooltip(e.currentTarget as HTMLElement, npcData.passiveSkill!);
          });
          passiveSkillSlot.addEventListener('mouseleave', () => {
            this.hideSkillTooltip();
          });
        }
        
        // Set cursor style based on recruitment status
        if (!isRecruited) {
          passiveSkillSlot.style.cursor = 'not-allowed';
          passiveSkillSlot.addEventListener('click', () => {
            this.showNotification('请先招募该角色才能管理技能', 'warning');
          });
        }
      }
      
      // Add active skill slot hover tooltip
      const activeSkillSlot = document.getElementById(`active-skill-slot-${npcData.id}`);
      if (activeSkillSlot) {
        if (npcData.activeSkill) {
          activeSkillSlot.addEventListener('mouseenter', (e) => {
            this.showActiveSkillTooltip(e.currentTarget as HTMLElement, npcData.activeSkill!);
          });
          activeSkillSlot.addEventListener('mouseleave', () => {
            this.hideSkillTooltip();
          });
        }
        
        if (isRecruited) {
          // Add click event to open skill management window only for recruited characters
          activeSkillSlot.addEventListener('click', () => {
            this.showSkillManagementWindow(npcData);
          });
          activeSkillSlot.style.cursor = 'pointer';
        } else {
          // For non-recruited characters, show a message when clicked
          activeSkillSlot.addEventListener('click', () => {
            this.showNotification('请先招募该角色才能管理技能', 'warning');
          });
          activeSkillSlot.style.cursor = 'not-allowed';
        }
      }
      
      // Add master skill slot hover tooltip and click handler
      const masterSkillSlot = document.getElementById(`master-skill-slot-${npcData.id}`);
      if (masterSkillSlot) {
        if (npcData.masterSkill) {
          masterSkillSlot.addEventListener('mouseenter', (e) => {
            this.showJobExclusiveSkillTooltip(e.currentTarget as HTMLElement, npcData.masterSkill!);
          });
          masterSkillSlot.addEventListener('mouseleave', () => {
            this.hideSkillTooltip();
          });
        }
        
        if (isRecruited) {
          // Add click event to open master skill management window only for recruited characters
          masterSkillSlot.addEventListener('click', () => {
            this.showMasterSkillManagementWindow(npcData);
          });
          masterSkillSlot.style.cursor = 'pointer';
        } else {
          // For non-recruited characters, show a message when clicked
          masterSkillSlot.addEventListener('click', () => {
            this.showNotification('请先招募该角色才能管理技能', 'warning');
          });
          masterSkillSlot.style.cursor = 'not-allowed';
        }
      }
      
      // Recruit button
      const recruitBtn = document.getElementById(`recruit-btn-${npcData.id}`);
      if (recruitBtn) {
        recruitBtn.addEventListener('click', () => {
          this.handleRecruitClick(npcData);
        });
        recruitBtn.addEventListener('mouseenter', () => {
          (recruitBtn as HTMLElement).style.background = '#5568d3';
        });
        recruitBtn.addEventListener('mouseleave', () => {
          (recruitBtn as HTMLElement).style.background = '#667eea';
        });
      }

      // Dismiss button
      const dismissBtn = document.getElementById(`dismiss-btn-${npcData.id}`);
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
          this.showDismissConfirmDialog(npcData);
        });
        dismissBtn.addEventListener('mouseenter', () => {
          (dismissBtn as HTMLElement).style.opacity = '1';
          (dismissBtn as HTMLElement).style.background = '#c82333';
        });
        dismissBtn.addEventListener('mouseleave', () => {
          (dismissBtn as HTMLElement).style.opacity = '0.8';
          (dismissBtn as HTMLElement).style.background = '#dc3545';
        });
      }

      // Add hover tooltips for main attributes
      this.addAttributeTooltips(actionPanel);

      // Add equipment slot click handlers
      const equipmentSlots = ['weapon', 'offhand', 'armor', 'accessory'];
      equipmentSlots.forEach(slot => {
        const slotEl = document.getElementById(`equip-slot-${slot}-${npcData.id}`);
        if (slotEl) {
          const equippedId = npcData.equippedItems?.[slot] || null;
          slotEl.addEventListener('click', () => {
            console.log(`[EquipmentSlot] Clicked ${slot} for character ${npcData.id}`);
            this.hideEquipmentTooltip();
            this.openWarehousePanelForEquipment(slot, npcData.id);
          });
          slotEl.addEventListener('mouseenter', () => {
            slotEl.style.background = '#e3f2fd';
            slotEl.style.borderColor = '#667eea';
            slotEl.style.borderStyle = 'solid';
            // Show tooltip if item is equipped
            if (equippedId) {
              const itemData = this.resolveEquippedItemData(equippedId);
              if (itemData) this.showEquipmentTooltip(slotEl, itemData);
            }
          });
          slotEl.addEventListener('mouseleave', () => {
            const hasEquipped = !!equippedId;
            slotEl.style.background = hasEquipped ? '#e8f5e9' : '#f0f0f0';
            slotEl.style.borderColor = hasEquipped ? '#4caf50' : '#ccc';
            slotEl.style.borderStyle = hasEquipped ? 'solid' : 'dashed';
            this.hideEquipmentTooltip();
          });
        }
      });
    }
  }

  /**
   * Show affinity feedback on progress bar
   */
  /**
     * Show affinity feedback on progress bar
     */
    private showAffinityFeedbackOnProgressBar(characterId: string, affinityChange: number): void {
      console.log('[GameUI] showAffinityFeedbackOnProgressBar called for', characterId, 'change:', affinityChange);

      const actionPanel = document.getElementById('action-panel');
      if (!actionPanel) {
        console.warn('[GameUI] Action panel not found');
        return;
      }

      // Find the affinity progress bar container
      const affinityContainer = actionPanel.querySelector('[data-affinity-bar]') as HTMLElement;
      if (!affinityContainer) {
        console.warn('[GameUI] Affinity progress bar not found');
        return;
      }

      console.log('[GameUI] Found affinity container:', affinityContainer);

      // Create feedback element - positioned at the END (right edge) of the progress bar
      const feedback = document.createElement('div');
      feedback.style.cssText = `
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        font-size: 42px;
        font-weight: bold;
        padding: 12px 24px;
        border-radius: 16px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        z-index: 10000;
        animation: affinityFeedbackBounce 0.6s ease-out;
        pointer-events: none;
        white-space: nowrap;
        border: 3px solid white;
      `;

      if (affinityChange > 0) {
        feedback.textContent = `+${affinityChange}`;
        feedback.style.background = 'linear-gradient(135deg, #ff6b9d, #ff8fb3)';
        feedback.style.color = 'white';
      } else if (affinityChange < 0) {
        feedback.textContent = `${affinityChange}`;
        feedback.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
        feedback.style.color = 'white';
      } else {
        feedback.textContent = '0';
        feedback.style.background = 'linear-gradient(135deg, #95a5a6, #7f8c8d)';
        feedback.style.color = 'white';
      }

      // Add animation keyframes if not already added
      if (!document.querySelector('style[data-affinity-feedback-animation]')) {
        const style = document.createElement('style');
        style.setAttribute('data-affinity-feedback-animation', 'true');
        style.textContent = `
          @keyframes affinityFeedbackBounce {
            0% {
              transform: translateY(-50%) scale(0.3);
              opacity: 0;
            }
            50% {
              transform: translateY(-50%) scale(1.3);
              opacity: 1;
            }
            100% {
              transform: translateY(-50%) scale(1);
              opacity: 1;
            }
          }
          @keyframes affinityFeedbackFadeOut {
            0% {
              opacity: 1;
              transform: translateY(-50%) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateY(-80%) scale(0.6);
            }
          }
        `;
        document.head.appendChild(style);
      }

      // Make the affinity container position relative and add feedback
      affinityContainer.style.position = 'relative';

      // Find the parent container that has enough space
      const parentContainer = affinityContainer.closest('[style*="margin-bottom"]') as HTMLElement;
      if (parentContainer) {
        parentContainer.style.position = 'relative';
        parentContainer.appendChild(feedback);
        console.log('[GameUI] Feedback element added to parent container');
      } else {
        affinityContainer.appendChild(feedback);
        console.log('[GameUI] Feedback element added to affinity container');
      }

      // Fade out and remove after delay
      setTimeout(() => {
        feedback.style.animation = 'affinityFeedbackFadeOut 0.5s ease-out forwards';
        setTimeout(() => {
          if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
            console.log('[GameUI] Feedback element removed');
          }
        }, 500);
      }, 2000);
    }


  private addAttributeTooltips(actionPanel: HTMLElement): void {
    // Define attribute tooltips
    const attributeTooltips = {
      strength: {
        title: `${ATTRIBUTE_ICONS.STRENGTH} 力量`,
        effects: [
          '+1 最大生命值',
          '+1 攻击力',
          '+1 体重',
          '+1 负重'
        ]
      },
      agility: {
        title: `${ATTRIBUTE_ICONS.AGILITY} 敏捷`,
        effects: [
          '+1 最大生命值',
          '+1 移动速度',
          '+0.5% 闪避率'
        ]
      },
      wisdom: {
        title: `${ATTRIBUTE_ICONS.WISDOM} 智慧`,
        effects: [
          '+1 最大生命值',
          '+0.2 每秒回魔',
          '+1 魔法强度',
          '+0.5 抗性'
        ]
      },
      technique: {
        title: `${ATTRIBUTE_ICONS.SKILL} 技巧`,
        effects: [
          '+1 最大生命值',
          '+0.5% 暴击率'
        ]
      }
    };

    // Get all attribute boxes
    const attributeBoxes = actionPanel.querySelectorAll('[data-attribute]');
    
    attributeBoxes.forEach((box) => {
      const attributeType = (box as HTMLElement).getAttribute('data-attribute');
      if (!attributeType || !(attributeType in attributeTooltips)) return;

      const tooltip = attributeTooltips[attributeType as keyof typeof attributeTooltips];
      let tooltipElement: HTMLDivElement | null = null;

      // Mouse enter - show tooltip
      box.addEventListener('mouseenter', () => {
        // Create tooltip
        tooltipElement = document.createElement('div');
        tooltipElement.style.cssText = `
          position: absolute;
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 10000;
          pointer-events: none;
          min-width: 180px;
        `;

        // Tooltip content
        const title = document.createElement('div');
        title.textContent = tooltip.title;
        title.style.cssText = `
          font-size: 14px;
          font-weight: bold;
          color: #333;
          margin-bottom: 8px;
          border-bottom: 1px solid #eee;
          padding-bottom: 6px;
        `;
        tooltipElement.appendChild(title);

        // Effects list
        tooltip.effects.forEach(effect => {
          const effectDiv = document.createElement('div');
          effectDiv.textContent = `• ${effect}`;
          effectDiv.style.cssText = `
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
          `;
          tooltipElement!.appendChild(effectDiv);
        });

        // Position tooltip
        const rect = (box as HTMLElement).getBoundingClientRect();
        tooltipElement.style.left = `${rect.left}px`;
        tooltipElement.style.top = `${rect.bottom + 8}px`;

        document.body.appendChild(tooltipElement);
      });

      // Mouse leave - hide tooltip
      box.addEventListener('mouseleave', () => {
        if (tooltipElement && tooltipElement.parentNode) {
          tooltipElement.parentNode.removeChild(tooltipElement);
          tooltipElement = null;
        }
      });
    });
  }
  
  private dialogues: any = null;

  private async loadDialogues(): Promise<void> {
    if (this.dialogues) return;
    
    try {
      const response = await fetch('src/game/data/dialogues.json');
      this.dialogues = await response.json();
    } catch (error) {
      console.error('Failed to load dialogues:', error);
      this.dialogues = {};
    }
  }

  private async handleTalkClick(npcData: any): Promise<void> {
    // Check dialogue count
    const canTalk = this.npcSystem.consumeDialogue(npcData.id);
    if (!canTalk) {
      this.showNotification(`今天已经和${npcData.title || ''}${npcData.name}聊够了，明天再来吧！`, 'warning');
      return;
    }

    // Check for daily membership card food reward (bartender only)
    if (npcData.id === 'bartender' && !this.dailyMembershipFoodClaimed.has('bartender') && this.itemSystem.hasItem('tavern_membership_card')) {
      this.dailyMembershipFoodClaimed.add('bartender');
      this.showMembershipFoodDialogue(npcData);
      this.updateDialogueButtonDisplay(npcData.id);
      return;
    }
    
    // Check if character has dialogue trees (new system)
    if (this.dialogueSystem.hasDialogues(npcData.id)) {
      // Use new DialogueModal system
      const topic = this.dialogueSystem.selectDialogueTopic(npcData.id);
      if (topic && this.dialogueModal && this.playerEntity) {
        this.dialogueModal.open(this.playerEntity.id, npcData.id, topic);
        // Update button display after dialogue
        this.updateDialogueButtonDisplay(npcData.id);
        return;
      }
    }
    
    // Fall back to old dialogue system
    await this.loadDialogues();
    
    // Check for quest-related dialogue
    if (npcData.id === 'village_chief') {
      const questDialogue = this.checkQuestDialogue(npcData);
      if (questDialogue) {
        this.showQuestDialogue(npcData, questDialogue);
        // Update button display after dialogue
        this.updateDialogueButtonDisplay(npcData.id);
        return;
      }
    }
    
    const dialogue = this.getDialogue(npcData);
    this.showDialogue(npcData, dialogue);
    // Update button display after dialogue
    this.updateDialogueButtonDisplay(npcData.id);
  }

  /**
   * Show membership card daily food dialogue for bartender
   */
  private showMembershipFoodDialogue(npcData: any): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;`;

    const box = document.createElement('div');
    box.style.cssText = `background: white; border-radius: 12px; padding: 24px; max-width: 420px; width: 90%; position: relative;`;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `position: absolute; top: 8px; right: 12px; background: none; border: none; font-size: 20px; cursor: pointer; color: #666;`;
    closeBtn.addEventListener('click', () => overlay.remove());

    const text = document.createElement('p');
    text.style.cssText = `font-size: 15px; line-height: 1.6; color: #333; margin: 0 0 16px 0;`;
    text.textContent = '今天还顺利吗？来吧，我知道你肯定饿了，这是专门给你准备的。';

    const responseBtn = document.createElement('button');
    responseBtn.textContent = '那我就不客气了';
    responseBtn.style.cssText = `width: 100%; padding: 12px; background: #6c7ae0; border: none; border-radius: 8px; color: white; font-size: 14px; font-weight: bold; cursor: pointer;`;
    responseBtn.addEventListener('click', () => {
      this.itemSystem.addItem('dalieba', 4);
      this.showNotification('🍞 获得 大列巴 ×4', 'success');
      // Emit dialogue completed event
      this.eventSystem.emit({ type: 'dialogue:completed', timestamp: Date.now(), characterId: npcData.id });
      overlay.remove();
    });

    box.appendChild(closeBtn);
    box.appendChild(text);
    box.appendChild(responseBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  /**
   * Update dialogue button display to show remaining count
   */
  private updateDialogueButtonDisplay(npcId: string): void {
    const npc = this.npcSystem.getNPC(npcId) || this.npcSystem.getRecruitedCharacter(npcId);
    if (!npc) return;
    
    const talkBtn = document.getElementById(`talk-btn-${npcId}`) as HTMLButtonElement;
    if (!talkBtn) return;
    
    const remaining = npc.dailyDialogueCount || 0;
    const max = npc.maxDailyDialogues || 3;
    
    if (remaining <= 0) {
      talkBtn.disabled = true;
      talkBtn.style.opacity = '0.5';
      talkBtn.style.cursor = 'not-allowed';
      talkBtn.innerHTML = `💬 对话 (0/${max})`;
    } else {
      talkBtn.innerHTML = `💬 对话 (${remaining}/${max})`;
    }
  }

  private checkQuestDialogue(npcData: any): any | null {
    return null;
  }

  private showQuestDialogue(npcData: any, questDialogue: any): void {
    // Create dialogue overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-in;
    `;

    // Create dialogue box
    const dialogueBox = document.createElement('div');
    dialogueBox.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
    `;

    // Character name
    const nameDisplay = npcData.title ? `${npcData.title}${npcData.name}` : npcData.name;
    const nameElement = document.createElement('div');
    nameElement.textContent = nameDisplay;
    nameElement.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #f0f0f0;
    `;

    // Dialogue text
    const textElement = document.createElement('div');
    textElement.textContent = questDialogue.text;
    textElement.style.cssText = `
      font-size: 16px;
      color: #333;
      line-height: 1.6;
      margin-bottom: 20px;
      min-height: 60px;
    `;

    // Options container
    const optionsContainer = document.createElement('div');
    optionsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    questDialogue.options.forEach((option: any) => {
      const optionButton = document.createElement('button');
      optionButton.textContent = option.text;
      optionButton.style.cssText = `
        width: 100%;
        padding: 12px;
        background: #667eea;
        border: none;
        border-radius: 6px;
        color: white;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
      `;

      optionButton.addEventListener('mouseenter', () => {
        optionButton.style.background = '#5568d3';
      });

      optionButton.addEventListener('mouseleave', () => {
        optionButton.style.background = '#667eea';
      });

      optionButton.addEventListener('click', () => {
        if (option.action === 'accept') {
          // Legacy quest dialogue - no longer used with new quest system
          overlay.remove();
          this.showQuestDialogue(npcData, {
            type: 'quest_main_1_accepted',
            text: '太好了，我听说最近草原上好像挺危险，你可要小心啊，这点钱你拿去买点补给或者去酒馆招募点可靠的同伴吧。',
            options: [
              { text: '放心，交给我吧！（点击NPC的"任务"按钮，在"进行中"分页中提交任务吧）', action: 'close' }
            ]
          });
        } else if (option.action === 'close') {
          overlay.remove();
        } else {
          // Decline - just close
          overlay.remove();
        }
      });

      optionsContainer.appendChild(optionButton);
    });

    // Assemble dialogue box
    dialogueBox.appendChild(nameElement);
    dialogueBox.appendChild(textElement);
    dialogueBox.appendChild(optionsContainer);
    overlay.appendChild(dialogueBox);

    // Add animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `;
    if (!document.querySelector('style[data-dialogue-animations]')) {
      style.setAttribute('data-dialogue-animations', 'true');
      document.head.appendChild(style);
    }

    // Add to document
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  private getDialogue(npcData: any): string {
    // Determine NPC type for dialogue selection
    let npcType = 'adventurer';
    if (npcData.id === 'village_chief') {
      npcType = 'village_chief';
    } else if (npcData.id === 'bartender') {
      npcType = 'bartender';
    } else if (npcData.id === 'maid') {
      npcType = 'maid';
    } else if (npcData.id === 'alchemist_tuanzi') {
      npcType = 'alchemist_tuanzi';
    } else if (npcData.id === 'scholar_xiaomei') {
      npcType = 'scholar_xiaomei';
    } else if (npcData.id === 'trainer_alin') {
      npcType = 'trainer_alin';
    } else if (npcData.id === 'bookseller_xiaochao') {
      npcType = 'bookseller_xiaochao';
    }

    const npcDialogues = this.dialogues[npcType];
    if (!npcDialogues) {
      return '...（沉默）';
    }

    // Check if character is recruited
    const isRecruited = this.npcSystem.getRecruitedCharacter(npcData.id) !== undefined;
    if (isRecruited && npcDialogues.recruited) {
      return this.getRandomDialogue(npcDialogues.recruited);
    }

    // Select dialogue based on affinity level
    const affinity = npcData.affinity || 0;
    let dialoguePool: string[] = [];

    if (affinity >= 80) {
      dialoguePool = npcDialogues.high_affinity || [];
    } else if (affinity >= 40) {
      dialoguePool = npcDialogues.medium_affinity || [];
    } else if (affinity >= 10) {
      dialoguePool = npcDialogues.low_affinity || [];
    }

    // Fallback to greeting if no specific dialogue
    if (dialoguePool.length === 0) {
      dialoguePool = npcDialogues.greeting || ['你好。'];
    }

    return this.getRandomDialogue(dialoguePool);
  }

  private getRandomDialogue(dialogues: string[]): string {
    if (!dialogues || dialogues.length === 0) return '...';
    return dialogues[Math.floor(Math.random() * dialogues.length)];
  }

  private showDialogue(npcData: any, dialogue: string): void {
    // Create dialogue overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-in;
    `;

    // Create dialogue box
    const dialogueBox = document.createElement('div');
    dialogueBox.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
    `;

    // Character name
    const nameDisplay = npcData.title ? `${npcData.title}${npcData.name}` : npcData.name;
    const nameElement = document.createElement('div');
    nameElement.textContent = nameDisplay;
    nameElement.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #f0f0f0;
    `;

    // Dialogue text
    const textElement = document.createElement('div');
    textElement.textContent = dialogue;
    textElement.style.cssText = `
      font-size: 16px;
      color: #333;
      line-height: 1.6;
      margin-bottom: 20px;
      min-height: 60px;
    `;

    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    closeButton.style.cssText = `
      width: 100%;
      padding: 12px;
      background: #667eea;
      border: none;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#5568d3';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#667eea';
    });

    closeButton.addEventListener('click', () => {
      overlay.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 200);
    });

    // Assemble dialogue box
    dialogueBox.appendChild(nameElement);
    dialogueBox.appendChild(textElement);
    dialogueBox.appendChild(closeButton);
    overlay.appendChild(dialogueBox);

    // Add animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    // Add to document
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeButton.click();
      }
    });
  }

  private calculateGiftAffinity(npcData: any, itemId: string): number {
    const prefs = npcData.giftPreferences;
    if (prefs) {
      if (prefs.loved && prefs.loved.includes(itemId)) return 2;
      if (prefs.liked && prefs.liked.includes(itemId)) return 1;
      if (prefs.hated && prefs.hated.includes(itemId)) return -1;
    }
    return 0.1;
  }

  private handleGiftClick(npcData: any): void {
      // Check daily gift count
      const giftRemaining = npcData.dailyGiftCount ?? 1;
      if (giftRemaining <= 0) {
        this.showNotification(`今天已经送过礼物给${npcData.title || ''}${npcData.name}了，明天再来吧！`, 'warning');
        return;
      }

      // Get all inventory items
      const inventory = this.itemSystem.getInventory();
      if (inventory.length === 0) {
        this.showNotification('背包中没有可以赠送的物品。', 'warning');
        return;
      }

      // Create gift selection overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      const modal = document.createElement('div');
      modal.style.cssText = `
        background: #fff;
        border-radius: 12px;
        padding: 24px;
        width: 720px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      `;

      const displayName = npcData.title ? `${npcData.title}${npcData.name}` : npcData.name;

      // Header
      const header = document.createElement('div');
      header.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;`;
      header.innerHTML = `
        <h3 style="margin: 0; font-size: 18px; color: #333;">🎁 送礼给 ${displayName}</h3>
        <button id="gift-modal-close" style="background: none; border: none; font-size: 22px; cursor: pointer; color: #999; padding: 4px 8px;">✕</button>
      `;
      modal.appendChild(header);

      // Preference panel
      const prefs = npcData.giftPreferences;
      if (prefs) {
        const prefPanel = document.createElement('div');
        prefPanel.style.cssText = `margin-bottom: 12px; padding: 10px; background: #fafafa; border-radius: 8px; border: 1px solid #eee;`;
        
        const prefTitle = document.createElement('div');
        prefTitle.style.cssText = `font-size: 13px; font-weight: bold; color: #555; margin-bottom: 8px;`;
        prefTitle.textContent = `${displayName} 的物品偏好`;
        prefPanel.appendChild(prefTitle);

        const discoveredPrefs = npcData.discoveredPreferences || [];

        const prefRows: { label: string; items: string[]; color: string; emoji: string }[] = [
          { label: '最爱', items: prefs.loved || [], color: '#d63384', emoji: '💜' },
          { label: '喜欢', items: prefs.liked || [], color: '#f8a4c8', emoji: '💗' },
          { label: '讨厌', items: prefs.hated || [], color: '#6c757d', emoji: '💔' }
        ];

        prefRows.forEach(row => {
          if (row.items.length === 0) return;
          const rowEl = document.createElement('div');
          rowEl.style.cssText = `display: flex; align-items: center; gap: 8px; margin-bottom: 6px;`;
          const labelEl = document.createElement('span');
          labelEl.style.cssText = `font-size: 12px; color: ${row.color}; font-weight: bold; min-width: 50px; flex-shrink: 0;`;
          labelEl.textContent = `${row.emoji} ${row.label}`;
          rowEl.appendChild(labelEl);

          const itemsContainer = document.createElement('div');
          itemsContainer.style.cssText = `display: flex; gap: 6px; flex-wrap: wrap;`;

          row.items.forEach(itemId => {
            const isDiscovered = discoveredPrefs.includes(itemId);
            const itemData = this.itemsData.get(itemId) || this.itemSystem.getItem(itemId);
            const itemName = isDiscovered ? (itemData ? itemData.name : itemId) : '？？？';
            const iconPath = isDiscovered ? (itemData?.icon || '') : '';
            
            const itemCard = document.createElement('div');
            itemCard.style.cssText = `
              display: flex;
              align-items: center;
              gap: 4px;
              padding: 3px 8px 3px 3px;
              border-radius: 12px;
              border: 1.5px solid ${row.color};
              background: ${row.color}11;
            `;

            if (isDiscovered) {
              const iconEl = document.createElement('div');
              iconEl.style.cssText = `
                width: 24px;
                height: 24px;
                border-radius: 4px;
                border: 2px solid ${row.color};
                overflow: hidden;
                background: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              `;
              iconEl.innerHTML = iconPath 
                ? `<img src="${iconPath}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.textContent='📦'">`
                : '📦';
              itemCard.appendChild(iconEl);
            }

            const nameEl = document.createElement('span');
            nameEl.style.cssText = `font-size: 11px; color: ${row.color}; font-weight: 500;`;
            nameEl.textContent = itemName;

            itemCard.appendChild(nameEl);
            itemsContainer.appendChild(itemCard);
          });

          rowEl.appendChild(itemsContainer);
          prefPanel.appendChild(rowEl);
        });

        modal.appendChild(prefPanel);
      }

      // Hint
      const hint = document.createElement('div');
      hint.style.cssText = `font-size: 12px; color: #888; margin-bottom: 12px;`;
      hint.textContent = '选择一个物品赠送。赠送角色喜爱的物品可以获得更多好感度。';
      modal.appendChild(hint);

      // Item grid (scrollable)
      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        overflow-y: auto;
        overflow-x: hidden;
        flex: 1;
        padding-right: 4px;
      `;

      inventory.forEach(slot => {
        const itemData = this.itemsData.get(slot.itemId) || this.itemSystem.getItem(slot.itemId);
        if (!itemData) return;

        const rarity = itemData.rarity || 0;
        const rarityColor = this.getRarityColor(rarity);
        const rarityName = this.getRarityName(rarity);
        const iconPath = itemData.icon || '';
        const affinityGain = this.calculateGiftAffinity(npcData, slot.itemId);

        // Determine border color based on preference (only if discovered)
        let prefBorderColor = '#e0e0e0';
        let prefLabel = '';
        const discoveredPrefs = npcData.discoveredPreferences || [];
        const isDiscovered = discoveredPrefs.includes(slot.itemId);
        
        if (prefs && isDiscovered) {
          if (prefs.loved && prefs.loved.includes(slot.itemId)) {
            prefBorderColor = '#d63384';
            prefLabel = '💜最爱';
          } else if (prefs.liked && prefs.liked.includes(slot.itemId)) {
            prefBorderColor = '#f8a4c8';
            prefLabel = '💗喜欢';
          } else if (prefs.hated && prefs.hated.includes(slot.itemId)) {
            prefBorderColor = '#6c757d';
            prefLabel = '💔讨厌';
          }
        }

        const card = document.createElement('div');
        card.style.cssText = `
          background: #f9f9f9;
          border: 2px solid ${prefBorderColor};
          border-radius: 8px;
          padding: 8px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        `;

        const affinityDisplay = isDiscovered 
          ? (affinityGain > 0 ? `💖+${affinityGain}` : affinityGain < 0 ? `💔${affinityGain}` : `💤+${affinityGain}`)
          : '❓';
        const affinityColor = isDiscovered 
          ? (affinityGain > 0 ? '#ff6b9d' : affinityGain < 0 ? '#6c757d' : '#bbb')
          : '#999';

        card.innerHTML = `
          ${prefLabel ? `<div style="position: absolute; top: 2px; right: 4px; font-size: 9px; color: ${prefBorderColor};">${prefLabel}</div>` : ''}
          <div style="width: 64px; height: 64px; margin: 0 auto 6px; border-radius: 6px; border: 2px solid ${rarityColor}; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center;">
            ${iconPath ? `<img src="${iconPath}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.textContent='📦'">` : '📦'}
          </div>
          <div style="font-size: 12px; font-weight: bold; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${itemData.name}</div>
          <div style="font-size: 10px; color: ${rarityColor};">${rarityName}</div>
          <div style="font-size: 10px; color: #999;">x${slot.quantity}</div>
          <div style="font-size: 11px; color: ${affinityColor}; font-weight: bold;">${affinityDisplay}</div>
        `;

        card.addEventListener('mouseenter', () => {
          card.style.borderColor = prefBorderColor !== '#e0e0e0' ? prefBorderColor : rarityColor;
          card.style.background = '#f0f0ff';
          card.style.transform = 'translateY(-2px)';
        });
        card.addEventListener('mouseleave', () => {
          card.style.borderColor = prefBorderColor;
          card.style.background = '#f9f9f9';
          card.style.transform = 'translateY(0)';
        });

        card.addEventListener('click', () => {
          // Remove item from inventory
          const removed = this.itemSystem.removeItem(slot.itemId, 1);
          if (!removed) {
            this.showNotification('赠送失败，物品不存在。', 'error');
            return;
          }

          // Consume daily gift count
          this.npcSystem.consumeGift(npcData.id);

          // Update NPC affinity
          const affinityChange = affinityGain;
          this.npcSystem.updateAffinity(npcData.id, affinityChange);

          // Check affinity milestone rewards
          const updatedNPCForReward = this.npcSystem.getNPC(npcData.id) || this.npcSystem.getRecruitedCharacter(npcData.id);
          if (updatedNPCForReward) {
            this.checkAffinityRewards(npcData.id, updatedNPCForReward.affinity || 0);
          }

          // Emit quest events for gift giving and affinity change
          this.eventSystem.emit({ type: 'quest:gift_given', npcId: npcData.id, timestamp: Date.now() });
          if (updatedNPCForReward) {
            this.eventSystem.emit({ type: 'quest:affinity_changed', npcId: npcData.id, newAffinity: updatedNPCForReward.affinity || 0, timestamp: Date.now() });
          }

          // Record discovered preference (record all gifted items)
          if (!npcData.discoveredPreferences) {
            npcData.discoveredPreferences = [];
          }
          if (!npcData.discoveredPreferences.includes(slot.itemId)) {
            npcData.discoveredPreferences.push(slot.itemId);
          }

          // Show emoji feedback on NPC card
          const npcCard = this.npcCardInstances.get(npcData.id);
          if (npcCard) {
            npcCard.showEmojiFeedback(affinityChange);
          }

          // Show affinity feedback on progress bar
          this.showAffinityFeedbackOnProgressBar(npcData.id, affinityChange);

          // Show notification
          const changeText = affinityChange >= 0 ? `+${affinityChange}` : `${affinityChange}`;
          this.showNotification(`赠送了 ${itemData.name} 给 ${displayName}，好感度 ${changeText}`, affinityChange >= 0 ? 'success' : 'warning');

          // Close modal
          overlay.remove();

          // Refresh NPC details panel with updated data
          const updatedNPC = this.npcSystem.getNPC(npcData.id) || this.npcSystem.getRecruitedCharacter(npcData.id);
          if (updatedNPC) {
            this.showNPCDetails(updatedNPC);
          }
        });

        grid.appendChild(card);
      });

      modal.appendChild(grid);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Close handlers
      const closeBtn = overlay.querySelector('#gift-modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => overlay.remove());
      }
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
      });
    }

  
  private handleRecruitClick(npcData: any): void {
    const recruitCost = 100;
    
    // Check if player has enough gold
    if (!this.playerEntity) {
      this.showNotification('玩家实体未初始化', 'error');
      return;
    }
    
    const currency = this.currencySystem.getCurrency(this.world, this.playerEntity.id);
    if (!currency || currency.amounts.gold < recruitCost) {
      this.showNotification('金币不足，无法招募！', 'warning');
      return;
    }
    
    // Show in-game confirmation dialog
    this.showConfirmDialog(
      `确定要花费 ${recruitCost} 金币招募 ${npcData.title}${npcData.name} 吗？`,
      () => {
        // Confirmed - proceed with recruitment
        const result = this.currencySystem.spendCurrency(
          this.world, 
          this.playerEntity!.id, 
          { gold: recruitCost }, 
          `招募 ${npcData.title}${npcData.name}`
        );
        
        if (!result.success) {
          this.showNotification('扣除金币失败！', 'error');
          return;
        }
        
        // Update currency display
        this.updateCurrencyDisplay();
        
        // Add character to recruited roster
        this.npcSystem.recruitCharacter(npcData);
        
        // Note: Do NOT apply hunger BUFF here - it should only be applied when entering battle
        
        // Reload the current scene to update the display
        this.switchScene(this.currentScene);
        
        // Clear the action panel
        this.clearActionPanel();
        
        this.showNotification(`成功招募 ${npcData.title}${npcData.name}！前往营地中管理角色吧~`, 'success');
        
        // Emit quest event for recruitment
        this.eventSystem.emit({ type: 'quest:recruited', timestamp: Date.now() });
      },
      () => {
        // Cancelled - do nothing
      }
    );
  }

  /**
   * Show dismiss confirmation dialog for adventurer/otherworld characters
   */
  private showDismissConfirmDialog(npcData: any): void {
    const displayName = npcData.title ? `${npcData.title}${npcData.name}` : npcData.name;
    this.showConfirmDialog(
      `确定要解雇 ${displayName} 吗？解雇后该角色将永久消失！`,
      () => {
        this.handleDismissCharacter(npcData);
      },
      () => {
        // Cancelled - do nothing
      }
    );
  }

  /**
   * Handle dismissing a character - remove from party, work slots, and recruited roster
   */
  private handleDismissCharacter(npcData: any): void {
    const characterId = npcData.id;
    const displayName = npcData.title ? `${npcData.title}${npcData.name}` : npcData.name;

    // Remove from party slots
    for (let i = 0; i < this.partySlots.length; i++) {
      if (this.partySlots[i] && this.partySlots[i].id === characterId) {
        this.clearBuffVisualEffects(characterId);
        this.partySlots[i] = null;
      }
    }

    // Remove from work slots
    for (let i = 0; i < this.workSlots.length; i++) {
      if (this.workSlots[i] && this.workSlots[i].id === characterId) {
        // Cancel active crafting task if any
        const task = this.workSlotTasks.get(i);
        if (task) {
          clearInterval(task.intervalId);
          this.workSlotTasks.delete(i);
        }
        this.workSlots[i] = null;
      }
    }

    // Remove from injured characters tracking
    const injuredEntry = this.injuredCharacters.get(characterId);
    if (injuredEntry) {
      clearInterval(injuredEntry.intervalId);
      this.injuredCharacters.delete(characterId);
    }

    // Remove from NPC card instances
    this.npcCardInstances.delete(characterId);

    // Remove from claimed affinity rewards
    this.claimedAffinityRewards.delete(characterId);

    // Remove from recruited characters in NPCSystem
    this.npcSystem.removeRecruitedCharacter(characterId);

    // Refresh UI
    this.refreshPartySlots();
    this.refreshWorkSlots();
    this.switchScene(this.currentScene);
    this.clearActionPanel();

    this.showNotification(`${displayName} 已被解雇`, 'success');
  }
  
  private showConfirmDialog(message: string, onConfirm: () => void, onCancel?: () => void): void {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `;
    
    // Create dialog box
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 16px;
      padding: 32px;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      animation: fadeInScale 0.2s ease-out;
    `;
    
    // Message
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
      font-size: 18px;
      color: #333;
      margin-bottom: 24px;
      line-height: 1.6;
      text-align: center;
    `;
    
    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: center;
    `;
    
    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.style.cssText = `
      flex: 1;
      padding: 12px 24px;
      background: #e0e0e0;
      border: none;
      border-radius: 8px;
      color: #333;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = '#d0d0d0';
    });
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = '#e0e0e0';
    });
    cancelButton.addEventListener('click', () => {
      overlay.remove();
      if (onCancel) onCancel();
    });
    
    // Confirm button
    const confirmButton = document.createElement('button');
    confirmButton.textContent = '确定';
    confirmButton.style.cssText = `
      flex: 1;
      padding: 12px 24px;
      background: #667eea;
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    confirmButton.addEventListener('mouseenter', () => {
      confirmButton.style.background = '#5568d3';
    });
    confirmButton.addEventListener('mouseleave', () => {
      confirmButton.style.background = '#667eea';
    });
    confirmButton.addEventListener('click', () => {
      overlay.remove();
      onConfirm();
    });
    
    // Assemble dialog
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);
    dialog.appendChild(messageEl);
    dialog.appendChild(buttonContainer);
    overlay.appendChild(dialog);
    
    // Add to document
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        onCancel();
      }
    });
  }

  private loadCampScene(): void {
    if (!this.sceneContainer) return;

    // Create warehouse container
    const warehouseContainer = document.createElement('div');
    warehouseContainer.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 80px 20px 20px 20px;
      box-sizing: border-box;
    `;

    // Tab buttons
    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = `
      display: flex;
      gap: 12px;
      margin-bottom: 5px;
    `;

    const characterTab = document.createElement('button');
    characterTab.textContent = '角色';
    characterTab.setAttribute('data-tab', 'character');
    characterTab.style.cssText = `
      padding: 8px 24px;
      background: rgba(102, 126, 234, 0.8);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;

    const itemTab = document.createElement('button');
    itemTab.textContent = '物品';
    itemTab.setAttribute('data-tab', 'item');
    itemTab.style.cssText = `
      padding: 8px 24px;
      background: rgba(255, 255, 255, 0.6);
      border: none;
      border-radius: 8px;
      color: #333;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;

    const cookingTab = document.createElement('button');
    cookingTab.textContent = '烹饪';
    cookingTab.setAttribute('data-tab', 'cooking');
    cookingTab.style.cssText = `
      padding: 8px 24px;
      background: rgba(255, 255, 255, 0.6);
      border: none;
      border-radius: 8px;
      color: #333;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;

    tabContainer.appendChild(characterTab);
    tabContainer.appendChild(itemTab);
    tabContainer.appendChild(cookingTab);

    // Content area
    const contentArea = document.createElement('div');
    contentArea.setAttribute('data-content-area', 'warehouse');
    contentArea.style.cssText = `
      flex: 1;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    `;

    // Add tab container to content area
    contentArea.appendChild(tabContainer);

    // Character grid container
    const characterGridContainer = document.createElement('div');
    characterGridContainer.style.cssText = `
      flex: 1;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 16px;
      align-content: start;
      margin-bottom: 10px;
    `;

    // Pagination container
    const paginationContainer = document.createElement('div');
    paginationContainer.style.cssText = `
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      padding: 10px;
    `;

    // Get recruited characters
    const recruitedCharacters = this.npcSystem.getRecruitedCharacters();
    const itemsPerPage = 21;
    let currentPage = 0;
    const totalPages = Math.ceil(recruitedCharacters.length / itemsPerPage);

    const renderCharacterPage = (page: number) => {
      characterGridContainer.innerHTML = '';
      const startIndex = page * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, recruitedCharacters.length);
      const pageCharacters = recruitedCharacters.slice(startIndex, endIndex);

      if (pageCharacters.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.style.cssText = `
          grid-column: 1 / -1;
          text-align: center;
          padding: 60px 20px;
        `;
        emptyState.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
          <div style="font-size: 18px; margin-bottom: 8px; color: white; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">暂无角色</div>
          <div style="font-size: 14px; color: white; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">前往酒馆招募冒险者吧！</div>
        `;
        characterGridContainer.appendChild(emptyState);
      } else {
        pageCharacters.forEach(character => {
          const card = this.createWarehouseCharacterCard(character);
          characterGridContainer.appendChild(card);
        });
      }

      // Update pagination dots
      renderPagination();
    };

    const renderPagination = () => {
      paginationContainer.innerHTML = '';
      
      if (totalPages <= 1) return;

      // Previous button
      const prevBtn = document.createElement('button');
      prevBtn.textContent = '上一页';
      prevBtn.style.cssText = `
        padding: 4px 12px;
        border: none;
        border-radius: 4px;
        background: ${currentPage === 0 ? '#ccc' : '#667eea'};
        color: white;
        font-size: 12px;
        cursor: ${currentPage === 0 ? 'not-allowed' : 'pointer'};
        opacity: ${currentPage === 0 ? '0.5' : '1'};
        transition: all 0.2s;
      `;
      prevBtn.addEventListener('click', () => {
        if (currentPage > 0) {
          currentPage--;
          renderCharacterPage(currentPage);
        }
      });
      paginationContainer.appendChild(prevBtn);

      for (let i = 0; i < totalPages; i++) {
        const dot = document.createElement('div');
        dot.style.cssText = `
          width: ${i === currentPage ? '12px' : '8px'};
          height: ${i === currentPage ? '12px' : '8px'};
          border-radius: 50%;
          background: ${i === currentPage ? '#667eea' : '#ccc'};
          cursor: pointer;
          transition: all 0.3s;
        `;
        
        dot.addEventListener('mouseenter', () => {
          if (i !== currentPage) {
            dot.style.background = '#999';
          }
        });
        
        dot.addEventListener('mouseleave', () => {
          if (i !== currentPage) {
            dot.style.background = '#ccc';
          }
        });
        
        dot.addEventListener('click', () => {
          currentPage = i;
          renderCharacterPage(currentPage);
        });
        
        paginationContainer.appendChild(dot);
      }

      // Next button
      const nextBtn = document.createElement('button');
      nextBtn.textContent = '下一页';
      nextBtn.style.cssText = `
        padding: 4px 12px;
        border: none;
        border-radius: 4px;
        background: ${currentPage === totalPages - 1 ? '#ccc' : '#667eea'};
        color: white;
        font-size: 12px;
        cursor: ${currentPage === totalPages - 1 ? 'not-allowed' : 'pointer'};
        opacity: ${currentPage === totalPages - 1 ? '0.5' : '1'};
        transition: all 0.2s;
      `;
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages - 1) {
          currentPage++;
          renderCharacterPage(currentPage);
        }
      });
      paginationContainer.appendChild(nextBtn);
    };

    // Tab switching
    characterTab.addEventListener('click', () => {
      characterTab.style.background = 'rgba(102, 126, 234, 0.8)';
      characterTab.style.color = 'white';
      itemTab.style.background = 'rgba(255, 255, 255, 0.6)';
      itemTab.style.color = '#333';
      cookingTab.style.background = 'rgba(255, 255, 255, 0.6)';
      cookingTab.style.color = '#333';
      
      // Remove existing content (except tabs)
      while (contentArea.children.length > 1) {
        contentArea.removeChild(contentArea.lastChild!);
      }
      
      contentArea.appendChild(characterGridContainer);
      contentArea.appendChild(paginationContainer);
      renderCharacterPage(currentPage);
    });

    itemTab.addEventListener('click', () => {
      itemTab.style.background = 'rgba(102, 126, 234, 0.8)';
      itemTab.style.color = 'white';
      characterTab.style.background = 'rgba(255, 255, 255, 0.6)';
      characterTab.style.color = '#333';
      cookingTab.style.background = 'rgba(255, 255, 255, 0.6)';
      cookingTab.style.color = '#333';
      
      // Remove existing content (except tabs)
      while (contentArea.children.length > 1) {
        contentArea.removeChild(contentArea.lastChild!);
      }
      
      // Create item grid
      this.renderItemGrid(contentArea);
    });

    cookingTab.addEventListener('click', () => {
      cookingTab.style.background = 'rgba(102, 126, 234, 0.8)';
      cookingTab.style.color = 'white';
      characterTab.style.background = 'rgba(255, 255, 255, 0.6)';
      characterTab.style.color = '#333';
      itemTab.style.background = 'rgba(255, 255, 255, 0.6)';
      itemTab.style.color = '#333';
      
      // Remove existing content (except tabs)
      while (contentArea.children.length > 1) {
        contentArea.removeChild(contentArea.lastChild!);
      }
      
      // Create cooking panel
      this.renderCookingPanel(contentArea);
    });

    // Initial render
    contentArea.appendChild(characterGridContainer);
    contentArea.appendChild(paginationContainer);
    renderCharacterPage(0);

    warehouseContainer.appendChild(contentArea);
    this.sceneContainer.appendChild(warehouseContainer);
  }

  /**
   * Open equipment selection popup
   * @param equipmentSlot - The equipment slot type to filter by
   * @param characterId - The NPC character ID
   */
  private openWarehousePanelForEquipment(equipmentSlot: string, characterId: string | number): void {
    this.showEquipmentSelectionPopup(equipmentSlot, String(characterId));
  }

  /**
   * Show a popup window for selecting equipment for a specific slot
   */
  private showEquipmentSelectionPopup(slotType: string, characterId: string): void {
    // Remove existing popup if any
    const existing = document.getElementById('equipment-selection-popup');
    if (existing) existing.remove();

    const slotLabels: Record<string, string> = {
      weapon: '⚔️ 武器', armor: '🦺 护甲', offhand: '🛡️ 副手', accessory: '💍 杂项'
    };

    // Get equipment items matching this slot from inventory
    const allItems = this.itemSystem.getInventory();
    const matchingItems = this.filterItemsByEquipmentSlot(allItems, slotType);

    // Get character data to check currently equipped item
    const character = this.npcSystem.getRecruitedCharacter(characterId) || this.npcSystem.getNPC(characterId);
    const currentEquipped = character?.equippedItems?.[slotType as keyof NonNullable<typeof character.equippedItems>] || null;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'equipment-selection-popup';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); display: flex; align-items: center;
      justify-content: center; z-index: 10000;
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { this.hideEquipmentTooltip(); overlay.remove(); }
    });

    // Create popup panel
    const popup = document.createElement('div');
    popup.style.cssText = `
      background: white; border-radius: 12px; padding: 20px; width: 420px;
      max-height: 70vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #eee;
    `;
    title.innerHTML = `
      <span style="font-size: 18px; font-weight: bold; color: #333;">选择${slotLabels[slotType] || slotType}</span>
    `;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none; border: none; font-size: 20px; cursor: pointer;
      color: #999; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;
    `;
    closeBtn.addEventListener('click', () => { this.hideEquipmentTooltip(); overlay.remove(); });
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#333'; closeBtn.style.background = '#f0f0f0'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#999'; closeBtn.style.background = 'none'; });
    title.appendChild(closeBtn);
    popup.appendChild(title);

    // Unequip button if something is equipped
    if (currentEquipped) {
      let currentItemData = this.itemSystem.getItem(currentEquipped);
      if (!currentItemData) {
        // Resolve instanceId to itemId
        const instances = this.itemSystem.getAllItemInstances();
        const inst = instances.find(i => i.instanceId === currentEquipped);
        if (inst) currentItemData = this.itemSystem.getItem(inst.itemId);
      }
      const unequipRow = document.createElement('div');
      unequipRow.style.cssText = `
        display: flex; align-items: center; gap: 12px; padding: 10px 12px;
        background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px;
        margin-bottom: 12px; cursor: pointer; transition: all 0.2s;
      `;
      unequipRow.innerHTML = `
        <span style="font-size: 24px;">🚫</span>
        <div style="flex:1;">
          <div style="font-size: 13px; font-weight: bold; color: #856404;">卸下当前装备</div>
          <div style="font-size: 11px; color: #856404;">${currentItemData?.name || currentEquipped}</div>
        </div>
      `;
      unequipRow.addEventListener('click', () => {
        this.hideEquipmentTooltip();
        this.equipItemToCharacter(characterId, slotType, null);
        overlay.remove();
        // Refresh character details with updated data
        const updatedCharacter = this.npcSystem.getRecruitedCharacter(characterId) || this.npcSystem.getNPC(characterId);
        if (updatedCharacter) this.showNPCDetails(updatedCharacter);
      });
      unequipRow.addEventListener('mouseenter', () => { unequipRow.style.background = '#ffe69c'; });
      unequipRow.addEventListener('mouseleave', () => { unequipRow.style.background = '#fff3cd'; });
      popup.appendChild(unequipRow);
    }

    // Item list
    if (matchingItems.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        text-align: center; padding: 40px 20px; color: #999;
      `;
      empty.innerHTML = `
        <div style="font-size: 36px; margin-bottom: 12px;">📦</div>
        <div style="font-size: 14px;">没有可用的${slotLabels[slotType] || '装备'}</div>
        <div style="font-size: 12px; margin-top: 4px; color: #bbb;">通过制作或战斗获取装备</div>
      `;
      popup.appendChild(empty);
    } else {
      const itemList = document.createElement('div');
      itemList.style.cssText = `display: flex; flex-direction: column; gap: 8px;`;

      matchingItems.forEach(slot => {
        const itemData = this.itemSystem.getItem(slot.itemId);
        if (!itemData) return;

        const isCurrentlyEquipped = slot.instanceId === currentEquipped || slot.itemId === currentEquipped;
        
        // Check if item is equipped by another character
        const equippedByCharacter = this.equippedItemsTracker.get(slot.instanceId);
        const isEquippedByOther = equippedByCharacter !== undefined && equippedByCharacter !== characterId;
        
        const rarityColors = ['#888', '#3498db', '#9b59b6', '#e67e22'];
        const rarityNames = ['普通', '稀有', '史诗', '传说'];
        const rarityColor = rarityColors[itemData.rarity] || '#888';

        const itemRow = document.createElement('div');
        itemRow.style.cssText = `
          display: flex; align-items: center; gap: 12px; padding: 10px 12px;
          background: ${isCurrentlyEquipped ? '#e8f5e9' : isEquippedByOther ? '#f5f5f5' : '#f9f9f9'};
          border: 2px solid ${isCurrentlyEquipped ? '#4caf50' : isEquippedByOther ? '#bbb' : '#eee'};
          border-radius: 8px; cursor: ${isEquippedByOther ? 'not-allowed' : 'pointer'}; 
          transition: all 0.2s;
          opacity: ${isEquippedByOther ? '0.6' : '1'};
        `;

        // Icon
        const icon = document.createElement('div');
        icon.style.cssText = `
          width: 48px; height: 48px; border-radius: 6px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; background: rgba(0,0,0,0.05);
          border: 2px solid ${rarityColor};
        `;
        if (itemData.icon && (itemData.icon.includes('.png') || itemData.icon.includes('.jpg'))) {
          icon.innerHTML = `<img src="${itemData.icon}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`;
        } else {
          icon.textContent = itemData.icon || '📦';
        }

        // Info
        const info = document.createElement('div');
        info.style.cssText = `flex: 1; min-width: 0;`;
        let statsHtml = '';
        if (itemData.mainStat) {
          const val = itemData.mainStat.type === 'percentage' ? `+${itemData.mainStat.value}%` : `+${itemData.mainStat.value}`;
          statsHtml += `<span style="color: #e67e22;">${this.getAttributeDisplayName(itemData.mainStat.attribute)} ${val}</span>`;
        }
        if (itemData.subStats && itemData.subStats.length > 0) {
          itemData.subStats.forEach((s: any) => {
            const val = s.type === 'percentage' ? `+${s.value}%` : `+${s.value}`;
            statsHtml += ` <span style="color: #3498db;">${this.getAttributeDisplayName(s.attribute)} ${val}</span>`;
          });
        }
        
        // Get character name if equipped by another character
        let equippedByName = '';
        if (isEquippedByOther && equippedByCharacter) {
          const otherCharacter = this.npcSystem.getRecruitedCharacter(equippedByCharacter) || this.npcSystem.getNPC(equippedByCharacter);
          equippedByName = otherCharacter?.name || '其他角色';
        }
        
        info.innerHTML = `
          <div style="font-size: 14px; font-weight: bold; color: ${rarityColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${itemData.name}${isCurrentlyEquipped ? ' <span style="color:#4caf50;font-size:11px;">(已装备)</span>' : ''}${isEquippedByOther ? ` <span style="color:#999;font-size:11px;">(${equippedByName}装备中)</span>` : ''}
          </div>
          <div style="font-size: 10px; color: #999; margin-top: 2px;">${rarityNames[itemData.rarity] || '普通'} · 数量: ${slot.quantity}</div>
          ${statsHtml ? `<div style="font-size: 10px; margin-top: 3px;">${statsHtml}</div>` : ''}
        `;

        itemRow.appendChild(icon);
        itemRow.appendChild(info);

        if (!isCurrentlyEquipped && !isEquippedByOther) {
          itemRow.addEventListener('click', () => {
            this.hideEquipmentTooltip();
            const equipId = slot.instanceId || slot.itemId;
            this.equipItemToCharacter(characterId, slotType, equipId);
            overlay.remove();
            // Refresh character details with updated data
            const updatedCharacter = this.npcSystem.getRecruitedCharacter(characterId) || this.npcSystem.getNPC(characterId);
            if (updatedCharacter) this.showNPCDetails(updatedCharacter);
          });
          itemRow.addEventListener('mouseenter', () => {
            itemRow.style.background = '#e3f2fd';
            itemRow.style.borderColor = '#667eea';
            const resolvedData = this.resolveEquippedItemData(slot.instanceId || slot.itemId);
            if (resolvedData) this.showEquipmentTooltip(itemRow, resolvedData);
          });
          itemRow.addEventListener('mouseleave', () => {
            itemRow.style.background = '#f9f9f9';
            itemRow.style.borderColor = '#eee';
            this.hideEquipmentTooltip();
          });
        } else {
          itemRow.addEventListener('mouseenter', () => {
            const resolvedData = this.resolveEquippedItemData(slot.instanceId || slot.itemId);
            if (resolvedData) this.showEquipmentTooltip(itemRow, resolvedData);
          });
          itemRow.addEventListener('mouseleave', () => {
            this.hideEquipmentTooltip();
          });
        }

        itemList.appendChild(itemRow);
      });

      popup.appendChild(itemList);
    }

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
  }

  /**
   * Equip or unequip an item to a character's slot
   */
  /**
   * Calculate primary attribute bonuses from equipped items
   * Returns the total bonuses to strength, agility, wisdom, and skill
   */
  private calculatePrimaryAttributeBonuses(character: NPCData): { strength: number; agility: number; wisdom: number; skill: number } {
    const bonuses = {
      strength: 0, agility: 0, wisdom: 0, skill: 0
    };

    if (!character.equippedItems) {
      return bonuses;
    }

    // Iterate through all equipped items and sum up primary attribute bonuses
    for (const slotType of ['weapon', 'armor', 'offhand', 'accessory']) {
      const equippedId = character.equippedItems[slotType as keyof typeof character.equippedItems];
      if (equippedId) {
        const itemData = this.resolveEquippedItemData(equippedId);
        if (itemData) {
          // Parse mainAttribute
          if (itemData.mainAttribute) {
            const parsedBonuses = this.parseMainAttribute(itemData.mainAttribute);
            for (const bonus of parsedBonuses) {
              if (bonus.attr in bonuses) {
                bonuses[bonus.attr as keyof typeof bonuses] += bonus.value;
              }
            }
          }

          // Parse mainStat
          if (itemData.mainStat && itemData.mainStat.attribute in bonuses) {
            bonuses[itemData.mainStat.attribute as keyof typeof bonuses] += itemData.mainStat.value;
          }

          // Parse subStats
          if (itemData.subStats && Array.isArray(itemData.subStats)) {
            for (const sub of itemData.subStats) {
              if (sub.attribute in bonuses) {
                bonuses[sub.attribute as keyof typeof bonuses] += sub.value;
              }
            }
          }

          // Parse affixes
          const calcAffixes1 = normalizeAffixes(itemData.appliedAffix);
          for (const a of calcAffixes1) {
            if (a.type in bonuses) {
              bonuses[a.type as keyof typeof bonuses] += a.value;
            }
          }
        }
      }
    }

    return bonuses;
  }

  /**
   * Recalculate all attributes based on base values and equipment bonuses
   * This should be called whenever equipment changes
   * 
   * This method assumes character.strength, character.agility, etc. are BASE values (without equipment).
   * Equipment bonuses are calculated and applied on top of these base values.
   */
  private recalculateSecondaryAttributes(character: NPCData): void {
    // Step 1: Collect all equipment bonuses (both primary and secondary attributes)
    const primaryBonuses = {
      strength: 0, agility: 0, wisdom: 0, skill: 0
    };
    
    const secondaryBonuses = {
      attack: 0, defense: 0, moveSpeed: 0, dodgeRate: 0, critRate: 0,
      critDamage: 0, resistance: 0, magicPower: 0, carryWeight: 0,
      accuracy: 0, hpRegen: 0, mpRegen: 0, weight: 0, volume: 0
    };
    
    const hpMpBonuses = {
      maxHP: 0, maxMP: 0
    };

    // Iterate through all equipped items and sum up their bonuses
    if (character.equippedItems) {
      for (const slotType of ['weapon', 'armor', 'offhand', 'accessory']) {
        const equippedId = character.equippedItems[slotType as keyof typeof character.equippedItems];
        if (equippedId) {
          const itemData = this.resolveEquippedItemData(equippedId);
          if (itemData) {
            // Parse mainAttribute
            if (itemData.mainAttribute) {
              const bonuses = this.parseMainAttribute(itemData.mainAttribute);
              for (const bonus of bonuses) {
                if (bonus.attr in primaryBonuses) {
                  primaryBonuses[bonus.attr as keyof typeof primaryBonuses] += bonus.value;
                } else if (bonus.attr in secondaryBonuses) {
                  secondaryBonuses[bonus.attr as keyof typeof secondaryBonuses] += bonus.value;
                } else if (bonus.attr in hpMpBonuses) {
                  hpMpBonuses[bonus.attr as keyof typeof hpMpBonuses] += bonus.value;
                }
              }
            }

            // Parse mainStat
            if (itemData.mainStat) {
              const attr = itemData.mainStat.attribute;
              const value = itemData.mainStat.value;
              if (attr in primaryBonuses) {
                primaryBonuses[attr as keyof typeof primaryBonuses] += value;
              } else if (attr in secondaryBonuses) {
                secondaryBonuses[attr as keyof typeof secondaryBonuses] += value;
              } else if (attr in hpMpBonuses) {
                hpMpBonuses[attr as keyof typeof hpMpBonuses] += value;
              }
            }

            // Parse subStats
            if (itemData.subStats && Array.isArray(itemData.subStats)) {
              for (const sub of itemData.subStats) {
                const attr = sub.attribute;
                const value = sub.value;
                if (attr in primaryBonuses) {
                  primaryBonuses[attr as keyof typeof primaryBonuses] += value;
                } else if (attr in secondaryBonuses) {
                  secondaryBonuses[attr as keyof typeof secondaryBonuses] += value;
                } else if (attr in hpMpBonuses) {
                  hpMpBonuses[attr as keyof typeof hpMpBonuses] += value;
                }
              }
            }

            // Parse affixes
            const calcAffixes2 = normalizeAffixes(itemData.appliedAffix);
            for (const a of calcAffixes2) {
              const attr = a.type;
              const value = a.value;
              if (attr in primaryBonuses) {
                primaryBonuses[attr as keyof typeof primaryBonuses] += value;
              } else if (attr in secondaryBonuses) {
                secondaryBonuses[attr as keyof typeof secondaryBonuses] += value;
              } else if (attr in hpMpBonuses) {
                hpMpBonuses[attr as keyof typeof hpMpBonuses] += value;
              }
            }
          }
        }
      }
    }

    // Step 2: Calculate effective primary attributes (base + equipment bonuses)
    // Note: character.strength etc. should be BASE values
    const effectiveStrength = character.strength + primaryBonuses.strength;
    const effectiveAgility = character.agility + primaryBonuses.agility;
    const effectiveWisdom = character.wisdom + primaryBonuses.wisdom;
    const effectiveSkill = character.skill + primaryBonuses.skill;

    // Step 3: Calculate secondary attributes from effective primary attributes
    const calculatedSecondaryAttrs = {
      attack: 10 + effectiveStrength,
      defense: 1 + effectiveStrength + effectiveAgility,
      moveSpeed: 50 + effectiveAgility,
      dodgeRate: 0 + effectiveAgility * 0.5,
      critRate: 5 + effectiveSkill * 0.5,
      critDamage: 125, // Fixed base value
      resistance: 0 + effectiveWisdom * 0.5,
      magicPower: 0 + effectiveWisdom,
      carryWeight: 10 + effectiveStrength,
      accuracy: 100 + effectiveSkill * 0.5,
      hpRegen: 1 + effectiveStrength * 0.2,
      mpRegen: 10 + effectiveWisdom * 0.2,
      weight: 50 + effectiveStrength,
      volume: 100  // Base volume
    };

    // Step 4: Add direct secondary attribute bonuses from equipment
    character.attack = calculatedSecondaryAttrs.attack + secondaryBonuses.attack;
    character.defense = calculatedSecondaryAttrs.defense + secondaryBonuses.defense;
    character.moveSpeed = calculatedSecondaryAttrs.moveSpeed + secondaryBonuses.moveSpeed;
    character.dodgeRate = calculatedSecondaryAttrs.dodgeRate + secondaryBonuses.dodgeRate;
    character.critRate = calculatedSecondaryAttrs.critRate + secondaryBonuses.critRate;
    character.critDamage = calculatedSecondaryAttrs.critDamage + secondaryBonuses.critDamage;
    character.resistance = calculatedSecondaryAttrs.resistance + secondaryBonuses.resistance;
    character.magicPower = calculatedSecondaryAttrs.magicPower + secondaryBonuses.magicPower;
    character.carryWeight = calculatedSecondaryAttrs.carryWeight + secondaryBonuses.carryWeight;
    character.accuracy = calculatedSecondaryAttrs.accuracy + secondaryBonuses.accuracy;
    character.expRate = 100; // Reset expRate to base before passive skill re-application
    // Round hpRegen and mpRegen to 1 decimal place
    character.hpRegen = Math.round((calculatedSecondaryAttrs.hpRegen + secondaryBonuses.hpRegen) * 10) / 10;
    character.mpRegen = Math.round((calculatedSecondaryAttrs.mpRegen + secondaryBonuses.mpRegen) * 10) / 10;
    character.weight = calculatedSecondaryAttrs.weight + secondaryBonuses.weight;
    character.volume = calculatedSecondaryAttrs.volume + secondaryBonuses.volume;

    // Step 5: Calculate max HP and MP
    const attributeHPBonus = effectiveStrength + effectiveAgility + effectiveWisdom + effectiveSkill;
    character.maxHP = 100 + attributeHPBonus + (character.level - 1) * 10 + hpMpBonuses.maxHP;
    character.maxMP = 100 + hpMpBonuses.maxMP;

    // Step 6: Re-apply passive skill effects on top of recalculated stats
    this.npcSystem.applyPassiveSkillEffects(character);
    
    console.log(`[GameUI] Recalculated attributes for ${character.name}:`, {
      primaryBonuses,
      effectivePrimary: { strength: effectiveStrength, agility: effectiveAgility, wisdom: effectiveWisdom, skill: effectiveSkill },
      secondaryBonuses,
      finalSecondary: { attack: character.attack, defense: character.defense, maxHP: character.maxHP }
    });
  }

  private equipItemToCharacter(characterId: string, slotType: string, itemId: string | null): void {
    this.hideEquipmentTooltip();
    const character = this.npcSystem.getRecruitedCharacter(characterId) || this.npcSystem.getNPC(characterId);
    if (!character) return;

    // Initialize equippedItems if not present
    if (!character.equippedItems) {
      character.equippedItems = { weapon: null, armor: null, offhand: null, accessory: null };
    }

    const slot = slotType as keyof typeof character.equippedItems;
    const previousItem = character.equippedItems[slot];

    if (itemId) {
      // Check if item is already equipped by another character
      const equippedByCharacter = this.equippedItemsTracker.get(itemId);
      if (equippedByCharacter && equippedByCharacter !== characterId) {
        console.error(`[GameUI] Item ${itemId} is already equipped by another character (${equippedByCharacter})`);
        return;
      }

      // Remove previous item from tracker
      if (previousItem) {
        this.equippedItemsTracker.delete(previousItem);
      }
      
      // Update the slot in character data
      character.equippedItems[slot] = itemId;
      
      // Track the equipped item
      this.equippedItemsTracker.set(itemId, characterId);
      
      // Emit quest event for equipment equip
      this.eventSystem.emit({ type: 'quest:equipment_equip', timestamp: Date.now(), characterId, slotType, itemId });
      
      console.log(`[GameUI] Equipped ${slotType} for ${character.name}: ${previousItem} -> ${itemId}`);
    } else {
      // Remove from tracker
      if (previousItem) {
        this.equippedItemsTracker.delete(previousItem);
      }
      
      // Update the slot in character data
      character.equippedItems[slot] = null;
      
      console.log(`[GameUI] Unequipped ${slotType} for ${character.name}: ${previousItem} -> null`);
    }

    // Recalculate all attributes after equipment change
    // This will recalculate secondary attributes from primary attributes
    // and add back all equipment bonuses
    this.recalculateSecondaryAttributes(character);
  }

  /**
   * Apply or remove equipment stat bonuses to/from a character
   * @param character - The character NPCData
   * @param equippedId - The instanceId or itemId of the equipment
   * @param apply - true to add bonuses, false to remove
   */
  private applyEquipmentBonuses(character: NPCData, equippedId: string, apply: boolean): void {
    const itemData = this.resolveEquippedItemData(equippedId);
    if (!itemData) return;

    const sign = apply ? 1 : -1;

    // Apply mainAttribute (string like "攻击力+5" or "防御力+2，最大生命值+10")
    if (itemData.mainAttribute) {
      const bonuses = this.parseMainAttribute(itemData.mainAttribute);
      for (const bonus of bonuses) {
        this.applyStatBonus(character, bonus.attr, bonus.value * sign);
      }
    }

    // Apply mainStat (object format from affix system)
    if (itemData.mainStat) {
      this.applyStatBonus(character, itemData.mainStat.attribute, itemData.mainStat.value * sign);
    }

    // Apply subStats
    if (itemData.subStats && Array.isArray(itemData.subStats)) {
      for (const sub of itemData.subStats) {
        this.applyStatBonus(character, sub.attribute, sub.value * sign);
      }
    }

    // Apply affixes (副词条 from crafting)
    const equipAffixes = normalizeAffixes(itemData.appliedAffix);
    for (const a of equipAffixes) {
      this.applyStatBonus(character, a.type, a.value * sign);
    }
  }

  /**
   * Parse a mainAttribute string like "攻击力+5" or "防御力+2，最大生命值+10"
   * Returns array of { attr: string, value: number }
   */
  private parseMainAttribute(mainAttr: string): Array<{ attr: string; value: number }> {
    const chineseToKey: Record<string, string> = {
      '攻击力': 'attack', '防御力': 'defense', '最大生命值': 'maxHP', '生命值': 'maxHP',
      '最大魔法值': 'maxMP', '魔法值': 'maxMP', '力量': 'strength', '敏捷': 'agility',
      '智慧': 'wisdom', '技巧': 'skill', '暴击率': 'critRate', '暴击伤害': 'critDamage',
      '闪避率': 'dodgeRate', '移动速度': 'moveSpeed', '魔法强度': 'magicPower',
      '抗性': 'resistance', '负重': 'carryWeight', '命中率': 'accuracy',
      '经验加成': 'expRate', '生命回复': 'hpRegen', '魔法回复': 'mpRegen'
    };

    const results: Array<{ attr: string; value: number }> = [];
    // Split by Chinese comma or regular comma
    const parts = mainAttr.split(/[，,]/);
    for (const part of parts) {
      // Match patterns like "攻击力+5" or "攻击力+5%"
      const match = part.trim().match(/(.+?)([+-])(\d+(?:\.\d+)?)/);
      if (match) {
        const chineseName = match[1].trim();
        const sign = match[2] === '+' ? 1 : -1;
        const value = parseFloat(match[3]) * sign;
        const attrKey = chineseToKey[chineseName];
        if (attrKey) {
          results.push({ attr: attrKey, value });
        }
      }
    }
    return results;
  }

  /**
   * Apply a single stat bonus to a character
   */
  private applyStatBonus(character: NPCData, attr: string, value: number): void {
    // Map attribute keys to NPCData fields
    const attrMap: Record<string, keyof NPCData> = {
      attack: 'attack', defense: 'defense', moveSpeed: 'moveSpeed',
      dodgeRate: 'dodgeRate', critRate: 'critRate', critDamage: 'critDamage',
      resistance: 'resistance', magicPower: 'magicPower', carryWeight: 'carryWeight',
      accuracy: 'accuracy', expRate: 'expRate', hpRegen: 'hpRegen', mpRegen: 'mpRegen',
      strength: 'strength', agility: 'agility', wisdom: 'wisdom', skill: 'skill',
      weight: 'weight', volume: 'volume',
      maxHP: 'maxHP', maxMP: 'maxMP',
      hitRate: 'accuracy', experienceRate: 'expRate',
      hp: 'maxHP', mp: 'maxMP',
      bodyWeight: 'weight', bodySize: 'volume'
    };

    const field = attrMap[attr];
    if (field && typeof (character as any)[field] === 'number') {
      (character as any)[field] = Math.max(0, (character as any)[field] + value);
    }
  }

  /**
   * Get attribute display name in Chinese
   */
  private getAttributeDisplayName(attribute: string): string {
    const names: Record<string, string> = {
      attack: '攻击力', defense: '防御力', health: '生命值', mana: '魔法值',
      strength: '力量', agility: '敏捷', wisdom: '智慧', technique: '技巧',
      skill: '技巧', critRate: '暴击率', critDamage: '暴击伤害', dodgeRate: '闪避率',
      moveSpeed: '移动速度', expRate: '经验加成', experienceRate: '经验加成',
      hitRate: '命中率', resistance: '抗性', magicPower: '魔法强度',
      carryWeight: '负重', hpRegen: '生命回复', mpRegen: '魔法回复',
      bodyWeight: '体重', bodySize: '体型'
    };
    return names[attribute] || attribute;
  }

  /**
   * Render a single equipment slot HTML for the character detail panel
   */
  private renderEquipSlotHtml(npcData: any, slotType: string, label: string): string {
    const equippedId = npcData.equippedItems?.[slotType] || null;
    
    // Resolve equippedId: it could be an instanceId or an itemId
    let itemData: any = null;
    if (equippedId) {
      // Try direct item lookup first
      itemData = this.itemSystem.getItem(equippedId);
      if (!itemData) {
        // It's likely an instanceId - look up the instance to get the real itemId
        const instances = this.itemSystem.getAllItemInstances();
        const instance = instances.find(inst => inst.instanceId === equippedId);
        if (instance) {
          itemData = this.itemSystem.getItem(instance.itemId);
        }
      }
    }
    
    const hasItem = !!itemData;
    const rarityColors = ['#888', '#3498db', '#9b59b6', '#e67e22'];
    const rarityNames = ['普通', '稀有', '史诗', '传说'];
    const rarityColor = hasItem ? (rarityColors[itemData!.rarity] || '#888') : '#666';
    const rarityName = hasItem ? (rarityNames[itemData!.rarity] || '普通') : '';

    // Determine equipment type display
    let typeDisplay = '';
    if (hasItem) {
      const sub = itemData!.subType || itemData!.equipmentSlot;
      if (Array.isArray(sub)) {
        typeDisplay = sub.filter((s: string) => s !== '装备').join(' ');
      } else {
        const typeMap: Record<string, string> = { weapon: '武器', armor: '护甲', offhand: '副手', accessory: '杂项', misc: '杂项' };
        typeDisplay = typeMap[sub] || sub || '';
      }
    }

    if (!hasItem) {
      return `<div id="equip-slot-${slotType}-${npcData.id}" class="equipment-slot-clickable" data-slot="${slotType}" style="padding: 8px; background: #f0f0f0; border: 2px dashed #ccc; border-radius: 6px; text-align: center; font-size: 10px; color: #666; cursor: pointer; transition: all 0.2s;">
        <div>${label}</div>
        <div style="margin-top: 4px;">空</div>
      </div>`;
    }

    // Build icon HTML
    let iconHtml = '';
    if (itemData!.icon && (itemData!.icon.includes('.png') || itemData!.icon.includes('.jpg'))) {
      iconHtml = `<img src="${itemData!.icon}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;border:1px solid ${rarityColor};">`;
    } else {
      iconHtml = `<div style="width:32px;height:32px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;background:rgba(0,0,0,0.05);border:1px solid ${rarityColor};">${itemData!.icon || '📦'}</div>`;
    }

    return `<div id="equip-slot-${slotType}-${npcData.id}" class="equipment-slot-clickable" data-slot="${slotType}" style="padding: 6px; background: #e8f5e9; border: 2px solid ${rarityColor}; border-radius: 6px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px;">
      <div style="flex-shrink:0;">${iconHtml}</div>
      <div style="flex:1;min-width:0;overflow:hidden;">
        <div style="font-size:11px;font-weight:bold;color:${rarityColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${itemData!.name}</div>
        <div style="font-size:9px;color:#999;margin-top:1px;">${typeDisplay} · <span style="color:${rarityColor};">${rarityName}</span></div>
      </div>
    </div>`;
  }

  /**
   * Resolve an equipped ID (which may be an instanceId) to item data
   */
  private resolveEquippedItemData(equippedId: string | null): any {
    if (!equippedId) return null;
    let itemData = this.itemSystem.getItem(equippedId);
    if (!itemData) {
      const instances = this.itemSystem.getAllItemInstances();
      const inst = instances.find(i => i.instanceId === equippedId);
      if (inst) {
        itemData = this.itemSystem.getItem(inst.itemId);
        if (itemData && inst.instanceData?.affix) {
          // Keep affix as a separate field instead of spreading (which would overwrite type/rarity)
          itemData = { ...itemData, appliedAffix: inst.instanceData.affix } as any;
        }
      }
    }
    return itemData || null;
  }

  /**
   * Show equipment tooltip near the slot element
   */
  private showEquipmentTooltip(slotEl: HTMLElement, itemData: any): void {
    this.hideEquipmentTooltip();

    const rarityColors = ['#888', '#3498db', '#9b59b6', '#e67e22'];
    const rarityNames = ['普通', '稀有', '史诗', '传说'];
    const rarityColor = rarityColors[itemData.rarity] || '#888';
    const rarityName = rarityNames[itemData.rarity] || '普通';

    // Equipment type
    let typeDisplay = '';
    const sub = itemData.subType || itemData.equipmentSlot;
    if (Array.isArray(sub)) {
      typeDisplay = sub.filter((s: string) => s !== '装备').join(' · ');
    } else {
      const typeMap: Record<string, string> = { weapon: '武器', armor: '护甲', offhand: '副手', accessory: '杂项', misc: '杂项' };
      typeDisplay = typeMap[sub] || sub || '装备';
    }

    // Icon
    let iconHtml = '';
    if (itemData.icon && (itemData.icon.includes('.png') || itemData.icon.includes('.jpg'))) {
      iconHtml = `<img src="${itemData.icon}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:2px solid ${rarityColor};">`;
    } else {
      iconHtml = `<div style="width:48px;height:48px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;background:rgba(0,0,0,0.05);border:2px solid ${rarityColor};">${itemData.icon || '📦'}</div>`;
    }

    // Main stat
    let mainStatHtml = '';
    if (itemData.mainAttribute) {
      mainStatHtml = `<div style="color:#e67e22;font-size:12px;font-weight:bold;">🔸 ${itemData.mainAttribute}</div>`;
    } else if (itemData.mainStat) {
      const val = itemData.mainStat.type === 'percentage' ? `+${itemData.mainStat.value}%` : `+${itemData.mainStat.value}`;
      mainStatHtml = `<div style="color:#e67e22;font-size:12px;font-weight:bold;">🔸 ${this.getAttributeDisplayName(itemData.mainStat.attribute)} ${val}</div>`;
    }

    // Sub stats
    let subStatsHtml = '';
    if (itemData.secondaryAttributes && itemData.secondaryAttributes.length > 0) {
      subStatsHtml = itemData.secondaryAttributes.map((s: string) => `<div style="color:#3498db;font-size:11px;">🔹 ${s}</div>`).join('');
    } else if (itemData.subStats && itemData.subStats.length > 0) {
      subStatsHtml = itemData.subStats.map((s: any) => {
        const val = s.type === 'percentage' ? `+${s.value}%` : `+${s.value}`;
        return `<div style="color:#3498db;font-size:11px;">🔹 ${this.getAttributeDisplayName(s.attribute)} ${val}</div>`;
      }).join('');
    }

    // Applied affix (from crafting system)
    let affixHtml = '';
    const slotAffixes1 = normalizeAffixes(itemData.appliedAffix);
    if (slotAffixes1.length > 0) {
      const affixRarityColors: Record<number, string> = { 0: '#888', 1: '#3498db', 2: '#9b59b6', 3: '#e67e22' };
      affixHtml = slotAffixes1.map((a: any) => {
        const affixColor = affixRarityColors[a.rarity] || '#9b59b6';
        const affixText = formatAffixDisplayWithRange(a);
        return `<div style="color:#fff;font-size:11px;font-weight:bold;text-shadow: -1px -1px 0 ${affixColor}, 1px -1px 0 ${affixColor}, -1px 1px 0 ${affixColor}, 1px 1px 0 ${affixColor};">✦ ${affixText}</div>`;
      }).join('');
    }

    // Description
    const descHtml = itemData.description ? `<div style="color:#666;font-size:11px;font-style:italic;margin-top:4px;">${itemData.description}</div>` : '';

    // Sell price
    const priceHtml = itemData.buyPrice != null ? `<div style="color:#888;font-size:11px;margin-top:6px;border-top:1px solid #eee;padding-top:4px;">💰 价值: ${itemData.buyPrice} 金币</div>` : '';

    // Hunger restore for food items
    const hungerHtml = itemData.type === 'food' && itemData.hungerRestore ? `<div style="color:#66bb6a;font-size:11px;">🍖 饱腹度+${itemData.hungerRestore}</div>` : '';

    const tooltip = document.createElement('div');
    tooltip.id = 'equipment-slot-tooltip';
    tooltip.style.cssText = `
      position: fixed; z-index: 20000; background: #fff; border: 2px solid ${rarityColor};
      border-radius: 10px; padding: 12px; width: 240px; box-shadow: 0 6px 24px rgba(0,0,0,0.25);
      pointer-events: none;
    `;
    tooltip.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
        ${iconHtml}
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:bold;color:${rarityColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${itemData.name}</div>
          <div style="font-size:11px;color:#999;">${typeDisplay} · <span style="color:${rarityColor};">${rarityName}</span></div>
        </div>
      </div>
      ${mainStatHtml}
      ${subStatsHtml}
      ${affixHtml}
      ${descHtml}
      ${priceHtml}
      ${hungerHtml}
    `;

    document.body.appendChild(tooltip);

    // Position near the slot element
    const rect = slotEl.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let left = rect.right + 8;
    let top = rect.top;

    // Keep within viewport
    if (left + tooltipRect.width > window.innerWidth) {
      left = rect.left - tooltipRect.width - 8;
    }
    if (top + tooltipRect.height > window.innerHeight) {
      top = window.innerHeight - tooltipRect.height - 8;
    }
    if (top < 0) top = 8;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  /**
   * Hide equipment tooltip
   */
  private hideEquipmentTooltip(): void {
    const existing = document.getElementById('equipment-slot-tooltip');
    if (existing) existing.remove();
  }

  /**
   * Show tooltip for stall items with detailed information
   */
  private showStallItemTooltip(slotEl: HTMLElement, itemData: any, affix: any, price: number): void {
    this.hideEquipmentTooltip();

    const rarityColors = ['#888', '#3498db', '#9b59b6', '#e67e22'];
    const rarityNames = ['普通', '稀有', '史诗', '传说'];
    const rarityColor = rarityColors[itemData.rarity] || '#888';
    const rarityName = rarityNames[itemData.rarity] || '普通';

    // Equipment type
    let typeDisplay = '';
    if (itemData.type === 'equipment') {
      const sub = itemData.subType || itemData.equipmentSlot;
      if (Array.isArray(sub)) {
        typeDisplay = sub.filter((s: string) => s !== '装备').join(' · ');
      } else {
        const typeMap: Record<string, string> = { weapon: '武器', armor: '护甲', offhand: '副手', accessory: '杂项', misc: '杂项' };
        typeDisplay = typeMap[sub] || sub || '装备';
      }
    } else {
      // Material or other types
      const typeMap: Record<string, string> = { material: '材料', food: '食物', book: '书籍', consumable: '消耗品' };
      typeDisplay = typeMap[itemData.type] || itemData.type || '物品';
    }

    // Icon
    let iconHtml = '';
    if (itemData.icon && (itemData.icon.includes('.png') || itemData.icon.includes('.jpg'))) {
      iconHtml = `<img src="${itemData.icon}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:2px solid ${rarityColor};">`;
    } else {
      iconHtml = `<div style="width:48px;height:48px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;background:rgba(0,0,0,0.05);border:2px solid ${rarityColor};">${itemData.icon || '📦'}</div>`;
    }

    // Main stat (for equipment)
    let mainStatHtml = '';
    if (itemData.type === 'equipment') {
      if (itemData.mainAttribute) {
        mainStatHtml = `<div style="color:#e67e22;font-size:12px;font-weight:bold;">🔸 ${itemData.mainAttribute}</div>`;
      } else if (itemData.mainStat) {
        const val = itemData.mainStat.type === 'percentage' ? `+${itemData.mainStat.value}%` : `+${itemData.mainStat.value}`;
        mainStatHtml = `<div style="color:#e67e22;font-size:12px;font-weight:bold;">🔸 ${this.getAttributeDisplayName(itemData.mainStat.attribute)} ${val}</div>`;
      }
    }

    // Sub stats (for equipment)
    let subStatsHtml = '';
    if (itemData.type === 'equipment') {
      if (itemData.secondaryAttributes && itemData.secondaryAttributes.length > 0) {
        subStatsHtml = itemData.secondaryAttributes.map((s: string) => `<div style="color:#3498db;font-size:11px;">🔹 ${s}</div>`).join('');
      } else if (itemData.subStats && itemData.subStats.length > 0) {
        subStatsHtml = itemData.subStats.map((s: any) => {
          const val = s.type === 'percentage' ? `+${s.value}%` : `+${s.value}`;
          return `<div style="color:#3498db;font-size:11px;">🔹 ${this.getAttributeDisplayName(s.attribute)} ${val}</div>`;
        }).join('');
      }
    }

    // Applied affix (for equipment)
    let affixHtml = '';
    const slotAffixes2 = normalizeAffixes(affix);
    if (slotAffixes2.length > 0) {
      const affixRarityColors: Record<number, string> = { 0: '#888', 1: '#3498db', 2: '#9b59b6', 3: '#e67e22' };
      affixHtml = slotAffixes2.map((a: any) => {
        const affixColor = affixRarityColors[a.rarity] || '#9b59b6';
        const affixText = formatAffixDisplayWithRange(a);
        return `<div style="color:#fff;font-size:11px;font-weight:bold;text-shadow: -1px -1px 0 ${affixColor}, 1px -1px 0 ${affixColor}, -1px 1px 0 ${affixColor}, 1px 1px 0 ${affixColor};">✦ ${affixText}</div>`;
      }).join('');
    }

    // Description
    const descHtml = itemData.description ? `<div style="color:#666;font-size:11px;font-style:italic;margin-top:4px;">${itemData.description}</div>` : '';

    // Purchase price
    const priceHtml = `<div style="color:#d4a017;font-size:12px;font-weight:bold;margin-top:6px;border-top:1px solid #eee;padding-top:4px;">💰 购买价格: ${price} 金币</div>`;

    const tooltip = document.createElement('div');
    tooltip.id = 'equipment-slot-tooltip';
    tooltip.style.cssText = `
      position: fixed; z-index: 20000; background: #fff; border: 2px solid ${rarityColor};
      border-radius: 10px; padding: 12px; width: 240px; box-shadow: 0 6px 24px rgba(0,0,0,0.25);
      pointer-events: none;
    `;
    tooltip.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
        ${iconHtml}
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:bold;color:${rarityColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${itemData.name}</div>
          <div style="font-size:11px;color:#999;">${typeDisplay} · <span style="color:${rarityColor};">${rarityName}</span></div>
        </div>
      </div>
      ${mainStatHtml}
      ${subStatsHtml}
      ${affixHtml}
      ${descHtml}
      ${priceHtml}
    `;

    document.body.appendChild(tooltip);

    // Position near the slot element
    const rect = slotEl.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let left = rect.right + 8;
    let top = rect.top;

    // Keep within viewport
    if (left + tooltipRect.width > window.innerWidth) {
      left = rect.left - tooltipRect.width - 8;
    }
    if (top + tooltipRect.height > window.innerHeight) {
      top = window.innerHeight - tooltipRect.height - 8;
    }
    if (top < 0) top = 8;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  /**
   * Filter inventory items by type
   * @param items - Array of inventory slots to filter
   * @param filterType - Type to filter by ('all', 'material', 'food', 'book', 'equipment', 'consumable')
   * @returns Filtered array of inventory slots
   */
  private filterItems(items: any[], filterType: string): any[] {
    // Validate input
    if (!Array.isArray(items)) {
      throw new TypeError('items must be an array');
    }
    
    // If filter is 'all', return all items
    if (filterType === 'all') {
      return items;
    }
    
    // Filter items by type
    return items.filter(slot => {
      const itemData = this.itemSystem.getItem(slot.itemId);
      return itemData && itemData.type === filterType;
    });
  }

  /**
   * Filter items by equipment slot type
   * @param items - Array of inventory slots to filter
   * @param equipmentSlot - Equipment slot type to filter by ('weapon', 'armor', 'offhand', 'accessory')
   * @returns Filtered array of inventory slots matching the equipment slot
   */
  private filterItemsByEquipmentSlot(items: any[], equipmentSlot: string): any[] {
    // Mapping from English slot names to Chinese subType names used in equipment-recipes.json
    const slotToChinese: Record<string, string> = {
      weapon: '武器',
      armor: '护甲',
      offhand: '副手',
      accessory: '杂项'
    };
    const chineseName = slotToChinese[equipmentSlot];

    return items.filter(slot => {
      const itemData = this.itemSystem.getItem(slot.itemId);
      if (!itemData || itemData.type !== 'equipment') {
        return false;
      }
      
      // Check equipmentSlot field first, then fall back to subType
      const itemSlot = itemData.equipmentSlot || itemData.subType;
      
      // Handle array subType (e.g. ["装备", "武器"] from crafted equipment)
      if (Array.isArray(itemSlot)) {
        if (chineseName && itemSlot.includes(chineseName)) return true;
        if (equipmentSlot === 'accessory' && (itemSlot.includes('杂项') || itemSlot.includes('饰品') || itemSlot.includes('misc'))) return true;
        return itemSlot.includes(equipmentSlot);
      }
      
      // Handle string subType
      if (equipmentSlot === 'accessory') {
        return itemSlot === 'accessory' || itemSlot === 'misc' || itemSlot === '杂项' || itemSlot === '饰品';
      }
      
      return itemSlot === equipmentSlot || itemSlot === chineseName;
    });
  }

  /**
   * Paginate items by slicing the array based on page number
   * @param items - Array of items to paginate
   * @param page - Page number (0-based)
   * @param itemsPerPage - Number of items per page
   * @returns Sliced array for the specified page
   */
  private paginateItems(items: any[], page: number, itemsPerPage: number): any[] {
    // Validate input
    if (!Array.isArray(items)) {
      throw new TypeError('items must be an array');
    }
    
    const startIndex = page * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  /**
   * Calculate total number of pages based on item count
   * @param itemCount - Total number of items
   * @param itemsPerPage - Number of items per page
   * @returns Total number of pages (at least 1)
   */
  private calculateTotalPages(itemCount: number, itemsPerPage: number): number {
    // Ensure total pages is at least 1
    return Math.max(1, Math.ceil(itemCount / itemsPerPage));
  }

  /**
   * Adjust current page if it exceeds the total pages
   * @param totalPages - Total number of pages
   */
  private adjustCurrentPage(totalPages: number): void {
    // If current page exceeds total pages, adjust to last page
    if (this.currentPage >= totalPages) {
      this.currentPage = Math.max(0, totalPages - 1);
    }
  }

  private renderItemGrid(contentArea: HTMLElement, equipmentSlotFilter?: string): void {
    // Get container width and calculate grid columns
    const containerWidth = contentArea.getBoundingClientRect().width;
    const columns = this.calculateGridColumns(containerWidth);
    const itemsPerPage = this.calculateItemsPerPage(columns);
    
    // Update current state
    this.currentColumns = columns;
    this.currentItemsPerPage = itemsPerPage;
    
    // Create wrapper for item grid and controls
    const itemGridWrapper = document.createElement('div');
    itemGridWrapper.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
    `;

    // Create item grid container with fixed columns
    const itemGridContainer = document.createElement('div');
    itemGridContainer.style.cssText = `
      flex: 1;
      display: grid;
      grid-template-columns: repeat(${columns}, 1fr);
      gap: 12px;
      align-content: start;
      margin-top: 10px;
      padding-bottom: 60px;
    `;

    // Get inventory items
    const inventory = this.itemSystem.getInventory();
    
    // Apply filtering
    let filteredItems = this.filterItems(inventory, this.currentFilter);
    
    // Apply equipment slot filter if provided
    if (equipmentSlotFilter) {
      filteredItems = this.filterItemsByEquipmentSlot(filteredItems, equipmentSlotFilter);
    }
    
    // Apply pagination with dynamic items per page
    const totalPages = this.calculateTotalPages(filteredItems.length, this.currentItemsPerPage);
    
    // Adjust current page if it exceeds total pages
    this.adjustCurrentPage(totalPages);
    
    const paginatedItems = this.paginateItems(filteredItems, this.currentPage, this.currentItemsPerPage);

    if (filteredItems.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.style.cssText = `
        grid-column: 1 / -1;
        text-align: center;
        padding: 60px 20px;
      `;
      emptyState.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
        <div style="font-size: 18px; margin-bottom: 8px; color: white; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">暂无物品</div>
        <div style="font-size: 14px; color: white; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">完成任务获取物品吧！</div>
      `;
      itemGridContainer.appendChild(emptyState);
      
      // Clear action panel
      this.updateActionPanel('');
    } else {
      paginatedItems.forEach(slot => {
        const itemData = this.itemSystem.getItem(slot.itemId);
        if (itemData) {
          // Merge slot data (including affix) with itemData
          // Affix is stored in instanceData.affix for non-stackable items
          const affix = slot.instanceData?.affix;
          const itemWithAffix = { ...itemData, affix };
          const itemCard = this.createItemCard(itemWithAffix, slot.quantity, slot);
          itemGridContainer.appendChild(itemCard);
        }
      });
      
      // Show first item details by default
      const firstItem = paginatedItems[0];
      const firstItemData = this.itemSystem.getItem(firstItem.itemId);
      if (firstItemData) {
        // Merge slot data (including affix) with itemData
        // Affix is stored in instanceData.affix for non-stackable items
        const affix = firstItem.instanceData?.affix;
        const itemWithAffix = { ...firstItemData, affix };
        this.showItemDetailsInPanel(itemWithAffix, firstItem.quantity);
      }
    }

    // Create filter tabs container (bottom-left)
    const filterTabsContainer = document.createElement('div');
    filterTabsContainer.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 0;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    `;

    // Define filter tabs
    const filterTabs = [
      { type: 'all', label: '全部' },
      { type: 'material', label: '材料' },
      { type: 'food', label: '菜肴' },
      { type: 'book', label: '书' },
      { type: 'equipment', label: '装备' },
      { type: 'consumable', label: '消耗品' },
      { type: 'special', label: '特殊' }
    ];

    // Create filter tab buttons
    filterTabs.forEach(tab => {
      const filterButton = document.createElement('button');
      filterButton.textContent = tab.label;
      filterButton.style.cssText = `
        padding: 6px 12px;
        background: ${this.currentFilter === tab.type ? 'rgba(102, 126, 234, 0.8)' : 'rgba(255, 255, 255, 0.6)'};
        border: none;
        border-radius: 6px;
        color: ${this.currentFilter === tab.type ? 'white' : '#333'};
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
      `;

      // Add hover effect
      filterButton.addEventListener('mouseenter', () => {
        if (this.currentFilter !== tab.type) {
          filterButton.style.background = 'rgba(255, 255, 255, 0.8)';
        }
      });

      filterButton.addEventListener('mouseleave', () => {
        if (this.currentFilter !== tab.type) {
          filterButton.style.background = 'rgba(255, 255, 255, 0.6)';
        }
      });

      // Add click handler
      filterButton.addEventListener('click', () => {
        // Update filter state
        this.currentFilter = tab.type;
        
        // Reset page to 0
        this.currentPage = 0;
        
        // Re-render item grid
        while (contentArea.children.length > 1) {
          contentArea.removeChild(contentArea.lastChild!);
        }
        this.renderItemGrid(contentArea);
      });

      filterTabsContainer.appendChild(filterButton);
    });

    // Create pagination controls container (bottom-right)
    const paginationContainer = document.createElement('div');
    paginationContainer.style.cssText = `
      position: absolute;
      bottom: 10px;
      right: 0;
      display: ${filteredItems.length > 0 ? 'flex' : 'none'};
      gap: 12px;
      align-items: center;
    `;

    // Previous button
    const prevButton = document.createElement('button');
    prevButton.textContent = '上一页';
    prevButton.disabled = this.currentPage === 0;
    prevButton.style.cssText = `
      padding: 6px 12px;
      background: ${this.currentPage === 0 ? 'rgba(100, 100, 100, 0.5)' : 'rgba(102, 126, 234, 0.8)'};
      border: none;
      border-radius: 6px;
      color: ${this.currentPage === 0 ? '#666' : 'white'};
      font-size: 12px;
      font-weight: bold;
      cursor: ${this.currentPage === 0 ? 'not-allowed' : 'pointer'};
      transition: all 0.2s;
    `;

    prevButton.addEventListener('click', () => {
      if (this.currentPage > 0) {
        this.currentPage--;
        
        // Re-render item grid
        while (contentArea.children.length > 1) {
          contentArea.removeChild(contentArea.lastChild!);
        }
        this.renderItemGrid(contentArea);
      }
    });

    // Page indicator
    const pageIndicator = document.createElement('div');
    pageIndicator.textContent = `${this.currentPage + 1}/${totalPages}`;
    pageIndicator.style.cssText = `
      color: white;
      font-size: 12px;
      font-weight: bold;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    // Next button
    const nextButton = document.createElement('button');
    nextButton.textContent = '下一页';
    nextButton.disabled = this.currentPage >= totalPages - 1;
    nextButton.style.cssText = `
      padding: 6px 12px;
      background: ${this.currentPage >= totalPages - 1 ? 'rgba(100, 100, 100, 0.5)' : 'rgba(102, 126, 234, 0.8)'};
      border: none;
      border-radius: 6px;
      color: ${this.currentPage >= totalPages - 1 ? '#666' : 'white'};
      font-size: 12px;
      font-weight: bold;
      cursor: ${this.currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer'};
      transition: all 0.2s;
    `;

    nextButton.addEventListener('click', () => {
      if (this.currentPage < totalPages - 1) {
        this.currentPage++;
        
        // Re-render item grid
        while (contentArea.children.length > 1) {
          contentArea.removeChild(contentArea.lastChild!);
        }
        this.renderItemGrid(contentArea);
      }
    });

    paginationContainer.appendChild(prevButton);
    paginationContainer.appendChild(pageIndicator);
    paginationContainer.appendChild(nextButton);

    // Assemble the components
    itemGridWrapper.appendChild(itemGridContainer);
    itemGridWrapper.appendChild(filterTabsContainer);
    itemGridWrapper.appendChild(paginationContainer);
    
    contentArea.appendChild(itemGridWrapper);
    
    // Setup resize observer to handle responsive layout
    this.setupResizeObserver(contentArea, contentArea);
  }

  private renderCookingPanel(contentArea: HTMLElement): void {
    // Create cooking panel container - full width for recipe grid only
    const cookingContainer = document.createElement('div');
    cookingContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      margin-top: 10px;
      min-height: 0;
    `;

    const recipeTitle = document.createElement('h3');
    recipeTitle.textContent = '配方列表';
    recipeTitle.style.cssText = `
      margin: 0 0 12px 0;
      color: white;
      font-size: 16px;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    const recipeGrid = document.createElement('div');
    recipeGrid.style.cssText = `
      flex: 1;
      overflow-y: auto;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 12px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 12px;
      align-content: start;
    `;

    cookingContainer.appendChild(recipeTitle);
    cookingContainer.appendChild(recipeGrid);

    // Render recipes - details will show in action panel
    this.renderRecipes(recipeGrid);

    contentArea.appendChild(cookingContainer);
  }

  private renderRecipes(recipeGrid: HTMLElement): void {
    const recipes = this.cookingSystem.getAllRecipes().filter((r: any) => !this.lockedRecipes.has(r.id));

    if (recipes.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.style.cssText = `
        grid-column: 1 / -1;
        text-align: center;
        padding: 60px 20px;
      `;
      emptyState.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">🍳</div>
        <div style="font-size: 18px; margin-bottom: 8px; color: white; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">暂无可用配方</div>
      `;
      recipeGrid.appendChild(emptyState);
      
      // Show empty action panel
      this.updateActionPanel('<div style="text-align: center; color: #666; padding: 40px 20px;">请选择一个配方</div>');
      return;
    }

    let selectedRecipe: any = null;

    recipes.forEach(recipe => {
      const recipeCard = document.createElement('div');
      recipeCard.style.cssText = `
        background: rgba(255, 255, 255, 1);
        border: none;
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      `;

      // Icon container with rounded square background
      const iconContainer = document.createElement('div');
      iconContainer.style.cssText = `
        width: 64px;
        height: 64px;
        background: rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      `;

      // Recipe icon - fill container
      const icon = document.createElement('img');
      icon.src = recipe.icon;
      icon.alt = recipe.name;
      icon.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 8px;
      `;

      iconContainer.appendChild(icon);

      // Recipe name
      const name = document.createElement('div');
      name.textContent = recipe.name;
      name.style.cssText = `
        color: #333;
        font-size: 12px;
        font-weight: bold;
        text-align: center;
        word-break: break-word;
      `;

      // Rarity indicator
      const rarityBadge = document.createElement('div');
      // recipe.rarity is already a number, no need to convert
      const rarityNumber = recipe.rarity;
      rarityBadge.textContent = this.itemSystem.getRarityName(rarityNumber);
      const rarityBgColor = this.itemSystem.getRarityColor(rarityNumber);
      rarityBadge.style.cssText = `
        background: ${rarityBgColor};
        color: white;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: bold;
        text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
      `;

      recipeCard.appendChild(iconContainer);
      recipeCard.appendChild(name);
      recipeCard.appendChild(rarityBadge);

      // Hover effects
      recipeCard.addEventListener('mouseenter', () => {
        recipeCard.style.background = 'rgba(255, 255, 255, 1)';
        recipeCard.style.transform = 'translateY(-2px)';
        recipeCard.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
      });

      recipeCard.addEventListener('mouseleave', () => {
        if (selectedRecipe !== recipe) {
          recipeCard.style.background = 'rgba(255, 255, 255, 1)';
          recipeCard.style.transform = 'translateY(0)';
          recipeCard.style.boxShadow = 'none';
        }
      });

      // Click handler for recipe selection - show in action panel
      recipeCard.addEventListener('click', () => {
        // Remove previous selection
        recipeGrid.querySelectorAll('div').forEach(card => {
          if (card !== recipeGrid && card.style.cursor === 'pointer') {
            card.style.boxShadow = 'none';
          }
        });

        // Highlight selected card
        const rarityNumber = recipe.rarity;
        recipeCard.style.boxShadow = `0 0 12px ${this.itemSystem.getRarityColor(rarityNumber)}`;

        selectedRecipe = recipe;
        this.renderRecipeDetailsInActionPanel(recipe);
      });

      recipeGrid.appendChild(recipeCard);
    });

    // Show first recipe details by default
    if (recipes.length > 0) {
      selectedRecipe = recipes[0];
      this.renderRecipeDetailsInActionPanel(selectedRecipe);
    }
  }

  private renderRecipeDetailsInActionPanel(recipe: any): void {
    const actionPanel = document.getElementById('action-panel');
    if (!actionPanel) return;

    actionPanel.innerHTML = '';
    actionPanel.style.cssText = `
      width: 490px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 16px;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    // Recipe header with icon and name
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    `;

    const icon = document.createElement('img');
    icon.src = recipe.icon;
    icon.alt = recipe.name;
    const rarityNumber = recipe.rarity;
    icon.style.cssText = `
      width: 80px;
      height: 80px;
      object-fit: cover;
      border: 2px solid ${this.itemSystem.getRarityColor(rarityNumber)};
      border-radius: 8px;
    `;

    const headerInfo = document.createElement('div');
    headerInfo.style.cssText = `
      flex: 1;
    `;

    const name = document.createElement('div');
    name.textContent = recipe.name;
    name.style.cssText = `
      color: white;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 6px;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    const rarityBadge = document.createElement('div');
    rarityBadge.textContent = this.itemSystem.getRarityName(rarityNumber);
    rarityBadge.style.cssText = `
      display: inline-block;
      background: ${this.itemSystem.getRarityColor(rarityNumber)};
      color: white;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      margin-bottom: 6px;
    `;

    const valuePrice = document.createElement('div');
    valuePrice.textContent = `价值: ${recipe.buyPrice} 金币`;
    valuePrice.style.cssText = `
      color: #ffd700;
      font-size: 14px;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    headerInfo.appendChild(name);
    headerInfo.appendChild(rarityBadge);
    headerInfo.appendChild(valuePrice);

    if (recipe.hungerRestore) {
      const hungerInfo = document.createElement('div');
      hungerInfo.textContent = `🍖 饱腹度+${recipe.hungerRestore}`;
      hungerInfo.style.cssText = `color: #66bb6a; font-size: 14px; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;`;
      headerInfo.appendChild(hungerInfo);
    }

    header.appendChild(icon);
    header.appendChild(headerInfo);

    // Description
    const description = document.createElement('div');
    description.textContent = recipe.description;
    description.style.cssText = `
      color: #333;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 16px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 6px;
    `;

    // Ingredients section
    const ingredientsTitle = document.createElement('h3');
    ingredientsTitle.textContent = '所需材料';
    ingredientsTitle.style.cssText = `
      margin: 0 0 12px 0;
      color: #333;
      font-size: 14px;
    `;

    const ingredientsList = document.createElement('div');
    ingredientsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    `;

    // Check if player can cook
    let canCook = false;
    if (this.playerEntity && this.itemSystem) {
      const validation = this.cookingSystem.validateCooking(this.playerEntity.id, recipe.id);
      canCook = validation.canCook;

      recipe.ingredients.forEach((ingredient: any) => {
        const ingredientItem = document.createElement('div');
        const isMissing = validation.missingIngredients.some((mi: any) => mi.itemId === ingredient.itemId);
        const itemData = this.itemSystem!.getItem(ingredient.itemId);
        
        ingredientItem.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 6px;
          border-left: 3px solid ${isMissing ? '#e74c3c' : '#2ecc71'};
        `;

        // Icon container
        const iconContainer = document.createElement('div');
        iconContainer.style.cssText = `
          width: 48px;
          height: 48px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          margin-right: 12px;
          border: 2px solid ${isMissing ? 'rgba(231, 76, 60, 0.3)' : 'rgba(46, 204, 113, 0.3)'};
          flex-shrink: 0;
        `;

        // Load icon image
        if (itemData && itemData.icon) {
          const icon = document.createElement('img');
          icon.src = itemData.icon;
          icon.alt = itemData.name || ingredient.itemId;
          icon.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
          `;
          icon.onerror = () => {
            iconContainer.textContent = '📦';
            iconContainer.style.fontSize = '24px';
          };
          iconContainer.appendChild(icon);
        } else {
          iconContainer.textContent = '📦';
          iconContainer.style.fontSize = '24px';
        }

        const ingredientInfo = document.createElement('div');
        ingredientInfo.style.cssText = `
          flex: 1;
        `;

        const ingredientName = document.createElement('div');
        ingredientName.textContent = this.getItemName(ingredient.itemId);
        ingredientName.style.cssText = `
          color: #333;
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 4px;
        `;

        const ingredientQuantity = document.createElement('div');
        const playerQuantity = this.itemSystem!.getItemQuantity(ingredient.itemId);
        ingredientQuantity.textContent = `需要: ${ingredient.quantity} (拥有: ${playerQuantity})`;
        ingredientQuantity.style.cssText = `
          color: #666;
          font-size: 11px;
        `;

        ingredientInfo.appendChild(ingredientName);
        ingredientInfo.appendChild(ingredientQuantity);

        // Availability indicator
        const indicator = document.createElement('div');
        indicator.textContent = isMissing ? '✗' : '✓';
        indicator.style.cssText = `
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${isMissing ? '#e74c3c' : '#2ecc71'};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          flex-shrink: 0;
        `;

        ingredientItem.appendChild(iconContainer);
        ingredientItem.appendChild(ingredientInfo);
        ingredientItem.appendChild(indicator);

        ingredientsList.appendChild(ingredientItem);
      });
    }

    // Cooking button
    const cookingButton = document.createElement('button');
    cookingButton.textContent = '开始烹饪';
    cookingButton.style.cssText = `
      width: 100%;
      padding: 12px;
      font-size: 16px;
      font-weight: bold;
      background: ${canCook ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#555'};
      border: none;
      border-radius: 8px;
      color: white;
      cursor: ${canCook ? 'pointer' : 'not-allowed'};
      transition: all 0.2s ease;
      opacity: ${canCook ? '1' : '0.5'};
    `;

    if (canCook) {
      cookingButton.addEventListener('mouseenter', () => {
        cookingButton.style.transform = 'translateY(-2px)';
        cookingButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
      });

      cookingButton.addEventListener('mouseleave', () => {
        cookingButton.style.transform = 'translateY(0)';
        cookingButton.style.boxShadow = 'none';
      });

      cookingButton.addEventListener('click', () => {
        if (this.playerEntity) {
          // Start cooking with progress bar
          this.startCookingWithProgress(recipe, cookingButton, actionPanel);
        }
      });
    } else {
      cookingButton.disabled = true;
    }

    // Assemble action panel
    actionPanel.appendChild(header);
    actionPanel.appendChild(description);
    actionPanel.appendChild(ingredientsTitle);
    actionPanel.appendChild(ingredientsList);
    actionPanel.appendChild(cookingButton);
  }

  /**
   * Get cooking duration based on rarity
   */
  private getCookingDuration(rarity: number): number {
    const durations = [5000, 8000, 15000, 25000]; // milliseconds: 普通5s, 稀有8s, 神话15s, 传说25s
    return durations[rarity] || 5000;
  }

  /**
   * Start cooking with progress bar in action panel
   */
  private startCookingWithProgress(recipe: any, cookingButton: HTMLButtonElement, actionPanel: HTMLElement): void {
    if (!this.playerEntity) return;

    // Validate cooking before starting
    const validation = this.cookingSystem.validateCooking(this.playerEntity.id, recipe.id);
    if (!validation.canCook) {
      this.showNotification('材料不足，无法烹饪！', 'error');
      return;
    }

    // Disable cooking button
    cookingButton.disabled = true;
    cookingButton.textContent = '烹饪中...';
    cookingButton.style.opacity = '0.5';
    cookingButton.style.cursor = 'not-allowed';

    // Create progress container
    const progressContainer = document.createElement('div');
    progressContainer.id = 'cooking-progress-container';
    progressContainer.style.cssText = `
      margin-top: 16px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      border: 2px solid rgba(102, 126, 234, 0.3);
    `;

    // Progress label
    const progressLabel = document.createElement('div');
    progressLabel.textContent = '烹饪进度';
    progressLabel.style.cssText = `
      color: #333;
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 8px;
    `;

    // Progress bar background
    const progressBarBg = document.createElement('div');
    progressBarBg.style.cssText = `
      width: 100%;
      height: 24px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      margin-bottom: 12px;
    `;

    // Progress bar fill
    const progressBarFill = document.createElement('div');
    progressBarFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      transition: width 0.1s linear;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Progress percentage text
    const progressText = document.createElement('div');
    progressText.textContent = '0%';
    progressText.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #333;
      font-size: 12px;
      font-weight: bold;
      z-index: 1;
    `;

    progressBarBg.appendChild(progressBarFill);
    progressBarBg.appendChild(progressText);

    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消烹饪';
    cancelButton.style.cssText = `
      width: 100%;
      padding: 10px;
      font-size: 14px;
      font-weight: bold;
      background: #e74c3c;
      border: none;
      border-radius: 6px;
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = '#c0392b';
    });

    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = '#e74c3c';
    });

    progressContainer.appendChild(progressLabel);
    progressContainer.appendChild(progressBarBg);
    progressContainer.appendChild(cancelButton);

    // Insert progress container after cooking button
    cookingButton.parentElement?.insertBefore(progressContainer, cookingButton.nextSibling);

    // Start progress animation
    const duration = this.getCookingDuration(recipe.rarity);
    const startTime = Date.now();
    let cancelled = false;

    const updateProgress = () => {
      if (cancelled) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);

      progressBarFill.style.width = `${progress}%`;
      progressText.textContent = `${Math.floor(progress)}%`;

      if (progress >= 100) {
        // Cooking complete
        this.completeCooking(recipe, cookingButton, progressContainer);
      } else {
        requestAnimationFrame(updateProgress);
      }
    };

    // Cancel button handler
    cancelButton.addEventListener('click', () => {
      cancelled = true;
      this.cancelCooking(cookingButton, progressContainer);
    });

    requestAnimationFrame(updateProgress);
  }

  /**
   * Start cooking with progress bar in details panel
   */
  private startCookingWithProgressInDetailsPanel(recipe: any, cookingButton: HTMLButtonElement, detailsPanel: HTMLElement): void {
    if (!this.playerEntity) return;

    // Validate cooking before starting
    const validation = this.cookingSystem.validateCooking(this.playerEntity.id, recipe.id);
    if (!validation.canCook) {
      this.showNotification('材料不足，无法烹饪！', 'error');
      return;
    }

    // Disable cooking button
    cookingButton.disabled = true;
    cookingButton.textContent = '烹饪中...';
    cookingButton.style.opacity = '0.5';
    cookingButton.style.cursor = 'not-allowed';

    // Create progress container
    const progressContainer = document.createElement('div');
    progressContainer.id = 'cooking-progress-container';
    progressContainer.style.cssText = `
      margin-top: 16px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      border: 2px solid rgba(102, 126, 234, 0.3);
    `;

    // Progress label
    const progressLabel = document.createElement('div');
    progressLabel.textContent = '烹饪进度';
    progressLabel.style.cssText = `
      color: white;
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 8px;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    // Progress bar background
    const progressBarBg = document.createElement('div');
    progressBarBg.style.cssText = `
      width: 100%;
      height: 24px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      margin-bottom: 12px;
    `;

    // Progress bar fill
    const progressBarFill = document.createElement('div');
    progressBarFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      transition: width 0.1s linear;
    `;

    // Progress percentage text
    const progressText = document.createElement('div');
    progressText.textContent = '0%';
    progressText.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 12px;
      font-weight: bold;
      z-index: 1;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    progressBarBg.appendChild(progressBarFill);
    progressBarBg.appendChild(progressText);

    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消烹饪';
    cancelButton.style.cssText = `
      width: 100%;
      padding: 10px;
      font-size: 14px;
      font-weight: bold;
      background: #e74c3c;
      border: none;
      border-radius: 6px;
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = '#c0392b';
    });

    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = '#e74c3c';
    });

    progressContainer.appendChild(progressLabel);
    progressContainer.appendChild(progressBarBg);
    progressContainer.appendChild(cancelButton);

    // Insert progress container after cooking button
    cookingButton.parentElement?.insertBefore(progressContainer, cookingButton.nextSibling);

    // Start progress animation
    const duration = this.getCookingDuration(recipe.rarity);
    const startTime = Date.now();
    let cancelled = false;

    const updateProgress = () => {
      if (cancelled) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);

      progressBarFill.style.width = `${progress}%`;
      progressText.textContent = `${Math.floor(progress)}%`;

      if (progress >= 100) {
        // Cooking complete
        this.completeCookingInDetailsPanel(recipe, cookingButton, progressContainer, detailsPanel);
      } else {
        requestAnimationFrame(updateProgress);
      }
    };

    // Cancel button handler
    cancelButton.addEventListener('click', () => {
      cancelled = true;
      this.cancelCookingInDetailsPanel(cookingButton, progressContainer);
    });

    requestAnimationFrame(updateProgress);
  }

  /**
   * Complete cooking and consume materials
   */
  private completeCooking(recipe: any, cookingButton: HTMLButtonElement, progressContainer: HTMLElement): void {
    if (!this.playerEntity) return;

    // Actually cook the dish
    const result = this.cookingSystem.cook(this.playerEntity.id, recipe.id);
    
    if (result.success) {
      this.showNotification(`烹饪成功！获得 ${recipe.name}`, 'success');
      
      // Emit quest event for cooking completion
      this.eventSystem.emit({ type: 'quest:craft_completed', recipeId: recipe.id, craftType: 'cooking', timestamp: Date.now() });
      
      // Remove progress container
      progressContainer.remove();
      
      // Re-enable cooking button
      cookingButton.disabled = false;
      cookingButton.textContent = '开始烹饪';
      cookingButton.style.opacity = '1';
      cookingButton.style.cursor = 'pointer';
      
      // Refresh the recipe details to update ingredient quantities
      this.renderRecipeDetailsInActionPanel(recipe);
    } else {
      this.showNotification(result.message, 'error');
      
      // Remove progress container
      progressContainer.remove();
      
      // Re-enable cooking button
      cookingButton.disabled = false;
      cookingButton.textContent = '开始烹饪';
      cookingButton.style.opacity = '1';
      cookingButton.style.cursor = 'pointer';
    }
  }

  /**
   * Complete cooking in details panel
   */
  private completeCookingInDetailsPanel(recipe: any, cookingButton: HTMLButtonElement, progressContainer: HTMLElement, detailsPanel: HTMLElement): void {
    if (!this.playerEntity) return;

    // Actually cook the dish
    const result = this.cookingSystem.cook(this.playerEntity.id, recipe.id);
    
    if (result.success) {
      this.showNotification(`烹饪成功！获得 ${recipe.name}`, 'success');
      
      // Emit quest event for cooking completion
      this.eventSystem.emit({ type: 'quest:craft_completed', recipeId: recipe.id, craftType: 'cooking', timestamp: Date.now() });
      
      // Remove progress container
      progressContainer.remove();
      
      // Re-enable cooking button
      cookingButton.disabled = false;
      cookingButton.textContent = '开始烹饪';
      cookingButton.style.opacity = '1';
      cookingButton.style.cursor = 'pointer';
      
      // Refresh the recipe details to update ingredient quantities
      this.renderRecipeDetails(detailsPanel, recipe);
    } else {
      this.showNotification(result.message, 'error');
      
      // Remove progress container
      progressContainer.remove();
      
      // Re-enable cooking button
      cookingButton.disabled = false;
      cookingButton.textContent = '开始烹饪';
      cookingButton.style.opacity = '1';
      cookingButton.style.cursor = 'pointer';
    }
  }

  /**
   * Cancel cooking
   */
  private cancelCooking(cookingButton: HTMLButtonElement, progressContainer: HTMLElement): void {
    this.showNotification('已取消烹饪', 'warning');
    
    // Remove progress container
    progressContainer.remove();
    
    // Re-enable cooking button
    cookingButton.disabled = false;
    cookingButton.textContent = '开始烹饪';
    cookingButton.style.opacity = '1';
    cookingButton.style.cursor = 'pointer';
  }

  /**
   * Cancel cooking in details panel
   */
  private cancelCookingInDetailsPanel(cookingButton: HTMLButtonElement, progressContainer: HTMLElement): void {
    this.showNotification('已取消烹饪', 'warning');
    
    // Remove progress container
    progressContainer.remove();
    
    // Re-enable cooking button
    cookingButton.disabled = false;
    cookingButton.textContent = '开始烹饪';
    cookingButton.style.opacity = '1';
    cookingButton.style.cursor = 'pointer';
  }

  /**
   * Start alchemy crafting with progress bar
   */
  private startAlchemyCraftingWithProgress(recipe: any, craftingButton: HTMLButtonElement, actionPanel: HTMLElement): void {
    if (!this.playerEntity) return;

    // Check if player can craft
    if (!this.alchemyCraftingSystem.canCraft(recipe.id)) {
      this.showNotification('材料不足，无法制作！', 'error');
      return;
    }

    // Start crafting in the system
    if (!this.alchemyCraftingSystem.startCrafting(recipe.id)) {
      this.showNotification('制作失败！', 'error');
      return;
    }

    // Disable crafting button
    craftingButton.disabled = true;
    craftingButton.textContent = '制作中...';
    craftingButton.style.opacity = '0.5';
    craftingButton.style.cursor = 'not-allowed';

    // Create progress container
    const progressContainer = document.createElement('div');
    progressContainer.id = 'alchemy-progress-container';
    progressContainer.style.cssText = `
      margin-top: 16px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      border: 2px solid rgba(155, 89, 182, 0.3);
    `;

    // Progress label
    const progressLabel = document.createElement('div');
    progressLabel.textContent = '制作进度';
    progressLabel.style.cssText = `
      color: #333;
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 8px;
    `;

    // Progress bar background
    const progressBarBg = document.createElement('div');
    progressBarBg.style.cssText = `
      width: 100%;
      height: 24px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      margin-bottom: 12px;
    `;

    // Progress bar fill
    const progressBarFill = document.createElement('div');
    progressBarFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #9b59b6 0%, #8e44ad 100%);
      border-radius: 12px;
      transition: width 0.1s linear;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Progress percentage text
    const progressText = document.createElement('div');
    progressText.textContent = '0%';
    progressText.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #333;
      font-size: 12px;
      font-weight: bold;
      z-index: 1;
    `;

    progressBarBg.appendChild(progressBarFill);
    progressBarBg.appendChild(progressText);

    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消制作';
    cancelButton.style.cssText = `
      width: 100%;
      padding: 10px;
      font-size: 14px;
      font-weight: bold;
      background: #e74c3c;
      border: none;
      border-radius: 6px;
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = '#c0392b';
    });

    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = '#e74c3c';
    });

    progressContainer.appendChild(progressLabel);
    progressContainer.appendChild(progressBarBg);
    progressContainer.appendChild(cancelButton);

    // Insert progress container after crafting button
    craftingButton.parentElement?.insertBefore(progressContainer, craftingButton.nextSibling);

    // Start progress animation
    let cancelled = false;

    const updateProgress = () => {
      if (cancelled) return;

      const progress = this.alchemyCraftingSystem.getCraftingProgress();

      progressBarFill.style.width = `${progress}%`;
      progressText.textContent = `${Math.floor(progress)}%`;

      if (progress >= 100) {
        // Crafting complete
        this.completeAlchemyCrafting(recipe, craftingButton, progressContainer);
      } else {
        requestAnimationFrame(updateProgress);
      }
    };

    // Cancel button handler
    cancelButton.addEventListener('click', () => {
      cancelled = true;
      this.cancelAlchemyCrafting(craftingButton, progressContainer);
    });

    requestAnimationFrame(updateProgress);
  }

  /**
   * Complete alchemy crafting and consume materials
   */
  private completeAlchemyCrafting(recipe: any, craftingButton: HTMLButtonElement, progressContainer: HTMLElement): void {
    if (!this.playerEntity) return;

    // Complete the crafting
    const success = this.alchemyCraftingSystem.completeCrafting();
    
    if (success) {
      this.showNotification(`制作成功！获得 ${recipe.name}`, 'success');
      
      // Emit quest event for alchemy crafting completion
      this.eventSystem.emit({ type: 'quest:craft_completed', recipeId: recipe.id, craftType: 'alchemy', timestamp: Date.now() });
      
      // Remove progress container
      progressContainer.remove();
      
      // Re-enable crafting button
      craftingButton.disabled = false;
      craftingButton.textContent = '开始制作';
      craftingButton.style.opacity = '1';
      craftingButton.style.cursor = 'pointer';
      
      // Refresh the recipe details to update material quantities
      this.renderAlchemyCraftingDetails(recipe);
    } else {
      this.showNotification('制作失败！', 'error');
      
      // Remove progress container
      progressContainer.remove();
      
      // Re-enable crafting button
      craftingButton.disabled = false;
      craftingButton.textContent = '开始制作';
      craftingButton.style.opacity = '1';
      craftingButton.style.cursor = 'pointer';
    }
  }

  /**
   * Cancel alchemy crafting
   */
  private cancelAlchemyCrafting(craftingButton: HTMLButtonElement, progressContainer: HTMLElement): void {
    this.showNotification('已取消制作', 'warning');
    
    // Cancel in the system
    this.alchemyCraftingSystem.cancelCrafting();
    
    // Remove progress container
    progressContainer.remove();
    
    // Re-enable crafting button
    craftingButton.disabled = false;
    craftingButton.textContent = '开始制作';
    craftingButton.style.opacity = '1';
    craftingButton.style.cursor = 'pointer';
  }

  /**
   * Show equipment crafting panel in scene
   */
  private showEquipmentCraftingPanel(): void {
    if (!this.sceneContainer) return;

    // Check for blueprint unlocks before showing recipes
    this.checkBlueprintUnlocks();

    // Create crafting panel container
    const craftingContainer = document.createElement('div');
    craftingContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 80px 20px 20px 20px;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3);
      z-index: 100;
      overflow: hidden;
    `;

    // Title
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    `;

    const title = document.createElement('h2');
    title.textContent = '装备制作';
    title.style.cssText = `
      color: white;
      font-size: 24px;
      font-weight: bold;
      margin: 0;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.5);
      border-radius: 8px;
      color: white;
      font-size: 24px;
      font-weight: bold;
      width: 40px;
      height: 40px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(255, 100, 100, 0.8)';
      closeButton.style.transform = 'scale(1.1)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
      closeButton.style.transform = 'scale(1)';
    });

    closeButton.addEventListener('click', () => {
      // Remove only the crafting panel
      craftingContainer.remove();
      // Clear action panel
      const actionPanel = document.getElementById('action-panel');
      if (actionPanel) {
        actionPanel.innerHTML = '';
      }
    });

    titleContainer.appendChild(title);
    titleContainer.appendChild(closeButton);

    // Recipe grid container
    const recipeGrid = document.createElement('div');
    recipeGrid.style.cssText = `
      flex: 1;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 12px;
      align-content: start;
      overflow-y: auto;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 20px;
    `;

    // Get all equipment recipes (filter out locked)
    const recipes = this.equipmentCraftingSystem.getAllRecipes().filter((r: any) => !this.lockedRecipes.has(r.id));

    let selectedRecipe: any = null;

    recipes.forEach(recipe => {
      const recipeCard = document.createElement('div');
      recipeCard.style.cssText = `
        background: rgba(255, 255, 255, 1);
        border: none;
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      `;

      // Icon container
      const iconContainer = document.createElement('div');
      iconContainer.style.cssText = `
        width: 64px;
        height: 64px;
        background: rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      `;

      // Recipe icon
      const icon = document.createElement('img');
      icon.src = recipe.icon;
      icon.alt = recipe.name;
      icon.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 8px;
      `;

      iconContainer.appendChild(icon);

      // Recipe name
      const name = document.createElement('div');
      name.textContent = recipe.name;
      name.style.cssText = `
        color: #333;
        font-size: 12px;
        font-weight: bold;
        text-align: center;
        word-break: break-word;
      `;

      // Rarity indicator
      const rarityBadge = document.createElement('div');
      const rarityNumber = this.convertRarityStringToNumber(recipe.rarity);
      rarityBadge.textContent = this.itemSystem.getRarityName(rarityNumber);
      const rarityBgColor = this.itemSystem.getRarityColor(rarityNumber);
      rarityBadge.style.cssText = `
        background: ${rarityBgColor};
        color: white;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: bold;
        text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
      `;

      recipeCard.appendChild(iconContainer);
      recipeCard.appendChild(name);
      recipeCard.appendChild(rarityBadge);

      // Hover effects
      recipeCard.addEventListener('mouseenter', () => {
        recipeCard.style.background = 'rgba(255, 255, 255, 1)';
        recipeCard.style.transform = 'translateY(-2px)';
        recipeCard.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
      });

      recipeCard.addEventListener('mouseleave', () => {
        if (selectedRecipe !== recipe) {
          recipeCard.style.background = 'rgba(255, 255, 255, 1)';
          recipeCard.style.transform = 'translateY(0)';
          recipeCard.style.boxShadow = 'none';
        }
      });

      // Click handler
      recipeCard.addEventListener('click', () => {
        // Remove previous selection
        recipeGrid.querySelectorAll('div').forEach(card => {
          if (card !== recipeGrid && card.style.cursor === 'pointer') {
            card.style.boxShadow = 'none';
          }
        });

        // Highlight selected card
        const rarityNumber = this.convertRarityStringToNumber(recipe.rarity);
        recipeCard.style.boxShadow = `0 0 12px ${this.itemSystem.getRarityColor(rarityNumber)}`;

        selectedRecipe = recipe;
        this.renderEquipmentCraftingDetails(recipe);
      });

      recipeGrid.appendChild(recipeCard);
    });

    // Show first recipe details by default
    if (recipes.length > 0) {
      selectedRecipe = recipes[0];
      this.renderEquipmentCraftingDetails(selectedRecipe);
    }

    craftingContainer.appendChild(titleContainer);
    craftingContainer.appendChild(recipeGrid);
    this.sceneContainer.appendChild(craftingContainer);
  }

  /**
   * Render equipment crafting details in action panel
   */
  private renderEquipmentCraftingDetails(recipe: any): void {
    const actionPanel = document.getElementById('action-panel');
    if (!actionPanel) return;

    actionPanel.innerHTML = '';
    actionPanel.style.cssText = `
      width: 490px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 16px;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    const rarityNumber = this.convertRarityStringToNumber(recipe.rarity);
    const rarityColor = this.itemSystem.getRarityColor(rarityNumber);
    const rarityName = this.itemSystem.getRarityName(rarityNumber);

    // Recipe header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    `;

    const icon = document.createElement('img');
    icon.src = recipe.icon;
    icon.alt = recipe.name;
    icon.style.cssText = `
      width: 80px;
      height: 80px;
      object-fit: cover;
      border: 2px solid ${rarityColor};
      border-radius: 8px;
    `;

    const headerInfo = document.createElement('div');
    headerInfo.style.cssText = `
      flex: 1;
    `;

    const name = document.createElement('div');
    name.textContent = recipe.name;
    name.style.cssText = `
      color: white;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 6px;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    const rarityBadge = document.createElement('div');
    rarityBadge.textContent = rarityName;
    rarityBadge.style.cssText = `
      display: inline-block;
      background: ${rarityColor};
      color: white;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      margin-bottom: 6px;
    `;

    const typeInfo = document.createElement('div');
    typeInfo.textContent = `类型: ${recipe.type.join(' / ')}`;
    typeInfo.style.cssText = `
      color: #666;
      font-size: 12px;
      margin-bottom: 4px;
    `;

    const valuePrice = document.createElement('div');
    valuePrice.textContent = `价值: ${recipe.buyPrice} 金币`;
    valuePrice.style.cssText = `
      color: #ffd700;
      font-size: 14px;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    headerInfo.appendChild(name);
    headerInfo.appendChild(rarityBadge);
    headerInfo.appendChild(typeInfo);
    headerInfo.appendChild(valuePrice);

    header.appendChild(icon);
    header.appendChild(headerInfo);

    // Description
    const description = document.createElement('div');
    description.textContent = recipe.description;
    description.style.cssText = `
      color: #333;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 16px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 6px;
    `;

    // Main attribute
    const mainAttrDiv = document.createElement('div');
    mainAttrDiv.textContent = `主词条: ${recipe.mainAttribute}`;
    mainAttrDiv.style.cssText = `
      color: #2ecc71;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 16px;
      padding: 10px;
      background: rgba(46, 204, 113, 0.1);
      border-radius: 6px;
      border-left: 3px solid #2ecc71;
    `;

    // Materials section
    const materialsTitle = document.createElement('h3');
    materialsTitle.textContent = '所需材料';
    materialsTitle.style.cssText = `
      margin: 0 0 12px 0;
      color: #333;
      font-size: 14px;
    `;

    const materialsList = document.createElement('div');
    materialsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    `;

    // Check if player can craft
    const canCraft = this.equipmentCraftingSystem.canCraft(recipe.id);

    recipe.materials.forEach((material: any) => {
      const materialItem = document.createElement('div');
      const playerAmount = this.itemSystem.getItemQuantity(material.itemId);
      const isMissing = playerAmount < material.amount;
      const itemData = this.itemSystem.getItem(material.itemId);
      
      materialItem.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 6px;
        border-left: 3px solid ${isMissing ? '#e74c3c' : '#2ecc71'};
      `;

      // Icon container
      const iconContainer = document.createElement('div');
      iconContainer.style.cssText = `
        width: 48px;
        height: 48px;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        margin-right: 12px;
        border: 2px solid ${isMissing ? 'rgba(231, 76, 60, 0.3)' : 'rgba(46, 204, 113, 0.3)'};
        flex-shrink: 0;
      `;

      if (itemData && itemData.icon) {
        const icon = document.createElement('img');
        icon.src = itemData.icon;
        icon.alt = itemData.name || material.itemId;
        icon.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: contain;
        `;
        icon.onerror = () => {
          iconContainer.textContent = '📦';
          iconContainer.style.fontSize = '24px';
        };
        iconContainer.appendChild(icon);
      } else {
        iconContainer.textContent = '📦';
        iconContainer.style.fontSize = '24px';
      }

      const materialInfo = document.createElement('div');
      materialInfo.style.cssText = `
        flex: 1;
      `;

      const materialName = document.createElement('div');
      materialName.textContent = this.getItemName(material.itemId);
      materialName.style.cssText = `
        color: #333;
        font-size: 13px;
        font-weight: bold;
        margin-bottom: 4px;
      `;

      const materialQuantity = document.createElement('div');
      materialQuantity.textContent = `需要: ${material.amount} (拥有: ${playerAmount})`;
      materialQuantity.style.cssText = `
        color: #666;
        font-size: 11px;
      `;

      materialInfo.appendChild(materialName);
      materialInfo.appendChild(materialQuantity);

      // Availability indicator
      const indicator = document.createElement('div');
      indicator.textContent = isMissing ? '✗' : '✓';
      indicator.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: ${isMissing ? '#e74c3c' : '#2ecc71'};
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        flex-shrink: 0;
      `;

      materialItem.appendChild(iconContainer);
      materialItem.appendChild(materialInfo);
      materialItem.appendChild(indicator);

      materialsList.appendChild(materialItem);
    });

    // Crafting button
    const craftingButton = document.createElement('button');
    craftingButton.textContent = '开始制作';
    craftingButton.style.cssText = `
      width: 100%;
      padding: 12px;
      font-size: 16px;
      font-weight: bold;
      background: ${canCraft ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#555'};
      border: none;
      border-radius: 8px;
      color: white;
      cursor: ${canCraft ? 'pointer' : 'not-allowed'};
      transition: all 0.2s ease;
      opacity: ${canCraft ? '1' : '0.5'};
    `;

    if (canCraft) {
      craftingButton.addEventListener('mouseenter', () => {
        craftingButton.style.transform = 'translateY(-2px)';
        craftingButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
      });

      craftingButton.addEventListener('mouseleave', () => {
        craftingButton.style.transform = 'translateY(0)';
        craftingButton.style.boxShadow = 'none';
      });

      craftingButton.addEventListener('click', () => {
        this.startEquipmentCraftingWithProgress(recipe, craftingButton, actionPanel);
      });
    } else {
      craftingButton.disabled = true;
    }

    // Assemble action panel
    actionPanel.appendChild(header);
    actionPanel.appendChild(description);
    actionPanel.appendChild(mainAttrDiv);
    actionPanel.appendChild(materialsTitle);
    actionPanel.appendChild(materialsList);
    actionPanel.appendChild(craftingButton);
  }

  /**
   * Start equipment crafting with progress bar
   */
  private startEquipmentCraftingWithProgress(recipe: any, craftingButton: HTMLButtonElement, actionPanel: HTMLElement): void {
    // Check if can craft
    if (!this.equipmentCraftingSystem.canCraft(recipe.id)) {
      this.showNotification('材料不足，无法制作！', 'error');
      return;
    }

    // Start crafting
    const started = this.equipmentCraftingSystem.startCrafting(recipe.id);
    if (!started) {
      this.showNotification('制作失败！', 'error');
      return;
    }

    // Disable crafting button
    craftingButton.disabled = true;
    craftingButton.textContent = '制作中...';
    craftingButton.style.opacity = '0.5';
    craftingButton.style.cursor = 'not-allowed';

    // Create progress container
    const progressContainer = document.createElement('div');
    progressContainer.id = 'crafting-progress-container';
    progressContainer.style.cssText = `
      margin-top: 16px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      border: 2px solid rgba(102, 126, 234, 0.3);
    `;

    // Progress label
    const progressLabel = document.createElement('div');
    progressLabel.textContent = '制作进度';
    progressLabel.style.cssText = `
      color: #333;
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 8px;
    `;

    // Progress bar background
    const progressBarBg = document.createElement('div');
    progressBarBg.style.cssText = `
      width: 100%;
      height: 24px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      margin-bottom: 12px;
    `;

    // Progress bar fill
    const progressBarFill = document.createElement('div');
    progressBarFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      transition: width 0.1s linear;
    `;

    // Progress percentage text
    const progressText = document.createElement('div');
    progressText.textContent = '0%';
    progressText.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #333;
      font-size: 12px;
      font-weight: bold;
      z-index: 1;
    `;

    progressBarBg.appendChild(progressBarFill);
    progressBarBg.appendChild(progressText);

    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消制作';
    cancelButton.style.cssText = `
      width: 100%;
      padding: 10px;
      font-size: 14px;
      font-weight: bold;
      background: #e74c3c;
      border: none;
      border-radius: 6px;
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = '#c0392b';
    });

    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = '#e74c3c';
    });

    progressContainer.appendChild(progressLabel);
    progressContainer.appendChild(progressBarBg);
    progressContainer.appendChild(cancelButton);

    // Insert progress container after crafting button
    craftingButton.parentElement?.insertBefore(progressContainer, craftingButton.nextSibling);

    // Start progress animation
    let cancelled = false;
    let lastUpdateTime = Date.now();

    const updateProgress = () => {
      if (cancelled) return;

      // Update the crafting system (simulate game loop)
      const currentTime = Date.now();
      const deltaTime = currentTime - lastUpdateTime;
      lastUpdateTime = currentTime;
      this.equipmentCraftingSystem.update(deltaTime);

      const progress = this.equipmentCraftingSystem.getCraftingProgress() * 100;

      progressBarFill.style.width = `${progress}%`;
      progressText.textContent = `${Math.floor(progress)}%`;

      // Check if crafting is still in progress
      if (this.equipmentCraftingSystem.isCrafting()) {
        requestAnimationFrame(updateProgress);
      } else {
        // Crafting complete (system has cleared the state)
        this.completeEquipmentCrafting(recipe, craftingButton, progressContainer);
      }
    };

    // Cancel button handler
    cancelButton.addEventListener('click', () => {
      cancelled = true;
      this.cancelEquipmentCrafting(craftingButton, progressContainer);
    });

    requestAnimationFrame(updateProgress);
  }

  /**
   * Complete equipment crafting
   */
  private completeEquipmentCrafting(recipe: any, craftingButton: HTMLButtonElement, progressContainer: HTMLElement): void {
    this.showNotification(`制作成功！获得 ${recipe.name}`, 'success');
    
    // Emit quest event for equipment crafting completion
    this.eventSystem.emit({ type: 'quest:craft_completed', recipeId: recipe.id, craftType: 'equipment', timestamp: Date.now() });
    
    // Remove progress container
    progressContainer.remove();
    
    // Re-enable crafting button and refresh details
    this.renderEquipmentCraftingDetails(recipe);
  }

  /**
   * Cancel equipment crafting
   */
  private cancelEquipmentCrafting(craftingButton: HTMLButtonElement, progressContainer: HTMLElement): void {
    this.equipmentCraftingSystem.cancelCrafting();
    this.showNotification('已取消制作', 'warning');
    
    // Remove progress container
    progressContainer.remove();
    
    // Re-enable crafting button
    craftingButton.disabled = false;
    craftingButton.textContent = '开始制作';
    craftingButton.style.opacity = '1';
    craftingButton.style.cursor = 'pointer';
  }

  /**
   * Show alchemy crafting panel in scene
   */
  private showAlchemyCraftingPanel(): void {
    if (!this.sceneContainer) return;

    // Create crafting panel container
    const craftingContainer = document.createElement('div');
    craftingContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 80px 20px 20px 20px;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3);
      z-index: 100;
      overflow: hidden;
    `;

    // Title
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    `;

    const title = document.createElement('h2');
    title.textContent = '炼金制作';
    title.style.cssText = `
      color: white;
      font-size: 24px;
      font-weight: bold;
      margin: 0;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.5);
      border-radius: 8px;
      color: white;
      font-size: 24px;
      font-weight: bold;
      width: 40px;
      height: 40px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(255, 100, 100, 0.8)';
      closeButton.style.transform = 'scale(1.1)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
      closeButton.style.transform = 'scale(1)';
    });

    closeButton.addEventListener('click', () => {
      // Remove only the crafting panel
      craftingContainer.remove();
      // Clear action panel
      const actionPanel = document.getElementById('action-panel');
      if (actionPanel) {
        actionPanel.innerHTML = '';
      }
    });

    titleContainer.appendChild(title);
    titleContainer.appendChild(closeButton);

    // Recipe grid container
    const recipeGrid = document.createElement('div');
    recipeGrid.style.cssText = `
      flex: 1;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 12px;
      align-content: start;
      overflow-y: auto;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 20px;
    `;

    // Get all alchemy recipes (filter out locked)
    const recipes = this.alchemyCraftingSystem.getAllRecipes().filter((r: any) => !this.lockedRecipes.has(r.id));

    let selectedRecipe: any = null;

    recipes.forEach(recipe => {
      const recipeCard = document.createElement('div');
      recipeCard.style.cssText = `
        background: rgba(255, 255, 255, 1);
        border: none;
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      `;

      // Icon container
      const iconContainer = document.createElement('div');
      iconContainer.style.cssText = `
        width: 64px;
        height: 64px;
        background: rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      `;

      // Recipe icon
      const icon = document.createElement('img');
      icon.src = recipe.icon;
      icon.alt = recipe.name;
      icon.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 8px;
      `;

      iconContainer.appendChild(icon);

      // Recipe name
      const name = document.createElement('div');
      name.textContent = recipe.name;
      name.style.cssText = `
        color: #333;
        font-size: 12px;
        font-weight: bold;
        text-align: center;
        word-break: break-word;
      `;

      // Rarity indicator
      const rarityBadge = document.createElement('div');
      const rarityNumber = this.convertRarityStringToNumber(recipe.rarity);
      rarityBadge.textContent = this.itemSystem.getRarityName(rarityNumber);
      const rarityBgColor = this.itemSystem.getRarityColor(rarityNumber);
      rarityBadge.style.cssText = `
        background: ${rarityBgColor};
        color: white;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: bold;
        text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
      `;

      recipeCard.appendChild(iconContainer);
      recipeCard.appendChild(name);
      recipeCard.appendChild(rarityBadge);

      // Hover effects
      recipeCard.addEventListener('mouseenter', () => {
        recipeCard.style.background = 'rgba(255, 255, 255, 1)';
        recipeCard.style.transform = 'translateY(-2px)';
        recipeCard.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
      });

      recipeCard.addEventListener('mouseleave', () => {
        if (selectedRecipe !== recipe) {
          recipeCard.style.background = 'rgba(255, 255, 255, 1)';
          recipeCard.style.transform = 'translateY(0)';
          recipeCard.style.boxShadow = 'none';
        }
      });

      // Click handler
      recipeCard.addEventListener('click', () => {
        // Remove previous selection
        recipeGrid.querySelectorAll('div').forEach(card => {
          if (card !== recipeGrid && card.style.cursor === 'pointer') {
            card.style.boxShadow = 'none';
          }
        });

        // Highlight selected card
        const rarityNumber = this.convertRarityStringToNumber(recipe.rarity);
        recipeCard.style.boxShadow = `0 0 12px ${this.itemSystem.getRarityColor(rarityNumber)}`;

        selectedRecipe = recipe;
        this.renderAlchemyCraftingDetails(recipe);
      });

      recipeGrid.appendChild(recipeCard);
    });

    // Show first recipe details by default
    if (recipes.length > 0) {
      selectedRecipe = recipes[0];
      this.renderAlchemyCraftingDetails(selectedRecipe);
    }

    craftingContainer.appendChild(titleContainer);
    craftingContainer.appendChild(recipeGrid);
    this.sceneContainer.appendChild(craftingContainer);
  }

  /**
   * Render alchemy crafting details in action panel
   */
  private renderAlchemyCraftingDetails(recipe: any): void {
    const actionPanel = document.getElementById('action-panel');
    if (!actionPanel) return;

    actionPanel.innerHTML = '';
    actionPanel.style.cssText = `
      width: 490px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 16px;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    const rarityNumber = this.convertRarityStringToNumber(recipe.rarity);
    const rarityColor = this.itemSystem.getRarityColor(rarityNumber);
    const rarityName = this.itemSystem.getRarityName(rarityNumber);

    // Recipe header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    `;

    const icon = document.createElement('img');
    icon.src = recipe.icon;
    icon.alt = recipe.name;
    icon.style.cssText = `
      width: 80px;
      height: 80px;
      object-fit: cover;
      border: 2px solid ${rarityColor};
      border-radius: 8px;
    `;

    const headerInfo = document.createElement('div');
    headerInfo.style.cssText = `
      flex: 1;
    `;

    const name = document.createElement('div');
    name.textContent = recipe.name;
    name.style.cssText = `
      color: white;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 6px;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    const rarityBadge = document.createElement('div');
    rarityBadge.textContent = rarityName;
    rarityBadge.style.cssText = `
      display: inline-block;
      background: ${rarityColor};
      color: white;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      margin-bottom: 6px;
    `;

    const typeInfo = document.createElement('div');
    typeInfo.textContent = `类型: ${recipe.type.join(' / ')}`;
    typeInfo.style.cssText = `
      color: #666;
      font-size: 12px;
      margin-bottom: 4px;
    `;

    const valuePrice = document.createElement('div');
    valuePrice.textContent = `价值: ${recipe.buyPrice} 金币`;
    valuePrice.style.cssText = `
      color: #ffd700;
      font-size: 14px;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    const ownedQuantity = this.itemSystem.getItemQuantity(recipe.id);
    const ownedInfo = document.createElement('div');
    ownedInfo.textContent = `已有数量: ${ownedQuantity}`;
    ownedInfo.style.cssText = `
      color: #666;
      font-size: 12px;
    `;

    headerInfo.appendChild(name);
    headerInfo.appendChild(rarityBadge);
    headerInfo.appendChild(typeInfo);
    headerInfo.appendChild(valuePrice);
    headerInfo.appendChild(ownedInfo);

    header.appendChild(icon);
    header.appendChild(headerInfo);

    // Description
    const description = document.createElement('div');
    description.textContent = recipe.description;
    description.style.cssText = `
      color: #333;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 16px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 6px;
    `;

    // Materials section
    const materialsTitle = document.createElement('h3');
    materialsTitle.textContent = '所需材料';
    materialsTitle.style.cssText = `
      margin: 0 0 12px 0;
      color: #333;
      font-size: 14px;
    `;

    const materialsList = document.createElement('div');
    materialsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    `;

    // Check if player can craft
    const canCraft = this.alchemyCraftingSystem.canCraft(recipe.id);

    recipe.materials.forEach((material: any) => {
      const materialItem = document.createElement('div');
      const playerAmount = this.itemSystem.getItemQuantity(material.itemId);
      const isMissing = playerAmount < material.amount;
      const itemData = this.itemSystem.getItem(material.itemId);
      
      materialItem.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 6px;
        border-left: 3px solid ${isMissing ? '#e74c3c' : '#2ecc71'};
      `;

      // Icon container
      const iconContainer = document.createElement('div');
      iconContainer.style.cssText = `
        width: 48px;
        height: 48px;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        margin-right: 12px;
        border: 2px solid ${isMissing ? 'rgba(231, 76, 60, 0.3)' : 'rgba(46, 204, 113, 0.3)'};
        flex-shrink: 0;
      `;

      if (itemData && itemData.icon) {
        const icon = document.createElement('img');
        icon.src = itemData.icon;
        icon.alt = itemData.name || material.itemId;
        icon.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: contain;
        `;
        icon.onerror = () => {
          iconContainer.textContent = '🧪';
          iconContainer.style.fontSize = '24px';
        };
        iconContainer.appendChild(icon);
      } else {
        iconContainer.textContent = '🧪';
        iconContainer.style.fontSize = '24px';
      }

      const materialInfo = document.createElement('div');
      materialInfo.style.cssText = `
        flex: 1;
      `;

      const materialName = document.createElement('div');
      materialName.textContent = this.getItemName(material.itemId);
      materialName.style.cssText = `
        color: #333;
        font-size: 13px;
        font-weight: bold;
        margin-bottom: 4px;
      `;

      const materialQuantity = document.createElement('div');
      materialQuantity.textContent = `需要: ${material.amount} (拥有: ${playerAmount})`;
      materialQuantity.style.cssText = `
        color: #666;
        font-size: 11px;
      `;

      materialInfo.appendChild(materialName);
      materialInfo.appendChild(materialQuantity);

      // Availability indicator
      const indicator = document.createElement('div');
      indicator.textContent = isMissing ? '✗' : '✓';
      indicator.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: ${isMissing ? '#e74c3c' : '#2ecc71'};
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        flex-shrink: 0;
      `;

      materialItem.appendChild(iconContainer);
      materialItem.appendChild(materialInfo);
      materialItem.appendChild(indicator);

      materialsList.appendChild(materialItem);
    });

    // Crafting button
    const craftingButton = document.createElement('button');
    craftingButton.textContent = '开始制作';
    craftingButton.style.cssText = `
      width: 100%;
      padding: 12px;
      font-size: 16px;
      font-weight: bold;
      background: ${canCraft ? 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)' : '#555'};
      border: none;
      border-radius: 8px;
      color: white;
      cursor: ${canCraft ? 'pointer' : 'not-allowed'};
      transition: all 0.2s ease;
      opacity: ${canCraft ? '1' : '0.5'};
    `;

    if (canCraft) {
      craftingButton.addEventListener('mouseenter', () => {
        craftingButton.style.transform = 'translateY(-2px)';
        craftingButton.style.boxShadow = '0 4px 12px rgba(155, 89, 182, 0.4)';
      });

      craftingButton.addEventListener('mouseleave', () => {
        craftingButton.style.transform = 'translateY(0)';
        craftingButton.style.boxShadow = 'none';
      });

      craftingButton.addEventListener('click', () => {
        if (this.playerEntity) {
          // Start crafting with progress bar
          this.startAlchemyCraftingWithProgress(recipe, craftingButton, actionPanel);
        }
      });
    } else {
      craftingButton.disabled = true;
    }

    // Assemble action panel
    actionPanel.appendChild(header);
    actionPanel.appendChild(description);
    actionPanel.appendChild(materialsTitle);
    actionPanel.appendChild(materialsList);
    actionPanel.appendChild(craftingButton);
  }

  /**
   * Show summoning panel for summoner Kaoezi (similar to alchemy crafting panel)
   */
  /**
   * Toggle disabled state for all buttons in the action panel
   */
  private setActionPanelButtonsDisabled(disabled: boolean): void {
    const actionPanel = document.getElementById('action-panel');
    if (!actionPanel) return;
    const buttons = actionPanel.querySelectorAll('button');
    buttons.forEach(btn => {
      (btn as HTMLButtonElement).disabled = disabled;
      (btn as HTMLButtonElement).style.opacity = disabled ? '0.5' : '1';
      (btn as HTMLButtonElement).style.pointerEvents = disabled ? 'none' : 'auto';
    });
  }

  /**
   * Card exchange recipes for scholar Xiaomei
   */
  private readonly cardExchangeRecipes = [
    { cardId: 'card_tianjiang_slime', name: '甜浆史莱姆', cost: { gold: 5000, items: [{ id: 'slime_sweet_pearl', name: '史莱姆甜珠', qty: 50 }, { id: 'sweet_syrup_gland', name: '甜浆腺体', qty: 20 }] } },
    { cardId: 'card_juxing_caoguchong', name: '巨型草菇虫', cost: { gold: 5000, items: [{ id: 'mystic_mushroom', name: '迷香菇', qty: 50 }, { id: 'grass_mushroom_worm_thin_wing', name: '草菇虫薄翼', qty: 20 }] } },
    { cardId: 'card_shidi_shuangtoushe', name: '湿地双头蛇', cost: { gold: 5000, items: [{ id: 'smooth_snake_skin', name: '光滑蛇皮', qty: 50 }, { id: 'two_headed_snake_liver', name: '双头蛇肝', qty: 20 }] } },
    { cardId: 'card_chizong', name: '赤鬃', cost: { gold: 5000, items: [{ id: 'red_mane_fang', name: '赤鬃獠牙', qty: 10 }, { id: 'red_mane_fur', name: '赤鬃毛皮', qty: 5 }] } },
    { cardId: 'card_kugenkui', name: '苦根葵', cost: { gold: 5000, items: [{ id: 'bitter_root', name: '苦根', qty: 50 }, { id: 'bitter_juice', name: '苦汁', qty: 20 }] } },
    { cardId: 'card_lanzhizhu', name: '蓝芝蛛', cost: { gold: 5000, items: [{ id: 'blue_spider_front_leg', name: '蓝芝蛛前腿', qty: 50 }, { id: 'blue_cheese_ball', name: '幽蓝芝士球', qty: 20 }] } },
    { cardId: 'card_yanshiguai', name: '盐石怪', cost: { gold: 5000, items: [{ id: 'coarse_salt_block', name: '粗盐块', qty: 50 }, { id: 'salt_stone_crystal', name: '盐石结晶', qty: 20 }] } },
    { cardId: 'card_huke', name: '胡克', cost: { gold: 5000, items: [{ id: 'huke_leg_bone', name: '胡克腿骨', qty: 10 }, { id: 'huke_curved_fang', name: '胡克弯牙', qty: 5 }] } },
    { cardId: 'card_kulougua', name: '骷髅瓜', cost: { gold: 5000, items: [{ id: 'corpse_potato', name: '尸薯', qty: 50 }, { id: 'three_color_eyeball', name: '三色眼珠', qty: 20 }] } },
    { cardId: 'card_huoshewa', name: '火舌蛙', cost: { gold: 5000, items: [{ id: 'fire_tongue_frog_leg', name: '火舌蛙腿', qty: 50 }, { id: 'spicy_tongue', name: '火辣舌', qty: 20 }] } },
    { cardId: 'card_juchiteng', name: '巨齿藤', cost: { gold: 5000, items: [{ id: 'twitching_vine_core', name: '抽搐的藤芯', qty: 50 }, { id: 'beating_gallbladder', name: '跳动的胆囊', qty: 20 }] } },
    { cardId: 'card_youling_xiyi', name: '幽灵蜥蜴', cost: { gold: 5000, items: [{ id: 'ghost_lizard_skin', name: '幽灵蜥蜴皮', qty: 10 }, { id: 'ghost_lizard_sucker', name: '幽灵蜥蜴吸盘', qty: 5 }] } },
  ];

  /**
   * Show card exchange panel for scholar Xiaomei
   */
  private showCardExchangePanel(): void {
    if (!this.sceneContainer) return;

    // Reconstruct exchangedCards from card system (persistence across sessions)
    this.cardExchangeRecipes.forEach(recipe => {
      if (this.cardSystem.ownsCard(recipe.cardId)) {
        this.exchangedCards.add(recipe.cardId);
      }
    });

    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; padding: 80px 20px 20px 20px;
      box-sizing: border-box; background: rgba(0, 0, 0, 0.3); z-index: 100; overflow: hidden;
    `;

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
    const title = document.createElement('h2');
    title.textContent = '🎴 卡牌兑换';
    title.style.cssText = 'color: white; font-size: 24px; font-weight: bold; margin: 0; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.5); border-radius: 8px;
      color: white; font-size: 24px; font-weight: bold; width: 40px; height: 40px; cursor: pointer;
      transition: all 0.2s; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
      display: flex; align-items: center; justify-content: center; padding: 0;
    `;
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(255,100,100,0.8)'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'rgba(255,255,255,0.2)'; });
    closeBtn.addEventListener('click', () => { container.remove(); });
    titleBar.appendChild(title);
    titleBar.appendChild(closeBtn);

    // Grid
    const grid = document.createElement('div');
    grid.style.cssText = `
      flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px; align-content: start; overflow-y: auto;
      background: rgba(255,255,255,0.2); border-radius: 12px; padding: 20px;
    `;

    const refreshGrid = () => {
      grid.innerHTML = '';
      this.cardExchangeRecipes.forEach(recipe => {
        const card = this.cardSystem.getCard(recipe.cardId);
        if (!card) return;
        const alreadyExchanged = this.exchangedCards.has(recipe.cardId);
        const hasGold = this.getPlayerGold() >= recipe.cost.gold;
        const hasItems = recipe.cost.items.every(item => this.itemSystem.getItemQuantity(item.id) >= item.qty);
        const canExchange = !alreadyExchanged && hasGold && hasItems;

        const cardEl = document.createElement('div');
        cardEl.style.cssText = `
          background: ${alreadyExchanged ? 'rgba(100,100,100,0.6)' : 'rgba(255,255,255,0.9)'};
          border-radius: 10px; padding: 10px; cursor: ${alreadyExchanged ? 'default' : 'pointer'};
          transition: all 0.2s; border: 2px solid ${alreadyExchanged ? '#666' : canExchange ? '#4caf50' : '#ccc'};
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          ${alreadyExchanged ? 'opacity: 0.5;' : ''}
        `;

        // Card image wrapper (for overlay text)
        const imgWrapper = document.createElement('div');
        imgWrapper.style.cssText = 'position: relative; width: 100%; max-width: 120px;';
        const img = document.createElement('img');
        img.src = card.image;
        const meetsRequirements = alreadyExchanged || (hasGold && hasItems);
        img.style.cssText = `width: 100%; border-radius: 12px; aspect-ratio: 3/5; object-fit: cover; transition: filter 0.3s, opacity 0.3s; box-shadow: 4px 6px 12px rgba(0,0,0,0.3); ${!meetsRequirements ? 'filter: saturate(0) blur(2px); opacity: 0.7;' : ''}`;
        imgWrapper.appendChild(img);
        if (!meetsRequirements) {
          const overlay = document.createElement('div');
          overlay.textContent = '未达需求';
          overlay.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 14px; font-weight: bold; text-shadow: 0 0 6px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9); pointer-events: none; white-space: nowrap;';
          imgWrapper.appendChild(overlay);
        }
        cardEl.appendChild(imgWrapper);

        // Name
        const nameEl = document.createElement('div');
        nameEl.textContent = alreadyExchanged ? `${card.name} ✓` : card.name;
        nameEl.style.cssText = `font-size: 13px; font-weight: bold; color: ${alreadyExchanged ? '#999' : '#333'}; text-align: center;`;
        cardEl.appendChild(nameEl);

        // Cost summary
        const costEl = document.createElement('div');
        costEl.style.cssText = 'font-size: 11px; color: #666; text-align: center; line-height: 1.4;';
        const goldColor = hasGold ? '#333' : '#dc3545';
        let costHtml = `<span style="color: ${goldColor};">💰 ${recipe.cost.gold}</span><br>`;
        recipe.cost.items.forEach(item => {
          const owned = this.itemSystem.getItemQuantity(item.id);
          const enough = owned >= item.qty;
          costHtml += `<span style="color: ${enough ? '#333' : '#dc3545'};">${item.name} ${owned}/${item.qty}</span><br>`;
        });
        costEl.innerHTML = costHtml;
        cardEl.appendChild(costEl);

        if (!alreadyExchanged) {
          cardEl.addEventListener('mouseenter', () => { cardEl.style.transform = 'translateY(-3px)'; cardEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'; });
          cardEl.addEventListener('mouseleave', () => { cardEl.style.transform = ''; cardEl.style.boxShadow = ''; });
          cardEl.addEventListener('click', () => {
            if (!canExchange) {
              this.showNotification('材料或金币不足，无法兑换', 'warning');
              return;
            }
            // Deduct cost
            this.currencySystem.spendCurrency(this.world, this.playerEntity!.id, { gold: recipe.cost.gold }, `卡牌兑换: ${card.name}`);
            recipe.cost.items.forEach(item => { this.itemSystem.removeItem(item.id, item.qty); });
            // Add card
            this.cardSystem.addCard(recipe.cardId);
            this.exchangedCards.add(recipe.cardId);
            this.updateCurrencyDisplay();
            this.showNotification(`🎴 成功兑换卡牌「${card.name}」`, 'success');
            refreshGrid();
          });
        }

        grid.appendChild(cardEl);
      });
    };

    refreshGrid();
    container.appendChild(titleBar);
    container.appendChild(grid);
    this.sceneContainer.appendChild(container);
  }

  /**
   * Show summoning panel for summoner Kaoezi (similar to alchemy crafting panel)
   */
  private showSummoningPanel(): void {
    if (!this.sceneContainer) return;

    // Get otherworld characters from config
    let otherworldCharacters: OtherworldCharacterConfig[] = [];
    try {
      const configManager = ConfigManager.getInstance();
      if (!configManager.isInitialized()) {
        this.showNotification('配置未加载', 'error');
        return;
      }
      otherworldCharacters = configManager.getOtherworldCharacters().filter(char =>
        char.characterTypes && char.characterTypes.includes('异界')
      );
    } catch (error) {
      this.showNotification('获取异界角色配置失败', 'error');
      return;
    }

    // Disable action panel buttons
    this.setActionPanelButtonsDisabled(true);

    // Create panel container
    const panelContainer = document.createElement('div');
    panelContainer.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column;
      padding: 80px 20px 20px 20px;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3);
      z-index: 100;
      overflow: hidden;
    `;

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;`;

    const title = document.createElement('h2');
    title.textContent = '🔮 异界召唤';
    title.style.cssText = `color: white; font-size: 24px; font-weight: bold; margin: 0; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;`;

    // Track active progress interval for cleanup
    let activeProgressInterval: number | null = null;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.5); border-radius: 8px; color: white; font-size: 24px; font-weight: bold; width: 40px; height: 40px; cursor: pointer; transition: all 0.2s; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; display: flex; align-items: center; justify-content: center; padding: 0;`;
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(255,100,100,0.8)'; closeBtn.style.transform = 'scale(1.1)'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'rgba(255,255,255,0.2)'; closeBtn.style.transform = 'scale(1)'; });
    closeBtn.addEventListener('click', () => {
      // Clear any active progress interval
      if (activeProgressInterval !== null) {
        clearInterval(activeProgressInterval);
        activeProgressInterval = null;
      }
      panelContainer.remove();
      this.setActionPanelButtonsDisabled(false);
    });

    titleBar.appendChild(title);
    titleBar.appendChild(closeBtn);

    // Content area with single summon button and background image
    const content = document.createElement('div');
    content.style.cssText = `flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.2) url('images/beijing_zhaohuan.png') center/cover no-repeat; border-radius: 12px; padding: 20px; position: relative; border: 3px solid white;`;

    const summonBtn = document.createElement('button');
    summonBtn.textContent = '🔮 开始召唤 (💎×1)';
    summonBtn.style.cssText = `padding: 20px 48px; font-size: 22px; font-weight: bold; background: linear-gradient(135deg, #8e44ad 0%, #6c3483 100%); border: none; border-radius: 12px; color: white; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(142,68,173,0.4); position: relative; z-index: 1;`;
    summonBtn.addEventListener('mouseenter', () => { summonBtn.style.transform = 'translateY(-3px)'; summonBtn.style.boxShadow = '0 8px 20px rgba(142,68,173,0.6)'; });
    summonBtn.addEventListener('mouseleave', () => { summonBtn.style.transform = 'translateY(0)'; summonBtn.style.boxShadow = '0 4px 12px rgba(142,68,173,0.4)'; });
    summonBtn.addEventListener('click', () => {
      if (otherworldCharacters.length === 0) {
        this.showNotification('没有可召唤的异界角色', 'error');
        return;
      }
      // Check crystal cost
      if (!this.playerEntity) {
        this.showNotification('玩家实体未初始化', 'error');
        return;
      }
      const currency = this.currencySystem.getCurrency(this.world, this.playerEntity.id);
      if (!currency || (currency.amounts.crystal ?? 0) < 1) {
        this.showNotification('水晶不足，需要 1 💎', 'warning');
        return;
      }
      // Deduct 1 crystal immediately
      const spendResult = this.currencySystem.spendCurrency(this.world, this.playerEntity.id, { crystal: 1 }, '异界召唤');
      if (!spendResult.success) {
        this.showNotification('水晶扣除失败', 'error');
        return;
      }
      this.updateCurrencyDisplay();

      // Change background image to summoning state
      content.style.backgroundImage = `url('images/beijing_zhaohuanzhong.png')`;

      // Disable the summon button
      summonBtn.disabled = true;
      summonBtn.style.opacity = '0.6';
      summonBtn.style.cursor = 'not-allowed';
      summonBtn.textContent = '召唤中...';

      // Show progress bar below the button
      const progressContainer = document.createElement('div');
      progressContainer.style.cssText = `width: 300px; margin-top: 16px;`;

      const progressLabel = document.createElement('div');
      progressLabel.textContent = '🔮 召唤进度';
      progressLabel.style.cssText = `color: white; font-size: 14px; text-align: center; margin-bottom: 6px; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;`;

      const progressBg = document.createElement('div');
      progressBg.style.cssText = `background: rgba(255,255,255,0.3); border-radius: 8px; height: 20px; overflow: hidden; border: 2px solid rgba(255,255,255,0.5);`;

      const progressFill = document.createElement('div');
      progressFill.style.cssText = `background: linear-gradient(90deg, #8e44ad, #c39bd3, #8e44ad); height: 100%; width: 0%; border-radius: 6px; transition: width 0.1s linear; background-size: 200% 100%; animation: shimmer 1.5s infinite linear;`;

      // Add shimmer animation
      const style = document.createElement('style');
      style.textContent = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;
      progressContainer.appendChild(style);

      const progressText = document.createElement('div');
      progressText.textContent = '0%';
      progressText.style.cssText = `color: white; font-size: 12px; text-align: center; margin-top: 4px; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;`;

      progressBg.appendChild(progressFill);
      progressContainer.appendChild(progressLabel);
      progressContainer.appendChild(progressBg);
      progressContainer.appendChild(progressText);
      content.appendChild(progressContainer);

      // Animate progress over 5 seconds
      const duration = 5000;
      const startTime = Date.now();
      activeProgressInterval = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(100, (elapsed / duration) * 100);
        progressFill.style.width = `${pct}%`;
        progressText.textContent = `${Math.floor(pct)}%`;

        if (pct >= 100) {
          clearInterval(activeProgressInterval!);
          activeProgressInterval = null;
          // Summon complete
          const randomChar = otherworldCharacters[Math.floor(Math.random() * otherworldCharacters.length)];
          this.createOtherworldCharacter(randomChar);
          panelContainer.remove();
          // Don't re-enable buttons here - let user decide in character details panel
          this.showSummonFireworks(randomChar);
          
          // Don't emit quest event immediately - wait for user to close the result panel
          // The event will be emitted when user clicks "继续召唤" or "完成" button
        }
      }, 50);
    });

    content.appendChild(summonBtn);
    panelContainer.appendChild(titleBar);
    panelContainer.appendChild(content);
    this.sceneContainer.appendChild(panelContainer);
  }

  /**
   * Show firework particle effects and character details after summoning
   */
  private showSummonFireworks(charConfig: OtherworldCharacterConfig): void {
    if (!this.sceneContainer) return;

    // Full-screen overlay for fireworks
    const overlay = document.createElement('div');
    overlay.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 200; pointer-events: auto; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;`;

    // Spawn firework particles
    const colors = ['#ff4444', '#ffaa00', '#44ff44', '#4488ff', '#ff44ff', '#ffff44', '#44ffff', '#ff8844'];
    const rect = this.sceneContainer.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    for (let burst = 0; burst < 6; burst++) {
      const cx = 80 + Math.random() * (w - 160);
      const cy = 60 + Math.random() * (h - 120);
      const delay = burst * 200;

      for (let i = 0; i < 18; i++) {
        const p = document.createElement('div');
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = 4 + Math.random() * 6;
        const angle = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.4;
        const dist = 60 + Math.random() * 80;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;

        p.style.cssText = `position: absolute; left: ${cx}px; top: ${cy}px; width: ${size}px; height: ${size}px; background: ${color}; border-radius: 50%; pointer-events: none; opacity: 1; box-shadow: 0 0 6px ${color}; z-index: 201;`;
        overlay.appendChild(p);

        setTimeout(() => {
          p.style.transition = `all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
          p.style.transform = `translate(${dx}px, ${dy}px)`;
          p.style.opacity = '0';
        }, delay + 20);

        setTimeout(() => { p.remove(); }, delay + 900);
      }
    }

    // After fireworks, show character details panel in center
    setTimeout(() => {
      // Find the recruited character
      const recruited = this.npcSystem.getRecruitedCharacters();
      const summoned = recruited.find(c => c.id.startsWith(`otherworld_${charConfig.id}_`));
      if (!summoned) return;

      // Temporarily render details into action-panel to get the HTML
      const actionPanel = document.getElementById('action-panel');
      const savedContent = actionPanel ? actionPanel.innerHTML : '';
      this.showNPCDetails(summoned);
      const detailsHtml = actionPanel ? actionPanel.innerHTML : '';
      // Restore action panel
      if (actionPanel) actionPanel.innerHTML = savedContent;

      // Create floating panel in center
      const panel = document.createElement('div');
      panel.style.cssText = `background: white; border-radius: 16px; padding: 20px; max-width: 520px; width: 90%; max-height: 95%; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.5); border: 3px solid #8e44ad; transform: scale(0); transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); z-index: 202; position: relative;`;

      // Close button (top right X)
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = `position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.1); border: none; border-radius: 50%; width: 32px; height: 32px; font-size: 18px; cursor: pointer; color: #666; transition: all 0.2s; z-index: 10; display: flex; align-items: center; justify-content: center;`;
      closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(255,100,100,0.8)'; closeBtn.style.color = 'white'; });
      closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'rgba(0,0,0,0.1)'; closeBtn.style.color = '#666'; });
      closeBtn.addEventListener('click', () => { 
        overlay.remove(); 
        // Emit quest event for summon (delayed until user closes result panel)
        this.eventSystem.emit({ type: 'quest:summon', timestamp: Date.now() });
        // Restore Kaoezi's action panel
        const kaoezi = this.npcSystem.getNPC('summoner_kaoezi');
        if (kaoezi) {
          this.showNPCDetails(kaoezi);
        }
      });

      panel.appendChild(closeBtn);

      // Insert the details HTML
      const content = document.createElement('div');
      content.innerHTML = detailsHtml;
      panel.appendChild(content);

      // Create a wrapper for panel and buttons with horizontal layout
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `display: flex; align-items: center; gap: 16px; max-width: 90%; width: fit-content;`;

      // Continue button on the left
      const continueBtn = document.createElement('button');
      continueBtn.textContent = '🔮 继续召唤';
      continueBtn.style.cssText = `padding: 14px 28px; font-size: 18px; font-weight: bold; background: linear-gradient(135deg, #8e44ad 0%, #6c3483 100%); border: none; border-radius: 10px; color: white; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(142,68,173,0.4); white-space: nowrap;`;
      continueBtn.addEventListener('mouseenter', () => { continueBtn.style.transform = 'translateY(-2px)'; continueBtn.style.boxShadow = '0 6px 16px rgba(142,68,173,0.6)'; });
      continueBtn.addEventListener('mouseleave', () => { continueBtn.style.transform = 'translateY(0)'; continueBtn.style.boxShadow = '0 4px 12px rgba(142,68,173,0.4)'; });
      continueBtn.addEventListener('click', () => { 
        overlay.remove(); 
        // Emit quest event for summon (delayed until user closes result panel)
        this.eventSystem.emit({ type: 'quest:summon', timestamp: Date.now() });
        // Reopen summoning panel (buttons stay disabled)
        this.showSummoningPanel();
      });

      // Done button on the right
      const doneBtn = document.createElement('button');
      doneBtn.textContent = '✓ 完成';
      doneBtn.style.cssText = `padding: 14px 28px; font-size: 18px; font-weight: bold; background: linear-gradient(135deg, #27ae60 0%, #229954 100%); border: none; border-radius: 10px; color: white; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(39,174,96,0.4); white-space: nowrap;`;
      doneBtn.addEventListener('mouseenter', () => { doneBtn.style.transform = 'translateY(-2px)'; doneBtn.style.boxShadow = '0 6px 16px rgba(39,174,96,0.6)'; });
      doneBtn.addEventListener('mouseleave', () => { doneBtn.style.transform = 'translateY(0)'; doneBtn.style.boxShadow = '0 4px 12px rgba(39,174,96,0.4)'; });
      doneBtn.addEventListener('click', () => { 
        overlay.remove(); 
        // Emit quest event for summon (delayed until user closes result panel)
        this.eventSystem.emit({ type: 'quest:summon', timestamp: Date.now() });
        // Restore Kaoezi's action panel
        const kaoezi = this.npcSystem.getNPC('summoner_kaoezi');
        if (kaoezi) {
          this.showNPCDetails(kaoezi);
        }
      });

      wrapper.appendChild(continueBtn);
      wrapper.appendChild(panel);
      wrapper.appendChild(doneBtn);

      overlay.appendChild(wrapper);
      requestAnimationFrame(() => { panel.style.transform = 'scale(1)'; });
    }, 600);

    this.sceneContainer.appendChild(overlay);
  }

  private renderRecipeDetails(detailsPanel: HTMLElement, recipe: any): void {
    detailsPanel.innerHTML = '';

    // Recipe header with icon and name
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.3);
    `;

    const icon = document.createElement('img');
    icon.src = recipe.icon;
    icon.alt = recipe.name;
    const rarityNumber = recipe.rarity;
    icon.style.cssText = `
      width: 80px;
      height: 80px;
      object-fit: contain;
      border: 2px solid ${this.itemSystem.getRarityColor(rarityNumber)};
      border-radius: 8px;
      padding: 4px;
      background: rgba(0, 0, 0, 0.3);
    `;

    const headerInfo = document.createElement('div');
    headerInfo.style.cssText = `
      flex: 1;
    `;

    const name = document.createElement('div');
    name.textContent = recipe.name;
    name.style.cssText = `
      color: ${this.itemSystem.getRarityColor(rarityNumber)};
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 6px;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    const rarityBadge = document.createElement('div');
    rarityBadge.textContent = this.itemSystem.getRarityName(rarityNumber);
    rarityBadge.style.cssText = `
      display: inline-block;
      background: ${this.itemSystem.getRarityColor(rarityNumber)};
      color: #000;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      margin-bottom: 6px;
    `;

    const valuePrice = document.createElement('div');
    valuePrice.textContent = `价值: ${recipe.buyPrice} 金币`;
    valuePrice.style.cssText = `
      color: #ffd700;
      font-size: 14px;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    headerInfo.appendChild(name);
    headerInfo.appendChild(rarityBadge);
    headerInfo.appendChild(valuePrice);

    if (recipe.hungerRestore) {
      const hungerInfo = document.createElement('div');
      hungerInfo.textContent = `🍖 饱腹度+${recipe.hungerRestore}`;
      hungerInfo.style.cssText = `color: #66bb6a; font-size: 14px; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;`;
      headerInfo.appendChild(hungerInfo);
    }

    header.appendChild(icon);
    header.appendChild(headerInfo);

    // Description
    const description = document.createElement('div');
    description.textContent = recipe.description;
    description.style.cssText = `
      color: white;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 16px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 6px;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    // Ingredients section
    const ingredientsTitle = document.createElement('h3');
    ingredientsTitle.textContent = '所需材料';
    ingredientsTitle.style.cssText = `
      margin: 0 0 12px 0;
      color: white;
      font-size: 14px;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    const ingredientsList = document.createElement('div');
    ingredientsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    `;

    // Check if player can cook
    let canCook = false;
    if (this.playerEntity && this.itemSystem) {
      const validation = this.cookingSystem.validateCooking(this.playerEntity.id, recipe.id);
      canCook = validation.canCook;

      recipe.ingredients.forEach((ingredient: any) => {
        const ingredientItem = document.createElement('div');
        const isMissing = validation.missingIngredients.some((mi: any) => mi.itemId === ingredient.itemId);
        const itemData = this.itemSystem!.getItem(ingredient.itemId);
        
        ingredientItem.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          border-left: 3px solid ${isMissing ? '#e74c3c' : '#2ecc71'};
        `;

        // Icon container
        const iconContainer = document.createElement('div');
        iconContainer.style.cssText = `
          width: 48px;
          height: 48px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          margin-right: 12px;
          border: 2px solid ${isMissing ? 'rgba(231, 76, 60, 0.5)' : 'rgba(46, 204, 113, 0.5)'};
          flex-shrink: 0;
        `;

        // Load icon image
        if (itemData && itemData.icon) {
          const icon = document.createElement('img');
          icon.src = itemData.icon;
          icon.alt = itemData.name || ingredient.itemId;
          icon.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
          `;
          icon.onerror = () => {
            iconContainer.textContent = '📦';
            iconContainer.style.fontSize = '24px';
          };
          iconContainer.appendChild(icon);
        } else {
          iconContainer.textContent = '📦';
          iconContainer.style.fontSize = '24px';
        }

        const ingredientInfo = document.createElement('div');
        ingredientInfo.style.cssText = `
          flex: 1;
        `;

        const ingredientName = document.createElement('div');
        ingredientName.textContent = this.getItemName(ingredient.itemId);
        ingredientName.style.cssText = `
          color: white;
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 4px;
          text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
        `;

        const ingredientQuantity = document.createElement('div');
        const playerQuantity = this.itemSystem!.getItemQuantity(ingredient.itemId);
        ingredientQuantity.textContent = `需要: ${ingredient.quantity} (拥有: ${playerQuantity})`;
        ingredientQuantity.style.cssText = `
          color: #ddd;
          font-size: 11px;
          text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
        `;

        ingredientInfo.appendChild(ingredientName);
        ingredientInfo.appendChild(ingredientQuantity);

        // Availability indicator
        const indicator = document.createElement('div');
        indicator.textContent = isMissing ? '✗' : '✓';
        indicator.style.cssText = `
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${isMissing ? '#e74c3c' : '#2ecc71'};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          flex-shrink: 0;
        `;

        ingredientItem.appendChild(iconContainer);
        ingredientItem.appendChild(ingredientInfo);
        ingredientItem.appendChild(indicator);

        ingredientsList.appendChild(ingredientItem);
      });
    }

    // Cooking button
    const cookingButton = document.createElement('button');
    cookingButton.textContent = '开始烹饪';
    cookingButton.style.cssText = `
      width: 100%;
      padding: 12px;
      font-size: 16px;
      font-weight: bold;
      background: ${canCook ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#555'};
      border: none;
      border-radius: 8px;
      color: white;
      cursor: ${canCook ? 'pointer' : 'not-allowed'};
      transition: all 0.2s ease;
      opacity: ${canCook ? '1' : '0.5'};
    `;

    if (canCook) {
      cookingButton.addEventListener('mouseenter', () => {
        cookingButton.style.transform = 'translateY(-2px)';
        cookingButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
      });

      cookingButton.addEventListener('mouseleave', () => {
        cookingButton.style.transform = 'translateY(0)';
        cookingButton.style.boxShadow = 'none';
      });

      cookingButton.addEventListener('click', () => {
        if (this.playerEntity) {
          // Start cooking with progress bar
          this.startCookingWithProgressInDetailsPanel(recipe, cookingButton, detailsPanel);
        }
      });
    } else {
      cookingButton.disabled = true;
    }

    // Assemble details panel
    detailsPanel.appendChild(header);
    detailsPanel.appendChild(description);
    detailsPanel.appendChild(ingredientsTitle);
    detailsPanel.appendChild(ingredientsList);
    detailsPanel.appendChild(cookingButton);
  }

  private createItemCard(itemData: any, quantity: number, slot?: any): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.3s ease;
      border: 2px solid transparent;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    `;

    // Icon container (rounded square)
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
      width: 80px;
      height: 80px;
      background: #f5f5f5;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
      overflow: hidden;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    `;

    // Item icon
    const icon = document.createElement('img');
    icon.src = itemData.icon;
    icon.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
    `;
    icon.onerror = () => {
      icon.style.display = 'none';
      const placeholder = document.createElement('div');
      placeholder.style.cssText = `
        font-size: 32px;
      `;
      placeholder.textContent = '📦';
      iconContainer.appendChild(placeholder);
    };

    iconContainer.appendChild(icon);

    // Item name
    const name = document.createElement('div');
    name.textContent = itemData.name;
    name.style.cssText = `
      font-size: 12px;
      font-weight: bold;
      color: #333;
      text-align: center;
      margin-bottom: 4px;
      word-break: break-word;
    `;

    // Quantity badge
    if (quantity > 1) {
      const quantityBadge = document.createElement('div');
      quantityBadge.textContent = `x${quantity}`;
      quantityBadge.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        background: rgba(102, 126, 234, 0.9);
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: bold;
      `;
      card.appendChild(quantityBadge);
    }

    // Rarity indicator
    const rarityColor = this.itemSystem.getRarityColor(itemData.rarity);
    card.style.borderColor = rarityColor;

    // Hover effect
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
    });

    // Click to show details in action panel or equip item if in equipment selection mode
    card.addEventListener('click', () => {
      // Check if we're in equipment selection mode
      const characterId = (this as any).equipmentSelectionCharacterId;
      const equipmentSlot = (this as any).equipmentSelectionSlot;
      
      if (characterId && equipmentSlot && itemData.type === 'equipment' && slot) {
        // Equipment selection mode - equip the item
        if (slot.instanceId) {
          // Use equipItemToCharacter method which handles tracking
          this.equipItemToCharacter(characterId, equipmentSlot, slot.instanceId);
          
          this.showNotification(`已装备 ${itemData.name}`, 'success');
          
          // Clear equipment selection state
          delete (this as any).equipmentSelectionCharacterId;
          delete (this as any).equipmentSelectionSlot;
          
          // Switch back to character tab
          setTimeout(() => {
            const characterTab = document.querySelector('[data-tab="character"]') as HTMLButtonElement;
            if (characterTab) {
              characterTab.click();
            }
          }, 500);
        }
      } else {
        // Normal mode - show item details
        this.showItemDetailsInPanel(itemData, quantity);
        
        // Highlight selected card using box-shadow instead of border width
        const allCards = card.parentElement?.querySelectorAll('[data-item-card]');
        allCards?.forEach(c => {
          (c as HTMLElement).style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        });
        card.style.boxShadow = `0 0 0 3px ${rarityColor}, 0 4px 16px rgba(0, 0, 0, 0.2)`;
      }
    });

    card.setAttribute('data-item-card', 'true');
    card.appendChild(iconContainer);
    card.appendChild(name);

    return card;
  }

  private showItemDetailsInPanel(itemData: any, quantity: number): void {
    // Debug: Log item data to console
    console.log('[GameUI] showItemDetailsInPanel - itemData:', itemData);
    console.log('[GameUI] affix:', itemData.affix);
    console.log('[GameUI] attributeModifiers:', itemData.attributeModifiers);
    console.log('[GameUI] mainStat:', itemData.mainStat);
    console.log('[GameUI] subStats:', itemData.subStats);
    console.log('[GameUI] mainAttribute:', itemData.mainAttribute);
    console.log('[GameUI] secondaryAttributes:', itemData.secondaryAttributes);
    
    const rarityColor = this.itemSystem.getRarityColor(itemData.rarity);
    const rarityName = this.itemSystem.getRarityName(itemData.rarity);

    // Build affix display HTML if item has affixes (显示为"副词条")
    let affixHTML = '';
    const affixes = normalizeAffixes(itemData.affix);
    if (affixes.length > 0) {
      const affixLines = affixes.map((a: any) => {
        const affixColor = getAffixColorStyle(a.rarity);
        const affixText = formatAffixDisplayWithRange(a);
        return `<div style="color: #fff; font-size: 16px; font-weight: bold; text-shadow: -1px -1px 0 ${affixColor}, 1px -1px 0 ${affixColor}, -1px 1px 0 ${affixColor}, 1px 1px 0 ${affixColor}, 0 0 6px ${affixColor}; margin-bottom: 4px;">${affixText}</div>`;
      }).join('');
      const borderColor = getAffixColorStyle(affixes[affixes.length - 1].rarity);
      affixHTML = `
        <div style="margin-bottom: 16px; padding: 16px; background: rgba(255, 215, 0, 0.1); border-radius: 8px; border-left: 4px solid ${borderColor};">
          <div style="font-weight: bold; margin-bottom: 8px; color: #424242;">副词条</div>
          ${affixLines}
        </div>
      `;
    }

    // Get item type display name
    const itemTypeDisplay = this.translateItemType(itemData.type || itemData.itemType || 'unknown');
    
    // Get item value
    const itemValue = itemData.buyPrice || 0;

    // Process equipment attributes
    // Only show mainAttribute as "主词条", affix will be shown as "副词条"
    let mainStatHTML = '';
    
    // Try mainAttribute first (from equipment-recipes.json)
    if (itemData.mainAttribute) {
      mainStatHTML = `
        <div style="margin-bottom: 16px; padding: 16px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #2e7d32;">主词条</div>
          <div style="color: #388e3c; font-size: 16px; font-weight: bold;">
            ${itemData.mainAttribute}
          </div>
        </div>
      `;
    }
    // Fallback to attributeModifiers (from items.json)
    else if (itemData.attributeModifiers && itemData.attributeModifiers.length > 0) {
      const mainStat = itemData.attributeModifiers[0];
      const mainValue = mainStat.type === 'percentage' ? `${mainStat.value}%` : mainStat.value;
      mainStatHTML = `
        <div style="margin-bottom: 16px; padding: 16px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #2e7d32;">主词条</div>
          <div style="color: #388e3c; font-size: 16px; font-weight: bold;">
            +${mainValue} ${this.translateAttribute(mainStat.attribute)}
          </div>
        </div>
      `;
    }
    // Fallback to mainStat (from ItemData interface)
    else if (itemData.mainStat) {
      mainStatHTML = `
        <div style="margin-bottom: 16px; padding: 16px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #2e7d32;">主词条</div>
          <div style="color: #388e3c; font-size: 16px; font-weight: bold;">
            +${itemData.mainStat.value} ${this.translateAttribute(itemData.mainStat.attribute)}
          </div>
        </div>
      `;
    }

    const detailsHTML = `
      <div style="padding: 20px;">
        <!-- Header with icon and basic info -->
        <div style="display: flex; gap: 16px; align-items: flex-start; margin-bottom: 20px;">
          <div style="width: 80px; height: 80px; background: #f5f5f5; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
            <img src="${itemData.icon}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">
          </div>
          <div style="flex: 1;">
            <h2 style="margin: 0 0 8px 0; color: #333; font-size: 20px; font-weight: bold;">${itemData.name}</h2>
            <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
              <div style="display: inline-block; padding: 4px 12px; background: ${rarityColor}; color: white; border-radius: 6px; font-size: 12px; font-weight: bold;">${rarityName}</div>
              <div style="display: inline-block; padding: 4px 12px; background: rgba(102, 126, 234, 0.8); color: white; border-radius: 6px; font-size: 12px; font-weight: bold;">${itemTypeDisplay}</div>
            </div>
            <div style="font-size: 14px; color: #f57c00; font-weight: bold; margin-bottom: 4px;">持有: ${quantity}</div>
            <div style="font-size: 14px; color: #ffd700; font-weight: bold; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">价值: ${itemValue} 金币</div>
            ${itemData.type === 'food' && itemData.hungerRestore ? `<div style="font-size: 14px; color: #66bb6a; font-weight: bold;">🍖 饱腹度+${itemData.hungerRestore}</div>` : ''}
          </div>
        </div>
        
        <!-- Description -->
        <div style="padding: 16px; background: #f5f5f5; border-radius: 8px; margin-bottom: 20px;">
          <div style="font-size: 14px; color: #666; line-height: 1.6;">${itemData.description || '暂无描述'}</div>
        </div>
        
        ${mainStatHTML}
        ${affixHTML}
      </div>
    `;

    this.updateActionPanel(detailsHTML);
  }

  private translateAttribute(attr: string): string {
    const translations: Record<string, string> = {
      'attack': '攻击力',
      'defense': '防御力',
      'hp': '生命值',
      'mp': '魔法值',
      'strength': '力量',
      'agility': '敏捷',
      'wisdom': '智慧',
      'skill': '技巧',
      'critRate': '暴击率',
      'critDamage': '暴击伤害',
      'dodgeRate': '闪避率',
      'moveSpeed': '移动速度'
    };
    return translations[attr] || attr;
  }

  private translateItemType(type: string): string {
    const translations: Record<string, string> = {
      'equipment': '装备',
      'weapon': '武器',
      'armor': '防具',
      'accessory': '饰品',
      'book': '书籍',
      'skill_book': '技能书',
      'material': '材料',
      'consumable': '消耗品',
      'food': '食物',
      'dish': '菜肴',
      'seed': '种子',
      'tool': '工具',
      'quest': '任务物品',
      'currency': '货币',
      'unknown': '未知'
    };
    return translations[type] || type;
  }

  private updateActionPanel(content: string): void {
    const actionPanel = document.getElementById('action-panel');
    if (actionPanel) {
      actionPanel.innerHTML = content;
    }
  }

  /**
   * Clear action panel and restore default content
   */
  private clearActionPanel(): void {
    const actionPanel = document.getElementById('action-panel');
    if (actionPanel) {
      actionPanel.innerHTML = '';
    }
  }

  private createWarehouseCharacterCard(character: any): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.3s ease;
      border: 2px solid transparent;
    `;

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
      margin: 0 auto 10px auto;
      overflow: hidden;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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
      avatar.style.fontSize = '40px';
    }

    // Name
    const name = document.createElement('div');
    name.textContent = character.title ? `${character.title}${character.name}` : character.name;
    name.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      color: #333;
      text-align: center;
      margin-bottom: 6px;
    `;

    // Level and Job
    const info = document.createElement('div');
    info.textContent = `Lv.${character.level} ${this.getJobDisplayName(character.job)}`;
    info.style.cssText = `
      font-size: 12px;
      color: #666;
      text-align: center;
    `;

    // Assemble card
    card.appendChild(avatar);
    card.appendChild(name);
    card.appendChild(info);

    // Hover effect
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.15)';
      card.style.borderColor = '#667eea';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
      card.style.borderColor = 'transparent';
    });

    // Click to show details
    card.addEventListener('click', () => {
      this.showNPCDetails(character);
    });

    return card;
  }

  private showQuestPanel(npcId?: string): void {
    if (!this.sceneContainer) return;

    this.clearSceneContainer();

    const questContainer = document.createElement('div');
    questContainer.style.cssText = `
      width: 100%; height: 100%; display: flex; flex-direction: column;
      padding: 80px 20px 20px 20px; box-sizing: border-box; position: relative;
    `;

    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
      position: absolute; top: 90px; right: 30px; width: 40px; height: 40px;
      background: rgba(220, 53, 69, 0.9); border: none; border-radius: 50%;
      color: white; font-size: 24px; font-weight: bold; cursor: pointer;
      transition: all 0.2s; z-index: 1000; display: flex; align-items: center;
      justify-content: center; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;
    closeButton.addEventListener('mouseenter', () => { closeButton.style.background = 'rgba(200, 35, 51, 1)'; closeButton.style.transform = 'scale(1.1)'; });
    closeButton.addEventListener('mouseleave', () => { closeButton.style.background = 'rgba(220, 53, 69, 0.9)'; closeButton.style.transform = 'scale(1)'; });
    closeButton.addEventListener('click', () => { this.switchScene(this.currentScene === 'square' ? 'square' : this.currentScene); });
    questContainer.appendChild(closeButton);

    const contentArea = document.createElement('div');
    contentArea.style.cssText = `
      flex: 1; background: rgba(255, 255, 255, 0.2); border-radius: 12px;
      padding: 20px; overflow-y: auto; display: flex; flex-direction: column;
    `;

    // Tab buttons
    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = 'display: flex; gap: 12px; margin-bottom: 5px;';

    const tabs = [
      { id: 'available', label: '可接任务' },
      { id: 'inProgress', label: '进行中' },
      { id: 'completed', label: '已完成' }
    ];

    const tabButtons: HTMLButtonElement[] = [];
    let currentTab = 'available';

    // Helper: get quests for current view
    const getFilteredQuests = (tab: string) => {
      let quests = npcId ? this.getQuestsForNpc(npcId) : this.questDefinitions;
      return quests.filter(q => {
        const state = this.questStates.get(q.id);
        if (!state) return false;
        if (tab === 'available') return state.status === 'available';
        if (tab === 'inProgress') return state.status === 'inProgress';
        if (tab === 'completed') return state.status === 'completed';
        return false;
      });
    };

    // Check if inProgress tab has completable quests
    const hasCompletable = getFilteredQuests('inProgress').some(q => {
      const state = this.questStates.get(q.id);
      if (!state) return false;
      return q.objectives.every((obj, i) => state.objectives[i].currentAmount >= obj.requiredAmount);
    });

    const questGridContainer = document.createElement('div');
    questGridContainer.style.cssText = `
      flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px; align-content: start; margin-bottom: 10px;
    `;

    const renderQuestList = (tab: string) => {
      questGridContainer.innerHTML = '';
      const quests = getFilteredQuests(tab);
      if (quests.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #fff;';
        emptyState.innerHTML = `<div style="font-size: 48px; margin-bottom: 16px;">📋</div><div style="font-size: 18px;">暂无任务</div>`;
        questGridContainer.appendChild(emptyState);
      } else {
        quests.forEach(quest => {
          const card = this.createQuestCard(quest, () => renderQuestList(currentTab));
          questGridContainer.appendChild(card);
        });
      }
    };

    tabs.forEach((tab, index) => {
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      const isActive = index === 0;
      btn.style.cssText = `
        padding: 8px 24px; border: none; border-radius: 8px; font-size: 13px;
        font-weight: bold; cursor: pointer; transition: all 0.2s; position: relative;
        background: ${isActive ? 'rgba(102, 126, 234, 0.8)' : 'rgba(255, 255, 255, 0.6)'};
        color: ${isActive ? 'white' : '#333'};
      `;
      // Red dot on inProgress tab
      if (tab.id === 'inProgress' && hasCompletable) {
        const redDot = document.createElement('span');
        redDot.style.cssText = `
          position: absolute; top: 8px; right: 8px; width: 10px; height: 10px;
          background: #dc3545; border-radius: 50%; border: 2px solid white; animation: pulse 1.5s infinite;
        `;
        btn.appendChild(redDot);
      }
      btn.addEventListener('click', () => {
        currentTab = tab.id;
        tabButtons.forEach(b => { b.style.background = 'rgba(255, 255, 255, 0.6)'; b.style.color = '#333'; });
        btn.style.background = 'rgba(102, 126, 234, 0.8)';
        btn.style.color = 'white';
        renderQuestList(tab.id);
      });
      tabButtons.push(btn);
      tabContainer.appendChild(btn);
    });

    contentArea.appendChild(tabContainer);
    contentArea.appendChild(questGridContainer);
    renderQuestList('available');

    questContainer.appendChild(contentArea);
    this.sceneContainer.appendChild(questContainer);
  }

  private getNpcDisplayNameForQuest(npcId: string): string {
    const npc = this.npcSystem.getNPC(npcId);
    return npc ? ((npc.title || '') + npc.name) : npcId;
  }

  private getQuestAcceptMethod(quest: QuestDefinition): string {
    const npcName = this.getNpcDisplayNameForQuest(quest.npcId);
    return `前往${npcName}处接取`;
  }

  private showQuestOverviewModal(): void {
    // Remove existing modal if any
    const existing = document.getElementById('quest-overview-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'quest-overview-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7); display: flex; align-items: center;
      justify-content: center; z-index: 10000; animation: fadeIn 0.2s ease-out;
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const panel = document.createElement('div');
    panel.style.cssText = `
      width: 700px; max-height: 80vh; background: #1e1e2e; border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.1); overflow: hidden; display: flex;
      flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.1);
      display: flex; align-items: center; justify-content: space-between;
    `;
    header.innerHTML = `<div style="font-size: 20px; font-weight: bold; color: #ffd700;">📋 任务总览</div>`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      width: 32px; height: 32px; border-radius: 50%; border: none;
      background: rgba(255,255,255,0.1); color: #aaa; font-size: 16px;
      cursor: pointer; transition: all 0.2s;
    `;
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(220,53,69,0.8)'; closeBtn.style.color = '#fff'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'rgba(255,255,255,0.1)'; closeBtn.style.color = '#aaa'; });
    closeBtn.addEventListener('click', () => overlay.remove());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Tabs
    const tabBar = document.createElement('div');
    tabBar.style.cssText = `display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.1);`;
    const tabDefs = [
      { id: 'main-progress', label: '主线进度' },
      { id: 'available', label: '可接任务' },
      { id: 'in-progress', label: '进行中' },
      { id: 'completed', label: '已完成' }
    ];
    let activeTab = 'main-progress';
    const contentArea = document.createElement('div');
    contentArea.style.cssText = `flex: 1; overflow-y: auto; padding: 16px 24px;`;

    const renderContent = () => {
      contentArea.innerHTML = '';
      if (activeTab === 'main-progress') this.renderMainProgress(contentArea);
      else if (activeTab === 'available') this.renderAvailableQuests(contentArea);
      else if (activeTab === 'in-progress') this.renderInProgressQuests(contentArea);
      else if (activeTab === 'completed') this.renderCompletedQuests(contentArea);
    };

    const tabBtns: HTMLButtonElement[] = [];
    tabDefs.forEach(t => {
      const btn = document.createElement('button');
      btn.textContent = t.label;
      // Count for badge
      let count = 0;
      if (t.id === 'available') count = this.questDefinitions.filter(q => this.questStates.get(q.id)?.status === 'available').length;
      else if (t.id === 'in-progress') count = this.questDefinitions.filter(q => this.questStates.get(q.id)?.status === 'inProgress').length;
      else if (t.id === 'completed') count = this.questDefinitions.filter(q => this.questStates.get(q.id)?.status === 'completed').length;
      if (count > 0 && t.id !== 'main-progress') btn.textContent = `${t.label} (${count})`;

      const isActive = t.id === activeTab;
      btn.style.cssText = `
        flex: 1; padding: 12px 0; border: none; font-size: 13px; font-weight: 600;
        cursor: pointer; transition: all 0.2s; position: relative;
        background: ${isActive ? 'rgba(102,126,234,0.2)' : 'transparent'};
        color: ${isActive ? '#7c8cf8' : '#888'};
        border-bottom: ${isActive ? '2px solid #7c8cf8' : '2px solid transparent'};
      `;
      btn.addEventListener('click', () => {
        activeTab = t.id;
        tabBtns.forEach(b => { b.style.background = 'transparent'; b.style.color = '#888'; b.style.borderBottom = '2px solid transparent'; });
        btn.style.background = 'rgba(102,126,234,0.2)';
        btn.style.color = '#7c8cf8';
        btn.style.borderBottom = '2px solid #7c8cf8';
        renderContent();
      });
      tabBtns.push(btn);
      tabBar.appendChild(btn);
    });

    panel.appendChild(tabBar);
    panel.appendChild(contentArea);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    renderContent();
  }

  private renderMainProgress(container: HTMLElement): void {
    const mainQuests = this.questDefinitions.filter(q => q.type === 'main').sort((a, b) => a.sortOrder - b.sortOrder);
    if (mainQuests.length === 0) { container.innerHTML = '<div style="text-align:center;color:#666;padding:40px;">暂无主线任务</div>'; return; }

    mainQuests.forEach((quest, idx) => {
      const state = this.questStates.get(quest.id);
      const status = state?.status || 'locked';
      const isCompleted = status === 'completed';
      const isInProgress = status === 'inProgress';
      const isLocked = status === 'locked';

      const card = document.createElement('div');
      card.style.cssText = `
        padding: 14px 16px; border-radius: 10px; margin-bottom: 8px;
        background: ${isCompleted ? 'rgba(46,204,113,0.1)' : isInProgress ? 'rgba(102,126,234,0.1)' : 'rgba(255,255,255,0.04)'};
        border: 1px solid ${isCompleted ? 'rgba(46,204,113,0.3)' : isInProgress ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.06)'};
        display: flex; align-items: center; gap: 14px;
      `;

      const statusIcon = isCompleted ? '✅' : isInProgress ? '🔵' : isLocked ? '🔒' : '⚪';
      const statusText = isCompleted ? '已完成' : isInProgress ? '进行中' : isLocked ? '未解锁' : '可接取';
      const statusColor = isCompleted ? '#2ecc71' : isInProgress ? '#7c8cf8' : '#666';

      // Progress for in-progress quests
      let progressHtml = '';
      if (isInProgress && state) {
        const objProgress = quest.objectives.map((obj, i) => {
          const cur = state.objectives[i]?.currentAmount || 0;
          return `${obj.description} ${cur}/${obj.requiredAmount}`;
        }).join(' · ');
        progressHtml = `<div style="font-size:11px;color:#999;margin-top:4px;">${objProgress}</div>`;
      }

      card.innerHTML = `
        <div style="font-size:20px;flex-shrink:0;">${statusIcon}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:#888;">#${idx + 1}</span>
            <span style="font-size:14px;font-weight:600;color:${isLocked ? '#555' : '#eee'};">${quest.name}</span>
            <span style="font-size:11px;color:${statusColor};background:${statusColor}22;padding:2px 8px;border-radius:4px;">${statusText}</span>
          </div>
          <div style="font-size:12px;color:#888;margin-top:2px;">${quest.description}</div>
          ${progressHtml}
        </div>
      `;
      container.appendChild(card);

      // Arrow between quests
      if (idx < mainQuests.length - 1) {
        const arrow = document.createElement('div');
        arrow.style.cssText = 'text-align:center;color:#444;font-size:16px;margin:2px 0;';
        arrow.textContent = '↓';
        container.appendChild(arrow);
      }
    });
  }

  private renderAvailableQuests(container: HTMLElement): void {
    const available = this.questDefinitions.filter(q => this.questStates.get(q.id)?.status === 'available');
    if (available.length === 0) { container.innerHTML = '<div style="text-align:center;color:#666;padding:40px;">暂无可接取的任务</div>'; return; }

    available.forEach(quest => {
      const card = document.createElement('div');
      const typeLabel = quest.type === 'main' ? '主线' : quest.type === 'side' ? '支线' : '日常';
      const typeColor = quest.type === 'main' ? '#e74c3c' : quest.type === 'side' ? '#3498db' : '#f39c12';
      const npcName = this.getNpcDisplayNameForQuest(quest.npcId);
      const acceptMethod = this.getQuestAcceptMethod(quest);

      let rewardHtml = '';
      if (quest.rewards.gold) rewardHtml += `<span style="color:#ffd700;">💰${quest.rewards.gold}</span> `;
      if (quest.rewards.crystal) rewardHtml += `<span style="color:#bb86fc;">💎${quest.rewards.crystal}</span> `;

      card.style.cssText = `
        padding: 14px 16px; border-radius: 10px; margin-bottom: 8px;
        background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      `;
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:11px;color:${typeColor};background:${typeColor}22;padding:2px 8px;border-radius:4px;font-weight:600;">${typeLabel}</span>
          <span style="font-size:14px;font-weight:600;color:#eee;">${quest.name}</span>
        </div>
        <div style="font-size:12px;color:#999;margin-bottom:6px;">${quest.description}</div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:11px;">
          <span style="color:#7c8cf8;">📍 ${npcName}</span>
          <span style="color:#888;">🔗 ${acceptMethod}</span>
          ${rewardHtml ? `<span>${rewardHtml}</span>` : ''}
        </div>
      `;
      container.appendChild(card);
    });
  }

  private renderInProgressQuests(container: HTMLElement): void {
    const inProgress = this.questDefinitions.filter(q => this.questStates.get(q.id)?.status === 'inProgress');
    if (inProgress.length === 0) { container.innerHTML = '<div style="text-align:center;color:#666;padding:40px;">暂无进行中的任务</div>'; return; }

    inProgress.forEach(quest => {
      const state = this.questStates.get(quest.id)!;
      const typeLabel = quest.type === 'main' ? '主线' : quest.type === 'side' ? '支线' : '日常';
      const typeColor = quest.type === 'main' ? '#e74c3c' : quest.type === 'side' ? '#3498db' : '#f39c12';

      const card = document.createElement('div');
      card.style.cssText = `
        padding: 14px 16px; border-radius: 10px; margin-bottom: 8px;
        background: rgba(102,126,234,0.06); border: 1px solid rgba(102,126,234,0.2);
      `;

      let objHtml = quest.objectives.map((obj, i) => {
        const cur = state.objectives[i]?.currentAmount || 0;
        const done = cur >= obj.requiredAmount;
        const pct = Math.min(100, Math.round((cur / obj.requiredAmount) * 100));
        return `
          <div style="margin-top:6px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:${done ? '#2ecc71' : '#ccc'};">
              <span>${done ? '✅' : '⬜'} ${obj.description}</span>
              <span>${cur}/${obj.requiredAmount}</span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:3px;">
              <div style="height:100%;width:${pct}%;background:${done ? '#2ecc71' : '#7c8cf8'};border-radius:2px;transition:width 0.3s;"></div>
            </div>
          </div>
        `;
      }).join('');

      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:11px;color:${typeColor};background:${typeColor}22;padding:2px 8px;border-radius:4px;font-weight:600;">${typeLabel}</span>
          <span style="font-size:14px;font-weight:600;color:#eee;">${quest.name}</span>
        </div>
        <div style="font-size:12px;color:#999;">${quest.description}</div>
        ${objHtml}
      `;
      container.appendChild(card);
    });
  }

  private renderCompletedQuests(container: HTMLElement): void {
    const completed = this.questDefinitions.filter(q => this.questStates.get(q.id)?.status === 'completed');
    if (completed.length === 0) { container.innerHTML = '<div style="text-align:center;color:#666;padding:40px;">暂无已完成的任务</div>'; return; }

    completed.forEach(quest => {
      const state = this.questStates.get(quest.id)!;
      const typeLabel = quest.type === 'main' ? '主线' : quest.type === 'side' ? '支线' : '日常';
      const typeColor = quest.type === 'main' ? '#e74c3c' : quest.type === 'side' ? '#3498db' : '#f39c12';
      const completedTime = state.completedAt ? new Date(state.completedAt).toLocaleString('zh-CN') : '';

      let rewardHtml = '';
      if (quest.rewards.gold) rewardHtml += `<span style="color:#ffd700;">💰${quest.rewards.gold}</span> `;
      if (quest.rewards.crystal) rewardHtml += `<span style="color:#bb86fc;">💎${quest.rewards.crystal}</span> `;
      if (quest.rewards.items) quest.rewards.items.forEach(item => { rewardHtml += `<span style="color:#aaa;">🎁${this.getItemName(item.itemId)} x${item.quantity}</span> `; });
      if (quest.rewards.cards) quest.rewards.cards.forEach(card => { rewardHtml += `<span style="color:#ff69b4;">🎴${card.holographic ? '闪卡' : '卡牌'}</span> `; });

      const card = document.createElement('div');
      card.style.cssText = `
        padding: 14px 16px; border-radius: 10px; margin-bottom: 8px;
        background: rgba(46,204,113,0.05); border: 1px solid rgba(46,204,113,0.15);
        opacity: 0.85;
      `;
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:14px;">✅</span>
          <span style="font-size:11px;color:${typeColor};background:${typeColor}22;padding:2px 8px;border-radius:4px;font-weight:600;">${typeLabel}</span>
          <span style="font-size:14px;font-weight:600;color:#aaa;">${quest.name}</span>
          ${completedTime ? `<span style="margin-left:auto;font-size:11px;color:#666;">${completedTime}</span>` : ''}
        </div>
        <div style="font-size:12px;color:#777;">${quest.description}</div>
        ${rewardHtml ? `<div style="margin-top:4px;font-size:11px;">奖励: ${rewardHtml}</div>` : ''}
      `;
      container.appendChild(card);
    });
  }

  private createQuestCard(quest: QuestDefinition, onUpdate?: () => void): HTMLDivElement {
    const state = this.questStates.get(quest.id);
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(255, 255, 255, 1); border-radius: 12px; padding: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); cursor: pointer; transition: all 0.3s ease;
      border: 2px solid transparent; display: flex; flex-direction: column; gap: 8px;
    `;

    // Type badge
    const typeColors: Record<string, string> = { main: '#667eea', side: '#28a745', daily: '#ffc107' };
    const typeLabels: Record<string, string> = { main: '主线', side: '支线', daily: '日常' };
    const badge = document.createElement('div');
    badge.textContent = typeLabels[quest.type] || quest.type;
    badge.style.cssText = `
      display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px;
      font-weight: bold; color: white; background: ${typeColors[quest.type] || '#999'};
      align-self: flex-start; margin-bottom: 4px;
    `;
    card.appendChild(badge);

    const name = document.createElement('div');
    name.textContent = quest.name;
    name.style.cssText = 'font-size: 16px; font-weight: bold; color: #333; margin-bottom: 4px;';
    card.appendChild(name);

    const description = document.createElement('div');
    description.textContent = quest.description;
    description.style.cssText = 'font-size: 12px; color: #666; line-height: 1.4; margin-bottom: 8px;';
    card.appendChild(description);

    // Objectives with progress
    quest.objectives.forEach((obj, i) => {
      const current = state ? state.objectives[i].currentAmount : 0;
      const objDiv = document.createElement('div');
      objDiv.style.cssText = 'font-size: 11px; color: #333; margin-bottom: 4px;';
      const done = current >= obj.requiredAmount;
      objDiv.innerHTML = `${done ? '✅' : '⬜'} ${obj.description} <span style="color: ${done ? '#28a745' : '#667eea'}; font-weight: bold;">${current}/${obj.requiredAmount}</span>`;
      card.appendChild(objDiv);
    });

    // Rewards
    const rewardParts: string[] = [];
    if (quest.rewards.gold) rewardParts.push(`${quest.rewards.gold}金币`);
    if (quest.rewards.crystal) rewardParts.push(`${quest.rewards.crystal}水晶`);
    if (quest.rewards.items) quest.rewards.items.forEach(item => rewardParts.push(`${this.getItemName(item.itemId)} x${item.quantity}`));
    if (quest.rewards.cards) quest.rewards.cards.forEach(card => { const cardData = this.cardSystem.getCard(card.cardId); const cardName = cardData ? cardData.name : card.cardId; rewardParts.push(`${card.holographic ? '闪卡' : '卡牌'}：${cardName}`); });
    if (rewardParts.length > 0) {
      const rewards = document.createElement('div');
      rewards.innerHTML = `<strong>奖励:</strong> ${rewardParts.join('、')}`;
      rewards.style.cssText = 'font-size: 11px; color: #28a745; margin-bottom: 8px;';
      card.appendChild(rewards);
    }

    // Action buttons
    if (state?.status === 'available' && quest.type !== 'main') {
      const acceptBtn = document.createElement('button');
      acceptBtn.textContent = '接受';
      acceptBtn.style.cssText = `
        padding: 8px; background: #28a745; border: none; border-radius: 6px;
        color: white; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.2s; margin-top: auto;
      `;
      acceptBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.acceptQuest(quest.id);
        if (onUpdate) onUpdate();
      });
      card.appendChild(acceptBtn);
    } else if (state?.status === 'inProgress') {
      const allComplete = quest.objectives.every((obj, i) => state.objectives[i].currentAmount >= obj.requiredAmount);
      if (allComplete && quest.type !== 'main') {
        const completeBtn = document.createElement('button');
        completeBtn.textContent = '完成';
        completeBtn.style.cssText = `
          padding: 8px; background: #ffc107; border: none; border-radius: 6px;
          color: #333; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.2s; margin-top: auto;
        `;
        completeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.completeQuest(quest.id, onUpdate);
        });
        card.appendChild(completeBtn);
      }
    }

    card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-4px)'; card.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.15)'; card.style.borderColor = '#667eea'; });
    card.addEventListener('mouseleave', () => { card.style.transform = 'translateY(0)'; card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'; card.style.borderColor = 'transparent'; });
    card.addEventListener('click', () => { this.showQuestDetails(quest); });

    return card;
  }

  private showQuestDetails(quest: QuestDefinition): void {
    const actionPanel = document.getElementById('action-panel');
    if (!actionPanel) return;
    const state = this.questStates.get(quest.id);

    const typeLabels: Record<string, string> = { main: '主线任务', side: '支线任务', daily: '日常任务' };
    const rewardParts: string[] = [];
    if (quest.rewards.gold) rewardParts.push(`${quest.rewards.gold} 金币`);
    if (quest.rewards.crystal) rewardParts.push(`${quest.rewards.crystal} 水晶`);
    if (quest.rewards.items) quest.rewards.items.forEach(item => rewardParts.push(`${this.getItemName(item.itemId)} x${item.quantity}`));
    if (quest.rewards.cards) quest.rewards.cards.forEach(card => { const cardData = this.cardSystem.getCard(card.cardId); const cardName = cardData ? cardData.name : card.cardId; rewardParts.push(`${card.holographic ? '闪卡' : '卡牌'}：${cardName}`); });

    let objectivesHtml = quest.objectives.map((obj, i) => {
      const current = state ? state.objectives[i].currentAmount : 0;
      const done = current >= obj.requiredAmount;
      return `<div style="margin-bottom: 8px;">
        <div style="font-size: 13px; color: #333;">${done ? '✅' : '⬜'} ${obj.description}</div>
        <div style="background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 4px;">
          <div style="background: ${done ? '#28a745' : '#667eea'}; height: 100%; width: ${Math.min(100, (current / obj.requiredAmount) * 100)}%; transition: width 0.3s;"></div>
        </div>
        <div style="font-size: 11px; color: #999; text-align: right;">${current}/${obj.requiredAmount}</div>
      </div>`;
    }).join('');

    actionPanel.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">任务详情</h3>
      <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <div style="font-size: 11px; color: #667eea; margin-bottom: 4px;">${typeLabels[quest.type] || quest.type}</div>
        <h4 style="margin: 0 0 12px 0; color: #667eea; font-size: 20px;">${quest.name}</h4>
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; color: #999; margin-bottom: 4px;">任务描述</div>
          <div style="font-size: 14px; color: #333; line-height: 1.6;">${quest.description}</div>
        </div>
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; color: #999; margin-bottom: 4px;">任务目标</div>
          ${objectivesHtml}
        </div>
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; color: #999; margin-bottom: 4px;">任务奖励</div>
          <div style="font-size: 14px; color: #28a745; font-weight: bold;">${rewardParts.join('、') || '无'}</div>
        </div>
      </div>
    `;
  }

  private completeQuest(questId: string, onUpdate?: () => void): void {
    const state = this.questStates.get(questId);
    if (!state || state.status !== 'inProgress') return;

    const def = this.questDefinitions.find(q => q.id === questId);
    if (!def) return;

    state.status = 'completed';
    state.completedAt = Date.now();

    let rewardMessages: string[] = [];

    // Award gold
    if (def.rewards.gold && this.playerEntity) {
      const result = this.currencySystem.addCurrency(
        this.world, this.playerEntity.id,
        { gold: def.rewards.gold }, `完成任务: ${def.name}`
      );
      if (result.success) {
        rewardMessages.push(`${def.rewards.gold} 金币`);
        this.updateCurrencyDisplay();
        this.eventSystem.emit({ type: 'currency:changed', timestamp: Date.now() });
      }
    }

    // Award crystal
    if (def.rewards.crystal && this.playerEntity) {
      const result = this.currencySystem.addCurrency(
        this.world, this.playerEntity.id,
        { crystal: def.rewards.crystal }, `完成任务: ${def.name}`
      );
      if (result.success) {
        rewardMessages.push(`${def.rewards.crystal} 水晶`);
        this.updateCurrencyDisplay();
        this.eventSystem.emit({ type: 'currency:changed', timestamp: Date.now() });
      }
    }

    // Award items
    if (def.rewards.items) {
      for (const reward of def.rewards.items) {
        const success = this.itemSystem.addItem(reward.itemId, reward.quantity);
        if (success) {
          const itemName = this.getItemName(reward.itemId);
          rewardMessages.push(`${itemName} x${reward.quantity}`);
        }
      }
    }

    // Award cards
    if (def.rewards.cards) {
      for (const cardReward of def.rewards.cards) {
        this.cardSystem.addCard(cardReward.cardId, cardReward.holographic);
        const card = this.cardSystem.getCard(cardReward.cardId);
        const cardName = card ? card.name : cardReward.cardId;
        const cardType = cardReward.holographic ? '闪卡' : '卡牌';
        rewardMessages.push(`${cardType}：${cardName}`);
      }
    }

    // Unlock NPC
    if (def.rewards.unlockNpc) {
      const npcIds = Array.isArray(def.rewards.unlockNpc) ? def.rewards.unlockNpc : [def.rewards.unlockNpc];
      for (const npcId of npcIds) {
        this.lockedNPCs.delete(npcId);
        const npc = this.npcSystem.getNPC(npcId);
        const npcName = npc ? (npc.title || '') + npc.name : npcId;
        this.showNotification(`🔓 ${npcName} 已解锁！`, 'success', 5000);
      }
      // Refresh scene to show newly unlocked NPCs (only in village)
      if (this.isNonCombatStage(this.currentStage)) {
        this.reloadCurrentScene();
      }
    }

    // Unlock stage
    if (def.rewards.unlockStage) {
      this.unlockStage(def.rewards.unlockStage);
    }

    // Unlock feature (e.g., card-collection)
    if (def.rewards.unlockFeature) {
      this.lockedButtons.delete(def.rewards.unlockFeature);
      const featureNames: Record<string, string> = {
        'card-collection': '卡牌图鉴'
      };
      const featureName = featureNames[def.rewards.unlockFeature] || def.rewards.unlockFeature;
      this.showNotification(`🔓 ${featureName} 已解锁！`, 'success', 5000);
      // Show the button if it was hidden
      const btn = document.getElementById(`${def.rewards.unlockFeature}-btn`);
      if (btn) {
        btn.style.display = '';
      }
    }

    // Award affinity bonus
    if (def.rewards.affinityBonus) {
      for (const bonus of def.rewards.affinityBonus) {
        const npc = this.npcSystem.getNPC(bonus.npcId) || this.npcSystem.getRecruitedCharacter(bonus.npcId);
        if (npc) {
          const oldAffinity = npc.affinity || 0;
          const newAffinity = Math.min(100, oldAffinity + bonus.amount);
          npc.affinity = newAffinity;
          const npcName = (npc.title || '') + npc.name;
          rewardMessages.push(`${npcName}好感度+${bonus.amount}`);
          // Check and apply affinity threshold rewards
          this.checkAffinityRewards(bonus.npcId, newAffinity);
        }
      }
    }

    // Main quest chain progression: auto-accept next main quest
    if (def.type === 'main') {
      for (const q of this.questDefinitions) {
        if (q.type !== 'main') continue;
        const qState = this.questStates.get(q.id);
        if (qState && (qState.status === 'locked' || qState.status === 'available') && this.isQuestAvailable(q)) {
          qState.status = 'inProgress';
        }
      }

      // Check if all main quests are completed
      const allMainDone = this.questDefinitions
        .filter(q => q.type === 'main')
        .every(q => this.questStates.get(q.id)?.status === 'completed');
      if (allMainDone) {
        setTimeout(() => {
          this.showNotification('🎉 你已经掌握基础操作啦~开始你的冒险吧！', 'success', 8000);
        }, 1500);
      }
    }

    if (rewardMessages.length > 0) {
      this.showNotification(`任务完成！获得 ${rewardMessages.join('、')}`, 'success');
    } else {
      this.showNotification(`任务完成！`, 'success');
    }

    this.updateQuestRedDots();
    if (onUpdate) onUpdate();
  }


  private unlockStage(stageId: string): void {
    if (this.unlockedStages.has(stageId)) return; // Already unlocked
    
    this.unlockedStages.add(stageId);
    this.updateStagePanel();
    
    // Show notification
    const stageNames: Record<string, string> = {
      grassland: '草原',
      forest: '森林'
    };
    const stageName = stageNames[stageId] || stageId;
    this.showNotification(`🎉 新关卡已解锁：${stageName}！`, 'success', 5000);
  }

  private updateStagePanel(): void {
    const stageList = document.getElementById('stage-list');
    if (!stageList) return;
    
    const stages = [
      { id: 'village', name: '村庄', icon: '🏘️', description: '起始地点' },
      { id: 'grassland', name: '草原', icon: '🌾', description: '广阔的草原' },
      { id: 'forest', name: '森林', icon: '🌲', description: '神秘的森林' },
      { id: 'cave', name: '洞穴', icon: '🕳️', description: '黑暗的洞穴' }
    ];
    
    stageList.innerHTML = '';
    
    stages.forEach(stage => {
      const isUnlocked = this.unlockedStages.has(stage.id);
      const isActive = stage.id === this.currentStage;
      const stageItem = document.createElement('div');
      stageItem.className = 'stage-item';
      stageItem.setAttribute('data-stage', stage.id);
      stageItem.style.cssText = `
        padding: 12px;
        background: ${isActive ? 'rgba(40, 167, 69, 0.8)' : '#f0f0f0'};
        border-radius: 8px;
        cursor: ${isUnlocked ? 'pointer' : 'not-allowed'};
        transition: all 0.2s;
        opacity: ${isUnlocked ? '1' : '0.5'};
      `;
      
      stageItem.innerHTML = `
        <div style="font-weight: bold; color: #333;">${stage.icon} ${stage.name}</div>
        <div style="font-size: 12px; color: #333;">${isUnlocked ? stage.description : '未解锁'}</div>
      `;
      
      if (isUnlocked) {
        stageItem.addEventListener('click', () => {
          this.switchStage(stage.id);
        });
        
        stageItem.addEventListener('mouseenter', () => {
          // Only apply hover effect if not the current stage
          if (stage.id !== this.currentStage) {
            stageItem.style.background = '#e0e0e0';
          }
        });
        
        stageItem.addEventListener('mouseleave', () => {
          // Restore background based on whether it's the current stage
          if (stage.id === this.currentStage) {
            stageItem.style.background = 'rgba(40, 167, 69, 0.8)';
          } else {
            stageItem.style.background = '#f0f0f0';
          }
        });
      }
      
      stageList.appendChild(stageItem);
    });
  }

  private switchStage(stageId: string): void {
    if (!this.unlockedStages.has(stageId)) {
      this.showNotification('该关卡尚未解锁', 'warning');
      return;
    }
    
    if (this.currentStage === stageId) {
      return; // Already on this stage
    }
    
    // Only show loot warning when leaving non-village stages
    if (this.isCombatStage(this.currentStage)) {
      // Check if loot inventory has items (not team bag)
      const lootInventory = this.lootSystem.getLootInventory();
      if (lootInventory.size > 0) {
        // Show confirmation dialog
        this.showLootWarningDialog(stageId);
        return; // Don't proceed with switch yet
      }
      
      // No items in loot inventory, but check if team bag has items
      const teamBagInventory = this.lootSystem.getTeamBagInventory();
      if (teamBagInventory.size > 0) {
        // Automatically transfer team bag items to warehouse
        this.transferTeamBagToInventory();
      }
    }
    
    // No items in loot inventory or leaving from village, switch directly
    this.performStageSwitch(stageId);
  }
  
  /**
   * Show warning dialog when leaving with loot items
   */
  private showLootWarningDialog(targetStageId: string): void {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-out;
    `;

    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 30px;
      max-width: 450px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s ease-out;
    `;

    // Count total items
    const lootInventory = this.lootSystem.getLootInventory();
    let totalItems = 0;
    lootInventory.forEach(quantity => {
      totalItems += quantity;
    });

    dialog.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
        <h2 style="margin: 0 0 10px 0; color: #333; font-size: 24px;">战利品提醒</h2>
        <p style="color: #666; line-height: 1.6; margin: 0;">
          战利品界面中还有 <strong style="color: #e74c3c;">${totalItems}</strong> 件物品未添加到团队背包！
        </p>
        <p style="color: #666; line-height: 1.6; margin: 10px 0 0 0;">
          只有添加到团队背包的物品才能带走，<br>
          否则战利品界面中的物品将会<strong style="color: #e74c3c;">永久消失</strong>。
        </p>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 25px;">
        <button id="stay-button" style="
          flex: 1;
          padding: 12px 24px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        ">留下</button>
        <button id="leave-button" style="
          flex: 1;
          padding: 12px 24px;
          background: #95a5a6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        ">直接离开</button>
      </div>
    `;

    // Add CSS animations
    if (!document.getElementById('loot-warning-animations')) {
      const style = document.createElement('style');
      style.id = 'loot-warning-animations';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Add button hover effects
    const stayButton = dialog.querySelector('#stay-button') as HTMLButtonElement;
    const leaveButton = dialog.querySelector('#leave-button') as HTMLButtonElement;

    stayButton.addEventListener('mouseenter', () => {
      stayButton.style.background = '#2980b9';
      stayButton.style.transform = 'translateY(-2px)';
    });
    stayButton.addEventListener('mouseleave', () => {
      stayButton.style.background = '#3498db';
      stayButton.style.transform = 'translateY(0)';
    });

    leaveButton.addEventListener('mouseenter', () => {
      leaveButton.style.background = '#7f8c8d';
      leaveButton.style.transform = 'translateY(-2px)';
    });
    leaveButton.addEventListener('mouseleave', () => {
      leaveButton.style.background = '#95a5a6';
      leaveButton.style.transform = 'translateY(0)';
    });

    // Stay button - close dialog
    stayButton.addEventListener('click', () => {
      overlay.remove();
      this.showNotification('已取消切换关卡', 'success');
    });

    // Leave button - proceed with stage switch and clear loot
    leaveButton.addEventListener('click', () => {
      overlay.remove();
      
      // Transfer team bag items to warehouse first
      this.transferTeamBagToInventory();
      
      // Then clear all loot (both dropped loots and loot inventory)
      this.lootSystem.clearAllLoot();
      this.updateLootPanel(); // Update loot panel display
      
      // Finally switch stage
      this.performStageSwitch(targetStageId);
      this.showNotification(`战利品已清空，已切换到新关卡`, 'warning');
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        this.showNotification('已取消切换关卡', 'success');
      }
    });
  }
  
  /**
   * Show confirmation dialog for stage change
   */
  private showStageChangeConfirmation(targetStageId: string): void {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = '结束探索';
    title.style.cssText = `
      margin: 0 0 16px 0;
      color: #333;
      font-size: 18px;
      text-align: center;
    `;
    dialog.appendChild(title);
    
    // Message
    const message = document.createElement('p');
    message.textContent = '要结束该次探索吗？团队背包中的物品会被转移至仓库中';
    message.style.cssText = `
      margin: 0 0 24px 0;
      color: #666;
      font-size: 14px;
      line-height: 1.6;
      text-align: center;
    `;
    dialog.appendChild(message);
    
    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: center;
    `;
    
    // Cancel button (留下)
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '留下';
    cancelBtn.style.cssText = `
      padding: 10px 24px;
      background: #e0e0e0;
      border: none;
      border-radius: 6px;
      color: #333;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = '#d0d0d0';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = '#e0e0e0';
    });
    cancelBtn.addEventListener('click', () => {
      overlay.remove();
    });
    buttonContainer.appendChild(cancelBtn);
    
    // Confirm button (确定)
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '确定';
    confirmBtn.style.cssText = `
      padding: 10px 24px;
      background: #667eea;
      border: none;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    confirmBtn.addEventListener('mouseenter', () => {
      confirmBtn.style.background = '#5568d3';
    });
    confirmBtn.addEventListener('mouseleave', () => {
      confirmBtn.style.background = '#667eea';
    });
    confirmBtn.addEventListener('click', () => {
      // Transfer team bag items to global inventory
      this.transferTeamBagToInventory();
      // Remove dialog
      overlay.remove();
      // Perform stage switch
      this.performStageSwitch(targetStageId);
    });
    buttonContainer.appendChild(confirmBtn);
    
    dialog.appendChild(buttonContainer);
    overlay.appendChild(dialog);
    
    // Add to document
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }
  
  /**
   * Transfer all items from team bag to global inventory
   */
  private transferTeamBagToInventory(): void {
    const teamBagInventory = this.lootSystem.getTeamBagInventory();
    let totalItems = 0;
    
    teamBagInventory.forEach((quantity, itemId) => {
      this.itemSystem.addItem(itemId, quantity);
      totalItems += quantity;
    });
    
    // Clear team bag
    teamBagInventory.clear();
    
    // Update displays
    this.updateTeamInventoryDisplay();
    
    if (totalItems > 0) {
      this.showNotification(`已将 ${totalItems} 件物品转移至仓库`, 'success');
    }
  }
  
  /**
   * Perform the actual stage switch
   */
  private performStageSwitch(stageId: string): void {
    // Disconnect ResizeObserver to prevent stale callbacks from overwriting the action panel
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clear action panel to prevent stale content from previous stage
    this.clearActionPanel();

    // Cleanup battle scene before switching (for all battle stages)
    if (this.isCombatStage(this.currentStage)) {
      this.cleanupBattleScene();
    }
    
    // Stop adventurer spawning and clear wandering adventurers when leaving village
    this.stopAdventurerSpawning();
    
    this.currentStage = stageId;
    
    // Update battle system's current stage for resource node drops
    this.battleSystem.setCurrentStage(stageId);
    
    // Clear party slots when switching stages
    for (let i = 0; i < this.partySlots.length; i++) {
      this.partySlots[i] = null;
    }
    this.refreshPartySlots();
    this.updateBattleSystemPartyMembers();
    
    const stageNames: Record<string, string> = {
      village: '村庄',
      grassland: '草原',
      forest: '森林',
      cave: '洞穴'
    };
    
    this.showNotification(`已切换到${stageNames[stageId]}，编队已清空`, 'success');
    
    // Update stage button styles to reflect current stage
    this.updateStageButtonStyles();
    
    // Update scene buttons visibility and load appropriate scene
    this.updateSceneButtons();
    this.loadStageDefaultScene();
    
    // Update quest tracker visibility based on stage
    this.updateQuestTracker();
  }
  
  private updateStageButtonStyles(): void {
    const stageItems = document.querySelectorAll('.stage-item');
    stageItems.forEach(item => {
      const stageId = (item as HTMLElement).getAttribute('data-stage');
      if (stageId) {
        if (stageId === this.currentStage) {
          // Active stage - green background
          (item as HTMLElement).style.background = 'rgba(40, 167, 69, 0.8)';
        } else if (this.unlockedStages.has(stageId)) {
          // Unlocked but not active - white/light gray background
          (item as HTMLElement).style.background = '#f0f0f0';
        }
        // Locked stages keep their existing style (opacity: 0.5)
      }
    });
  }

  private updateSceneButtons(): void {
    const buttonContainer = document.querySelector('#stage-area .location-button')?.parentElement;
    if (!buttonContainer) return;
    
    // Village scenes (only show in village stage)
    const villageScenes = ['square', 'tavern', 'market', 'farm', 'camp'];
    
    buttonContainer.querySelectorAll('.location-button').forEach(button => {
      const location = (button as HTMLElement).getAttribute('data-location');
      if (location) {
        if (this.isNonCombatStage(this.currentStage)) {
          // Show village scene buttons
          if (villageScenes.includes(location)) {
            (button as HTMLElement).style.display = 'block';
          }
        } else {
          // Hide village scene buttons in other stages
          if (villageScenes.includes(location)) {
            (button as HTMLElement).style.display = 'none';
          }
        }
      }
    });
  }

  private loadStageDefaultScene(): void {
    if (!this.sceneContainer) return;
    
    // Clear scene
    this.clearSceneContainer();
    
    // Set background based on stage
    const stageBackgrounds: Record<string, string> = {
      village: '', // Village uses scene-specific backgrounds
      grassland: 'images/changjing_caoyuan.png',
      forest: 'images/changjing_senlin.png',
      cave: 'images/changjing_dongxue.png'
    };
    
    if (this.isNonCombatStage(this.currentStage)) {
      // Load default village scene (square)
      this.currentScene = 'square';
      this.switchScene('square');
    } else {
      // Load stage background
      const backgroundImage = stageBackgrounds[this.currentStage];
      if (backgroundImage) {
        this.sceneContainer.style.backgroundImage = `url('${backgroundImage}')`;
        this.sceneContainer.style.backgroundSize = 'cover';
        this.sceneContainer.style.backgroundPosition = 'center';
        this.sceneContainer.style.backgroundRepeat = 'no-repeat';
      }
      
      // Load exploration panel for grassland, forest, and cave
      if (this.isCurrentStageCombat()) {
        this.loadExplorationPanel();
      }
    }
  }

  private loadExplorationPanel(): void {
    const actionPanel = document.getElementById('action-panel');
    if (!actionPanel) return;
    
    actionPanel.innerHTML = '';
    
    // Create party formation section (top half)
    const partySection = document.createElement('div');
    partySection.style.cssText = `
      height: calc(50% - 8px);
      background: white;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      overflow-y: auto;
    `;
    
    // Header with title and auto-party button
    const headerContainer = document.createElement('div');
    headerContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    `;
    
    const partyTitle = document.createElement('h4');
    partyTitle.textContent = '编队界面';
    partyTitle.style.cssText = `
      margin: 0;
      color: white;
      font-size: 16px;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;
    
    const autoPartyBtn = document.createElement('button');
    autoPartyBtn.id = 'auto-party-btn';
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
    
    // Create party slots container
    const slotsContainer = document.createElement('div');
    slotsContainer.id = 'party-slots-container';
    slotsContainer.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    `;
    
    // Create 4 party slots
    for (let i = 0; i < 4; i++) {
      const slot = this.createPartySlot(i);
      slotsContainer.appendChild(slot);
    }
    
    partySection.appendChild(slotsContainer);
    
    // Initially disable party section until battle starts
    this.setPartyPanelEnabled(false);
    
    // Create split inventory container (horizontal layout) - bottom half
    const splitInventoryContainer = document.createElement('div');
    splitInventoryContainer.style.cssText = `
      height: calc(50% - 8px);
      display: flex;
      flex-direction: row;
      gap: 12px;
    `;
    
    // Left section - Loot (战利品)
    const lootSection = document.createElement('div');
    lootSection.id = 'loot-panel';
    lootSection.style.cssText = `
      flex: 1;
      background: white;
      border-radius: 12px;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    `;
    
    const lootTitle = document.createElement('div');
    lootTitle.textContent = '战利品';
    lootTitle.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      color: #ffc107;
      margin-bottom: 12px;
      text-align: center;
    `;
    lootSection.appendChild(lootTitle);
    
    const lootContent = document.createElement('div');
    lootContent.id = 'loot-content';
    lootContent.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      flex: 1;
      align-content: start;
    `;
    lootSection.appendChild(lootContent);
    
    // Right section - Team Inventory (团队背包)
    const teamInventorySection = document.createElement('div');
    teamInventorySection.id = 'team-inventory-panel';
    teamInventorySection.style.cssText = `
      flex: 1;
      background: white;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    const teamInventoryTitle = document.createElement('div');
    teamInventoryTitle.textContent = '团队背包';
    teamInventoryTitle.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 12px;
      text-align: center;
      flex-shrink: 0;
    `;
    teamInventorySection.appendChild(teamInventoryTitle);
    
    const teamInventoryContent = document.createElement('div');
    teamInventoryContent.id = 'team-inventory-content';
    teamInventoryContent.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      flex: 1;
      align-content: start;
      overflow-y: auto;
      min-height: 0;
    `;
    teamInventorySection.appendChild(teamInventoryContent);
    
    // Add weight capacity progress bar at the bottom
    const weightBarContainer = document.createElement('div');
    weightBarContainer.style.cssText = `
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e0e0e0;
      flex-shrink: 0;
    `;
    
    const weightLabel = document.createElement('div');
    weightLabel.id = 'team-bag-weight-label';
    weightLabel.style.cssText = `
      font-size: 12px;
      color: #666;
      margin-bottom: 6px;
      text-align: center;
    `;
    weightLabel.textContent = '负重: 0 / 0';
    weightBarContainer.appendChild(weightLabel);
    
    const weightBarBg = document.createElement('div');
    weightBarBg.style.cssText = `
      width: 100%;
      height: 20px;
      background: #e0e0e0;
      border-radius: 10px;
      overflow: hidden;
      position: relative;
    `;
    
    const weightBarFill = document.createElement('div');
    weightBarFill.id = 'team-bag-weight-bar';
    weightBarFill.style.cssText = `
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #4caf50, #8bc34a);
      transition: all 0.3s ease;
      border-radius: 10px;
    `;
    weightBarBg.appendChild(weightBarFill);
    weightBarContainer.appendChild(weightBarBg);
    
    teamInventorySection.appendChild(weightBarContainer);
    
    splitInventoryContainer.appendChild(lootSection);
    splitInventoryContainer.appendChild(teamInventorySection);
    
    // Initial update of both panels
    this.updateLootPanelDisplay();
    this.updateTeamInventoryDisplay();
    
    actionPanel.appendChild(partySection);
    actionPanel.appendChild(splitInventoryContainer);
    
    // Initialize battle scene in the main scene container (without starting spawning)
    this.initializeBattleSceneWithoutSpawning();
    
    // Show preparation panel for combat stages, or start battle immediately for non-combat stages
    if (this.isCurrentStageCombat()) {
      this.showPreparationPanel();
    } else {
      // For non-combat stages, start normally (though this shouldn't happen in exploration panel)
      this.onPreparationComplete();
    }
    
    // Update party members again after initialization to ensure they are set
    // This handles the case where characters were already in party slots before switching to grassland
    this.updateBattleSystemPartyMembers();
    
    // Start party slots update interval (update every 100ms for smooth updates)
    this.startPartyUpdateInterval();
  }

  private createPartySlot(slotIndex: number): HTMLDivElement {
    const slot = document.createElement('div');
    slot.className = 'party-slot';
    slot.setAttribute('data-slot-index', slotIndex.toString());
    slot.style.cssText = `
      background: #f8f9fa;
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 12px;
      min-height: 120px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
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

  private renderCharacterInSlot(slot: HTMLDivElement, character: any, slotIndex: number): void {
    slot.style.border = '2px solid #667eea';
    slot.style.background = 'white';
    slot.style.cursor = 'default';
    slot.style.position = 'relative'; // Add position relative for absolute positioning of X button
    slot.innerHTML = '';
    
    // Create horizontal layout container
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      gap: 8px;
      width: 100%;
      align-items: flex-start;
    `;
    
    // Left side - Avatar (with particle effects container)
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'avatar-container';
    avatarContainer.setAttribute('data-character-id', character.id);
    avatarContainer.style.cssText = `
      position: relative;
      width: 60px;
      height: 60px;
      flex-shrink: 0;
    `;
    
    // Particle effects layer (behind avatar)
    const particleLayer = document.createElement('div');
    particleLayer.className = 'particle-layer';
    particleLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    `;
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.cssText = `
      position: relative;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      z-index: 2;
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
      avatar.style.fontSize = '30px';
    }
    
    avatarContainer.appendChild(particleLayer);
    avatarContainer.appendChild(avatar);
    
    // Right side - Info and bars
    const infoContainer = document.createElement('div');
    infoContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    `;
    
    // Name and title
    const nameDiv = document.createElement('div');
    nameDiv.textContent = character.title ? `${character.title}${character.name}` : character.name;
    nameDiv.style.cssText = `
      font-size: 13px;
      font-weight: bold;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    
    // Level and job
    const infoDiv = document.createElement('div');
    infoDiv.className = 'character-level-job'; // Add class for easy selection
    infoDiv.textContent = `Lv.${character.level} ${this.getJobDisplayName(character.job)}`;
    infoDiv.style.cssText = `
      font-size: 10px;
      color: #666;
      margin-bottom: 2px;
    `;
    
    // Progress bars container
    const barsContainer = document.createElement('div');
    barsContainer.style.cssText = `
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 3px;
    `;
    
    // HP bar (green for adventurers)
    const hpBar = this.createProgressBar('HP', character.currentHP || character.maxHP, character.maxHP, '#28a745');
    // MP bar
    const mpBar = this.createProgressBar('MP', character.currentMP || 0, character.maxMP, '#007bff');
    // EXP bar
    const expBar = this.createProgressBar('EXP', character.currentEXP || 0, character.maxEXP || 100, '#ffc107');
    
    // Hunger bar (get from hunger component)
    const hungerComponent = this.world.getComponent(character.id, HungerComponentType);
    const currentHunger = hungerComponent ? hungerComponent.current : 0;
    const maxHunger = hungerComponent ? hungerComponent.maximum : 100;
    const hungerBar = this.createProgressBar('🍚', currentHunger, maxHunger, '#ff9800');
    
    barsContainer.appendChild(hpBar);
    barsContainer.appendChild(mpBar);
    barsContainer.appendChild(expBar);
    barsContainer.appendChild(hungerBar);
    
    infoContainer.appendChild(nameDiv);
    infoContainer.appendChild(infoDiv);
    infoContainer.appendChild(barsContainer);
    
    container.appendChild(avatarContainer);
    container.appendChild(infoContainer);
    
    // Add circular X button in top-right corner
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.style.cssText = `
      position: absolute;
      top: 4px;
      right: 4px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #dc3545;
      color: white;
      border: 2px solid white;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      line-height: 1;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      z-index: 10;
    `;
    removeBtn.addEventListener('mouseenter', () => {
      removeBtn.style.background = '#c82333';
      removeBtn.style.transform = 'scale(1.1)';
    });
    removeBtn.addEventListener('mouseleave', () => {
      removeBtn.style.background = '#dc3545';
      removeBtn.style.transform = 'scale(1)';
    });
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeCharacterFromSlot(slotIndex);
    });
    
    // Create BUFF icons container at the bottom
    const buffContainer = document.createElement('div');
    buffContainer.className = 'buff-icons-container';
    buffContainer.setAttribute('data-character-id', character.id);
    buffContainer.style.cssText = `
      display: flex;
      gap: 4px;
      margin-top: 6px;
      justify-content: flex-start;
      align-items: center;
      min-height: 32px;
    `;
    
    // Get active buffs for this character
    const activeBuffs = this.buffSystem.getActiveBuffs(character.id);
    activeBuffs.forEach(activeBuff => {
      const buffDef = this.buffSystem.getBuffDefinition(activeBuff.buffId);
      if (buffDef) {
        const buffIcon = this.createBuffIcon(buffDef, activeBuff.remainingDuration, buffDef.duration, activeBuff.stacks);
        buffContainer.appendChild(buffIcon);
      }
    });
    
    slot.appendChild(removeBtn);
    slot.appendChild(container);
    slot.appendChild(buffContainer);
    
    // Apply initial buff visual effects
    this.applyBuffVisualEffects(character.id, slot);
    
    // Add hover event to show full character details in a floating panel
    slot.addEventListener('mouseenter', () => {
      this.showPartySlotDetailPanel(character, slot);
    });
    slot.addEventListener('mouseleave', () => {
      this.hidePartySlotDetailPanel();
    });
  }

  /**
   * Create a buff icon with circular countdown timer
   */
  private createBuffIcon(buffDef: any, remainingDuration: number, totalDuration: number, stacks: number = 1): HTMLDivElement {
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
      position: relative;
      width: 32px;
      height: 32px;
      cursor: pointer;
    `;
    
    // Create SVG for circular progress
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '32');
    svg.setAttribute('height', '32');
    svg.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      transform: rotate(-90deg);
    `;
    
    // Background circle (dark)
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', '16');
    bgCircle.setAttribute('cy', '16');
    bgCircle.setAttribute('r', '14');
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', 'rgba(0, 0, 0, 0.3)');
    bgCircle.setAttribute('stroke-width', '3');
    
    // Progress circle (countdown)
    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircle.setAttribute('cx', '16');
    progressCircle.setAttribute('cy', '16');
    progressCircle.setAttribute('r', '14');
    progressCircle.setAttribute('fill', 'none');
    progressCircle.setAttribute('stroke', 'rgba(50, 205, 50, 0.9)');
    progressCircle.setAttribute('stroke-width', '3');
    
    const circumference = 2 * Math.PI * 14;
    const progress = remainingDuration / totalDuration;
    const offset = circumference * (1 - progress);
    
    progressCircle.setAttribute('stroke-dasharray', `${circumference}`);
    progressCircle.setAttribute('stroke-dashoffset', `${offset}`);
    progressCircle.style.transition = 'stroke-dashoffset 0.1s linear';
    
    svg.appendChild(bgCircle);
    svg.appendChild(progressCircle);
    
    // Buff icon image
    const icon = document.createElement('img');
    icon.src = buffDef.icon;
    icon.style.cssText = `
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    `;
    icon.onerror = () => {
      // Fallback if image doesn't load
      icon.style.display = 'none';
      iconContainer.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      iconContainer.style.borderRadius = '50%';
      iconContainer.style.display = 'flex';
      iconContainer.style.alignItems = 'center';
      iconContainer.style.justifyContent = 'center';
      iconContainer.style.fontSize = '16px';
      iconContainer.textContent = buffDef.name.charAt(0);
    };
    
    iconContainer.appendChild(svg);
    iconContainer.appendChild(icon);
    
    // Add stack count badge if stacks > 1
    if (stacks > 1) {
      const stackBadge = document.createElement('div');
      stackBadge.style.cssText = `
        position: absolute;
        bottom: -2px;
        right: -2px;
        background: rgba(255, 69, 0, 0.95);
        color: white;
        font-size: 10px;
        font-weight: bold;
        border-radius: 50%;
        width: 14px;
        height: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      `;
      stackBadge.textContent = stacks.toString();
      iconContainer.appendChild(stackBadge);
    }
    
    // Add hover events for custom tooltip
    iconContainer.addEventListener('mouseenter', (e) => {
      this.showBuffTooltip(buffDef, remainingDuration, stacks, e.currentTarget as HTMLElement);
    });
    iconContainer.addEventListener('mouseleave', () => {
      this.hideBuffTooltip();
    });
    
    // Store reference to icon for cleanup
    (iconContainer as any).__buffId = buffDef.id;
    
    return iconContainer;
  }

  private buffTooltip: HTMLDivElement | null = null;

  /**
   * Show a custom tooltip for a buff icon
   */
  private showBuffTooltip(buffDef: any, remainingDuration: number, stacks: number, anchorElement: HTMLElement): void {
    // Remove any existing tooltip
    this.hideBuffTooltip();

    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position: fixed;
      background: white;
      border: 2px solid #333;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      pointer-events: none;
      min-width: 180px;
      font-family: Arial, sans-serif;
    `;

    // Buff name
    const nameDiv = document.createElement('div');
    nameDiv.style.cssText = `
      font-weight: bold;
      font-size: 14px;
      color: #333;
      margin-bottom: 6px;
    `;
    nameDiv.textContent = buffDef.name;

    // Buff description
    const descDiv = document.createElement('div');
    descDiv.style.cssText = `
      font-size: 12px;
      color: #666;
      margin-bottom: 6px;
    `;
    descDiv.textContent = buffDef.description;
    
    // Stack count (if stackable and stacks > 1)
    if (buffDef.stackable && stacks > 1) {
      const stackDiv = document.createElement('div');
      stackDiv.style.cssText = `
        font-size: 12px;
        color: #ff4500;
        font-weight: bold;
        margin-bottom: 6px;
      `;
      stackDiv.textContent = `层数: ${stacks}/${buffDef.maxStacks}`;
      tooltip.appendChild(nameDiv);
      tooltip.appendChild(descDiv);
      tooltip.appendChild(stackDiv);
    } else {
      tooltip.appendChild(nameDiv);
      tooltip.appendChild(descDiv);
    }

    // Remaining duration
    const durationDiv = document.createElement('div');
    durationDiv.style.cssText = `
      font-size: 12px;
      color: #999;
      font-style: italic;
    `;
    durationDiv.textContent = `剩余时间: ${Math.ceil(remainingDuration)}秒`;

    tooltip.appendChild(durationDiv);

    // Position tooltip near the buff icon
    const rect = anchorElement.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 10}px`;
    tooltip.style.transform = 'translate(-50%, -100%)';

    document.body.appendChild(tooltip);
    this.buffTooltip = tooltip;
  }

  /**
   * Hide the buff tooltip
   */
  private hideBuffTooltip(): void {
    if (this.buffTooltip) {
      this.buffTooltip.remove();
      this.buffTooltip = null;
    }
  }

  // Track buff visual effect intervals
  private buffEffectIntervals: Map<string, number> = new Map();
  
  // Store pre-hunger BUFF stats for restoration when hunger BUFF is removed
  private hungerPreBuffStats: Map<string, { moveSpeed: number; attack: number; hpRegen: number; mpRegen: number }> = new Map();

  /**
   * Check and apply/remove hunger BUFF based on character's current hunger value
   * hunger ≤ 0 → apply hunger BUFF; hunger > 0 → remove hunger BUFF
   */
  private checkHungerBuff(characterId: string, currentHunger: number): void {
    const hasHungerBuff = this.buffSystem.hasBuff(characterId, 'hunger');
    const character = this.npcSystem.getRecruitedCharacter(characterId);
    
    if (currentHunger <= 0 && !hasHungerBuff) {
      // Apply hunger BUFF (duration is very long since it's condition-based)
      this.buffSystem.applyBuff(characterId, 'hunger', 999999);
    } else if (currentHunger <= 0 && hasHungerBuff && character) {
      // Character already has hunger BUFF, but ensure effects are applied
      // This handles cases where character enters battle with existing hunger BUFF
      if (!this.hungerPreBuffStats.has(characterId)) {
        this.hungerPreBuffStats.set(characterId, {
          moveSpeed: character.moveSpeed,
          attack: character.attack,
          hpRegen: character.hpRegen,
          mpRegen: character.mpRegen
        });
        character.moveSpeed = 0;
        character.attack = Math.round(character.attack * 0.25);
        character.hpRegen = 0;
        character.mpRegen = 0;
        console.log(`[GameUI] Hunger BUFF effects re-applied to ${character.name}: moveSpeed=0, attack*0.25, hpRegen=0, mpRegen=0`);
      }
    } else if (currentHunger > 0 && hasHungerBuff) {
      // Remove hunger BUFF
      this.buffSystem.removeBuff(characterId, 'hunger');
    }
  }

  /**
   * Start the global hunger decay timer
   * Reduces all recruited characters' hunger by 0.1 per second (reduced by 50% from original 0.2)
   */
  private startHungerDecay(): void {
    if (this.hungerDecayInterval) {
      clearInterval(this.hungerDecayInterval);
    }
    
    const HUNGER_DECAY_RATE = 0.1; // per second (reduced by 50% from 0.2)
    const TICK_INTERVAL = 1000; // 1 second
    
    this.hungerDecayInterval = window.setInterval(() => {
      // Only decay hunger during combat stages (grassland, forest, cave)
      // Also skip when preparation panel is open (pre-battle)
      if (!this.isCurrentStageCombat() || this.preparationPanel) return;
      
      // Only decay hunger for characters in the active party (battle scene)
      const partyCharacters = this.partySlots.filter((c): c is any => c !== null);
      for (const character of partyCharacters) {
        const hungerComponent = this.world.getComponent(character.id as any, HungerComponentType);
        if (!hungerComponent) continue;
        
        const oldHunger = hungerComponent.current;
        if (oldHunger <= 0) continue; // Already at 0, no need to decay
        
        // Check for gastritis passive skill (reduces satiety consumption by 50%)
        let effectiveDecayRate = HUNGER_DECAY_RATE;
        if (character.passiveSkill) {
          const passiveSkill = this.npcSystem.getPassiveSkill(character.passiveSkill);
          if (passiveSkill) {
            for (const effect of passiveSkill.effects) {
              if (effect.type === 'attribute_multiplier' && effect.attribute === 'satietyConsumptionRate') {
                effectiveDecayRate = HUNGER_DECAY_RATE * (1 + effect.value);
              }
            }
          }
        }
        
        const newHunger = Math.max(0, oldHunger - effectiveDecayRate);
        hungerComponent.current = newHunger;
        character.currentHunger = newHunger;
        
        // Update the hunger bar display in party slot
        this.updatePartySlotHungerBar(character.id, newHunger, hungerComponent.maximum);
        
        // Check if hunger just hit 0 → apply hunger BUFF
        if (oldHunger > 0 && newHunger <= 0) {
          this.checkHungerBuff(character.id, newHunger);
        }
      }
    }, TICK_INTERVAL);
  }

  /**
   * Start the day/night cycle timer
   * Progress increases by 0.4% per second, cycles between day and night
   */
  private startDayNightCycle(): void {
    if (this.dayNightInterval) {
      clearInterval(this.dayNightInterval);
    }
    
    const PROGRESS_RATE = 0.4; // % per second
    const TICK_INTERVAL = 1000; // 1 second
    
    this.dayNightInterval = window.setInterval(() => {
      // Increase progress
      this.dayNightProgress += PROGRESS_RATE;
      
      // Check if cycle is complete
      if (this.dayNightProgress >= 100) {
        this.dayNightProgress = 0;
        const wasNight = !this.isDaytime;
        this.isDaytime = !this.isDaytime;
        
        // If transitioning from night to day, advance to next day
        if (wasNight && this.isDaytime) {
          this.currentDayOfWeek = (this.currentDayOfWeek + 1) % 7;
          this.updateDayOfWeekDisplay();
          
          // Auto-save on dawn
          this.saveToSlot(this.AUTO_SAVE_KEY, true);
          
          // Trigger dawn events
          this.onDawnEvents();
        }
        
        // Update label
        const timeLabel = document.getElementById('time-label');
        if (timeLabel) {
          timeLabel.textContent = this.isDaytime ? '☀️ 白天' : '🌙 夜晚';
        }
        
        // Update progress bar color
        const progressFill = document.getElementById('day-night-progress-fill');
        if (progressFill) {
          progressFill.style.background = this.isDaytime 
            ? 'linear-gradient(90deg, #ffd700 0%, #ff8c00 100%)' 
            : 'linear-gradient(90deg, #4a5568 0%, #2d3748 100%)';
        }

        // Apply/remove time-dependent passive skill effects
        this.applyTimeDependentPassiveSkills();
      }
      
      // Update progress bar width
      const progressFill = document.getElementById('day-night-progress-fill');
      if (progressFill) {
        progressFill.style.width = `${this.dayNightProgress}%`;
      }
    }, TICK_INTERVAL);
  }

  /**
   * Apply or remove time-dependent passive skill effects based on current day/night state.
   * Called on every day/night transition.
   */
  private applyTimeDependentPassiveSkills(): void {
    const recruitedCharacters = this.npcSystem.getRecruitedCharacters();
    const passiveSkills = this.npcSystem.getPassiveSkills();

    // Attribute name mapping: passive-skills.json → NPCData
    const attrMap: Record<string, string> = {
      healthRegen: 'hpRegen',
      manaRegen: 'mpRegen',
    };

    for (const character of recruitedCharacters) {
      if (!character.passiveSkill) continue;

      const skill = passiveSkills.find((s: any) => s.id === character.passiveSkill);
      if (!skill || skill.triggerCondition !== 'time_of_day') continue;

      const shouldBeActive =
        (skill.triggerValue === 'day' && this.isDaytime) ||
        (skill.triggerValue === 'night' && !this.isDaytime);

      const appliedKey = character.id;
      const alreadyApplied = this.timeDependentBonusesApplied.has(appliedKey);

      if (shouldBeActive && !alreadyApplied) {
        // Apply bonuses
        const appliedEffects: { attribute: string; value: number; type: string }[] = [];
        for (const effect of skill.effects) {
          const rawAttr = effect.attribute as string;
          const attr = attrMap[rawAttr] || rawAttr;

          if (effect.type === 'attribute_bonus') {
            (character as any)[attr] = ((character as any)[attr] || 0) + effect.value;
            appliedEffects.push({ attribute: attr, value: effect.value, type: 'bonus' });
            console.log(`[GameUI] Time skill "${skill.name}" applied to ${character.name}: ${attr} +${effect.value}`);
          } else if (effect.type === 'attribute_multiplier') {
            const base = (character as any)[attr] || 0;
            const bonus = Math.round(base * effect.value);
            (character as any)[attr] = base + bonus;
            appliedEffects.push({ attribute: attr, value: bonus, type: 'multiplier' });
            console.log(`[GameUI] Time skill "${skill.name}" applied to ${character.name}: ${attr} +${bonus} (${effect.value * 100}%)`);
          }
        }
        this.timeDependentBonusesApplied.set(appliedKey, appliedEffects);
        this.showNotification(`🌟 ${character.name} 的 ${skill.name} 生效了`, 'success');
      } else if (!shouldBeActive && alreadyApplied) {
        // Remove bonuses
        const appliedEffects = this.timeDependentBonusesApplied.get(appliedKey)!;
        for (const applied of appliedEffects) {
          if (applied.type === 'bonus') {
            (character as any)[applied.attribute] = ((character as any)[applied.attribute] || 0) - applied.value;
          } else if (applied.type === 'multiplier') {
            (character as any)[applied.attribute] = ((character as any)[applied.attribute] || 0) - applied.value;
          }
          console.log(`[GameUI] Time skill "${skill.name}" removed from ${character.name}: ${applied.attribute} -${applied.value}`);
        }
        this.timeDependentBonusesApplied.delete(appliedKey);
        this.showNotification(`🌙 ${character.name} 的 ${skill.name} 失效了`, 'warning');
      }
    }
  }

  /**
   * Update the day of week display
   */
  private updateDayOfWeekDisplay(): void {
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const dayOfWeekLabel = document.getElementById('day-of-week-label');
    if (dayOfWeekLabel) {
      dayOfWeekLabel.textContent = dayNames[this.currentDayOfWeek];
    }
  }

  /**
   * Handle events that occur at dawn (night -> day transition)
   */
  private onDawnEvents(): void {
    console.log('🌅 Dawn events triggered');
    
    // 0. Reset daily dialogue counts for all NPCs and characters
    this.npcSystem.resetDailyDialogues();
    console.log('✅ Reset daily dialogue counts');
    
    // 0.5. Reset daily gift counts for all NPCs and characters
    this.npcSystem.resetDailyGifts();
    console.log('✅ Reset daily gift counts');

    // 0.6. Reset daily membership food claims
    this.dailyMembershipFoodClaimed.clear();
    console.log('✅ Reset daily membership food claims');
    
    // 1. Refresh merchant inventories for specific NPCs
    const merchantIds = ['chef_curry', 'merchant_youliang', 'merchant_xiaoheiyang', 'bookseller_xiaochao'];
    for (const merchantId of merchantIds) {
      // Clear cached inventory
      this.merchantInventories.delete(merchantId);
      
      // Reset refresh count to default
      this.merchantRefreshCounts.delete(merchantId);
      
      console.log(`✅ Refreshed inventory for ${merchantId}`);
    }
    
    // 2. Refresh tavern adventurers (replace existing ones and fill empty spawn points)
    const spawnPointCount = 6; // Total number of spawn points in tavern
    const existingAdventurers = this.npcSystem.getNPCsByType('Adventurer');
    
    // Track which spawn points are occupied
    const occupiedSpawnPoints = new Set<number>();
    
    // Replace existing adventurers at their spawn points
    existingAdventurers.forEach(adventurer => {
      const spawnIndex = (adventurer as any).spawnPointIndex;
      if (spawnIndex !== undefined && spawnIndex >= 0 && spawnIndex < spawnPointCount) {
        occupiedSpawnPoints.add(spawnIndex);
        
        // Remove old adventurer
        this.npcSystem.removeNPC(adventurer.id);
        this.npcCardInstances.delete(adventurer.id);
        
        // Create new adventurer at the same spawn point
        const newAdventurer = this.npcSystem.createAdventurer();
        (newAdventurer as any).spawnPointIndex = spawnIndex;
        console.log(`✅ Replaced adventurer at spawn point ${spawnIndex}:`, newAdventurer.title, newAdventurer.name);
      }
    });
    
    // Fill empty spawn points with new adventurers
    for (let i = 0; i < spawnPointCount; i++) {
      if (!occupiedSpawnPoints.has(i)) {
        const newAdventurer = this.npcSystem.createAdventurer();
        (newAdventurer as any).spawnPointIndex = i;
        console.log(`✅ Created new adventurer at empty spawn point ${i}:`, newAdventurer.title, newAdventurer.name);
      }
    }
    
    // If currently in tavern scene, reload it to display new adventurers
    if (this.currentScene === 'tavern') {
      this.loadTavernScene();
      console.log('✅ Reloaded tavern scene with new adventurers');
    }
    
    this.showNotification('🌅 新的一天开始了！商人的货物已更新，酒馆的冒险者已刷新', 'success');
    
    // Reset daily quests
    this.resetDailyQuests();
  }

  /**
   * Update the hunger bar display in a party slot
   * @param characterId - Character ID
   * @param currentHunger - Current hunger value
   * @param maxHunger - Maximum hunger value
   */
  private updatePartySlotHungerBar(characterId: string, currentHunger: number, maxHunger: number): void {
    // Find the party slot containing this character
    const partySlots = document.querySelectorAll('.party-slot');
    for (const slot of Array.from(partySlots)) {
      const avatarContainer = slot.querySelector('.avatar-container');
      if (avatarContainer && avatarContainer.getAttribute('data-character-id') === characterId) {
        // Find the hunger bar (has data-bar-type="🍚")
        const hungerBar = slot.querySelector('[data-bar-type="🍚"]');
        if (hungerBar) {
          const fill = hungerBar.querySelector('.bar-fill') as HTMLElement;
          const text = hungerBar.querySelector('.bar-text') as HTMLElement;
          
          if (fill && text) {
            const percentage = maxHunger > 0 ? (currentHunger / maxHunger) * 100 : 0;
            fill.style.width = `${percentage}%`;
            text.textContent = `${Math.round(currentHunger)}/${maxHunger}`;
          }
        }
        break;
      }
    }
  }

  /**
   * Apply visual effects for active buffs on a character
   */
  private applyBuffVisualEffects(characterId: string, slot: HTMLElement): void {
    const activeBuffs = this.buffSystem.getActiveBuffs(characterId);
    const avatarContainer = slot.querySelector('.avatar-container') as HTMLElement;
    const avatar = slot.querySelector('.avatar') as HTMLElement;
    const particleLayer = slot.querySelector('.particle-layer') as HTMLElement;
    
    if (!avatarContainer || !avatar) return;

    // Clear existing intervals for this character
    const existingInterval = this.buffEffectIntervals.get(characterId);
    if (existingInterval) {
      clearInterval(existingInterval);
      this.buffEffectIntervals.delete(characterId);
    }

    // Reset visual effects
    avatar.style.filter = '';
    avatar.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    if (particleLayer) {
      particleLayer.innerHTML = '';
    }

    // Remove any existing speed buff overlays
    const existingOverlays = avatarContainer.querySelectorAll('.speed-buff-overlay');
    existingOverlays.forEach(el => el.remove());

    // Apply effects based on active buffs
    const hasStrength = activeBuffs.some(b => b.buffId === 'strength');
    const hasSpeed = activeBuffs.some(b => b.buffId === 'speed');
    const hasHardening = activeBuffs.some(b => b.buffId === 'hardening');
    const hasEnrage = activeBuffs.some(b => b.buffId === 'enrage');
    const hasCharge = activeBuffs.some(b => b.buffId === 'charge');
    const hasHunger = activeBuffs.some(b => b.buffId === 'hunger');

    // Hunger buff: Desaturated gray with reduced opacity (character looks weakened)
    if (hasHunger) {
      avatar.style.filter = 'grayscale(0.7) brightness(0.6)';
    }

    // Strength buff: Orange outer glow
    if (hasStrength) {
      avatar.style.filter = 'drop-shadow(0 0 6px rgba(220, 50, 0, 0.9)) drop-shadow(0 0 12px rgba(180, 30, 0, 0.7))';
    }

    // Enrage buff: Red pulsing glow (overrides strength if both active)
    if (hasEnrage) {
      avatar.style.filter = 'drop-shadow(0 0 8px rgba(255, 0, 0, 0.9)) drop-shadow(0 0 16px rgba(200, 0, 0, 0.7)) brightness(1.15)';
    }

    // Charge buff: Blue-white speed glow
    if (hasCharge) {
      avatar.style.filter = 'drop-shadow(0 0 6px rgba(100, 180, 255, 0.9)) drop-shadow(0 0 12px rgba(50, 120, 255, 0.7)) brightness(1.2)';
    }

    // Speed buff: Purple overlay with overlay blend mode
    if (hasSpeed) {
      const overlay = document.createElement('div');
      overlay.className = 'speed-buff-overlay';
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(75, 0, 130, 0.5);
        border-radius: 50%;
        mix-blend-mode: multiply;
        pointer-events: none;
        z-index: 3;
      `;
      avatarContainer.appendChild(overlay);
    }

    // Hardening buff: Blue-gray thick outline
    if (hasHardening) {
      avatar.style.boxShadow = '0 0 0 4px #6b7c9e, 0 2px 4px rgba(0, 0, 0, 0.1)';
    }
  }

  /**
   * Create orange particle burst effect (for strength buff)
   */
  private createParticleBurst(container: HTMLElement): void {
    // Limit particles if container already has too many
    const existingParticles = container.children.length;
    if (existingParticles > 20) {
      return; // Skip this burst to prevent lag
    }

    const particleCount = 8;
    const centerX = 30; // Center of 60px avatar
    const centerY = 30;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      const angle = (Math.PI * 2 * i) / particleCount;
      const distance = 40; // How far particles travel
      
      particle.style.cssText = `
        position: absolute;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: radial-gradient(circle, #ff9500 0%, #ff6b00 100%);
        left: ${centerX}px;
        top: ${centerY}px;
        transform: translate(-50%, -50%);
        pointer-events: none;
        mix-blend-mode: screen;
        opacity: 0.8;
      `;

      container.appendChild(particle);

      // Animate particle
      const endX = centerX + Math.cos(angle) * distance;
      const endY = centerY + Math.sin(angle) * distance;

      particle.animate([
        { 
          left: `${centerX}px`, 
          top: `${centerY}px`,
          opacity: 0.8,
          transform: 'translate(-50%, -50%) scale(1)'
        },
        { 
          left: `${endX}px`, 
          top: `${endY}px`,
          opacity: 0,
          transform: 'translate(-50%, -50%) scale(0.3)'
        }
      ], {
        duration: 600,
        easing: 'ease-out'
      });

      // Remove particle after animation
      setTimeout(() => {
        if (particle.parentNode) {
          particle.remove();
        }
      }, 600);
    }
  }

  /**
   * Apply purple-red afterimage effect (for speed buff)
   */
  private applyAfterimageEffect(avatar: HTMLElement): void {
    // Create afterimage container
    const afterimageContainer = document.createElement('div');
    afterimageContainer.className = 'afterimage-container';
    afterimageContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    `;

    // Insert before avatar
    if (avatar.parentElement) {
      avatar.parentElement.insertBefore(afterimageContainer, avatar);
    }

    // Create multiple afterimages
    const createAfterimage = () => {
      // Limit afterimages to prevent lag
      if (afterimageContainer.children.length > 3) {
        return; // Skip if too many afterimages
      }

      const afterimage = avatar.cloneNode(true) as HTMLElement;
      afterimage.style.cssText = avatar.style.cssText;
      afterimage.style.position = 'absolute';
      afterimage.style.top = '0';
      afterimage.style.left = '0';
      afterimage.style.zIndex = '1';
      afterimage.style.opacity = '0.4';
      afterimage.style.filter = 'none';
      afterimage.style.boxShadow = 'none';
      
      // Apply purple-red multiply blend mode overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #c71585;
        border-radius: 50%;
        mix-blend-mode: multiply;
        pointer-events: none;
      `;
      afterimage.appendChild(overlay);

      afterimageContainer.appendChild(afterimage);

      // Fade out and remove
      afterimage.animate([
        { opacity: 0.4 },
        { opacity: 0 }
      ], {
        duration: 300,
        easing: 'ease-out'
      });

      setTimeout(() => {
        if (afterimage.parentNode) {
          afterimage.remove();
        }
      }, 300);
    };

    // Generate afterimages periodically
    const afterimageInterval = window.setInterval(createAfterimage, 100);
    
    // Store interval for cleanup
    const characterId = avatar.closest('.avatar-container')?.getAttribute('data-character-id');
    if (characterId) {
      this.buffEffectIntervals.set(`${characterId}-speed`, afterimageInterval);
    }
  }

  /**
   * Clear all buff visual effects for a character
   */
  private clearBuffVisualEffects(characterId: string): void {
    // Clear strength particle interval (no longer used but keep for compatibility)
    const strengthInterval = this.buffEffectIntervals.get(`${characterId}-strength`);
    if (strengthInterval) {
      clearInterval(strengthInterval);
      this.buffEffectIntervals.delete(`${characterId}-strength`);
    }

    // Clear speed afterimage interval (no longer used but keep for compatibility)
    const speedInterval = this.buffEffectIntervals.get(`${characterId}-speed`);
    if (speedInterval) {
      clearInterval(speedInterval);
      this.buffEffectIntervals.delete(`${characterId}-speed`);
    }
  }

  /**
   * Show party slot detail panel - displays full character details in a floating panel
   */
  private showPartySlotDetailPanel(npcData: any, anchorElement: HTMLElement): void {
    // Remove any existing panel
    this.hidePartySlotDetailPanelForce();

    const actionPanel = document.getElementById('action-panel');
    if (!actionPanel) return;

    // Re-fetch latest character data
    const freshData = this.npcSystem.getRecruitedCharacter(npcData.id) || this.npcSystem.getNPC(npcData.id) || npcData;

    const displayName = freshData.title ? `${freshData.title}${freshData.name}` : freshData.name;
    const isImage = freshData.emoji.includes('.png') || freshData.emoji.includes('.jpg');
    const avatarContent = isImage
      ? `<img src="${freshData.emoji}" style="width: 100%; height: 100%; object-fit: cover;" />`
      : freshData.emoji;

    // Calculate equipment bonuses
    const primaryBonuses = this.calculatePrimaryAttributeBonuses(freshData);
    const strBonus = primaryBonuses.strength > 0 ? `<div style="font-size: 12px; color: #90ff90; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">(+${primaryBonuses.strength})</div>` : '';
    const agiBonus = primaryBonuses.agility > 0 ? `<div style="font-size: 12px; color: #90ff90; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">(+${primaryBonuses.agility})</div>` : '';
    const wisBonus = primaryBonuses.wisdom > 0 ? `<div style="font-size: 12px; color: #90ff90; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">(+${primaryBonuses.wisdom})</div>` : '';
    const sklBonus = primaryBonuses.skill > 0 ? `<div style="font-size: 12px; color: #90ff90; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">(+${primaryBonuses.skill})</div>` : '';

    // Create hover panel
    const hoverPanel = document.createElement('div');
    hoverPanel.id = 'party-slot-hover-panel';
    hoverPanel.style.cssText = `
      position: fixed;
      width: 420px;
      background: white;
      border: 2px solid #667eea;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      overflow-y: auto;
      max-height: 90vh;
    `;

    hoverPanel.innerHTML = `
      <div style="display: flex; gap: 12px; margin-bottom: 12px;">
        <div style="flex: 1; width: 50%;">
          <div style="margin-bottom: 8px; text-align: center;">
            <h2 style="margin: 0; color: #333; font-size: 18px; font-weight: bold;">${displayName}</h2>
            <div style="font-size: 11px; color: #666; margin-top: 2px;">等级: ${freshData.level} | 职业: ${this.getJobDisplayName(freshData.job)}</div>
          </div>
          
          <div style="width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 60px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); overflow: hidden; margin-bottom: 12px; margin-left: auto; margin-right: auto;">
            ${avatarContent}
          </div>
          <div>
            <div style="margin-bottom: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; color: #333;">
                <span>❤️ 生命值</span>
                <span>${Math.floor(freshData.currentHP || freshData.maxHP)}/${Math.floor(freshData.maxHP)}</span>
              </div>
              <div style="background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden;">
                <div style="background: linear-gradient(90deg, #28a745, #5cb85c); height: 100%; width: ${((freshData.currentHP || freshData.maxHP) / freshData.maxHP * 100)}%;"></div>
              </div>
            </div>
            <div style="margin-bottom: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; color: #333;">
                <span>💙 魔法值</span>
                <span>${Math.floor(freshData.currentMP || 0)}/${Math.floor(freshData.maxMP)}</span>
              </div>
              <div style="background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden;">
                <div style="background: linear-gradient(90deg, #4dabf7, #74c0fc); height: 100%; width: ${((freshData.currentMP || 0) / freshData.maxMP * 100)}%;"></div>
              </div>
            </div>
            <div style="margin-bottom: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; color: #333;">
                <span>⭐ 经验值</span>
                <span>${Math.floor(freshData.currentEXP || 0)}/${Math.floor(freshData.maxEXP)}</span>
              </div>
              <div style="background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden;">
                <div style="background: linear-gradient(90deg, #ffd43b, #ffe066); height: 100%; width: ${((freshData.currentEXP || 0) / freshData.maxEXP * 100)}%;"></div>
              </div>
            </div>
            <div style="margin-bottom: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; color: #333;">
                <span>🍚 饱腹度</span>
                <span>${Math.floor(freshData.currentHunger || 0)}/${Math.floor(freshData.maxHunger || 100)}</span>
              </div>
              <div style="background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden;">
                <div style="background: linear-gradient(90deg, #f39c12, #f5b041); height: 100%; width: ${((freshData.currentHunger || 0) / (freshData.maxHunger || 100) * 100)}%;"></div>
              </div>
            </div>
            <div style="margin-bottom: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; color: #333;">
                <span>💖 好感度</span>
                <span>${freshData.affinity}/100</span>
              </div>
              <div style="background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden;">
                <div style="background: linear-gradient(90deg, #ff6b9d, #ff8fb3); height: 100%; width: ${freshData.affinity}%;"></div>
              </div>
            </div>
          </div>
        </div>
        <div style="flex: 1; width: 50%; margin-top: 45px;">
          <div style="margin-bottom: 12px;">
            <h4 style="margin: 0 0 8px 0; color: #333; font-size: 12px; font-weight: bold;">主属性</h4>
            <div style="display: flex; gap: 4px;">
              <div style="background: #dc3545; border-radius: 6px; padding: 8px; text-align: center; color: white; width: 20%; flex-shrink: 0;">
                <div style="font-size: 20px; margin-bottom: 2px;">${ATTRIBUTE_ICONS.STRENGTH}</div>
                <div style="font-size: 15px; font-weight: bold; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">${freshData.strength}</div>
                ${strBonus}
              </div>
              <div style="background: #28a745; border-radius: 6px; padding: 10px 8px; text-align: center; color: white; width: 20%; flex-shrink: 0;">
                <div style="font-size: 20px; margin-bottom: 2px;">${ATTRIBUTE_ICONS.AGILITY}</div>
                <div style="font-size: 15px; font-weight: bold; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">${freshData.agility}</div>
                ${agiBonus}
              </div>
              <div style="background: #007bff; border-radius: 6px; padding: 10px 8px; text-align: center; color: white; width: 20%; flex-shrink: 0;">
                <div style="font-size: 20px; margin-bottom: 2px;">${ATTRIBUTE_ICONS.WISDOM}</div>
                <div style="font-size: 15px; font-weight: bold; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">${freshData.wisdom}</div>
                ${wisBonus}
              </div>
              <div style="background: #ffc107; border-radius: 6px; padding: 10px 8px; text-align: center; color: white; width: 20%; flex-shrink: 0;">
                <div style="font-size: 20px; margin-bottom: 2px;">${ATTRIBUTE_ICONS.SKILL}</div>
                <div style="font-size: 15px; font-weight: bold; text-shadow: 0.5px 0.5px 0 #000, -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000;">${freshData.skill}</div>
                ${sklBonus}
              </div>
            </div>
          </div>
          <div>
            <h4 style="margin: 0 0 8px 0; color: #333; font-size: 12px; font-weight: bold;">副属性</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3px; font-size: 9px;">
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">⚔️ 攻击力: ${formatNumber(freshData.attack)}</div>
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">🛡️ 防御力: ${formatNumber(freshData.defense)}</div>
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">🏃 移动速度: ${formatNumber(freshData.moveSpeed)}</div>
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">💨 闪避率: ${formatNumber(freshData.dodgeRate)}%</div>
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">💥 暴击率: ${formatNumber(freshData.critRate)}%</div>
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">💢 暴伤: ${formatNumber(freshData.critDamage)}%</div>
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">🔮 抗性: ${formatNumber(freshData.resistance)}</div>
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">✨ 魔法强度: ${formatNumber(freshData.magicPower)}</div>
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">🎒 负重: ${formatNumber(freshData.carryWeight)}</div>
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">📦 体积: ${formatNumber(freshData.volume)}</div>
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">⭐ 经验率: ${formatNumber(freshData.expRate)}%</div>
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">🩹 回血: ${formatNumber(freshData.hpRegen)}</div>
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">💙 回魔: ${formatNumber(freshData.mpRegen)}</div>
              <div style="padding: 3px 5px; background: #f9f9f9; border-radius: 3px; color: #333;">⚖️ 体重: ${formatNumber(freshData.weight)}kg</div>
            </div>
          </div>
        </div>
      </div>
      <div style="margin-bottom: 12px;">
        <h4 style="margin: 0 0 8px 0; color: #333; font-size: 12px; font-weight: bold;">技能槽位</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <div style="padding: 12px; background: ${freshData.passiveSkill ? '#e3f2fd' : '#f0f0f0'}; border: 2px ${freshData.passiveSkill ? 'solid' : 'dashed'} ${freshData.passiveSkill ? '#2196f3' : '#ccc'}; border-radius: 8px; height: 74px; box-sizing: border-box; overflow: hidden;">
            <div style="display: flex; align-items: center; gap: 12px; height: 100%;">
              <div style="flex-shrink: 0;">
                ${freshData.passiveSkill ? `<img src="${this.npcSystem.getPassiveSkill(freshData.passiveSkill)?.icon || ''}" style="width: 50px; height: 50px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onerror="this.style.display='none'">` : '<div style="width: 50px; height: 50px; background: #ddd; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🔵</div>'}
              </div>
              <div style="flex: 1; text-align: left; min-width: 0; overflow: hidden;">
                <div style="font-size: 11px; color: #999; margin-bottom: 4px;">被动技能</div>
                <div style="font-size: 13px; font-weight: bold; color: ${freshData.passiveSkill ? '#333' : '#999'};">${freshData.passiveSkill ? this.npcSystem.getPassiveSkill(freshData.passiveSkill)?.name || '空' : '空'}</div>
              </div>
            </div>
          </div>
          <div style="padding: 12px; background: ${freshData.activeSkill ? '#ffebee' : '#f0f0f0'}; border: 2px ${freshData.activeSkill ? 'solid' : 'dashed'} ${freshData.activeSkill ? '#f44336' : '#ccc'}; border-radius: 8px; height: 74px; box-sizing: border-box; overflow: hidden;">
            <div style="display: flex; align-items: center; gap: 12px; height: 100%;">
              <div style="flex-shrink: 0;">
                ${freshData.activeSkill ? `<img src="${this.npcSystem.getActiveSkill(freshData.activeSkill)?.icon || ''}" style="width: 50px; height: 50px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onerror="this.style.display='none'">` : '<div style="width: 50px; height: 50px; background: #ddd; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🔴</div>'}
              </div>
              <div style="flex: 1; text-align: left; min-width: 0; overflow: hidden;">
                <div style="font-size: 11px; color: #999; margin-bottom: 4px;">主动技能</div>
                <div style="font-size: 13px; font-weight: bold; color: ${freshData.activeSkill ? '#333' : '#999'};">${freshData.activeSkill ? this.npcSystem.getActiveSkill(freshData.activeSkill)?.name || '空' : '空'}</div>
              </div>
            </div>
          </div>
          <div style="padding: 12px; background: ${freshData.masterSkill ? '#fff3e0' : '#f0f0f0'}; border: 2px ${freshData.masterSkill ? 'solid' : 'dashed'} ${freshData.masterSkill ? '#ff9800' : '#ccc'}; border-radius: 8px; height: 74px; box-sizing: border-box; overflow: hidden;">
            <div style="display: flex; align-items: center; gap: 12px; height: 100%;">
              <div style="flex-shrink: 0;">
                ${freshData.masterSkill ? `<img src="${this.npcSystem.getJobExclusiveSkill(freshData.masterSkill)?.icon || ''}" style="width: 50px; height: 50px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onerror="this.style.display='none'">` : '<div style="width: 50px; height: 50px; background: #ddd; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🟡</div>'}
              </div>
              <div style="flex: 1; text-align: left; min-width: 0; overflow: hidden;">
                <div style="font-size: 11px; color: #999; margin-bottom: 4px;">大师技能</div>
                <div style="font-size: 13px; font-weight: bold; color: ${freshData.masterSkill ? '#333' : '#999'};">${freshData.masterSkill ? this.npcSystem.getJobExclusiveSkill(freshData.masterSkill)?.name || '空' : '空'}</div>
              </div>
            </div>
          </div>
          <div style="padding: 12px; background: #f0f0f0; border: 2px dashed #ccc; border-radius: 8px; height: 74px; box-sizing: border-box; overflow: hidden;">
            <div style="display: flex; align-items: center; gap: 12px; height: 100%;">
              <div style="flex-shrink: 0;"><div style="width: 50px; height: 50px; background: #ddd; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🟣</div></div>
              <div style="flex: 1; text-align: left; min-width: 0; overflow: hidden;">
                <div style="font-size: 11px; color: #999; margin-bottom: 4px;">徽章技能</div>
                <div style="font-size: 13px; font-weight: bold; color: #999;">空</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <h4 style="margin: 0 0 8px 0; color: #333; font-size: 12px; font-weight: bold;">装备槽位</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          ${this.renderEquipSlotHtmlReadonly(freshData, 'weapon', '⚔️ 武器')}
          ${this.renderEquipSlotHtmlReadonly(freshData, 'offhand', '🛡️ 副手')}
          ${this.renderEquipSlotHtmlReadonly(freshData, 'armor', '🦺 护甲')}
          ${this.renderEquipSlotHtmlReadonly(freshData, 'accessory', '💍 杂项')}
        </div>
      </div>
    `;

    document.body.appendChild(hoverPanel);

    // Position the panel to the left of the action panel
    const actionPanelRect = actionPanel.getBoundingClientRect();
    const panelWidth = 420;
    const gap = 10;

    let left = actionPanelRect.left - panelWidth - gap;
    let top = actionPanelRect.top;

    if (left < 10) {
      left = actionPanelRect.right + gap;
    }

    const panelHeight = hoverPanel.offsetHeight;
    if (top + panelHeight > window.innerHeight) {
      top = window.innerHeight - panelHeight - 10;
    }
    if (top < 10) {
      top = 10;
    }

    hoverPanel.style.left = `${left}px`;
    hoverPanel.style.top = `${top}px`;

    // Keep panel visible when mouse enters it
    hoverPanel.addEventListener('mouseenter', () => {
      hoverPanel.setAttribute('data-hover', 'true');
    });
    hoverPanel.addEventListener('mouseleave', () => {
      hoverPanel.removeAttribute('data-hover');
      this.hidePartySlotDetailPanelForce();
    });
  }

  /**
   * Render equipment slot HTML for read-only display in hover panel
   */
  private renderEquipSlotHtmlReadonly(npcData: any, slotType: string, label: string): string {
    const equippedId = npcData.equippedItems?.[slotType] || null;
    if (equippedId) {
      const itemData = this.resolveEquippedItemData(equippedId);
      if (itemData) {
        const rarityColors = ['#888', '#3498db', '#9b59b6', '#e67e22'];
        const rarityNames = ['普通', '稀有', '史诗', '传说'];
        const rarityColor = rarityColors[itemData.rarity] || '#888';
        const rarityName = rarityNames[itemData.rarity] || '普通';

        // Determine equipment type display
        let typeDisplay = '';
        const sub = itemData.subType || itemData.equipmentSlot;
        if (Array.isArray(sub)) {
          typeDisplay = sub.filter((s: string) => s !== '装备').join(' ');
        } else {
          const typeMap: Record<string, string> = { weapon: '武器', armor: '护甲', offhand: '副手', accessory: '杂项', misc: '杂项' };
          typeDisplay = typeMap[sub] || sub || '';
        }

        // Build icon HTML
        let iconHtml = '';
        if (itemData.icon && (itemData.icon.includes('.png') || itemData.icon.includes('.jpg'))) {
          iconHtml = `<img src="${itemData.icon}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;border:1px solid ${rarityColor};">`;
        } else {
          iconHtml = `<div style="width:32px;height:32px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;background:rgba(0,0,0,0.05);border:1px solid ${rarityColor};">${itemData.icon || '📦'}</div>`;
        }

        return `<div style="padding: 6px; background: #e8f5e9; border: 2px solid ${rarityColor}; border-radius: 6px; display: flex; align-items: center; gap: 6px;">
          <div style="flex-shrink:0;">${iconHtml}</div>
          <div style="flex:1;min-width:0;overflow:hidden;">
            <div style="font-size:11px;font-weight:bold;color:${rarityColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${itemData.name}</div>
            <div style="font-size:9px;color:#999;margin-top:1px;">${typeDisplay} · <span style="color:${rarityColor};">${rarityName}</span></div>
          </div>
        </div>`;
      }
    }
    return `<div style="padding: 8px; background: #f0f0f0; border: 2px dashed #ccc; border-radius: 6px; text-align: center; font-size: 10px; color: #666;">
      <div>${label}</div>
      <div style="margin-top: 4px;">空</div>
    </div>`;
  }

  /**
   * Hide party slot detail panel (only if mouse is not hovering over it)
   */
  private hidePartySlotDetailPanel(): void {
    const hoverPanel = document.getElementById('party-slot-hover-panel');
    if (hoverPanel && !hoverPanel.getAttribute('data-hover')) {
      hoverPanel.remove();
    }
  }

  /**
   * Force hide party slot detail panel
   */
  private hidePartySlotDetailPanelForce(): void {
    const hoverPanel = document.getElementById('party-slot-hover-panel');
    if (hoverPanel) {
      hoverPanel.remove();
    }
  }

  /**
   * Show skill tooltip on hover
   */
  private showSkillTooltip(anchorElement: HTMLElement, skillId: string): void {
    // Remove any existing tooltip
    this.hideSkillTooltip();

    const skill = this.npcSystem.getPassiveSkill(skillId);
    if (!skill) return;

    // Get rarity color
    const rarityColors: Record<string, string> = {
      common: '#FFFFFF',
      rare: '#2196f3',
      epic: '#9c27b0',
      legendary: '#ff9800'
    };
    const rarityColor = rarityColors[skill.rarity] || '#FFFFFF';

    // Get rarity text
    const rarityText: Record<string, string> = {
      common: '普通',
      rare: '稀有',
      epic: '神话',
      legendary: '传说'
    };
    const rarityLabel = rarityText[skill.rarity] || '普通';

    // Get skill type text
    const typeText: Record<string, string> = {
      passive: '被动技能',
      active: '主动技能',
      master: '大师技能',
      badge: '徽章技能'
    };
    const typeLabel = typeText[skill.type] || '被动技能';

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'skill-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: white;
      border: 2px solid ${rarityColor};
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      min-width: 250px;
      max-width: 300px;
      pointer-events: none;
    `;

    tooltip.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
        <img src="${skill.icon}" style="width: 60px; height: 60px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" onerror="this.style.display='none'">
        <div style="flex: 1;">
          <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 4px;">${skill.name}</div>
          <div style="font-size: 11px; color: #666; margin-bottom: 2px;">${typeLabel}</div>
          <div style="font-size: 11px; font-weight: bold; color: ${rarityColor};">稀有度: ${rarityLabel}</div>
        </div>
      </div>
      <div style="border-top: 1px solid #e0e0e0; padding-top: 8px;">
        <div style="font-size: 12px; color: #666; line-height: 1.5;">${skill.description}</div>
      </div>
    `;

    document.body.appendChild(tooltip);

    // Position tooltip near the anchor element
    const rect = anchorElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Try to position to the right of the slot
    let left = rect.right + 10;
    let top = rect.top;

    // If tooltip goes off screen to the right, position to the left
    if (left + tooltipRect.width > window.innerWidth) {
      left = rect.left - tooltipRect.width - 10;
    }

    // If tooltip goes off screen at the bottom, adjust top
    if (top + tooltipRect.height > window.innerHeight) {
      top = window.innerHeight - tooltipRect.height - 10;
    }

    // If tooltip goes off screen at the top, adjust top
    if (top < 10) {
      top = 10;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  /**
   * Hide skill tooltip
   */
  private hideSkillTooltip(): void {
    const tooltip = document.getElementById('skill-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  /**
   * Show active skill tooltip on hover
   */
  private showActiveSkillTooltip(anchorElement: HTMLElement, skillId: string): void {
    // Remove any existing tooltip
    this.hideSkillTooltip();

    const skill = this.npcSystem.getActiveSkill(skillId);
    if (!skill) return;

    // Get rarity color
    const rarityColors: Record<string, string> = {
      common: '#FFFFFF',
      rare: '#2196f3',
      epic: '#9c27b0',
      legendary: '#ff9800'
    };
    const rarityColor = rarityColors[skill.rarity] || '#FFFFFF';

    // Get rarity text
    const rarityText: Record<string, string> = {
      common: '普通',
      rare: '稀有',
      epic: '神话',
      legendary: '传说'
    };
    const rarityLabel = rarityText[skill.rarity] || '普通';

    // Get skill type text
    const typeText: Record<string, string> = {
      passive: '被动技能',
      active: '主动技能',
      master: '大师技能',
      badge: '徽章技能'
    };
    const typeLabel = typeText[skill.type] || '主动技能';

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'skill-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: white;
      border: 2px solid ${rarityColor};
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      min-width: 250px;
      max-width: 300px;
      pointer-events: none;
    `;

    tooltip.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
        <img src="${skill.icon}" style="width: 60px; height: 60px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" onerror="this.style.display='none'">
        <div style="flex: 1;">
          <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 4px;">${skill.name}</div>
          <div style="font-size: 11px; color: #666; margin-bottom: 2px;">${typeLabel}</div>
          <div style="font-size: 11px; font-weight: bold; color: ${rarityColor};">稀有度: ${rarityLabel}</div>
        </div>
      </div>
      <div style="border-top: 1px solid #e0e0e0; padding-top: 8px;">
        <div style="font-size: 12px; color: #666; line-height: 1.5;">${skill.description}</div>
      </div>
    `;

    document.body.appendChild(tooltip);

    // Position tooltip near the anchor element
    const rect = anchorElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Try to position to the right of the slot
    let left = rect.right + 10;
    let top = rect.top;

    // If tooltip goes off screen to the right, position to the left
    if (left + tooltipRect.width > window.innerWidth) {
      left = rect.left - tooltipRect.width - 10;
    }

    // If tooltip goes off screen at the bottom, adjust top
    if (top + tooltipRect.height > window.innerHeight) {
      top = window.innerHeight - tooltipRect.height - 10;
    }

    // Ensure tooltip doesn't go off screen at the top
    if (top < 10) {
      top = 10;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  /**
   * Show job exclusive (master) skill tooltip on hover
   */
  private showJobExclusiveSkillTooltip(anchorElement: HTMLElement, skillId: string): void {
    // Remove any existing tooltip
    this.hideSkillTooltip();

    const skill = this.npcSystem.getJobExclusiveSkill(skillId);
    if (!skill) return;

    // Get rarity color
    const rarityColors: Record<string, string> = {
      common: '#FFFFFF',
      rare: '#2196f3',
      epic: '#9c27b0',
      legendary: '#ff9800'
    };
    const rarityColor = rarityColors[skill.rarity] || '#ff9800';

    // Get rarity text
    const rarityText: Record<string, string> = {
      common: '普通',
      rare: '稀有',
      epic: '神话',
      legendary: '传说'
    };
    const rarityLabel = rarityText[skill.rarity] || '传说';

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'skill-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: white;
      border: 2px solid ${rarityColor};
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      min-width: 250px;
      max-width: 300px;
      pointer-events: none;
    `;

    tooltip.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
        <img src="${skill.icon}" style="width: 60px; height: 60px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" onerror="this.style.display='none'">
        <div style="flex: 1;">
          <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 4px;">${skill.name}</div>
          <div style="font-size: 11px; color: #666; margin-bottom: 2px;">大师技能</div>
          <div style="font-size: 11px; font-weight: bold; color: ${rarityColor};">稀有度: ${rarityLabel}</div>
        </div>
      </div>
      <div style="border-top: 1px solid #e0e0e0; padding-top: 8px;">
        <div style="font-size: 12px; color: #666; line-height: 1.5;">${skill.description}</div>
      </div>
    `;

    document.body.appendChild(tooltip);

    // Position tooltip near the anchor element
    const rect = anchorElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Try to position to the right of the slot
    let left = rect.right + 10;
    let top = rect.top;

    // If tooltip goes off screen to the right, position to the left
    if (left + tooltipRect.width > window.innerWidth) {
      left = rect.left - tooltipRect.width - 10;
    }

    // If tooltip goes off screen at the bottom, adjust top
    if (top + tooltipRect.height > window.innerHeight) {
      top = window.innerHeight - tooltipRect.height - 10;
    }

    // Ensure tooltip doesn't go off screen at the top
    if (top < 10) {
      top = 10;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  private createProgressBar(label: string, current: number, max: number, color: string): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `
      width: 100%;
      display: flex;
      align-items: center;
      gap: 4px;
    `;
    
    // Add data-bar-type attribute based on label
    const barType = label.toLowerCase();
    container.setAttribute('data-bar-type', barType);
    
    // Label on the left
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    labelSpan.style.cssText = `
      font-size: 9px;
      color: #666;
      white-space: nowrap;
      min-width: 24px;
    `;
    
    // Progress bar container (takes remaining space)
    const barContainer = document.createElement('div');
    barContainer.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      gap: 4px;
    `;
    
    const barBg = document.createElement('div');
    barBg.style.cssText = `
      flex: 1;
      height: 5px;
      background: #e9ecef;
      border-radius: 3px;
      overflow: hidden;
    `;
    
    const barFill = document.createElement('div');
    barFill.className = 'bar-fill'; // Add class for easy selection
    // Ensure we have valid numbers and avoid division by zero
    const safeCurrent = isNaN(current) ? 0 : current;
    const safeMax = isNaN(max) || max === 0 ? 1 : max;
    const percentage = Math.max(0, Math.min(100, (safeCurrent / safeMax) * 100));
    barFill.style.cssText = `
      width: ${percentage}%;
      height: 100%;
      background: ${color};
      transition: width 0.3s ease;
    `;
    
    barBg.appendChild(barFill);
    
    // Value text on the right
    const valueSpan = document.createElement('span');
    valueSpan.className = 'bar-text';
    valueSpan.textContent = `${Math.floor(current)}/${Math.floor(max)}`;
    valueSpan.style.cssText = `
      font-size: 9px;
      color: #666;
      white-space: nowrap;
      min-width: 35px;
      text-align: right;
    `;
    
    barContainer.appendChild(barBg);
    barContainer.appendChild(valueSpan);
    
    container.appendChild(labelSpan);
    container.appendChild(barContainer);
    
    return container;
  }

  private hasCompletableQuests(): boolean {
    for (const [questId, state] of this.questStates) {
      if (state.status !== 'inProgress') continue;
      const def = this.questDefinitions.find(q => q.id === questId);
      if (!def) continue;
      const allComplete = def.objectives.every((obj, i) => state.objectives[i].currentAmount >= obj.requiredAmount);
      if (allComplete) return true;
    }
    return false;
  }

  private hasCompletableQuestsForNpc(npcId: string): boolean {
    const npcQuests = this.getQuestsForNpc(npcId);
    for (const quest of npcQuests) {
      const state = this.questStates.get(quest.id);
      if (!state || state.status !== 'inProgress') continue;
      const allComplete = quest.objectives.every((obj, i) => state.objectives[i].currentAmount >= obj.requiredAmount);
      if (allComplete) return true;
    }
    return false;
  }

  private updateQuestRedDots(): void {
    // Update red dots on all NPC quest buttons
    const allNpcIds = ['village_chief', 'bartender', 'maid', 'blacksmith_zz', 'chef_curry', 'alchemist_tuanzi', 'scholar_xiaomei', 'trainer_alin', 'summoner_kaoezi', 'merchant_xiaoheiyang', 'merchant_youliang'];
    for (const npcId of allNpcIds) {
      const questRedDot = document.getElementById(`quest-red-dot-${npcId}`);
      if (questRedDot) {
        questRedDot.style.display = this.hasCompletableQuestsForNpc(npcId) ? 'block' : 'none';
      }
    }
  }

  /**
   * Update quest tracker with current main quest
   */
  private updateQuestTracker(): void {
    if (!this.questTracker) return;

    // Find current in-progress main quest
    let currentMainQuest: QuestDefinition | null = null;
    let currentMainState: QuestState | null = null;

    for (const quest of this.questDefinitions) {
      if (quest.type !== 'main') continue;
      const state = this.questStates.get(quest.id);
      if (state && state.status === 'inProgress') {
        currentMainQuest = quest;
        currentMainState = state;
        break;
      }
    }

    this.questTracker.update(currentMainQuest, currentMainState);
  }

  private autoFillParty(): void {
    // Get all recruited characters
    const recruitedCharacters = this.npcSystem.getRecruitedCharacters();
    
    if (recruitedCharacters.length === 0) {
      this.showNotification('暂无可用角色，请先招募冒险者！', 'warning');
      return;
    }
    
    // Filter out injured characters
    const availableCharacters = recruitedCharacters.filter(char => !this.injuredCharacters.has(char.id));
    
    if (availableCharacters.length === 0) {
      this.showNotification('所有角色都在重伤复活中，无法自动填充编队', 'warning');
      return;
    }
    
    // Sort characters by level (descending), then randomly if levels are equal
    const sortedCharacters = [...availableCharacters].sort((a, b) => {
      if (b.level !== a.level) {
        return b.level - a.level; // Higher level first
      }
      // If levels are equal, randomize
      return Math.random() - 0.5;
    });
    
    // Fill empty slots with top characters
    let addedCount = 0;
    for (let i = 0; i < 4; i++) {
      if (!this.partySlots[i] && sortedCharacters[i]) {
        const character = sortedCharacters[i];
        if (!character) continue; // Type guard
        
        this.partySlots[i] = character;
        addedCount++;
        
        // Spawn character in battle scene if in grassland, forest, or cave stage
        if (this.isCurrentStageCombat() && this.battleSceneContainer) {
          this.battleSystem.spawnCharacter(character);
        }
      }
    }
    
    if (addedCount > 0) {
      this.refreshPartySlots();
      // Update party member IDs in BattleSystem for EXP sharing
      this.updateBattleSystemPartyMembers();
      // Update team bag weight display after a small delay to ensure party slots are updated
      setTimeout(() => {
        this.updateTeamBagWeightDisplay();
      }, 50);
      this.showNotification(`已自动添加 ${addedCount} 个角色到编队`, 'success');
    } else {
      this.showNotification('编队已满！', 'warning');
    }
  }

  private showCharacterSelectionModal(slotIndex: number): void {
    // Create modal overlay (transparent, no dark background)
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: transparent;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
    `;
    
    // Create modal content (warehouse-style)
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 24px;
      width: 100%;
      max-width: 900px;
      height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;
    
    // Header with title and close button
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    `;
    
    const title = document.createElement('h3');
    title.textContent = '选择角色';
    title.style.cssText = `
      margin: 0;
      color: #333;
      font-size: 24px;
      font-weight: bold;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      width: 40px;
      height: 40px;
      background: #dc3545;
      border: none;
      border-radius: 50%;
      color: white;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#c82333';
      closeBtn.style.transform = 'scale(1.1)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = '#dc3545';
      closeBtn.style.transform = 'scale(1)';
    });
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);
    
    // Get recruited characters
    const recruitedCharacters = this.npcSystem.getRecruitedCharacters();
    
    if (recruitedCharacters.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.style.cssText = `
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #999;
      `;
      emptyState.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 20px;">👥</div>
        <div style="font-size: 20px; margin-bottom: 10px;">暂无可用角色</div>
        <div style="font-size: 16px;">前往酒馆招募冒险者吧！</div>
      `;
      modal.appendChild(emptyState);
    } else {
      // Character grid container with pagination
      const itemsPerPage = 12;
      let currentPage = 0;
      const totalPages = Math.ceil(recruitedCharacters.length / itemsPerPage);
      
      const characterGridContainer = document.createElement('div');
      characterGridContainer.style.cssText = `
        flex: 1;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
        gap: 16px;
        align-content: start;
        overflow-y: auto;
        margin-bottom: 16px;
      `;
      
      const paginationContainer = document.createElement('div');
      paginationContainer.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        padding: 10px;
      `;
      
      const renderCharacterPage = (page: number) => {
        characterGridContainer.innerHTML = '';
        const startIndex = page * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, recruitedCharacters.length);
        const pageCharacters = recruitedCharacters.slice(startIndex, endIndex);
        
        pageCharacters.forEach(character => {
          const card = this.createWarehouseStyleCharacterCard(character, slotIndex, overlay);
          characterGridContainer.appendChild(card);
        });
        
        renderPagination();
      };
      
      const renderPagination = () => {
        paginationContainer.innerHTML = '';
        
        if (totalPages <= 1) return;
        
        for (let i = 0; i < totalPages; i++) {
          const dot = document.createElement('div');
          dot.style.cssText = `
            width: ${i === currentPage ? '12px' : '8px'};
            height: ${i === currentPage ? '12px' : '8px'};
            border-radius: 50%;
            background: ${i === currentPage ? '#667eea' : '#ccc'};
            cursor: pointer;
            transition: all 0.3s;
          `;
          
          dot.addEventListener('mouseenter', () => {
            if (i !== currentPage) {
              dot.style.background = '#999';
            }
          });
          
          dot.addEventListener('mouseleave', () => {
            if (i !== currentPage) {
              dot.style.background = '#ccc';
            }
          });
          
          dot.addEventListener('click', () => {
            currentPage = i;
            renderCharacterPage(currentPage);
          });
          
          paginationContainer.appendChild(dot);
        }
      };
      
      modal.appendChild(characterGridContainer);
      modal.appendChild(paginationContainer);
      
      // Initial render
      renderCharacterPage(0);
    }
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });
  }

  private createWarehouseStyleCharacterCard(character: any, slotIndex: number, overlay: HTMLElement): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.3s ease;
      border: 2px solid transparent;
    `;
    
    // Check if character is already in party
    const isInParty = this.partySlots.some(slot => slot && slot.id === character.id);
    
    // Check if character is injured (in revive countdown)
    const isInjured = this.injuredCharacters.has(character.id);
    
    if (isInParty || isInjured) {
      card.style.opacity = '0.5';
      card.style.cursor = 'not-allowed';
      card.style.background = '#f0f0f0';
    }
    
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
      margin: 0 auto 10px auto;
      overflow: hidden;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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
      avatar.style.fontSize = '40px';
    }
    
    // Name
    const name = document.createElement('div');
    name.textContent = character.title ? `${character.title}${character.name}` : character.name;
    name.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      color: #333;
      text-align: center;
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    
    // Level and Job
    const info = document.createElement('div');
    info.textContent = `Lv.${character.level} ${this.getJobDisplayName(character.job)}`;
    info.style.cssText = `
      font-size: 12px;
      color: #666;
      text-align: center;
    `;
    
    // Show injured status if character is injured
    if (isInjured) {
      const injuredData = this.injuredCharacters.get(character.id);
      if (injuredData) {
        const remainingTime = Math.ceil((injuredData.reviveTime - Date.now()) / 1000);
        const injuredStatus = document.createElement('div');
        injuredStatus.textContent = `重伤 (${remainingTime}s)`;
        injuredStatus.style.cssText = `
          font-size: 11px;
          color: #dc3545;
          text-align: center;
          margin-top: 4px;
          font-weight: bold;
        `;
        card.appendChild(injuredStatus);
      }
    }
    
    // Assemble card
    card.appendChild(avatar);
    card.appendChild(name);
    card.appendChild(info);
    
    if (!isInParty && !isInjured) {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px)';
        card.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.15)';
        card.style.borderColor = '#667eea';
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        card.style.borderColor = 'transparent';
      });
      
      card.addEventListener('click', () => {
        this.addCharacterToSlot(character, slotIndex);
        document.body.removeChild(overlay);
      });
    }
    
    return card;
  }

  private addCharacterToSlot(character: any, slotIndex: number): void {
    // Check if character is injured
    if (this.injuredCharacters.has(character.id)) {
      this.showNotification('该角色正在重伤复活中，无法加入编队', 'warning');
      return;
    }
    
    this.partySlots[slotIndex] = character;
    this.refreshPartySlots();
    this.showNotification(`${character.name} 已加入编队`, 'success');
    
    // Update party member IDs in BattleSystem for EXP sharing
    this.updateBattleSystemPartyMembers();
    
    // Update team bag weight display
    this.updateTeamBagWeightDisplay();
    
    // Spawn character in battle scene if in grassland, forest, or cave stage
    if (this.isCurrentStageCombat() && this.battleSceneContainer) {
      this.battleSystem.spawnCharacter(character);
    }
  }

  private removeCharacterFromSlot(slotIndex: number): void {
    const character = this.partySlots[slotIndex];
    if (character) {
      // Clear buff visual effects before removing
      this.clearBuffVisualEffects(character.id);
      
      this.partySlots[slotIndex] = null;
      this.refreshPartySlots();
      this.showNotification(`${character.name} 已移出编队`, 'success');
      
      // Update party member IDs in BattleSystem for EXP sharing
      this.updateBattleSystemPartyMembers();
      
      // Update team bag weight display
      this.updateTeamBagWeightDisplay();
      
      // Despawn character from battle scene if in grassland, forest, or cave stage
      if (this.isCurrentStageCombat() && this.battleSceneContainer) {
        this.battleSystem.despawnCharacter(character.id);
      }
    }
  }

  /**
   * Update BattleSystem with current party member IDs for EXP sharing
   */
  private updateBattleSystemPartyMembers(): void {
    const partyMemberIds = this.partySlots
      .filter(char => char !== null)
      .map(char => char!.id);
    
    console.log('[GameUI] Updating party members for EXP sharing:', partyMemberIds);
    this.battleSystem.setPartyMembers(partyMemberIds);
  }

  private refreshPartySlots(): void {
    const slotsContainer = document.getElementById('party-slots-container');
    if (!slotsContainer) return;
    
    slotsContainer.innerHTML = '';
    
    for (let i = 0; i < 4; i++) {
      const slot = this.createPartySlot(i);
      slotsContainer.appendChild(slot);
    }
    
    // Update team bag max weight based on party members' carryWeight
    this.updateTeamBagMaxWeight();
  }

  /**
   * Recalculate and set team bag max weight from party members' carryWeight
   */
  private updateTeamBagMaxWeight(): void {
    let totalCarryWeight = 0;
    for (let i = 0; i < this.partySlots.length; i++) {
      const character = this.partySlots[i];
      if (character && character.carryWeight) {
        totalCarryWeight += character.carryWeight;
      }
    }
    this.lootSystem.setTeamBagMaxWeight(totalCarryWeight);
  }
  
  /**
   * Initialize battle scene container and spawn party characters (without starting enemy spawning)
   */
  private initializeBattleSceneWithoutSpawning(): void {
    if (!this.sceneContainer) return;
    
    // Create a battle scene overlay container
    const battleContainer = document.createElement('div');
    battleContainer.id = 'battle-scene-container';
    battleContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
    `;
    
    this.sceneContainer.appendChild(battleContainer);
    this.battleSceneContainer = battleContainer;
    
    // Create battle stats counter panel
    this.createBattleStatsPanel();
    
    // Initialize battle system with the container
    this.battleSystem.initialize(battleContainer);
    
    // Set loot system reference
    this.battleSystem.setLootSystem(this.lootSystem);
    
    // Set currency system reference
    this.battleSystem.setCurrencySystem(this.currencySystem);
    
    // Set gold gain callback for passive skills (midas_touch)
    this.battleSystem.setOnGoldGain((amount: number) => {
      if (this.playerEntity) {
        this.currencySystem.addCurrency(this.world, this.playerEntity.id, { gold: amount }, '麦达斯之触');
        this.updateCurrencyDisplay();
      }
    });
    
    // Set resource node system reference and load data
    this.battleSystem.setResourceNodeSystem(this.resourceNodeSystem);
    this.loadResourceNodeData();
    
    // Set current stage for resource node drops (use current stage)
    this.battleSystem.setCurrentStage(this.currentStage);
    
    // Set up loot dropped callback
    this.battleSystem.setOnLootDropped((lootId, itemId, x, y) => {
      this.renderLootDrop(lootId, itemId, x, y);
    });
    
    // Set up stats update callback
    this.battleSystem.setOnStatsUpdate(() => {
      const currentKills = this.battleSystem.getTotalKills();
      const previousKills = (this as any)._lastKnownKills || 0;
      if (currentKills > previousKills) {
        // Emit quest events once per actual kill
        for (let i = 0; i < currentKills - previousKills; i++) {
          this.eventSystem.emit({ type: 'quest:combat_completed', stageId: this.currentStage, timestamp: Date.now() });
          this.eventSystem.emit({ type: 'quest:combat_kill', stageId: this.currentStage, timestamp: Date.now() });
        }
      }
      (this as any)._lastKnownKills = currentKills;
      this.updateBattleStatsPanel();
    });
    
    // Set up enemy death callback (for specific enemy kill tracking)
    this.battleSystem.setOnEnemyDeath((enemyId: string) => {
      this.eventSystem.emit({ type: 'quest:kill_enemy', enemyId, stageId: this.currentStage, timestamp: Date.now() });
    });
    
    // Set up boss spawn callback
    this.battleSystem.setOnBossSpawn(() => {
      this.spawnBoss();
    });
    
    // Set up character injured callback
    this.battleSystem.setOnCharacterInjured((characterId, reviveTime) => {
      this.handleCharacterInjured(characterId, reviveTime);
    });
    
    // Set up character revived callback
    this.battleSystem.setOnCharacterRevived((characterId) => {
      this.handleCharacterRevived(characterId);
    });
    
    // Set up character healed callback
    this.battleSystem.setOnCharacterHealed((characterId, healAmount) => {
      this.showPartySlotHealNumber(characterId, healAmount);
    });
    
    // Set up EXP gain callback
    this.battleSystem.setOnEnemyKilled((characterId, exp) => {
      // Find character and add experience
      const character = this.npcSystem.getRecruitedCharacter(characterId);
      if (character) {
        // addExperience already applies expRate multiplier internally
        this.npcSystem.addExperience(characterId, exp);
        console.log(`[GameUI] ${character.name} gained EXP (base: ${exp}, rate: ${character.expRate}%)`);
      }
    });
    
    // Reset kill counter and crisis meter for new expedition
    this.battleSystem.resetKills();
    (this as any)._lastKnownKills = 0;
    this.battleSystem.resetCrisis();
    
    // Update party members for shared EXP (this will set the current party members)
    this.updateBattleSystemPartyMembers();
    
    // Spawn all characters currently in party slots
    this.partySlots.forEach((character) => {
      if (character) {
        this.battleSystem.spawnCharacter(character);
      }
    });
    
    // NOTE: Enemy spawning, resource node spawning, and loot system updates
    // are deferred until after preparation panel closes
    // Call startEnemySpawning(), battleSystem.startResourceNodeSpawning(), 
    // and startLootSystemUpdate() after preparation is complete
    
    // Add centered preparation button in the battle scene
    this.createPreparationButton();
    
    console.log('[GameUI] Battle scene initialized (spawning deferred for preparation)');
  }

  /**
   * Create a centered preparation button in the battle scene
   */
  private createPreparationButton(): void {
    if (!this.sceneContainer) return;
    
    // Check if button already exists
    const existingButton = document.getElementById('preparation-button-overlay');
    if (existingButton) {
      existingButton.remove();
    }
    
    // Create button overlay container
    const buttonOverlay = document.createElement('div');
    buttonOverlay.id = 'preparation-button-overlay';
    buttonOverlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 100;
      pointer-events: auto;
    `;
    
    // Create the preparation button
    const preparationBtn = document.createElement('button');
    preparationBtn.textContent = '⚔️ 战前准备';
    preparationBtn.style.cssText = `
      padding: 20px 60px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: 3px solid white;
      border-radius: 16px;
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    preparationBtn.addEventListener('mouseenter', () => {
      preparationBtn.style.transform = 'scale(1.1)';
      preparationBtn.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.5)';
    });
    preparationBtn.addEventListener('mouseleave', () => {
      preparationBtn.style.transform = 'scale(1)';
      preparationBtn.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';
    });
    preparationBtn.addEventListener('click', () => {
      this.showPreparationPanel();
    });
    
    buttonOverlay.appendChild(preparationBtn);
    this.sceneContainer.appendChild(buttonOverlay);
  }

  /**
   * Show preparation panel before starting battle
   */
  private showPreparationPanel(): void {
    this.battlePaused = true;
    
    // Hide the preparation button when panel is open
    const buttonOverlay = document.getElementById('preparation-button-overlay');
    if (buttonOverlay) {
      buttonOverlay.style.display = 'none';
    }
    
    this.preparationPanel = new PreparationPanel(
      this.world,
      this.npcSystem,
      this.itemSystem,
      this.lootSystem,
      this.partySlots,
      this.itemsData,
      () => this.onPreparationComplete(),
      () => this.onPreparationPanelClosed(),
      (characterId, newHunger) => this.checkHungerBuff(characterId, newHunger)
    );
    
    this.preparationPanel.show();
    
    console.log('[GameUI] Preparation panel shown, battle paused');
  }

  /**
   * Called when preparation panel is closed without starting battle
   */
  private onPreparationPanelClosed(): void {
    // Refresh party slots first (this recreates DOM elements)
    this.refreshPartySlots();
    
    // Then re-disable party panel since battle hasn't started
    this.setPartyPanelEnabled(false);
    
    console.log('[GameUI] Preparation panel closed, party panel remains disabled');
  }

  /**
   * Called when preparation is complete and battle should start
   */
  private onPreparationComplete(): void {
    this.battlePaused = false;
    
    // Hide the preparation button when battle starts
    const buttonOverlay = document.getElementById('preparation-button-overlay');
    if (buttonOverlay) {
      buttonOverlay.style.display = 'none';
    }
    
    // Enable party panel now that battle has started
    this.setPartyPanelEnabled(true);
    
    // Refresh party slots to show the characters added in preparation panel
    this.refreshPartySlots();
    
    // Update battle system with party members
    this.updateBattleSystemPartyMembers();
    
    // Update team bag display to show items added during preparation
    this.updateTeamInventoryDisplay();
    
    // Spawn party characters into the battle scene
    this.partySlots.forEach((character) => {
      if (character) {
        // Ensure hunger BUFF is applied/removed based on current hunger
        this.checkHungerBuff(character.id, character.currentHunger || 0);
        this.battleSystem.spawnCharacter(character);
      }
    });
    
    // Start combat systems
    this.startEnemySpawning();
    this.battleSystem.startResourceNodeSpawning();
    this.startLootSystemUpdate();
    
    // Cleanup preparation panel
    if (this.preparationPanel) {
      this.preparationPanel = null;
    }
    
    console.log('[GameUI] Preparation complete, battle started');
  }

  /**
   * Enable or disable the party panel
   */
  private setPartyPanelEnabled(enabled: boolean): void {
    const partySlots = document.querySelectorAll('.party-slot');
    const autoPartyBtn = document.querySelector('#auto-party-btn') as HTMLButtonElement;
    
    partySlots.forEach((slot) => {
      const slotElement = slot as HTMLElement;
      if (enabled) {
        // Enable: restore normal appearance and functionality
        slotElement.style.opacity = '1';
        slotElement.style.pointerEvents = 'auto';
        slotElement.style.filter = 'none';
      } else {
        // Disable: gray out and prevent interaction
        slotElement.style.opacity = '0.5';
        slotElement.style.pointerEvents = 'none';
        slotElement.style.filter = 'grayscale(100%)';
      }
    });
    
    // Also disable/enable the auto-party button
    if (autoPartyBtn) {
      autoPartyBtn.disabled = !enabled;
      if (enabled) {
        autoPartyBtn.style.opacity = '1';
        autoPartyBtn.style.cursor = 'pointer';
        autoPartyBtn.style.filter = 'none';
      } else {
        autoPartyBtn.style.opacity = '0.5';
        autoPartyBtn.style.cursor = 'not-allowed';
        autoPartyBtn.style.filter = 'grayscale(100%)';
      }
    }
  }
  
  /**
   * Start automatic enemy spawning (3-8 seconds interval)
   */
  private startEnemySpawning(): void {
    if (!this.enemySystem) {
      console.warn('[GameUI] Enemy system not initialized yet');
      return;
    }

    // Define the enemy types that can spawn in each stage
    // Separate normal enemies and boss enemies
    const stageEnemies: Record<string, { normal: string[], boss: string }> = {
      grassland: {
        normal: [
          'enemy_wetland_two_headed_snake',
          'enemy_sweet_syrup_slime',
          'enemy_giant_grass_mushroom_worm'
        ],
        boss: 'enemy_red_mane'
      },
      forest: {
        normal: [
          'enemy_bitter_root_sunflower',
          'enemy_blue_mushroom_spider',
          'enemy_salt_stone_behemoth'
        ],
        boss: 'enemy_huke'
      },
      cave: {
        normal: [
          'enemy_corpse_potato_plant',
          'enemy_fire_tongue_frog',
          'enemy_giant_tooth_vine'
        ],
        boss: 'enemy_ghost_lizard'
      }
    };

    // Get enemy list for current stage
    const stageConfig = stageEnemies[this.currentStage] || stageEnemies.grassland;

    this.battleSystem.startEnemySpawning(() => {
      // Check if crisis value is at 100% to spawn boss
      const crisisValue = this.battleSystem.getCrisisValue();
      let enemyType: string;
      
      if (crisisValue >= 100) {
        // Spawn boss when crisis is full
        enemyType = stageConfig.boss;
      } else {
        // Spawn normal enemy
        const normalEnemies = stageConfig.normal;
        enemyType = normalEnemies[Math.floor(Math.random() * normalEnemies.length)];
      }
      
      // Create enemy
      const enemy = this.enemySystem.createEnemy(enemyType);
      if (enemy) {
        // Calculate level-ups based on total kills (10% of kills)
        const totalKills = this.battleSystem.getTotalKills();
        const levelUps = Math.floor(totalKills * 0.1);
        
        // Apply level-ups to enemy
        if (levelUps > 0) {
          const originalLevel = enemy.level;
          const originalMaxHP = enemy.maxHP;
          const originalAttack = enemy.attack;
          
          for (let i = 0; i < levelUps; i++) {
            enemy.level++;
            enemy.maxHP += 2;
            enemy.attack += 0.5;
          }
          
          // Heal to full HP after leveling
          enemy.currentHP = enemy.maxHP;
          
          console.log(`[GameUI] Enemy auto-leveled: ${enemy.name} Lv.${originalLevel}→${enemy.level} (HP: ${originalMaxHP}→${enemy.maxHP}, ATK: ${originalAttack}→${enemy.attack})`);
        }
        
        // Spawn enemy far from adventurers
        this.battleSystem.spawnCharacterAwayFromAdventurers(enemy, 200);
        console.log(`[GameUI] Auto-spawned enemy: ${enemy.name} Lv.${enemy.level}`);
      }
    });
  }
  
  /**
   * Spawn boss enemy based on current stage
   */
  private spawnBoss(): void {
    if (!this.enemySystem) {
      console.error('[GameUI] Enemy system not initialized');
      return;
    }

    // Determine boss type based on current stage
    const stageBossMap: Record<string, string> = {
      grassland: 'enemy_red_mane',
      forest: 'enemy_huke',
      cave: 'enemy_ghost_lizard'
    };
    const bossEnemyId = stageBossMap[this.currentStage] || 'enemy_red_mane';

    console.log(`[GameUI] Spawning boss for stage ${this.currentStage}: ${bossEnemyId}`);
    
    // Create boss enemy
    const boss = this.enemySystem.createEnemy(bossEnemyId);
    if (!boss) {
      console.error('[GameUI] Failed to create boss');
      return;
    }

    // Get highest adventurer level
    const highestLevel = this.battleSystem.getHighestAdventurerLevel();
    const targetLevel = highestLevel + 3;
    
    console.log(`[GameUI] Highest adventurer level: ${highestLevel}, boss target level: ${targetLevel}`);
    
    // Level up boss to target level
    const levelsToGain = targetLevel - boss.level;
    for (let i = 0; i < levelsToGain; i++) {
      boss.level++;
      boss.maxHP += 2;
      boss.currentHP = boss.maxHP; // Heal to full on level up
      boss.attack += 1;
      boss.defense += 1;
      boss.weight += 1;
    }
    
    console.log(`[GameUI] Boss leveled up to ${boss.level}: HP=${boss.maxHP}, ATK=${boss.attack}, DEF=${boss.defense}, Weight=${boss.weight}`);
    
    // Spawn boss far from all adventurers
    this.battleSystem.spawnCharacterAwayFromAdventurers(boss, 300);
    
    // Mark as boss for tracking behavior
    this.battleSystem.markAsBoss(boss.id);
    
    // Show boss spawn notification
    this.showNotification(`⚠️ BOSS出现！${boss.name}降临战场！`, 'warning', 5000);
    
    console.log(`[GameUI] Boss spawned: ${boss.name} Lv.${boss.level}`);
  }

  /**
   * Load resource node data from JSON
   */
  private async loadResourceNodeData(): Promise<void> {
    try {
      const response = await fetch('src/game/data/resource-nodes.json');
      const data = await response.json();
      await this.resourceNodeSystem.loadResourceNodes(data);
      console.log('[GameUI] Resource node data loaded successfully');
    } catch (error) {
      console.error('[GameUI] Failed to load resource node data:', error);
    }
  }
  
  /**
   * Cleanup battle scene
   */
  private cleanupBattleScene(): void {
    if (this.battleSceneContainer) {
      this.battleSystem.clearAll();
      if (this.battleSceneContainer.parentNode) {
        this.battleSceneContainer.parentNode.removeChild(this.battleSceneContainer);
      }
      this.battleSceneContainer = null;
    }
    
    // Remove battle stats panel
    const statsPanel = document.getElementById('battle-stats-panel');
    if (statsPanel && statsPanel.parentNode) {
      statsPanel.parentNode.removeChild(statsPanel);
    }
    
    // Stop enemy spawning
    this.battleSystem.stopEnemySpawning();
    
    // Clear all enemies from enemy system
    if (this.enemySystem) {
      this.enemySystem.clearAllEnemies();
    }
    
    // Clear injured character intervals
    this.injuredCharacters.forEach((data) => {
      clearInterval(data.intervalId);
    });
    this.injuredCharacters.clear();
    
    // Stop party update interval when leaving battle scene
    this.stopPartyUpdateInterval();
  }

  /**
   * Create battle stats counter panel in top-left corner
   */
  private createBattleStatsPanel(): void {
    if (!this.sceneContainer) return;
    
    const panel = document.createElement('div');
    panel.id = 'battle-stats-panel';
    panel.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 100;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      min-width: 180px;
    `;
    
    panel.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: bold; font-size: 16px; color: #ffd700;">📊 战斗统计</div>
      <div style="margin-bottom: 6px;">
        <span style="color: #ff6b6b;">🎯 怪物:</span>
        <span id="enemy-count-display" style="font-weight: bold; margin-left: 8px;">0/10</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="color: #51cf66;">⚔️ 击杀:</span>
        <span id="kill-count-display" style="font-weight: bold; margin-left: 8px;">0</span>
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #ff9500;">⚠️ 危机值:</span>
      </div>
      <div style="width: 100%; height: 16px; background: rgba(0, 0, 0, 0.5); border-radius: 8px; overflow: hidden; border: 1px solid #666;">
        <div id="crisis-meter-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #ffd700 0%, #ff6b00 50%, #ff0000 100%); transition: width 0.3s ease;"></div>
      </div>
      <div style="text-align: center; margin-top: 2px;">
        <span id="crisis-value-display" style="font-size: 12px; color: #ffd700; font-weight: bold;">0%</span>
      </div>
    `;
    
    this.sceneContainer.appendChild(panel);
    
    // Initial update
    this.updateBattleStatsPanel();
  }

  /**
   * Update battle stats panel with current values
   */
  private updateBattleStatsPanel(): void {
    const enemyCountDisplay = document.getElementById('enemy-count-display');
    const killCountDisplay = document.getElementById('kill-count-display');
    const crisisMeterFill = document.getElementById('crisis-meter-fill') as HTMLElement;
    const crisisValueDisplay = document.getElementById('crisis-value-display');
    
    if (enemyCountDisplay) {
      const currentEnemies = this.battleSystem.getEnemyCount();
      const maxEnemies = this.battleSystem.getMaxEnemies();
      enemyCountDisplay.textContent = `${currentEnemies}/${maxEnemies}`;
    }
    
    if (killCountDisplay) {
      const totalKills = this.battleSystem.getTotalKills();
      killCountDisplay.textContent = `${totalKills}`;
    }
    
    if (crisisMeterFill && crisisValueDisplay) {
      const crisisValue = this.battleSystem.getCrisisValue();
      crisisMeterFill.style.width = `${crisisValue}%`;
      crisisValueDisplay.textContent = `${crisisValue}%`;
      
      // Change color based on crisis level
      if (crisisValue >= 100) {
        crisisValueDisplay.style.color = '#ff0000';
      } else if (crisisValue >= 75) {
        crisisValueDisplay.style.color = '#ff6b00';
      } else {
        crisisValueDisplay.style.color = '#ffd700';
      }
    }
  }

  /**
   * Start party slots update interval
   */
  private startPartyUpdateInterval(): void {
    // Clear existing interval if any
    this.stopPartyUpdateInterval();
    
    // Update every 100ms (10 times per second) for smooth updates
    this.partyUpdateInterval = window.setInterval(() => {
      this.updatePartySlotsBars();
    }, 100);
  }

  /**
   * Stop party slots update interval
   */
  private stopPartyUpdateInterval(): void {
    if (this.partyUpdateInterval !== null) {
      clearInterval(this.partyUpdateInterval);
      this.partyUpdateInterval = null;
    }
  }

  /**
   * Update only the HP/MP/EXP bars in party slots without recreating the entire slot
   */
  private updatePartySlotsBars(): void {
    const slotsContainer = document.getElementById('party-slots-container');
    if (!slotsContainer) return;

    for (let i = 0; i < 4; i++) {
      const character = this.partySlots[i];
      if (!character) continue;

      const slot = slotsContainer.querySelector(`[data-slot-index="${i}"]`) as HTMLElement;
      if (!slot) continue;

      // Update level and job info
      const levelJobDiv = slot.querySelector('.character-level-job') as HTMLElement;
      if (levelJobDiv) {
        levelJobDiv.textContent = `Lv.${character.level} ${this.getJobDisplayName(character.job)}`;
      }

      // Update HP bar
      const hpBar = slot.querySelector('[data-bar-type="hp"]');
      if (hpBar) {
        const hpFill = hpBar.querySelector('.bar-fill') as HTMLElement;
        const hpText = hpBar.querySelector('.bar-text') as HTMLElement;
        if (hpFill && hpText) {
          const safeCurrent = isNaN(character.currentHP) ? 0 : character.currentHP;
          const safeMax = isNaN(character.maxHP) || character.maxHP === 0 ? 1 : character.maxHP;
          const hpPercentage = Math.max(0, Math.min(100, (safeCurrent / safeMax) * 100));
          hpFill.style.width = `${hpPercentage}%`;
          hpText.textContent = `${Math.floor(safeCurrent)}/${Math.floor(safeMax)}`;
        }
      }

      // Update MP bar
      const mpBar = slot.querySelector('[data-bar-type="mp"]');
      if (mpBar) {
        const mpFill = mpBar.querySelector('.bar-fill') as HTMLElement;
        const mpText = mpBar.querySelector('.bar-text') as HTMLElement;
        if (mpFill && mpText) {
          const safeCurrent = isNaN(character.currentMP) ? 0 : character.currentMP;
          const safeMax = isNaN(character.maxMP) || character.maxMP === 0 ? 1 : character.maxMP;
          const mpPercentage = Math.max(0, Math.min(100, (safeCurrent / safeMax) * 100));
          mpFill.style.width = `${mpPercentage}%`;
          mpText.textContent = `${Math.floor(safeCurrent)}/${Math.floor(safeMax)}`;
        }
      }

      // Update EXP bar
      const expBar = slot.querySelector('[data-bar-type="exp"]');
      if (expBar) {
        const expFill = expBar.querySelector('.bar-fill') as HTMLElement;
        const expText = expBar.querySelector('.bar-text') as HTMLElement;
        if (expFill && expText) {
          const safeCurrent = isNaN(character.currentEXP) ? 0 : character.currentEXP;
          const safeMax = isNaN(character.maxEXP) || character.maxEXP === 0 ? 1 : character.maxEXP;
          const expPercentage = Math.max(0, Math.min(100, (safeCurrent / safeMax) * 100));
          expFill.style.width = `${expPercentage}%`;
          expText.textContent = `${Math.floor(safeCurrent)}/${Math.floor(safeMax)}`;
        }
      }

      // Update BUFF icons
      const buffContainer = slot.querySelector('.buff-icons-container') as HTMLElement;
      if (buffContainer) {
        // Check if tooltip is showing for a buff that's about to be removed
        if (this.buffTooltip) {
          const tooltipStillValid = this.buffSystem.getActiveBuffs(character.id).length > 0;
          if (!tooltipStillValid) {
            this.hideBuffTooltip();
          }
        }
        
        buffContainer.innerHTML = '';
        const activeBuffs = this.buffSystem.getActiveBuffs(character.id);
        activeBuffs.forEach(activeBuff => {
          const buffDef = this.buffSystem.getBuffDefinition(activeBuff.buffId);
          if (buffDef) {
            const buffIcon = this.createBuffIcon(buffDef, activeBuff.remainingDuration, buffDef.duration, activeBuff.stacks);
            buffContainer.appendChild(buffIcon);
          }
        });
      }

      // Update buff visual effects
      this.applyBuffVisualEffects(character.id, slot);
    }
  }

  /**
   * Show floating green heal number on party slot avatar
   */
  private showPartySlotHealNumber(characterId: string, healAmount: number): void {
    const partySlots = document.querySelectorAll('.party-slot');
    for (const slot of Array.from(partySlots)) {
      const avatarContainer = slot.querySelector('.avatar-container');
      if (avatarContainer && avatarContainer.getAttribute('data-character-id') === characterId) {
        const healEl = document.createElement('div');
        healEl.textContent = `+${Math.floor(healAmount)}`;
        healEl.style.cssText = `
          position: absolute;
          left: 50%;
          top: 0;
          transform: translateX(-50%);
          color: #44ff44;
          font-size: 16px;
          font-weight: bold;
          text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
          pointer-events: none;
          z-index: 100;
          animation: partySlotHealFloat 1.5s ease-out forwards;
        `;
        avatarContainer.appendChild(healEl);

        // Add animation if not already present
        if (!document.getElementById('party-slot-heal-animation')) {
          const style = document.createElement('style');
          style.id = 'party-slot-heal-animation';
          style.textContent = `
            @keyframes partySlotHealFloat {
              0% { opacity: 1; transform: translateX(-50%) translateY(0); }
              100% { opacity: 0; transform: translateX(-50%) translateY(-30px); }
            }
          `;
          document.head.appendChild(style);
        }

        setTimeout(() => {
          if (healEl.parentNode) healEl.parentNode.removeChild(healEl);
        }, 1500);
        break;
      }
    }
  }

  /**
   * Handle character becoming injured
   */
  private handleCharacterInjured(characterId: string, reviveTime: number): void {
    console.log(`[GameUI] Character ${characterId} injured, revive time: ${reviveTime}`);
    
    // Start countdown interval for this character
    const intervalId = window.setInterval(() => {
      this.updateInjuredCharacterCountdown(characterId, reviveTime);
    }, 1000);
    
    // Store the interval ID
    this.injuredCharacters.set(characterId, { reviveTime, intervalId });
    
    // Immediately update the UI
    this.updateInjuredCharacterCountdown(characterId, reviveTime);
  }

  /**
   * Handle character being revived
   */
  private handleCharacterRevived(characterId: string): void {
    console.log(`[GameUI] Character ${characterId} revived`);
    
    // Clear the countdown interval
    const injuredData = this.injuredCharacters.get(characterId);
    if (injuredData) {
      clearInterval(injuredData.intervalId);
      this.injuredCharacters.delete(characterId);
    }
    
    // Update the UI to remove grayscale and countdown
    this.updateRevivedCharacterUI(characterId);
    
    // Check if character is in party slots
    const characterInParty = this.partySlots.find(slot => slot && slot.id === characterId);
    
    // Re-apply hunger BUFF effects if character still has hunger ≤ 0
    if (characterInParty && characterInParty.currentHunger !== undefined) {
      this.checkHungerBuff(characterId, characterInParty.currentHunger);
    }
    
    // If character is in party and we're in a battle stage, respawn them
    if (characterInParty && this.isCurrentStageCombat() && this.battleSceneContainer) {
      console.log(`[GameUI] Respawning revived character ${characterInParty.name} in battle scene`);
      this.battleSystem.spawnCharacter(characterInParty);
      this.showNotification(`${characterInParty.name} 已复活并重新加入战斗！`, 'success');
    }
  }

  /**
   * Update countdown display for injured character
   */
  private updateInjuredCharacterCountdown(characterId: string, reviveTime: number): void {
    const slotsContainer = document.getElementById('party-slots-container');
    if (!slotsContainer) return;
    
    // Find the slot index for this character
    let slotIndex = -1;
    for (let i = 0; i < this.partySlots.length; i++) {
      if (this.partySlots[i] && this.partySlots[i].id === characterId) {
        slotIndex = i;
        break;
      }
    }
    
    // If character is not in party slots, don't update UI (but keep the timer running for actual revival)
    if (slotIndex === -1) return;
    
    const slot = slotsContainer.querySelector(`[data-slot-index="${slotIndex}"]`) as HTMLElement;
    if (!slot) return;
    
    // Calculate remaining time
    const now = Date.now();
    const remainingMs = reviveTime - now;
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    
    // If time is up, the BattleSystem will handle the revival
    if (remainingSeconds === 0) {
      return;
    }
    
    // Apply grayscale filter to the entire slot
    slot.style.filter = 'grayscale(100%)';
    slot.style.opacity = '0.6';
    
    // Find or create countdown overlay on avatar
    const avatar = slot.querySelector('div[style*="border-radius: 50%"]') as HTMLElement;
    if (avatar) {
      let countdown = avatar.querySelector('.revive-countdown') as HTMLElement;
      if (!countdown) {
        countdown = document.createElement('div');
        countdown.className = 'revive-countdown';
        countdown.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 20px;
          font-weight: bold;
          text-shadow: 
            -2px -2px 0 #000,
            2px -2px 0 #000,
            -2px 2px 0 #000,
            2px 2px 0 #000,
            0 0 5px rgba(0, 0, 0, 0.8);
          z-index: 10;
          pointer-events: none;
        `;
        // Make avatar position relative if not already
        if (avatar.style.position !== 'relative' && avatar.style.position !== 'absolute') {
          avatar.style.position = 'relative';
        }
        avatar.appendChild(countdown);
      }
      countdown.textContent = `${remainingSeconds}s`;
    }
  }

  /**
   * Update UI when character is revived
   */
  private updateRevivedCharacterUI(characterId: string): void {
    const slotsContainer = document.getElementById('party-slots-container');
    if (!slotsContainer) return;
    
    // Find the slot index for this character
    let slotIndex = -1;
    for (let i = 0; i < this.partySlots.length; i++) {
      if (this.partySlots[i] && this.partySlots[i].id === characterId) {
        slotIndex = i;
        break;
      }
    }
    
    if (slotIndex === -1) return;
    
    const slot = slotsContainer.querySelector(`[data-slot-index="${slotIndex}"]`) as HTMLElement;
    if (!slot) return;
    
    // Remove grayscale filter
    slot.style.filter = '';
    slot.style.opacity = '1';
    
    // Remove countdown overlay
    const countdown = slot.querySelector('.revive-countdown');
    if (countdown) {
      countdown.remove();
    }
  }

  /**
   * Render a loot drop in the battle scene
   */
  private renderLootDrop(lootId: string, itemId: string, x: number, y: number): void {
    if (!this.battleSceneContainer) return;
    
    const item = this.itemSystem.getItem(itemId);
    if (!item) {
      console.error(`[GameUI] Item not found: ${itemId}`);
      return;
    }
    
    const rarityColor = this.getRarityColor(item.rarity);
    
    const lootElement = document.createElement('div');
    lootElement.id = `loot-${lootId}`;
    lootElement.className = 'loot-drop';
    lootElement.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 50px;
      height: 50px;
      cursor: pointer;
      transition: transform 0.2s;
      z-index: 100;
      pointer-events: auto;
    `;
    
    lootElement.innerHTML = `
      <div style="
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.9);
        border: 3px solid ${rarityColor};
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 12px ${rarityColor}80;
        overflow: hidden;
      ">
        <img src="${item.icon}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">
      </div>
    `;
    
    // Add hover effect
    lootElement.addEventListener('mouseenter', () => {
      lootElement.style.transform = 'scale(1.1)';
    });
    
    lootElement.addEventListener('mouseleave', () => {
      lootElement.style.transform = 'scale(1)';
    });
    
    // Add click handler for manual pickup
    lootElement.addEventListener('click', () => {
      this.pickupLoot(lootId);
    });
    
    this.battleSceneContainer.appendChild(lootElement);
    console.log(`[GameUI] Rendered loot drop: ${item.name} at (${x}, ${y})`);

    // Show first-time hint
    if (!this.hasShownLootDropHint) {
      this.hasShownLootDropHint = true;
      this.showShakingHint(lootElement, '点击拾取战利品');
    }
  }

  /**
   * Pick up a loot drop
   */
  private pickupLoot(lootId: string): void {
    const success = this.lootSystem.pickupLoot(lootId);
    if (success) {
      // Remove loot element from scene
      const lootElement = document.getElementById(`loot-${lootId}`);
      if (lootElement) {
        lootElement.remove();
      }
      
      // Update loot panel and track inventory
      const lootInventory = this.lootSystem.getLootInventory();
      this.lastLootInventorySize = lootInventory.size;
      this.lastLootInventoryHash = this.getLootInventoryHash(lootInventory);
      this.updateLootPanel();
      
      console.log(`[GameUI] Picked up loot: ${lootId}`);
    }
  }

  /**
   * Start loot system update loop (for auto-pickup)
   */
  private lootUpdateInterval: number | null = null;
  private lastLootInventorySize: number = 0;
  private lastLootInventoryHash: string = '';
  
  private startLootSystemUpdate(): void {
    // Clear existing interval if any
    if (this.lootUpdateInterval) {
      clearInterval(this.lootUpdateInterval);
    }
    
    // Update every 100ms
    this.lootUpdateInterval = window.setInterval(() => {
      this.lootSystem.update(0.1);
      
      // Check for auto-picked up loots and remove their elements
      const droppedLoots = this.lootSystem.getDroppedLoots();
      const lootIds = new Set(droppedLoots.map(l => l.id));
      
      // Remove elements for loots that no longer exist (auto-picked up)
      if (this.battleSceneContainer) {
        const lootElements = this.battleSceneContainer.querySelectorAll('.loot-drop');
        lootElements.forEach(element => {
          const lootId = element.id.replace('loot-', '');
          if (!lootIds.has(lootId)) {
            element.remove();
            console.log(`[GameUI] Auto-picked up loot: ${lootId}`);
          }
        });
      }
      
      // Check if inventory content changed (not just size)
      const lootInventory = this.lootSystem.getLootInventory();
      const currentHash = this.getLootInventoryHash(lootInventory);
      if (currentHash !== this.lastLootInventoryHash) {
        console.log(`[GameUI] Loot inventory changed, updating panel`);
        this.lastLootInventoryHash = currentHash;
        this.lastLootInventorySize = lootInventory.size;
        this.updateLootPanel();
      }
    }, 100);
  }
  
  /**
   * Generate a hash of the loot inventory for change detection
   */
  private getLootInventoryHash(inventory: Map<string, number>): string {
    const items: string[] = [];
    inventory.forEach((quantity, itemId) => {
      items.push(`${itemId}:${quantity}`);
    });
    return items.sort().join('|');
  }

  /**
   * Stop loot system update loop
   */
  private stopLootSystemUpdate(): void {
    if (this.lootUpdateInterval) {
      clearInterval(this.lootUpdateInterval);
      this.lootUpdateInterval = null;
    }
  }

  /**
   * Get rarity color based on rarity value
   */
  private getRarityColor(rarity: number): string {
    const rarityColors: Record<number, string> = {
      0: '#FFFFFF', // 普通 - 白色
      1: '#2196f3', // 稀有 - 蓝色
      2: '#9c27b0', // 神话 - 紫色
      3: '#ff9800'  // 传说 - 橙色
    };
    return rarityColors[rarity] || rarityColors[0];
  }

  /**
   * Get rarity name based on rarity value
   */
  private getRarityName(rarity: number): string {
    const rarityNames: Record<number, string> = {
      0: '普通',
      1: '稀有',
      2: '神话',
      3: '传说'
    };
    return rarityNames[rarity] || rarityNames[0];
  }

  /**
   * Convert rarity string to number
   */
  private convertRarityStringToNumber(rarityString: string): number {
    const rarityMap: Record<string, number> = {
      'common': 0,
      'uncommon': 0,
      'rare': 1,
      'epic': 2,
      'legendary': 3
    };
    return rarityMap[rarityString] || 0;
  }

  /**
   * Show item tooltip
   */
  private showItemTooltip(event: MouseEvent, item: any, quantity: number): void {
    // Remove existing tooltip
    this.hideItemTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.id = 'item-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px;
      border-radius: 8px;
      z-index: 10001;
      pointer-events: none;
      min-width: 200px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      border: 2px solid ${this.getRarityColor(item.rarity)};
    `;
    
    const rarityColor = this.getRarityColor(item.rarity);
    const rarityName = this.getRarityName(item.rarity);
    
    // Build affix display HTML if item has affixes
    let affixHTML = '';
    const tooltipAffixes = normalizeAffixes(item.affix);
    if (tooltipAffixes.length > 0) {
      const affixLines = tooltipAffixes.map((a: any) => {
        const affixColor = getAffixColorStyle(a.rarity);
        const affixText = formatAffixDisplayWithRange(a);
        return `<div style="color: #fff; text-shadow: -1px -1px 0 ${affixColor}, 1px -1px 0 ${affixColor}, -1px 1px 0 ${affixColor}, 1px 1px 0 ${affixColor}, 0 0 4px ${affixColor}; font-weight: bold;">${affixText}</div>`;
      }).join('');
      affixHTML = `
        <div style="font-size: 12px; border-top: 1px solid #555; padding-top: 8px; margin-top: 8px;">
          ${affixLines}
        </div>
      `;
    }
    
    tooltip.innerHTML = `
      <div style="display: flex; gap: 12px; margin-bottom: 8px;">
        <div style="width: 60px; height: 60px; background: #333; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px solid ${rarityColor}; flex-shrink: 0;">
          <img src="${item.icon}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">
        </div>
        <div style="flex: 1;">
          <div style="font-size: 14px; font-weight: bold; color: ${rarityColor}; margin-bottom: 4px;">${item.name}</div>
          <div style="font-size: 12px; color: ${rarityColor};">稀有度: ${rarityName}</div>
          <div style="font-size: 12px; color: #aaa;">数量: x${quantity}</div>
          ${item.buyPrice != null ? `<div style="font-size: 12px; color: #ffd700;">💰 价值: ${item.buyPrice} 金币</div>` : ''}
          ${item.type === 'food' && item.hungerRestore ? `<div style="font-size: 12px; color: #66bb6a;">🍖 饱腹度+${item.hungerRestore}</div>` : ''}
        </div>
      </div>
      <div style="font-size: 12px; color: #ccc; line-height: 1.4; border-top: 1px solid #555; padding-top: 8px;">
        ${item.description || '无描述'}
      </div>
      ${affixHTML}
    `;
    
    document.body.appendChild(tooltip);
    
    // Position tooltip near mouse
    const x = event.clientX + 10;
    const y = event.clientY + 10;
    
    // Adjust if tooltip goes off screen
    const rect = tooltip.getBoundingClientRect();
    const adjustedX = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 10 : x;
    const adjustedY = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 10 : y;
    
    tooltip.style.left = `${adjustedX}px`;
    tooltip.style.top = `${adjustedY}px`;
  }

  /**
   * Hide item tooltip
   */
  private hideItemTooltip(): void {
    const tooltip = document.getElementById('item-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  /**
   * Update loot panel display
   */
  private updateLootPanel(): void {
    this.updateLootPanelDisplay();
  }

  /**
   * Update loot panel display (detailed implementation)
   */
  private updateLootPanelDisplay(): void {
    const lootContent = document.getElementById('loot-content');
    if (!lootContent) return;

    // Remove loot panel hint if it still exists (item was clicked or panel refreshed)
    const existingHint = document.getElementById('loot-panel-hint');
    if (existingHint) existingHint.remove();
    
    const lootInventory = this.lootSystem.getLootInventory();
    console.log(`[GameUI] Updating loot panel display, inventory size: ${lootInventory.size}`);
    
    if (lootInventory.size === 0) {
      lootContent.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: #999; font-size: 12px;">
          暂无战利品
        </div>
      `;
      return;
    }
    
    lootContent.innerHTML = '';
    
    lootInventory.forEach((quantity, itemId) => {
      const item = this.itemSystem.getItem(itemId);
      if (!item) return;
      
      const rarityColor = this.getRarityColor(item.rarity);
      
      const itemCard = document.createElement('div');
      itemCard.style.cssText = `
        aspect-ratio: 1;
        background: #f5f5f5;
        border: 3px solid ${rarityColor};
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        overflow: hidden;
        transform-origin: center center;
      `;
      
      itemCard.addEventListener('mouseenter', (e) => {
        itemCard.style.boxShadow = `0 4px 12px ${rarityColor}80`;
        itemCard.style.zIndex = '10';
        this.showItemTooltip(e, item, quantity);
      });
      
      itemCard.addEventListener('mouseleave', () => {
        itemCard.style.boxShadow = 'none';
        itemCard.style.zIndex = '1';
        this.hideItemTooltip();
      });
      
      itemCard.addEventListener('mousemove', (e) => {
        // Update tooltip position as mouse moves
        const tooltip = document.getElementById('item-tooltip');
        if (tooltip) {
          const x = e.clientX + 10;
          const y = e.clientY + 10;
          const rect = tooltip.getBoundingClientRect();
          const adjustedX = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 10 : x;
          const adjustedY = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 10 : y;
          tooltip.style.left = `${adjustedX}px`;
          tooltip.style.top = `${adjustedY}px`;
        }
      });
      
      // Long press support for continuous transfer
      let pressTimer: number | null = null;
      let transferInterval: number | null = null;
      
      const clearTimers = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        if (transferInterval) {
          clearInterval(transferInterval);
          transferInterval = null;
        }
      };
      
      const transferOneItem = () => {
        // Check weight capacity before transferring
        const canTransfer = this.canTransferToTeamBag(itemId, 1);
        if (!canTransfer.allowed) {
          this.showNotification(canTransfer.reason || '无法转移物品', 'warning');
          clearTimers();
          return false;
        }
        
        // Transfer only 1 item to team bag inventory
        if (this.lootSystem.transferToTeamInventory(itemId, 1)) {
          this.lastLootInventorySize = this.lootSystem.getLootInventory().size;
          this.updateLootPanelDisplay();
          this.updateTeamInventoryDisplay();
          return true;
        }
        clearTimers();
        return false;
      };
      
      const handleMouseDown = (e: MouseEvent) => {
        // Prevent default to avoid text selection during long press
        e.preventDefault();
        
        // Hide tooltip immediately when clicked
        this.hideItemTooltip();
        
        // Transfer one item immediately on click
        transferOneItem();
        
        // Start long press timer (500ms delay before continuous transfer)
        pressTimer = window.setTimeout(() => {
          // Start continuous transfer (every 100ms)
          transferInterval = window.setInterval(() => {
            const success = transferOneItem();
            if (!success) {
              clearTimers();
            }
          }, 100);
        }, 500);
      };
      
      const handleMouseUp = () => {
        clearTimers();
      };
      
      const handleMouseLeave = () => {
        clearTimers();
      };
      
      itemCard.addEventListener('mousedown', handleMouseDown);
      itemCard.addEventListener('mouseup', handleMouseUp);
      itemCard.addEventListener('mouseleave', handleMouseLeave);
      
      // Add global mouseup listener to ensure timers are cleared even if mouse is released outside the card
      const globalMouseUpHandler = () => {
        clearTimers();
        document.removeEventListener('mouseup', globalMouseUpHandler);
      };
      
      itemCard.addEventListener('mousedown', () => {
        document.addEventListener('mouseup', globalMouseUpHandler);
      });
      
      itemCard.innerHTML = `
        <img src="${item.icon}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">
        <div style="position: absolute; bottom: 2px; right: 2px; background: rgba(0, 0, 0, 0.7); color: white; padding: 2px 4px; border-radius: 4px; font-size: 10px; font-weight: bold;">
          ${quantity}
        </div>
      `;
      
      lootContent.appendChild(itemCard);
    });

    // Show first-time hint on the first item card
    if (!this.hasShownLootPanelHint && lootContent.firstElementChild) {
      this.hasShownLootPanelHint = true;
      const firstCard = lootContent.firstElementChild as HTMLElement;
      const rect = firstCard.getBoundingClientRect();
      const hint = document.createElement('div');
      hint.id = 'loot-panel-hint';
      hint.textContent = '点击装进团队背包';
      hint.style.cssText = `
        position: fixed;
        left: ${rect.left + rect.width / 2}px;
        top: ${rect.top - 8}px;
        transform: translateX(-50%);
        background: transparent;
        color: #ffd700;
        font-size: 12px;
        font-weight: bold;
        padding: 4px 10px;
        border-radius: 6px;
        white-space: nowrap;
        z-index: 10000;
        pointer-events: none;
        -webkit-text-stroke: 0.5px #000;
        text-shadow: 1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000;
        animation: hintShake 0.5s ease-in-out infinite;
      `;
      document.body.appendChild(hint);

      // Remove hint when any loot item is clicked
      firstCard.addEventListener('mousedown', () => {
        const h = document.getElementById('loot-panel-hint');
        if (h) h.remove();
      }, { once: true });

      if (!document.getElementById('shaking-hint-style')) {
        const style = document.createElement('style');
        style.id = 'shaking-hint-style';
        style.textContent = `
          @keyframes hintShake {
            0%, 100% { transform: translateX(-50%) rotate(0deg); }
            25% { transform: translateX(-50%) rotate(-2deg); }
            75% { transform: translateX(-50%) rotate(2deg); }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }
  private updateTeamBagWeightDisplay(): void {
    const weightLabel = document.getElementById('team-bag-weight-label');
    const weightBar = document.getElementById('team-bag-weight-bar');
    if (!weightLabel || !weightBar) return;
    
    // Calculate total carry weight capacity from party slots
    let totalCarryWeight = 0;
    for (let i = 0; i < this.partySlots.length; i++) {
      const character = this.partySlots[i];
      if (character && character.carryWeight) {
        totalCarryWeight += character.carryWeight;
      }
    }
    
    // Calculate current weight from team bag items
    let currentWeight = 0;
    const teamBagInventory = this.lootSystem.getTeamBagInventory();
    teamBagInventory.forEach((quantity, itemId) => {
      const item = this.itemSystem.getItem(itemId);
      if (item && item.weight) {
        currentWeight += item.weight * quantity;
      }
    });
    
    // Update label
    weightLabel.textContent = `负重: ${currentWeight} / ${totalCarryWeight}`;
    
    // Update progress bar
    const percentage = totalCarryWeight > 0 ? (currentWeight / totalCarryWeight) * 100 : 0;
    weightBar.style.width = `${Math.min(percentage, 100)}%`;
    
    // Change color based on capacity
    if (percentage >= 100) {
      weightBar.style.background = 'linear-gradient(90deg, #f44336, #e91e63)'; // Red when full
    } else if (percentage >= 80) {
      weightBar.style.background = 'linear-gradient(90deg, #ff9800, #ffc107)'; // Orange when near full
    } else {
      weightBar.style.background = 'linear-gradient(90deg, #4caf50, #8bc34a)'; // Green when normal
    }
  }

  /**
   * Check if items can be transferred to team bag (weight capacity check)
   */
  private canTransferToTeamBag(itemId: string, quantity: number): { allowed: boolean; reason?: string } {
    // Calculate total carry weight capacity from party slots
    let totalCarryWeight = 0;
    for (let i = 0; i < this.partySlots.length; i++) {
      const character = this.partySlots[i];
      if (character && character.carryWeight) {
        totalCarryWeight += character.carryWeight;
      }
    }
    
    // If no party members, can't carry anything
    if (totalCarryWeight === 0) {
      return { allowed: false, reason: '编队中没有角色，无法携带物品' };
    }
    
    // Calculate current weight from team bag items
    let currentWeight = 0;
    const teamBagInventory = this.lootSystem.getTeamBagInventory();
    teamBagInventory.forEach((qty, id) => {
      const item = this.itemSystem.getItem(id);
      if (item && item.weight) {
        currentWeight += item.weight * qty;
      }
    });
    
    // Calculate weight of items to be transferred
    const item = this.itemSystem.getItem(itemId);
    if (!item) {
      return { allowed: false, reason: '物品不存在' };
    }
    
    const itemWeight = (item.weight || 0) * quantity;
    const newTotalWeight = currentWeight + itemWeight;
    
    // Check if exceeds capacity
    if (newTotalWeight > totalCarryWeight) {
      return { 
        allowed: false, 
        reason: `负重不足！需要 ${itemWeight}，剩余 ${totalCarryWeight - currentWeight}` 
      };
    }
    
    return { allowed: true };
  }

  /**
   * Update team inventory display
   */
  private updateTeamInventoryDisplay(): void {
    const teamInventoryContent = document.getElementById('team-inventory-content');
    if (!teamInventoryContent) return;
    
    // Update weight capacity display
    this.updateTeamBagWeightDisplay();
    
    const teamBagInventory = this.lootSystem.getTeamBagInventory();
    
    if (teamBagInventory.size === 0) {
      teamInventoryContent.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: #999; font-size: 12px;">
          背包为空
        </div>
      `;
      return;
    }
    
    teamInventoryContent.innerHTML = '';
    
    teamBagInventory.forEach((quantity, itemId) => {
      const item = this.itemSystem.getItem(itemId);
      if (!item) return;
      
      const rarityColor = this.getRarityColor(item.rarity);
      
      const itemCard = document.createElement('div');
      itemCard.style.cssText = `
        aspect-ratio: 1;
        background: #f5f5f5;
        border: 3px solid ${rarityColor};
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        overflow: hidden;
        transform-origin: center center;
      `;
      
      itemCard.addEventListener('mouseenter', (e) => {
        itemCard.style.boxShadow = `0 4px 12px ${rarityColor}80`;
        itemCard.style.zIndex = '10';
        this.showItemTooltip(e, item, quantity);
      });
      
      itemCard.addEventListener('mouseleave', () => {
        itemCard.style.boxShadow = 'none';
        itemCard.style.zIndex = '1';
        this.hideItemTooltip();
      });
      
      itemCard.addEventListener('mousemove', (e) => {
        // Update tooltip position as mouse moves
        const tooltip = document.getElementById('item-tooltip');
        if (tooltip) {
          const x = e.clientX + 10;
          const y = e.clientY + 10;
          const rect = tooltip.getBoundingClientRect();
          const adjustedX = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 10 : x;
          const adjustedY = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 10 : y;
          tooltip.style.left = `${adjustedX}px`;
          tooltip.style.top = `${adjustedY}px`;
        }
      });
      
      itemCard.addEventListener('click', () => {
        // Show item action modal for clickable items
        if (item.type === 'food' || item.type === 'consumable' || item.type === 'potion' || item.type === 'material') {
          this.showTeamBagItemActionModal(itemId, item, quantity);
        } else {
          this.showNotification(`${item.name}: ${item.description}`, 'success', 3000);
        }
      });
      
      itemCard.innerHTML = `
        <img src="${item.icon}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">
        <div style="position: absolute; bottom: 2px; right: 2px; background: rgba(0, 0, 0, 0.7); color: white; padding: 2px 4px; border-radius: 4px; font-size: 10px; font-weight: bold;">
          ${quantity}
        </div>
      `;
      
      teamInventoryContent.appendChild(itemCard);
    });

    // Show first-time hint on the first item card
    if (!this.hasShownTeamBagHint && teamInventoryContent.firstElementChild) {
      this.hasShownTeamBagHint = true;
      const firstCard = teamInventoryContent.firstElementChild as HTMLElement;
      // Use fixed positioning to avoid overflow clipping from parent containers
      const rect = firstCard.getBoundingClientRect();
      const hint = document.createElement('div');
      hint.textContent = '只有团队背包中的物品才能带走哦';
      hint.style.cssText = `
        position: fixed;
        left: ${rect.left + rect.width / 2}px;
        top: ${rect.top - 8}px;
        transform: translateX(-50%);
        background: transparent;
        color: #ffd700;
        font-size: 12px;
        font-weight: bold;
        padding: 4px 10px;
        border-radius: 6px;
        white-space: nowrap;
        z-index: 10000;
        pointer-events: none;
        -webkit-text-stroke: 0.5px #000;
        text-shadow: 1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000;
        animation: hintShake 0.5s ease-in-out infinite;
      `;
      document.body.appendChild(hint);

      // Inject keyframes if not already present
      if (!document.getElementById('shaking-hint-style')) {
        const style = document.createElement('style');
        style.id = 'shaking-hint-style';
        style.textContent = `
          @keyframes hintShake {
            0%, 100% { transform: translateX(-50%) rotate(0deg); }
            25% { transform: translateX(-50%) rotate(-2deg); }
            75% { transform: translateX(-50%) rotate(2deg); }
          }
        `;
        document.head.appendChild(style);
      }

      setTimeout(() => { hint.remove(); }, 5000);
    }
  }
  private showItemDetails(item: any): void {
    this.showNotification(`${item.name}: ${item.description}`, 'success', 3000);
  }

  private showVillageChiefInfo(npcData: any): void {
    const actionPanel = document.getElementById('action-panel');
    if (!actionPanel) return;

    const displayName = npcData.title ? `${npcData.title}${npcData.name}` : npcData.name;
    
    // Check if emoji is an image path
    const isImage = npcData.emoji.includes('.png') || npcData.emoji.includes('.jpg');
    const avatarContent = isImage 
      ? `<img src="${npcData.emoji}" style="width: 100%; height: 100%; object-fit: cover;" />`
      : npcData.emoji;

    actionPanel.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
        <div style="
          width: 120px;
          height: 120px;
          border-radius: 50%;
          overflow: hidden;
          border: 3px solid #667eea;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 60px;
          background: white;
        ">
          ${avatarContent}
        </div>
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #333; margin-bottom: 8px;">
            ${displayName}
          </div>
          <div style="
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 12px 16px;
            background: rgba(102, 126, 234, 0.1);
            border-radius: 8px;
            min-width: 180px;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 14px; color: #667eea; font-weight: bold;">❤️ 好感度</span>
              <span style="font-size: 14px; color: #667eea; font-weight: bold;">${npcData.affinity || 0}/100</span>
            </div>
            <div style="background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden;">
              <div style="background: linear-gradient(90deg, #ff6b9d, #ff8fb3); height: 100%; width: ${Math.max(0, Math.min(100, npcData.affinity || 0))}%; transition: width 0.3s ease;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private showSkillManagementWindow(character: any): void {
    // Save reference to this for use in nested functions
    const self = this;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // Create window
    const window = document.createElement('div');
    window.style.cssText = `
      background: white;
      border-radius: 12px;
      width: 800px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <h2 style="margin: 0; color: #333; font-size: 20px;">技能管理 - ${character.name}</h2>
      <button id="close-skill-window" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: all 0.2s;">✕</button>
    `;

    // Tab container
    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = `
      display: flex;
      gap: 8px;
      padding: 16px 20px 0 20px;
      border-bottom: 1px solid #e0e0e0;
    `;

    const learnedTab = document.createElement('button');
    learnedTab.textContent = '已习得技能';
    learnedTab.style.cssText = `
      padding: 10px 20px;
      background: #667eea;
      border: none;
      border-radius: 8px 8px 0 0;
      color: white;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;

    const booksTab = document.createElement('button');
    booksTab.textContent = '技能书仓库';
    booksTab.style.cssText = `
      padding: 10px 20px;
      background: #f0f0f0;
      border: none;
      border-radius: 8px 8px 0 0;
      color: #666;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;

    tabContainer.appendChild(learnedTab);
    tabContainer.appendChild(booksTab);

    // Content area
    const contentArea = document.createElement('div');
    contentArea.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    `;

    // Function to render learned skills
    const renderLearnedSkills = () => {
      // Combine initial active skill with learned skills
      const learnedSkills = character.learnedActiveSkills || [];
      const allSkills = [...new Set([...learnedSkills, character.activeSkill].filter(Boolean))];
      
      if (allSkills.length === 0) {
        contentArea.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; color: #999;">
            <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
            <div style="font-size: 16px;">该角色还没有习得任何主动技能</div>
            <div style="font-size: 14px; margin-top: 8px;">前往"技能书仓库"使用技能书学习技能</div>
          </div>
        `;
        return;
      }

      contentArea.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
          ${allSkills.map((skillId: string) => {
            const skill = self.npcSystem.getActiveSkill(skillId);
            if (!skill) return '';
            
            const isEquipped = character.activeSkill === skillId;
            
            return `
              <div class="learned-skill-card" data-skill-id="${skillId}" style="
                background: ${isEquipped ? '#e0e0e0' : 'white'};
                border: 2px solid ${isEquipped ? '#999' : '#e0e0e0'};
                border-radius: 8px;
                padding: 12px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
                opacity: ${isEquipped ? '0.7' : '1'};
              ">
                <div style="width: 80px; height: 80px; background: #f5f5f5; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; overflow: hidden; position: relative;">
                  <img src="${skill.icon}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">
                  ${isEquipped ? '<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold; text-align: center; padding: 4px;">装备中</div>' : ''}
                </div>
                <div style="text-align: center; font-size: 13px; font-weight: bold; color: #333; margin-bottom: 4px;">${skill.name}</div>
                <div style="text-align: center; font-size: 11px; color: #666; line-height: 1.4;">${skill.description}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Add click events to skill cards
      contentArea.querySelectorAll('.learned-skill-card').forEach(card => {
        card.addEventListener('click', () => {
          const skillId = (card as HTMLElement).getAttribute('data-skill-id');
          if (skillId) {
            if (character.activeSkill === skillId) {
              // Unequip
              character.activeSkill = null;
              self.showNotification(`已卸下技能：${self.npcSystem.getActiveSkill(skillId)?.name}`, 'success');
            } else {
              // Equip
              character.activeSkill = skillId;
              self.showNotification(`已装备技能：${self.npcSystem.getActiveSkill(skillId)?.name}`, 'success');
              // Emit quest event for skill change
              console.log('[Quest Debug] Emitting quest:skill_change event', { characterId: character.id, skillId });
              self.eventSystem.emit({ type: 'quest:skill_change', timestamp: Date.now(), characterId: character.id, skillId });
            }
            renderLearnedSkills();
            self.showNPCDetails(character);
          }
        });

        const skillId = (card as HTMLElement).getAttribute('data-skill-id');
        const isEquipped = character.activeSkill === skillId;
        
        card.addEventListener('mouseenter', () => {
          if (!isEquipped) {
            (card as HTMLElement).style.background = '#f5f5f5';
            (card as HTMLElement).style.transform = 'translateY(-2px)';
          } else {
            (card as HTMLElement).style.opacity = '0.85';
          }
        });

        card.addEventListener('mouseleave', () => {
          if (!isEquipped) {
            (card as HTMLElement).style.background = 'white';
            (card as HTMLElement).style.transform = 'translateY(0)';
          } else {
            (card as HTMLElement).style.opacity = '0.7';
          }
        });
      });
    };

    // Function to render skill books
    const renderSkillBooks = () => {
      const inventory = self.itemSystem.getInventory();
      const skillBooks = inventory.filter(slot => {
        const item = self.itemSystem.getItem(slot.itemId);
        return item && item.type === 'book' && item.subType === 'skill_book';
      });

      if (skillBooks.length === 0) {
        contentArea.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; color: #999;">
            <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
            <div style="font-size: 16px;">仓库中没有技能书</div>
            <div style="font-size: 14px; margin-top: 8px;">完成任务或购买技能书来学习新技能</div>
          </div>
        `;
        return;
      }

      contentArea.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
          ${skillBooks.map(slot => {
            const item = self.itemSystem.getItem(slot.itemId);
            if (!item) return '';
            
            const skillId = item.skillId;
            const skill = skillId ? self.npcSystem.getActiveSkill(skillId) : null;
            const alreadyLearned = character.learnedActiveSkills?.includes(skillId);
            
            return `
              <div class="skill-book-card" data-item-id="${item.id}" data-skill-id="${skillId}" style="
                background: white;
                border: 2px solid ${alreadyLearned ? '#ffc107' : '#e0e0e0'};
                border-radius: 8px;
                padding: 12px;
                cursor: ${alreadyLearned ? 'not-allowed' : 'pointer'};
                transition: all 0.2s;
                opacity: ${alreadyLearned ? '0.6' : '1'};
                position: relative;
              ">
                ${alreadyLearned ? '<div style="position: absolute; top: 8px; right: 8px; background: #ffc107; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: bold;">已习得</div>' : ''}
                <div style="position: absolute; top: 8px; left: 8px; background: rgba(102, 126, 234, 0.9); color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: bold;">x${slot.quantity}</div>
                <div style="width: 80px; height: 80px; background: #f5f5f5; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; overflow: hidden;">
                  <img src="${item.icon}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">
                </div>
                <div style="text-align: center; font-size: 13px; font-weight: bold; color: #333; margin-bottom: 4px;">${item.name}</div>
                ${skill ? `<div style="text-align: center; font-size: 11px; color: #666; line-height: 1.4;">学习：${skill.name}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Add click events to skill book cards
      contentArea.querySelectorAll('.skill-book-card').forEach(card => {
        const skillId = (card as HTMLElement).getAttribute('data-skill-id');
        const alreadyLearned = character.learnedActiveSkills?.includes(skillId);
        
        if (!alreadyLearned) {
          card.addEventListener('click', () => {
            const itemId = (card as HTMLElement).getAttribute('data-item-id');
            if (itemId && skillId) {
              // Initialize learnedActiveSkills if it doesn't exist
              if (!character.learnedActiveSkills) {
                character.learnedActiveSkills = [];
              }
              
              // Learn the skill
              character.learnedActiveSkills.push(skillId);
              
              // Remove the skill book from inventory
              self.itemSystem.removeItem(itemId, 1);
              
              const skill = self.npcSystem.getActiveSkill(skillId);
              self.showNotification(`${character.name} 学会了 ${skill?.name}！`, 'success');
              
              renderSkillBooks();
            }
          });

          card.addEventListener('mouseenter', () => {
            (card as HTMLElement).style.background = '#f5f5f5';
            (card as HTMLElement).style.transform = 'translateY(-2px)';
          });

          card.addEventListener('mouseleave', () => {
            (card as HTMLElement).style.background = 'white';
            (card as HTMLElement).style.transform = 'translateY(0)';
          });
        }
      });
    };

    // Tab switching
    learnedTab.addEventListener('click', () => {
      learnedTab.style.background = '#667eea';
      learnedTab.style.color = 'white';
      booksTab.style.background = '#f0f0f0';
      booksTab.style.color = '#666';
      renderLearnedSkills();
    });

    booksTab.addEventListener('click', () => {
      booksTab.style.background = '#667eea';
      booksTab.style.color = 'white';
      learnedTab.style.background = '#f0f0f0';
      learnedTab.style.color = '#666';
      renderSkillBooks();
    });

    // Close button
    const closeBtn = header.querySelector('#close-skill-window');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        overlay.remove();
      });
      closeBtn.addEventListener('mouseenter', () => {
        (closeBtn as HTMLElement).style.background = '#f0f0f0';
      });
      closeBtn.addEventListener('mouseleave', () => {
        (closeBtn as HTMLElement).style.background = 'none';
      });
    }

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    // Assemble window
    window.appendChild(header);
    window.appendChild(tabContainer);
    window.appendChild(contentArea);
    overlay.appendChild(window);
    document.body.appendChild(overlay);

    // Initial render
    renderLearnedSkills();
  }

  /**
   * Show master skill management window
   */
  private showMasterSkillManagementWindow(character: any): void {
    const self = this;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // Create window
    const window = document.createElement('div');
    window.style.cssText = `
      background: white;
      border-radius: 12px;
      width: 800px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <h2 style="margin: 0; color: #333; font-size: 20px;">大师技能管理 - ${character.name}</h2>
      <button id="close-master-skill-window" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: all 0.2s;">✕</button>
    `;

    // Content area
    const contentArea = document.createElement('div');
    contentArea.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    `;

    // Function to render learned master skills
    const renderLearnedMasterSkills = () => {
      // Get all learned master skills (from learnedMasterSkills array)
      const learnedSkills = character.learnedMasterSkills || [];
      const allSkills = [...new Set([...learnedSkills, character.masterSkill].filter(Boolean))];
      
      if (allSkills.length === 0) {
        contentArea.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; color: #999;">
            <div style="font-size: 48px; margin-bottom: 16px;">🌟</div>
            <div style="font-size: 16px;">该角色还没有习得任何大师技能</div>
            <div style="font-size: 14px; margin-top: 8px;">通过转职获得大师技能</div>
          </div>
        `;
        return;
      }

      contentArea.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
          ${allSkills.map((skillId: string) => {
            const skill = self.npcSystem.getJobExclusiveSkill(skillId);
            if (!skill) return '';
            
            const isEquipped = character.masterSkill === skillId;
            
            return `
              <div class="learned-master-skill-card" data-skill-id="${skillId}" style="
                background: ${isEquipped ? '#e0e0e0' : 'white'};
                border: 2px solid ${isEquipped ? '#ff9800' : '#e0e0e0'};
                border-radius: 8px;
                padding: 12px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
                opacity: ${isEquipped ? '0.7' : '1'};
              ">
                <div style="width: 80px; height: 80px; background: #fff3e0; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; overflow: hidden; position: relative;">
                  <img src="${skill.icon}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">
                  ${isEquipped ? '<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold; text-align: center; padding: 4px;">装备中</div>' : ''}
                </div>
                <div style="text-align: center; font-size: 13px; font-weight: bold; color: #333; margin-bottom: 4px;">${skill.name}</div>
                <div style="text-align: center; font-size: 11px; color: #666; line-height: 1.4;">${skill.description}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Add click events to skill cards
      contentArea.querySelectorAll('.learned-master-skill-card').forEach(card => {
        card.addEventListener('click', () => {
          const skillId = (card as HTMLElement).getAttribute('data-skill-id');
          if (skillId) {
            if (character.masterSkill === skillId) {
              // Unequip
              character.masterSkill = null;
              self.showNotification(`已卸下大师技能：${self.npcSystem.getJobExclusiveSkill(skillId)?.name}`, 'success');
            } else {
              // Equip
              character.masterSkill = skillId;
              self.showNotification(`已装备大师技能：${self.npcSystem.getJobExclusiveSkill(skillId)?.name}`, 'success');
            }
            renderLearnedMasterSkills();
            self.showNPCDetails(character);
          }
        });

        const skillId = (card as HTMLElement).getAttribute('data-skill-id');
        const isEquipped = character.masterSkill === skillId;
        
        card.addEventListener('mouseenter', () => {
          if (!isEquipped) {
            (card as HTMLElement).style.background = '#fff3e0';
            (card as HTMLElement).style.transform = 'translateY(-2px)';
          } else {
            (card as HTMLElement).style.opacity = '0.85';
          }
        });

        card.addEventListener('mouseleave', () => {
          if (!isEquipped) {
            (card as HTMLElement).style.background = 'white';
            (card as HTMLElement).style.transform = 'translateY(0)';
          } else {
            (card as HTMLElement).style.opacity = '0.7';
          }
        });
      });
    };

    // Close button
    const closeBtn = header.querySelector('#close-master-skill-window');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        overlay.remove();
      });
      closeBtn.addEventListener('mouseenter', () => {
        (closeBtn as HTMLElement).style.background = '#f0f0f0';
      });
      closeBtn.addEventListener('mouseleave', () => {
        (closeBtn as HTMLElement).style.background = 'none';
      });
    }

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    // Assemble window
    window.appendChild(header);
    window.appendChild(contentArea);
    overlay.appendChild(window);
    document.body.appendChild(overlay);

    // Initial render
    renderLearnedMasterSkills();
  }

  /**
   * Show equipment crafted celebration modal with fireworks
   */
  private showEquipmentCraftedModal(recipeId: string, affix: any): void {
    // Get item data
    const itemData = this.itemSystem.getItem(recipeId);
    if (!itemData) {
      console.error('[GameUI] Item not found:', recipeId);
      return;
    }

    // Add affix to item data for display
    const itemWithAffix: any = { ...itemData, affix };
    const quantity = this.itemSystem.getItemQuantity(recipeId);

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'equipment-crafted-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease-out;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 16px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      animation: scaleIn 0.3s ease-out;
      position: relative;
    `;

    // Create celebration header
    const header = document.createElement('div');
    header.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px;
      text-align: center;
      border-radius: 16px 16px 0 0;
      position: relative;
      overflow: hidden;
    `;
    header.innerHTML = `
      <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);">
        🎉 制作成功！ 🎉
      </div>
      <div style="font-size: 16px; opacity: 0.9;">
        恭喜获得新装备
      </div>
    `;

    // Create item details content using the same method as warehouse panel
    const detailsContainer = document.createElement('div');
    const rarityColor = this.itemSystem.getRarityColor(itemWithAffix.rarity);
    const rarityName = this.itemSystem.getRarityName(itemWithAffix.rarity);
    const itemTypeDisplay = this.translateItemType(itemWithAffix.type || 'unknown');
    const itemValue = itemWithAffix.buyPrice || 0;

    // Build affix display HTML
    let affixHTML = '';
    const modalAffixes = normalizeAffixes(itemWithAffix.affix);
    if (modalAffixes.length > 0) {
      const affixLines = modalAffixes.map((a: any) => {
        const affixColor = getAffixColorStyle(a.rarity);
        const affixText = formatAffixDisplayWithRange(a);
        return `<div style="color: #fff; font-size: 16px; font-weight: bold; text-shadow: -1px -1px 0 ${affixColor}, 1px -1px 0 ${affixColor}, -1px 1px 0 ${affixColor}, 1px 1px 0 ${affixColor}, 0 0 6px ${affixColor}; margin-bottom: 4px;">${affixText}</div>`;
      }).join('');
      const borderColor = getAffixColorStyle(modalAffixes[modalAffixes.length - 1].rarity);
      affixHTML = `
        <div style="margin-bottom: 16px; padding: 16px; background: rgba(255, 215, 0, 0.1); border-radius: 8px; border-left: 4px solid ${borderColor};">
          <div style="font-weight: bold; margin-bottom: 8px; color: #424242;">副词条</div>
          ${affixLines}
        </div>
      `;
    }

    // Build main stat HTML
    let mainStatHTML = '';
    if (itemWithAffix.mainAttribute) {
      mainStatHTML = `
        <div style="margin-bottom: 16px; padding: 16px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #2e7d32;">主词条</div>
          <div style="color: #388e3c; font-size: 16px; font-weight: bold;">
            ${itemWithAffix.mainAttribute}
          </div>
        </div>
      `;
    }

    detailsContainer.innerHTML = `
      <div style="padding: 20px;">
        <!-- Header with icon and basic info -->
        <div style="display: flex; gap: 16px; align-items: flex-start; margin-bottom: 20px;">
          <div style="width: 80px; height: 80px; background: #f5f5f5; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
            <img src="${itemWithAffix.icon}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">
          </div>
          <div style="flex: 1;">
            <h2 style="margin: 0 0 8px 0; color: #333; font-size: 20px; font-weight: bold;">${itemWithAffix.name}</h2>
            <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
              <div style="display: inline-block; padding: 4px 12px; background: ${rarityColor}; color: white; border-radius: 6px; font-size: 12px; font-weight: bold;">${rarityName}</div>
              <div style="display: inline-block; padding: 4px 12px; background: rgba(102, 126, 234, 0.8); color: white; border-radius: 6px; font-size: 12px; font-weight: bold;">${itemTypeDisplay}</div>
            </div>
            <div style="font-size: 14px; color: #f57c00; font-weight: bold; margin-bottom: 4px;">持有: ${quantity}</div>
            <div style="font-size: 14px; color: #ffd700; font-weight: bold; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">价值: ${itemValue} 金币</div>
            ${itemWithAffix.type === 'food' && itemWithAffix.hungerRestore ? `<div style="font-size: 14px; color: #66bb6a; font-weight: bold;">🍖 饱腹度+${itemWithAffix.hungerRestore}</div>` : ''}
          </div>
        </div>
        
        <!-- Description -->
        <div style="padding: 16px; background: #f5f5f5; border-radius: 8px; margin-bottom: 20px;">
          <div style="font-size: 14px; color: #666; line-height: 1.6;">${itemWithAffix.description || '暂无描述'}</div>
        </div>
        
        ${mainStatHTML}
        ${affixHTML}
      </div>
    `;

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '确定';
    closeButton.style.cssText = `
      width: calc(100% - 40px);
      margin: 0 20px 20px 20px;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: transform 0.2s;
    `;
    closeButton.onmouseover = () => {
      closeButton.style.transform = 'scale(1.05)';
    };
    closeButton.onmouseout = () => {
      closeButton.style.transform = 'scale(1)';
    };
    closeButton.onclick = () => {
      overlay.remove();
    };

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(detailsContainer);
    modal.appendChild(closeButton);
    overlay.appendChild(modal);

    // Add animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scaleIn {
        from { transform: scale(0.8); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // Add to DOM
    document.body.appendChild(overlay);

    // Trigger fireworks
    this.triggerFireworks();

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  /**
   * Trigger fireworks celebration effect
   */
  private triggerFireworks(): void {
    const fireworksContainer = document.createElement('div');
    fireworksContainer.id = 'fireworks-container';
    fireworksContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `;
    document.body.appendChild(fireworksContainer);

    // Create multiple fireworks
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#ff1493'];
    const fireworkCount = 8;

    for (let i = 0; i < fireworkCount; i++) {
      setTimeout(() => {
        this.createFirework(fireworksContainer, colors[i % colors.length]);
      }, i * 300);
    }

    // Remove container after animation
    setTimeout(() => {
      fireworksContainer.remove();
    }, 4000);
  }

  /**
   * Create a single firework explosion
   */
  private createFirework(container: HTMLElement, color: string): void {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * (window.innerHeight * 0.6) + window.innerHeight * 0.1;

    const particleCount = 30;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: 6px;
        height: 6px;
        background: ${color};
        border-radius: 50%;
        box-shadow: 0 0 10px ${color};
      `;

      const angle = (Math.PI * 2 * i) / particleCount;
      const velocity = 100 + Math.random() * 100;
      const vx = Math.cos(angle) * velocity;
      const vy = Math.sin(angle) * velocity;

      container.appendChild(particle);

      // Animate particle
      let posX = x;
      let posY = y;
      let opacity = 1;
      const gravity = 200;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 2) {
          particle.remove();
          return;
        }

        posX += vx * 0.016;
        posY += (vy + gravity * elapsed) * 0.016;
        opacity = Math.max(0, 1 - elapsed / 2);

        particle.style.left = `${posX}px`;
        particle.style.top = `${posY}px`;
        particle.style.opacity = `${opacity}`;

        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    }
  }

  public destroy(): void {
    // Clean up UI components
    this.uiManager.destroy();

    // Cleanup battle system
    this.battleSystem.shutdown();
    this.cleanupBattleScene();

    // Remove HUD
    if (this.mainHUD.parentNode) {
      this.mainHUD.parentNode.removeChild(this.mainHUD);
    }

    // Remove menu bar
    const menuBar = document.getElementById('menu-bar');
    if (menuBar && menuBar.parentNode) {
      menuBar.parentNode.removeChild(menuBar);
    }

    // Remove game layout
    const gameLayout = document.getElementById('game-layout');
    if (gameLayout && gameLayout.parentNode) {
      gameLayout.parentNode.removeChild(gameLayout);
    }

    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    // Stop adventurer spawning
    this.stopAdventurerSpawning();

    console.log('🎮 Game UI destroyed');
  }

  /**
   * Start spawning wandering adventurers in the market scene
   */
  private startAdventurerSpawning(): void {
    // Clear any existing timer
    this.stopAdventurerSpawning();
    
    // Spawn first adventurer immediately
    this.spawnWanderingAdventurer();
    
    // Schedule next spawn
    this.scheduleNextAdventurerSpawn();
  }

  /**
   * Stop spawning adventurers and remove all existing ones
   */
  private stopAdventurerSpawning(): void {
    if (this.adventurerSpawnTimer !== null) {
      clearTimeout(this.adventurerSpawnTimer);
      this.adventurerSpawnTimer = null;
    }
    
    // Remove all wandering adventurers
    this.wanderingAdventurers.forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    this.wanderingAdventurers = [];
  }

  /**
   * Schedule the next adventurer spawn with random delay (3-10 seconds)
   */
  private scheduleNextAdventurerSpawn(): void {
    const delay = 3000 + Math.random() * 7000; // 3-10 seconds
    this.adventurerSpawnTimer = window.setTimeout(() => {
      if (this.currentScene === 'market') {
        this.spawnWanderingAdventurer();
        this.scheduleNextAdventurerSpawn();
      }
    }, delay);
  }

  /**
   * Spawn a single wandering adventurer with random properties
   */
  private spawnWanderingAdventurer(): void {
    if (!this.sceneContainer) return;
    
    // Check if we've reached the maximum number of adventurers
    const MAX_ADVENTURERS = 10;
    if (this.wanderingAdventurers.length >= MAX_ADVENTURERS) {
      return; // Don't spawn if at max capacity
    }
    
    // Define player stall area (red semi-transparent box)
    const STALL_AREA = {
      left: 340,
      top: 490,
      width: 155,
      height: 150
    };
    
    // Use NPCSystem's name and title generation (same as tavern adventurers)
    const adventurerData = this.npcSystem.createAdventurer();
    const title = adventurerData.title || '勇敢的';
    const name = adventurerData.name || '冒险者';
    
    console.log('[Adventurer Spawn] Generated from NPCSystem:', { title, name });
    
    // Random avatar (001-048)
    const avatarNum = String(Math.floor(Math.random() * 48) + 1).padStart(3, '0');
    const avatar = `images/touxiang_maoxianzhe_${avatarNum}.png`;
    
    // Random starting position (far from stall area)
    const sceneWidth = this.sceneContainer.clientWidth;
    const sceneHeight = this.sceneContainer.clientHeight;
    let startX: number, startY: number;
    
    // Keep trying until we find a position far from the stall
    do {
      startX = Math.random() * (sceneWidth - 100);
      startY = Math.random() * (sceneHeight - 100);
    } while (
      startX >= STALL_AREA.left - 100 &&
      startX <= STALL_AREA.left + STALL_AREA.width + 100 &&
      startY >= STALL_AREA.top - 100 &&
      startY <= STALL_AREA.top + STALL_AREA.height + 100
    );
    
    // Random movement direction and speed
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 30; // 20-50 pixels per second
    let velocityX = Math.cos(angle) * speed;
    let velocityY = Math.sin(angle) * speed;
    
    // Adventurer state
    let state: 'wandering' | 'shopping' | 'leaving' = 'wandering';
    let shoppingTimer: number | null = null;
    
    // Create adventurer element
    const adventurer = document.createElement('div');
    adventurer.style.cssText = `
      position: absolute;
      left: ${startX}px;
      top: ${startY}px;
      width: 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      pointer-events: none;
      z-index: 50;
      transition: left 0.1s linear, top 0.1s linear;
    `;
    
    adventurer.innerHTML = `
      <img src="${avatar}" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" />
      <div class="adventurer-name" style="font-size: 10px; color: #fff; white-space: nowrap; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${title}${name}</div>
    `;
    
    this.sceneContainer.appendChild(adventurer);
    this.wanderingAdventurers.push(adventurer);
    
    // Animate movement
    let currentX = startX;
    let currentY = startY;
    let lastTime = Date.now();
    let animationId: number | null = null;
    
    // Helper function to check collision with stall area (AABB collision detection)
    const isInStallArea = (x: number, y: number): boolean => {
      // Adventurer bounding box
      const advLeft = x;
      const advRight = x + 80; // adventurer width
      const advTop = y;
      const advBottom = y + 80; // approximate adventurer height
      
      // Stall area bounding box
      const stallLeft = STALL_AREA.left;
      const stallRight = STALL_AREA.left + STALL_AREA.width;
      const stallTop = STALL_AREA.top;
      const stallBottom = STALL_AREA.top + STALL_AREA.height;
      
      // AABB collision: check if rectangles overlap
      const inArea = (
        advLeft < stallRight &&
        advRight > stallLeft &&
        advTop < stallBottom &&
        advBottom > stallTop
      );
      
      if (inArea) {
        console.log(`[Stall] Adventurer touched stall area at (${x.toFixed(0)}, ${y.toFixed(0)})`);
      }
      return inArea;
    };
    
    // Helper function to purchase item from stall
    const purchaseFromStall = () => {
      // Get all items in stall with stock > 0
      const availableItems: Array<{ slotIndex: number; itemId: string; quantity: number }> = [];
      this.playerStallItems.forEach((itemData, slotIndex) => {
        if (itemData.quantity > 0) {
          availableItems.push({ slotIndex, ...itemData });
        }
      });
      
      if (availableItems.length === 0) {
        console.log('[Stall] No items available for purchase');
        return;
      }
      
      // Pick random item
      const randomItem = availableItems[Math.floor(Math.random() * availableItems.length)];
      const itemInfo = this.itemsData.get(randomItem.itemId);
      
      if (!itemInfo) return;
      
      // Calculate price (value * 0.5)
      const price = Math.floor((itemInfo.buyPrice || 0) * 0.5);
      
      // Reduce stock
      const currentData = this.playerStallItems.get(randomItem.slotIndex);
      if (currentData) {
        currentData.quantity -= 1;
        if (currentData.quantity <= 0) {
          this.playerStallItems.delete(randomItem.slotIndex);
        }
      }
      
      // Add gold to player
      this.currencySystem.addCurrency(this.world, this.playerEntity.id, { gold: price }, '摊位销售');
      this.updateCurrencyDisplay();
      
      console.log(`[Stall] ${title}${name} purchased ${itemInfo.name} for ${price} gold`);
      
      // Create floating item icon and price animation
      const floatingElement = document.createElement('div');
      floatingElement.style.cssText = `
        position: absolute;
        left: ${currentX + 10}px;
        top: ${currentY - 20}px;
        display: flex;
        align-items: center;
        gap: 4px;
        pointer-events: none;
        z-index: 100;
        transition: transform 2s ease-out, opacity 2s ease-out;
        transform: translateY(0);
        opacity: 1;
      `;
      
      // Get item icon path
      const iconPath = itemInfo.icon || 'images/default_item.png';
      
      floatingElement.innerHTML = `
        <img src="${iconPath}" style="width: 24px; height: 24px; border-radius: 4px; border: 1px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.3);" />
        <span style="font-size: 14px; font-weight: bold; color: #ffd700; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">+${price}💰</span>
      `;
      
      this.sceneContainer.appendChild(floatingElement);
      
      // Trigger animation after a brief delay to ensure transition works
      requestAnimationFrame(() => {
        floatingElement.style.transform = 'translateY(-60px)';
        floatingElement.style.opacity = '0';
      });
      
      // Remove element after animation completes
      setTimeout(() => {
        if (floatingElement.parentNode) {
          floatingElement.parentNode.removeChild(floatingElement);
        }
      }, 2000);
      
      // Update stall UI if it's open
      const stallPanel = document.querySelector('[data-panel="player-stall-management"]');
      if (stallPanel) {
        // Refresh the stall display
        this.showPlayerStallManagement();
      }
      
      // Update stall status (check if still has items)
      this.updateStallStatus();
    };
    
    const animate = () => {
      // Check if adventurer is still in DOM and scene is still market
      if (!adventurer.parentNode || this.currentScene !== 'market') {
        // Stop animation if adventurer was removed or scene changed
        if (animationId !== null) {
          cancelAnimationFrame(animationId);
        }
        if (shoppingTimer !== null) {
          clearTimeout(shoppingTimer);
        }
        return;
      }
      
      const now = Date.now();
      let deltaTime = (now - lastTime) / 1000; // Convert to seconds
      lastTime = now;
      
      // Cap deltaTime to prevent large jumps when tab is inactive
      const MAX_DELTA_TIME = 0.1; // Maximum 100ms per frame
      if (deltaTime > MAX_DELTA_TIME) {
        deltaTime = MAX_DELTA_TIME;
      }
      
      // Get current scene dimensions (in case of resize)
      const currentSceneWidth = this.sceneContainer?.clientWidth || sceneWidth;
      const currentSceneHeight = this.sceneContainer?.clientHeight || sceneHeight;
      
      // State machine
      if (state === 'wandering') {
        // Update position
        currentX += velocityX * deltaTime;
        currentY += velocityY * deltaTime;
        
        // Check if entered stall area AND stall is open
        if (isInStallArea(currentX, currentY) && this.isStallOpen) {
          console.log(`[Stall] State changing from wandering to shopping for ${title}${name}`);
          state = 'shopping';
          velocityX = 0;
          velocityY = 0;
          
          // Update display to show "选购中"
          const nameEl = adventurer.querySelector('.adventurer-name');
          if (nameEl) {
            nameEl.textContent = '选购中';
            console.log('[Stall] Display updated to "选购中"');
          }
          
          // Schedule purchase after 3-10 seconds
          const shoppingDuration = 3000 + Math.random() * 7000;
          console.log(`[Stall] Shopping will last ${(shoppingDuration / 1000).toFixed(1)} seconds`);
          shoppingTimer = window.setTimeout(() => {
            purchaseFromStall();
            state = 'leaving';
            
            // Update display back to name
            const nameEl = adventurer.querySelector('.adventurer-name');
            if (nameEl) {
              nameEl.textContent = `${title}${name}`;
            }
            
            // Set velocity towards nearest edge
            const toLeft = currentX;
            const toRight = currentSceneWidth - currentX;
            const toTop = currentY;
            const toBottom = currentSceneHeight - currentY;
            const minDist = Math.min(toLeft, toRight, toTop, toBottom);
            
            const exitSpeed = 50; // Faster exit speed
            if (minDist === toLeft) {
              velocityX = -exitSpeed;
              velocityY = 0;
            } else if (minDist === toRight) {
              velocityX = exitSpeed;
              velocityY = 0;
            } else if (minDist === toTop) {
              velocityX = 0;
              velocityY = -exitSpeed;
            } else {
              velocityX = 0;
              velocityY = exitSpeed;
            }
          }, shoppingDuration);
        } else {
          // Bounce off edges
          const margin = 10;
          let bounced = false;
          
          if (currentX < margin) {
            currentX = margin;
            velocityX = Math.abs(velocityX);
            bounced = true;
          } else if (currentX > currentSceneWidth - 80 - margin) {
            currentX = currentSceneWidth - 80 - margin;
            velocityX = -Math.abs(velocityX);
            bounced = true;
          }
          
          if (currentY < margin) {
            currentY = margin;
            velocityY = Math.abs(velocityY);
            bounced = true;
          } else if (currentY > currentSceneHeight - 80 - margin) {
            currentY = currentSceneHeight - 80 - margin;
            velocityY = -Math.abs(velocityY);
            bounced = true;
          }
          
          if (bounced) {
            const randomAngle = (Math.random() - 0.5) * Math.PI * 0.5;
            const currentAngle = Math.atan2(velocityY, velocityX);
            const newAngle = currentAngle + randomAngle;
            const currentSpeed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
            velocityX = Math.cos(newAngle) * currentSpeed;
            velocityY = Math.sin(newAngle) * currentSpeed;
          }
        }
      } else if (state === 'shopping') {
        // Stay still while shopping
        // (position doesn't change)
      } else if (state === 'leaving') {
        // Move towards edge
        currentX += velocityX * deltaTime;
        currentY += velocityY * deltaTime;
        
        // Check if reached edge - if so, remove adventurer
        const margin = -20; // Allow going slightly off-screen
        if (
          currentX < margin ||
          currentX > currentSceneWidth - 80 + margin ||
          currentY < margin ||
          currentY > currentSceneHeight - 80 + margin
        ) {
          // Remove adventurer
          if (animationId !== null) {
            cancelAnimationFrame(animationId);
          }
          if (adventurer.parentNode) {
            adventurer.parentNode.removeChild(adventurer);
          }
          const index = this.wanderingAdventurers.indexOf(adventurer);
          if (index > -1) {
            this.wanderingAdventurers.splice(index, 1);
          }
          return;
        }
      }
      
      // Apply new position
      adventurer.style.left = `${currentX}px`;
      adventurer.style.top = `${currentY}px`;
      
      // Continue animation
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
  }

  /**
   * Show job change panel in scene
   */
  private showJobChangePanel(): void {
    if (!this.sceneContainer) return;

    // Disable action panel buttons
    const actionPanel = document.getElementById('action-panel');
    if (actionPanel) {
      const buttons = actionPanel.querySelectorAll('button');
      buttons.forEach(button => {
        (button as HTMLButtonElement).disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
      });
    }

    // Create job change panel container
    const jobChangeContainer = document.createElement('div');
    jobChangeContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 80px 20px 20px 20px;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3);
      z-index: 100;
      overflow: hidden;
    `;

    // Title
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    `;

    const title = document.createElement('h2');
    title.textContent = '职业转职';
    title.style.cssText = `
      color: white;
      font-size: 24px;
      font-weight: bold;
      margin: 0;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.5);
      border-radius: 8px;
      color: white;
      font-size: 24px;
      font-weight: bold;
      width: 40px;
      height: 40px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(255, 100, 100, 0.8)';
      closeButton.style.transform = 'scale(1.1)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
      closeButton.style.transform = 'scale(1)';
    });

    closeButton.addEventListener('click', () => {
      jobChangeContainer.remove();
      
      // Re-enable action panel buttons
      const actionPanel = document.getElementById('action-panel');
      if (actionPanel) {
        const buttons = actionPanel.querySelectorAll('button');
        buttons.forEach(button => {
          (button as HTMLButtonElement).disabled = false;
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
        });
        actionPanel.innerHTML = '';
      }
    });

    titleContainer.appendChild(title);
    titleContainer.appendChild(closeButton);

    // Main content container with two equal sections
    const mainContent = document.createElement('div');
    mainContent.style.cssText = `
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      overflow: hidden;
    `;

    // Left section: Character selection
    const characterSection = document.createElement('div');
    characterSection.style.cssText = `
      background: rgba(255, 255, 255, 0.4);
      border-radius: 12px;
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    `;

    const characterTitle = document.createElement('h3');
    characterTitle.textContent = '选择转职角色';
    characterTitle.style.cssText = `
      color: white;
      font-size: 18px;
      font-weight: bold;
      margin: 0 0 16px 0;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    // Character slot container
    const characterSlotContainer = document.createElement('div');
    characterSlotContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      flex: 1;
    `;

    // Get all recruited characters
    const characters = this.npcSystem.getRecruitedCharacters();
    let selectedCharacter: any = null;

    // Create character slot
    const characterSlot = document.createElement('div');
    characterSlot.style.cssText = `
      width: 100%;
      background: rgba(255, 255, 255, 0.9);
      border: 3px dashed #ccc;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
      padding: 16px;
      box-sizing: border-box;
    `;

    const updateCharacterSlot = (character: any | null) => {
      characterSlot.innerHTML = '';
      
      if (!character) {
        // Empty slot - centered layout (图1)
        characterSlotContainer.style.justifyContent = 'center';
        characterSlotContainer.style.alignItems = 'center';
        characterSlot.style.height = '280px';
        characterSlot.style.width = '200px';
        
        // Empty slot
        const emptyIcon = document.createElement('div');
        emptyIcon.textContent = '👤';
        emptyIcon.style.cssText = `
          font-size: 64px;
          margin-bottom: 12px;
          opacity: 0.3;
        `;
        
        const emptyText = document.createElement('div');
        emptyText.textContent = '点击选择角色';
        emptyText.style.cssText = `
          color: #999;
          font-size: 14px;
          text-align: center;
        `;
        
        characterSlot.appendChild(emptyIcon);
        characterSlot.appendChild(emptyText);
        characterSlot.style.border = '3px dashed #ccc';
      } else {
        // Show selected character - compact layout at top (图2)
        characterSlotContainer.style.justifyContent = 'flex-start';
        characterSlotContainer.style.alignItems = 'stretch';
        characterSlot.style.height = 'auto';
        characterSlot.style.width = '100%';
        characterSlot.style.border = '3px solid #e67e22';
        
        // Create a horizontal layout for character info
        const characterInfoContainer = document.createElement('div');
        characterInfoContainer.style.cssText = `
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
        `;
        
        // Avatar (larger)
        const avatarContainer = document.createElement('div');
        avatarContainer.style.cssText = `
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-size: 40px;
          flex-shrink: 0;
        `;
        
        const isImage = character.emoji && (character.emoji.includes('.png') || character.emoji.includes('.jpg'));
        if (isImage) {
          const img = document.createElement('img');
          img.src = character.emoji;
          img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
          `;
          avatarContainer.appendChild(img);
        } else {
          avatarContainer.textContent = character.emoji || '👤';
        }
        
        // Info section (name, level, job)
        const infoSection = document.createElement('div');
        infoSection.style.cssText = `
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        `;
        
        // Title and name
        const displayName = character.title ? `${character.title}${character.name}` : character.name;
        const nameDiv = document.createElement('div');
        nameDiv.textContent = displayName;
        nameDiv.style.cssText = `
          color: #333;
          font-size: 14px;
          font-weight: bold;
        `;
        
        // Level and Job in one line
        const levelJobDiv = document.createElement('div');
        levelJobDiv.textContent = `等级: ${character.level || 1} | 职业: ${this.getJobDisplayName(character.job)}`;
        levelJobDiv.style.cssText = `
          color: #666;
          font-size: 11px;
        `;
        
        infoSection.appendChild(nameDiv);
        infoSection.appendChild(levelJobDiv);
        
        // Primary attributes (4 colored boxes)
        const attributesContainer = document.createElement('div');
        attributesContainer.style.cssText = `
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        `;
        
        const attrs = [
          { icon: ATTRIBUTE_ICONS.STRENGTH, value: character.strength || 0, color: '#e74c3c' },
          { icon: ATTRIBUTE_ICONS.AGILITY, value: character.agility || 0, color: '#2ecc71' },
          { icon: ATTRIBUTE_ICONS.WISDOM, value: character.wisdom || 0, color: '#3498db' },
          { icon: ATTRIBUTE_ICONS.SKILL, value: character.skill || character.technique || 0, color: '#f39c12' }
        ];
        
        attrs.forEach(attr => {
          const attrBox = document.createElement('div');
          attrBox.style.cssText = `
            width: 50px;
            height: 65px;
            background: ${attr.color};
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
          `;
          
          const icon = document.createElement('div');
          icon.textContent = attr.icon;
          icon.style.fontSize = '16px';
          
          const value = document.createElement('div');
          value.textContent = String(attr.value);
          value.style.fontSize = '14px';
          
          attrBox.appendChild(icon);
          attrBox.appendChild(value);
          attributesContainer.appendChild(attrBox);
        });
        
        characterInfoContainer.appendChild(avatarContainer);
        characterInfoContainer.appendChild(infoSection);
        characterInfoContainer.appendChild(attributesContainer);
        
        characterSlot.appendChild(characterInfoContainer);
      }
    };
    
    // Create secondary attributes and progress bars container
    const detailsContainer = document.createElement('div');
    detailsContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 16px 0;
      display: none;
      margin-top: 16px;
    `;
    
    const updateCharacterDetails = (character: any | null) => {
      detailsContainer.innerHTML = '';
      
      if (!character) {
        detailsContainer.style.display = 'none';
        return;
      }
      
      detailsContainer.style.display = 'block';
      
      // Progress bars section FIRST (生命值、魔法值、饱腹度)
      const progressBarsContainer = document.createElement('div');
      progressBarsContainer.style.cssText = `
        margin-bottom: 16px;
      `;
      
      // Helper function to create progress bar
      const createProgressBar = (label: string, current: number, max: number, color: string) => {
        const container = document.createElement('div');
        container.style.cssText = `
          margin-bottom: 8px;
        `;
        
        const labelDiv = document.createElement('div');
        labelDiv.textContent = `${label} ${current}/${max}`;
        labelDiv.style.cssText = `
          font-size: 11px;
          color: #fff;
          margin-bottom: 4px;
          font-weight: bold;
          text-shadow: -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000;
        `;
        
        const barBg = document.createElement('div');
        barBg.style.cssText = `
          width: 100%;
          height: 24px;
          background: #e0e0e0;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        `;
        
        const barFill = document.createElement('div');
        const percentage = max > 0 ? (current / max) * 100 : 0;
        barFill.style.cssText = `
          width: ${percentage}%;
          height: 100%;
          background: ${color};
          transition: width 0.3s ease;
        `;
        
        barBg.appendChild(barFill);
        container.appendChild(labelDiv);
        container.appendChild(barBg);
        
        return container;
      };
      
      // HP bar
      const hpBar = createProgressBar(
        '生命值',
        character.currentHP || 0,
        character.maxHP || 100,
        'linear-gradient(90deg, #e74c3c 0%, #c0392b 100%)'
      );
      progressBarsContainer.appendChild(hpBar);
      
      // MP bar
      const mpBar = createProgressBar(
        '魔法值',
        character.currentMP || 0,
        character.maxMP || 100,
        'linear-gradient(90deg, #3498db 0%, #2980b9 100%)'
      );
      progressBarsContainer.appendChild(mpBar);
      
      // Hunger bar
      const hungerBar = createProgressBar(
        '饱腹度',
        character.currentHunger || 0,
        character.maxHunger || 100,
        'linear-gradient(90deg, #f39c12 0%, #e67e22 100%)'
      );
      progressBarsContainer.appendChild(hungerBar);
      
      detailsContainer.appendChild(progressBarsContainer);
      
      // Secondary attributes grid SECOND (at the bottom)
      const secondaryAttrsGrid = document.createElement('div');
      secondaryAttrsGrid.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        font-size: 11px;
        color: #333;
      `;
      
      const secondaryAttrs = [
        { label: '攻击力', value: formatNumber(character.attack || 0) },
        { label: '防御力', value: formatNumber(character.defense || 0) },
        { label: '暴击率', value: formatPercentage(character.critRate || 0) },
        { label: '暴击伤害', value: formatPercentage(character.critDamage || 0) },
        { label: '负重', value: formatNumber(character.carryWeight || 0) },
        { label: '闪避率', value: formatPercentage(character.dodgeRate || 0) },
        { label: '魔法强度', value: formatNumber(character.magicPower || 0) },
        { label: '抗性', value: formatPercentage(character.resistance || 0) },
        { label: '体重', value: formatNumber(character.weight || 0) },
        { label: '体积', value: formatNumber(character.volume || 0) },
        { label: '移动速度', value: formatNumber(character.moveSpeed || 0) },
        { label: '命中率', value: formatPercentage(character.accuracy || 0) },
        { label: '生命恢复', value: formatNumber(character.hpRegen || 0) },
        { label: '魔力恢复', value: formatNumber(character.mpRegen || 0) }
      ];
      
      secondaryAttrs.forEach(attr => {
        const attrDiv = document.createElement('div');
        attrDiv.textContent = `${attr.label}: ${attr.value}`;
        attrDiv.style.cssText = `
          padding: 6px 8px;
          background: #f8f9fa;
          border-radius: 4px;
        `;
        secondaryAttrsGrid.appendChild(attrDiv);
      });
      
      detailsContainer.appendChild(secondaryAttrsGrid);
    };

    // Initialize with empty slot
    updateCharacterSlot(null);
    updateCharacterDetails(null);
    
    // Add character slot FIRST (top), then details container (bottom)
    characterSlotContainer.appendChild(characterSlot);
    characterSlotContainer.appendChild(detailsContainer);

    // Click handler for character slot
    characterSlot.addEventListener('click', () => {
      this.showJobChangeCharacterSelectionModal(characters, (character: any) => {
        selectedCharacter = character;
        updateCharacterSlot(character);
        updateCharacterDetails(character);
        
        // Load jobs data and render job details
        fetch('src/game/data/jobs.json')
          .then(response => response.json())
          .then(jobsData => {
            const jobs = jobsData.jobs;
            this.renderJobDetails(jobDetailsContainer, character, jobs, updateCharacterSlot, updateCharacterDetails);
          })
          .catch(error => {
            console.error('Failed to load jobs data:', error);
          });
      });
    });

    characterSlot.addEventListener('mouseenter', () => {
      characterSlot.style.transform = 'scale(1.05)';
      characterSlot.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
    });

    characterSlot.addEventListener('mouseleave', () => {
      characterSlot.style.transform = 'scale(1)';
      characterSlot.style.boxShadow = 'none';
    });

    characterSection.appendChild(characterTitle);
    characterSection.appendChild(characterSlotContainer);

    // Right section: Job details
    const jobSection = document.createElement('div');
    jobSection.style.cssText = `
      background: rgba(255, 255, 255, 0.4);
      border-radius: 12px;
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    `;

    const jobTitle = document.createElement('h3');
    jobTitle.textContent = '职业详情';
    jobTitle.style.cssText = `
      color: white;
      font-size: 18px;
      font-weight: bold;
      margin: 0 0 16px 0;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;

    const jobDetailsContainer = document.createElement('div');
    jobDetailsContainer.style.cssText = `
      flex: 1;
    `;

    jobSection.appendChild(jobTitle);
    jobSection.appendChild(jobDetailsContainer);

    mainContent.appendChild(characterSection);
    mainContent.appendChild(jobSection);

    jobChangeContainer.appendChild(titleContainer);
    jobChangeContainer.appendChild(mainContent);
    this.sceneContainer.appendChild(jobChangeContainer);

    // Show empty state in job details initially
    jobDetailsContainer.innerHTML = `
      <div style="color: white; text-align: center; padding: 40px; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">
        请先选择一个角色
      </div>
    `;
  }

  /**
   * Show character selection modal for job change
   */
  private showJobChangeCharacterSelectionModal(characters: any[], onSelect: (character: any) => void): void {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;

    // Create modal content (保持4:3比例，但缩小到800x600)
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      width: 800px;
      height: 600px;
      max-width: calc(100vw - 40px);
      max-height: calc(100vh - 140px);
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
    `;

    // Title
    const title = document.createElement('h2');
    title.textContent = '选择角色';
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #333;
      font-size: 20px;
      text-align: center;
      font-weight: bold;
    `;

    // Character grid
    const characterGrid = document.createElement('div');
    characterGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 20px;
      flex: 1;
      overflow-y: auto;
      align-content: start;
      padding-right: 8px;
    `;

    // Load jobs data for displaying job names
    fetch('src/game/data/jobs.json')
      .then(response => response.json())
      .then(jobsData => {
        const jobs = jobsData.jobs;

        characters.forEach(character => {
          const characterCard = document.createElement('div');
          characterCard.style.cssText = `
            background: #f5f5f5;
            border: 2px solid transparent;
            border-radius: 8px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            height: fit-content;
          `;

          // Avatar (固定宽高比，防止变形)
          const avatarContainer = document.createElement('div');
          avatarContainer.style.cssText = `
            width: 70px;
            height: 70px;
            min-width: 70px;
            min-height: 70px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            font-size: 35px;
            margin-bottom: 6px;
            flex-shrink: 0;
          `;

          const isImage = character.emoji && (character.emoji.includes('.png') || character.emoji.includes('.jpg'));
          if (isImage) {
            const img = document.createElement('img');
            img.src = character.emoji;
            img.style.cssText = `
              width: 100%;
              height: 100%;
              object-fit: cover;
            `;
            avatarContainer.appendChild(img);
          } else {
            avatarContainer.textContent = character.emoji || '👤';
          }

          // Title and name
          const displayName = character.title ? `${character.title}${character.name}` : character.name;
          const nameDiv = document.createElement('div');
          nameDiv.textContent = displayName;
          nameDiv.style.cssText = `
            color: #333;
            font-size: 11px;
            font-weight: bold;
            text-align: center;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          `;

          // Level
          const levelDiv = document.createElement('div');
          levelDiv.textContent = `等级: ${character.level || 1}`;
          levelDiv.style.cssText = `
            color: #666;
            font-size: 10px;
          `;

          // Job
          const jobData = jobs.find((j: any) => j.id === character.job);
          const jobDiv = document.createElement('div');
          jobDiv.textContent = `职业: ${jobData ? jobData.name : '无职业'}`;
          jobDiv.style.cssText = `
            color: #666;
            font-size: 10px;
          `;

          // Attributes
          const attributesDiv = document.createElement('div');
          attributesDiv.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px;
            width: 100%;
            font-size: 9px;
            color: #666;
            margin-top: 6px;
          `;

          attributesDiv.innerHTML = `
            <div>💪 ${character.strength || 0}</div>
            <div>👟 ${character.agility || 0}</div>
            <div>🧠 ${character.wisdom || 0}</div>
            <div>🔧 ${character.skill || character.technique || 0}</div>
          `;

          characterCard.appendChild(avatarContainer);
          characterCard.appendChild(nameDiv);
          characterCard.appendChild(levelDiv);
          characterCard.appendChild(jobDiv);
          characterCard.appendChild(attributesDiv);

          // Hover effects
          characterCard.addEventListener('mouseenter', () => {
            characterCard.style.background = '#e8f4f8';
            characterCard.style.borderColor = '#e67e22';
            characterCard.style.transform = 'translateY(-4px)';
            characterCard.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          });

          characterCard.addEventListener('mouseleave', () => {
            characterCard.style.background = '#f5f5f5';
            characterCard.style.borderColor = 'transparent';
            characterCard.style.transform = 'translateY(0)';
            characterCard.style.boxShadow = 'none';
          });

          // Click handler
          characterCard.addEventListener('click', () => {
            onSelect(character);
            modalOverlay.remove();
          });

          characterGrid.appendChild(characterCard);
        });
      })
      .catch(error => {
        console.error('Failed to load jobs data:', error);
      });

    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '取消';
    closeButton.style.cssText = `
      width: 100%;
      padding: 10px;
      background: #e0e0e0;
      border: none;
      border-radius: 6px;
      color: #333;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: auto;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#d0d0d0';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#e0e0e0';
    });

    closeButton.addEventListener('click', () => {
      modalOverlay.remove();
    });

    modalContent.appendChild(title);
    modalContent.appendChild(characterGrid);
    modalContent.appendChild(closeButton);
    modalOverlay.appendChild(modalContent);

    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.remove();
      }
    });

    document.body.appendChild(modalOverlay);
  }

  /**
   * Render job details for selected character
   */
  private renderJobDetails(
    container: HTMLElement, 
    character: any, 
    jobs: any[], 
    updateCharacterSlot: (character: any) => void,
    updateCharacterDetails: (character: any) => void
  ): void {
    container.innerHTML = '';
    container.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // Current character info
    const characterInfo = document.createElement('div');
    characterInfo.style.cssText = `
      background: rgba(255, 255, 255, 0.9);
      border-radius: 8px;
      padding: 12px;
    `;

    const currentJobData = jobs.find((j: any) => j.id === character.job);
    characterInfo.innerHTML = `
      <div style="font-size: 14px; font-weight: bold; color: #333; margin-bottom: 8px;">
        ${character.name} (Lv.${character.level || 1})
      </div>
      <div style="font-size: 12px; color: #666;">
        当前职业: ${currentJobData ? currentJobData.name : '无职业'}
      </div>
    `;

    container.appendChild(characterInfo);

    // Filter jobs based on character's current job
    let filteredJobs: any[] = [];
    const currentJob = character.job || 'none';
    
    if (currentJob === 'none' || currentJob === '无职业' || !currentJob) {
      // Show only base jobs (warrior, mage, ranger, priest)
      filteredJobs = jobs.filter((job: any) => job.prerequisiteJob === null);
    } else if (currentJob === 'warrior') {
      // Show only berserker and guardian
      filteredJobs = jobs.filter((job: any) => job.prerequisiteJob === 'warrior');
    } else if (currentJob === 'mage') {
      // Show only elementalist and warlock
      filteredJobs = jobs.filter((job: any) => job.prerequisiteJob === 'mage');
    } else if (currentJob === 'ranger') {
      // Show only hunter and dancer
      filteredJobs = jobs.filter((job: any) => job.prerequisiteJob === 'ranger');
    } else if (currentJob === 'priest') {
      // Show only divine_messenger and dark_messenger
      filteredJobs = jobs.filter((job: any) => job.prerequisiteJob === 'priest');
    } else {
      // For advanced jobs or unknown jobs, show no jobs (can't change from advanced job)
      filteredJobs = [];
    }

    // Available jobs grid
    const jobsGrid = document.createElement('div');
    jobsGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
      flex: 1;
      align-content: start;
    `;

    filteredJobs.forEach(job => {
      const jobCard = document.createElement('div');
      const isCurrentJob = character.job === job.id;
      
      jobCard.style.cssText = `
        background: ${isCurrentJob ? 'rgba(230, 126, 34, 1.0)' : 'rgba(255, 255, 255, 1.0)'};
        border: 2px solid ${isCurrentJob ? '#e67e22' : 'transparent'};
        border-radius: 8px;
        padding: 12px;
        cursor: ${isCurrentJob ? 'default' : 'pointer'};
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        gap: 8px;
      `;

      const jobName = document.createElement('div');
      jobName.textContent = job.name;
      jobName.style.cssText = `
        font-size: 14px;
        font-weight: bold;
        color: #333;
        text-align: center;
      `;

      const jobDesc = document.createElement('div');
      jobDesc.textContent = job.description;
      jobDesc.style.cssText = `
        font-size: 11px;
        color: #666;
        text-align: center;
        line-height: 1.4;
        margin-bottom: 4px;
      `;

      jobCard.appendChild(jobName);
      jobCard.appendChild(jobDesc);

      // Display unlock requirements
      if (job.unlockConditions && job.unlockConditions.length > 0) {
        const requirementsContainer = document.createElement('div');
        requirementsContainer.style.cssText = `
          font-size: 10px;
          line-height: 1.4;
          margin-bottom: 4px;
        `;

        job.unlockConditions.forEach((condition: any) => {
          const reqDiv = document.createElement('div');
          let isMet = false;
          let displayText = '';

          if (condition.type === 'attribute') {
            // Support both 'technique' and 'skill' attribute names for backward compatibility
            let attrValue = character[condition.attribute] || 0;
            if (condition.attribute === 'technique' && attrValue === 0) {
              attrValue = character.skill || 0;
            }
            isMet = attrValue >= condition.value;
            
            // Get attribute display name
            const attrNames: { [key: string]: string } = {
              'strength': '力量',
              'agility': '敏捷',
              'wisdom': '智慧',
              'technique': '技巧'
            };
            const attrName = attrNames[condition.attribute] || condition.attribute;
            displayText = `${attrName}≥${condition.value}`;
          } else if (condition.type === 'level') {
            const level = character.level || 1;
            isMet = level >= condition.value;
            displayText = `等级≥${condition.value}`;
          } else if (condition.type === 'noJob') {
            isMet = !character.job || character.job === '' || character.job === 'none' || character.job === '无职业';
            displayText = '无职业';
          }

          reqDiv.textContent = displayText;
          reqDiv.style.cssText = `
            color: ${isMet ? '#27ae60' : '#e74c3c'};
            font-weight: ${isMet ? 'normal' : 'bold'};
          `;
          requirementsContainer.appendChild(reqDiv);
        });

        jobCard.appendChild(requirementsContainer);
      }

      if (isCurrentJob) {
        const currentBadge = document.createElement('div');
        currentBadge.textContent = '当前职业';
        currentBadge.style.cssText = `
          background: #e67e22;
          color: white;
          font-size: 10px;
          padding: 4px 8px;
          border-radius: 4px;
          text-align: center;
          font-weight: bold;
        `;
        jobCard.appendChild(currentBadge);
      } else {
        // Check unlock conditions
        const canUnlock = this.checkJobUnlockConditions(character, job);
        
        if (!canUnlock.unlocked) {
          const lockBadge = document.createElement('div');
          lockBadge.textContent = '🔒 未达条件';
          lockBadge.style.cssText = `
            background: #95a5a6;
            color: white;
            font-size: 10px;
            padding: 4px 8px;
            border-radius: 4px;
            text-align: center;
            font-weight: bold;
          `;
          jobCard.appendChild(lockBadge);
          jobCard.style.opacity = '0.6';
          jobCard.style.cursor = 'not-allowed';
        } else {
          // Add change job button
          const changeButton = document.createElement('button');
          changeButton.textContent = '转职';
          changeButton.style.cssText = `
            background: #27ae60;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s ease;
          `;

          changeButton.addEventListener('mouseenter', () => {
            changeButton.style.background = '#229954';
          });

          changeButton.addEventListener('mouseleave', () => {
            changeButton.style.background = '#27ae60';
          });

          changeButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.changeCharacterJob(character, job);
            // Refresh the character display
            updateCharacterSlot(character);
            updateCharacterDetails(character);
            // Refresh the job list
            this.renderJobDetails(container, character, jobs, updateCharacterSlot, updateCharacterDetails);
          });

          jobCard.appendChild(changeButton);
        }

        // Hover effect for unlocked jobs
        if (canUnlock.unlocked) {
          jobCard.addEventListener('mouseenter', () => {
            jobCard.style.outline = '3px solid rgba(230, 126, 34, 1.0)';
            jobCard.style.outlineOffset = '-3px';
            jobCard.style.transform = 'translateY(-2px)';
          });

          jobCard.addEventListener('mouseleave', () => {
            jobCard.style.outline = 'none';
            jobCard.style.outlineOffset = '0';
            jobCard.style.transform = 'translateY(0)';
          });
        }
      }

      jobsGrid.appendChild(jobCard);
    });

    container.appendChild(jobsGrid);
  }

  /**
   * Check if character meets job unlock conditions
   */
  private checkJobUnlockConditions(character: any, job: any): { unlocked: boolean; reasons: string[] } {
    const reasons: string[] = [];
    
    if (!job.unlockConditions || job.unlockConditions.length === 0) {
      return { unlocked: true, reasons: [] };
    }

    for (const condition of job.unlockConditions) {
      if (condition.type === 'level') {
        if ((character.level || 1) < condition.value) {
          reasons.push(`需要等级 ${condition.value}`);
        }
      } else if (condition.type === 'attribute') {
        // Support both 'technique' and 'skill' attribute names for backward compatibility
        let attrValue = character[condition.attribute] || 0;
        if (condition.attribute === 'technique' && attrValue === 0) {
          attrValue = character.skill || 0;
        }
        if (attrValue < condition.value) {
          reasons.push(condition.description || `${condition.attribute} < ${condition.value}`);
        }
      } else if (condition.type === 'noJob') {
        if (character.job && character.job !== '' && character.job !== 'none' && character.job !== '无职业') {
          reasons.push(condition.description || '需要无职业');
        }
      }
      // Add more condition types as needed
    }

    return {
      unlocked: reasons.length === 0,
      reasons
    };
  }

  /**
   * Change character's job
   */
  private async changeCharacterJob(character: any, newJob: any): Promise<void> {
    // Get the actual character data from NPCSystem to ensure we're modifying the correct reference
    const actualCharacter = this.npcSystem.getRecruitedCharacter(character.id);
    if (!actualCharacter) {
      console.error(`Character ${character.id} not found in recruited characters`);
      this.showNotification(`无法找到角色 ${character.name}`, 'error');
      return;
    }
    
    // Load jobs data to get old job bonuses
    const response = await fetch('src/game/data/jobs.json');
    const jobsData = await response.json();
    const oldJobData = jobsData.jobs.find((j: any) => j.id === actualCharacter.job);
    
    // Remove old job attribute bonuses
    if (oldJobData && oldJobData.attributeGrowth) {
      if (oldJobData.attributeGrowth.strength) {
        actualCharacter.strength = (actualCharacter.strength || 0) - oldJobData.attributeGrowth.strength;
      }
      if (oldJobData.attributeGrowth.agility) {
        actualCharacter.agility = (actualCharacter.agility || 0) - oldJobData.attributeGrowth.agility;
      }
      if (oldJobData.attributeGrowth.wisdom) {
        actualCharacter.wisdom = (actualCharacter.wisdom || 0) - oldJobData.attributeGrowth.wisdom;
      }
      if (oldJobData.attributeGrowth.technique) {
        // Support both 'skill' and 'technique' attribute names
        const charAny = actualCharacter as any;
        const currentValue = charAny.technique || actualCharacter.skill || 0;
        const newValue = currentValue - oldJobData.attributeGrowth.technique;
        if (charAny.technique !== undefined) {
          charAny.technique = newValue;
        } else {
          actualCharacter.skill = newValue;
        }
      }
    }
    
    // Apply new job attribute bonuses
    if (newJob.attributeGrowth) {
      if (newJob.attributeGrowth.strength) {
        actualCharacter.strength = (actualCharacter.strength || 0) + newJob.attributeGrowth.strength;
      }
      if (newJob.attributeGrowth.agility) {
        actualCharacter.agility = (actualCharacter.agility || 0) + newJob.attributeGrowth.agility;
      }
      if (newJob.attributeGrowth.wisdom) {
        actualCharacter.wisdom = (actualCharacter.wisdom || 0) + newJob.attributeGrowth.wisdom;
      }
      if (newJob.attributeGrowth.technique) {
        // Support both 'skill' and 'technique' attribute names
        const charAny = actualCharacter as any;
        const currentValue = charAny.technique || actualCharacter.skill || 0;
        const newValue = currentValue + newJob.attributeGrowth.technique;
        if (charAny.technique !== undefined) {
          charAny.technique = newValue;
        } else {
          actualCharacter.skill = newValue;
        }
      }
    }
    
    // Update job
    actualCharacter.job = newJob.id;
    
    // Grant job-specific skills
    if (newJob.grantedSkills && Array.isArray(newJob.grantedSkills)) {
      // Initialize learnedActiveSkills array if it doesn't exist
      if (!actualCharacter.learnedActiveSkills) {
        actualCharacter.learnedActiveSkills = [];
      }
      
      // Add each granted skill if not already learned
      for (const skillId of newJob.grantedSkills) {
        if (!actualCharacter.learnedActiveSkills.includes(skillId)) {
          actualCharacter.learnedActiveSkills.push(skillId);
          console.log(`✅ Granted skill ${skillId} to ${actualCharacter.name}`);
        }
      }
      
      // If character has no active skill set, set the first granted skill as active
      if (!actualCharacter.activeSkill && newJob.grantedSkills.length > 0) {
        actualCharacter.activeSkill = newJob.grantedSkills[0];
        console.log(`✅ Set active skill ${actualCharacter.activeSkill} for ${actualCharacter.name}`);
      }
    }
    
    // Grant master skill for advanced jobs
    if (newJob.grantedMasterSkill) {
      // Initialize learnedMasterSkills array if it doesn't exist
      if (!actualCharacter.learnedMasterSkills) {
        actualCharacter.learnedMasterSkills = [];
      }
      
      // Add the granted master skill if not already learned
      if (!actualCharacter.learnedMasterSkills.includes(newJob.grantedMasterSkill)) {
        actualCharacter.learnedMasterSkills.push(newJob.grantedMasterSkill);
        console.log(`✅ Granted master skill ${newJob.grantedMasterSkill} to ${actualCharacter.name}`);
      }
      
      // Automatically equip the master skill
      actualCharacter.masterSkill = newJob.grantedMasterSkill;
      console.log(`✅ Equipped master skill ${actualCharacter.masterSkill} for ${actualCharacter.name}`);
    }
    
    // Recalculate secondary attributes based on new primary attributes
    this.recalculateSecondaryAttributes(actualCharacter);
    
    // Adjust current HP and MP to not exceed new max values
    if (actualCharacter.currentHP > actualCharacter.maxHP) {
      actualCharacter.currentHP = actualCharacter.maxHP;
    }
    if (actualCharacter.currentMP > actualCharacter.maxMP) {
      actualCharacter.currentMP = actualCharacter.maxMP;
    }
    
    // Copy updated data back to the character parameter for UI updates
    Object.assign(character, actualCharacter);
    
    this.showNotification(`${actualCharacter.name} 已转职为 ${newJob.name}`, 'success');
    
    // Emit quest event for job change
    this.eventSystem.emit({ type: 'quest:job_change', timestamp: Date.now() });
  }
}
