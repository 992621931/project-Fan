/**
 * NPC System - Manages non-player characters
 */

import { System } from '../../ecs/System';
import { World } from '../../ecs/World';
import passiveSkillsData from '../data/passive-skills.json';
import activeSkillsData from '../data/active-skills.json';
import jobExclusiveSkillsData from '../data/job-exclusive-skills.json';
import exclusiveSkillsData from '../data/exclusive-skills.json';
import { HungerComponentType } from '../components/CharacterComponents';

export interface NPCData {
  id: string;
  name: string;
  title?: string;  // Optional title for adventurers
  emoji: string;
  type: 'NPC' | 'Merchant' | 'Quest' | 'Adventurer' | 'Enemy';
  level: number;
  maxLevel?: number; // Maximum level (20 for adventurers, 50 for otherworld characters)
  currentEXP?: number; // Current experience points
  currentHP: number; // Current hit points
  maxHP: number;
  currentMP: number; // Current mana points
  maxMP: number;
  currentShield?: number; // Current shield amount (absorbs damage)
  currentHunger?: number; // Current hunger/satiety level
  maxHunger?: number; // Maximum hunger/satiety level
  maxEXP: number;
  job: string;
  skills: string[];
  equipment: string[];
  equippedItems?: { weapon: string | null; armor: string | null; offhand: string | null; accessory: string | null }; // Per-slot equipped item IDs
  passiveSkill?: string; // Equipped passive skill ID
  activeSkill?: string; // Equipped active skill ID
  masterSkill?: string; // Equipped master skill ID
  learnedActiveSkills?: string[]; // List of learned active skill IDs
  collisionCount?: number; // For heavy_strike skill tracking
  guaranteedCrit?: boolean; // For heavy_strike skill effect
  size?: number; // Character size for collision detection
  // Primary attributes
  strength: number;
  agility: number;
  wisdom: number;
  skill: number;
  // Secondary attributes
  attack: number;
  defense: number;
  moveSpeed: number;
  dodgeRate: number;
  critRate: number;
  critDamage: number;
  resistance: number;
  magicPower: number;
  carryWeight: number;
  accuracy: number;
  expRate: number;
  hpRegen: number;
  mpRegen: number;
  weight: number;
  volume: number;
  // Social
  affinity: number;
  // Gift preferences
  giftPreferences?: {
    loved: string[];    // 最爱的物品 IDs
    liked: string[];    // 喜欢的物品 IDs
    hated: string[];    // 讨厌的物品 IDs
  };
  discoveredPreferences?: string[]; // 已发现的偏好物品 IDs
  // Daily dialogue limit
  dailyDialogueCount?: number; // Remaining dialogue count for today (default 3)
  maxDailyDialogues?: number; // Maximum daily dialogues (default 3)
  // Daily gift limit
  dailyGiftCount?: number; // Remaining gift count for today (default 1)
  maxDailyGifts?: number; // Maximum daily gifts (default 1)
}

export class NPCSystem extends System {
  public readonly name = 'NPCSystem';
  public readonly requiredComponents: any[] = [];
  
  private world: World;
  private npcs: Map<string, NPCData> = new Map();
  private recruitedCharacters: Map<string, NPCData> = new Map(); // Store recruited characters
  private adventurerCounter: number = 0;
  private passiveSkills: any[] = []; // Passive skills pool
  private activeSkills: any[] = []; // Active skills pool (regular skills only)
  private jobExclusiveSkills: any[] = []; // Job-exclusive skills pool (separate from regular skills)
  private exclusiveSkills: any[] = []; // Otherworld character exclusive skills pool
  
  // Name and title pools for adventurers
  private readonly namePool = ['李', '王', '林', '刘', '肯尼', '塞拉', '本田', '五藏', '奥拉', '拉尔', '卡尔', '琳达', '牛牛', '本', '巴尼', '迪克', '朴', '金', '韩', '赵', '杰克', '龟田', '比尔', '艾克', '埃斯', '露西', '藤田', '小鸟游', '库鲁', '库克', '静香', '菲娜', '理惠', '优依', '悠', '穹', '瑛', '奈绪', '慧子', '井上', '田中', '山下', '青木', '咲', '铃木', '金田', '工藤', '毛利', '野原', '风间', '凯', '马尔斯', '马琳', '泰达', '米尔', '林克', '赛尔', '艾达', '乔', '肯特', '特瑞', '不知火', '伯克', '巴依', '修', '哈尔', '菲特', '菲尼', '拉菲', '裴娜', '靖', '张', '孙', '黄', '马', '牛', '石', '叶', '费', '伍', '锅', '谢', '蔡', '郑', '周', '姜', '胡', '朱', '诸葛', '南宫', '司马', '欧阳', '许', '陈', '成', '苏', '乐', '吉米', '米歇尔', '马尔福', '赫尔', '奥斯', '奥特', '奥妮'];
  private readonly titlePool = ['勇敢的', '胆小的', '好色的', '冷酷的', '目光呆滞的', '口齿不清的', '莽撞的', '谨慎的', '乐观的', '结巴的', '凶猛的', '暴脾气的', '温柔的', '迟钝的', '敏感的', '沉默的', '嘴臭的', '脚臭的', '喋喋不休的', '乐于助人的', '好为人师的', '自信满满的', '魅力四射的', '受欢迎的', '人见人爱的', '社恐的', '眼神躲闪的', '色眯眯的', '勤快的', '懒惰的', '贪吃的', '瘸腿的', '近视的', '爱笑的', '爱哭的', '无口的', '傲娇的', '冷漠的', '纯洁的', '低情商的', '高情商的', '热情洋溢的', '自私的', '慷慨的', '色盲的', '流口水的', '双下巴的', '秃头的', '恐高的', '贤惠的', '大大方方的', '抠抠搜搜的', '大大咧咧的', '娘娘闷闷儿的', '大嗓门的', '自来熟的', '没礼貌的', '客气的', '高效的', '没眼力见的', '欲求不满的'];
  
