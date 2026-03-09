import sleep from '@bemedev/sleep';
import { createFakeWaiter, createTests } from '@bemedev/vitest-extended';
import { makeCounter, nothing } from './fixtures';
import { createScheduler } from './scheduler';

vi.useFakeTimers();
const waiter = createFakeWaiter(vi);

describe('#01 => createScheduler', () => {
  const { acceptation } = createTests(createScheduler);
  describe('#00 => Acceptation', acceptation);
  const scheduler = createScheduler();

  test('#01 => returns an object', () => {
    expect(typeof scheduler).toBe('object');
    expect(scheduler).toBeDefined();
  });

  test('#02 => initial status is "idle"', () => {
    expect(scheduler.status).toBe('idle');
  });

  test('#03 => initial performeds is 0', () => {
    expect(scheduler.performeds).toBe(0);
  });
});

describe('#02 => start', () => {
  test('#01 => status is "initialized" after start (no callback, empty queue)', async () => {
    const scheduler = createScheduler();
    scheduler.start();
    expect(scheduler.status).toBe('initialized');
    expect(scheduler.performeds).toBe(0);
  });

  test('#02 => status becomes "available" after start with a callback', async () => {
    const scheduler = createScheduler();
    const counter = makeCounter();
    scheduler.start(counter.task);
    expect(scheduler.status).toBe('available');
    expect(counter.count).toBe(1);
    expect(scheduler.status).toBe('available');
    expect(scheduler.performeds).toBe(1);
    scheduler.start(counter.task);
    expect(scheduler.status).toBe('available');
    expect(counter.count).toBe(1);
    expect(scheduler.status).toBe('available');
    expect(scheduler.performeds).toBe(1);
  });

  test('#03 => start with an async callback awaits completion', async () => {
    const scheduler = createScheduler();
    let resolved = false;

    scheduler.start(async () => {
      await Promise.resolve();
      resolved = true;
    });

    expect(resolved).toBe(false);
    await waiter(0);
    expect(resolved).toBe(true);
    expect(scheduler.performeds).toBe(1);
    expect(scheduler.status).toBe('available');
  });

  test('#04 => tasks queued before start are not flushed on start', async () => {
    const scheduler = createScheduler();
    const order: number[] = [];
    scheduler.schedule(() => order.push(1));
    scheduler.schedule(() => order.push(2));
    scheduler.schedule(() => order.push(3));
    scheduler.start();
    expect(order).toEqual([]);
    expect(scheduler.performeds).toBe(0);
  });

  test('#05 => tasks queued after start are flushed (FIFO)', async () => {
    const scheduler = createScheduler();
    const order: number[] = [];
    scheduler.start();
    scheduler.schedule(() => order.push(1));
    scheduler.schedule(() => order.push(2));
    scheduler.schedule(() => order.push(3));
    expect(order).toEqual([1, 2, 3]);
    expect(scheduler.performeds).toBe(3);
  });
});

describe('#03 => stop', () => {
  test('#01 => stop() returns "stopped"', () => {
    const scheduler = createScheduler();
    scheduler.start();
    const result = scheduler.stop();
    expect(result).toBe('stopped');
  });

  test('#02 => status is "stopped" after stop()', () => {
    const scheduler = createScheduler();
    scheduler.start();
    scheduler.stop();
    expect(scheduler.status).toBe('stopped');
  });

  test('#03 => stop cannot be called before start', () => {
    const scheduler = createScheduler();
    expect(scheduler.status).toBe('idle');
    scheduler.stop();
    expect(scheduler.status).toBe('idle');
  });

  test('#04 => schedule after stop is a no-op (non-immediate)', async () => {
    const scheduler = createScheduler();
    scheduler.start();
    scheduler.stop();
    const counter = makeCounter();
    scheduler.schedule(counter.task);
    expect(counter.count).toBe(0);
    expect(scheduler.performeds).toBe(0);
  });

  test('#05 => stop clears any pending queue entries', async () => {
    const scheduler = createScheduler();
    const counter = makeCounter();
    scheduler.schedule(counter.task);
    scheduler.schedule(counter.task);
    scheduler.stop();
    scheduler.start(); // start is now a no-op (not idle)
    expect(counter.count).toBe(0);
    expect(scheduler.performeds).toBe(0);
  });
});

