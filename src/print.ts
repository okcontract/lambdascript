import { jsonStringify } from "@okcontract/cells";

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
  NameVariable
} from "./ast";
import type { MonoType, TypeVar } from "./types";

const greekLetters = [
  "α",
  "β",
  "γ",
  "δ",
  "ε",
  "ζ",
  "η",
  "θ",
  "ι",
  "κ",
  "λ",
  "μ",
  "ν",
  "ξ",
  "ο",
  "π",
  "ρ",
  "ς",
  "σ",
  "τ",
  "υ",
  "φ",
  "χ",
  "ψ",
  "ω"
];

function getPrettyTypeVar(m: Map<string, string>, typeVar: TypeVar): string {
  if (!m.has(typeVar.type)) {
    const newIndex = m.size;
    const greekLetter =
      greekLetters[newIndex % greekLetters.length] +
      (newIndex < greekLetters.length
        ? ""
        : `${Math.floor(newIndex / greekLetters.length)}`);
    m.set(typeVar.type, greekLetter);
  }
  return m.get(typeVar.type);
}

export function prettyPrintType(type: MonoType): string {
  const typeVarMap = new Map<string, string>();
  const aux = (type: MonoType): string => {
    switch (type.kind) {
      case NameVariable:
        return getPrettyTypeVar(typeVarMap, type);
      case NameConstant:
        return type.type;
      case NameLambda: {
        const argTypes = type.argTypes
          .map((argType) => aux(argType))
          .join(", ");
        const returnType = aux(type.returnType);
        return `(${argTypes}) -> ${returnType}`;
      }
      case NameList:
        return `[${aux(type.elementType)}]`;
      case NameTuple:
        return `{${type.elementTypes.map(aux).join(", ")}}`;
      case NameObject: {
        const fields = Object.entries(type.fields)
          .map(([key, fieldType]) => `${key}: ${aux(fieldType)}`)
          .join(", ");
        return `{${fields}}`;
      }
      default:
        return "";
    }
  };
  return aux(type);
}

// @todo share with parser?
const operatorPrecedence: { [key: string]: number } = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "^": 3,
  "=": 0,
  "<": 0,
  ">": 0,
  "!": 0
};

function isInteger(str) {
  const num = Number.parseInt(str, 10);
  return !Number.isNaN(num) && Number.isInteger(num) && num.toString() === str;
}

function toBoldUnicode(text: string) {
  const getBoldChar = (char) => {
    const code = char.codePointAt(0);

    // Uppercase letters A-Z
    if (code >= 0x41 && code <= 0x5a) {
      return String.fromCodePoint(0x1d400 + (code - 0x41));
    }
    // Lowercase letters a-z
    if (code >= 0x61 && code <= 0x7a) {
      return String.fromCodePoint(0x1d41a + (code - 0x61));
    }
    // Digits 0-9
    if (code >= 0x30 && code <= 0x39) {
      return String.fromCodePoint(0x1d7ce + (code - 0x30));
    }
    // Common symbols
    switch (char) {
      case "+":
        return "\u{1D756}";
      case "-":
        return "\u{1D757}";
      case "*":
        return "\u{1D758}";
      case "/":
        return "\u{1D759}";
      case "=":
        return "\u{1D75A}";
      case "<":
        return "\u{1D75B}";
      case ">":
        return "\u{1D75C}";
      case "(":
        return "\u{1D75D}";
      case ")":
        return "\u{1D75E}";
      case "[":
        return "\u{1D75F}";
      case "]":
        return "\u{1D760}";
      case "{":
        return "\u{1D761}";
      case "}":
        return "\u{1D762}";
      default:
        return char;
    }
  };

  return Array.from(text).map(getBoldChar).join("");
}

