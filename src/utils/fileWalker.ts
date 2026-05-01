import path from "node:path";
import { glob } from "glob";
import { relativePath, toPosixPath } from "./normalize.js";

const ignore = [
  "**/.git/**",
  "**/node_modules/**",
  "**/dist/**",
  "**/coverage/**",
  "**/whattheagent.json",
  "**/whattheagent.graph.json",
  "**/whattheagent.risk-report.md"
];

export async function findFiles(root: string, pattern: string | string[]): Promise<string[]> {
  const matches = await glob(pattern, {
    cwd: root,
    absolute: true,
    nodir: true,
    dot: true,
    ignore
  });

  return matches.sort((a, b) => relativePath(root, a).localeCompare(relativePath(root, b)));
}

export async function findExistingFiles(root: string, relativeFiles: string[]): Promise<string[]> {
  const matches: string[] = [];
  for (const file of relativeFiles) {
    const absolute = path.join(root, file);
    const found = await glob(toPosixPath(file), {
      cwd: root,
      absolute: true,
      nodir: true,
      dot: true,
      ignore
    });
    if (found.includes(absolute)) {
      matches.push(absolute);
    } else if (found.length > 0) {
      matches.push(...found);
    }
  }
  return [...new Set(matches)].sort((a, b) => relativePath(root, a).localeCompare(relativePath(root, b)));
}
