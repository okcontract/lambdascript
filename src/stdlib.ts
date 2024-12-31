import {
  type AnyCell,
  type CellArray,
  type MapCell,
  type SheetProxy,
  filterPredicateCell,
  last,
  mapArrayCell
} from "@okcontract/cells";

import { NameLambda, NameList } from "./ast";
import type { Environment } from "./env";
import { isEqual } from "./equal";
import type { Value } from "./eval";
import { findCell } from "./find";
import { Rational } from "./rational";
import type { TypeScheme } from "./typeScheme";
import {
  type MonoType,
  type TypeConst,
  newTypeConst,
  newTypeObject,
  newTypeVar,
  typeAny,
  typeFunction,
  typeList
} from "./types";

// Number type, implemented as Rational.
export const typeNumber = newTypeConst("number");
// String type
export const typeString = newTypeConst("string");
// Boolean type
export const typeBoolean = newTypeConst("boolean");
// Bytes type
export const typeBytes = newTypeConst("bytes");

const stringToHex = (str) =>
  [...str]
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");

/**
 * LibraryItem defines an element of the standard library.
 */
export interface LibraryElement {
  doc?: string;
  f: Value<unknown>;
  t: TypeScheme;
}

const builtinIF = (libproxy: SheetProxy): LibraryElement => {
  const alpha = newTypeVar("if");
  return {
    f: libproxy.new(
      (
        env: Environment,
        condition: AnyCell<boolean>,
        thenValue: AnyCell<unknown>,
        elseValue: AnyCell<unknown>
      ) =>
        env.proxy.map(
          [condition, thenValue, elseValue],
          (condition, thenValue, elseValue) =>
            condition ? thenValue : elseValue,
          "if"
        ),
      "$if"
    ),
    doc: "If statement",
    t: {
      vars: [alpha.type],
      type: {
        kind: NameLambda,
        argTypes: [typeBoolean, alpha, alpha],
        returnType: alpha
      }
    }
  };
};

const builtinFILTER = (libproxy: SheetProxy): LibraryElement => {
  const alpha = newTypeVar("filter");
  return {
    f: libproxy.new(
      <T>(
        env: Environment,
        pred: AnyCell<(elt: AnyCell<T>) => AnyCell<boolean>>,
        arr: CellArray<T>
      ) => filterPredicateCell(env.proxy, pred, arr, "filter"),
      "$filter"
    ),
    doc: "Returns a filter for an array",
    t: {
      vars: [alpha.type],
      type: {
        kind: NameLambda,
        argTypes: [
          {
            kind: NameLambda,
            argTypes: [alpha],
            returnType: typeBoolean,
            label: "filter function"
          },
          { kind: NameList, elementType: alpha, label: "value list" }
        ],
        returnType: {
          kind: NameList,
          elementType: alpha,
          label: "filtered items"
        }
      }
    }
  };
};

const builtinMAP = (libproxy: SheetProxy): LibraryElement => {
  const alpha = newTypeVar("map");
  const beta = newTypeVar("map");
  return {
    f: libproxy.new(
      <T, U>(
        env: Environment,
        fn: AnyCell<(v: AnyCell<T>) => AnyCell<U>>,
        arr: CellArray<T>
      ) => mapArrayCell(env.proxy, arr, fn, "map") as AnyCell<U[]>,
      "$map"
    ),
    doc: "Returns a mapped array",
    t: {
      vars: [alpha.type, beta.type],
      type: {
        kind: NameLambda,
        argTypes: [
          {
            kind: NameLambda,
            argTypes: [alpha],
            returnType: beta,
            label: "map function"
          },
          { kind: NameList, elementType: alpha, label: "value list" }
        ],
        returnType: {
          kind: NameList,
          elementType: beta,
          label: "mapped items"
        }
      }
    }
  };
};

