import {
  type AnyCell,
  Cell,
  type SheetProxy,
  ValueCell
} from "@okcontract/cells";

import type { ASTNode } from "./ast";
import { type Value, evaluateAST } from "./eval";
import type { ParserExtension } from "./highLevel";
import { inferType } from "./infer";
import { mergeWithFirstPriority } from "./merge";
import { ObjectMapKey } from "./objectMap";
import { type ParseOptions, parseExpression } from "./parse";
import {
  type LibraryElement,
  type StandardLibrary,
  defaultLibrary,
  typeBoolean
} from "./stdlib";
import type { TypeScheme } from "./typeScheme";

export let envCounter = 0;

export type ValueMap = {
  [key: string]: Value<unknown>;
};

export type ValueDefinition = [string, Value<unknown>, TypeScheme];

/**
 * Options for the Environment constructor.
 */
export type EnvironmentOptions = {
  id?: string;
  lib?: StandardLibrary;
  values?: ValueMap;
  types?: { [key: string]: TypeScheme };
  cases?: { [key: string]: string };
  parseOptions?: ParseOptions;
  extensions?: ParserExtension<unknown, string>[];
  noInstance?: boolean;
};

export const valuesCase = (initialValues: ValueMap) =>
  ObjectMapKey((key, _) => [key.toLowerCase(), key], initialValues);

export class Environment {
  /** static library: resolved first, containing both value and type information */
  private _lib: { [key: string]: LibraryElement };
  /**
   * values defined in the host language (JavaScript)
   * @todo merge values and types as { [key: string]: LibraryElement } ?
   *       However, `inferType` for `NameLambda` uses an Environment updated
   *       with the type of the bound variable in the lambda.
   **/
  _values: ValueMap;
  /** type expressions (for values) */
  private _types: { [key: string]: TypeScheme };
  /** original cases for values and types */
  private _originalCases: { [key: string]: string };

  readonly proxy: SheetProxy;

  initialValues = {} as const;

  initialTypes: { [key: string]: TypeScheme } = {
    true: { vars: [], type: typeBoolean },
    false: { vars: [], type: typeBoolean }
  };

  options: EnvironmentOptions;

  constructor(proxy: SheetProxy, options: EnvironmentOptions = {}) {
    envCounter = envCounter + 1;
    // console.log("new env", { id, envCounter });
    this._lib = options?.lib || defaultLibrary(proxy); // no copy, should be static values anyway
    // Always lowercase for both values and types
    this._values = ObjectMapKey(
      (key, v) => [key.toLowerCase(), v],
      options?.values || this.initialValues
    ) as ValueMap;
    this._types = ObjectMapKey(
      (key, ty) => [key.toLowerCase(), ty],
      options?.types || this.initialTypes
    );
    // We only map the case on values and expect types to be defined with
    // same name.
    this._originalCases =
      options?.cases || valuesCase(options?.values || this.initialValues);
    this.proxy = proxy;
    this.options = options;
  }

  _updateLib(lib: StandardLibrary) {
    this._lib = lib;
  }

  // getters
  library = (name: string): LibraryElement | undefined =>
    this._lib[name.toLowerCase()];
  value = (name: string): Value<unknown> | undefined =>
    this._values[name.toLowerCase()];
  type = (name: string): TypeScheme | undefined =>
    this._types[name.toLowerCase()];
  /** original case: for display, completions, etc. */
  case = (name: string): string | undefined =>
    this._originalCases[name.toLowerCase()];

  infer = inferType(this);
  eval = evaluateAST(this);

  clone = () =>
    new Environment(this.proxy, {
      ...this.options,
      lib: this._lib,
      values: { ...this._values },
      types: { ...this._types },
      cases: { ...this._originalCases },
      extensions: this.options.extensions
    });

  /**
   * keys returns the list of defined keywords in the
   * environment
   * @returns
   */
  keys = (includeLib = true) => [
    ...Object.keys(this._originalCases),
    ...(includeLib ? Object.keys(this._lib) : [])
    // ...reservedKeywords
  ];

  withValue(name: string, value: AnyCell<unknown>) {
    const nameLow = name.toLowerCase();
    return new Environment(this.proxy, {
      lib: this._lib,
      values: { ...this._values, [nameLow]: value },
      types: this._types,
      cases: { ...this._originalCases, [nameLow]: name },
      extensions: this.options.extensions
    });
  }

  withType(name: string, ts: TypeScheme) {
    const nameLow = name.toLowerCase();
    return new Environment(this.proxy, {
      lib: this._lib,
      values: this._values,
      types: { ...this._types, [nameLow]: ts },
      // We **don't** update cases for types.
      cases: this._originalCases,
      extensions: this.options.extensions
    });
  }

