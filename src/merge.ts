export const mergeWithFirstPriority = <
  Key extends string | number,
  T extends Record<Key, unknown>
>(
  objects: T[]
): T => {
  const result = {} as T;
  for (const obj of objects)
    for (const [k, v] of Object.entries(obj))
      if (result[k] === undefined) result[k] = v;
  return result;
};