const builtinFIND = (
  libproxy: SheetProxy,
  findFunction = Array.prototype.find,
  name = "$find"
): LibraryElement => {
  const alpha = newTypeVar("map");
  return {
    f: libproxy.new(
      <T>(
        env: Environment,
        fn: AnyCell<(v: AnyCell<T>) => AnyCell<boolean>>,
        arr: CellArray<T>
      ): AnyCell<T | undefined> =>
        findCell(env.proxy, arr, fn, findFunction, `$${name}`),
      name
    ),
    doc: "Returns a mapped array",
    t: {
      vars: [alpha.type],
      type: {
        kind: NameLambda,
        argTypes: [
          {
            kind: NameLambda,
            argTypes: [alpha],
            returnType: typeBoolean,
            label: "find function, returns true if an element matches"
          },
          { kind: NameList, elementType: alpha, label: "value list" }
        ],
        returnType: alpha
      }
    }
  };
};

// @todo move to cells
export const isClassInstance = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  value.constructor.prototype !== Object.prototype;

const builtinLENGTH = (libproxy: SheetProxy): LibraryElement => {
  const alpha = newTypeVar("len");
  return {
    f: libproxy.new(
      (env: Environment, cell: AnyCell<unknown>) =>
        env.proxy.map(
          [cell],
          (v) =>
            new Rational(
              Array.isArray(v)
                ? v.length
                : isClassInstance(v)
                  ? 1
                  : typeof v === "object"
                    ? Object.keys(v).length
                    : v !== null && v !== undefined
                      ? 1
                      : 0
            ),
          "length"
        ),
      "$length"
    ),
    t: {
      vars: [alpha.type],
      type: typeFunction([alpha], typeBoolean)
    }
  };
};

/**
 * builtinOperator generates a new operator.
 */
const builtinOperator = (
  libproxy: SheetProxy,
  op: string,
  doc?: string
): LibraryElement => {
  return {
    doc,
    f: libproxy.new(
      (
        env: Environment,
        a: AnyCell<Rational>,
        b: AnyCell<Rational>
      ): AnyCell<Rational> => {
        return env.proxy.map(
          [a, b],
          (a, b) => {
            switch (op) {
              case "+":
                return a.add(b);
              case "-":
                return a.subtract(b);
              case "*":
                return a.multiply(b);
              case "/":
                return a.divide(b);
              case "^":
                return a.power(b);
            }
            throw new Error("unknown operator");
          },
          op
        );
      },
      `(${op})`
    ),
    t: {
      vars: [],
      type: typeFunction([typeNumber, typeNumber], typeNumber)
    }
  };
};

const builtinComparator = (
  libproxy: SheetProxy,
  op: string,
  doc?: string
): LibraryElement => {
  const alpha = newTypeVar("op");
  return {
    doc,
    f: libproxy.new(
      (
        env: Environment,
        a: AnyCell<unknown>,
        b: AnyCell<unknown>
      ): MapCell<boolean, false> =>
        env.proxy.map(
          [a, b],
          (a, b) => {
            if (a instanceof Rational && b instanceof Rational)
              return a.compare(op, b);
            switch (op) {
              case "<":
                return a < b;
              case "<=":
                return a <= b;
              case ">":
                return a > b;
              case ">=":
                return a >= b;
              case "==":
                return a === b;
              case "!=":
                return a !== b;
            }
            throw new Error("unknown comparator");
          },
          op
        ),
      `(${op})`
    ),
    t: {
      vars: [alpha.type],
      type: typeFunction([alpha, alpha], typeBoolean)
    }
  };
};

const builtinEQUAL = (libproxy: SheetProxy, not: boolean): LibraryElement => {
  const alpha = newTypeVar("eq");
  return {
    doc: `returns ${not ? "false" : "true"} if both arguments are equal`,
    f: libproxy.new(
      <T>(
        env: Environment,
        a: AnyCell<T>,
        b: AnyCell<T>
      ): MapCell<boolean, false> =>
        env.proxy.map(
          [a, b],
          not ? (a, b) => !isEqual(a, b) : isEqual,
          not ? "!=" : "=="
        ),
      not ? "(!=)" : "(==)"
    ),
    t: {
      vars: [alpha.type],
      type: typeFunction([alpha, alpha], typeBoolean)
    }
  };
};

