import { expect, test } from "vitest";

import {
  type ApplicationNode,
  type ConstantNode,
  type ListNode,
  NameApplication,
  NameConstant,
  NameList,
  NameVariable,
  type VariableNode
} from "./ast";
import { exprDependencies } from "./deps";

test("deps function correctly computes dependencies", async () => {
  // No dependencies
  const constantNode: ConstantNode<unknown> = {
    type: NameConstant,
    value: "test"
  };
  expect(exprDependencies(constantNode)).toEqual([]);

  // Single dependency
  const variableNode: VariableNode = {
    type: NameVariable,
    name: "var1"
  };
  expect(exprDependencies(variableNode)).toEqual(["var1"]);

  // Function name dependency
  const functionNode: ApplicationNode = {
    type: NameApplication,
    function: { type: NameVariable, name: "func1" },
    params: [constantNode]
  };
  expect(exprDependencies(functionNode)).toEqual(["func1"]);

  // Multiple dependencies
  const listNode: ListNode = {
    type: NameList,
    elements: [functionNode, variableNode, { type: NameVariable, name: "var2" }]
  };
  expect(exprDependencies(listNode)).toEqual(["func1", "var1", "var2"]);

  // Duplicate dependencies
  const functionNode2: ApplicationNode = {
    type: NameApplication,
    function: { type: NameVariable, name: "func1" },
    params: [variableNode]
  };
  expect(exprDependencies(functionNode2)).toEqual(["func1", "var1"]);
});
