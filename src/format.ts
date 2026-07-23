import { type LowLevelAST, toLowLevelAST } from "./lowLevel";
import { parser } from "./parser/λs";

export const Separator = {
  Space: " "
} as const;

export type Separator = (typeof Separator)[keyof typeof Separator];

export type FormatSettings = {
  separator: Separator;
  spaces: number;
  trailingCommas: boolean;
  width: number;
};

export const defaultFormatSettings: FormatSettings = {
  separator: Separator.Space,
  spaces: 2,
  trailingCommas: false,
  width: 80
};

type FormatOptions = Partial<FormatSettings>;

type Doc =
  | { kind: "text"; text: string }
  | { kind: "concat"; parts: Doc[] }
  | { kind: "group"; doc: Doc }
  | { kind: "nest"; spaces: number; doc: Doc }
  | { kind: "line"; mode: "regular" | "soft" | "hard" }
  | { kind: "ifBreak"; broken: Doc; flat: Doc };

type RenderMode = "flat" | "break";

type RenderCommand = {
  indent: number;
  mode: RenderMode;
  doc: Doc;
};

const emptyDoc = (): Doc => ({ kind: "concat", parts: [] });

const text = (value: string): Doc =>
  value.length === 0 ? emptyDoc() : { kind: "text", text: value };

const concatDocs = (parts: Doc[]): Doc => {
  const flat: Doc[] = [];
  for (const part of parts) {
    if (part.kind === "concat") {
      flat.push(...part.parts);
      continue;
    }
    if (part.kind === "text" && part.text.length === 0) {
      continue;
    }
    flat.push(part);
  }
  if (flat.length === 0) return emptyDoc();
  if (flat.length === 1) return flat[0];
  return { kind: "concat", parts: flat };
};

const group = (doc: Doc): Doc => ({ kind: "group", doc });

const nest = (spaces: number, doc: Doc): Doc =>
  spaces === 0 ? doc : { kind: "nest", spaces, doc };

const lineDoc: Doc = { kind: "line", mode: "regular" };
const softlineDoc: Doc = { kind: "line", mode: "soft" };
const hardlineDoc: Doc = { kind: "line", mode: "hard" };

const ifBreak = (broken: Doc, flat: Doc = emptyDoc()): Doc => ({
  kind: "ifBreak",
  broken,
  flat
});

const joinDocs = (separator: Doc, docs: Doc[]): Doc => {
  if (docs.length === 0) return emptyDoc();
  const parts: Doc[] = [docs[0]];
  for (let i = 1; i < docs.length; i++) {
    parts.push(separator, docs[i]);
  }
  return concatDocs(parts);
};

const normalizeSettings = (options: FormatOptions = {}): FormatSettings => ({
  ...defaultFormatSettings,
  ...options
});

const throwParseError = (value: string | undefined): never => {
  if (value && value.length > 0) {
    throw new Error(`Parse error: ${value}`);
  }
  throw new Error("Parse error.");
};

const findParseError = (node: LowLevelAST): string | undefined => {
  if (node.name === "⚠") return node.value;
  for (const child of node.children ?? []) {
    const value = findParseError(child);
    if (value !== undefined) return value;
  }
  return undefined;
};

const parseSource = (source: string): LowLevelAST => {
  const root = toLowLevelAST(source, parser.parse(source));
  const error = findParseError(root);
  if (error !== undefined) {
    throwParseError(error);
  }
  return root;
};

const needsParens = (parentPrecedence: number, precedence: number): boolean =>
  precedence < parentPrecedence;

const wrapParens = (doc: Doc): Doc => concatDocs([text("("), doc, text(")")]);

const wrapIfNeeded = (
  doc: Doc,
  parentPrecedence: number,
  precedence: number
): Doc => (needsParens(parentPrecedence, precedence) ? wrapParens(doc) : doc);

const binaryPrecedence = (operator: string): number => {
  switch (operator) {
    case "||":
      return 10;
    case "&&":
      return 20;
    case "in":
    case "isa":
    case "=":
    case "!=":
    case "<":
    case "<=":
    case ">":
    case ">=":
      return 30;
    case "+":
    case "-":
      return 40;
    case "*":
    case "/":
    case "%":
      return 50;
    case "^":
      return 60;
    default:
      return 30;
  }
};

