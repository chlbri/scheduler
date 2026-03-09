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

  describe('#01 => returns an object', () => {
    test('#01 => is an object', () => {
      expect(typeof scheduler).toBe('object');
    });

    test('#02 => is defined', () => expect(scheduler).toBeDefined());
  });

  test('#02 => initial status is "idle"', () => {
    expect(scheduler.status).toBe('idle');
  });

  test('#03 => initial performeds is 0', () => {
    expect(scheduler.performeds).toBe(0);
  });
});

describe('#02 => start', () => {
  describe('#01 => no callback, empty queue', () => {
    const scheduler = createScheduler();

    test('#01 => start', () => {
      scheduler.start();
    });

    test('#02 => status is "initialized"', () => {
      expect(scheduler.status).toBe('initialized');
    });

    test('#03 => performeds is 0', () => {
      expect(scheduler.performeds).toBe(0);
    });
  });

  describe('#02 => with a sync callback', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#00 => initial counter.count is 0', () => {
      expect(counter.count).toBe(0);
    });

    test('#01 => start with callback', () => {
      scheduler.start(counter.task);
    });

    test('#02 => status is "available"', () => {
      expect(scheduler.status).toBe('available');
    });

    test('#03 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#04 => performeds is 1', () =>
      expect(scheduler.performeds).toBe(1));

    describe('#05 => second call is idempotent', () => {
      test('#01 => restart', () => {
        scheduler.start(counter.task);
      });

      test('#02 => status remains "available"', () => {
        expect(scheduler.status).toBe('available');
      });

      test('#03 => counter.count is still 1', () => {
        expect(counter.count).toBe(1);
      });

      test('#04 => performeds is still 1', () => {
        expect(scheduler.performeds).toBe(1);
      });
    });
  });

  describe('#03 => with an async callback', () => {
    const scheduler = createScheduler();
    let resolved = false;

    test('#01 => start with async callback', () => {
      scheduler.start(async () => {
        await Promise.resolve();
        resolved = true;
      });
    });

    test('#02 => await', async () => {
      await waiter(0);
    });

    test('#03 => resolved is true', () => expect(resolved).toBe(true));

    test('#04 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });

    test('#05 => status is "available"', () => {
      expect(scheduler.status).toBe('available');
    });
  });

  describe('#04 => tasks queued before start are not flushed', () => {
    const scheduler = createScheduler();
    const order: number[] = [];

    test('#01 => schedule 1', () => {
      scheduler.schedule(() => order.push(1));
    });

    test('#02 => schedule 2', () => {
      scheduler.schedule(() => order.push(2));
    });

    test('#03 => schedule 3', () => {
      scheduler.schedule(() => order.push(3));
    });

    test('#04 => start', () => scheduler.start());
    test('#05 => order is empty', () => expect(order).toEqual([]));

    test('#06 => performeds is 0', () => {
      expect(scheduler.performeds).toBe(0);
    });
  });

  describe('#05 => tasks queued after start are flushed (FIFO)', () => {
    const scheduler = createScheduler();
    const order: number[] = [];

    test('#01 => start', () => scheduler.start());

    test('#02 => schedule 1', () => {
      scheduler.schedule(() => order.push(1));
    });

    test('#03 => schedule 2', () => {
      scheduler.schedule(() => order.push(2));
    });

    test('#04 => schedule 3', () => {
      scheduler.schedule(() => order.push(3));
    });

    test('#05 => order is [1, 2, 3]', () => {
      expect(order).toEqual([1, 2, 3]);
    });

    test('#06 => performeds is 3', () => {
      expect(scheduler.performeds).toBe(3);
    });
  });
});

