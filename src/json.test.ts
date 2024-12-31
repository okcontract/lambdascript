import { beforeAll, expect, test } from "vitest";

import { jsonStringify } from "@okcontract/cells";

import { NameApplication, NameConstant, NameVariable } from "./ast";
import { parseNode } from "./json";
import { Rational } from "./rational";

import { toEqualWithRationals } from "./extend.test";
beforeAll(() => {
  toEqualWithRationals();
});

test("output is fine", () => {
  const v = {
    type: NameApplication,
    function: { type: NameVariable, name: "+" },
    params: [
      { type: NameConstant, value: "-123/1000" },
      { type: NameConstant, value: "100" }
    ]
  };
  const exp = {
    type: NameApplication,
    function: { type: NameVariable, name: "+" },
    params: [
      {
        type: "const",
        value: new Rational([123n, 1000n, true])
      },
      {
        type: "const",
        value: "100"
      }
    ]
  };
  expect(parseNode(v)).toEqual(exp);
});

const values: unknown[] = [
  1,
  "hello, world",
  '"and"',
  ['"and"'],
  {},
  [true, false],
  { foo: 1, bar: "charlie" },
  [1, 2, 3],
  { foo: [1, 2, 3], bar: { foo: 1, bar: "charlie" } }
  // 100n, // @todo returns "100" which is correct but we need to adapt the test
];

test("json_stringify re-parse", async () => {
  for (const v of values) {
    expect(JSON.parse(jsonStringify(v))).toEqual(v);
  }
});

test("json_stringify order", () => {
  expect(jsonStringify({ a: 1, b: "bar" })).toBe(
    jsonStringify({ b: "bar", a: 1 })
  );
  expect(jsonStringify({ a: { c: 100, z: 1 }, b: "bar" })).toBe(
    jsonStringify({ b: "bar", a: { z: 1, c: 100 } })
  );
});

test("json_stringify undefined", () => {
  expect(jsonStringify({ a: 1, b: undefined })).toBe(jsonStringify({ a: 1 }));
});
