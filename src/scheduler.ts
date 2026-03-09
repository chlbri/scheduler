import { ERROR } from './helpers';
import type { Cb, Status } from './types';

/**
 * A class that manages a queue of tasks and their execution status.
 */
class Scheduler {
  readonly #queue: Array<Cb> = [];
  readonly #controller = new AbortController();
  #performeds = 0;
  #currentStatus: Status = 'idle';

  /**
   * Returns the number of tasks that have been performed.
   */
  get performeds() {
    return this.#performeds;
  }

  /**
   * Returns the current status of the scheduler.
   *
   * The status can be one of the following:
   * - 'idle': The scheduler is not initialized or processing any tasks.
   * - 'initialized': The scheduler has been initialized and is ready to process tasks.
   * - 'processing': The scheduler is currently processing a task.
   * - 'available': The scheduler is actively available on a task.
   * - 'stopped': The scheduler has been stopped and will not process any more tasks.
   */
  get status() {
    return this.#currentStatus;
  }

  /**
   * Returns a boolean indicating whether the scheduler is currently processing a task.
   *
   * The scheduler is considered to be processing if its current status is 'processing'.
   */
  get #processing() {
    return this.#currentStatus === 'processing';
  }

  start = (callback?: Cb): this => {
    const check = this.#currentStatus !== 'idle';
    if (check) return this;
    this.#currentStatus = 'initialized';

    if (callback) {
      this.#process(callback);
    }

    this.#flush();
    return this;
  };

  /**
   * Schedules a callback function for execution.
   * @param task of type {@linkcode Cb} The callback function to be scheduled for execution.
   */
  #schedule = (task: Cb) => {
    const check0 =
      this.#currentStatus === 'stopped' || this.#currentStatus === 'idle';
    if (check0) return;
    const check1 = this.#processing || this.#currentStatus === 'idle';
    if (check1) return this.#queue.push(task);
    return this.#process(task);
  };

  /**
   * Clears the task queue.
   * @returns 0
   */
  #clear = () => (this.#queue.length = 0);

  /**
   * Stops the scheduler by aborting any ongoing tasks, clearing the task queue, and updating the status to 'stopped'.
   *
   * @returns {@linkcode Status} 'stopped'
   */
  stop = (): Status => {
    const check =
      this.#currentStatus === 'stopped' || this.#currentStatus === 'idle';
    if (check) return this.#currentStatus;
    this.#controller.abort();
    this.#clear();
    return (this.#currentStatus = 'stopped');
  };

  /**
   * Flushes the task queue by processing each task sequentially.
   *
   * The method continues to process tasks until the queue is empty.
   */
  #flush = async () => {
    let nextCallback = this.#queue.shift();
    while (nextCallback) {
      await this.#process(nextCallback);
      nextCallback = this.#queue.shift();
    }
  };

  /**
   * Immediately processes the callback function, updates the status, and increments the performed count.
   *
   * @param callback of type {@linkcode Cb} The callback function to be executed immediately.
   */
  #processImmediate = async (callback: Cb) => {
    const check0 =
      this.#currentStatus === 'stopped' || this.#currentStatus === 'idle';
    if (check0) return;
    const result = callback();

    if (result instanceof Promise) {
      return Promise.race([
        result,
        new Promise((_, reject) =>
          this.#controller.signal.addEventListener('abort', () =>
            reject(ERROR),
          ),
        ),
      ])
        .catch(error => {
          if (error === ERROR) {
            this.stop();
            return;
          }
          throw error;
        })
        .finally(() => {
          this.#performeds++;
          this.#currentStatus = 'available';
          return this.#flush();
        });
    }

    this.#performeds++;
    this.#currentStatus = 'available';
    return this.#flush();
  };

  /**
   * Processes the callback function if the scheduler is in an appropriate state (either 'available' or 'initialized').
   *
   * If the scheduler is in the 'available' or 'initialized' state, it updates the status to 'processing', executes the callback function immediately, and waits for its completion before proceeding to the next task in the queue.
   * @param callback The callback function to be processed.
   */
  #process = async (callback: Cb) => {
    const check =
      this.#currentStatus === 'available' ||
      this.#currentStatus === 'initialized';

    if (check) {
      this.#currentStatus = 'processing';
      await this.#processImmediate(callback);
    }
  };

  /**
   * Schedules a callback function for execution, with an option to execute it immediately.
   *
   * If the `immediate` parameter is set to `true`, the callback function will be executed immediately, bypassing the task queue. Otherwise, it will be added to the task queue for sequential execution.
   * @param callback The callback function to be scheduled.
   * @param immediate A boolean flag indicating whether the callback should be executed immediately.
   * @returns A promise that resolves when the callback has been processed.
   */
  schedule = async (callback: Cb, immediate = false) => {
    return immediate
      ? this.#processImmediate(callback)
      : this.#schedule(callback);
  };
}

export type { Scheduler };

/**
 * Creates and returns a new instance of the `Scheduler` class.
 *
 * @see {@linkcode Scheduler}
 */
export const createScheduler = () => new Scheduler();
