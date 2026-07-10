import { assertValid, createSchemaValidator } from "../schemas/validate.js";
import type { LeaderboardDocument } from "./leaderboard.js";

const validateLeaderboardSchema =
  createSchemaValidator<LeaderboardDocument>("leaderboard.schema.json");

/** Assert `data` matches the Leaderboard JSON Schema (v1). */
export function assertValidLeaderboard(data: unknown): asserts data is LeaderboardDocument {
  assertValid(validateLeaderboardSchema, data, "VALIDATION_ERROR", "Leaderboard");
}

export function isValidLeaderboard(data: unknown): data is LeaderboardDocument {
  return validateLeaderboardSchema(data) === true;
}
