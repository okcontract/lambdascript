import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const entryPoints = [
  {
    cells: await import("@okcontract/cells"),
    lambdascript: await import("../dist/lambdascript.js"),
    name: "ES module"
  },
  {
    cells: require("@okcontract/cells"),
    lambdascript: require("../dist/lambdascript.umd.cjs"),
    name: "CommonJS"
  }
];

for (const { cells, lambdascript, name } of entryPoints) {
  const proxy = new cells.Sheet().newProxy();
  const foo = proxy.new(new lambdascript.Rational(1));
  const env = new lambdascript.Environment(proxy, { values: { foo } });
  const expression = await env.evaluateString("foo + 1");

  if ((await expression.get()).toString() !== "2") {
    throw new Error(`${name} entry point failed its initial evaluation`);
  }

  foo.set(new lambdascript.Rational(2));
  if ((await expression.get()).toString() !== "3") {
    throw new Error(`${name} entry point failed its reactive evaluation`);
  }

  const value = await env.evaluateStringValue("foo + 1");
  if (value?.toString() !== "3") {
    throw new Error(`${name} entry point failed value extraction`);
  }

  proxy.destroy();
}

console.log("Package entry points passed");
