/**
 * Quest Tracker Component
 * Displays current main quest information in the top-right corner of village scene
 */

export interface QuestObjective {
  type: string;
  target: string;
  requiredAmount: number;
  currentAmount: number;
  description: string;
}

export interface QuestDefinition {
  id: string;
  name: string;
  description: string;
  type: 'main' | 'side' | 'daily';
  objectives: QuestObjective[];
}

export interface QuestState {
  id: string;
  status: 'locked' | 'available' | 'inProgress' | 'completed';
  objectives: Array<{ currentAmount: number }>;
}

export class QuestTracker {
  private container: HTMLElement | null = null;
  private currentQuest: QuestDefinition | null = null;
  private currentState: QuestState | null = null;

  constructor() {
    this.createContainer();
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'quest-tracker';
    this.container.style.cssText = `
      position: absolute;
      top: 15px;
      right: 0px;
      width: 280px;
      background: transparent;
      border: none;
      border-radius: 8px;
      padding: 9.6px;
      z-index: 101;
      display: none;
      font-family: Arial, sans-serif;
      pointer-events: auto;
      transform: scale(0.8);
      transform-origin: top right;
    `;
  }

  /**
   * Update the quest tracker with current quest information
   */
  public update(quest: QuestDefinition | null, state: QuestState | null): void {
    if (!this.container) return;

    this.currentQuest = quest;
    this.currentState = state;

    if (!quest || !state || state.status !== 'inProgress') {
      this.hide();
      return;
    }

    this.render();
    this.show();
  }

  private render(): void {
    if (!this.container || !this.currentQuest || !this.currentState) return;

    const quest = this.currentQuest;
    const state = this.currentState;

    // Calculate overall progress
    let totalCompleted = 0;
    let totalRequired = 0;
    quest.objectives.forEach((obj, index) => {
      const current = state.objectives[index]?.currentAmount || 0;
      totalCompleted += Math.min(current, obj.requiredAmount);
      totalRequired += obj.requiredAmount;
    });
    const progressPercent = totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0;

    // Text shadow style for all text
    const textShadow = 'text-shadow: 1px 1px 2px #000, -1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000;';

    this.container.innerHTML = `
      <div style="margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span style="font-size: 16px; ${textShadow}">📜</span>
          <div style="flex: 1;">
            <div style="font-size: 11px; font-weight: bold; color: #fff; ${textShadow}">主线任务</div>
            <div style="font-size: 13px; font-weight: bold; color: #fff; margin-top: 1px; ${textShadow}">${quest.name}</div>
          </div>
        </div>
      </div>

      <div style="margin-top: 6px;">
        ${quest.objectives.map((obj, index) => {
          const current = state.objectives[index]?.currentAmount || 0;
          const isCompleted = current >= obj.requiredAmount;
          return `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
              <span style="font-size: 14px; ${textShadow}">${isCompleted ? '✅' : '⭕'}</span>
              <div style="flex: 1;">
                <div style="font-size: 11px; color: #fff; ${textShadow}">
                  ${obj.description} (${current}/${obj.requiredAmount})
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  public show(): void {
    if (this.container) {
      this.container.style.display = 'block';
    }
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  public getElement(): HTMLElement | null {
    return this.container;
  }

  public destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.currentQuest = null;
    this.currentState = null;
  }
}
