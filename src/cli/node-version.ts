import { MIN_NODE_MAJOR } from "./invocation.js";

/** Parse major version from `node --version` output (`v22.22.1` → 22). */
export function parseNodeMajor(version: string): number | undefined {
  const match = version
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)/);
  if (match?.[1] === undefined) {
    return undefined;
  }
  const major = Number.parseInt(match[1], 10);
  return Number.isFinite(major) ? major : undefined;
}

export function isSupportedNodeVersion(version: string): boolean {
  const major = parseNodeMajor(version);
  return major !== undefined && major >= MIN_NODE_MAJOR;
}

export function nodeVersionRequirementDetail(version: string): {
  readonly ok: boolean;
  readonly detail: string;
  readonly fix?: string;
} {
  const major = parseNodeMajor(version);
  if (major === undefined) {
    return {
      ok: false,
      detail: `Could not parse Node.js version from "${version}" (need >= ${MIN_NODE_MAJOR})`,
      fix: `Install Node.js ${MIN_NODE_MAJOR}+ (Active LTS): https://nodejs.org/ — or use nvm/fnm/asdf.`,
    };
  }
  if (major < MIN_NODE_MAJOR) {
    return {
      ok: false,
      detail: `${version} is below the required major ${MIN_NODE_MAJOR}`,
      fix: `Upgrade to Node.js ${MIN_NODE_MAJOR}+ (Active LTS). This process is ${version}. See README “First-time setup (Linux)”.`,
    };
  }
  return {
    ok: true,
    detail: `${version} meets engines (>= ${MIN_NODE_MAJOR})`,
  };
}
