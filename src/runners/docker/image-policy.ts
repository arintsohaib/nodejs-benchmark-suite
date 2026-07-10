import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BenchError } from "../../errors/bench-error.js";
import type { DockerCli, ResolvedDockerImage } from "./types.js";

type ImagePinFile = {
  readonly policies: Readonly<Record<string, string>>;
};

const HERE = dirname(fileURLToPath(import.meta.url));

function loadPinFile(explicitPath?: string): ImagePinFile {
  const candidates = [
    ...(explicitPath !== undefined ? [explicitPath] : []),
    join(process.cwd(), "docker", "resolved-images.json"),
    join(HERE, "..", "..", "..", "docker", "resolved-images.json"),
    join(HERE, "..", "..", "..", "..", "docker", "resolved-images.json"),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }
    const parsed = JSON.parse(readFileSync(candidate, "utf8")) as ImagePinFile;
    if (parsed.policies === undefined) {
      throw new BenchError("VALIDATION_ERROR", `Invalid image pin file: ${candidate}`, {
        path: candidate,
      });
    }
    return parsed;
  }
  throw new BenchError("IO_ERROR", "Unable to locate docker/resolved-images.json", { candidates });
}

/**
 * Resolve an imagePolicy alias or `exact:<ref>` to a concrete image reference.
 */
export function resolveImagePolicy(
  imagePolicy: string,
  options: { readonly pinFilePath?: string } = {},
): ResolvedDockerImage {
  if (imagePolicy.startsWith("exact:")) {
    const imageRef = imagePolicy.slice("exact:".length);
    if (imageRef === "") {
      throw new BenchError("INVALID_PROFILE", "exact: image policy is empty", { imagePolicy });
    }
    return { imageRef, imagePolicy };
  }

  const pins = loadPinFile(options.pinFilePath);
  const imageRef = pins.policies[imagePolicy];
  if (imageRef === undefined) {
    throw new BenchError(
      "INVALID_PROFILE",
      `Unknown imagePolicy "${imagePolicy}" (add to docker/resolved-images.json or use exact:<ref>)`,
      { imagePolicy },
    );
  }
  return { imageRef, imagePolicy };
}

export async function ensureImage(options: {
  readonly cli: DockerCli;
  readonly image: ResolvedDockerImage;
  readonly pull: "always" | "if-missing" | "never";
}): Promise<ResolvedDockerImage> {
  const { cli, image, pull } = options;

  if (pull === "always") {
    const pulled = await cli.exec(["pull", image.imageRef], { timeoutMs: 600_000 });
    if (pulled.exitCode !== 0) {
      throw new BenchError("DOCKER_ERROR", `docker pull failed for ${image.imageRef}`, {
        stderr: pulled.stderr.trim(),
        exitCode: pulled.exitCode,
      });
    }
  } else if (pull === "if-missing") {
    const inspect = await cli.exec(["image", "inspect", image.imageRef], { timeoutMs: 30_000 });
    if (inspect.exitCode !== 0) {
      const pulled = await cli.exec(["pull", image.imageRef], { timeoutMs: 600_000 });
      if (pulled.exitCode !== 0) {
        throw new BenchError("DOCKER_ERROR", `docker pull failed for ${image.imageRef}`, {
          stderr: pulled.stderr.trim(),
          exitCode: pulled.exitCode,
        });
      }
    }
  } else {
    const inspect = await cli.exec(["image", "inspect", image.imageRef], { timeoutMs: 30_000 });
    if (inspect.exitCode !== 0) {
      throw new BenchError("DOCKER_ERROR", `Image missing and pull: never — ${image.imageRef}`, {
        imageRef: image.imageRef,
      });
    }
  }

  const digestResult = await cli.exec(
    ["image", "inspect", "--format", "{{index .RepoDigests 0}}", image.imageRef],
    { timeoutMs: 30_000 },
  );
  const digestRaw = digestResult.stdout.trim();
  const imageDigest =
    digestResult.exitCode === 0 && digestRaw.includes("@")
      ? digestRaw.slice(digestRaw.indexOf("@") + 1)
      : undefined;

  return {
    ...image,
    ...(imageDigest !== undefined ? { imageDigest } : {}),
  };
}
