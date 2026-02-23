/**
 * VersionManager - Handles version information and update notifications
 */

export interface VersionInfo {
  version: string;
  buildTime: string;
  commit: string;
  branch: string;
  environment: 'development' | 'production';
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  updateUrl?: string;
  releaseNotes?: string;
}

export class VersionManager {
  private currentVersion: VersionInfo;
  private updateCheckInterval: number = 5 * 60 * 1000; // 5 minutes
  private updateCheckTimer: NodeJS.Timeout | null = null;
  private updateCallback?: (updateInfo: UpdateInfo) => void;

  constructor(versionInfo?: VersionInfo) {
    // Try to get version info from build-time generated file
    this.currentVersion = versionInfo || this.getDefaultVersionInfo();
  }

  /**
   * Get default version info for development
   */
  private getDefaultVersionInfo(): VersionInfo {
    return {
      version: 'dev',
      buildTime: new Date().toISOString(),
      commit: 'unknown',
      branch: 'development',
      environment: 'development'
    };
  }

  /**
   * Get current version information
   */
  public getCurrentVersion(): VersionInfo {
    return { ...this.currentVersion };
  }

  /**
   * Check for updates
   */
  public async checkForUpdates(): Promise<UpdateInfo> {
    try {
      // In production, check the build manifest
      if (this.currentVersion.environment === 'production') {
        return await this.checkProductionUpdates();
      } else {
        // In development, always return no updates
        return {
          hasUpdate: false,
          currentVersion: this.currentVersion.version,
          latestVersion: this.currentVersion.version
        };
      }
    } catch (error) {
      console.warn('Failed to check for updates:', error);
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion.version,
        latestVersion: this.currentVersion.version
      };
    }
  }

  /**
   * Check for updates in production environment
   */
  private async checkProductionUpdates(): Promise<UpdateInfo> {
    try {
      // Fetch the latest build manifest
      const response = await fetch('/build-manifest.json?t=' + Date.now());
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const latestManifest = await response.json();
      const hasUpdate = latestManifest.version !== this.currentVersion.version;

      return {
        hasUpdate,
        currentVersion: this.currentVersion.version,
        latestVersion: latestManifest.version,
        updateUrl: hasUpdate ? window.location.href : undefined
      };
    } catch (error) {
      throw new Error(`Failed to fetch update information: ${error}`);
    }
  }

  /**
   * Start automatic update checking
   */
  public startUpdateChecking(callback?: (updateInfo: UpdateInfo) => void): void {
    if (this.updateCheckTimer) {
      this.stopUpdateChecking();
    }

    this.updateCallback = callback;

    // Check immediately
    this.performUpdateCheck();

    // Set up periodic checking
    this.updateCheckTimer = setInterval(() => {
      this.performUpdateCheck();
    }, this.updateCheckInterval);
  }

  /**
   * Stop automatic update checking
   */
  public stopUpdateChecking(): void {
    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer);
      this.updateCheckTimer = null;
    }
    this.updateCallback = undefined;
  }

  /**
   * Perform update check and notify callback
   */
  private async performUpdateCheck(): Promise<void> {
    try {
      const updateInfo = await this.checkForUpdates();
      
      if (this.updateCallback && updateInfo.hasUpdate) {
        this.updateCallback(updateInfo);
      }
    } catch (error) {
      console.warn('Update check failed:', error);
    }
  }

  /**
   * Set update check interval
   */
  public setUpdateCheckInterval(intervalMs: number): void {
    this.updateCheckInterval = intervalMs;
    
    // Restart checking with new interval if currently running
    if (this.updateCheckTimer) {
      this.stopUpdateChecking();
      this.startUpdateChecking(this.updateCallback);
    }
  }

  /**
   * Get version display string
   */
  public getVersionString(): string {
    const { version, buildTime, environment } = this.currentVersion;
    
    if (environment === 'development') {
      return `${version} (dev)`;
    }
    
    const buildDate = new Date(buildTime).toLocaleDateString();
    return `${version} (${buildDate})`;
  }

  /**
   * Get detailed version information for display
   */
  public getDetailedVersionInfo(): string {
    const { version, buildTime, commit, branch, environment } = this.currentVersion;
    
    const lines = [
      `Version: ${version}`,
      `Environment: ${environment}`,
      `Build Time: ${new Date(buildTime).toLocaleString()}`,
      `Branch: ${branch}`,
      `Commit: ${commit.substring(0, 8)}`
    ];
    
    return lines.join('\n');
  }

  /**
   * Check if running in development mode
   */
  public isDevelopment(): boolean {
    return this.currentVersion.environment === 'development';
  }

  /**
   * Check if running in production mode
   */
  public isProduction(): boolean {
    return this.currentVersion.environment === 'production';
  }

  /**
   * Compare two version strings
   */
  public static compareVersions(version1: string, version2: string): number {
    // Simple version comparison - in a real app you might want semver
    if (version1 === version2) return 0;
    
    // Handle development versions
    if (version1 === 'dev') return -1;
    if (version2 === 'dev') return 1;
    
    // For date-based versions (YYYY.MM.DD-hash), compare as strings
    return version1.localeCompare(version2);
  }

  /**
   * Format version for display
   */
  public static formatVersion(version: string): string {
    if (version === 'dev') {
      return 'Development';
    }
    
    // If it looks like a date-based version, format it nicely
    const dateMatch = version.match(/^(\d{4})\.(\d{2})\.(\d{2})-(.+)$/);
    if (dateMatch) {
      const [, year, month, day, hash] = dateMatch;
      return `${year}-${month}-${day} (${hash})`;
    }
    
    return version;
  }
}

// Global version manager instance
let globalVersionManager: VersionManager | null = null;

/**
 * Get the global version manager instance
 */
export function getVersionManager(): VersionManager {
  if (!globalVersionManager) {
    // Try to load version info from generated file
    let versionInfo: VersionInfo | undefined;
    
    try {
      // This will be replaced by the build process
      versionInfo = (window as any).__VERSION_INFO__;
    } catch (error) {
      // Fallback to default version info
    }
    
    globalVersionManager = new VersionManager(versionInfo);
  }
  
  return globalVersionManager;
}

/**
 * Initialize version manager with build-time information
 */
export function initializeVersionManager(versionInfo: VersionInfo): void {
  globalVersionManager = new VersionManager(versionInfo);
}