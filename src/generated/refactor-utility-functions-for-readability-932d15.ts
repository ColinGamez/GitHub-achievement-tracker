/**
 * Utility: sanitiseInput
 *
 * Strips control characters and trims whitespace.
 * Applied to any user-facing input before it reaches the API.
 */

export function sanitiseInput(raw: string): string {
  return raw.replace(/[\x00-\x1F\x7F]/g, "").trim();
}
