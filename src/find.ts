import {
  type AnyCell,
  type CellArray,
  type MapCell,
  type SheetProxy,
  collector
} from "@okcontract/cells";

/**
 * mapArrayCell is a variant of `mapArray` with a function taking
 * element cells as arguments.
 * @param proxy
 * @param arr
 * @param fn
 * @returns mapped array cell
 */
export const mapArrayCell = <T, U, NF extends boolean = false>(
  proxy: SheetProxy,
  arr: CellArray<T>,
  fn: AnyCell<(v: AnyCell<T>, idx?: number) => AnyCell<U>>,
  name = "map",
  nf?: NF
): MapCell<MapCell<U, NF>[], NF> => {
  let prevFn: (v: AnyCell<T>) => AnyCell<U>;
  return proxy.map(
    [arr, fn],
    (cells, _fn, prev) => {
      const set = new Set((prev || []).map((cell) => cell.id));
      const arr = cells.map((cell, i) => {
        const reuse =
          _fn === prevFn &&
          prev?.find((_c) => _c.dependencies?.[0] === cell.id);
        if (reuse) {
          set.delete(reuse.id);
          return reuse;
        }
        return _fn(cell, i) as MapCell<U, NF>;
      });
      prevFn = _fn;
      proxy._sheet.collect(...[...set]);
      return arr;
    },
    name,
    nf
  );
};

export const findCell = <T, NF extends boolean = false>(
  proxy: SheetProxy,
  arr: CellArray<T>,
  predicate: AnyCell<(v: AnyCell<T>) => AnyCell<boolean>>,
  findFunction = Array.prototype.find,
  name = "find",
  nf?: NF
) => {
  const keep = mapArrayCell(proxy, arr, predicate, "keep");
  const coll = collector<MapCell<T, NF>>(proxy);
  return proxy.map(
    [arr, keep],
    (cells, _keep) =>
      coll(
        proxy.mapNoPrevious(_keep, (..._flat) =>
          findFunction.call(cells, (_, i) => _flat[i])
        )
      ),
    name,
    nf
  );
};
