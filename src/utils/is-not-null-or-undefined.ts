export function isNullOrUndefined<T>(value: T | null | undefined): value is null | undefined {
  return typeof value === "undefined" || value === null;
}

export function isNotNullOrUndefined<T>(value: T | null | undefined): value is T {
  return !isNullOrUndefined(value);
}
