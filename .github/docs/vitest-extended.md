# @bemedev/vitest-extended

> Extensions to make writing tests with Vitest easier and more expressive.

## Installation

```sh
npm install @bemedev/vitest-extended
```

```sh
pnpm add @bemedev/vitest-extended
```

```sh
yarn add @bemedev/vitest-extended
```

---

## Imports

```ts
import {
  useTestFunctionAcceptation,
  useTFA, // Alias of useTestFunctionAcceptation
  createTests,
  doneTest,
  useEach,
  useEachAsync,
  createFakeWaiter,
} from '@bemedev/vitest-extended';
```

---

## API Reference

---

### `createTests(func, options?)`

The main utility to generate structured test suites for any function.

Returns an object with three methods:

| Method        | Description                                                    |
| ------------- | -------------------------------------------------------------- |
| `acceptation` | Checks that the function is defined and is actually a function |
| `success`     | Runs happy-path cases using strict equality                    |
| `fails`       | Runs error cases, asserting that the function rejects/throws   |

#### Signature

```ts
createTests<F extends Fn, T extends NextFn<F>>(
  func: F,
  args?: { transform?: T; toError?: ToError_F<F> },
): {
  acceptation: () => void;
  success: (...cases: TestArgs<F>) => () => void;
  fails:   (...cases: TestErrors<F>) => () => void;
}
```

#### Basic usage

```ts
import { createTests } from '@bemedev/vitest-extended';

const add = (a: number, b: number) => a + b;

describe('add', () => {
  const { acceptation, success } = createTests(add);

  acceptation();

  describe(
    '#success',
    success(
      { invite: '1 + 2 = 3', parameters: [1, 2], expected: 3 },
      { invite: '0 + 0 = 0', parameters: [0, 0], expected: 0 },
      { invite: '10 + 5 = 15', parameters: [10, 5], expected: 15 },
    ),
  );
});
```

#### With `transform`

Transform the return value before asserting equality.

```ts
import { createTests } from '@bemedev/vitest-extended';

const greet = (name: string) => `Hello, ${name}!`;

describe('greet', () => {
  const { success } = createTests(greet, {
    transform: result => result.toUpperCase(),
  });

  describe(
    '#success',
    success({
      invite: 'greets Alice',
      parameters: ['Alice'],
      expected: 'HELLO, ALICE!',
    }),
  );
});
```

#### With a custom `test` function per case

Each case accepts an optional `test` field for fine-grained assertions:

```ts
import { createTests } from '@bemedev/vitest-extended';

const add = (a: number, b: number) => a + b;

describe('add – custom assertion', () => {
  const { success } = createTests(add);

  describe(
    '#success',
    success({
      invite: '1 + 2, result should be less than 10',
      parameters: [1, 2],
      expected: 3,
      test: (value, _expected) => {
        expect(value).toBeLessThan(10);
      },
    }),
  );
});
```

#### With `fails`

Assert that the function throws / rejects.

```ts
import { createTests } from '@bemedev/vitest-extended';

const divide = (a: number, b: number) => {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
};

describe('divide', () => {
  const { fails } = createTests(divide);

  describe(
    '#fails',
    fails({
      invite: 'divide by zero',
      parameters: [1, 0],
      error: 'Division by zero',
    }),
  );
});
```

---

### `createTests.withImplementation(func, options)`

Use this variant when the function implementation is not available at the
time the test suite is declared (e.g. a lazy-loaded module or a class
instance created in `beforeAll`).

```ts
createTests.withImplementation<F, T>(
  f: F,
  {
    instanciation: () => Promise<F> | F;
    name: string;          // required because the name can't be inferred
    transform?: T;
    toError?: ToError_F<F>;
  },
)
```

#### Example

```ts
import { createTests } from '@bemedev/vitest-extended';

type Add_F = (a: number, b: number) => number;
const addImpl: Add_F = (a, b) => a + b;

// Intentionally undefined at declaration time
const addTest = undefined as unknown as Add_F;

describe('add – late binding', () => {
  const { success } = createTests.withImplementation(addTest, {
    instanciation: () => addImpl,
    name: 'add',
  });

  describe(
    '#success',
    success(
      { invite: '1 + 1 = 2', parameters: [1, 1], expected: 2 },
      { invite: '99 + 1 = 100', parameters: [99, 1], expected: 100 },
    ),
  );
});
```

---

### `useTestFunctionAcceptation(f, name?)` / `useTFA`

Generates two basic vitest tests to verify that a value:

1. is **defined**
2. is a **function**

```ts
useTestFunctionAcceptation(f: Fn, name?: string): void
```

#### Example

