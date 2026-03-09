import sleep from '@bemedev/sleep';

export const makeCounter = () => {
  let _count = 0;
  const task = () => _count++;

  const asyncTaskWithTime = (ms = 0) => {
    return () => sleep(ms).then(() => _count++);
  };

  return {
    task,
    asyncTaskWithTime,
    get count() {
      return _count;
    },
  };
};

export const nothing = () => {};