  // Adventurer avatar image pool (48 images)
  private readonly adventurerAvatarPool = [
    'images/touxiang_maoxianzhe_001.png',
    'images/touxiang_maoxianzhe_002.png',
    'images/touxiang_maoxianzhe_003.png',
    'images/touxiang_maoxianzhe_004.png',
    'images/touxiang_maoxianzhe_005.png',
    'images/touxiang_maoxianzhe_006.png',
    'images/touxiang_maoxianzhe_007.png',
    'images/touxiang_maoxianzhe_008.png',
    'images/touxiang_maoxianzhe_009.png',
    'images/touxiang_maoxianzhe_010.png',
    'images/touxiang_maoxianzhe_011.png',
    'images/touxiang_maoxianzhe_012.png',
    'images/touxiang_maoxianzhe_013.png',
    'images/touxiang_maoxianzhe_014.png',
    'images/touxiang_maoxianzhe_015.png',
    'images/touxiang_maoxianzhe_016.png',
    'images/touxiang_maoxianzhe_017.png',
    'images/touxiang_maoxianzhe_018.png',
    'images/touxiang_maoxianzhe_019.png',
    'images/touxiang_maoxianzhe_020.png',
    'images/touxiang_maoxianzhe_021.png',
    'images/touxiang_maoxianzhe_022.png',
    'images/touxiang_maoxianzhe_023.png',
    'images/touxiang_maoxianzhe_024.png',
    'images/touxiang_maoxianzhe_025.png',
    'images/touxiang_maoxianzhe_026.png',
    'images/touxiang_maoxianzhe_027.png',
    'images/touxiang_maoxianzhe_028.png',
    'images/touxiang_maoxianzhe_029.png',
    'images/touxiang_maoxianzhe_030.png',
    'images/touxiang_maoxianzhe_031.png',
    'images/touxiang_maoxianzhe_032.png',
    'images/touxiang_maoxianzhe_033.png',
    'images/touxiang_maoxianzhe_034.png',
    'images/touxiang_maoxianzhe_035.png',
    'images/touxiang_maoxianzhe_036.png',
    'images/touxiang_maoxianzhe_037.png',
    'images/touxiang_maoxianzhe_038.png',
    'images/touxiang_maoxianzhe_039.png',
    'images/touxiang_maoxianzhe_040.png',
    'images/touxiang_maoxianzhe_041.png',
    'images/touxiang_maoxianzhe_042.png',
    'images/touxiang_maoxianzhe_043.png',
    'images/touxiang_maoxianzhe_044.png',
    'images/touxiang_maoxianzhe_045.png',
    'images/touxiang_maoxianzhe_046.png',
    'images/touxiang_maoxianzhe_047.png',
    'images/touxiang_maoxianzhe_048.png'
  ];

  constructor(world: World) {
    super();
    this.world = world;
    this.initializeNPCs();
    // Load skills from imported JSON data
    this.loadSkillsFromImports();
  }

  /**
   * Load skills from imported JSON data
   */
  private loadSkillsFromImports(): void {
    try {
      this.passiveSkills = passiveSkillsData.passiveSkills || [];
      this.activeSkills = activeSkillsData.activeSkills || [];
      
      // Load job-exclusive skills separately (do NOT merge into activeSkills)
      this.jobExclusiveSkills = jobExclusiveSkillsData.jobExclusiveSkills || [];
      
      // Load otherworld character exclusive skills
      this.exclusiveSkills = exclusiveSkillsData.exclusiveSkills || [];
      
      console.log('[NPCSystem] Skills loaded from imports');
      console.log(`[NPCSystem] Passive skills: ${this.passiveSkills.length}, Active skills: ${this.activeSkills.length}, Job-exclusive skills: ${this.jobExclusiveSkills.length}, Exclusive skills: ${this.exclusiveSkills.length}`);
    } catch (error) {
      console.error('[NPCSystem] Error loading skills from imports:', error);
      // Use fallback data
      this.loadFallbackSkills();
    }
  }

  /**
   * Load fallback skills if import fails
   */
  private loadFallbackSkills(): void {
    this.passiveSkills = [
      {
        id: 'martial_training',
        name: '自幼习武',
        type: 'passive',
        rarity: 'common',
        icon: 'images/beidongjineng_ziyouxiwu.png',
        description: '攻击力+15%',
        triggerCondition: 'always',
        effects: [{ type: 'attribute_multiplier', attribute: 'attack', value: 0.15 }]
      },
      {
        id: 'thick_skin',
        name: '皮糙肉厚',
        type: 'passive',
        rarity: 'common',
        icon: 'images/beidongjineng_picaorouhou.png',
        description: '防御力+5',
        triggerCondition: 'always',
        effects: [{ type: 'attribute_bonus', attribute: 'defense', value: 5 }]
      },
      {
        id: 'robust_body',
        name: '身强体壮',
        type: 'passive',
        rarity: 'common',
        icon: 'images/beidongjineng_shenqiangtizhuang.png',
        description: '最大生命值+15%',
        triggerCondition: 'always',
        effects: [{ type: 'hp_multiplier', attribute: 'maxHP', value: 0.15 }]
      },
      {
        id: 'swift_feet',
        name: '脚底抹油',
        type: 'passive',
        rarity: 'common',
        icon: 'images/beidongjineng_jiaodimoyou.png',
        description: '移动速度+20%',
        triggerCondition: 'always',
        effects: [{ type: 'attribute_multiplier', attribute: 'moveSpeed', value: 0.20 }]
      },
      {
        id: 'thirst_for_knowledge',
        name: '求知欲',
        type: 'passive',
        rarity: 'common',
        icon: 'images/beidongjineng_qiuzhiyu.png',
        description: '经验率+15%',
        triggerCondition: 'always',
        effects: [{ type: 'attribute_multiplier', attribute: 'expRate', value: 0.15 }]
      },
      {
        id: 'heavy_strike',
        name: '重击',
        type: 'passive',
        rarity: 'common',
        icon: 'images/beidongjineng_zhongji.png',
        description: '和敌人发生3次碰撞之后，下一次碰撞必定暴击',
        triggerCondition: 'collision_count',
        triggerValue: 3,
        effects: [{ type: 'guaranteed_crit', duration: 'next_hit' }]
      }
    ];

    this.activeSkills = [
      {
        id: 'heavy_punch',
        name: '重拳出击',
        type: 'active',
        tag: 'orbit',
        rarity: 'common',
        icon: 'images/zhudongjineng_zhongquanchuji.png',
        description: '挥舞拳头造成伤害（10+施法者攻击力*75%）。',
        effects: [
          {
            type: 'spawn_orbit',
            emoji: '👊',
            distance: 100,
            duration: 2000,
            size: 50,
            damage: { base: 10, attackMultiplier: 0.75 },
            knockback: { base: 10, strengthMultiplier: 1.0 },
            piercing: true,
            hitOnce: true
          }
        ]
      },
      {
        id: 'charge',
        name: '冲锋',
        type: 'active',
        tag: 'single_target',
        rarity: 'common',
        icon: 'images/zhudongjineng_chongfeng.png',
        description: '朝距离自己最近的敌人移动并获得「冲锋」BUFF（移动速度+50，防御力+10，附带残影），持续5秒。碰撞敌人0.2秒后移除BUFF。',
        effects: [
          {
            type: 'charge_enemy',
            buffId: 'charge',
            duration: 5000,
            visualEffect: 'afterimage'
          }
        ]
      },
      {
        id: 'simple_bandage',
        name: '简易包扎',
        type: 'active',
        tag: 'single_target',
        rarity: 'common',
        icon: 'images/zhudongjineng_jianyibaoza.png',
        description: '治疗一个当前生命值最低的队友。治疗量（10+施法者主属性技巧*100%）',
        effects: [
          {
            type: 'heal_lowest_hp',
            healing: { base: 10, skillMultiplier: 1.0 }
          }
        ]
      },
      {
        id: 'enrage',
        name: '激怒',
        type: 'active',
        tag: 'single_target',
        rarity: 'common',
        icon: 'images/zhudongjineng_jinu.png',
        description: '使一个随机队友（包括自己）获得"激怒"BUFF，移动速度+30，攻击力+20%，持续8秒。',
        effects: [
          {
            type: 'buff_ally',
            buffId: 'enrage',
            duration: 8000,
            visualEffect: 'angry_emoji'
          }
        ]
      }
    ];
    console.log('[NPCSystem] Using fallback skills');
  }

