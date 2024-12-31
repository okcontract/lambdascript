import { expect, test } from "vitest";

import {
  type ASTNode,
  type ApplicationNode,
  type ConstantNode,
  type ListNode,
  NameApplication,
  NameConstant,
  NameList,
  NameVariable,
  type RawConstant,
  type VariableNode
} from "./ast";
import { traverseAST } from "./traverse";

test("traverseAST applies operation to each node", async () => {
  // Simple node with no children
  const constantNode: ConstantNode<RawConstant> = {
    type: NameConstant,
    value: "test"
  };

  let visitedNodes: ASTNode[] = [];
  traverseAST(constantNode, (node) => visitedNodes.push(node));
  expect(visitedNodes).toEqual([constantNode]);

  const functionNode: VariableNode = { type: NameVariable, name: "func" };

  // Node with one child
  const applicationNode: ApplicationNode = {
    type: NameApplication,
    function: functionNode,
    params: [constantNode]
  };

  visitedNodes = [];
  traverseAST(applicationNode, (node) => visitedNodes.push(node));
  expect(visitedNodes).toEqual([applicationNode, functionNode, constantNode]);

  // Node with multiple children
  const listNode: ListNode = {
    type: NameList,
    elements: [
      applicationNode,
      constantNode,
      { type: NameVariable, name: "var" }
    ]
  };

  visitedNodes = [];
  traverseAST(listNode, (node) => visitedNodes.push(node));
  expect(visitedNodes).toEqual([
    listNode,
    applicationNode,
    functionNode,
    constantNode,
    constantNode,
    { type: NameVariable, name: "var" }
  ]);
});
