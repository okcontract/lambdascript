import { describe, expect, it } from "vitest";

import {
  type ApplicationNode,
  type ConstantNode,
  NameApplication,
  NameConstant,
  NameVariable,
  type RawConstant,
  type VariableNode
} from "./ast";
import { Program } from "./program";

describe("order_program correctly orders expressions and identifies external dependencies", async () => {
  const constantNode: ConstantNode<RawConstant> = {
    type: NameConstant,
    value: "test"
  };
  const variableNode: VariableNode = {
    type: NameVariable,
    name: "expr1"
  };
  // Multiple dependencies, both internal and external
  const functionNode: ApplicationNode = {
    type: NameApplication,
    function: { type: NameVariable, name: "func1" },
    params: [variableNode]
  };

  it("works with No dependencies", () => {
    const program = new Program({
      expr1: constantNode
    });
    expect(program.order).toEqual([["expr1"], []]);
  });

  it("works with Single internal dependency", () => {
    const program = new Program({
      expr1: constantNode,
      expr2: variableNode
    });
    expect(program.order).toEqual([["expr1", "expr2"], []]);
  });

  it("works with Single external dependency", () => {
    const program = new Program({
      expr2: variableNode
    });
    expect(program.order).toEqual([["expr2"], ["expr1"]]);
  });

  it("works with Multiple dependencies, both internal and external", () => {
    const program = new Program({
      expr1: constantNode,
      expr2: functionNode,
      expr3: { type: NameVariable, name: "expr1" }
    });
    expect(program.order).toEqual([["expr1", "expr2", "expr3"], ["func1"]]);
  });
});

describe("deps_for correctly computes required dependencies", async () => {
  // No dependencies
  const constantNode: ConstantNode = {
    type: NameConstant,
    value: "test"
  };
  it("works for program with no deps", () => {
    const program = new Program({
      expr1: constantNode
    });
    expect(program.dependencies(["expr1"])).toEqual([]);
  });

  // Single internal dependency
  const variableNode: VariableNode = {
    type: NameVariable,
    name: "expr1"
  };

  it("works for program with single internal deps", () => {
    const program = new Program({
      expr1: constantNode,
      expr2: variableNode
    });
    expect(program.dependencies(["expr2"])).toEqual([]);
  });

  it("works for program with single external deps", () => {
    // Single external dependency
    const program = new Program({
      expr1: variableNode
    });
    expect(program.dependencies(["expr1"])).toEqual([]);
  });

  const functionNode: ApplicationNode = {
    type: NameApplication,
    function: { type: NameVariable, name: "func1" },
    params: [variableNode]
  };

  it("works for multiple dependencies, both internal and external", () => {
    const program = new Program({
      expr1: constantNode,
      expr2: functionNode,
      expr3: { type: NameVariable, name: "var2" }
    });
    expect(program.dependencies(["expr2", "expr3"])).toEqual(["func1", "var2"]);
  });
});