export function prettyPrint(node: ASTNode, parentPrecedence = 0): string {
  switch (node.type) {
    case NameApplication: {
      // Treat as infix operator if name starts with specified characters.
      let name: string;
      if (node.function.type === NameVariable) {
        name = node.function.name;
        if (name !== "!" && /^[\+\-\*\/=<>!^&|]/.test(name)) {
          const params = node.params.map((p) =>
            prettyPrint(p, operatorPrecedence[name])
          );
          const expression = `${params.join(` ${name} `)}`;
          if (parentPrecedence > operatorPrecedence[name]) {
            return `(${expression})`;
          }
          return expression;
        }
      } else {
        name = prettyPrint(node.function);
      }
      const params = node.params.map(prettyPrint);
      return `${name}(${params.join(", ")})`;
    }

    case NameConstant: {
      const value = node.value;
      // Stringable values
      if (typeof value === "object" && "toString" in value)
        return value.toString();
      return jsonStringify(value);
    }

    case NameVariable:
      return node.name; // toBoldUnicode(node.name);

    case NameList: {
      const elements = node.elements.map(prettyPrint).join(", ");
      return `[${elements}]`;
    }

    case NameTuple: {
      const elements = node.elements.map(prettyPrint).join(", ");
      return `{${elements}}`;
    }

    case NameObject: {
      const values = Object.entries(node.values)
        .map(([key, value]) => `${key}: ${prettyPrint(value)}`)
        .join(", ");
      return `{${values}}`;
    }

    case NameLambda:
      return `${node.parameter} => (${prettyPrint(node.body)})`;

    case NameField: {
      const fieldName = "field" in node ? node.field : prettyPrint(node.sub);
      return isInteger(fieldName)
        ? `${prettyPrint(node.expr)}[${fieldName}]`
        : `${prettyPrint(node.expr)}.${fieldName}`;
    }
    case "named":
      throw new Error(
        `node type "named" is temporary and shouldn't appear in final AST`
      );
    case NameError:
      return node.value;

    default: {
      const _unreachable: never = node;
      throw _unreachable;
    }
  }
}

export function prettyPrintHTML(node: ASTNode, parentPrecedence = 0): string {
  switch (node.type) {
    case NameApplication: {
      let name: string;
      if (node.function.type === NameVariable) {
        name = node.function.name;
        if (name !== "!" && /^[\+\-\*\/=<>!^&|]/.test(name)) {
          const params = node.params.map((p) =>
            prettyPrintHTML(p, operatorPrecedence[name])
          );
          const expression = `${params.join(` ${name} `)}`;
          if (parentPrecedence > operatorPrecedence[name]) {
            return `<span>(</span>${expression}<span>)</span>`;
          }
          return expression;
        }
      } else {
        name = prettyPrintHTML(node.function);
      }
      const params = node.params.map(prettyPrint);
      return `<span>${name}</span><span>(</span>${params.join(
        ", "
      )}<span>)</span>`;
    }

    case NameConstant: {
      const value = node.value;
      if (typeof value === "object" && "toString" in value)
        return value.toString();
      return `<span>${jsonStringify(value)}</span>`;
    }

    case NameVariable:
      return `<span>${node.name}</span>`;

    case NameList: {
      const elements = node.elements.map(prettyPrintHTML).join(", ");
      return `<span>[${elements}]</span>`;
    }

    case NameTuple: {
      const elements = node.elements.map(prettyPrintHTML).join(", ");
      return `<span>{${elements}}</span>`;
    }

    case NameObject: {
      const values = Object.entries(node.values).map(
        ([key, value]) => `<b>${key}</b>: ${prettyPrintHTML(value)}`
      );

      const isLargeObject = values.length > 3; // Adjust the threshold as needed
      if (isLargeObject) {
        const list = `<ul>${values.map((s) => `<li>${s}</li>`).join("")}</ul>`;
        // return `
        //   <details>
        //     <summary>Object { ... }</summary>
        //     ${list}
        //   </details>
        // `;
        return `<b>{</b>${list}<b>}</b>`;
      }
      return `<span>{${values.join(", ")}}</span>`;
    }

    case NameLambda:
      return `<span>${
        node.parameter
      }</span> <span>=></span> <span>(${prettyPrintHTML(node.body)})</span>`;

    case NameField: {
      const fieldName =
        "field" in node ? node.field : prettyPrintHTML(node.sub);
      return isInteger(fieldName)
        ? `${prettyPrintHTML(
            node.expr
          )}<span>[</span>${fieldName}<span>]</span>`
        : `${prettyPrintHTML(node.expr)}<span>.</span>${fieldName}`;
    }

    case NameError:
      return `<span>${node.value}</span>`;

    case "named":
      throw new Error(
        `node type "named" is temporary and shouldn't appear in final AST`
      );

    default: {
      const _unreachable: never = node;
      throw _unreachable;
    }
  }
}
