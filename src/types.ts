/**
 * A callback function type that takes no arguments and returns void.
 *
 */
export type Cb = () => any | Promise<any>;

/**
 * Represents the status of the scheduler.
 *
 * @enum
 * - 'processing': The scheduler is currently processing a task.
 * - 'available': The scheduler is ready to process tasks.
 * - 'stopped': The scheduler has been stopped and will not process any more tasks.
 */
export type State = 'processing' | 'available' | 'stopped';
