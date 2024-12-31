import { Graph } from "@okcontract/graph";

import type { ASTNode } from "./ast";
import { exprDependencies } from "./deps";
import type { Environment } from "./env";
import { type ParseOptions, parseExpression } from "./parse";
import { prettyPrint } from "./print";
import { plural } from "./utils";

// @todo update
export enum EvalOption {
  NoFail = "noFail", // modified from lowercase
  LocalEvaluation = "local",
  ErrorToFalse = "false",
  Sense = "sense",
  SkipNotFound = "skip",
  FailUndefined = "undefined"
}

type ProgramOptions = {
  parseOptions?: ParseOptions;
};

/**
 * Program defines a lambdascript program.
 * @usage await new Program().set([defs...])
 */
export class Program {
  private _graph: Graph<string>;
  _defs: { [key: string]: ASTNode };
  _options: ProgramOptions;

  /**
   *
   * @param defs AST for each expression, where keys **must** be lower case.
   */
  constructor(
    defs: { [key: string]: ASTNode } = {},
    options: ProgramOptions = {}
  ) {
    this._graph = new Graph();
    this._defs = defs;
    this._options = options;
    for (const key in defs) {
      this._addDef(key, defs[key]);
    }
  }

  private _resetProgram(defs: { [key: string]: ASTNode }) {
    this._graph = new Graph();
    this._defs = defs;
    for (const key in defs) {
      this._addDef(key, defs[key]);
    }
    return this;
  }

  /** add a definition to the program, updating the graph */
  private _addDef(key: string, expr: ASTNode) {
    const keyLow = key.toLowerCase();
    this._graph.addNode(keyLow);
    for (const to of exprDependencies(expr)) {
      const toLow = to.toLowerCase();
      this._graph.addNode(toLow);
      this._graph.addEdge(keyLow, toLow);
    }
  }

  // Set resets the Program with definitions from unparsed expressions (chainable).
  set = async (...l: string[]): Promise<Program> =>
    this._resetProgram(await this.parseProgram(l));

  get = (key: string): ASTNode | undefined => this._defs[key];

  /**
   * order_program returns the order of evaluation for a program.
   * @param p Program (list of definitions "name:expr")
   * @returns [order of evaluation for program definitions, set of required values in env]
   */
  get order(): [string[], string[]] {
    if (!this._defs) return [[], []];
    const keys = new Set(Object.keys(this._defs)); // or get from the graph
    const ts = this._graph.topologicalSort();
    if (ts === null) throw new Error("Program: Cyclic dependencies");
    // console.log("order_program", p, keys, "topsort:", ts, pairs);
    // console.log({ keys, ts });
    return [
      [
        ...Array.from(keys).filter((key) => !ts.includes(key)),
        ...ts.filter((key) => keys.has(key)) // @todo check .reverse()
      ],
      ts.filter((key) => !keys.has(key))
    ];
  }

  /**
   * dependencies computes the required dependencies for a sub-list of keys in a Program.
   * @param keys root keys
   * @returns list of values required for the evaluation of given keys
   * @todo move to Graph
   */
  dependencies = (keys: string[], env?: Environment) => {
    if (!this._defs) return [];
    const terminal: Set<string> = new Set();
    const visited: Set<string> = new Set();
    const aux = (key: string) => {
      if (visited.has(key)) return;
      // Add the key to visited
      visited.add(key);
      if (this._defs[key] !== undefined) {
        const l = exprDependencies(this._defs[key])
          .filter((key) => (env ? !env.has(key) : true))
          .map((_k) => _k.toLowerCase());
        l.forEach(aux);
        return;
      }
      // Else: Terminal keys
      terminal.add(key);
    };
    // Iterate through keys
    keys.forEach(aux);
    return Array.from(terminal);
  };

  /**
   * reduce computes an updated environment after evaluation of a program.
   * @param env environment
   * @param options list of evaluation options
   * @returns updated environment
   */
  reduce = async (env: Environment): Promise<Environment> => {
    const [order, set] = this.order;
    const unknown: string[] = [];
    for (const elt of set) if (!env.has(elt)) unknown.push(elt);

    // console.log("reduce", { env, order, set, unknown });
    if (unknown.length > 0)
      throw new Error(
        `Unknown ${plural("identifier", unknown, false)}: ${unknown.join(", ")}`
      );

    const copy = env.clone();
    for (let i = 0; i < order.length; i++)
      await copy
        .addExpression(order[i], this.get(order[i]) as ASTNode) // @todo (, con, ...options)
        .catch((error) => {
          console.log("caught:", {
            error,
            expr: order[i],
            val: this.get(order[i]),
            defs: this._defs,
            env: env.keys
          });
          throw error;
        });

    return copy;
  };

  /**
   * partialReduce attempts to evaluate the program while skipping expressions
   * with unknown dependencies.
   * It returns the updated environment, the list of expressions that couldn't
   * be evaluated, and the set of their unknown dependencies.
   * @param env environment
   * @returns [updated environment, remaining expressions to evaluate,
   * set of unknown dependencies]
   */
  partialReduce = async (
    env: Environment
  ): Promise<[Environment, string[], Set<string>]> => {
    const [order, set] = this.order;
    const remainingExpressions: string[] = [];
    const unresolvedDeps: Set<string> = new Set();

    const copy = env.clone();
    for (const expr of order) {
      const deps = exprDependencies(this.get(expr) as ASTNode).filter(
        (dep) => !env.has(dep)
      );

      if (deps.length === 0) {
        try {
          await copy.addExpression(expr, this.get(expr) as ASTNode);
          // console.log("partialReduce", expr);
        } catch (error) {
          console.log("Error during evaluation:", {
            error,
            expr,
            val: this.get(expr),
            defs: this._defs,
            env: env.keys
          });
          remainingExpressions.push(expr);
          for (const dep of deps) unresolvedDeps.add(dep);
        }
      } else {
        remainingExpressions.push(expr);
        for (const dep of deps) unresolvedDeps.add(dep);
      }
    }

    return [copy, remainingExpressions, unresolvedDeps];
  };

  /**
   * parseProgram parses a program (without ordering).
   * @param l list of definitions in the form "name:expr"
   * @returns Program (may throw error)
   */
  parseProgram = async (l: string[]): Promise<{ [key: string]: ASTNode }> =>
    Object.fromEntries(
      await Promise.all(
        l.map(async (def) => {
          const pos = def.indexOf(":");
          const ast = await parseExpression(
            def.substring(pos + 1),
            this._options.parseOptions
          ).catch((err) => {
            throw err;
          });
          return [def.substring(0, pos), ast];
        })
      )
    );

  get expressions() {
    return this.order[0].map((key) => prettyPrint(this._defs[key]));
  }
}
