import path from "node:path";
import { glob } from "glob";
import { relativePath, toPosixPath } from "./normalize.js";

const ignore = [
  "**/.git/**",
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.cache/**",
  "**/.venv/**",
  "**/venv/**",
  "**/__pycache__/**",
  "**/.pytest_cache/**",
  "**/.mypy_cache/**",
  "**/.tox/**",
  "**/.gradle/**",
  "**/Library/Caches/**",
  "**/.claude/plugins/cache/**",
  "**/.claude/plugins/marketplaces/**",
  "**/.claude/projects/**",
  "**/.wta/**",
  "**/whattheagent.json",
  "**/whattheagent.graph.json",
  "**/whattheagent.risk-report.md"
];

export async function findFiles(root: string, pattern: string | string[], extraIgnore: string[] = []): Promise<string[]> {
  const matches = await glob(pattern, {
    cwd: root,
    absolute: true,
    nodir: true,
    dot: true,
    ignore: combineIgnore(extraIgnore)
  });

  return matches.sort((a, b) => relativePath(root, a).localeCompare(relativePath(root, b)));
}

export async function findExistingFiles(root: string, relativeFiles: string[], extraIgnore: string[] = []): Promise<string[]> {
  const matches: string[] = [];
  for (const file of relativeFiles) {
    const absolute = path.join(root, file);
    const found = await glob(toPosixPath(file), {
      cwd: root,
      absolute: true,
      nodir: true,
      dot: true,
      ignore: combineIgnore(extraIgnore)
    });
    if (found.includes(absolute)) {
      matches.push(absolute);
    } else if (found.length > 0) {
      matches.push(...found);
    }
  }
  return [...new Set(matches)].sort((a, b) => relativePath(root, a).localeCompare(relativePath(root, b)));
}

function combineIgnore(extra: string[]): string[] {
  if (extra.length === 0) return ignore;
  return [...ignore, ...extra.map(normalizeUserPattern)];
}

export function normalizeUserPattern(pattern: string): string {
  const trimmed = pattern.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes("*") || trimmed.includes("?") || trimmed.includes("[")) return trimmed;
  const stripped = trimmed.replace(/^\.?\//, "").replace(/\/+$/, "");
  return `**/${stripped}/**`;
}
