# 饱腹度系统故障排除指南

## 问题：在角色详情面板中看不到饱腹度

### 可能的原因

1. **项目未重新构建** - 代码更改后需要重新编译
2. **浏览器缓存** - 旧的 JavaScript 文件还在浏览器缓存中
3. **旧存档的角色** - 查看的是系统实现之前创建的角色

### 解决步骤

#### 步骤 1：重新构建项目

**方法 A：使用批处理文件（推荐）**
```bash
# 双击运行项目根目录下的 rebuild.bat 文件
rebuild.bat
```

**方法 B：手动构建**
```bash
# 在命令提示符（CMD）中运行
npm run build
```

#### 步骤 2：清除浏览器缓存

**Chrome/Edge:**
- 按 `Ctrl + Shift + R` 强制刷新
- 或者按 `Ctrl + Shift + Delete` 打开清除缓存对话框

**Firefox:**
- 按 `Ctrl + Shift + R` 强制刷新
- 或者按 `Ctrl + Shift + Delete` 打开清除缓存对话框

#### 步骤 3：验证饱腹度显示

**测试新角色：**
1. 打开游戏
2. 招募一个新角色
3. 打开角色面板查看该角色
4. 应该能看到饱腹度进度条（橙色，显示 100/100）

**测试旧角色：**
1. 如果查看的是旧存档中的角色
2. 系统应该自动为其添加默认饱腹度（100/100）
3. 如果还是看不到，尝试：
   - 保存游戏
   - 刷新页面
   - 重新加载存档

#### 步骤 4：清除存档重新开始（最后手段）

如果以上步骤都不起作用：

1. 打开浏览器开发者工具（F12）
2. 进入 Application/存储 标签
3. 找到 Local Storage
4. 删除游戏相关的存档数据
5. 刷新页面，重新开始游戏

### 验证饱腹度系统是否正常工作

#### 检查控制台日志

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 招募一个新角色
4. 应该看到类似以下的日志：
   ```
   Added default HungerComponent to character entity X (old save compatibility)
   ```

#### 检查角色数据

在浏览器控制台中运行以下代码：

```javascript
// 获取第一个角色的饱腹度组件
const world = window.gameWorld; // 假设游戏世界对象暴露为 window.gameWorld
const characters = world.getEntitiesWithComponent({ name: 'characterInfo' });
if (characters.length > 0) {
  const hunger = world.getComponent(characters[0], { name: 'hunger' });
  console.log('Hunger component:', hunger);
}
```

### 预期的饱腹度显示

饱腹度进度条应该：
- 位于经验值进度条之后
- 位于好感度显示之前（如果有）
- 使用橙色（#f39c12）
- 显示格式：`饱腹度 100 / 100`
- 进度条宽度反映当前饱腹度百分比

### 如果问题仍然存在

请检查以下内容：

1. **确认代码已正确实现：**
   - `src/game/components/CharacterComponents.ts` - HungerComponent 定义
   - `src/game/systems/CharacterRecruitmentSystem.ts` - 角色创建时添加 HungerComponent
   - `src/ui/components/CharacterPanel.ts` - UI 渲染饱腹度进度条
   - `src/ecs/SaveSystem.ts` - 旧存档兼容性处理

2. **运行测试验证：**
   ```bash
   npm test -- --run src/game/components/CharacterComponents.property.test.ts
   npm test -- --run src/ui/components/CharacterPanel.test.ts
   ```

3. **检查构建输出：**
   - 确认 `dist/` 目录中有最新的构建文件
   - 检查构建时间戳是否是最新的

### 联系支持

如果以上所有步骤都无法解决问题，请提供以下信息：

- 浏览器类型和版本
- 控制台错误日志（如果有）
- 是否是新角色还是旧角色
- 构建是否成功完成
- 浏览器缓存是否已清除

## 常见问题

### Q: 为什么旧角色没有饱腹度？
A: 旧角色应该会自动添加默认饱腹度（100/100）。如果没有，请尝试保存并重新加载游戏。

### Q: 新招募的角色有饱腹度吗？
A: 是的，所有新招募的角色都会自动拥有满饱腹度（100/100）。

### Q: 饱腹度会随时间减少吗？
A: 当前版本的饱腹度系统只是显示功能，不会自动减少。未来版本可能会添加饱腹度消耗机制。

### Q: 如何修改角色的饱腹度？
A: 当前版本没有提供修改饱腹度的 UI。这是为未来的食物系统预留的功能。

## 技术细节

### 饱腹度组件结构

```typescript
interface HungerComponent {
  type: 'hunger';
  current: number;  // 当前饱腹度 (0-100)
  maximum: number;  // 最大饱腹度 (100)
}
```

### 旧存档兼容性逻辑

SaveSystem 在加载存档时会：
1. 检查每个实体是否有 `characterInfo` 组件
2. 如果是角色实体但没有 `hunger` 组件
3. 自动添加默认的 HungerComponent (current: 100, maximum: 100)

### UI 渲染逻辑

CharacterPanel 在渲染角色详情时：
1. 获取角色的 HungerComponent
2. 如果组件存在，渲染饱腹度进度条
3. 如果组件不存在，跳过渲染（不显示进度条）

这意味着如果你看不到饱腹度进度条，说明该角色没有 HungerComponent。