describe('#03 => stop', () => {
  describe('#01 => stop() returns "stopped"', () => {
    const scheduler = createScheduler();
    let result: ReturnType<typeof scheduler.stop>;

    test('#01 => start', () => scheduler.start());

    test('#02 => stop', () => (result = scheduler.stop()));

    test('#03 => result is "stopped"', () => {
      expect(result).toBe('stopped');
    });
  });

  describe('#02 => status is "stopped" after stop()', () => {
    const scheduler = createScheduler();

    test('#01 => start', () => scheduler.start());
    test('#02 => stop', scheduler.stop);

    test('#03 => status is "stopped"', () => {
      expect(scheduler.status).toBe('stopped');
    });
  });

  describe('#03 => stop cannot be called before start', () => {
    const scheduler = createScheduler();

    test('#00 => status is "idle" before stop', () => {
      expect(scheduler.status).toBe('idle');
    });

    test('#01 => stop', scheduler.stop);

    test('#02 => status is still "idle"', () => {
      expect(scheduler.status).toBe('idle');
    });
  });

  describe('#04 => schedule after stop is a no-op (non-immediate)', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#01 => start', () => scheduler.start());
    test('#02 => stop', scheduler.stop);

    test('#03 => schedule', () => {
      scheduler.schedule(counter.task);
    });

    test('#04 => counter.count is 0', () => expect(counter.count).toBe(0));

    test('#05 => performeds is 0', () => {
      expect(scheduler.performeds).toBe(0);
    });
  });

  describe('#05 => stop clears any pending queue entries', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();
    test('#01 => schedule 1', () => scheduler.schedule(counter.task));
    test('#02 => schedule 2', () => scheduler.schedule(counter.task));
    test('#03 => stop', scheduler.stop);
    test('#04 => start (no-op)', () => scheduler.start());
    test('#05 => counter.count is 0', () => expect(counter.count).toBe(0));

    test('#06 => performeds is 0', () => {
      expect(scheduler.performeds).toBe(0);
    });
  });
});

