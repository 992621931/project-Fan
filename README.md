# 代号：饭 (Codename Rice Game)

一款基于 TypeScript 和 ECS 架构的幻想题材异世界休闲模拟经营游戏。

## 游戏特色

- 🎭 **角色收集养成**: 招募不同稀有度的冒险者，培养他们的能力和好感度
- ⚔️ **探索与战斗**: 组建小队探索地下城，获取战利品和经验
- 🔨 **制作系统**: 制作装备、烹饪美食、调制药水
- 🏪 **商店经营**: 经营自己的商店，销售制作的物品获取收益
- 🌱 **种植系统**: 种植作物获取制作材料
- 📚 **图鉴收集**: 收集各种物品和角色的图鉴
- 💾 **数据持久化**: 自动保存游戏进度

## 技术栈

- **TypeScript**: 类型安全的 JavaScript 超集
- **Webpack**: 模块打包和构建工具
- **ECS 架构**: Entity-Component-System 游戏架构
- **Canvas API**: 2D 图形渲染
- **Vitest**: 现代化测试框架
- **ESLint + Prettier**: 代码质量和格式化工具
- **GitHub Actions**: 自动化部署到 GitHub Pages

## 开发环境设置

### 前置要求

- Node.js 18+ 
- npm 或 yarn

### 安装依赖

\`\`\`bash
npm install
\`\`\`

### 开发命令

\`\`\`bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm run test

# 代码检查
npm run lint

# 代码格式化
npm run format

# 类型检查
npm run type-check
\`\`\`

## 项目结构

\`\`\`
src/
├── components/     # ECS 组件定义
├── systems/        # ECS 系统实现
├── entities/       # 实体工厂和管理
├── types/          # TypeScript 类型定义
├── utils/          # 工具函数
├── config/         # 游戏配置文件
├── styles/         # CSS 样式文件
├── assets/         # 静态资源
└── index.ts        # 应用入口点
\`\`\`

## 部署

项目配置了 GitHub Actions 自动部署，推送到 main 分支时会自动构建并部署到 GitHub Pages。

## 开发规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 和 Prettier 配置
- 编写单元测试和属性测试
- 使用语义化的 Git 提交信息

## 许可证

MIT License