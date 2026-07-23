import { expect, test } from "bun:test";
import { Sheet } from "@okcontract/cells";

import { Environment } from "./env";
import { allDiff, firstDiff, isEqual } from "./equal";

test("isEqual", () => {
  expect(isEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBeTruthy();
  expect(isEqual({ a: 1, b: 2 }, { b: 2, a: 1, c: 2 })).toBeFalsy();
});

test("errors", () => {
  const err = new Error("foo");
  expect(isEqual(err, err)).toBeTruthy();
  expect(isEqual(err, new Error("foo"))).toBeTruthy();
});

test("undefined", () => {
  expect(isEqual(undefined, undefined)).toBeTruthy();
  expect(isEqual(undefined, null)).toBeFalsy();
  expect(isEqual(undefined, 1)).toBeFalsy();
  expect(isEqual(1, undefined)).toBeFalsy();
});

test("array", () => {
  expect(isEqual([], [])).toBeTruthy();
  expect(isEqual([], null)).toBeFalsy();
  expect(isEqual([1, 2, 3], [1, 2, 3])).toBeTruthy();
  expect(isEqual([1, 2, 3, 4], [1, 2, 3])).toBeFalsy();
  expect(isEqual([1, 2, 3], [1, 2, 3, 4])).toBeFalsy();
  expect(isEqual([1, 2, [1, 2, 3]], [1, 2, [1, 2, 3]])).toBeTruthy();
});

test("cells", () => {
  const proxy = new Sheet().newProxy();
  const a = proxy.new(1);
  expect(isEqual(1, a)).toBeFalsy();
  const b = proxy.new(1);
  expect(isEqual(a, b)).toBeFalsy();
});

test("env", () => {
  const proxy = new Sheet().newProxy();
  const v = proxy.new(1);
  const w = proxy.new(1);
  const a = new Environment(proxy, { values: { v } });
  const b = new Environment(proxy, { values: { v } });
  const c = new Environment(proxy, { values: { w } });
  expect(isEqual(a, b)).toBeTruthy();
  expect(isEqual(b, c)).toBeFalsy();
});

test("set deep equality", () => {
  const a = new Set([{ id: 1 }, { nested: [1, 2, 3] }]);
  const b = new Set([{ nested: [1, 2, 3] }, { id: 1 }]);
  const c = new Set([{ id: 1 }, { nested: [1, 2, 4] }]);
  expect(isEqual(a, b)).toBeTruthy();
  expect(isEqual(a, c)).toBeFalsy();
});

test("set deep equality with duplicate deep-equal values", () => {
  const a = new Set([{ id: 1 }, { id: 1 }]);
  const b = new Set([{ id: 1 }, { id: 1 }]);
  const c = new Set([{ id: 1 }, { id: 2 }]);
  expect(isEqual(a, b)).toBeTruthy();
  expect(isEqual(a, c)).toBeFalsy();
});

test("map deep equality", () => {
  const a = new Map<unknown, unknown>([
    [{ id: 1 }, { nested: [1, 2, 3] }],
    ["tags", new Set([{ value: 1 }])]
  ]);
  const b = new Map<unknown, unknown>([
    ["tags", new Set([{ value: 1 }])],
    [{ id: 1 }, { nested: [1, 2, 3] }]
  ]);
  const c = new Map<unknown, unknown>([
    ["tags", new Set([{ value: 1 }])],
    [{ id: 1 }, { nested: [1, 2, 4] }]
  ]);
  expect(isEqual(a, b)).toBeTruthy();
  expect(isEqual(a, c)).toBeFalsy();
});

test("map deep equality with duplicate deep-equal keys", () => {
  const a = new Map<unknown, unknown>([
    [{ id: 1 }, "one"],
    [{ id: 1 }, "two"]
  ]);
  const b = new Map<unknown, unknown>([
    [{ id: 1 }, "two"],
    [{ id: 1 }, "one"]
  ]);
  const c = new Map<unknown, unknown>([
    [{ id: 1 }, "one"],
    [{ id: 1 }, "three"]
  ]);
  expect(isEqual(a, b)).toBeTruthy();
  expect(isEqual(a, c)).toBeFalsy();
});

test("set diffs", () => {
  const a = new Set([{ count: 1 }]);
  const b = new Set([{ count: 2 }]);
  expect(firstDiff(a, b)).toBe(
    "Set value difference: Key 'count' difference: Value difference: 1 vs 2"
  );
  expect(allDiff(a, b)).toEqual([
    "/Set value difference: Key 'count' difference: Value difference: 1 vs 2"
  ]);
});

test("map diffs", () => {
  const a = new Map([["count", { total: 1 }]]);
  const b = new Map([["count", { total: 2 }]]);
  expect(firstDiff(a, b)).toBe(
    "Map value for key \"count\": Key 'total' difference: Value difference: 1 vs 2"
  );
  expect(allDiff(a, b)).toEqual([
    '/Map value for key "count"/total/Value: 1 vs 2'
  ]);
});
