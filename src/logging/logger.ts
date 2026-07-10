export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  readonly level: LogLevel;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  silent: 100,
  error: 40,
  warn: 30,
  info: 20,
  debug: 10,
};

function shouldLog(configured: LogLevel, attempted: LogLevel): boolean {
  if (configured === "silent") {
    return false;
  }
  return LEVEL_RANK[attempted] >= LEVEL_RANK[configured];
}

function write(
  stream: NodeJS.WritableStream,
  level: Exclude<LogLevel, "silent">,
  message: string,
  fields: LogFields | undefined,
  base: LogFields,
): void {
  const payload = {
    level,
    msg: message,
    time: new Date().toISOString(),
    ...base,
    ...(fields ?? {}),
  };
  stream.write(`${JSON.stringify(payload)}\n`);
}

export interface CreateLoggerOptions {
  readonly level?: LogLevel;
  readonly fields?: LogFields;
  /** Stream for debug/info. Defaults to stderr. */
  readonly stdout?: NodeJS.WritableStream;
  /** Stream for warn/error. Defaults to stderr. */
  readonly stderr?: NodeJS.WritableStream;
}

class JsonLogger implements Logger {
  readonly level: LogLevel;
  private readonly base: LogFields;
  private readonly stdout: NodeJS.WritableStream;
  private readonly stderr: NodeJS.WritableStream;

  constructor(options: CreateLoggerOptions = {}) {
    this.level = options.level ?? "info";
    this.base = options.fields ?? {};
    this.stdout = options.stdout ?? process.stderr;
    this.stderr = options.stderr ?? process.stderr;
  }

  debug(message: string, fields?: LogFields): void {
    if (shouldLog(this.level, "debug")) {
      write(this.stdout, "debug", message, fields, this.base);
    }
  }

  info(message: string, fields?: LogFields): void {
    if (shouldLog(this.level, "info")) {
      write(this.stdout, "info", message, fields, this.base);
    }
  }

  warn(message: string, fields?: LogFields): void {
    if (shouldLog(this.level, "warn")) {
      write(this.stderr, "warn", message, fields, this.base);
    }
  }

  error(message: string, fields?: LogFields): void {
    if (shouldLog(this.level, "error")) {
      write(this.stderr, "error", message, fields, this.base);
    }
  }

  child(fields: LogFields): Logger {
    return new JsonLogger({
      level: this.level,
      fields: { ...this.base, ...fields },
      stdout: this.stdout,
      stderr: this.stderr,
    });
  }
}

/** Structured JSON logger. Progress/info go to stderr by default so stdout stays pipe-friendly. */
export function createLogger(options?: CreateLoggerOptions): Logger {
  return new JsonLogger(options);
}
