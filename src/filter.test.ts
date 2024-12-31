import { beforeAll, expect, test } from "vitest";

import {
  type AnyCell,
  Sheet,
  SheetProxy,
  filterPredicateCell
} from "@okcontract/cells";

import { toEqualWithRationals } from "./extend.test";
beforeAll(() => {
  toEqualWithRationals();
});

test("filter array", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const a = proxy.new(1);
  const b = proxy.new(2);
  const c = proxy.new(3);
  const arr = proxy.new([a, b, c]);
  const fn = proxy.new((v: AnyCell<number>) => v.map((_v) => _v > 1));
  const out = filterPredicateCell(proxy, fn, arr);
  // consolidatedValue also working here
  await expect(out.get()).resolves.toEqual([b, c]);
  fn.set((v: AnyCell<number>) => v.map((_v) => _v === 1));
  // here, we must use consolidateValue otherwise get returns the value before update
  expect(out.consolidatedValue).toEqual([a]);
});

test("filter array", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const a = proxy.new(1);
  const b = proxy.new(2);
  const c = proxy.new(3);
  const arr = proxy.new([a, b, c]);
  const fn = proxy.new((v: AnyCell<number>) => v.map((_v) => _v > 1));
  const out = filterPredicateCell(proxy, fn, arr);
  // consolidatedValue also working here
  await expect(out.get()).resolves.toEqual([b, c]);
  a.set(10);
  expect(out.consolidatedValue).toEqual([a, b, c]);
});
