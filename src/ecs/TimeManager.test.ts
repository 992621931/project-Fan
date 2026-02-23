import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeManager, Timer } from './TimeManager';

// Mock performance.now
const mockPerformanceNow = vi.fn();
Object.defineProperty(global, 'performance', {
  value: { now: mockPerformanceNow },
  writable: true,
});

describe('TimeManager', () => {
  let timeManager: TimeManager;
  let currentTime: number;

  beforeEach(() => {
    vi.clearAllMocks();
    currentTime = 1000; // Start at 1 second
    mockPerformanceNow.mockImplementation(() => currentTime);
    timeManager = new TimeManager();
  });

  it('should create a time manager with default values', () => {
    expect(timeManager.getTimeScale()).toBe(1.0);
    expect(timeManager.isTimePaused()).toBe(false);
  });

  it('should set and get time scale', () => {
    timeManager.setTimeScale(2.0);
    expect(timeManager.getTimeScale()).toBe(2.0);
    
    timeManager.setTimeScale(0.5);
    expect(timeManager.getTimeScale()).toBe(0.5);
    
    // Should not allow negative time scale
    timeManager.setTimeScale(-1.0);
    expect(timeManager.getTimeScale()).toBe(0);
  });

  it('should scale delta time', () => {
    timeManager.setTimeScale(2.0);
    expect(timeManager.scaleDeltaTime(100)).toBe(200);
    
    timeManager.setTimeScale(0.5);
    expect(timeManager.scaleDeltaTime(100)).toBe(50);
    
    timeManager.setTimeScale(0);
    expect(timeManager.scaleDeltaTime(100)).toBe(0);
  });

  it('should track elapsed time', () => {
    const startTime = currentTime;
    
    // Advance time by 500ms
    currentTime += 500;
    mockPerformanceNow.mockReturnValue(currentTime);
    
    expect(timeManager.getElapsedTime()).toBe(500);
    expect(timeManager.getRealTime()).toBe(500);
  });

  it('should handle pause and resume', () => {
    const startTime = currentTime;
    
    // Advance time by 500ms
    currentTime += 500;
    mockPerformanceNow.mockReturnValue(currentTime);
    
    // Pause
    timeManager.pause();
    expect(timeManager.isTimePaused()).toBe(true);
    
    // Advance time while paused
    currentTime += 300;
    mockPerformanceNow.mockReturnValue(currentTime);
    
    // Resume
    timeManager.resume();
    expect(timeManager.isTimePaused()).toBe(false);
    
    // Advance time after resume
    currentTime += 200;
    mockPerformanceNow.mockReturnValue(currentTime);
    
    // Elapsed time should exclude the paused period
    expect(timeManager.getElapsedTime()).toBe(700); // 500 + 200, excluding 300ms pause
    expect(timeManager.getRealTime()).toBe(1000); // Total real time including pause
  });

  it('should reset time manager', () => {
    // Advance time and change settings
    currentTime += 1000;
    mockPerformanceNow.mockReturnValue(currentTime);
    timeManager.setTimeScale(2.0);
    timeManager.pause();
    
    // Reset
    timeManager.reset();
    
    expect(timeManager.getTimeScale()).toBe(1.0);
    expect(timeManager.isTimePaused()).toBe(false);
    expect(timeManager.getElapsedTime()).toBe(0);
    expect(timeManager.getRealTime()).toBe(0);
  });

  it('should format time correctly', () => {
    expect(TimeManager.formatTime(0)).toBe('00:00');
    expect(TimeManager.formatTime(30000)).toBe('00:30');
    expect(TimeManager.formatTime(90000)).toBe('01:30');
    expect(TimeManager.formatTime(3661000)).toBe('61:01');
  });

  it('should format time with hours correctly', () => {
    expect(TimeManager.formatTimeWithHours(0)).toBe('00:00');
    expect(TimeManager.formatTimeWithHours(30000)).toBe('00:30');
    expect(TimeManager.formatTimeWithHours(3661000)).toBe('1:01:01');
    expect(TimeManager.formatTimeWithHours(7323000)).toBe('2:02:03');
  });

  it('should convert between milliseconds and seconds', () => {
    expect(TimeManager.msToSeconds(1000)).toBe(1);
    expect(TimeManager.msToSeconds(2500)).toBe(2.5);
    expect(TimeManager.secondsToMs(1)).toBe(1000);
    expect(TimeManager.secondsToMs(2.5)).toBe(2500);
  });

  it('should have predefined time scales', () => {
    expect(TimeManager.TIME_SCALES.PAUSED.scale).toBe(0);
    expect(TimeManager.TIME_SCALES.NORMAL.scale).toBe(1.0);
    expect(TimeManager.TIME_SCALES.FAST.scale).toBe(2.0);
  });
});

