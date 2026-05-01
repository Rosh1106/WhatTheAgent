import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { SkillComponent } from "../core/types.js";
import { relativePath, stableId } from "../utils/normalize.js";

export interface ParsedSkill {
  component: SkillComponent;
  body: string;
  directory: string;
  bodyStartLine: number;
}

export async function parseSkill(root: string, skillFile: string): Promise<ParsedSkill> {
  const content = await fs.readFile(skillFile, "utf8");
  const parsed = matter(content);
  const relPath = relativePath(root, skillFile);
  const directory = path.dirname(skillFile);
  const name = readString(parsed.data.name) ?? path.basename(directory);
  const description = readString(parsed.data.description);
  const referencedFiles = extractReferencedFiles(parsed.content).sort();

  return {
    component: {
      id: stableId("skill", path.dirname(relPath)),
      type: "skill",
      label: name,
      path: relPath,
      metadata: {
        name,
        description,
        frontmatter: stableFrontmatter(parsed.data),
        referencedFiles,
        scripts: []
      }
    },
    body: parsed.content,
    directory,
    bodyStartLine: getBodyStartLine(content)
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stableFrontmatter(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function extractReferencedFiles(body: string): string[] {
  const references = new Set<string>();
  const markdownLinks = body.matchAll(/\[[^\]]*]\(([^)]+)\)/g);
  for (const match of markdownLinks) {
    const target = match[1]?.trim();
    if (target && !/^https?:\/\//i.test(target) && !target.startsWith("#")) {
      references.add(target);
    }
  }

  const inlinePaths = body.matchAll(/(?:^|\s)([\w./-]+\.(?:md|json|ya?ml|txt|py|js|ts|sh))/g);
  for (const match of inlinePaths) {
    if (match[1]) references.add(match[1]);
  }

  return [...references];
}

function getBodyStartLine(content: string): number {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") return 1;
  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  return closingIndex === -1 ? 1 : closingIndex + 2;
}
