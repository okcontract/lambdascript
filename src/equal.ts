import { Cell } from "@okcontract/cells";

import { Environment } from "./env";
import { Rational } from "./rational";

function constructorNameOf(value: object) {
  return (
    (value as { constructor?: { name?: string } }).constructor?.name ?? "Object"
  );
}

function isPlainObject(value: object) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function valuePreview(value: unknown) {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "symbol") return value.toString();
  return String(value);
}

function canUseNativeScalarEquality(value: unknown) {
  return (value === null || typeof value !== "object") && !Number.isNaN(value);
}

function findMatchingSetValueIndex(
  values: readonly unknown[],
  candidate: unknown,
  used: readonly boolean[]
) {
  for (let index = 0; index < values.length; index++) {
    if (used[index]) continue;
    if (isEqual(candidate, values[index])) return index;
  }
  return -1;
}

function findMatchingMapEntryIndex(
  entries: readonly (readonly [unknown, unknown])[],
  key: unknown,
  value: unknown,
  used: readonly boolean[]
) {
  for (let index = 0; index < entries.length; index++) {
    if (used[index]) continue;
    const [otherKey, otherValue] = entries[index];
    if (isEqual(key, otherKey) && isEqual(value, otherValue)) return index;
  }
  return -1;
}

function findMatchingMapKeyIndex(
  entries: readonly (readonly [unknown, unknown])[],
  key: unknown,
  used: readonly boolean[]
) {
  for (let index = 0; index < entries.length; index++) {
    if (used[index]) continue;
    if (isEqual(key, entries[index][0])) return index;
  }
  return -1;
}

function setsEqual(a: Set<unknown>, b: Set<unknown>) {
  if (a.size !== b.size) return false;

  const deferredValuesA: unknown[] = [];
  const deferredValuesB: unknown[] = [];

  for (const value of a) {
    if (canUseNativeScalarEquality(value)) {
      if (!b.has(value)) return false;
    } else {
      deferredValuesA.push(value);
    }
  }

  if (deferredValuesA.length === 0) return true;

  for (const value of b) {
    if (!canUseNativeScalarEquality(value)) deferredValuesB.push(value);
  }

  if (deferredValuesA.length !== deferredValuesB.length) return false;

  const used = new Array(deferredValuesB.length).fill(false);

  for (const value of deferredValuesA) {
    const matchIndex = findMatchingSetValueIndex(deferredValuesB, value, used);
    if (matchIndex === -1) return false;
    used[matchIndex] = true;
  }

  return true;
}

function mapsEqual(a: Map<unknown, unknown>, b: Map<unknown, unknown>) {
  if (a.size !== b.size) return false;
  const entriesB = Array.from(b.entries());
  const used = new Array(entriesB.length).fill(false);

  for (const [key, value] of a) {
    const matchIndex = findMatchingMapEntryIndex(entriesB, key, value, used);
    if (matchIndex === -1) return false;
    used[matchIndex] = true;
  }

  return true;
}

