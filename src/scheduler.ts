import { ERROR } from './helpers';
import type { Cb, State } from './types';

/**
 * A class that manages a queue of tasks and their execution status.
 */
class Scheduler {
  readonly #queue: Array<Cb> = [];
  readonly #controller = new AbortController();
  #performeds = 0;
  #state: State = 'available';

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
   * - 'processing': The scheduler is currently processing a task.
   * - 'available': The scheduler is ready to process tasks.
   * - 'stopped': The scheduler has been stopped and will not process any more tasks.
   */
  get state() {
    return this.#state;
  }

  get #processing() {
    return this.#state === 'processing';
  }

  /**
   * Schedules a callback function for execution.
   * @param task of type {@linkcode Cb} The callback function to be scheduled for execution.
   */
  #schedule = (task: Cb) => {
    if (this.#processing) return this.#queue.push(task);
    return this.#process(task);
  };

  /**
   * Clears the task queue.
   */
  #clear = () => (this.#queue.length = 0);

  /**
   * Stops the scheduler by aborting any ongoing tasks, clearing the task queue,
   * and updating the status to 'stopped'.
   *
   * @returns {@linkcode Status} 'stopped'
   */
  stop = (): State => {
    if (this.#state === 'stopped') return this.#state;
    this.#controller.abort();
    this.#clear();
    return (this.#state = 'stopped');
  };

  /**
   * Flushes the task queue by processing each task sequentially.
   */
  #flush = async () => {
    let nextCallback = this.#queue.shift();
    while (nextCallback) {
      await this.#process(nextCallback);
      nextCallback = this.#queue.shift();
    }
  };

  /**
   * Immediately processes the callback function, updates the status,
   * and increments the performed count.
   *
   * @param callback of type {@linkcode Cb} The callback function to be executed immediately.
   */
  #processImmediate = async (callback: Cb) => {
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
          this.#state = 'available';
          return this.#flush();
        });
    }

    this.#performeds++;
    this.#state = 'available';
    return this.#flush();
  };

  /**
   * Processes the callback if the scheduler is in 'available' state.
   */
  #process = async (callback: Cb) => {
    if (this.#state === 'available') {
      this.#state = 'processing';
      await this.#processImmediate(callback);
    }
  };

  /**
   * Schedules a callback function for execution, with an option to execute it immediately.
   *
   * If `immediate` is `true` the callback bypasses the queue and runs right away.
   * Otherwise it is enqueued for sequential execution.
   *
   * @param callback The callback function to be scheduled.
   * @param immediate Whether the callback should bypass the queue.
   * @returns A promise that resolves when the callback has been processed.
   */
  schedule = async (callback: Cb, immediate = false) => {
    if (this.#state === 'stopped') this.#state = 'available';
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
