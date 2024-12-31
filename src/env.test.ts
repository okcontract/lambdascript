import { writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it, test } from "vitest";

import { Debugger, Sheet, SheetProxy, uncellify } from "@okcontract/cells";

import { Environment } from "./env";
import { isEqual } from "./equal";
import { parseExpression } from "./parse";
import { Program } from "./program";
import { Rational } from "./rational";
import { defaultLibrary } from "./stdlib";

import { toEqualWithRationals } from "./extend.test";
beforeAll(() => {
  toEqualWithRationals();
});

const sheet = new Sheet(isEqual);

test("env withValue", async () => {
  const proxy = new SheetProxy(sheet);
  const env = new Environment(proxy);
  const env2 = env.withValue("x", proxy.new("foo"));
  expect(env2.value("x").get()).resolves.toBe("foo");
});

test("evaluate string", async () => {
  const proxy = new SheetProxy(sheet);
  const env = new Environment(proxy);
  const result = await env.evaluateStringValue("1+1");
  // console.log({ computed_in_test: result });
  expect(isEqual(result, new Rational(2))).toBe(true);
});

test("evaluate string array", async () => {
  const proxy = new SheetProxy(sheet);
  const env = new Environment(proxy);
  const val = await env.evaluateStringArrayToValues(["1+1", "2*2"]);
  const exp = [new Rational(2), new Rational(4)];
  expect(isEqual(val, exp)).toBe(true);
});

test("case insensitive values", async () => {
  const proxy = new SheetProxy(sheet);
  const env = new Environment(proxy);
  await env.addExpression("test", await parseExpression("10"));
  expect(env.case("test")).toBe("test");
  for (const s of ["test", "Test", "TEST"])
    await expect(env.evaluateStringValue(s)).resolves.toEqual(new Rational(10));
  await env.addExpression("TEST", await parseExpression("11"));
  expect(env.case("TEST")).toBe("test");
  for (const s of ["test", "Test", "TEST"])
    await expect(env.evaluateStringValue(s)).resolves.toEqual(new Rational(11));
});

describe("eval programs", async () => {
  const progs: [string[], { [key: string]: unknown }, string][] = [
    [
      ["foo:1", "bar:foo"],
      { foo: new Rational(1), bar: new Rational(1) },
      "get"
    ],
    [
      ["y:x*x", "foo:x+1", "bar:y*x", "x:2"],
      {
        x: new Rational(2),
        y: new Rational(4),
        foo: new Rational(3),
        bar: new Rational(8)
      },
      "arithmetic"
    ],
    // Expressions are not case sensitive
    [["foo:test"], { foo: new Rational(10) }, "case1"],
    [["foo:TEST"], { foo: new Rational(10) }, "case2"],
    // However, keys **must** be lower case
    // [["Foo:TEST"], { foo: new Rational(10) }],
    [["foo:$max(1,2,3)"], { foo: new Rational(3) }, "function"],
    [["f:x=>x.foo>1", "v:f({foo:2})"], { v: true }, "object"],
    [
      ["f:x=>x+1", "l:[10,20]", "v:$map(f,l)"],
      { v: [new Rational(11), new Rational(21)] },
      "simple_map"
    ],
    [
      [
        "f:x=>(x.foo>=10)",
        "arr:[{foo:2},{foo:20},{foo:-2},{foo:7},{foo:10}]",
        "out:$filter(f,arr)"
      ],
      { out: [{ foo: new Rational(20) }, { foo: new Rational(10) }] },
      "filter"
    ],
    [
      [
        "f:x=>(x.foo>=10)",
        "arr:[{foo:2},{foo:20},{foo:-2},{foo:7},{foo:10}]",
        "out:$map(f,arr)"
      ],
      { out: [false, true, false, false, true] },
      "map"
    ],
    [
      [
        "f:x=>(x.foo>=10)",
        "arr:[{foo:2},{foo:20},{foo:-2},{foo:7},{foo:10}]",
        "out:($find(f,arr)).foo"
      ],
      { out: new Rational(20) },
      "find"
    ],
    [
      ["f:x=>x", 'out:{a:f(1),b:f("a")}'],
      { out: { a: new Rational(1), b: "a" } },
      "polymorphism"
    ],
    [
      ["arr:[{foo:2},{foo:20},{foo:-2},{foo:7},{foo:10}]", "out:$length(arr)"],
      { out: new Rational(5) },
      "length"
    ]
  ];

  for (const pt of progs) {
    it(
      `evaluates program ${pt[2]}`,
      async () => {
        // sheet and standard library
        // it could be global, but for the graph
        const sheet = new Sheet(isEqual);
        const top = new SheetProxy(sheet);
        const lib = defaultLibrary(top);
        // sheet for the isolated environment
        const proxy = new SheetProxy(sheet);
        const env = new Environment(proxy, { lib });
        await env.addExpression("test", await parseExpression("10")); // @todo only for some tests
        const debug = new Debugger(sheet);
        const prog = await new Program().set(...pt[0]);
        const up = await prog.reduce(env);
        writeFileSync(`${pt[2]}.dot`, debug.dot(`${pt[0][0]}...`));
        for (const [key, expectedValue] of Object.entries(pt[1])) {
          const computedValue = up.value(key);
          await expect(uncellify(computedValue)).resolves.toEqual(
            expectedValue
          );
        }
      },
      { timeout: 500 }
    );
  }
});
