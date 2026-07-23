import {
  type AnyCell,
  type CellArray,
  mapArrayCell,
  type SheetProxy
} from "@okcontract/cells";

export const findCell = <T, NF extends boolean = false>(
  proxy: SheetProxy,
  arr: CellArray<T>,
  predicate: AnyCell<(v: AnyCell<T>) => AnyCell<boolean>>,
  findFunction = Array.prototype.find,
  name = "find",
  nf?: NF
) => {
  const keep = mapArrayCell(proxy, arr, predicate, "keep");
  return proxy.map(
    [arr, keep],
    (cells, _keep) =>
      proxy.mapNoPrevious(_keep, (..._flat) =>
        findFunction.call(cells, (_, i) => _flat[i])
      ),
    name,
    nf
  );
};