  /**
   * addExpression type checks and add an expression to the environment (in place).
   * @param name
   * @param expr
   * @returns true if a previous definition was overwritten.
   */
  addExpression = async (name: string, expr: ASTNode): Promise<boolean> => {
    if (!name) throw new Error("Value must be named");
    // console.log("addExpression", { name, expr });
    const type = await this.infer(expr);
    const value = this.eval(expr);
    value.bless(`eval:${name}`);
    const nameLow = name.toLowerCase();
    // Value already exists, it must have same type.
    // @todo check type
    if (this._types[nameLow]) {
      const valueCell = this.value(nameLow);
      // @todo propagate cells changes minimally (including in nested arrays/objects)
      if (valueCell instanceof ValueCell) {
        value.subscribe(
          (
            _value:
              | ((args: Value<unknown>) => Value<unknown>)
              | AnyCell<
                  (args: Value<unknown>) => Value<unknown>,
                  boolean,
                  boolean
                >
              | Promise<(args: Value<unknown>) => Value<unknown>>
              | Promise<
                  AnyCell<
                    (args: Value<unknown>) => Value<unknown>,
                    boolean,
                    boolean
                  >
                >
          ) => {
            // console.log("Setting", {
            //   value: value.id,
            //   valueCell: value.id,
            //   _value
            // });
            valueCell.set(_value);
            // return _value;
          }
        );
        return true;
      }
      return true;
    }
    return this.addValueType(name, value, type);
  };

  addValueType = (name: string, value: Value<unknown>, type: TypeScheme) => {
    const nameLow = name.toLowerCase();
    this._types[nameLow] = type;
    const overWrite = this._values[nameLow] !== undefined;
    this._values[nameLow] = value;
    // Only if the original case was not defined, we update it.
    if (!this._originalCases[nameLow]) this._originalCases[nameLow] = name;
    return overWrite;
  };

  /**
   * evaluateString evaluates an expression as string.
   * @param expr
   * @returns value
   * @throws exception in case of parse error, type error or eval error.
   */
  evaluateString = async (
    expr: string,
    options: { typeCheck?: boolean } = {}
  ): Promise<Value<unknown>> => {
    const ast = await parseExpression(expr, this.options.parseOptions);
    if (options?.typeCheck) await this.infer(ast); // type checking
    return this.eval(ast);
  };

  evaluateStringValue = async (expr: string): Promise<unknown> => {
    const val = await this.evaluateString(expr);
    // console.log({ evaluateStringValue: val });
    if (val instanceof Cell) {
      return val.get();
    }
    throw new Error(`cannot get value for ${val}, it's not a cell`);
  };
  /**
   * evaluate_string_array evaluates multiple expressions
   * @param arr array of expressions as string
   */
  evaluateStringArray = async (arr: string[]): Promise<Value<unknown>[]> =>
    Promise.all(arr.map((s) => this.evaluateString(s)));

  /**
   * evaluate_string_array evaluates multiple expressions
   * @param arr array of expressions as string
   */
  evaluateStringArrayToValues = async (arr: string[]): Promise<unknown[]> => {
    return await Promise.all(arr.map((s) => this.evaluateStringValue(s)));
  };

  /**
   * has checks if a given name (env value, built-in function or smart-contract method)
   * is defined in the Context.
   * @param name
   * @returns true if found
   * @todo return the type of entity found
   * @todo precise the order of evaluation in the semantics (library then values)
   * @todo use addr? or rather should contracts be added to the env
   */
  has = (name: string) => {
    const keyLow = name.toLowerCase();
    return (
      this.library(keyLow) !== undefined || this.value(keyLow) !== undefined
    );
  };

  public const<T>(value: T): Value<T> {
    return this.proxy.new(value, `c:${value}`);
  }

  public read(varName: string): Value<unknown> | undefined {
    const keyLow = varName.toLowerCase();
    const libVal = this.library(keyLow);
    return libVal?.f || this.value(keyLow);
  }

  public mergeWith(
    lib: StandardLibrary | undefined,
    ...envs: Environment[]
  ): Environment {
    return new Environment(this.proxy, {
      lib: lib || this._lib,
      values: mergeWithFirstPriority([
        this._values,
        ...envs.map((_env) => _env._values)
      ]),
      types: mergeWithFirstPriority([
        this._types,
        ...envs.map((_env) => _env._types)
      ]),
      cases: mergeWithFirstPriority([
        this._originalCases,
        ...envs.map((_env) => _env._originalCases)
      ]),
      extensions: this.options.extensions
    });
  }

  /**
   * withValueTypes creates a new Environment with added
   * definitions, overwriting previous definitions when applicable.
   */
  public withValueTypes(...defs: ValueDefinition[]) {
    const newValues = Object.fromEntries(
      defs.map(([k, v, _t]) => [k.toLowerCase(), v])
    );
    const newTypes = Object.fromEntries(
      defs.map(([k, _v, t]) => [k.toLowerCase(), t])
    );
    const newCases = Object.fromEntries(
      defs.map(([k, _v, _t]) => [k.toLowerCase(), k])
    );
    return new Environment(this.proxy, {
      lib: this._lib,
      values: { ...this._values, ...newValues },
      types: { ...this._types, ...newTypes },
      cases: { ...this._originalCases, ...newCases },
      extensions: this.options.extensions
    });
  }

  public valueTypes() {
    return Object.entries(this._originalCases).map(
      ([k, orig]) => [orig, this._values[k], this._types[k]] as ValueDefinition
    );
  }

  public mergeValues(...envs: Environment[]) {
    this._values = mergeWithFirstPriority([
      this._values,
      ...envs.map((_env) => _env._values)
    ]);
    this._types = mergeWithFirstPriority([
      this._types,
      ...envs.map((_env) => _env._types)
    ]);
    this._originalCases = mergeWithFirstPriority([
      this._originalCases,
      ...envs.map((_env) => _env._originalCases)
    ]);
  }
}
