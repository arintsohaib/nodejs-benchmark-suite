import { assertValid, createSchemaValidator } from "../schemas/validate.js";
import type { RunArtifact } from "./types.js";

const validateRunArtifactSchema = createSchemaValidator<RunArtifact>("run-artifact.schema.json");

/** Assert `data` matches the RunArtifact JSON Schema (v1). */
export function assertValidRunArtifact(data: unknown): asserts data is RunArtifact {
  assertValid(validateRunArtifactSchema, data, "VALIDATION_ERROR", "RunArtifact");
}

export function isValidRunArtifact(data: unknown): data is RunArtifact {
  return validateRunArtifactSchema(data) === true;
}
