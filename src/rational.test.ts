import { describe, expect, it, test } from "vitest";

import {
  NewRational,
  Rational,
  type RationalNumber,
  add,
  divide,
  floatToRational,
  getNumberParts,
  isRationalString,
  multiply,
  power,
  rootNth,
  simplifyRational,
  subtract
} from "./rational";

test("regexp", () => {
  expect(isRationalString("-113/256")).toBe(true);
  expect(isRationalString("113/256")).toBe(true);
  expect(isRationalString("113/0")).toBe(true); // does not check for valid math, just format
  expect(isRationalString("-113/-256")).toBe(false);
  expect(isRationalString("abc/123")).toBe(false);
});

test("print rational", () => {
  expect(new Rational(10).toString()).toBe("10");
  expect(new Rational([1n, 10n, true]).toString()).toBe("-1/10");
  expect(new Rational("-1/10").toString()).toBe("-1/10");
});

test("floatToRational", () => {
  const [numerator, denominator] = floatToRational(Math.PI);
  expect(numerator).toBe(4272943n);
  expect(denominator).toBe(1360120n);
});

test("floatToRational 1/x", () => {
  // @todo fixme for i>=10
  for (let i = 1; i < 9; i++) {
    const [numerator, denominator] = floatToRational(1 / 10 ** i);
    expect(numerator).toBe(1n);
    expect(denominator).toBe(10n ** BigInt(i));
  }
});

test("floatToRational large", () => {
  const [numerator, denominator] = floatToRational(1000.000000000001);
  expect(numerator).toBe(977343669134001n);
  expect(denominator).toBe(977343669134n);
});

test("floatToRational fractions", () => {
  for (let i = 1; i < 10000; i++) {
    const [numerator, denominator] = floatToRational(1 / i);
    expect(numerator).toBe(1n);
    expect(denominator).toBe(BigInt(i));
  }
});

test("simplifyRational", () => {
  let [numerator, denominator] = simplifyRational([1000n, 2000n, false]);
  expect(numerator).toBe(1n);
  expect(denominator).toBe(2n);
  [numerator, denominator] = simplifyRational([2000n, 1000n, false]);
  expect(numerator).toBe(2n);
  expect(denominator).toBe(1n);
});

test("getNumberParts", () => {
  const tests = [
    1,
    -1,
    0.123,
    -0.123,
    1.5,
    -1.5,
    1e100,
    -1e100,
    1e-100,
    -1e-100,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY
  ];

  for (const x of tests) {
    const parts = getNumberParts(x);
    const value = (-1) ** parts.sign * 2 ** parts.exponent * parts.mantissa;
    expect(x).toBe(value);
  }
});

test("NewRational", () => {
  expect(NewRational(0)).toEqual([0n, 1n, false]);
  expect(NewRational(1)).toEqual([1n, 1n, false]);
  expect(NewRational(-1)).toEqual([1n, 1n, true]);
  expect(NewRational("1")).toEqual([1n, 1n, false]);
  expect(NewRational("0x10")).toEqual([16n, 1n, false]);
  expect(NewRational(100n)).toEqual([100n, 1n, false]);
  expect(NewRational(-100n)).toEqual([100n, 1n, true]);
  expect(NewRational("23448594291968334")).toEqual([
    23448594291968334n,
    1n,
    false
  ]);
});

test("rationalOps", () => {
  const rational1 = [3n, 4n, false] as RationalNumber; // 3/4
  const rational2 = [2n, 3n, false] as RationalNumber; // 2/3

  expect(add(rational1, rational2)).toEqual([17n, 12n, false]); // 17/12
  expect(subtract(rational1, rational2)).toEqual([1n, 12n, false]); // 1/12
  expect(multiply(rational1, rational2)).toEqual([1n, 2n, false]); // 1/2
  expect(divide(rational1, rational2)).toEqual([9n, 8n, false]); // 9/8

  // Simplification
  expect(add([1n, 100n, false], [1n, 100n, false])).toEqual([1n, 50n, false]);
});

