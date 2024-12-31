/**
 * ObjectMap is map for objects, preserving keys.
 * @param fn
 * @param obj
 * @returns
 */
export const ObjectMap = <A, B>(
  fn: (key: string, v: A) => B,
  obj: { [key: string]: A }
): { [key: string]: B } =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(k, v)]));

/**
 * ObjectMapKey is map for objects, with the mapping function generating new keys.
 * @param fn
 * @param obj
 * @returns
 */
export const ObjectMapKey = <A, B>(
  fn: (key: string, v: A) => [string, B],
  obj: { [key: string]: A }
): { [key: string]: B } =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => fn(k, v)));

/**
 * ObjectMapValuesPreserve is map for objects, preserving keys.
 * It returns the original object if no values have changed.
 */
export const ObjectMapValuesPreserve = <A>(
  fn: (v: A) => A,
  obj: { [key: string]: A }
): { [key: string]: A } => {
  let changed = false;
  const newEntries = Object.entries(obj).map(([k, v]) => {
    const newV = fn(v);
    if (!newV) console.log("ObjectMapValuesPreserve", { k, v, newV });
    if (newV !== v) changed = true;
    return [k, newV];
  });
  if (changed) return Object.fromEntries(newEntries);
  return obj;
};

export const ArrayMapPreserve = <A>(fn: (v: A) => A, arr: A[]): A[] => {
  let changed = false;
  const fn2 = (v: A) => {
    const newV = fn(v);
    if (!newV) console.log("ArrayMapPreserve", { v, newV });
    if (newV !== v) changed = true;
    return newV;
  };
  const newArr = arr.map(fn2);
  if (changed) return newArr;
  return arr;
};
