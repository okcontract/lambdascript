import { beforeAll, describe, expect, it, test } from "vitest";

import {
  type AnyCell,
  Sheet,
  type SheetProxy,
  uncellify
} from "@okcontract/cells";

import { NameLambda } from "./ast";
import { Environment } from "./env";
import { isEqual } from "./equal";
import { parseExpression } from "./parse";
import { Rational } from "./rational";
import { type LibraryElement, defaultLibrary, typeString } from "./stdlib";

import { toEqualWithRationals } from "./extend.test";
beforeAll(() => {
  toEqualWithRationals();
});

test("eval 1+1", async () => {
  const proxy = new Sheet(isEqual).newProxy();
  const env = new Environment(proxy);
  const ast = await parseExpression("1 + 1");
  const result = env.eval(ast);
  await expect(result.get()).resolves.toEqual(new Rational(2));
});

describe("eval valid expressions", async () => {
  const proxy = new Sheet(isEqual).newProxy();
  const foo = proxy.new(new Rational(1));
  const bar = proxy.new(new Rational(2));
  const values = {
    foo,
    bar,
    three: proxy.new(new Rational(3)),
    obj: proxy.new({ a: new Rational(1), b: new Rational(2) }),
    $test: proxy.new(new Rational(10)),
    numbers: proxy.new([foo, bar])
  };
  const env = new Environment(proxy, { values });

  const exprs: { [e: string]: unknown } = {
    "1": new Rational(1),
    "1+2": new Rational(3),
    "5*1+1": new Rational(6),
    "5*(1+1)": new Rational(10),
    "foo+bar": new Rational(3),
    '"foo"': "foo",
    "[1,2]": [new Rational(1), new Rational(2)],
    "{a:1, b:2}": { a: new Rational(1), b: new Rational(2) },
    "{a:1, b:2}.a": new Rational(1),
    "obj.a": new Rational(1),
    "(obj).a": new Rational(1),
    "$max(1,2,3)": new Rational(3), // defaultLibrary
    "$last([[3,2,1]])": new Rational(1), // defaultLibrary
    "true && true": true,
    "false || true": true,
    "1<2": true,
    $test: new Rational(10),
    "[1,2].(0)": new Rational(1),
    "$min(1,2,3)>=foo&&$max(1,2,3)<=three": true,
    "(1000*1000)/(1000*1000)": new Rational(1),
    "(x=>x+1)(1)": new Rational(2),
    "(x=>y=>x+y)(1)(2)": new Rational(3),
    "((x,y)=>x+y)(1)(2)": new Rational(3),
    // "(x=>y=>x+y)(1,2)": new Rational(3),
    // "((x,y)=>x+y)(1,2)": new Rational(3),
    "0x1234": new Rational(4660),
    '$concat(1,"a")': "1a",
    "({a:numbers}).a[0]": new Rational(1),
    "(x=>({a:x}))(numbers).a[0]": new Rational(1)
  };

  for (const [expr, expected] of Object.entries(exprs)) {
    it(
      `evaluates ${expr}`,
      async () => {
        const ast = await parseExpression(expr);
        const res = env.eval(ast);
        await expect(uncellify(res)).resolves.toEqual(expected);
      },
      { timeout: 500 }
    );
  }
});

test("parse errors", async () => {
  const pErrors: string[] = [
    "1+", // unfinished op
    "[1," // open array
  ];
  const proxy = new Sheet(isEqual).newProxy();
  const env = new Environment(proxy);
  for (const expr of pErrors) {
    const ast = await parseExpression(expr);
    expect(() => env.eval(ast)).toThrow("parse error");
  }
});

// This test is not significant because all these errors should be
// detected during type checking.
test("eval errors", async () => {
  const evErrors: { [e: string]: string } = {
    "foo+a": "Undefined variable: foo",
    "kk(1)": "Undefined variable: kk"
  };
  for (const [expr, err] of Object.entries(evErrors)) {
    const proxy = new Sheet(isEqual).newProxy();
    const env = new Environment(proxy);
    const ast = await parseExpression(expr);
    expect(() => env.eval(ast)).toThrow(err);
  }
});

test("evaluated expressions are reactive", async () => {
  const proxy = new Sheet(isEqual).newProxy();
  const foo = proxy.new(new Rational(1));
  const env = new Environment(proxy, { values: { foo } });
  const ast = await parseExpression("foo + 1");
  const expr = env.eval(ast) as AnyCell<Rational>;
  await expect(expr.get()).resolves.toEqual(new Rational(2));
  foo.set(new Rational(2));
  await expect(expr.get()).resolves.toEqual(new Rational(3));
});

test("eval outputs cannot be evaluated before env value definition", async () => {
  const proxy = new Sheet(isEqual).newProxy();
  const env = new Environment(proxy);
  const ast = await parseExpression("foo + 1");
  expect(() => env.eval(ast)).toThrow("Undefined variable: foo");
});

test("eval outputs are reactive with errors", async () => {
  const proxy = new Sheet(isEqual).newProxy();
  const foo = proxy.new("");
  const test: LibraryElement = {
    f: proxy.new((_: SheetProxy, input: AnyCell<string>) =>
      input.map((_in) => {
        if (!_in) throw new Error("empty");
        return _in[0];
      })
    ),
    t: {
      vars: [],
      type: {
        kind: NameLambda,
        argTypes: [typeString],
        returnType: typeString
      }
    }
  };
  const env = new Environment(proxy, {
    lib: { ...defaultLibrary(proxy), test: test },
    values: { foo }
  });
  const ast = await parseExpression("test(foo)");
  const expr = env.eval(ast) as AnyCell<string>;
  await expect(expr.get()).resolves.toBeInstanceOf(Error);
  foo.set("hello");
  await expect(expr.get()).resolves.toBe("h");
});