const precedenceOf = (node: LowLevelAST): number => {
  switch (node.name) {
    case "FunctionExpression":
    case "PairExpression":
      return 5;
    case "TernaryExpression":
      return 8;
    case "BinaryExpression": {
      const operator = node.children?.[1]?.value ?? "";
      return binaryPrecedence(operator);
    }
    case "UnaryExpression":
      return 70;
    case "SpreadExpression":
      return 75;
    case "InterpolationExpression":
      return 80;
    case "FieldExpression":
    case "SubscriptExpression":
    case "CallExpression":
      return 90;
    default:
      return 100;
  }
};

const formatDelimited = (
  open: string,
  close: string,
  items: Doc[],
  settings: FormatSettings,
  options: { bracketSpacing: boolean; trailingCommas?: boolean }
): Doc => {
  if (items.length === 0) {
    return concatDocs([text(open), text(close)]);
  }
  const boundary = options.bracketSpacing ? lineDoc : softlineDoc;
  const trailingComma =
    options.trailingCommas && settings.trailingCommas
      ? ifBreak(text(","))
      : emptyDoc();
  return group(
    concatDocs([
      text(open),
      nest(
        settings.spaces,
        concatDocs([
          boundary,
          joinDocs(concatDocs([text(","), lineDoc]), items),
          trailingComma
        ])
      ),
      boundary,
      text(close)
    ])
  );
};

const formatWrapped = (
  open: string,
  close: string,
  content: Doc,
  settings: FormatSettings,
  mode: "soft" | "regular"
): Doc => {
  const boundary = mode === "regular" ? lineDoc : softlineDoc;
  return group(
    concatDocs([
      text(open),
      nest(settings.spaces, concatDocs([boundary, content])),
      boundary,
      text(close)
    ])
  );
};

const formatChildren = (
  node: LowLevelAST,
  settings: FormatSettings,
  parentPrecedence = 0
): Doc[] =>
  (node.children ?? []).map((child) =>
    formatExpressionNode(child, settings, parentPrecedence)
  );

const formatBinding = (node: LowLevelAST, settings: FormatSettings): Doc => {
  const [nameNode, exprNode] = node.children ?? [];
  if (!nameNode || !exprNode) {
    throw new Error("Invalid binding");
  }
  return group(
    concatDocs([
      text(nameNode.value ?? ""),
      text(" = "),
      formatExpressionNode(exprNode, settings)
    ])
  );
};

const formatNamedField = (node: LowLevelAST, settings: FormatSettings): Doc => {
  const [nameNode, valueNode] = node.children ?? [];
  if (!nameNode || !valueNode) {
    throw new Error("Invalid named field");
  }
  return group(
    concatDocs([
      text(nameNode.value ?? ""),
      text(": "),
      formatExpressionNode(valueNode, settings)
    ])
  );
};

const formatNamedArgument = (
  node: LowLevelAST,
  settings: FormatSettings
): Doc => {
  const [field] = node.children ?? [];
  if (!field) {
    throw new Error("Invalid named argument");
  }
  return formatNamedField(field, settings);
};

const formatArgumentList = (
  node: LowLevelAST,
  settings: FormatSettings
): Doc => {
  const children = node.children ?? [];
  if (children.length === 0) {
    return concatDocs([text("("), text(")")]);
  }
  const positional = children.filter((child) => child.name !== "NamedArgument");
  const named = children.filter((child) => child.name === "NamedArgument");
  const positionalDoc = joinDocs(
    concatDocs([text(","), lineDoc]),
    positional.map((child) => formatExpressionNode(child, settings))
  );
  const namedDoc = joinDocs(
    concatDocs([text(","), lineDoc]),
    named.map((child) => formatNamedArgument(child, settings))
  );
  let content = emptyDoc();
  if (positional.length > 0) {
    content = positionalDoc;
  }
  if (named.length > 0) {
    content =
      positional.length > 0
        ? concatDocs([content, text(";"), lineDoc, namedDoc])
        : concatDocs([text(";"), lineDoc, namedDoc]);
  }
  return group(
    concatDocs([
      text("("),
      nest(
        settings.spaces,
        concatDocs([
          softlineDoc,
          content,
          settings.trailingCommas ? ifBreak(text(",")) : emptyDoc()
        ])
      ),
      softlineDoc,
      text(")")
    ])
  );
};

