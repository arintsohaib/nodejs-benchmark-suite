import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BenchError } from "../errors/bench-error.js";
import type { ExpandedWorkloadParams, LoadedTemplate } from "./types.js";

function libraryModuleSource(index: number, seed: number, complexity: number): string {
  const lines: string[] = [
    `/** Generated module m${index} (seed=${seed}) */`,
    `export const id_${index} = ${index + seed};`,
  ];
  for (let c = 0; c < complexity; c += 1) {
    lines.push(`export function fn_${index}_${c}(x: number): number { return x + ${index + c}; }`);
  }
  lines.push(`export default id_${index};`, "");
  return lines.join("\n");
}

function nextPageSource(index: number, seed: number, complexity: number): string {
  const helpers: string[] = [];
  for (let c = 0; c < complexity; c += 1) {
    helpers.push(
      `function helper_${index}_${c}(n: number): number { return n + ${index + c + seed}; }`,
    );
  }
  const sumExpr =
    complexity === 0
      ? String(index + seed)
      : Array.from({ length: complexity }, (_, c) => `helper_${index}_${c}(${index})`).join(" + ");
  return [
    `/** Generated page p${index} (seed=${seed}) */`,
    ...helpers,
    `export default function PageP${index}() {`,
    `  const value = ${sumExpr};`,
    `  return <main><h1>page-${index}</h1><p>{value}</p></main>;`,
    "}",
    "",
  ].join("\n");
}

