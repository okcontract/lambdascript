import { describe, expect, it, test } from "vitest";

import { Sheet, SheetProxy } from "@okcontract/cells";

import {
  type ASTNode,
  NameApplication,
  NameConstant,
  NameLambda,
  NameVariable
} from "./ast";
import { Environment } from "./env";
import { parseExpression } from "./parse";
import { Rational } from "./rational";
import { typeBoolean, typeNumber, typeString } from "./stdlib";
import {
  Instantiate,
  InstantiateAlpha,
  type TypeScheme,
  newTypeScheme
} from "./typeScheme";
import { type MonoType, typeAny, typeList } from "./types";

test("infer type of constant values", async () => {
  const proxy = new SheetProxy(new Sheet());
  const env = new Environment(proxy, undefined);
  const numberNode: ASTNode = { type: NameConstant, value: new Rational(42) };
  const stringNode: ASTNode = { type: NameConstant, value: "hello" };
  const boolNode: ASTNode = { type: NameConstant, value: true };

  expect(Instantiate(await env.infer(numberNode))).toEqual(typeNumber);
  expect(Instantiate(await env.infer(stringNode))).toEqual(typeString);
  expect(Instantiate(await env.infer(boolNode))).toEqual(typeBoolean);
});

test("infer type of variables", async () => {
  const proxy = new SheetProxy(new Sheet());
  const env = new Environment(proxy)
    .withType("x", { vars: [], type: typeNumber })
    .withType("y", { vars: [], type: typeString });
  // console.log(env._types);

  const varNode1: ASTNode = { type: NameVariable, name: "x" };
  const varNode2: ASTNode = { type: NameVariable, name: "y" };

  expect(Instantiate(await env.infer(varNode1))).toEqual(typeNumber);
  expect(Instantiate(await env.infer(varNode2))).toEqual(typeString);
});

test("infer type of function application", async () => {
  const proxy = new SheetProxy(new Sheet());
  const env = new Environment(proxy);
  const addNode: ASTNode = {
    type: NameApplication,
    function: { type: NameVariable, name: "+" },
    params: [
      { type: NameConstant, value: new Rational(1) },
      { type: NameConstant, value: new Rational(2) }
    ]
  };

  expect(Instantiate(await env.infer(addNode))).toEqual(typeNumber);
});

test("infer type of function application with bigint", async () => {
  const proxy = new SheetProxy(new Sheet());
  const env = new Environment(proxy);
  const addNode: ASTNode = {
    type: NameApplication,
    function: { type: NameVariable, name: "+" },
    params: [
      { type: NameConstant, value: new Rational(1) },
      { type: NameConstant, value: new Rational(1) }
    ]
  };

  expect(Instantiate(await env.infer(addNode))).toEqual(typeNumber);
});

test("infer type of lambda expressions", async () => {
  const proxy = new SheetProxy(new Sheet());
  const env = new Environment(proxy);
  const lambdaNode: ASTNode = {
    type: NameLambda,
    parameter: "x",
    body: {
      type: NameApplication,
      function: { type: NameVariable, name: "+" },
      params: [
        { type: NameVariable, name: "x" },
        { type: NameConstant, value: new Rational(1) }
      ]
    }
  };

  const lambdaType = await env.infer(lambdaNode);
  expect(Instantiate(lambdaType)).toEqual({
    kind: NameLambda,
    argTypes: [typeNumber],
    returnType: typeNumber
  });
});

test("infer type of function application from env", async () => {
  const proxy = new SheetProxy(new Sheet());
  const env = new Environment(proxy);
  await env.addExpression("f", {
    body: {
      type: NameApplication,
      function: { type: NameVariable, name: "+" },
      params: [
        { name: "x", type: NameVariable },
        { type: NameConstant, value: new Rational(1) }
      ]
    },
    parameter: "x",
    type: NameLambda
  });
  // console.log({ type: prettyPrintType(env.type("f").type) });

  const appType = await env.infer({
    type: NameApplication,
    function: { type: NameVariable, name: "f" },
    params: [{ type: NameConstant, value: new Rational(2) }]
  });
  expect(Instantiate(appType)).toEqual(typeNumber);
});

test("application error", async () => {
  const proxy = new SheetProxy(new Sheet());
  const env = new Environment(proxy);
  await env.addExpression("a", { type: NameConstant, value: new Rational(1) });
  await expect(
    env.infer({
      type: NameApplication,
      function: { type: NameVariable, name: "a" },
      params: [{ type: NameConstant, value: new Rational(2) }]
    })
  ).rejects.toThrow("Type mismatch: number vs (number) -> α");
});

test("application error from stdlib", async () => {
  const proxy = new SheetProxy(new Sheet());
  const env = new Environment(proxy);
  await expect(
    env.infer({
      type: NameApplication,
      function: { type: NameVariable, name: "$pi" },
      params: []
    })
  ).rejects.toThrow("Type mismatch: number vs () -> α");
});

