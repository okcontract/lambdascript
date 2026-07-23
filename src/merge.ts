export const mergeWithFirstPriority = <
  Key extends string | number,
  T extends Record<Key, unknown>
>(
  objects: T[]
): T => {
  const result = {} as Record<Key, unknown>;
  for (const obj of objects) {
    for (const [k, v] of Object.entries(obj) as [Key, unknown][])
      if (result[k] === undefined) result[k] = v;
  }
  return result as T;
};
