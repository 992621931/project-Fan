/**
 * PerformanceMonitor - Performance monitoring and analysis system
 */

export interface PerformanceMetrics {
  frameTime: number;
  updateTime: number;
  renderTime: number;
  memoryUsage: number;
  entityCount: number;
  componentCount: number;
  systemCount: number;
  cacheHitRate: number;
  poolEfficiency: number;
}

export interface PerformanceThresholds {
  maxFrameTime?: number;
  maxUpdateTime?: number;
  maxRenderTime?: number;
  maxMemoryUsage?: number;
  minCacheHitRate?: number;
  minPoolEfficiency?: number;
}

export interface PerformanceAlert {
  type: 'warning' | 'critical';
  metric: keyof PerformanceMetrics;
  value: number;
  threshold: number;
  timestamp: number;
  message: string;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxHistorySize: number = 300; // Keep 5 minutes at 60fps
  private thresholds: PerformanceThresholds = {};
  private alerts: PerformanceAlert[] = [];
  private maxAlerts: number = 100;
  
  // Timing measurements
  private frameStartTime: number = 0;
  private updateStartTime: number = 0;
  private renderStartTime: number = 0;
  
  // Callbacks
  private alertCallback?: (alert: PerformanceAlert) => void;
  private metricsCallback?: (metrics: PerformanceMetrics) => void;

  constructor(thresholds: PerformanceThresholds = {}) {
    this.thresholds = {
      maxFrameTime: 16.67, // 60fps
      maxUpdateTime: 10,
      maxRenderTime: 6,
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      minCacheHitRate: 80,
      minPoolEfficiency: 70,
      ...thresholds,
    };
  }

  /**
   * Start frame timing
   */
  public startFrame(): void {
    this.frameStartTime = performance.now();
  }

  /**
   * Start update timing
   */
  public startUpdate(): void {
    this.updateStartTime = performance.now();
  }

  /**
   * End update timing
   */
  public endUpdate(): number {
    const updateTime = performance.now() - this.updateStartTime;
    return updateTime;
  }

  /**
   * Start render timing
   */
  public startRender(): void {
    this.renderStartTime = performance.now();
  }

  /**
   * End render timing
   */
  public endRender(): number {
    const renderTime = performance.now() - this.renderStartTime;
    return renderTime;
  }

  /**
   * End frame and record metrics
   */
  public endFrame(
    entityCount: number,
    componentCount: number,
    systemCount: number,
    cacheHitRate: number = 0,
    poolEfficiency: number = 0
  ): void {
    const frameTime = performance.now() - this.frameStartTime;
    const updateTime = this.updateStartTime > 0 ? performance.now() - this.updateStartTime : 0;
    const renderTime = this.renderStartTime > 0 ? performance.now() - this.renderStartTime : 0;
    
    const metrics: PerformanceMetrics = {
      frameTime,
      updateTime,
      renderTime,
      memoryUsage: this.getMemoryUsage(),
      entityCount,
      componentCount,
      systemCount,
      cacheHitRate,
      poolEfficiency,
    };

    this.recordMetrics(metrics);
    this.checkThresholds(metrics);

    // Reset timing
    this.frameStartTime = 0;
    this.updateStartTime = 0;
    this.renderStartTime = 0;

    // Call metrics callback
    if (this.metricsCallback) {
      this.metricsCallback(metrics);
    }
  }