test("rationalOps negative", () => {
  const negativeRational1 = [3n, 4n, true] as RationalNumber; // -3/4
  const negativeRational2 = [2n, 3n, true] as RationalNumber; // -2/3

  expect(add(negativeRational1, negativeRational2)).toEqual([17n, 12n, true]); // -17/12
  expect(subtract(negativeRational1, negativeRational2)).toEqual([
    1n,
    12n,
    true
  ]); // -1/12
  expect(multiply(negativeRational1, negativeRational2)).toEqual([
    1n,
    2n,
    false
  ]); // 1/2 (because -x*-y = x*y)
  expect(divide(negativeRational1, negativeRational2)).toEqual([9n, 8n, false]); // 9/8 (because -x/-y = x/y)
});

describe("rootNth function", () => {
  it("should correctly compute the square root of 4", () => {
    expect(rootNth(4n, 2n)).toEqual([2n, 0n]);
  });

  it("should correctly compute the cube root of 8", () => {
    expect(rootNth(8n, 3n)).toEqual([2n, 0n]);
  });

  it("should correctly compute the 4th root of 16", () => {
    expect(rootNth(16n, 4n)).toEqual([2n, 0n]);
  });

  it("should correctly compute the square root of a non-square number", () => {
    expect(rootNth(15n, 2n)).toEqual([4n, -1n]);
  });

  it("should correctly compute the cube root of a non-cube number", () => {
    expect(rootNth(16n, 3n)).toEqual([2n, 8n]);
  });

  it("should correctly compute the square root of 5", () => {
    const [root, remainder] = rootNth(5n, 2n);
    expect(root).toEqual(2n);
    expect(remainder).toEqual(1n);
  });
});

describe("power function", () => {
  const rational: RationalNumber = [2n, 3n, false];
  const negativeRational: RationalNumber = [2n, 3n, true];
  it("should correctly compute a positive rational number to the power of 0", () => {
    expect(power(rational, NewRational(0))).toEqual([1n, 1n, false]);
  });

  it("should correctly compute a positive rational number to the power of 2", () => {
    expect(power(rational, NewRational(2))).toEqual([4n, 9n, false]);
  });

  it("should correctly compute a negative rational number to the power of 2", () => {
    expect(power(negativeRational, NewRational(2))).toEqual([4n, 9n, false]);
  });

  it("should correctly compute a negative rational number to the power of 3", () => {
    expect(power(negativeRational, NewRational(3))).toEqual([8n, 27n, true]);
  });

  it("should throw an error when exponent is negative", () => {
    expect(() => power(rational, NewRational(-1))).toThrow(
      "Exponent must be a non-negative integer"
    );
  });

  it("should throw an error when there is a remainder", () => {
    expect(() => power(NewRational(5), [1n, 2n, false])).toThrow(
      "There is a remainder"
    );
  });

  it("should throw an error when base is negative and exponent is fractional", () => {
    expect(() => power(negativeRational, [1n, 2n, false])).toThrow(
      "Cannot root a negative base"
    );
  });

  // @todo

  // it("should correctly compute a positive rational number to the power of 1/2", () => {
  //   // assuming rootNth correctly computes square root for 2/3
  //   const expectedResult: Rational = [rootNth(2n, 2n), rootNth(3n, 2n), false];
  //   expect(power(rational, [1n, 2n, false])).toEqual(expectedResult);
  // });

  // it("should correctly compute a positive rational number to the power of 2/3", () => {
  //   // assuming rootNth correctly computes cube root for (2/3)^2
  //   const expectedResult: Rational = [rootNth(4n, 3n), rootNth(9n, 3n), false];
  //   expect(power(rational, [2n, 3n, false])).toEqual(expectedResult);
  // });
});

test("from JSON", () => {
  const v = JSON.parse('{"numid": "23448594291968334"}', (key, value) =>
    typeof value === "string" && /^\d+$/.test(value) ? BigInt(value) : value
  );
  expect(new Rational(v.numid).toString()).toBe("23448594291968334");
});
