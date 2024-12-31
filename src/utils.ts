/**
 * length returns the length of a value.
 * @param value any value (object, array, single value)
 */
export const length = (value: unknown) => {
  if (!value) {
    return 0;
  }
  if (typeof value === "number") return value;
  if (Array.isArray(value)) {
    return value.length;
  }
  if (typeof value === "object") {
    return Object.keys(value).length;
  }
  return 1;
};

/**
 * plural returns a label with "s" if value length is more than 1.
 * Also, display the number (unless _count_ set to false).
 * @param label name of entity
 * @param value any value
 * @param showCount display count (true by default)
 */
export const plural = (label: string, value: unknown, showCount = true) => {
  const l = length(value);
  return `${showCount ? `${l} ` : ""}${label}${l > 1 ? "s" : ""}`;
};
