/**
 * Utility: assertNever
 *
 * Exhaustiveness check for TypeScript discriminated unions.
 * Calling this in a default/else branch guarantees at compile time
 * that every variant has been handled.
 */

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
