import path from "node:path";
import matter from "gray-matter";
import type { AgentProfile, Component, Finding, SkillComponent } from "../core/types.js";
import { classifyCapability } from "../risk/classifier.js";
import { findFiles } from "../utils/fileWalker.js";
import { compactSnippet, relativePath, stableId } from "../utils/normalize.js";
import { skillInstructionPatterns } from "../utils/patterns.js";
import { readTextFileForScan, skippedMetadata } from "../utils/safeRead.js";

export interface PersonalAgentScanResult {
  components: Component[];
  findings: Finding[];
}

const identityFiles = [
  "**/SOUL.md",
  "**/IDENTITY.md",
  "**/PERSONA.md",
  "**/MEMORY.md",
  "**/AGENTS.md"
];

const personalSkillFiles = [
  "**/skills/**/*.md",
  "**/*.skill.md"
];

export async function scanPersonalAgentSurfaces(root: string, profile: AgentProfile | undefined, extraIgnore: string[] = []): Promise<PersonalAgentScanResult> {
  if (!isPersonalProfile(profile)) {
    return { components: [], findings: [] };
  }
  const activeProfile = profile;

  const identityMatches = await findFiles(root, identityFiles, extraIgnore);
  const skillMatches = [...new Set(await findFiles(root, personalSkillFiles, extraIgnore))]
    .filter((file) => path.basename(file) !== "SKILL.md");

  const components: Component[] = [];
  const findings: Finding[] = [];

  for (const file of identityMatches) {
    const surface = await scanIdentitySurface(root, file, activeProfile);
    components.push(surface.component);
    findings.push(...surface.findings);
  }

  for (const file of skillMatches) {
    const surface = await scanPersonalSkill(root, file, activeProfile);
    components.push(surface.component);
    findings.push(...surface.findings);
  }

  return {
    components: dedupeComponents(components),
    findings
  };
}

function isPersonalProfile(profile: AgentProfile | undefined): profile is "personal-agent" | "openclaw" | "hermes" {
  return profile === "personal-agent" || profile === "openclaw" || profile === "hermes";
}

async function scanIdentitySurface(root: string, file: string, profile: AgentProfile): Promise<{ component: Component; findings: Finding[] }> {
  const relPath = relativePath(root, file);
  const label = path.basename(file);
  const type = label === "MEMORY.md" ? "memory" : label === "AGENTS.md" ? "rule" : "prompt";
  const safeRead = await readTextFileForScan(file);
  const component: Component = {
    id: stableId(type, relPath),
    type,
    label,
    path: relPath,
    metadata: {
      profile,
      surface: type,
      personalAgent: true,
      ...(safeRead.skipped ? skippedMetadata(safeRead.skipped) : {})
    }
  };

  if (safeRead.skipped) {
    return {
      component,
      findings: [{
        id: stableId("finding", `${component.id}-skipped-large-file`),
        componentId: component.id,
        capability: "read_file",
        risk: "low",
        evidence: {
          file: relPath,
          pattern: "skipped:large-file",
          snippet: `Skipped personal-agent file larger than ${safeRead.skipped.maxBytes} bytes`
        }
      }]
    };
  }

  const parsed = matter(safeRead.content ?? "");
  return {
    component,
    findings: scanMarkdownText(root, file, component.id, parsed.content, getBodyStartLine(safeRead.content ?? ""))
  };
}

async function scanPersonalSkill(root: string, file: string, profile: AgentProfile): Promise<{ component: SkillComponent; findings: Finding[] }> {
  const safeRead = await readTextFileForScan(file);
  const content = safeRead.content ?? "";
  const parsed = matter(content);
  const relPath = relativePath(root, file);
  const name = safeRead.skipped ? path.basename(file, path.extname(file)) : readString(parsed.data.name) ?? path.basename(file, path.extname(file));
  const description = safeRead.skipped ? undefined : readString(parsed.data.description);
  const component: SkillComponent = {
    id: stableId("skill", relPath),
    type: "skill",
    label: name,
    path: relPath,
    metadata: {
      name,
      description,
      frontmatter: safeRead.skipped ? {} : Object.fromEntries(Object.entries(parsed.data).sort(([a], [b]) => a.localeCompare(b))),
      referencedFiles: safeRead.skipped ? [] : extractReferencedFiles(parsed.content),
      scripts: [],
      profile,
      personalAgent: true,
      skillFormat: "personal-agent-markdown",
      ...(safeRead.skipped ? skippedMetadata(safeRead.skipped) : {})
    }
  };

  if (safeRead.skipped) {
    return {
      component,
      findings: [{
        id: stableId("finding", `${component.id}-skipped-large-file`),
        componentId: component.id,
        capability: "read_file",
        risk: "low",
        evidence: {
          file: relPath,
          pattern: "skipped:large-file",
          snippet: `Skipped personal skill larger than ${safeRead.skipped.maxBytes} bytes`
        }
      }]
    };
  }

  return {
    component,
    findings: scanMarkdownText(root, file, component.id, parsed.content, getBodyStartLine(content))
  };
}

function scanMarkdownText(root: string, file: string, componentId: string, body: string, bodyStartLine: number): Finding[] {
  const relPath = relativePath(root, file);
  const findings: Finding[] = [];
  const lines = body.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = bodyStartLine + index;
    for (const candidate of skillInstructionPatterns) {
      if (!candidate.regex.test(line)) continue;
      findings.push({
        id: stableId("finding", `${componentId}-${candidate.capability}-${lineNumber}-${candidate.pattern}`),
        componentId,
        capability: candidate.capability,
        risk: classifyCapability(candidate.capability),
        evidence: {
          file: relPath,
          line: lineNumber,
          snippet: compactSnippet(line),
          pattern: candidate.pattern
        }
      });
    }
  });

  return findings;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
  return [...references].sort();
}

function getBodyStartLine(content: string): number {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") return 1;
  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  return closingIndex === -1 ? 1 : closingIndex + 2;
}

function dedupeComponents(components: Component[]): Component[] {
  return [...new Map(components.map((component) => [component.id, component])).values()]
    .sort((a, b) => a.id.localeCompare(b.id));
}
