import { expect, test } from "vitest";

import { ObjectMap, ObjectMapKey } from "./objectMap";

test("ObjectMap", () => {
  const m = { a: 1, b: 2, c: 3 };
  const fn = (key: string, v: number) => v + 1;
  expect(ObjectMap(fn, {})).toEqual({});
  expect(ObjectMap(fn, m)).toEqual({ a: 2, b: 3, c: 4 });
});

test("ObjectMapKey", () => {
  const m = { a: 1, b: 2, c: 3 };
  const fn = (key: string, v: number): [string, number] => [`${key}a`, v + 1];
  expect(ObjectMapKey(fn, {})).toEqual({});
  expect(ObjectMapKey(fn, m)).toEqual({ aa: 2, ba: 3, ca: 4 });
});

test("ObjectMapKey with different type", () => {
  const m = { a: 1, b: 2, c: 3 };
  const fn = (key: string, v: number): [string, string] => [`${key}a`, key];
  expect(ObjectMapKey(fn, {})).toEqual({});
  expect(ObjectMapKey(fn, m)).toEqual({ aa: "a", ba: "b", ca: "c" });
});
