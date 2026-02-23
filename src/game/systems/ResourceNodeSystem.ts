/**
 * ResourceNodeSystem - Manages resource nodes in the game
 */

export interface ResourceNodeDrop {
  itemId: string;
  quantity: number;
  chance: number;
}

export interface ResourceNodeData {
  id: string;
  name: string;
  icon: string;
  size: number;
  maxHP: number;
  drops: {
    [stageName: string]: ResourceNodeDrop[];
  };
}

export class ResourceNodeSystem {
  private resourceNodes: Map<string, ResourceNodeData> = new Map();

  constructor() {
    console.log('[ResourceNodeSystem] Initialized');
  }

  /**
   * Load resource node data from JSON
   */
  public async loadResourceNodes(data: any): Promise<void> {
    if (!data || !data.resourceNodes) {
      console.error('[ResourceNodeSystem] Invalid resource node data');
      return;
    }

    data.resourceNodes.forEach((node: ResourceNodeData) => {
      this.resourceNodes.set(node.id, node);
    });

    console.log(`[ResourceNodeSystem] Loaded ${this.resourceNodes.size} resource nodes`);
  }

  /**
   * Get resource node by ID
   */
  public getResourceNode(id: string): ResourceNodeData | undefined {
    return this.resourceNodes.get(id);
  }

  /**
   * Get all resource node IDs
   */
  public getAllResourceNodeIds(): string[] {
    return Array.from(this.resourceNodes.keys());
  }

  /**
   * Get drops for a resource node in a specific stage
   */
  public getDropsForStage(nodeId: string, stageName: string): ResourceNodeDrop[] {
    const node = this.resourceNodes.get(nodeId);
    if (!node) {
      console.warn(`[ResourceNodeSystem] Resource node ${nodeId} not found`);
      return [];
    }

    return node.drops[stageName] || [];
  }

  /**
   * Roll for drops when a resource node is destroyed
   */
  public rollDrops(nodeId: string, stageName: string): { itemId: string; quantity: number }[] {
    const drops = this.getDropsForStage(nodeId, stageName);
    const result: { itemId: string; quantity: number }[] = [];

    drops.forEach(drop => {
      if (Math.random() < drop.chance) {
        result.push({
          itemId: drop.itemId,
          quantity: drop.quantity
        });
      }
    });

    return result;
  }
}