describe('#04 => schedule (immediate = false)', () => {
  describe('#01 => from "initialized" state', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#01 => start', () => scheduler.start());

    test('#00 => status is "initialized"', () => {
      expect(scheduler.status).toBe('initialized');
    });

    test('#02 => schedule', () => scheduler.schedule(counter.task));
    test('#03 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#04 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });

    test('#05 => status is "available"', () => {
      expect(scheduler.status).toBe('available');
    });
  });

  describe('#02 => from "available" state', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#01 => start with seed', () => scheduler.start(() => {}));

    test('#00 => status is "available"', () => {
      expect(scheduler.status).toBe('available');
    });

    test('#02 => schedule', () => scheduler.schedule(counter.task));
    test('#03 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#04 => performeds is 2 (seed + counter)', () => {
      return expect(scheduler.performeds).toBe(2);
    });

    test('#05 => status is "available"', () => {
      expect(scheduler.status).toBe('available');
    });
  });

  describe('#03 => task queued while "processing" is flushed afterwards', () => {
    const scheduler = createScheduler();
    const order: number[] = [];

    test('#01 => start with first task', () => {
      scheduler.start(() => order.push(0));
    });

    test('#02 => schedule second task', () => {
      scheduler.schedule(() => order.push(1));
    });

    test('#03 => order is [0, 1]', () => expect(order).toEqual([0, 1]));

    test('#04 => performeds is 2', () => {
      expect(scheduler.performeds).toBe(2);
    });
  });

  describe('#04 => async task is properly awaited before next task runs', () => {
    const scheduler = createScheduler();
    let resolved = false;
    const asyncTask = async () => {
      await new Promise<void>(r => setTimeout(r, 20));
      resolved = true;
    };

    test('#01 => start with seed', () => scheduler.start(() => {}));

    test('#02 => schedule async task', () => {
      scheduler.schedule(asyncTask);
    });

    test('#03 => performeds is 1 (seed only)', () => {
      expect(scheduler.performeds).toBe(1);
    });

    test('#04 => resolved is false', () => expect(resolved).toBe(false));
    test('#05 => await 20ms', () => waiter(20));
    test('#06 => resolved is true', () => expect(resolved).toBe(true));

    test('#07 => performeds is 2', () => {
      expect(scheduler.performeds).toBe(2);
    });
  });

  describe('#05 => async task rejects', () => {
    let resolved = false;
    const WAITING = 3000;

    test('#01 => rejects with a string', async () => {
      const action = async () => {
        const scheduler = createScheduler();
        scheduler.start(() => {});
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

    test('#02 => rejects with an Error', async () => {
      const action = async () => {
        const scheduler = createScheduler();
        scheduler.start(() => {});
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
  describe('#01 => task runs immediately from "initialized" state', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#01 => start', () => scheduler.start());

    test('#02 => schedule immediate', () => {
      scheduler.schedule(counter.task, true);
    });

    test('#03 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#04 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });

    test('#05 => status is "available"', () => {
      expect(scheduler.status).toBe('available');
    });
  });

  describe('#02 => async task in immediate mode', () => {
    const scheduler = createScheduler();
    let resolved = false;

    const asyncTask = async () => {
      await new Promise<void>(r => setTimeout(r, 10));
      resolved = true;
    };

    test('#01 => start', () => scheduler.start());

    test('#02 => schedule async immediate', () => {
      scheduler.schedule(asyncTask, true);
    });

    test('#03 => performeds is 0 before awaiting', () => {
      expect(scheduler.performeds).toBe(0);
    });

    test('#04 => resolved is false before awaiting', () => {
      expect(resolved).toBe(false);
    });

    test('#05 => await 10ms', () => waiter(10));
    test('#06 => resolved is true', () => expect(resolved).toBe(true));

    test('#07 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });
  });

  describe('#03 => no immediate schedule after stopped', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();
    test('#01 => start', () => scheduler.start());
    test('#02 => stop', scheduler.stop);

    test('#03 => schedule immediate', () => {
      scheduler.schedule(counter.task, true);
    });

    test('#04 => counter.count is 0', () => expect(counter.count).toBe(0));

    test('#05 => performeds is 0', () => {
      expect(scheduler.performeds).toBe(0);
    });
  });

  describe('#04 => immediate schedule before stopped', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();
    test('#01 => start', () => scheduler.start());

    test('#02 => schedule immediate', () => {
      scheduler.schedule(counter.task, true);
    });

    test('#03 => stop', scheduler.stop);
    test('#04 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#05 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });
  });

  describe('#05 => async not fully waited before stop', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#01 => start', () => scheduler.start());

    test('#02 => schedule async immediate (300ms)', () => {
      scheduler.schedule(counter.asyncTaskWithTime(300), true);
    });

    test('#00 => counter.count is 0 immediately', () => {
      expect(counter.count).toBe(0);
    });

    test('#03 => await 50ms', () => waiter(50));
    test('#04 => stop', scheduler.stop);

    test('#05 => counter.count is still 0', () => {
      expect(counter.count).toBe(0);
    });

    test('#06 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });

    test('#07 => await remaining time', () => waiter(500));
  });

  describe('#06 => async fully waited before stop', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#01 => start', () => scheduler.start());

    test('#02 => schedule async immediate (100ms)', () => {
      scheduler.schedule(counter.asyncTaskWithTime(100), true);
    });

    test('#00 => counter.count is 0 before awaiting', () =>
      expect(counter.count).toBe(0));

    test('#03 => await 100ms', async () => {
      await waiter(100);
    });

    test('#04 => stop', scheduler.stop);

    test('#05 => status is "stopped"', () => {
      expect(scheduler.status).toBe('stopped');
    });

    test('#06 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#07 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });
  });
});

describe('#06 => Status transitions, test processing status', () => {
  const scheduler = createScheduler();
  const statusDuringTask: string[] = [];

  const longTask = async () => {
    await sleep(5000);
    return statusDuringTask.push(scheduler.status);
  };

  test('#01 => start with seed', () => scheduler.start(() => {}));

  test('#02 => schedule long task', () => {
    scheduler.schedule(longTask);
  });

  test('#03 => await 5000ms', () => waiter(5000));

  test('#04 => status during task was "processing"', () => {
    expect(statusDuringTask[0]).toBe('processing');
  });
});

describe('#07 => Queue behaviour, FIFO order (10 tasks)', () => {
  const scheduler = createScheduler();
  const order: number[] = [];
  const N = 10;

  test('#01 => start with seed', () => scheduler.start(() => {}));

  test('#02 => schedule 10 tasks', () => {
    Array.from({ length: N }).forEach((_, i) =>
      scheduler.schedule(() => order.push(i)),
    );
  });

  test('#03 => order is [0..9]', () => {
    expect(order).toEqual(Array.from({ length: N }, (_, i) => i));
  });

  test('#04 => performeds is N + 1 (seed + N)', () => {
    expect(scheduler.performeds).toBe(N + 1);
  });
});

describe('#08 => Edge cases', () => {
  describe('#01 => mixed sync and async tasks', () => {
    const scheduler = createScheduler();
    const mock = vi.fn();

    test('#01 => start with seed', () => scheduler.start(nothing));

    test('#02 => schedule nothing', () => {
      scheduler.schedule(nothing);
    });

    test('#03 => schedule async task', () => {
      scheduler.schedule(async () => {
        await sleep(10);
        mock('A SYNC TASK DONE');
      });
    });

    test('#04 => schedule sync task 4', () => {
      scheduler.schedule(() => {
        mock('SYNC 4');
      });
    });

    test('#05 => schedule sync task 5', () => {
      scheduler.schedule(() => {
        mock('SYNC 5');
      });
    });

    test('#06 => performeds is 2', () => {
      expect(scheduler.performeds).toBe(2);
    });

    test('#07 => status is "processing"', () => {
      expect(scheduler.status).toBe('processing');
    });

    test('#08 => mock not yet called', () => {
      expect(mock).toHaveBeenCalledTimes(0);
    });

    test('#09 => await 10ms', () => waiter(10));

    test('#10 => mock called 3 times', () => {
      expect(mock).toHaveBeenCalledTimes(3);
    });

    test('#11 => mock 1st call', () => {
      expect(mock).toHaveBeenNthCalledWith(1, 'A SYNC TASK DONE');
    });

    test('#12 => mock 2nd call', () => {
      expect(mock).toHaveBeenNthCalledWith(2, 'SYNC 4');
    });

    test('#13 => mock 3rd call', () => {
      expect(mock).toHaveBeenNthCalledWith(3, 'SYNC 5');
    });

    test('#14 => performeds is 5', () => {
      expect(scheduler.performeds).toBe(5);
    });

    test('#15 => status is "available"', () => {
      expect(scheduler.status).toBe('available');
    });
  });

  describe('#02 => many schedulers are independent', () => {
    const a = createScheduler();
    const b = createScheduler();

    test('#01 => start a with seed', () => a.start(nothing));
    test('#02 => start b', () => b.start());

    test('#03 => schedule on b', () => {
      b.schedule(nothing);
    });

    test('#04 => a.performeds is 1', () => expect(a.performeds).toBe(1));
    test('#05 => b.performeds is 1', () => expect(b.performeds).toBe(1));

    test('#06 => a.status is "available"', () => {
      expect(a.status).toBe('available');
    });

    test('#07 => b.status is "available"', () => {
      expect(b.status).toBe('available');
    });
  });

  describe('#03 => stop on already-stopped scheduler is idempotent', () => {
    const scheduler = createScheduler();
    test('#01 => start', () => scheduler.start());
    test('#02 => first stop', scheduler.stop);
    test('#03 => second stop', scheduler.stop);

    test('#04 => status is "stopped"', () => {
      expect(scheduler.status).toBe('stopped');
    });

    test('#05 => performeds is 0', () => {
      expect(scheduler.performeds).toBe(0);
    });
  });
});
