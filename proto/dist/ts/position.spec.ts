import { expect, test } from "vitest";
import * as pb from "./index";

// just make sure it exists
test("pb.Rect create", () => {
  const f = pb.Rect.create();
  f.bottom = 100;
  expect(f.bottom).toBe(100);

  const dat = pb.Rect.encode(f).finish();
  const g = pb.Rect.decode(dat);
  expect(g.bottom).toBe(f.bottom);
});
