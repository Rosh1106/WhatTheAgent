import path from "node:path";
import type { Finding, SkillComponent } from "../core/types.js";
import { chunkMarkdown, type Region } from "../parser/regions.js";
import { parseSkill } from "../parser/skillParser.js";
import { classifyCapability } from "../risk/classifier.js";
import { findFiles } from "../utils/fileWalker.js";
import { compactSnippet, relativePath, stableId } from "../utils/normalize.js";
import { scriptFilePattern, scriptPatterns, skillInstructionPatterns, type CapabilityPattern } from "../utils/patterns.js";
import { scanScript, type ScriptScanResult } from "./scriptScanner.js";

export interface SkillScanResult {
  skills: SkillComponent[];
  scripts: ScriptScanResult[];
  findings: Finding[];
}

export async function scanSkills(root: string, extraIgnore: string[] = []): Promise<SkillScanResult> {
  const skillFiles = await findFiles(root, "**/SKILL.md", extraIgnore);
  const skills: SkillComponent[] = [];
  const scripts: ScriptScanResult[] = [];
  const findings: Finding[] = [];

  for (const skillFile of skillFiles) {
    const parsed = await parseSkill(root, skillFile);
    const scriptPaths = await findFiles(parsed.directory, scriptFilePattern, extraIgnore);
    const skillScriptRelPaths = scriptPaths.map((scriptPath) => relativePath(root, scriptPath)).sort();

    parsed.component.metadata.scripts = skillScriptRelPaths;
    skills.push(parsed.component);
    findings.push(...scanSkillInstructions(root, skillFile, parsed.component.id, parsed.body, parsed.bodyStartLine));

    for (const scriptPath of scriptPaths) {
      scripts.push(await scanScript(root, scriptPath, parsed.component.id));
    }
  }

  return { skills, scripts, findings };
}

function scanSkillInstructions(root: string, skillFile: string, componentId: string, body: string, bodyStartLine: number): Finding[] {
  const relPath = relativePath(root, skillFile);
  const findings: Finding[] = [];
  const regions = chunkMarkdown(body);

  for (const region of regions) {
    const patterns = patternsForRegion(region);
    if (patterns.length === 0) continue;
    scanRegion(region, bodyStartLine, patterns).forEach((match) => {
      findings.push({
        id: stableId("finding", `${componentId}-${match.capability}-${match.line}-${match.pattern}`),
        componentId,
        capability: match.capability,
        risk: classifyCapability(match.capability),
        evidence: {
          file: relPath,
          line: match.line,
          snippet: compactSnippet(match.text),
          pattern: match.pattern
        }
      });
    });
  }

  return findings;
}

function patternsForRegion(region: Region): CapabilityPattern[] {
  if (region.kind === "prose") return skillInstructionPatterns;
  if (region.kind === "code") return scriptPatterns;
  return []; // skip comments, strings, inline_code
}

interface RegionMatch {
  capability: CapabilityPattern["capability"];
  pattern: string;
  line: number;
  text: string;
}

function scanRegion(region: Region, bodyStartLine: number, patterns: CapabilityPattern[]): RegionMatch[] {
  const matches: RegionMatch[] = [];
  const lines = region.text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const lineNumber = bodyStartLine + (region.startLine - 1) + i;
    for (const candidate of patterns) {
      if (!candidate.regex.test(line)) continue;
      matches.push({
        capability: candidate.capability,
        pattern: candidate.pattern,
        line: lineNumber,
        text: line
      });
    }
  }
  return matches;
}

export function skillDirectory(skill: SkillComponent): string {
  return path.dirname(skill.path ?? "");
}
