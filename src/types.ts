import {
  NameConstant,
  NameLambda,
  NameList,
  NameObject,
  NameTuple,
  NameVariable
} from "./ast";
import { ArrayMapPreserve, ObjectMapValuesPreserve } from "./objectMap";

export const NameAny = "any";

export type MonoType = (
  | TypeVar
  | TypeConst
  | TypeFunction
  | TypeList
  | TypeObject
  | TypeGeneric
  | TypeConditional
  | TypeAny
  | TypeTuple
) & {
  /** optional label */
  label?: string;
  /** optional hint */
  hint?: string;
};

export type TypeAny = {
  kind: typeof NameAny;
};

export type TypeVar = {
  kind: typeof NameVariable;
  type: string;
};

export type TypeConst = {
  kind: typeof NameConstant;
  type: string;
};

export type TypeFunction = {
  kind: typeof NameLambda;
  argTypes: MonoType[];
  /** type of variadic arguments */
  argVariadic?: MonoType;
  returnType: MonoType;
};

/**
 * TypeFunction constructor.
 * @param argTypes
 * @param returnType
 * @param argVariadic
 * @returns
 */
export const typeFunction = (
  argTypes: MonoType[],
  returnType: MonoType,
  argVariadic?: MonoType
): TypeFunction => ({
  kind: NameLambda,
  argTypes,
  argVariadic,
  returnType
});

export type TypeList = {
  kind: typeof NameList;
  elementType: MonoType;
  /** fixed-size list or tuples */
  size?: number;
  /** min length */
  min?: number;
  /** max length */
  max?: number;
};

export const typeList = (elementType: MonoType): TypeList => ({
  kind: NameList,
  elementType
});

export type TypeTuple = {
  kind: typeof NameTuple;
  elementTypes: MonoType[];
};

export const newTypeTuple = (elementTypes: MonoType[]): TypeTuple => ({
  kind: NameTuple,
  elementTypes
});

// @todo also add tuples?

export type TypeObject = {
  kind: typeof NameObject;
  fields: { [key: string]: MonoType };
  open: boolean;
};

/**
 * TypeObject constructor.
 * @param fields
 * @param open
 * @returns
 */
export const newTypeObject = (
  fields: { [key: string]: MonoType },
  open = false
): TypeObject => ({
  kind: NameObject,
  fields,
  open
});

// Generic types

export const NameGeneric = "generic";
export const NameConditional = "conditional";
export const NameExtends = "extends";

export type TypeGeneric = {
  kind: typeof NameGeneric;
  baseType: MonoType;
  typeArgs: MonoType[];
};

export type TypeConditional = {
  kind: typeof NameConditional;
  check: TypeCheck;
  trueType: MonoType;
  falseType: MonoType;
};

export type TypeCheck = {
  kind: typeof NameExtends;
  left: MonoType;
  right: MonoType;
};

let typeVarCounter = 0;

export function newTypeVar(prefix: string): TypeVar {
  const id = typeVarCounter++;
  return { kind: NameVariable, type: `${prefix}${id}` };
}

/**
 * refreshTypeVars generates a mapping for a list of type variables.
 * @param vars
 * @param prefix
 * @returns
 */
export const refreshTypeVars = (
  vars: string[],
  prefix: string
): { [orig: string]: string } =>
  Object.fromEntries(
    vars.map((v) => {
      const id = typeVarCounter++;
      return [v, `${prefix}${id}`];
    })
  );

/**
 * Starting from "", generates in order "a", "b", ..., "z", "aa", "ab", ...
 */
function nextVariableName(name: string): string {
  let i = name.length - 1;
  while (i >= 0 && name[i] === "z") i--;
  const prefix = name.substring(0, i);
  const mid = i < 0 ? "a" : String.fromCharCode(name.charCodeAt(i) + 1);
  const suffix = "a".repeat(name.length - 1 - i);
  return prefix + mid + suffix;
}

export const refreshTypeVarsAlpha = (
  vars: string[]
): { [orig: string]: string } => {
  let varName = "";
  return Object.fromEntries(
    vars.map((v) => {
      varName = nextVariableName(varName);
      return [v, varName];
    })
  );
};

export function isTypeVar(type: MonoType): type is TypeVar {
  return type.kind === NameVariable;
}

export const newTypeConst = (type: string): TypeConst => {
  return { kind: NameConstant, type };
};

export function isTypeConst(type: MonoType): type is TypeConst {
  return type.kind === NameConstant;
}

export const typeAny: TypeAny = { kind: NameAny };

/**
 * Substitutes type variables in a type. Substitution is not recursive (i.e. it
 * is not applied on the result of the provided function).
 *
 * The function returns the same object if no substitution happened. This allows
 * for fast equality comparisons.
 *
 * @param fn Map a type variable name to a type. Return undefined if the type
 *  variable should not be substituted.
 */
export function mapType(
  fn: (varName: string) => MonoType | undefined,
  monoType: MonoType
): MonoType {
  const aux = (monoType: MonoType): MonoType => {
    switch (monoType.kind) {
      case NameVariable: {
        const mapped = fn(monoType.type);
        return mapped ?? monoType;
      }

      case NameConstant:
        return monoType;

      case NameLambda: {
        const argTypes = ArrayMapPreserve(aux, monoType.argTypes);
        const returnType = aux(monoType.returnType);
        const argVariadic = monoType.argVariadic
          ? aux(monoType.argVariadic)
          : undefined;

        if (
          argTypes === monoType.argTypes &&
          returnType === monoType.returnType &&
          argVariadic === monoType.argVariadic
        )
          return monoType;

        return {
          kind: NameLambda,
          argTypes,
          returnType,
          argVariadic
        };
      }

      case NameList: {
        const elementType = aux(monoType.elementType);

        if (elementType === monoType.elementType) return monoType;

        return {
          kind: NameList,
          elementType
        };
      }

      case NameObject: {
        const fields = ObjectMapValuesPreserve(aux, monoType.fields);

        if (fields === monoType.fields) return monoType;

        return {
          kind: NameObject,
          fields,
          open: monoType.open
        };
      }

      case NameGeneric: {
        const baseType = aux(monoType.baseType);
        const typeArgs = ArrayMapPreserve(aux, monoType.typeArgs);

        if (baseType === monoType.baseType && typeArgs === monoType.typeArgs)
          return monoType;

        return {
          kind: NameGeneric,
          baseType,
          typeArgs
        };
      }

      case NameConditional: {
        const left = aux(monoType.check.left);
        const right = aux(monoType.check.right);
        const trueType = aux(monoType.trueType);
        const falseType = aux(monoType.falseType);

        if (
          left === monoType.check.left &&
          right === monoType.check.right &&
          trueType === monoType.trueType &&
          falseType === monoType.falseType
        )
          return monoType;

        return {
          kind: NameConditional,
          check: {
            kind: monoType.check.kind,
            left,
            right
          },
          trueType,
          falseType
        };
      }

      case NameAny:
        return typeAny;

      case NameTuple: {
        const elementTypes = ArrayMapPreserve(aux, monoType.elementTypes);
        if (elementTypes === monoType.elementTypes) return monoType;
        return {
          kind: NameTuple,
          elementTypes
        };
      }

      default: {
        const _exhaustiveCheck: never = monoType;
        return _exhaustiveCheck;
      }
    }
  };
  return aux(monoType);
}
