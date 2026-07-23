import { expect, test } from "bun:test";

import { parser } from "./λs";

function collectNodeNames(input) {
  const tree = parser.parse(input);
  const nodes = [];
  const cursor = tree.cursor();
  do {
    if (cursor.name && cursor.name !== "⚠") {
      nodes.push(cursor.name);
    }
  } while (cursor.next());
  return nodes;
}

test("it parses", () => {
  const input = "min(1,2)";
  const nodes = collectNodeNames(input);
  expect(nodes).toEqual([
    "SourceFile",
    "CallExpression",
    "Identifier",
    "ArgumentList",
    "NumberValue",
    "NumberValue"
  ]);
});

test("it parses singleton tuple call arguments with trailing commas cleanly", () => {
  const input = `foo(
  {x,},
)`;
  const tree = parser.parse(input);
  const nodes = [];
  const cursor = tree.cursor();
  do {
    if (cursor.name) {
      nodes.push(cursor.name);
    }
  } while (cursor.next());
  expect(nodes).toEqual([
    "SourceFile",
    "CallExpression",
    "Identifier",
    "ArgumentList",
    "TupleExpression",
    "Identifier"
  ]);
});