```ts
import { useTFA } from '@bemedev/vitest-extended';
import { myUtil } from './myUtil';

describe('myUtil', () => {
  useTFA(myUtil);
  // Produces:
  //   ✓ #1 => myUtil is defined
  //   ✓ #2 => myUtil is a function
});
```

---

### `useEach(func, transform?)`

An enhanced synchronous `test.each` that runs concurrent tests for a
function.

```ts
useEach<F extends Fn>(
  func: F,
  transform?: (result: ReturnType<F>) => any,
): (...cases: TestArgs<F>) => void
```

#### Example

```ts
import { useEach } from '@bemedev/vitest-extended';

const double = (n: number) => n * 2;
const runTests = useEach(double);

describe('double', () => {
  runTests(
    { invite: '2 * 2 = 4', parameters: [2], expected: 4 },
    { invite: '3 * 2 = 6', parameters: [3], expected: 6 },
  );
});
```

---

### `useEachAsync(func, transform?)`

Same as `useEach` but awaits the function result before asserting.

```ts
useEachAsync<F extends Fn>(
  func: F,
  transform?: (result: Awaited<ReturnType<F>>) => any,
): (...cases: TestArgs<F>) => void
```

#### Example

```ts
import { useEachAsync } from '@bemedev/vitest-extended';

const fetchValue = async (id: number) => ({ id, value: id * 10 });

const runTests = useEachAsync(fetchValue, r => r.value);

describe('fetchValue', () => {
  runTests(
    { invite: 'id 1 → 10', parameters: [1], expected: 10 },
    { invite: 'id 5 → 50', parameters: [5], expected: 50 },
  );
});
```

---

### `doneTest(invite, fn, options?)`

Creates a test that uses a `done` callback pattern (similar to Jest's
`done`).  
Internally it waits for `done()` to be called before the timeout expires.

```ts
doneTest(
  invite: string,
  fn: (done: () => void) => void,
  options?: number | TestOptions,   // default: 100 ms
): void
```

#### Variants

| Variant               | Description                |
| --------------------- | -------------------------- |
| `doneTest`            | Standard test              |
| `doneTest.fails`      | Expects the test to fail   |
| `doneTest.concurrent` | Runs the test concurrently |

#### Example

```ts
import { doneTest } from '@bemedev/vitest-extended';

doneTest(
  'fires callback after 50 ms',
  done => {
    setTimeout(() => done(), 50);
  },
  200,
);
```

---

### `createFakeWaiter(vi)`

Utility to advance fake timers (or real sleep) by a given number of
milliseconds a given number of times.

```ts
createFakeWaiter(vi: VitestUtils): (ms?: number, times?: number) => Promise<void>
```

#### Variants

| Variant                                     | Description                                  |
| ------------------------------------------- | -------------------------------------------- |
| `createFakeWaiter(vi)`                      | Returns `(ms, times) => Promise<void>`       |
| `createFakeWaiter.withDefaultDelay(vi, ms)` | Returns `(index, times) => [invite, fn]`     |
| `createFakeWaiter.all(vi)`                  | Returns `(index, ms, times) => [invite, fn]` |

#### Example

```ts
import { createFakeWaiter } from '@bemedev/vitest-extended';
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('advances fake timers', async () => {
  const wait = createFakeWaiter(vi);
  // advance 100 ms, 3 times (total 300 ms of fake time)
  await wait(100, 3);
});
```

---

## Type Reference

### `TestArgs<F>`

```ts
type TestArgs<F extends Fn> = ({
  invite: string;
  expected: Awaited<ReturnType<F>>;
  test?: (
    value: Awaited<ReturnType<F>>,
    expected: Awaited<ReturnType<F>>,
  ) => void;
} & SimpleParams<F>)[];
```

### `TestErrors<F>`

```ts
type TestErrors<F extends Fn> = ({
  invite: string;
  error?: string;
} & SimpleParams<F>)[];
```

### `SimpleParams<F>`

Handles zero, one, and many parameters automatically:

```ts
// 0 params  → parameters is optional / omitted
// 1 param   → parameters can be T or [T]
// N params  → parameters must be the full tuple [T1, T2, ...]
```

---

## Notes

- All `success` / `fails` tests run with `test.concurrent` for maximum
  speed.
- `createTests` uses **strict equality** (`===`) by default.
- A `transform` function lets you map the output before comparison, keeping
  the original function untouched.
- `createTests.withImplementation` internally calls `vi.fn()` and
  `beforeAll` to wire the real implementation at runtime.

---

## License

MIT — authored by Charles-Lévi BRI ([@chlbri](https://github.com/chlbri))
