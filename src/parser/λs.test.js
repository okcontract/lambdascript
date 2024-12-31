import { expect, test } from "vitest";

import { parser } from "./λs";

test("it parses", () => {
  const input = "min(1,2)";
  const tree = parser.parse(input);
  const nodes = [];
  const cursor = tree.cursor();
  do {
    if (cursor.name && cursor.name !== "⚠") {
      nodes.push(cursor.name);
    }
    // console.log(`Node ${cursor.name} from ${cursor.from} to ${cursor.to}`);
  } while (cursor.next());
  expect(nodes).toEqual([
    "SourceFile",
    "CallExpression",
    "Identifier",
    "ArgumentList",
    "NumberValue",
    "NumberValue"
  ]);
});
