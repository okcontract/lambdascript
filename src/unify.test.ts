import { expect, test } from "vitest";

import { NameVariable } from "./ast";
import { typeNumber, typeString } from "./stdlib";
import {
  NameConditional,
  NameExtends,
  NameGeneric,
  type TypeConditional,
  type TypeGeneric,
  type TypeVar
} from "./types";
import { TypeSubstitution } from "./unify";

test("unify generic and conditional types", async () => {
  const typeT: TypeVar = { kind: NameVariable, type: "T" };

  const typeGeneric1: TypeGeneric = {
    kind: NameGeneric,
    baseType: typeNumber,
    typeArgs: [typeT]
  };

  const typeGeneric2: TypeGeneric = {
    kind: NameGeneric,
    baseType: typeNumber,
    typeArgs: [typeString]
  };

  const typeConditional1: TypeConditional = {
    kind: NameConditional,
    check: { kind: NameExtends, left: typeT, right: typeNumber },
    trueType: typeNumber,
    falseType: typeString
  };

  const typeConditional2: TypeConditional = {
    kind: NameConditional,
    check: { kind: NameExtends, left: typeString, right: typeNumber },
    trueType: typeNumber,
    falseType: typeString
  };

  const subst = new TypeSubstitution();
  // Unify generic types
  subst._unify(typeGeneric1, typeGeneric2);
  const unifiedGeneric = subst._apply(typeGeneric1);
  expect(unifiedGeneric).toEqual(typeGeneric2);

  // Unify conditional types
  subst._unify(typeConditional1, typeConditional2);
  const unifiedConditional = subst._apply(typeConditional1);
  expect(unifiedConditional).toEqual(typeConditional2);
});
