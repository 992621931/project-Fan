/**
 * TimeManager - Provides time-related utilities and manages time scaling
 */

export interface TimeScale {
  scale: number;
  name: string;
}

export class TimeManager {
  private timeScale: number = 1.0;
  private pausedTime: number = 0;
  private totalPausedTime: number = 0;
  private startTime: number = 0;
  private lastPauseTime: number = 0;
  private isPaused: boolean = false;
  
  // Predefined time scales
  public static readonly TIME_SCALES: Record<string, TimeScale> = {
    PAUSED: { scale: 0, name: 'Paused' },
    SLOW: { scale: 0.5, name: 'Slow Motion' },
    NORMAL: { scale: 1.0, name: 'Normal' },
    FAST: { scale: 2.0, name: 'Fast Forward' },
    VERY_FAST: { scale: 4.0, name: 'Very Fast' },
  };
  
  constructor() {
    this.startTime = performance.now();
  }
  
  /**
   * Get the current time scale
   */
  public getTimeScale(): number {
    return this.timeScale;
  }
  
  /**
   * Set the time scale
   */
  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, scale);
  }
  
  /**
   * Apply time scale to a delta time value
   */
  public scaleDeltaTime(deltaTime: number): number {
    return deltaTime * this.timeScale;
  }
  
  /**
   * Get the total elapsed time since start (excluding paused time)
   */
  public getElapsedTime(): number {
    const currentTime = performance.now();
    const totalTime = currentTime - this.startTime;
    return totalTime - this.totalPausedTime - (this.isPaused ? currentTime - this.lastPauseTime : 0);
  }
  
  /**
   * Get the total real time since start (including paused time)
   */
  public getRealTime(): number {
    return performance.now() - this.startTime;
  }
  
  /**
   * Pause time tracking
   */
  public pause(): void {
    if (!this.isPaused) {
      this.isPaused = true;
      this.lastPauseTime = performance.now();
    }
  }
  
  /**
   * Resume time tracking
   */
  public resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.totalPausedTime += performance.now() - this.lastPauseTime;
    }
  }
  
  /**
   * Check if time is paused
   */
  public isTimePaused(): boolean {
    return this.isPaused;
  }
  
  /**
   * Reset the time manager
   */
  public reset(): void {
    this.startTime = performance.now();
    this.totalPausedTime = 0;
    this.pausedTime = 0;
    this.lastPauseTime = 0;
    this.isPaused = false;
    this.timeScale = 1.0;
  }
  
  /**
   * Convert milliseconds to seconds
   */
  public static msToSeconds(ms: number): number {
    return ms / 1000;
  }
  
  /**
   * Convert seconds to milliseconds
   */
  public static secondsToMs(seconds: number): number {
    return seconds * 1000;
  }
  
  /**
   * Format time as MM:SS
   */
  public static formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Format time as HH:MM:SS
   */
  public static formatTimeWithHours(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }
  
  /**
   * Create a timer that calls a callback after a delay
   */
  public createTimer(delay: number, callback: () => void): Timer {
    return new Timer(delay, callback, this);
  }
  
  /**
   * Create an interval that calls a callback repeatedly
   */
  public createInterval(interval: number, callback: () => void): Timer {
    return new Timer(interval, callback, this, true);
  }
}

/**
 * Timer class that respects time scaling and pausing
 */
export class Timer {
  private startTime: number;
  private delay: number;
  private callback: () => void;
  private timeManager: TimeManager;
  private isRepeating: boolean;
  private isActive: boolean = true;
  private pausedTime: number = 0;
  private lastPauseTime: number = 0;
  private wasPaused: boolean = false;
  
  constructor(delay: number, callback: () => void, timeManager: TimeManager, isRepeating: boolean = false) {
    this.delay = delay;
    this.callback = callback;
    this.timeManager = timeManager;
    this.isRepeating = isRepeating;
    this.startTime = performance.now();
  }
  
  /**
   * Update the timer
   */
  public update(): boolean {
    if (!this.isActive) {
      return false;
    }
    
    // Handle pause state changes
    const isPaused = this.timeManager.isTimePaused();
    if (isPaused && !this.wasPaused) {
      // Just paused
      this.lastPauseTime = performance.now();
      this.wasPaused = true;
    } else if (!isPaused && this.wasPaused) {
      // Just resumed
      this.pausedTime += performance.now() - this.lastPauseTime;
      this.wasPaused = false;
    }
    
    if (isPaused) {
      return true; // Still active but paused
    }
    
    const currentTime = performance.now();
    const elapsed = (currentTime - this.startTime - this.pausedTime) * this.timeManager.getTimeScale();
    
    if (elapsed >= this.delay) {
      this.callback();
      
      if (this.isRepeating) {
        // Reset for next interval
        this.startTime = currentTime;
        this.pausedTime = 0;
      } else {
        this.isActive = false;
      }
    }
    
    return this.isActive;
  }
  
  /**
   * Cancel the timer
   */
  public cancel(): void {
    this.isActive = false;
  }
  
  /**
   * Check if the timer is active
   */
  public isTimerActive(): boolean {
    return this.isActive;
  }
  
  /**
   * Get remaining time
   */
  public getRemainingTime(): number {
    if (!this.isActive) {
      return 0;
    }
    
    const currentTime = performance.now();
    const elapsed = (currentTime - this.startTime - this.pausedTime) * this.timeManager.getTimeScale();
    return Math.max(0, this.delay - elapsed);
  }
}