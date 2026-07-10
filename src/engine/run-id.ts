import { randomBytes } from "node:crypto";

/**
 * Run id format: `YYYYMMDDThhmmssZ-<short-hex>`
 * @see docs/08_REPORTING.md
 */
export function createRunId(now: Date = new Date()): string {
  const iso = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const suffix = randomBytes(4).toString("hex");
  return `${iso}-${suffix}`;
}
