import { expect, test } from "vitest";

import {
  type ASTNode,
  NameApplication,
  NameConstant,
  NameField,
  NameLambda,
  NameList,
  NameObject,
  NameVariable
} from "./ast";
import { prettyPrint, prettyPrintType } from "./print";
import { Rational } from "./rational";
import type {
  TypeConst,
  TypeFunction,
  TypeList,
  TypeObject,
  TypeVar
} from "./types";

test("prettyPrintType: TypeVar", () => {
  //   resetTypeVarMap();
  const typeVar: TypeVar = { kind: NameVariable, type: "a" };
  expect(prettyPrintType(typeVar)).toBe("α");
});

test("prettyPrintType: TypeConst", () => {
  const typeConst: TypeConst = { kind: NameConstant, type: "string" };
  expect(prettyPrintType(typeConst)).toBe("string");
});

test("prettyPrintType: TypeFunction", () => {
  //   resetTypeVarMap();
  const typeFunction: TypeFunction = {
    kind: NameLambda,
    argTypes: [
      { kind: NameVariable, type: "a" },
      { kind: NameConstant, type: "number" }
    ],
    returnType: { kind: NameConstant, type: "string" }
  };
  expect(prettyPrintType(typeFunction)).toBe("(α, number) -> string");
});

test("prettyPrintType: TypeList", () => {
  //   resetTypeVarMap();
  const typeList: TypeList = {
    kind: NameList,
    elementType: { kind: NameVariable, type: "a" }
  };
  expect(prettyPrintType(typeList)).toBe("[α]");
});

test("prettyPrintType: TypeObject", () => {
  //   resetTypeVarMap();
  const typeObject: TypeObject = {
    kind: NameObject,
    fields: {
      field1: { kind: NameConstant, type: "string" },
      field2: { kind: NameVariable, type: "a" }
    },
    open: false
  };
  expect(prettyPrintType(typeObject)).toBe("{field1: string, field2: α}");
});

test("prettyPrint function", () => {
  const ast: ASTNode = {
    type: NameApplication,
    function: { type: NameVariable, name: "sum" },
    params: [
      { type: NameConstant, value: new Rational(1) },
      { type: NameConstant, value: new Rational(2) },
      { type: NameVariable, name: "x" },
      {
        type: NameList,
        elements: [
          { type: NameConstant, value: new Rational(3) },
          { type: NameConstant, value: new Rational(4) }
        ]
      },
      {
        type: NameObject,
        values: {
          key1: { type: NameConstant, value: "value1" },
          key2: { type: NameConstant, value: "value2" }
        }
      },
      {
        type: NameLambda,
        parameter: "y",
        body: { type: NameVariable, name: "y" }
      },
      {
        type: NameField,
        expr: { type: NameVariable, name: "obj" },
        field: "field1"
      }
    ]
  };

  const result = prettyPrint(ast);

  expect(result).toBe(
    'sum(1, 2, x, [3, 4], {key1: "value1", key2: "value2"}, y => (y), obj.field1)'
  );
});

test("prettyPrint infix operators", () => {
  const ast: ASTNode = {
    type: NameLambda,
    parameter: "x",
    body: {
      type: NameObject,
      values: {
        a: {
          type: NameList,
          elements: [
            { type: NameVariable, name: "x" },
            { type: NameVariable, name: "x" }
          ]
        },
        b: {
          type: NameLambda,
          parameter: "y",
          body: {
            type: NameApplication,
            function: { type: NameVariable, name: "+" },
            params: [
              { type: NameVariable, name: "y" },
              { type: NameConstant, value: new Rational(1) }
            ]
          }
        }
      }
    }
  };
  const result = prettyPrint(ast);
  expect(result).toBe("x => ({a: [x, x], b: y => (y + 1)})");
});
