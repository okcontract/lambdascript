/**
 * Rational encodes arbitrary precision numbers as
 * [numerator,denominator,negative]
 */
export type RationalNumber = [bigint, bigint, boolean];
export type RationalString = string;

export const rationalNumberRegex = /^-?\d+\/\d+$/;

export const isRationalString = (input: unknown): input is RationalString =>
  typeof input === "string" && rationalNumberRegex.test(input);

/**
 * Rational is a class from RationalNumbers.
 */
export class Rational {
  private _value: RationalNumber;

  constructor(num: number | bigint | string | RationalNumber) {
    this._value =
      Array.isArray(num) &&
      num.length === 3 &&
      typeof num[0] === "bigint" &&
      typeof num[1] === "bigint" &&
      typeof num[2] === "boolean"
        ? num
        : NewRational(num as number | bigint | string);
  }
  /**
   * low-level output
   * @returns
   */
  output = () => {
    const numerator = this._value[0];
    const denominator = this._value[1];
    const isNegative = this._value[2];
    return `"${isNegative ? "-" : ""}${numerator.toString()}${
      denominator === 1n ? "" : `/${denominator.toString()}`
    }"`;
  };

  simplify = () => new Rational(simplifyRational(this._value));
  toString = () => printRational(this._value); // this.toBigInt().toString();
  get toPrettyString() {
    return printRational(this._value);
  }

  toBigInt = () => {
    const [a, b, s] = this._value;
    return s ? -a / b : a / b;
  };

  toNumber = () => {
    const [a, b, s] = this._value;
    return s ? Number(-a) / Number(b) : Number(a) / Number(b);
  };

  add = (b: Rational) => new Rational(add(this._value, b._value));
  subtract = (b: Rational) => new Rational(subtract(this._value, b._value));
  multiply = (b: Rational) => new Rational(multiply(this._value, b._value));
  divide = (b: Rational) => new Rational(divide(this._value, b._value));
  power = (b: Rational) => new Rational(power(this._value, b._value));

  // @todo reduce value encapsulation
  min = (...args: Rational[]) =>
    new Rational(min(this._value, ...args.map((v) => v._value)));
  max = (...args: Rational[]) =>
    new Rational(max(this._value, ...args.map((v) => v._value)));

  compare = (op: string, b: Rational) => {
    const aSimplified = this.simplify();
    const bSimplified = b.simplify();
    // console.log({ aSimplified, bSimplified });
    // Multiply the numerators by the denominators of the other fraction
    const aVal = aSimplified._value[2]
      ? -(aSimplified._value[0] * bSimplified._value[1])
      : aSimplified._value[0] * bSimplified._value[1];
    const bVal = bSimplified._value[2]
      ? -(bSimplified._value[0] * aSimplified._value[1])
      : bSimplified._value[0] * aSimplified._value[1];
    switch (op) {
      case "<":
        return aVal < bVal;
      case ">":
        return aVal > bVal;
      case "<=":
        return aVal <= bVal;
      case ">=":
        return aVal >= bVal;
      case "==":
        return aVal === bVal;
      case "!=":
        return aVal !== bVal;
      default:
        throw new Error("Invalid operator. Use one of these: < > <= >= == !=");
    }
  };

  equals = (b: Rational) => this.compare("==", b);

  floor = () => {
    const [numerator, denominator, isNegative] = this._value;
    // Perform integer division
    let result = numerator / denominator;
    // If negative and there's a remainder, subtract 1 to floor it correctly
    if (isNegative && numerator % denominator !== 0n) {
      result += 1n;
    }
    // Return a new Rational representing the floored value
    return new Rational([result, 1n, isNegative]);
  };
}

export const printRational = (r: RationalNumber): string => {
  const [num, den, sign] = simplifyRational(r);
  return (
    // json_stringify(r) +
    `${sign ? "-" : ""}${num.toString()}${den > 1n ? `/${den.toString()}` : ""}`
  );
};

/**
 * NewRational creates a new Rational from any number.
 * @param num
 */
export const NewRational = (num: number | bigint | string): RationalNumber => {
  // console.log({ num });
  switch (typeof num) {
    case "bigint":
      return [num < 0n ? -num : num, 1n, num < 0n];
    case "number":
      return floatToRational(num);
    case "string":
      if (num.includes(".")) return floatToRational(Number.parseFloat(num));
      if (num.includes("/")) {
        const [numerator, denominator] = num
          .split("/")
          .map((n) => BigInt(n.trim()));
        const isNegative = numerator < 0n;
        return [isNegative ? -numerator : numerator, denominator, isNegative];
      }
      return NewRational(BigInt(num));
  }
};

// from: https://stackoverflow.com/questions/9383593/extracting-the-exponent-and-mantissa-of-a-javascript-number
export function getNumberParts(x: number) {
  const float = new Float64Array(1);
  const bytes = new Uint8Array(float.buffer);
  float[0] = x;
  const sign = bytes[7] >> 7;
  const exponent = (((bytes[7] & 0x7f) << 4) | (bytes[6] >> 4)) - 0x3ff;
  bytes[7] = 0x3f;
  bytes[6] |= 0xf0;
  return {
    sign: sign,
    exponent: exponent,
    mantissa: float[0]
  };
}

