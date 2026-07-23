import { describe, expect, it } from "bun:test";

import {
  type ASTNode,
  type ConstantNode,
  NameConstant,
  NameTuple,
  NameVariable
} from "./ast";
import { parseExpression, parseProgram } from "./parse";
import { Rational } from "./rational";

function assertConstantNode(
  node: ASTNode
): asserts node is ConstantNode<unknown> {
  if (node.type !== NameConstant) {
    throw new Error(`Expected constant node, got ${node.type}`);
  }
}

describe("parseExpression scientific notation", () => {
  it("parses positive exponents", async () => {
    const ast = await parseExpression("1e5");
    assertConstantNode(ast);
    expect(ast.value).toBeInstanceOf(Rational);
    expect((ast.value as Rational).toString()).toBe("100000");
  });

  it("parses decimal mantissa with positive exponent", async () => {
    const ast = await parseExpression("1.23e3");
    assertConstantNode(ast);
    expect(ast.value).toBeInstanceOf(Rational);
    expect((ast.value as Rational).toString()).toBe("1230");
  });

  it("parses negative exponents", async () => {
    const ast = await parseExpression("1.23e-3");
    assertConstantNode(ast);
    expect(ast.value).toBeInstanceOf(Rational);
    expect((ast.value as Rational).toNumber()).toBeCloseTo(0.00123);
  });

  it("parses leading decimal notation", async () => {
    const ast = await parseExpression(".5E2");
    assertConstantNode(ast);
    expect(ast.value).toBeInstanceOf(Rational);
    expect((ast.value as Rational).toString()).toBe("50");
  });

  it("parses zero mantissa", async () => {
    const ast = await parseExpression("0e5");
    assertConstantNode(ast);
    expect(ast.value).toBeInstanceOf(Rational);
    expect((ast.value as Rational).toString()).toBe("0");
  });
});

describe("parseProgram", () => {
  it("parses top-level definitions", async () => {
    const parsed = await parseProgram("foo = 1\nbar = foo + 1");
    expect(parsed.components).toHaveLength(0);
    expect(parsed.definitions).toEqual([
      expect.objectContaining({ name: "foo" }),
      expect.objectContaining({ name: "bar" })
    ]);
  });

  it("parses let components with results", async () => {
    const parsed = await parseProgram(`
let foo = 1
and bar = foo + 1
in { foo, bar }
`);
    expect(parsed.components).toHaveLength(1);
    const component = parsed.components[0];
    expect(component.bindings.map((binding) => binding.name)).toEqual([
      "foo",
      "bar"
    ]);
    expect(component.result.type).toBe(NameTuple);
    expect(parsed.definitions).toHaveLength(0);
  });

  it("returns variable result for simple let-in", async () => {
    const parsed = await parseProgram(`
let foo = 1
in foo
`);
    expect(parsed.components).toHaveLength(1);
    expect(parsed.components[0].result.type).toBe(NameVariable);
  });
});
