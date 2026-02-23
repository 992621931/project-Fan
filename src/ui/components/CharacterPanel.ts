/**
 * Character Panel - Character management interface
 * Displays character list, details, and management options
 */

import { BaseUIComponent } from '../BaseUIComponent';
import { UIManager } from '../UIManager';
import { EventSystem, createEvent } from '../../ecs/EventSystem';
import { EntityId } from '../../ecs/Entity';
import { World } from '../../ecs/World';
import { 
  CharacterInfoComponent, 
  CharacterInfoComponentType,
  AttributeComponent, 
  AttributeComponentType,
  DerivedStatsComponent,
  DerivedStatsComponentType,
  HealthComponent,
  HealthComponentType,
  ManaComponent,
  ManaComponentType,
  HungerComponent,
  HungerComponentType,
  LevelComponent,
  LevelComponentType,
  JobComponent,
  JobComponentType,
  AffinityComponent,
  AffinityComponentType
} from '../../game/components/CharacterComponents';
import { RarityType } from '../../game/types/RarityTypes';
import { JobType } from '../../game/types/GameTypes';
import { EquipmentSlotUI } from './EquipmentSlotUI';
import { ItemSystem } from '../../game/systems/ItemSystem';
import { DialogueSystem } from '../../game/systems/DialogueSystem';

export class CharacterPanel extends BaseUIComponent {
  private world: World;
  private selectedCharacter: EntityId | null = null;
  private characterList!: HTMLDivElement;
  private characterDetails!: HTMLDivElement;
  private equipmentSlotUI: EquipmentSlotUI | null = null;
  private itemSystem: ItemSystem;

  constructor(uiManager: UIManager, eventSystem: EventSystem, world: World) {
    super('character-panel', uiManager, eventSystem);
    this.world = world;
    this.itemSystem = new ItemSystem(world);
  }

