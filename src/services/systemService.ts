/**
 * System Service for J.A.R.V.I.S.
 * Handles system commands like opening applications
 * Requires the local server to be running (node server/index.js)
 */

const SERVER_URL = 'http://localhost:3001';

interface OpenAppResponse {
  success?: boolean;
  app?: string;
  error?: string;
}

interface HealthResponse {
  status: string;
  message: string;
}

interface AppsResponse {
  apps: string[];
  count: number;
}

class SystemService {
  private isServerOnline: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds

  /**
   * Check if the local server is running
   */
  async checkServerHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${SERVER_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });
      
      if (response.ok) {
        const data: HealthResponse = await response.json();
        this.isServerOnline = data.status === 'online';
        this.lastHealthCheck = Date.now();
        return this.isServerOnline;
      }
    } catch (error) {
      this.isServerOnline = false;
    }
    return false;
  }

  /**
   * Get server status (with caching)
   */
  async getServerStatus(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastHealthCheck > this.healthCheckInterval) {
      return this.checkServerHealth();
    }
    return this.isServerOnline;
  }

  /**
   * Open an application
   */
  async openApplication(appName: string): Promise<{ success: boolean; message: string }> {
    try {
      // First check if server is available
      const serverOnline = await this.checkServerHealth();
      
      if (!serverOnline) {
        return {
          success: false,
          message: `I'm unable to access system commands. Please ensure the JARVIS server is running by executing: node server/index.js`,
        };
      }

      const response = await fetch(`${SERVER_URL}/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ app: appName }),
      });

      const data: OpenAppResponse = await response.json();

      if (data.success) {
        return {
          success: true,
          message: `Opening ${data.app || appName} for you now.`,
        };
      } else {
        return {
          success: false,
          message: data.error || `Unable to open ${appName}. The application may not be installed.`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `I encountered an error while trying to open ${appName}. Please ensure the JARVIS server is running.`,
      };
    }
  }

  /**
   * Get list of available applications
   */
  async getAvailableApps(): Promise<string[]> {
    try {
      const response = await fetch(`${SERVER_URL}/apps`);
      const data: AppsResponse = await response.json();
      return data.apps || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Parse a message to detect if it's an app-opening command
   * Returns the app name if detected, null otherwise
   */
  parseOpenCommand(message: string): string | null {
    const normalizedMessage = message.toLowerCase().trim();
    
    // Common patterns for opening apps
    const patterns = [
      /^open\s+(.+)$/i,
      /^launch\s+(.+)$/i,
      /^start\s+(.+)$/i,
      /^run\s+(.+)$/i,
      /^execute\s+(.+)$/i,
      /^open up\s+(.+)$/i,
      /^fire up\s+(.+)$/i,
      /^boot up\s+(.+)$/i,
      /^can you open\s+(.+)$/i,
      /^please open\s+(.+)$/i,
      /^i want to open\s+(.+)$/i,
      /^i need\s+(.+)$/i,
      /^show me\s+(.+)$/i,
      /^bring up\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = normalizedMessage.match(pattern);
      if (match && match[1]) {
        // Clean up the app name
        let appName = match[1].trim();
        
        // Remove trailing punctuation
        appName = appName.replace(/[.,!?]+$/, '');
        
        // Remove common filler words
        appName = appName.replace(/^(the|a|an|my)\s+/i, '');
        appName = appName.replace(/\s+(app|application|program|software)$/i, '');
        appName = appName.replace(/\s+(please|now|for me)$/i, '');
        
        return appName.trim();
      }
    }

    return null;
  }

  /**
   * Check if a message is a system command
   */
  isSystemCommand(message: string): boolean {
    return this.parseOpenCommand(message) !== null;
  }
}

// Export singleton instance
export const systemService = new SystemService();
export default systemService;