const formatFunctionParameters = (
  node: LowLevelAST,
  settings: FormatSettings
): Doc => {
  if (node.name === "Identifier") {
    return text(node.value ?? "");
  }
  if (node.name !== "ArgumentList") {
    throw new Error(`Unsupported function parameter list: ${node.name}`);
  }
  const items = (node.children ?? []).map((child) =>
    formatExpressionNode(child, settings)
  );
  return formatDelimited("(", ")", items, settings, {
    bracketSpacing: false
  });
};

const formatComprehensionClause = (
  node: LowLevelAST,
  settings: FormatSettings
): Doc =>
  joinDocs(
    lineDoc,
    (node.children ?? []).map((child) => formatExpressionNode(child, settings))
  );

const formatExpressionNode = (
  node: LowLevelAST,
  settings: FormatSettings,
  parentPrecedence = 0
): Doc => {
  switch (node.name) {
    case "Identifier":
    case "BooleanValue":
    case "Character":
    case "NumberValue":
    case "StringValue":
    case "TripleString":
    case "CommandString":
      return text(node.value ?? "");

    case "SymbolValue": {
      const [identifier] = node.children ?? [];
      return concatDocs([text(":"), text(identifier?.value ?? "")]);
    }

    case "PrefixedString": {
      const [prefix, value] = node.children ?? [];
      return concatDocs([text(prefix?.value ?? ""), text(value?.value ?? "")]);
    }

    case "InterpolationExpression": {
      const [valueNode] = node.children ?? [];
      if (!valueNode) throw new Error("Invalid interpolation expression");
      if (valueNode.name === "Identifier") {
        return concatDocs([text("#"), text(valueNode.value ?? "")]);
      }
      return concatDocs([
        text("#("),
        formatExpressionNode(valueNode, settings),
        text(")")
      ]);
    }

    case "ParenthesizedExpression": {
      const [content] = node.children ?? [];
      if (!content) {
        return concatDocs([text("("), text(")")]);
      }
      return formatWrapped(
        "(",
        ")",
        formatExpressionNode(content, settings),
        settings,
        "soft"
      );
    }

    case "TupleExpression":
      return formatDelimited(
        "{",
        "}",
        formatChildren(node, settings),
        settings,
        { bracketSpacing: true, trailingCommas: true }
      );

    case "ArrayExpression":
      return formatDelimited(
        "[",
        "]",
        formatChildren(node, settings),
        settings,
        { bracketSpacing: false, trailingCommas: true }
      );

    case "ObjectExpression":
      return formatDelimited(
        "{",
        "}",
        (node.children ?? []).map((child) => formatNamedField(child, settings)),
        settings,
        { bracketSpacing: true, trailingCommas: true }
      );

    case "NamedField":
      return formatNamedField(node, settings);

    case "CallExpression": {
      const [callee, args] = node.children ?? [];
      if (!callee || !args) throw new Error("Invalid call expression");
      const doc = concatDocs([
        formatExpressionNode(callee, settings, precedenceOf(node)),
        formatArgumentList(args, settings)
      ]);
      return wrapIfNeeded(doc, parentPrecedence, precedenceOf(node));
    }

    case "FieldExpression": {
      const [target, field] = node.children ?? [];
      if (!target || !field) throw new Error("Invalid field expression");
      const doc = concatDocs([
        formatExpressionNode(target, settings, precedenceOf(node)),
        text("."),
        field.name === "Identifier"
          ? text(field.value ?? "")
          : formatExpressionNode(field, settings)
      ]);
      return wrapIfNeeded(doc, parentPrecedence, precedenceOf(node));
    }

    case "SubscriptExpression": {
      const [target, ...indexes] = node.children ?? [];
      if (!target) throw new Error("Invalid subscript expression");
      const indexDoc = formatDelimited(
        "[",
        "]",
        indexes.map((child) => formatExpressionNode(child, settings)),
        settings,
        { bracketSpacing: false, trailingCommas: true }
      );
      const doc = concatDocs([
        formatExpressionNode(target, settings, precedenceOf(node)),
        indexDoc
      ]);
      return wrapIfNeeded(doc, parentPrecedence, precedenceOf(node));
    }

    case "UnaryExpression": {
      const [left, right] = node.children ?? [];
      if (!left || !right) throw new Error("Invalid unary expression");
      const precedence = precedenceOf(node);
      if (left.value !== undefined && left.name.includes("Operator")) {
        const doc = concatDocs([
          text(left.value),
          formatExpressionNode(right, settings, precedence)
        ]);
        return wrapIfNeeded(doc, parentPrecedence, precedence);
      }
      const doc = concatDocs([
        formatExpressionNode(left, settings, precedence),
        text(right.value ?? "")
      ]);
      return wrapIfNeeded(doc, parentPrecedence, precedence);
    }

    case "BinaryExpression": {
      const [left, operator, right] = node.children ?? [];
      if (!left || !operator || !right) {
        throw new Error("Invalid binary expression");
      }
      const precedence = binaryPrecedence(operator.value ?? "");
      const doc = group(
        concatDocs([
          formatExpressionNode(left, settings, precedence),
          text(` ${operator.value ?? ""}`),
          nest(
            settings.spaces,
            concatDocs([
              lineDoc,
              formatExpressionNode(right, settings, precedence + 1)
            ])
          )
        ])
      );
      return wrapIfNeeded(doc, parentPrecedence, precedence);
    }

    case "TernaryExpression": {
      const [condition, thenNode, elseNode] = node.children ?? [];
      if (!condition || !thenNode || !elseNode) {
        throw new Error("Invalid ternary expression");
      }
      const precedence = precedenceOf(node);
      const doc = group(
        concatDocs([
          formatExpressionNode(condition, settings, precedence),
          text(" ?"),
          nest(
            settings.spaces,
            concatDocs([
              lineDoc,
              formatExpressionNode(thenNode, settings, precedence),
              text(" :"),
              lineDoc,
              formatExpressionNode(elseNode, settings, precedence)
            ])
          )
        ])
      );
      return wrapIfNeeded(doc, parentPrecedence, precedence);
    }

    case "FunctionExpression": {
      const [parameters, body] = node.children ?? [];
      if (!parameters || !body) throw new Error("Invalid function expression");
      const precedence = precedenceOf(node);
      const doc = group(
        concatDocs([
          formatFunctionParameters(parameters, settings),
          text(" =>"),
          nest(
            settings.spaces,
            concatDocs([
              lineDoc,
              formatExpressionNode(body, settings, precedence)
            ])
          )
        ])
      );
      return wrapIfNeeded(doc, parentPrecedence, precedence);
    }

    case "PairExpression": {
      const [left, right] = node.children ?? [];
      if (!left || !right) throw new Error("Invalid pair expression");
      const precedence = precedenceOf(node);
      const doc = group(
        concatDocs([
          formatExpressionNode(left, settings, precedence),
          text(" =>"),
          nest(
            settings.spaces,
            concatDocs([
              lineDoc,
              formatExpressionNode(right, settings, precedence)
            ])
          )
        ])
      );
      return wrapIfNeeded(doc, parentPrecedence, precedence);
    }

    case "SpreadExpression": {
      const [valueNode] = node.children ?? [];
      if (!valueNode) throw new Error("Invalid spread expression");
      const precedence = precedenceOf(node);
      const doc = concatDocs([
        formatExpressionNode(valueNode, settings, precedence),
        text("...")
      ]);
      return wrapIfNeeded(doc, parentPrecedence, precedence);
    }

    case "RangeExpression": {
      const [start, end] = node.children ?? [];
      if (!start || !end) throw new Error("Invalid range expression");
      const doc = group(
        concatDocs([
          formatExpressionNode(start, settings, precedenceOf(node)),
          text("::"),
          nest(
            settings.spaces,
            concatDocs([
              lineDoc,
              formatExpressionNode(end, settings, precedenceOf(node) + 1)
            ])
          )
        ])
      );
      return wrapIfNeeded(doc, parentPrecedence, precedenceOf(node));
    }

    case "ArrayComprehensionExpression": {
      const [valueNode, ...clauses] = node.children ?? [];
      if (!valueNode) throw new Error("Invalid array comprehension");
      return formatWrapped(
        "[",
        "]",
        concatDocs([
          formatExpressionNode(valueNode, settings),
          text(" "),
          formatComprehensionClause(
            {
              name: "comprehensionClause",
              children: clauses,
              from: node.from,
              to: node.to
            },
            settings
          )
        ]),
        settings,
        "soft"
      );
    }

    case "GeneratorExpression": {
      const [valueNode, ...clauses] = node.children ?? [];
      if (!valueNode) throw new Error("Invalid generator expression");
      return formatWrapped(
        "(",
        ")",
        concatDocs([
          formatExpressionNode(valueNode, settings),
          text(" "),
          formatComprehensionClause(
            {
              name: "comprehensionClause",
              children: clauses,
              from: node.from,
              to: node.to
            },
            settings
          )
        ]),
        settings,
        "soft"
      );
    }

    case "ForClause": {
      const bindings = (node.children ?? []).filter(
        (child) => child.name === "ForBinding"
      );
      return group(
        concatDocs([
          text("for "),
          joinDocs(
            concatDocs([text(","), lineDoc]),
            bindings.map((child) => formatExpressionNode(child, settings))
          )
        ])
      );
    }

    case "ForBinding": {
      const [identifier, operator, valueNode] = node.children ?? [];
      if (!identifier || !operator || !valueNode) {
        throw new Error("Invalid for binding");
      }
      return group(
        concatDocs([
          text(identifier.value ?? ""),
          text(` ${operator.value ?? ""} `),
          formatExpressionNode(valueNode, settings)
        ])
      );
    }

    case "IfClause": {
      const [, condition] = node.children ?? [];
      if (!condition) throw new Error("Invalid if clause");
      return group(
        concatDocs([text("if "), formatExpressionNode(condition, settings)])
      );
    }

    case "SourceFile":
      return formatSourceFile(node, settings);

    case "Program":
    case "ProgramComponent":
    case "LetComponent":
    case "TopLevelDefinition":
    case "ComponentBinding":
      return formatProgramNode(node, settings);

    default:
      throw new Error(`Unsupported formatter node: ${node.name}`);
  }
};

