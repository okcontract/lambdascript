// utils
export { length, plural } from "./utils";

export {
  NameApplication,
  NameConstant,
  NameError,
  NameField,
  NameLambda,
  NameList,
  NameObject,
  NameTuple,
  NameVariable,
  Names,
  newConstant,
  newFromJS,
  newLambda,
  newLambdaMulti,
  newList,
  newNumber,
  newObject,
  newVariable,
  type ASTNode,
  type ApplicationNode,
  type ConstantNode,
  type FieldNode,
  type LambdaNode,
  type ListNode,
  type ObjectNode,
  type VariableNode
} from "./ast";
export { newTypeScheme, type TypeScheme } from "./typeScheme";
export {
  newTypeConst,
  newTypeObject,
  newTypeTuple,
  newTypeVar,
  typeAny,
  typeFunction,
  typeList,
  type MonoType,
  type TypeAny,
  type TypeConst
} from "./types";

// parse and print
export { allDiff, firstDiff, isEqual } from "./equal";
export { toHighLevelAST, type ParserExtension } from "./highLevel";
export { toLowLevelAST } from "./lowLevel";
export { parseExpression, reservedKeywords } from "./parse";
export { parser } from "./parser/λs";
export { prettyPrint, prettyPrintType } from "./print";

// stdlib, environment and program
export { Environment, type ValueDefinition } from "./env";
export { EvalOption, Program } from "./program";
export {
  Rational,
  isRationalString,
  rationalNumberRegex,
  zero
} from "./rational";
export {
  defaultLibrary,
  rationalNumber,
  typeBoolean,
  typeBytes,
  typeFromJSValue,
  typeNumber,
  typeString,
  type FirstClassValue,
  type LibraryElement,
  type StandardLibrary
} from "./stdlib";
