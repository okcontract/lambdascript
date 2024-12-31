import { type ASTNode, NameVariable } from "./ast";
import { traverseAST } from "./traverse";

/**
 * exprDependencies computes the free variables in a given expression.
 * @param expr
 * @returns
 */
export const exprDependencies = (expr: ASTNode): string[] => {
  const out: Set<string> = new Set();
  traverseAST(expr, (node, vars) => {
    switch (node.type) {
      case NameVariable:
        if (!vars.has(node.name)) out.add(node.name);
    }
  });
  return Array.from(out);
};