  /**
   * Load passive skills from JSON file (deprecated - kept for backwards compatibility)
   */
  private async loadPassiveSkills(): Promise<void> {
    try {
      const response = await fetch('src/game/data/passive-skills.json');
      const data = await response.json();
      this.passiveSkills = data.passiveSkills || [];
      console.log('[NPCSystem] Loaded passive skills:', this.passiveSkills.length);
    } catch (error) {
      console.error('[NPCSystem] Failed to load passive skills:', error);
      // Fallback: define skills inline if loading fails
      this.passiveSkills = [
        {
          id: 'martial_training',
          name: '自幼习武',
          type: 'passive',
          rarity: 'common',
          icon: 'images/beidongjineng_ziyouxiwu.png',
          description: '攻击力+15%',
          triggerCondition: 'always',
          effects: [{ type: 'attribute_multiplier', attribute: 'attack', value: 0.15 }]
        },
        {
          id: 'thick_skin',
          name: '皮糙肉厚',
          type: 'passive',
          rarity: 'common',
          icon: 'images/beidongjineng_picaorouhou.png',
          description: '防御力+5',
          triggerCondition: 'always',
          effects: [{ type: 'attribute_bonus', attribute: 'defense', value: 5 }]
        },
        {
          id: 'robust_body',
          name: '身强体壮',
          type: 'passive',
          rarity: 'common',
          icon: 'images/beidongjineng_shenqiangtizhuang.png',
          description: '最大生命值+15%',
          triggerCondition: 'always',
          effects: [{ type: 'hp_multiplier', attribute: 'maxHP', value: 0.15 }]
        },
        {
          id: 'swift_feet',
          name: '脚底抹油',
          type: 'passive',
          rarity: 'common',
          icon: 'images/beidongjineng_jiaodimoyou.png',
          description: '移动速度+20%',
          triggerCondition: 'always',
          effects: [{ type: 'attribute_multiplier', attribute: 'moveSpeed', value: 0.20 }]
        },
        {
          id: 'thirst_for_knowledge',
          name: '求知欲',
          type: 'passive',
          rarity: 'common',
          icon: 'images/beidongjineng_qiuzhiyu.png',
          description: '经验率+15%',
          triggerCondition: 'always',
          effects: [{ type: 'attribute_multiplier', attribute: 'expRate', value: 0.15 }]
        },
        {
          id: 'heavy_strike',
          name: '重击',
          type: 'passive',
          rarity: 'common',
          icon: 'images/beidongjineng_zhongji.png',
          description: '和敌人发生3次碰撞之后，下一次碰撞必定暴击',
          triggerCondition: 'collision_count',
          triggerValue: 3,
          effects: [{ type: 'guaranteed_crit', duration: 'next_hit' }]
        }
      ];
      console.log('[NPCSystem] Using fallback passive skills');
    }
  }

  /**
   * Load active skills from JSON file
   */
  private async loadActiveSkills(): Promise<void> {
    try {
      const response = await fetch('src/game/data/active-skills.json');
      const data = await response.json();
      this.activeSkills = data.activeSkills || [];
      
      // Also load job-exclusive skills separately (do NOT merge)
      const jobSkillsResponse = await fetch('src/game/data/job-exclusive-skills.json');
      const jobSkillsData = await jobSkillsResponse.json();
      this.jobExclusiveSkills = jobSkillsData.jobExclusiveSkills || [];
      
      console.log('[NPCSystem] Loaded active skills:', this.activeSkills.length, ', job-exclusive skills:', this.jobExclusiveSkills.length);
    } catch (error) {
      console.error('[NPCSystem] Failed to load active skills:', error);
      // Fallback: define skills inline if loading fails
      this.activeSkills = [
        {
          id: 'heavy_punch',
          name: '重拳出击',
          type: 'active',
          tag: 'orbit',
          rarity: 'common',
          icon: 'images/zhudongjineng_zhongquanchuji.png',
          description: '挥舞拳头造成伤害（10+施法者攻击力*75%），力量越高，击退效果越强。',
          effects: [
            {
              type: 'spawn_orbit',
              emoji: '👊',
              distance: 100,
              duration: 2000,
              size: 50,
              damage: { base: 10, attackMultiplier: 0.75 },
              knockback: { base: 10, strengthMultiplier: 1.0 },
              piercing: true,
              hitOnce: true
            }
          ]
        },
        {
          id: 'charge',
          name: '冲锋',
          type: 'active',
          tag: 'single_target',
          rarity: 'common',
          icon: 'images/zhudongjineng_chongfeng.png',
          description: '朝距离自己最近的敌人移动并获得「冲锋」BUFF（移动速度+50，防御力+10，附带残影），持续5秒。碰撞敌人0.2秒后移除BUFF。',
          effects: [
            {
              type: 'charge_enemy',
              buffId: 'charge',
              duration: 5000,
              visualEffect: 'afterimage'
            }
          ]
        },
        {
          id: 'simple_bandage',
          name: '简易包扎',
          type: 'active',
          tag: 'single_target',
          rarity: 'common',
          icon: 'images/zhudongjineng_jianyibaoza.png',
          description: '治疗一个当前生命值最低的队友。治疗量（10+施法者主属性技巧*100%）',
          effects: [
            {
              type: 'heal_lowest_hp',
              healing: { base: 10, skillMultiplier: 1.0 }
            }
          ]
        },
        {
          id: 'enrage',
          name: '激怒',
          type: 'active',
          tag: 'single_target',
          rarity: 'common',
          icon: 'images/zhudongjineng_jinu.png',
          description: '使一个随机队友（包括自己）获得"激怒"BUFF，移动速度+30，攻击力+20%，持续8秒。',
          effects: [
            {
              type: 'buff_ally',
              buffId: 'enrage',
              duration: 8000,
              visualEffect: 'angry_emoji'
            }
          ]
        }
      ];
      console.log('[NPCSystem] Using fallback active skills');
    }
  }

  /**
   * Get a random passive skill from the pool
   */
  private getRandomPassiveSkill(): string | undefined {
    if (this.passiveSkills.length === 0) return undefined;
    const skill = this.getRandomElement(this.passiveSkills);
    return skill.id;
  }

  /**
   * Get a random active skill from the pool (common rarity only, excludes job-exclusive skills)
   */
  private getRandomActiveSkill(): string | undefined {
    // Only use regular active skills, NOT job-exclusive skills
    const commonActiveSkills = this.activeSkills.filter(s => s.rarity === 'common');
    console.log(`[NPCSystem] Active skills pool size: ${this.activeSkills.length}, common skills: ${commonActiveSkills.length} (job-exclusive skills excluded)`);
    if (commonActiveSkills.length === 0) {
      console.warn('[NPCSystem] No common active skills available!');
      return undefined;
    }
    const skill = this.getRandomElement(commonActiveSkills);
    console.log(`[NPCSystem] Selected active skill: ${skill.id} (${skill.name})`);
    return skill.id;
  }

