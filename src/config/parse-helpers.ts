import { BenchError } from "../errors/bench-error.js";
import type { LogLevel } from "../logging/logger.js";

const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error", "silent"];

export function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

export function parseLogLevel(value: string): LogLevel {
  if (!isLogLevel(value)) {
    throw new BenchError("INVALID_CONFIG", `Invalid log level: ${value}`, { value });
  }
  return value;
}

export function parseBool(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  throw new BenchError("INVALID_CONFIG", `Invalid boolean env value: ${value}`, { value });
}
