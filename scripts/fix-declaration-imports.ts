const declarationGlob = new Bun.Glob("**/*.d.ts");
const runtimeExtension = /\.(?:c|m)?js$|\.json$|\.node$/i;
const specifierPatterns = [
  /(\bfrom\s+["'])(\.{1,2}\/[^"']+)(["'])/g,
  /(\bimport\s*\(\s*["'])(\.{1,2}\/[^"']+)(["']\s*\))/g
];

const addRuntimeExtensions = (source: string): string =>
  specifierPatterns.reduce(
    (result, pattern) =>
      result.replace(
        pattern,
        (_match, prefix: string, specifier: string, suffix: string) =>
          `${prefix}${
            runtimeExtension.test(specifier) ? specifier : `${specifier}.js`
          }${suffix}`
      ),
    source
  );

let declarationCount = 0;
let rewrittenCount = 0;

for await (const relativePath of declarationGlob.scan({
  cwd: "dist",
  onlyFiles: true
})) {
  declarationCount++;
  const path = `dist/${relativePath}`;
  const source = await Bun.file(path).text();
  const rewritten = addRuntimeExtensions(source);
  if (rewritten !== source) {
    await Bun.write(path, rewritten);
    rewrittenCount++;
  }
}

if (declarationCount === 0) {
  throw new Error("No declaration files found under dist");
}

console.log(
  `Checked ${declarationCount} declaration files; rewrote ${rewrittenCount}`
);
