import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import { BenchError } from "../errors/bench-error.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const validatorCache = new Map<string, ValidateFunction<unknown>>();

/** Resolve schema files from package root whether running from src/ or dist/. */
export function resolveSchemaPath(fileName: string): string {
  const candidates = [
    join(HERE, "..", "..", "schemas", fileName),
    join(process.cwd(), "schemas", fileName),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new BenchError("IO_ERROR", `Unable to locate schema file: ${fileName}`, {
    candidates,
  });
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
  if (errors === undefined || errors === null || errors.length === 0) {
    return "unknown validation error";
  }
  return errors
    .map((err) => {
      const path = err.instancePath === "" ? "/" : err.instancePath;
      return `${path} ${err.message ?? "invalid"}`;
    })
    .join("; ");
}

export function createSchemaValidator<T>(schemaFileName: string): ValidateFunction<T> {
  const cached = validatorCache.get(schemaFileName);
  if (cached !== undefined) {
    return cached as ValidateFunction<T>;
  }

  const schemaPath = resolveSchemaPath(schemaFileName);
  let schema: object;
  try {
    schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;
  } catch (error) {
    throw new BenchError(
      "IO_ERROR",
      `Failed to read schema file: ${schemaPath}`,
      { schemaPath },
      { cause: error },
    );
  }

  // Formats plugin omitted: current schemas do not use JSON Schema "format" keywords.
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    allowUnionTypes: true,
  });
  const validate = ajv.compile(schema) as ValidateFunction<T>;
  validatorCache.set(schemaFileName, validate as ValidateFunction<unknown>);
  return validate;
}

export function assertValid<T>(
  validate: ValidateFunction<T>,
  data: unknown,
  errorCode: "INVALID_CONFIG" | "INVALID_PROFILE" | "VALIDATION_ERROR",
  label: string,
): asserts data is T {
  const ok = validate(data);
  if (!ok) {
    throw new BenchError(
      errorCode,
      `${label} failed schema validation: ${formatAjvErrors(validate.errors)}`,
      { errors: validate.errors ?? [] },
    );
  }
}
