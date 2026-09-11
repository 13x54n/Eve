import { OfflineStorage } from "./offline-storage";

export type QueuedAction = {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  retries: number;
  maxRetries: number;
  expiresAt?: number;
};

type ActionHandler = (payload: unknown) => Promise<void>;

export class ActionQueue {
  private handlers = new Map<string, ActionHandler>();
  private processing = false;
  private queue: QueuedAction[] = [];

  async initialize(): Promise<void> {
    const stored = await OfflineStorage.get<QueuedAction[]>("PENDING_ACTIONS");
    if (stored) {
      const now = Date.now();
      this.queue = stored.filter(
        (action) => !action.expiresAt || action.expiresAt > now,
      );
      if (this.queue.length !== stored.length) {
        await this.persistQueue();
      }
    }
  }

  registerHandler(type: string, handler: ActionHandler): void {
    this.handlers.set(type, handler);
  }

  async enqueue(
    type: string,
    payload: unknown,
    options: {
      maxRetries?: number;
      expiryMs?: number;
    } = {},
  ): Promise<string> {
    const action: QueuedAction = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: options.maxRetries ?? 3,
      expiresAt: options.expiryMs
        ? Date.now() + options.expiryMs
        : undefined,
    };

    this.queue.push(action);
    await this.persistQueue();

    return action.id;
  }

  async process(isOnline: boolean): Promise<void> {
    if (!isOnline || this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      const now = Date.now();
      const validActions = this.queue.filter(
        (action) => !action.expiresAt || action.expiresAt > now,
      );

      if (validActions.length !== this.queue.length) {
        this.queue = validActions;
        await this.persistQueue();
      }

      for (let i = 0; i < this.queue.length; i++) {
        const action = this.queue[i];
        const handler = this.handlers.get(action.type);

        if (!handler) {
          console.warn(
            `[ActionQueue] No handler registered for action type: ${action.type}`,
          );
          this.queue.splice(i, 1);
          i--;
          continue;
        }

        try {
          await handler(action.payload);
          this.queue.splice(i, 1);
          i--;
          console.log(`[ActionQueue] Successfully processed action: ${action.id}`);
        } catch (error) {
          console.error(
            `[ActionQueue] Error processing action ${action.id}:`,
            error,
          );
          action.retries++;

          if (action.retries >= action.maxRetries) {
            console.error(
              `[ActionQueue] Max retries reached for action ${action.id}, removing from queue`,
            );
            this.queue.splice(i, 1);
            i--;
          }
        }
      }

      await this.persistQueue();
    } finally {
      this.processing = false;
    }
  }

  async clear(): Promise<void> {
    this.queue = [];
    await OfflineStorage.remove("PENDING_ACTIONS");
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getQueue(): ReadonlyArray<QueuedAction> {
    return [...this.queue];
  }

  private async persistQueue(): Promise<void> {
    try {
      await OfflineStorage.set("PENDING_ACTIONS", this.queue);
    } catch (error) {
      console.error("[ActionQueue] Failed to persist queue:", error);
    }
  }
}

export const actionQueue = new ActionQueue();
