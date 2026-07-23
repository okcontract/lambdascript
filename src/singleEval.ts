import { type AnyCell, Cell } from "@okcontract/cells";

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
import type { Environment } from "./env";
import type { Value } from "./eval";
import { traverseAST } from "./traverse";

// Helper: collect free variables (not bound by lambdas), using traverseAST
const collectFreeVariables = (node: ASTNode): Set<string> => {
  const free = new Set<string>();
  traverseAST(node, (n, bound) => {
    if (n.type === NameVariable) {
      const nameLow = n.name.toLowerCase();
      if (!bound.has(nameLow)) free.add(nameLow);
    }
  });
  return free;
};

// Helper: detect parse errors anywhere in the AST, return message if found
const findParseError = (node: ASTNode): string | undefined => {
  let msg: string | undefined;
  traverseAST(node, (n) => {
    if (msg !== undefined) return;
    if (n.type === NameError)
      msg = String((n as unknown as { value?: unknown }).value ?? "");
  });
  return msg;
};

// Simple check for AnyCell instance
const isCell = (v: unknown): v is AnyCell<unknown> => v instanceof Cell;

/**
 * Evaluate an AST as a single cell by mapping once over all used
 * environment values and library functions, then computing the value
 * inside the mapping closure.
 */
export const evaluateASTSingle =
  (env: Environment) =>
  (node: ASTNode): Value<unknown> => {
    // Early parse error propagation (match legacy behavior)
    const err = findParseError(node);
    if (err !== undefined) throw new Error(`parse error: ${err}`);
    // Collect free (unbound) variable names used in the expression
    const free = collectFreeVariables(node);

    // Partition between user-defined environment values and library items
    const envNames: string[] = [];
    const envCells: AnyCell<unknown>[] = [];
    const libNames: string[] = [];
    const libCells: AnyCell<unknown>[] = [];

    for (const nameLow of free) {
      const v = env.value(nameLow);
      if (v !== undefined) {
        envNames.push(nameLow);
        envCells.push(v);
        continue;
      }
      const lib = env.library(nameLow);
      if (lib?.f) {
        libNames.push(nameLow);
        libCells.push(lib.f);
        continue;
      }
      // Unknown identifier at evaluation time
      // Use original casing if available
      throw new Error(`Undefined variable: ${nameLow}`);
    }

    // If there are no dependencies at all (constants-only), evaluate once
    // and wrap into a constant cell.
    if (envCells.length === 0 && libCells.length === 0) {
      const value = interpret(node, env, {});
      return env.proxy.new(value, "single-eval:const");
    }

    const allNames = [...envNames, ...libNames];
    const allCells = [...envCells, ...libCells];

    const mapFn = env.proxy.map.bind(env.proxy) as <T>(
      cells: AnyCell<unknown>[],
      fn: (...values: unknown[]) => T,
      id?: string
    ) => AnyCell<T>;
    return mapFn(
      allCells,
      // values are unwrapped underlying values (env values and functions)
      (...values: unknown[]) => {
        const scope: Record<string, unknown> = {};
        for (let i = 0; i < allNames.length; i++)
          scope[allNames[i]] = values[i];
        return interpret(node, env, scope);
      },
      "single-eval"
    );
  };

// Interpret AST inside a single mapping closure.
// `scope` maps lower-cased identifiers to unwrapped values/functions.
const interpret = (
  node: ASTNode,
  env: Environment,
  scope: Record<string, unknown>
): unknown => {
  switch (node.type) {
    case NameConstant:
      return node.value;

    case NameVariable: {
      const nameLow = node.name.toLowerCase();
      if (Object.hasOwn(scope, nameLow)) return scope[nameLow];
      // Should not happen due to pre-check, unless variable is lambda-bound
      const v = env.read(nameLow);
      if (v === undefined) throw new Error(`Undefined variable: ${node.name}`);
      return v;
    }

    case NameApplication: {
      const func = interpret(node.function, env, scope);
      const args = node.params.map((p) => interpret(p, env, scope));

      if (typeof func !== "function")
        throw new Error(`Not a function: ${node.function.type}`);

      // Local (lambda) functions use raw values and don't expect env
      // Library / external functions expect (env, ...AnyCell[]) args
      const isLocal = (func as unknown as { local?: boolean })?.local === true;
      if (isLocal) {
        return (func as (...xs: unknown[]) => unknown)(...args);
      }
      // Wrap arguments as cells when necessary
      const asCell = (v: unknown): AnyCell<unknown> => {
        if (isCell(v)) return v;
        // Arrays and objects are wrapped as a single value cell
        if (Array.isArray(v)) return env.proxy.new(v, "[]");
        if (v !== null && typeof v === "object") return env.proxy.new(v, "{}");
        return env.proxy.new(v as unknown);
      };
      const cellArgs = args.map(asCell);
      return (func as (env: Environment, ...xs: AnyCell<unknown>[]) => unknown)(
        env,
        ...cellArgs
      );
    }

    case NameList: {
      const items = node.elements.map((e) => {
        const v = interpret(e, env, scope);
        return isCell(v) ? (v as AnyCell<unknown>) : env.proxy.new(v);
      });
      return env.proxy.new(items, "[]");
    }

    case NameTuple: {
      const items = node.elements.map((e) => {
        const v = interpret(e, env, scope);
        return isCell(v) ? (v as AnyCell<unknown>) : env.proxy.new(v);
      });
      return env.proxy.new(items, "{}");
    }

    case NameObject: {
      const entries = Object.entries(node.values);
      const values = entries.map(([, v]) => interpret(v, env, scope));
      const cells = values.map((v) =>
        isCell(v) ? (v as AnyCell<unknown>) : env.proxy.new(v)
      );
      return env.proxy.mapNoPrevious(
        cells,
        (...l) => Object.fromEntries(l.map((v, i) => [entries[i][0], v])),
        "{}"
      );
    }

    case NameField: {
      const base = interpret(node.expr, env, scope) as
        | AnyCell<Record<string, unknown> | unknown[]>
        | Record<string, unknown>
        | unknown[];
      if (isCell(base)) {
        if ("field" in node)
          return (base as AnyCell<Record<string, unknown>>).map(
            (obj) => obj[node.field]
          );
        const sub = interpret(node.sub, env, scope) as string | number | symbol;
        return (base as AnyCell<Record<string, unknown> | unknown[]>).map(
          (obj: Record<string, unknown> | unknown[]) =>
            Array.isArray(obj)
              ? (obj as unknown[])[sub as number]
              : (obj as Record<string, unknown>)[
                  sub as keyof Record<string, unknown>
                ]
        );
      }
      // non-cell object
      if ("field" in node) return (base as Record<string, unknown>)[node.field];
      const sub = interpret(node.sub, env, scope) as string | number | symbol;
      return Array.isArray(base)
        ? (base as unknown[])[sub as number]
        : (base as Record<string, unknown>)[
            sub as keyof Record<string, unknown>
          ];
    }

    case NameLambda: {
      const param = node.parameter.toLowerCase();
      const body = node.body;
      type LocalFn = ((arg: unknown) => unknown) & { local?: boolean };
      const lambda: LocalFn = (arg: unknown) => {
        const childScope = { ...scope, [param]: arg };
        return interpret(body, env, childScope);
      };
      lambda.local = true;
      return lambda;
    }

    case NameError:
      throw new Error(`parse error: ${node.value}`);

    default: {
      if ((node as unknown as { type: string }).type === "named")
        return interpret(
          (node as unknown as { value: ASTNode }).value,
          env,
          scope
        );
      const _unreachable: never = node as never;
      return _unreachable;
    }
  }
};
