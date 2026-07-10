import { pathToFileURL } from "node:url";
import { BenchError } from "../errors/bench-error.js";
import type { JsBenchPlugin, PluginModule } from "./types.js";

function isPlugin(value: unknown): value is JsBenchPlugin {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const candidate = value as { id?: unknown };
  return typeof candidate.id === "string" && candidate.id.length > 0;
}

function resolveExport(mod: PluginModule, path: string): JsBenchPlugin {
  const raw = mod.default ?? mod.plugin;
  if (raw === undefined) {
    throw new BenchError("INVALID_CONFIG", `Plugin module must export default or plugin: ${path}`, {
      path,
    });
  }
  const resolved = typeof raw === "function" ? raw() : raw;
  if (!isPlugin(resolved)) {
    throw new BenchError(
      "INVALID_CONFIG",
      `Plugin export must be an object with a non-empty id: ${path}`,
      { path },
    );
  }
  return resolved;
}

/** Dynamically import a local plugin module (absolute or file URL path). */
export async function loadPluginModule(modulePath: string): Promise<JsBenchPlugin> {
  let href: string;
  try {
    href = pathToFileURL(modulePath).href;
  } catch (error) {
    throw new BenchError("INVALID_CONFIG", `Invalid plugin path: ${modulePath}`, {
      path: modulePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  let mod: PluginModule;
  try {
    mod = (await import(href)) as PluginModule;
  } catch (error) {
    throw new BenchError("INVALID_CONFIG", `Failed to load plugin: ${modulePath}`, {
      path: modulePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  return resolveExport(mod, modulePath);
}
