import { expect, test } from 'vitest';
import * as pb from './index';

// just make sure the frame exists
test('pb.Frame create', () => {
  const f = pb.Frame.create();
  f.id = 1;
  f.data = new Uint8Array(4);
  console.log(f);
  expect(f.id).toBe(1);
  expect(f.data.length).toBe(4);

  const dat = pb.Frame.encode(f).finish();
  const g = pb.Frame.decode(dat);
  expect(g.id).toBe(f.id);
  expect(g.data).toStrictEqual(f.data);
});
