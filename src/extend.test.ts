import { expect, test } from "vitest";

import { jsonStringify } from "@okcontract/cells";

import { isEqual } from "./equal";
import { Rational } from "./rational";

// biome-ignore lint/suspicious/noExportsInTest: used only in tests
export const toEqualWithRationals = () =>
  expect.extend({
    toEqual(received, expected) {
      const pass = isEqual(received, expected);
      return {
        message: () =>
          `expected ${jsonStringify(received)} to be equal to ${jsonStringify(
            expected
          )}`,
        pass,
        expected,
        received
      };
    }
  });

test("test toEqualWithRationals", () => {
  toEqualWithRationals();
  expect(new Rational(1)).toEqual(new Rational([1n, 1n, false]));
});