export function floatToRational(
  f: number,
  maxDenominator = 1000000
): RationalNumber {
  const epsilon = 1.0 / (maxDenominator * maxDenominator);
  let [n, d] = [1n, 0n]; // numerator / denominator
  let [a, b] = [0n, 1n]; // auxiliary numerator / denominator
  let c = Math.abs(f);

  do {
    const l = BigInt(Math.floor(c));
    const next = c - Number(l);

    [a, n] = [n, l * n + a];
    [b, d] = [d, l * d + b];

    if (Math.abs(Number(n) / Number(d) - Math.abs(f)) < epsilon) {
      break;
    }

    c = 1 / next;
  } while (Number(d) < maxDenominator);

  return [n, d, f < 0];
}

function gcd(a: bigint, b: bigint): bigint {
  return b === 0n ? a : gcd(b, a % b);
}

export function simplifyRational([
  numerator,
  denominator,
  neg
]: RationalNumber): RationalNumber {
  const commonDivisor = gcd(numerator, denominator);
  return [numerator / commonDivisor, denominator / commonDivisor, neg];
}

export function add(
  [num1, den1, sign1]: RationalNumber,
  [num2, den2, sign2]: RationalNumber
): RationalNumber {
  const numerator =
    (sign1 ? -1n : 1n) * num1 * den2 + (sign2 ? -1n : 1n) * num2 * den1;
  const denominator = den1 * den2;
  const absNumerator = numerator < 0n ? -numerator : numerator;
  const commonDivisor = gcd(absNumerator, denominator);
  return [
    absNumerator / commonDivisor,
    denominator / commonDivisor,
    numerator < 0n
  ];
}

export const negative = ([a, b, s]: RationalNumber): RationalNumber => [
  a,
  b,
  !s
];

export const subtract = (
  r1: RationalNumber,
  r2: RationalNumber
): RationalNumber => add(r1, negative(r2));

export const multiply = (
  [num1, den1, isNegative1]: RationalNumber,
  [num2, den2, isNegative2]: RationalNumber
): RationalNumber =>
  simplifyRational([num1 * num2, den1 * den2, isNegative1 !== isNegative2]);

export const divide = (
  [num1, den1, isNegative1]: RationalNumber,
  [num2, den2, isNegative2]: RationalNumber
): RationalNumber => {
  if (num2 === BigInt(0)) throw new Error("Division by zero");
  return simplifyRational([
    num1 * den2,
    den1 * num2,
    isNegative1 !== isNegative2
  ]);
};

/**
 * Calculate n-th root of val
 * Parameters:
 * k: is n-th (default square root)
 * limit: is maximum number of iterations (default: -1 no limit)
 * @from https://stackoverflow.com/questions/53683995/javascript-big-integer-square-root
 */
export function rootNth(val: bigint, k = 2n, limit = -1) {
  let o = 0n; // old approx value
  let x = val;
  let l = limit;

  while (x ** k !== k && x !== o && --l) {
    o = x;
    x = ((k - 1n) * x + val / x ** (k - 1n)) / k;
    if (l < 0 && (x - o) ** 2n === 1n) break;
  }

  if ((val - (x - 1n) ** k) ** 2n < (val - x ** k) ** 2n) x = x - 1n;
  if ((val - (x + 1n) ** k) ** 2n < (val - x ** k) ** 2n) x = x + 1n;

  const remainder = val - x ** k;
  // console.log({ x, remainder });
  return [x, remainder];
}

export const power = (
  [num1, den1, isNegative1]: RationalNumber,
  [num2, den2, isNegative2]: RationalNumber
): RationalNumber => {
  if (isNegative2) throw new Error("Exponent must be a non-negative integer");
  if (num2 === 0n) return [1n, 1n, false];

  if (den2 !== 1n) {
    if (isNegative1) throw new Error("Cannot root a negative base");
    // fractional power
    const [numRoot, rem1] = rootNth(num1, den2);
    const [denRoot, rem2] = rootNth(den1, den2);
    // @todo approximation from float
    if (rem1 !== 0n || rem2 !== 0n) throw new Error("There is a remainder");
    return simplifyRational([numRoot, denRoot, false]);
  }

  // integral power
  return simplifyRational([
    num1 ** num2,
    den1 ** num2,
    isNegative1 && num2 % 2n !== 0n
  ]);
};

/**
 * Compares two rational numbers.
 * Returns:
 *  - a positive number if a > b
 *  - 0 if a = b
 *  - a negative number if a < b
 */
export function compareRationalNumbers(
  [aNum, aDenom, aNeg]: RationalNumber,
  [bNum, bDenom, bNeg]: RationalNumber
): number {
  if (aNeg && !bNeg) return -1;
  if (!aNeg && bNeg) return 1;

  const aBig = aNum * bDenom;
  const bBig = bNum * aDenom;

  if (aNeg && bNeg) {
    return Number(bBig - aBig);
  }
  return Number(aBig - bBig);
}

export function min(
  v: RationalNumber,
  ...args: RationalNumber[]
): RationalNumber {
  let minVal = v;
  for (const arg of args) {
    if (compareRationalNumbers(arg, minVal) < 0) {
      minVal = arg;
    }
  }
  return minVal;
}

export function max(
  v: RationalNumber,
  ...args: RationalNumber[]
): RationalNumber {
  let maxVal = v;
  for (const arg of args) {
    if (compareRationalNumbers(arg, maxVal) > 0) {
      maxVal = arg;
    }
  }
  return maxVal;
}

export const zero = new Rational(0);
