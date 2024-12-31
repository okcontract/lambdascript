import type { ASTNode } from "./ast";
import { type ParserExtension, toHighLevelAST } from "./highLevel";
import { toLowLevelAST } from "./lowLevel";
import { parser } from "./parser/λs";

export const reservedKeywords = ["true", "false", "if", "for", "in"];

export type ParseOptions = {
  ext?: ParserExtension<unknown, string>[];
};

export const parseExpression = async (
  expr: string,
  options: ParseOptions = {}
): Promise<ASTNode> => {
  return new Promise((resolve, reject) => {
    try {
      // 1. parse tree
      const tree = parser.parse(expr);
      // 2. low-level AST
      const lowLevelAST = toLowLevelAST(expr, tree);
      // 3. high-level AST
      const highLevelAST = toHighLevelAST(lowLevelAST, options.ext);
      resolve(highLevelAST);
    } catch (error) {
      reject(error);
    }
  });
};