  protected createElement(): HTMLElement {
    const panel = this.createPanel('character-panel');
    panel.style.cssText = `
      top: 20px;
      left: 20px;
      width: 800px;
      height: 600px;
      display: flex;
      flex-direction: row;
      gap: 16px;
    `;

    // Initialize the div elements here
    this.characterList = this.createElement_div();
    this.characterDetails = this.createElement_div();

    // Header
    const header = this.createElement_div('panel-header', `
      <h2>角色管理</h2>
      <button class="ui-button close-btn">×</button>
    `);
    header.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 50px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 16px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      margin: -16px -16px 16px -16px;
    `;

    const closeBtn = header.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => this.hide());

    // Character list (left side)
    this.characterList.className = 'character-list';
    this.characterList.style.cssText = `
      flex: 1;
      max-height: 500px;
      overflow-y: auto;
      border-right: 1px solid rgba(255,255,255,0.1);
      padding-right: 16px;
      margin-top: 50px;
    `;

    // Character details (right side)
    this.characterDetails.className = 'character-details';
    this.characterDetails.style.cssText = `
      flex: 1;
      max-height: 500px;
      overflow-y: auto;
      padding-left: 16px;
      margin-top: 50px;
    `;

    panel.appendChild(header);
    panel.appendChild(this.characterList);
    panel.appendChild(this.characterDetails);

    return panel;
  }

  public render(): void {
    this.renderCharacterList();
    this.renderCharacterDetails();
  }

  private renderCharacterList(): void {
    this.characterList.innerHTML = '';

    const characters = this.world.getEntitiesWithComponent(CharacterInfoComponentType);
    
    if (characters.length === 0) {
      this.characterList.appendChild(
        this.createElement_div('empty-state', '暂无角色，请先招募角色')
      );
      return;
    }

    characters.forEach(characterId => {
      const characterItem = this.createCharacterListItem(characterId);
      this.characterList.appendChild(characterItem);
    });
  }

  private createCharacterListItem(characterId: EntityId): HTMLDivElement {
    const info = this.world.getComponent<CharacterInfoComponent>(characterId, CharacterInfoComponentType);
    const level = this.world.getComponent<LevelComponent>(characterId, LevelComponentType);
    const health = this.world.getComponent<HealthComponent>(characterId, HealthComponentType);
    const job = this.world.getComponent<JobComponent>(characterId, JobComponentType);

    if (!info) return this.createElement_div();

    const item = this.createElement_div('character-item');
    item.style.cssText = `
      padding: 12px;
      margin-bottom: 8px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    const rarityClass = this.formatRarity(info.rarity);
    
    item.innerHTML = `
      <div class="character-header">
        <span class="${rarityClass} character-name">${info.title} ${info.name}</span>
        <span class="character-level">Lv.${level?.level || 1}</span>
      </div>
      <div class="character-info">
        <span class="character-job">${this.getJobName(job?.currentJob || JobType.Warrior)}</span>
        <span class="character-health">${Math.floor(health?.current || 0)}/${Math.floor(health?.maximum || 0)} HP</span>
      </div>
      <div class="character-status ${info.status === 'available' ? 'text-success' : 'text-warning'}">
        ${this.getStatusText(info.status)}
      </div>
    `;

    // Add hover effects
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgba(255,255,255,0.05)';
      item.style.borderColor = 'rgba(255,255,255,0.3)';
    });

    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
      item.style.borderColor = 'rgba(255,255,255,0.1)';
    });

    // Select character on click
    item.addEventListener('click', () => {
      // Remove previous selection
      this.characterList.querySelectorAll('.character-item').forEach(el => {
        el.classList.remove('selected');
      });
      
      // Add selection to current item
      item.classList.add('selected');
      item.style.borderColor = this.uiManager.getTheme().colors.primary;
      
      this.selectedCharacter = characterId;
      this.renderCharacterDetails();
    });

    return item;
  }

  private renderCharacterDetails(): void {
    this.characterDetails.innerHTML = '';

    if (!this.selectedCharacter) {
      this.characterDetails.appendChild(
        this.createElement_div('empty-state', '请选择一个角色查看详情')
      );
      return;
    }

    const character = this.selectedCharacter;
    const info = this.world.getComponent<CharacterInfoComponent>(character, CharacterInfoComponentType);
    const attributes = this.world.getComponent<AttributeComponent>(character, AttributeComponentType);
    const derivedStats = this.world.getComponent<DerivedStatsComponent>(character, DerivedStatsComponentType);
    const health = this.world.getComponent<HealthComponent>(character, HealthComponentType);
    const mana = this.world.getComponent<ManaComponent>(character, ManaComponentType);
    const hunger = this.world.getComponent<HungerComponent>(character, HungerComponentType);
    const level = this.world.getComponent<LevelComponent>(character, LevelComponentType);
    const job = this.world.getComponent<JobComponent>(character, JobComponentType);

    if (!info) return;

    // Character header
    const header = this.createElement_div('character-detail-header');
    const rarityClass = this.formatRarity(info.rarity);
    header.innerHTML = `
      <h3 class="${rarityClass}">${info.title} ${info.name}</h3>
      <div class="character-basic-info">
        <span>等级: ${level?.level || 1}</span>
        <span>职业: ${this.getJobName(job?.currentJob || JobType.Warrior)}</span>
        <span>稀有度: ${this.getRarityName(info.rarity)}</span>
      </div>
    `;

    // Health and Mana bars
    const statusBars = this.createElement_div('status-bars');
    statusBars.innerHTML = `
      <div class="status-bar">
        <label>生命值</label>
        <div class="bar-container">
          <div class="bar health-bar" style="width: ${((health?.current || 0) / (health?.maximum || 1)) * 100}%"></div>
          <span class="bar-text">${Math.floor(health?.current || 0)} / ${Math.floor(health?.maximum || 0)}</span>
        </div>
      </div>
      <div class="status-bar">
        <label>魔法值</label>
        <div class="bar-container">
          <div class="bar mana-bar" style="width: ${((mana?.current || 0) / (mana?.maximum || 1)) * 100}%"></div>
          <span class="bar-text">${Math.floor(mana?.current || 0)} / ${Math.floor(mana?.maximum || 0)}</span>
        </div>
      </div>
    `;

    // Experience bar
    if (level) {
      const expBar = this.createElement_div('exp-bar');
      const expPercent = (level.experience / level.experienceToNext) * 100;
      expBar.innerHTML = `
        <label>经验值</label>
        <div class="bar-container">
          <div class="bar exp-bar" style="width: ${expPercent}%"></div>
          <span class="bar-text">${level.experience} / ${level.experienceToNext}</span>
        </div>
      `;
      statusBars.appendChild(expBar);
    }

    // Hunger bar
    if (hunger) {
      const hungerBar = this.createElement_div('hunger-bar');
      const hungerPercent = (hunger.current / hunger.maximum) * 100;
      hungerBar.innerHTML = `
        <label>饱腹度</label>
        <div class="bar-container">
          <div class="bar hunger-bar" style="width: ${hungerPercent}%"></div>
          <span class="bar-text">${Math.floor(hunger.current)} / ${Math.floor(hunger.maximum)}</span>
        </div>
      `;
      statusBars.appendChild(hungerBar);
    }

    // Affinity bar
    const affinity = this.world.getComponent<AffinityComponent>(character, AffinityComponentType);
    if (affinity) {
      const affinityBar = this.createElement_div('affinity-bar');
      // Affinity ranges from -100 to 100, convert to 0-100 for display
      const affinityPercent = ((affinity.level + 100) / 200) * 100;
      const affinityColor = affinity.level >= 0 ? '#2ecc71' : '#e74c3c';
      affinityBar.innerHTML = `
        <label>好感度</label>
        <div class="bar-container">
          <div class="bar affinity-bar" style="width: ${affinityPercent}%; background: ${affinityColor};"></div>
          <span class="bar-text">${affinity.level} / 100</span>
        </div>
      `;
      statusBars.appendChild(affinityBar);
    }

    // Attributes section
    const attributesSection = this.createElement_div('attributes-section');
    attributesSection.innerHTML = `
      <h4>基础属性</h4>
      <div class="attributes-grid">
        <div class="attribute-item">
          <span class="attribute-name">力量</span>
          <span class="attribute-value">${attributes?.strength || 0}</span>
        </div>
        <div class="attribute-item">
          <span class="attribute-name">敏捷</span>
          <span class="attribute-value">${attributes?.agility || 0}</span>
        </div>
        <div class="attribute-item">
          <span class="attribute-name">智慧</span>
          <span class="attribute-value">${attributes?.wisdom || 0}</span>
        </div>
        <div class="attribute-item">
          <span class="attribute-name">技巧</span>
          <span class="attribute-value">${attributes?.technique || 0}</span>
        </div>
      </div>
    `;

    // Derived stats section
    const derivedSection = this.createElement_div('derived-section');
    derivedSection.innerHTML = `
      <h4>战斗属性</h4>
      <div class="derived-stats-grid">
        <div class="stat-item">
          <span class="stat-name">攻击力</span>
          <span class="stat-value">${derivedStats?.attack || 0}</span>
        </div>
        <div class="stat-item">
          <span class="stat-name">防御力</span>
          <span class="stat-value">${derivedStats?.defense || 0}</span>
        </div>
        <div class="stat-item">
          <span class="stat-name">暴击率</span>
          <span class="stat-value">${((derivedStats?.critRate || 0) * 100).toFixed(1)}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-name">闪避率</span>
          <span class="stat-value">${((derivedStats?.dodgeRate || 0) * 100).toFixed(1)}%</span>
        </div>
      </div>
    `;

    // Action buttons
    const actions = this.createElement_div('character-actions');
    
    // Check if character has affinity tracking and dialogues for Talk button
    const hasAffinity = this.world.hasComponent(character, AffinityComponentType);
    const dialogueSystem = this.world.getSystem<DialogueSystem>('DialogueSystem');
    const hasDialogues = dialogueSystem ? dialogueSystem.hasDialogues(character) : false;
    const shouldShowTalkButton = hasAffinity && hasDialogues;
    
    actions.innerHTML = `
      <button class="ui-button level-up-btn">升级</button>
      <button class="ui-button job-change-btn">转职</button>
      <button class="ui-button equipment-btn">装备</button>
      <button class="ui-button skills-btn">技能</button>
      ${shouldShowTalkButton ? '<button class="ui-button talk-btn">对话</button>' : ''}
    `;

    // Add event listeners for action buttons
    const levelUpBtn = actions.querySelector('.level-up-btn') as HTMLButtonElement;
    const jobChangeBtn = actions.querySelector('.job-change-btn') as HTMLButtonElement;
    const equipmentBtn = actions.querySelector('.equipment-btn') as HTMLButtonElement;
    const skillsBtn = actions.querySelector('.skills-btn') as HTMLButtonElement;
    const talkBtn = actions.querySelector('.talk-btn') as HTMLButtonElement | null;

    levelUpBtn.addEventListener('click', () => this.handleLevelUp());
    jobChangeBtn.addEventListener('click', () => this.handleJobChange());
    equipmentBtn.addEventListener('click', () => this.handleEquipment());
    skillsBtn.addEventListener('click', () => this.handleSkills());
    
    if (talkBtn) {
      talkBtn.addEventListener('click', () => this.handleTalk());
    }

    // Equipment Slots Section
    const equipmentSection = this.createElement_div('equipment-section');
    equipmentSection.innerHTML = '<h4>装备槽位</h4>';
    
    // Create or update EquipmentSlotUI
    if (!this.equipmentSlotUI) {
      this.equipmentSlotUI = new EquipmentSlotUI(
        this.uiManager,
        this.eventSystem,
        this.world,
        this.itemSystem
      );
    }
    
    // Set the character and render
    this.equipmentSlotUI.setCharacter(character);
    this.equipmentSlotUI.render();
    
    // Append the equipment UI element
    equipmentSection.appendChild(this.equipmentSlotUI.element);

    // Append all sections
    this.characterDetails.appendChild(header);
    this.characterDetails.appendChild(statusBars);
    this.characterDetails.appendChild(attributesSection);
    this.characterDetails.appendChild(derivedSection);
    this.characterDetails.appendChild(actions);
    this.characterDetails.appendChild(equipmentSection);

    // Add styles
    this.addDetailStyles();
  }

  private addDetailStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .status-bars .status-bar {
        margin-bottom: 12px;
      }
      
      .status-bars label {
        display: block;
        margin-bottom: 4px;
        font-size: 12px;
        color: #b0b0b0;
      }
      
      .bar-container {
        position: relative;
        background: rgba(0,0,0,0.3);
        height: 20px;
        border-radius: 10px;
        overflow: hidden;
      }
      
      .bar {
        height: 100%;
        transition: width 0.3s ease;
      }
      
      .health-bar { background: #e74c3c; }
      .mana-bar { background: #3498db; }
      .exp-bar { background: #f39c12; }
      .hunger-bar { background: #f39c12; }
      
      .bar-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 11px;
        color: white;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      }
      
      .attributes-grid, .derived-stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 8px;
      }
      
      .attribute-item, .stat-item {
        display: flex;
        justify-content: space-between;
        padding: 8px;
        background: rgba(255,255,255,0.05);
        border-radius: 4px;
      }
      
      .attribute-name, .stat-name {
        font-size: 12px;
        color: #b0b0b0;
      }
      
      .attribute-value, .stat-value {
        font-weight: bold;
        color: #ffffff;
      }
      
      .character-actions {
        display: flex;
        gap: 8px;
        margin-top: 16px;
        flex-wrap: wrap;
      }
      
      .character-actions .ui-button {
        flex: 1;
        min-width: 80px;
      }
      
      h4 {
        margin: 16px 0 8px 0;
        color: #ffffff;
        font-size: 14px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        padding-bottom: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  private getJobName(jobType: JobType): string {
    const jobNames: Record<JobType, string> = {
      [JobType.Warrior]: '战士',
      [JobType.Mage]: '法师',
      [JobType.Archer]: '弓手',
      [JobType.Healer]: '治疗师',
      [JobType.Rogue]: '盗贼',
      [JobType.Paladin]: '圣骑士',
      [JobType.Berserker]: '狂战士',
      [JobType.Wizard]: '巫师'
    };
    return jobNames[jobType] || '未知';
  }

  private getRarityName(rarity: RarityType): string {
    const rarityNames = ['普通', '稀有', '神话', '传说'];
    return rarityNames[rarity] || '未知';
  }

  private getStatusText(status: string): string {
    const statusTexts: Record<string, string> = {
      'available': '可用',
      'working': '工作中',
      'exploring': '探险中',
      'injured': '受伤',
      'resting': '休息中'
    };
    return statusTexts[status] || status;
  }

  private handleLevelUp(): void {
    if (this.selectedCharacter) {
      this.eventSystem.emit(createEvent({ 
        type: 'character:levelup', 
        character: this.selectedCharacter 
      }));
      this.showNotification('角色升级！', 'success');
    }
  }

  private handleJobChange(): void {
    if (this.selectedCharacter) {
      this.eventSystem.emit(createEvent({ 
        type: 'ui:show', 
        panel: 'job-change', 
        character: this.selectedCharacter 
      }));
    }
  }

  private handleEquipment(): void {
    if (this.selectedCharacter) {
      this.eventSystem.emit(createEvent({ 
        type: 'ui:show', 
        panel: 'equipment', 
        character: this.selectedCharacter 
      }));
    }
  }

  private handleSkills(): void {
    if (this.selectedCharacter) {
      this.eventSystem.emit(createEvent({ 
        type: 'ui:show', 
        panel: 'skills', 
        character: this.selectedCharacter 
      }));
    }
  }

  private handleTalk(): void {
    if (this.selectedCharacter) {
      this.eventSystem.emit(createEvent({ 
        type: 'ui:show', 
        panel: 'dialogue', 
        character: this.selectedCharacter 
      }));
    }
  }

  protected setupEventListeners(): void {
    this.eventSystem.on('character:recruited', () => this.render());
    this.eventSystem.on('character:updated', () => this.render());
    this.eventSystem.on('character:levelup', () => this.render());
    
    // Listen for equipment changes to update character attributes display
    this.eventSystem.on('equipment_changed', (data: any) => {
      // Only update if the equipment change affects the currently selected character
      if (this.selectedCharacter && data.characterId === this.selectedCharacter) {
        this.renderCharacterDetails();
      }
    });
    
    // Listen for hunger changes to update character display
    // Requirement 6.1, 6.2, 6.3, 6.4: Real-time hunger updates
    this.eventSystem.on('hunger:changed', (data: any) => {
      // Only update if the hunger change affects the currently selected character
      if (this.selectedCharacter && data.characterId === this.selectedCharacter) {
        this.renderCharacterDetails();
      }
    });
    
    // Listen for dialogue completion to update affinity display
    // Requirement 3.4, 10.4: Real-time affinity updates after dialogue
    this.eventSystem.on('dialogue:completed', (data: any) => {
      // Only update if the dialogue affects the currently selected character
      if (this.selectedCharacter && data.characterId === this.selectedCharacter) {
        this.renderCharacterDetails();
      }
    });
    
    // Listen for affinity changes to update character display
    this.eventSystem.on('affinity:changed', (data: any) => {
      // Only update if the affinity change affects the currently selected character
      if (this.selectedCharacter && data.characterId === this.selectedCharacter) {
        this.renderCharacterDetails();
      }
    });
  }
}