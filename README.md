# lambdascript, a reactive functional scripting language

[![CI](https://github.com/okcontract/lambdascript/actions/workflows/main.yml/badge.svg)](https://github.com/okcontract/lambdascript/actions?query=branch%3Amain++)
[![Coverage Status](https://coveralls.io/repos/github/okcontract/lambdascript/badge.svg?branch=main)](https://coveralls.io/github/okcontract/lambdascript?branch=main)
[![size](https://deno.bundlejs.com/badge?q=@okcontract/lambdascript)](https://bundlephobia.com/package/@okcontract/lambdascript)

lambdascript (λs) is a purely functional programming language that generates
**reactive expressions** using [cells](https://github.com/okcontract/cells) as
a runtime.

It is similar to formulas in spreadsheets that can be parsed from user inputs
or definition templates.

λs is strongly statically typed, i.e. there is a typechecker with inference
(akin to OCaml) that verifies expression types before they are built as
reactive programs.

Another notable property is the default use of `Rationals` for both integers
and floats of arbitrary length throughout the standard library.

## Installation

```sh
npm install @okcontract/lambdascript @okcontract/cells
```

## Walkthrough

```ts
import { type AnyCell, Sheet } from "@okcontract/cells";
import { Environment, Rational } from "@okcontract/lambdascript";

// Create a new cell `foo` (see https://github.com/okcontract/cells)
const proxy = new Sheet().newProxy();
const foo = proxy.new(new Rational(1));
// Create a λs Environment (and a standard library)
const env = new Environment(proxy, {
  values: {
    foo,
  },
});

// The expression is recomputed whenever `foo` changes.
const expr = (await env.evaluateString("foo + 1")) as AnyCell<Rational>;
expect((await expr.get()).toString()).toBe("2");

foo.set(new Rational(2));
expect((await expr.get()).toString()).toBe("3");
```

## Standard library

The standard library is easily extensible.

If you plan to use a single `Environment`, a new library is automatically
created. However, you can reuse a standard library between environments:

```ts
const lib = defaultLibrary(libproxy);
const env1 = new Environment(proxy1, { lib });
// ...
const env2 = new Environment(proxy2, { lib });
```

## Development

Building and testing `lambdascript` requires a system installation of
[`bun`](https://bun.com). Bun is deliberately not included in the project's
dependencies.

```sh
bun install --frozen-lockfile
bun run grammar
bun run test
bun run build
bun run definitions
```

[`biome`](https://biomejs.dev) is also deliberately not included as a project
dependency. Install it as a system binary if you want to run `bun run format`
or `bun run check`. The standard `bun run build` script formats the source
before bundling, so it also expects `biome` to be available on `PATH`; direct
use of `bun build` does not require Biome.

# Design & Philosophy

We aim for ease of use, correction and security, so chasing down any bug is
our top priority. Our goal is to run expressions safely from user inputs.

A non-goal is high-performance: `lambdascript` is slower than `eval` calls!

# About

`lambdascript` is built at [OKcontract](https://okcontract.com) and is
released under the Apache license.

Contributors are welcome, feel free to submit PRs directly for small changes.
You can also reach out on [Twitter](https://x.com/okcontract) in advance for
larger contributions.
