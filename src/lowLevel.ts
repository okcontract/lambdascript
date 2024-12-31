import type { SyntaxNode, Tree } from "@lezer/common";

/** Low-level AST Nodes */
export type LowLevelAST = {
  /** name of Node type */
  name: string;
  /** value for terminal Nodes */
  value?: string;
  /** children for non-terminal Nodes */
  children?: LowLevelAST[];
  error?: { from: number; to: number };
};

function isError(name: string): boolean {
  return name === "⚠";
}

export function toLowLevelAST(input: string, tree: Tree) {
  const aux = (node: SyntaxNode): LowLevelAST => {
    const name = node?.type?.name;
    const res: LowLevelAST = { name };
    let child = node.firstChild;

    if (child) {
      res.children = [aux(child)];
      // biome-ignore lint/suspicious/noAssignInExpressions: easy to understand
      while ((child = child.nextSibling)) {
        res.children.push(aux(child));
      }
    } else {
      // terminal node
      res.value = input.slice(node.from, node.to);
    }
    if (isError(name)) {
      res.error = { from: node.from, to: node.to };
    }
    return res;
  };
  return aux(tree.topNode);
}