  /**
   * Apply passive skill effects to character
   * Note: This method applies permanent/static effects during character generation.
   * Runtime effects (time-dependent, collision-triggered) are handled by CombatSystem/TimeSystem.
   */
  public applyPassiveSkillEffects(character: NPCData): void {
    if (!character.passiveSkill) return;

    const skill = this.passiveSkills.find(s => s.id === character.passiveSkill);
    if (!skill) return;

    // Apply effects based on skill type
    skill.effects.forEach((effect: any) => {
      // Skip runtime effects that need to be handled by other systems
      if (skill.triggerCondition === 'time_of_day' || skill.triggerCondition === 'on_collision') {
        console.log(`[NPCSystem] Skipping runtime effect for ${skill.name} (handled by CombatSystem/TimeSystem)`);
        return;
      }

      switch (effect.type) {
        case 'attribute_multiplier':
          // Multiply attribute by percentage
          const currentValue = (character as any)[effect.attribute];
          const calculatedValue = currentValue * (1 + effect.value);
          // Use Math.round() instead of Math.floor() to avoid floating point precision issues
          const newValue = Math.round(calculatedValue);
          console.log(`[NPCSystem] Applying ${skill.name} to ${effect.attribute}: ${currentValue} × (1 + ${effect.value}) = ${calculatedValue} → ${newValue}`);
          (character as any)[effect.attribute] = newValue;
          break;
        
        case 'attribute_bonus':
          // Add flat bonus to attribute
          const oldValue = (character as any)[effect.attribute];
          (character as any)[effect.attribute] += effect.value;
          console.log(`[NPCSystem] Applying ${skill.name} to ${effect.attribute}: ${oldValue} + ${effect.value} = ${(character as any)[effect.attribute]}`);
          break;
        
        case 'hp_multiplier':
          // Multiply max HP by percentage
          const baseHP = character.maxHP;
          const calculatedHP = baseHP * (1 + effect.value);
          // Use Math.round() instead of Math.floor() to avoid floating point precision issues
          character.maxHP = Math.round(calculatedHP);
          // Maintain HP ratio instead of healing to full (preserves current HP proportion)
          const hpRatio = character.currentHP / baseHP;
          character.currentHP = Math.round(character.maxHP * hpRatio);
          console.log(`[NPCSystem] Applying ${skill.name} to maxHP: ${baseHP} × (1 + ${effect.value}) = ${calculatedHP} → ${character.maxHP}, currentHP: ${character.currentHP}`);
          break;
        
        case 'damage_modifier':
          // Damage modifiers are stored on the character and applied by CombatSystem
          // No need to modify attributes here, just log for debugging
          console.log(`[NPCSystem] ${skill.name} provides damage modifier: +${effect.value * 100}% to ${effect.targetType} targets`);
          break;
        
        case 'lifesteal':
          // Lifesteal is handled by CombatSystem during collision
          console.log(`[NPCSystem] ${skill.name} provides lifesteal: ${effect.value * 100}% of damage`);
          break;
        
        case 'gold_on_hit':
          // Gold on hit is handled by CombatSystem during collision
          console.log(`[NPCSystem] ${skill.name} provides gold on hit: ${effect.minValue}-${effect.maxValue} gold`);
          break;
      }
    });

    console.log(`[NPCSystem] Applied passive skill "${skill.name}" to ${character.name}`);
  }

  /**
   * Get passive skill data by ID
   */
  public getPassiveSkill(skillId: string): any {
    return this.passiveSkills.find(s => s.id === skillId);
  }

  /**
   * Get all passive skills
   */
  public getPassiveSkills(): any[] {
    return this.passiveSkills;
  }

  /**
   * Get active skill data by ID (searches regular, job-exclusive, and otherworld exclusive skills)
   */
  public getActiveSkill(skillId: string): any {
    // Search in regular active skills first
    let skill = this.activeSkills.find(s => s.id === skillId);
    // If not found, search in job-exclusive skills
    if (!skill) {
      skill = this.jobExclusiveSkills.find(s => s.id === skillId);
    }
    // If still not found, search in otherworld exclusive skills
    if (!skill) {
      skill = this.exclusiveSkills.find(s => s.id === skillId);
    }
    return skill;
  }

  /**
   * Get job-exclusive (master) skill data by ID
   */
  public getJobExclusiveSkill(skillId: string): any {
    return this.jobExclusiveSkills.find(s => s.id === skillId);
  }

  private getRandomElement<T>(array: T[]): T {
    const index = Math.floor(Math.random() * array.length);
    return array[index]!;
  }

  /**
   * Calculate secondary attributes based on primary attributes
   * Base values + bonuses from primary attributes:
   * - Attack: 10 base + strength bonus
   * - Defense: 1 base + (strength + agility) bonus
   * - Move Speed: 50 base + agility bonus
   * - Dodge Rate: 0% base + (agility × 0.5%) bonus
   * - Crit Rate: 5% base + (skill × 0.5%) bonus
   * - Crit Damage: 150% base + (skill × 2%) bonus
   * - Resistance: 0 base + (wisdom × 0.5) bonus
   * - Magic Power: 0 base + wisdom bonus
   * - Carry Weight: 10 base + strength bonus
   * - Accuracy: 100% base + (skill × 0.5%) bonus
   * - HP Regen: 1 base + (strength × 0.2) bonus
   * - MP Regen: 10 base + (wisdom × 0.2) bonus
   * - Weight: 50 base + strength bonus
   */
  private calculateSecondaryAttributes(strength: number, agility: number, wisdom: number, skill: number) {
    return {
      attack: 10 + strength,
      defense: 1 + strength + agility,
      moveSpeed: 50 + agility,
      dodgeRate: 0 + agility * 0.5,
      critRate: 5 + skill * 0.5,
      critDamage: 125, // Fixed base value
      resistance: 0 + wisdom * 0.5,
      magicPower: 0 + wisdom,
      carryWeight: 10 + strength,
      accuracy: 100 + skill * 0.5,
      expRate: 100,
      hpRegen: 1 + strength * 0.2,
      mpRegen: 10 + wisdom * 0.2,
      weight: 50 + strength,
      volume: 100
    };
  }

  /**
   * Calculate max HP and MP based on attributes and level
   * - Max HP: 100 + (all attributes) + (level - 1) * 10
   * - Max MP: Always 100 (fixed value)
   */
  private calculateMaxHPMP(strength: number, agility: number, wisdom: number, skill: number, level: number) {
    const attributeHPBonus = strength + agility + wisdom + skill;
    const maxHP = 100 + attributeHPBonus + (level - 1) * 10;
    const maxMP = 100; // Fixed value, does not change with level or attributes
    return { maxHP, maxMP };
  }

