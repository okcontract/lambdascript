import { expect, test } from "vitest";

import { type LowLevelAST, toLowLevelAST } from "./lowLevel";
import { parser } from "./parser/λs";

const lowLevelData: [string, LowLevelAST][] = [
  [
    "1.+.3",
    {
      name: "SourceFile",
      children: [
        {
          name: "BinaryExpression",
          children: [
            { name: "NumberValue", value: "1." },
            { name: "PlusOperator", value: "+" },
            { name: "NumberValue", value: ".3" }
          ]
        }
      ]
    }
  ],
  [
    "2*3+4",
    {
      name: "SourceFile",
      children: [
        {
          name: "BinaryExpression",
          children: [
            {
              name: "BinaryExpression",
              children: [
                { name: "NumberValue", value: "2" },
                { name: "TimesOperator", value: "*" },
                { name: "NumberValue", value: "3" }
              ]
            },
            { name: "PlusOperator", value: "+" },
            { name: "NumberValue", value: "4" }
          ]
        }
      ]
    }
  ],
  [
    "2+3*4",
    {
      name: "SourceFile",
      children: [
        {
          name: "BinaryExpression",
          children: [
            { name: "NumberValue", value: "2" },
            { name: "PlusOperator", value: "+" },
            {
              name: "BinaryExpression",
              children: [
                { name: "NumberValue", value: "3" },
                { name: "TimesOperator", value: "*" },
                { name: "NumberValue", value: "4" }
              ]
            }
          ]
        }
      ]
    }
  ],
  [
    "(x=>x+1)",
    {
      name: "SourceFile",
      children: [
        {
          name: "ParenthesizedExpression",
          children: [
            {
              name: "FunctionExpression",
              children: [
                { name: "Identifier", value: "x" },
                {
                  name: "BinaryExpression",
                  children: [
                    { name: "Identifier", value: "x" },
                    { name: "PlusOperator", value: "+" },
                    { name: "NumberValue", value: "1" }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
];

test("low-level parsing", () => {
  for (let i = 0; i < lowLevelData.length; i++) {
    const [expr, ast] = lowLevelData[i];
    const tree = parser.parse(expr);
    expect(toLowLevelAST(expr, tree)).toEqual(ast);
  }
});

test("parse error", () => {
  const expr = "1+";
  const tree = parser.parse(expr);
  expect(toLowLevelAST(expr, tree)).toEqual({
    children: [
      {
        children: [
          {
            name: "NumberValue",
            value: "1"
          },
          {
            name: "PlusOperator",
            value: "+"
          },
          {
            name: "⚠",
            value: "",
            error: { from: 2, to: 2 }
          }
        ],
        name: "BinaryExpression"
      }
    ],
    name: "SourceFile"
  });
});
