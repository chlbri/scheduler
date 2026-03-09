import { ERROR } from './helpers';
import { Cb } from './types';

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
type Status =
  | 'idle'
  | 'initialized'
  | 'processing'
  | 'available'
  | 'stopped';

/**
 * A class that manages a queue of tasks and their execution status.
 */
class Scheduler {
  #queue: Array<Cb> = [];

  #performeds = 0;

  get performeds() {
    return this.#performeds;
  }

  #currentStatus: Status = 'idle';

  /* v8 ignore next 3*/
  get status() {
    return this.#currentStatus;
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

  get #processing() {
    return this.#currentStatus === 'processing';
  }

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

  #clear = () => (this.#queue = []);

  stop = (): Status => {
    const check =
      this.#currentStatus === 'stopped' || this.#currentStatus === 'idle';
    if (check) return this.#currentStatus;
    this.#controller.abort();
    this.#clear();
    return (this.#currentStatus = 'stopped');
  };

  #flush = async () => {
    let nextCallback = this.#queue.shift();
    while (nextCallback) {
      await this.#process(nextCallback);
      nextCallback = this.#queue.shift();
    }
  };

  readonly #controller = new AbortController();

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

  schedule = (callback: Cb, immediate = false) => {
    return immediate
      ? this.#processImmediate(callback)
      : this.#schedule(callback);
  };

  #process = async (callback: Cb) => {
    const check =
      this.#currentStatus === 'available' ||
      this.#currentStatus === 'initialized';

    if (check) {
      this.#currentStatus = 'processing';
      await this.#processImmediate(callback);
    }
  };
}

export type { Scheduler };
export const createScheduler = () => new Scheduler();