  private generateRandomGiftPreferences(): { loved: string[]; liked: string[]; hated: string[] } {
    const giftItemPool = [
      'copper_ore', 'iron_ore', 'oak_wood', 'blue_tan_wood', 'lavender',
      'mystic_mushroom', 'slime_qq_candy', 'salty_concubine_candy', 'bitter_ball',
      'bitter_juice', 'suffocating_special_drink', 'sweet_syrup_gland',
      'two_headed_snake_liver', 'beating_gallbladder', 'cave_set_meal',
      'dehydrated_compressed_biscuit', 'dry_pot_eye_frog',
      'copper_longsword', 'small_round_shield', 'copper_ring', 'copper_necklace',
      'apprentice_strength_potion', 'apprentice_mana_potion'
    ];
    // Shuffle and pick 3 distinct items
    const shuffled = [...giftItemPool].sort(() => Math.random() - 0.5);
    return {
      loved: [shuffled[0]],
      liked: [shuffled[1]],
      hated: [shuffled[2]]
    };
  }

  public createAdventurer(): NPCData {
    this.adventurerCounter++;
    const randomName = this.getRandomElement(this.namePool);
    const randomTitle = this.getRandomElement(this.titlePool);
    const randomAvatar = this.getRandomElement(this.adventurerAvatarPool);
    
    // Randomly distribute 10 attribute points among the 4 primary attributes
    const totalPoints = 10;
    const attributes = { strength: 1, agility: 1, wisdom: 1, skill: 1 };
    
    // Distribute the remaining points randomly
    for (let i = 0; i < totalPoints; i++) {
      const attributeKeys = Object.keys(attributes) as Array<keyof typeof attributes>;
      const randomAttribute = this.getRandomElement(attributeKeys);
      attributes[randomAttribute]++;
    }
    
    // Calculate secondary attributes based on primary attributes
    const secondaryAttrs = this.calculateSecondaryAttributes(
      attributes.strength,
      attributes.agility,
      attributes.wisdom,
      attributes.skill
    );
    
    // Calculate max HP and MP
    const { maxHP, maxMP } = this.calculateMaxHPMP(
      attributes.strength,
      attributes.agility,
      attributes.wisdom,
      attributes.skill,
      1 // Level 1
    );
    
    // Get initial active skill
    const initialActiveSkill = this.getRandomActiveSkill();
    
    const adventurer: NPCData = {
      id: `adventurer_${this.adventurerCounter}_${Date.now()}`,
      name: randomName,
      title: randomTitle,
      emoji: randomAvatar,
      type: 'Adventurer',
      level: 1,
      maxLevel: 20,
      currentEXP: 0,
      currentHP: maxHP, // Start with full HP
      maxHP: maxHP,
      currentMP: 0, // Start with 0 MP
      maxMP: maxMP,
      currentHunger: Math.floor(Math.random() * 21) + 30, // Start with 30-50 hunger (hunger bonus)
      maxHunger: 100,
      maxEXP: this.calculateRequiredEXP(1),
      job: 'none',
      skills: [],
      equipment: [],
      equippedItems: { weapon: null, armor: null, offhand: null, accessory: null },
      passiveSkill: this.getRandomPassiveSkill(), // Assign random passive skill
      activeSkill: initialActiveSkill, // Assign random active skill
      learnedActiveSkills: initialActiveSkill ? [initialActiveSkill] : [], // Add initial skill to learned skills
      collisionCount: 0, // Initialize collision counter
      guaranteedCrit: false, // Initialize crit flag
      // Primary attributes (1 base + random distribution of 10 points)
      strength: attributes.strength,
      agility: attributes.agility,
      wisdom: attributes.wisdom,
      skill: attributes.skill,
      // Secondary attributes (calculated from primary attributes)
      attack: secondaryAttrs.attack,
      defense: secondaryAttrs.defense,
      moveSpeed: secondaryAttrs.moveSpeed,
      dodgeRate: secondaryAttrs.dodgeRate,
      critRate: secondaryAttrs.critRate,
      critDamage: secondaryAttrs.critDamage,
      resistance: secondaryAttrs.resistance,
      magicPower: secondaryAttrs.magicPower,
      carryWeight: secondaryAttrs.carryWeight,
      accuracy: secondaryAttrs.accuracy,
      expRate: secondaryAttrs.expRate,
      hpRegen: secondaryAttrs.hpRegen,
      mpRegen: secondaryAttrs.mpRegen,
      weight: secondaryAttrs.weight,
      volume: secondaryAttrs.volume,
      // Social
      affinity: 0,
      giftPreferences: this.generateRandomGiftPreferences()
    };
    
    console.log(`[NPCSystem] Created adventurer ${adventurer.title}${adventurer.name} with expRate: ${adventurer.expRate}, passiveSkill: ${adventurer.passiveSkill}, activeSkill: ${adventurer.activeSkill}`);
    
    // Apply passive skill effects
    this.applyPassiveSkillEffects(adventurer);
    
    console.log(`[NPCSystem] After applying skill, expRate: ${adventurer.expRate}`);
    
    this.addNPC(adventurer);
    return adventurer;
  }

