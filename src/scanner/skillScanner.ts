import path from "node:path";
import type { Finding, SkillComponent } from "../core/types.js";
import { parseSkill } from "../parser/skillParser.js";
import { classifyCapability } from "../risk/classifier.js";
import { findFiles } from "../utils/fileWalker.js";
import { compactSnippet, relativePath, stableId } from "../utils/normalize.js";
import { scriptFilePattern, skillInstructionPatterns } from "../utils/patterns.js";
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

export function skillDirectory(skill: SkillComponent): string {
  return path.dirname(skill.path ?? "");
}
