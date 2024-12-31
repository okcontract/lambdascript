import { describe, expect, it } from "vitest";

import { compareRationalNumbers, max, min } from "./rational";

describe("compareRationalNumbers", () => {
  it("should return a negative number if the first number is less than the second", () => {
    const result = compareRationalNumbers([1n, 2n, false], [1n, 1n, false]);
    expect(result).toBeLessThan(0);
  });

  it("should return a positive number if the first number is greater than the second", () => {
    const result = compareRationalNumbers([1n, 1n, false], [1n, 2n, false]);
    expect(result).toBeGreaterThan(0);
  });

  it("should return zero if the numbers are equal", () => {
    const result = compareRationalNumbers([1n, 2n, false], [1n, 2n, false]);
    expect(result).toBe(0);
  });
});

describe("min", () => {
  it("should return the smallest rational number", () => {
    const smallest = min([1n, 2n, false], [1n, 1n, false], [2n, 3n, false]);
    expect(smallest).toEqual([1n, 2n, false]);
  });
});

describe("max", () => {
  it("should return the largest rational number", () => {
    const largest = max([1n, 2n, false], [1n, 1n, false], [2n, 3n, false]);
    expect(largest).toEqual([1n, 1n, false]);
  });
});