  private initializeNPCs(): void {
    // Add Village Chief NPC
    this.addNPC({
      id: 'village_chief',
      name: '刘易斯',
      title: '村长',
      emoji: 'images/touxiang_npc_cunzhang.png',
      type: 'NPC',
      level: 1,
      currentHP: 100,
      maxHP: 100,
      currentMP: 0,
      maxMP: 100,
      maxEXP: 100,
      job: '无',
      skills: [],
      equipment: [],
      // Primary attributes
      strength: 1,
      agility: 1,
      wisdom: 1,
      skill: 1,
      // Secondary attributes
      attack: 1,
      defense: 1,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      hpRegen: 0,
      mpRegen: 0,
      weight: 50,
      volume: 100,
      // Social
      affinity: 0,
      giftPreferences: {
        loved: ['cave_set_meal'],
        liked: ['copper_ring'],
        hated: ['slime_qq_candy']
      }
    });

    // Add Blacksmith Z·Z NPC
    this.addNPC({
      id: 'blacksmith_zz',
      name: 'Z·Z',
      title: '铁匠',
      emoji: 'images/touxiang_npc_tiejiangZZ.png',
      type: 'NPC',
      level: 1,
      currentHP: 100,
      maxHP: 100,
      currentMP: 0,
      maxMP: 100,
      maxEXP: 100,
      job: '无',
      skills: [],
      equipment: [],
      // Primary attributes
      strength: 1,
      agility: 1,
      wisdom: 1,
      skill: 1,
      // Secondary attributes
      attack: 1,
      defense: 1,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      hpRegen: 0,
      mpRegen: 0,
      weight: 50,
      volume: 100,
      // Social
      affinity: 0,
      giftPreferences: {
        loved: ['iron_ore'],
        liked: ['copper_ore'],
        hated: ['suffocating_special_drink']
      }
    });

    // Add Bartender NPC
    this.addNPC({
      id: 'bartender',
      name: '鲍勃',
      title: '酒保',
      emoji: 'images/touxiang_npc_jiubao.png',
      type: 'NPC',
      level: 1,
      currentHP: 100,
      maxHP: 100,
      currentMP: 0,
      maxMP: 100,
      maxEXP: 100,
      job: '无',
      skills: [],
      equipment: [],
      // Primary attributes
      strength: 1,
      agility: 1,
      wisdom: 1,
      skill: 1,
      // Secondary attributes
      attack: 1,
      defense: 1,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      hpRegen: 0,
      mpRegen: 0,
      weight: 50,
      volume: 100,
      // Social
      affinity: 0,
      giftPreferences: {
        loved: ['suffocating_special_drink'],
        liked: ['bitter_juice'],
        hated: ['sweet_syrup_gland']
      }
    });

    // Add Maid NPC
    this.addNPC({
      id: 'maid',
      name: '凉子',
      title: '女仆',
      emoji: 'images/touxiang_npc_nvpu_liangzi.png',
      type: 'NPC',
      level: 1,
      currentHP: 100,
      maxHP: 100,
      currentMP: 0,
      maxMP: 100,
      maxEXP: 100,
      job: '无',
      skills: [],
      equipment: [],
      // Primary attributes
      strength: 1,
      agility: 1,
      wisdom: 1,
      skill: 1,
      // Secondary attributes
      attack: 1,
      defense: 1,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      hpRegen: 0,
      mpRegen: 0,
      weight: 50,
      volume: 100,
      // Social
      affinity: 0,
      giftPreferences: {
        loved: ['bitter_ball'],
        liked: ['salty_concubine_candy'],
        hated: ['dry_pot_eye_frog']
      }
    });

    // Add Chef Curry NPC
    this.addNPC({
      id: 'chef_curry',
      name: '咖喱',
      title: '厨师',
      emoji: 'images/touxiang_npc_gali.png',
      type: 'NPC',
      level: 1,
      currentHP: 100,
      maxHP: 100,
      currentMP: 0,
      maxMP: 100,
      maxEXP: 100,
      job: '无',
      skills: [],
      equipment: [],
      // Primary attributes
      strength: 1,
      agility: 1,
      wisdom: 1,
      skill: 1,
      // Secondary attributes
      attack: 1,
      defense: 1,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      hpRegen: 0,
      mpRegen: 0,
      weight: 50,
      volume: 100,
      // Social
      affinity: 0,
      giftPreferences: {
        loved: ['two_headed_snake_liver'],
        liked: ['mystic_mushroom'],
        hated: ['blue_tan_wood']
      }
    });

    // Add Alchemist Tuanzi NPC
    this.addNPC({
      id: 'alchemist_tuanzi',
      name: '团子',
      title: '炼金师',
      emoji: 'images/touxiang_npc_tuanzi.png',
      type: 'NPC',
      level: 1,
      currentHP: 100,
      maxHP: 100,
      currentMP: 0,
      maxMP: 100,
      maxEXP: 100,
      job: '无',
      skills: [],
      equipment: [],
      // Primary attributes
      strength: 1,
      agility: 1,
      wisdom: 1,
      skill: 1,
      // Secondary attributes
      attack: 1,
      defense: 1,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      hpRegen: 0,
      mpRegen: 0,
      weight: 50,
      volume: 100,
      // Social
      affinity: 0,
      giftPreferences: {
        loved: ['lavender'],
        liked: ['slime_qq_candy'],
        hated: ['copper_ore']
      }
    });

    // Add Scholar Xiaomei NPC
    this.addNPC({
      id: 'scholar_xiaomei',
      name: '小么',
      title: '智者',
      emoji: 'images/touxiang_npc_xiaome.png',
      type: 'NPC',
      level: 1,
      currentHP: 100,
      maxHP: 100,
      currentMP: 0,
      maxMP: 100,
      maxEXP: 100,
      job: '无',
      skills: [],
      equipment: [],
      // Primary attributes
      strength: 1,
      agility: 1,
      wisdom: 1,
      skill: 1,
      // Secondary attributes
      attack: 1,
      defense: 1,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      hpRegen: 0,
      mpRegen: 0,
      weight: 50,
      volume: 100,
      // Social
      affinity: 0,
      giftPreferences: {
        loved: ['apprentice_mana_potion'],
        liked: ['copper_necklace'],
        hated: ['salty_concubine_candy']
      }
    });

    // Add Trainer Alin NPC
    this.addNPC({
      id: 'trainer_alin',
      name: '阿林',
      title: '训练官',
      emoji: 'images/touxiang_npc_alin.png',
      type: 'NPC',
      level: 1,
      currentHP: 100,
      maxHP: 100,
      currentMP: 0,
      maxMP: 100,
      maxEXP: 100,
      job: '无',
      skills: [],
      equipment: [],
      // Primary attributes
      strength: 1,
      agility: 1,
      wisdom: 1,
      skill: 1,
      // Secondary attributes
      attack: 1,
      defense: 1,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      hpRegen: 0,
      mpRegen: 0,
      weight: 50,
      volume: 100,
      // Social
      affinity: 0,
      giftPreferences: {
        loved: ['apprentice_strength_potion'],
        liked: ['copper_longsword'],
        hated: ['dehydrated_compressed_biscuit']
      }
    });

    // Add Summoner Kaoezi NPC
    this.addNPC({
      id: 'summoner_kaoezi',
      name: '烤鹅子',
      title: '召唤师',
      emoji: 'images/touxiang_npc_kaoezi.png',
      type: 'NPC',
      level: 1,
      currentHP: 100,
      maxHP: 100,
      currentMP: 0,
      maxMP: 100,
      maxEXP: 100,
      job: '无',
      skills: [],
      equipment: [],
      // Primary attributes
      strength: 1,
      agility: 1,
      wisdom: 1,
      skill: 1,
      // Secondary attributes
      attack: 1,
      defense: 1,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      hpRegen: 0,
      mpRegen: 0,
      weight: 50,
      volume: 100,
      // Social
      affinity: 0,
      giftPreferences: {
        loved: ['beating_gallbladder'],
        liked: ['bitter_ball'],
        hated: ['copper_longsword']
      }
    });

    // Add Merchant Xiaoheiyang NPC (Market)
    this.addNPC({
      id: 'merchant_xiaoheiyang',
      name: '小黑羊',
      title: '杂货商',
      emoji: 'images/touxiang_npc_xiaoheiyang.png',
      type: 'NPC',
      level: 1,
      currentHP: 100,
      maxHP: 100,
      currentMP: 0,
      maxMP: 100,
      maxEXP: 100,
      job: '无',
      skills: [],
      equipment: [],
      // Primary attributes
      strength: 1,
      agility: 1,
      wisdom: 1,
      skill: 1,
      // Secondary attributes
      attack: 1,
      defense: 1,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      hpRegen: 0,
      mpRegen: 0,
      weight: 50,
      volume: 100,
      // Social
      affinity: 0,
      giftPreferences: {
        loved: ['salty_concubine_candy'],
        liked: ['slime_qq_candy'],
        hated: ['bitter_ball']
      }
    });

    // Add Equipment Merchant Youliang NPC (Market)
    this.addNPC({
      id: 'merchant_youliang',
      name: '由良',
      title: '装备商',
      emoji: 'images/touxiang_npc_youliang.png',
      type: 'NPC',
      level: 1,
      currentHP: 100,
      maxHP: 100,
      currentMP: 0,
      maxMP: 100,
      maxEXP: 100,
      job: '无',
      skills: [],
      equipment: [],
      // Primary attributes
      strength: 1,
      agility: 1,
      wisdom: 1,
      skill: 1,
      // Secondary attributes
      attack: 1,
      defense: 1,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      hpRegen: 0,
      mpRegen: 0,
      weight: 50,
      volume: 100,
      // Social
      affinity: 0,
      giftPreferences: {
        loved: ['copper_longsword'],
        liked: ['small_round_shield'],
        hated: ['oak_wood']
      }
    });

    // Add Bookseller Xiaochao NPC (Market)
    this.addNPC({
      id: 'bookseller_xiaochao',
      name: '小超',
      title: '书商',
      emoji: 'images/touxiang_npc_xiaochao.png',
      type: 'NPC',
      level: 1,
      currentHP: 100,
      maxHP: 100,
      currentMP: 0,
      maxMP: 100,
      maxEXP: 100,
      job: '无',
      skills: [],
      equipment: [],
      // Primary attributes
      strength: 1,
      agility: 1,
      wisdom: 1,
      skill: 1,
      // Secondary attributes
      attack: 1,
      defense: 1,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      hpRegen: 0,
      mpRegen: 0,
      weight: 50,
      volume: 100,
      // Social
      affinity: 0,
      giftPreferences: {
        loved: ['apprentice_hardening_potion'],
        liked: ['burst_berry'],
        hated: ['frog_leg_sashimi']
      }
    });

    // Add Player's Stall NPC (Market)
    this.addNPC({
      id: 'player_stall',
      name: '我的摊位',
      title: '',
      emoji: 'images/touxiang_npc_wodetanwei.png',
      type: 'NPC',
      level: 1,
      currentHP: 100,
      maxHP: 100,
      currentMP: 0,
      maxMP: 100,
      maxEXP: 100,
      job: '无',
      skills: [],
      equipment: [],
      // Primary attributes
      strength: 1,
      agility: 1,
      wisdom: 1,
      skill: 1,
      // Secondary attributes
      attack: 1,
      defense: 1,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      hpRegen: 0,
      mpRegen: 0,
      weight: 50,
      volume: 100,
      // Social
      affinity: -1 // Special value to indicate no affinity display
    });
  }

