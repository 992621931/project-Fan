/**
 * Exploration Panel - Exploration and combat interface
 * Handles dungeon selection, party management, and combat display
 */

import { BaseUIComponent } from '../BaseUIComponent';
import { UIManager } from '../UIManager';
import { EventSystem } from '../../ecs/EventSystem';
import { Entity } from '../../ecs/Entity';
import { World } from '../../ecs/World';

export interface Dungeon {
  id: string;
  name: string;
  difficulty: number;
  description: string;
  requirements: string[];
  rewards: string[];
  energyCost: number;
}

export interface CombatState {
  isActive: boolean;
  currentTurn: number;
  playerParty: Entity[];
  enemies: any[];
  combatLog: string[];
}

export class ExplorationPanel extends BaseUIComponent {
  private world: World;
  private dungeonList!: HTMLDivElement;
  private partySelection!: HTMLDivElement;
  private combatArea!: HTMLDivElement;
  private selectedDungeon: Dungeon | null = null;
  private selectedParty: Entity[] = [];
  private combatState: CombatState = {
    isActive: false,
    currentTurn: 0,
    playerParty: [],
    enemies: [],
    combatLog: []
  };

  // Mock dungeon data
  private dungeons: Dungeon[] = [
    {
      id: 'forest_1',
      name: '新手森林',
      difficulty: 1,
      description: '适合新手冒险者的安全森林区域',
      requirements: ['等级 1+'],
      rewards: ['经验值', '基础材料', '少量金币'],
      energyCost: 10
    },
    {
      id: 'cave_1',
      name: '幽暗洞穴',
      difficulty: 3,
      description: '充满危险的地下洞穴',
      requirements: ['等级 5+', '至少2名角色'],
      rewards: ['稀有材料', '装备', '中等金币'],
      energyCost: 20
    },
    {
      id: 'ruins_1',
      name: '古代遗迹',
      difficulty: 5,
      description: '神秘的古代文明遗迹',
      requirements: ['等级 10+', '至少3名角色', '特殊钥匙'],
      rewards: ['传说装备', '大量经验', '珍贵材料'],
      energyCost: 30
    }
  ];

  constructor(uiManager: UIManager, eventSystem: EventSystem, world: World) {
    super('exploration-panel', uiManager, eventSystem);
    this.world = world;
  }

  protected createElement(): HTMLElement {
    const panel = this.createPanel('exploration-panel');
    panel.style.cssText = `
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 1000px;
      height: 700px;
      display: flex;
      flex-direction: column;
    `;

    // Initialize the div elements here
    this.dungeonList = this.createElement_div();
    this.partySelection = this.createElement_div();
    this.combatArea = this.createElement_div();

    // Header
    const header = this.createElement_div('panel-header', `
      <h2>🗺️ 探险与战斗</h2>
      <button class="ui-button close-btn">×</button>
    `);
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    `;

    const closeBtn = header.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => this.hide());

    // Main content
    const mainContent = this.createElement_div('main-content');
    mainContent.style.cssText = `
      display: flex;
      flex: 1;
      gap: 16px;
      min-height: 0;
    `;

    // Left side - Dungeon list
    const leftSide = this.createElement_div('left-side');
    leftSide.style.cssText = `
      width: 300px;
      display: flex;
      flex-direction: column;
    `;

    const dungeonTitle = this.createElement_h3('', '选择地下城');
    this.dungeonList.className = 'dungeon-list';
    this.dungeonList.style.cssText = `
      flex: 1;
      overflow-y: auto;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 16px;
    `;

    leftSide.appendChild(dungeonTitle);
    leftSide.appendChild(this.dungeonList);

    // Center - Party selection
    const centerSide = this.createElement_div('center-side');
    centerSide.style.cssText = `
      width: 300px;
      display: flex;
      flex-direction: column;
    `;

    const partyTitle = this.createElement_h3('', '选择队伍');
    this.partySelection.className = 'party-selection';
    this.partySelection.style.cssText = `
      flex: 1;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 16px;
    `;

    centerSide.appendChild(partyTitle);
    centerSide.appendChild(this.partySelection);

    // Right side - Combat area
    const rightSide = this.createElement_div('right-side');
    rightSide.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
    `;

    const combatTitle = this.createElement_h3('', '战斗区域');
    this.combatArea.className = 'combat-area';
    this.combatArea.style.cssText = `
      flex: 1;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
    `;

    rightSide.appendChild(combatTitle);
    rightSide.appendChild(this.combatArea);

    // Assemble panel
    mainContent.appendChild(leftSide);
    mainContent.appendChild(centerSide);
    mainContent.appendChild(rightSide);

    panel.appendChild(header);
    panel.appendChild(mainContent);

    return panel;
  }

  public render(): void {
    this.renderDungeonList();
    this.renderPartySelection();
    this.renderCombatArea();
  }

