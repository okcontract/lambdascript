import {
  type ASTNode,
  NameApplication,
  NameConstant,
  NameError,
  NameField,
  NameLambda,
  NameList,
  NameObject,
  NameTuple,
  NameVariable,
  type RawConstant
} from "./ast";
import type { LowLevelAST } from "./lowLevel";
import { Rational } from "./rational";
import type { TypeConst } from "./types";

export type ParserExtension<Result, Name extends string> = {
  elt: Name;
  pat: (value: unknown) => boolean;
  rewrite: (value: string) => Result;
  instance: (value: Result) => boolean;
  type: TypeConst;
};

export function toHighLevelAST(
  parseTree: LowLevelAST,
  extensions: ParserExtension<unknown, string>[] = []
): ASTNode {
  if (!parseTree || !parseTree.name) {
    throw new Error("Invalid parse tree");
  }

  // @check Extensions
  for (const ext of extensions)
    if (parseTree.name === ext.elt && ext.pat(parseTree.value))
      return {
        type: NameConstant,
        value: ext.rewrite(parseTree.value) as RawConstant
      };

  switch (parseTree.name) {
    case "SourceFile":
      if (parseTree.children?.length === 1)
        return toHighLevelAST(parseTree.children[0], extensions);
      throw new Error("empty source");
    case "ParenthesizedExpression":
      if (parseTree.children?.length === 1)
        return toHighLevelAST(parseTree.children[0], extensions);
      throw new Error("empty parenthesis");

    case "TupleExpression": {
      const elements =
        parseTree.children?.map((c) => toHighLevelAST(c, extensions)) || [];
      if (elements.length === 0) {
        throw new Error("Empty tuples are not allowed");
      }
      return {
        type: NameTuple,
        elements
      };
    }

    case "Identifier":
      return { type: NameVariable, name: parseTree.value as string };
    case "NumberValue":
      return {
        type: NameConstant,
        value: new Rational(parseTree.value as string | number | bigint)
      };
    case "StringValue":
      return {
        type: NameConstant,
        value: JSON.parse(parseTree.value as string)
      }; //.slice(1, -1) };
    case "BooleanValue":
      return { type: NameConstant, value: parseTree.value === "true" };

    case "ArrayExpression":
      return {
        type: NameList,
        elements:
          parseTree.children?.map((c) => toHighLevelAST(c, extensions)) || []
      };

    case "ObjectExpression":
      return {
        type: NameObject,
        values: Object.fromEntries(
          parseTree.children
            ?.map((c) => toHighLevelAST(c, extensions))
            ?.map((node) =>
              // @ts-ignore @todo check node is temporary "named"
              [node.key, node.value]
            ) || []
        )
      };
    case "NamedField":
      if (parseTree.children?.length === 2)
        return {
          type: "named",
          key: parseTree.children[0].value as string,
          value: toHighLevelAST(parseTree.children[1], extensions)
        };
      throw new Error("wrong NamedField length");

    case "FieldExpression":
    case "SubscriptExpression":
      if (parseTree.children?.length !== 2)
        throw new Error("wrong FieldExpression length");
      // @todo support field expressions
      if (parseTree.children[1].name === "Identifier")
        return {
          type: NameField,
          expr: toHighLevelAST(parseTree.children[0], extensions),
          field: parseTree.children[1].value as string
        };
      return {
        type: NameField,
        expr: toHighLevelAST(parseTree.children[0], extensions),
        sub: toHighLevelAST(parseTree.children[1], extensions)
      };

    case "FunctionExpression": {
      if (parseTree.children?.length !== 2)
        throw new Error("wrong function length");
      let parameters: LowLevelAST[];
      if (parseTree.children[0].name === "ArgumentList") {
        parameters = parseTree.children[0].children ?? [];
      } else {
        parameters = [parseTree.children[0]];
      }
      if (!parameters.length) throw new Error("Function with no arguments");
      let body = toHighLevelAST(parseTree.children[1], extensions);
      for (const parameter of parameters.reverse()) {
        body = {
          type: NameLambda,
          parameter: parameter.value as string,
          body
        };
      }
      return body;
    }

    case "CallExpression": {
      if (parseTree.children?.length !== 2)
        throw new Error("wrong CallExpression length");
      if (parseTree.children[1].name !== "ArgumentList")
        throw new Error("wrong CallExpression arguments");
      const params =
        parseTree.children[1].children?.map((c) =>
          toHighLevelAST(c, extensions)
        ) || [];
      switch (parseTree.children[0].name) {
        case "Identifier":
          return {
            type: NameApplication,
            function: {
              type: NameVariable,
              name: parseTree.children[0].value as string
            },
            params
          };
        case "ParenthesizedExpression":
        case "CallExpression":
          return {
            type: NameApplication,
            function: toHighLevelAST(parseTree.children[0], extensions),
            params
          };
      }
      throw new Error("unknown CallExpression");
    }

    case "UnaryExpression":
      if (parseTree.children?.length !== 2)
        throw new Error("wrong UnaryExpression length");
      if (!parseTree.children[0].name.includes("Operator"))
        throw new Error("not an unary operator");
      return {
        type: NameApplication,
        function: {
          type: NameVariable,
          name: parseTree.children[0].value as string
        },
        params: [toHighLevelAST(parseTree.children[1], extensions)]
      };

    case "BinaryExpression":
      if (parseTree.children?.length !== 3)
        throw new Error("wrong BinaryExpression length");
      return {
        type: NameApplication,
        function: {
          type: NameVariable,
          name: parseTree.children[1].value as string
        },
        params: [
          toHighLevelAST(parseTree.children[0], extensions),
          toHighLevelAST(parseTree.children[2], extensions)
        ]
      };

    case "TernaryExpression": {
      if (parseTree.children?.length !== 3)
        throw new Error("wrong TernaryExpression length");
      return {
        type: NameApplication,
        function: { type: NameVariable, name: "IF" },
        params: parseTree.children.map((c) => toHighLevelAST(c, extensions))
      };
    }
    case "⚠":
      return { type: NameError, value: parseTree.value as string };
    default:
      throw new Error(`Unknown parse tree node: ${parseTree.name}`);
  }
}
