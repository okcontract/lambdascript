import { Cell } from "@okcontract/cells";

import { Environment } from "./env";
import { Rational } from "./rational";

export const allDiff = (a: unknown, b: unknown) => {
  const differences = [];
  const aux = (a: unknown, b: unknown, path = "") => {
    if (a === b) return;

    if (a instanceof Cell && b instanceof Cell) {
      if (!(a.id === b.id || a?.pointed === b.id || a.id === b?.pointed))
        differences.push(`${path}/Cell: ${a.id} vs ${b.id}`);
      return;
    }

    if (a instanceof Environment && b instanceof Environment) {
      aux(a._values, b._values, `${path}/Environment`);
    }

    if (a instanceof Rational && b instanceof Rational) {
      if (!a.compare("==", b))
        differences.push(`${path}/Rational: ${a} vs ${b}`);
      return;
    }

    if (typeof a === "function" && typeof b === "function") return;

    if (
      typeof a !== "object" ||
      a === null ||
      typeof b !== "object" ||
      b === null
    ) {
      differences.push(`${path}/Type: ${typeof a} vs ${typeof b}`);
      return;
    }

    if (
      a.constructor.name !== "Object" &&
      a.constructor.name === b.constructor.name &&
      a.toString
    ) {
      if (a.toString() !== b.toString())
        differences.push(`${path}/${a.constructor.name}: ${a} vs ${b}`);
      return;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length)
        differences.push(`${path}/Array length: ${a.length} vs ${b.length}`);
      a.forEach((item, index) => {
        aux(item, b[index], `${path}[${index}]`);
      });
      return;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length)
      differences.push(
        `${path}/Object keys length: ${keysA.length} vs ${keysB.length}`
      );

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        differences.push(`${path}/Missing key in second object: ${key}`);
      } else {
        aux(a[key], b[key], `${path}/${key}`);
      }
    }
  };

  aux(a, b);
  return differences;
};

export function firstDiff(a: unknown, b: unknown): string | null {
  if (a === b) return null;

  if (a instanceof Cell && b instanceof Cell) {
    if (!(a.id === b.id || a?.pointed === b.id || a.id === b?.pointed))
      return `Cell difference: ${a.id} vs ${b.id}`;
    return null;
  }

  if (a instanceof Environment && b instanceof Environment) {
    const diff = firstDiff(a._values, b._values);
    if (diff) return `Environment difference: ${diff}`;
    return null;
  }

  if (a instanceof Rational && b instanceof Rational) {
    if (!a.compare("==", b)) return `Rational number difference: ${a} vs ${b}`;
    return null;
  }

  if (
    typeof a === "object" &&
    typeof b === "object" &&
    a.constructor.name !== "Object" &&
    a.constructor.name === b.constructor.name &&
    a.toString
  ) {
    if (a.toString() !== b.toString())
      return `${a.constructor.name}: ${a} vs ${b}`;
    return null;
  }

  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  )
    return `Type difference: ${typeof a} vs ${typeof b}`;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length)
      return `Array length difference: ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const diff = firstDiff(a[i], b[i]);
      if (diff) return `Array[${i}] difference: ${diff}`;
    }
    return null;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length)
    return `Object keys length difference: ${keysA.length} vs ${keysB.length}`;

  for (const key of keysA) {
    if (!keysB.includes(key)) return `Missing key in second object: ${key}`;
    const diff = firstDiff(a[key], b[key]);
    if (diff) return `Key '${key}' difference: ${diff}`;
  }

  return null;
}

export function isEqual(a: unknown, b: unknown): boolean {
  // Same instance or primitive values are equal
  if (a === b) return true;

  // Cells are identical if same cell or one cell points to another.
  if (a instanceof Cell && b instanceof Cell)
    return a.id === b.id || isEqual(a.value, b.value);
  // return a.id === b.id || a?.pointed === b.id || a.id === b?.pointed;

  // Environments are equals if the hold the same values.
  if (a instanceof Environment && b instanceof Environment) {
    const eq = isEqual(a._values, b._values);
    // console.log({
    //   isEqual: "env",
    //   a: Object.keys(a._values),
    //   b: Object.keys(b._values),
    //   eq,
    //   reason: allDiff(a, b),
    // });
    return eq;
  }

  // Special case for Rational instances
  if (a instanceof Rational && b instanceof Rational) return a.compare("==", b);

  // If one of them is null or not an object, they are not equal
  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  )
    return false;

  // Compare arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (
    a.constructor.name !== "Object" &&
    a.constructor.name === b.constructor.name &&
    a.toString
  )
    return a.toString() === b.toString();

  // Compare objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false; // Different shape
    if (!isEqual(a[key], b[key])) return false; // Different value
  }

  return true;
}