const formatProgramComponent = (
  node: LowLevelAST,
  settings: FormatSettings
): Doc => {
  const [inner] = node.children ?? [];
  if (!inner) return emptyDoc();
  return formatProgramNode(inner, settings);
};

const formatLetComponent = (
  node: LowLevelAST,
  settings: FormatSettings
): Doc => {
  const children = node.children ?? [];
  const bindings: LowLevelAST[] = [];
  let resultNode: LowLevelAST | undefined;
  for (const child of children) {
    if (child.name === "ComponentBinding") {
      bindings.push(child);
    }
    if (child.name === "in") {
      resultNode = children[children.indexOf(child) + 1];
      break;
    }
  }
  if (bindings.length === 0 || !resultNode) {
    throw new Error("Invalid let component");
  }
  const [firstBinding, ...restBindings] = bindings;
  return group(
    concatDocs([
      text("let "),
      formatBinding(firstBinding, settings),
      ...restBindings.flatMap((binding) => [
        lineDoc,
        text("and "),
        formatBinding(binding, settings)
      ]),
      lineDoc,
      text("in "),
      formatExpressionNode(resultNode, settings)
    ])
  );
};

const formatProgramNode = (
  node: LowLevelAST,
  settings: FormatSettings
): Doc => {
  switch (node.name) {
    case "Program":
      return joinDocs(
        hardlineDoc,
        (node.children ?? []).map((child) =>
          formatProgramComponent(child, settings)
        )
      );
    case "ProgramComponent":
      return formatProgramComponent(node, settings);
    case "LetComponent":
      return formatLetComponent(node, settings);
    case "TopLevelDefinition": {
      const [binding] = node.children ?? [];
      if (!binding) throw new Error("Invalid top level definition");
      return formatBinding(binding, settings);
    }
    case "ComponentBinding":
      return formatBinding(node, settings);
    default:
      return formatExpressionNode(node, settings);
  }
};

