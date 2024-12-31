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

## Walkthrough

```ts
import { Environment, Rational } from "@okcontract/lambdascript";
// create a new cell (see cells repo on how to create a proxy)
const foo = proxy.new(new Rational(1));
// create a λs Environment (and a standard library)
const env = new Environment(proxy, {
  values: {
    foo,
  },
});
// expr the built reactive expression that will react to `foo` updates
const expr = (await env.evaluateString("foo + 1")) as AnyCell<Rational>; // λs types are not known to TypeScript
expect((await expr.get()).toString()).toBe("2");
// we update foo
foo.set(new Rational(2));
// expr is automatically re-computed
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
