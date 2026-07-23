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
  type RawConstant,
  type SourceRange
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

const rangeFor = (node?: LowLevelAST): SourceRange | undefined =>
  node ? { from: node.from, to: node.to } : undefined;

const throwRangedError = (message: string, node?: LowLevelAST): never => {
  const error = new Error(message) as Error & { range?: SourceRange };
  if (node) {
    error.range = rangeFor(node);
  }
  throw error;
};

export function toHighLevelAST(
  parseTree: LowLevelAST,
  extensions: ParserExtension<unknown, string>[] = []
): ASTNode {
  if (!parseTree?.name) {
    return throwRangedError("Invalid parse tree", parseTree);
  }

  // @check Extensions
  for (const ext of extensions) {
    if (
      parseTree.name === ext.elt &&
      typeof parseTree.value === "string" &&
      ext.pat(parseTree.value)
    )
      return {
        type: NameConstant,
        value: ext.rewrite(parseTree.value) as RawConstant,
        range: rangeFor(parseTree)
      };
  }

  switch (parseTree.name) {
    case "SourceFile":
      if (parseTree.children?.length === 1)
        return toHighLevelAST(parseTree.children[0], extensions);
      return throwRangedError("empty source", parseTree);
    case "ParenthesizedExpression":
      if (parseTree.children?.length === 1)
        return toHighLevelAST(parseTree.children[0], extensions);
      return throwRangedError("empty parenthesis", parseTree);

    case "TupleExpression": {
      const elements =
        parseTree.children?.map((c) => toHighLevelAST(c, extensions)) || [];
      if (elements.length === 0) {
        throwRangedError("Empty tuples are not allowed", parseTree);
      }
      return {
        type: NameTuple,
        elements,
        range: rangeFor(parseTree)
      };
    }

    case "Identifier":
      return {
        type: NameVariable,
        name: parseTree.value as string,
        range: rangeFor(parseTree)
      };
    case "NumberValue":
      return {
        type: NameConstant,
        value: new Rational(parseTree.value as string | number | bigint),
        range: rangeFor(parseTree)
      };
    case "StringValue":
      return {
        type: NameConstant,
        value: JSON.parse(parseTree.value as string),
        range: rangeFor(parseTree)
      }; //.slice(1, -1) };
    case "BooleanValue":
      return {
        type: NameConstant,
        value: parseTree.value === "true",
        range: rangeFor(parseTree)
      };

    case "ArrayExpression":
      return {
        type: NameList,
        elements:
          parseTree.children?.map((c) => toHighLevelAST(c, extensions)) || [],
        range: rangeFor(parseTree)
      };

    case "ObjectExpression":
      return {
        type: NameObject,
        values: Object.fromEntries(
          parseTree.children
            ?.map((c) => toHighLevelAST(c, extensions))
            ?.map((node) =>
              // @ts-expect-error @todo check node is temporary "named"
              [node.key, node.value]
            ) || []
        ),
        range: rangeFor(parseTree)
      };
    case "NamedField":
      if (parseTree.children?.length === 2)
        return {
          type: "named",
          key: parseTree.children[0].value as string,
          value: toHighLevelAST(parseTree.children[1], extensions),
          range: rangeFor(parseTree)
        };
      return throwRangedError("wrong NamedField length", parseTree);

    case "FieldExpression":
    case "SubscriptExpression": {
      const children = parseTree.children;
      if (children?.length !== 2)
        return throwRangedError("wrong FieldExpression length", parseTree);
      // @todo support field expressions
      if (children[1].name === "Identifier")
        return {
          type: NameField,
          expr: toHighLevelAST(children[0], extensions),
          field: children[1].value as string,
          range: rangeFor(parseTree)
        };
      return {
        type: NameField,
        expr: toHighLevelAST(children[0], extensions),
        sub: toHighLevelAST(children[1], extensions),
        range: rangeFor(parseTree)
      };
    }

    case "FunctionExpression": {
      const children = parseTree.children;
      if (children?.length !== 2)
        return throwRangedError("wrong function length", parseTree);
      let parameters: LowLevelAST[];
      if (children[0].name === "ArgumentList") {
        parameters = children[0].children ?? [];
      } else {
        parameters = [children[0]];
      }
      if (!parameters.length)
        return throwRangedError("Function with no arguments", parseTree);
      let body = toHighLevelAST(children[1], extensions);
      for (const parameter of parameters.reverse()) {
        body = {
          type: NameLambda,
          parameter: parameter.value as string,
          body,
          range: rangeFor(parseTree)
        };
      }
      return body;
    }

    case "CallExpression": {
      const children = parseTree.children;
      if (children?.length !== 2)
        return throwRangedError("wrong CallExpression length", parseTree);
      if (children[1].name !== "ArgumentList")
        return throwRangedError("wrong CallExpression arguments", children[1]);
      const params =
        children[1].children?.map((c) => toHighLevelAST(c, extensions)) || [];
      switch (children[0].name) {
        case "Identifier":
          return {
            type: NameApplication,
            function: {
              type: NameVariable,
              name: children[0].value as string,
              range: rangeFor(children[0])
            },
            params,
            range: rangeFor(parseTree)
          };
        case "ParenthesizedExpression":
        case "CallExpression":
          return {
            type: NameApplication,
            function: toHighLevelAST(children[0], extensions),
            params,
            range: rangeFor(parseTree)
          };
      }
      return throwRangedError("unknown CallExpression", parseTree);
    }

    case "UnaryExpression": {
      const children = parseTree.children;
      if (children?.length !== 2)
        return throwRangedError("wrong UnaryExpression length", parseTree);
      if (!children[0].name.includes("Operator"))
        return throwRangedError("not an unary operator", children[0]);
      return {
        type: NameApplication,
        function: {
          type: NameVariable,
          name: children[0].value as string,
          range: rangeFor(children[0])
        },
        params: [toHighLevelAST(children[1], extensions)],
        range: rangeFor(parseTree)
      };
    }

    case "BinaryExpression": {
      const children = parseTree.children;
      if (children?.length !== 3)
        return throwRangedError("wrong BinaryExpression length", parseTree);
      return {
        type: NameApplication,
        function: {
          type: NameVariable,
          name: children[1].value as string,
          range: rangeFor(children[1])
        },
        params: [
          toHighLevelAST(children[0], extensions),
          toHighLevelAST(children[2], extensions)
        ],
        range: rangeFor(parseTree)
      };
    }

    case "TernaryExpression": {
      const children = parseTree.children;
      if (children?.length !== 3)
        return throwRangedError("wrong TernaryExpression length", parseTree);
      return {
        type: NameApplication,
        function: {
          type: NameVariable,
          name: "IF",
          range: rangeFor(parseTree)
        },
        params: children.map((c) => toHighLevelAST(c, extensions)),
        range: rangeFor(parseTree)
      };
    }
    case "⚠":
      return {
        type: NameError,
        value: parseTree.value as string,
        range: rangeFor(parseTree)
      };
    default:
      return throwRangedError(
        `Unknown parse tree node: ${parseTree.name}`,
        parseTree
      );
  }
}
