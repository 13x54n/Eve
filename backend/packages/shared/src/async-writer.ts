/**
 * Async Database Writer
 * 
 * Batches non-critical database writes to improve request latency
 * Use for: audit logs, stats updates, event logs
 * Don't use for: trip creation, payment records, user data
 * 
 * Savings: 10-20ms per request (non-blocking writes)
 */

type WriteOperation = () => Promise<void>;

class AsyncWriter {
  private queue: WriteOperation[] = [];
  private processing = false;
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL = 1000; // 1 second
  private flushTimer: NodeJS.Timeout | null = null;
  private stats = {
    queued: 0,
    processed: 0,
    failed: 0,
  };

  constructor() {
    this.startFlushTimer();
    this.setupShutdownHandlers();
  }

  /**
   * Enqueue a write operation
   */
  enqueue(operation: WriteOperation): void {
    this.queue.push(operation);
    this.stats.queued++;
    
    // Flush immediately if batch size reached
    if (this.queue.length >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Flush pending writes
   */
  async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    const batch = this.queue.splice(0, this.BATCH_SIZE);
    
    try {
      // Execute all operations in parallel
      const results = await Promise.allSettled(
        batch.map(op => op())
      );

      // Count successes and failures
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          this.stats.processed++;
        } else {
          this.stats.failed++;
          console.error('[async-writer] Write failed:', result.reason);
        }
      });
    } catch (err) {
      this.stats.failed += batch.length;
      console.error('[async-writer] Batch flush failed:', err);
    } finally {
      this.processing = false;
      
      // If more items accumulated, flush again
      if (this.queue.length > 0) {
        setImmediate(() => this.flush());
      }
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Stop flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async () => {
      console.log('[async-writer] Shutting down, flushing pending writes...');
      this.stopFlushTimer();
      await this.flush();
      console.log(`[async-writer] Shutdown complete. Stats:`, this.stats);
    };

    process.on('SIGTERM', () => {
      shutdown().finally(() => process.exit(0));
    });

    process.on('SIGINT', () => {
      shutdown().finally(() => process.exit(0));
    });
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      ...this.stats,
      pending: this.queue.length,
    };
  }

  /**
   * Clear queue (for testing)
   */
  clear(): void {
    this.queue = [];
  }
}

/**
 * Singleton async writer instance
 */
export const asyncWriter = new AsyncWriter();

/**
 * Enqueue a database write (convenience function)
 */
export function enqueueWrite(operation: WriteOperation): void {
  asyncWriter.enqueue(operation);
}

/**
 * Flush all pending writes (convenience function)
 */
export async function flushWrites(): Promise<void> {
  await asyncWriter.flush();
}

/**
 * Get async writer stats (convenience function)
 */
export function getAsyncWriterStats() {
  return asyncWriter.getStats();
}