  private renderDungeonList(): void {
    this.dungeonList.innerHTML = '';

    this.dungeons.forEach(dungeon => {
      const dungeonItem = this.createElement_div('dungeon-item');
      dungeonItem.style.cssText = `
        padding: 12px;
        margin-bottom: 12px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      `;

      const difficultyColor = this.getDifficultyColor(dungeon.difficulty);
      
      dungeonItem.innerHTML = `
        <div class="dungeon-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="margin: 0; color: ${difficultyColor};">${dungeon.name}</h4>
          <span class="difficulty" style="background: ${difficultyColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
            难度 ${dungeon.difficulty}
          </span>
        </div>
        <p style="margin: 8px 0; font-size: 12px; color: #b0b0b0; line-height: 1.4;">
          ${dungeon.description}
        </p>
        <div class="requirements" style="margin: 8px 0;">
          <div style="font-size: 11px; color: #f39c12; margin-bottom: 4px;">需求条件:</div>
          ${dungeon.requirements.map(req => `
            <div style="font-size: 10px; color: #b0b0b0;">• ${req}</div>
          `).join('')}
        </div>
        <div class="rewards" style="margin: 8px 0;">
          <div style="font-size: 11px; color: #2ecc71; margin-bottom: 4px;">奖励:</div>
          ${dungeon.rewards.map(reward => `
            <div style="font-size: 10px; color: #b0b0b0;">• ${reward}</div>
          `).join('')}
        </div>
        <div class="energy-cost" style="font-size: 11px; color: #e74c3c;">
          消耗体力: ${dungeon.energyCost}
        </div>
      `;

      // Add hover effects
      dungeonItem.addEventListener('mouseenter', () => {
        dungeonItem.style.backgroundColor = 'rgba(255,255,255,0.05)';
        dungeonItem.style.borderColor = 'rgba(255,255,255,0.3)';
      });

      dungeonItem.addEventListener('mouseleave', () => {
        dungeonItem.style.backgroundColor = 'transparent';
        dungeonItem.style.borderColor = 'rgba(255,255,255,0.1)';
      });

      // Select dungeon on click
      dungeonItem.addEventListener('click', () => {
        // Remove previous selection
        this.dungeonList.querySelectorAll('.dungeon-item').forEach(el => {
          el.classList.remove('selected');
        });
        
        // Add selection to current item
        dungeonItem.classList.add('selected');
        dungeonItem.style.borderColor = this.uiManager.getTheme().colors.primary;
        
        this.selectedDungeon = dungeon;
        this.renderPartySelection();
      });

      this.dungeonList.appendChild(dungeonItem);
    });
  }

  private renderPartySelection(): void {
    this.partySelection.innerHTML = '';

    if (!this.selectedDungeon) {
      this.partySelection.appendChild(
        this.createElement_div('empty-state', '请先选择一个地下城')
      );
      return;
    }

    // Available characters
    const characters = this.world.getEntitiesWithComponent('characterInfo');
    
    const availableTitle = this.createElement_h4('', '可用角色');
    this.partySelection.appendChild(availableTitle);

    const characterList = this.createElement_div('character-list');
    characterList.style.cssText = `
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 16px;
    `;

    characters.forEach(character => {
      const characterItem = this.createCharacterItem(character, false);
      characterList.appendChild(characterItem);
    });

    this.partySelection.appendChild(characterList);

    // Selected party
    const partyTitle = this.createElement_h4('', `选中队伍 (${this.selectedParty.length}/4)`);
    this.partySelection.appendChild(partyTitle);

    const partyList = this.createElement_div('party-list');
    partyList.style.cssText = `
      min-height: 100px;
      border: 1px dashed rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 8px;
      margin-bottom: 16px;
    `;

    if (this.selectedParty.length === 0) {
      partyList.appendChild(
        this.createElement_div('empty-state', '点击角色添加到队伍')
      );
    } else {
      this.selectedParty.forEach(character => {
        const characterItem = this.createCharacterItem(character, true);
        partyList.appendChild(characterItem);
      });
    }

    this.partySelection.appendChild(partyList);

    // Start exploration button
    const startBtn = this.createButton('开始探险', () => {
      this.startExploration();
    });
    
    startBtn.disabled = this.selectedParty.length === 0;
    if (startBtn.disabled) {
      startBtn.style.opacity = '0.5';
    }

    this.partySelection.appendChild(startBtn);
  }