const formatSourceFile = (node: LowLevelAST, settings: FormatSettings): Doc => {
  const children = node.children ?? [];
  if (children.length === 0) return emptyDoc();
  if (children.length === 1) {
    const [onlyChild] = children;
    if (!onlyChild) return emptyDoc();
    if (onlyChild.name === "Program") {
      return formatProgramNode(onlyChild, settings);
    }
    return formatExpressionNode(onlyChild, settings);
  }
  return joinDocs(
    hardlineDoc,
    children.map((child) =>
      child.name === "Program"
        ? formatProgramNode(child, settings)
        : formatExpressionNode(child, settings)
    )
  );
};

const fits = (
  remainingWidth: number,
  commands: RenderCommand[],
  settings: FormatSettings
): boolean => {
  const queue = [...commands];
  while (remainingWidth >= 0 && queue.length > 0) {
    const next = queue.pop();
    if (!next) break;
    const { indent, mode, doc } = next;
    switch (doc.kind) {
      case "text":
        remainingWidth -= doc.text.length;
        break;
      case "concat":
        for (let i = doc.parts.length - 1; i >= 0; i--) {
          queue.push({ indent, mode, doc: doc.parts[i] });
        }
        break;
      case "group":
        queue.push({ indent, mode: "flat", doc: doc.doc });
        break;
      case "nest":
        queue.push({ indent: indent + doc.spaces, mode, doc: doc.doc });
        break;
      case "line":
        if (doc.mode === "hard") {
          return mode === "break";
        }
        if (mode === "break") {
          return true;
        }
        if (doc.mode === "regular") {
          remainingWidth -= settings.separator.length;
        }
        break;
      case "ifBreak":
        queue.push({
          indent,
          mode,
          doc: mode === "break" ? doc.broken : doc.flat
        });
        break;
    }
  }
  return remainingWidth >= 0;
};

