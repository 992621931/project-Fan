/**
 * PerformanceMonitor Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceMonitor, PerformanceThresholds } from './PerformanceMonitor';

describe('PerformanceMonitor Tests', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      maxFrameTime: 16.67,
      maxUpdateTime: 10,
      maxRenderTime: 6,
      maxMemoryUsage: 100,
      minCacheHitRate: 80,
      minPoolEfficiency: 70,
    });
  });

  it('should track frame timing accurately', () => {
    const startTime = performance.now();
    
    monitor.startFrame();
    
    // Simulate some work
    const workStart = performance.now();
    while (performance.now() - workStart < 5) {
      // Busy wait for 5ms
    }
    
    monitor.endFrame(100, 500, 10, 85, 75);
    
    const metrics = monitor.getCurrentMetrics();
    expect(metrics).toBeDefined();
    expect(metrics!.frameTime).toBeGreaterThan(4);
    expect(metrics!.frameTime).toBeLessThan(20);
    expect(metrics!.entityCount).toBe(100);
    expect(metrics!.componentCount).toBe(500);
    expect(metrics!.systemCount).toBe(10);
  });

  it('should track update and render timing separately', () => {
    monitor.startFrame();
    
    monitor.startUpdate();
    // Simulate update work
    const updateStart = performance.now();
    while (performance.now() - updateStart < 3) {
      // Busy wait for 3ms
    }
    const updateTime = monitor.endUpdate();
    
    monitor.startRender();
    // Simulate render work
    const renderStart = performance.now();
    while (performance.now() - renderStart < 2) {
      // Busy wait for 2ms
    }
    const renderTime = monitor.endRender();
    
    monitor.endFrame(50, 200, 5, 90, 80);
    
    expect(updateTime).toBeGreaterThan(2);
    expect(updateTime).toBeLessThan(10);
    expect(renderTime).toBeGreaterThan(1);
    expect(renderTime).toBeLessThan(10);
    
    const metrics = monitor.getCurrentMetrics();
    expect(metrics!.updateTime).toBeGreaterThan(0);
    expect(metrics!.renderTime).toBeGreaterThan(0);
  });

  it('should generate alerts when thresholds are exceeded', () => {
    const alerts: any[] = [];
    monitor.setAlertCallback((alert) => {
      alerts.push(alert);
    });

    // Simulate slow frame
    monitor.startFrame();
    const workStart = performance.now();
    while (performance.now() - workStart < 20) {
      // Busy wait for 20ms (exceeds 16.67ms threshold)
    }
    monitor.endFrame(100, 500, 10, 85, 75);

    expect(alerts.length).toBeGreaterThan(0);
    const frameTimeAlert = alerts.find(a => a.metric === 'frameTime');
    expect(frameTimeAlert).toBeDefined();
    expect(frameTimeAlert.type).toBe('warning');
    expect(frameTimeAlert.value).toBeGreaterThan(16.67);
  });

  it('should generate critical alerts for severe performance issues', () => {
    const alerts: any[] = [];
    monitor.setAlertCallback((alert) => {
      alerts.push(alert);
    });

    // Simulate very slow frame (critical threshold)
    monitor.startFrame();
    const workStart = performance.now();
    while (performance.now() - workStart < 30) {
      // Busy wait for 30ms (way over threshold)
    }
    monitor.endFrame(100, 500, 10, 85, 75);

    const criticalAlerts = alerts.filter(a => a.type === 'critical');
    expect(criticalAlerts.length).toBeGreaterThan(0);
  });

  it('should calculate average metrics correctly', () => {
    // Record multiple frames
    for (let i = 0; i < 10; i++) {
      monitor.startFrame();
      
      // Simulate variable frame times
      const workStart = performance.now();
      while (performance.now() - workStart < (5 + i)) {
        // Busy wait for 5-14ms
      }
      
      monitor.endFrame(100 + i, 500 + i * 10, 10, 85, 75);
    }

    const averageMetrics = monitor.getAverageMetrics(1000);
    expect(averageMetrics).toBeDefined();
    expect(averageMetrics!.frameTime).toBeGreaterThan(5);
    expect(averageMetrics!.frameTime).toBeLessThan(20);
    expect(averageMetrics!.entityCount).toBeGreaterThan(100);
    expect(averageMetrics!.entityCount).toBeLessThan(110);
  });

  it('should handle high-frequency monitoring without performance degradation', () => {
    const startTime = performance.now();
    const iterations = 1000;

    // Simulate many rapid frames
    for (let i = 0; i < iterations; i++) {
      monitor.startFrame();
      monitor.startUpdate();
      monitor.endUpdate();
      monitor.startRender();
      monitor.endRender();
      monitor.endFrame(100, 500, 10, 85, 75);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Monitoring itself should be very fast
    expect(duration).toBeLessThan(100); // 100ms for 1000 monitoring cycles

    const metrics = monitor.getCurrentMetrics();
    expect(metrics).toBeDefined();
  });

  it('should generate comprehensive performance reports', () => {
    // Record some frames with varying performance
    const scenarios = [
      { entities: 100, components: 500, frameDelay: 10 },
      { entities: 200, components: 1000, frameDelay: 15 },
      { entities: 150, components: 750, frameDelay: 12 },
      { entities: 300, components: 1500, frameDelay: 18 },
      { entities: 250, components: 1250, frameDelay: 14 },
    ];

    scenarios.forEach(scenario => {
      monitor.startFrame();
      
      const workStart = performance.now();
      while (performance.now() - workStart < scenario.frameDelay) {
        // Simulate work
      }
      
      monitor.endFrame(
        scenario.entities,
        scenario.components,
        10,
        85,
        75
      );
    });

    const report = monitor.generateReport();
    
    expect(report.current).toBeDefined();
    expect(report.average).toBeDefined();
    expect(report.summary).toContain('Performance Report');
    expect(report.summary).toContain('Current FPS');
    expect(report.summary).toContain('Frame Time');
    expect(report.summary).toContain('Entities');
    
    if (report.alerts.length > 0) {
      expect(report.summary).toContain('Recent Alerts');
    }
  });

  it('should handle memory usage tracking', () => {
    // Mock performance.memory if available
    const originalMemory = (performance as any).memory;
    (performance as any).memory = {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    };

    monitor.startFrame();
    monitor.endFrame(100, 500, 10, 85, 75);

    const metrics = monitor.getCurrentMetrics();
    expect(metrics!.memoryUsage).toBeGreaterThan(0);

    // Restore original memory object
    (performance as any).memory = originalMemory;
  });

  it('should track cache and pool efficiency metrics', () => {
    monitor.startFrame();
    monitor.endFrame(100, 500, 10, 95, 85); // High efficiency

    let metrics = monitor.getCurrentMetrics();
    expect(metrics!.cacheHitRate).toBe(95);
    expect(metrics!.poolEfficiency).toBe(85);

    // Test with low efficiency (should trigger alerts)
    const alerts: any[] = [];
    monitor.setAlertCallback((alert) => {
      alerts.push(alert);
    });

    monitor.startFrame();
    monitor.endFrame(100, 500, 10, 60, 50); // Low efficiency

    metrics = monitor.getCurrentMetrics();
    expect(metrics!.cacheHitRate).toBe(60);
    expect(metrics!.poolEfficiency).toBe(50);

    // Should have alerts for low efficiency
    const cacheAlert = alerts.find(a => a.metric === 'cacheHitRate');
    const poolAlert = alerts.find(a => a.metric === 'poolEfficiency');
    expect(cacheAlert).toBeDefined();
    expect(poolAlert).toBeDefined();
  });
});