export const allDiff = (a: unknown, b: unknown) => {
  const differences: string[] = [];
  const aux = (a: unknown, b: unknown, path = "") => {
    if (a === b) return;

    if (a instanceof Cell && b instanceof Cell) {
      if (!(a.id === b.id || a?.pointed === b.id || a.id === b?.pointed))
        differences.push(`${path}/Cell: ${a.id} vs ${b.id}`);
      return;
    }

    if (a instanceof Environment && b instanceof Environment) {
      aux(a.values, b.values, `${path}/Environment`);
      return;
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
      if (typeof a !== typeof b)
        differences.push(`${path}/Type: ${typeof a} vs ${typeof b}`);
      else differences.push(`${path}/Value: ${String(a)} vs ${String(b)}`);
      return;
    }

    const constructorNameA = constructorNameOf(a);
    const constructorNameB = constructorNameOf(b);

    if (constructorNameA !== constructorNameB) {
      differences.push(
        `${path}/Constructor: ${constructorNameA} vs ${constructorNameB}`
      );
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

    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size)
        differences.push(`${path}/Set size: ${a.size} vs ${b.size}`);

      const valuesB = Array.from(b);
      const used = new Array(valuesB.length).fill(false);

      for (const value of a) {
        const matchIndex = findMatchingSetValueIndex(valuesB, value, used);
        if (matchIndex !== -1) {
          used[matchIndex] = true;
          continue;
        }

        const diffIndex = used.findIndex((taken) => !taken);
        if (diffIndex === -1) {
          differences.push(
            `${path}/Missing value in second set: ${valuePreview(value)}`
          );
          continue;
        }

        used[diffIndex] = true;
        differences.push(
          `${path}/Set value difference: ${
            firstDiff(value, valuesB[diffIndex]) ?? valuePreview(value)
          }`
        );
      }

      for (let index = 0; index < valuesB.length; index++) {
        if (!used[index]) {
          differences.push(
            `${path}/Unexpected value in second set: ${valuePreview(valuesB[index])}`
          );
        }
      }
      return;
    }

    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size)
        differences.push(`${path}/Map size: ${a.size} vs ${b.size}`);

      const entriesB = Array.from(b.entries());
      const used = new Array(entriesB.length).fill(false);

      for (const [key, value] of a) {
        const matchIndex = findMatchingMapEntryIndex(
          entriesB,
          key,
          value,
          used
        );
        if (matchIndex !== -1) {
          used[matchIndex] = true;
          continue;
        }

        const keyIndex = findMatchingMapKeyIndex(entriesB, key, used);
        if (keyIndex !== -1) {
          used[keyIndex] = true;
          aux(
            value,
            entriesB[keyIndex][1],
            `${path}/Map value for key ${valuePreview(key)}`
          );
          continue;
        }

        differences.push(
          `${path}/Missing map key in second map: ${valuePreview(key)}`
        );
      }

      for (let index = 0; index < entriesB.length; index++) {
        if (!used[index]) {
          differences.push(
            `${path}/Unexpected map key in second map: ${valuePreview(
              entriesB[index][0]
            )}`
          );
        }
      }
      return;
    }

    if (
      !isPlainObject(a) &&
      typeof a.toString === "function" &&
      typeof b.toString === "function"
    ) {
      if (a.toString() !== b.toString())
        differences.push(`${path}/${constructorNameA}: ${a} vs ${b}`);
      return;
    }

    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length)
      differences.push(
        `${path}/Object keys length: ${keysA.length} vs ${keysB.length}`
      );

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        differences.push(`${path}/Missing key in second object: ${key}`);
      } else {
        aux(objA[key], objB[key], `${path}/${key}`);
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
    const diff = firstDiff(a.values, b.values);
    if (diff) return `Environment difference: ${diff}`;
    return null;
  }

  if (a instanceof Rational && b instanceof Rational) {
    if (!a.compare("==", b)) return `Rational number difference: ${a} vs ${b}`;
    return null;
  }

  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  )
    return typeof a !== typeof b
      ? `Type difference: ${typeof a} vs ${typeof b}`
      : `Value difference: ${String(a)} vs ${String(b)}`;

  const constructorNameA = constructorNameOf(a);
  const constructorNameB = constructorNameOf(b);

  if (constructorNameA !== constructorNameB)
    return `Constructor difference: ${constructorNameA} vs ${constructorNameB}`;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length)
      return `Array length difference: ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const diff = firstDiff(a[i], b[i]);
      if (diff) return `Array[${i}] difference: ${diff}`;
    }
    return null;
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return `Set size difference: ${a.size} vs ${b.size}`;

    const valuesB = Array.from(b);
    const used = new Array(valuesB.length).fill(false);

    for (const value of a) {
      const matchIndex = findMatchingSetValueIndex(valuesB, value, used);
      if (matchIndex !== -1) {
        used[matchIndex] = true;
        continue;
      }

      const diffIndex = used.findIndex((taken) => !taken);
      if (diffIndex === -1)
        return `Missing value in second set: ${valuePreview(value)}`;

      return `Set value difference: ${
        firstDiff(value, valuesB[diffIndex]) ?? valuePreview(value)
      }`;
    }

    return null;
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return `Map size difference: ${a.size} vs ${b.size}`;

    const entriesB = Array.from(b.entries());
    const used = new Array(entriesB.length).fill(false);

    for (const [key, value] of a) {
      const matchIndex = findMatchingMapEntryIndex(entriesB, key, value, used);
      if (matchIndex !== -1) {
        used[matchIndex] = true;
        continue;
      }

      const keyIndex = findMatchingMapKeyIndex(entriesB, key, used);
      if (keyIndex !== -1) {
        const diff = firstDiff(value, entriesB[keyIndex][1]);
        return diff
          ? `Map value for key ${valuePreview(key)}: ${diff}`
          : `Map entry difference for key ${valuePreview(key)}`;
      }
      return `Missing map key in second map: ${valuePreview(key)}`;
    }

    return null;
  }

  if (
    !isPlainObject(a) &&
    typeof a.toString === "function" &&
    typeof b.toString === "function"
  ) {
    if (a.toString() !== b.toString())
      return `${constructorNameA}: ${a} vs ${b}`;
    return null;
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length)
    return `Object keys length difference: ${keysA.length} vs ${keysB.length}`;

  for (const key of keysA) {
    if (!keysB.includes(key)) return `Missing key in second object: ${key}`;
    const diff = firstDiff(objA[key], objB[key]);
    if (diff) return `Key '${key}' difference: ${diff}`;
  }

  return null;
}

export function isEqual(a: unknown, b: unknown): boolean {
  // Same instance or primitive values are equal
  if (a === b) return true;

  // Cells are identical if same cell or one cell points to another.
  if (a instanceof Cell && b instanceof Cell) return a.id === b.id;
  // || isEqual(a.value, b.value);
  // return a.id === b.id || a?.pointed === b.id || a.id === b?.pointed;

  // Environments are equals if the hold the same values.
  if (a instanceof Environment && b instanceof Environment) {
    const eq = isEqual(a.values, b.values);
    // if (!eq)
    //   console.log({
    //     isEqual: "env",
    //     a: Object.keys(a._values),
    //     b: Object.keys(b._values),
    //     eq,
    //     reason: allDiff(a, b)
    //   });
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

  if (a instanceof Set && b instanceof Set) return setsEqual(a, b);
  if (a instanceof Map && b instanceof Map) return mapsEqual(a, b);

  // Fast rejection for mismatched object kinds before deeper comparison.
  if (constructorNameOf(a) !== constructorNameOf(b)) return false;

  if (
    !isPlainObject(a) &&
    typeof a.toString === "function" &&
    typeof b.toString === "function"
  )
    return a.toString() === b.toString();

  // Compare objects
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);

  if (keysA.length !== Object.keys(objB).length) return false;

  for (let index = 0; index < keysA.length; index++) {
    const key = keysA[index];
    if (!Object.hasOwn(objB, key)) return false; // Different shape
    if (!isEqual(objA[key], objB[key])) return false; // Different value
  }

  return true;
}
