import { expect, test } from "bun:test";
import { jsonStringify } from "@okcontract/cells";

import { isEqual } from "./equal";
import { Rational } from "./rational";

declare module "bun:test" {
  interface Matchers<T = unknown> {
    toEqualRational(expected: T | unknown): void;
  }

  interface AsymmetricMatchers {
    toEqualRational(expected: unknown): void;
  }
}

// Provide a dedicated matcher to avoid overriding global toEqual
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const stripRanges = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripRanges);
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value).filter(([key]) => key !== "range");
    return Object.fromEntries(
      entries.map(([key, entryValue]) => [key, stripRanges(entryValue)])
    );
  }
  return value;
};

export const toEqualRational = () =>
  expect.extend({
    toEqualRational(received, expected) {
      const normalizedReceived = stripRanges(received);
      const normalizedExpected = stripRanges(expected);
      const pass = isEqual(normalizedReceived, normalizedExpected);
      return {
        message: () =>
          `expected ${jsonStringify(normalizedReceived)} to be equal to ${jsonStringify(
            normalizedExpected
          )}`,
        pass,
        expected,
        received
      };
    }
  });

// Backward-compatible helper used by other tests
export const toEqualWithRationals = toEqualRational;

test("test toEqualRational", () => {
  toEqualRational();
  expect(new Rational(1)).toEqualRational(new Rational([1n, 1n, false]));
});
