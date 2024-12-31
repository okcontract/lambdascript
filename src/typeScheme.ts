import { NameVariable } from "./ast";
import {
  type MonoType,
  mapType,
  refreshTypeVars,
  refreshTypeVarsAlpha
} from "./types";

export type TypeScheme = { vars: string[]; type: MonoType };

export const newTypeScheme = (
  type: MonoType,
  vars: string[] = []
): TypeScheme => ({
  vars,
  type
});

/**
 * Instantiate a fresh representation of a TypeScheme.
 * @param ts
 * @returns
 */
export const Instantiate = (
  ts: TypeScheme,
  newVars?: { [orig: string]: string }
): MonoType => {
  const definedNewVars = newVars ?? refreshTypeVars(ts.vars, "in");
  return mapType((varName: string) => {
    if (ts.vars.includes(varName))
      return {
        kind: NameVariable,
        type: definedNewVars[varName]
      };
    return undefined;
  }, ts.type);
};

export const InstantiateAlpha = (ts: TypeScheme): MonoType =>
  Instantiate(ts, refreshTypeVarsAlpha(ts.vars));

function freeVariables(type: MonoType): string[] {
  const fv = new Set<string>();
  // Kinda-hackish but easiest way to traverse a type.
  mapType((varName: string) => {
    fv.add(varName);
    return undefined;
  }, type);
  return Array.from(fv);
}

/**
 * Create a TypeScheme from a MonoType by collecting its free variables.
 */
export const TypeSchemeOfMonoType = (type: MonoType): TypeScheme => {
  const vars = freeVariables(type);
  return { vars, type };
};