/**
 * return the first element of an array, recursively.
 * @param v
 * @returns first element or input value if not an array
 */
export const first_element = <T>(v: T | T[]): T =>
  Array.isArray(v) ? first_element(v[0]) : v;

export type StandardLibrary = {
  [key: string]: LibraryElement;
};

/**
 * defaultLibrary is the core standard library.
 * @namespace all names should be lower case
 */
export const defaultLibrary = (
  libproxy: SheetProxy
  // local: LocalSubscriber<CacheQuery>
): StandardLibrary => ({
  // constants
  $pi: {
    f: libproxy.new(new Rational(Math.PI), "π"),
    t: { vars: [], type: typeNumber },
    doc: "π constant"
  },

  // operators
  "+": builtinOperator(libproxy, "+"),
  "-": builtinOperator(libproxy, "-"),
  "*": builtinOperator(libproxy, "*"),
  "/": builtinOperator(libproxy, "/"),
  "^": builtinOperator(libproxy, "^"),
  // comparators
  "<": builtinComparator(libproxy, "<"),
  "<=": builtinComparator(libproxy, "<="),
  ">": builtinComparator(libproxy, ">"),
  ">=": builtinComparator(libproxy, ">="),
  "==": builtinEQUAL(libproxy, false), // builtinComparator("=="),
  "!=": builtinEQUAL(libproxy, true), // builtinComparator("!="),
  // logic
  if: builtinIF(libproxy),
  "&&": {
    f: libproxy.new(
      (
        env: Environment,
        a: AnyCell<boolean>,
        b: AnyCell<boolean>
      ): MapCell<boolean, true> =>
        env.proxy.map([a, b], (a, b) => a && b, "&&"),
      "(&&)"
    ),
    t: {
      vars: [],
      type: typeFunction([typeBoolean, typeBoolean], typeBoolean)
    }
  },
  "||": {
    f: libproxy.new(
      (
        env: Environment,
        a: AnyCell<boolean>,
        b: AnyCell<boolean>
      ): AnyCell<boolean> => env.proxy.map([a, b], (a, b) => a || b, "||"),
      "(||)"
    ),
    t: {
      vars: [],
      type: typeFunction([typeBoolean, typeBoolean], typeBoolean)
    }
  },
  "!": {
    f: libproxy.new(
      (env: Environment, a: AnyCell<boolean>): MapCell<boolean, true> =>
        env.proxy.map([a], (a) => !a, "!"),
      "(!)"
    ),
    t: {
      vars: [],
      type: typeFunction([typeBoolean], typeBoolean)
    }
  },
  // basic maths
  $min: {
    f: libproxy.new(
      (env: Environment, ...vCells: AnyCell<Rational>[]) =>
        env.proxy.mapNoPrevious(
          vCells,
          (...v) => v[0].min(...v.slice(1)),
          "min"
        ),
      "$min"
    ),
    t: {
      vars: [],
      type: typeFunction([typeNumber], typeNumber, typeNumber)
    }
  },
  $max: {
    f: libproxy.new(
      (env: Environment, ...vCells: AnyCell<Rational>[]) =>
        env.proxy.mapNoPrevious(
          vCells,
          (...v: Rational[]) => v[0].max(...v.slice(1)),
          "max"
        ),
      "$max"
    ),
    t: {
      vars: [],
      type: typeFunction([typeNumber], typeNumber, typeNumber)
    }
  },
  $last: {
    f: libproxy.new(
      (env: Environment, arr: CellArray<unknown>) => last(env.proxy, arr),
      "$last"
    ),
    doc: "return the last element of an array, recursively",
    t: {
      vars: ["elt"],
      // @todo fix types (introduce sum types)
      type: typeFunction([typeList(typeAny)], typeAny)
    }
  },
  $first: {
    f: libproxy.new(
      (env: Environment, ...vCells: AnyCell<Rational>[]) =>
        env.proxy.mapNoPrevious(
          vCells,
          (...v: unknown[]) => first_element(v),
          "first"
        ),
      "$first"
    ),
    doc: "Returns the first element in an array, recursively",
    t: {
      vars: ["elt"],
      // @todo fix types (introduce sum types)
      type: typeFunction([typeList(typeAny)], typeAny)
    }
  },
  $concat: {
    f: libproxy.new((env: Environment, ...vCells: AnyCell<unknown>[]) =>
      env.proxy.mapNoPrevious(vCells, (...v: unknown[]) =>
        v.reduce((acc, _v) => `${acc}${_v.toString()}`, "")
      )
    ),
    doc: "Concatenates string representations of any value",
    t: {
      vars: [],
      type: typeFunction([], typeString, typeAny)
    }
  },
  // lists
  $filter: builtinFILTER(libproxy),
  $map: builtinMAP(libproxy),
  $find: builtinFIND(libproxy),
  $findi: builtinFIND(libproxy, Array.prototype.findIndex, "$findi"),
  $length: builtinLENGTH(libproxy),
  $floor: {
    f: libproxy.new((env: Environment, rational: AnyCell<Rational>) => {
      return env.proxy.map([rational], (rational) => rational.floor(), "floor");
    }, "$floor"),
    doc: "Returns the floor of a rational number.",
    t: {
      vars: [],
      type: {
        kind: NameLambda,
        argTypes: [typeNumber],
        returnType: typeNumber
      }
    }
  },
  // @todo @security check
  $json: {
    f: libproxy.new((env: Environment, v: AnyCell<unknown>) => {
      return env.proxy.map([v], (v) => JSON.stringify(v), "json");
    }, "$json"),
    doc: "Returns the JSON representation of any value",
    t: {
      vars: [],
      type: {
        kind: NameLambda,
        argTypes: [typeAny],
        returnType: typeString
      }
    }
  },
  $hex: {
    f: libproxy.new((env: Environment, v: AnyCell<string>) => {
      return env.proxy.map([v], (v) => `0x${stringToHex(v)}`, "hex");
    }, "$hex"),
    doc: "Returns the hex representation of a string (prefixed with 0x)",
    t: {
      vars: [],
      type: {
        kind: NameLambda,
        argTypes: [typeString],
        returnType: typeString
      }
    }
  }
});

export type FirstClassValue = {
  name: string;
  is: (v: unknown) => boolean;
  type: TypeConst;
};

export const rationalNumber: FirstClassValue = {
  name: "Rational",
  is: (expr: unknown) => expr instanceof Rational,
  type: typeNumber
};

/**
 * typeFromJSValue creates a λs type from a JS literal.
 * @param expression
 * @returns
 */
export const typeFromJSValue = (
  expression: unknown,
  fcv: FirstClassValue[] = [rationalNumber]
): MonoType => {
  // Extensible first class values
  for (const def of fcv) if (def.is(expression)) return def.type;

  const typeOfExpression = typeof expression;
  switch (typeOfExpression) {
    case "number":
    case "bigint":
      return typeNumber;
    case "string":
    case "boolean":
      return newTypeConst(typeOfExpression);
    case "object":
      if (Array.isArray(expression))
        // Assuming all elements of the array are of the same type
        return typeList(typeFromJSValue(expression[0]));
      if (expression === null) return newTypeConst("null");
      return newTypeObject(
        Object.fromEntries(
          Object.entries(expression).map(([k, v]) => [k, typeFromJSValue(v)])
        )
      );
    default:
      throw new Error("Unsupported expression type");
  }
};