describe('#04 => schedule (immediate = false)', () => {
  test('#01 => task is executed after scheduling from "initialized" state', () => {
    const scheduler = createScheduler();
    scheduler.start();
    expect(scheduler.status).toBe('initialized');
    const counter = makeCounter();
    scheduler.schedule(counter.task);
    expect(counter.count).toBe(1);
    expect(scheduler.performeds).toBe(1);
    expect(scheduler.status).toBe('available');
  });

  test('#02 => task is executed after scheduling from "available" state', () => {
    const scheduler = createScheduler();
    scheduler.start(/* seed task */ () => {});
    expect(scheduler.status).toBe('available');
    const counter = makeCounter();
    scheduler.schedule(counter.task);
    expect(counter.count).toBe(1);
    expect(scheduler.performeds).toBe(2); // seed + counter
  });

  test('#03 => task queued while "processing" is flushed afterwards', async () => {
    const scheduler = createScheduler();
    const order: number[] = [];
    scheduler.start(() => order.push(0));
    scheduler.schedule(() => order.push(1));
    expect(order).toEqual([0, 1]);
    expect(scheduler.performeds).toBe(2);
  });

  test('#04 => async task is properly awaited before next task runs', async () => {
    const scheduler = createScheduler();
    scheduler.start(() => {}); // seed → available
    let resolved = false;
    const asyncTask = async () => {
      await new Promise<void>(r => setTimeout(r, 20));
      resolved = true;
    };
    scheduler.schedule(asyncTask);
    expect(scheduler.performeds).toBe(1);
    expect(resolved).toBe(false);
    await waiter(20);
    expect(resolved).toBe(true);
    expect(scheduler.performeds).toBe(2);
  });

  describe('#05 => async task rejects', () => {
    let resolved = false;
    const WAITING = 3000;
    test('#01 => async task rejects, throw undefined', async () => {
      const action = async () => {
        const scheduler = createScheduler();
        scheduler.start(() => {}); // seed → available
        const asyncTask = async () => {
          await new Promise<void>((_, r) =>
            setTimeout(() => r('str'), WAITING),
          );
          resolved = true;
        };
        return scheduler.schedule(asyncTask);
      };

      const expectation = expect(action).rejects.toThrow('str');
      await waiter(WAITING);
      expect(resolved).toBeFalsy();
      return expectation;
    });

    test('#02 => async task rejects, throw Error', async () => {
      const action = async () => {
        const scheduler = createScheduler();
        scheduler.start(() => {}); // seed → available
        const asyncTask = async () => {
          await new Promise<void>((_, r) =>
            setTimeout(() => r(new Error('none')), WAITING),
          );
          resolved = true;
        };
        return scheduler.schedule(asyncTask);
      };

      const expectation = expect(action).rejects.toThrowError('none');
      await waiter(WAITING);
      expect(resolved).toBeFalsy();
      return expectation;
    });
  });
});

