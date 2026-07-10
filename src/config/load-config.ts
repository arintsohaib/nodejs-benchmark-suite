import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { BenchError } from "../errors/bench-error.js";
import { assertValid, createSchemaValidator } from "../schemas/validate.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import { mergeConfig } from "./merge.js";
import { parseBool, parseLogLevel } from "./parse-helpers.js";
import type { JsBenchConfig, JsBenchConfigPartial, LoadConfigOptions } from "./types.js";

const configValidator = createSchemaValidator<JsBenchConfigPartial>("jsbench-config.schema.json");

const ENV_PREFIX = "JSBENCH_";

function expandHome(pathValue: string): string {
  if (pathValue === "~") {
    return homedir();
  }
  if (pathValue.startsWith("~/")) {
    return join(homedir(), pathValue.slice(2));
  }
  return pathValue;
}

function resolvePath(baseDir: string, pathValue: string): string {
  const expanded = expandHome(pathValue);
  return isAbsolute(expanded) ? expanded : resolve(baseDir, expanded);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadYamlObject(path: string): Promise<unknown> {
  try {
    const raw = await readFile(path, "utf8");
    return parseYaml(raw);
  } catch (error) {
    throw new BenchError(
      "IO_ERROR",
      `Failed to read config file: ${path}`,
      { path },
      { cause: error },
    );
  }
}

function envOverrides(env: NodeJS.ProcessEnv): JsBenchConfigPartial {
  const partial: {
    outputDir?: string;
    workspaceRoot?: string;
    defaultRunner?: "native" | "docker";
    strictDoctor?: boolean;
    profilesDir?: string;
    logLevel?: ReturnType<typeof parseLogLevel>;
    redactEnv?: readonly string[];
    toolchains?: { node?: string };
  } = {};

  const outputDir = env[`${ENV_PREFIX}OUTPUT_DIR`];
  if (outputDir !== undefined && outputDir !== "") {
    partial.outputDir = outputDir;
  }

  const workspaceRoot = env[`${ENV_PREFIX}WORKSPACE_ROOT`];
  if (workspaceRoot !== undefined && workspaceRoot !== "") {
    partial.workspaceRoot = workspaceRoot;
  }

  const profilesDir = env[`${ENV_PREFIX}PROFILES_DIR`];
  if (profilesDir !== undefined && profilesDir !== "") {
    partial.profilesDir = profilesDir;
  }

  const defaultRunner = env[`${ENV_PREFIX}DEFAULT_RUNNER`];
  if (defaultRunner === "native" || defaultRunner === "docker") {
    partial.defaultRunner = defaultRunner;
  } else if (defaultRunner !== undefined && defaultRunner !== "") {
    throw new BenchError("INVALID_CONFIG", `Invalid ${ENV_PREFIX}DEFAULT_RUNNER: ${defaultRunner}`);
  }

  const strictDoctor = env[`${ENV_PREFIX}STRICT_DOCTOR`];
  if (strictDoctor !== undefined && strictDoctor !== "") {
    partial.strictDoctor = parseBool(strictDoctor);
  }

  const logLevel = env[`${ENV_PREFIX}LOG_LEVEL`];
  if (logLevel !== undefined && logLevel !== "") {
    partial.logLevel = parseLogLevel(logLevel);
  }

  const nodePolicy = env[`${ENV_PREFIX}NODE_POLICY`];
  if (nodePolicy !== undefined && nodePolicy !== "") {
    partial.toolchains = { node: nodePolicy };
  }

  const redact = env[`${ENV_PREFIX}REDACT_ENV`];
  if (redact !== undefined && redact !== "") {
    partial.redactEnv = redact
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  return partial;
}

function resolveConfigPaths(config: JsBenchConfig, baseDir: string): JsBenchConfig {
  return {
    ...config,
    outputDir: resolvePath(baseDir, config.outputDir),
    workspaceRoot: resolvePath(baseDir, config.workspaceRoot),
    profilesDir: resolvePath(baseDir, config.profilesDir),
    plugins: config.plugins.map((pluginPath) => resolvePath(baseDir, pluginPath)),
  };
}

/**
 * Load suite configuration with precedence:
 * CLI flags > env vars > project config > user config > built-in defaults.
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<JsBenchConfig> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;

  const userConfigPath = join(
    env["XDG_CONFIG_HOME"] ?? join(homedir(), ".config"),
    "jsbench",
    "config.yaml",
  );
  const explicitConfigPath = options.configPath;
  const projectConfigPath = explicitConfigPath ?? join(cwd, "jsbench.config.yaml");

  let userPartial: JsBenchConfigPartial | undefined;
  if (await fileExists(userConfigPath)) {
    const raw = await loadYamlObject(userConfigPath);
    assertValid(configValidator, raw, "INVALID_CONFIG", "User config");
    userPartial = raw;
  }

  let projectPartial: JsBenchConfigPartial | undefined;
  if (await fileExists(projectConfigPath)) {
    const raw = await loadYamlObject(projectConfigPath);
    assertValid(configValidator, raw, "INVALID_CONFIG", "Project config");
    projectPartial = raw;
  } else if (explicitConfigPath !== undefined) {
    throw new BenchError("INVALID_CONFIG", `Config file not found: ${projectConfigPath}`, {
      path: projectConfigPath,
    });
  }

  const merged = mergeConfig(
    DEFAULT_CONFIG,
    userPartial,
    projectPartial,
    envOverrides(env),
    options.cliOverrides,
  );

  return resolveConfigPaths(merged, cwd);
}
