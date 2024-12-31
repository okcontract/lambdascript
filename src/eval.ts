import type { AnyCell } from "@okcontract/cells";

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

// @todo V | PrimValue[] ?
export type PrimValue<V> =
  | V
  | Value<V>[]
  | { [key: number | string]: Value<unknown> }; // @todo
export type Value<V> =
  | AnyCell<PrimValue<V>>
  | AnyCell<(args: Value<unknown>) => Value<unknown>>;

/**
 *
 * evaluateAST transform the AST into a series of cell mappings.
 * Each cell is associated to a node and holds a local reduction of the node expression,
 * that depends on the subnodes of the AST.
 *
 * The cells belongs to the environment Proxy sheet.
 * @param env An environment
 * @returns the root Cell of the AST that holds the result of the reduction of the whole expression in the given environment.
 */
export const evaluateAST =
  (env: Environment) =>
  (node: ASTNode): Value<unknown> => {
    // console.log({ values: env.values, types: env.types, node });
    switch (node.type) {
      case NameConstant:
        return env.const(node.value);

      case NameVariable: {
        const v = env.read(node.name);
        if (!v)
          // @todo agrep to suggest similar names?
          throw new Error(
            `Undefined variable: ${node.name} in ${JSON.stringify(
              env.keys(false)
            )}`
          );
        return v;
      }

      case NameApplication: {
        const func = evaluateAST(env)(node.function);
        // @todo lazy evaluation for unused arguments?
        const args = node.params.map((param) => evaluateAST(env)(param));
        return func.map((_func: unknown) => {
          // each update of the function  will create a new Cell
          // this cell cannot be returned by the evaluator as it is created inside a mapCell, so, we create a result Cell,
          // which is a value Cell "subscribed" to the resulting
          //
          // should not happen after type checking?
          if (!(typeof _func === "function"))
            throw new Error(`Not a function: ${node.function.type}`);
          return (_func as unknown & { local?: boolean })?.local
            ? _func(...args)
            : _func(env, ...args);
        }, "(app)"); //as AnyCell<PrimValue>;
      }

      case NameList: {
        const evaluations = node.elements.map(evaluateAST(env));
        // console.log({ length: evaluations.length });
        return env.proxy.new(evaluations, "[]");
      }

      case NameTuple: {
        const evaluations = node.elements.map(evaluateAST(env));
        // console.log("NameTuple", { length: evaluations.length });
        return env.proxy.new(evaluations, "{}");
      }

      case NameObject: {
        // split object into [keys[],values[]]
        const entries = Object.entries(node.values);
        const keys = entries.map(([k, _v]) => k);
        const values = entries.map(([_k, v]) => v).map(evaluateAST(env));
        const objCell = env.proxy.mapNoPrevious(
          values,
          (...l) => Object.fromEntries(l.map((v, i) => [keys[i], v])),
          "{}"
        );
        return objCell;
      }

      case NameField: {
        const objectCell = evaluateAST(env)(node.expr) as AnyCell<{
          [key: string]: Value<unknown>;
        }>;
        if (NameField in node) {
          const fieldName = node.field;
          return objectCell.map((obj: { [key: string]: Value<unknown> }) => {
            return obj[fieldName];
          });
        }
        const fieldNameCell = evaluateAST(env)(node.sub);
        return env.proxy.map(
          [objectCell, fieldNameCell],
          (obj, fieldName) => {
            // console.log({ objectCell, fieldNameCell, obj, fieldName });
            //@ts-expect-error lambdascript typing ensured the field exists
            return obj[fieldName] || null;
          },
          ":"
        );
      }

      case NameLambda: {
        const lambda = (arg: Value<unknown>) => {
          // console.log({ lambda: arg });
          const newEnv = env.withValue(node.parameter, arg);
          return evaluateAST(newEnv)(node.body);
        };
        // anonymous function lack the extra environment as first parameter
        lambda.local = true;
        return env.proxy.new(lambda, "eval.λ");
      }

      case NameError:
        throw new Error(`parse error: ${node.value}`);

      case "named":
        // console.log({ named_node: node });
        throw new Error(
          `"named" node type is temporary and should not appears at evaluation`
        );

      default: {
        const _unreachable: never = node;
        return _unreachable;
      }
    }
  };
