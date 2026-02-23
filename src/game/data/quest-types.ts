/** 任务目标检测类型 */
export type QuestObjectiveType =
  | 'item_possession'    // 持有物品
  | 'scene_visit'        // 访问场景
  | 'craft_item'         // 制作物品
  | 'combat_complete'    // 完成战斗
  | 'combat_kill'        // 击杀敌人
  | 'shop_purchase'      // 从商店购买物品
  | 'job_change'         // 角色转职
  | 'summon'             // 异界召唤
  | 'recruit'            // 招募冒险者
  | 'gift_give'          // 送礼
  | 'affinity_level'     // 好感度等级
  | 'dialogue'           // 与NPC对话
  | 'skill_change'       // 更换技能
  | 'stall_add_item'     // 摊位添加商品
  | 'equipment_equip'     // 装备装备
  | 'kill_enemy';        // 击杀特定敌人

/** 单个任务目标 */
export interface QuestObjective {
  type: QuestObjectiveType;
  target: string;          // 目标ID（物品ID、场景ID、NPC ID等）
  requiredAmount: number;  // 需要数量
  currentAmount: number;   // 当前进度
  description: string;     // 目标描述文本
}

/** 任务奖励 */
export interface QuestReward {
  gold?: number;
  crystal?: number;
  items?: Array<{ itemId: string; quantity: number }>;
  cards?: Array<{ cardId: string; holographic?: boolean }>;  // 卡牌奖励
  unlockNpc?: string | string[];  // 解锁NPC的ID（支持单个或多个）
  unlockStage?: string;    // 解锁关卡的ID
  unlockFeature?: string;  // 解锁功能（如 card-collection）
  affinityBonus?: Array<{ npcId: string; amount: number }>; // 增加NPC好感度
}

/** 任务类型 */
export type QuestType = 'main' | 'side' | 'daily';

/** 任务状态 */
export type QuestStatus = 'locked' | 'available' | 'inProgress' | 'completed';

/** 任务定义（JSON中的数据） */
export interface QuestDefinition {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  npcId: string;           // 关联NPC
  objectives: QuestObjective[];
  rewards: QuestReward;
  prerequisites: string[]; // 前置任务ID列表
  sortOrder: number;       // 排序权重
}

/** 运行时任务状态 */
export interface QuestState {
  id: string;
  status: QuestStatus;
  objectives: Array<{
    currentAmount: number;
  }>;
  completedAt?: number;    // 完成时间戳（用于日常任务重置判断）
}

/** 任务持久化数据 */
export interface QuestSaveData {
  questStates: Record<string, QuestState>;  // questId -> QuestState
  lastDailyReset: number;                    // 上次日常重置时间戳
  unlockedStages?: string[];                 // 已解锁关卡列表
}
