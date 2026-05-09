import fs from "node:fs/promises";
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
    follow: false,
    ignore: combineIgnore(extraIgnore)
  });

  const filtered = await keepOnlyInsideRoot(root, matches);
  return filtered.sort((a, b) => relativePath(root, a).localeCompare(relativePath(root, b)));
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
      follow: false,
      ignore: combineIgnore(extraIgnore)
    });
    if (found.includes(absolute)) {
      matches.push(absolute);
    } else if (found.length > 0) {
      matches.push(...found);
    }
  }
  const deduped = [...new Set(matches)];
  const filtered = await keepOnlyInsideRoot(root, deduped);
  return filtered.sort((a, b) => relativePath(root, a).localeCompare(relativePath(root, b)));
}

// Defense against symlink-escape disclosure: a malicious workspace must not be
// able to make the scanner read files outside the scan root by shipping a
// symlink (e.g. a SKILL.md that points at ~/.ssh/id_rsa). We resolve every
// matched path with fs.realpath and drop anything whose real location escapes
// the resolved scan root. Intra-workspace symlinks (which resolve back inside
// the root) remain scannable.
async function keepOnlyInsideRoot(root: string, matches: string[]): Promise<string[]> {
  if (matches.length === 0) return matches;
  let realRoot: string;
  try {
    realRoot = await fs.realpath(root);
  } catch {
    realRoot = path.resolve(root);
  }
  const realRootWithSep = realRoot.endsWith(path.sep) ? realRoot : `${realRoot}${path.sep}`;

  const inside: string[] = [];
  for (const match of matches) {
    let real: string;
    try {
      real = await fs.realpath(match);
    } catch {
      continue;
    }
    if (real === realRoot || real.startsWith(realRootWithSep)) {
      inside.push(match);
    }
  }
  return inside;
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
