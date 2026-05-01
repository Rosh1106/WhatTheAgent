import fs from "node:fs/promises";
import path from "node:path";
import type { Component, Finding } from "../core/types.js";
import { classifyCapability } from "../risk/classifier.js";
import { compactSnippet, relativePath, stableId } from "../utils/normalize.js";
import { scriptPatterns } from "../utils/patterns.js";

export interface ScriptScanResult {
  component: Component;
  findings: Finding[];
}

export async function scanScript(root: string, scriptPath: string, parentId?: string): Promise<ScriptScanResult> {
  const relPath = relativePath(root, scriptPath);
  const label = path.basename(scriptPath);
  const componentId = stableId("script", relPath);
  const content = await fs.readFile(scriptPath, "utf8");
  const findings: Finding[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const candidate of scriptPatterns) {
      if (!candidate.regex.test(line)) continue;
      findings.push({
        id: stableId("finding", `${componentId}-${candidate.capability}-${index + 1}-${candidate.pattern}`),
        componentId,
        capability: candidate.capability,
        risk: classifyCapability(candidate.capability),
        evidence: {
          file: relPath,
          line: index + 1,
          snippet: compactSnippet(line),
          pattern: candidate.pattern
        }
      });
    }
  });

  return {
    component: {
      id: componentId,
      type: "script",
      label,
      path: relPath,
      parentId,
      metadata: {
        extension: path.extname(scriptPath),
        parentId
      }
    },
    findings
  };
}