  private createCharacterItem(character: Entity, isInParty: boolean): HTMLDivElement {
    const info = this.world.getComponent(character, 'characterInfo');
    const level = this.world.getComponent(character, 'level');
    const health = this.world.getComponent(character, 'health');

    if (!info) return this.createElement_div();

    const item = this.createElement_div('character-item');
    item.style.cssText = `
      padding: 8px;
      margin-bottom: 4px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const rarityClass = this.formatRarity(info.rarity);
    
    item.innerHTML = `
      <div class="character-info">
        <div class="${rarityClass}" style="font-size: 12px; font-weight: bold;">
          ${info.title} ${info.name}
        </div>
        <div style="font-size: 10px; color: #b0b0b0;">
          Lv.${level?.level || 1} | HP: ${Math.floor(health?.current || 0)}/${Math.floor(health?.maximum || 0)}
        </div>
      </div>
      <div class="action-icon" style="font-size: 16px;">
        ${isInParty ? '❌' : '➕'}
      </div>
    `;

    // Add click handler
    item.addEventListener('click', () => {
      if (isInParty) {
        this.removeFromParty(character);
      } else {
        this.addToParty(character);
      }
    });

    // Add hover effects
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgba(255,255,255,0.05)';
    });

    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });

    return item;
  }

  private addToParty(character: Entity): void {
    if (this.selectedParty.length >= 4) {
      this.showNotification('队伍已满（最多4人）', 'warning');
      return;
    }

    if (!this.selectedParty.includes(character)) {
      this.selectedParty.push(character);
      this.renderPartySelection();
    }
  }

  private removeFromParty(character: Entity): void {
    const index = this.selectedParty.indexOf(character);
    if (index > -1) {
      this.selectedParty.splice(index, 1);
      this.renderPartySelection();
    }
  }

  private renderCombatArea(): void {
    this.combatArea.innerHTML = '';

    if (!this.combatState.isActive) {
      this.combatArea.appendChild(
        this.createElement_div('empty-state', '选择地下城和队伍后开始探险')
      );
      return;
    }

    // Combat UI
    const combatUI = this.createElement_div('combat-ui');
    combatUI.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
    `;

    // Battle field
    const battlefield = this.createElement_div('battlefield');
    battlefield.style.cssText = `
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      margin-bottom: 16px;
    `;

    // Player party side
    const playerSide = this.createElement_div('player-side');
    playerSide.innerHTML = `
      <h4>我方队伍</h4>
      <div class="party-members">
        ${this.combatState.playerParty.map((character, index) => {
          const info = this.world.getComponent(character, 'characterInfo');
          const health = this.world.getComponent(character, 'health');
          return `
            <div class="combat-character" style="margin-bottom: 8px; padding: 8px; background: rgba(46, 204, 113, 0.2); border-radius: 4px;">
              <div style="font-size: 12px; font-weight: bold;">${info?.name || 'Unknown'}</div>
              <div class="health-bar" style="width: 100px; height: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden;">
                <div style="width: ${((health?.current || 0) / (health?.maximum || 1)) * 100}%; height: 100%; background: #e74c3c;"></div>
              </div>
              <div style="font-size: 10px;">${Math.floor(health?.current || 0)}/${Math.floor(health?.maximum || 0)} HP</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Enemy side
    const enemySide = this.createElement_div('enemy-side');
    enemySide.innerHTML = `
      <h4>敌方</h4>
      <div class="enemies">
        ${this.combatState.enemies.map((enemy, index) => `
          <div class="combat-enemy" style="margin-bottom: 8px; padding: 8px; background: rgba(231, 76, 60, 0.2); border-radius: 4px;">
            <div style="font-size: 12px; font-weight: bold;">${enemy.name}</div>
            <div class="health-bar" style="width: 100px; height: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden;">
              <div style="width: ${(enemy.health / enemy.maxHealth) * 100}%; height: 100%; background: #e74c3c;"></div>
            </div>
            <div style="font-size: 10px;">${enemy.health}/${enemy.maxHealth} HP</div>
          </div>
        `).join('')}
      </div>
    `;

    battlefield.appendChild(playerSide);
    battlefield.appendChild(enemySide);

    // Combat log
    const combatLog = this.createElement_div('combat-log');
    combatLog.style.cssText = `
      height: 150px;
      overflow-y: auto;
      background: rgba(0,0,0,0.3);
      border-radius: 8px;
      padding: 12px;
      font-family: monospace;
      font-size: 12px;
      line-height: 1.4;
    `;

    combatLog.innerHTML = this.combatState.combatLog.map(log => `
      <div style="margin-bottom: 4px;">${log}</div>
    `).join('');

    // Auto-scroll to bottom
    combatLog.scrollTop = combatLog.scrollHeight;

    // Combat actions
    const combatActions = this.createElement_div('combat-actions');
    combatActions.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 16px;
    `;

    const attackBtn = this.createButton('攻击', () => {
      this.performCombatAction('attack');
    });

    const defendBtn = this.createButton('防御', () => {
      this.performCombatAction('defend');
    });

    const skillBtn = this.createButton('技能', () => {
      this.performCombatAction('skill');
    });

    const runBtn = this.createButton('逃跑', () => {
      this.performCombatAction('run');
    });

    combatActions.appendChild(attackBtn);
    combatActions.appendChild(defendBtn);
    combatActions.appendChild(skillBtn);
    combatActions.appendChild(runBtn);

    // Assemble combat UI
    combatUI.appendChild(battlefield);
    combatUI.appendChild(combatLog);
    combatUI.appendChild(combatActions);

    this.combatArea.appendChild(combatUI);
  }

  private getDifficultyColor(difficulty: number): string {
    if (difficulty <= 2) return '#2ecc71';
    if (difficulty <= 4) return '#f39c12';
    return '#e74c3c';
  }

  private startExploration(): void {
    if (!this.selectedDungeon || this.selectedParty.length === 0) {
      this.showNotification('请选择地下城和队伍', 'warning');
      return;
    }

    // Initialize combat state
    this.combatState = {
      isActive: true,
      currentTurn: 1,
      playerParty: [...this.selectedParty],
      enemies: this.generateEnemies(this.selectedDungeon),
      combatLog: [
        `进入 ${this.selectedDungeon.name}...`,
        `遭遇敌人！战斗开始！`,
        `回合 1 开始`
      ]
    };

    this.eventSystem.emit('exploration:started', {
      dungeon: this.selectedDungeon,
      party: this.selectedParty
    });

    this.renderCombatArea();
    this.showNotification(`开始探险：${this.selectedDungeon.name}`, 'success');
  }

  private generateEnemies(dungeon: Dungeon): any[] {
    // Mock enemy generation based on dungeon difficulty
    const enemyCount = Math.min(dungeon.difficulty, 4);
    const enemies = [];

    for (let i = 0; i < enemyCount; i++) {
      enemies.push({
        name: `敌人 ${i + 1}`,
        health: 50 + dungeon.difficulty * 20,
        maxHealth: 50 + dungeon.difficulty * 20,
        attack: 10 + dungeon.difficulty * 5,
        defense: 5 + dungeon.difficulty * 2
      });
    }

    return enemies;
  }

  private performCombatAction(action: string): void {
    if (!this.combatState.isActive) return;

    let logMessage = '';

    switch (action) {
      case 'attack':
        logMessage = `队伍发动攻击！`;
        // Simulate damage to enemies
        this.combatState.enemies.forEach(enemy => {
          const damage = Math.floor(Math.random() * 20) + 10;
          enemy.health = Math.max(0, enemy.health - damage);
          logMessage += ` 对 ${enemy.name} 造成 ${damage} 点伤害！`;
        });
        break;
      case 'defend':
        logMessage = `队伍采取防御姿态！`;
        break;
      case 'skill':
        logMessage = `队伍使用技能攻击！`;
        break;
      case 'run':
        logMessage = `队伍尝试逃跑...`;
        if (Math.random() > 0.5) {
          logMessage += ` 逃跑成功！`;
          this.endCombat(false);
          return;
        } else {
          logMessage += ` 逃跑失败！`;
        }
        break;
    }

    this.combatState.combatLog.push(logMessage);

    // Check if all enemies are defeated
    if (this.combatState.enemies.every(enemy => enemy.health <= 0)) {
      this.combatState.combatLog.push('所有敌人被击败！战斗胜利！');
      this.endCombat(true);
      return;
    }

    // Enemy turn
    this.combatState.combatLog.push('敌人回合...');
    // Simulate enemy actions
    this.combatState.enemies.forEach(enemy => {
      if (enemy.health > 0) {
        const damage = Math.floor(Math.random() * 15) + 5;
        this.combatState.combatLog.push(`${enemy.name} 攻击队伍，造成 ${damage} 点伤害！`);
      }
    });

    this.combatState.currentTurn++;
    this.combatState.combatLog.push(`回合 ${this.combatState.currentTurn} 开始`);

    this.renderCombatArea();
  }

  private endCombat(victory: boolean): void {
    this.combatState.isActive = false;

    if (victory) {
      this.combatState.combatLog.push('探险成功！获得奖励！');
      this.eventSystem.emit('exploration:victory', {
        dungeon: this.selectedDungeon,
        party: this.selectedParty
      });
      this.showNotification('探险胜利！', 'success');
    } else {
      this.combatState.combatLog.push('探险结束。');
      this.eventSystem.emit('exploration:ended', {
        dungeon: this.selectedDungeon,
        party: this.selectedParty
      });
    }

    // Reset selections
    this.selectedDungeon = null;
    this.selectedParty = [];

    setTimeout(() => {
      this.render();
    }, 2000);
  }

  protected setupEventListeners(): void {
    this.eventSystem.on('character:recruited', () => this.render());
    this.eventSystem.on('character:updated', () => this.render());
  }
}