describe('Timer', () => {
  let timeManager: TimeManager;
  let currentTime: number;

  beforeEach(() => {
    vi.clearAllMocks();
    currentTime = 1000;
    mockPerformanceNow.mockImplementation(() => currentTime);
    timeManager = new TimeManager();
  });

  it('should create and execute a timer', () => {
    const callback = vi.fn();
    const timer = timeManager.createTimer(100, callback);
    
    expect(timer.isTimerActive()).toBe(true);
    expect(callback).not.toHaveBeenCalled();
    
    // Advance time by 50ms
    currentTime += 50;
    mockPerformanceNow.mockReturnValue(currentTime);
    timer.update();
    
    expect(callback).not.toHaveBeenCalled();
    expect(timer.isTimerActive()).toBe(true);
    
    // Advance time by another 60ms (total 110ms)
    currentTime += 60;
    mockPerformanceNow.mockReturnValue(currentTime);
    timer.update();
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(timer.isTimerActive()).toBe(false);
  });

  it('should create and execute an interval', () => {
    const callback = vi.fn();
    const timer = timeManager.createInterval(100, callback);
    
    expect(timer.isTimerActive()).toBe(true);
    
    // First execution
    currentTime += 110;
    mockPerformanceNow.mockReturnValue(currentTime);
    timer.update();
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(timer.isTimerActive()).toBe(true);
    
    // Second execution
    currentTime += 110;
    mockPerformanceNow.mockReturnValue(currentTime);
    timer.update();
    
    expect(callback).toHaveBeenCalledTimes(2);
    expect(timer.isTimerActive()).toBe(true);
  });

  it('should cancel a timer', () => {
    const callback = vi.fn();
    const timer = timeManager.createTimer(100, callback);
    
    timer.cancel();
    expect(timer.isTimerActive()).toBe(false);
    
    // Advance time
    currentTime += 200;
    mockPerformanceNow.mockReturnValue(currentTime);
    timer.update();
    
    expect(callback).not.toHaveBeenCalled();
  });

  it('should respect time scaling', () => {
    const callback = vi.fn();
    const timer = timeManager.createTimer(100, callback);
    
    // Set time scale to 2x
    timeManager.setTimeScale(2.0);
    
    // Advance time by 60ms (should be scaled to 120ms)
    currentTime += 60;
    mockPerformanceNow.mockReturnValue(currentTime);
    timer.update();
    
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should pause with time manager', () => {
    const callback = vi.fn();
    const timer = timeManager.createTimer(100, callback);
    
    // Advance time by 50ms
    currentTime += 50;
    mockPerformanceNow.mockReturnValue(currentTime);
    timer.update();
    
    expect(callback).not.toHaveBeenCalled();
    
    // Pause time manager
    timeManager.pause();
    
    // Advance time while paused
    currentTime += 100;
    mockPerformanceNow.mockReturnValue(currentTime);
    timer.update();
    
    expect(callback).not.toHaveBeenCalled();
    expect(timer.isTimerActive()).toBe(true);
    
    // Resume and advance time
    timeManager.resume();
    currentTime += 60;
    mockPerformanceNow.mockReturnValue(currentTime);
    timer.update();
    
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should calculate remaining time', () => {
    const callback = vi.fn();
    const timer = timeManager.createTimer(100, callback);
    
    expect(timer.getRemainingTime()).toBe(100);
    
    // Advance time by 30ms
    currentTime += 30;
    mockPerformanceNow.mockReturnValue(currentTime);
    timer.update();
    
    expect(timer.getRemainingTime()).toBe(70);
    
    // Complete the timer
    currentTime += 80;
    mockPerformanceNow.mockReturnValue(currentTime);
    timer.update();
    
    expect(timer.getRemainingTime()).toBe(0);
  });
});