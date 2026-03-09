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

  test('#02 => initial status is "available"', () => {
    expect(scheduler.state).toBe('available');
  });

  test('#03 => initial performeds is 0', () => {
    expect(scheduler.performeds).toBe(0);
  });
});

describe('#02 => first schedule', () => {
  describe('#01 => no callback', () => {
    const scheduler = createScheduler();

    test('#01 => status is "available"', () => {
      expect(scheduler.state).toBe('available');
    });

    test('#02 => performeds is 0', () => {
      expect(scheduler.performeds).toBe(0);
    });
  });

  describe('#02 => with a sync callback', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#00 => initial counter.count is 0', () => {
      expect(counter.count).toBe(0);
    });

    test('#01 => schedule with callback', () => {
      scheduler.schedule(counter.task);
    });

    test('#02 => status is "available"', () => {
      expect(scheduler.state).toBe('available');
    });

    test('#03 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#04 => performeds is 1', () =>
      expect(scheduler.performeds).toBe(1));

    describe('#05 => second call increments again', () => {
      test('#01 => schedule again', () => {
        scheduler.schedule(counter.task);
      });

      test('#02 => status remains "available"', () => {
        expect(scheduler.state).toBe('available');
      });

      test('#03 => counter.count is 2', () => {
        expect(counter.count).toBe(2);
      });

      test('#04 => performeds is 2', () => {
        expect(scheduler.performeds).toBe(2);
      });
    });
  });

  describe('#03 => with an async callback', () => {
    const scheduler = createScheduler();
    let resolved = false;

    test('#01 => schedule async callback', () => {
      scheduler.schedule(async () => {
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
      expect(scheduler.state).toBe('available');
    });
  });

  describe('#04 => tasks are flushed FIFO', () => {
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

    test('#04 => order is [1, 2, 3]', () => {
      expect(order).toEqual([1, 2, 3]);
    });

    test('#05 => performeds is 3', () => {
      expect(scheduler.performeds).toBe(3);
    });
  });
});

describe('#03 => stop', () => {
  describe('#01 => status is "stopped" after stop()', () => {
    const scheduler = createScheduler();
    let result: ReturnType<typeof scheduler.stop>;

    test('#01 => schedule seed', () => scheduler.schedule(nothing));
    test('#02 => stop', () => (result = scheduler.stop()));

    test('#03 => result is "stopped"', () => {
      expect(result).toBe('stopped');
    });

    test('#04 => status is "stopped"', () => {
      expect(scheduler.state).toBe('stopped');
    });
  });

  describe('#02 => stop on fresh scheduler', () => {
    const scheduler = createScheduler();

    test('#00 => status is "available" before stop', () => {
      expect(scheduler.state).toBe('available');
    });

    test('#01 => stop', scheduler.stop);

    test('#02 => status is "stopped"', () => {
      expect(scheduler.state).toBe('stopped');
    });
  });

  describe('#04 => schedule after stop reactivates and processes (non-immediate)', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#01 => schedule seed', () => scheduler.schedule(nothing));
    test('#02 => stop', scheduler.stop);

    test('#03 => schedule', () => {
      scheduler.schedule(counter.task);
    });

    test('#04 => status is "available"', () =>
      expect(scheduler.state).toBe('available'));

    test('#05 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#06 => performeds is 2 (seed + counter)', () => {
      expect(scheduler.performeds).toBe(2);
    });
  });

  describe('#05 => schedule after stop reactivates (two calls)', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#01 => stop', scheduler.stop);
    test('#02 => schedule 1 (reactivates)', () =>
      scheduler.schedule(counter.task));
    test('#03 => schedule 2', () => scheduler.schedule(counter.task));
    test('#04 => counter.count is 2', () => expect(counter.count).toBe(2));

    test('#05 => performeds is 2', () => {
      expect(scheduler.performeds).toBe(2);
    });
  });
});

