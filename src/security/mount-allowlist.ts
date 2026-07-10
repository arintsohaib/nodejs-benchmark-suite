import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import { BenchError } from "../errors/bench-error.js";

/** Host paths that must never be Docker bind-mounted wholesale. */
const FORBIDDEN_EXACT = new Set([
  "/",
  "/etc",
  "/home",
  "/root",
  "/usr",
  "/var",
  "/boot",
  "/dev",
  "/proc",
  "/sys",
  "/opt",
  "/tmp",
]);

/** Prefixes that must never appear as (or contain) a bind mount source. */
const FORBIDDEN_PREFIXES = ["/etc", "/dev", "/proc", "/sys", "/boot", "/root"] as const;

function isPathInside(parent: string, child: string): boolean {
  const root = resolve(parent);
  const target = resolve(child);
  if (target === root) {
    return true;
  }
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  return target.startsWith(prefix);
}

/**
 * Ensure a host path used for Docker bind/populate mounts is under an allowlisted root
 * and is not a sensitive system or home directory.
 */
export function assertSafeHostMountPath(
  hostPath: string,
  options: { readonly allowedRoots: readonly string[] },
): void {
  if (hostPath.trim() === "") {
    throw new BenchError("INVALID_CONFIG", "Docker host mount path must not be empty", {});
  }

  const resolved = resolve(hostPath);

  if (FORBIDDEN_EXACT.has(resolved)) {
    throw new BenchError(
      "INVALID_CONFIG",
      `Docker mount of sensitive host path is forbidden: ${resolved}`,
      { path: resolved },
    );
  }

  for (const prefix of FORBIDDEN_PREFIXES) {
    if (isPathInside(prefix, resolved)) {
      throw new BenchError(
        "INVALID_CONFIG",
        `Docker mount under sensitive host prefix is forbidden: ${resolved}`,
        { path: resolved, prefix },
      );
    }
  }

  const home = resolve(homedir());
  if (resolved === home) {
    throw new BenchError(
      "INVALID_CONFIG",
      "Docker mount of the operator home directory is forbidden",
      { path: resolved },
    );
  }

  const underAllowed = options.allowedRoots.some((root) => isPathInside(root, resolved));
  if (!underAllowed) {
    throw new BenchError(
      "INVALID_CONFIG",
      `Docker host mount path must be under an allowlisted workspace root: ${resolved}`,
      {
        path: resolved,
        allowedRoots: options.allowedRoots.map((r) => resolve(r)),
      },
    );
  }
}
