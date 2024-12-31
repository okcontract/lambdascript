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

/**
 * traverseAST traverses the AST.
 * @param node
 * @param operation function taking the node and the list of bound vars in context.
 */
export const traverseAST = (
  node: ASTNode,
  operation: (node: ASTNode, vars: Set<string>) => void
): void => {
  const aux =
    (vars: Set<string>) =>
    (node: ASTNode): void => {
      operation(node, vars);

      switch (node.type) {
        case NameApplication: {
          aux(vars)(node.function);
          for (const childNode of node.params) aux(vars)(childNode);
          break;
        }
        case NameConstant:
          // No child nodes to traverse
          break;
        case NameVariable:
          // No child nodes to traverse
          break;
        case NameList:
          node.elements.forEach(aux(vars));
          break;
        case NameObject:
          Object.values(node.values).forEach(aux(vars));
          break;
        case NameField:
          aux(vars)(node.expr);
          if ("sub" in node) {
            aux(vars)(node.sub);
          }
          break;
        case NameLambda:
          aux(vars.add(node.parameter))(node.body);
          break;
        case "named":
          aux(vars)(node.value);
          break;
        case NameError:
          // No child nodes to traverse
          break;
        case NameTuple:
          node.elements.forEach(aux(vars));
          break;
        default: {
          const _exhaustiveCheck: never = node;
        }
      }
    };
  aux(new Set())(node);
};