describe('#05 => schedule (immediate = true)', () => {
  test('#01 => task runs immediately when status is "idle"', async () => {
    const scheduler = createScheduler();
    scheduler.start();
    const counter = makeCounter();
    scheduler.schedule(counter.task, true);
    expect(counter.count).toBe(1);
    expect(scheduler.performeds).toBe(1);
    expect(scheduler.status).toBe('available');
  });

  test('#02 => async task in immediate mode is properly awaited', async () => {
    const scheduler = createScheduler();
    scheduler.start(); // "initialized"
    let resolved = false;

    const asyncTask = async () => {
      await new Promise<void>(r => setTimeout(r, 10));
      resolved = true;
    };

    scheduler.schedule(asyncTask, true);
    expect(scheduler.performeds).toBe(0);
    expect(resolved).toBe(false);
    await waiter(10);
    expect(scheduler.performeds).toBe(1);
  });

  test('#03 => no immediate schedule after stopped', async () => {
    const scheduler = createScheduler();
    scheduler.start();
    scheduler.stop();
    const counter = makeCounter();
    scheduler.schedule(counter.task, true);
    expect(counter.count).toBe(0);
    expect(scheduler.performeds).toBe(0);
  });

  test('#04 => immediate schedule before stopped', async () => {
    const scheduler = createScheduler().start();
    const counter = makeCounter();
    scheduler.schedule(counter.task, true);
    scheduler.stop();
    expect(counter.count).toBe(1);
    expect(scheduler.performeds).toBe(1);
  });

  test('#05 => immediate schedule before stopped, async not fully waited, the action is not performed', async () => {
    const scheduler = createScheduler().start();
    const counter = makeCounter();
    scheduler.schedule(counter.asyncTaskWithTime(300), true);
    expect(counter.count).toBe(0);
    await waiter(50);
    scheduler.stop();
    expect(counter.count).toBe(0);
    expect(scheduler.performeds).toBe(0);
    await waiter(500);
  });

  test('#06 => immediate schedule before stopped, async fully waited, the action is not performed', async () => {
    const scheduler = createScheduler();
    scheduler.start();
    const counter = makeCounter();
    scheduler.schedule(counter.asyncTaskWithTime(100), true);
    expect(counter.count).toBe(0);
    await waiter(100);
    scheduler.stop();
    expect(scheduler.status).toBe('stopped');
    expect(counter.count).toBe(1);
    expect(scheduler.performeds).toBe(1);
  });
});

test('#06 => Status transitions, test processing status', async () => {
  const scheduler = createScheduler();
  scheduler.start(() => {}); // seed → available
  const statusDuringTask: string[] = [];

  const longTask = async () => {
    await sleep(5000);
    return statusDuringTask.push(scheduler.status);
  };

  scheduler.schedule(longTask);
  await waiter(5000);
  expect(statusDuringTask[0]).toBe('processing');
});

test('#07 => Queue behaviour, FIFO order (10 tasks)', () => {
  const scheduler = createScheduler();
  scheduler.start(() => {}); // seed → available
  const order: number[] = [];
  const N = 10;

  Array.from({ length: N }).forEach((_, i) =>
    scheduler.schedule(() => order.push(i)),
  );

  expect(order).toEqual(Array.from({ length: N }, (_, i) => i));
  expect(scheduler.performeds).toBe(N + 1); // seed + N
});

describe('#08 => Edge cases', () => {
  test('#01 => scheduler handles a single task cleanly', async () => {
    const scheduler = createScheduler();
    const mock = vi.fn();
    scheduler.start(nothing); // seed
    scheduler.schedule(nothing);
    scheduler.schedule(async () => {
      await sleep(10);
      mock('A SYNC TASK DONE');
    });
    scheduler.schedule(() => {
      mock('SYNC 4');
    });
    scheduler.schedule(() => {
      mock('SYNC 5');
    });
    expect(scheduler.performeds).toBe(2);
    expect(scheduler.status).toBe('processing');
    expect(mock).toHaveBeenCalledTimes(0);
    await waiter(10);
    expect(mock).toHaveBeenCalledTimes(3);
    expect(mock).toHaveBeenNthCalledWith(1, 'A SYNC TASK DONE');
    expect(mock).toHaveBeenNthCalledWith(2, 'SYNC 4');
    expect(mock).toHaveBeenNthCalledWith(3, 'SYNC 5');
    expect(scheduler.performeds).toBe(5);
    expect(scheduler.status).toBe('available');
  });

  test('#02 => many schedulers are independent', async () => {
    const a = createScheduler();
    const b = createScheduler();
    a.start(nothing);
    b.start();

    {
      b.schedule(nothing);
    }

    expect(a.performeds).toBe(1);
    expect(b.performeds).toBe(1);
    expect(a.status).toBe('available');
    expect(b.status).toBe('available');
  });

  test('#02 => stop on already-stopped scheduler is idempotent', () => {
    const scheduler = createScheduler();
    scheduler.start();
    scheduler.stop();
    scheduler.stop();
    expect(scheduler.status).toBe('stopped');
    expect(scheduler.performeds).toBe(0);
  });
});