  public addNPC(data: NPCData): void {
    // Initialize dialogue count if not set
    if (data.dailyDialogueCount === undefined) {
      data.dailyDialogueCount = 3;
    }
    if (data.maxDailyDialogues === undefined) {
      data.maxDailyDialogues = 3;
    }
    // Initialize gift count if not set
    if (data.dailyGiftCount === undefined) {
      data.dailyGiftCount = 1;
    }
    if (data.maxDailyGifts === undefined) {
      data.maxDailyGifts = 1;
    }
    this.npcs.set(data.id, data);
  }

  public removeNPC(id: string): void {
    this.npcs.delete(id);
  }

  public getNPC(id: string): NPCData | undefined {
    return this.npcs.get(id);
  }

  public getAllNPCs(): NPCData[] {
    return Array.from(this.npcs.values());
  }

  public getNPCsByType(type: NPCData['type']): NPCData[] {
    return Array.from(this.npcs.values()).filter(npc => npc.type === type);
  }

  public updateAffinity(npcId: string, amount: number): void {
    const npc = this.npcs.get(npcId) || this.recruitedCharacters.get(npcId);
    if (npc) {
      // Regular adventurer characters (maxLevel 20) gain 10x affinity, otherworld characters (maxLevel 50) do not
      const isRegularAdventurer = npc.type === 'Adventurer' && (npc.maxLevel || 20) <= 20;
      const multipliedAmount = isRegularAdventurer ? amount * 10 : amount;
      npc.affinity = Math.max(0, Math.min(100, npc.affinity + multipliedAmount));
    }
  }

  // Recruited character management
  public recruitCharacter(npcData: NPCData): void {
    // Initialize dialogue/gift counts if not set (same as addNPC)
    if (npcData.dailyDialogueCount === undefined) {
      npcData.dailyDialogueCount = 3;
    }
    if (npcData.maxDailyDialogues === undefined) {
      npcData.maxDailyDialogues = 3;
    }
    if (npcData.dailyGiftCount === undefined) {
      npcData.dailyGiftCount = 1;
    }
    if (npcData.maxDailyGifts === undefined) {
      npcData.maxDailyGifts = 1;
    }
    this.recruitedCharacters.set(npcData.id, npcData);
    this.removeNPC(npcData.id); // Remove from available NPCs
    
    // Add hunger component to ECS system if character has hunger data
    if (npcData.currentHunger !== undefined && npcData.maxHunger !== undefined) {
      // Use character ID as entity ID (NPCData.id is used as the entity identifier)
      this.world.addComponent(npcData.id as any, HungerComponentType, {
        type: 'hunger',
        current: npcData.currentHunger,
        maximum: npcData.maxHunger
      });
      console.log(`[NPCSystem] Added hunger component to ${npcData.name}: ${npcData.currentHunger}/${npcData.maxHunger}`);
    }
  }

  public getRecruitedCharacters(): NPCData[] {
    return Array.from(this.recruitedCharacters.values());
  }

  public getRecruitedCharacter(id: string): NPCData | undefined {
    return this.recruitedCharacters.get(id);
  }

  /**
   * Remove a recruited character (dismiss/fire)
   * @param id - Character ID to remove
   * @returns true if character was found and removed
   */
  public removeRecruitedCharacter(id: string): boolean {
    const character = this.recruitedCharacters.get(id);
    if (!character) return false;
    this.recruitedCharacters.delete(id);
    console.log(`[NPCSystem] Removed recruited character: ${character.name} (${id})`);
    return true;
  }

  /**
   * Calculate required EXP for a given level
   * Uses formula: baseEXP * (level^1.5)
   * This creates a smooth exponential curve typical of RPGs
   */
  public calculateRequiredEXP(level: number, maxLevel: number = 20): number {
    if (level >= maxLevel) return 0; // Max level reached
    const baseEXP = 100;
    return Math.floor(baseEXP * Math.pow(level, 1.5));
  }

