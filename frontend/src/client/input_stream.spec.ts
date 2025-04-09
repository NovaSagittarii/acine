import { expect, test } from 'vitest';
import { InputEvent } from 'acine-proto-dist';
import { handleInputEvent as handleEvent, open } from './input_stream';

/**
 * strings that represent some type of input event
 */
type P = NonNullable<InputEvent['type']>['$case'];

let t = 0;
function getInputEvent(s: P = 'move') {
  let e = InputEvent.create({
    timestamp: t++,
  });
  switch (s) {
    case 'move':
      e.type = {
        $case: 'move',
        move: { x: 0, y: 0 },
      };
      break;
    case 'mouseUp':
      e.type = {
        $case: 'mouseUp',
        mouseUp: 0,
      };
      break;
    case 'mouseDown':
      e.type = {
        $case: 'mouseDown',
        mouseDown: 0,
      };
      break;
  }
  return e;
}

test('open and close', async () => {
  const f = open();
  f.close();
  expect(await f.getContents()).toStrictEqual([]);
});

test('1 event via insert', async () => {
  const f = open();
  const x1 = getInputEvent();
  f.insert(x1);
  f.close();
  expect(await f.getContents()).toStrictEqual([x1]);
});

test('3 events via insert', async () => {
  const f = open();
  const a = new Array(3).fill(0).map(getInputEvent);
  for (const x of a) f.insert(x);
  f.close();
  expect(await f.getContents()).toStrictEqual(a);
});

test('1 event via handleEvent', async () => {
  const f = open();
  const x1 = getInputEvent();
  handleEvent(x1);
  f.close();
  expect(await f.getContents()).toStrictEqual([x1]);
});

test('3 events via handleEvent', async () => {
  const f = open();
  const a = new Array(3).fill(0).map(getInputEvent);
  for (const x of a) handleEvent(x);
  f.close();
  expect(await f.getContents()).toStrictEqual(a);
});

test('2 listeners with partial overlap', async () => {
  async function runInBackground() {
    expect(await f.getContents()).toStrictEqual(a.slice(0, 7));
    expect(await g.getContents()).toStrictEqual(a.slice(3, 9));
  }
  const a = new Array(9).fill(0).map(getInputEvent);
  const f = open();
  for (let i = 0; i < 3; ++i) handleEvent(a[i]);
  const g = open();
  runInBackground();
  for (let i = 3; i < 7; ++i) handleEvent(a[i]);
  f.close();
  for (let i = 7; i < 9; ++i) handleEvent(a[i]);
  g.close();
  expect(await f.getContents()).toStrictEqual(a.slice(0, 7));
  expect(await g.getContents()).toStrictEqual(a.slice(3, 9));
});

test('noHover flag', async () => {
  const a = new Array(12)
    .fill(12)
    .map((_, i) =>
      getInputEvent((['move', 'mouseDown', 'move', 'mouseUp'] as P[])[i % 4]),
    );
  const f = open();
  a.map(handleEvent);
  f.close({ noHover: true });
  expect(await f.getContents()).toStrictEqual(a.filter((_, i) => i % 4 != 0));
});
