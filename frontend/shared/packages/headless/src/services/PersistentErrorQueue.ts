/**
 * Persistent Error Queue
 *
 * Provides offline-capable error storage with automatic synchronization.
 * Errors are stored in LocalStorage and automatically uploaded when online.
 */

import { StandardErrorResponse } from "../types/error-contract";

export interface QueuedError {
  error: StandardErrorResponse;
  queued_at: string;
  retry_count: number;
  last_retry_at?: string;
}

export interface ErrorQueueConfig {
  /** Maximum number of errors to store */
  maxQueueSize: number;
  /** Maximum age of errors in milliseconds (default: 24 hours) */
  maxAge: number;
  /** Endpoint to send errors to */
  errorEndpoint?: string;
  /** Whether to automatically sync when online */
  autoSync: boolean;
  /** Sync interval in milliseconds (default: 60 seconds) */
  syncInterval: number;
  /** Maximum number of retry attempts per error */
  maxRetries: number;
}

const DEFAULT_CONFIG: ErrorQueueConfig = {
  maxQueueSize: 100,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  autoSync: true,
  syncInterval: 60 * 1000, // 1 minute
  maxRetries: 3,
};

const STORAGE_KEY = "dotmac_error_queue";

export class PersistentErrorQueue {
  private config: ErrorQueueConfig;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private isOnline: boolean = typeof navigator !== "undefined" ? navigator.onLine : true;

  constructor(config: Partial<ErrorQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (typeof window !== "undefined") {
      // Listen for online/offline events
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);

      // Start auto-sync if configured
      if (this.config.autoSync) {
        this.startAutoSync();
      }
    }
  }

  /**
   * Add an error to the queue
   */
  public enqueue(error: StandardErrorResponse): void {
    if (typeof localStorage === "undefined") {
      console.warn("LocalStorage not available, error will not be persisted");
      return;
    }

    const queue = this.loadQueue();

    // Check queue size limit
    if (queue.length >= this.config.maxQueueSize) {
      // Remove oldest error
      queue.shift();
    }

    // Add new error
    const queuedError: QueuedError = {
      error,
      queued_at: new Date().toISOString(),
      retry_count: 0,
    };

    queue.push(queuedError);
    this.saveQueue(queue);

    // Try immediate sync if online
    if (this.isOnline && this.config.autoSync) {
      this.sync().catch((err) => {
        console.error("Failed to sync error queue:", err);
      });
    }
  }

  /**
   * Get all queued errors
   */
  public getQueue(): QueuedError[] {
    return this.loadQueue();
  }

  /**
   * Get count of queued errors
   */
  public getQueueSize(): number {
    return this.loadQueue().length;
  }

  /**
   * Clear all queued errors
   */
  public clear(): void {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Manually trigger sync
   */
  public async sync(): Promise<void> {
    if (!this.config.errorEndpoint) {
      console.warn("No error endpoint configured, skipping sync");
      return;
    }

    if (this.isSyncing) {
      console.log("Sync already in progress, skipping");
      return;
    }

    if (!this.isOnline) {
      console.log("Offline, skipping sync");
      return;
    }

    this.isSyncing = true;

    try {
      const queue = this.loadQueue();

      if (queue.length === 0) {
        return;
      }

      // Clean up expired errors
      const now = new Date().getTime();
      const validQueue = queue.filter((item) => {
        const queuedAt = new Date(item.queued_at).getTime();
        return now - queuedAt < this.config.maxAge;
      });

      // Separate errors that haven't exceeded retry limit
      const retryableErrors = validQueue.filter(
        (item) => item.retry_count < this.config.maxRetries,
      );

      if (retryableErrors.length === 0) {
        // Only expired or max-retry errors left, clear them
        this.saveQueue([]);
        return;
      }

      // Send errors in batch
      const response = await fetch(this.config.errorEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          errors: retryableErrors.map((item) => item.error),
          batch_id: `batch_${Date.now()}`,
        }),
      });

      if (response.ok) {
        // Successfully sent, remove from queue
        this.clear();
        console.log(`Successfully synced ${retryableErrors.length} errors`);
      } else {
        // Failed to send, increment retry count
        const updatedQueue = retryableErrors.map((item) => ({
          ...item,
          retry_count: item.retry_count + 1,
          last_retry_at: new Date().toISOString(),
        }));
        this.saveQueue(updatedQueue);
        console.warn(`Failed to sync errors: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Error during sync:", error);

      // Increment retry count for all errors
      const queue = this.loadQueue();
      const updatedQueue = queue.map((item) => ({
        ...item,
        retry_count: item.retry_count + 1,
        last_retry_at: new Date().toISOString(),
      }));
      this.saveQueue(updatedQueue);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Start automatic synchronization
   */
  public startAutoSync(): void {
    if (this.syncIntervalId !== null) {
      return; // Already started
    }

    this.syncIntervalId = setInterval(() => {
      this.sync().catch((err) => {
        console.error("Auto-sync failed:", err);
      });
    }, this.config.syncInterval);
  }

  /**
   * Stop automatic synchronization
   */
  public stopAutoSync(): void {
    if (this.syncIntervalId !== null) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Destroy the queue and clean up
   */
  public destroy(): void {
    this.stopAutoSync();

    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
  }

  /**
   * Load queue from LocalStorage
   */
  private loadQueue(): QueuedError[] {
    if (typeof localStorage === "undefined") {
      return [];
    }

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return [];
      }

      const queue = JSON.parse(data) as QueuedError[];
      return Array.isArray(queue) ? queue : [];
    } catch (error) {
      console.error("Failed to load error queue:", error);
      return [];
    }
  }

  /**
   * Save queue to LocalStorage
   */
  private saveQueue(queue: QueuedError[]): void {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error("Failed to save error queue:", error);

      // If storage is full, try to clear old errors
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        // Keep only the most recent half
        const halfQueue = queue.slice(Math.floor(queue.length / 2));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(halfQueue));
        } catch {
          // If still fails, give up
          console.error("Storage quota exceeded, unable to save errors");
        }
      }
    }
  }

  /**
   * Handle online event
   */
  private handleOnline = (): void => {
    console.log("Connection restored, syncing error queue");
    this.isOnline = true;

    // Trigger immediate sync
    this.sync().catch((err) => {
      console.error("Failed to sync on reconnection:", err);
    });
  };

  /**
   * Handle offline event
   */
  private handleOffline = (): void => {
    console.log("Connection lost, errors will be queued");
    this.isOnline = false;
  };
}

// Singleton instance
let globalQueue: PersistentErrorQueue | null = null;

/**
 * Get the global error queue instance
 */
export function getErrorQueue(config?: Partial<ErrorQueueConfig>): PersistentErrorQueue {
  if (globalQueue === null) {
    globalQueue = new PersistentErrorQueue(config);
  }
  return globalQueue;
}

/**
 * Reset the global error queue (mainly for testing)
 */
export function resetErrorQueue(): void {
  if (globalQueue !== null) {
    globalQueue.destroy();
    globalQueue = null;
  }
}
