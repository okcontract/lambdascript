import { beforeAll, describe, expect, it, test } from "vitest";

import {
  type ASTNode,
  NameApplication,
  NameConstant,
  NameField,
  NameLambda,
  NameList,
  NameObject,
  NameTuple,
  NameVariable
} from "./ast";
import { toHighLevelAST } from "./highLevel";
import { toLowLevelAST } from "./lowLevel";
import { parser } from "./parser/λs";
import { Rational } from "./rational";

import { toEqualWithRationals } from "./extend.test";
beforeAll(() => {
  toEqualWithRationals();
});

const highLevelData: [string, ASTNode][] = [
  ["true", { type: NameConstant, value: true }],
  ["trues", { type: NameVariable, name: "trues" }],
  ["false", { type: NameConstant, value: false }],
  ["falseS", { type: NameVariable, name: "falseS" }],
  ['"a\\n"', { type: NameConstant, value: "a\n" }],
  ["0x12121", { type: NameConstant, value: new Rational("0x12121") }],
  [
    "0x1+0x1",
    {
      type: NameApplication,
      function: { type: NameVariable, name: "+" },
      params: [
        { type: NameConstant, value: new Rational(1) },
        { type: NameConstant, value: new Rational(1) }
      ]
    }
  ],
  [
    "f(2)",
    {
      type: NameApplication,
      function: { type: NameVariable, name: "f" },
      params: [{ type: NameConstant, value: new Rational(2) }]
    }
  ],
  [
    "1+1",
    {
      type: NameApplication,
      function: { type: NameVariable, name: "+" },
      params: [
        { type: NameConstant, value: new Rational(1) },
        { type: NameConstant, value: new Rational(1) }
      ]
    }
  ],
  [
    "f(2*3)",
    {
      type: NameApplication,
      function: { type: NameVariable, name: "f" },
      params: [
        {
          type: NameApplication,
          function: { type: NameVariable, name: "*" },
          params: [
            { type: NameConstant, value: new Rational(2) },
            { type: NameConstant, value: new Rational(3) }
          ]
        }
      ]
    }
  ],
  [
    "2*3+4",
    {
      type: NameApplication,
      function: { type: NameVariable, name: "+" },
      params: [
        {
          type: NameApplication,
          function: { type: NameVariable, name: "*" },
          params: [
            { type: NameConstant, value: new Rational(2) },
            { type: NameConstant, value: new Rational(3) }
          ]
        },
        { type: NameConstant, value: new Rational(4) }
      ]
    }
  ],
  [
    "(x=>x+1)",
    {
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
    }
  ],
  [
    "x=>[x,f(x+1)]",
    {
      type: NameLambda,
      parameter: "x",
      body: {
        type: NameList,
        elements: [
          { type: NameVariable, name: "x" },
          {
            type: NameApplication,
            function: { type: NameVariable, name: "f" },
            params: [
              {
                type: NameApplication,
                function: { type: NameVariable, name: "+" },
                params: [
                  { type: NameVariable, name: "x" },
                  { type: NameConstant, value: new Rational(1) }
                ]
              }
            ]
          }
        ]
      }
    }
  ],
  [
    "1+a ? b : c",
    {
      type: NameApplication,
      function: { type: NameVariable, name: "IF" },
      params: [
        {
          type: NameApplication,
          function: { type: NameVariable, name: "+" },
          params: [
            { type: NameConstant, value: new Rational(1) },
            { type: NameVariable, name: "a" }
          ]
        },
        { type: NameVariable, name: "b" },
        { type: NameVariable, name: "c" }
      ]
    }
  ],
  [
    "{a:1,b:2+1}",
    {
      type: NameObject,
      values: {
        a: { type: NameConstant, value: new Rational(1) },
        b: {
          type: NameApplication,
          function: { type: NameVariable, name: "+" },
          params: [
            { type: NameConstant, value: new Rational(2) },
            { type: NameConstant, value: new Rational(1) }
          ]
        }
      }
    }
  ],
  [
    "{a:1,b:(x=>x+1)(2+1),c:f(1)}",
    {
      type: NameObject,
      values: {
        a: { type: NameConstant, value: new Rational(1) },
        b: {
          type: NameApplication,
          function: {
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
          },
          params: [
            {
              type: NameApplication,
              function: { type: NameVariable, name: "+" },
              params: [
                { type: NameConstant, value: new Rational(2) },
                { type: NameConstant, value: new Rational(1) }
              ]
            }
          ]
        },
        c: {
          type: NameApplication,
          function: { type: NameVariable, name: "f" },
          params: [{ type: NameConstant, value: new Rational(1) }]
        }
      }
    }
  ],
  [
    "(f(x)).a",
    {
      type: NameField,
      expr: {
        type: NameApplication,
        function: { type: NameVariable, name: "f" },
        params: [{ type: NameVariable, name: "x" }]
      },
      field: "a"
    }
  ],
  [
    "(f(x))[0]",
    {
      type: NameField,
      expr: {
        type: NameApplication,
        function: { type: NameVariable, name: "f" },
        params: [{ type: NameVariable, name: "x" }]
      },
      sub: { type: NameConstant, value: new Rational(0) }
    }
  ],
  [
    "!x+1",
    {
      type: NameApplication,
      function: { type: NameVariable, name: "+" },
      params: [
        {
          type: NameApplication,
          function: { type: NameVariable, name: "!" },
          params: [{ type: NameVariable, name: "x" }]
        },
        { type: NameConstant, value: new Rational(1) }
      ]
    }
  ],
  [
    "-1-1",
    {
      type: NameApplication,
      function: { type: NameVariable, name: "-" },
      params: [
        { type: NameConstant, value: new Rational(-1) },
        { type: NameConstant, value: new Rational(1) }
      ]
    }
  ],
  ["-1", { type: NameConstant, value: new Rational(-1) }],
  [
    "-x",
    {
      type: NameApplication,
      function: { type: NameVariable, name: "-" },
      params: [{ type: NameVariable, name: "x" }]
    }
  ],

  // Test for a basic tuple (1, 2, 3)
  [
    "{1, 2, 3}",
    {
      type: NameTuple,
      elements: [
        { type: NameConstant, value: new Rational(1) },
        { type: NameConstant, value: new Rational(2) },
        { type: NameConstant, value: new Rational(3) }
      ]
    }
  ],
  // Test for a dual element tuple with a trailing comma (x,)
  [
    "{x, y, }",
    {
      type: NameTuple,
      elements: [
        { type: NameVariable, name: "x" },
        { type: NameVariable, name: "y" }
      ]
    }
  ],
  // Test for a tuple with an expression (x + 1, 2)
  [
    "{x + 1, 2}",
    {
      type: NameTuple,
      elements: [
        {
          type: NameApplication,
          function: { type: NameVariable, name: "+" },
          params: [
            { type: NameVariable, name: "x" },
            { type: NameConstant, value: new Rational(1) }
          ]
        },
        { type: NameConstant, value: new Rational(2) }
      ]
    }
  ],
  // Test for a nested tuple ((x, y), z)
  [
    "{{x, y}, z}",
    {
      type: NameTuple,
      elements: [
        {
          type: NameTuple,
          elements: [
            { type: NameVariable, name: "x" },
            { type: NameVariable, name: "y" }
          ]
        },
        { type: NameVariable, name: "z" }
      ]
    }
  ]
  // Test for an empty tuple (should throw an error)
  // [
  //   "()",
  //   // Assuming we expect the error message for an empty tuple:
  //   "Error: Empty tuples are not allowed"
  // ]
];

describe("high-level parsing", () => {
  for (let i = 0; i < highLevelData.length; i++) {
    const [expr, ast] = highLevelData[i];
    it(`parses ${expr}`, () => {
      const tree = parser.parse(expr);
      const low = toLowLevelAST(expr, tree);
      const high = toHighLevelAST(low);
      expect(high).toEqual(ast);
    });
  }
});
