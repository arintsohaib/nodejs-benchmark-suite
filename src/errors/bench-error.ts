/**
 * Process exit codes for the jsbench CLI.
 * @see docs/03_ARCHITECTURE.md §10
 */
export const ExitCode = {
  Success: 0,
  RuntimeError: 1,
  InvalidConfig: 2,
  DoctorFailure: 3,
  StageFailure: 4,
  DockerError: 5,
  PartialFailure: 6,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

export type BenchErrorCode =
  | "INVALID_CONFIG"
  | "INVALID_PROFILE"
  | "PROFILE_NOT_FOUND"
  | "NOT_IMPLEMENTED"
  | "IO_ERROR"
  | "VALIDATION_ERROR"
  | "TOOL_NOT_FOUND"
  | "DOCKER_ERROR"
  | "INTERNAL";

const EXIT_BY_CODE: Record<BenchErrorCode, ExitCode> = {
  INVALID_CONFIG: ExitCode.InvalidConfig,
  INVALID_PROFILE: ExitCode.InvalidConfig,
  PROFILE_NOT_FOUND: ExitCode.InvalidConfig,
  VALIDATION_ERROR: ExitCode.InvalidConfig,
  NOT_IMPLEMENTED: ExitCode.RuntimeError,
  IO_ERROR: ExitCode.RuntimeError,
  TOOL_NOT_FOUND: ExitCode.DoctorFailure,
  DOCKER_ERROR: ExitCode.DockerError,
  INTERNAL: ExitCode.RuntimeError,
};

export class BenchError extends Error {
  readonly code: BenchErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: BenchErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "BenchError";
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }

  toExitCode(): ExitCode {
    return EXIT_BY_CODE[this.code];
  }
}

export function isBenchError(value: unknown): value is BenchError {
  return value instanceof BenchError;
}

export function toExitCode(error: unknown): ExitCode {
  if (isBenchError(error)) {
    return error.toExitCode();
  }
  return ExitCode.RuntimeError;
}