  /**
   * Add experience to a character and handle level ups
   * Returns true if character leveled up
   */
  public addExperience(npcId: string, amount: number): boolean {
    const npc = this.npcs.get(npcId) || this.recruitedCharacters.get(npcId);
    if (!npc || npc.type !== 'Adventurer') return false;

    // Check if already at max level
    if (npc.level >= (npc.maxLevel || 20)) return false;

    // Initialize currentEXP if not set
    if (npc.currentEXP === undefined) npc.currentEXP = 0;

    // Apply expRate multiplier to experience gain
    const expRate = npc.expRate || 100;
    const finalAmount = Math.round(amount * (expRate / 100));
    
    console.log(`[NPCSystem] Experience gain for ${npc.name}:`);
    console.log(`  Base EXP: ${amount}`);
    console.log(`  ExpRate: ${expRate}%`);
    console.log(`  Final EXP: ${finalAmount}`);

    npc.currentEXP += finalAmount;
    let leveledUp = false;

    // Check for level up (can level up multiple times)
    while (npc.currentEXP >= npc.maxEXP && npc.level < (npc.maxLevel || 20)) {
      npc.currentEXP -= npc.maxEXP;
      this.levelUp(npc);
      leveledUp = true;
    }

    return leveledUp;
  }

  /**
   * Level up a character
   * - Increases level by 1
   * - Distributes 3 attribute points randomly
   * - Recalculates secondary attributes based on new primary attributes
   * - Updates maxHP and maxMP
   * - Updates maxEXP for next level
   */
  private levelUp(npc: NPCData): void {
    npc.level++;

    // Randomly distribute 3 attribute points
    const pointsToDistribute = 3;
    const attributes: Array<'strength' | 'agility' | 'wisdom' | 'skill'> = ['strength', 'agility', 'wisdom', 'skill'];
    
    for (let i = 0; i < pointsToDistribute; i++) {
      const randomAttribute = this.getRandomElement(attributes);
      npc[randomAttribute]++;
    }

    // Recalculate secondary attributes based on new primary attributes
    const secondaryAttrs = this.calculateSecondaryAttributes(
      npc.strength,
      npc.agility,
      npc.wisdom,
      npc.skill
    );
    
    // Update secondary attributes
    npc.attack = secondaryAttrs.attack;
    npc.defense = secondaryAttrs.defense;
    npc.moveSpeed = secondaryAttrs.moveSpeed;
    npc.dodgeRate = secondaryAttrs.dodgeRate;
    npc.critRate = secondaryAttrs.critRate;
    npc.critDamage = secondaryAttrs.critDamage;
    npc.resistance = secondaryAttrs.resistance;
    npc.magicPower = secondaryAttrs.magicPower;
    npc.carryWeight = secondaryAttrs.carryWeight;
    npc.accuracy = secondaryAttrs.accuracy;
    npc.hpRegen = secondaryAttrs.hpRegen;
    npc.mpRegen = secondaryAttrs.mpRegen;
    npc.weight = secondaryAttrs.weight;
    npc.expRate = secondaryAttrs.expRate;
    
    // Recalculate max HP and MP
    const { maxHP, maxMP } = this.calculateMaxHPMP(
      npc.strength,
      npc.agility,
      npc.wisdom,
      npc.skill,
      npc.level
    );
    
    // Update max HP/MP while maintaining current HP/MP ratio
    const hpRatio = npc.currentHP / npc.maxHP;
    const mpRatio = npc.currentMP / npc.maxMP;
    npc.maxHP = maxHP;
    npc.maxMP = maxMP;
    npc.currentHP = Math.floor(maxHP * hpRatio);
    npc.currentMP = Math.floor(maxMP * mpRatio);

    // Update maxEXP for next level
    npc.maxEXP = this.calculateRequiredEXP(npc.level, npc.maxLevel || 20);

    // Re-apply passive skill effects after recalculating base stats
    this.applyPassiveSkillEffects(npc);

    console.log(`${npc.title}${npc.name} leveled up to ${npc.level}!`);
    console.log(`  Attributes: STR ${npc.strength}, AGI ${npc.agility}, WIS ${npc.wisdom}, SKL ${npc.skill}`);
    console.log(`  Secondary: ATK ${npc.attack}, DEF ${npc.defense}, SPD ${npc.moveSpeed}`);
    console.log(`  HP: ${npc.currentHP}/${npc.maxHP}, MP: ${npc.currentMP}/${npc.maxMP}`);
  }

  update(_deltaTime: number): void {
    // NPC system update logic
  }

  /**
   * Reset daily dialogue count for all NPCs and recruited characters
   * Called when day changes (night -> day transition)
   */
  public resetDailyDialogues(): void {
    // Reset for all NPCs
    for (const npc of this.npcs.values()) {
      if (npc.maxDailyDialogues !== undefined) {
        npc.dailyDialogueCount = npc.maxDailyDialogues;
      }
    }
    
    // Reset for all recruited characters
    for (const character of this.recruitedCharacters.values()) {
      if (character.maxDailyDialogues !== undefined) {
        character.dailyDialogueCount = character.maxDailyDialogues;
      }
    }
    
    console.log('[NPCSystem] Reset daily dialogue counts for all characters');
  }

  /**
   * Reset daily gift counts for all NPCs and recruited characters
   * Called when day changes (night -> day transition)
   */
  public resetDailyGifts(): void {
    for (const npc of this.npcs.values()) {
      if (npc.maxDailyGifts !== undefined) {
        npc.dailyGiftCount = npc.maxDailyGifts;
      }
    }
    for (const character of this.recruitedCharacters.values()) {
      if (character.maxDailyGifts !== undefined) {
        character.dailyGiftCount = character.maxDailyGifts;
      }
    }
    console.log('[NPCSystem] Reset daily gift counts for all characters');
  }

  /**
   * Consume one gift count for a character
   * Returns true if gift is allowed, false if no gifts remaining
   */
  public consumeGift(npcId: string): boolean {
    const npc = this.npcs.get(npcId) || this.recruitedCharacters.get(npcId);
    if (!npc) return false;

    if (npc.dailyGiftCount === undefined) {
      npc.dailyGiftCount = 1;
    }
    if (npc.maxDailyGifts === undefined) {
      npc.maxDailyGifts = 1;
    }

    if (npc.dailyGiftCount <= 0) {
      return false;
    }

    npc.dailyGiftCount--;
    console.log(`[NPCSystem] ${npc.name} gift consumed. Remaining: ${npc.dailyGiftCount}/${npc.maxDailyGifts}`);
    return true;
  }

  /**
   * Consume one dialogue count for a character
   * Returns true if dialogue is allowed, false if no dialogues remaining
   */
  public consumeDialogue(npcId: string): boolean {
    const npc = this.npcs.get(npcId) || this.recruitedCharacters.get(npcId);
    if (!npc) return false;
    
    // Initialize if not set
    if (npc.dailyDialogueCount === undefined) {
      npc.dailyDialogueCount = 3;
    }
    if (npc.maxDailyDialogues === undefined) {
      npc.maxDailyDialogues = 3;
    }
    
    // Check if dialogues remaining
    if (npc.dailyDialogueCount <= 0) {
      return false;
    }
    
    // Consume one dialogue
    npc.dailyDialogueCount--;
    console.log(`[NPCSystem] ${npc.name} dialogue consumed. Remaining: ${npc.dailyDialogueCount}/${npc.maxDailyDialogues}`);
    return true;
  }
}
