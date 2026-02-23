// 调试饱腹度奖励的脚本
// 在浏览器控制台中运行此脚本

console.log('=== 饱腹度奖励调试 ===');

// 获取游戏世界实例
const world = window.gameWorld || window.world;

if (!world) {
  console.error('找不到游戏世界实例！请确保游戏已加载。');
} else {
  console.log('✓ 找到游戏世界实例');
  
  // 获取招募系统
  const recruitmentSystem = world.getSystem('CharacterRecruitmentSystem');
  
  if (!recruitmentSystem) {
    console.error('找不到招募系统！');
  } else {
    console.log('✓ 找到招募系统');
    
    // 检查 generateCharacter 方法
    const generateCharacterCode = recruitmentSystem.generateCharacter.toString();
    
    if (generateCharacterCode.includes('hungerBonus') || generateCharacterCode.includes('Math.random() * 21')) {
      console.log('✓ generateCharacter 方法包含饱腹度奖励代码');
    } else {
      console.error('✗ generateCharacter 方法不包含饱腹度奖励代码！');
      console.log('这意味着代码没有被正确编译或加载。');
    }
    
    // 尝试招募一个角色并检查饱腹度
    console.log('\n尝试招募一个测试角色...');
    
    const playerEntity = world.entityManager.getEntitiesByComponent('player')[0];
    if (!playerEntity) {
      console.error('找不到玩家实体！');
    } else {
      const playerId = playerEntity.id;
      
      // 确保有足够的金币
      const currency = world.componentManager.getComponent(playerId, 'currency');
      if (currency && currency.gold < 1000) {
        currency.gold = 10000;
        console.log('已添加金币');
      }
      
      // 招募角色
      const result = recruitmentSystem.recruitWithGold(playerId);
      
      if (result.success && result.character) {
        const charId = result.character;
        const hunger = world.componentManager.getComponent(charId, 'hunger');
        const info = world.componentManager.getComponent(charId, 'characterInfo');
        
        console.log(`\n招募成功: ${info.title} ${info.name}`);
        console.log(`饱腹度: ${hunger.current}/${hunger.maximum}`);
        
        if (hunger.current >= 30 && hunger.current <= 50) {
          console.log('✓ 饱腹度奖励正常工作！');
        } else if (hunger.current === 0) {
          console.error('✗ 饱腹度为 0，奖励没有生效！');
          console.log('可能的原因：');
          console.log('1. 代码没有被正确编译');
          console.log('2. 浏览器缓存了旧版本');
          console.log('3. 存在其他系统在重置饱腹度');
        } else {
          console.warn(`⚠ 饱腹度值异常: ${hunger.current}`);
        }
      } else {
        console.error('招募失败！', result);
      }
    }
  }
}

console.log('\n=== 调试完成 ===');
