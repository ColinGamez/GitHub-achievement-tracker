/**
 * Utility: deepFreeze
 *
 * Recursively freezes an object so it cannot be mutated at runtime.
 * Useful for configuration and constant objects.
 */

export function deepFreeze<T extends Record<string, unknown>>(obj: T): Readonly<T> {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === "object" && value !== null) {
      deepFreeze(value as Record<string, unknown>);
    }
  }
  return Object.freeze(obj);
}
