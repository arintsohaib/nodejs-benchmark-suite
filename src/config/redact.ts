/**
 * Redacts environment variable values whose names match deny-list patterns.
 */
export function redactEnvVars(
  env: NodeJS.ProcessEnv,
  patterns: readonly string[],
): Record<string, string> {
  const compiled = patterns.map((pattern) => new RegExp(pattern, "i"));
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      continue;
    }
    const sensitive = compiled.some((re) => re.test(key));
    result[key] = sensitive ? "[REDACTED]" : value;
  }

  return result;
}