async function stampPackageJson(
  workspacePath: string,
  template: LoadedTemplate,
  params: ExpandedWorkloadParams,
): Promise<void> {
  const pkgPath = join(workspacePath, "package.json");
  const pkgRaw = await readFile(pkgPath, "utf8");
  const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
  pkg["name"] = `jsbench-${template.manifest.id}-s${params.seed}`;
  const jsbenchMeta: Record<string, unknown> = {
    templateId: template.manifest.id,
    size: params.size,
    seed: params.seed,
    fileCount: params.fileCount,
  };
  if (template.manifest.produces.kind === "workspace") {
    jsbenchMeta["packageCount"] = params.packageCount;
  }
  pkg["jsbench"] = jsbenchMeta;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

async function renderLibraryTree(
  workspacePath: string,
  params: ExpandedWorkloadParams,
): Promise<void> {
  const generatedDir = join(workspacePath, "src", "generated");
  await mkdir(generatedDir, { recursive: true });

  const exports: string[] = [];
  for (let i = 0; i < params.fileCount; i += 1) {
    const name = `m${String(i).padStart(3, "0")}`;
    await writeFile(
      join(generatedDir, `${name}.ts`),
      libraryModuleSource(i, params.seed, params.tsComplexity),
      "utf8",
    );
    exports.push(`export { default as ${name} } from "./${name}.js";`);
  }
  await writeFile(join(generatedDir, "index.ts"), `${exports.join("\n")}\n`, "utf8");
}

async function renderNextAppTree(
  workspacePath: string,
  params: ExpandedWorkloadParams,
  templateId: string,
): Promise<void> {
  const genRoot = join(workspacePath, "app", "gen");
  await mkdir(genRoot, { recursive: true });

  const links: string[] = [];
  for (let i = 0; i < params.fileCount; i += 1) {
    const slug = `p${String(i).padStart(3, "0")}`;
    const pageDir = join(genRoot, slug);
    await mkdir(pageDir, { recursive: true });
    await writeFile(
      join(pageDir, "page.tsx"),
      nextPageSource(i, params.seed, params.tsComplexity),
      "utf8",
    );
    links.push(`    <li key="${slug}"><a href="/gen/${slug}">${slug}</a></li>`);
  }

  // Overwrite home page with deterministic index of generated routes.
  await writeFile(
    join(workspacePath, "app", "page.tsx"),
    [
      "/** Generated home (seed-aware route index) */",
      "export default function Home() {",
      "  return (",
      "    <main>",
      `      <h1>jsbench-${templateId}</h1>`,
      "      <ul>",
      ...links,
      "      </ul>",
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

/**
 * Multi-package pnpm workspace: `packages/pkg-NNN` libraries driven by `packageCount` × `fileCount`.
 */
async function renderWorkspaceTree(
  workspacePath: string,
  params: ExpandedWorkloadParams,
): Promise<void> {
  if (params.packageCount < 1) {
    throw new BenchError(
      "VALIDATION_ERROR",
      `Workspace templates require packageCount >= 1 (got ${params.packageCount})`,
      { packageCount: params.packageCount },
    );
  }
  const packagesRoot = join(workspacePath, "packages");
  await mkdir(packagesRoot, { recursive: true });

  for (let p = 0; p < params.packageCount; p += 1) {
    const pkgId = `pkg-${String(p).padStart(3, "0")}`;
    const pkgDir = join(packagesRoot, pkgId);
    const srcDir = join(pkgDir, "src", "generated");
    await mkdir(srcDir, { recursive: true });

    const exports: string[] = [];
    for (let i = 0; i < params.fileCount; i += 1) {
      const name = `m${String(i).padStart(3, "0")}`;
      // Offset module indices by package so content differs across packages.
      const moduleIndex = p * 1000 + i;
      await writeFile(
        join(srcDir, `${name}.ts`),
        libraryModuleSource(moduleIndex, params.seed, params.tsComplexity),
        "utf8",
      );
      exports.push(`export { default as ${name} } from "./${name}.js";`);
    }
    await writeFile(join(srcDir, "index.ts"), `${exports.join("\n")}\n`, "utf8");
    await writeFile(
      join(pkgDir, "src", "index.ts"),
      `export * from "./generated/index.js";\n`,
      "utf8",
    );

    const dependencies: Record<string, string> = {};
    if (p > 0) {
      const prevId = `pkg-${String(p - 1).padStart(3, "0")}`;
      dependencies[`@jsbench/${prevId}`] = "workspace:*";
    }

    const pkgJson: Record<string, unknown> = {
      name: `@jsbench/${pkgId}`,
      version: "0.0.0",
      private: true,
      type: "module",
      main: "./dist/index.js",
      types: "./dist/index.d.ts",
      scripts: {
        build: "tsc -p tsconfig.json",
        typecheck: "tsc -p tsconfig.json --noEmit",
      },
      ...(Object.keys(dependencies).length > 0 ? { dependencies } : {}),
      devDependencies: {
        typescript: "policy:latest-stable",
        "@types/node": "policy:latest-stable",
      },
    };
    await writeFile(join(pkgDir, "package.json"), `${JSON.stringify(pkgJson, null, 2)}\n`, "utf8");
    await writeFile(
      join(pkgDir, "tsconfig.json"),
      `${JSON.stringify(
        {
          extends: "../../tsconfig.base.json",
          compilerOptions: {
            outDir: "dist",
            rootDir: "src",
          },
          include: ["src/**/*.ts"],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
}

/**
 * Copy skeleton/ and emit deterministic generated sources for the template kind.
 */
export async function renderTemplateTree(options: {
  readonly template: LoadedTemplate;
  readonly workspacePath: string;
  readonly params: ExpandedWorkloadParams;
}): Promise<void> {
  const skeletonDir = join(options.template.rootDir, "skeleton");
  await mkdir(options.workspacePath, { recursive: true });
  await cp(skeletonDir, options.workspacePath, { recursive: true });

  const kind = options.template.manifest.produces.kind;
  if (kind === "library") {
    await renderLibraryTree(options.workspacePath, options.params);
  } else if (kind === "application") {
    await renderNextAppTree(options.workspacePath, options.params, options.template.manifest.id);
  } else if (kind === "workspace") {
    await renderWorkspaceTree(options.workspacePath, options.params);
  } else {
    throw new BenchError(
      "VALIDATION_ERROR",
      `Template kind "${kind}" is not supported by the generator renderer`,
      { templateId: options.template.manifest.id, kind },
    );
  }

  await stampPackageJson(options.workspacePath, options.template, options.params);
}
