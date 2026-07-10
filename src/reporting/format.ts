/** Shared formatting helpers for Markdown/HTML reporters. */

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(1);
}

export function formatBytes(totalBytes: number): string {
  const gib = totalBytes / 1024 ** 3;
  return `${gib.toFixed(1)} GiB`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Truncate text for report embedding (logs / long warnings).
 * Keeps head and a short tail when over the limit.
 */
export function truncateText(text: string, maxChars = 4000): string {
  const limit = maxChars < 32 ? 32 : maxChars;
  if (text.length <= limit) {
    return text;
  }
  const marker = `\n…[truncated ${text.length - limit} chars]…\n`;
  const budget = Math.max(limit - marker.length, 8);
  const head = Math.ceil(budget * 0.75);
  const tail = Math.max(budget - head, 1);
  return `${text.slice(0, head)}${marker}${text.slice(-tail)}`;
}

/** Prefill citation blurb for external publishing (no winner claims). */
export function renderCitationBlock(options: {
  readonly suiteVersion: string;
  readonly runId: string;
  readonly profileId: string;
  readonly profileDigest: string;
  readonly mode: string;
}): string {
  return [
    "## Citation",
    "",
    "When citing these results, include at least:",
    "",
    `- Suite version: \`${options.suiteVersion}\``,
    `- Run id: \`${options.runId}\``,
    `- Profile: \`${options.profileId}\` (digest \`${options.profileDigest}\`)`,
    `- Runner mode: ${options.mode}`,
    "- Hardware / OS summary from the Environment section",
    "- Cold/warm and network policy from the profile stages",
    "- Attach or link the immutable `run.json` for this run",
    "",
    "Do not claim package-manager or hardware “winners” from a single run.",
    "",
  ].join("\n");
}
