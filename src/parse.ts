import type { ASTNode, SourceRange } from "./ast";
import { type ParserExtension, toHighLevelAST } from "./highLevel";
import { type LowLevelAST, toLowLevelAST } from "./lowLevel";
import { parser } from "./parser/λs";

export const reservedKeywords = [
  "true",
  "false",
  "if",
  "for",
  "in",
  "let",
  "and"
];

export type ParseOptions = {
  ext?: ParserExtension<unknown, string>[];
};

export type ProgramBinding = {
  name: string;
  expr: ASTNode;
  range?: SourceRange;
};

export type ProgramComponent = {
  bindings: ProgramBinding[];
  result: ASTNode;
};

export type ParsedProgram = {
  components: ProgramComponent[];
  definitions: ProgramBinding[];
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

const scientificNotationPattern =
  /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))[eE]([+-]?\d+)$/;

const normalizeScientificNotation = (value: string): string => {
  const sanitized = value.replace(/_/g, "");
  const match = sanitized.match(scientificNotationPattern);
  if (!match) return value;

  const sign = match[1] === "-" ? "-" : "";
  const integerDigits = match[2] ?? "";
  const fractionDigits =
    match[3] && match[3] !== "" ? match[3] : (match[4] ?? "");
  const exponent = Number(match[5]);

  const mantissa = integerDigits + fractionDigits;
  const digits = mantissa === "" ? "0" : mantissa;
  const decimalIndex = integerDigits.length;
  const shiftedIndex = decimalIndex + exponent;

  if (/^0+$/.test(digits)) {
    return "0";
  }

  let result: string;

  if (exponent >= 0) {
    if (shiftedIndex >= digits.length) {
      result = digits + "0".repeat(shiftedIndex - digits.length);
    } else {
      const whole = digits.slice(0, shiftedIndex) || "0";
      const fraction = digits.slice(shiftedIndex);
      result = fraction ? `${whole}.${fraction}` : whole;
    }
  } else if (shiftedIndex <= 0) {
    const zeros = "0".repeat(-shiftedIndex);
    result = `0.${zeros}${digits}`;
  } else {
    const whole = digits.slice(0, shiftedIndex) || "0";
    const fraction = digits.slice(shiftedIndex);
    result = `${whole}.${fraction}`;
  }

  if (result.includes(".")) {
    result = result.replace(/^0+(?=\d)/, "");
    if (result.startsWith(".")) {
      result = `0${result}`;
    }
  } else {
    result = result.replace(/^0+(?=\d)/, "");
  }

  const final = sign + result;
  return final === "-0" ? "0" : final;
};

const normalizeNumbers = (node: LowLevelAST): void => {
  if (node.name === "NumberValue" && typeof node.value === "string") {
    node.value = normalizeScientificNotation(node.value);
  }
  node.children?.forEach(normalizeNumbers);
};

const toProgramBinding = (
  node: LowLevelAST,
  extensions: ParserExtension<unknown, string>[]
): ProgramBinding => {
  if (node.name !== "ComponentBinding")
    throwRangedError(`Unexpected node in binding: ${node.name}`, node);
  const [identifier, exprNode] = node.children ?? [];
  if (identifier?.name !== "Identifier")
    throwRangedError("Program bindings must start with an identifier", node);
  if (!exprNode)
    throwRangedError(
      `Missing expression for program binding "${identifier.value ?? ""}"`,
      identifier
    );
  return {
    name: identifier.value as string,
    expr: toHighLevelAST(exprNode, extensions),
    range: rangeFor(identifier)
  };
};

const toProgramComponent = (
  node: LowLevelAST,
  extensions: ParserExtension<unknown, string>[]
): ProgramComponent => {
  if (node.name !== "LetComponent")
    throwRangedError(`Unexpected node in component: ${node.name}`, node);
  const bindings: ProgramBinding[] = [];
  let result: ASTNode | undefined;
  const children = node.children ?? [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) continue;
    switch (child.name) {
      case "ComponentBinding":
        bindings.push(toProgramBinding(child, extensions));
        break;
      case "in": {
        const exprNode = children[i + 1];
        if (!exprNode)
          throwRangedError("Missing result expression after `in`", child);
        result = toHighLevelAST(exprNode, extensions);
        i++; // Skip expression node, already processed
        break;
      }
      case "let":
      case "and":
        break;
      default:
        throwRangedError(
          `Unknown element in let component: ${child.name}`,
          child
        );
    }
  }
  if (!bindings.length)
    return throwRangedError(
      "Let components must declare at least one binding",
      node
    );
  const resolvedResult = result;
  if (!resolvedResult)
    return throwRangedError(
      "Let components must provide a result after `in`",
      node
    );
  return { bindings, result: resolvedResult };
};

const toParsedProgram = (
  node: LowLevelAST,
  extensions: ParserExtension<unknown, string>[]
): ParsedProgram => {
  if (node.name !== "Program")
    return throwRangedError(`Unexpected node for program: ${node.name}`, node);
  const components: ProgramComponent[] = [];
  const definitions: ProgramBinding[] = [];
  for (const component of node.children ?? []) {
    if (component.name !== "ProgramComponent") continue;
    const [inner] = component.children ?? [];
    if (!inner) continue;
    if (inner.name === "LetComponent") {
      components.push(toProgramComponent(inner, extensions));
      continue;
    }
    if (inner.name === "TopLevelDefinition") {
      const binding = inner.children?.find(
        (child) => child.name === "ComponentBinding"
      );
      if (!binding)
        return throwRangedError(
          "Top level definition missing binding content",
          inner
        );
      definitions.push(toProgramBinding(binding, extensions));
      continue;
    }
    throwRangedError(`Unknown program component type: ${inner.name}`, inner);
  }
  return { components, definitions };
};

export const parseExpression = async (
  expr: string,
  options: ParseOptions = {}
): Promise<ASTNode> => {
  return new Promise((resolve, reject) => {
    try {
      // 1. parse tree
      const tree = parser.parse(expr);
      // 2. low-level AST
      const lowLevelAST = toLowLevelAST(expr, tree);
      normalizeNumbers(lowLevelAST);
      // 3. high-level AST
      const highLevelAST = toHighLevelAST(lowLevelAST, options.ext);
      resolve(highLevelAST);
    } catch (error) {
      reject(error);
    }
  });
};

export const parseProgram = async (
  source: string,
  options: ParseOptions = {}
): Promise<ParsedProgram> => {
  return new Promise((resolve, reject) => {
    try {
      const { ext = [] } = options;
      const tree = parser.parse(source);
      const lowLevelAST = toLowLevelAST(source, tree);
      normalizeNumbers(lowLevelAST);
      const programNode = lowLevelAST.children?.find(
        (child) => child.name === "Program"
      );
      if (!programNode) {
        if (source.trim() === "") {
          resolve({ components: [], definitions: [] });
          return;
        }
        return throwRangedError("Expected program definition", lowLevelAST);
      }
      resolve(toParsedProgram(programNode, ext));
    } catch (error) {
      reject(error);
    }
  });
};