  /**
   * Record performance metrics
   */
  private recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);

    // Trim history if too large
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics.shift();
    }
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private checkThresholds(metrics: PerformanceMetrics): void {
    const checks: Array<{
      metric: keyof PerformanceMetrics;
      value: number;
      threshold: number | undefined;
      isMax: boolean;
    }> = [
      { metric: 'frameTime', value: metrics.frameTime, threshold: this.thresholds.maxFrameTime, isMax: true },
      { metric: 'updateTime', value: metrics.updateTime, threshold: this.thresholds.maxUpdateTime, isMax: true },
      { metric: 'renderTime', value: metrics.renderTime, threshold: this.thresholds.maxRenderTime, isMax: true },
      { metric: 'memoryUsage', value: metrics.memoryUsage, threshold: this.thresholds.maxMemoryUsage, isMax: true },
      { metric: 'cacheHitRate', value: metrics.cacheHitRate, threshold: this.thresholds.minCacheHitRate, isMax: false },
      { metric: 'poolEfficiency', value: metrics.poolEfficiency, threshold: this.thresholds.minPoolEfficiency, isMax: false },
    ];

    for (const check of checks) {
      if (check.threshold === undefined) continue;

      const isViolation = check.isMax 
        ? check.value > check.threshold
        : check.value < check.threshold;

      if (isViolation) {
        const severity = this.getSeverity(check.metric, check.value, check.threshold, check.isMax);
        const alert: PerformanceAlert = {
          type: severity,
          metric: check.metric,
          value: check.value,
          threshold: check.threshold,
          timestamp: Date.now(),
          message: this.generateAlertMessage(check.metric, check.value, check.threshold, check.isMax),
        };

        this.addAlert(alert);
      }
    }
  }

  /**
   * Determine alert severity
   */
  private getSeverity(
    metric: keyof PerformanceMetrics,
    value: number,
    threshold: number,
    isMax: boolean
  ): 'warning' | 'critical' {
    const ratio = isMax ? value / threshold : threshold / value;
    
    // Critical if 50% over/under threshold
    if (ratio >= 1.5) {
      return 'critical';
    }
    
    return 'warning';
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(
    metric: keyof PerformanceMetrics,
    value: number,
    threshold: number,
    isMax: boolean
  ): string {
    const direction = isMax ? 'exceeded' : 'below';
    const unit = this.getMetricUnit(metric);
    
    return `${metric} ${direction} threshold: ${value.toFixed(2)}${unit} (threshold: ${threshold}${unit})`;
  }

  /**
   * Get unit for metric
   */
  private getMetricUnit(metric: keyof PerformanceMetrics): string {
    switch (metric) {
      case 'frameTime':
      case 'updateTime':
      case 'renderTime':
        return 'ms';
      case 'memoryUsage':
        return 'MB';
      case 'cacheHitRate':
      case 'poolEfficiency':
        return '%';
      default:
        return '';
    }
  }

  /**
   * Add alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    // Trim alerts if too many
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift();
    }

    // Call alert callback
    if (this.alertCallback) {
      this.alertCallback(alert);
    }
  }

  /**
   * Get current performance metrics
   */
  public getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get average metrics over a time period
   */
  public getAverageMetrics(timeWindowMs: number = 5000): PerformanceMetrics | null {
    if (this.metrics.length === 0) return null;

    const now = Date.now();
    const cutoff = now - timeWindowMs;
    
    // Filter metrics within time window (approximate based on 60fps)
    const windowSize = Math.min(Math.floor(timeWindowMs / 16.67), this.metrics.length);
    const recentMetrics = this.metrics.slice(-windowSize);

    if (recentMetrics.length === 0) return null;

    // Calculate averages
    const totals = recentMetrics.reduce((acc, metrics) => ({
      frameTime: acc.frameTime + metrics.frameTime,
      updateTime: acc.updateTime + metrics.updateTime,
      renderTime: acc.renderTime + metrics.renderTime,
      memoryUsage: acc.memoryUsage + metrics.memoryUsage,
      entityCount: acc.entityCount + metrics.entityCount,
      componentCount: acc.componentCount + metrics.componentCount,
      systemCount: acc.systemCount + metrics.systemCount,
      cacheHitRate: acc.cacheHitRate + metrics.cacheHitRate,
      poolEfficiency: acc.poolEfficiency + metrics.poolEfficiency,
    }), {
      frameTime: 0, updateTime: 0, renderTime: 0, memoryUsage: 0,
      entityCount: 0, componentCount: 0, systemCount: 0,
      cacheHitRate: 0, poolEfficiency: 0,
    });

    const count = recentMetrics.length;
    return {
      frameTime: totals.frameTime / count,
      updateTime: totals.updateTime / count,
      renderTime: totals.renderTime / count,
      memoryUsage: totals.memoryUsage / count,
      entityCount: Math.round(totals.entityCount / count),
      componentCount: Math.round(totals.componentCount / count),
      systemCount: Math.round(totals.systemCount / count),
      cacheHitRate: totals.cacheHitRate / count,
      poolEfficiency: totals.poolEfficiency / count,
    };
  }

  /**
   * Get recent alerts
   */
  public getRecentAlerts(timeWindowMs: number = 60000): PerformanceAlert[] {
    const now = Date.now();
    const cutoff = now - timeWindowMs;
    
    return this.alerts.filter(alert => alert.timestamp >= cutoff);
  }

  /**
   * Get all alerts
   */
  public getAllAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear alerts
   */
  public clearAlerts(): void {
    this.alerts.length = 0;
  }

  /**
   * Set alert callback
   */
  public setAlertCallback(callback: (alert: PerformanceAlert) => void): void {
    this.alertCallback = callback;
  }

  /**
   * Set metrics callback
   */
  public setMetricsCallback(callback: (metrics: PerformanceMetrics) => void): void {
    this.metricsCallback = callback;
  }

  /**
   * Update thresholds
   */
  public updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get memory usage (rough estimate)
   */
  private getMemoryUsage(): number {
    // In a browser environment, we can't get exact memory usage
    // This is a placeholder - in a real implementation you might use performance.memory
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
    
    // Fallback estimate
    return 0;
  }

  /**
   * Generate performance report
   */
  public generateReport(): {
    current: PerformanceMetrics | null;
    average: PerformanceMetrics | null;
    alerts: PerformanceAlert[];
    summary: string;
  } {
    const current = this.getCurrentMetrics();
    const average = this.getAverageMetrics();
    const recentAlerts = this.getRecentAlerts();

    let summary = 'Performance Report:\n';
    
    if (current) {
      summary += `Current FPS: ${(1000 / current.frameTime).toFixed(1)}\n`;
      summary += `Frame Time: ${current.frameTime.toFixed(2)}ms\n`;
      summary += `Update Time: ${current.updateTime.toFixed(2)}ms\n`;
      summary += `Render Time: ${current.renderTime.toFixed(2)}ms\n`;
      summary += `Entities: ${current.entityCount}\n`;
      summary += `Components: ${current.componentCount}\n`;
    }

    if (recentAlerts.length > 0) {
      summary += `\nRecent Alerts: ${recentAlerts.length}\n`;
      const criticalAlerts = recentAlerts.filter(a => a.type === 'critical').length;
      if (criticalAlerts > 0) {
        summary += `Critical Alerts: ${criticalAlerts}\n`;
      }
    }

    return {
      current,
      average,
      alerts: recentAlerts,
      summary,
    };
  }
}