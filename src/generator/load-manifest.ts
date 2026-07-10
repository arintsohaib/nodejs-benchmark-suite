import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { BenchError } from "../errors/bench-error.js";
import { assertValid, createSchemaValidator } from "../schemas/validate.js";
import type { LoadedTemplate, TemplateManifest } from "./types.js";

const manifestValidator = createSchemaValidator<TemplateManifest>("template-manifest.schema.json");

const HERE = dirname(fileURLToPath(import.meta.url));

/** Resolve the suite `templates/` directory from src/ or dist/. */
export function defaultTemplatesDir(cwd: string = process.cwd()): string {
  const candidates = [
    join(cwd, "templates"),
    join(HERE, "..", "..", "templates"),
    join(HERE, "..", "..", "..", "templates"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return join(cwd, "templates");
}

/**
 * Load and validate `templates/<id>/template.manifest.yaml`.
 */
export async function loadTemplateManifest(
  templateId: string,
  options: { readonly templatesDir?: string; readonly cwd?: string } = {},
): Promise<LoadedTemplate> {
  const cwd = options.cwd ?? process.cwd();
  const templatesDir =
    options.templatesDir !== undefined
      ? isAbsolute(options.templatesDir)
        ? options.templatesDir
        : resolve(cwd, options.templatesDir)
      : defaultTemplatesDir(cwd);

  const rootDir = join(templatesDir, templateId);
  const manifestPath = join(rootDir, "template.manifest.yaml");

  let rawText: string;
  try {
    rawText = await readFile(manifestPath, "utf8");
  } catch (error) {
    throw new BenchError(
      "VALIDATION_ERROR",
      `Unknown template "${templateId}" (missing ${manifestPath})`,
      { templateId, manifestPath, templatesDir },
      { cause: error },
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(rawText);
  } catch (error) {
    throw new BenchError(
      "VALIDATION_ERROR",
      `Failed to parse template manifest: ${manifestPath}`,
      { manifestPath },
      { cause: error },
    );
  }

  assertValid(manifestValidator, parsed, "VALIDATION_ERROR", "TemplateManifest");

  if (parsed.id !== templateId) {
    throw new BenchError(
      "VALIDATION_ERROR",
      `Template id mismatch: directory "${templateId}" vs manifest id "${parsed.id}"`,
      { templateId, manifestId: parsed.id },
    );
  }

  return { manifest: parsed, rootDir };
}
