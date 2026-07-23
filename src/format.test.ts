import { describe, expect, it } from "bun:test";

import { formatExpression, formatProgram, Separator } from "./format";

describe("formatExpression", () => {
  it("formats flat expressions while preserving raw numeric literals", () => {
    const formatted = formatExpression("f(1;foo:0xa,bar:{0x1})", {
      separator: Separator.Space,
      spaces: 2,
      trailingCommas: true,
      width: 120
    });

    expect(formatted).toBe("f(1; foo: 0xa, bar: { 0x1 })");
  });
});

describe("formatProgram", () => {
  it("formats multiline call arguments with trailing commas", () => {
    const source = `let $value = $arg0
in $write(
  0xd66362fd3da0170e26e474de2ee0a2f6edec74aab8bb3f24dd92849da9f0a5e5,
  0xa1903eab,
  {0x99c7485e8f6ec45063fad412f5c65b454ba9ce41},
)`;

    const formatted = formatProgram(source, {
      separator: Separator.Space,
      spaces: 2,
      trailingCommas: true,
      width: 80
    });

    expect(formatted).toBe(`let $value = $arg0
in $write(
  0xd66362fd3da0170e26e474de2ee0a2f6edec74aab8bb3f24dd92849da9f0a5e5,
  0xa1903eab,
  { 0x99c7485e8f6ec45063fad412f5c65b454ba9ce41 },
)`);
  });

  it("respects indentation and trailing comma settings", () => {
    const source = `let $value = $arg0
in $write(
  0xd66362fd3da0170e26e474de2ee0a2f6edec74aab8bb3f24dd92849da9f0a5e5,
  0xa1903eab,
  {0x99c7485e8f6ec45063fad412f5c65b454ba9ce41},
)`;

    const formatted = formatProgram(source, {
      separator: Separator.Space,
      spaces: 4,
      trailingCommas: false,
      width: 80
    });

    expect(formatted).toBe(`let $value = $arg0
in $write(
    0xd66362fd3da0170e26e474de2ee0a2f6edec74aab8bb3f24dd92849da9f0a5e5,
    0xa1903eab,
    { 0x99c7485e8f6ec45063fad412f5c65b454ba9ce41 }
)`);
  });
});