const renderDoc = (doc: Doc, settings: FormatSettings): string => {
  const output: string[] = [];
  const stack: RenderCommand[] = [{ indent: 0, mode: "break", doc }];
  let column = 0;
  while (stack.length > 0) {
    const command = stack.pop();
    if (!command) break;
    const { indent, mode, doc: current } = command;
    switch (current.kind) {
      case "text":
        output.push(current.text);
        column += current.text.length;
        break;
      case "concat":
        for (let i = current.parts.length - 1; i >= 0; i--) {
          stack.push({ indent, mode, doc: current.parts[i] });
        }
        break;
      case "group": {
        const flatCommand: RenderCommand = {
          indent,
          mode: "flat",
          doc: current.doc
        };
        if (fits(settings.width - column, [...stack, flatCommand], settings)) {
          stack.push(flatCommand);
        } else {
          stack.push({ indent, mode: "break", doc: current.doc });
        }
        break;
      }
      case "nest":
        stack.push({
          indent: indent + current.spaces,
          mode,
          doc: current.doc
        });
        break;
      case "line":
        if (current.mode === "hard" || mode === "break") {
          output.push(`\n${" ".repeat(indent)}`);
          column = indent;
          break;
        }
        if (current.mode === "regular") {
          output.push(settings.separator);
          column += settings.separator.length;
        }
        break;
      case "ifBreak":
        stack.push({
          indent,
          mode,
          doc: mode === "break" ? current.broken : current.flat
        });
        break;
    }
  }
  return output.join("");
};

export const formatSource = (
  source: string,
  options: FormatOptions = {}
): string => {
  const settings = normalizeSettings(options);
  const root = parseSource(source);
  return renderDoc(formatSourceFile(root, settings), settings);
};

export const formatExpression = (
  source: string,
  options: FormatOptions = {}
): string => {
  const settings = normalizeSettings(options);
  const root = parseSource(source);
  const child = root.children?.[0];
  if (
    !child ||
    child.name === "Program" ||
    (root.children?.length ?? 0) !== 1
  ) {
    throw new Error("Expected expression source");
  }
  return renderDoc(formatExpressionNode(child, settings), settings);
};

export const formatProgram = (
  source: string,
  options: FormatOptions = {}
): string => {
  const settings = normalizeSettings(options);
  const root = parseSource(source);
  const programNode = root.children?.find((child) => child.name === "Program");
  if (!programNode) {
    throw new Error("Expected program definition");
  }
  return renderDoc(formatProgramNode(programNode, settings), settings);
};