describe('#04 => schedule (immediate = false)', () => {
  describe('#01 => from "available" state', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#00 => status is "available"', () => {
      expect(scheduler.state).toBe('available');
    });

    test('#01 => schedule', () => scheduler.schedule(counter.task));
    test('#02 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#03 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });

    test('#04 => status is "available"', () => {
      expect(scheduler.state).toBe('available');
    });
  });

  describe('#02 => second schedule from "available" state', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#01 => schedule seed', () => scheduler.schedule(nothing));

    test('#00 => status is "available"', () => {
      expect(scheduler.state).toBe('available');
    });

    test('#02 => schedule', () => scheduler.schedule(counter.task));
    test('#03 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#04 => performeds is 2 (seed + counter)', () => {
      return expect(scheduler.performeds).toBe(2);
    });

    test('#05 => status is "available"', () => {
      expect(scheduler.state).toBe('available');
    });
  });

  describe('#03 => task queued while "processing" is flushed afterwards', () => {
    const scheduler = createScheduler();
    const order: number[] = [];

    test('#01 => schedule first task', () => {
      scheduler.schedule(() => order.push(0));
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

    test('#01 => schedule seed', () => scheduler.schedule(nothing));

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
    const WAITING = 3000;

    describe('#01 => rejects with a string', () => {
      const scheduler = createScheduler();
      let resolved = false;
      let expectation: () => void;

      test('#01 => create expectation', () => {
        scheduler.schedule(nothing);
        const asyncTask = async () => {
          await new Promise<void>((_, r) =>
            setTimeout(() => r('str'), WAITING),
          );
          resolved = true;
        };
        scheduler.schedule(asyncTask).catch(e => {
          expectation = () => expect(e).toBe('str');
        });
      });

      test('#02 => Performeds is "1"', () => {
        expect(scheduler.performeds).toBe(1);
      });

      test('#03 => await', () => waiter(WAITING));

      test('#04 => performeds is now 2, even error', () => {
        expect(scheduler.performeds).toBe(2);
      });

      test('#05 => resolved is still false', () => {
        expect(resolved).toBeFalsy();
      });

      test('#06 => throws "str":(string)', () => expectation());
    });

    describe('#02 => rejects with an Error', () => {
      const scheduler = createScheduler();
      let resolved = false;
      let expectationType: () => void;
      let expectationMessage: () => void;

      test('#01 => create expectation', () => {
        scheduler.schedule(nothing);

        const asyncTask = async () => {
          await new Promise<void>((_, r) =>
            setTimeout(() => r(new Error('none')), WAITING),
          );
          resolved = true;
        };

        scheduler.schedule(asyncTask).catch(e => {
          expectationType = () => expect(e).toBeInstanceOf(Error);
          expectationMessage = () => expect(e.message).toBe('none');
        });
      });

      test('#02 => Performeds is "1"', () => {
        expect(scheduler.performeds).toBe(1);
      });

      test('#03 => await', () => waiter(WAITING));

      test('#04 => performeds is now 2, even error', () => {
        expect(scheduler.performeds).toBe(2);
      });

      test('#05 => resolved is still false', () => {
        expect(resolved).toBeFalsy();
      });

      describe('#06 => throws "none":(Error)', () => {
        test('#01 => is an Error', () => expectationType());
        test('#02 => message is "none"', () => expectationMessage());
      });
    });
  });
});

