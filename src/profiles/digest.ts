import { createHash } from "node:crypto";

/**
 * Stable digest over a JSON-serializable value using sorted object keys.
 */
export function digestValue(value: unknown): string {
  const canonical = canonicalize(value);
  return createHash("sha256").update(canonical).digest("hex");
}

function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const entry = record[key];
    if (entry !== undefined) {
      sorted[key] = sortKeys(entry);
    }
  }
  return sorted;
}
