import {
  type ASTNode,
  type ApplicationNode,
  type ConstantNode,
  type FieldNode,
  type LambdaNode,
  type ListNode,
  NameApplication,
  NameConstant,
  NameField,
  NameLambda,
  NameList,
  NameObject,
  NameTuple,
  NameVariable,
  type ObjectNode,
  type TupleNode,
  type VariableNode
} from "./ast";
import type { ParserExtension } from "./highLevel";
import { Rational, isRationalString } from "./rational";

export function parseNode(
  node: ASTNode,
  ext: ParserExtension<unknown, string>[] = []
): ASTNode {
  switch (node.type) {
    case NameConstant:
      // Built-in Rational (could be implemented as Extension though).
      if (isRationalString(node.value))
        return {
          ...node,
          value: new Rational(node.value)
        } as ConstantNode<unknown>;
      // Extensions
      if (typeof node.value === "string")
        for (const e of ext)
          if (e.pat(node.value))
            return {
              ...node,
              value: e.rewrite(node.value)
            } as ConstantNode<unknown>;
      return node as ConstantNode<(typeof ext)[number]>;
    case NameApplication:
      node.function = parseNode(node.function, ext);
      node.params = node.params.map((node) => parseNode(node, ext));
      return node as ApplicationNode;
    case NameVariable:
      return node as VariableNode;
    case NameTuple:
      node.elements = node.elements.map((node) => parseNode(node, ext));
      return node as TupleNode;
    case NameList:
      node.elements = node.elements.map((node) => parseNode(node, ext));
      return node as ListNode;
    case NameObject:
      for (const key in node.values) {
        node.values[key] = parseNode(node.values[key], ext);
      }
      return node as ObjectNode;
    case NameLambda:
      node.body = parseNode(node.body, ext);
      return node as LambdaNode;
    case NameField:
      node.expr = parseNode(node.expr, ext);
      if ("sub" in node && node.sub) node.sub = parseNode(node.sub, ext);
      return node as FieldNode;
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

export function parseAst(
  json: string,
  ext: ParserExtension<unknown, string>[]
): ASTNode {
  const root = JSON.parse(json);
  return parseNode(root, ext);
}