describe('#05 => schedule (immediate = true)', () => {
  describe('#01 => task runs immediately from "available" state', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#01 => schedule immediate', () => {
      scheduler.schedule(counter.task, true);
    });

    test('#02 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#03 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });

    test('#04 => status is "available"', () => {
      expect(scheduler.state).toBe('available');
    });
  });

  describe('#02 => async task in immediate mode', () => {
    const scheduler = createScheduler();
    let resolved = false;

    const asyncTask = async () => {
      await new Promise<void>(r => setTimeout(r, 10));
      resolved = true;
    };

    test('#01 => schedule async immediate', () => {
      scheduler.schedule(asyncTask, true);
    });

    test('#02 => performeds is 0 before awaiting', () => {
      expect(scheduler.performeds).toBe(0);
    });

    test('#03 => resolved is false before awaiting', () => {
      expect(resolved).toBe(false);
    });

    test('#04 => await 10ms', () => waiter(10));
    test('#05 => resolved is true', () => expect(resolved).toBe(true));

    test('#06 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });
  });

  describe('#03 => immediate schedule after stopped reactivates and processes', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();
    test('#01 => stop', scheduler.stop);

    test('#02 => schedule immediate', () => {
      scheduler.schedule(counter.task, true);
    });

    test('#03 => status is "available"', () =>
      expect(scheduler.state).toBe('available'));

    test('#04 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#05 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });
  });

  describe('#04 => immediate schedule before stopped', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#01 => schedule immediate', () => {
      scheduler.schedule(counter.task, true);
    });

    test('#02 => stop', scheduler.stop);
    test('#03 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#04 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });
  });

  describe('#05 => async not fully waited before stop', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#01 => schedule async immediate (300ms)', () => {
      scheduler.schedule(counter.asyncTaskWithTime(300), true);
    });

    test('#00 => counter.count is 0 immediately', () => {
      expect(counter.count).toBe(0);
    });

    test('#02 => await 50ms', () => waiter(50));
    test('#03 => stop', scheduler.stop);

    test('#04 => counter.count is still 0', () => {
      expect(counter.count).toBe(0);
    });

    test('#05 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });

    test('#06 => await remaining time', () => waiter(500));
  });

  describe('#06 => async fully waited before stop', () => {
    const scheduler = createScheduler();
    const counter = makeCounter();

    test('#01 => schedule async immediate (100ms)', () => {
      scheduler.schedule(counter.asyncTaskWithTime(100), true);
    });

    test('#00 => counter.count is 0 before awaiting', () =>
      expect(counter.count).toBe(0));

    test('#02 => await 100ms', async () => {
      await waiter(100);
    });

    test('#03 => stop', scheduler.stop);

    test('#04 => status is "stopped"', () => {
      expect(scheduler.state).toBe('stopped');
    });

    test('#05 => counter.count is 1', () => expect(counter.count).toBe(1));

    test('#06 => performeds is 1', () => {
      expect(scheduler.performeds).toBe(1);
    });
  });
});

describe('#06 => Status transitions, test processing status', () => {
  const scheduler = createScheduler();
  const statusDuringTask: string[] = [];

  const longTask = async () => {
    await sleep(5000);
    return statusDuringTask.push(scheduler.state);
  };

  test('#01 => schedule seed', () => scheduler.schedule(nothing));

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

  test('#01 => schedule seed', () => scheduler.schedule(nothing));

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

    test('#01 => schedule seed', () => scheduler.schedule(nothing));

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
      expect(scheduler.state).toBe('processing');
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
      expect(scheduler.state).toBe('available');
    });
  });

  describe('#02 => many schedulers are independent', () => {
    const a = createScheduler();
    const b = createScheduler();

    test('#01 => schedule on a with seed', () => a.schedule(nothing));
    test('#02 => schedule on b', () => b.schedule(nothing));

    test('#03 => a.performeds is 1', () => expect(a.performeds).toBe(1));
    test('#04 => b.performeds is 1', () => expect(b.performeds).toBe(1));

    test('#05 => a.status is "available"', () => {
      expect(a.state).toBe('available');
    });

    test('#06 => b.status is "available"', () => {
      expect(b.state).toBe('available');
    });
  });

  describe('#03 => stop on already-stopped scheduler is idempotent', () => {
    const scheduler = createScheduler();
    test('#01 => first stop', scheduler.stop);
    test('#02 => second stop', scheduler.stop);

    test('#03 => status is "stopped"', () => {
      expect(scheduler.state).toBe('stopped');
    });

    test('#04 => performeds is 0', () => {
      expect(scheduler.performeds).toBe(0);
    });
  });
});