describe("types for lambda functions", async () => {
  const exprList: { [e: string]: MonoType } = {
    "(x=>{a:x})(2).a": { kind: "const", type: "number" },
    "([1,2,3])[0]": { kind: "const", type: "number" },
    "arr[0]": { kind: "const", type: "number" },
    '(x=>{a:x,b:x})("foo")': {
      kind: "obj",
      fields: {
        a: { kind: "const", type: "string" },
        b: { kind: "const", type: "string" }
      },
      open: false
    },
    '{1,2,"foo"}': {
      kind: "tup",
      elementTypes: [
        { kind: "const", type: "number" },
        { kind: "const", type: "number" },
        { kind: "const", type: "string" }
      ]
    },
    "x=>x.foo": {
      kind: NameLambda,
      argTypes: [
        {
          kind: "obj",
          fields: { foo: { kind: "var", type: "a" } },
          open: true
        }
      ],
      returnType: { kind: "var", type: "a" }
    },
    "x=>x.foo+1": {
      kind: NameLambda,
      argTypes: [
        {
          kind: "obj",
          fields: { foo: { kind: "const", type: "number" } },
          open: true
        }
      ],
      returnType: { kind: "const", type: "number" }
    },
    "x=>x.foo+x.bar": {
      kind: NameLambda,
      argTypes: [
        {
          kind: "obj",
          fields: {
            foo: { kind: "const", type: "number" },
            bar: { kind: "const", type: "number" }
          },
          open: true
        }
      ],
      returnType: { kind: "const", type: "number" }
    },
    "x=>a=>{x:x+a}": {
      kind: NameLambda,
      argTypes: [{ kind: "const", type: "number" }],
      returnType: {
        kind: NameLambda,
        argTypes: [{ kind: "const", type: "number" }],
        returnType: {
          kind: "obj",
          fields: { x: { kind: "const", type: "number" } },
          open: false
        }
      }
    },
    // nested objects
    "x=>a=>{x:{x:a},y:x}": {
      kind: NameLambda,
      argTypes: [{ kind: "var", type: "a" }],
      returnType: {
        kind: NameLambda,
        argTypes: [{ kind: "var", type: "b" }],
        returnType: {
          kind: "obj",
          fields: {
            x: {
              kind: "obj",
              fields: { x: { kind: "var", type: "b" } },
              open: false
            },
            y: { kind: "var", type: "a" }
          },
          open: false
        }
      }
    },
    "x=>a=>{x:{x:a,y:x},y:x+1}": {
      kind: NameLambda,
      argTypes: [{ kind: "const", type: "number" }],
      returnType: {
        kind: NameLambda,
        argTypes: [{ kind: "var", type: "a" }],
        returnType: {
          kind: "obj",
          fields: {
            x: {
              kind: "obj",
              fields: {
                x: { kind: "var", type: "a" },
                y: { kind: "const", type: "number" }
              },
              open: false
            },
            y: { kind: "const", type: "number" }
          },
          open: false
        }
      }
    },
    "$FILTER(x=>x!=0,[0,3,4])": {
      kind: "lst",
      elementType: { kind: "const", type: "number" }
    },
    // TypeScheme instantiation for standard library
    '{a:$FILTER(x=>x!=0,[0,3,4]),b:$FILTER(x=>x!="a",["a","b","c"])}': {
      kind: "obj",
      fields: {
        a: { kind: "lst", elementType: { kind: "const", type: "number" } },
        b: { kind: "lst", elementType: { kind: "const", type: "string" } }
      },
      open: false
    }
  };
  const proxy = new SheetProxy(new Sheet());
  const env = new Environment(proxy, {
    types: { arr: newTypeScheme(typeList(typeNumber)) }
  });
  for (const [expr, expected] of Object.entries(exprList))
    it(
      `typechecks ${expr}`,
      async () => {
        const ast = await parseExpression(expr);
        const res = InstantiateAlpha(await env.infer(ast));
        expect(res).toEqual(expected);
      },
      { timeout: 500 }
    );
});

test("type errors", async () => {
  const evErrors: { [e: string]: string } = {
    "foo+a": "Unbound variable: foo",
    '"foo"+1': "Type mismatch: number vs string",
    "kk(1)": "Unbound variable: kk",
    "{a:1}.b": "Unknown field: b"
  };
  const proxy = new SheetProxy(new Sheet());
  const env = new Environment(proxy);
  for (const [k, err] of Object.entries(evErrors)) {
    const ast = await parseExpression(k);
    await expect(env.infer(ast)).rejects.toThrow(err);
  }
});

describe("type any", async () => {
  const proxy = new SheetProxy(new Sheet());
  const env = new Environment(proxy).withType("x", { vars: [], type: typeAny });

  const tests: Record<string, TypeScheme> = {
    "x+1": {
      type: typeNumber,
      vars: []
    },
    'x=="foo"': {
      type: typeBoolean,
      vars: []
    }
  };

  for (const [expr, exp] of Object.entries(tests)) {
    test(`any: ${expr}`, async () => {
      const ast = await parseExpression(expr);
      await expect(env.infer(ast)).resolves.toEqual(exp);
    });
  }
});
