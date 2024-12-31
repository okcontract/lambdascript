import { Rational } from "./rational";

export type NodeType = ASTNode["type"];

export const NameApplication = "app";
export const NameConstant = "const";
export const NameVariable = "var";
export const NameList = "lst";
export const NameObject = "obj";
export const NameLambda = "λ";
export const NameField = "field";
export const NameError = "error";
export const NameTuple = "tup";

export const Names = Object.entries({
  [NameApplication]: "NameApplication",
  [NameConstant]: "NameConstant",
  [NameVariable]: "NameVariable",
  [NameList]: "NameList",
  [NameObject]: "NameObject",
  [NameLambda]: "NameLambda",
  [NameField]: "NameField",
  [NameError]: "NameError",
  [NameTuple]: "NameTuple"
}) as [NodeType, string][];

// @todo ASTNode<Extensions>
export type ASTNode =
  | ApplicationNode
  | ConstantNode<unknown>
  | VariableNode
  | ListNode
  | ObjectNode
  | LambdaNode
  | FieldNode
  | ErrorNode
  | TupleNode

  // TemporaryNodes
  | { type: "named"; key: string; value: ASTNode };

export type ApplicationNode = {
  type: typeof NameApplication;
  function: ASTNode;
  params: ASTNode[];
};

// RawConstant without extensions (e.g. Address in `@okcontract/sdk`)
export type RawConstant = string | boolean | Rational;

export interface ConstantNode<Extensions> {
  type: typeof NameConstant;
  value: RawConstant | Extensions;
}

export const newNumber = (
  n: string | number | bigint | Rational
): ConstantNode<unknown> => {
  const value: Rational = n instanceof Rational ? n : new Rational(n);
  return {
    type: NameConstant,
    value
  };
};

export const newConstant = (
  value: string | boolean | number | bigint
): ConstantNode<unknown> =>
  typeof value === "number" || typeof value === "bigint"
    ? newNumber(value)
    : {
        type: NameConstant,
        value
      };

export interface VariableNode {
  type: typeof NameVariable;
  name: string;
}

export const newVariable = (name: string): VariableNode => ({
  type: NameVariable,
  name
});

export interface ListNode {
  type: typeof NameList;
  elements: ASTNode[];
}

export interface TupleNode {
  type: typeof NameTuple;
  elements: ASTNode[];
}

export const newList = (elements: ASTNode[]): ListNode => ({
  type: NameList,
  elements
});

export const newTuple = (elements: ASTNode[]): TupleNode => ({
  type: NameTuple,
  elements
});

export interface ObjectNode {
  type: typeof NameObject;
  values: { [key: string]: ASTNode };
}

export const newObject = (values: { [key: string]: ASTNode }): ObjectNode => ({
  type: NameObject,
  values
});

export const newFromJS = (value: unknown): ASTNode =>
  Array.isArray(value)
    ? newList(value.map(newFromJS))
    : typeof value === "object" && value !== null
      ? newObject(
          Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, newFromJS(v)])
          )
        )
      : typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "bigint" ||
          typeof value === "boolean"
        ? newConstant(value)
        : // @todo fail?
          newConstant(null);

export type FieldNode = {
  type: typeof NameField;
  expr: ASTNode;
} & ({ field: string } | { sub: ASTNode });

export interface LambdaNode {
  type: typeof NameLambda;
  parameter: string;
  body: ASTNode;
}

export const newLambda = (parameter: string, body: ASTNode): LambdaNode => ({
  type: NameLambda,
  parameter,
  body
});

export const newLambdaMulti = (
  parameters: string[],
  body: ASTNode
): LambdaNode => {
  const [hd, ...tl] = parameters;
  if (tl.length === 0) return newLambda(hd, body);
  return newLambda(hd, newLambdaMulti(tl, body));
};

export interface ErrorNode {
  type: typeof NameError;
  value: string;
}
