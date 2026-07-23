import { expect, test } from "bun:test";
import type { AnyCell } from "@okcontract/cells";
import { mapArrayCell, Sheet, SheetProxy } from "@okcontract/cells";

test("mapArrayCell does not delete externally retained mapped cells", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const values = proxy.new([proxy.new(1), proxy.new(2)]);
  const fn = proxy.new((cell: AnyCell<number>) =>
    cell.map((value) => value + 1)
  );
  const mapped = mapArrayCell(proxy, values, fn, "mapped");

  const [firstMapped] = await mapped.get();
  const derived = proxy.map([firstMapped], (value) => value * 10);
  await expect(derived.get()).resolves.toBe(20);

  values.set([proxy.new(2)]);
  await proxy.wait();
  sheet.collection();

  const [currentMapped] = await mapped.get();
  expect(currentMapped?.id).not.toBe(firstMapped.id);
  expect(sheet.get(firstMapped.id)).toBeDefined();
  expect(sheet.get(derived.id)).toBeDefined();
});
