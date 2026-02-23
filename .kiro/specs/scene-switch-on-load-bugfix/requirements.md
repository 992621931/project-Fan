# 需求文档

## 简介

修复存档加载后场景被强制切换到村庄广场的 Bug。当前 `loadFromSlot` 方法在正确恢复了存档中的 `currentScene` 和 `currentStage` 后，又无条件地将它们覆写为 `village` / `square`，导致玩家在非村庄关卡（如草原、森林、洞穴）保存的位置丢失。同时，自动保存功能仅在村庄关卡生效，导致在战斗关卡中的黎明自动存档静默失败。

## 术语表

- **GameUI**: 游戏主 UI 管理类，负责场景切换、存档加载、UI 状态管理
- **SaveSystem**: ECS 存档系统，负责序列化/反序列化 World 数据
- **Stage（关卡）**: 游戏的大区域，包括 village（村庄）、grassland（草原）、forest（森林）、cave（洞穴）
- **Scene（场景）**: 关卡内的具体场景，如村庄中的 square（广场）、tavern（酒馆）等
- **Combat_Stage（战斗关卡）**: grassland、forest、cave 等需要战斗的关卡
- **Non_Combat_Stage（非战斗关卡）**: village 等无战斗的关卡
- **Auto_Save（自动保存）**: 在黎明时刻自动触发的存档功能
- **loadFromSlot**: GameUI 中从指定存档槽加载游戏状态的方法
- **saveToSlot**: GameUI 中将游戏状态保存到指定存档槽的方法
- **loadStageDefaultScene**: GameUI 中根据当前关卡加载默认场景的方法

## 需求

### 需求 1：加载存档时恢复玩家实际保存位置

**用户故事：** 作为玩家，我希望加载存档后回到我保存时所在的关卡和场景，以便继续之前的游戏进度。

#### 验收标准

1. WHEN 玩家加载一个存档，THEN GameUI SHALL 将 `currentStage` 和 `currentScene` 恢复为存档中保存的值，而非强制覆写为 `village` / `square`
2. WHEN 存档中保存的关卡为战斗关卡（grassland、forest、cave），THEN GameUI SHALL 正确加载该战斗关卡的背景图和探索面板
3. WHEN 存档中保存的关卡为村庄，THEN GameUI SHALL 正确加载村庄中对应的场景（如广场、酒馆、市场等）
4. WHEN 存档加载完成后，THEN GameUI SHALL 调用 `updateStageButtonStyles` 和 `updateSceneButtons` 以确保 UI 按钮状态与恢复的关卡一致

### 需求 2：自动保存支持所有关卡

**用户故事：** 作为玩家，我希望在任何关卡中都能触发自动保存，以便在意外退出后不丢失在战斗关卡中的进度。

#### 验收标准

1. WHEN 黎明自动保存触发且玩家处于战斗关卡时，THEN saveToSlot SHALL 成功保存当前游戏状态（包括 `currentStage` 和 `currentScene`）
2. WHEN 黎明自动保存触发且玩家处于村庄关卡时，THEN saveToSlot SHALL 继续正常保存游戏状态
3. WHILE 玩家处于战斗关卡时手动保存，THEN saveToSlot SHALL 仍然显示"只能在村庄中保存游戏"的提示并阻止手动保存
4. WHEN 自动保存在战斗关卡中成功执行后，THEN saveToSlot SHALL 在控制台输出自动保存完成的日志

### 需求 3：加载存档后 UI 正确更新

**用户故事：** 作为玩家，我希望加载存档后看到的界面与保存时一致，以便无缝继续游戏。

#### 验收标准

1. WHEN 加载的存档关卡为战斗关卡，THEN GameUI SHALL 隐藏村庄场景按钮并显示战斗关卡对应的 UI 元素
2. WHEN 加载的存档关卡为村庄，THEN GameUI SHALL 显示村庄场景按钮并加载对应场景内容
3. WHEN 加载存档后关卡发生切换，THEN GameUI SHALL 更新关卡选择按钮的高亮状态以反映当前关卡
