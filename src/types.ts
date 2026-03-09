/**
 * A callback function type that takes no arguments and returns void.
 *
 */
export type Cb = () => any | Promise<any>;

/**
 * Represents the status of the scheduler.
 *
 * @enum
 * - 'idle': The scheduler is not initialized or processing any tasks.
 * - 'initialized': The scheduler has been initialized and is ready to process tasks.
 * - 'processing': The scheduler is currently processing a task.
 * - 'paused': The scheduler is paused and not processing tasks.
 * - 'available': The scheduler is actively available on a task.
 * - 'stopped': The scheduler has been stopped and will not process any more tasks.
 */
export type Status =
  | 'idle'
  | 'initialized'
  | 'processing'
  | 'available'
  | 'stopped';
